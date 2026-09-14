const test = require('node:test');
const assert = require('node:assert/strict');
const { createLeaderboardClient, formatDuration, LeaderboardError } = require('../../lib/leaderboard-client.js');

test('formatDuration presents short and minute-scale runs', () => {
  assert.equal(formatDuration(42100), '42s');
  assert.equal(formatDuration(125000), '2:05');
});

test('client stays explicitly unconfigured without an API base', async () => {
  const client = createLeaderboardClient({ baseUrl:'', fetchImpl:async () => { throw new Error('should not run'); } });
  assert.equal(client.configured, false);
  await assert.rejects(client.health(), (error) => error instanceof LeaderboardError && error.code === 'not-configured');
});

test('client requests mode-scoped leaderboard data', async () => {
  let requested = '';
  const client = createLeaderboardClient({ baseUrl:'https://worker.example/api', fetchImpl:async (url) => {
    requested = url;
    return new Response(JSON.stringify({ mode:'brick-breaker', scores:[] }), { status:200, headers:{ 'content-type':'application/json' } });
  }});
  const result = await client.getScores('brick-breaker', 8);
  assert.equal(result.mode, 'brick-breaker');
  assert.match(requested, /\/scores\?mode=brick-breaker&limit=8$/);
});

test('client exposes structured API failures', async () => {
  const client = createLeaderboardClient({ baseUrl:'https://worker.example/api', fetchImpl:async () => new Response(JSON.stringify({ error:'Too many score submissions.' }), { status:429, headers:{ 'content-type':'application/json' } }) });
  await assert.rejects(client.submitScore({}), (error) => error instanceof LeaderboardError && error.status === 429 && error.code === 'rate-limited');
});
