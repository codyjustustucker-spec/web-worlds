const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../../lib/core-utils.js');

test('normalizeTheme accepts all supported themes', () => {
  for (const theme of ['cool','cute','royal','scary']) assert.equal(core.normalizeTheme(theme), theme);
});
test('normalizeTheme safely falls back to cool', () => assert.equal(core.normalizeTheme('neon'), 'cool'));
test('clamp enforces both bounds', () => {
  assert.equal(core.clamp(-10, 0, 5), 0); assert.equal(core.clamp(3, 0, 5), 3); assert.equal(core.clamp(10, 0, 5), 5);
});
test('safeInteger parses numeric strings and falls back safely', () => {
  assert.equal(core.safeInteger('42'), 42); assert.equal(core.safeInteger('nope', 7), 7);
});
test('formatBytes provides readable source-size output', () => {
  assert.equal(core.formatBytes(512), '512 B'); assert.equal(core.formatBytes(2048), '2.0 KB');
});
test('normalizeQualityStatus rejects decorative success values', () => {
  assert.equal(core.normalizeQualityStatus('pass'), 'pass'); assert.equal(core.normalizeQualityStatus('perfect'), 'pending');
});
