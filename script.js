(() => {
  const root = document.documentElement;
  const body = document.body;
  const config = window.siteConfig || {};
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const isSmall = window.matchMedia('(max-width: 760px)').matches;

  const themeButtons = [...document.querySelectorAll('[data-theme-choice]')];
  const themeLabels = [...document.querySelectorAll('[data-theme-label]')];
  const royalTextNodes = [...document.querySelectorAll('[data-royal-text]')];
  const scaryTextNodes = [...document.querySelectorAll('[data-scary-text]')];
  const themeCopyNodes = [...document.querySelectorAll('[data-theme-copy]')];
  [...new Set([...royalTextNodes, ...scaryTextNodes])].forEach((node) => { if (!node.dataset.baseText) node.dataset.baseText = node.textContent; });

  function setTheme(theme, persist = true) {
    const next = ['cute','royal','scary'].includes(theme) ? theme : 'cool';
    root.dataset.theme = next;
    themeButtons.forEach((button) => {
      const selected = button.dataset.themeChoice === next;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-active', selected);
    });
    themeLabels.forEach((label) => {
      label.textContent = next === 'cute' ? 'Cute mode' : next === 'royal' ? 'Royal mode' : next === 'scary' ? 'Scary mode' : 'Cool mode';
    });
    royalTextNodes.forEach((node) => { node.textContent = next === 'royal' ? node.dataset.royalText : node.dataset.baseText; });
    scaryTextNodes.forEach((node) => { node.textContent = next === 'scary' ? node.dataset.scaryText : (next === 'royal' && node.dataset.royalText ? node.dataset.royalText : node.dataset.baseText); });
    themeCopyNodes.forEach((node) => {
      const variants = config.themeCopy?.[node.dataset.themeCopy];
      if (!variants) return;
      node.textContent = variants[next] || variants.cool || node.textContent;
    });
    if (persist) {
      try { localStorage.setItem(config.themeStorageKey || 'cody-web-worlds-theme', next); } catch (_) {}
    }
    window.dispatchEvent(new CustomEvent('worldthemechange', { detail: { theme: next } }));
  }

  themeButtons.forEach((button) => button.addEventListener('click', () => setTheme(button.dataset.themeChoice)));
  setTheme(root.dataset.theme || 'cool', false);

  const menuButton = document.querySelector('.menu-button');
  const nav = document.querySelector('.site-nav');
  const closeMenu = () => {
    if (!menuButton || !nav) return;
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
  };
  if (menuButton && nav) {
    menuButton.addEventListener('click', () => {
      const open = !nav.classList.contains('open');
      nav.classList.toggle('open', open);
      menuButton.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (event) => {
      if (!nav.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
    });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });
    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  }

  const page = body.dataset.page;
  document.querySelectorAll('[data-room-link]').forEach((link) => {
    if (link.dataset.roomLink === page) link.setAttribute('aria-current', 'page');
  });

  const header = document.querySelector('.site-header');
  const onScroll = () => header?.classList.toggle('scrolled', window.scrollY > 18);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  const revealItems = [...document.querySelectorAll('.reveal')];
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((el) => el.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    revealItems.forEach((el) => revealObserver.observe(el));
  }

  // Lightweight ambient particles. CSS handles animation; JS only creates a small fixed set.
  const particleField = document.querySelector('[data-particles]');
  if (particleField && !reduceMotion) {
    const count = isSmall ? 10 : 24;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i += 1) {
      const particle = document.createElement('i');
      particle.className = 'ambient-particle';
      particle.style.setProperty('--x', `${Math.random() * 100}%`);
      particle.style.setProperty('--y', `${Math.random() * 100}%`);
      particle.style.setProperty('--s', `${2 + Math.random() * 4}px`);
      particle.style.setProperty('--d', `${8 + Math.random() * 12}s`);
      particle.style.setProperty('--delay', `${-Math.random() * 12}s`);
      frag.appendChild(particle);
    }
    particleField.appendChild(frag);
  }

  // Pointer glow updates a CSS variable. Disabled on coarse pointers and reduced motion.
  if (!coarsePointer && !reduceMotion) {
    let frame = 0;
    window.addEventListener('pointermove', (event) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        root.style.setProperty('--pointer-x', `${event.clientX}px`);
        root.style.setProperty('--pointer-y', `${event.clientY}px`);
        frame = 0;
      });
    }, { passive: true });
  }

  // Card tilt. Only runs while the pointer is over a tilt card.
  if (!coarsePointer && !reduceMotion) {
    document.querySelectorAll('[data-tilt]').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`);
        card.style.setProperty('--ry', `${(x * 7).toFixed(2)}deg`);
        card.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${((y + 0.5) * 100).toFixed(1)}%`);
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
        card.style.setProperty('--mx', '50%');
        card.style.setProperty('--my', '50%');
      });
    });

    document.querySelectorAll('[data-magnetic]').forEach((button) => {
      button.addEventListener('pointermove', (event) => {
        const rect = button.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2;
        const y = event.clientY - rect.top - rect.height / 2;
        button.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px)`;
      });
      button.addEventListener('pointerleave', () => { button.style.transform = ''; });
    });
  }

  // Simple draggable demo, constrained to its own panel.
  const dragStage = document.querySelector('[data-drag-stage]');
  const dragItem = document.querySelector('[data-drag-item]');
  if (dragStage && dragItem) {
    let active = false;
    const move = (event) => {
      if (!active) return;
      const rect = dragStage.getBoundingClientRect();
      const item = dragItem.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width - item.width, event.clientX - rect.left - item.width / 2));
      const y = Math.max(0, Math.min(rect.height - item.height, event.clientY - rect.top - item.height / 2));
      dragItem.style.left = `${x}px`;
      dragItem.style.top = `${y}px`;
    };
    dragItem.addEventListener('pointerdown', (event) => {
      active = true;
      dragItem.setPointerCapture(event.pointerId);
      dragItem.classList.add('is-dragging');
      move(event);
    });
    dragItem.addEventListener('pointermove', move);
    dragItem.addEventListener('pointerup', () => { active = false; dragItem.classList.remove('is-dragging'); });
    dragItem.addEventListener('pointercancel', () => { active = false; dragItem.classList.remove('is-dragging'); });
  }

  // Capability chips light related nodes without expensive layout work.
  document.querySelectorAll('[data-capability]').forEach((chip) => {
    const id = chip.dataset.capability;
    const targets = [...document.querySelectorAll(`[data-proof~="${id}"]`)];
    const toggle = (on) => targets.forEach((target) => target.classList.toggle('is-linked', on));
    chip.addEventListener('mouseenter', () => toggle(true));
    chip.addEventListener('mouseleave', () => toggle(false));
    chip.addEventListener('focus', () => toggle(true));
    chip.addEventListener('blur', () => toggle(false));
  });

  // Tiny harmless easter egg.
  const logo = document.querySelector('[data-logo-secret]');
  if (logo) {
    let taps = 0;
    logo.addEventListener('click', () => {
      taps += 1;
      if (taps >= 5) {
        body.classList.add('secret-found');
        taps = 0;
        window.setTimeout(() => body.classList.remove('secret-found'), 2400);
      }
    });
  }

  const preview = document.querySelector('[data-hub-preview]');
  const entry = document.querySelector('[data-world-entry]');
  const entryLabel = entry?.querySelector('[data-world-entry-label]');
  const entrySymbol = entry?.querySelector('[data-world-entry-symbol]');
  const targets = [...document.querySelectorAll('[data-world-preview]')];
  const labels = { playground:'PLAYGROUND', lab:'LAB', '3d':'3D SPACE', room:'ROOM', tunnel:'TUNNEL', about:'ABOUT' };
  const symbols = { playground:'◎', lab:'⌁', '3d':'◇', room:'✦', tunnel:'◉', about:'◈' };

  function setPreview(key='') {
    if (!preview) return;
    preview.dataset.activeWorld = key;
    body.dataset.hubPreview = key;
  }
  targets.forEach((target) => {
    const key = target.dataset.worldPreview;
    target.addEventListener('pointerup', (event) => { if (event.pointerType && event.pointerType !== 'mouse') target.blur(); });
    target.addEventListener('mouseenter', () => setPreview(key));
    target.addEventListener('mouseleave', () => setPreview(''));
    target.addEventListener('focus', () => setPreview(key));
    target.addEventListener('blur', () => setPreview(''));
    target.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || target.target === '_blank') return;
      const href = target.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if (reduceMotion || !entry) return;
      event.preventDefault();
      entryLabel.textContent = `ENTERING ${labels[key] || 'WORLD'}`;
      entrySymbol.textContent = symbols[key] || '✦';
      entry.dataset.world = key;
      entry.classList.add('is-active');
      window.setTimeout(() => { window.location.href = href; }, 260);
    });
  });
})();
