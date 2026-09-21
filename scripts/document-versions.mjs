import { readFile, writeFile } from 'node:fs/promises';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const snapshot = JSON.parse(await readFile('docs/registry-versions.json', 'utf8'));
snapshot.selectedVersions = { ...pkg.dependencies, ...pkg.devDependencies };
snapshot.overrides = pkg.overrides;
snapshot.compatibilityNotes = [
  'ESLint 9.39.5 is the newest npm-registry ESLint 9; Next lint plugins reject ESLint 10.',
  'TypeScript 6.0.3 is the newest stable registry version below typescript-eslint’s <6.1 constraint.',
  '@types/node 24.13.6 matches the Node 24 runtime instead of using Node 26 types.',
  'Firebase Admin 13.10.0 is the newest npm-registry 13.x release. Admin 14.4.0 fails on Vercel because jwks-rsa 4 requires ESM-only jose 6 while require(ESM) is disabled. CI checks this runtime constraint.',
  'Firebase Admin transitive uuid is overridden to registry-verified 11.1.1, the patched dual CJS/ESM release; its consumers use the compatible v4 API. This avoids GHSA-w5hq-g745-h8pq without an ESM-only override.',
  'npm install resolved the exact package-lock.json; npm ls confirms installed versions.',
];
await writeFile('docs/registry-versions.json', JSON.stringify(snapshot, null, 2) + '\n');
const versionSection = `## Resolved versions

Read directly from the npm registry on ${snapshot.resolvedAt.slice(0, 10)}; exact
pins and the lockfile are authoritative. Newest-compatible, not blindly newest:
ESLint 9 and TypeScript 6 satisfy Next's transitive lint-plugin peer constraints.
Firebase Admin 13.10.0 is the newest compatible 13.x release, rechecked in npm
on 2026-09-21. Admin 14.4.0 crashes on Vercel through jwks-rsa 4 requiring jose 6
when require(ESM) is disabled. CI reproduces that runtime setting explicitly.
Within Firebase Admin only, uuid is pinned to registry-verified **11.1.1** to
include the buffer-bounds security fix while retaining CommonJS support.
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
