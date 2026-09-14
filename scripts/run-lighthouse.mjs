import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const root = process.cwd();
const port = 4174;
const server = spawn(process.execPath, ['scripts/static-server.mjs', String(port)], { cwd:root, stdio:['ignore','pipe','inherit'] });
const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('QA server did not start')), 10_000);
  server.stdout.on('data', (chunk) => { if (String(chunk).includes('QA server')) { clearTimeout(timer); resolve(); } });
});

let chrome;
try {
  await ready;
  chrome = await chromeLauncher.launch({ chromeFlags:['--headless','--no-sandbox','--disable-gpu'] });
  const routes = [
    { name:'home', path:'/' },
    { name:'engineering', path:'/engineering/' },
    { name:'tunnel', path:'/tunnel/' }
  ];
  await mkdir(path.join(root,'reports/lighthouse'), { recursive:true });
  const summaries = [];
  for (const route of routes) {
    const result = await lighthouse(`http://127.0.0.1:${port}${route.path}`, {
      port:chrome.port,
      output:'json',
      logLevel:'error',
      onlyCategories:['performance','accessibility','best-practices','seo']
    });
    const json = result.lhr;
    await writeFile(path.join(root,`reports/lighthouse/${route.name}.json`), JSON.stringify(json, null, 2));
    summaries.push({
      route:route.path,
      performance:Math.round(json.categories.performance.score * 100),
      accessibility:Math.round(json.categories.accessibility.score * 100),
      bestPractices:Math.round(json.categories['best-practices'].score * 100),
      seo:Math.round(json.categories.seo.score * 100)
    });
  }
  await writeFile(path.join(root,'reports/lighthouse/summary.json'), JSON.stringify(summaries,null,2)+'\n');
  console.table(summaries);
  console.log('Lighthouse reports are CI/local evidence. Commit release metrics only after reviewing them.');
} finally {
  if (chrome) await chrome.kill();
  server.kill();
}
