(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function rectsOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function relativeRect(element, stage) {
    const sr = stage.getBoundingClientRect();
    const r = element.getBoundingClientRect();
    return {
      left: r.left - sr.left,
      top: r.top - sr.top,
      right: r.right - sr.left,
      bottom: r.bottom - sr.top,
      width: r.width,
      height: r.height,
      cx: r.left - sr.left + r.width / 2,
      cy: r.top - sr.top + r.height / 2
    };
  }

  function wallRects(stage) {
    const stageRect = stage.getBoundingClientRect();
    return [...stage.querySelectorAll('[data-lab-wall]')]
      .filter((wall) => !wall.classList.contains('is-open'))
      .map((wall) => {
        const r = wall.getBoundingClientRect();
        return {
          left: r.left - stageRect.left,
          top: r.top - stageRect.top,
          right: r.right - stageRect.left,
          bottom: r.bottom - stageRect.top
        };
      });
  }

  function boxAt(x, y, width, height) {
    return { left: x, top: y, right: x + width, bottom: y + height };
  }

  function moveWithCollision(stage, entity, targetX, targetY) {
    const stageRect = stage.getBoundingClientRect();
    const width = entity.offsetWidth;
    const height = entity.offsetHeight;
    const walls = wallRects(stage);

    let x = Number(entity.dataset.x || 0);
    let y = Number(entity.dataset.y || 0);

    const tx = clamp(targetX, 0, stageRect.width - width);
    const ty = clamp(targetY, 0, stageRect.height - height);
    const dx = tx - x;
    const dy = ty - y;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 7));

    for (let i = 0; i < steps; i += 1) {
      const nx = x + dx / steps;
      const ny = y + dy / steps;

      if (!walls.some((wall) => rectsOverlap(boxAt(nx, y, width, height), wall))) x = nx;
      if (!walls.some((wall) => rectsOverlap(boxAt(x, ny, width, height), wall))) y = ny;
    }
    return { x, y };
  }

  function setEntityPosition(entity, x, y, dispatch = true) {
    entity.dataset.x = String(x);
    entity.dataset.y = String(y);
    entity.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    if (dispatch) {
      entity.dispatchEvent(new CustomEvent('labentitymove', {
        bubbles: true,
        detail: { entity }
      }));
    }
  }

  function placeFromPercent(stage, entity) {
    const rect = stage.getBoundingClientRect();
    const xRaw = entity.dataset.startX || '0';
    const yRaw = entity.dataset.startY || '0';
    const x = xRaw === 'center'
      ? Math.max(0, (rect.width - entity.offsetWidth) / 2)
      : clamp(rect.width * Number(xRaw) / 100, 0, rect.width - entity.offsetWidth);
    const y = yRaw === 'center'
      ? Math.max(0, (rect.height - entity.offsetHeight) / 2)
      : clamp(rect.height * Number(yRaw) / 100, 0, rect.height - entity.offsetHeight);
    setEntityPosition(entity, x, y);
    entity.dataset.dragging = 'false';
  }

  function resetStage(stage) {
    stage.querySelectorAll('[data-lab-entity]').forEach((entity) => placeFromPercent(stage, entity));
    stage.dispatchEvent(new CustomEvent('labstagereset', { bubbles: true }));
  }

  function bindStage(stage, module) {
    const entities = [...stage.querySelectorAll('[data-lab-entity]')];

    entities.forEach((entity) => {
      let dragging = false;
      let pointerId = null;
      let offsetX = 0;
      let offsetY = 0;

      const dragState = module?.querySelector('[data-drag-state]');
      const dragX = module?.querySelector('[data-drag-x]');
      const dragY = module?.querySelector('[data-drag-y]');

      function updateDiagnostics() {
        if (!dragX || !dragY) return;
        const stageRect = stage.getBoundingClientRect();
        const x = Number(entity.dataset.x || 0);
        const y = Number(entity.dataset.y || 0);
        dragX.textContent = String(Math.round((x / Math.max(1, stageRect.width - entity.offsetWidth)) * 100));
        dragY.textContent = String(Math.round((y / Math.max(1, stageRect.height - entity.offsetHeight)) * 100));
      }

      entity.addEventListener('pointerdown', (event) => {
        dragging = true;
        entity.dataset.dragging = 'true';
        pointerId = event.pointerId;
        const r = entity.getBoundingClientRect();
        offsetX = event.clientX - r.left;
        offsetY = event.clientY - r.top;
        entity.setPointerCapture?.(event.pointerId);
        entity.classList.add('is-dragging');
        if (dragState) dragState.textContent = 'grabbed';
      });

      entity.addEventListener('pointermove', (event) => {
        if (!dragging || event.pointerId !== pointerId) return;
        const stageRect = stage.getBoundingClientRect();
        const targetX = event.clientX - stageRect.left - offsetX;
        const targetY = event.clientY - stageRect.top - offsetY;
        let result;

        if (entity.hasAttribute('data-collide')) {
          result = moveWithCollision(stage, entity, targetX, targetY);
        } else {
          result = {
            x: clamp(targetX, 0, stageRect.width - entity.offsetWidth),
            y: clamp(targetY, 0, stageRect.height - entity.offsetHeight)
          };
        }

        setEntityPosition(entity, result.x, result.y);
        updateDiagnostics();
      });

      function stop(event) {
        if (!dragging || event.pointerId !== pointerId) return;
        dragging = false;
        entity.dataset.dragging = 'false';
        entity.classList.remove('is-dragging');
        if (dragState) dragState.textContent = 'idle';
        entity.dispatchEvent(new CustomEvent('labentityrelease', {
          bubbles: true,
          detail: { entity }
        }));
        if (entity.hasPointerCapture?.(event.pointerId)) entity.releasePointerCapture(event.pointerId);
      }

      entity.addEventListener('pointerup', stop);
      entity.addEventListener('pointercancel', stop);
    });

    requestAnimationFrame(() => resetStage(stage));
  }

  document.querySelectorAll('[data-lab-stage]').forEach((stage) => {
    bindStage(stage, stage.closest('[data-lab-module]'));
  });

  /* Hidden-object module */
  const secretModule = document.querySelector('[data-lab-module="collectible"]');
  if (secretModule) {
    const secret = secretModule.querySelector('[data-lab-secret]');
    const count = secretModule.querySelector('[data-lab-secret-count]');
    const reset = secretModule.querySelector('[data-module-reset]');

    function resetSecret() {
      secret.classList.remove('is-collected');
      secret.disabled = false;
      count.textContent = '0 / 1';
    }

    secret.addEventListener('click', () => {
      if (secret.classList.contains('is-collected')) return;
      secret.classList.add('is-collected');
      secret.disabled = true;
      count.textContent = '1 / 1';
    });

    reset?.addEventListener('click', () => {
      resetSecret();
      resetStage(secretModule.querySelector('[data-lab-stage]'));
    });
  }

  /* Ordinary stage resets */
  document.querySelectorAll('[data-lab-module]').forEach((module) => {
    if (module.dataset.labModule === 'collectible') return;
    const reset = module.querySelector('[data-module-reset]');
    const stage = module.querySelector('[data-lab-stage]');
    if (reset && stage) reset.addEventListener('click', () => resetStage(stage));
  });

  /* Pointer / motion bench */
  const pointerStage = document.querySelector('[data-pointer-stage]');
  const pointerCard = document.querySelector('[data-pointer-card]');
  if (pointerStage && pointerCard) {
    const xOut = document.querySelector('[data-pointer-x]');
    const yOut = document.querySelector('[data-pointer-y]');
    const clicksOut = document.querySelector('[data-pointer-clicks]');
    const reset = pointerStage.closest('[data-lab-module]')?.querySelector('[data-module-reset]');
    let clicks = 0;

    pointerStage.addEventListener('pointermove', (event) => {
      const r = pointerStage.getBoundingClientRect();
      const x = clamp((event.clientX - r.left) / r.width, 0, 1);
      const y = clamp((event.clientY - r.top) / r.height, 0, 1);
      xOut.textContent = Math.round(x * 100);
      yOut.textContent = Math.round(y * 100);

      if (!reduceMotion) {
        pointerCard.style.transform = `rotateX(${(0.5 - y) * 10}deg) rotateY(${(x - 0.5) * 12}deg)`;
        pointerCard.style.setProperty('--px', `${x * 100}%`);
        pointerCard.style.setProperty('--py', `${y * 100}%`);
      }
    });
    pointerStage.addEventListener('pointerleave', () => { pointerCard.style.transform = ''; });
    pointerCard.addEventListener('click', () => {
      clicks += 1;
      clicksOut.textContent = String(clicks);
      pointerCard.classList.remove('pulse');
      void pointerCard.offsetWidth;
      pointerCard.classList.add('pulse');
    });
    reset?.addEventListener('click', () => {
      clicks = 0;
      clicksOut.textContent = '0';
      xOut.textContent = '0';
      yOut.textContent = '0';
      pointerCard.style.transform = '';
    });
  }

  /* Theme-state bench */
  const themeModule = document.querySelector('[data-lab-module="theme"]');
  if (themeModule) {
    const input = themeModule.querySelector('[data-lab-code]');
    const status = themeModule.querySelector('[data-lab-code-status]');
    const check = themeModule.querySelector('[data-lab-code-check]');
    const reset = themeModule.querySelector('[data-module-reset]');

    check?.addEventListener('click', () => {
      if (input.value.trim() === '4729') {
        status.textContent = ({cute:'Four charms aligned ♡',royal:'Four seals aligned. Passage granted.',scary:'Four omens align. Seal broken.'}[document.documentElement.dataset.theme] || 'Four signals aligned. Route clear.');
        themeModule.classList.add('is-solved');
      } else {
        status.textContent = 'Not quite. Inspect Cool, Cute, Royal, and Scary.';
        themeModule.classList.remove('is-solved');
      }
    });
    reset?.addEventListener('click', () => {
      input.value = '';
      status.textContent = 'Inspect every world. Combine the four clues.';
      themeModule.classList.remove('is-solved');
    });
  }

  /* Theme-specific hidden words; positions and light behavior stay unchanged. */
  const lightCopies = [...document.querySelectorAll('[data-light-copy]')];
  function syncLightCopies() {
    const rawTheme = document.documentElement.dataset.theme;
    const theme = ['cute','royal','scary'].includes(rawTheme) ? rawTheme : 'cool';
    lightCopies.forEach((node) => { node.textContent = node.dataset[theme] || node.dataset.cool || node.textContent; });
    const lightSymbol=document.querySelector('[data-light-symbol]'); if(lightSymbol) lightSymbol.textContent=({cute:'♡',royal:'◆',scary:'◐'}[theme]||'✦');
  }
  syncLightCopies();
  window.addEventListener('worldthemechange', syncLightCopies);

  /* Lighting bench */
  const lightStage = document.querySelector('[data-light-stage]');
  const lightHandle = document.querySelector('[data-light-handle]');
  if (lightStage && lightHandle) {
    const reset = lightStage.closest('[data-lab-module]')?.querySelector('[data-module-reset]');
    let active = false;
    let pointerId = null;

    function setLight(clientX, clientY) {
      const r = lightStage.getBoundingClientRect();
      const x = clamp(clientX - r.left, 0, r.width);
      const y = clamp(clientY - r.top, 0, r.height);
      lightStage.style.setProperty('--light-x', `${x}px`);
      lightStage.style.setProperty('--light-y', `${y}px`);
      lightHandle.style.transform = `translate3d(${x - lightHandle.offsetWidth / 2}px, ${y - lightHandle.offsetHeight / 2}px, 0)`;
    }

    lightHandle.addEventListener('pointerdown', (event) => {
      active = true;
      pointerId = event.pointerId;
      lightHandle.setPointerCapture?.(event.pointerId);
      lightHandle.classList.add('is-dragging');
    });
    lightHandle.addEventListener('pointermove', (event) => {
      if (!active || event.pointerId !== pointerId) return;
      setLight(event.clientX, event.clientY);
    });
    function end(event) {
      if (!active || event.pointerId !== pointerId) return;
      active = false;
      lightHandle.classList.remove('is-dragging');
    }
    lightHandle.addEventListener('pointerup', end);
    lightHandle.addEventListener('pointercancel', end);

    const resetLight = () => {
      const r = lightStage.getBoundingClientRect();
      setLight(r.left + r.width * 0.25, r.top + r.height * 0.55);
    };
    reset?.addEventListener('click', resetLight);
    requestAnimationFrame(resetLight);
  }


  /* Simple obstacle: move block, then get the player to END */
  const obstacleModule = document.querySelector('[data-lab-module="obstacle"]');
  if (obstacleModule) {
    const stage = obstacleModule.querySelector('[data-lab-stage]');
    const player = obstacleModule.querySelector('.obstacle-player');
    const goal = obstacleModule.querySelector('[data-obstacle-goal]');
    const status = obstacleModule.querySelector('[data-obstacle-status]');
    const success = obstacleModule.querySelector('[data-obstacle-success]');
    let solved = false;

    function updateObstacleGoal() {
      if (solved) return;
      if (rectsOverlap(relativeRect(player, stage), relativeRect(goal, stage))) {
        solved = true;
        status.textContent = 'CLEAR';
        success.classList.add('is-visible');
        goal.classList.add('is-complete');
      }
    }

    stage.addEventListener('labentitymove', (event) => {
      if (event.target === player) updateObstacleGoal();
    });

    stage.addEventListener('labstagereset', () => {
      solved = false;
      status.textContent = 'BLOCKED';
      success.classList.remove('is-visible');
      goal.classList.remove('is-complete');
    });
  }

  /* Pressure plate + unavoidable door */
  const pressureModule = document.querySelector('[data-lab-module="pressure"]');
  if (pressureModule) {
    const stage = pressureModule.querySelector('[data-lab-stage]');
    const block = pressureModule.querySelector('.pressure-block');
    const plate = pressureModule.querySelector('[data-pressure-plate]');
    const door = pressureModule.querySelector('[data-pressure-door]');
    const plateState = pressureModule.querySelector('[data-plate-state]');
    const doorState = pressureModule.querySelector('[data-door-state]');
    const player = pressureModule.querySelector('.pressure-player');
    const exit = pressureModule.querySelector('[data-pressure-exit]');

    function updatePressure() {
      const active = rectsOverlap(relativeRect(block, stage), relativeRect(plate, stage));
      plate.classList.toggle('is-active', active);
      door.classList.toggle('is-open', active);
      plateState.textContent = active ? 'ON' : 'OFF';
      doorState.textContent = active ? 'OPEN' : 'CLOSED';
      const reached = !!(player && exit && rectsOverlap(relativeRect(player, stage), relativeRect(exit, stage)));
      exit?.classList.toggle('is-complete', reached);
    }

    stage.addEventListener('labentitymove', (event) => {
      if (event.target === block || event.target === player) updatePressure();
    });
    stage.addEventListener('labentityrelease', (event) => {
      if (event.target === block || event.target === player) updatePressure();
    });
    stage.addEventListener('labstagereset', () => requestAnimationFrame(updatePressure));
    requestAnimationFrame(updatePressure);
  }

  /* Surface physics toy */
  const surfaceModule = document.querySelector('[data-lab-module="surface"]');
  if (surfaceModule) {
    const stage = surfaceModule.querySelector('[data-surface-stage]');
    const puck = surfaceModule.querySelector('[data-surface-puck]');
    const status = surfaceModule.querySelector('[data-surface-status]');
    const speedOut = surfaceModule.querySelector('[data-surface-speed]');
    const reset = surfaceModule.querySelector('[data-module-reset]');
    const zones = [...surfaceModule.querySelectorAll('[data-surface-zone]')];

    let x = 44;
    let y = 52;
    let vx = 0;
    let vy = 0;
    let dragging = false;
    let pointerId = null;
    let offsetX = 0;
    let offsetY = 0;
    let lastPointer = null;
    let last = performance.now();
    let inView = true;
    let visible = !document.hidden;
    const updateVisibility = () => { visible = inView && !document.hidden; last = performance.now(); };
    new IntersectionObserver((entries) => { inView = entries[0]?.isIntersecting ?? true; updateVisibility(); }, { rootMargin:'140px' }).observe(stage);

    function zoneAt(px, py) {
      const stageRect = stage.getBoundingClientRect();
      for (const zone of zones) {
        const r = zone.getBoundingClientRect();
        if (px >= r.left - stageRect.left && px <= r.right - stageRect.left &&
            py >= r.top - stageRect.top && py <= r.bottom - stageRect.top) {
          return zone.dataset.surfaceZone;
        }
      }
      return 'normal';
    }

    function renderSurfacePuck() {
      puck.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      const cx = x + puck.offsetWidth / 2;
      const cy = y + puck.offsetHeight / 2;
      const zone = zoneAt(cx, cy);
      status.textContent = zone.toUpperCase();
      speedOut.textContent = String(Math.round(Math.hypot(vx, vy)));
      stage.dataset.activeSurface = zone;
    }

    function resetSurface() {
      x = Math.max(12, stage.clientWidth * .08);
      y = Math.max(12, stage.clientHeight * .16);
      vx = 0;
      vy = 0;
      renderSurfacePuck();
    }

    puck.addEventListener('pointerdown', (event) => {
      dragging = true;
      pointerId = event.pointerId;
      const pr = puck.getBoundingClientRect();
      offsetX = event.clientX - pr.left;
      offsetY = event.clientY - pr.top;
      lastPointer = { x: event.clientX, y: event.clientY, t: performance.now() };
      vx = 0;
      vy = 0;
      puck.setPointerCapture?.(event.pointerId);
      puck.classList.add('is-dragging');
    });

    puck.addEventListener('pointermove', (event) => {
      if (!dragging || event.pointerId !== pointerId) return;
      const r = stage.getBoundingClientRect();
      const now = performance.now();
      const nx = clamp(event.clientX - r.left - offsetX, 0, r.width - puck.offsetWidth);
      const ny = clamp(event.clientY - r.top - offsetY, 0, r.height - puck.offsetHeight);

      if (lastPointer) {
        const dt = Math.max(8, now - lastPointer.t);
        vx = (event.clientX - lastPointer.x) / dt * 1000;
        vy = (event.clientY - lastPointer.y) / dt * 1000;
      }

      lastPointer = { x: event.clientX, y: event.clientY, t: now };
      x = nx;
      y = ny;
      renderSurfacePuck();
    });

    function releaseSurface(event) {
      if (!dragging || event.pointerId !== pointerId) return;
      dragging = false;
      puck.classList.remove('is-dragging');
      if (puck.hasPointerCapture?.(event.pointerId)) puck.releasePointerCapture(event.pointerId);
      vx = clamp(vx, -900, 900);
      vy = clamp(vy, -900, 900);
      lastPointer = null;
    }

    puck.addEventListener('pointerup', releaseSurface);
    puck.addEventListener('pointercancel', releaseSurface);
    reset?.addEventListener('click', resetSurface);

    document.addEventListener('visibilitychange', updateVisibility);

    function step(now) {
      requestAnimationFrame(step);
      if (!visible) return;

      const dt = Math.min(.035, Math.max(.008, (now - last) / 1000));
      last = now;

      if (!dragging) {
        const zone = zoneAt(x + puck.offsetWidth / 2, y + puck.offsetHeight / 2);

        let friction = 2.6;
        let conveyor = 0;

        if (zone === 'ice') friction = .28;
        if (zone === 'sticky') friction = 10.5;
        if (zone === 'conveyor') {
          friction = 1.8;
          conveyor = 210;
        }

        vx += conveyor * dt;

        const decay = Math.exp(-friction * dt);
        vx *= decay;
        vy *= decay;

        x += vx * dt;
        y += vy * dt;

        const maxX = stage.clientWidth - puck.offsetWidth;
        const maxY = stage.clientHeight - puck.offsetHeight;
        const bounce = .68;

        if (x < 0) { x = 0; vx = Math.abs(vx) * bounce; }
        if (x > maxX) { x = maxX; vx = -Math.abs(vx) * bounce; }
        if (y < 0) { y = 0; vy = Math.abs(vy) * bounce; }
        if (y > maxY) { y = maxY; vy = -Math.abs(vy) * bounce; }

        if (Math.abs(vx) < .8) vx = 0;
        if (Math.abs(vy) < .8) vy = 0;

        renderSurfacePuck();
      }
    }

    requestAnimationFrame(() => {
      resetSurface();
      requestAnimationFrame(step);
    });
  }

  /* Multi-magnet field */
  const magnetModule = document.querySelector('[data-lab-module="magnet"]');
  if (magnetModule) {
    const stage = magnetModule.querySelector('[data-magnet-stage]');
    const orb = magnetModule.querySelector('[data-metal-orb]');
    const magnets = [...magnetModule.querySelectorAll('[data-magnet-id]')];
    const reset = magnetModule.querySelector('[data-module-reset]');
    const controls = [...magnetModule.querySelectorAll('[data-magnet-controls]')];
    const magnetMobileQuery = window.matchMedia('(max-width: 760px)');

    let orbX = 0, orbY = 0, vx = 0, vy = 0;
    let orbDragging = false;
    let orbPointer = null;
    let orbOffsetX = 0, orbOffsetY = 0;
    let orbLastPointer = null;
    let last = performance.now();
    let inView = true;
    let visible = !document.hidden;
    const updateVisibility = () => { visible = inView && !document.hidden; last = performance.now(); };
    new IntersectionObserver((entries) => { inView = entries[0]?.isIntersecting ?? true; updateVisibility(); }, { rootMargin:'140px' }).observe(stage);

    const magnetState = new Map();

    function placeElementFromPercent(element) {
      const xPct = Number(element.dataset.startX || 0);
      const yPct = Number(element.dataset.startY || 0);
      const x = clamp(stage.clientWidth * xPct / 100, 0, stage.clientWidth - element.offsetWidth);
      const y = clamp(stage.clientHeight * yPct / 100, 0, stage.clientHeight - element.offsetHeight);
      element.dataset.x = String(x);
      element.dataset.y = String(y);
      element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      return { x, y };
    }

    function setMagnetMode(id, mode) {
      const magnet = magnets.find((item) => item.dataset.magnetId === id);
      if (!magnet) return;
      magnet.dataset.mode = mode;
      magnetState.get(id).mode = mode;
      magnet.querySelector('small').textContent = mode.toUpperCase();

      const group = controls.find((item) => item.dataset.magnetControls === id);
      group?.querySelectorAll('[data-magnet-mode]').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.magnetMode === mode);
      });
    }

    controls.forEach((group) => {
      const id = group.dataset.magnetControls;
      group.querySelectorAll('[data-magnet-mode]').forEach((button) => {
        button.addEventListener('click', () => setMagnetMode(id, button.dataset.magnetMode));
      });
    });

    magnets.forEach((magnet) => {
      const id = magnet.dataset.magnetId;
      magnetState.set(id, { mode: magnet.dataset.mode || 'off' });

      let dragging = false;
      let pointerId = null;
      let ox = 0, oy = 0;

      magnet.addEventListener('pointerdown', (event) => {
        dragging = true;
        pointerId = event.pointerId;
        const r = magnet.getBoundingClientRect();
        ox = event.clientX - r.left;
        oy = event.clientY - r.top;
        magnet.setPointerCapture?.(event.pointerId);
        magnet.classList.add('is-dragging');
      });

      magnet.addEventListener('pointermove', (event) => {
        if (!dragging || event.pointerId !== pointerId) return;
        const r = stage.getBoundingClientRect();
        const x = clamp(event.clientX - r.left - ox, 0, r.width - magnet.offsetWidth);
        const y = clamp(event.clientY - r.top - oy, 0, r.height - magnet.offsetHeight);
        magnet.dataset.x = String(x);
        magnet.dataset.y = String(y);
        magnet.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });

      function stopMagnet(event) {
        if (!dragging || event.pointerId !== pointerId) return;
        dragging = false;
        magnet.classList.remove('is-dragging');
      }
      magnet.addEventListener('pointerup', stopMagnet);
      magnet.addEventListener('pointercancel', stopMagnet);
    });

    function renderOrb() {
      orb.style.transform = `translate3d(${orbX}px, ${orbY}px, 0)`;
    }

    orb.addEventListener('pointerdown', (event) => {
      orbDragging = true;
      orbPointer = event.pointerId;
      const r = orb.getBoundingClientRect();
      orbOffsetX = event.clientX - r.left;
      orbOffsetY = event.clientY - r.top;
      orbLastPointer = { x: event.clientX, y: event.clientY, t: performance.now() };
      vx = 0;
      vy = 0;
      orb.setPointerCapture?.(event.pointerId);
      orb.classList.add('is-dragging');
    });

    orb.addEventListener('pointermove', (event) => {
      if (!orbDragging || event.pointerId !== orbPointer) return;
      const r = stage.getBoundingClientRect();
      const now = performance.now();
      orbX = clamp(event.clientX - r.left - orbOffsetX, 0, r.width - orb.offsetWidth);
      orbY = clamp(event.clientY - r.top - orbOffsetY, 0, r.height - orb.offsetHeight);

      if (orbLastPointer) {
        const dt = Math.max(8, now - orbLastPointer.t);
        vx = (event.clientX - orbLastPointer.x) / dt * 1000;
        vy = (event.clientY - orbLastPointer.y) / dt * 1000;
      }
      orbLastPointer = { x: event.clientX, y: event.clientY, t: now };
      renderOrb();
    });

    function releaseOrb(event) {
      if (!orbDragging || event.pointerId !== orbPointer) return;
      orbDragging = false;
      orb.classList.remove('is-dragging');
      if (orb.hasPointerCapture?.(event.pointerId)) orb.releasePointerCapture(event.pointerId);
      vx = clamp(vx, -750, 750);
      vy = clamp(vy, -750, 750);
      orbLastPointer = null;
    }

    orb.addEventListener('pointerup', releaseOrb);
    orb.addEventListener('pointercancel', releaseOrb);

    function resetMagnets() {
      magnets.forEach((magnet) => placeElementFromPercent(magnet));
      let p = placeElementFromPercent(orb);
      if (magnetMobileQuery.matches) {
        const a = magnets.find((magnet) => magnet.dataset.magnetId === 'a');
        if (a) {
          const ax = clamp(stage.clientWidth * .16, 0, stage.clientWidth - a.offsetWidth);
          const ay = clamp(stage.clientHeight * .40, 0, stage.clientHeight - a.offsetHeight);
          a.dataset.x = String(ax); a.dataset.y = String(ay);
          a.style.transform = `translate3d(${ax}px, ${ay}px, 0)`;
        }
        orbX = clamp(stage.clientWidth * .68, 0, stage.clientWidth - orb.offsetWidth);
        orbY = clamp(stage.clientHeight * .44, 0, stage.clientHeight - orb.offsetHeight);
        setMagnetMode('a', 'attract');
        setMagnetMode('b', 'off');
        setMagnetMode('c', 'off');
      } else {
        orbX = p.x; orbY = p.y;
        setMagnetMode('a', 'attract');
        setMagnetMode('b', 'repel');
        setMagnetMode('c', 'off');
      }
      vx = 0;
      vy = 0;
      renderOrb();
      last = performance.now();
    }

    reset?.addEventListener('click', resetMagnets);
    magnetMobileQuery.addEventListener?.('change', () => requestAnimationFrame(resetMagnets));

    document.addEventListener('visibilitychange', updateVisibility);

    function step(now) {
      requestAnimationFrame(step);
      if (!visible) return;

      const dt = Math.min(.035, Math.max(.008, (now - last) / 1000));
      last = now;

      if (!orbDragging) {
        const orbCx = orbX + orb.offsetWidth / 2;
        const orbCy = orbY + orb.offsetHeight / 2;

        let ax = 0;
        let ay = 0;

        magnets.forEach((magnet) => {
          const state = magnetState.get(magnet.dataset.magnetId);
          if (!state || state.mode === 'off') return;

          const mx = Number(magnet.dataset.x || 0) + magnet.offsetWidth / 2;
          const my = Number(magnet.dataset.y || 0) + magnet.offsetHeight / 2;
          let dx = mx - orbCx;
          let dy = my - orbCy;
          const distance = Math.max(58, Math.hypot(dx, dy));
          dx /= distance;
          dy /= distance;

          const sign = state.mode === 'attract' ? 1 : -1;
          const strength = Math.min(950, 9500000 / (distance * distance));
          ax += dx * strength * sign;
          ay += dy * strength * sign;
        });

        vx += ax * dt;
        vy += ay * dt;

        const drag = Math.exp(-.48 * dt);
        vx *= drag;
        vy *= drag;

        const maxSpeed = 820;
        const speed = Math.hypot(vx, vy);
        if (speed > maxSpeed) {
          vx = vx / speed * maxSpeed;
          vy = vy / speed * maxSpeed;
        }

        orbX += vx * dt;
        orbY += vy * dt;

        const maxX = stage.clientWidth - orb.offsetWidth;
        const maxY = stage.clientHeight - orb.offsetHeight;
        const bounce = .72;

        if (orbX < 0) { orbX = 0; vx = Math.abs(vx) * bounce; }
        if (orbX > maxX) { orbX = maxX; vx = -Math.abs(vx) * bounce; }
        if (orbY < 0) { orbY = 0; vy = Math.abs(vy) * bounce; }
        if (orbY > maxY) { orbY = maxY; vy = -Math.abs(vy) * bounce; }

        renderOrb();
      }
    }

    requestAnimationFrame(() => {
      resetMagnets();
      requestAnimationFrame(step);
    });
  }

  /* Teleporter */
  const teleportModule = document.querySelector('[data-lab-module="teleporter"]');
  if (teleportModule) {
    const stage = teleportModule.querySelector('[data-lab-stage]');
    const object = teleportModule.querySelector('.teleport-object');
    const portalA = teleportModule.querySelector('[data-portal="a"]');
    const portalB = teleportModule.querySelector('[data-portal="b"]');
    const status = teleportModule.querySelector('[data-teleport-status]');
    let cooldownUntil = 0;

    function inside(entity, portal) {
      const e = relativeRect(entity, stage);
      const p = relativeRect(portal, stage);
      const dx = e.cx - p.cx;
      const dy = e.cy - p.cy;
      return Math.hypot(dx, dy) < Math.min(p.width, p.height) * .43;
    }

    function flash(portal) {
      portal.classList.remove('portal-flash');
      void portal.offsetWidth;
      portal.classList.add('portal-flash');
    }

    function teleportTo(portal, label) {
      const p = relativeRect(portal, stage);
      const x = clamp(p.cx - object.offsetWidth / 2, 0, stage.clientWidth - object.offsetWidth);
      const y = clamp(p.cy - object.offsetHeight / 2, 0, stage.clientHeight - object.offsetHeight);
      setEntityPosition(object, x, y, false);
      flash(portal);
      status.textContent = `Teleported to ${label}.`;
      cooldownUntil = performance.now() + 650;
    }

    object.addEventListener('labentityrelease', () => {
      if (performance.now() < cooldownUntil) return;
      if (inside(object, portalA)) {
        flash(portalA);
        teleportTo(portalB, 'B');
      } else if (inside(object, portalB)) {
        flash(portalB);
        teleportTo(portalA, 'A');
      }
    });

    stage.addEventListener('labstagereset', () => {
      cooldownUntil = 0;
      status.textContent = 'Drop into a portal.';
    });
  }

  /* Resize: preserve clean demonstrations rather than stale geometry. */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      document.querySelectorAll('[data-lab-stage]').forEach((stage) => resetStage(stage));
    }, 140);
  }, { passive: true });
})();

/* v0.10 force experiments */
(() => {
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function dragFlick(stage,puck,onRelease){let dragging=false,pid=null,ox=0,oy=0,last=null,vx=0,vy=0,x=24,y=36;const render=()=>puck.style.transform=`translate3d(${x}px,${y}px,0)`;function reset(nx=24,ny=36){x=nx;y=ny;vx=vy=0;render();}puck.addEventListener('pointerdown',e=>{dragging=true;pid=e.pointerId;const r=puck.getBoundingClientRect();ox=e.clientX-r.left;oy=e.clientY-r.top;last={x:e.clientX,y:e.clientY,t:performance.now()};vx=vy=0;puck.setPointerCapture?.(pid);puck.classList.add('is-dragging');});puck.addEventListener('pointermove',e=>{if(!dragging||e.pointerId!==pid)return;const r=stage.getBoundingClientRect(),now=performance.now(),dt=Math.max(8,now-last.t);vx=(e.clientX-last.x)/dt*1000;vy=(e.clientY-last.y)/dt*1000;last={x:e.clientX,y:e.clientY,t:now};x=clamp(e.clientX-r.left-ox,0,r.width-puck.offsetWidth);y=clamp(e.clientY-r.top-oy,0,r.height-puck.offsetHeight);render();});function end(e){if(!dragging||e.pointerId!==pid)return;dragging=false;puck.classList.remove('is-dragging');onRelease?.({vx,vy,get:()=>({x,y}),set:(nx,ny)=>{x=nx;y=ny;render();},isDragging:()=>dragging});}puck.addEventListener('pointerup',end);puck.addEventListener('pointercancel',end);return{reset,get:()=>({x,y,vx,vy,dragging}),set:(nx,ny)=>{x=nx;y=ny;render();},setVelocity:(a,b)=>{vx=a;vy=b;},velocity:()=>({vx,vy}),isDragging:()=>dragging};}

  // WIND + SPRING — one shared ball. Springs retain independent impulse behavior.
  const fs=document.querySelector('[data-wind-spring-stage]'),
        forceBall=document.querySelector('[data-force-ball]'),
        xHandle=document.querySelector('[data-spring-handle="x"]'),
        yHandle=document.querySelector('[data-spring-handle="y"]'),
        xOut=document.querySelector('[data-spring-x]'),
        yOut=document.querySelector('[data-spring-y]'),
        speedOut=document.querySelector('[data-spring-speed]'),
        windButtons=[...document.querySelectorAll('[data-wind-mode]')];
  if(fs&&forceBall&&xHandle&&yHandle){
    let px=0,py=0,vx=0,vy=0,last=performance.now(),visible=true,wind='off',ballDrag=false,bpid=null,box=0,boy=0;
    const gravity=150,clampLocal=(v,a,b)=>Math.max(a,Math.min(b,v));
    const handles={x:{el:xHandle,axis:'x',drag:false,pid:null,startPointer:0,pull:0,max:95},y:{el:yHandle,axis:'y',drag:false,pid:null,startPointer:0,pull:0,max:88}};
    function neutral(){const xa=xHandle.parentElement,ya=yHandle.parentElement;return{x:{x:Math.max(0,(xa.clientWidth-xHandle.offsetWidth)/2),y:Math.max(0,(xa.clientHeight-xHandle.offsetHeight)/2)},y:{x:Math.max(0,(ya.clientWidth-yHandle.offsetWidth)/2),y:Math.max(0,(ya.clientHeight-yHandle.offsetHeight)/2)}};}
    function renderHandle(h){const n=neutral()[h.axis],tx=h.axis==='x'?n.x+h.pull:n.x,ty=h.axis==='y'?n.y+h.pull:n.y;h.el.style.transform=`translate3d(${tx}px,${ty}px,0)`;const coil=h.el.parentElement?.querySelector('.spring-coil');if(coil){if(h.axis==='x'){coil.style.width=`${84+Math.abs(h.pull)*.52}px`;coil.style.transform=`translate(-50%,-50%) translateX(${h.pull*.22}px)`;}else{coil.style.height=`${84+Math.abs(h.pull)*.52}px`;coil.style.transform=`translate(-50%,-50%) translateY(${h.pull*.22}px)`;}}fs.style.setProperty(`--spring-${h.axis}-pull`,`${h.pull}px`);}
    function renderBall(){forceBall.style.transform=`translate3d(${px}px,${py}px,0)`;if(speedOut)speedOut.textContent=String(Math.round(Math.hypot(vx,vy)));}
    function setWind(mode){wind=mode;windButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.windMode===mode)));fs.dataset.wind=mode;}
    windButtons.forEach(b=>b.addEventListener('click',()=>setWind(b.dataset.windMode)));
    function reset(){px=fs.clientWidth*.22-forceBall.offsetWidth/2;py=fs.clientHeight*.48-forceBall.offsetHeight/2;vx=vy=0;Object.values(handles).forEach(h=>{h.pull=0;h.drag=false;renderHandle(h);});if(xOut)xOut.textContent='0';if(yOut)yOut.textContent='0';setWind('off');renderBall();last=performance.now();}
    function bindSpring(h){const axis=h.axis;h.el.addEventListener('pointerdown',e=>{h.drag=true;h.pid=e.pointerId;h.startPointer=axis==='x'?e.clientX:e.clientY;h.el.setPointerCapture?.(h.pid);h.el.classList.add('is-dragging');});h.el.addEventListener('pointermove',e=>{if(!h.drag||e.pointerId!==h.pid)return;const now=axis==='x'?e.clientX:e.clientY;h.pull=clampLocal(now-h.startPointer,-h.max,h.max);renderHandle(h);const impulse=Math.round(-h.pull*5.1);if(axis==='x'&&xOut)xOut.textContent=String(impulse);if(axis==='y'&&yOut)yOut.textContent=String(impulse);});function release(e){if(!h.drag||e.pointerId!==h.pid)return;h.drag=false;h.el.classList.remove('is-dragging');const impulse=clampLocal(-h.pull*5.1,-520,520);if(axis==='x')vx=clampLocal(vx+impulse,-900,900);else vy=clampLocal(vy+impulse,-900,900);h.pull=0;renderHandle(h);if(axis==='x'&&xOut)xOut.textContent=String(Math.round(impulse));if(axis==='y'&&yOut)yOut.textContent=String(Math.round(impulse));}h.el.addEventListener('pointerup',release);h.el.addEventListener('pointercancel',release);}
    bindSpring(handles.x);bindSpring(handles.y);
    forceBall.addEventListener('pointerdown',e=>{ballDrag=true;bpid=e.pointerId;const r=forceBall.getBoundingClientRect();box=e.clientX-r.left;boy=e.clientY-r.top;forceBall.setPointerCapture?.(bpid);forceBall.classList.add('is-dragging');vx=vy=0;});
    forceBall.addEventListener('pointermove',e=>{if(!ballDrag||e.pointerId!==bpid)return;const r=fs.getBoundingClientRect();px=clampLocal(e.clientX-r.left-box,0,r.width-forceBall.offsetWidth);py=clampLocal(e.clientY-r.top-boy,0,r.height-forceBall.offsetHeight);renderBall();});
    const endBall=e=>{if(!ballDrag||e.pointerId!==bpid)return;ballDrag=false;forceBall.classList.remove('is-dragging');};forceBall.addEventListener('pointerup',endBall);forceBall.addEventListener('pointercancel',endBall);
    function step(t){requestAnimationFrame(step);const dt=Math.min(.032,(t-last)/1000||.016);last=t;if(!visible||ballDrag)return;const windAccel=wind==='right'?330:wind==='left'?-330:0;vx+=windAccel*dt;vy+=gravity*dt;px+=vx*dt;py+=vy*dt;const maxX=fs.clientWidth-forceBall.offsetWidth,maxY=fs.clientHeight-forceBall.offsetHeight,rest=.72;if(px<0){px=0;vx=Math.abs(vx)*rest;}if(px>maxX){px=maxX;vx=-Math.abs(vx)*rest;}if(py<0){py=0;vy=Math.abs(vy)*rest;}if(py>maxY){py=maxY;vy=-Math.abs(vy)*rest;vx*=.94;}vx*=Math.exp(-.12*dt);vy*=Math.exp(-.04*dt);renderBall();}
    document.querySelector('[data-force-reset]')?.addEventListener('click',reset);new IntersectionObserver(e=>visible=e[0]?.isIntersecting??true,{rootMargin:'100px'}).observe(fs);new ResizeObserver(()=>{if(!ballDrag)reset();}).observe(fs);requestAnimationFrame(()=>{reset();requestAnimationFrame(step);});
  }

  // ROTATING BRIDGE — v0.22: one traveler, one continuous route, two bridges on desktop.
  const bridgeStage=document.querySelector('[data-bridge-stage]');
  if(bridgeStage){
    const bridges=[...bridgeStage.querySelectorAll('[data-bridge]')];
    const cargo=bridgeStage.querySelector('[data-bridge-cargo]');
    const angleOut=document.querySelector('[data-bridge-angle]');
    const stateOut=document.querySelector('[data-bridge-state]');
    const resetButton=document.querySelector('[data-bridge-reset]');
    const mobileQuery=window.matchMedia('(max-width: 760px)');
    const states=new Map();
    const snap=(a)=>[-35,0,35].reduce((best,x)=>Math.abs(x-a)<Math.abs(best-a)?x:best,-35);
    let cx=0,cy=0,cargoDrag=false,cargoPid=null;

    bridges.forEach((bridge,index)=>{
      const id=bridge.dataset.bridge||String.fromCharCode(97+index),handle=bridge.querySelector('[data-bridge-handle]');
      const state={id,bridge,handle,angle:Number(bridge.dataset.startAngle||0),drag:false,pid:null};states.set(id,state);
      const setAngle=(value)=>{state.angle=clamp(value,-42,42);bridge.style.transform=`translate(-50%,-50%) rotate(${state.angle}deg)`;refreshReadout();};state.setAngle=setAngle;
      if(handle){
        handle.addEventListener('pointerdown',e=>{state.drag=true;state.pid=e.pointerId;handle.setPointerCapture?.(e.pointerId);e.preventDefault();});
        handle.addEventListener('pointermove',e=>{if(!state.drag||e.pointerId!==state.pid)return;const r=bridgeStage.getBoundingClientRect(),xPct=(id==='b' && !mobileQuery.matches) ? .67 : .34,ccx=r.left+r.width*xPct,ccy=r.top+r.height*.56;setAngle(Math.atan2(e.clientY-ccy,e.clientX-ccx)*180/Math.PI);});
        const end=e=>{if(!state.drag||e.pointerId!==state.pid)return;state.drag=false;setAngle(snap(state.angle));};handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',()=>{state.drag=false;setAngle(snap(state.angle));});
      }
    });

    const activeStates=()=>mobileQuery.matches?[states.get('a')].filter(Boolean):[states.get('a'),states.get('b')].filter(Boolean);
    function refreshReadout(){const active=activeStates();if(angleOut)angleOut.textContent=active.map((st,i)=>`${String.fromCharCode(65+i)} ${Math.round(st.angle)}°`).join(' · ');if(stateOut)stateOut.textContent=active.every(st=>Math.abs(st.angle)<8)?'OPEN':'BLOCKED';}
    function geom(){const w=bridgeStage.clientWidth,h=bridgeStage.clientHeight,cw=cargo?.offsetWidth||44,ch=cargo?.offsetHeight||44,centerY=h*.56;return mobileQuery.matches?{w,h,cw,ch,centerY,gaps:[[w*.28,w*.72,'a']],corridorHalf:Math.max(31,h*.10)}:{w,h,cw,ch,centerY,gaps:[[w*.21,w*.45,'a'],[w*.55,w*.79,'b']],corridorHalf:Math.max(31,h*.10)};}
    function bridgeOpen(id){const st=states.get(id);return !!st&&Math.abs(st.angle)<8;}
    function valid(x,y){const g=geom(),ccx=x+g.cw/2,ccy=y+g.ch/2;if(x<0||y<0||x>g.w-g.cw||y>g.h-g.ch)return false;for(const [left,right,id] of g.gaps){if(ccx>left&&ccx<right){if(!bridgeOpen(id))return false;if(Math.abs(ccy-g.centerY)>g.corridorHalf)return false;}}return true;}
    function renderCargo(){if(cargo)cargo.style.transform=`translate3d(${cx}px,${cy}px,0)`;}
    function sweepTo(tx,ty){const dx=tx-cx,dy=ty-cy,steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/4));let lx=cx,ly=cy;for(let i=1;i<=steps;i++){const nx=cx+dx*i/steps,ny=cy+dy*i/steps;if(!valid(nx,ny))break;lx=nx;ly=ny;}cx=lx;cy=ly;renderCargo();}
    function resetBridges(){bridges.forEach(bridge=>states.get(bridge.dataset.bridge)?.setAngle(Number(bridge.dataset.startAngle||0)));const g=geom();cx=Math.max(6,g.w*.07-g.cw/2);cy=g.centerY-g.ch/2;renderCargo();refreshReadout();}
    if(cargo){cargo.addEventListener('pointerdown',e=>{cargoDrag=true;cargoPid=e.pointerId;cargo.setPointerCapture?.(e.pointerId);cargo.classList.add('is-dragging');e.preventDefault();});cargo.addEventListener('pointermove',e=>{if(!cargoDrag||e.pointerId!==cargoPid)return;const r=bridgeStage.getBoundingClientRect();sweepTo(e.clientX-r.left-cargo.offsetWidth/2,e.clientY-r.top-cargo.offsetHeight/2);});const end=e=>{if(!cargoDrag||e.pointerId!==cargoPid)return;cargoDrag=false;cargo.classList.remove('is-dragging');};cargo.addEventListener('pointerup',end);cargo.addEventListener('pointercancel',()=>{cargoDrag=false;cargo.classList.remove('is-dragging');});}
    resetButton?.addEventListener('click',resetBridges);mobileQuery.addEventListener?.('change',()=>requestAnimationFrame(resetBridges));new ResizeObserver(()=>requestAnimationFrame(resetBridges)).observe(bridgeStage);requestAnimationFrame(resetBridges);
  }

  // LINKED STATE — v0.22 remote Brick Breaker. Slider remains the primary controller.
  const input=document.querySelector('[data-linked-input]'),platform=document.querySelector('[data-linked-platform]'),value=document.querySelector('[data-linked-value]'),room=document.querySelector('[data-linked-room]'),ball=document.querySelector('[data-linked-ball]'),bricksHost=document.querySelector('[data-linked-bricks]'),linkedStatus=document.querySelector('[data-linked-status]');
  if(input&&platform&&room&&ball&&bricksHost){
    let platformX=0,ballX=0,ballY=0,ballVx=155,ballVy=-190,last=performance.now(),visible=true,complete=false;
    let bricks=[];
    const rows=4,cols=6,gap=6;
    function updatePlatform(){const v=Number(input.value),available=Math.max(0,room.clientWidth-platform.offsetWidth);platformX=available*v/100;value.textContent=`${Math.round(v)}%`;platform.style.transform=`translate3d(${platformX}px,0,0)`;}
    function renderBall(){ball.style.transform=`translate3d(${ballX}px,${ballY}px,0)`;}
    function buildBricks(resetHits=true){
      if(resetHits){bricksHost.textContent='';bricks=[];for(let i=0;i<rows*cols;i++){const el=document.createElement('i');el.className='linked-brick';el.dataset.brick=String(i);bricksHost.appendChild(el);bricks.push(el);}}
      const pad=12,usable=Math.max(120,room.clientWidth-pad*2),bw=(usable-gap*(cols-1))/cols,bh=22;
      bricks.forEach((el,i)=>{const row=Math.floor(i/cols),col=i%cols;el.style.left=`${pad+col*(bw+gap)}px`;el.style.top=`${12+row*(bh+gap)}px`;el.style.width=`${bw}px`;el.style.height=`${bh}px`;});
    }
    function paddleTop(){return room.clientHeight-18-platform.offsetHeight;}
    function resetBall(){ballX=Math.max(0,room.clientWidth/2-ball.offsetWidth/2);ballY=Math.max(0,paddleTop()-ball.offsetHeight-12);ballVx=155*(Math.random()>.5?1:-1);ballVy=-190;renderBall();}
    function resetLinked(){complete=false;input.value='50';if(linkedStatus)linkedStatus.textContent='ACTIVE';updatePlatform();buildBricks(true);resetBall();last=performance.now();}
    function ballRect(){return{l:ballX,t:ballY,r:ballX+ball.offsetWidth,b:ballY+ball.offsetHeight};}
    function rectHit(a,b){return a.l<b.r&&a.r>b.l&&a.t<b.b&&a.b>b.t;}
    function brickRect(el){return{l:el.offsetLeft,t:el.offsetTop,r:el.offsetLeft+el.offsetWidth,b:el.offsetTop+el.offsetHeight};}
    function hitBrick(){const br=ballRect();for(const brick of bricks){if(brick.classList.contains('is-hit'))continue;const rr=brickRect(brick);if(!rectHit(br,rr))continue;brick.classList.add('is-hit');ballVy*=-1;const remaining=bricks.some((item)=>!item.classList.contains('is-hit'));if(!remaining){complete=true;ballVx=ballVy=0;if(linkedStatus)linkedStatus.textContent='COMPLETE';}return;}}
    input.addEventListener('input',updatePlatform);
    room.addEventListener('keydown',(e)=>{if(!['ArrowLeft','ArrowRight','a','A','d','D'].includes(e.key))return;e.preventDefault();const dir=(e.key==='ArrowLeft'||e.key==='a'||e.key==='A')?-1:1;input.value=String(clamp(Number(input.value)+dir*6,0,100));updatePlatform();});
    document.querySelector('[data-linked-reset]')?.addEventListener('click',resetLinked);
    new ResizeObserver(()=>{updatePlatform();buildBricks(false);ballX=clamp(ballX,0,Math.max(0,room.clientWidth-ball.offsetWidth));ballY=clamp(ballY,0,Math.max(0,room.clientHeight-ball.offsetHeight));renderBall();}).observe(room);
    new IntersectionObserver(e=>visible=e[0]?.isIntersecting??true,{rootMargin:'100px'}).observe(room);
    document.addEventListener('visibilitychange',()=>{last=performance.now();});
    function loop(t){
      requestAnimationFrame(loop);const dt=Math.min(.032,(t-last)/1000||.016);last=t;if(!visible||document.hidden||complete)return;
      const maxX=Math.max(0,room.clientWidth-ball.offsetWidth),maxY=Math.max(0,room.clientHeight-ball.offsetHeight),prevBottom=ballY+ball.offsetHeight;
      ballX+=ballVx*dt;ballY+=ballVy*dt;
      if(ballX<0){ballX=0;ballVx=Math.abs(ballVx);}else if(ballX>maxX){ballX=maxX;ballVx=-Math.abs(ballVx);}
      if(ballY<0){ballY=0;ballVy=Math.abs(ballVy);}
      const pTop=paddleTop(),pLeft=platformX,pRight=platformX+platform.offsetWidth,bottom=ballY+ball.offsetHeight;
      if(ballVy>0&&ballX+ball.offsetWidth>pLeft&&ballX<pRight&&prevBottom<=pTop&&bottom>=pTop){const center=ballX+ball.offsetWidth/2,hit=clamp((center-(pLeft+platform.offsetWidth/2))/(platform.offsetWidth/2),-1,1);ballY=pTop-ball.offsetHeight-1;ballVx=hit*235;const minHorizontal=42;if(Math.abs(ballVx)<minHorizontal)ballVx=minHorizontal*(ballVx<0?-1:1);ballVy=-Math.max(175,Math.abs(ballVy));}
      hitBrick();
      if(ballY>maxY+8){resetBall();}
      renderBall();
    }
    requestAnimationFrame(()=>{resetLinked();requestAnimationFrame(loop);});
  }

  // v0.22: when the responsive composition crosses into mobile, reset every Lab toy
  // using its existing Reset button rather than trying to migrate incompatible geometry.
  const labMobileQuery=window.matchMedia('(max-width: 760px)');
  labMobileQuery.addEventListener?.('change',event=>{
    if(!event.matches)return;
    requestAnimationFrame(()=>document.querySelectorAll('.lab-page [data-lab-module] .lab-reset').forEach(button=>button.click()));
  });
})();


/* v0.12 lightweight depth experiments moved from 3D into Lab */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  const cardCopy={
    cool:[
      'ACCESS / 03','CLEARANCE: MAYBE','SIGNAL FOUND','SIGNAL LOST','ROUTE OPEN','ROUTE UNKNOWN','NODE ACTIVE','NODE ASLEEP',
      'DO NOT FLIP','UNAUTHORIZED VIBES','DATA GHOST','PHASE SHIFT','FIELD READY','SCAN COMPLETE','PACKET DREAMING','SYSTEM THINKING',
      'NO SAFE ROUTE','AUTH: QUESTIONABLE','DEEP PASS','HELLO, OPERATOR','STILL ROTATING','WHY ARE YOU STILL FLIPPING','SYSTEM PRETENDING TO WORK','SIDE COUNT: ???'
    ],
    cute:[
      'little pass ♡','hehe another one','another side!','authorized cutie','tiny secret ♡','sparkle clearance','wish granted','secret heart',
      'still flipping?','tiny treasure','kiss token ♡','pretty please','lucky charm','soft access','moon pass','friend approved ♡',
      'you found another','sparkles say yes','tiny door key','sweet pass','side quest ♡','boop accepted','okay this card is infinite','one more? ♡'
    ],
    royal:[
      'CROWN PASS / I','COURT ACCESS','VAULT OPEN','OATH ACCEPTED','GILDED ROUTE','ROYAL SEAL','JEWEL ARCHIVE','THRONE SIGNAL',
      'KEEPER APPROVED','CREST VERIFIED','COURT IN SESSION','PASSAGE GRANTED','GEM REGISTERED','ARCHIVE / VII','SCEPTER LINK','PALACE NODE',
      'THE CROWN REMEMBERS','VAULT / MAYBE','CEREMONIAL ACCESS','GILDED SIDE','ROYAL CLEARANCE','OATH / ACTIVE','ONE MORE DECREE','STILL FLIPPING, YOUR GRACE'
    ],
    scary:[
      'OMEN / I','VEIL ACCESS','WHISPER FOUND','HEX ACCEPTED','HOLLOW ROUTE','BLACK SEAL','ECHO ARCHIVE','NIGHT SIGNAL',
      'RITUAL / 04','BONE KEY','GRAVE RECORD','SEAL BROKEN','SHADOW ARCHIVE','MOON ENTRY','DO NOT TURN IT','SOMETHING IS LISTENING',
      'THE VEIL REMEMBERS','HOLLOW / MAYBE','CURSED ACCESS','DARK SIDE','OMEN CLEARANCE','WHISPER / ACTIVE','ONE MORE TURN','STILL FLIPPING?'
    ]
  };
  document.querySelectorAll('[data-css3d-artifact]').forEach((artifact,index)=>{
    const inner=artifact.querySelector('.artifact-3d'); if(!inner)return;
    const impossible=artifact.hasAttribute('data-impossible-card');
    const copyEl=artifact.querySelector('[data-card-copy]');
    let rx=-8,ry=impossible?0:(index-1)*12,dragging=false,pid=null,lastX=0,lastY=0,moved=false,startRy=ry,step=0,lastCopy='';
    const setCardCopy=()=>{
      if(!copyEl)return;
      const rawTheme=document.documentElement.dataset.theme,theme=['cute','royal','scary'].includes(rawTheme)?rawTheme:'cool',list=cardCopy[theme];
      let next=list[Math.floor(Math.random()*list.length)];
      if(list.length>1){let guard=0;while(next===lastCopy&&guard++<8)next=list[Math.floor(Math.random()*list.length)];}
      lastCopy=next;copyEl.textContent=next;inner.style.setProperty('--face-fix',`${-step*180}deg`);
    };
    const render=()=>{inner.style.setProperty('--rx',`${rx}deg`);inner.style.setProperty('--ry',`${ry}deg`);}; render();setCardCopy();
    artifact.addEventListener('pointermove',e=>{
      if(dragging){
        const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;
        if(Math.abs(dx)+Math.abs(dy)>2)moved=true;
        if(impossible){ry+=dx*.8;rx=clamp(rx-dy*.08,-10,10);}else{ry+=dx*.45;rx=clamp(rx-dy*.35,-45,45);}render();return;
      }
      if(reduceMotion||impossible)return;
      const r=artifact.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
      inner.style.setProperty('--hover-rx',`${-y*10}deg`);inner.style.setProperty('--hover-ry',`${x*13}deg`);
    });
    artifact.addEventListener('pointerleave',()=>{inner.style.setProperty('--hover-rx','0deg');inner.style.setProperty('--hover-ry','0deg');});
    artifact.addEventListener('pointerdown',e=>{dragging=true;moved=false;pid=e.pointerId;lastX=e.clientX;lastY=e.clientY;startRy=ry;artifact.setPointerCapture?.(pid);artifact.classList.add('is-dragging');});
    artifact.addEventListener('pointerup',e=>{
      if(!dragging||e.pointerId!==pid)return;dragging=false;artifact.classList.remove('is-dragging');
      if(impossible){
        const delta=ry-startRy;
        if(!moved||Math.abs(delta)<45) step += delta<0?-1:1;
        else step += (delta<0?-1:1)*Math.max(1,Math.round(Math.abs(delta)/180));
        ry=step*180;rx=0;inner.classList.add('is-snapping');render();setCardCopy();setTimeout(()=>inner.classList.remove('is-snapping'),260);
      } else if(!moved) artifact.classList.toggle('is-open');
    });
    artifact.addEventListener('pointercancel',()=>{dragging=false;artifact.classList.remove('is-dragging');});
    artifact.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(impossible){step+=e.shiftKey?-1:1;ry=step*180;rx=0;render();setCardCopy();}else artifact.classList.toggle('is-open');}});
    if(impossible)window.addEventListener('worldthemechange',setCardCopy);
  });

  const tunnel=document.querySelector('[data-depth-tunnel]');
  if(tunnel){
    const layers=[...tunnel.querySelectorAll('[data-depth]')],copy=tunnel.querySelector('.depth-tunnel-copy'),dots=[...tunnel.querySelectorAll('[data-zone-dot]')];
    let ticking=false,visible=true;
    const io=new IntersectionObserver(e=>{visible=e[0]?.isIntersecting??true;if(visible)requestUpdate();},{rootMargin:'220px'});io.observe(tunnel);
    function update(){
      ticking=false;if(!visible)return;
      const r=tunnel.getBoundingClientRect(),vh=innerHeight,total=Math.max(1,r.height-vh),p=clamp((-r.top)/total,0,1);
      const wave=Math.sin(p*Math.PI*18),wave2=Math.cos(p*Math.PI*11);
      layers.forEach((layer,i)=>{
        const d=Number(layer.dataset.depth)||.5,start=Number(layer.dataset.start||0),end=Number(layer.dataset.end||1),span=Math.max(.001,end-start),local=clamp((p-start)/span,0,1),isFinal=layer.dataset.final==='true';
        const travel=(local-.5)*d*3900,scale=1+local*d*1.05;
        const spin=(Number(layer.dataset.spin)||((i%2?1:-1)*(90+i*19)))*local;
        const lateral=Math.sin((local+i*.17)*Math.PI*2.4)*d*90;
        const vertical=Math.cos((local+i*.11)*Math.PI*2.0)*d*42;
        let opacity=isFinal?clamp((local-.18)*1.7,0,1):clamp(Math.min(local*6,(1-local)*6),0,1);
        layer.style.setProperty('--local',local.toFixed(3));
        layer.style.setProperty('--spin',`${spin.toFixed(2)}deg`);
        layer.style.setProperty('--chroma',`${Math.round(local*18)}px`);
        if(reduceMotion){layer.style.transform=`scale(${1+local*d*.10})`;opacity=local>.10&&local<.94?Math.min(opacity,.78):opacity;}
        else layer.style.transform=`translate3d(${lateral}px,${vertical}px,${travel}px) rotate(${spin}deg) scale(${scale})`;
        layer.style.opacity=String(opacity);
      });
      if(copy)copy.style.opacity=String(clamp(1-p*11,0,1));
      const zone=Math.min(6,Math.floor(p*7));dots.forEach((dot,i)=>dot.classList.toggle('is-active',i===zone));
      tunnel.style.setProperty('--tunnel-progress',p.toFixed(4));
      tunnel.style.setProperty('--tunnel-hue',`${Math.round((p*760 + wave*35)%360)}deg`);
      tunnel.style.setProperty('--tunnel-warp',String((.45+.55*Math.abs(wave2)).toFixed(3)));
      tunnel.style.setProperty('--tunnel-twist',`${(wave*18+p*135).toFixed(2)}deg`);
    }
    function requestUpdate(){if(!ticking){ticking=true;requestAnimationFrame(update);}}
    addEventListener('scroll',requestUpdate,{passive:true});addEventListener('resize',requestUpdate,{passive:true});requestUpdate();
  }
})();

/* v0.13 — gravity well + pendulum experiments */
(() => {
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Gravity well: movable radial source plus a flickable orb.
  const stage=document.querySelector('[data-gravity-stage]');
  const well=document.querySelector('[data-gravity-well]');
  const orb=document.querySelector('[data-gravity-orb]');
  const strength=document.querySelector('[data-gravity-strength]');
  const modeButtons=[...document.querySelectorAll('[data-gravity-mode]')];
  if(stage&&well&&orb&&strength){
    let mode='attract',wx=0,wy=0,ox=0,oy=0,vx=0,vy=0,last=performance.now(),visible=true;
    let drag=null;
    function defaults(){wx=stage.clientWidth*.52-well.offsetWidth/2;wy=stage.clientHeight*.48-well.offsetHeight/2;ox=stage.clientWidth*.12;oy=stage.clientHeight*.66;vx=260;vy=-80;render();}
    function render(){well.style.transform=`translate3d(${wx}px,${wy}px,0)`;orb.style.transform=`translate3d(${ox}px,${oy}px,0)`;}
    function setMode(next){mode=next;modeButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.gravityMode===next)));stage.dataset.gravityMode=next;}
    modeButtons.forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.gravityMode)));
    function begin(which,e){const el=which==='well'?well:orb,r=el.getBoundingClientRect();drag={which,id:e.pointerId,dx:e.clientX-r.left,dy:e.clientY-r.top,lastX:e.clientX,lastY:e.clientY,lastT:performance.now()};el.setPointerCapture?.(e.pointerId);el.classList.add('is-dragging');if(which==='orb'){vx=0;vy=0;}}
    function move(which,e){if(!drag||drag.which!==which||e.pointerId!==drag.id)return;const r=stage.getBoundingClientRect(),now=performance.now(),dt=Math.max(8,now-drag.lastT);let x=e.clientX-r.left-drag.dx,y=e.clientY-r.top-drag.dy;if(which==='well'){wx=clamp(x,0,r.width-well.offsetWidth);wy=clamp(y,0,r.height-well.offsetHeight);}else{vx=(e.clientX-drag.lastX)/dt*1000;vy=(e.clientY-drag.lastY)/dt*1000;ox=clamp(x,0,r.width-orb.offsetWidth);oy=clamp(y,0,r.height-orb.offsetHeight);}drag.lastX=e.clientX;drag.lastY=e.clientY;drag.lastT=now;render();}
    function end(which,e){if(!drag||drag.which!==which||e.pointerId!==drag.id)return;(which==='well'?well:orb).classList.remove('is-dragging');drag=null;}
    [['well',well],['orb',orb]].forEach(([name,el])=>{el.addEventListener('pointerdown',e=>begin(name,e));el.addEventListener('pointermove',e=>move(name,e));el.addEventListener('pointerup',e=>end(name,e));el.addEventListener('pointercancel',e=>end(name,e));});
    document.querySelector('[data-gravity-reset]')?.addEventListener('click',()=>{strength.value='58';setMode('attract');defaults();});
    new IntersectionObserver(e=>visible=e[0]?.isIntersecting??true,{rootMargin:'120px'}).observe(stage);
    function loop(t){requestAnimationFrame(loop);const dt=Math.min(.035,(t-last)/1000||.016);last=t;if(!visible||drag?.which==='orb')return;const ocx=ox+orb.offsetWidth/2,ocy=oy+orb.offsetHeight/2,wcx=wx+well.offsetWidth/2,wcy=wy+well.offsetHeight/2,dx=wcx-ocx,dy=wcy-ocy,dist=Math.max(42,Math.hypot(dx,dy)),power=Number(strength.value)/100;const accel=(28000*power)/(dist*dist)*220*(mode==='repel'?-1:1);vx+=dx/dist*accel*dt;vy+=dy/dist*accel*dt;vx*=Math.exp(-.16*dt);vy*=Math.exp(-.16*dt);ox+=vx*dt;oy+=vy*dt;const mx=stage.clientWidth-orb.offsetWidth,my=stage.clientHeight-orb.offsetHeight;if(ox<0){ox=0;vx=Math.abs(vx)*.78}if(ox>mx){ox=mx;vx=-Math.abs(vx)*.78}if(oy<0){oy=0;vy=Math.abs(vy)*.78}if(oy>my){oy=my;vy=-Math.abs(vy)*.78}render();}
    setMode('attract');requestAnimationFrame(()=>{defaults();requestAnimationFrame(loop);});new ResizeObserver(defaults).observe(stage);
  }

  // Pendulum: preserve the same physics; View only changes visual scale, never world coordinates.
  const ps=document.querySelector('[data-pendulum-stage]'),anchor=document.querySelector('[data-pendulum-anchor]'),bobs=[...document.querySelectorAll('[data-pendulum-bob]')],ropePaths=[document.querySelector('[data-pendulum-rope-a]'),document.querySelector('[data-pendulum-rope-b]')],lengthInput=document.querySelector('[data-pendulum-length]'),lengthValue=document.querySelector('[data-pendulum-length-value]'),zoomInput=document.querySelector('[data-pendulum-zoom]'),zoomValue=document.querySelector('[data-pendulum-zoom-value]'),systemButtons=[...document.querySelectorAll('[data-pendulum-system]')],constraintButtons=[...document.querySelectorAll('[data-pendulum-constraint]')];
  if(ps&&anchor&&bobs.length>=2&&ropePaths.every(Boolean)&&lengthInput&&zoomInput){
    let ax=0,ay=0,last=performance.now(),visible=true,system='single',constraint='taut',drag=null;
    const pts=[0,1].map(()=>({x:0,y:0,vx:0,vy:0}));
    const svg=ropePaths[0].closest('svg'),gravity=610,damping=.99925;
    const L=()=>Number(lengthInput.value)||105;
    const count=()=>system==='double'?2:1;
    const viewScale=()=>clamp(Number(zoomInput.value||50)/100,.35,.70);
    function reset(){
      ax=ps.clientWidth*.5; ay=ps.clientHeight*.30;
      const l=L();
      pts[0]={x:ax+l*.44,y:ay+l*.68,vx:0,vy:0};
      pts[1]={x:pts[0].x+l*.46,y:pts[0].y+l*.70,vx:0,vy:0};
      pts.forEach(clampPoint);solveConstraints();render();
    }
    function clampPoint(p){const r=22;p.x=clamp(p.x,r,ps.clientWidth-r);p.y=clamp(p.y,r,ps.clientHeight-r);}
    function enforceFixedPoint(p,origin,maxLen,exact){
      let dx=p.x-origin.x,dy=p.y-origin.y,dist=Math.max(.001,Math.hypot(dx,dy));
      if((exact&&Math.abs(dist-maxLen)>.001)||(!exact&&dist>maxLen)){
        const nx=dx/dist,ny=dy/dist,target=maxLen;p.x=origin.x+nx*target;p.y=origin.y+ny*target;
        const radial=p.vx*nx+p.vy*ny;if(exact||radial>0){p.vx-=radial*nx;p.vy-=radial*ny;}
      }
    }
    function enforcePair(a,b,maxLen,exact,aIndex,bIndex){
      let dx=b.x-a.x,dy=b.y-a.y,dist=Math.max(.001,Math.hypot(dx,dy));
      if(!((exact&&Math.abs(dist-maxLen)>.001)||(!exact&&dist>maxLen)))return;
      const nx=dx/dist,ny=dy/dist,error=dist-maxLen;
      const aDragged=drag?.kind==='bob'&&drag.index===aIndex,bDragged=drag?.kind==='bob'&&drag.index===bIndex;
      if(aDragged&&!bDragged){b.x-=nx*error;b.y-=ny*error;}
      else if(bDragged&&!aDragged){a.x+=nx*error;a.y+=ny*error;}
      else{const move=error*.5;a.x+=nx*move;a.y+=ny*move;b.x-=nx*move;b.y-=ny*move;}
      const rvx=b.vx-a.vx,rvy=b.vy-a.vy,radial=rvx*nx+rvy*ny;
      if(exact||radial>0){const impulse=radial*.5;if(!aDragged){a.vx+=impulse*nx;a.vy+=impulse*ny;}if(!bDragged){b.vx-=impulse*nx;b.vy-=impulse*ny;}}
    }
    function solveConstraints(){
      const l=L(),exact=constraint==='taut',n=count();
      for(let k=0;k<7;k++){
        enforceFixedPoint(pts[0],{x:ax,y:ay},l,exact);
        for(let i=1;i<n;i++)enforcePair(pts[i-1],pts[i],l,exact,i-1,i);
        enforceFixedPoint(pts[0],{x:ax,y:ay},l,exact);
        for(let i=0;i<n;i++)clampPoint(pts[i]);
      }
    }
    function ropePath(a,b,maxLen){
      const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy),slack=Math.max(0,maxLen-dist);
      if(constraint==='taut'||slack<2)return`M ${a.x} ${a.y} L ${b.x} ${b.y}`;
      const mx=(a.x+b.x)/2,my=(a.y+b.y)/2+Math.min(72,slack*.78+12),nx=-dy/(Math.hypot(dx,dy)||1),ny=dx/(Math.hypot(dx,dy)||1),wobble=Math.min(24,slack*.22);
      return`M ${a.x} ${a.y} Q ${mx+nx*wobble} ${my+ny*wobble} ${b.x} ${b.y}`;
    }
    function render(){
      const l=L(),n=count(),scale=viewScale();
      if(lengthValue)lengthValue.textContent=String(Math.round(l));if(zoomValue)zoomValue.textContent=`${Math.round(scale*100)}%`;
      anchor.style.transform=`translate3d(${ax-anchor.offsetWidth/2}px,${ay-anchor.offsetHeight/2}px,0) scale(${scale})`;
      bobs.forEach((b,i)=>{b.style.transform=`translate3d(${pts[i].x-b.offsetWidth/2}px,${pts[i].y-b.offsetHeight/2}px,0) scale(${scale})`;b.hidden=i>=n;});
      svg.setAttribute('viewBox',`0 0 ${ps.clientWidth} ${ps.clientHeight}`);
      ropePaths[0].setAttribute('d',ropePath({x:ax,y:ay},pts[0],l));
      ropePaths[1].setAttribute('d',n>=2?ropePath(pts[0],pts[1],l):'');
      ropePaths.forEach(path=>{path.style.strokeWidth=`${(constraint==='rope'?2.7:2.2)*scale}px`;});
      ps.dataset.system=system;ps.dataset.constraint=constraint;ps.style.setProperty('--pendulum-view',String(scale));
    }
    function setSystem(next){system=next==='double'?'double':'single';systemButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pendulumSystem===system)));reset();}
    function setConstraint(next){constraint=next==='rope'?'rope':'taut';constraintButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pendulumConstraint===constraint)));ps.dataset.constraint=constraint;solveConstraints();render();}
    systemButtons.forEach(b=>b.addEventListener('click',()=>setSystem(b.dataset.pendulumSystem)));
    constraintButtons.forEach(b=>b.addEventListener('click',()=>setConstraint(b.dataset.pendulumConstraint)));
    function begin(kind,index,e){
      const el=kind==='anchor'?anchor:bobs[index],r=ps.getBoundingClientRect(),point=kind==='anchor'?{x:ax,y:ay}:pts[index];
      drag={kind,index,id:e.pointerId,lastX:e.clientX,lastY:e.clientY,lastT:performance.now(),offX:e.clientX-r.left-point.x,offY:e.clientY-r.top-point.y};el.setPointerCapture?.(e.pointerId);el.classList.add('is-dragging');
    }
    function move(e){
      if(!drag||e.pointerId!==drag.id)return;const r=ps.getBoundingClientRect(),now=performance.now(),dt=Math.max(8,now-drag.lastT)/1000;
      const x=clamp(e.clientX-r.left-drag.offX,22,r.width-22),y=clamp(e.clientY-r.top-drag.offY,22,r.height-22);
      if(drag.kind==='anchor'){
        const dax=x-ax,day=y-ay;ax=x;ay=y;
        pts.forEach((p,i)=>{if(i<count()){p.vx+=dax/dt*(.09/(i+1));p.vy+=day/dt*(.09/(i+1));}});
      }else{
        const p=pts[drag.index];p.vx=(x-p.x)/dt;p.vy=(y-p.y)/dt;p.x=x;p.y=y;
      }
      drag.lastX=e.clientX;drag.lastY=e.clientY;drag.lastT=now;solveConstraints();render();
    }
    function end(e){if(!drag||e.pointerId!==drag.id)return;const el=drag.kind==='anchor'?anchor:bobs[drag.index];el.classList.remove('is-dragging');drag=null;}
    anchor.addEventListener('pointerdown',e=>begin('anchor',0,e));anchor.addEventListener('pointermove',move);anchor.addEventListener('pointerup',end);anchor.addEventListener('pointercancel',end);
    bobs.forEach((b,i)=>{b.addEventListener('pointerdown',e=>{if(i>=count())return;begin('bob',i,e)});b.addEventListener('pointermove',move);b.addEventListener('pointerup',end);b.addEventListener('pointercancel',end);});
    lengthInput.addEventListener('input',()=>{solveConstraints();render();});zoomInput.addEventListener('input',render);
    document.querySelector('[data-pendulum-reset]')?.addEventListener('click',()=>{lengthInput.value='105';zoomInput.value='50';system='single';constraint='taut';systemButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pendulumSystem==='single')));constraintButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pendulumConstraint==='taut')));reset();});
    new IntersectionObserver(e=>visible=e[0]?.isIntersecting??true,{rootMargin:'140px'}).observe(ps);
    function loop(t){
      requestAnimationFrame(loop);const dt=Math.min(.022,(t-last)/1000||.016);last=t;if(!visible||reduceMotion)return;const n=count();
      for(let i=0;i<n;i++){if(drag?.kind==='bob'&&drag.index===i)continue;const p=pts[i];p.vy+=gravity*dt;p.vx*=Math.pow(damping,dt*60);p.vy*=Math.pow(damping,dt*60);p.x+=p.vx*dt;p.y+=p.vy*dt;clampPoint(p);}solveConstraints();render();
    }
    requestAnimationFrame(()=>{reset();requestAnimationFrame(loop);});new ResizeObserver(()=>{ax=clamp(ax,30,ps.clientWidth-30);ay=clamp(ay,30,ps.clientHeight*.55);pts.forEach(clampPoint);solveConstraints();render();}).observe(ps);
  }
})();
