import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const ignore = new Set(['node_modules', '.git', 'playwright-report', 'test-results', 'reports']);
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes:true })) {
    if (ignore.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (/\.(?:js|mjs|cjs)$/.test(entry.name)) files.push(full);
  }
}
await walk(root);
let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding:'utf8' });
  if (result.status !== 0) { failed += 1; console.error(result.stderr || result.stdout); }
}
if (failed) process.exit(1);
console.log(`Syntax check passed: ${files.length} JavaScript files.`);
