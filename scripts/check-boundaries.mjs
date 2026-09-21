import { readdir, readFile } from 'node:fs/promises';
import ts from 'typescript';

async function files(root) {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const paths = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? files(`${root}/${entry.name}`)
        : /\.[cm]?[jt]sx?$/.test(entry.name)
          ? [`${root}/${entry.name}`]
          : [],
    ),
  );
  return paths.flat();
}
const violations = [];
for (const file of [...(await files('app/api')), ...(await files('lib/ai'))]) {
  const source = ts.createSourceFile(
    file,
    await readFile(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const path = node.moduleSpecifier?.text ?? '';
      if (/firebase(-admin)?\/(firestore|app)|data\/client/.test(path))
        violations.push(
          `${file}: raw Firebase/client data access is forbidden in server routes and AI`,
        );
      if (/data\/admin\/items/.test(path)) {
        const bindings = node.importClause?.namedBindings;
        if (
          !bindings ||
          !ts.isNamedImports(bindings) ||
          bindings.elements.some(
            (entry) => !['getItem', 'listItems'].includes((entry.propertyName ?? entry.name).text),
          )
        )
          violations.push(
            `${file}: only getItem/listItems imports are allowed from the Admin item adapter`,
          );
      }
    }
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        node.expression.getText(source) === 'require')
    )
      violations.push(`${file}: dynamic module imports cannot bypass the item-write boundary`);
    ts.forEachChild(node, visit);
  }
  visit(source);
}
const admin = ts.createSourceFile(
  'lib/data/admin/items.ts',
  await readFile('lib/data/admin/items.ts', 'utf8'),
  ts.ScriptTarget.Latest,
  true,
);
for (const node of admin.statements) {
  if (
    node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) &&
    (!ts.isFunctionDeclaration(node) ||
      !['getItem', 'listItems', 'applyProposal'].includes(node.name?.text))
  )
    violations.push('Admin items adapter may export only getItem, listItems and applyProposal.');
}
if (violations.length) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else
  console.log('Item-write import boundary passed. No AI or API route can import item mutations.');
