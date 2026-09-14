const base = new URL(process.env.WEB_WORLDS_URL || 'https://web-worlds.pages.dev/');
const targets = [
  '/', '/playground/', '/3d/', '/lab/', '/room/', '/tunnel/', '/about/', '/engineering/',
  '/assets/icons/favicon.svg', '/engineering/data/release.json', '/engineering/data/quality.json'
];

const results = [];
for (const target of targets) {
  const url = new URL(target.replace(/^\//,''), base);
  const started = performance.now();
  try {
    const response = await fetch(url, { redirect:'follow', headers:{ 'User-Agent':'web-worlds-production-smoke/0.27' } });
    results.push({ target, status:response.status, ok:response.ok, ms:Math.round(performance.now()-started) });
  } catch (error) {
    results.push({ target, status:'ERR', ok:false, ms:Math.round(performance.now()-started), error:error.message });
  }
}
console.table(results.map(({target,status,ok,ms}) => ({ target,status,ok,ms })));
const failed = results.filter((item) => !item.ok);
if (failed.length) {
  console.error(`Production smoke failed for ${failed.length} target(s).`);
  process.exit(1);
}
const apiBase = (process.env.WEB_WORLDS_API_BASE || '').replace(/\/$/, '');
if (apiBase) {
  const started = performance.now();
  try {
    const response = await fetch(`${apiBase}/health`, { headers:{ 'User-Agent':'web-worlds-production-smoke/0.27' } });
    const body = await response.json().catch(() => ({}));
    const ok = response.ok && body.worker === 'ok' && body.database === 'ok';
    console.log(`Backend health: ${ok ? 'PASS' : 'FAIL'} (${Math.round(performance.now()-started)} ms)`);
    if (!ok) process.exit(1);
  } catch (error) {
    console.error('Backend health check failed:', error.message);
    process.exit(1);
  }
} else {
  console.log('Backend smoke skipped: WEB_WORLDS_API_BASE is not configured for this workflow.');
}
console.log(`Production smoke passed: ${results.length}/${results.length} frontend targets healthy.`);
