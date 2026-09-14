# Web Worlds Score API

Web Worlds v0.27 adds one deliberately small backend service: a Cloudflare Worker with D1 persistence for completed Brick Breaker runs.

The network feature is optional. Playground gameplay never depends on the API.

## Endpoints

### `GET /api/health`

Runs a lightweight `SELECT 1` against D1 and returns Worker/database state.

Example:

```json
{"status":"ok","worker":"ok","database":"ok","latencyMs":3}
```

The endpoint exposes health state only. It does not return binding names, account identifiers, stack traces, or database metadata.

### `GET /api/scores?mode=brick-breaker&limit=10`

Returns the fastest completed runs for one allowed mode. `limit` is clamped to `1..25`.

Supported modes:

- `brick-breaker` — desktop field, 320-point complete run
- `brick-breaker-mobile` — mobile field, 150-point complete run

Equal scores are ranked by lower completion time, then earlier creation time.

### `POST /api/scores`

Expected JSON:

```json
{
  "displayName": "Cody",
  "score": 320,
  "mode": "brick-breaker",
  "durationMs": 42120
}
```

The Worker validates the display name, allowed mode, exact completion score, plausible duration, JSON/body size, origin, and a best-effort per-isolate submission rate limit. SQL writes use bound parameters.

## Failure model

The client stores a completed run locally before attempting network submission. If the Worker, D1, or network is unavailable, the run remains retryable and Brick Breaker continues to work normally.

## Local and production setup

1. `npm install`
2. Create a D1 database: `npx wrangler d1 create web-worlds-scores`
3. Replace the placeholder `database_id` in `wrangler.jsonc` with the returned ID.
4. Apply migrations locally with `npm run worker:migrate:local`.
5. Run the Worker with `npm run worker:dev`.
6. Apply production migrations with `npm run worker:migrate:remote`.
7. Deploy with `npm run worker:deploy`.
8. Set `siteConfig.backend.apiBase` in `config.js` to the deployed Worker URL ending in `/api`.

For production, update `ALLOWED_ORIGIN` in `wrangler.jsonc` if the frontend moves to a custom domain.

## Automated tests

`npm run test:api` uses an in-memory D1-compatible test double. It does not touch the production database.
