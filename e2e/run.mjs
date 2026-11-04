// Builds the app with the test "sign in" switched on, starts the test server and runs every
// browser test in e2e/tests one after the other. Exits with an error if anything failed.
//
//   npm run e2e                  everything
//   npm run e2e -- phone sorting only the tests whose name contains one of these words
//
// E2E_CHROMIUM=/path/to/chrome   use this browser instead of the one Playwright installed
// E2E_SKIP_BUILD=1               reuse the last build in .e2e-dist
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const filters = process.argv.slice(2);
const PORT = process.env.E2E_PORT ?? '4190';
const BASE = `http://127.0.0.1:${PORT}`;

if (!process.env.E2E_SKIP_BUILD) {
  console.log('building the app for the tests…');
  const build = spawnSync('npx', ['vite', 'build', '--outDir', '.e2e-dist', '--emptyOutDir'], {
    env: { ...process.env, VITE_FAKE_AUTH: '1' },
    stdio: 'inherit',
  });
  if (build.status !== 0) process.exit(1);
}

const server = spawn('node', ['e2e/server.mjs'], { env: { ...process.env, E2E_ROOT: '.e2e-dist', E2E_PORT: PORT }, stdio: 'inherit' });
const stop = () => server.kill();
process.on('exit', stop);
process.on('SIGINT', () => process.exit(130));

for (let i = 0; i < 50; i += 1) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {
    /* not up yet */
  }
  await new Promise((r) => setTimeout(r, 200));
}

const files = readdirSync('e2e/tests')
  .filter((f) => f.endsWith('.e2e.mjs'))
  .filter((f) => filters.length === 0 || filters.some((w) => f.includes(w)))
  .sort();

const run = (file) =>
  new Promise((resolve) => {
    const child = spawn('node', [`e2e/tests/${file}`], { env: process.env });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    const timer = setTimeout(() => child.kill('SIGKILL'), 5 * 60_000);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ out, code });
    });
  });

let failedTests = 0;
for (const file of files) {
  const started = Date.now();
  const { out, code } = await run(file);
  const lines = out.split('\n');
  const ok = lines.filter((l) => l.startsWith('OK')).length;
  const fails = lines.filter((l) => l.startsWith('FAIL'));
  const errors = lines.find((l) => l.startsWith('errors:')) ?? 'errors: (the test did not finish)';
  const clean = code === 0 && fails.length === 0 && errors === 'errors: none' && ok > 0;
  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(`${clean ? '✓' : '✗'} ${file.replace('.e2e.mjs', '').padEnd(22)} ${String(ok).padStart(2)} ok · ${fails.length} failed · ${seconds}s`);
  if (!clean) {
    failedTests += 1;
    for (const l of fails) console.log(`    ${l}`);
    if (errors !== 'errors: none') console.log(`    ${errors}`);
    if (code !== 0 || ok === 0) console.log(out.split('\n').slice(-25).map((l) => `    | ${l}`).join('\n'));
  }
}

console.log(failedTests === 0 ? `\nall ${files.length} browser tests passed` : `\n${failedTests} of ${files.length} browser tests FAILED`);
process.exit(failedTests === 0 ? 0 : 1);
