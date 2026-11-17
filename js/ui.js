// 界面与交互
var UI = (function () {
  const VERSION = '0.9.2';
  const $ = id => document.getElementById(id);
  const U = DATA.UNITS, B = DATA.BUILDINGS, TECH = DATA.TECHS;
  const S = () => GAME.S;
  const P = () => S().player;
  let sel = null; // {type:'city'|'army'|'tile', id, tile}
  let cityTab = 'gov';
  let pendingTarget = -1;
  let moveMode = false;
  let battleQueue = [], inTurn = false;
  let garrisonPick = new Set();
  const SAVE_PREFIX = 'hwhs_save_';
  let difficulty = 1, timeScale = 7;
  let animSpeed = +(localStorage.getItem('hwhs_anim') || 1);
  const phone = matchMedia('(max-width: 600px), (max-height: 500px)');
  // 触屏：不显示键盘快捷键提示
  const TOUCH = matchMedia('(pointer: coarse)');
  const kb = key => TOUCH.matches ? '' : ' ' + key;
  const SET = Object.assign({ defend: 'all', follow: true, autosave: 'turn', ui: 1, showRes: true, showSites: true, showNames: true }, (() => { try { return JSON.parse(localStorage.getItem('hwhs_settings') || '{}'); } catch (e) { return {}; } })());
  function applyUISize() {
    const zoom = phone.matches ? '' : SET.ui;
    for (const id of ['side', 'endturn', 'modal', 'tip', 'toasts']) $(id).style.zoom = zoom;
    $('top').style.zoom = phone.matches ? '' : Math.min(1, SET.ui);
    $('side').style.maxHeight = phone.matches ? '' : `calc((100vh - 215px) / ${SET.ui})`;
    document.documentElement.style.setProperty('--phone-font-scale', SET.ui);
  }
  function applySettings() {
    RENDER.opts.showRes = SET.showRes; RENDER.opts.showSites = SET.showSites; RENDER.opts.showNames = SET.showNames;
    applyUISize();
    try { localStorage.setItem('hwhs_settings', JSON.stringify(SET)); } catch (e) {}
  }
  let deferredToasts = [];
  const TU = () => GAME.unitName();

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => { n = Math.round(n); return n >= 10000 ? (n / 10000).toFixed(1) + '万' : String(n); };
  const sgn = n => (n >= 0 ? '+' : '') + Math.round(n);
  function unitName(f, t) { const c = GAME.fac(f).culture; return (DATA.CULTURE_UNIT_NAME[c] && DATA.CULTURE_UNIT_NAME[c][t]) || U[t].name; }
  function facSeal(f, cls) { const F = GAME.fac(f); return `<span class="seal ${cls || 'sm'}" style="background:${F.color}">${F.seal}</span>`; }
  function facName(f) { const F = GAME.fac(f); return F ? F.name : '?'; }
  function meter(v, max, cls) { return `<div class="meter ${cls || ''}"><i style="width:${Math.max(0, Math.min(100, v / max * 100))}%"></i></div>`; }

  // ---------- 启动 ----------
  function boot() {
    $('mobilebar').insertAdjacentHTML('beforeend', `
      <button id="cancelpreview" type="button" class="btn hidden" data-act="cancelpreview">取消预览</button>
      <div id="mapzoom" role="group" aria-label="地图缩放">
        <button type="button" class="btn" data-act="zoomin" aria-label="放大地图">＋</button>
        <button type="button" class="btn" data-act="zoomout" aria-label="缩小地图">－</button>
      </div>`);
    RENDER.init($('map'), $('mini'));
    applySettings();
    phone.addEventListener('change', () => { applyUISize(); setMenu(false); setMini(false); revealSelection(); });
    titleScreen();
    withLoading('研墨铺纸，绘制天下舆图……', () => { GEO.generate(); ensureBase(); const [c, r] = GEO.nearestHex(100, 36); RENDER.centerOn(GEO.idx(c, r), 0.45); });
    bindInput();
    GAME.on('log', e => { if (inTurn || RENDER.isAnimating()) { if (['war', 'big'].includes(e.type)) deferredToasts.push(e); } else toast(e.text, e.type); });
    GAME.on('battle', r => battleQueue.push(r));
    GAME.on('change', () => { refreshTop(); RENDER.markDirty(); });
    GAME.on('event', () => {});
  }

  function titleScreen() {
    $('title').classList.remove('hidden');
    // 山水长卷：首次显示与窗口改变大小时重绘
    const paintScene = () => {
      if (typeof INKART === 'undefined' || typeof INKART.scene !== 'function' || $('title').classList.contains('hidden')) return;
      INKART.scene($('titlescene'));
    };
    requestAnimationFrame(paintScene);
    if (!titleScreen.bound) { titleScreen.bound = true; let tm = 0; addEventListener('resize', () => { clearTimeout(tm); tm = setTimeout(paintScene, 150); }); }
    const hasAuto = !!localStorage.getItem(SAVE_PREFIX + 'auto');
    const names = ['宽仁', '中庸', '严苛', '地狱'];
    $('titlemenu').innerHTML = `
      ${hasAuto ? '<button data-t="continue">继续征程</button>' : ''}
      <button data-t="new">新开天下</button>
      <div class="diff">${names.map((n, i) => `<button data-d="${i}" class="${i === difficulty ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="diff">${[[7, '一周'], [10, '一旬'], [30, '一月'], [90, '一季']].map(([v, n]) => `<button data-sc="${v}" class="${v === timeScale ? 'on' : ''}" title="每回合推进的时间">${n}</button>`).join('')}</div>
      <button data-t="load">读取存档</button>
      <button data-t="import">导入存档</button>
      <button data-t="help">玩法说明</button>`;
    $('titlemenu').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.d) { difficulty = +b.dataset.d; titleScreen(); return; }
      if (b.dataset.sc) { timeScale = +b.dataset.sc; titleScreen(); return; }
      const t = b.dataset.t;
      if (t === 'new') startNew();
      if (t === 'continue') loadSlot('auto');
      if (t === 'load') showSave(true);
      if (t === 'import') $('importfile').click();
      if (t === 'help') showHelp();
    };
  }

  function withLoading(text, fn) {
    $('loadtext').textContent = text;
    $('loading').classList.remove('hidden');
    setTimeout(() => { try { fn(); } catch (e) { console.error(e); alert('出错：' + e.message); } $('loading').classList.add('hidden'); }, 30);
  }
  let baseBuilt = false;
  function ensureBase() { if (!baseBuilt) { RENDER.buildBase(); baseBuilt = true; } }
  function startNew() {
    withLoading('排兵布阵，诸国就位……', () => {
      GAME.newGame({ difficulty, scale: timeScale });
      ensureBase();
      enterGame();
      const yf = S().armies.find(a => a.name === '岳家军');
      RENDER.centerOn(yf ? yf.tile : GAME.city(GAME.fac(P()).capital).tile, 1.3);
      select({ type: 'army', id: yf.id, tile: yf.tile });
      processPending();
    });
  }
  function engage(aid, tile) {
    const a = GAME.army(aid);
    if (!a) return;
    RENDER.centerOn(tile);
    TACTIC.prebattle(a, tile, opts => {
      if (!opts) { refreshSide(); refreshTop(); return; }
      if (!GAME.army(aid)) return;
      GAME.takeAnim();
      const snap = RENDER.snapshot();
      const rep = GAME.attack(a, tile, opts);
      a.path = [];
      if (rep && rep.win) guide('battle');
      const evs = GAME.takeAnim();
      RENDER.play(snap, evs, Math.max(animSpeed, 1), () => {
        afterAction(true);
        const still = GAME.army(aid);
        if (still && sel && sel.type === 'army' && sel.id === aid) { sel.tile = still.tile; RENDER.state.sel = { tile: still.tile, army: still.id }; showSavedPath(); }
        else if (!still && sel && sel.id === aid) select(null);
        refreshSide(); refreshTop(); flushDeferred(); setTimeout(processPending, 30);
      });
    });
  }
  function enterGame() {
    GAME.hooks.engage = true;
    GAME.hooks.defend = (a, tile) => SET.defend === 'all' || (SET.defend === 'city' && !!GAME.cityAt(tile) && GAME.cityAt(tile).f === P());
    $('title').classList.add('hidden');
    for (const id of ['top', 'side', 'endturn', 'minimap', 'mobilebar']) $(id).classList.remove('hidden');
    setMenu(false); setMini(false);
    RENDER.buildPolitical(); RENDER.buildFog();
    refreshTop(); refreshSide();
    $('pseal').style.background = GAME.fac(P()).color;
  }

  // ---------- 顶栏 ----------
  function refreshTop() {
    if (!S()) return;
    const F = GAME.fac(P()), inc = F.income || {};
    $('date').textContent = GAME.dateStr();
    $('subdate').textContent = `公元 ${S().year} 年 · 第 ${S().turn + 1} ${TU()}`;
    $('endbtn').querySelector('span').textContent = inTurn ? '运筹中' : '下一' + TU();
    const C = S().court;
    $('courtbox').innerHTML = C ? `<span class="k">权威</span> <b>${Math.round(C.auth)}</b><div class="lean"><i style="left:${(C.lean + 100) / 2}%"></i></div><span class="k">${C.lean > 20 ? '朝议主战' : C.lean < -20 ? '朝议主和' : '朝议未决'}</span>` : '';
    const gnet = (inc.gold || 0) - (inc.upkeep || 0) + (inc.trib || 0), fnet = (inc.food || 0) - (inc.foodUp || 0);
    const r = F.research ? TECH[F.research] : null;
    const rc = F.research ? GAME.techCost(P(), F.research) : 0;
    const eta = r && inc.sci ? Math.max(1, Math.ceil((rc - F.sci) / (inc.sci * GAME.E()))) : 0;
    $('res').innerHTML = `
      <div class="rbox" title="岁入 ${inc.gold || 0}，军费俸禄与营缮 ${inc.upkeep || 0}，岁币 ${inc.trib || 0}"><span class="k">钱</span> <b>${fmt(F.gold)}</b> <span class="d ${gnet >= 0 ? 'pos' : 'neg'}">${sgn(gnet)}/季</span></div>
      <div class="rbox" title="诸州输粮 ${inc.food || 0}，军粮 ${inc.foodUp || 0}"><span class="k">粮</span> <b>${fmt(F.food)}</b> <span class="d ${fnet >= 0 ? 'pos' : 'neg'}">${sgn(fnet)}/季</span></div>
      <div class="rbox" title="每营需兵源 5（约五百人）；每季 +${inc.man || 0}"><span class="k">兵源</span> <b>${fmt(F.man)}</b></div>
      <div class="rbox" title="骑兵每营耗马 3；每季 +${inc.horse || 0}"><span class="k">马</span> <b>${fmt(F.horse)}</b></div>
      <div class="rbox" title="甲骑、火器每营耗铁 2；每季 +${inc.iron || 0}"><span class="k">铁</span> <b>${fmt(F.iron)}</b></div>
      <div class="rbox" data-act="tech" style="cursor:pointer" title="每季文教 ${inc.sci || 0}"><span class="k">研究</span> <b style="font-size:14px">${r ? r.name : '<span class=neg>未定</span>'}</b> <span class="d">${r ? eta + TU() : ''}</span>
        <div class="bar"><i style="width:${r ? Math.min(100, F.sci / rc * 100) : 0}%"></i></div></div>
      <div class="rbox" title="攻占诸国原都城即一统天下"><span class="k">都城</span> <b>${S().capProgress ? S().capProgress.own + '/' + S().capProgress.total : ''}</b></div>`;
    const idle = S().armies.filter(a => a.f === P() && a.mp > 0 && !(a.path && a.path.length) && !a.sentry).length;
    const routed = S().armies.filter(a => a.f === P() && a.path && a.path.length && a.mp > 0).length;
    const idleC = GAME.citiesOf(P()).filter(c => !c.queue.length).length;
    $('idlehint').innerHTML =
      (idleC ? `<button type="button" data-act="nextcity" title="下一座空闲城">${idleC} 城空闲<span class="keyhint">（Q）</span></button>` : '') +
      (idle ? `<button type="button" data-act="nextidle" title="下一支待命军团">尚有 ${idle} 军待命<span class="keyhint">（Tab）</span></button>` : '') +
      (routed ? `<button type="button" data-act="contall">▶ ${routed} 军待续·全军继续<span class="keyhint">（C）</span></button>` : '');
  }

  // ---------- 输入 ----------
  function setPendingTarget(t) {
    pendingTarget = t;
    $('cancelpreview').classList.toggle('hidden', t < 0);
    renderOrderBar();
  }
  function cancelPreview() { setPendingTarget(-1); showSavedPath(); RENDER.markDirty(); }
  function zoomCenter(factor) { RENDER.zoomAt(innerWidth / 2, innerHeight / 2, factor); }
  function setMenu(open) { $('menutoggle').setAttribute('aria-expanded', open); }
  function setMini(open) {
    $('maptoggle').setAttribute('aria-expanded', open);
    $('minimap').classList.toggle('mini-open', open);
    if (open) RENDER.markDirty();
  }
  function setDrawer(open) {
    const button = $('drawertoggle');
    button.setAttribute('aria-expanded', open);
    button.textContent = open ? '收起详情' : '详情';
    $('side').classList.toggle('drawer-closed', !open);
    renderOrderBar();
    requestAnimationFrame(revealSelection);
  }
  // ---------- 手机军令条：选中我军后代替详情抽屉，地图保持可见 ----------
  function myArmySel() { if (!sel || sel.type !== 'army') return null; const a = GAME.army(sel.id); return a && a.f === P() ? a : null; }
  function renderOrderBar() {
    const bar = $('orderbar');
    const a = phone.matches && S() ? myArmySel() : null;
    const drawerOpen = !$('side').classList.contains('drawer-closed') && !$('side').classList.contains('hidden');
    if (!a || drawerOpen) { bar.classList.add('hidden'); return; }
    const g = a.gen != null ? GAME.gen(a.gen) : null;
    const head = `<div class="ob-head">${g ? PORTRAIT.img(g, 34) : ''}<div><b>${esc(GAME.armyName(a))}</b><span class="note">${a.units.length} 营 · ${fmt(GAME.sumStr(a.units))} 人 · 行军力 ${Math.round(a.mp * 10) / 10}/${GAME.armyMP(a)} · 士气 ${Math.round(a.morale)}</span></div></div>`;
    let body;
    if (pendingTarget >= 0) {
      const t = pendingTarget, c = GAME.cityAt(t), ea = GAME.armyAt(t);
      const enemy = (ea && ea.f !== P() && GAME.atWar(P(), ea.f)) || (c && c.f !== P() && GAME.atWar(P(), c.f));
      const where = c ? c.name : GEO.TERRAIN[GEO.terrain[t]].name;
      const pt = RENDER.state.pathTurns || [];
      const n = pt.length ? pt[pt.length - 1][1] : 1;
      body = `<div class="ob-msg">${enemy ? '<span class="neg">进攻</span> ' : '前往 '}<b>${esc(where)}</b>　约 ${n} ${TU()}${enemy ? '　胜算 ' + odds(a, t) : ''}</div>
        <div class="ob-btns"><button class="btn" data-act="cancelpreview">取消</button><button class="btn red ob-go" data-act="go">${enemy ? '进攻' : '出发'}</button></div>`;
    } else {
      body = `<div class="ob-msg note">轻点地图，选择目的地</div>
        <div class="ob-btns">${a.path && a.path.length ? `<button class="btn red" data-act="cont" ${a.mp > 0 ? '' : 'disabled'}>继续行军</button>` : ''}<button class="btn" data-act="sentry">驻守</button><button class="btn" data-act="drawertoggle">详情</button><button class="btn" data-act="desel" aria-label="取消选择">✕</button></div>`;
    }
    bar.innerHTML = head + body;
    bar.classList.remove('hidden');
    requestAnimationFrame(revealSelection);
  }
  // 平滑移镜，避免画面一下子跳开
  let panAnim = 0;
  function smoothPan(dy) {
    cancelAnimationFrame(panAnim);
    const t0 = performance.now(), dur = 240; let done = 0;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      RENDER.pan(0, (e - done) * dy); done = e;
      if (k < 1) panAnim = requestAnimationFrame(step);
    };
    panAnim = requestAnimationFrame(step);
  }
  function revealSelection() {
    if (!phone.matches || !sel || $('side').classList.contains('hidden')) return;
    // 底部遮挡物：详情抽屉或军令条，取较高者
    let bottom = innerHeight;
    for (const id of ['side', 'orderbar']) {
      const el = $(id); if (el.classList.contains('hidden') || el.classList.contains('drawer-closed')) continue;
      const r = el.getBoundingClientRect(); if (r.height) bottom = Math.min(bottom, r.top);
    }
    if (bottom >= innerHeight) return;
    const top = $('top').getBoundingClientRect().bottom;
    const sy = (RENDER.ty(sel.tile) - RENDER.cam.y) * RENDER.cam.z;
    // 只在选中格确实被挡住时才移镜，且平滑过渡
    if (sy > bottom - 30 || sy < top + 24) smoothPan((top + bottom) / 2 - sy);
  }
  function preventPageZoom() {
    const stopZoom = e => { if (e.cancelable) e.preventDefault(); };
    for (const name of ['gesturestart', 'gesturechange', 'gestureend']) {
      document.addEventListener(name, stopZoom, { passive: false });
    }
    document.addEventListener('touchmove', e => {
      if (e.touches.length > 1) stopZoom(e);
    }, { passive: false });

    // 点按控件交给浏览器产生 click；地图的双指和两次轻点由 Pointer Events 处理。
    const controls = '#map, #minimap, button, a, input, select, textarea, label, [role="button"], [data-act]';
    let start = null, lastTap = null;
    document.addEventListener('touchstart', e => {
      const touch = e.touches[0];
      start = e.touches.length === 1 && !e.target.closest(controls) ? touch : null;
      if (!start) lastTap = null;
    }, { passive: true });
    document.addEventListener('touchcancel', () => { start = lastTap = null; }, { passive: true });
    document.addEventListener('touchend', e => {
      const from = start;
      start = null;
      const touch = e.changedTouches[0];
      if (!from || e.touches.length || Math.hypot(touch.clientX - from.clientX, touch.clientY - from.clientY) > 12) {
        lastTap = null;
        return;
      }
      if (lastTap && e.timeStamp - lastTap.time < 300 &&
          Math.hypot(touch.clientX - lastTap.x, touch.clientY - lastTap.y) <= 24) stopZoom(e);
      lastTap = { time: e.timeStamp, x: touch.clientX, y: touch.clientY };
    }, { passive: false });
  }
  function bindInput() {
    preventPageZoom();
    const cv = $('map');
    const pointers = new Map();
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const point = e => ({ x: e.clientX, y: e.clientY });
    let dragged = false, pinched = false, lastHover = -1, tipTimer;
    cv.addEventListener('pointerdown', e => {
      if (RENDER.isAnimating()) { RENDER.skipAnim(); return; }
      if (pointers.size && (e.pointerType !== 'touch' || [...pointers.values()][0].type !== 'touch')) return;
      if (!pointers.size) { dragged = false; pinched = false; }
      pointers.set(e.pointerId, { ...point(e), button: e.button, type: e.pointerType });
      if (pointers.size > 1) pinched = true;
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', e => {
      const p = pointers.get(e.pointerId);
      const next = point(e);
      if (p && pinched) {
        const [one, two] = pointers.values();
        const before = two ? distance(one, two) : 0;
        Object.assign(p, next);
        if (before > 0 && (p === one || p === two)) {
          const after = distance(one, two);
          if (after > 0) RENDER.zoomAt((one.x + two.x) / 2, (one.y + two.y) / 2, after / before);
        }
        return;
      }
      if (p && p.button === 0) {
        const dx = next.x - p.x, dy = next.y - p.y;
        const moved = p.type === 'mouse' ? Math.abs(dx) + Math.abs(dy) > 5 : distance(p, next) > 8;
        if (dragged || moved) {
          dragged = true;
          RENDER.pan(dx, dy);
          Object.assign(p, next);
          cv.style.cursor = 'grabbing';
        }
        return;
      }
      if (e.pointerType === 'touch' || !S()) return;
      clearTimeout(tipTimer);
      const t = RENDER.tileAtScreen(next.x, next.y);
      if (t !== lastHover) { lastHover = t; hover(t); }
    });
    const finishPointer = e => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      pointers.delete(e.pointerId);
      cv.style.cursor = moveMode ? 'crosshair' : 'default';
      if (e.type !== 'pointerup' || dragged || pinched || !S()) return;
      if (p.type !== 'mouse' && distance(p, point(e)) > 8) return;
      if (document.elementFromPoint(e.clientX, e.clientY) !== cv) return;
      const t = RENDER.tileAtScreen(e.clientX, e.clientY);
      if (t < 0) return;
      if (p.button === 2 || (p.button === 0 && moveMode)) orderMove(t);
      else if (p.button === 0) clickTile(t, p.type !== 'mouse');
      if (p.type !== 'mouse') {
        clearTimeout(tipTimer);
        lastHover = -1;
        hover(t, false);
        tipTimer = setTimeout(() => {
          $('tip').classList.add('hidden');
          RENDER.state.hover = -1;
          RENDER.markDirty();
        }, 2800);
      }
    };
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) cv.addEventListener(name, finishPointer);
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => { e.preventDefault(); RENDER.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0016)); }, { passive: false });
    window.addEventListener('keydown', e => {
      if (!S() || !$('title').classList.contains('hidden')) return;
      if (e.target.tagName === 'INPUT') return;
      const modalOpen = !$('modal-bg').classList.contains('hidden');
      if (RENDER.isAnimating()) { if (e.key === ' ' || e.key === 'Escape' || e.key === 'Enter') { RENDER.skipAnim(); e.preventDefault(); } return; }
      if (e.key === 'Escape') { if (modalOpen) closeModal(); else if (pendingTarget >= 0) cancelPreview(); else { moveMode = false; select(null); } return; }
      if (modalOpen) return;
      const k = e.key;
      if (k === 'Enter') { endTurn(); e.preventDefault(); }
      else if (k === 'Tab') { nextIdle(); e.preventDefault(); }
      else if (k === 'q' || k === 'Q') nextIdleCity();
      else if (k === 'c' || k === 'C') { if (sel && sel.type === 'army' && GAME.army(sel.id) && (GAME.army(sel.id).path || []).length && !e.shiftKey) continueArmies([sel.id]); else continueAll(); }
      else if (k === 'm' || k === 'M') { if (sel && sel.type === 'army') { moveMode = !moveMode; cv.style.cursor = moveMode ? 'crosshair' : 'default'; refreshSide(); } }
      else if (k === 'ArrowLeft' || k === 'a') RENDER.pan(120, 0);
      else if (k === 'ArrowRight' || k === 'd') RENDER.pan(-120, 0);
      else if (k === 'ArrowUp' || k === 'w') RENDER.pan(0, 120);
      else if (k === 'ArrowDown' || k === 's') RENDER.pan(0, -120);
      else if (k === '=' || k === '+') zoomCenter(1.2);
      else if (k === '-') zoomCenter(1 / 1.2);
      else if (k === ' ' && sel && sel.type === 'army') { const a = GAME.army(sel.id); if (a && a.f === P()) { a.sentry = true; a.path = []; nextIdle(); } e.preventDefault(); }
    });
    // 小地图
    const mm = $('minimap');
    const mmMove = e => {
      const r = $('mini').getBoundingClientRect();
      const wx = (e.clientX - r.left) * RENDER.BW / r.width;
      const wy = (e.clientY - r.top) * RENDER.BH / r.height;
      RENDER.cam.x = wx - innerWidth / 2 / RENDER.cam.z;
      RENDER.cam.y = wy - innerHeight / 2 / RENDER.cam.z;
      RENDER.pan(0, 0);
    };
    let mmPointer = null;
    mm.addEventListener('pointerdown', e => {
      if (mmPointer !== null) return;
      if (RENDER.isAnimating() && e.pointerType !== 'mouse') { RENDER.skipAnim(); return; }
      mmPointer = e.pointerId;
      mm.setPointerCapture(mmPointer);
      mmMove(e);
    });
    mm.addEventListener('pointermove', e => { if (e.pointerId === mmPointer) mmMove(e); });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      mm.addEventListener(name, e => { if (e.pointerId === mmPointer) mmPointer = null; });
    }
    // 委托
    document.body.addEventListener('click', e => {
      const el = e.target.closest('[data-act]'); if (!el) return;
      if (el.id !== 'menutoggle' && el.closest('#topmenu')) setMenu(false);
      act(el.dataset.act, el.dataset.arg, el, e);
    });
    document.body.addEventListener('pointerdown', e => {
      if (!e.target.closest('#top')) setMenu(false);
    });
    $('endbtn').onclick = endTurn;

    $('importfile').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = async () => { let txt; try { txt = await unpackSave(String(rd.result).trim()); } catch (err) { alert('存档无法读取：' + err.message); return; } withLoading('展读旧卷……', () => { try { GAME.deserialize(txt); ensureBase(); enterGame(); centerCapital(); toast('存档已导入'); } catch (err) { alert('存档无法读取：' + err.message); } }); };
      rd.readAsText(f); e.target.value = '';
    };
    $('modal-bg').addEventListener('mousedown', e => { if (e.target.id === 'modal-bg' && !modalLocked) closeModal(); });
  }

  function hover(t, previewPath = true) {
    RENDER.state.hover = t;
    const tip = $('tip');
    if (t < 0 || !S().explored[t]) { tip.classList.add('hidden'); if (previewPath) RENDER.state.path = null; RENDER.markDirty(); return; }
    const tr = GEO.TERRAIN[GEO.terrain[t]];
    const own = GAME.tileOwner(t), c = GAME.cityAt(t), a = GAME.armyAt(t);
    const y = GAME.tileYield(t);
    let h = `<b>${tr.name}</b>${GEO.river[t] ? ' · 临河' : ''}${GEO.resource[t] ? ' · <span class=skill>' + GEO.resource[t] + '</span>' : ''}`;
    if (!GEO.isWater(t)) h += `<br>粮 ${y.food}　工 ${y.prod}　钱 ${y.gold}${tr.def ? '　守 +' + Math.round(tr.def * 100) + '%' : ''}　行军耗 ${tr.move}`;
    if (own) h += `<br>${facSeal(own)} ${facName(own)}${own !== P() ? '　' + relText(own) : ''}`;
    if (c) h += `<br>城：<b>${c.name}</b>　户口 ${c.pop} 万`;
    if (a && (a.f === P() || S().visible[t])) h += `<br>军：${esc(GAME.armyName(a))}（${a.units.length} 营，${fmt(GAME.sumStr(a.units))} 人）`;
    const site = GAME.siteAt(t);
    if (site) { const ST = DATA.SITES[site.type]; const cd = ST.repeat === 'season' && site.cd[P()] > S().T; h += `<br><b class="skill">${site.name}</b>　${ST.desc}${cd ? '　<span class=neg>（本季已访）</span>' : ''}`; }
    // 预览路径
    if (pendingTarget >= 0) { tip.innerHTML = h + '<br><span class=pos>再次点击目标格出发</span>'; tip.classList.remove('hidden'); RENDER.markDirty(); return; }
    if (!previewPath) { tip.innerHTML = h; tip.classList.remove('hidden'); RENDER.markDirty(); return; }
    showSavedPath();
    if (sel && sel.type === 'army') {
      const ar = GAME.army(sel.id);
      if (ar && ar.f === P() && t !== ar.tile && (moveMode || true)) {
        const p = GAME.findPath(ar, t, 3000);
        if (p && p.length) {
          const full = [ar.tile, ...p];
          RENDER.state.path = full;
          RENDER.state.pathTurns = pathTurns(ar, full);
          const enemy = (a && a.f !== P() && GAME.atWar(P(), a.f)) || (c && c.f !== P() && GAME.atWar(P(), c.f));
          if (enemy) h += `<br><span class=neg>进攻！</span> 估算胜算：${odds(ar, t)}`;
          else h += `<br>行军约 ${RENDER.state.pathTurns.length ? RENDER.state.pathTurns[RENDER.state.pathTurns.length - 1][1] : 1} ${TU()}`;
        }
      }
    }
    tip.innerHTML = h; tip.classList.remove('hidden');
    RENDER.markDirty();
  }
  function showSavedPath() {
    RENDER.state.path = null; RENDER.state.pathTurns = null;
    if (!sel || sel.type !== 'army') return;
    const a = GAME.army(sel.id);
    if (a && a.f === P() && a.path && a.path.length) { const full = [a.tile, ...a.path]; RENDER.state.path = full; RENDER.state.pathTurns = pathTurns(a, full); }
  }
  function pathTurns(a, full) {
    const out = []; let mp = a.mp, turn = 1;
    const max = GAME.armyMP(a);
    let prog = a.progTo === full[1] ? (a.prog || 0) : 0;
    for (let k = 1; k < full.length; k++) {
      const t = full[k];
      const water = GEO.isWater(t);
      let cost = water ? 6 / (6 + (GAME.techFx(a.f).seaMP || 0)) : GEO.TERRAIN[GEO.terrain[t]].move;
      if (GEO.isWater(full[k - 1]) && !water) cost = Math.max(cost, 2);
      let need = cost - prog; prog = 0;
      while (need > mp + 1e-9) { need -= mp; out.push([full[k - 1], turn]); turn++; mp = max; }
      mp -= need;
    }
    out.push([full[full.length - 1], turn]);
    return out.filter((x, i, arr) => i === arr.length - 1 || x[1] !== (arr[i + 1] || [])[1]);
  }
  function odds(a, t) {
    const ea = GAME.armyAt(t), c = GAME.cityAt(t);
    let dp = 0;
    if (ea) dp += AI.armyPower(ea) * (1 + GEO.TERRAIN[GEO.terrain[t]].def);
    if (c && c.f !== a.f) dp += AI.cityDefense(c) - (ea && ea.f === c.f ? AI.armyPower(ea) * 1.2 : 0);
    const ap = AI.armyPower(a) * (0.55 + 0.45 * a.morale / 100);
    const r = ap / (ap + dp + 0.01);
    return r > 0.68 ? '<span class=pos>大优</span>' : r > 0.55 ? '<span class=pos>占优</span>' : r > 0.45 ? '五五之数' : r > 0.32 ? '<span class=neg>劣势</span>' : '<span class=neg>以卵击石</span>';
  }
  function relText(f) {
    const r = GAME.getRel(P(), f);
    if (r.war) return '<span class=neg>交战</span>';
    if (r.ally) return '<span class=pos>同盟</span>';
    if (r.truce > 0) return `和约（${Math.ceil(r.truce)}季）`;
    return '和平';
  }

  function clickTile(t, touch) {
    const a = GAME.armyAt(t), c = GAME.cityAt(t);
    const visA = a && (a.f === P() || S().visible[t]);
    if (sel && sel.type === 'army' && sel.tile === t && c) { select({ type: 'city', id: c.id, tile: t }); return; }
    const myA = sel && sel.type === 'army' && GAME.army(sel.id);
    if (myA && myA.f === P() && t !== myA.tile && !(visA && a.f === P())) {
      if (pendingTarget === t) { orderMove(t); return; }
      const p = GAME.findPath(myA, t, 4000);
      if (!p || !p.length) { toast('无路可达'); return; }
      setPendingTarget(t);
      const full = [myA.tile, ...p];
      RENDER.state.path = full; RENDER.state.pathTurns = pathTurns(myA, full);
      const last = RENDER.state.pathTurns.length ? RENDER.state.pathTurns[RENDER.state.pathTurns.length - 1][1] : 1;
      if (!phone.matches) toast(`路线已定：约 ${last} ${TU()}抵达。再点一次出发，${touch ? '可点「取消预览」撤回' : 'Esc 取消'}`);
      RENDER.markDirty();
      return;
    }
    if (visA && a.f === P()) select({ type: 'army', id: a.id, tile: t });
    else if (c && S().explored[t]) select({ type: 'city', id: c.id, tile: t });
    else if (visA) select({ type: 'army', id: a.id, tile: t });
    else if (S().explored[t]) select({ type: 'tile', tile: t });
    else select(null);
  }
  function select(s) {
    sel = s; garrisonPick.clear(); setPendingTarget(-1);
    if (!s || s.type !== 'army') moveMode = false;
    RENDER.state.sel = s ? { tile: s.tile, army: s.type === 'army' ? s.id : null } : null;
    showSavedPath();
    refreshSide(); RENDER.markDirty();
    if (phone.matches) setDrawer(!!s && !myArmySel());
  }
  function orderMove(t) {
    if (!sel || sel.type !== 'army') return;
    const a = GAME.army(sel.id);
    if (!a || a.f !== P()) return;
    setPendingTarget(-1);
    a.sentry = false;
    const tgtArmy = GAME.armyAt(t), tgtCity = GAME.cityAt(t);
    const other = (tgtArmy && tgtArmy.f !== P() && tgtArmy.f) || (tgtCity && tgtCity.f !== P() && tgtCity.f);
    if (other && !GAME.atWar(P(), other) && !GAME.allied(P(), other) && GEO.dist(a.tile, t) <= 1) {
      courtVote('war', other, () => { GAME.declareWar(P(), other); RENDER.buildPolitical(); doMove(a, t); });
      return;
    }
    doMove(a, t);
  }
  function doMove(a, t) {
    GAME.takeAnim();
    const snap = RENDER.snapshot();
    const mp0 = a.mp, tile0 = a.tile, nm = GAME.armyName(a);
    const res = GAME.moveArmyTo(a.id, t);
    if (res.ok) guide('move');
    if (res.ok && res.battles && res.battles.some(b => b.win)) guide('battle');
    if (res.ok) {
      const still = GAME.army(a.id);
      if (mp0 <= 0) toast(`${nm}本${TU()}行军力已尽（已行军或已交战），路线已定，下${TU()}按 C 继续`);
      else if (still && still.tile === tile0 && !(res.battles && res.battles.length)) toast(`${nm}前路险阻，本${TU()}只推进了一段，下${TU()}按 C 继续`);
    }
    moveMode = false; $('map').style.cursor = 'default';
    if (!res.ok) { GAME.takeAnim(); toast(res.msg || '无法抵达'); return; }
    RENDER.state.path = null;
    const fin = () => {
      afterAction(res.battles && res.battles.length);
      const still = GAME.army(a.id);
      if (still && sel) { sel.tile = still.tile; RENDER.state.sel = { tile: still.tile, army: still.id }; showSavedPath(); }
      else select(null);
      refreshSide(); flushDeferred();
      const eng = (res.battles || []).find(b => b.engage);
      if (eng) engage(eng.aid, eng.tile); else setTimeout(processPending, 30);
    };
    RENDER.play(snap, GAME.takeAnim(), Math.max(animSpeed, animSpeed ? 1 : 0), fin);
  }
  function continueArmies(ids) {
    if (RENDER.isAnimating()) return;
    GAME.takeAnim();
    const snap = RENDER.snapshot();
    let battles = 0; const engs = [];
    for (const id of ids) { const r = GAME.continueArmy(id); for (const b of r) { if (b.engage) engs.push(b); else battles++; } }
    const evs = GAME.takeAnim();
    if (!evs.length && !engs.length) { toast('诸军行军力已尽，下回合再行'); return; }
    RENDER.state.path = null;
    RENDER.play(snap, evs, Math.max(animSpeed, animSpeed ? 1 : 0), () => {
      afterAction(battles);
      if (sel && sel.type === 'army') { const a = GAME.army(sel.id); if (a) { sel.tile = a.tile; RENDER.state.sel = { tile: a.tile, army: a.id }; showSavedPath(); } else select(null); }
      refreshSide(); flushDeferred();
      if (engs.length) engage(engs[0].aid, engs[0].tile); else setTimeout(processPending, 30);
    });
  }
  function continueAll() {
    const ids = S().armies.filter(a => a.f === P() && a.path && a.path.length && a.mp > 0).map(a => a.id);
    if (!ids.length) { toast('无待续之路线'); return; }
    continueArmies(ids);
  }
  function flushDeferred() { const L = deferredToasts; deferredToasts = []; for (const e of L.slice(-4)) toast(e.text, e.type); }
  function afterAction(major) {
    GAME.updateVisibility();
    if (major) { GAME.assignTerritory(false); RENDER.buildPolitical(); }
    RENDER.buildFog();
    refreshTop(); RENDER.markDirty();
    flushBattles(false);
  }
  function nextIdle() {
    const list = S().armies.filter(a => a.f === P() && a.mp > 0 && !(a.path && a.path.length) && !a.sentry);
    if (!list.length) { toast('诸军皆已调遣'); return; }
    let k = sel && sel.type === 'army' ? list.findIndex(a => a.id === sel.id) : -1;
    const a = list[(k + 1) % list.length];
    select({ type: 'army', id: a.id, tile: a.tile });
    RENDER.centerOn(a.tile);
  }
  function nextIdleCity() {
    const list = GAME.citiesOf(P()).filter(c => !c.queue.length).sort((a, b) => b.pop - a.pop);
    if (!list.length) { toast('诸城皆有营造'); return; }
    let k = sel && sel.type === 'city' ? list.findIndex(c => c.id === sel.id) : -1;
    const c = list[(k + 1) % list.length];
    cityTab = 'gov';
    select({ type: 'city', id: c.id, tile: c.tile }); RENDER.centerOn(c.tile);
  }
  function centerCapital() { const c = GAME.city(GAME.fac(P()).capital); if (c) RENDER.centerOn(c.tile, 0.9); }

  // ---------- 侧栏 ----------
  function refreshSide() {
    const el = $('side');
    if (!S()) return;
    if (!sel) { el.innerHTML = overviewHTML(); return; }
    if (sel.type === 'city') { const c = GAME.city(sel.id); el.innerHTML = c.f === P() ? cityHTML(c) : foreignCityHTML(c); }
    else if (sel.type === 'army') { const a = GAME.army(sel.id); if (!a) { sel = null; el.innerHTML = overviewHTML(); return; } el.innerHTML = a.f === P() ? armyHTML(a) : foreignArmyHTML(a); }
    else el.innerHTML = tileHTML(sel.tile);
    renderOrderBar();
  }
  function overviewHTML() {
    const F = GAME.fac(P());
    const cs = GAME.citiesOf(P());
    const pop = cs.reduce((s, c) => s + c.pop, 0);
    const wars = Object.keys(S().factions).filter(f => f !== P() && GAME.fac(f).alive && f !== 'rebel' && GAME.atWar(P(), f));
    const recent = S().log.slice(-8).reverse();
    return `<div class="ph">${facSeal(P(), '')}<div><h2>${F.name}</h2><div class="sub">${GAME.dateStr()}</div></div></div>
      <div class="stat"><div><b>${cs.length}</b><span>州府</span></div><div><b>${pop}</b><span>户口(万)</span></div><div><b>${S().armies.filter(a => a.f === P()).length}</b><span>军团</span></div><div><b>${Object.keys(F.techs).length}</b><span>科技</span></div></div>
      <div class="sec">交战之国</div>
      <div class="chips">${wars.length ? wars.map(f => `<span class="chip red" data-act="dip">${facName(f)}</span>`).join('') : '<span class="note">四境无战事</span>'}</div>
      ${guideHTML()}
      <div class="sec">近事</div>
      <div class="loglist">${recent.map(logRow).join('')}</div>
      <p class="note">${TOUCH.matches ? '轻点城池或军队查看；选中军队后轻点目的地看路线，点「出发」即行。单指拖动平移，双指缩放。' : '左键选取城池或军队；选中军队后左键点目标格显示路线，<b>再点一次</b>出发（右键可直接出发）。未走完的路线按 <kbd>C</kbd> 继续，<kbd>Shift+C</kbd> 全军继续。拖动平移，滚轮缩放，<kbd>Enter</kbd> 结束回合。'}</p>`;
  }
  function tileHTML(t) {
    const tr = GEO.TERRAIN[GEO.terrain[t]], y = GAME.tileYield(t), own = GAME.tileOwner(t);
    return `<div class="ph"><div><h2>${tr.name}</h2><div class="sub">${GEO.river[t] ? '临河 · ' : ''}${GEO.resource[t] ? '物产：' + GEO.resource[t] : '无特产'}</div></div><button class="x" data-act="desel">×</button></div>
      <div class="stat"><div><b>${y.food}</b><span>粮</span></div><div><b>${y.prod}</b><span>工</span></div><div><b>${y.gold}</b><span>钱</span></div><div><b>${tr.move}</b><span>行军耗</span></div></div>
      ${own ? `<p>${facSeal(own)} 属【${facName(own)}】${own !== P() ? '　' + relText(own) : ''}</p>` : '<p class="note">无主之地</p>'}`;
  }

  function cityHTML(c) {
    const y = GAME.cityYield(c), tg = GAME.loyaltyTarget(c), g = GAME.gen(c.governor);
    const tabs = [['gov', '内政'], ['mil', '军务'], ['trade', '海贸']];
    let h = `<div class="ph">${facSeal(c.f, '')}<div><h2>${c.name}${c.cap ? ' <span class="chip red">都城</span>' : ''}</h2><div class="sub">户口 ${c.pop} 万 · 仓储 ${Math.round(c.store)}/${Math.round(GAME.growthTh(c))}</div></div><button class="x" data-act="desel">×</button></div>
      <div class="stat"><div><b class="${y.food - y.foodNeed >= 0 ? 'pos' : 'neg'}">${sgn(y.food - y.foodNeed)}</b><span>余粮/季</span></div><div><b>${y.prod}</b><span>工/季</span></div><div><b>${y.gold}</b><span>钱/季${y.trade ? '(贸' + y.trade + ')' : ''}</span></div><div><b>${y.sci}</b><span>文/季</span></div></div>
      <div class="row"><span>民心 ${Math.round(c.loyalty)}</span><div class="grow">${meter(c.loyalty, 100, c.loyalty < 30 ? 'red' : '')}</div><span class="cost">趋向 ${tg}</span></div>
      <div class="row"><span>城防 ${Math.round(c.wall)}/${GAME.maxWall(c)}</span><div class="grow">${meter(c.wall, GAME.maxWall(c), 'gold')}</div></div>
      <div class="tabs">${tabs.map(([k, n]) => `<button data-act="ctab" data-arg="${k}" class="${cityTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    if (cityTab === 'gov') {
      h += `<div class="sec">营造队列 ${c.queue.length ? `<span class="r"><button class="btn sm" data-act="hurry" ${GAME.fac(P()).gold < GAME.hurryCost(c) ? 'disabled' : ''}>加急 ${GAME.hurryCost(c)} 贯</button></span>` : ''}</div>`;
      h += c.queue.length ? c.queue.map((q, k) => `<div class="row"><span class="grow">${q.kind === 'b' ? B[q.id].name : '募' + unitName(P(), q.id)}<br>${meter(q.prog, q.cost, 'gold')}</span><span class="cost">${Math.max(0, Math.ceil((q.cost - q.prog) / Math.max(0.1, y.prod * GAME.E())))} ${TU()}</span><button class="btn sm" data-act="deq" data-arg="${k}">撤</button></div>`).join('') : '<div class="note">空闲——请择一项营建或征兵。</div>';
      {
        const gold = GAME.fac(P()).gold, rk = GAME.reliefCost(c), mk = GAME.migrateCost(c);
        const rOk = GAME.reliefReady(c), mOk = GAME.migrateOk(c);
        const mWhy = c.cap ? '都城不须' : c.pop >= 12 ? '户口已足' : '两年一次';
        h += `<div class="sec">安民</div><div class="btns">
          <button class="btn sm" data-act="relief" ${rOk && gold >= rk ? '' : 'disabled'} title="民心 +15，民变之势 −15；一年一次">赈济 ${rk} 贯${rOk ? '' : '（一年一次）'}</button>
          <button class="btn sm" data-act="migrate" ${mOk && gold >= mk ? '' : 'disabled'} title="户口 +1 万；户口十二万以下、非都城，两年一次">移民实边 ${mk} 贯${mOk ? '' : '（' + mWhy + '）'}</button></div>`;
      }
      h += `<div class="sec">知州</div>`;
      h += g ? `<div class="row">${PORTRAIT.img(g, 34)}<span class="grow">${g.name}　政 ${g.zheng}${g.skill ? ' <span class=skill>' + g.skill + '</span>' : ''}</span><button class="btn sm" data-act="govoff">卸任</button></div>` : `<div class="row"><span class="grow note">无人主政</span><button class="btn sm" data-act="govpick">任命</button></div>`;
      h += `<div class="sec">已建</div><div class="chips">${Object.keys(c.buildings).map(b => `<span class="chip" title="${B[b].desc}">${B[b].name}</span>`).join('') || '<span class="note">无</span>'}</div>`;
      h += `<div class="sec">可营建</div>`;
      for (const b of GAME.buildOptions(c)) h += `<div class="row click" data-act="build" data-arg="${b}"><span class="grow"><b>${B[b].name}</b><br><span class="note">${B[b].desc}</span></span><span class="cost">工 ${B[b].prod}<br>约 ${Math.ceil(B[b].prod / Math.max(0.1, y.prod * GAME.E()))} ${TU()}</span></div>`;
    } else if (cityTab === 'mil') {
      const cap = c.garrison.length;
      const gcap = GAME.garrisonCap(c);
      h += `<div class="sec">守军（${cap}/${gcap} 营${cap > gcap ? ' <span class=neg>超编，军饷加倍</span>' : ''}）<span class="r">${c.garrison.length ? `<button class="btn sm red" data-act="form">组建军团${garrisonPick.size ? '（' + garrisonPick.size + '）' : ''}</button>` : ''}</span></div>`;
      h += c.garrison.map((u, i) => `<div class="row click ${garrisonPick.has(i) ? 'sel' : ''}" data-act="gpick" data-arg="${i}"><span class="unit-ic">${unitName(P(), u.t)[0]}</span><span class="grow">${unitName(P(), u.t)}<br>${meter(u.s, 100)}</span><span class="cost">${u.s * 5} 人</span></div>`).join('') || '<div class="note">城中无兵。</div>';
      if (c.garrison.length) h += `<div class="note">点选守军营后组建军团（不选则全选）。军团规模受主将统率所限。</div>`;
      const a = GAME.armyAt(c.tile);
      if (a && a.f === P()) h += `<div class="row click" data-act="selarmy" data-arg="${a.id}"><span class="grow">城中驻有：<b>${esc(GAME.armyName(a))}</b>（${a.units.length} 营）</span><span class="cost">选取 ›</span></div>`;
      h += `<div class="sec">征兵</div>`;
      for (const u of GAME.unitOptions(c)) {
        const k = GAME.unitCost(c, u), ok = GAME.canAffordUnit(c, u);
        h += `<div class="row ${ok ? 'click' : ''}" ${ok ? `data-act="recruit" data-arg="${u}"` : ''} style="${ok ? '' : 'opacity:.45'}"><span class="unit-ic">${unitName(P(), u)[0]}</span><span class="grow"><b>${unitName(P(), u)}</b> <span class="note">攻${U[u].atk} 守${U[u].def} 行${U[u].mv}</span><br><span class="note">${U[u].desc}</span></span><span class="cost">钱${k.gold} 兵${k.man}${k.horse ? ' 马' + k.horse : ''}${k.iron ? ' 铁' + k.iron : ''}<br>工${k.prod}·${Math.ceil(k.prod / Math.max(0.1, y.prod * GAME.E()))}${TU()}</span></div>`;
      }
    } else {
      const slots = GAME.tradeSlots(c);
      if (!c.port) h += '<div class="note">此城不临海，无法开设海路。</div>';
      else if (!slots) h += '<div class="note">需建<b>市舶司</b>方可开辟海贸航线。</div>';
      else {
        h += `<div class="sec">航线 ${c.trade.length}/${slots}</div>`;
        h += c.trade.map(t => { const b = GAME.city(t); return `<div class="row">${facSeal(b.f)}<span class="grow">${b.name}（${facName(b.f)}）</span><span class="cost">+${GAME.routeValue(c, b)} 贯</span><button class="btn sm" data-act="cutroute" data-arg="${t}">罢</button></div>`; }).join('') || '<div class="note">尚无航线。</div>';
        if (c.trade.length < slots) {
          const tg2 = GAME.routeTargets(c).slice(0, 10);
          h += `<div class="sec">可通商之港</div>`;
          h += tg2.map(b => `<div class="row click" data-act="route" data-arg="${b.id}">${facSeal(b.f)}<span class="grow">${b.name}（${facName(b.f)}）<br><span class="note">相距 ${GEO.dist(c.tile, b.tile)} 程</span></span><span class="cost">+${GAME.routeValue(c, b)} 贯/季</span></div>`).join('') || '<div class="note">无可达之港（需同一海域、已结识且不在交战；未习远洋则不过 48 程）。</div>';
        }
      }
      const inb = S().cities.filter(o => o.trade.includes(c.id));
      if (inb.length) h += `<div class="sec">来港番舶</div>` + inb.map(o => `<div class="row">${facSeal(o.f)}<span class="grow">${o.name}（${facName(o.f)}）</span><span class="cost">+${Math.round(GAME.routeValue(o, c) * 0.5)}</span></div>`).join('');
    }
    return h;
  }
  function foreignCityHTML(c) {
    const vis = S().visible[c.tile];
    return `<div class="ph">${facSeal(c.f, '')}<div><h2>${c.name}</h2><div class="sub">【${facName(c.f)}】${c.cap ? '都城' : '城池'}</div></div><button class="x" data-act="desel">×</button></div>
      <div class="stat"><div><b>${c.pop}</b><span>户口</span></div><div><b>${vis ? Math.round(c.wall) : '?'}</b><span>城防</span></div><div><b>${vis ? c.garrison.length : '?'}</b><span>守军(营)</span></div><div><b>${c.f === 'rebel' ? '—' : Math.round(GAME.getRel(P(), c.f).op)}</b><span>好感</span></div></div>
      <p>关系：${c.f === 'rebel' ? '<span class=neg>乱军</span>' : relText(c.f)}</p>
      ${vis ? '' : '<p class="note">此城不在视野之内，所见为旧日情报。</p>'}
      <div class="btns"><button class="btn" data-act="dip">外交</button></div>`;
  }
  function genBlock(g, f) {
    if (!g) return `<div class="row"><span class="gseal" style="background:#777">军</span><span class="grow">偏师（无主将）<br><span class="note">统兵上限 4 营，战力 -10%</span></span></div>`;
    return `<div class="row">${PORTRAIT.img(g, 64, 'style="width:64px;height:64px"')}<span class="grow"><b style="font-size:17px">${g.name}</b>${g.hist ? ' <span class="chip">史</span>' : ''} <span class="note">${S().year - g.birth}岁</span><br>
      <span class="gstats">统<b>${g.tong}</b> 武<b>${g.wu}</b> 智<b>${g.zhi}</b> 政<b>${g.zheng}</b></span>
      <div style="display:flex;align-items:center;gap:6px;font-size:12px">Lv${g.lv || 1}<div class="grow" style="flex:1">${meter((g.exp || 0) - 0, GAME.nextLv(g), 'gold')}</div><span class="cost">${Math.round(g.exp || 0)}/${GAME.nextLv(g)}</span></div>
      ${GAME.skillList(g).map(k => `<span class="skill" title="${DATA.SKILLS[k] || ''}">【${k}】</span>`).join('')}${(g.items || []).map(i => `<span class="chip" title="${DATA.ITEMS[i].desc}">${DATA.ITEMS[i].name}</span>`).join(' ')}</span></div>`;
  }
  function armyHTML(a) {
    const c = GAME.cityAt(a.tile), inOwn = c && c.f === P();
    const near = S().armies.filter(o => o !== a && o.f === P() && GEO.dist(o.tile, a.tile) === 1);
    let h = `<div class="ph"><div><h2>${esc(GAME.armyName(a))}</h2><div class="sub">${a.units.length}/${GAME.armyCap(a)} 营 · ${fmt(GAME.sumStr(a.units))} 人${inOwn ? ' · 驻' + c.name : ''}</div></div><button class="x" data-act="desel">×</button></div>`;
    h += genBlock(GAME.gen(a.gen), a.f);
    h += `<div class="row"><span>士气 ${Math.round(a.morale)}</span><div class="grow">${meter(a.morale, 100, a.morale < 40 ? 'red' : '')}</div><span class="cost">行军力 ${Math.round(a.mp * 10) / 10}/${Math.round(GAME.armyMP(a) * 10) / 10}</span></div>`;
    h += `<div class="btns"><button class="btn ${moveMode ? 'red' : ''}" data-act="movemode">行军${kb('M')}</button>${a.path && a.path.length ? `<button class="btn red" data-act="cont" ${a.mp > 0 ? '' : 'disabled'}>继续行军${kb('C')}</button><button class="btn" data-act="stop">取消路线</button>` : ''}<button class="btn" data-act="sentry">驻守${kb('␣')}</button><button class="btn" data-act="reward" ${GAME.rewardReady(a) && GAME.fac(P()).gold >= GAME.rewardCost(a) ? '' : 'disabled'} title="士气 +30，主将经验 +15；两季一次">犒军 ${GAME.rewardCost(a)} 贯</button><button class="btn" data-act="genpick">${a.gen != null ? '换将' : '任将'}</button>${inOwn ? '<button class="btn" data-act="disband">解散入城</button>' : ''}</div>`;
    if (GAME.canSail(a)) h += `<p class="note">舟师足以载军，可横渡江海。</p>`;
    h += `<div class="sec">各营</div>`;
    h += a.units.map((u, i) => `<div class="row"><span class="unit-ic">${unitName(P(), u.t)[0]}</span><span class="grow">${unitName(P(), u.t)}<br>${meter(u.s, 100)}</span><span class="cost">${u.s * 5} 人</span>${inOwn ? `<button class="btn sm" data-act="toCity" data-arg="${i}">留驻</button>` : ''}</div>`).join('');
    if (inOwn && c.garrison.length && a.units.length < GAME.armyCap(a)) {
      h += `<div class="sec">城中守军可补入</div>`;
      h += c.garrison.map((u, i) => `<div class="row click" data-act="toArmy" data-arg="${i}"><span class="unit-ic">${unitName(P(), u.t)[0]}</span><span class="grow">${unitName(P(), u.t)}　${u.s * 5} 人</span><span class="cost">补入 ›</span></div>`).join('');
    }
    if (near.length) h += `<div class="sec">相邻友军</div>` + near.map(o => `<div class="row"><span class="grow">${esc(GAME.armyName(o))}（${o.units.length} 营）</span><button class="btn sm" data-act="merge" data-arg="${o.id}">并入本军</button></div>`).join('');
    h += `<p class="note">${TOUCH.matches ? '轻点目标格看路线，再点一次（或点「出发」）即行军' : '选中后右键目标格行军，或左键点两次'}；目标为交战之敌则进攻。城外每季休整 +8，入城 +20；粮尽则减员。</p>`;
    return h;
  }
  function foreignArmyHTML(a) {
    const g = GAME.gen(a.gen);
    const cnt = {}; for (const u of a.units) cnt[u.t] = (cnt[u.t] || 0) + 1;
    return `<div class="ph">${facSeal(a.f, '')}<div><h2>${esc(GAME.armyName(a))}</h2><div class="sub">【${facName(a.f)}】${a.units.length} 营 · ${fmt(GAME.sumStr(a.units))} 人</div></div><button class="x" data-act="desel">×</button></div>
      ${genBlock(g, a.f)}
      <div class="chips">${Object.entries(cnt).map(([t, n]) => `<span class="chip">${unitName(a.f, t)}×${n}</span>`).join('')}</div>
      <p>关系：${a.f === 'rebel' ? '<span class=neg>乱军</span>' : relText(a.f)}　士气 ${Math.round(a.morale)}</p>`;
  }

  // ---------- 动作 ----------
  function act(k, arg, el, ev) {
    const F = S() ? GAME.fac(P()) : null;
    const c = sel && sel.type === 'city' ? GAME.city(sel.id) : null;
    const a = sel && sel.type === 'army' ? GAME.army(sel.id) : null;
    switch (k) {
      case 'menutoggle': setMenu(el.getAttribute('aria-expanded') !== 'true'); break;
      case 'maptoggle': setMini(el.getAttribute('aria-expanded') !== 'true'); break;
      case 'drawertoggle': setDrawer(el.getAttribute('aria-expanded') !== 'true'); break;
      case 'zoomin': zoomCenter(1.2); break;
      case 'zoomout': zoomCenter(1 / 1.2); break;
      case 'cancelpreview': cancelPreview(); break;
      case 'go': if (pendingTarget >= 0) orderMove(pendingTarget); break;
      case 'desel': select(null); break;
      case 'ctab': cityTab = arg; refreshSide(); break;
      case 'build': GAME.queueBuilding(c.id, arg); guide('build'); refreshSide(); break;
      case 'recruit': if (!GAME.queueUnit(c.id, arg)) toast('钱粮兵马不足'); else guide('recruit'); refreshSide(); refreshTop(); break;
      case 'deq': GAME.dequeue(c.id, +arg); refreshSide(); refreshTop(); break;
      case 'hurry': if (GAME.hurry(c.id)) toast('已加急，下季完工'); refreshSide(); refreshTop(); break;
      case 'relief': GAME.relief(c.id); refreshSide(); refreshTop(); break;
      case 'migrate': GAME.migrate(c.id); refreshSide(); refreshTop(); break;
      case 'reward': GAME.rewardArmy(a.id); refreshSide(); refreshTop(); break;
      case 'donate': { const d = GAME.donateInfo(P()); const n = arg === 'all' ? d.left : Math.ceil(d.cap / 4); const got = GAME.donate(P(), n); if (!got) toast('本季已捐满或国库不足'); showTech(); refreshTop(); break; }
      case 'govpick': pickGeneral('任命知州', g => true, g => g.zheng, gid => { GAME.assignGovernor(gid, c.id); guide('gov'); refreshSide(); }); break;
      case 'govoff': GAME.unassign(c.governor); refreshSide(); break;
      case 'gpick': { const i = +arg; garrisonPick.has(i) ? garrisonPick.delete(i) : garrisonPick.add(i); refreshSide(); break; }
      case 'form': {
        if (GAME.armyAt(c.tile)) { toast('城中已驻一军，请先令其出城或将守军补入该军'); break; }
        const idx = garrisonPick.size ? [...garrisonPick] : c.garrison.map((u, i) => i);
        pickGeneral('择将统军', g => true, g => g.tong, gid => {
          const cap = GAME.capFor(gid);
          if (idx.length > cap) toast(`主将统率所限，仅领 ${cap} 营`);
          const na = GAME.formArmy(c.id, gid, idx.slice(0, cap));
          if (na) { select({ type: 'army', id: na.id, tile: na.tile }); guide('form'); toast(`军团已成。新军整编，本${TU()}行军力减半`); }
        }, true);
        break;
      }
      case 'selarmy': { const x = GAME.army(+arg); select({ type: 'army', id: x.id, tile: x.tile }); break; }
      case 'route': if (GAME.openRoute(c.id, +arg)) { refreshSide(); refreshTop(); RENDER.markDirty(); } break;
      case 'cutroute': c.trade = c.trade.filter(t => t !== +arg); refreshSide(); RENDER.markDirty(); break;
      case 'movemode': moveMode = !moveMode; $('map').style.cursor = moveMode ? 'crosshair' : 'default'; refreshSide(); break;
      case 'stop': a.path = []; cancelPreview(); refreshSide(); refreshTop(); break;
      case 'cont': continueArmies([a.id]); break;
      case 'court': showCourt(); break;
      case 'settings': showSettings(); break;
      case 'guideoff': S().guide = S().guide || {}; S().guide.off = 1; refreshSide(); break;
      case 'gototile': { closeModal(); const t = +arg; RENDER.centerOn(t); RENDER.flash(t); break; }
      case 'nextcity': nextIdleCity(); break;
      case 'contall': continueAll(); break;
      case 'nextidle': nextIdle(); break;
      case 'sentry': a.sentry = true; a.path = []; refreshTop(); nextIdle(); break;
      case 'genpick': pickGeneral(a.gen != null ? '更换主将' : '任命主将', g => true, g => g.tong, gid => { GAME.setArmyGeneral(a.id, gid); refreshSide(); }, true); break;
      case 'disband': GAME.disband(a.id); select({ type: 'city', id: GAME.cityAt(sel.tile).id, tile: sel.tile }); break;
      case 'toCity': GAME.transferToCity(a.id, +arg); if (!GAME.army(a.id)) select({ type: 'city', id: GAME.cityAt(sel.tile).id, tile: sel.tile }); else refreshSide(); break;
      case 'toArmy': if (!GAME.transferToArmy(a.id, +arg)) toast('军团已满'); refreshSide(); break;
      case 'merge': if (GAME.mergeArmies(a.id, +arg)) { refreshSide(); RENDER.markDirty(); } break;
      case 'tech': showTech(); break;
      case 'settech': GAME.setResearch(P(), arg); guide('research'); showTech(); refreshTop(); break;
      case 'gens': showGenerals(); break;
      case 'dip': showDiplomacy(); break;
      case 'cities': showCities(); break;
      case 'armies': showArmies(); break;
      case 'chron': showChronicle(arg); break;
      case 'save': showSave(false); break;
      case 'help': showHelp(); break;
      case 'animx': animSpeed = (animSpeed + 1) % 3; localStorage.setItem('hwhs_anim', animSpeed); refreshTop(); toast('回合动画：' + ['关闭', '常速', '快速'][animSpeed]); break;
      case 'goto': { const [type, id] = arg.split(':'); closeModal(); if (type === 'c') { const x = GAME.city(+id); select({ type: 'city', id: x.id, tile: x.tile }); RENDER.centerOn(x.tile); } else { const x = GAME.army(+id); if (x) { select({ type: 'army', id: x.id, tile: x.tile }); RENDER.centerOn(x.tile); } } break; }
      case 'mclose': closeModal(); break;
    }
  }

  // ---------- 弹窗 ----------
  let modalLocked = false, modalOnClose = null;
  function openModal(html, opts) {
    opts = opts || {};
    modalLocked = !!opts.lock; modalOnClose = opts.onClose || null;
    const modal = $('modal');
    modal.innerHTML = (opts.lock ? '' : '<button class="mclose" data-act="mclose" aria-label="关闭">×</button>') + '<div class="modal-content">' + html + '</div>';
    for (const table of modal.querySelectorAll('table.t')) {
      const scroll = document.createElement('div');
      scroll.className = 'table-scroll';
      table.replaceWith(scroll);
      scroll.append(table);
    }
    modal.style.width = opts.width || '';
    $('modal-bg').classList.remove('hidden');
  }
  function closeModal() {
    $('modal-bg').classList.add('hidden'); $('modal').innerHTML = '';
    const f = modalOnClose; modalOnClose = null; modalLocked = false;
    if (f) f();
    else setTimeout(processPending, 10);
  }
  function confirmBox(text, yes) {
    openModal(`<h1>请旨</h1><div class="story">${esc(text)}</div><div class="choices"><button class="choice" id="cy">准奏</button><button class="choice" id="cn">作罢</button></div>`, { width: '520px' });
    $('cy').onclick = () => { closeModal(); yes(); }; $('cn').onclick = closeModal;
  }
  function pickGeneral(title, filter, sortKey, cb, allowNone) {
    const list = S().generals.filter(g => g.f === P() && g.status === 'idle' && filter(g)).sort((x, y) => sortKey(y) - sortKey(x));
    let h = `<h1>${title}</h1><div class="scroll" style="max-height:60vh"><table class="t"><tr><th>姓名</th><th>年</th><th>统</th><th>武</th><th>智</th><th>政</th><th>特技</th><th>立场</th><th>统兵</th><th></th></tr>`;
    if (allowNone) h += `<tr><td>（不设主将）</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td>4</td><td><button class="btn sm" data-pg="-1">选</button></td></tr>`;
    for (const g of list) h += `<tr><td>${PORTRAIT.img(g, 30)} <b>${g.name}</b>${g.hist ? ' <span class=chip>史</span>' : ''}</td><td>${S().year - g.birth}</td><td>${g.tong}</td><td>${g.wu}</td><td>${g.zhi}</td><td>${g.zheng}</td><td>${GAME.skillList(g).map(k => `<span class="skill" title="${DATA.SKILLS[k]}">${k}</span>`).join(' ')}</td><td>${stanceTag(g)}</td><td>${GAME.capFor(g.id)}</td><td><button class="btn sm red" data-pg="${g.id}">选</button></td></tr>`;
    h += `</table>${list.length ? '' : '<p class="note">朝中暂无闲散之臣。可待科举取士、名士来投，或在将领名册中召回。</p>'}</div>`;
    openModal(h, { width: '720px', onClose: () => {} });
    $('modal').onclick = e => { const b = e.target.closest('[data-pg]'); if (!b) return; const id = +b.dataset.pg; $('modal').onclick = null; closeModal(); cb(id < 0 ? null : id); refreshTop(); };
  }

  function showTech() {
    const F = GAME.fac(P());
    const branches = ['农桑', '工技', '兵学', '文治', '航海'];
    const av = GAME.availableTechs(P());
    const dn = GAME.donateInfo(P());
    let h = `<h1>格物致知</h1><div class="note" style="text-align:center">每季文教 ${F.income.sci || 0}　已积 ${Math.round(F.sci)}　点选可研之术以定方略</div>
      <div class="note" style="text-align:center;margin-top:4px">捐资助学：每 ${dn.rate} 贯折文教 1，本季尚可捐 ${dn.left}（上限为半季文教）
        <button class="btn sm" data-act="donate" data-arg="part" ${dn.left && F.gold >= dn.rate ? '' : 'disabled'}>捐 ${Math.min(dn.left, Math.ceil(dn.cap / 4)) * dn.rate} 贯</button>
        <button class="btn sm" data-act="donate" data-arg="all" ${dn.left && F.gold >= dn.rate ? '' : 'disabled'}>尽捐 ${dn.cost} 贯</button></div><div class="scroll" style="max-height:70vh;margin-top:8px"><div class="techgrid">`;
    for (const br of branches) {
      h += `<div class="techcol"><h3>${br}</h3>`;
      // 按时代、再按花费排列；有多个时代时插入时代小标题
      const ids = Object.keys(TECH).filter(id => TECH[id].branch === br).sort((x, y) => ((TECH[x].era || 1) - (TECH[y].era || 1)) || (TECH[x].cost - TECH[y].cost));
      const eraNames = DATA.ERAS || ['', '中兴', '开海', '万国'];
      const multiEra = Object.values(TECH).some(t => (t.era || 1) > 1);
      let lastEra = 0;
      for (const id of ids) {
        const t = TECH[id];
        if (multiEra && (t.era || 1) !== lastEra) { lastEra = t.era || 1; h += `<div class="note" style="margin:6px 0 2px;border-bottom:1px dashed var(--ink2)">${eraNames[lastEra] || '第' + lastEra + '期'}</div>`; }
        const known = GAME.hasTech(P(), id), can = av.includes(id), cur = F.research === id;
        const cost = GAME.techCost(P(), id);
        h += `<div class="tech ${known ? 'known' : can ? 'avail' : 'lock'} ${cur ? 'cur' : ''}" ${can ? `data-act="settech" data-arg="${id}"` : ''}><b>${t.name}</b> ${known ? '✓' : `<span class="cost">${cost}</span>`}<br>${t.desc}${t.req && !known ? `<br><span class="cost">需：${t.req.map(r => TECH[r].name).join('、')}</span>` : ''}${cur ? `<div class="meter gold" style="margin-top:3px"><i style="width:${Math.min(100, F.sci / cost * 100)}%"></i></div>` : ''}</div>`;
      }
      h += `</div>`;
    }
    h += `</div></div>`;
    openModal(h, { width: '1040px' });
  }

  function statusText(g) {
    if (g.status === 'army') { const a = GAME.army(g.loc); return a ? '统 ' + esc(GAME.armyName(a)) : '统军'; }
    if (g.status === 'gov') return '知 ' + GAME.city(g.loc).name;
    if (g.status === 'idle') return '<span class="pos">候命</span>';
    if (g.status === 'court') { const o = COURT.OFFICES.find(o => o.id === COURT.officeOf(g)); return '<span class="skill">' + (o ? o.name : '朝臣') + '</span>'; }
    return g.status;
  }
  function stanceTag(g) { COURT.ensure(g); const c = g.stance === 'war' ? 'neg' : g.stance === 'peace' ? 'pos' : ''; return `<span class="${c}">${COURT.STANCE_NAME[g.stance]}</span>`; }
  function showGenerals() {
    const mine = S().generals.filter(g => g.f === P() && ['idle', 'army', 'gov', 'court'].includes(g.status)).map(g => COURT.ensure(g)).sort((a, b) => (b.tong + b.wu + b.zhi + b.zheng) - (a.tong + a.wu + a.zhi + a.zheng));
    const caps = S().generals.filter(g => g.status === 'captive' && g.capBy === P());
    let h = `<h1>文武百官</h1><div class="scroll" style="max-height:72vh"><table class="t"><tr><th>姓名</th><th>年</th><th>级</th><th>统</th><th>武</th><th>智</th><th>政</th><th>特技 / 宝物</th><th>立场</th><th>忠诚</th><th>职守</th><th>战绩</th><th></th></tr>`;
    for (const g of mine) h += `<tr><td>${PORTRAIT.img(g, 30)} <b>${g.name}</b>${g.hist ? ' <span class=chip>史</span>' : ''}</td><td>${S().year - g.birth}</td><td>${g.lv || 1}</td><td>${g.tong}</td><td>${g.wu}</td><td>${g.zhi}</td><td>${g.zheng}</td><td>${GAME.skillList(g).map(k => `<span class="skill" title="${DATA.SKILLS[k]}">${k}</span>`).join(' ')}${(g.items || []).map(i => ` <span class="chip" title="${DATA.ITEMS[i].desc}">${DATA.ITEMS[i].name}</span>`).join('')}</td><td>${stanceTag(g)}</td><td class="${g.loyalty < 40 ? 'neg' : ''}">${Math.round(g.loyalty)}${g.loyal ? ' <span title="精忠：忠诚不会过低">忠</span>' : ''}</td><td>${statusText(g)}</td><td>${g.wins || 0} 胜</td>
      <td><button class="btn sm" data-g="reward" data-id="${g.id}" title="赏赐 50 贯，忠诚 +12">赏</button> ${g.status === 'idle' ? `<button class="btn sm" data-g="gov" data-id="${g.id}">任知州</button>` : `<button class="btn sm" data-g="recall" data-id="${g.id}">召回</button>`}${g.status === 'army' ? ` <button class="btn sm" data-g="find" data-id="${g.id}">寻</button>` : ''}</td></tr>`;
    h += `</table>`;
    if (caps.length) {
      h += `<h3 style="margin-top:16px">囚中敌将</h3><table class="t"><tr><th>姓名</th><th>原属</th><th>统</th><th>武</th><th>智</th><th>政</th><th>特技</th><th></th></tr>`;
      for (const g of caps) h += `<tr><td>${PORTRAIT.img(g, 30)} <b>${g.name}</b></td><td>${facName(g.f)}</td><td>${g.tong}</td><td>${g.wu}</td><td>${g.zhi}</td><td>${g.zheng}</td><td>${g.skill || ''}</td><td><button class="btn sm red" data-g="recruit" data-id="${g.id}">招降</button> <button class="btn sm" data-g="release" data-id="${g.id}">释放</button> <button class="btn sm" data-g="exec" data-id="${g.id}">斩</button></td></tr>`;
      h += `</table>`;
    }
    h += `<p class="note">候命之将方可统军或任知州。文臣多由三年一度的科举选拔（每逢公元年份除三余二之春）。</p></div>`;
    openModal(h, { width: '900px' });
    $('modal').onclick = e => {
      const b = e.target.closest('[data-g]'); if (!b) return;
      const id = +b.dataset.id, k = b.dataset.g, g = GAME.gen(id);
      if (k === 'recall') { GAME.unassign(id); showGenerals(); }
      if (k === 'reward') { if (COURT.reward(id)) { toast(`赏赐${g.name}，忠诚升至 ${Math.round(g.loyalty)}`); guide('reward'); } else toast('国库不足'); showGenerals(); }
      if (k === 'find') { const a = GAME.army(g.loc); closeModal(); if (a) { select({ type: 'army', id: a.id, tile: a.tile }); RENDER.centerOn(a.tile); } }
      if (k === 'gov') pickCity('任 ' + g.name + ' 为知州', c => true, cid => { GAME.assignGovernor(id, cid); guide('gov'); toast(`${g.name}出知${GAME.city(cid).name}`); });
      if (k === 'recruit') { const r = GAME.recruitCaptive(id, P()); toast(r ? `${g.name}感恩归降！` : `${g.name}不屈，拒降。`); showGenerals(); }
      if (k === 'release') { GAME.releaseCaptive(id); toast(`释放${g.name}，敌国感念`); showGenerals(); }
      if (k === 'exec') { GAME.executeCaptive(id); toast(`斩${g.name}于市`); showGenerals(); }
      refreshTop();
    };
  }
  function pickCity(title, filter, cb) {
    const list = GAME.citiesOf(P()).filter(filter).sort((a, b) => b.pop - a.pop);
    let h = `<h1>${title}</h1><div class="scroll" style="max-height:60vh"><table class="t"><tr><th>城</th><th>户口</th><th>民心</th><th>现任知州</th><th></th></tr>`;
    for (const c of list) { const g = GAME.gen(c.governor); h += `<tr><td><b>${c.name}</b></td><td>${c.pop}</td><td>${Math.round(c.loyalty)}</td><td>${g ? g.name + '（政' + g.zheng + '）' : '—'}</td><td><button class="btn sm red" data-pc="${c.id}">选</button></td></tr>`; }
    h += `</table></div>`;
    openModal(h, { width: '600px', onClose: () => {} });
    $('modal').onclick = e => { const b = e.target.closest('[data-pc]'); if (!b) return; $('modal').onclick = null; closeModal(); cb(+b.dataset.pc); refreshSide(); };
  }

  function showDiplomacy() {
    const me = GAME.fac(P());
    const list = Object.keys(me.met).filter(f => GAME.fac(f) && GAME.fac(f).alive && f !== 'rebel');
    const myPow = GAME.totalPower(P());
    list.sort((a, b) => (GAME.atWar(P(), b) - GAME.atWar(P(), a)) || (GAME.totalPower(b) - GAME.totalPower(a)));
    let h = `<h1>鸿胪寺</h1><div class="scroll" style="max-height:72vh"><table class="t"><tr><th></th><th>国</th><th>城</th><th>国力</th><th>好感</th><th>关系</th><th>岁币</th><th>操作</th></tr>`;
    for (const f of list) {
      const r = GAME.getRel(P(), f), pw = GAME.totalPower(f);
      const ratio = pw / (myPow + 1);
      const trib = r.trib ? (r.trib.from === P() ? `<span class=neg>纳 ${r.trib.amt}</span>` : `<span class=pos>收 ${r.trib.amt}</span>`) + `·${Math.ceil(r.trib.turns)}季` : '';
      h += `<tr><td>${facSeal(f)}</td><td><b>${facName(f)}</b></td><td>${GAME.citiesOf(f).length}</td><td>${ratio > 1.5 ? '<span class=neg>远胜我</span>' : ratio > 1 ? '略胜我' : ratio > 0.5 ? '略逊' : '<span class=pos>弱小</span>'}</td><td>${Math.round(r.op)}</td><td>${relText(f)}</td><td>${trib}</td><td>
        <button class="btn sm" data-d="envoy" data-f="${f}">遣使(${GAME.envoyCost(P())})</button>
        ${r.war ? `<button class="btn sm red" data-d="peace" data-f="${f}">议和</button>` : `<button class="btn sm" data-d="war" data-f="${f}" ${r.truce > 0 ? 'title="和约未满，背约将失信于天下"' : ''}>宣战</button> ${r.ally ? '' : `<button class="btn sm" data-d="ally" data-f="${f}">结盟</button>`} <button class="btn sm" data-d="trib" data-f="${f}">索贡</button>`}
      </td></tr>`;
    }
    h += `</table><p class="note">交战诸国之外，凡已结识者皆在此列。好感随遣使、通商而升，随战事而降。和约期内宣战，天下诸国好感大降。</p></div>`;
    openModal(h, { width: '960px' });
    $('modal').onclick = e => {
      const b = e.target.closest('[data-d]'); if (!b) return;
      const f = b.dataset.f, k = b.dataset.d;
      let res;
      if (k === 'envoy') res = GAME.sendEnvoy(P(), f);
      if (k === 'war') {
        const r = GAME.getRel(P(), f);
        courtVote('war', f, () => {
          if (r.truce > 0) for (const x in S().factions) if (x !== P() && x !== 'rebel') GAME.getRel(P(), x).op -= 15;
          GAME.declareWar(P(), f); RENDER.buildPolitical(); refreshTop(); showDiplomacy();
        }, r.truce > 0 ? '（背弃和约，诸国好感 −15）' : '');
        return;
      }
      if (k === 'peace' && !b.dataset.voted) {
        courtVote('peace', f, () => { const bb = document.createElement('i'); bb.dataset.d = 'peace'; bb.dataset.f = f; bb.dataset.voted = 1; showDiplomacy(); setTimeout(() => $('modal').onclick({ target: { closest: () => bb } }), 0); });
        return;
      }
      if (k === 'peace') {
        res = GAME.proposePeace(P(), f);
        if (!res.ok && res.counter) {
          const amt = res.counter;
          confirmBox(`${res.msg}　允否？`, () => { const r2 = GAME.proposePeace(P(), f, amt); toast(r2.msg); refreshTop(); showDiplomacy(); });
          return;
        }
      }
      if (k === 'ally') res = GAME.proposeAlliance(P(), f);
      if (k === 'trib') res = GAME.demandTribute(P(), f);
      if (res) toast(res.msg);
      refreshTop(); showDiplomacy();
    };
  }
  // ---------- 廷议 ----------
  function courtVote(motion, f, onPass, extra) {
    const res = COURT.vote(motion);
    const lean = S().court.lean;
    if (res.pass && ((motion === 'war' && lean > 40) || (motion === 'peace' && lean < -40))) { COURT.applyVote(res, false); toast('群臣附议，准奏施行'); refreshTop(); onPass(); return; }
    const list = arr => arr.map(([g, w]) => `<span class="vm" title="${COURT.STANCE_NAME[g.stance]} · 忠诚 ${Math.round(g.loyalty)}">${PORTRAIT.img(g, 26)}${g.name}${w > 1 ? '<sup>' + w + '</sup>' : ''}</span>`).join('') || '<span class="note">无</span>';
    const tot = res.sw + res.ow || 1;
    const subj = motion === 'war' ? `向【${facName(f)}】宣战` : `与【${facName(f)}】议和`;
    let h = `<h1>廷　议</h1><div class="story" style="text-align:center;padding-bottom:4px">议题：<b>${subj}</b>${extra ? '<br><span class="note">' + extra + '</span>' : ''}</div>
      <div class="vote-bar"><i style="width:${res.sw / tot * 100}%"></i></div>
      <div style="display:flex;justify-content:space-between;font-size:14px;margin:2px 0 10px"><span class="pos">赞成 ${res.sw}</span><span>${res.emp.title}意在${res.empSide === 'war' ? '主战' : '主和'}（${res.ew} 票）</span><span class="neg">反对 ${res.ow}</span></div>
      <div class="sec">赞成</div><div class="vlist">${list(res.sup)}</div>
      <div class="sec">反对</div><div class="vlist">${list(res.opp)}</div>
      ${res.abs.length ? `<div class="sec">缄默</div><div class="vlist">${list(res.abs)}</div>` : ''}
      <p class="note">宰相等朝臣三票，知州与统兵将领各一票。立场相合者赞成，中立者视忠诚与皇权而定。</p><div class="choices">`;
    if (res.pass) h += `<button class="choice" data-v="pass">群臣附议，准奏施行<small>权威 +2</small></button>`;
    else h += `<button class="choice" data-v="force">乾纲独断，执意施行<small>权威 −12，反对者忠诚 −8</small></button>`;
    h += `<button class="choice" data-v="no">${res.pass ? '暂且作罢' : '从众作罢'}</button></div>`;
    openModal(h, { width: '720px', onClose: () => {} });
    $('modal').onclick = e => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      $('modal').onclick = null;
      const v = b.dataset.v;
      closeModal();
      if (v === 'no') return;
      COURT.applyVote(res, v === 'force');
      refreshTop();
      onPass();
    };
  }
  function showCourt() {
    const C = S().court, emp = COURT.emperor();
    const fake = { id: 900000 + (C.emp || 0), name: emp.name, f: P(), birth: emp.birth, tong: 40, wu: 30, zhi: 70, zheng: 75, cul: 'han' };
    const mem = COURT.members().map(x => x[0]);
    const cnt = k => mem.filter(g => g.stance === k).length;
    let h = `<h1>朝　堂</h1><div class="scroll" style="max-height:74vh">
      <div class="court-top"><div style="text-align:center">${PORTRAIT.img(fake, 80)}<div><b style="font-size:18px">${emp.title}</b></div><div class="note">${emp.name} · ${S().year - emp.birth}岁<br>${emp.note}</div></div>
      <div style="flex:1">
        <div class="row"><span style="width:76px">皇帝权威</span><div class="grow">${meter(C.auth, 100, 'gold')}</div><b>${Math.round(C.auth)}</b></div>
        <div class="row"><span style="width:76px">朝议倾向</span><div class="grow"><div class="lean big"><i style="left:${(C.lean + 100) / 2}%"></i></div><div style="display:flex;justify-content:space-between;font-size:12px"><span class="pos">主和</span><span class="neg">主战</span></div></div><b>${Math.round(C.lean)}</b></div>
        <p class="note">权威决定民心与群臣忠诚，胜仗与克城可增，败绩与独断则减。朝议倾向受帝意、朝臣立场与战局影响：与之相背而宣战或议和，须经廷议。</p>
        <div class="chips"><span class="chip red">主战 ${cnt('war')}</span><span class="chip">中立 ${cnt('mid')}</span><span class="chip" style="color:var(--green);border-color:var(--green)">主和 ${cnt('peace')}</span></div>
      </div></div>
      <div class="sec">百官</div><table class="t"><tr><th>官职</th><th>职掌</th><th>现任</th><th>立场</th><th>忠诚</th><th>效果</th><th></th></tr>`;
    for (const o of COURT.OFFICES) {
      const g = COURT.holder(o.id);
      h += `<tr><td><b>${o.name}</b></td><td class="note">${o.desc}</td><td>${g ? PORTRAIT.img(g, 28) + ' ' + g.name + `（${GAME.STAT_NAME[o.stat]}${g[o.stat]}）` : '<span class="note">空缺</span>'}</td><td>${g ? stanceTag(g) : ''}</td><td>${g ? Math.round(g.loyalty) : ''}</td><td>${g ? '+' + Math.round(COURT.bonus(o.id) * 100) + '%' : ''}</td>
        <td><button class="btn sm red" data-o="set" data-k="${o.id}">${g ? '改任' : '任命'}</button>${g ? ` <button class="btn sm" data-o="off" data-k="${o.id}">罢免</button>` : ''}</td></tr>`;
    }
    h += `</table><div class="sec">近日朝堂</div><div class="loglist">${S().log.filter(e => /罢|独断|相位|叛|挂冠|即皇帝位|登第/.test(e.text)).slice(-6).reverse().map(e => `<div><span class="d">${e.d}</span>${esc(e.text)}</div>`).join('') || '<div class="note">无事</div>'}</div></div>`;
    openModal(h, { width: '980px' });
    $('modal').onclick = e => {
      const b = e.target.closest('[data-o]'); if (!b) return;
      const k = b.dataset.k, O = COURT.OFFICES.find(o => o.id === k);
      if (b.dataset.o === 'off') { const g = COURT.holder(k); COURT.vacate(k); if (g) g.loyalty -= 10; showCourt(); refreshTop(); return; }
      pickGeneral('任' + O.name + '（看' + GAME.STAT_NAME[O.stat] + '）', g => true, g => g[O.stat], gid => { if (gid != null) { COURT.assign(k, gid); guide('office'); } setTimeout(showCourt, 20); });
    };
  }
  function showSettings() {
    const opt = (k, v, label) => `<button class="btn sm ${SET[k] === v ? 'red' : ''}" data-set="${k}" data-v="${v}">${label}</button>`;
    const row = (name, inner) => `<div class="row"><span style="width:110px">${name}</span><span class="grow" style="display:flex;gap:5px;flex-wrap:wrap">${inner}</span></div>`;
    const h = `<h1>设　置</h1><div class="settings-body">
      ${row('回合动画', [0, 1, 2].map(v => `<button class="btn sm ${animSpeed === v ? 'red' : ''}" data-anim="${v}">${['关闭', '常速', '快速'][v]}</button>`).join(''))}
      ${row('敌军来犯', opt('defend', 'all', '逐战过问') + opt('defend', 'city', '仅守城时过问') + opt('defend', 'off', '皆交守将'))}
      ${row('敌方回合镜头', opt('follow', true, '跟随') + opt('follow', false, '不跟随'))}
      ${row('自动存档', opt('autosave', 'turn', '每回合') + opt('autosave', 'season', '每季') + opt('autosave', 'off', '关闭'))}
      ${row('界面字号', opt('ui', 0.9, '小') + opt('ui', 1, '中') + opt('ui', 1.15, '大') + opt('ui', 1.3, '特大'))}
      ${row('地图显示', opt('showRes', !SET.showRes, SET.showRes ? '隐藏物产' : '显示物产') + opt('showSites', !SET.showSites, SET.showSites ? '隐藏奇遇点' : '显示奇遇点') + opt('showNames', !SET.showNames, SET.showNames ? '隐藏国名' : '显示国名'))}
      ${row('新手引导', `<button class="btn sm" data-guide="1">${S() && S().guide && S().guide.off ? '重新显示' : '隐藏'}</button>`)}
      <p class="note">设置保存在本浏览器中。</p>
      <section class="settings-about" aria-labelledby="about-title">
        <h2 id="about-title" class="sec">关于</h2>
        <p><strong>还我河山</strong> <span class="note">v${VERSION}</span></p>
        <p class="note">大宋征服天下</p>
        <div class="row"><span>制作人</span><strong>大老师</strong></div>
        <div class="row"><span>微信</span><strong id="about-wechat">lynchrrr</strong>
          <button type="button" class="btn sm" data-copy-wechat>复制</button></div>
        <p class="note">试玩中，欢迎加微信反馈问题与建议。</p>
      </section></div>`;
    openModal(h, { width: '620px' });
    $('modal').onclick = async e => {
      if (e.target.closest('[data-copy-wechat]')) {
        const wechat = $('about-wechat');
        try {
          await navigator.clipboard.writeText(wechat.textContent);
          toast('已复制微信号');
        } catch (error) {
          if (!wechat.isConnected) return;
          const range = document.createRange();
          range.selectNodeContents(wechat);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          toast('已选中微信号，请手动复制');
        }
        return;
      }
      const a = e.target.closest('[data-anim]');
      if (a) { animSpeed = +a.dataset.anim; localStorage.setItem('hwhs_anim', animSpeed); showSettings(); return; }
      const g = e.target.closest('[data-guide]');
      if (g && S()) { S().guide = S().guide || {}; S().guide.off = !S().guide.off; refreshSide(); showSettings(); return; }
      const b = e.target.closest('[data-set]'); if (!b) return;
      const k = b.dataset.set; let v = b.dataset.v;
      v = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v;
      SET[k] = v; applySettings();
      if (k === 'showNames' && S()) RENDER.buildPolitical();
      RENDER.markDirty(); showSettings();
    };
  }
  // ---------- 新手引导 ----------
  const GUIDE = [['research', '在“科技”中选定研究方向'], ['build', '在城池“内政”页营建一座建筑'], ['recruit', '在城池“军务”页征募一营兵'], ['form', '点选守军，择将组建军团'],
    ['move', '选中军队，点目标格两次出发'], ['battle', '打赢一场战斗'], ['gov', '任命一位知州'], ['office', '在“朝堂”任命一位朝臣'], ['reward', '在“将领”中赏赐一位将领'], ['turns', '结束三个回合']];
  function guide(k) { const s = S(); if (!s) return; s.guide = s.guide || {}; if (k === 'turns') { s.guide.nT = (s.guide.nT || 0) + 1; if (s.guide.nT < 3) return; } if (!s.guide[k]) { s.guide[k] = 1; if (!s.guide.off) toast('✓ ' + GUIDE.find(x => x[0] === k)[1]); } }
  function guideHTML() {
    const g = S().guide || {};
    if (g.off) return '';
    const done = GUIDE.filter(x => g[x[0]]).length;
    if (done === GUIDE.length) return '';
    return `<div class="sec">初政指引 <span class="r cost">${done}/${GUIDE.length}　<a data-act="guideoff" style="cursor:pointer">收起</a></span></div>` +
      GUIDE.map(([k, t]) => `<div class="row" style="padding:2px 4px">${g[k] ? '<span class="pos">✓</span>' : '<span class="note">○</span>'}<span class="${g[k] ? 'note' : ''}">${t}</span></div>`).join('');
  }
  function showCities() {
    const cs = GAME.citiesOf(P()).sort((a, b) => b.pop - a.pop);
    let h = `<h1>州府一览</h1><div class="scroll" style="max-height:72vh"><table class="t"><tr><th>城</th><th>户口</th><th>民心</th><th>粮</th><th>工</th><th>钱</th><th>文</th><th>守军</th><th>营造</th><th>知州</th></tr>`;
    for (const c of cs) {
      const y = GAME.cityYield(c), q = c.queue[0], g = GAME.gen(c.governor);
      h += `<tr class="click" data-act="goto" data-arg="c:${c.id}" style="cursor:pointer"><td><b>${c.name}</b>${c.cap ? ' ★' : ''}</td><td>${c.pop}</td><td class="${c.loyalty < 30 ? 'neg' : ''}">${Math.round(c.loyalty)}</td><td>${sgn(y.food - y.foodNeed)}</td><td>${y.prod}</td><td>${y.gold}</td><td>${y.sci}</td><td>${c.garrison.length}</td><td>${q ? (q.kind === 'b' ? B[q.id].name : unitName(P(), q.id)) : '<span class=neg>空闲</span>'}</td><td>${g ? g.name : ''}</td></tr>`;
    }
    h += `</table></div>`;
    openModal(h, { width: '900px' });
  }
  function showArmies() {
    const as = S().armies.filter(a => a.f === P());
    let h = `<h1>诸军</h1><div class="scroll" style="max-height:72vh"><table class="t"><tr><th>军</th><th>主将</th><th>营</th><th>兵力</th><th>士气</th><th>位置</th><th>状态</th></tr>`;
    for (const a of as) {
      const c = GAME.cityAt(a.tile), own = GAME.tileOwner(a.tile);
      h += `<tr data-act="goto" data-arg="a:${a.id}" style="cursor:pointer"><td><b>${esc(GAME.armyName(a))}</b></td><td>${a.gen != null ? GAME.gen(a.gen).name : '—'}</td><td>${a.units.length}</td><td>${fmt(GAME.sumStr(a.units))}</td><td>${Math.round(a.morale)}</td><td>${c ? c.name : (own ? facName(own) + '境内' : '荒野')}</td><td>${a.path && a.path.length ? '行军中' : a.sentry ? '驻守' : a.mp > 0 ? '<span class=pos>待命</span>' : '已动'}</td></tr>`;
    }
    h += `</table></div>`;
    openModal(h, { width: '760px' });
  }
  function logRow(e) { return `<div class="${e.type}" ${e.tile != null ? `data-act="gototile" data-arg="${e.tile}" style="cursor:pointer"` : ''}><span class="d">${e.d}</span>${esc(e.text)}${e.tile != null ? ' ◎' : ''}</div>`; }
  // 史册：「大事」为逐条记事；「本纪」由 EVENTS.annals() 提供（若有）
  function showChronicle(tab) {
    let annals = '';
    if (typeof EVENTS !== 'undefined' && EVENTS.annals) { try { annals = EVENTS.annals() || ''; } catch (e) { console.error(e); } }
    tab = annals ? (tab || 'annals') : 'log';
    const tabs = annals ? `<div class="tabs"><button class="${tab === 'annals' ? 'on' : ''}" data-act="chron" data-arg="annals">本纪</button><button class="${tab === 'log' ? 'on' : ''}" data-act="chron" data-arg="log">大事</button></div>` : '';
    const L = S().log.slice().reverse();
    const body = tab === 'annals' ? `<div class="scroll annals" style="max-height:70vh">${annals}</div>`
      : `<div class="scroll loglist" style="max-height:70vh">${L.map(logRow).join('')}</div><p class="note">带 ◎ 者可点击前往其地。</p>`;
    openModal(`<h1>史册</h1>${tabs}${body}`, { width: '720px' });
  }

  // ---------- 存档 ----------
  function slotMeta(k) {
    try { const m = localStorage.getItem(SAVE_PREFIX + k + '_meta'); return m ? JSON.parse(m) : null; } catch (e) { return null; }
  }
  // 存档压缩：gzip + base64（浏览器不支持时退回明文）
  function b64(buf) { const u8 = new Uint8Array(buf); let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); }
  function unb64(str) { const bin = atob(str); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; }
  async function packSave(str) {
    if (typeof CompressionStream === 'undefined') return str;
    const buf = await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
    return 'GZ1:' + b64(buf);
  }
  async function unpackSave(str) {
    if (!str || !str.startsWith('GZ1:')) return str;
    return await new Response(new Blob([unb64(str.slice(4))]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }
  let saving = false;
  async function saveSlot(k, quiet) {
    if (saving && quiet) return false;
    saving = true;
    try {
      const data = await packSave(GAME.serialize());
      const meta = JSON.stringify({ date: GAME.dateStr(), year: S().year, turn: S().turn, cities: GAME.citiesOf(P()).length, at: new Date().toLocaleString('zh-CN'), kb: Math.round(data.length / 1024) });
      try { localStorage.setItem(SAVE_PREFIX + k, data); }
      catch (e) { localStorage.removeItem(SAVE_PREFIX + k); localStorage.setItem(SAVE_PREFIX + k, data); }
      localStorage.setItem(SAVE_PREFIX + k + '_meta', meta);
      if (!quiet) toast('已存档');
      return true;
    } catch (e) {
      if (!quiet) alert('浏览器存储空间不足，请删除部分存档栏，或改用“导出存档文件”。');
      else toast('自动存档失败：浏览器存储已满，请清理存档栏或导出存档', 'war');
      return false;
    } finally { saving = false; }
  }
  async function loadSlot(k) {
    const raw = localStorage.getItem(SAVE_PREFIX + k);
    if (!raw) { toast('此栏无存档'); return; }
    let d;
    try { d = await unpackSave(raw); } catch (e) { alert('存档损坏：' + e.message); return; }
    withLoading('展读旧卷……', () => { closeModalQuiet(); GAME.deserialize(d); ensureBase(); enterGame(); select(null); centerCapital(); toast('读档完成：' + GAME.dateStr()); processPending(); });
  }
  function closeModalQuiet() { $('modal-bg').classList.add('hidden'); modalOnClose = null; modalLocked = false; }
  function exportSave() {
    const data = GAME.serialize();
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `还我河山_${S().year}_${GAME.dateStr()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function showSave(fromTitle) {
    const slots = ['auto', '1', '2', '3', '4', '5'];
    let h = `<h1>${fromTitle ? '读取存档' : '存档'}</h1><div class="scroll" style="max-height:65vh;min-width:520px">`;
    for (const k of slots) {
      const m = slotMeta(k);
      h += `<div class="slot"><span class="seal sm" style="background:${k === 'auto' ? '#555' : 'var(--red)'}">${k === 'auto' ? '自' : k}</span><div style="flex:1">${m ? `<b>${m.date}</b>（${m.year}）　州府 ${m.cities}<br><span class="note">${m.at}${m.kb ? '　' + m.kb + ' KB' : ''}</span>` : '<span class="note">空</span>'}</div>
        ${!fromTitle && k !== 'auto' ? `<button class="btn sm red" data-s="save" data-k="${k}">存入</button>` : ''}${m ? `<button class="btn sm" data-s="load" data-k="${k}">读取</button> <button class="btn sm" data-s="del" data-k="${k}">删</button>` : ''}</div>`;
    }
    h += `</div><div class="btns" style="justify-content:center;margin-top:12px">${fromTitle ? '' : '<button class="btn red" data-s="export">导出存档文件</button>'}<button class="btn" data-s="import">导入存档文件</button>${fromTitle ? '' : '<button class="btn" data-s="title">返回标题</button>'}</div>
      <p class="note" style="text-align:center">每季自动存于“自”栏。浏览器缓存可能被清理，长期经营建议定期导出存档文件。</p>`;
    openModal(h, { width: '640px' });
    $('modal').onclick = e => {
      const b = e.target.closest('[data-s]'); if (!b) return;
      const k = b.dataset.k, s = b.dataset.s;
      if (s === 'save') { saveSlot(k).then(() => showSave(fromTitle)); }
      if (s === 'load') loadSlot(k);
      if (s === 'del') { localStorage.removeItem(SAVE_PREFIX + k); localStorage.removeItem(SAVE_PREFIX + k + '_meta'); showSave(fromTitle); }
      if (s === 'export') exportSave();
      if (s === 'import') $('importfile').click();
      if (s === 'title') { closeModalQuiet(); for (const id of ['top', 'side', 'endturn', 'minimap', 'tip', 'mobilebar']) $(id).classList.add('hidden'); titleScreen(); }
    };
  }
  function showHelp() {
    openModal(`<h1>玩法说明</h1><div class="scroll help" style="max-height:72vh;max-width:760px">
      <h3>大势</h3><p>绍兴十年（1140）七月，岳飞郾城大捷。你执掌南宋，经营江南，北伐中原，进而西出玉门、南下天竺、远征大食与拂菻。<b>攻占诸国原都城</b>即为一统天下。开局可选每回合推进一周、一旬、一月或一季；城池产出以“每季”计，按回合折算。</p>
      <h3>回合动画</h3><p>结束回合后，视野内的行军、交战会依次演示：兵锋推进、刀兵相交、伤亡跳字与胜负印章。点击地图或按空格可跳过；顶栏“动画”按钮可切换常速/快速/关闭。</p>
      ${TOUCH.matches ? '<h3>手机操作</h3><ul><li>单指拖动平移，双指捏合缩放，轻点选取城池或军队。</li><li>选中我军后，底部出现<b>军令条</b>：轻点地图上的目的地，军令条显示路程与胜算，点<b>「出发」</b>（或再点一次该格）即行军；点「取消」重选。</li><li>「详情」可展开军团或城池的全部信息；右下「下一周」结束回合。</li></ul>' : ''}
      <h3>${TOUCH.matches ? '键盘鼠标操作' : '操作'}</h3><ul><li>左键选城池/军队；拖动平移地图；滚轮缩放；点小地图跳转。</li><li>选中军队后<b>右键</b>目标格即行军，目标为交战之敌则发起进攻；或按 <kbd>M</kbd> 后左键。远途会自动分季行进。</li>
      <li>选中军队后<b>左键点目标格</b>先显示路线与抵达时间，<b>再点一次</b>即出发（右键可直接出发）。远途路线会保留，下回合按 <kbd>C</kbd> 或点“继续行军”接着走，<kbd>Shift+C</kbd>／“全军继续”令所有有路线的军团一齐前进。</li>
      <li><kbd>Enter</kbd> 下一回合，<kbd>Tab</kbd> 下一支待命军，<kbd>空格</kbd> 令其驻守，<kbd>Esc</kbd> 取消。</li></ul>
      <h3>内政</h3><ul><li>城池按户口耕作周边地块，产出粮、工、钱、文。余粮使户口增长；工用于营建与征兵；钱用于军饷、加急；文推动科技。</li>
      <li>民心低于 25 易生民变。寺观、常平仓、知州、奢侈物产（茶丝瓷香料）可安民；战事日久则厌战。</li>
      <li>委任<b>政</b>高之臣为知州，可大增一城产出。</li></ul>
      <h3>军事</h3><ul><li>在城中“军务”页征兵，募成后为守军；点选守军并择将即可<b>组建军团</b>。主将<b>统</b>越高，可统营数越多（最多十营）。</li>
      <li>兵种相克：步卒克骑，弓弩克步，骑兵克弓与砲车。甲骑、背嵬军、火器营为强兵。攻城宜带砲车，城防降至三成以下且守军尽没方可破城。</li>
      <li>战力取决于兵力、相克、主将统武智、特技、地形（山地守 +50%、丘陵 +25%、临河 +15%）与士气。</li>
      <li>舟师足够（每三营陆军配一营舟师）的军团可渡海。军队离境过远、粮尽或国库亏空会减员。</li></ul>
      <h3>科举与将领</h3><ul><li>每三年春殿试放榜，可从候选中择优录用；史上名臣（朱熹、虞允文、陆游、范成大……）会在其登第之年出现。</li>
      <li>武将多会在其出仕之年“慕义来投”。战败的敌将可能被俘，可招降、释放或处斩。</li></ul>
      <h3>战前军议与临阵指挥</h3><ul><li>我军进攻时先开<b>战前军议</b>：可见双方将领、兵种、地形与胜算；可择一<b>计策</b>（火攻、夜袭、水淹、诱敌、激将、疑兵），成败取决于双方主将之智与地形时令。</li>
      <li>随后选“自动决战”即刻分晓，或“临阵指挥”于六角战场亲自调度：每营每回合可移动后攻击一次，弓弩火器砲车可远射；丘陵林地利守，城墙大利守军，砲车专破城墙；包夹敌营可增伤。十回合内击溃敌军（兵力不足三成或士气崩溃）即胜。</li>
      <li><b>敌军来犯</b>：敌方回合结束后，凡敌军攻我城池或军团，逐一请示方略：可施守策（劫营、火攻、坚壁、疑兵），再选“亲自守城/迎战”或“交由守将”。亲自守御时敌军先攻，守满十回合即算守住。可在“设置”中改为仅守城时过问或全部交由守将。</li></ul>
      <h3>奇遇与将领成长</h3><ul><li>地图上的菱形标记为奇遇点：古战场（经验）、名山古刹（士气兵员）、隐士草庐（特技）、遗迹（宝物）、义军营寨（兵员）、牧马场、商队、屯粮所、藏书楼。带兵经过即可触发。</li>
      <li>将领作战与奇遇可得经验，升级时三选一：提升能力或习得新特技（至多三项）。宝物每人至多三件，直接提升能力或行军。</li></ul>
      <h3>朝堂</h3><ul><li>“朝堂”中可任命宰相、枢密使、三司使、翰林学士、御史中丞、殿前都指挥使，各按其能力提供全国加成。</li>
      <li>群臣分主战、主和、中立。宣战与议和须经<b>廷议</b>：附议者多则准奏；否则可乾纲独断，但损权威、失人心。</li>
      <li>皇帝权威影响民心与忠诚；将领忠诚过低会挂冠而去，甚至率部叛逃。可赏赐、任以要职，或设御史中丞纠察百官。皇帝会按史实更替，新君性情各异。</li></ul>
      <h3>海贸</h3><ul><li>临海之城建<b>市舶司</b>后可开辟航线，与同一海域、已结识且未交战的外国港口通商。路途越远、对方越大，获利越丰；研习“远洋”后航线不限远近。</li></ul>
      <h3>用钱之道</h3><ul><li><b>捐资助学</b>（科技面板）：每 5 贯折文教 1，每季最多捐半季文教之数。</li><li><b>赈济</b>（城池·内政）：民心 +15、民变之势 −15，每城一年一次。</li><li><b>移民实边</b>（城池·内政）：户口 +1 万，限十二万以下的非都城，每城两年一次。</li><li><b>犒军</b>（军团）：士气 +30、主将经验 +15，每军两季一次。</li><li>电脑诸国库银充裕时也会如此用钱。</li></ul>
      <h3>外交</h3><ul><li>鸿胪寺中可遣使修好、宣战、议和、结盟、索贡。电脑诸国亦会彼此征伐，天下大势随史而动：十字军东征、萨拉丁崛起、成吉思汗称汗……</li></ul>
      <h3>存档</h3><p>每季自动存档；可手动存于五栏，并可导出为文件长期保存。</p></div>`, { width: '820px' });
  }

  // ---------- 事件 ----------
  function processPending() {
    if (!S() || !$('modal-bg').classList.contains('hidden')) return;
    if (battleQueue.length) { flushBattles(true); return; }
    const p = S().pending.shift();
    if (!p) { refreshTop(); refreshSide(); return; }
    if (p.ev === 'peaceoffer' && !GAME.atWar(P(), p.from)) return processPending();
    showEvent(p);
  }
  function showEvent(p) {
    const v = EVENTS.view(p);
    if (v.type === 'pick') {
      const chosen = new Set();
      const render = () => {
        let h = `<h1>${v.title}</h1><div class="story">${esc(v.text)}</div><div style="text-align:center">`;
        for (const id of v.options) {
          const g = GAME.gen(id);
          const civ = g.zheng >= g.wu;
          h += `<div class="cand ${chosen.has(id) ? 'on' : ''}" data-c="${id}">${PORTRAIT.img(g, 56, 'style="float:right;width:56px;height:56px"')}<b>${g.name}</b>${g.hist ? ' <span class="chip red">史</span>' : ''}<br><span class="note">${civ ? '进士' : '武举'}　${S().year - g.birth}岁</span><br>统 ${g.tong}　武 ${g.wu}<br>智 ${g.zhi}　政 ${g.zheng}<br>${g.skill ? `<span class="skill">【${g.skill}】</span>` : '&nbsp;'}</div>`;
        }
        h += `</div><div class="choices" style="margin-top:10px"><button class="choice" id="kj">钦点 ${chosen.size}/${v.max} 人，放榜</button></div>`;
        openModal(h, { lock: true, width: '760px' });
        $('modal').onclick = e => {
          const c = e.target.closest('[data-c]');
          if (c) { const id = +c.dataset.c; if (chosen.has(id)) chosen.delete(id); else if (chosen.size < v.max) chosen.add(id); render(); return; }
          if (e.target.closest('#kj')) { $('modal').onclick = null; EVENTS.resolve(p, [...chosen]); closeModal(); refreshSide(); }
        };
      };
      render();
      return;
    }
    const pg = v.gen != null ? GAME.gen(v.gen) : null;
    let h = `<h1>${esc(v.title)}</h1>${pg ? `<div style="text-align:center">${PORTRAIT.img(pg, 84)}</div>` : ''}<div class="story">${esc(v.text)}</div><div class="choices">`;
    v.choices.forEach((c, i) => { h += `<button class="choice" data-ch="${i}">${esc(c.t)}${c.d ? `<small>${esc(c.d)}</small>` : ''}</button>`; });
    h += `</div>`;
    openModal(h, { lock: true, width: '700px' });
    $('modal').onclick = e => {
      const b = e.target.closest('[data-ch]'); if (!b) return;
      $('modal').onclick = null;
      EVENTS.resolve(p, +b.dataset.ch);
      closeModal();
      RENDER.buildPolitical(); RENDER.buildFog(); refreshSide(); refreshTop();
    };
  }
  function myResult(r) {
    if (r.att === P()) return r.result;
    if (!r.win && !/城破/.test(r.result)) return r.city ? '守住城池' : '击退来犯';
    const map = { '敌军败退': '我军败退', '敌军溃散': '我军溃散', '守军全军覆没': '我军覆没', '攻城小胜': '城防受损', '城破': '城池陷落', '守军尽没，城墙尚坚': '守军尽没，城墙尚在', '获胜': '我军失利' };
    return map[r.result] || r.result;
  }
  function battleRow(r) {
    const mine = r.att === P();
    const win = mine ? r.win : !r.win;
    return `<tr><td>${facSeal(r.att)} ${esc(r.attName)}</td><td>${fmt(r.before.a)} → ${fmt(r.after.a)}</td><td>攻</td><td>${facSeal(r.def)} ${esc(r.defName)}${r.city ? '（' + r.city + '）' : ''}</td><td>${fmt(r.before.d)} → ${fmt(r.after.d)}</td><td class="${win ? 'pos' : 'neg'}"><b>${esc(myResult(r))}</b>${r.captured ? '<br>' + esc(r.captured) : ''}</td></tr>`;
  }
  function flushBattles(chain) {
    if (!battleQueue.length) { if (chain) processPending(); return; }
    const list = battleQueue; battleQueue = [];
    if (list.length === 1 && (list[0].att === P() || list[0].manual || list[0].plan)) {
      const r = list[0];
      const ga = GAME.gen(r.attGen), gd = GAME.gen(r.defGen);
      const win = r.att === P() ? r.win : !r.win;
      openModal(`<h1>${r.att === P() ? '战报' : '守御战报'}</h1><div class="battle">
        <div class="side">${ga ? PORTRAIT.img(ga, 72) : facSeal(r.att, '')}<h3>${esc(r.attName)}</h3>${ga ? ga.name + '　统' + ga.tong + ' 武' + ga.wu : '无主将'}<br>兵 ${fmt(r.before.a)} → <b>${fmt(r.after.a)}</b></div>
        <div class="vs">战</div>
        <div class="side">${gd ? PORTRAIT.img(gd, 72) : facSeal(r.def, '')}<h3>${esc(r.defName)}</h3>${gd ? gd.name + '　统' + gd.tong + ' 智' + gd.zhi : '无主将'}<br>兵 ${fmt(r.before.d)} → <b>${fmt(r.after.d)}</b>${r.city ? `<br>城防 ${Math.round(r.before.wall)} → ${Math.round(r.after.wall)}` : ''}</div></div>
        <div class="bres ${win ? 'win' : 'lose'}">${win ? '捷' : '挫'}　${esc(myResult(r))}</div>${r.plan ? `<p class="note" style="text-align:center">${esc(r.plan)}</p>` : ''}${r.captured ? `<p style="text-align:center">${esc(r.captured)}</p>` : ''}
        <div class="choices"><button class="choice" data-act="mclose" style="text-align:center">知道了</button></div>`, { width: '640px', onClose: () => { RENDER.buildPolitical(); refreshSide(); setTimeout(processPending, 10); } });
      RENDER.flash(r.tile);
      return;
    }
    openModal(`<h1>本${TU()}战报</h1><div class="scroll" style="max-height:65vh"><table class="t"><tr><th>攻方</th><th>兵力</th><th></th><th>守方</th><th>兵力</th><th>结果</th></tr>${list.map(battleRow).join('')}</table></div>`, { width: '900px', onClose: () => setTimeout(processPending, 10) });
  }

  // ---------- 回合 ----------
  function endTurn() {
    if (inTurn || !S() || !$('modal-bg').classList.contains('hidden')) return;
    if (S().defeat) { toast('社稷已倾'); return; }
    if (RENDER.isAnimating()) return;
    inTurn = true; $('endbtn').classList.add('busy'); $('endbtn').querySelector('span').textContent = '运筹中';
    setTimeout(() => {
      let snap = null;
      try {
        GAME.takeAnim();
        snap = RENDER.snapshot();
        GAME.endTurn();
        for (const a of S().armies) if (a.f === P() && a.sentry && GAME.armyAt(a.tile) === a) { /* keep sentry */ }
        RENDER.buildPolitical(); RENDER.buildFog();
        if (SET.autosave === 'turn' || (SET.autosave === 'season' && S().newSeason)) saveSlot('auto', true);
        guide('turns');
      } catch (e) { console.error(e); toast('结算出错：' + e.message, 'war'); }
      const evs = GAME.takeAnim();
      inTurn = false; $('endbtn').querySelector('span').textContent = '下一' + TU();
      const done = () => {
        $('endbtn').classList.remove('busy');
        RENDER.buildPolitical(); RENDER.buildFog();
        if (sel && sel.type === 'army' && !GAME.army(sel.id)) select(null);
        if (sel && sel.type === 'army') { const a = GAME.army(sel.id); sel.tile = a.tile; RENDER.state.sel = { tile: a.tile, army: a.id }; }
        showSavedPath(); refreshSide(); refreshTop();
        toast(GAME.dateStr(), 'big');
        runDefenses(() => { flushDeferred(); processPending(); });
      };
      if (snap) RENDER.play(snap, evs, animSpeed, done, SET.follow); else done();
    }, 30);
  }

  // 敌军来犯：逐一询问亲自守御还是交由守将
  function runDefenses(cb) {
    const q = GAME.takeDefenses();
    let skip = false, n = 0;
    const next = () => {
      let d, a = null;
      while (!a && (d = q.shift())) a = GAME.defenseValid(d);
      if (!a) {
        if (n) { RENDER.buildPolitical(); RENDER.buildFog(); if (sel && sel.type === 'army' && !GAME.army(sel.id)) select(null); refreshSide(); refreshTop(); }
        cb(); return;
      }
      n++;
      const fight = opts => {
        GAME.takeAnim();
        const snap = RENDER.snapshot();
        GAME.attack(a, d.tile, opts);
        const evs = GAME.takeAnim();
        RENDER.play(snap, evs, skip ? animSpeed : Math.max(animSpeed, 1), () => { RENDER.buildPolitical(); RENDER.buildFog(); refreshTop(); next(); }, true);
      };
      if (skip) { fight({}); return; }
      RENDER.centerOn(d.tile);
      TACTIC.defend(a, d.tile, opts => { if (opts.skipAll) skip = true; fight(opts.skipAll ? {} : opts); }, q.length);
    };
    next();
  }
  function toast(text, type) {
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = text;
    $('toasts').appendChild(el);
    while ($('toasts').children.length > 5) $('toasts').firstChild.remove();
    setTimeout(() => { el.style.transition = 'opacity .5s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 500); }, type === 'big' ? 2200 : 3800);
  }

  return { boot, select, toast, processPending, engage };
})();
window.addEventListener('load', () => UI.boot());
