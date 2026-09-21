import { readFile, writeFile } from 'node:fs/promises';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const snapshot = JSON.parse(await readFile('docs/registry-versions.json', 'utf8'));
snapshot.selectedVersions = { ...pkg.dependencies, ...pkg.devDependencies };
snapshot.compatibilityNotes = [
  'ESLint 9.39.5 is the newest npm-registry ESLint 9; Next lint plugins reject ESLint 10.',
  'TypeScript 6.0.3 is the newest stable registry version below typescript-eslint’s <6.1 constraint.',
  '@types/node 24.13.6 matches the Node 24 runtime instead of using Node 26 types.',
  'npm install resolved the exact package-lock.json; npm ls confirms installed versions.',
];
await writeFile('docs/registry-versions.json', JSON.stringify(snapshot, null, 2) + '\n');
const versionSection = `## Resolved versions

Read directly from the npm registry on ${snapshot.resolvedAt.slice(0, 10)}; exact
pins and the lockfile are authoritative. Newest-compatible, not blindly newest:
ESLint 9 and TypeScript 6 satisfy Next's transitive lint-plugin peer constraints.
Registry evidence and initial latest metadata: docs/registry-versions.json.

| Package | Resolved version |
| --- | --- |
${Object.entries(snapshot.selectedVersions)
  .map(([name, version]) => `| ${name} | ${version} |`)
  .join('\n')}

`;
const documentation = await readFile('CLAUDE.md', 'utf8');
if (!/## Resolved versions\r?\n[\s\S]*?(?=## File map)/.test(documentation))
  throw new Error('CLAUDE.md version section was not found');
await writeFile(
  'CLAUDE.md',
  documentation.replace(/## Resolved versions\r?\n[\s\S]*?(?=## File map)/, versionSection),
);
