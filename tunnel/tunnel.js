(() => {
  const tunnel = document.querySelector('[data-depth-tunnel]');
  if (!tunnel) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smoothstep = (t) => t * t * (3 - 2 * t);
  const layers = [...tunnel.querySelectorAll('[data-depth]')];
  const copy = tunnel.querySelector('.depth-tunnel-copy');
  const dots = [...tunnel.querySelectorAll('[data-zone-dot]')];
  const cache = new WeakMap();

  let ticking = false;
  let visible = true;
  let autoLast = performance.now();
  let lastManual = performance.now();
  let autoActive = false;
  let autoStartedAt = 0;
  let lastZone = -1;
  let lastTunnelVars = '';
  let lastDecorativeUpdate = 0;
  let tunnelTop = 0;
  let tunnelTravel = 1;
  let mobileLayout = innerWidth <= 760;
  let perspective = mobileLayout ? 1200 : 1700;

  const autoSpeed = 82;
  const autoDelay = 3000;
  const autoRamp = 10000;
  const autoMaxMultiplier = 3;
  const MAX_DESKTOP_EXPENSIVE = 2;

  // v0.25: mobile keeps the visually rich v0.24 profile. Desktop treats large,
  // translucent/glowy families as expensive and limits how many can overlap.
  const PROFILES = [
    ['nebula-a',      { cost:'expensive', baseCoverage:.46, fade:.54, hide:.72, maxZ:205, maxScale:1.04 }],
    ['prism-field',   { cost:'expensive', baseCoverage:.50, fade:.66, hide:.84, maxZ:255, maxScale:1.08 }],
    ['kaleido-layer', { cost:'expensive', baseCoverage:.48, fade:.64, hide:.82, maxZ:245, maxScale:1.07 }],
    ['chroma-field',  { cost:'expensive', baseCoverage:.54, fade:.76, hide:.94, maxZ:300, maxScale:1.09 }],
    ['portal-stack',  { cost:'expensive', baseCoverage:.52, fade:.72, hide:.90, maxZ:285, maxScale:1.09 }],
    ['chamber-layer', { cost:'expensive', baseCoverage:.54, fade:.72, hide:.90, maxZ:280, maxScale:1.08 }],
    ['final-chamber', { cost:'expensive', baseCoverage:.54, fade:.76, hide:.94, maxZ:300, maxScale:1.09 }],
    ['spiral-layer',  { cost:'cheap', baseCoverage:.56, fade:.82, hide:1.02, maxZ:340, maxScale:1.11 }],
    ['ribbon-layer',  { cost:'cheap', baseCoverage:.56, fade:.82, hide:1.02, maxZ:340, maxScale:1.10 }],
    ['mid-ring-layer',{ cost:'cheap', baseCoverage:.52, fade:.84, hide:1.04, maxZ:350, maxScale:1.11 }],
    ['ring-layer',    { cost:'cheap', baseCoverage:.52, fade:.84, hide:1.04, maxZ:350, maxScale:1.11 }],
    ['gate-layer',    { cost:'cheap', baseCoverage:.38, fade:.82, hide:1.02, maxZ:340, maxScale:1.11 }],
    ['rush-layer',    { cost:'cheap', baseCoverage:.25, fade:.92, hide:1.16, maxZ:390, maxScale:1.13 }],
    ['flyby-layer',   { cost:'cheap', baseCoverage:.18, fade:.92, hide:1.16, maxZ:390, maxScale:1.13 }],
    ['glyph-field',   { cost:'cheap', baseCoverage:.16, fade:.94, hide:1.18, maxZ:410, maxScale:1.14 }],
    ['star-layer',    { cost:'cheap', baseCoverage:.14, fade:.96, hide:1.20, maxZ:420, maxScale:1.14 }],
    ['shard-layer',   { cost:'cheap', baseCoverage:.16, fade:.94, hide:1.18, maxZ:410, maxScale:1.14 }]
  ];
  const DEFAULT_PROFILE = { cost:'cheap', baseCoverage:.34, fade:.82, hide:1.02, maxZ:340, maxScale:1.11 };

  function layerProfile(layer) {
    for (const [cls, profile] of PROFILES) if (layer.classList.contains(cls)) return profile;
    return DEFAULT_PROFILE;
  }

  function measureTunnel() {
    const rect = tunnel.getBoundingClientRect();
    tunnelTop = window.scrollY + rect.top;
    tunnelTravel = Math.max(1, tunnel.offsetHeight - innerHeight);
    mobileLayout = innerWidth <= 760;
    perspective = mobileLayout ? 1200 : 1700;
    tunnel.classList.toggle('is-mobile-profile', mobileLayout);
    tunnel.classList.toggle('is-desktop-profile', !mobileLayout);
  }

  const io = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? true;
    if (visible) requestUpdate();
  }, { rootMargin: '180px' });
  io.observe(tunnel);

  function stateFor(layer) {
    let state = cache.get(layer);
    if (!state) { state = {}; cache.set(layer, state); }
    return state;
  }

  function writeLayer(layer, key, value) {
    const state = stateFor(layer);
    if (state[key] === value) return;
    state[key] = value;
    if (key === 'transform' || key === 'opacity' || key === 'display') layer.style[key] = value;
    else layer.style.setProperty(key, value);
  }

  function setLayerActive(layer, active) {
    const state = stateFor(layer);
    if (state.active === active) return;
    state.active = active;
    layer.classList.toggle('is-depth-active', active);
    writeLayer(layer, 'display', active ? 'grid' : 'none');
  }

  function setLayerNear(layer, near) {
    const state = stateFor(layer);
    if (state.near === near) return;
    state.near = near;
    layer.classList.toggle('is-depth-near', near);
  }

  function buildRecord(layer, i, p) {
    const d = Number(layer.dataset.depth) || .5;
    const start = Number(layer.dataset.start || 0);
    const end = Number(layer.dataset.end || 1);
    const span = Math.max(.001, end - start);
    const local = clamp((p - start) / span, 0, 1);
    const isFinal = layer.dataset.final === 'true';
    const profile = layerProfile(layer);

    if ((!isFinal && (local <= 0 || local >= 1)) || (isFinal && p < start - .025)) {
      return { layer, i, active:false, isFinal, profile, local, score:0, near:false };
    }

    const rawTravel = (local - .5) * d * 3000;
    const rawScale = 1 + local * d * .62;

    // Estimate screen coverage without layout reads in the hot loop.
    const probeZ = clamp(Math.max(0, rawTravel), 0, perspective * .78);
    const perspectiveScale = perspective / Math.max(240, perspective - probeZ);
    const projectedCoverage = profile.baseCoverage * rawScale * perspectiveScale;

    // Mobile intentionally keeps v0.24's generous near-camera allowance.
    // Expensive desktop families fade/cull earlier because desktop raster area
    // is the known bottleneck even when DOM object count is moderate.
    const mobileAllowance = mobileLayout ? .15 : 0;
    const desktopPenalty = (!mobileLayout && profile.cost === 'expensive') ? .075 : 0;
    const fadeAt = Math.max(.28, profile.fade + mobileAllowance - desktopPenalty);
    const hideAt = Math.max(fadeAt + .08, profile.hide + mobileAllowance - desktopPenalty * 1.35);
    const coverageT = isFinal ? 0 : clamp((projectedCoverage - fadeAt) / Math.max(.01, hideAt - fadeAt), 0, 1);
    const coverageFade = smoothstep(coverageT);
    const endFade = isFinal ? 0 : smoothstep(clamp((local - .78) / .20, 0, 1));
    const nearFade = Math.max(coverageFade, endFade);

    if (!isFinal && nearFade >= .992) {
      return { layer, i, active:false, isFinal, profile, local, score:0, near:true };
    }

    const baseOpacity = isFinal
      ? clamp((local - .18) * 1.7, 0, 1)
      : clamp(Math.min(local * 6, (1 - local) * 6), 0, 1) * (1 - nearFade);

    // Keep the most visually useful expensive layers when desktop density is capped.
    const centerWeight = 1 - Math.min(1, Math.abs(local - .5) * 1.4);
    const score = baseOpacity * (.72 + centerWeight * .28) * (1 - coverageFade * .35);
    const near = !mobileLayout && profile.cost === 'expensive' && projectedCoverage >= fadeAt * .72;

    return {
      layer, i, active:true, isFinal, profile, local, d, rawTravel,
      projectedCoverage, nearFade, baseOpacity, score, near
    };
  }

  function update() {
    ticking = false;
    if (!visible) return;

    const p = clamp((window.scrollY - tunnelTop) / tunnelTravel, 0, 1);
    const wave = Math.sin(p * Math.PI * 18);
    const wave2 = Math.cos(p * Math.PI * 11);

    const records = layers.map((layer, i) => buildRecord(layer, i, p));
    let allowedExpensive = null;

    if (!mobileLayout) {
      const candidates = records
        .filter(r => r.active && r.profile.cost === 'expensive')
        .sort((a, b) => b.score - a.score);
      allowedExpensive = new Set(candidates.slice(0, MAX_DESKTOP_EXPENSIVE).map(r => r.layer));
    }

    for (const rec of records) {
      const { layer, i, profile, isFinal, local } = rec;
      const densitySuppressed = !mobileLayout && rec.active && profile.cost === 'expensive' && !allowedExpensive.has(layer);

      if (!rec.active || densitySuppressed) {
        writeLayer(layer, 'opacity', '0');
        setLayerNear(layer, false);
        setLayerActive(layer, false);
        continue;
      }

      setLayerActive(layer, true);
      setLayerNear(layer, rec.near);

      const desktopExpensive = !mobileLayout && profile.cost === 'expensive';
      const maxZ = mobileLayout
        ? profile.maxZ + 70
        : Math.max(145, profile.maxZ - (desktopExpensive ? 42 : 0));
      const travel = isFinal
        ? Math.min(rec.rawTravel, 330)
        : rec.rawTravel > 0 ? Math.min(rec.rawTravel, maxZ) : Math.max(rec.rawTravel, -1100);
      const maxScale = mobileLayout
        ? profile.maxScale + .05
        : Math.max(1.015, profile.maxScale - (desktopExpensive ? .025 : 0));
      const scale = Math.min(1 + local * rec.d * .46, maxScale);
      const spin = (Number(layer.dataset.spin) || ((i % 2 ? 1 : -1) * (90 + i * 19))) * local;
      const lateral = Math.sin((local + i * .17) * Math.PI * 2.4) * rec.d * 82;
      const vertical = Math.cos((local + i * .11) * Math.PI * 2.0) * rec.d * 38;
      let opacity = rec.baseOpacity;

      writeLayer(layer, '--local', local.toFixed(3));
      writeLayer(layer, '--spin', `${spin.toFixed(2)}deg`);
      if (reduceMotion) {
        writeLayer(layer, 'transform', `scale(${Math.min(1 + local * rec.d * .08, maxScale).toFixed(4)})`);
        opacity = local > .10 && local < .94 ? Math.min(opacity, .78) : opacity;
      } else {
        writeLayer(layer, 'transform', `translate3d(${lateral.toFixed(2)}px,${vertical.toFixed(2)}px,${travel.toFixed(2)}px) rotate(${spin.toFixed(2)}deg) scale(${scale.toFixed(4)})`);
      }
      writeLayer(layer, 'opacity', opacity.toFixed(3));
    }

    if (copy) {
      const next = clamp(1 - p * 11, 0, 1).toFixed(3);
      if (copy.dataset.v25Opacity !== next) {
        copy.dataset.v25Opacity = next;
        copy.style.opacity = next;
      }
    }

    const zone = Math.min(6, Math.floor(p * 7));
    if (zone !== lastZone) {
      dots.forEach((dot, i) => dot.classList.toggle('is-active', i === zone));
      lastZone = zone;
    }

    // Decorative color drift runs slower than spatial motion.
    const now = performance.now();
    const decorativeCadence = mobileLayout ? 80 : 120;
    if (now - lastDecorativeUpdate >= decorativeCadence) {
      const warp = (.45 + .55 * Math.abs(wave2)).toFixed(2);
      const twist = `${(wave * 12 + p * 90).toFixed(0)}deg`;
      const vars = `${warp}|${twist}`;
      if (vars !== lastTunnelVars) {
        tunnel.style.setProperty('--tunnel-progress', p.toFixed(3));
        tunnel.style.setProperty('--tunnel-warp', warp);
        tunnel.style.setProperty('--tunnel-twist', twist);
        lastTunnelVars = vars;
      }
      lastDecorativeUpdate = now;
    }
  }

  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  function markManual() {
    if (reduceMotion) return;
    lastManual = performance.now();
    autoActive = false;
    autoStartedAt = 0;
    document.documentElement.classList.remove('is-tunnel-auto-scrolling');
  }

  addEventListener('wheel', markManual, { passive: true });
  addEventListener('touchstart', markManual, { passive: true });
  addEventListener('touchmove', markManual, { passive: true });
  addEventListener('pointerdown', markManual, { passive: true });
  addEventListener('keydown', (event) => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) markManual();
  });

  function autoLoop(now) {
    requestAnimationFrame(autoLoop);
    const dt = Math.min(.05, (now - autoLast) / 1000 || .016);
    autoLast = now;
    if (reduceMotion || document.hidden) return;

    const scroller = document.scrollingElement || document.documentElement;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    if (scroller.scrollTop >= maxScroll - 2) {
      autoActive = false;
      document.documentElement.classList.remove('is-tunnel-auto-scrolling');
      return;
    }

    if (!autoActive && now - lastManual >= autoDelay) {
      autoActive = true;
      autoStartedAt = now;
      document.documentElement.classList.add('is-tunnel-auto-scrolling');
    }

    if (autoActive) {
      const progress = clamp((now - autoStartedAt) / autoRamp, 0, 1);
      const multiplier = 1 + (autoMaxMultiplier - 1) * progress;
      scroller.scrollTop = Math.min(maxScroll, scroller.scrollTop + autoSpeed * multiplier * dt);
      requestUpdate();
    }
  }

  addEventListener('scroll', requestUpdate, { passive: true });
  addEventListener('resize', () => { measureTunnel(); requestUpdate(); }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    autoLast = performance.now();
    if (!document.hidden) requestUpdate();
  });

  measureTunnel();
  requestUpdate();
  requestAnimationFrame(autoLoop);
})();
