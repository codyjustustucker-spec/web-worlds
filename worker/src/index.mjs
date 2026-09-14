const MODES = Object.freeze({
  'brick-breaker': Object.freeze({ maxScore: 320, minDurationMs: 4000, maxDurationMs: 900000 }),
  'brick-breaker-mobile': Object.freeze({ maxScore: 150, minDurationMs: 3000, maxDurationMs: 900000 })
});

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 5;
const rateBuckets = new Map();

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders
    }
  });
}

function parseAllowedOrigins(value = '') {
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function isLocalOrigin(origin) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin');
  if (!origin) return {};
  const allowed = parseAllowedOrigins(env.ALLOWED_ORIGIN || '');
  if (allowed.includes(origin) || isLocalOrigin(origin)) {
    return {
      'access-control-allow-origin': origin,
      'vary': 'Origin',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'Content-Type'
    };
  }
  return null;
}

function normalizeDisplayName(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > 20) return null;
  if (!/^[\p{L}\p{N} _.'\-♡♛☾]+$/u.test(name)) return null;
  return name;
}

function validateScorePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'Body must be a JSON object.' };
  }
  const mode = typeof payload.mode === 'string' ? payload.mode : '';
  const rules = MODES[mode];
  if (!rules) return { ok: false, error: 'Unsupported game mode.' };

  const displayName = normalizeDisplayName(payload.displayName);
  if (!displayName) return { ok: false, error: 'Display name must be 1–20 simple characters.' };

  const score = Number(payload.score);
  if (!Number.isInteger(score) || score < 0 || score > rules.maxScore || score % 10 !== 0) {
    return { ok: false, error: 'Score is outside the valid range for this mode.' };
  }
  if (score !== rules.maxScore) {
    return { ok: false, error: 'Only completed Brick Breaker runs can be submitted.' };
  }

  const durationMs = Number(payload.durationMs);
  if (!Number.isInteger(durationMs) || durationMs < rules.minDurationMs || durationMs > rules.maxDurationMs) {
    return { ok: false, error: 'Run duration is outside the valid range.' };
  }

  return { ok: true, value: { displayName, score, mode, durationMs } };
}

function requestIdentity(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'anonymous';
}

function checkRateLimit(request, now = Date.now()) {
  if (rateBuckets.size > 1000) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (now - bucket.startedAt >= RATE_WINDOW_MS) rateBuckets.delete(bucketKey);
    }
  }
  const key = requestIdentity(request);
  const existing = rateBuckets.get(key);
  if (!existing || now - existing.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }
  existing.count += 1;
  if (existing.count > RATE_LIMIT) return { allowed: false, remaining: 0 };
  return { allowed: true, remaining: RATE_LIMIT - existing.count };
}

async function readJsonBody(request) {
  const type = request.headers.get('content-type') || '';
  if (!type.toLowerCase().includes('application/json')) throw new ResponseError(415, 'Content-Type must be application/json.');
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > 2048) throw new ResponseError(413, 'Request body is too large.');
  const text = await request.text();
  if (text.length > 2048) throw new ResponseError(413, 'Request body is too large.');
  try { return JSON.parse(text); }
  catch { throw new ResponseError(400, 'Malformed JSON.'); }
}

class ResponseError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function getScores(env, url) {
  const mode = url.searchParams.get('mode') || 'brick-breaker';
  if (!MODES[mode]) throw new ResponseError(400, 'Unsupported game mode.');
  const requestedLimit = Number.parseInt(url.searchParams.get('limit') || '10', 10);
  const limit = Math.min(25, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 10));
  const result = await env.DB.prepare(`
    SELECT id, display_name, score, mode, duration_ms, created_at
    FROM scores
    WHERE mode = ?1
    ORDER BY score DESC, duration_ms ASC, created_at ASC
    LIMIT ?2
  `).bind(mode, limit).all();
  return {
    mode,
    scores: (result.results || []).map((row) => ({
      id: row.id,
      displayName: row.display_name,
      score: row.score,
      mode: row.mode,
      durationMs: row.duration_ms,
      createdAt: row.created_at
    }))
  };
}

async function postScore(request, env) {
  const rate = checkRateLimit(request);
  if (!rate.allowed) throw new ResponseError(429, 'Too many score submissions. Try again shortly.');
  const payload = await readJsonBody(request);
  const validation = validateScorePayload(payload);
  if (!validation.ok) throw new ResponseError(400, validation.error);
  const value = validation.value;
  const result = await env.DB.prepare(`
    INSERT INTO scores (display_name, score, mode, duration_ms)
    VALUES (?1, ?2, ?3, ?4)
  `).bind(value.displayName, value.score, value.mode, value.durationMs).run();
  return {
    ok: true,
    id: result.meta?.last_row_id ?? null,
    score: value
  };
}

async function health(env) {
  const started = Date.now();
  try {
    const row = await env.DB.prepare('SELECT 1 AS ok').first();
    return {
      status: row?.ok === 1 ? 'ok' : 'degraded',
      worker: 'ok',
      database: row?.ok === 1 ? 'ok' : 'degraded',
      latencyMs: Date.now() - started
    };
  } catch {
    return {
      status: 'degraded',
      worker: 'ok',
      database: 'unavailable',
      latencyMs: Date.now() - started
    };
  }
}

async function handleRequest(request, env) {
  const cors = corsHeaders(request, env);
  if (cors === null) return json({ error: 'Origin is not allowed.' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const url = new URL(request.url);
  try {
    if (url.pathname === '/api/health' && request.method === 'GET') return json(await health(env), 200, cors);
    if (url.pathname === '/api/scores' && request.method === 'GET') return json(await getScores(env, url), 200, cors);
    if (url.pathname === '/api/scores' && request.method === 'POST') return json(await postScore(request, env), 201, cors);
    return json({ error: 'Not found.' }, 404, cors);
  } catch (error) {
    if (error instanceof ResponseError) return json({ error: error.message }, error.status, cors);
    if (env.ENVIRONMENT !== 'test') console.error('Web Worlds score API failure', error);
    return json({ error: 'Service temporarily unavailable.' }, 503, cors);
  }
}

export { MODES, RATE_LIMIT, normalizeDisplayName, validateScorePayload, checkRateLimit, handleRequest };

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  }
};
