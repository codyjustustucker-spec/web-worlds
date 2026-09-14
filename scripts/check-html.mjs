import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes:true })) {
    if (['node_modules','.git','playwright-report','test-results','reports'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.name.endsWith('.html')) files.push(full);
  }
}
await walk(root);

const failures = [];
for (const file of files) {
  const rel = path.relative(root, file);
  const html = await readFile(file, 'utf8');
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((m) => m[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) failures.push(`${rel}: duplicate id(s): ${[...new Set(duplicates)].join(', ')}`);
  if (!/<main\b[^>]*\bid=["']main["']/i.test(html)) failures.push(`${rel}: missing <main id="main">`);
  if (!/class=["'][^"']*skip-link[^"']*["'][^>]*href=["']#main["']/i.test(html) && !/href=["']#main["'][^>]*class=["'][^"']*skip-link/i.test(html)) failures.push(`${rel}: missing skip link to #main`);
  for (const match of html.matchAll(/<button\b([^>]*)>/gi)) {
    if (!/\btype=["'](?:button|submit|reset)["']/i.test(match[1])) failures.push(`${rel}: button missing explicit type near ${match[0].slice(0,80)}`);
  }
  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    if (!/\balt=["'][^"']*["']/i.test(match[1])) failures.push(`${rel}: img missing alt attribute`);
  }
  const themeGroups = [...html.matchAll(/class=["'][^"']*theme-switch[^"']*["'][^>]*>/gi)];
  for (const group of themeGroups) {
    if (!/aria-label=/i.test(group[0]) && !/role=["']group["']/i.test(group[0])) failures.push(`${rel}: theme switcher missing accessible group semantics`);
  }
}

if (failures.length) {
  console.error(`HTML structural audit failed (${failures.length}):\n${failures.map((item) => `  - ${item}`).join('\n')}`);
  process.exit(1);
}
console.log(`HTML structural audit passed: ${files.length} pages, no duplicate ids, missing main/skip targets, implicit buttons, or unlabeled images.`);
