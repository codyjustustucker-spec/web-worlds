# Testing Strategy

Web Worlds tests outcomes that protect the product rather than chasing a coverage percentage.

## Deterministic unit tests

`npm run test:unit`

Covers shared utilities, configuration integrity, release data honesty, and theme/route assumptions.

## Worker/API tests

`npm run test:api`

Covers accepted score payloads, impossible/incomplete scores, malformed JSON, unsupported modes, D1 health degradation, persistence behavior, leaderboard ordering/limits, and CORS denial. Production D1 is never used by the test suite.

## Browser tests

`npm run test:e2e:critical`

Playwright checks primary routes, theme persistence, representative mobile behavior, Engineering evidence, reduced-motion behavior, and the leaderboard's safe not-configured state.

`npm run test:e2e:cross`

Runs lightweight smoke coverage in Firefox and WebKit.

## Accessibility

`npm run test:a11y`

Each primary route is scanned with axe-core. Automated results are treated as evidence, not as formal WCAG certification. Manual checks remain necessary for keyboard behavior, semantics, complex visual interactions, focus, and screen-reader usability.

## Static quality

`npm run quality:static`

Runs syntax parsing, unit/API tests, local-reference validation, and refreshes the committed quality snapshot.

## Full quality

`npm run quality`

Runs linting, deterministic tests, links, Chromium/mobile browser tests, and automated accessibility checks.

Lighthouse remains intentionally separate because exact scores can vary between machines.
