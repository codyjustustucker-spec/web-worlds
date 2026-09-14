(() => {
  const desktopQuery = window.matchMedia('(min-width: 900px)');

  const level = document.querySelector('[data-playground-level]');
  const player = document.querySelector('[data-game-player]');
  const block = document.querySelector('[data-game-block]');
  const gate = document.querySelector('[data-game-gate]');
  const finish = document.querySelector('[data-finish-zone]');
  const secretCount = document.querySelector('[data-secret-count]');
  const gameStatus = document.querySelector('[data-game-status]');
  const completionCard = document.querySelector('[data-completion-card]');
  const completionSecrets = document.querySelector('[data-completion-secrets]');
  const codeInput = document.querySelector('[data-theme-code]');
  const codeSubmit = document.querySelector('[data-code-submit]');
  const codeFeedback = document.querySelector('[data-code-feedback]');
  const cluePanel = document.querySelector('.theme-clue-panel');
  const resetButtons = [...document.querySelectorAll('[data-playground-reset]')];
  const secretButtons = [...document.querySelectorAll('[data-secret-id]')];
  const collectibleTutorial = document.querySelector('[data-collectible-tutorial]');

  if (!level || !player || !block || !gate || !finish) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const entities = [player, block];
  const entityState = new Map();
  let wallRects = [];
  let gateRect = null;
  let activeDrag = null;
  let autoScrollFrame = 0;
  let latestPointer = null;

  const state = {
    collected: new Set(),
    tutorialDone: false,
    gateOpen: false,
    complete: false
  };

  const rectsOverlap = (a, b) => (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );

  function levelSize() {
    return { w: level.clientWidth, h: level.clientHeight };
  }

  function elementRectRelative(el) {
    return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
  }

  function refreshStaticGeometry() {
    wallRects = [...level.querySelectorAll('.pg-wall')].map(elementRectRelative);
    gateRect = elementRectRelative(gate);
  }

  function stateFor(el) {
    return entityState.get(el);
  }

  function setEntityPosition(el, x, y) {
    const s = stateFor(el);
    if (!s) return;
    s.x = x;
    s.y = y;
    el.style.setProperty('--px', `${x}px`);
    el.style.setProperty('--py', `${y}px`);
    if (el === player) {
      checkFinish();
    }
  }

  function obstacleRectsFor(el) {
    const obstacles = [...wallRects];
    if (!state.gateOpen && gateRect) obstacles.push(gateRect);

    entities.forEach((other) => {
      if (other === el) return;
      const s = stateFor(other);
      if (!s) return;
      obstacles.push({ x: s.x, y: s.y, w: s.w, h: s.h });
    });

    return obstacles;
  }

  function collides(el, x, y) {
    const s = stateFor(el);
    const candidate = { x, y, w: s.w, h: s.h };
    return obstacleRectsFor(el).some((obstacle) => rectsOverlap(candidate, obstacle));
  }

  function clampTarget(el, x, y) {
    const s = stateFor(el);
    const size = levelSize();
    return {
      x: Math.max(0, Math.min(size.w - s.w, x)),
      y: Math.max(0, Math.min(size.h - s.h, y))
    };
  }

  // Sub-stepped axis resolution prevents fast pointer movement from tunnelling through thin walls.
  function moveEntity(el, targetX, targetY) {
    const s = stateFor(el);
    const target = clampTarget(el, targetX, targetY);
    const dx = target.x - s.x;
    const dy = target.y - s.y;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 7));
    const stepX = dx / steps;
    const stepY = dy / steps;

    let x = s.x;
    let y = s.y;

    for (let i = 0; i < steps; i += 1) {
      const nextX = x + stepX;
      if (!collides(el, nextX, y)) x = nextX;

      const nextY = y + stepY;
      if (!collides(el, x, nextY)) y = nextY;
    }

    setEntityPosition(el, x, y);
  }

  function initializeEntity(el) {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const size = levelSize();
    const startX = Number(el.dataset.startX || 0) / 100;
    const startY = Number(el.dataset.startY || 0) / 100;
    let x = Math.max(0, (size.w - w) * startX);
    let y = Math.max(0, (size.h - h) * startY);
    // A named anchor keeps the MOVE block centered over its hidden bubble even as the level resizes.
    if (el.dataset.startAnchor) {
      const anchor = level.querySelector(el.dataset.startAnchor);
      if (anchor) {
        x = Math.max(0, Math.min(size.w - w, anchor.offsetLeft + anchor.offsetWidth / 2 - w / 2));
        // Sit a few pixels above dead-center so the block seals the opening without spawning inside the lower wall.
        y = Math.max(0, Math.min(size.h - h, anchor.offsetTop + anchor.offsetHeight / 2 - h / 2 + 3));
      }
    }
    entityState.set(el, { x, y, w, h });
    const s = stateFor(el);
    setEntityPosition(el, s.x, s.y);
  }

  function checkFinish() {
    if (state.complete) return;
    const ps = stateFor(player);
    if (!ps) return;
    const finishRect = elementRectRelative(finish);
    const playerRect = { x: ps.x, y: ps.y, w: ps.w, h: ps.h };
    if (!rectsOverlap(playerRect, finishRect)) return;

    state.complete = true;
    level.classList.add('is-complete');
    completionSecrets.textContent = `${state.collected.size} / ${secretButtons.length}`;
    completionCard.classList.add('is-visible');
    gameStatus.textContent = 'Chapter complete.';
    player.classList.remove('is-dragging');

    if (!reduceMotion) {
      level.animate(
        [
          { boxShadow: 'var(--shadow)' },
          { boxShadow: '0 0 0 2px var(--accent), 0 0 70px var(--glow)' },
          { boxShadow: 'var(--shadow)' }
        ],
        { duration: 900, easing: 'cubic-bezier(.2,.8,.2,1)' }
      );
    }
  }

  function updateSecretCounter() {
    secretCount.textContent = `${state.collected.size} / ${secretButtons.length}`;
  }

  secretButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.secretId;
      if (!id || state.collected.has(id)) return;
      state.collected.add(id);
      if (id === 'tutorial') {
        state.tutorialDone = true;
        level.classList.add('tutorial-complete');
      }
      button.classList.add('is-collected');
      button.disabled = true;
      updateSecretCounter();
      gameStatus.textContent = `Secret found. ${state.collected.size} of ${secretButtons.length}.`;
    });
  });

  function openGate() {
    if (state.gateOpen) return;
    state.gateOpen = true;
    gate.classList.add('is-open');
    gate.setAttribute('aria-hidden', 'true');
    cluePanel?.classList.add('is-solved');
    codeFeedback.textContent = ({cute:'PATH OPEN ♡',royal:'PASSAGE GRANTED',scary:'SEAL BROKEN'}[document.documentElement.dataset.theme] || 'ROUTE CLEAR');
    gameStatus.textContent = 'Theme lock solved.';
  }

  function tryCode() {
    const value = (codeInput?.value || '').replace(/\D/g, '');
    if (value === '4729') {
      openGate();
    } else {
      codeFeedback.textContent = value.length < 4 ? 'Four digits. Inspect every world.' : 'Not quite. Read them Cool → Cute → Royal → Scary.';
      codeInput?.focus();
    }
  }

  codeSubmit?.addEventListener('click', tryCode);
  codeInput?.addEventListener('input', () => {
    codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 4);
  });
  codeInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') tryCode();
  });

  function stopAutoScroll() {
    if (autoScrollFrame) cancelAnimationFrame(autoScrollFrame);
    autoScrollFrame = 0;
  }

  function autoScrollTick() {
    autoScrollFrame = 0;
    if (!activeDrag || !latestPointer) return;

    const edge = 92;
    const maxSpeed = 14;
    let speed = 0;
    if (latestPointer.clientY < edge) {
      speed = -maxSpeed * (1 - latestPointer.clientY / edge);
    } else if (latestPointer.clientY > window.innerHeight - edge) {
      speed = maxSpeed * (1 - (window.innerHeight - latestPointer.clientY) / edge);
    }

    if (Math.abs(speed) > .3) {
      window.scrollBy(0, speed);
      dragToPointer(latestPointer);
    }

    autoScrollFrame = requestAnimationFrame(autoScrollTick);
  }

  function dragToPointer(eventLike) {
    if (!activeDrag) return;
    const { el, offsetX, offsetY } = activeDrag;
    const levelRect = level.getBoundingClientRect();
    const x = eventLike.clientX - levelRect.left - offsetX;
    const y = eventLike.clientY - levelRect.top - offsetY;
    moveEntity(el, x, y);
  }

  function beginDrag(el, event) {
    if (state.complete || event.button !== 0) return;
    const elRect = el.getBoundingClientRect();
    activeDrag = {
      el,
      pointerId: event.pointerId,
      offsetX: event.clientX - elRect.left,
      offsetY: event.clientY - elRect.top
    };
    latestPointer = { clientX: event.clientX, clientY: event.clientY };
    el.setPointerCapture(event.pointerId);
    el.classList.add('is-dragging');
    gameStatus.textContent = el === player ? 'Player grabbed.' : 'Block grabbed.';
    stopAutoScroll();
    autoScrollFrame = requestAnimationFrame(autoScrollTick);
    event.preventDefault();
  }

  function continueDrag(event) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
    latestPointer = { clientX: event.clientX, clientY: event.clientY };
    dragToPointer(latestPointer);
    event.preventDefault();
  }

  function endDrag(event) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
    const el = activeDrag.el;
    if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
    el.classList.remove('is-dragging');
    activeDrag = null;
    latestPointer = null;
    stopAutoScroll();
    if (!state.complete) gameStatus.textContent = 'Keep going.';
  }

  entities.forEach((el) => {
    el.addEventListener('pointerdown', (event) => beginDrag(el, event));
    el.addEventListener('pointermove', continueDrag);
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
  });

  function resetGame(shouldScroll = true) {
    stopAutoScroll();
    activeDrag?.el.classList.remove('is-dragging');
    activeDrag = null;
    latestPointer = null;
    state.collected.clear();
    state.tutorialDone = false;
    state.gateOpen = false;
    state.complete = false;
    gate.classList.remove('is-open');
    gate.removeAttribute('aria-hidden');
    cluePanel?.classList.remove('is-solved');
    codeInput.value = '';
    codeFeedback.textContent = 'Four worlds. Four digits.';
    completionCard.classList.remove('is-visible');
    level.classList.remove('is-complete', 'tutorial-complete');
    secretButtons.forEach((button) => {
      button.classList.remove('is-collected');
      button.disabled = false;
    });
    updateSecretCounter();
    refreshStaticGeometry();
    entities.forEach((el) => initializeEntity(el));
    gameStatus.textContent = 'Drag the core to begin.';
    document.dispatchEvent(new CustomEvent('playground:full-reset'));
    if (shouldScroll && desktopQuery.matches) window.scrollTo({ top: level.getBoundingClientRect().top + window.scrollY - 150, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  resetButtons.forEach((button) => button.addEventListener('click', resetGame));

  // Theme swaps are visual/state changes only. Geometry is deliberately untouched.
  window.addEventListener('worldthemechange', () => {
    if (!state.complete) gameStatus.textContent = 'Theme shifted. Position preserved.';
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      refreshStaticGeometry();
      entities.forEach((el) => {
        const s = stateFor(el);
        if (!s) return;
        s.w = el.offsetWidth;
        s.h = el.offsetHeight;
        const clamped = clampTarget(el, s.x, s.y);
        setEntityPosition(el, clamped.x, clamped.y);
      });
    }, 120);
  });

  desktopQuery.addEventListener?.('change', (event) => {
    // v0.22: crossing layout modes resets the toys instead of reloading the page.
    resetGame(false);
    document.dispatchEvent(new CustomEvent('playground:responsive-reset', { detail: { mobile: !event.matches } }));
  });

  refreshStaticGeometry();
  entities.forEach(initializeEntity);
  updateSecretCounter();
})();

/* v0.15 — required Spring Shot catch-bucket puzzle */
(() => {
  const stage=document.querySelector('[data-hoop-stage]');
  const ball=document.querySelector('[data-hoop-ball]');
  const target=document.querySelector('[data-hoop-target]');
  const bubble=document.querySelector('[data-hoop-success-bubble]');
  const burst=document.querySelector('[data-hoop-burst]');
  const reset=document.querySelector('[data-hoop-reset]');
  const handles=[...document.querySelectorAll('[data-hoop-spring]')];
  if(!stage||!ball||!target||!bubble||!handles.length)return;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  let x=0,y=0,vx=0,vy=0,last=performance.now(),visible=true,scored=false,completed=false,drag=null,settleTime=0;
  function render(){ball.style.transform=`translate3d(${x-ball.offsetWidth/2}px,${y-ball.offsetHeight/2}px,0)`;}
  function bucketGeometry(){
    const shell=target.querySelector('.bucket-shell')||target,sr=stage.getBoundingClientRect(),tr=shell.getBoundingClientRect();
    const x=tr.left-sr.left,y=tr.top-sr.top,w=tr.width,h=tr.height,t=5,b=7;
    return{left:{x,y,w:t,h},right:{x:x+w-t,y,w:t,h},bottom:{x,y:y+h-b,w,h:b},inside:{left:x+t,right:x+w-t,top:y,bottom:y+h-b}};
  }
  function resolveCircleRect(rect,r,restitution=.28){
    const cx=clamp(x,rect.x,rect.x+rect.w),cy=clamp(y,rect.y,rect.y+rect.h),dx=x-cx,dy=y-cy,d2=dx*dx+dy*dy;
    if(d2>=r*r)return;
    let dist=Math.sqrt(d2),nx=0,ny=0;
    if(dist>.001){nx=dx/dist;ny=dy/dist;}else{
      const dl=Math.abs(x-rect.x),dr=Math.abs(rect.x+rect.w-x),dt=Math.abs(y-rect.y),db=Math.abs(rect.y+rect.h-y),m=Math.min(dl,dr,dt,db);
      if(m===dl)nx=-1;else if(m===dr)nx=1;else if(m===dt)ny=-1;else ny=1;dist=0;
    }
    const push=r-dist;x+=nx*push;y+=ny*push;
    const vn=vx*nx+vy*ny;if(vn<0){vx-=(1+restitution)*vn*nx;vy-=(1+restitution)*vn*ny;}
  }
  function resetBall(){
    const r=stage.getBoundingClientRect();x=r.width*.27;y=r.height*.58;vx=0;vy=0;scored=false;completed=false;settleTime=0;
    stage.classList.remove('is-scored','is-complete');burst?.classList.remove('is-visible');
    bubble.hidden=true;bubble.classList.remove('is-collected','is-visible');bubble.setAttribute('aria-hidden','true');bubble.disabled=false;
    handles.forEach(h=>{h.style.transform='';h.closest('.hoop-spring')?.style.setProperty('--pull','0px');});render();
  }
  function score(){
    if(scored)return;scored=true;stage.classList.add('is-scored');
    if(burst){burst.classList.remove('is-visible');void burst.offsetWidth;burst.classList.add('is-visible');}
    bubble.hidden=false;bubble.removeAttribute('aria-hidden');requestAnimationFrame(()=>bubble.classList.add('is-visible'));vx=0;vy=0;
  }
  function complete(){
    if(completed||!scored)return;completed=true;bubble.classList.add('is-collected');bubble.disabled=true;stage.classList.add('is-complete');
    document.dispatchEvent(new CustomEvent('playground:hoop-complete'));
  }
  function resolveBucket(dt){
    const g=bucketGeometry(),r=ball.offsetWidth/2||18;
    resolveCircleRect(g.left,r,.24);resolveCircleRect(g.right,r,.24);resolveCircleRect(g.bottom,r,.12);
    const inside=x>g.inside.left+r*.25&&x<g.inside.right-r*.25&&y>g.inside.top+r*.15&&y+r>=g.inside.bottom-5;
    if(!scored&&inside&&Math.abs(vx)<58&&Math.abs(vy)<52){settleTime+=dt;if(settleTime>.30)score();}else if(!scored)settleTime=Math.max(0,settleTime-dt*1.8);
  }
  function step(t){
    requestAnimationFrame(step);if(!visible){last=t;return;}const dt=Math.min(.035,(t-last)/1000||.016);last=t;
    if(!scored){vy+=185*dt;vx*=Math.exp(-.24*dt);vy*=Math.exp(-.08*dt);x+=vx*dt;y+=vy*dt;const w=stage.clientWidth,h=stage.clientHeight,r=ball.offsetWidth/2||18;if(x<r){x=r;vx=Math.abs(vx)*.72}if(x>w-r){x=w-r;vx=-Math.abs(vx)*.72}if(y<r){y=r;vy=Math.abs(vy)*.72}if(y>h-r){y=h-r;vy=-Math.abs(vy)*.66}resolveBucket(dt);}render();
  }
  function begin(handle,e){const axis=handle.dataset.hoopSpring;drag={axis,id:e.pointerId,startX:e.clientX,startY:e.clientY,pull:0,handle};handle.setPointerCapture?.(e.pointerId);handle.classList.add('is-pulling');}
  function move(e){if(!drag||e.pointerId!==drag.id)return;drag.pull=drag.axis==='x'?clamp(e.clientX-drag.startX,-78,78):clamp(e.clientY-drag.startY,-78,78);drag.handle.style.transform=drag.axis==='x'?`translateX(${drag.pull}px)`:`translateY(${drag.pull}px)`;drag.handle.closest('.hoop-spring')?.style.setProperty('--pull',`${drag.pull}px`);}
  function end(e){if(!drag||e.pointerId!==drag.id)return;const force=-drag.pull*5.4;if(drag.axis==='x')vx=clamp(vx+force,-720,720);else vy=clamp(vy+force,-720,720);drag.handle.classList.remove('is-pulling');drag.handle.style.transform='';drag.handle.closest('.hoop-spring')?.style.setProperty('--pull','0px');drag=null;}
  handles.forEach(h=>{h.addEventListener('pointerdown',e=>begin(h,e));h.addEventListener('pointermove',move);h.addEventListener('pointerup',end);h.addEventListener('pointercancel',end);});
  bubble.addEventListener('click',complete);reset?.addEventListener('click',resetBall);document.addEventListener('playground:full-reset',resetBall);
  new IntersectionObserver(e=>visible=e[0]?.isIntersecting??true,{rootMargin:'120px'}).observe(stage);new ResizeObserver(resetBall).observe(stage);requestAnimationFrame(()=>{resetBall();requestAnimationFrame(step);});
})();

/* v0.22 — dedicated scored Playground Brick Breaker */
(() => {
  const card=document.querySelector('[data-pg-breaker]');
  if(!card)return;
  const stage=card.querySelector('[data-pg-breaker-stage]'),paddle=card.querySelector('[data-pg-breaker-paddle]'),ball=card.querySelector('[data-pg-breaker-ball]'),host=card.querySelector('[data-pg-breaker-bricks]'),scoreOut=card.querySelector('[data-pg-breaker-score]'),status=card.querySelector('[data-pg-breaker-status]'),win=card.querySelector('[data-pg-breaker-win]'),reset=card.querySelector('[data-pg-breaker-reset]');
  if(!stage||!paddle||!ball||!host)return;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  let px=0,bx=0,by=0,bvx=190,bvy=-235,last=performance.now(),visible=true,complete=false,score=0,bricks=[],drag=false,pid=null;
  const rows=4,cols=8,gap=7;
  const paddleTop=()=>stage.clientHeight-20-paddle.offsetHeight;
  const renderPaddle=()=>paddle.style.transform=`translate3d(${px}px,0,0)`;
  const renderBall=()=>ball.style.transform=`translate3d(${bx}px,${by}px,0)`;
  function layoutBricks(rebuild=false){
    if(rebuild){host.textContent='';bricks=[];for(let i=0;i<rows*cols;i++){const el=document.createElement('i');el.className='pg-breaker-brick';host.appendChild(el);bricks.push(el);}}
    const pad=Math.max(14,stage.clientWidth*.025),usable=stage.clientWidth-pad*2,bw=(usable-gap*(cols-1))/cols,bh=24;
    bricks.forEach((el,i)=>{el.style.left=`${pad+(i%cols)*(bw+gap)}px`;el.style.top=`${16+Math.floor(i/cols)*(bh+gap)}px`;el.style.width=`${bw}px`;el.style.height=`${bh}px`;});
  }
  function resetBall(){bx=stage.clientWidth/2-ball.offsetWidth/2;by=paddleTop()-ball.offsetHeight-12;bvx=(Math.random()>.5?1:-1)*190;bvy=-235;renderBall();}
  function resetGame(){score=0;complete=false;px=Math.max(0,(stage.clientWidth-paddle.offsetWidth)/2);if(scoreOut)scoreOut.textContent='0';if(status)status.textContent='PLAY';if(win)win.hidden=true;renderPaddle();layoutBricks(true);resetBall();last=performance.now();}
  function movePaddle(clientX){const r=stage.getBoundingClientRect();px=clamp(clientX-r.left-paddle.offsetWidth/2,0,stage.clientWidth-paddle.offsetWidth);renderPaddle();}
  stage.addEventListener('pointerdown',e=>{if(e.target.closest('.pg-breaker-win'))return;drag=true;pid=e.pointerId;stage.setPointerCapture?.(pid);movePaddle(e.clientX);stage.focus({preventScroll:true});});
  stage.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==pid)return;movePaddle(e.clientX);});
  const stop=e=>{if(!drag||e.pointerId!==pid)return;drag=false;};stage.addEventListener('pointerup',stop);stage.addEventListener('pointercancel',()=>{drag=false;});
  stage.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','a','A','d','D'].includes(e.key))return;e.preventDefault();const dir=(e.key==='ArrowLeft'||e.key.toLowerCase()==='a')?-1:1;px=clamp(px+dir*34,0,stage.clientWidth-paddle.offsetWidth);renderPaddle();});
  reset?.addEventListener('click',resetGame);document.addEventListener('playground:full-reset',resetGame);document.addEventListener('playground:responsive-reset',resetGame);
  new IntersectionObserver(e=>visible=e[0]?.isIntersecting??true,{rootMargin:'140px'}).observe(stage);
  new ResizeObserver(()=>{layoutBricks(false);px=clamp(px,0,Math.max(0,stage.clientWidth-paddle.offsetWidth));renderPaddle();resetBall();}).observe(stage);
  function loop(t){
    requestAnimationFrame(loop);const dt=Math.min(.032,(t-last)/1000||.016);last=t;if(!visible||document.hidden||complete||stage.offsetParent===null)return;
    const prevBottom=by+ball.offsetHeight;bx+=bvx*dt;by+=bvy*dt;const maxX=stage.clientWidth-ball.offsetWidth;
    if(bx<0){bx=0;bvx=Math.abs(bvx)}else if(bx>maxX){bx=maxX;bvx=-Math.abs(bvx)}if(by<0){by=0;bvy=Math.abs(bvy)}
    const pTop=paddleTop();if(bvy>0&&bx+ball.offsetWidth>px&&bx<px+paddle.offsetWidth&&prevBottom<=pTop&&by+ball.offsetHeight>=pTop){const hit=clamp((bx+ball.offsetWidth/2-(px+paddle.offsetWidth/2))/(paddle.offsetWidth/2),-1,1);bvx=hit*300;if(Math.abs(bvx)<60)bvx=60*(bvx<0?-1:1);bvy=-Math.max(220,Math.abs(bvy));by=pTop-ball.offsetHeight-1;}
    const br={l:bx,t:by,r:bx+ball.offsetWidth,b:by+ball.offsetHeight};for(const brick of bricks){if(brick.classList.contains('is-hit'))continue;const rr={l:brick.offsetLeft,t:brick.offsetTop,r:brick.offsetLeft+brick.offsetWidth,b:brick.offsetTop+brick.offsetHeight};if(br.l<rr.r&&br.r>rr.l&&br.t<rr.b&&br.b>rr.t){brick.classList.add('is-hit');score+=10;if(scoreOut)scoreOut.textContent=String(score);bvy*=-1;break;}}
    if(bricks.length&&bricks.every(el=>el.classList.contains('is-hit'))){complete=true;bvx=bvy=0;if(status)status.textContent='CLEAR';if(win)win.hidden=false;}
    if(by>stage.clientHeight+10){if(status)status.textContent='BALL RESET';resetBall();setTimeout(()=>{if(!complete&&status)status.textContent='PLAY';},500);}
    renderBall();
  }
  requestAnimationFrame(()=>{resetGame();requestAnimationFrame(loop);});
})();

/* v0.22 — curated touch-first mobile Playground */
(() => {
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;

  // 01 / mobile corridor
  const corridor=document.querySelector('[data-mobile-corridor]');
  if(corridor){
    const stage=corridor.querySelector('[data-mobile-corridor-stage]'),player=corridor.querySelector('[data-mobile-corridor-player]'),end=corridor.querySelector('[data-mobile-corridor-end]'),win=corridor.querySelector('[data-mobile-corridor-win]'),reset=corridor.querySelector('[data-mobile-corridor-reset]');
    let x=0,y=0,drag=false,pid=null,ox=0,oy=0;
    const render=()=>player.style.transform=`translate3d(${x}px,${y}px,0)`;
    const walls=()=>[...stage.querySelectorAll('.mobile-wall')].map(el=>{const sr=stage.getBoundingClientRect(),r=el.getBoundingClientRect();return{left:r.left-sr.left,top:r.top-sr.top,right:r.right-sr.left,bottom:r.bottom-sr.top};});
    const valid=(nx,ny,wallRects)=>{const w=player.offsetWidth,h=player.offsetHeight,box={left:nx,top:ny,right:nx+w,bottom:ny+h};return !wallRects.some(wall=>overlaps(box,wall));};
    const moveTo=(tx,ty)=>{tx=clamp(tx,0,stage.clientWidth-player.offsetWidth);ty=clamp(ty,0,stage.clientHeight-player.offsetHeight);const wallRects=walls(),dx=tx-x,dy=ty-y,steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/5));for(let i=0;i<steps;i++){const nx=x+dx/steps,ny=y+dy/steps;if(valid(nx,y,wallRects))x=nx;if(valid(x,ny,wallRects))y=ny;}render();const sr=stage.getBoundingClientRect(),er=end.getBoundingClientRect(),pr=player.getBoundingClientRect();const hit=overlaps({left:pr.left-sr.left,top:pr.top-sr.top,right:pr.right-sr.left,bottom:pr.bottom-sr.top},{left:er.left-sr.left,top:er.top-sr.top,right:er.right-sr.left,bottom:er.bottom-sr.top});if(hit){win.hidden=false;stage.classList.add('is-clear');}};
    const resetGame=()=>{x=2;y=10;win.hidden=true;stage.classList.remove('is-clear');render();};
    player.addEventListener('pointerdown',e=>{drag=true;pid=e.pointerId;const r=player.getBoundingClientRect();ox=e.clientX-r.left;oy=e.clientY-r.top;player.setPointerCapture?.(pid);player.classList.add('is-dragging');e.preventDefault();});
    player.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==pid)return;const r=stage.getBoundingClientRect();moveTo(e.clientX-r.left-ox,e.clientY-r.top-oy);e.preventDefault();});
    const stop=e=>{if(!drag||e.pointerId!==pid)return;drag=false;player.classList.remove('is-dragging');};player.addEventListener('pointerup',stop);player.addEventListener('pointercancel',()=>{drag=false;player.classList.remove('is-dragging');});
    reset?.addEventListener('click',resetGame);document.addEventListener('playground:responsive-reset',e=>{if(e.detail?.mobile)resetGame();});new ResizeObserver(resetGame).observe(stage);requestAnimationFrame(resetGame);
  }

  // 02 / mobile bridge: slider is deliberately simple and touch reliable.
  const bridgeCard=document.querySelector('[data-mobile-bridge]');
  if(bridgeCard){
    const input=bridgeCard.querySelector('[data-mobile-bridge-input]'),bar=bridgeCard.querySelector('[data-mobile-bridge-bar]'),angleOut=bridgeCard.querySelector('[data-mobile-bridge-angle]'),stateOut=bridgeCard.querySelector('[data-mobile-bridge-state]'),reset=bridgeCard.querySelector('[data-mobile-bridge-reset]');
    const update=()=>{const a=Number(input.value);bar.style.transform=`translate(-50%,-50%) rotate(${a}deg)`;angleOut.textContent=`${Math.round(a)}°`;const open=Math.abs(a)<7;stateOut.textContent=open?'OPEN':'BLOCKED';bridgeCard.classList.toggle('is-open',open);};
    const resetBridge=()=>{input.value='-35';update();};input.addEventListener('input',update);reset?.addEventListener('click',resetBridge);document.addEventListener('playground:responsive-reset',e=>{if(e.detail?.mobile)resetBridge();});update();
  }

  // 03 / mobile magnet field
  const magnetCard=document.querySelector('[data-mobile-magnet]');
  if(magnetCard){
    const stage=magnetCard.querySelector('[data-mobile-magnet-stage]'),puck=magnetCard.querySelector('[data-mobile-metal-puck]'),nodes=[...magnetCard.querySelectorAll('[data-mobile-magnet-id]')],groups=[...magnetCard.querySelectorAll('[data-mobile-magnet-controls]')],reset=magnetCard.querySelector('[data-mobile-magnet-reset]');
    const defaults={a:'attract'},modes={...defaults};let x=0,y=0,vx=0,vy=0,drag=false,pid=null,ox=0,oy=0,last=performance.now(),visible=true;
    function setMode(id,mode){modes[id]=mode;const node=nodes.find(n=>n.dataset.mobileMagnetId===id);if(node){node.dataset.mode=mode;node.querySelector('small').textContent=mode.toUpperCase();}const group=groups.find(g=>g.dataset.mobileMagnetControls===id);group?.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('is-active',b.dataset.mode===mode));}
    groups.forEach(group=>group.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>setMode(group.dataset.mobileMagnetControls,button.dataset.mode))));
    const render=()=>puck.style.transform=`translate3d(${x}px,${y}px,0)`;
    function resetField(){Object.entries(defaults).forEach(([id,mode])=>setMode(id,mode));x=Math.max(0,stage.clientWidth*.47-puck.offsetWidth/2);y=Math.max(0,stage.clientHeight*.45-puck.offsetHeight/2);vx=vy=0;render();last=performance.now();}
    puck.addEventListener('pointerdown',e=>{drag=true;pid=e.pointerId;const r=puck.getBoundingClientRect();ox=e.clientX-r.left;oy=e.clientY-r.top;puck.setPointerCapture?.(pid);puck.classList.add('is-dragging');vx=vy=0;e.preventDefault();});
    puck.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==pid)return;const r=stage.getBoundingClientRect();x=clamp(e.clientX-r.left-ox,0,r.width-puck.offsetWidth);y=clamp(e.clientY-r.top-oy,0,r.height-puck.offsetHeight);render();e.preventDefault();});
    const stop=e=>{if(!drag||e.pointerId!==pid)return;drag=false;puck.classList.remove('is-dragging');};puck.addEventListener('pointerup',stop);puck.addEventListener('pointercancel',()=>{drag=false;puck.classList.remove('is-dragging');});
    reset?.addEventListener('click',resetField);document.addEventListener('playground:responsive-reset',e=>{if(e.detail?.mobile)resetField();});new ResizeObserver(resetField).observe(stage);new IntersectionObserver(e=>visible=e[0]?.isIntersecting??true,{rootMargin:'100px'}).observe(stage);
    function loop(t){requestAnimationFrame(loop);const dt=Math.min(.032,(t-last)/1000||.016);last=t;if(!visible||document.hidden||drag)return;const pcx=x+puck.offsetWidth/2,pcy=y+puck.offsetHeight/2;nodes.forEach(node=>{const mode=modes[node.dataset.mobileMagnetId];if(mode==='off')return;const nr=node.getBoundingClientRect(),sr=stage.getBoundingClientRect(),mx=nr.left-sr.left+nr.width/2,my=nr.top-sr.top+nr.height/2,dx=mx-pcx,dy=my-pcy,d2=Math.max(900,dx*dx+dy*dy),d=Math.sqrt(d2),dir=mode==='repel'?-1:1,force=Math.min(480,55000/d2);vx+=dir*(dx/d)*force*dt;vy+=dir*(dy/d)*force*dt;});vx*=Math.exp(-.75*dt);vy*=Math.exp(-.75*dt);x+=vx*dt;y+=vy*dt;const maxX=stage.clientWidth-puck.offsetWidth,maxY=stage.clientHeight-puck.offsetHeight;if(x<0){x=0;vx=Math.abs(vx)*.7}if(x>maxX){x=maxX;vx=-Math.abs(vx)*.7}if(y<0){y=0;vy=Math.abs(vy)*.7}if(y>maxY){y=maxY;vy=-Math.abs(vy)*.7}render();}
    requestAnimationFrame(()=>{resetField();requestAnimationFrame(loop);});
  }

  // 04 / mobile linked-state Brick Breaker
  const breaker=document.querySelector('[data-mobile-breaker]');
  if(breaker){
    const input=breaker.querySelector('[data-mobile-breaker-input]'),value=breaker.querySelector('[data-mobile-breaker-value]'),room=breaker.querySelector('[data-mobile-breaker-room]'),paddle=breaker.querySelector('[data-mobile-breaker-paddle]'),ball=breaker.querySelector('[data-mobile-breaker-ball]'),host=breaker.querySelector('[data-mobile-breaker-bricks]'),status=breaker.querySelector('[data-mobile-breaker-status]'),scoreOut=breaker.querySelector('[data-mobile-breaker-score]'),reset=breaker.querySelector('[data-mobile-breaker-reset]');
    let px=0,bx=0,by=0,bvx=135,bvy=-175,last=performance.now(),visible=true,complete=false,score=0,bricks=[];const rows=3,cols=5,gap=5;
    function updatePaddle(){const v=Number(input.value),available=Math.max(0,room.clientWidth-paddle.offsetWidth);px=available*v/100;value.textContent=`${Math.round(v)}%`;paddle.style.transform=`translate3d(${px}px,0,0)`;}
    function layoutBricks(resetHits=false){if(resetHits){host.textContent='';bricks=[];for(let i=0;i<rows*cols;i++){const el=document.createElement('i');el.className='mobile-breaker-brick';host.appendChild(el);bricks.push(el);}}const pad=10,w=(room.clientWidth-pad*2-gap*(cols-1))/cols;bricks.forEach((el,i)=>{el.style.left=`${pad+(i%cols)*(w+gap)}px`;el.style.top=`${10+Math.floor(i/cols)*25}px`;el.style.width=`${w}px`;el.style.height='19px';});}
    const paddleTop=()=>room.clientHeight-14-paddle.offsetHeight;
    const renderBall=()=>ball.style.transform=`translate3d(${bx}px,${by}px,0)`;
    function resetBall(){bx=room.clientWidth/2-ball.offsetWidth/2;by=paddleTop()-ball.offsetHeight-10;bvx=135*(Math.random()>.5?1:-1);bvy=-175;renderBall();}
    function resetGame(){complete=false;score=0;if(scoreOut)scoreOut.textContent='0';input.value='50';status.textContent='PLAY';updatePaddle();layoutBricks(true);resetBall();last=performance.now();}
    input.addEventListener('input',updatePaddle);room.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','a','A','d','D'].includes(e.key))return;e.preventDefault();const dir=(e.key==='ArrowLeft'||e.key.toLowerCase()==='a')?-1:1;input.value=String(clamp(Number(input.value)+dir*8,0,100));updatePaddle();});reset?.addEventListener('click',resetGame);document.addEventListener('playground:responsive-reset',e=>{if(e.detail?.mobile)resetGame();});new IntersectionObserver(e=>visible=e[0]?.isIntersecting??true,{rootMargin:'100px'}).observe(room);new ResizeObserver(()=>{updatePaddle();layoutBricks(false);resetBall();}).observe(room);
    function loop(t){requestAnimationFrame(loop);const dt=Math.min(.032,(t-last)/1000||.016);last=t;if(!visible||document.hidden||complete)return;const prevBottom=by+ball.offsetHeight;bx+=bvx*dt;by+=bvy*dt;const maxX=room.clientWidth-ball.offsetWidth;if(bx<0){bx=0;bvx=Math.abs(bvx)}if(bx>maxX){bx=maxX;bvx=-Math.abs(bvx)}if(by<0){by=0;bvy=Math.abs(bvy)}const pTop=paddleTop();if(bvy>0&&bx+ball.offsetWidth>px&&bx<px+paddle.offsetWidth&&prevBottom<=pTop&&by+ball.offsetHeight>=pTop){const hit=clamp((bx+ball.offsetWidth/2-(px+paddle.offsetWidth/2))/(paddle.offsetWidth/2),-1,1);bvx=hit*195;if(Math.abs(bvx)<35)bvx=35*(bvx<0?-1:1);bvy=-Math.max(160,Math.abs(bvy));by=pTop-ball.offsetHeight-1;}const br={l:bx,t:by,r:bx+ball.offsetWidth,b:by+ball.offsetHeight};for(const brick of bricks){if(brick.classList.contains('is-hit'))continue;const rr={l:brick.offsetLeft,t:brick.offsetTop,r:brick.offsetLeft+brick.offsetWidth,b:brick.offsetTop+brick.offsetHeight};if(br.l<rr.r&&br.r>rr.l&&br.t<rr.b&&br.b>rr.t){brick.classList.add('is-hit');score+=10;if(scoreOut)scoreOut.textContent=String(score);bvy*=-1;break;}}if(bricks.length&&bricks.every(el=>el.classList.contains('is-hit'))){complete=true;bvx=bvy=0;status.textContent='COMPLETE';}if(by>room.clientHeight+8)resetBall();renderBall();}
    requestAnimationFrame(()=>{resetGame();requestAnimationFrame(loop);});
  }
})();
