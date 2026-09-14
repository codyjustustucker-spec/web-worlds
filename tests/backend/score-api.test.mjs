import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, validateScorePayload, normalizeDisplayName } from '../../worker/src/index.mjs';

class FakeStatement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async all() {
    if (this.db.failReads) throw new Error('db read unavailable');
    if (!this.sql.includes('FROM scores')) return { results: [] };
    const [mode, limit] = this.values;
    const rows = this.db.rows.filter((row) => row.mode === mode)
      .sort((a,b) => b.score - a.score || a.duration_ms - b.duration_ms || a.created_at.localeCompare(b.created_at))
      .slice(0, limit);
    return { results: rows };
  }
  async run() {
    if (!this.sql.includes('INSERT INTO scores')) throw new Error('unsupported SQL');
    const [display_name, score, mode, duration_ms] = this.values;
    const id = this.db.rows.length + 1;
    this.db.rows.push({ id, display_name, score, mode, duration_ms, created_at: `2026-09-14T00:00:${String(id).padStart(2,'0')}Z` });
    return { meta: { last_row_id: id } };
  }
  async first() {
    if (this.db.failHealth) throw new Error('db unavailable');
    return { ok: 1 };
  }
}

class FakeDB {
  constructor() { this.rows = []; this.failHealth = false; this.failReads = false; }
  prepare(sql) { return new FakeStatement(this, sql); }
}

const env = () => ({ DB: new FakeDB(), ALLOWED_ORIGIN:'https://web-worlds.pages.dev', ENVIRONMENT:'test' });
const req = (path, init={}) => new Request(`https://api.example${path}`, init);

async function body(response) { return response.json(); }

test('display names are normalized without accepting markup characters', () => {
  assert.equal(normalizeDisplayName('  Cody   Cat  '), 'Cody Cat');
  assert.equal(normalizeDisplayName('<script>'), null);
});

test('score validation accepts a completed desktop run', () => {
  const result = validateScorePayload({ displayName:'Cody', score:320, mode:'brick-breaker', durationMs:45000 });
  assert.equal(result.ok, true);
});

test('score validation rejects impossible desktop scores', () => {
  const result = validateScorePayload({ displayName:'Cody', score:999999, mode:'brick-breaker', durationMs:45000 });
  assert.equal(result.ok, false);
});

test('score validation rejects incomplete runs', () => {
  const result = validateScorePayload({ displayName:'Cody', score:300, mode:'brick-breaker', durationMs:45000 });
  assert.equal(result.ok, false);
});

test('health route reports worker and database state', async () => {
  const response = await handleRequest(req('/api/health'), env());
  assert.equal(response.status, 200);
  const data = await body(response);
  assert.equal(data.worker, 'ok');
  assert.equal(data.database, 'ok');
});

test('health route degrades honestly when D1 fails', async () => {
  const testEnv = env(); testEnv.DB.failHealth = true;
  const response = await handleRequest(req('/api/health'), testEnv);
  const data = await body(response);
  assert.equal(data.status, 'degraded');
  assert.equal(data.database, 'unavailable');
});

test('valid score submission persists a row', async () => {
  const testEnv = env();
  const response = await handleRequest(req('/api/scores', {
    method:'POST',
    headers:{ 'content-type':'application/json', 'cf-connecting-ip':'10.0.0.1' },
    body:JSON.stringify({ displayName:'Cody', score:320, mode:'brick-breaker', durationMs:42000 })
  }), testEnv);
  assert.equal(response.status, 201);
  assert.equal(testEnv.DB.rows.length, 1);
});

test('malformed JSON returns 400', async () => {
  const response = await handleRequest(req('/api/scores', {
    method:'POST', headers:{ 'content-type':'application/json', 'cf-connecting-ip':'10.0.0.2' }, body:'{' 
  }), env());
  assert.equal(response.status, 400);
});

test('unsupported mode is rejected', async () => {
  const response = await handleRequest(req('/api/scores', {
    method:'POST', headers:{ 'content-type':'application/json', 'cf-connecting-ip':'10.0.0.3' },
    body:JSON.stringify({ displayName:'Cody', score:320, mode:'orbital-pong', durationMs:42000 })
  }), env());
  assert.equal(response.status, 400);
});

test('leaderboard sorts equal scores by faster duration', async () => {
  const testEnv = env();
  testEnv.DB.rows.push(
    { id:1, display_name:'Slow', score:320, mode:'brick-breaker', duration_ms:70000, created_at:'2026-09-14T00:00:01Z' },
    { id:2, display_name:'Fast', score:320, mode:'brick-breaker', duration_ms:30000, created_at:'2026-09-14T00:00:02Z' }
  );
  const response = await handleRequest(req('/api/scores?mode=brick-breaker&limit=10'), testEnv);
  const data = await body(response);
  assert.deepEqual(data.scores.map((row) => row.displayName), ['Fast','Slow']);
});

test('leaderboard limit is capped at 25', async () => {
  const testEnv = env();
  for (let i=0;i<40;i++) testEnv.DB.rows.push({ id:i+1, display_name:`Player ${i}`, score:320, mode:'brick-breaker', duration_ms:30000+i, created_at:`2026-09-14T00:00:${String(i).padStart(2,'0')}Z` });
  const response = await handleRequest(req('/api/scores?mode=brick-breaker&limit=999'), testEnv);
  const data = await body(response);
  assert.equal(data.scores.length, 25);
});

test('disallowed browser origin is blocked', async () => {
  const response = await handleRequest(req('/api/health', { headers:{ origin:'https://evil.example' } }), env());
  assert.equal(response.status, 403);
});


test('score submissions are rate limited after five attempts per minute per isolate', async () => {
  const testEnv = env();
  const send = () => handleRequest(req('/api/scores', {
    method:'POST', headers:{ 'content-type':'application/json', 'cf-connecting-ip':'10.0.9.9' },
    body:JSON.stringify({ displayName:'Rate Test', score:320, mode:'brick-breaker', durationMs:42000 })
  }), testEnv);
  for (let i=0;i<5;i++) assert.equal((await send()).status, 201);
  assert.equal((await send()).status, 429);
});

test('database read failures return a structured service-unavailable response', async () => {
  const testEnv = env(); testEnv.DB.failReads = true;
  const response = await handleRequest(req('/api/scores?mode=brick-breaker'), testEnv);
  assert.equal(response.status, 503);
  assert.equal((await body(response)).error, 'Service temporarily unavailable.');
});
