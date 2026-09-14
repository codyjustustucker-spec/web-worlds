# Architecture

## Runtime

Web Worlds intentionally keeps the browser runtime simple:

```text
Browser
  ├─ static HTML
  ├─ route CSS
  ├─ vanilla JavaScript
  ├─ Three.js on /3d/
  └─ Matter.js on /room/
```

The production frontend does not require a JavaScript framework or bundler.

## Optional full-stack path

v0.27 adds one failure-isolated network feature:

```text
Brick Breaker
   ↓ completed run saved locally
leaderboard-client.js
   ↓ HTTPS JSON
Cloudflare Worker
   ↓ bound/prepared SQL
D1
```

If any network layer fails, Brick Breaker remains playable and the pending run remains local for retry.

## Shared browser layers

- `config.js` — release, routes, theme copy, backend endpoint configuration
- `script.js` — navigation, themes, ambient behavior, diagnostics
- `lib/core-utils.js` — deterministic shared utilities
- `lib/runtime-status.js` — bounded runtime incident recording and opt-in degraded-state notices
- `lib/leaderboard-client.js` — timeout-aware score API client with typed failure states

Route-specific simulations remain route-specific. v0.27 deliberately avoids turning every behavior into a shared abstraction.

## Backend

- `worker/src/index.mjs` — Cloudflare Worker request handling and validation
- `worker/migrations/0001_scores.sql` — D1 schema/index
- `wrangler.jsonc` — deployment binding template
- `tests/backend/` — deterministic Worker/API tests using a local test double

## Delivery

```text
local change
  ↓
lint / syntax / unit / API tests
  ↓
Playwright + axe
  ↓
GitHub main
  ├─ Cloudflare Pages → static frontend
  └─ documented Wrangler deploy → Worker + D1
```

The Worker is deployed separately so backend changes cannot make the static site impossible to serve.
