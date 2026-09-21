import { existsSync, readdirSync } from 'node:fs';
import { resolve, delimiter } from 'node:path';
import { spawn } from 'node:child_process';
const javaRoot = resolve('.tools/java');
if (!process.env.JAVA_HOME && existsSync(javaRoot)) {
  const runtime = readdirSync(javaRoot).find((name) => name.startsWith('jdk-'));
  if (runtime) {
    process.env.JAVA_HOME = resolve(javaRoot, runtime);
    process.env.PATH = resolve(javaRoot, runtime, 'bin') + delimiter + process.env.PATH;
  }
}
const args = [
  resolve('node_modules/firebase-tools/lib/bin/firebase.js'),
  'emulators:start',
  '--project',
  'demo-mitos',
  '--only',
  'auth,firestore',
  '--export-on-exit',
  '.emulator-data',
];
if (existsSync('.emulator-data/firebase-export-metadata.json'))
  args.push('--import', '.emulator-data');
const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  env: { ...process.env, FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
