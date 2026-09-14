const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../engineering/data', name), 'utf8'));

test('release snapshot identifies the matching release', () => {
  const release = read('release.json'); assert.equal(release.version, '0.27');
});
test('unmeasured Lighthouse values are represented as null, never fake scores', () => {
  const q = read('quality.json');
  for (const key of ['performance','accessibility','bestPractices','seo']) assert.ok(q.lighthouse[key] === null || Number.isFinite(q.lighthouse[key]));
});
test('quality checks use recognized states', () => {
  const q = read('quality.json'); const allowed = new Set(['pass','warn','fail','pending','info']);
  q.checks.forEach((check) => assert.ok(allowed.has(check.status)));
});
