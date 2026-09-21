// No accidental deployment from the default demo project or an ordinary npm gate.
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
try {
  loadEnvFile('.env.local');
} catch {
  /* CI may supply environment directly. */
}
const project = process.env.FIREBASE_PROJECT_ID;
if (!process.argv.includes('--approved') || !project || project.startsWith('demo-')) {
  throw new Error(
    'Cloud deployment is blocked. Obtain Andrew’s approval, configure a real FIREBASE_PROJECT_ID, then explicitly pass --approved.',
  );
}
const emails = (process.env.ALLOWED_EMAILS ?? '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
if (
  emails.length !== 2 ||
  emails.some(
    (email) => !/^[^\s@'\\]+@[^\s@'\\]+\.[^\s@'\\]+$/.test(email) || email.endsWith('.test'),
  )
)
  throw new Error('Configure Andrew and Karen’s two real allowlisted emails.');
const rules = (await readFile('firestore.rules', 'utf8')).replace(
  "['andrew@mitos.test', 'karen@mitos.test']",
  JSON.stringify(emails),
);
await mkdir('.tools/deploy', { recursive: true });
await writeFile('.tools/deploy/firestore.rules', rules);
await writeFile(
  '.tools/deploy/firebase.json',
  JSON.stringify({
    firestore: { rules: 'firestore.rules', indexes: '../../firestore.indexes.json' },
  }),
);
const cli = resolve('node_modules/firebase-tools/lib/bin/firebase.js');
const result = spawnSync(
  process.execPath,
  [
    cli,
    'deploy',
    '--only',
    'firestore:rules,firestore:indexes',
    '--project',
    project,
    '--config',
    '.tools/deploy/firebase.json',
  ],
  { stdio: 'inherit' },
);
process.exitCode = result.status ?? 1;
