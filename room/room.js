(() => {
  const worldEl = document.querySelector('[data-physics-world]');
  const layer = document.querySelector('[data-physics-layer]');
  const fallback = document.querySelector('[data-room-fallback]');
  const loading = document.querySelector('[data-room-loading]');
  if (!worldEl || !layer) return;

  const failWorld = (error = new Error('Physics world unavailable')) => {
    if (loading) loading.hidden = true;
    fallback?.removeAttribute('hidden');
    worldEl.classList.add('has-failed');
    window.WWRuntime?.report('room', error, { fatal:false });
  };
  if (!window.Matter) { failWorld(new Error('Matter.js failed to load')); return; }

  const { Engine, World, Bodies, Body, Sleeping, Events } = window.Matter;
  const engine = Engine.create({ enableSleeping: true });
  engine.gravity.y = 1;

  // v0.15 collision model: creatures ghost through one another and through food.
  // They still collide with the world and with toys/props, while food remains physical against scenery.
  const COLLISION = { WORLD:0x0001, CREATURE:0x0002, FOOD:0x0004, PROP:0x0008 };

  const statusEl = document.querySelector('[data-room-status]');
  const gravityControl = document.querySelector('[data-gravity-control]');
  const pauseButton = document.querySelector('[data-pause-world]');
  const resetButton = document.querySelector('[data-reset-world]');
  const dropButtons = [...document.querySelectorAll('[data-drop-tool]')];
  const activityButtons = [...document.querySelectorAll('[data-room-activity]')];
  const clearDropsButton = document.querySelector('[data-clear-drops]');
  const populationButtons = [...document.querySelectorAll('[data-population-action]')];
  const populationCounts = [...document.querySelectorAll('[data-population-count]')];
  const inspector = document.querySelector('[data-creature-inspector]');
  const inspectorClose = document.querySelector('[data-creature-inspector-close]');
  const inspectorSpecies = document.querySelector('[data-inspect-species]');
  const inspectorPersonality = document.querySelector('[data-inspect-personality]');
  const inspectorAction = document.querySelector('[data-inspect-action]');

  const smallScreen = window.matchMedia('(max-width: 760px)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bodyMap = new Map();
  const domMap = new Map();
  const creatureBodies = [];
  const boundaryBodies = [];
  const userBodies = new Set();
  const foodBodies = new Set();

  let dynamicBodies = [];
  let paused = false;
  let worldInView = true;
  let visible = !document.hidden;
  let lastTime = performance.now();
  let lastCreatureThink = 0;
  let dragging = null;
  let ready = false;
  let selectedTool = 'food-plant';
  let activity = 'normal';
  let inspectedCreature = null;

  const MAX_ANIMALS = smallScreen ? 8 : 12;
  const MAX_DROPS = smallScreen ? 10 : 18;
  const activityFactor = { calm: .74, normal: 1, busy: 1.28 };
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const rand = (min, max) => min + Math.random() * (max - min);
  const nowMs = () => performance.now();

  const speciesProfile = {
    a: { personality:'CALM · FOOD MOTIVATED', favorite:'food-plant', speed:1.05, foodRange:390, curiosity:.22, restChance:.52 },
    b: { personality:'CURIOUS · PLAYFUL', favorite:'food-meat', speed:1.58, foodRange:320, curiosity:.72, restChance:.20 },
    c: { personality:'AIRBORNE · CURIOUS', favorite:'food-omnivore', speed:1.35, foodRange:430, curiosity:.38, restChance:.30 }
  };
  const foodCategory = { 'food-plant':'plant', 'food-meat':'meat', 'food-omnivore':'omnivore' };
  const dietByPersona = {
    a: new Set(['plant','meat']),
    b: new Set(['meat']),
    c: new Set(['meat','omnivore'])
  };
  const canEat = (creature, food) => dietByPersona[creature?.plugin?.persona]?.has(food?.plugin?.foodCategory) === true;

  const cuteCreature = {
    a: `<svg viewBox="0 0 110 86" aria-hidden="true"><g class="animal bunny"><ellipse class="body" cx="52" cy="55" rx="31" ry="20"/><circle class="tail" cx="22" cy="52" r="9"/><ellipse class="foot f1" cx="44" cy="73" rx="11" ry="5"/><ellipse class="foot f2" cx="70" cy="72" rx="10" ry="5"/><circle class="head" cx="73" cy="37" r="20"/><ellipse class="ear e1" cx="67" cy="10" rx="8" ry="22"/><ellipse class="ear e2" cx="85" cy="12" rx="8" ry="21"/><circle class="eye" cx="67" cy="35" r="3.1"/><circle class="eye" cx="81" cy="35" r="3.1"/><circle class="nose" cx="75" cy="43" r="2.4"/><circle class="cheek" cx="61" cy="43" r="4"/><circle class="cheek" cx="87" cy="43" r="4"/></g></svg>`,
    b: `<svg viewBox="0 0 110 86" aria-hidden="true"><g class="animal kitty"><path class="tail-line" d="M28 59 C7 58 7 34 24 37 C35 39 31 49 24 47"/><ellipse class="body" cx="50" cy="57" rx="31" ry="18"/><ellipse class="paw p1" cx="43" cy="73" rx="9" ry="4"/><ellipse class="paw p2" cx="67" cy="73" rx="9" ry="4"/><circle class="head" cx="73" cy="38" r="19"/><path class="ear-tri e1" d="M58 27 L62 8 L72 24 Z"/><path class="ear-tri e2" d="M76 24 L90 8 L91 30 Z"/><circle class="eye" cx="68" cy="37" r="3"/><circle class="eye" cx="81" cy="37" r="3"/><path class="nose-path" d="M73 44 l4 0 -2 3 z"/><path class="mouth" d="M75 47 q-4 5 -7 0 M75 47 q4 5 7 0"/></g></svg>`,
    c: `<svg viewBox="0 0 132 88" aria-hidden="true"><g class="animal bird flyer-bird"><path class="tail-feathers" d="M45 53 L20 65 L35 47 L15 43 L42 39 Z"/><ellipse class="body" cx="65" cy="46" rx="24" ry="13"/><path class="wing w1" d="M58 44 C43 14 19 7 7 21 C27 23 39 34 58 54 Z"/><path class="wing w2" d="M70 44 C85 13 111 8 125 22 C103 24 90 35 70 54 Z"/><circle class="head" cx="88" cy="39" r="12"/><path class="beak" d="M98 37 L119 42 L98 47 Z"/><circle class="eye" cx="90" cy="36" r="2.5"/><path class="tiny-feet" d="M62 56 l-2 7 M72 56 l2 7"/></g></svg>`
  };
  const coolCreature = {
    a: `<svg viewBox="0 0 120 86" aria-hidden="true"><g class="dino herb"><path class="tail-shape" d="M28 52 L2 43 L24 64 Z"/><ellipse class="body" cx="55" cy="53" rx="34" ry="18"/><rect class="leg l1" x="39" y="62" width="8" height="18" rx="3"/><rect class="leg l2" x="66" y="62" width="8" height="18" rx="3"/><ellipse class="head" cx="88" cy="45" rx="16" ry="13"/><ellipse class="snout" cx="103" cy="49" rx="13" ry="8"/><circle class="eye" cx="90" cy="42" r="2.8"/><path class="plates" d="M30 41 L37 25 L44 41 L51 22 L58 40 L66 25 L73 42 Z"/></g></svg>`,
    b: `<svg viewBox="0 0 125 86" aria-hidden="true"><g class="dino raptor"><path class="tail-shape" d="M45 52 C25 50 13 45 2 35 C21 40 35 38 53 42 Z"/><ellipse class="body" cx="60" cy="51" rx="28" ry="15"/><path class="leg-line" d="M52 62 l-5 18 h15 M70 62 l5 18 h14"/><circle class="head" cx="86" cy="35" r="13"/><path class="snout-long" d="M95 33 L121 40 L96 47 Z"/><circle class="eye" cx="89" cy="32" r="2.8"/><path class="arm" d="M70 48 q12 3 15 12 M74 50 q7 8 15 5"/><path class="neck" d="M72 45 Q77 35 84 38"/></g></svg>`,
    c: `<svg viewBox="0 0 125 86" aria-hidden="true"><g class="dino flyer"><ellipse class="body" cx="60" cy="52" rx="22" ry="14"/><path class="wing w1" d="M51 50 C26 14 8 19 17 57 C29 44 39 45 55 57 Z"/><path class="wing w2" d="M68 50 C92 14 112 18 106 58 C94 45 82 45 66 57 Z"/><circle class="head" cx="79" cy="36" r="12"/><path class="snout-long" d="M88 34 L116 40 L89 45 Z"/><path class="tail-shape" d="M43 55 L13 72 L46 63 Z"/><circle class="eye" cx="81" cy="33" r="2.5"/><path class="horns" d="M73 27 l4 -11 4 12 6 -10 0 14"/></g></svg>`
  };

  const royalCreature = {
    a: `<svg viewBox="0 0 110 86" aria-hidden="true"><g class="court attendant"><circle class="royal-head" cx="58" cy="27" r="13"/><path class="royal-hair" d="M45 27 q13-22 27 0 v5 q-14-9-27 0z"/><path class="royal-body" d="M39 43 Q58 34 77 43 L82 76 H34 Z"/><path class="royal-apron" d="M45 49 H70 L74 76 H40 Z"/><path class="royal-arm" d="M42 48 L26 62 M74 48 L91 60"/><circle class="royal-eye" cx="54" cy="26" r="2"/><circle class="royal-eye" cx="63" cy="26" r="2"/></g></svg>`,
    b: `<svg viewBox="0 0 110 86" aria-hidden="true"><g class="court noble"><circle class="royal-head" cx="57" cy="28" r="14"/><path class="royal-crown" d="M43 17 L48 5 L56 14 L64 4 L72 17 Z"/><path class="royal-body" d="M36 44 Q57 35 78 44 L85 77 H29 Z"/><path class="royal-cape" d="M37 44 Q25 55 27 77 H40 L47 47 Z"/><path class="royal-sash" d="M45 44 L69 75"/><circle class="royal-eye" cx="52" cy="28" r="2"/><circle class="royal-eye" cx="62" cy="28" r="2"/></g></svg>`,
    c: `<svg viewBox="0 0 132 88" aria-hidden="true"><g class="royal-eagle flyer-bird"><path class="eagle-tail" d="M48 54 L28 69 L51 62 L61 72 L68 58 Z"/><ellipse class="eagle-body" cx="67" cy="47" rx="24" ry="13"/><path class="eagle-wing w1" d="M59 46 C42 11 13 8 5 25 C31 24 43 39 61 56 Z"/><path class="eagle-wing w2" d="M72 45 C91 11 119 10 128 27 C103 25 89 39 70 56 Z"/><circle class="eagle-head" cx="92" cy="39" r="12"/><path class="eagle-beak" d="M101 37 L123 41 L102 47 Z"/><circle class="eagle-eye" cx="94" cy="36" r="2.5"/></g></svg>`
  };
  const scaryCreature = {
    a: `<svg viewBox="0 0 110 86" aria-hidden="true"><g class="haunt ghost"><path class="ghost-body" d="M31 71 Q27 40 38 25 Q50 9 67 18 Q83 27 80 55 L79 74 L70 66 L61 75 L51 66 L42 75 Z"/><circle class="ghost-eye" cx="50" cy="38" r="3"/><circle class="ghost-eye" cx="65" cy="38" r="3"/><path class="ghost-mouth" d="M53 49 q5 4 10 0"/></g></svg>`,
    b: `<svg viewBox="0 0 110 86" aria-hidden="true"><g class="haunt vampire"><path class="vamp-cape" d="M23 75 Q27 40 42 28 Q55 17 70 29 Q84 42 91 75 L70 64 L56 77 L42 64 Z"/><circle class="vamp-head" cx="57" cy="30" r="16"/><path class="vamp-hair" d="M42 30 Q43 10 57 13 Q72 10 73 31 L65 23 L57 30 L49 23 Z"/><circle class="vamp-eye" cx="52" cy="29" r="2.5"/><circle class="vamp-eye" cx="63" cy="29" r="2.5"/><path class="vamp-mouth" d="M50 38 Q57 42 65 38"/><path class="vamp-fang" d="M53 39 L55 46 L58 40 M61 40 L64 46 L65 39"/><path class="vamp-collar" d="M43 44 L56 53 L72 43 L67 58 L56 54 L46 59 Z"/></g></svg>`,
    c: `<svg viewBox="0 0 132 88" aria-hidden="true"><g class="haunt bat flyer-bird"><ellipse class="bat-body" cx="66" cy="47" rx="17" ry="18"/><path class="bat-wing w1" d="M51 43 C34 17 13 12 5 27 L23 29 L13 43 L35 40 L25 58 L55 53 Z"/><path class="bat-wing w2" d="M81 43 C98 17 119 12 127 27 L109 29 L119 43 L97 40 L107 58 L77 53 Z"/><circle class="bat-head" cx="66" cy="31" r="12"/><path class="bat-ear" d="M58 23 L57 8 L64 20 M74 23 L76 8 L68 20"/><circle class="bat-eye" cx="62" cy="30" r="2.5"/><circle class="bat-eye" cx="70" cy="30" r="2.5"/></g></svg>`
  };

  function creatureMarkup(persona) {
    return `<span class="creature-sprite cute-creature">${cuteCreature[persona] || cuteCreature.a}</span><span class="creature-sprite cool-creature">${coolCreature[persona] || coolCreature.a}</span><span class="creature-sprite royal-creature">${royalCreature[persona] || royalCreature.a}</span><span class="creature-sprite scary-creature">${scaryCreature[persona] || scaryCreature.a}</span><span class="creature-shadow"></span><span class="creature-reaction" data-creature-reaction></span>`;
  }

  function makeEntityElement(body, kind, role = 'object', persona = '') {
    const el = document.createElement('div');
    el.className = `physics-entity role-${role} kind-${kind}`;
    el.dataset.physicsId = String(body.id);
    el.dataset.kind = kind;
    el.dataset.role = role;
    if (persona) el.dataset.persona = persona;
    el.innerHTML = role === 'creature'
      ? creatureMarkup(persona)
      : '<span class="object-glyph"></span><span class="object-shine"></span>';
    layer.appendChild(el);
    bodyMap.set(body.id, body);
    domMap.set(body.id, el);
    return el;
  }

  function showReaction(body, symbol, duration = 900) {
    const reaction = domMap.get(body.id)?.querySelector('[data-creature-reaction]');
    if (!reaction) return;
    reaction.textContent = symbol;
    reaction.classList.remove('is-visible');
    void reaction.offsetWidth;
    reaction.classList.add('is-visible');
    clearTimeout(reaction._timer);
    reaction._timer = setTimeout(() => reaction.classList.remove('is-visible'), duration);
  }

  function configureCreature(body) {
    const now = nowMs();
    const persona = body.plugin.persona;
    body.plugin.ai = {
      state: persona === 'c' ? 'fly' : 'idle',
      direction: Math.random() > .5 ? 1 : -1,
      stateUntil: now + rand(500, 1300),
      nextHop: now + rand(1600, 4200),
      lastX: body.position.x,
      blockedFor: 0,
      type: persona === 'c' ? 'flyer' : 'walker',
      targetAltitude: rand(.25,.46),
      recoverAt: 0,
      nextFlap: now + rand(500, 1500),
      nextRetarget: now + rand(2400, 5200),
      foodTarget: null,
      nextFoodCheck: now + rand(400, 1300),
      eatCooldownUntil: 0,
      inspectTarget: null,
      nextCuriosityCheck: now + rand(1800, 4800),
      toyTarget: null,
      nextToyCheck: now + rand(1800, 4200),
      socialCooldownUntil: 0,
      restTarget: null,
      restUntil: 0,
      nextRestCheck: now + rand(3500, 7500),
      personality: speciesProfile[persona]?.personality || 'CURIOUS'
    };
    body.sleepThreshold = 999999;
    Body.setInertia(body, Infinity);
    Body.setAngularVelocity(body, 0);
    Body.setAngle(body, 0);
  }

  function addDynamic(kind, x, y, options = {}) {
    const size = options.size || 44;
    const shape = options.shape || 'circle';
    const role = options.role || 'object';
    const isFood = kind.startsWith('food-');
    const collisionFilter = role === 'creature'
      ? { category:COLLISION.CREATURE, mask:COLLISION.WORLD | COLLISION.PROP }
      : isFood
        ? { category:COLLISION.FOOD, mask:COLLISION.WORLD | COLLISION.FOOD | COLLISION.PROP }
        : { category:COLLISION.PROP, mask:COLLISION.WORLD | COLLISION.CREATURE | COLLISION.FOOD | COLLISION.PROP };
    const common = {
      restitution: options.restitution ?? .5,
      friction: options.friction ?? .32,
      frictionAir: options.frictionAir ?? .008,
      density: options.density ?? .0013,
      sleepThreshold: role === 'creature' ? 999999 : 60,
      collisionFilter
    };
    const body = shape === 'box'
      ? Bodies.rectangle(x, y, size, size, { ...common, chamfer: { radius: Math.min(10, size * .2) } })
      : Bodies.circle(x, y, size / 2, common);

    body.plugin.renderSize = size;
    body.plugin.kind = kind;
    body.plugin.role = role;
    body.plugin.persona = options.persona || '';
    body.plugin.userSpawned = Boolean(options.userSpawned);
    body.plugin.isFood = isFood;
    body.plugin.foodType = body.plugin.isFood ? kind : '';
    body.plugin.foodCategory = body.plugin.isFood ? (foodCategory[kind] || '') : '';
    body.plugin.claimedBy = null;
    body.plugin.spawnedAt = nowMs();

    if (body.plugin.role === 'creature') configureCreature(body);
    World.add(engine.world, body);
    dynamicBodies.push(body);
    makeEntityElement(body, kind, body.plugin.role, body.plugin.persona);
    if (body.plugin.role === 'creature') creatureBodies.push(body);
    if (body.plugin.userSpawned) userBodies.add(body);
    if (body.plugin.isFood) foodBodies.add(body);
    return body;
  }

  function releaseFoodClaim(creature) {
    const food = creature?.plugin?.ai?.foodTarget;
    if (food?.plugin?.claimedBy === creature.id) food.plugin.claimedBy = null;
    if (creature?.plugin?.ai) creature.plugin.ai.foodTarget = null;
  }

  function hideInspector() {
    inspectedCreature = null;
    if (inspector) inspector.hidden = true;
  }

  function removeBody(body) {
    if (!body || !bodyMap.has(body.id)) return;
    if (body.plugin.role === 'creature') releaseFoodClaim(body);
    creatureBodies.forEach((creature) => {
      const ai = creature.plugin.ai;
      if (ai?.foodTarget === body) { releaseFoodClaim(creature); ai.nextFoodCheck = nowMs() + 300; }
      if (ai?.inspectTarget === body) ai.inspectTarget = null;
      if (ai?.toyTarget === body) ai.toyTarget = null;
    });
    if (inspectedCreature === body) hideInspector();
    World.remove(engine.world, body);
    dynamicBodies = dynamicBodies.filter((b) => b !== body);
    userBodies.delete(body);
    foodBodies.delete(body);
    const ci = creatureBodies.indexOf(body);
    if (ci >= 0) creatureBodies.splice(ci, 1);
    domMap.get(body.id)?.remove();
    domMap.delete(body.id);
    bodyMap.delete(body.id);
    updatePopulationCounts();
  }

  function clearWorld() {
    dynamicBodies.forEach((body) => World.remove(engine.world, body));
    boundaryBodies.forEach((body) => World.remove(engine.world, body));
    dynamicBodies = [];
    creatureBodies.length = 0;
    boundaryBodies.length = 0;
    userBodies.clear();
    foodBodies.clear();
    bodyMap.clear();
    domMap.clear();
    layer.innerHTML = '';
    hideInspector();
  }

  function groundY() { return worldEl.clientHeight * .78; }

  function buildBoundaries() {
    const w = worldEl.clientWidth, h = worldEl.clientHeight, t = 80, gy = groundY();
    const ground = Bodies.rectangle(w / 2, gy + t / 2, w + t * 2, t, { isStatic: true });
    const left = Bodies.rectangle(-t / 2, h / 2, t, h * 2, { isStatic: true });
    const right = Bodies.rectangle(w + t / 2, h / 2, t, h * 2, { isStatic: true });
    const ceiling = Bodies.rectangle(w / 2, -t / 2, w + t * 2, t, { isStatic: true });
    boundaryBodies.push(ground, left, right, ceiling);
    World.add(engine.world, [ground, left, right, ceiling]);
  }

  function populationSnapshot() {
    return ['a','b','c'].reduce((out, persona) => {
      out[persona] = creatureBodies.filter((b) => b.plugin.persona === persona).length;
      return out;
    }, {});
  }

  function updatePopulationCounts() {
    const counts = populationSnapshot();
    populationCounts.forEach((el) => { el.textContent = String(counts[el.dataset.populationCount] || 0); });
  }

  function safeGroundSpawnX(persona) {
    const w = worldEl.clientWidth;
    const existing = creatureBodies.filter((b) => b.plugin.persona !== 'c');
    for (let tries=0; tries<10; tries+=1) {
      const x = rand(w*.12,w*.88);
      if (existing.every((b)=>Math.abs(b.position.x-x)>72)) return x;
    }
    return rand(w*.15,w*.85);
  }

  function spawnCreature(persona, x = null, y = null) {
    if (creatureBodies.length >= MAX_ANIMALS) { statusEl.textContent = `Animal limit reached (${MAX_ANIMALS})`; return null; }
    const w = worldEl.clientWidth, gy = groundY();
    const flyer = persona === 'c';
    const sx = x ?? (flyer ? rand(w*.18,w*.82) : safeGroundSpawnX(persona));
    const sy = y ?? (flyer ? rand(gy*.24,gy*.48) : gy - (smallScreen ? 34 : 42));
    const body = addDynamic('creature', sx, sy, {
      size: smallScreen ? 56 : 70,
      shape:'circle', role:'creature', persona,
      restitution:.11, friction:.9, frictionAir:flyer?.045:.06, density:.0019
    });
    updatePopulationCounts();
    return body;
  }

  function buildWorld(counts = {a:1,b:1,c:1}) {
    clearWorld();
    buildBoundaries();
    ['a','b','c'].forEach((persona) => {
      const n = clamp(Number(counts[persona] || 0),0,MAX_ANIMALS);
      for (let i=0;i<n && creatureBodies.length<MAX_ANIMALS;i+=1) spawnCreature(persona);
    });
    updatePopulationCounts();
    statusEl.textContent = 'Simulation live';
  }

  function resetWorld() { buildWorld({a:1,b:1,c:1}); }

  function spawnConfig(kind) {
    if (kind.startsWith('food-')) return { size: kind === 'food-meat' ? 28 : 32, shape:'circle', restitution:.16, friction:.72, frictionAir:.025 };
    switch (kind) {
      case 'block': return { size:46, shape:'box', restitution:.18, friction:.55 };
      case 'rock': return { size:40, shape:'box', restitution:.15, friction:.72, density:.0025 };
      case 'bouncy': return { size:36, shape:'circle', restitution:.94, friction:.08, frictionAir:.004 };
      default: return { size:38, shape:'circle', restitution:.62, friction:.24 };
    }
  }

  function friendlyDropName(kind) {
    return ({'food-plant':'plant food','food-meat':'meat','food-omnivore':'fancy omnivore food',ball:'ball',block:'block',rock:'rock',bouncy:'bouncy ball'})[kind] || kind;
  }

  function spawnUserObject(kind, x, y) {
    if (userBodies.size >= MAX_DROPS) { statusEl.textContent = 'Drop limit reached'; return null; }
    const cfg = spawnConfig(kind);
    const body = addDynamic(kind, x, y, { ...cfg, userSpawned:true });
    statusEl.textContent = kind.startsWith('food-') ? `${friendlyDropName(kind)} dropped` : `${friendlyDropName(kind)} dropped`;
    return body;
  }

  function setDropTool(tool) {
    selectedTool = tool;
    dropButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.dropTool === tool)));
    statusEl.textContent = `Drop tool: ${friendlyDropName(tool)}`;
  }

  function setActivity(next) {
    if (!(next in activityFactor)) return;
    activity = next;
    activityButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.roomActivity === next)));
    statusEl.textContent = `Activity: ${next}`;
  }

  dropButtons.forEach((button) => button.addEventListener('click', () => setDropTool(button.dataset.dropTool)));
  activityButtons.forEach((button) => button.addEventListener('click', () => setActivity(button.dataset.roomActivity)));
  clearDropsButton?.addEventListener('click', () => {
    [...userBodies].forEach(removeBody);
    statusEl.textContent = 'Dropped objects cleared';
  });

  populationButtons.forEach((button) => button.addEventListener('click', () => {
    const row = button.closest('[data-population-species]');
    const persona = row?.dataset.populationSpecies;
    if (!persona) return;
    if (button.dataset.populationAction === 'plus') {
      const creature = spawnCreature(persona);
      if (creature) { showReaction(creature, document.documentElement.dataset.theme === 'cute' ? '♡' : '+', 750); statusEl.textContent = 'Creature added'; }
      return;
    }
    const matches = creatureBodies.filter((b) => b.plugin.persona === persona);
    if (!matches.length) { statusEl.textContent = 'That population is already zero'; return; }
    removeBody(matches[matches.length-1]);
    statusEl.textContent = 'Creature removed';
  }));

  function nearestBody(from, bodies, maxDistance = Infinity, scoreFn = null) {
    let best = null, bestDistance = maxDistance, bestScore = Infinity;
    bodies.forEach((body) => {
      if (!bodyMap.has(body.id)) return;
      const d = Math.hypot(body.position.x - from.position.x, body.position.y - from.position.y);
      if (d > maxDistance) return;
      const score = scoreFn ? scoreFn(body,d) : d;
      if (score < bestScore) { best = body; bestDistance = d; bestScore = score; }
    });
    return { body:best, distance:bestDistance };
  }

  function claimFood(creature, food) {
    if (!food || !bodyMap.has(food.id)) return false;
    if (food.plugin.claimedBy && food.plugin.claimedBy !== creature.id) return false;
    releaseFoodClaim(creature);
    food.plugin.claimedBy = creature.id;
    creature.plugin.ai.foodTarget = food;
    return true;
  }

  function stabilizeFood(food, distance) {
    if (!food || distance > 145) return;
    const factor = distance < 90 ? .025 : .18;
    Body.setVelocity(food,{x:food.velocity.x*factor,y:food.velocity.y*factor});
    Body.setAngularVelocity(food,food.angularVelocity*.08);
  }

  function consumeFood(creature, food, now) {
    if (!food || !bodyMap.has(food.id)) return;
    const favorite = speciesProfile[creature.plugin.persona]?.favorite === food.plugin.foodType;
    food.plugin.claimedBy = null;
    removeBody(food);
    const ai = creature.plugin.ai;
    ai.foodTarget = null;
    ai.eatCooldownUntil = now + rand(2200, 4200);
    ai.nextFoodCheck = now + rand(900, 1700);
    ai.state = ai.type === 'flyer' ? 'fly' : 'idle';
    ai.stateUntil = now + 700;
    showReaction(creature, document.documentElement.dataset.theme === 'cute' ? (favorite ? '♡♡' : '♡') : (favorite ? '✦!' : '✦'), 1050);
    if (inspectedCreature === creature) updateInspector(creature);
  }

  function maybeFindFood(body, now) {
    const ai = body.plugin.ai;
    if (ai.foodTarget && bodyMap.has(ai.foodTarget.id) && (!ai.foodTarget.plugin.claimedBy || ai.foodTarget.plugin.claimedBy === body.id)) return ai.foodTarget;
    releaseFoodClaim(body);
    if (now < ai.nextFoodCheck || now < ai.eatCooldownUntil || !foodBodies.size) return null;
    const profile = speciesProfile[body.plugin.persona] || speciesProfile.a;
    const candidates = [...foodBodies].filter((food) => canEat(body,food) && (!food.plugin.claimedBy || food.plugin.claimedBy === body.id) && (ai.type==='flyer' || food.position.y>groundY()-72));
    const found = nearestBody(body, candidates, smallScreen ? profile.foodRange*.75 : profile.foodRange, (food,d) => d * (food.plugin.foodType === profile.favorite ? .62 : 1));
    ai.nextFoodCheck = now + rand(500, 1350) / activityFactor[activity];
    if (found.body && claimFood(body,found.body)) showReaction(body, found.body.plugin.foodType === profile.favorite ? '!' : '·', 600);
    return ai.foodTarget;
  }

  function habitatPoint(name) {
    const el = worldEl.querySelector(`[data-habitat="${name}"]`);
    if (!el) return null;
    const wr = worldEl.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x:r.left-wr.left+r.width/2, y:r.top-wr.top+r.height/2 };
  }

  function maybeChooseRest(body, now) {
    const ai = body.plugin.ai, profile = speciesProfile[body.plugin.persona];
    if (ai.type === 'flyer' || ai.foodTarget || ai.inspectTarget || ai.toyTarget || now < ai.nextRestCheck) return false;
    ai.nextRestCheck = now + rand(5000,10000) / activityFactor[activity];
    if (Math.random() > profile.restChance) return false;
    const point = habitatPoint(Math.random() < .7 ? 'nest' : 'patch');
    if (!point) return false;
    ai.restTarget = point;
    ai.state = 'seek-rest';
    return true;
  }

  function maybeFindToy(body, now) {
    const ai=body.plugin.ai, profile=speciesProfile[body.plugin.persona];
    if (ai.type!=='walker' || ai.foodTarget || ai.inspectTarget || now<ai.nextToyCheck) return;
    ai.nextToyCheck=now+rand(2800,6200)/activityFactor[activity];
    if (Math.random()>profile.curiosity*activityFactor[activity]) return;
    const toys=[...userBodies].filter((b)=>['ball','bouncy'].includes(b.plugin.kind));
    const found=nearestBody(body,toys,220);
    if(found.body){ai.toyTarget=found.body;ai.state='play';showReaction(body,'?',650);}
  }

  function maybeFindCuriosity(body, now) {
    const ai=body.plugin.ai, profile=speciesProfile[body.plugin.persona];
    if (ai.type !== 'walker' || ai.foodTarget || ai.toyTarget || now < ai.nextCuriosityCheck) return;
    ai.nextCuriosityCheck = now + rand(2600, 6000) / activityFactor[activity];
    if (Math.random() > profile.curiosity * .72 * activityFactor[activity]) return;
    const candidates = [...userBodies].filter((b) => !b.plugin.isFood && !['ball','bouncy'].includes(b.plugin.kind) && now - (b.plugin.spawnedAt || 0) < 9000);
    const found = nearestBody(body, candidates, 210);
    if (found.body) { ai.inspectTarget = found.body; ai.state = 'inspect'; }
  }

  function beginWalk(body, now, forcedDirection = null) {
    const ai = body.plugin.ai;
    ai.state = 'walk'; ai.restTarget = null;
    if (forcedDirection) ai.direction = forcedDirection;
    else if (Math.random() < .35) ai.direction *= -1;
    ai.stateUntil = now + rand(1500, 4000) / activityFactor[activity];
    ai.blockedFor = 0; ai.lastX = body.position.x; Sleeping.set(body, false);
  }

  function beginIdle(body, now) {
    const ai = body.plugin.ai;
    ai.state = 'idle'; ai.restTarget = null;
    ai.stateUntil = now + rand(650, 1800) / activityFactor[activity];
    ai.blockedFor = 0;
    Body.setVelocity(body, { x:body.velocity.x*.14, y:body.velocity.y });
    if (Math.random() < .12) showReaction(body, 'z', 700);
  }

  function hop(body, direction, strength = 1) {
    Sleeping.set(body, false);
    Body.setVelocity(body, { x:clamp(body.velocity.x+direction*1.12*strength,-4.6,4.6), y:Math.min(body.velocity.y,-3.7*strength) });
  }

  function controlFlyer(body, now, dtMs) {
    const ai = body.plugin.ai, w = worldEl.clientWidth, gy = groundY();
    Sleeping.set(body,false); Body.setAngularVelocity(body,0); Body.setAngle(body,0);

    if (ai.state === 'tossed' && now < ai.recoverAt) return;
    if (ai.state === 'tossed' && now >= ai.recoverAt) { ai.state='fly'; ai.targetAltitude=rand(.25,.46); ai.nextRetarget=now+rand(2200,4800); }

    const food = maybeFindFood(body,now);
    if (!food) maybeChooseRest(body,now);

    let targetX, targetY;
    if (food && bodyMap.has(food.id)) {
      targetX=food.position.x; targetY=Math.max(48,food.position.y-4);
      const dist=Math.hypot(targetX-body.position.x,targetY-body.position.y);
      stabilizeFood(food,dist);
      if(dist<84){consumeFood(body,food,now);targetX=body.position.x;targetY=gy*ai.targetAltitude;}
      else ai.state='seek-food';
    } else {
      if (body.position.x<48) ai.direction=1;
      if (body.position.x>w-48) ai.direction=-1;
      if (now>=ai.nextRetarget){ai.targetAltitude=rand(.23,.49);ai.nextRetarget=now+rand(2600,5600)/activityFactor[activity];if(Math.random()<.35)ai.direction*=-1;}
      targetX=body.position.x+ai.direction*120; targetY=gy*ai.targetAltitude; ai.state='fly';
    }

    const dx=targetX-body.position.x,dy=targetY-body.position.y;
    if(Math.abs(dx)>8)ai.direction=dx<0?-1:1;
    const desiredX=clamp(dx*.022,-2.45,2.45)*activityFactor[activity];
    let desiredY=clamp(dy*.055,-5.5,4.3);
    if(body.position.y>gy-60)desiredY=Math.min(desiredY,-5.9);
    if(body.position.y<52)desiredY=Math.max(desiredY,2.0);
    const response=clamp(dtMs/58,.18,.58);
    let nextY=body.velocity.y+(desiredY-body.velocity.y)*response;
    let nextX=body.velocity.x+(desiredX-body.velocity.x)*Math.min(.42,response*.82);
    if(now>=ai.nextFlap){nextY-=rand(.45,1.15);ai.nextFlap=now+rand(650,1450)/activityFactor[activity];}
    Body.setVelocity(body,{x:clamp(nextX,-4.6,4.6),y:clamp(nextY,-6.5,5.0)});
  }

  function thinkWalkCreature(body, now, dtMs) {
    const ai=body.plugin.ai, profile=speciesProfile[body.plugin.persona];
    const food=maybeFindFood(body,now);
    if(food&&bodyMap.has(food.id)){
      ai.state='seek-food';const dx=food.position.x-body.position.x;ai.direction=dx<0?-1:1;
      const desired=ai.direction*1.72*activityFactor[activity];Body.setVelocity(body,{x:body.velocity.x+(desired-body.velocity.x)*.48,y:body.velocity.y});
      const dist=Math.hypot(dx,food.position.y-body.position.y);stabilizeFood(food,dist);if(dist<64)consumeFood(body,food,now);return;
    }

    if (ai.state === 'rest' && now < ai.restUntil) { Body.setVelocity(body,{x:body.velocity.x*.08,y:body.velocity.y}); return; }
    if (ai.state === 'rest' && now >= ai.restUntil) beginIdle(body,now);

    maybeFindToy(body,now);
    if(ai.toyTarget){
      if(!bodyMap.has(ai.toyTarget.id))ai.toyTarget=null;
      else{const dx=ai.toyTarget.position.x-body.position.x,dist=Math.abs(dx);if(dist>46){ai.direction=dx<0?-1:1;const desired=ai.direction*1.25*activityFactor[activity];Body.setVelocity(body,{x:body.velocity.x+(desired-body.velocity.x)*.42,y:body.velocity.y});ai.state='play';return;}const push=ai.direction*rand(2.2,4.2);Body.setVelocity(ai.toyTarget,{x:clamp(ai.toyTarget.velocity.x+push,-8,8),y:Math.min(ai.toyTarget.velocity.y,-rand(.8,2.2))});showReaction(body,document.documentElement.dataset.theme==='cute'?'♡':'!',750);ai.toyTarget=null;ai.nextToyCheck=now+rand(3500,6500);beginIdle(body,now);return;}
    }

    maybeFindCuriosity(body,now);
    if(ai.inspectTarget){
      if(!bodyMap.has(ai.inspectTarget.id))ai.inspectTarget=null;
      else{const dx=ai.inspectTarget.position.x-body.position.x,dist=Math.abs(dx);if(dist>48){ai.direction=dx<0?-1:1;const desired=ai.direction*1.15*activityFactor[activity];Body.setVelocity(body,{x:body.velocity.x+(desired-body.velocity.x)*.42,y:body.velocity.y});ai.state='inspect';return;}Body.setVelocity(body,{x:body.velocity.x*.2,y:body.velocity.y});showReaction(body,'?',850);ai.inspectTarget=null;ai.nextCuriosityCheck=now+rand(3500,6500);ai.state='idle';ai.stateUntil=now+900;return;}
    }

    if(ai.state==='seek-rest'&&ai.restTarget){const dx=ai.restTarget.x-body.position.x;if(Math.abs(dx)>34){ai.direction=dx<0?-1:1;const desired=ai.direction*profile.speed*.85;Body.setVelocity(body,{x:body.velocity.x+(desired-body.velocity.x)*.42,y:body.velocity.y});return;}ai.state='rest';ai.restUntil=now+rand(2200,5000);Body.setVelocity(body,{x:0,y:body.velocity.y});showReaction(body,document.documentElement.dataset.theme==='cute'?'z':'·',750);return;}
    if(!['seek-rest','rest'].includes(ai.state)) maybeChooseRest(body,now);
    if(ai.state==='seek-rest') return;

    const w=worldEl.clientWidth,edge=smallScreen?38:50;
    if(body.position.x<edge)beginWalk(body,now,1);else if(body.position.x>w-edge)beginWalk(body,now,-1);
    if(ai.state==='idle'&&now>=ai.stateUntil)beginWalk(body,now);else if(ai.state==='walk'&&now>=ai.stateUntil)beginIdle(body,now);else if(ai.state==='startled'&&now>=ai.stateUntil)beginWalk(body,now,ai.direction);
    if(ai.state==='walk'){
      const desired=ai.direction*profile.speed*activityFactor[activity];Body.setVelocity(body,{x:body.velocity.x+(desired-body.velocity.x)*.42,y:body.velocity.y});
      const moved=Math.abs(body.position.x-ai.lastX);if(moved<1.15)ai.blockedFor+=dtMs;else ai.blockedFor=Math.max(0,ai.blockedFor-dtMs*.65);
      if(ai.blockedFor>650){ai.direction*=-1;ai.blockedFor=0;hop(body,ai.direction,.82);ai.stateUntil=now+rand(1200,2400);}
      if(now>=ai.nextHop&&Math.random()<.32*activityFactor[activity]){hop(body,ai.direction,.74);ai.nextHop=now+rand(2400,5600)/activityFactor[activity];}
    }
    ai.lastX=body.position.x;
  }

  function socialAwareness(now){
    for(let i=0;i<creatureBodies.length;i+=1){const a=creatureBodies[i],ai=a.plugin.ai;if(now<ai.socialCooldownUntil||ai.foodTarget)continue;for(let j=i+1;j<creatureBodies.length;j+=1){const b=creatureBodies[j],bi=b.plugin.ai;if(now<bi.socialCooldownUntil||bi.foodTarget)continue;const dist=Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y);if(dist<82&&Math.random()<.025*activityFactor[activity]){ai.socialCooldownUntil=bi.socialCooldownUntil=now+rand(3500,6500);if(ai.type==='walker')beginIdle(a,now);if(bi.type==='walker')beginIdle(b,now);showReaction(a,document.documentElement.dataset.theme==='cute'?'♡':'·',700);showReaction(b,document.documentElement.dataset.theme==='cute'?'♡':'·',700);return;}}}
  }

  function thinkCreatures(now,dtMs){
    creatureBodies.forEach((body)=>{if(dragging?.body===body)return;const ai=body.plugin.ai;if(ai.type==='flyer'){ai.lastX=body.position.x;return;}Sleeping.set(body,false);Body.setAngularVelocity(body,0);Body.setAngle(body,0);thinkWalkCreature(body,now,dtMs);});
    socialAwareness(now);
    if(inspectedCreature&&bodyMap.has(inspectedCreature.id))updateInspector(inspectedCreature);
  }

  Events.on(engine,'collisionStart',(event)=>{
    event.pairs.forEach(({bodyA,bodyB})=>{
      [[bodyA,bodyB],[bodyB,bodyA]].forEach(([creature,other])=>{
        if(creature.plugin?.role!=='creature'||other.isStatic||other.plugin?.role==='creature'||other.plugin?.isFood)return;
        const impact=Math.hypot(other.velocity.x,other.velocity.y);if(impact<2.2)return;
        const ai=creature.plugin.ai,direction=other.position.x<creature.position.x?1:-1;showReaction(creature,'!',650);
        if(ai.type==='flyer'){ai.state='tossed';ai.direction=direction;ai.recoverAt=nowMs()+rand(650,1050);ai.targetAltitude=rand(.25,.46);}else{ai.state='startled';ai.direction=direction;ai.stateUntil=nowMs()+rand(500,1000);ai.nextHop=nowMs()+rand(1800,3600);hop(creature,direction,.95);}
      });
    });
  });

  function renderBodies(){
    dynamicBodies.forEach((body)=>{
      const el=domMap.get(body.id);if(!el)return;const size=body.plugin.renderSize||44;el.style.width=`${size}px`;el.style.height=`${size}px`;
      if(body.plugin.role==='creature'){
        el.style.transform=`translate3d(${body.position.x-size/2}px,${body.position.y-size/2}px,0)`;const ai=body.plugin.ai;
        el.classList.toggle('facing-left',ai.direction<0);el.classList.toggle('is-walking',['walk','seek-food','inspect','play','seek-rest'].includes(ai.state));el.classList.toggle('is-idle',['idle','rest'].includes(ai.state));el.classList.toggle('is-startled',['startled','tossed'].includes(ai.state));el.classList.toggle('is-flying',ai.type==='flyer');el.classList.toggle('is-resting',ai.state==='rest');el.classList.toggle('is-seeking-food',Boolean(ai.foodTarget));
        if(ai.type==='flyer'){const altitude=clamp(1-body.position.y/Math.max(1,groundY()),0,1);el.style.setProperty('--fly-shadow-scale',String(.55+(1-altitude)*.45));el.style.setProperty('--fly-shadow-opacity',String(.18+(1-altitude)*.42));el.style.setProperty('--fly-shadow-offset',`${18+altitude*26}px`);}
      }else el.style.transform=`translate3d(${body.position.x-size/2}px,${body.position.y-size/2}px,0) rotate(${body.angle}rad)`;
    });
  }

  function pointerPosition(event){const r=worldEl.getBoundingClientRect();return{x:clamp(event.clientX-r.left,0,r.width),y:clamp(event.clientY-r.top,0,r.height)};}
  function bodyForTarget(target){const entity=target.closest('[data-physics-id]');if(!entity)return null;return{body:bodyMap.get(Number(entity.dataset.physicsId)),el:entity};}

  function speciesName(body){
    const theme=document.documentElement.dataset.theme;
    const p=body.plugin.persona;
    if(theme==='cute') return ({a:'Garden Bunny',b:'Garden Kitty',c:'Sky Bird'}[p]||'Tiny Friend');
    if(theme==='royal') return ({a:'Court Attendant',b:'Royal Noble',c:'Royal Eagle'}[p]||'Court Creature');
    if(theme==='scary') return ({a:'Little Ghost',b:'Vampire',c:'Night Bat'}[p]||'Night Creature');
    return ({a:'Herbivore',b:'Raptor',c:'Flyer'}[p]||'Creature');
  }
  function actionName(body){return String(body.plugin.ai?.state||'idle').replaceAll('-',' ').toUpperCase();}
  function updateInspector(body){if(!inspector||!body||!bodyMap.has(body.id))return;inspectedCreature=body;inspector.hidden=false;if(inspectorSpecies)inspectorSpecies.textContent=speciesName(body);if(inspectorPersonality)inspectorPersonality.textContent=body.plugin.ai?.personality||'CURIOUS';if(inspectorAction)inspectorAction.textContent=actionName(body);}
  inspectorClose?.addEventListener('click',(event)=>{event.stopPropagation();hideInspector();});

  function petCreature(body){
    const ai=body.plugin.ai;{const t=document.documentElement.dataset.theme;showReaction(body,t==='cute'?'♡':t==='royal'?'♛':t==='scary'?'☾':'✦',1000);}
    if(ai.type==='walker'){ai.state='idle';ai.stateUntil=nowMs()+850;Body.setVelocity(body,{x:body.velocity.x*.15,y:body.velocity.y});}
    updateInspector(body);{const t=document.documentElement.dataset.theme;statusEl.textContent=t==='cute'?'Tiny friend approved ♡':t==='royal'?'Court companion acknowledged ♛':t==='scary'?'Night creature noticed you ☾':'Creature acknowledged';}
  }

  worldEl.addEventListener('pointerdown',(event)=>{
    if(event.button!==0)return;const hit=bodyForTarget(event.target);
    if(hit?.body){if(hit.body.isStatic)return;const p=pointerPosition(event);dragging={body:hit.body,el:hit.el,pointerId:event.pointerId,lastX:p.x,lastY:p.y,startX:p.x,startY:p.y,lastT:nowMs(),vx:0,vy:0,moved:false,offsetX:p.x-hit.body.position.x,offsetY:p.y-hit.body.position.y};Sleeping.set(hit.body,false);Body.setStatic(hit.body,true);hit.el.classList.add('is-dragging');worldEl.setPointerCapture?.(event.pointerId);statusEl.textContent='Holding object';return;}
    if(event.target.closest('button,input,label,a,[data-creature-inspector]'))return;const p=pointerPosition(event);spawnUserObject(selectedTool,p.x,p.y);
  });
  worldEl.addEventListener('pointermove',(event)=>{if(!dragging||event.pointerId!==dragging.pointerId)return;const p=pointerPosition(event),now=nowMs(),dt=Math.max(8,now-dragging.lastT);dragging.vx=(p.x-dragging.lastX)/dt*16;dragging.vy=(p.y-dragging.lastY)/dt*16;dragging.lastX=p.x;dragging.lastY=p.y;dragging.lastT=now;if(Math.hypot(p.x-dragging.startX,p.y-dragging.startY)>6)dragging.moved=true;Body.setPosition(dragging.body,{x:p.x-dragging.offsetX,y:p.y-dragging.offsetY});},{passive:true});

  function release(event){
    if(!dragging||event.pointerId!==dragging.pointerId)return;const{body,el,vx,vy,moved}=dragging;Body.setStatic(body,false);Sleeping.set(body,false);
    if(body.plugin.role==='creature'&&!moved){Body.setVelocity(body,{x:body.velocity.x*.2,y:body.velocity.y*.2});petCreature(body);}else{Body.setVelocity(body,{x:clamp(vx,-16,16),y:clamp(vy,-16,16)});if(body.plugin.role==='creature'){Body.setAngularVelocity(body,0);Body.setAngle(body,0);const ai=body.plugin.ai;ai.direction=vx<0?-1:1;ai.restTarget=null;if(ai.type==='flyer'){ai.state='tossed';ai.recoverAt=nowMs()+1200;ai.targetAltitude=rand(.25,.48);}else{ai.state='startled';ai.stateUntil=nowMs()+700;}}}
    el.classList.remove('is-dragging');dragging=null;statusEl.textContent='Simulation live';
  }
  worldEl.addEventListener('pointerup',release);worldEl.addEventListener('pointercancel',release);

  gravityControl?.addEventListener('input',()=>{engine.gravity.y=Number(gravityControl.value);statusEl.textContent=`Gravity ${Number(gravityControl.value).toFixed(2)}×`;});
  pauseButton?.addEventListener('click',()=>{paused=!paused;pauseButton.textContent=paused?'Resume':'Pause';statusEl.textContent=paused?'Simulation paused':'Simulation live';});
  resetButton?.addEventListener('click',resetWorld);

  window.addEventListener('worldthemechange',()=>{worldEl.classList.remove('is-world-shifting');void worldEl.offsetWidth;worldEl.classList.add('is-world-shifting');if(inspectedCreature)updateInspector(inspectedCreature);statusEl.textContent='World shifted. Keep playing.';window.setTimeout(()=>{worldEl.classList.remove('is-world-shifting');if(!paused)statusEl.textContent='Simulation live';},reduceMotion?50:520);});
  const updateWorldVisibility=()=>{visible=worldInView&&!document.hidden;lastTime=performance.now();};
  document.addEventListener('visibilitychange',updateWorldVisibility);
  new IntersectionObserver((entries)=>{worldInView=entries[0]?.isIntersecting??true;updateWorldVisibility();},{rootMargin:'160px'}).observe(worldEl);

  function finishLoading(){if(ready)return;ready=true;worldEl.classList.add('is-ready');if(loading){loading.classList.add('is-done');setTimeout(()=>{loading.hidden=true;},reduceMotion?0:420);}}
  function frame(now){requestAnimationFrame(frame);if(!visible){lastTime=now;return;}const dt=clamp(now-lastTime,8,34);lastTime=now;if(!paused){if(now-lastCreatureThink>=150){thinkCreatures(now,now-lastCreatureThink||150);lastCreatureThink=now;}creatureBodies.forEach((body)=>{if(body.plugin.ai?.type==='flyer'&&dragging?.body!==body)controlFlyer(body,now,dt);});Engine.update(engine,dt);}renderBodies();finishLoading();}

  const resizeObserver=new ResizeObserver(()=>{if(!dynamicBodies.length)return;clearTimeout(resizeObserver.timer);const counts=populationSnapshot();resizeObserver.timer=setTimeout(()=>buildWorld(counts),180);});
  resizeObserver.observe(worldEl);

  try{setDropTool('food-plant');setActivity('normal');resetWorld();requestAnimationFrame(frame);}catch(error){console.error('Room failed to initialize',error);failWorld();}
})();
