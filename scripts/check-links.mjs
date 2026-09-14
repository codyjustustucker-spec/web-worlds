import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const htmlFiles = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes:true })) {
    if (['node_modules','.git','playwright-report','test-results','reports'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.name.endsWith('.html')) htmlFiles.push(full);
  }
}
await walk(root);
const attrPattern = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
let checked = 0;
const failures = [];
for (const file of htmlFiles) {
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(attrPattern)) {
    const value = match[1].trim();
    if (!value || value.startsWith('#') || /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(value)) continue;
    const clean = value.split('#')[0].split('?')[0];
    let target = clean.startsWith('/') ? path.join(root, clean) : path.resolve(path.dirname(file), clean);
    checked += 1;
    try {
      let info = await stat(target);
      if (info.isDirectory()) { target = path.join(target, 'index.html'); info = await stat(target); }
      if (!info.isFile()) failures.push(`${path.relative(root,file)} -> ${value}`);
    } catch { failures.push(`${path.relative(root,file)} -> ${value}`); }
  }
}
if (failures.length) {
  console.error('Broken local references:\n' + failures.map((x) => `  - ${x}`).join('\n'));
  process.exit(1);
}
console.log(`Link check passed: ${checked} local href/src references across ${htmlFiles.length} HTML files.`);
