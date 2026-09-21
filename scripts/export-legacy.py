"""Read-only export of the legacy app's effective loader data; never imports app.py."""
import argparse
import ast
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


def export(source: Path, output: Path):
    app_file = source / 'app.py'
    code = app_file.read_text(encoding='utf-8')
    tree = ast.parse(code)
    defaults = next(ast.literal_eval(node.value) for node in tree.body
                    if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'DEFAULT_DAYS' for t in node.targets))
    data_dir = source / 'data'
    # Execute only the app's read functions. Replace its mkdir-on-read helper
    # with a pure path join so exporting cannot touch the source.
    names = {'_read_json', 'load_projects', 'load_planner_days', 'load_planner_checked', 'load_list_tasks', 'load_list_config'}
    functions = ast.Module(body=[node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in names], type_ignores=[])
    namespace = {'json': json, 'fcntl': None, 'DEFAULT_DAYS': defaults,
                 'PROJECTS_FILE': data_dir / 'projects.json',
                 '_project_dir': lambda kind, slug: data_dir / kind / slug}
    exec(compile(functions, str(app_file), 'exec'), namespace)
    records, manifest = [], []
    projects = namespace['load_projects']()
    seen = set()
    sources = [(p['type'], p.get('slug', p['id'])) for p in projects]
    for expected in [('list', 'personal-projects'), ('list', 'home-projects'), ('list', 'santa-rosa-202603'), ('planner', 'santa-rosa-202603'), ('planner', 'wine-tasting')]:
        if expected not in sources:
            sources.append(expected)
    for kind, slug in sources:
        if (kind, slug) in seen:
            continue
        seen.add((kind, slug))
        if '/' in slug or '\\' in slug or slug in {'.', '..'}:
            raise ValueError('Unsafe source slug')
        fields = [('tasks', 'load_list_tasks'), ('config', 'load_list_config')] if kind == 'list' else [('days', 'load_planner_days'), ('checked', 'load_planner_checked')]
        record = {'kind': kind, 'slug': slug}
        for field, loader in fields:
            path = data_dir / kind / slug / f'{field}.json'
            value = namespace[loader](slug)
            status = 'from source file' if path.exists() else 'from DEFAULT_DAYS' if kind == 'planner' and slug == 'santa-rosa-202603' and field == 'days' else 'no source file; empty'
            if path.exists():
                # Never silently accept the legacy loader's corrupt-file fallback.
                json.loads(path.read_text(encoding='utf-8'))
            count = len(value)
            record[field] = value
            manifest.append({'source': f'{kind}/{slug}/{field}', 'count': count, 'status': status,
                             'sha256': hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None})
        records.append(record)
    payload = {'formatVersion': 1, 'exportedAt': datetime.now(timezone.utc).isoformat(),
               'sourcePath': str(source.resolve()), 'sourceKind': 'local snapshot',
               'appSha256': hashlib.sha256(app_file.read_bytes()).hexdigest(),
               'projects': projects, 'records': records, 'manifest': manifest}
    output.mkdir(parents=True, exist_ok=True)
    (output / 'legacy-export.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    rows = ['# Legacy export manifest', '', f'Exported: {payload["exportedAt"]}', f'Source: {source.resolve()}',
            '', '**Local snapshot only. Not verified against the live Pi. No source was modified.**', '',
            '| Source | Records | Status |', '| --- | ---: | --- |']
    rows += [f'| {r["source"]} | {r["count"]} | {r["status"]} |' for r in manifest]
    rows += ['', 'Task counts are task records; days counts are day objects. Full timed blocks and checked state are preserved in JSON.',
             '', 'Manual verification and a fresh Pi export remain required before any retirement. Flask and its tunnel are unchanged.']
    (output / 'MANIFEST.md').write_text('\n'.join(rows) + '\n', encoding='utf-8')
    print('\n'.join(rows))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('legacy'))
    args = parser.parse_args()
    export(args.source, args.output)
