# Web Worlds — v0.25

A multi-page interactive frontend showcase built with plain HTML, CSS, vanilla JavaScript, Three.js, and Matter.js.

## Routes

- `/` — animated world gateway / selector
- `/playground/` — browser puzzle route with Spring Shot
- `/3d/` — interactive Three.js scene and customizer
- `/lab/` — mechanics laboratory
- `/room/` — Matter.js living simulation sandbox
- `/tunnel/` — psychedelic scroll journey
- `/about/` — creator information and professional links

## v0.25 update

- Tightened the main readability shells so they track the real content width more closely and expose more wallpaper.
- Reduced oversized hero/top padding on content pages while preserving comfortable mobile spacing.
- Finished Home orbit safe-area/overflow cleanup and softened the far-left grid artifact.
- Split Tunnel rendering into a rich mobile profile and a curated desktop profile. Desktop caps simultaneous expensive layers, fades heavy geometry earlier, and drops large-object glow near camera while keeping motion full-rate.


This release is a readability and final-performance pass built on the stable v0.22 systems.

- Simplified the Royal wallpaper to a crown-led system with no arch motif, smaller repeats, and lighter supporting ornament.
- Added a large calm themed readability panel behind the main content on Home, Playground, 3D, Lab, Room, and About while keeping wallpaper visible around the edges.
- Made Royal and Scary mobile navigation surfaces opaque enough that page text and wallpaper no longer bleed through.
- Added near-camera Tunnel culling: expensive layers fade before perspective makes them enormous, then leave paint/compositing entirely until needed again.
- Capped near-camera depth/scale, promoted only active Tunnel layers, kept decorative updates slower than motion, and preserved the existing 3-second idle / 1×→3× auto-scroll behavior.
- Preserved all v0.22 gameplay, Room habitats, mobile-specific levels, scoring, puzzle logic, themes, navigation, and accessibility behavior.

## Themes

The four persistent themes share the same layouts, physics, AI, puzzle rules, controls, and progression. Theme differences are presentation and flavor only.

- **Cool** — dark technical signal-world presentation
- **Cute** — pastel, rounded, playful presentation
- **Royal** — burgundy, purple, ivory, gold, court and ceremonial flavor
- **Scary** — dark purple, moonlight, eye, ghost, thorn, and haunted flavor

The selected theme is stored in `localStorage` and shared across routes.

## CSS structure

Each route loads a standalone CSS bundle from `/styles/` rather than paying for every other route's styles:

- `styles/home.css`
- `styles/playground.css`
- `styles/3d.css`
- `styles/lab.css`
- `styles/room.css`
- `styles/tunnel.css`
- `styles/about.css`

The bundles preserve the original cascade order, which keeps the mature v0.19 visuals stable while reducing per-page stylesheet weight.

## Run locally

No build step is required. Serve the folder with any static file server, for example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

### v0.24 polish notes
- Narrower centered readability panels expose more themed wallpaper while preserving content width.
- Home orbit gets extra vertical safe area so top/bottom labels and glow are not clipped; the stray side rule is removed.
- Tunnel visuals are tuned per theme around lightweight outlines, rings, glyphs, and particles.
- Tunnel depth rendering now uses cost-aware near-camera culling, screen-coverage estimates, maximum Z/scale caps, and early recycling so large filled/translucent layers never become viewport-sized performance hazards.
