# Changelog

## v0.27 — Production Hardening + Full-Stack Proof

- added optional Cloudflare Worker + D1 Brick Breaker leaderboard
- added 17 frontend/unit tests plus 14 deterministic Worker/API tests without production database access
- added server-side validation, prepared SQL, CORS controls, body/result limits, structured errors, and best-effort rate limiting
- added local preservation/retry behavior so network failure never blocks Brick Breaker
- added live Worker/D1 health states to the Engineering page, with honest deployment-pending behavior before configuration
- added release-history evidence for deterministic test count and tracked source size
- added shared runtime incident recording and explicit 3D/Room dependency reporting
- added report-only CSP inventory plus expanded defensive response headers
- upgraded CI to separate unit and API quality gates
- expanded architecture, testing, performance, API, README, and deployment documentation
- retained v0.26 visual/game behavior as the regression baseline

## v0.26 — Engineering Foundation + Proof

- Added `/engineering/` as a data-driven technical case-study and live-health page.
- Added versioned release/quality/history JSON with explicit unknown states for unmeasured metrics.
- Added shared deterministic utility helpers and unit tests.
- Added Playwright route, theme, interaction, mobile, and reduced-motion coverage.
- Added axe-core accessibility scans for every major route.
- Added local link validation and JavaScript syntax validation.
- Added ESLint configuration and npm quality scripts.
- Added GitHub Actions critical-quality, cross-browser smoke, and daily deployed-route smoke jobs.
- Added Dependabot configuration for npm and GitHub Actions.
- Added EditorConfig, Node version pinning, and Git LF normalization for cleaner cross-platform development.
- Added custom 404, sitemap, canonical/Open Graph metadata, and conservative Cloudflare response headers.
- Added reduced-motion CSS guard and labeled theme-control groups.
- Added tablet navigation fallback for the expanded eight-route navigation.
- Added architecture, testing, and performance documentation plus an expanded engineering README.
- Preserved the v0.25 games, themes, Room simulation, 3D scene, Tunnel behavior, and static Cloudflare Pages deployment model.

## v0.25 — Functional Base

- Locked the polished functional baseline used to begin the production-engineering phase.
- Finished readability/panel tuning and Home orbit cleanup.
- Split Tunnel rendering into richer mobile and smoothness-first desktop profiles.
