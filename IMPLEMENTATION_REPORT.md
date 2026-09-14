# Web Worlds v0.27 — Implementation Report

## Release goal

v0.27 turns the v0.26 engineering scaffold into a stronger production/full-stack signal while preserving the existing Web Worlds experiences. The static frontend remains framework-free; persistent online scores are an optional service rather than a gameplay dependency.

## Frontend changes

- added a reusable timeout-aware leaderboard API client
- added desktop and mobile Brick Breaker leaderboard panels
- completed runs are saved locally before submission and remain retryable after network failure
- desktop and mobile runs use separate modes because their maximum scores differ
- clear time is recorded to break equal-score ties without changing the existing visible scoring system
- added shared bounded runtime incident recording
- Three.js and Matter.js fallback paths now report degraded state to the shared runtime diagnostics

## Backend architecture

Cloudflare Worker + D1:

- `GET /api/health`
- `GET /api/scores`
- `POST /api/scores`

The Worker validates body shape, display name, mode, completion score, duration, request size, browser origin, and basic submission rate. D1 writes use bound parameters. Health checks expose only coarse Worker/database state.

## D1 schema

`worker/migrations/0001_scores.sql` creates `scores` with:

- integer primary key
- display name
- score
- mode
- completion duration
- UTC creation timestamp
- composite ranking index

## Automated evidence generated in this artifact

- JavaScript syntax: verified
- deterministic unit tests: 17 passing
- Worker/API tests: 14 passing
- local href/src references: verified by `scripts/check-links.mjs`
- release source sizes: generated from the actual release tree

Playwright, axe, ESLint, Lighthouse, and cross-browser checks remain configured for installed-dependency/CI execution. Their results are not represented as passing merely because the configuration exists.

## Accessibility

Existing v0.26 keyboard, semantic-control, focus, reduced-motion, and axe infrastructure is retained. The leaderboard adds labeled name inputs, explicit buttons, live status/result regions, and does not require online availability to use the game.

## Performance

The frontend change is deliberately small. No additional animation loop is introduced by the leaderboard. Network requests occur only for leaderboard refresh/submit/health behavior. Existing Tunnel and 3D performance strategies remain untouched.

Lighthouse values remain unmeasured in this artifact until a reproducible audit is executed.

## Security hardening

- existing nosniff, framing, referrer, and permission restrictions retained
- permissions policy expanded
- report-only CSP added based on actual local/CDN/connect requirements
- Worker CORS restricts browser origins
- body size and result limits added
- prepared D1 statements used for writes/queries
- no secrets or production database identifiers are included

The placeholder D1 ID in `wrangler.jsonc` must be replaced after creating the real database.

## Failure isolation

- leaderboard/API failure does not stop Brick Breaker
- pending run remains local after failed submission
- D1 failure is surfaced as degraded health rather than fabricated healthy state
- missing Worker configuration shows deployment pending
- 3D and physics dependency fallbacks stay isolated to their routes

## CI/CD

GitHub Actions now runs unit and Worker/API suites as separate readable steps before browser/accessibility gates. Cloudflare Pages remains the frontend deployment. Worker/D1 deployment is documented separately through Wrangler.

## Intentionally deferred

- production Worker/D1 deployment, because account-specific IDs/endpoints cannot be truthfully invented in the source artifact
- live Lighthouse values until run in a reproducible environment
- strict enforcing CSP until the report-only policy is reviewed on the deployed site
- formal WCAG certification
- authentication/user accounts, because they do not serve the product

## Regression posture

The v0.27 work deliberately avoids rewriting the mature Playground, Lab, Tunnel, Room, or 3D systems. The full-stack feature is attached at the edges through events and an isolated client module so the working v0.26 product remains the behavioral baseline.
