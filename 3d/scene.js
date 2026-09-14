(() => {
  const canvas = document.querySelector('[data-three-canvas]');
  const stage = document.querySelector('[data-three-stage]');
  const fallback = document.querySelector('[data-three-fallback]');
  const loading = document.querySelector('[data-three-loading]');
  if (!canvas || !stage) return;

  const failScene = () => {
    if (loading) loading.hidden = true;
    fallback?.removeAttribute('hidden');
    stage.classList.add('has-failed');
  };
  if (!window.THREE) { failScene(); return; }

  const THREE = window.THREE;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const smallScreen = window.matchMedia('(max-width: 760px)').matches;
  const nameEl = document.querySelector('[data-scene-name]');
  const kickerEl = document.querySelector('[data-scene-kicker]');
  const titleEl = document.querySelector('[data-scene-title]');
  const descriptionEl = document.querySelector('[data-scene-description]');
  const hudCoords = document.querySelector('[data-hud-coords]');
  const hudSpeed = document.querySelector('[data-hud-speed]');
  const hudLock = document.querySelector('[data-hud-lock]');
  const inspectionPanel = document.querySelector('[data-inspection-panel]');
  const inspectionClose = document.querySelector('[data-inspection-close]');
  const colorButtons = [...document.querySelectorAll('[data-scene-color]')];
  const toggleButtons = [...document.querySelectorAll('[data-scene-toggle]')];
  const speedButtons = [...document.querySelectorAll('[data-scene-speed]')];
  const materialButtons = [...document.querySelectorAll('[data-scene-material]')];
  const resetButton = document.querySelector('[data-scene-reset]');
  const orbitLockButton = document.querySelector('[data-scene-orbit-lock]');
  const shapeCycleButton = document.querySelector('[data-scene-shape-cycle]');
  const shapeLabel = document.querySelector('[data-scene-shape-label]');
  const densityButtons = [...document.querySelectorAll('[data-scene-density]')];
  const fogButtons = [...document.querySelectorAll('[data-scene-fog]')];
  const cameraButtons = [...document.querySelectorAll('[data-scene-camera]')];
  const glowInput = document.querySelector('[data-scene-glow]');
  const glowValue = document.querySelector('[data-scene-glow-value]');
  const distanceInput = document.querySelector('[data-scene-distance]');
  const distanceValue = document.querySelector('[data-scene-distance-value]');
  const selectionPanel = document.querySelector('[data-scene-selection]');
  const selectedLabel = document.querySelector('[data-selected-label]');
  const resetViewButton = document.querySelector('[data-reset-view]');

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, powerPreference:'high-performance' }); }
  catch (error) { console.error('WebGL renderer unavailable', error); failScene(); return; }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, smallScreen ? 1.1 : 1.55));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42,1,.1,100); camera.position.set(0,.15,8.8);
  const world = new THREE.Group(); scene.add(world);
  const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2();

  let currentTheme = document.documentElement.dataset.theme === 'cute' ? 'cute' : 'cool';
  let flavorTheme = document.documentElement.dataset.theme || 'cool';
  let rotating = [];
  let activeLights = {};
  let ready = false;
  let inspection = false;
  let documentVisible = !document.hidden;
  let stageVisible = true;
  let elapsed = 0;
  let pulse = 0;
  let selectedObject = null;
  let hoveredObject = null;
  let selectableMeshes = [];
  let focusActive = false;
  const focusPoint = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  let lastInteractionAt = performance.now();
  const pointer = {x:0,y:0,tx:0,ty:0};
  const drag = {active:false,id:null,x:0,y:0,startX:0,startY:0,moved:false};
  const worldRotation = {x:-.12,y:.28,vx:0,vy:0};
  const settings = { color:0, material:'gloss', speed:'normal', particleDensity:'medium', glow:58, fog:'atmospheric', cameraMotion:'drift', cameraDistance:8.8, orbitLocked:false, shape:0, visible:{inner:true,outer:true,moons:true,particles:true,accents:true,background:true,base:true} };
  const speedScale = {slow:.35,normal:1,fast:2.25,hyper:4.5};
  const densityScale={low:.28,medium:.55,high:.80,storm:1};
  const fogScale={clear:.34,atmospheric:1,deep:2.15};

  const palettes = {
    cool:[0x68e8ff,0x7181ff,0xa276ff,0xff5f7f,0x55d99a,0xf5f8ff],
    cute:[0xf07ab6,0xb98bea,0x87cfff,0xffad91,0x8fd8bd,0xfff1fa]
  };
  const emissives = {
    cool:[0x0b4a69,0x1a237d,0x3e176e,0x75192e,0x155c3d,0x596271],
    cute:[0x6d1d48,0x442467,0x24516d,0x743c2d,0x2c604e,0x705467]
  };

  function disposeMaterial(material){ if(!material)return; (Array.isArray(material)?material:[material]).forEach(m=>m.dispose?.()); }
  function clearWorld(){
    rotating=[]; activeLights={};
    while(world.children.length){ const child=world.children.pop(); child.traverse?.(n=>{n.geometry?.dispose?.(); disposeMaterial(n.material);}); }
    world.userData={};
  }
  function group(name){ const g=new THREE.Group(); g.name=name; world.add(g); return g; }
  function makePoints(count,spread,color,size=.03){
    const geo=new THREE.BufferGeometry(); const arr=new Float32Array(count*3);
    for(let i=0;i<count;i++){ const r=spread*(.28+Math.random()*.72),a=Math.random()*Math.PI*2,p=Math.acos(THREE.MathUtils.randFloatSpread(2)); arr[i*3]=r*Math.sin(p)*Math.cos(a); arr[i*3+1]=r*Math.sin(p)*Math.sin(a); arr[i*3+2]=r*Math.cos(p); }
    geo.setAttribute('position',new THREE.BufferAttribute(arr,3)); return new THREE.Points(geo,new THREE.PointsMaterial({color,size,transparent:true,opacity:.66,depthWrite:false}));
  }
  function heartGeometry(size=.82){
    const s=new THREE.Shape(); s.moveTo(0,.35); s.bezierCurveTo(0,.35,-.34,-.08,-.92,-.08); s.bezierCurveTo(-1.72,-.08,-1.72,.92,-1.72,.92); s.bezierCurveTo(-1.72,1.58,-1.03,2.18,0,2.86); s.bezierCurveTo(1.03,2.18,1.72,1.58,1.72,.92); s.bezierCurveTo(1.72,.92,1.72,-.08,.92,-.08); s.bezierCurveTo(.34,-.08,0,.35,0,.35);
    const g=new THREE.ExtrudeGeometry(s,{depth:.42,bevelEnabled:true,bevelSegments:4,steps:1,bevelSize:.10,bevelThickness:.10,curveSegments:22}); g.center(); g.scale(size,size,size); return g;
  }
  function starCoreGeometry(size=1){
    const s=new THREE.Shape(); const points=10, outer=.95*size, inner=.44*size;
    for(let i=0;i<points;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2===0?outer:inner,x=Math.cos(a)*r,y=Math.sin(a)*r;if(i===0)s.moveTo(x,y);else s.lineTo(x,y);}s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:.48*size,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.08*size,bevelThickness:.08*size,curveSegments:3});g.center();return g;
  }
  function crownCoreGeometry(size=1){
    const s=new THREE.Shape();
    s.moveTo(-1.05,-.58);s.lineTo(-.88,.72);s.lineTo(-.34,.18);s.lineTo(0,.92);s.lineTo(.34,.18);s.lineTo(.88,.72);s.lineTo(1.05,-.58);s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:.42,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.07,bevelThickness:.08,curveSegments:2});g.center();g.scale(size,size,size);return g;
  }
  function ghostCoreGeometry(size=1){
    const s=new THREE.Shape();s.moveTo(-.78,-.78);s.lineTo(-.78,.12);s.bezierCurveTo(-.78,.78,-.42,1.05,0,1.05);s.bezierCurveTo(.42,1.05,.78,.78,.78,.12);s.lineTo(.78,-.78);s.lineTo(.48,-.48);s.lineTo(.18,-.78);s.lineTo(-.12,-.48);s.lineTo(-.43,-.78);s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:.46,bevelEnabled:true,bevelSegments:4,steps:1,bevelSize:.08,bevelThickness:.08,curveSegments:18});g.center();g.scale(size,size,size);return g;
  }
  function coinCoreGeometry(size=1){return new THREE.CylinderGeometry(1.12*size,1.12*size,.34*size,48,2,false);}
  const shapeNames={
    cool:['Orb','Cube','Crystal','Ring Core','Relic'],
    cute:['Heart','Rounded Cube','Orb','Gem','Star Core'],
    royal:['Crown','Coin','Crystal','Orb','Royal Relic'],
    scary:['Ghost','Eyeball','Night Relic','Orb','Wisp']
  };
  function heroGeometry(theme,index){
    if(theme==='cute'){switch(index){case 1:return new THREE.BoxGeometry(1.9,1.9,1.9,4,4,4);case 2:return new THREE.SphereGeometry(1.25,36,24);case 3:return new THREE.OctahedronGeometry(1.42,1);case 4:return starCoreGeometry(1.2);default:return heartGeometry(.82);}}
    if(theme==='royal'){switch(index){case 0:return crownCoreGeometry(.95);case 1:return coinCoreGeometry(1);case 2:return new THREE.OctahedronGeometry(1.45,1);case 3:return new THREE.SphereGeometry(1.25,36,24);default:return new THREE.DodecahedronGeometry(1.38,0);}}
    if(theme==='scary'){switch(index){case 0:return ghostCoreGeometry(.95);case 1:return new THREE.SphereGeometry(1.22,36,24);case 2:return new THREE.DodecahedronGeometry(1.35,0);case 3:return new THREE.SphereGeometry(1.18,28,18);default:return new THREE.TorusKnotGeometry(.82,.25,80,12,2,5);}}
    switch(index){case 1:return new THREE.BoxGeometry(2.0,2.0,2.0,3,3,3);case 2:return new THREE.OctahedronGeometry(1.45,0);case 3:return new THREE.TorusKnotGeometry(.88,.28,90,14,2,3);case 4:return new THREE.DodecahedronGeometry(1.38,0);default:return new THREE.IcosahedronGeometry(1.28,2);}
  }
  function clearHeroDecoration(hero){
    const old=hero?.getObjectByName?.('shape-decoration');if(!old)return;old.removeFromParent();old.traverse?.(n=>{n.geometry?.dispose?.();disposeMaterial(n.material);});
  }
  function decorateHero(hero,theme,index){
    clearHeroDecoration(hero);if(!hero)return;
    if(theme==='scary'&&index===1){
      const g=new THREE.Group();g.name='shape-decoration';
      const iris=new THREE.Mesh(new THREE.CircleGeometry(.44,32),new THREE.MeshPhysicalMaterial({color:0x91b36b,emissive:0x304526,emissiveIntensity:.7,roughness:.3}));iris.position.z=1.18;
      const pupil=new THREE.Mesh(new THREE.CircleGeometry(.18,28),new THREE.MeshBasicMaterial({color:0x130c15}));pupil.position.z=1.205;pupil.scale.x=.58;g.add(iris,pupil);hero.add(g);
    }else if(theme==='royal'&&index===1){
      const g=new THREE.Group();g.name='shape-decoration';g.rotation.x=Math.PI/2;
      const crest=new THREE.Mesh(new THREE.TorusGeometry(.58,.055,10,36),new THREE.MeshBasicMaterial({color:0xf0cf6f}));crest.position.z=.20;g.add(crest);hero.add(g);
    }
  }
  function applyHeroShape(){
    const hero=world.userData.hero;if(!hero)return;const old=hero.geometry;const shapeTheme=flavorTheme||currentTheme;hero.geometry=heroGeometry(shapeTheme,settings.shape);old?.dispose?.();hero.scale.setScalar(1);
    hero.rotation.z=(shapeTheme==='cute'&&settings.shape===0)?Math.PI:0;
    hero.rotation.x=(shapeTheme==='royal'&&settings.shape===1)?Math.PI/2:0;
    decorateHero(hero,shapeTheme,settings.shape);
    // Signature shapes start in signature colors, while the color controls still take over after the first choice.
    if(settings.color===0&&hero.material?.color){
      if(shapeTheme==='royal'&&settings.shape<=1){hero.material.color.setHex(0xe1bd58);hero.material.emissive?.setHex?.(0x5b3b12);}
      if(shapeTheme==='scary'&&settings.shape===0){hero.material.color.setHex(0xc9c3cf);hero.material.emissive?.setHex?.(0x33283a);}
      if(shapeTheme==='scary'&&settings.shape===1){hero.material.color.setHex(0xd8d2c6);hero.material.emissive?.setHex?.(0x2b1d26);}
    }
    if(shapeLabel) shapeLabel.textContent=shapeNames[shapeTheme]?.[settings.shape]||'Shape';
  }
  function makeCloud(scale=1){ const g=new THREE.Group(); const m=new THREE.MeshPhysicalMaterial({color:0xfff4fb,roughness:.52,clearcoat:.25,transparent:true,opacity:.9}); [[-.72,0,.55],[-.2,.18,.72],[.42,.05,.62],[.9,-.04,.45]].forEach(([x,y,r])=>{const q=new THREE.Mesh(new THREE.SphereGeometry(r*scale,14,10),m.clone());q.position.set(x*scale,y*scale,0);g.add(q);});return g; }
  function makeBow(color){ const g=new THREE.Group(),m=new THREE.MeshPhysicalMaterial({color,roughness:.25,clearcoat:.85}); const l=new THREE.Mesh(new THREE.SphereGeometry(.25,14,10),m); l.scale.set(1.5,.75,.35);l.position.x=-.27;const r=l.clone();r.position.x=.27;const c=new THREE.Mesh(new THREE.SphereGeometry(.12,12,8),m.clone());g.add(l,r,c);return g; }
  function makeRoyalCrown(){
    const g=new THREE.Group();
    const gold=new THREE.MeshPhysicalMaterial({color:0xe1bd58,emissive:0x6d4711,emissiveIntensity:.35,metalness:.62,roughness:.2,clearcoat:1});
    const jewel=new THREE.MeshPhysicalMaterial({color:0xa94f68,emissive:0x4f1629,emissiveIntensity:.5,roughness:.2,clearcoat:1});
    const band=new THREE.Mesh(new THREE.CylinderGeometry(.52,.58,.24,28,1,true),gold); band.rotation.x=Math.PI/2; g.add(band);
    [-.38,-.19,0,.19,.38].forEach((x,i)=>{const spike=new THREE.Mesh(new THREE.ConeGeometry(.13,.58,8),gold.clone());spike.position.set(x,.38,0);spike.rotation.z=(i-2)*-.08;g.add(spike);});
    const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.13,0),jewel);gem.position.set(0,.12,.5);g.add(gem);
    g.scale.setScalar(.78);return g;
  }
  function makeScaryEye(){
    const g=new THREE.Group();
    const white=new THREE.MeshPhysicalMaterial({color:0xd8d2c6,emissive:0x2b1d26,emissiveIntensity:.18,roughness:.38,clearcoat:.6});
    const iris=new THREE.MeshStandardMaterial({color:0x668a55,emissive:0x263a20,emissiveIntensity:.8,roughness:.25});
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.58,28,18),white);eye.scale.set(1.35,.62,.34);g.add(eye);
    const pupil=new THREE.Mesh(new THREE.SphereGeometry(.19,20,14),iris);pupil.position.z=.31;pupil.scale.set(.72,1,.35);g.add(pupil);
    const thorn=new THREE.Mesh(new THREE.TorusGeometry(.78,.035,8,44),new THREE.MeshBasicMaterial({color:0x6d3449,transparent:true,opacity:.72}));thorn.rotation.x=.3;g.add(thorn);
    return g;
  }
  function addThemeSignature(theme){
    if(theme!=='royal'&&theme!=='scary')return;
    const accents=world.userData.accents||group('theme-signature');
    const sig=theme==='royal'?makeRoyalCrown():makeScaryEye();
    sig.name=theme==='royal'?'Royal Crown':'Watching Eye';
    sig.position.set(3.15,1.25,-1.25);sig.rotation.set(.18,-.4,.08);sig.userData.spin=theme==='royal'?.13:-.10;
    rotating.push(sig);accents.add(sig);world.userData.themeSignature=sig;
  }
  function makePedestal(cute){
    const g=group('pedestal');
    const base=new THREE.Mesh(new THREE.CylinderGeometry(1.75,2.12,.22,48),new THREE.MeshPhysicalMaterial({color:cute?0xeeb6d6:0x172738,transparent:cute,opacity:cute?.45:1,metalness:cute?.05:.7,roughness:.22,clearcoat:.8}));
    base.position.y=-2.35;g.add(base);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.8,.03,8,96),new THREE.MeshBasicMaterial({color:cute?0xf6a8cf:0x54dcff,transparent:true,opacity:.48}));
    ring.rotation.x=Math.PI/2;ring.position.y=-2.2;ring.userData.spin=.08;rotating.push(ring);g.add(ring);
    const halo=new THREE.Mesh(new THREE.TorusGeometry(2.12,.012,8,96),new THREE.MeshBasicMaterial({color:cute?0xdba2e9:0x2f83a5,transparent:true,opacity:.22}));
    halo.rotation.x=Math.PI/2;halo.position.y=-2.24;halo.userData.spin=-.045;rotating.push(halo);g.add(halo);
    world.userData.base=ring; world.userData.baseHalo=halo;
  }

  function buildCool(){
    scene.fog=new THREE.FogExp2(0x061019,.058); nameEl.textContent='Signal Core'; kickerEl.textContent='COOL MODE'; titleEl.textContent='Orbital signal chamber'; descriptionEl.textContent='One scene, several layers, all yours to retune.';
    const ambient=new THREE.HemisphereLight(0x334b68,0x060a10,1.5), key=new THREE.PointLight(0x66e8ff,26,20,1.7), rim=new THREE.PointLight(0x746dff,22,18,1.8), under=new THREE.PointLight(0x2affbf,8,14,2); key.position.set(3,3.4,4.5);rim.position.set(-4,-1.5,2.5);under.position.set(0,-4,2);world.add(ambient,key,rim,under);activeLights={ambient,key,rim,under};
    const core=new THREE.Mesh(new THREE.IcosahedronGeometry(1.28,2),new THREE.MeshPhysicalMaterial({color:palettes.cool[0],emissive:emissives.cool[0],emissiveIntensity:1.6,metalness:.38,roughness:.18,clearcoat:1}));core.name='hero';world.add(core);world.userData.hero=core;
    const inner=new THREE.Mesh(new THREE.IcosahedronGeometry(.76,1),new THREE.MeshBasicMaterial({color:0x8ef5ff,transparent:true,opacity:.27,wireframe:true}));core.add(inner);world.userData.inner=inner;
    const rings=group('outer-rings'); [[2.0,.018,0x62e9ff,.14],[2.42,.022,0x7181ff,-.18],[2.86,.018,0x50ffcb,.11],[3.28,.012,0x4d7eff,-.06]].forEach((v,i)=>{const r=new THREE.Mesh(new THREE.TorusGeometry(v[0],v[1],10,120),new THREE.MeshBasicMaterial({color:v[2],transparent:true,opacity:.43}));r.rotation.set([1.18,.25,1.6,.76][i],[.15,.76,.5,.2][i],[.12,1.22,.7,1.5][i]);r.userData.spin=v[3];rotating.push(r);rings.add(r);});world.userData.outer=rings;
    const moons=group('moons'); for(let i=0;i<(smallScreen?7:13);i++){const n=new THREE.Mesh(i%3?new THREE.OctahedronGeometry(.075,0):new THREE.TetrahedronGeometry(.12),new THREE.MeshBasicMaterial({color:i%2?0x75f5ff:0x7788ff}));const a=i/(smallScreen?7:13)*Math.PI*2,r=2.6+(i%4)*.34;n.position.set(Math.cos(a)*r,Math.sin(a)*r*.52,Math.sin(a*1.5)*.9);moons.add(n);}moons.userData.spin=-.085;rotating.push(moons);world.userData.moons=moons;
    const accents=group('accents'); for(let i=0;i<(smallScreen?5:10);i++){const m=new THREE.Mesh(new THREE.BoxGeometry(.16+Math.random()*.16,.55+Math.random()*.7,.12+Math.random()*.16),new THREE.MeshPhysicalMaterial({color:i%2?0x1e3a4e:0x272d4f,metalness:.75,roughness:.3}));const a=i/(smallScreen?5:10)*Math.PI*2+.4,r=4+(i%3)*.5;m.position.set(Math.cos(a)*r,Math.sin(a)*r*.58,-1.4-Math.random()*2.4);m.rotation.set(a,.5*a,a*.2);accents.add(m);}accents.userData.spin=.018;rotating.push(accents);world.userData.accents=accents;
    const background=group('background');[-3.7,0,3.9].forEach((x,i)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(.42,1.7+i*.2,.38),new THREE.MeshPhysicalMaterial({color:0x111c2b,metalness:.55,roughness:.26,emissive:0x07111f,emissiveIntensity:.35}));m.position.set(x,-1.45,-4.8-i*.5);background.add(m);}); [[-3.2,1.9,-3,.34,0x2a7798],[3.5,-.8,-3.8,.48,0x30466e],[2.9,2.2,-5,.22,0x4da3a8]].forEach(v=>{const p=new THREE.Mesh(new THREE.SphereGeometry(v[3],18,12),new THREE.MeshStandardMaterial({color:v[4],roughness:.6}));p.position.set(v[0],v[1],v[2]);background.add(p);});world.userData.background=background;
    const particles=makePoints(smallScreen?110:230,7.4,0x7fdfff,smallScreen?.035:.026);world.add(particles);particles.userData.spin=.009;rotating.push(particles);world.userData.particles=particles; 
    const foreground=group('foreground-depth');[[-4.4,1.8,2.2,.22],[4.2,-1.2,2.6,.28],[-3.8,-2.0,1.7,.18]].forEach((v,i)=>{const m=new THREE.Mesh(new THREE.TetrahedronGeometry(v[3],0),new THREE.MeshPhysicalMaterial({color:i%2?0x2d5c79:0x354064,metalness:.65,roughness:.3,transparent:true,opacity:.72}));m.position.set(v[0],v[1],v[2]);m.rotation.set(.4+i,.7*i,.2);foreground.add(m);});background.add(foreground);
    makePedestal(false);
  }

  function buildCute(){
    scene.fog=new THREE.FogExp2(0xf0d9eb,.037); nameEl.textContent='Charm Garden'; kickerEl.textContent='CUTE MODE ♡'; titleEl.textContent='Jewelry-box universe'; descriptionEl.textContent='A giant heart, tiny moons, and exactly as many charms as you allow.';
    const ambient=new THREE.HemisphereLight(0xfff4fb,0xb787d3,2.1), key=new THREE.PointLight(0xff7db7,24,19,1.7), rim=new THREE.PointLight(0xb98cff,18,17,1.8), under=new THREE.PointLight(0xffc6a6,10,13,2); key.position.set(3.4,2.7,4.5);rim.position.set(-3.8,-1.2,3.2);under.position.set(0,-4,2);world.add(ambient,key,rim,under);activeLights={ambient,key,rim,under};
    const heart=new THREE.Mesh(heartGeometry(.82),new THREE.MeshPhysicalMaterial({color:palettes.cute[0],emissive:emissives.cute[0],emissiveIntensity:.34,metalness:.02,roughness:.18,clearcoat:1}));heart.name='hero';heart.rotation.set(-.10,.10,Math.PI);heart.position.y=.15;world.add(heart);world.userData.hero=heart;
    const inner=new THREE.Mesh(new THREE.TorusGeometry(1.5,.035,10,110),new THREE.MeshBasicMaterial({color:0xffd3e8,transparent:true,opacity:.46}));inner.rotation.set(1.1,.18,.3);inner.userData.spin=.16;rotating.push(inner);world.add(inner);world.userData.inner=inner;
    const rings=group('outer-rings'); [[1.95,.04,0xffd3e8,.11],[2.5,.025,0xb996ef,-.085],[3.08,.014,0x83d8c7,.055]].forEach((v,i)=>{const r=new THREE.Mesh(new THREE.TorusGeometry(v[0],v[1],10,120),new THREE.MeshPhysicalMaterial({color:v[2],transparent:true,opacity:.55,roughness:.25,clearcoat:.8}));r.rotation.set([1.18,.3,1.45][i],[.16,1,.3][i],[.25,.7,1][i]);r.userData.spin=v[3];rotating.push(r);rings.add(r);});world.userData.outer=rings;
    const moons=group('moons'); const cols=[0xff9fc6,0xc69cf4,0xffc891,0x83d8c7,0xb7a7ff];for(let i=0;i<(smallScreen?7:12);i++){const m=new THREE.Mesh(i%4===0?new THREE.OctahedronGeometry(.13,0):new THREE.SphereGeometry(i%2?.1:.07,14,10),new THREE.MeshPhysicalMaterial({color:cols[i%cols.length],roughness:.25,clearcoat:.8}));const a=i/(smallScreen?7:12)*Math.PI*2,r=2.3+(i%4)*.32;m.position.set(Math.cos(a)*r,Math.sin(a)*r*.48,Math.sin(a*1.3)*.8);moons.add(m);}moons.userData.spin=-.075;rotating.push(moons);world.userData.moons=moons;
    const accents=group('accents');const bow1=makeBow(0xf28fbd);bow1.position.set(-3.1,1.4,-2.2);accents.add(bow1);const bow2=makeBow(0xb894e8);bow2.scale.setScalar(.78);bow2.position.set(3.1,-.9,-3);accents.add(bow2);const ribbon=new THREE.Mesh(new THREE.TorusKnotGeometry(.7,.025,60,8,2,3),new THREE.MeshBasicMaterial({color:0xf2a5ce,transparent:true,opacity:.28}));ribbon.position.set(3.7,1.2,-4);ribbon.scale.set(1.7,.7,1.2);ribbon.userData.spin=.035;rotating.push(ribbon);accents.add(ribbon);world.userData.accents=accents;
    const background=group('background');[[-3.1,-1.55,-1.4,.68],[2.8,1.75,-1.8,.50],[2.7,-1.65,-2,.38],[-2.6,1.6,-3.2,.34]].forEach(v=>{const c=makeCloud(v[3]);c.position.set(v[0],v[1],v[2]);background.add(c);});[[-3,2,-3,.34,0xffd7a3],[3.5,-.6,-3.8,.46,0xc99de9],[2.8,2.15,-5,.22,0x8edbcf]].forEach(v=>{const p=new THREE.Mesh(new THREE.SphereGeometry(v[3],18,12),new THREE.MeshPhysicalMaterial({color:v[4],roughness:.28,clearcoat:.8}));p.position.set(v[0],v[1],v[2]);background.add(p);});world.userData.background=background;
    const particles=makePoints(smallScreen?100:210,6.8,0xe78dbc,smallScreen?.045:.034);world.add(particles);particles.userData.spin=.008;rotating.push(particles);world.userData.particles=particles; 
    const foreground=group('foreground-depth');[[-4.2,1.7,2.0,.22,0xf19ac5],[4.1,-1.4,2.4,.28,0xb89ae8],[-3.7,-2.0,1.8,.18,0x8bd8c9]].forEach((v,i)=>{const m=new THREE.Mesh(i===1?starCoreGeometry(v[3]*2.1):new THREE.OctahedronGeometry(v[3],0),new THREE.MeshPhysicalMaterial({color:v[4],roughness:.2,clearcoat:.9,transparent:true,opacity:.74}));m.position.set(v[0],v[1],v[2]);m.rotation.set(.3+i,.5*i,.2);foreground.add(m);});background.add(foreground);
    makePedestal(true);
  }

  function heroMaterial(){
    const c=palettes[currentTheme][settings.color],e=emissives[currentTheme][settings.color],cute=currentTheme==='cute';
    switch(settings.material){
      case 'matte': return new THREE.MeshStandardMaterial({color:c,emissive:e,emissiveIntensity:cute?.18:.5,roughness:.78,metalness:cute?0:.08});
      case 'glass': return new THREE.MeshPhysicalMaterial({color:c,emissive:e,emissiveIntensity:cute?.12:.28,roughness:.04,metalness:0,transparent:true,opacity:.52,transmission:.46,thickness:1.0,clearcoat:1});
      case 'wire': return new THREE.MeshBasicMaterial({color:c,wireframe:true,transparent:true,opacity:.95});
      case 'glow': return new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:cute?1.7:2.45,roughness:.25,metalness:.02});
      default: return new THREE.MeshPhysicalMaterial({color:c,emissive:e,emissiveIntensity:cute?.34:1.25,metalness:cute?.02:.42,roughness:.12,clearcoat:1});
    }
  }
  function applyHeroMaterial(){
    const hero=world.userData.hero;if(!hero)return;
    const old=hero.material;hero.material=heroMaterial();
    const glowFactor=.30+(settings.glow/100)*1.20;
    if('emissiveIntensity' in hero.material)hero.material.emissiveIntensity*=glowFactor;
    disposeMaterial(old);
  }

  function captureLightBaselines(){
    Object.values(activeLights).forEach((light)=>{ if(light && light.intensity != null && light.userData.baseIntensity == null) light.userData.baseIntensity=light.intensity; });
  }
  function applyAtmosphere(){
    const glow=settings.glow/100;
    renderer.toneMappingExposure=.84+glow*.52;
    Object.values(activeLights).forEach((light)=>{if(light?.userData?.baseIntensity!=null)light.intensity=light.userData.baseIntensity*(.72+glow*.78);});
    if(scene.fog?.isFogExp2) scene.fog.density=(currentTheme==='cute'?.037:.058)*(fogScale[settings.fog]||1);
    const particles=world.userData.particles;
    if(particles?.geometry?.attributes?.position){const max=particles.geometry.attributes.position.count,frac=densityScale[settings.particleDensity]||.55;particles.geometry.setDrawRange(0,Math.max(1,Math.round(max*frac)));}
    if(particles?.material){particles.material.opacity=.38+glow*.42;particles.material.size=(smallScreen?.032:.025)*(settings.particleDensity==='storm'?1.35:settings.particleDensity==='high'?1.15:1);particles.material.needsUpdate=true;}
    stage.dataset.sceneDensity=settings.particleDensity;stage.dataset.sceneFog=settings.fog;stage.dataset.cameraMotion=settings.cameraMotion;
  }
  function registerSelectable(root,label){
    if(!root)return;root.userData.selectableLabel=label;root.traverse?.((node)=>{if(node.isMesh){node.userData.selectableRoot=root;selectableMeshes.push(node);}});
  }
  function registerSelectables(){
    selectableMeshes=[];
    registerSelectable(world.userData.hero,shapeNames[flavorTheme||currentTheme]?.[settings.shape]||'Core');
    registerSelectable(world.userData.inner,currentTheme==='cute'?'Inner Halo':'Inner Core');
    registerSelectable(world.userData.outer,currentTheme==='cute'?'Orbit Rings':'Outer Rings');
    registerSelectable(world.userData.moons,currentTheme==='cute'?'Charm Moons':'Moon Cluster');
    registerSelectable(world.userData.accents,currentTheme==='cute'?'Floating Charms':'Signal Shards');
    registerSelectable(world.userData.base,currentTheme==='cute'?'Pedestal Ring':'Base Ring');
    registerSelectable(world.userData.background,currentTheme==='cute'?'Dream Backdrop':'Deep Structures');
  }
  function setRootScale(root,scale){if(root)root.scale.setScalar(scale);}
  function refreshSelectionScales(){
    const roots=new Set(selectableMeshes.map((m)=>m.userData.selectableRoot).filter(Boolean));
    roots.forEach((root)=>setRootScale(root,root===selectedObject?1.055:(root===hoveredObject?1.03:1)));
  }
  function setHovered(root){if(hoveredObject===root)return;hoveredObject=root||null;refreshSelectionScales();canvas.style.cursor=root?'pointer':'grab';stage.classList.toggle('has-hovered-object',Boolean(root));}
  function selectObject(root){
    selectedObject=root||null;focusActive=Boolean(root);stage.classList.toggle('has-selection',Boolean(root));
    if(selectionPanel)selectionPanel.classList.toggle('is-visible',Boolean(root));
    if(selectedLabel)selectedLabel.textContent=root?.userData?.selectableLabel||'None';
    if(root===world.userData.hero)setInspection(Boolean(root));else if(inspection)setInspection(false);
    refreshSelectionScales();pulse=1;lastInteractionAt=performance.now();
  }
  function resetView(){selectedObject=null;focusActive=false;setInspection(false);if(selectedLabel)selectedLabel.textContent='None';selectionPanel?.classList.remove('is-visible');stage.classList.remove('has-selection');refreshSelectionScales();lastInteractionAt=performance.now();}
  function isEffectivelyVisible(object){let node=object;while(node){if(node.visible===false)return false;node=node.parent;}return true;}
  function raycastSelectable(event){
    const r=canvas.getBoundingClientRect();mouse.x=((event.clientX-r.left)/r.width)*2-1;mouse.y=-((event.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(mouse,camera);
    const hit=raycaster.intersectObjects(selectableMeshes.filter(isEffectivelyVisible),false)[0];return hit?.object?.userData?.selectableRoot||null;
  }
  function applySettings(pulseIt=false){
    const c=palettes[currentTheme][settings.color], hero=world.userData.hero;
    applyHeroMaterial();
    if(world.userData.inner?.material?.color) world.userData.inner.material.color.setHex(c);
    const firstRing = world.userData.outer?.children?.[0]; if(firstRing?.material?.color) firstRing.material.color.setHex(c);
    if(activeLights.key) activeLights.key.color.setHex(c);
    applyHeroShape();
    ['inner','outer','moons','particles','accents','background','base'].forEach(k=>{ if(world.userData[k]) world.userData[k].visible=settings.visible[k]; });
    if(world.userData.baseHalo) world.userData.baseHalo.visible=settings.visible.base;
    hudSpeed.textContent=settings.orbitLocked?'LOCKED':settings.speed.toUpperCase();
    if(orbitLockButton){orbitLockButton.setAttribute('aria-pressed',String(settings.orbitLocked));orbitLockButton.textContent=settings.orbitLocked?'Orbit: Locked':'Orbit: Live';}
    colorButtons.forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.sceneColor)===settings.color)));
    toggleButtons.forEach(b=>b.setAttribute('aria-pressed',String(settings.visible[b.dataset.sceneToggle])));
    speedButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sceneSpeed===settings.speed)));
    materialButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sceneMaterial===settings.material)));
    densityButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sceneDensity===settings.particleDensity)));
    fogButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sceneFog===settings.fog)));
    cameraButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sceneCamera===settings.cameraMotion)));
    if(glowInput)glowInput.value=String(settings.glow);if(glowValue)glowValue.textContent=String(Math.round(settings.glow));
    if(distanceInput)distanceInput.value=String(Math.round(settings.cameraDistance*10));if(distanceValue)distanceValue.textContent=settings.cameraDistance.toFixed(1);
    applyAtmosphere();
    if(pulseIt){pulse=1;lastInteractionAt=performance.now();}
  }
  function applySceneThemeCopy(theme){
    if(theme==='royal'){
      nameEl.textContent='Crown Core';kickerEl.textContent='ROYAL MODE ♛';titleEl.textContent='Gilded orbital chamber';descriptionEl.textContent='A crown keeps watch over the court of orbiting relics.';
    }else if(theme==='scary'){
      nameEl.textContent='Watching Core';kickerEl.textContent='SCARY MODE ☾';titleEl.textContent='The chamber is looking back';descriptionEl.textContent='Same machine. Different omen. Do not stare too long.';
    }else if(currentTheme==='cute'){
      nameEl.textContent='Charm Garden';kickerEl.textContent='CUTE MODE ♡';titleEl.textContent='Jewelry-box universe';descriptionEl.textContent='A giant heart, tiny moons, and exactly as many charms as you allow.';
    }else{
      nameEl.textContent='Signal Core';kickerEl.textContent='COOL MODE';titleEl.textContent='Orbital signal chamber';descriptionEl.textContent='One scene, several layers, all yours to retune.';
    }
  }
  function buildScene(theme){ flavorTheme=['cute','royal','scary'].includes(theme)?theme:'cool';currentTheme=flavorTheme==='cute'?'cute':'cool';clearWorld();selectedObject=null;hoveredObject=null;focusActive=false;world.rotation.set(worldRotation.x,worldRotation.y,0);world.scale.setScalar(1);currentTheme==='cute'?buildCute():buildCool();addThemeSignature(flavorTheme);captureLightBaselines();registerSelectables();applySettings(false);applySceneThemeCopy(flavorTheme);if(selectedLabel)selectedLabel.textContent='None';selectionPanel?.classList.remove('is-visible');stage.classList.remove('has-selection'); }
  function resetSettings(){settings.color=0;settings.material='gloss';settings.speed='normal';settings.particleDensity='medium';settings.glow=58;settings.fog='atmospheric';settings.cameraMotion='drift';settings.cameraDistance=8.8;settings.orbitLocked=false;settings.shape=0;Object.keys(settings.visible).forEach(k=>settings.visible[k]=true);resetView();applySettings(true);}

  colorButtons.forEach(b=>b.addEventListener('click',()=>{settings.color=Number(b.dataset.sceneColor)||0;applySettings(true);}));
  toggleButtons.forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.sceneToggle;settings.visible[k]=!settings.visible[k];applySettings(true);}));
  speedButtons.forEach(b=>b.addEventListener('click',()=>{settings.speed=b.dataset.sceneSpeed;applySettings(true);}));
  materialButtons.forEach(b=>b.addEventListener('click',()=>{settings.material=b.dataset.sceneMaterial||'gloss';applySettings(true);}));
  orbitLockButton?.addEventListener('click',()=>{settings.orbitLocked=!settings.orbitLocked;applySettings(true);});
  shapeCycleButton?.addEventListener('click',()=>{settings.shape=(settings.shape+1)%5;applySettings(true);if(selectedObject===world.userData.hero&&selectedLabel)selectedLabel.textContent=shapeNames[flavorTheme||currentTheme]?.[settings.shape]||'Core';});
  densityButtons.forEach(b=>b.addEventListener('click',()=>{settings.particleDensity=b.dataset.sceneDensity;applySettings(true);}));
  fogButtons.forEach(b=>b.addEventListener('click',()=>{settings.fog=b.dataset.sceneFog;applySettings(true);}));
  cameraButtons.forEach(b=>b.addEventListener('click',()=>{settings.cameraMotion=b.dataset.sceneCamera;applySettings(true);}));
  glowInput?.addEventListener('input',()=>{settings.glow=Number(glowInput.value);applySettings(false);});
  distanceInput?.addEventListener('input',()=>{settings.cameraDistance=Number(distanceInput.value)/10;if(distanceValue)distanceValue.textContent=settings.cameraDistance.toFixed(1);lastInteractionAt=performance.now();});
  resetViewButton?.addEventListener('click',(e)=>{e.stopPropagation();resetView();});
  resetButton?.addEventListener('click',resetSettings);

  function sizeRenderer(){const r=stage.getBoundingClientRect();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);camera.aspect=Math.max(1,r.width)/Math.max(1,r.height);camera.updateProjectionMatrix();}
  function setInspection(next){inspection=Boolean(next);stage.classList.toggle('is-inspecting',inspection);inspectionPanel?.setAttribute('aria-hidden',String(!inspection));hudLock.textContent=inspection?'INSPECT':'LOCKED';lastInteractionAt=performance.now();}

  stage.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button'))return;drag.active=true;drag.id=e.pointerId;drag.x=drag.startX=e.clientX;drag.y=drag.startY=e.clientY;drag.moved=false;stage.setPointerCapture?.(e.pointerId);stage.classList.add('is-grabbing');lastInteractionAt=performance.now();});
  stage.addEventListener('pointermove',e=>{const r=stage.getBoundingClientRect();pointer.tx=((e.clientX-r.left)/r.width-.5)*2;pointer.ty=((e.clientY-r.top)/r.height-.5)*2;if(!drag.active){setHovered(raycastSelectable(e));return;}if(e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5)drag.moved=true;worldRotation.y+=dx*.006;worldRotation.x=THREE.MathUtils.clamp(worldRotation.x+dy*.004,-.8,.8);worldRotation.vy=dx*.0007;worldRotation.vx=dy*.00045;lastInteractionAt=performance.now();},{passive:true});
  stage.addEventListener('pointerleave',()=>{if(!drag.active)setHovered(null);});
  function endDrag(e){if(!drag.active||e.pointerId!==drag.id)return;const moved=drag.moved;drag.active=false;stage.classList.remove('is-grabbing');if(stage.hasPointerCapture?.(e.pointerId))stage.releasePointerCapture(e.pointerId);if(!moved){const hit=raycastSelectable(e);if(hit)selectObject(hit);else if(selectedObject||inspection)resetView();else{pulse=1;lastInteractionAt=performance.now();}}}
  stage.addEventListener('pointerup',endDrag);stage.addEventListener('pointercancel',endDrag);inspectionClose?.addEventListener('click',e=>{e.stopPropagation();setInspection(false);});document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(inspection)setInspection(false);else if(selectedObject)resetView();}});
  window.addEventListener('worldthemechange',e=>{const raw=e.detail?.theme||'cool',base=raw==='cute'?'cute':'cool';if(base!==currentTheme||raw!==flavorTheme){buildScene(raw);setInspection(false);}else applySceneThemeCopy(raw);});
  document.addEventListener('visibilitychange',()=>documentVisible=!document.hidden);
  new IntersectionObserver(entries=>{stageVisible=entries[0]?.isIntersecting??true;},{rootMargin:'160px'}).observe(stage);
  const ro=new ResizeObserver(sizeRenderer);ro.observe(stage);sizeRenderer();
  function finishLoading(){if(ready)return;ready=true;stage.classList.add('is-ready');if(loading){loading.classList.add('is-done');setTimeout(()=>loading.hidden=true,reduceMotion?0:450);}}
  try{buildScene(flavorTheme);}catch(err){console.error('3D scene failed',err);failScene();return;}

  function animate(time){
    requestAnimationFrame(animate);if(!documentVisible||!stageVisible)return;
    const now=time*.001,dt=Math.min(.05,now-elapsed||.016);elapsed=now;pointer.x+=(pointer.tx-pointer.x)*Math.min(1,dt*4.8);pointer.y+=(pointer.ty-pointer.y)*Math.min(1,dt*4.8);
    const idle=performance.now()-lastInteractionAt>900,energy=.95,sp=(speedScale[settings.speed]||1);
    if(!drag.active&&!reduceMotion&&!settings.orbitLocked){const drift=idle?Math.sin(now*.27)*.0035:0;worldRotation.y+=(currentTheme==='cute'?.078:.064)*sp*dt+drift*dt;worldRotation.y+=worldRotation.vy;worldRotation.x+=worldRotation.vx;worldRotation.vx*=.94;worldRotation.vy*=.94;} else if(settings.orbitLocked){worldRotation.vx*=.82;worldRotation.vy*=.82;}
    world.rotation.x+=(worldRotation.x-world.rotation.x)*Math.min(1,dt*7);world.rotation.y+=(worldRotation.y-world.rotation.y)*Math.min(1,dt*7);
    if(!reduceMotion&&!settings.orbitLocked)rotating.forEach((o,i)=>{if(!o.visible)return;const s=(o.userData.spin||.05)*sp*energy;o.rotation.z+=s*dt;if(i%2)o.rotation.y+=s*(.16+.18*energy)*dt;});
    pulse*=Math.pow(.055,dt);const sc=(inspection?1.10:1)+pulse*.11;world.scale.lerp(new THREE.Vector3(sc,sc,sc),Math.min(1,dt*10));
    const hero=world.userData.hero;if(hero&&!reduceMotion){if(!settings.orbitLocked){hero.rotation.y+=(currentTheme==='cute'?.16:.24)*dt*sp;hero.rotation.x+=.08*dt;}const ty=.12+Math.sin(now*1.18)*.07;hero.position.y+=(ty-hero.position.y)*Math.min(1,dt*2.2);}
    const cameraMode=reduceMotion?'still':settings.cameraMotion;let baseZ=inspection?Math.max(5.2,settings.cameraDistance*.68):settings.cameraDistance,breathe=0,targetX=pointer.x*(inspection?.2:.48),targetY=-pointer.y*(inspection?.14:.31)+.15;
    if(!focusActive&&cameraMode==='drift'){breathe=Math.sin(now*.55)*(.10+.10*energy);targetX+=Math.sin(now*.19)*(.05+.10*energy);targetY+=Math.cos(now*.23)*(.04+.07*energy);}
    if(!focusActive&&cameraMode==='auto'){breathe=Math.sin(now*.38)*(.18+.16*energy);targetX+=Math.sin(now*.24)*(.45+.42*energy);targetY+=Math.cos(now*.17)*(.20+.22*energy);if(!drag.active&&!settings.orbitLocked)worldRotation.y+=dt*(.035+.035*energy);}
    if(focusActive&&selectedObject){selectedObject.getWorldPosition(focusPoint);lookTarget.lerp(focusPoint,Math.min(1,dt*4.5));targetX=focusPoint.x*.62;targetY=focusPoint.y*.62+.12;baseZ=Math.max(4.9,focusPoint.z+settings.cameraDistance*.60);}else{lookTarget.lerp(new THREE.Vector3(0,0,0),Math.min(1,dt*4));}
    camera.position.x+=(targetX-camera.position.x)*Math.min(1,dt*2.4);camera.position.y+=(targetY-camera.position.y)*Math.min(1,dt*2.4);camera.position.z+=(baseZ+breathe-camera.position.z)*Math.min(1,dt*2.1);camera.lookAt(lookTarget);
    if(hudCoords)hudCoords.textContent=`${world.rotation.x>=0?'+':''}${world.rotation.x.toFixed(2)} / ${world.rotation.y>=0?'+':''}${world.rotation.y.toFixed(2)}`;
    renderer.render(scene,camera);finishLoading();
  }
  requestAnimationFrame(animate);
})();