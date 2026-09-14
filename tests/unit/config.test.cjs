const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function loadConfig() {
  const source = fs.readFileSync(path.join(__dirname, '../../config.js'), 'utf8');
  const context = { window:{} };
  vm.createContext(context); vm.runInContext(source, context);
  return context.window.siteConfig;
}

test('release version is v0.27', () => assert.equal(loadConfig().version, '0.27'));
test('route ids are unique', () => {
  const ids = loadConfig().routes.map((route) => route.id);
  assert.equal(new Set(ids).size, ids.length);
});
test('engineering route is registered after about', () => {
  const ids = loadConfig().routes.map((route) => route.id);
  assert.equal(ids.at(-2), 'about'); assert.equal(ids.at(-1), 'engineering');
});
test('theme copy defines all four variants for engineering hero', () => {
  const item = loadConfig().themeCopy['engineering.title'];
  assert.deepEqual(Object.keys(item).sort(), ['cool','cute','royal','scary']);
});
