# Performance

Web Worlds is deliberately more animated than a normal content site, so performance work is measurement-driven and route-specific.

## Existing strategy

- animation loops pause or skip work when pages/components are hidden where practical
- 3D pixel ratio is capped and reduced on smaller screens
- Tunnel uses separate mobile/desktop density decisions and early culling
- ambient particles are reduced on small screens and disabled for reduced motion
- expensive systems initialize only on pages that use them
- reduced-motion preferences disable nonessential motion without removing content

## Release evidence

`engineering/data/quality.json` records source-size measurements generated from the actual release tree.

Lighthouse fields remain `null` until a reproducible audit is run. Web Worlds does not commit invented scores to make the Engineering dashboard look healthy.

Run:

```bash
npm run audit:lighthouse
```

after installing dependencies and a compatible Chrome/Chromium browser.

## Backend performance

The live Engineering page measures browser-to-Worker health round-trip latency only when a Worker endpoint is configured. That value is a live diagnostic, not an uptime SLA or a substitute for production monitoring.
