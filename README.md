# Web Worlds — v0.27

**Production Hardening + Full-Stack Proof**

Web Worlds is an interactive browser playground built to show that a polished web product can be technically serious without becoming visually generic. It combines themed interfaces, games, simulations, physics, 3D, responsive interaction design, automated quality tooling, CI, and an optional serverless score service.

**Live frontend:** https://web-worlds.pages.dev

## What it demonstrates

- start-to-finish product design and implementation
- responsive vanilla HTML/CSS/JavaScript architecture
- four persistent visual themes
- custom browser game and simulation logic
- Three.js and Matter.js integration
- automated unit, API, browser, link, and accessibility testing
- GitHub Actions quality workflows
- measured release evidence and an in-product Engineering dashboard
- graceful failure isolation
- Cloudflare Pages deployment
- Cloudflare Worker API design
- D1 schema/migrations and persistence
- validation, CORS, basic rate limiting, structured errors, and prepared SQL

## Routes

- `/` — world map/home
- `/playground/` — interactive puzzles and Brick Breaker
- `/3d/` — customizable Three.js chamber
- `/lab/` — isolated browser mechanics
- `/room/` — Matter.js creature habitat
- `/tunnel/` — performance-sensitive spatial descent
- `/about/` — creator/project context
- `/engineering/` — architecture, testing, accessibility, performance, reliability, delivery, and live health evidence

## Full-stack feature

Brick Breaker can submit completed runs to a Cloudflare Worker + D1 leaderboard. The browser saves the run locally first. If the service is unavailable, gameplay still works and the run remains retryable.

The source artifact ships with `siteConfig.backend.apiBase` blank on purpose. This keeps the dashboard honest until the Worker is actually deployed. See [docs/API.md](docs/API.md) for deployment steps.

## Architecture

```text
Static product                         Optional network feature

Browser                               Brick Breaker clear
  ↓                                         ↓
Cloudflare Pages                       leaderboard client
  ↓                                         ↓
HTML / CSS / vanilla JS               Cloudflare Worker
                                            ↓
                                            D1
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Development

Requires Node.js 20+.

```bash
npm install
npm run serve
```

Quality commands:

```bash
npm run lint
npm run test:unit
npm run test:api
npm run test:links
npm run test:e2e:critical
npm run test:a11y
npm run quality
```

## Worker / D1

```bash
npx wrangler d1 create web-worlds-scores
# put the returned database_id into wrangler.jsonc
npm run worker:migrate:local
npm run worker:dev
npm run worker:migrate:remote
npm run worker:deploy
```

Then set `siteConfig.backend.apiBase` in `config.js` to the Worker URL ending in `/api`.

## Reliability model

Optional systems fail independently:

- missing Three.js shows the 3D fallback without breaking navigation
- missing Matter.js shows the Room fallback without breaking the site
- missing engineering evidence renders unavailable states instead of fake success
- missing score API leaves Brick Breaker playable and preserves completed runs locally

## Accessibility

The project targets WCAG 2.2 AA where applicable and uses semantic controls, keyboard focus, reduced-motion support, touch-sized controls, status regions, and automated axe scans. Complex visual worlds have documented limitations and are not presented as formally certified accessible experiences.

## Performance

The heavy interactive routes are judged differently from lightweight content routes. Tunnel and 3D use route-specific optimizations instead of flattening the visual design to chase a decorative score. Lighthouse data is displayed only after a reproducible measurement exists.

See [docs/PERFORMANCE.md](docs/PERFORMANCE.md).

## Security

The static site sends defensive response headers through Cloudflare Pages. v0.27 includes a report-only CSP that inventories the actual CDN/runtime needs before enforcement. The Worker validates request shape/ranges, binds SQL parameters, restricts browser origins, caps bodies/results, and uses a lightweight submission limiter.

## Why vanilla JavaScript?

It is intentional. Web Worlds is a collection of browser-native experiments whose main complexity is interaction, animation, state, and rendering rather than application routing or server-rendered UI. Keeping the production runtime framework-free makes the architecture visible and minimizes machinery that does not serve the product.

## Release

- `v0.25` — stable functional baseline
- `v0.26` — engineering foundation and proof
- `v0.27` — production hardening and full-stack proof

Detailed implementation evidence is also visible directly at `/engineering/`.
