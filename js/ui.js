// 界面与交互
var UI = (function () {
  const VERSION = '0.20.0';
  const CREATOR = '大老师', WECHAT = 'lynchrrr';
  const $ = id => document.getElementById(id);
  const U = DATA.UNITS, B = DATA.BUILDINGS, TECH = DATA.TECHS;
  const S = () => GAME.S;
  const P = () => S().player;
  let sel = null; // {type:'city'|'army'|'tile', id, tile}
  let cityTab = 'gov';
  let cityFilter = 'all', citySort = 'pop';
  let pendingTarget = -1;
  let moveMode = false;
  let battleQueue = [], marchEngagements = [], inTurn = false, batchingMarch = false;
  const unitPick = new Set();
  const SAVE_PREFIX = 'hwhs_save_';
  const HALL_KEY = 'hwhs_hall';
  const DIFFICULTY_NAMES = DATA.DIFFICULTY.map(d => d.name);
  const REINFORCEMENT_DIFFICULTY_NOTE = '严苛、地狱之下丁口常不敷补员，宜善用合营与急募。';
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
    document.documentElement.style.setProperty('--panel-zoom', zoom || 1);
    document.documentElement.style.setProperty('--hud-zoom', phone.matches ? 1 : Math.min(1, SET.ui));
    document.documentElement.style.setProperty('--phone-font-scale', SET.ui);
  }
  function applySettings() {
    RENDER.opts.showRes = SET.showRes; RENDER.opts.showSites = SET.showSites; RENDER.opts.showNames = SET.showNames;
    applyUISize();
    try { localStorage.setItem('hwhs_settings', JSON.stringify(SET)); } catch (e) {}
  }
  let deferredToasts = [];
  const TU = () => GAME.unitName();
  const CULTURE_NAME = { han: '中原', jurchen: '女真', tangut: '党项', bai: '白族', tibetan: '吐蕃', khitan: '契丹',
    mongol: '草原蒙古', korean: '高丽', japanese: '日本', viet: '交趾', cham: '占城', khmer: '高棉', burmese: '缅甸',
    turkic: '突厥', persian: '波斯', indian: '天竺', arab: '大食', frankish: '法兰克', greek: '希腊', georgian: '格鲁吉亚',
    rus: '斡罗思', cuman: '钦察', magyar: '马札儿', polish: '波兰', german: '日耳曼', english: '不列颠诸邦',
    iberian: '伊比利亚', moorish: '马格里布', italian: '意大利', norse: '北欧', ethiopian: '埃塞俄比亚与努比亚', filipino: '南洋群岛' };

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => { n = Math.round(n); return n >= 10000 ? (n / 10000).toFixed(1) + '万' : String(n); };
  const fmtShort = n => Math.abs(n) >= 10000 ? (n / 10000).toFixed(1) + '万' : Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + '千' : String(Math.round(n));
  const fmtAmount = n => (n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  const upkeepText = ({ gold, food }) => `钱 ${fmtAmount(gold)} 贯、粮 ${fmtAmount(food)} 石`;
  const sgn = n => (n >= 0 ? '+' : '') + Math.round(n);
  function unitName(f, t) { const c = GAME.fac(f).culture; return (DATA.CULTURE_UNIT_NAME[c] && DATA.CULTURE_UNIT_NAME[c][t]) || U[t].name; }
  function facSeal(f, cls) { const F = GAME.fac(f); return `<span class="seal ${cls || 'sm'}" style="background:${F.color}">${F.seal}</span>`; }
  function facName(f) { const F = GAME.fac(f); return F ? F.name : '?'; }
  function livingTileOwner(t) {
    const f = GAME.tileOwner(t);
    return GAME.fac(f)?.alive ? f : null;
  }
  function meter(v, max, cls) { return `<div class="meter ${cls || ''}"><i style="width:${Math.max(0, Math.min(100, v / max * 100))}%"></i></div>`; }

  const prose = 'p, li, .note, .story, .choice small, .ob-msg, .court-log > div > span:last-child, .loglist > div, .toast, .tresult > div, .tside > div, .battle .side, .cand';
  let layoutRoster, layoutRosterSize, layoutNames;
  function namePattern() {
    const roster = S()?.generals;
    if (layoutNames && layoutRoster === roster && layoutRosterSize === roster?.length) return layoutNames;
    layoutRoster = roster;
    layoutRosterSize = roster?.length;
    const people = roster ? roster.map(g => g.name) : DATA.GEN.map(row => row[0]);
    const terms = [...new Set(people.concat(COURT.OFFICES.map(office => office.name)))].filter(name => name.length >= 2);
    const escaped = terms.sort((a, b) => b.length - a.length).map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    layoutNames = new RegExp('[（【《「『]?(?:' + escaped.join('|') + ')[，。；：！？、）】》」』]*', 'gu');
    return layoutNames;
  }
  // 只处理已呈现的文字。旧浏览器也能把姓名、数值与单位、段尾作为整体排布。
  function layoutText(root) {
    const keep = (text, cls = 'keep') => {
      const span = document.createElement('span');
      span.className = cls;
      span.textContent = text;
      return span;
    };
    for (const button of root.querySelectorAll('.choice, .record-link')) {
      const cls = button.matches('.choice') ? 'choice-label' : 'record-label';
      for (const node of [...button.childNodes]) if (node.nodeType === Node.TEXT_NODE && node.data.trim()) {
        const span = keep(node.data, cls);
        if (!button.title) span.title = node.data.trim();
        node.replaceWith(span);
      }
    }
    const metric = /[（【《「『]?(?:(?:岁入|岁出|兵源|行军力|忠诚|威胁度|好感|权威|士气|民心|城防|折损|胜算|成功率|射程|战力|效果|主战|主和|中立|工事|嫁妆|文教|仓储|户口|等级|钱|粮|兵|工|文|马|铁|统|武|智|政|攻|守|行|岁|第|余)[ \t　]*)?[+−-]?\d[\d,.]*(?:[/:／—–-]\d[\d,.]*)?(?: *[%％]| *(?:万人|贯\/季|万|人|贯|石|营|州|座|员|程|日|年|岁|季|月|旬|周|分|级|票|条|项|KB))?(?:\/[日季月年])?[，。；：！？、）】》」』”’]*/gu;
    const names = namePattern();
    const blocks = [...root.querySelectorAll(prose)];
    if (root.matches(prose)) blocks.unshift(root);
    for (const block of blocks) {
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
        acceptNode: n => n.data.trim() && n.parentElement.closest(prose) === block &&
          !n.parentElement.closest('.keep, .choice-label, .record-label, button:not(.choice, .plan), .chip, .skill, select')
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
      });
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        const text = node.data;
        const ranges = [...text.matchAll(metric), ...text.matchAll(names)].map(m => [m.index, m.index + m[0].length]);
        if (node === nodes.at(-1)) {
          const tail = text.match(/[（【《「『“‘]*\p{Script=Han}{2}(?:[ \t]+[+−])?[，。；：！？、）】》」』”’]*\s*$/u);
          if (tail) ranges.push([tail.index, tail.index + tail[0].trimEnd().length]);
        }
        if (!ranges.length) continue;
        ranges.sort((a, b) => a[0] - b[0]);
        const merged = [];
        for (const range of ranges) {
          const last = merged.at(-1);
          if (last && range[0] < last[1]) last[1] = Math.max(last[1], range[1]);
          else merged.push(range);
        }
        const fragment = document.createDocumentFragment();
        let end = 0;
        for (const [start, stop] of merged) {
          fragment.append(text.slice(end, start), keep(text.slice(start, stop)));
          end = stop;
        }
        fragment.append(text.slice(end));
        node.replaceWith(fragment);
      }
    }
  }

  // ---------- 启动 ----------
  function boot() {
    AUDIO.init();
    refreshSound();
    $('top').insertAdjacentHTML('beforeend', '<button id="mobile-research" type="button" data-act="tech"></button>');
    $('topmenu').querySelector('[data-act="chron"]').insertAdjacentHTML('afterend', '<button type="button" data-act="honors">功业</button>');
    $('mobilebar').insertAdjacentHTML('beforeend', `
      <button id="cancelpreview" type="button" class="btn hidden" data-act="cancelpreview">取消预览</button>
      <div id="mapzoom" role="group" aria-label="地图缩放">
        <button type="button" class="btn" data-act="zoomin" aria-label="放大地图">＋</button>
        <button type="button" class="btn" data-act="zoomout" aria-label="缩小地图">－</button>
      </div>`);
    RENDER.init($('map'), $('mini'));
    applySettings();
    phone.addEventListener('change', () => {
      applyUISize(); refreshTop(); setMenu(false); setMini(false); revealSelection();
      if (!$('modal-bg').classList.contains('hidden')) {
        if ($('modal').querySelector('.tech-tree')) showTech();
        if ($('modal').querySelector('[data-general-roster]')) showGenerals();
        if ($('modal').querySelector('.court-page')) showCourt();
        if ($('modal').querySelector('.dip-page')) showDiplomacy();
      }
    });
    titleScreen();
    withLoading('研墨铺纸，绘制天下舆图……', () => { GEO.generate(); ensureBase(); const [c, r] = GEO.nearestHex(100, 36); RENDER.centerOn(GEO.idx(c, r), 0.45); });
    bindInput();
    GAME.on('log', e => {
      if (inTurn || RENDER.isAnimating()) { if (['war', 'big'].includes(e.type) || e.hot) deferredToasts.push(e); }
      else { if (majorSound(e)) AUDIO.play('major'); toast(e.text, e.type); }
    });
    GAME.on('battle', r => battleQueue.push(r));
    GAME.on('change', () => { if (!inTurn && !batchingMarch) refreshTop(); RENDER.markDirty(); });
    GAME.on('event', () => {});
  }

  function titleScreen() {
    AUDIO.setMusic('title');
    $('title').classList.remove('hidden');
    // 山水长卷：首次显示与窗口改变大小时重绘
    const paintScene = () => {
      if (typeof INKART === 'undefined' || typeof INKART.scene !== 'function' || $('title').classList.contains('hidden')) return;
      INKART.scene($('titlescene'));
    };
    requestAnimationFrame(paintScene);
    if (!titleScreen.bound) { titleScreen.bound = true; let tm = 0; addEventListener('resize', () => { clearTimeout(tm); tm = setTimeout(paintScene, 150); }); }
    const hasAuto = !!localStorage.getItem(SAVE_PREFIX + 'auto');
    $('titlemenu').innerHTML = `
      ${hasAuto ? '<button data-t="continue">继续征程</button>' : ''}
      <button data-t="new">新开天下</button>
      <div class="diff">${DATA.DIFFICULTY.map((d, i) => `<button data-d="${i}" class="${i === difficulty ? 'on' : ''}" title="${esc(difficultyDescription(d))}">${d.name}</button>`).join('')}</div>
      <div class="diff">${[[7, '一周'], [10, '一旬'], [30, '一月'], [90, '一季']].map(([v, n]) => `<button data-sc="${v}" class="${v === timeScale ? 'on' : ''}" title="每回合推进的时间">${n}</button>`).join('')}</div>
      <button data-t="load">读取存档</button>
      <button data-t="import">导入存档</button>
      <button data-t="hall">功业榜</button>
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
      if (t === 'hall') showHall();
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
    AUDIO.beginReplay();
    RENDER.centerOn(tile);
    TACTIC.prebattle(a, tile, opts => {
      if (!opts) { refreshSide(); refreshTop(); setTimeout(processPending, 10); return; }
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
    marchEngagements = [];
    GAME.hooks.engage = true;
    GAME.hooks.defend = (a, tile) => SET.defend === 'all' || (SET.defend === 'city' && !!GAME.cityAt(tile) && GAME.cityAt(tile).f === P());
    $('title').classList.add('hidden');
    for (const id of ['top', 'side', 'endturn', 'minimap', 'mobilebar']) $(id).classList.remove('hidden');
    setMenu(false); setMini(false);
    RENDER.buildPolitical(); RENDER.buildFog();
    refreshTop(); refreshSide();
    $('pseal').style.background = GAME.fac(P()).color;
    updateSoundMood();
  }

  function refreshSound() {
    const muted = AUDIO.getSettings().muted;
    $('sound-toggle').textContent = muted ? '静' : '声';
    $('sound-toggle').setAttribute('aria-pressed', String(muted));
    $('sound-toggle').title = muted ? '恢复声音 (N)' : '静音 (N)';
    const toggle = $('modal').querySelector('[data-sound-switch]');
    if (toggle) {
      toggle.textContent = muted ? '已静音' : '静音';
      toggle.setAttribute('aria-pressed', String(muted));
    }
  }
  function toggleSound() {
    AUDIO.setSetting('muted', !AUDIO.getSettings().muted);
    refreshSound();
  }
  function updateSoundMood() {
    if (!AUDIO.supported() || !S()) return;
    const state = S(), player = P(), capital = GAME.city(GAME.fac(player).capital);
    const besieged = capital?.f === player && GEO.NBR[capital.tile].some(t => {
      const army = GAME.armyAt(t);
      return army && GAME.atWar(player, army.f);
    });
    const losses = new Set();
    for (let i = state.log.length - 1; i >= 0; i--) {
      const row = state.log[i];
      if ((state.turn - row.t) * state.scale > 180) break;
      const city = row.type === 'war' && row.text.match(/^(.+)失守于【/);
      if (city) losses.add(city[1]);
      if (losses.size >= 3) break;
    }
    const war = Object.values(state.factions).some(f => f.alive && !f.rebel && f.id !== player && GAME.atWar(player, f.id));
    AUDIO.setMusic(state.flags.league?.stage === 'war' || besieged || losses.size >= 3 ? 'crisis' : war ? 'war' : 'peace');
  }

  // ---------- 顶栏 ----------
  function researchProgress(F, inc) {
    const tech = TECH[F.research];
    const cost = tech ? GAME.techCost(P(), F.research) : 0;
    const eta = tech && inc.sci > 0 ? Math.max(1, Math.ceil((cost - F.sci) / (inc.sci * GAME.E()))) : 0;
    return { tech, cost, eta, pct: cost ? GAME.clamp(F.sci / cost * 100, 0, 100) : 0 };
  }
  function capitalProgress() {
    const caps = S().cities.filter(c => c.origCap);
    return caps.filter(c => c.f === P()).length + '/' + caps.length;
  }
  function cityProgress() {
    return GAME.citiesOf(P()).length + '/' + S().cities.filter(c => c.f).length;
  }
  function showTreasury() {
    const F = GAME.fac(P()), inc = F.income || {};
    const { tech, cost, eta, pct } = researchProgress(F, inc);
    const amount = fmtAmount;
    const row = (label, value) => `<div class="row"><span class="grow">${label}</span><strong>${value}</strong></div>`;
    const resource = (name, value, unit, detail) => `<section class="treasury-group"><div class="sec">${name}<span class="r">${amount(value)} ${unit}</span></div>${detail}</section>`;
    const trib = inc.trib || 0;
    const { gold, food, governance } = GAME.factionUpkeep(P());
    const deficit = (inc.gold != null && inc.gold + trib < gold + governance) || (inc.food != null && inc.food < food);
    openModal(`<h1>府库</h1>
      <p class="note treasury-date">公元 ${S().year} 年 · ${GAME.dateStr()} · 第 ${S().turn + 1} ${TU()}</p>
      ${deficit ? '<div class="treasury-alert"><button class="btn sm" type="button" data-act="armies">兵多饷重，可于军中遣散</button></div>' : ''}
      <div class="treasury-grid">
        ${resource('钱', F.gold, '贯', row('岁入 / 季', amount(inc.gold)) + row('军费、俸禄与营缮 / 季', amount(gold)) +
          (governance ? row('治理支出 / 季', amount(governance)) : '') + row('岁币 / 季', trib ? sgn(trib) : 0))}
        ${resource('粮', F.food, '石', row('诸州输粮 / 季', amount(inc.food)) + row('军粮 / 季', amount(food)))}
        ${resource('兵源', F.man, '', row('增兵源 / 季', amount(inc.man)) + row('募兵每营', '耗 5（约五百人）'))}
        ${resource('马', F.horse, '匹', row('入马 / 季', amount(inc.horse)) + row('骑兵每营', '耗 3 匹'))}
        ${resource('铁', F.iron, '', row('入铁 / 季', amount(inc.iron)) + row('甲骑、火器每营', '耗 2'))}
        <section class="treasury-group"><div class="sec">研究<span class="r">${tech ? esc(tech.name) : '未定'}</span></div>
        ${row('文教 / 季', amount(inc.sci))}
        ${tech ? row('研究进度', `${amount(F.sci)} / ${cost}${eta ? ' · 余 ' + eta + TU() : ''}`) + meter(pct, 100, 'gold') : ''}
        ${row('原都城', capitalProgress())}${row('城池', cityProgress())}</section>
      </div>`, { width: '620px' });
  }
  function refreshTop() {
    if (!S()) return;
    const F = GAME.fac(P()), inc = F.income || {};
    $('date').textContent = phone.matches ? GAME.dateStr(S().year, S().season) : GAME.dateStr();
    $('subdate').textContent = `公元 ${S().year} 年 · 第 ${S().turn + 1} ${TU()}`;
    $('endbtn').querySelector('span').textContent = inTurn ? '运筹中' : '下一' + TU();
    const C = S().court;
    $('courtbox').innerHTML = C ? `<span class="k">权威</span> <b>${Math.round(C.auth)}</b><div class="lean"><i style="left:${(C.lean + 100) / 2}%"></i></div><span class="k">${C.lean > 20 ? '朝议主战' : C.lean < -20 ? '朝议主和' : '朝议未决'}</span>` : '';
    const gnet = (inc.gold || 0) - (inc.upkeep || 0) + (inc.trib || 0), fnet = (inc.food || 0) - (inc.foodUp || 0);
    const { tech: r, eta, pct } = researchProgress(F, inc);
    if (phone.matches) {
      const stats = [['钱', F.gold, gnet], ['粮', F.food, fnet], ['兵', F.man, inc.man], ['马', F.horse, inc.horse], ['铁', F.iron, inc.iron]];
      $('res').innerHTML = stats.map(([label, value, rate]) => `<button type="button" class="rbox resource-cell" data-act="treasury" aria-label="${label} ${fmtShort(value)}，查看府库">
        <span class="k">${label}${rate ? ` <span aria-hidden="true" class="${rate > 0 ? 'pos' : 'neg'}">${rate > 0 ? '▲' : '▼'}</span>` : ''}</span>
        <b>${fmtShort(value)}</b></button>`).join('');
      $('mobile-research').style.setProperty('--research-pct', pct + '%');
      $('mobile-research').textContent = r ? `${r.name} · ${eta ? '余 ' + eta + TU() : '待计'}` : '研究未定';
    } else $('res').innerHTML = `
      <button type="button" data-act="treasury" class="rbox resource-cell" title="岁入 ${inc.gold || 0}，军费、俸禄、营缮与治理 ${inc.upkeep || 0}，岁币 ${inc.trib || 0}。点击查看府库"><span class="k">钱</span> <b>${fmt(F.gold)}</b> <span class="d ${gnet >= 0 ? 'pos' : 'neg'}">${sgn(gnet)}/季</span></button>
      <button type="button" data-act="treasury" class="rbox resource-cell" title="诸州输粮 ${inc.food || 0}，军粮 ${inc.foodUp || 0}。点击查看府库"><span class="k">粮</span> <b>${fmt(F.food)}</b> <span class="d ${fnet >= 0 ? 'pos' : 'neg'}">${sgn(fnet)}/季</span></button>
      <div class="rbox" title="每营需兵源 5（约五百人）；每季 +${inc.man || 0}"><span class="k">兵源</span> <b>${fmt(F.man)}</b></div>
      <div class="rbox" title="骑兵每营耗马 3；每季 +${inc.horse || 0}"><span class="k">马</span> <b>${fmt(F.horse)}</b></div>
      <div class="rbox" title="甲骑、火器每营耗铁 2；每季 +${inc.iron || 0}"><span class="k">铁</span> <b>${fmt(F.iron)}</b></div>
      <div class="rbox" data-act="tech" style="cursor:pointer" title="每季文教 ${inc.sci || 0}"><span class="k">研究</span> <b style="font-size:14px">${r ? r.name : '<span class=neg>未定</span>'}</b> <span class="d">${r ? eta + TU() : ''}</span>
        <div class="bar"><i style="width:${pct}%"></i></div></div>
      <div class="rbox" title="攻占诸国原都城可获万国来朝"><span class="k">都城</span> <b>${capitalProgress()}</b></div>
      <div class="rbox" title="尽取有主之城即一统天下"><span class="k">城池</span> <b>${cityProgress()}</b></div>`;
    const idle = S().armies.filter(a => a.f === P() && a.mp > 0 && !(a.path && a.path.length) && !a.sentry).length;
    const routed = S().armies.filter(a => a.f === P() && a.path && a.path.length && a.mp > 0).length;
    const idleC = GAME.citiesOf(P()).filter(c => !c.queue.length).length;
    $('idlehint').innerHTML =
      (idleC ? `<button type="button" data-act="nextcity" title="下一座空闲城">${idleC} 城空闲<span class="keyhint">（Q）</span></button>` : '') +
      (idle ? `<button type="button" data-act="nextidle" title="下一支待命军团">尚有 ${idle} 军待命<span class="keyhint">（Tab）</span></button>` : '') +
      (routed ? `<button type="button" data-act="contall">${routed} 军待续 · 全军继续<span class="keyhint">（C）</span></button>` : '');
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
    const c = GAME.cityAt(a.tile);
    const head = `<div class="ob-head">${g ? PORTRAIT.img(g, 34) : ''}<div><b>${esc(GAME.armyName(a))}</b><span class="note">${a.units.length} 营 · ${fmt(GAME.sumStr(a.units))} 人 · 行军力 ${Math.round(a.mp * 10) / 10}/${GAME.armyMP(a)} · 士气 ${Math.round(a.morale)}</span></div>${c ? '<button type="button" class="btn" data-act="inspect-town">城池</button>' : ''}</div>`;
    let body;
    if (pendingTarget >= 0) {
      const t = pendingTarget, c = GAME.cityAt(t), ea = GAME.armyAt(t);
      const enemy = (ea && ea.f !== P() && GAME.atWar(P(), ea.f)) || (c && c.f !== P() && GAME.atWar(P(), c.f));
      const where = c ? c.name : GEO.TERRAIN[GEO.terrain[t]].name;
      const pt = RENDER.state.pathTurns || [];
      body = `<div class="ob-msg">${enemy ? '<span class="neg">进攻</span> ' : '前往 '}<b>${esc(where)}</b>　${arrivalText(t, pt)}${enemy ? '　胜算 ' + odds(a, t) : ''}</div>
        <div class="ob-btns">${S().explored[t] ? `<button class="btn" data-act="terrain" data-arg="${t}">地势</button>` : ''}<button class="btn" data-act="cancelpreview">取消</button><button class="btn red ob-go" data-act="go">${enemy ? '进攻' : '出发'}</button></div>`;
    } else {
      const routed = !!a.path?.length;
      body = `<div class="ob-msg note">${moveMode ? '轻点地图，择定去处' : '可轻点目标格预览路线'}</div>
        <div class="ob-btns">${routed ? `<button class="btn red" data-act="cont" ${a.mp > 0 ? '' : 'disabled'}>继续行军</button>` : ''}<button class="btn ${routed ? '' : 'red'}" data-act="movemode" aria-pressed="${moveMode}">行军</button><button class="btn" data-act="drawertoggle">详情</button><button class="btn" data-act="desel" aria-label="取消选择">✕</button></div>`;
    }
    bar.innerHTML = head + body;
    layoutText(bar);
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
    let dragged = false, pinched = false, held = false, lastHover = -1, tipTimer, holdTimer;
    cv.addEventListener('pointerdown', e => {
      if (RENDER.isAnimating()) { RENDER.skipAnim(); return; }
      if (pointers.size && (e.pointerType !== 'touch' || [...pointers.values()][0].type !== 'touch')) return;
      clearTimeout(holdTimer);
      if (!pointers.size) { dragged = false; pinched = false; held = false; }
      pointers.set(e.pointerId, { ...point(e), button: e.button, type: e.pointerType });
      if (pointers.size > 1) pinched = true;
      else if (e.button === 0) {
        const t = RENDER.tileAtScreen(e.clientX, e.clientY);
        if (S()?.explored[t]) holdTimer = setTimeout(() => {
          held = true;
          $('tip').classList.add('hidden');
          showTileTerrain(t);
        }, 550);
      }
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', e => {
      const p = pointers.get(e.pointerId);
      const next = point(e);
      if (p && held) return;
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
          clearTimeout(holdTimer);
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
      clearTimeout(holdTimer);
      pointers.delete(e.pointerId);
      cv.style.cursor = moveMode ? 'crosshair' : 'default';
      if (e.type !== 'pointerup' || dragged || pinched || held || !S()) return;
      if (p.type !== 'mouse' && distance(p, point(e)) > 8) return;
      if (document.elementFromPoint(e.clientX, e.clientY) !== cv) return;
      const armyHit = p.button === 0 && !moveMode ? RENDER.armyAtScreen(e.clientX, e.clientY) : null;
      const t = armyHit?.tile ?? RENDER.tileAtScreen(e.clientX, e.clientY);
      if (t < 0) return;
      if (p.button === 2 || (p.button === 0 && moveMode && !phone.matches)) orderMove(t);
      else if (p.button === 0) clickTile(t, p.type !== 'mouse', armyHit);
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
      if (e.key.toLowerCase() === 'n' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey &&
          !e.target.closest?.('input, select, textarea, [contenteditable]')) {
        toggleSound(); e.preventDefault(); return;
      }
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
      else if (k === ' ' && sel && sel.type === 'army') { const a = myArmySel(); if (a) { sentryOrder(a); nextIdle(); } e.preventDefault(); }
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
    $('modal').addEventListener('input', e => {
      const input = e.target;
      if (!input.dataset.volume) return;
      AUDIO.setSetting(input.dataset.volume, input.valueAsNumber / 100);
      input.nextElementSibling.value = input.value + '%';
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
    const own = livingTileOwner(t), c = GAME.cityAt(t), a = GAME.armyAt(t);
    const y = GAME.tileYield(t);
    let h = `<b>${tr.name}</b>${GEO.river[t] ? ' · 临河' : ''}${GEO.resource[t] ? ' · <span class=skill>' + GEO.resource[t] + '</span>' : ''}`;
    if (!GEO.isWater(t)) h += `<br>粮 ${y.food}　工 ${y.prod}　钱 ${y.gold}${tr.def ? '　守 +' + Math.round(tr.def * 100) + '%' : ''}　行军耗 ${tr.move}`;
    if (own) h += `<br>${facSeal(own)} ${facName(own)}${own !== P() ? '　' + relText(own) : ''}`;
    if (c) h += `<br>${own ? '城' : '荒城'}：<b>${esc(c.name)}</b>　户口 ${c.pop} 万`;
    if (a && (a.f === P() || S().visible[t])) h += `<br>军：${esc(GAME.armyName(a))}（${a.units.length} 营，${fmt(GAME.sumStr(a.units))} 人）`;
    const site = GAME.siteAt(t);
    if (site) { const ST = DATA.SITES[site.type]; const cd = ST.repeat === 'season' && site.cd[P()] > S().T; h += `<br><b class="skill">${site.name}</b>　${ST.desc}${cd ? '　<span class=neg>（本季已访）</span>' : ''}`; }
    // 预览路径
    if (pendingTarget >= 0) { tip.innerHTML = h + '<br><span class=pos>再次点击目标格出发</span>'; tip.classList.remove('hidden'); RENDER.markDirty(); return; }
    if (!previewPath) { tip.innerHTML = h; tip.classList.remove('hidden'); RENDER.markDirty(); return; }
    showSavedPath();
    if (sel && sel.type === 'army') {
      const ar = GAME.army(sel.id);
      if (ar && ar.f === P() && t !== ar.tile) {
        const p = GAME.findPath(ar, t, 3000);
        if (p && p.length) {
          const full = [ar.tile, ...p];
          RENDER.state.path = full;
          RENDER.state.pathTurns = pathTurns(ar, full);
          const enemy = (a && a.f !== P() && GAME.atWar(P(), a.f)) || (c && c.f !== P() && GAME.atWar(P(), c.f));
          if (enemy) h += `<br><span class=neg>进攻！</span> 估算胜算：${odds(ar, t)}`;
          else h += `<br>${arrivalText(t, RENDER.state.pathTurns)}`;
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
    let from = full[0];
    for (let k = 1; k < full.length;) {
      const step = GAME.routeStep(a, from, full, k);
      if (step.kind === 'blocked' || step.kind === 'wait') break;
      if (step.kind === 'attack') {
        if (mp <= 0) { out.push([from, turn]); turn++; }
        from = step.to;
        break;
      }
      if (step.kind === 'pass') {
        if (step.cost > mp + 1e-9) {
          if (step.cost > max + 1e-9) break;
          out.push([from, turn]); turn++; mp = max;
        }
        mp = Math.max(0, mp - step.cost);
      } else {
        let need = step.cost - prog;
        while (need > mp + 1e-9) { need -= mp; out.push([from, turn]); turn++; mp = max; }
        mp = Math.max(0, mp - need);
      }
      prog = 0;
      from = step.to; k = step.end + 1;
    }
    out.push([from, turn]);
    return out.filter((x, i, arr) => i === arr.length - 1 || x[1] !== (arr[i + 1] || [])[1]);
  }
  function arrivalText(goal, turns) {
    const last = turns.at(-1);
    return last?.[0] === goal ? `约 ${last[1]} ${TU()}抵达` : '前路受阻';
  }
  function odds(a, t) {
    const path = RENDER.state.path;
    const from = path?.at(-1) === t ? path.at(-2) : a.tile;
    const r = GAME.previewBattle(a, t, {}, from).r;
    return r > 0.68 ? '<span class=pos>大优</span>' : r > 0.55 ? '<span class=pos>占优</span>' : r > 0.45 ? '五五之数' : r > 0.32 ? '<span class=neg>劣势</span>' : '<span class=neg>以卵击石</span>';
  }
  function relText(f) {
    const r = GAME.getRel(P(), f);
    if (r.war) return '<span class=neg>交战</span>';
    if (r.vassal?.lord === P()) return '<span class=pos>藩属</span>';
    if (r.ally) return '<span class=pos>同盟</span>';
    if (r.truce > 0) return `和约（${Math.ceil(r.truce)}季）`;
    return r.op >= 0 ? '通好' : '冷淡';
  }

  function clickTile(t, touch, armyHit) {
    const a = GAME.armyAt(t), c = GAME.cityAt(t);
    const visA = a && (a.f === P() || S().visible[t]);
    if (armyHit && (armyHit.f === P() || !myArmySel())) { select({ type: 'army', id: armyHit.id, tile: armyHit.tile }); return; }
    if (sel && sel.type === 'army' && sel.tile === t && c) { select({ type: 'city', id: c.id, tile: t }); return; }
    const myA = sel && sel.type === 'army' && GAME.army(sel.id);
    if (myA && myA.f === P() && t !== myA.tile && !(visA && a.f === P())) {
      if (pendingTarget === t) { orderMove(t); return; }
      const p = GAME.findPath(myA, t, Infinity);
      if (!p || !p.length) { toast('无路可达'); return; }
      const full = [myA.tile, ...p];
      RENDER.state.path = full; RENDER.state.pathTurns = pathTurns(myA, full);
      setPendingTarget(t);
      if (!phone.matches) toast(`路线已定 · ${arrivalText(t, RENDER.state.pathTurns)}。再点一次出发，${touch ? '可点「取消预览」撤回' : 'Esc 取消'}`);
      RENDER.markDirty();
      return;
    }
    if (c && S().explored[t]) select({ type: 'city', id: c.id, tile: t });
    else if (visA) select({ type: 'army', id: a.id, tile: t });
    else if (S().explored[t]) select({ type: 'tile', tile: t });
    else select(null);
  }
  function select(s) {
    cancelAnimationFrame(panAnim);
    sel = s; unitPick.clear(); setPendingTarget(-1);
    moveMode = false;
    $('map').style.cursor = 'default';
    RENDER.state.sel = s ? { tile: s.tile, army: s.type === 'army' ? s.id : null } : null;
    showSavedPath();
    refreshSide(); RENDER.markDirty();
    if (phone.matches) setDrawer(!!s && !myArmySel());
  }
  function orderMove(t) {
    if (!sel || sel.type !== 'army') return;
    const a = GAME.army(sel.id);
    if (!a || a.f !== P()) return;
    const tgtArmy = GAME.armyAt(t), tgtCity = GAME.cityAt(t);
    if (tgtArmy && tgtArmy.f === a.f && tgtArmy !== a) {
      select({ type: 'army', id: tgtArmy.id, tile: t });
      return;
    }
    setPendingTarget(-1);
    const other = (tgtArmy && tgtArmy.f !== P() && tgtArmy.f) || (tgtCity && tgtCity.f !== P() && tgtCity.f);
    if (other && !GAME.atWar(P(), other) && !GAME.allied(P(), other) && GEO.dist(a.tile, t) <= 1) {
      courtVote('war', other, () => { GAME.declareWar(P(), other); RENDER.buildPolitical(); doMove(a, t); });
      return;
    }
    doMove(a, t);
  }
  function doMove(a, t) {
    AUDIO.beginReplay();
    GAME.takeAnim();
    const snap = RENDER.snapshot();
    const mp0 = a.mp, tile0 = a.tile, nm = GAME.armyName(a);
    const res = GAME.moveArmyTo(a.id, t);
    if (res.ok) guide('move');
    if (res.ok && res.battles && res.battles.some(b => b.win)) guide('battle');
    if (res.ok) {
      const still = GAME.army(a.id);
      if (mp0 <= 0) toast(`${nm}本${TU()}行军力已尽（已行军或已交战），路线已定，下${TU()}按 C 继续`);
      else if (still && still.tile === tile0 && !(res.battles && res.battles.length)) {
        const passed = still.prog > 0 ? '只推进了一段' : '暂留原地';
        toast(`${nm}前路险阻，本${TU()}${passed}，下${TU()}再行`);
      }
    }
    moveMode = false; $('map').style.cursor = 'default';
    if (!res.ok) { GAME.takeAnim(); toast(res.msg || '无法抵达'); return; }
    RENDER.state.path = null;
    const battles = res.battles || [];
    marchEngagements.push(...battles.filter(b => b.engage));
    refreshSight();
    const fin = () => {
      afterAction(battles.some(b => !b.engage));
      const still = GAME.army(a.id);
      if (still && sel) { sel.tile = still.tile; RENDER.state.sel = { tile: still.tile, army: still.id }; showSavedPath(); }
      else select(null);
      refreshSide(); flushDeferred();
      setTimeout(processPending, 30);
    };
    RENDER.play(snap, GAME.takeAnim(), Math.max(animSpeed, animSpeed ? 1 : 0), fin);
  }
  function continueArmies(ids) {
    if (RENDER.isAnimating()) return;
    AUDIO.beginReplay();
    GAME.takeAnim();
    const snap = RENDER.snapshot();
    let battles = 0; const engs = [];
    batchingMarch = true;
    try {
      for (const id of ids) for (const b of GAME.continueArmy(id)) { if (b.engage) engs.push(b); else battles++; }
    } finally { batchingMarch = false; }
    const evs = GAME.takeAnim();
    if (!evs.length && !engs.length) { showSavedPath(); refreshSide(); refreshTop(); toast('本回合暂不能续行'); return; }
    marchEngagements.push(...engs);
    refreshSight();
    RENDER.state.path = null;
    RENDER.play(snap, evs, Math.max(animSpeed, animSpeed ? 1 : 0), () => {
      afterAction(battles);
      if (sel && sel.type === 'army') { const a = GAME.army(sel.id); if (a) { sel.tile = a.tile; RENDER.state.sel = { tile: a.tile, army: a.id }; showSavedPath(); } else select(null); }
      refreshSide(); flushDeferred();
      setTimeout(processPending, 30);
    });
  }
  function continueAll() {
    const ids = S().armies.filter(a => a.f === P() && a.path && a.path.length && a.mp > 0).map(a => a.id);
    if (!ids.length) { toast('无待续之路线'); return; }
    continueArmies(ids);
  }
  function majorSound(e) {
    return /^合纵共讨：|即位，百司奉诏如常。$|^【[^】]+】亡国。$/.test(e.text);
  }
  // 回合结束提示：我朝战报优先，天下大事最多两条，合计不超过五条
  function flushDeferred() {
    const L = deferredToasts; deferredToasts = [];
    if (L.some(majorSound)) AUDIO.play('major');
    const shortage = L.find(e => e.type === 'regen');
    const own = L.filter(e => e.type !== 'world' && e !== shortage).slice(shortage ? -3 : -4);
    if (shortage) own.push(shortage);
    const world = L.filter(e => e.type === 'world').slice(-Math.min(2, 5 - own.length));
    for (const e of [...world, ...own]) toast(e.text, e.type);
  }
  function refreshSight(major = false) {
    if (major) GAME.assignTerritory(false);
    GAME.updateVisibility();
    if (RENDER.buildFog() || major) RENDER.buildPolitical();
  }
  function afterAction(major) {
    refreshSight(major);
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
  function sentryOrder(a) {
    GAME.setSentry(a);
    moveMode = false;
    $('map').style.cursor = 'default';
    cancelPreview();
    refreshSide();
    refreshTop();
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
    if (!sel) { el.innerHTML = overviewHTML(); layoutText(el); return; }
    if (sel.type === 'city') {
      const c = GAME.city(sel.id);
      el.innerHTML = !GAME.fac(c.f)?.alive ? ruinHTML(c) : c.f === P() ? cityHTML(c) : foreignCityHTML(c);
    }
    else if (sel.type === 'army') { const a = GAME.army(sel.id); if (!a) { sel = null; el.innerHTML = overviewHTML(); layoutText(el); return; } el.innerHTML = a.f === P() ? armyHTML(a) : foreignArmyHTML(a); }
    else el.innerHTML = tileHTML(sel.tile);
    if (sel.type !== 'tile') {
      const stationed = GAME.armyAt(sel.tile);
      const visibleArmy = stationed && (stationed.f === P() || S().visible[sel.tile]);
      const switchTo = sel.type === 'army' && GAME.cityAt(sel.tile) ? '<button class="btn sm" data-act="inspect-town">查看城池</button>' :
        sel.type === 'city' && visibleArmy ? '<button class="btn sm" data-act="inspect-army">查看驻军</button>' : '';
      el.querySelector('.ph').insertAdjacentHTML('afterend', `<button class="record-link terrain-link" data-act="terrain" data-arg="${sel.tile}">察看地势 · ${tileTerrainName(sel.tile)}</button>${switchTo}`);
    }
    layoutText(el);
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
  function tileTerrainName(t) { return GEO.TERRAIN[GEO.terrain[t]].name + (GEO.river[t] ? ' · 临河' : ''); }
  function showTileTerrain(t) {
    if (S()?.explored[t]) openModal(`<h1>${tileTerrainName(t)}</h1><div class="sec">地形修正</div>${TACTIC.terrainRowsHTML(GAME.tileTerrainRows(t))}`, { width: '440px' });
  }
  function tileHTML(t) {
    const tr = GEO.TERRAIN[GEO.terrain[t]], y = GAME.tileYield(t), own = livingTileOwner(t);
    return `<div class="ph"><div><h2>${tr.name}</h2><div class="sub">${GEO.river[t] ? '临河 · ' : ''}${GEO.resource[t] ? '物产：' + GEO.resource[t] : '无特产'}</div></div><button class="x" data-act="desel">×</button></div>
      <div class="stat"><div><b>${y.food}</b><span>粮</span></div><div><b>${y.prod}</b><span>工</span></div><div><b>${y.gold}</b><span>钱</span></div><div><b>${tr.move}</b><span>行军耗</span></div></div>
      <div class="sec">地形修正</div>${TACTIC.terrainRowsHTML(GAME.tileTerrainRows(t))}
      ${own ? `<p>${facSeal(own)} 属【${facName(own)}】${own !== P() ? '　' + relText(own) : ''}</p>` : '<p class="note">无主之地</p>'}`;
  }
  function ruinHTML(c) {
    return `<div class="ph"><span class="seal" style="background:#756e62">荒</span>
      <div><h2>${esc(c.name)}</h2><div class="sub">荒城 · 户口 ${c.pop} 万</div></div><button class="x" data-act="desel">×</button></div>
      <p class="note">城垣尚存，今无所隶。</p>`;
  }

  function selectedUnits(owner) {
    return (owner.units || owner.garrison).flatMap((u, i) => unitPick.has(u) ? [i] : []);
  }
  function recoveryText() {
    const rates = DATA.UNIT_RECOVERY;
    return `军团每季休整，本国城内 +${rates.city}、本国境内 +${rates.home}、盟境近援 +${rates.ally}，皆耗丁口。粮尽或欠饷则少补，甚则减员。`;
  }
  function refillCostText(cost) {
    return Object.entries({ gold: '钱', man: '丁口', horse: '马', iron: '铁' })
      .filter(([key]) => cost[key] > 0).map(([key, name]) => `${name} ${fmtAmount(cost[key])}`).join('、');
  }
  function unitButton(act, label, info, attrs = '') {
    const title = info.ok ? (info.cost ? refillCostText(info.cost) : '') : info.msg;
    return `<button type="button" class="btn sm" data-act="${act}" ${attrs}${info.ok ? '' : ' disabled'}${title ? ' title="' + esc(title) + '"' : ''}>${label}</button>`;
  }
  function unitPanel(owner, extra = '', dismissalLock = '') {
    const army = !!owner.units, units = owner.units || owner.garrison;
    if (!units.length) return '<div class="note">城中无兵。</div>';
    const canRefill = !army || GAME.cityAt(owner.tile)?.f === owner.f;
    const batch = canRefill ? GAME.reinforcementInfo(owner) : null;
    const picked = selectedUnits(owner);
    const join = picked.length >= 2 ? GAME.consolidationInfo(owner, picked) : null;
    const refill = batch ? unitButton('reinforce-all', army ? '全军补员' : '守军补员', batch) : '';
    const combine = join ? unitButton('consolidate-units', '合营', join) : '';
    const fee = batch?.ok ? `全补需${refillCostText(batch.cost)}。` : batch?.msg !== '兵员已足' ? batch?.msg : '';
    const notes = [join?.msg, fee].filter(Boolean).map(text => `<p class="note unit-order-note">${esc(text)}</p>`).join('');
    const rows = units.map((u, i) => {
      const selected = unitPick.has(u);
      const single = canRefill ? GAME.reinforcementInfo(owner, [i]) : null;
      const refillBtn = single ? unitButton('reinforce-unit', '补', single, `data-arg="${i}" aria-label="补员第 ${i + 1} 营"`) : '';
      const leave = army && canRefill ? `<button class="btn sm" data-act="toCity" data-arg="${i}">留驻</button>` : '';
      const dismiss = army ? `<button class="btn sm" data-act="dismiss-unit" data-arg="${i}" aria-label="遣散第 ${i + 1} 营" ${dismissalLock}>散</button>` : '';
      const cost = single?.ok ? refillCostText(single.cost) : u.s < 100 && single?.msg !== batch?.msg ? single?.msg : '';
      return `<div class="row unit-row${selected ? ' sel' : ''}"><button type="button" class="unit-select" data-act="${army ? 'apick' : 'gpick'}" data-arg="${i}" aria-pressed="${selected}">
        ${UNITART.img(owner.f, u.t, 34)}<span class="grow"><span class="unit-name">${esc(unitName(owner.f, u.t))}</span><span class="cost">约 ${fmt(u.s * 5)} 人</span><span class="meter"><i style="width:${u.s}%"></i></span></span>
        </button><div class="unit-actions">${refillBtn}${leave}${dismiss}</div>${cost ? `<span class="note unit-order-note">${esc(cost)}</span>` : ''}</div>`;
    }).join('');
    const orders = extra + refill + combine;
    return (orders ? `<div class="btns garrison-actions">${orders}</div>` : '') + notes + rows;
  }

  function cityTitle(c) { return `<span class="chip city-tier">${GAME.cityTier(c).name}</span> ${esc(c.name)}`; }
  function cityQueueName(c, q) {
    if (q.kind === 'tier') return '升为' + DATA.CITY_TIERS[q.id].name;
    return q.kind === 'b' ? B[q.id].name : '募' + unitName(c.f, q.id);
  }
  function cityDevelopment(c) {
    const up = GAME.tierUpgrade(c), role = DATA.CITY_ROLES[c.role];
    const pending = GAME.roleTime(c, DATA.CITY_ROLE_CHANGE.delay);
    const wait = GAME.roleTime(c, DATA.CITY_ROLE_CHANGE.cooldown);
    let h = '<div class="sec">城池等级与定位</div>';
    if (up) {
      h += `<div class="row"><span class="grow">${up.queued ? '升等已入营造队列' : `升为${up.name}需工 ${up.cost}`}</span><button class="btn sm" data-act="city-upgrade" ${up.ok ? '' : 'disabled'}>升为${up.name}</button></div>`;
      const missing = up.needs.filter(([met]) => !met);
      if (missing.length && !up.queued) h += '<ul class="note city-upgrade-needs">' + missing.map(([, text]) => `<li>须${text}</li>`).join('') + '</ul>';
    }
    if (c.tier === 0) return h + '<div class="note">升为州后，方可择定一业。</div>';
    h += `<div class="row"><span class="grow">定位 ${role?.name || '未定'}${pending ? ` <span class="chip red">改制中</span><br><span class="note">再历 ${pending.toFixed(2)} 季施行</span>` : role ? `<br><span class="note">${role.desc}</span>` : ''}</span>
      <button class="btn sm" data-act="city-role-menu" ${wait || (role && GAME.fac(c.f).gold < DATA.CITY_ROLE_CHANGE.gold) ? 'disabled' : ''}>${role ? '改定位' : '选定位'}</button></div>`;
    if (wait) h += `<div class="note">尚须 ${wait.toFixed(2)} 季方可再改。</div>`;
    else if (role) h += `<div class="note">改定位需钱 ${DATA.CITY_ROLE_CHANGE.gold} 贯。</div>`;
    return h;
  }
  function showCityRoles(c) {
    const change = DATA.CITY_ROLE_CHANGE;
    const terms = c.role ? `改制费钱 ${change.gold} 贯，满 ${change.delay} 季施行，${change.cooldown} 季后方可再改。` : '初定免钱，即日施行。';
    openModal(`<h1>${esc(c.name)} · 择业</h1><p class="note">${terms}</p><div class="choices">${Object.entries(DATA.CITY_ROLES).map(([id, role]) =>
      `<button class="choice" data-act="city-role" data-arg="${id}" ${c.role === id ? 'disabled' : ''}>${role.name}<small>${role.desc}</small></button>`).join('')}</div>`, { width: '560px' });
  }
  function cityHTML(c) {
    const y = GAME.cityYield(c), tg = GAME.loyaltyTarget(c), g = GAME.gen(c.governor);
    const tier = GAME.cityTier(c), next = DATA.CITY_TIERS[c.tier + 1];
    const tabs = [['gov', '内政'], ['mil', '军务'], ['trade', '海贸']];
    let h = `<div class="ph">${facSeal(c.f, '')}<div><h2>${cityTitle(c)}${c.cap ? ' <span class="chip red">都城</span>' : ''}</h2><div class="sub">户口 ${c.pop}/${tier.pop} 万 · 仓储 ${Math.round(c.store)}/${Math.round(GAME.growthTh(c))}</div></div><button class="x" data-act="desel">×</button></div>
      ${c.pop >= tier.pop ? `<div class="note city-pop-full">户口已盈，${next?.upgrade ? `须升为${next.name}方可续增` : `已达${tier.name}级上限`}。</div>` : ''}
      ${tier.vacantPct && !g ? '<div class="note">府无亲民之官，诸项产出减一成。</div>' : ''}
      <div class="stat"><div><b class="${y.food - y.foodNeed >= 0 ? 'pos' : 'neg'}">${sgn(y.food - y.foodNeed)}</b><span>余粮/季</span></div><div><b>${y.prod}</b><span>工/季</span></div><div><b>${y.gold}</b><span>钱/季${y.trade ? '(贸' + y.trade + ')' : ''}</span></div><div><b>${y.sci}</b><span>文/季</span></div></div>
      <div class="row"><span>民心 ${Math.round(c.loyalty)}</span><div class="grow">${meter(c.loyalty, 100, c.loyalty < 30 ? 'red' : '')}</div><span class="cost">趋向 ${tg}</span></div>
      <div class="row"><span>城防 ${Math.round(c.wall)}/${GAME.maxWall(c)}</span><div class="grow">${meter(c.wall, GAME.maxWall(c), 'gold')}</div></div>
      <div class="tabs">${tabs.map(([k, n]) => `<button data-act="ctab" data-arg="${k}" class="${cityTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    if (cityTab === 'gov') {
      h += cityDevelopment(c);
      h += `<div class="sec">营造队列 ${c.queue.length ? `<span class="r"><button class="btn sm" data-act="hurry" ${GAME.fac(P()).gold < GAME.hurryCost(c) ? 'disabled' : ''}>加急 ${GAME.hurryCost(c)} 贯</button></span>` : ''}</div>`;
      let rounds = 0;
      h += c.queue.length ? c.queue.map((q, k) => {
        const work = Math.max(0, q.cost - q.prog);
        if (y.prod > 0) rounds += Math.max(1, Math.ceil(work / (y.prod * GAME.E())));
        const duration = y.prod > 0 ? '约需 ' + +(rounds * GAME.E()).toFixed(2) + ' 季' : '工事暂滞';
        return `<div class="row"><span class="grow">${cityQueueName(c, q)}<br>${meter(q.prog, q.cost, 'gold')}</span><span class="cost">${duration}</span><button class="btn sm" data-act="deq" data-arg="${k}">撤</button></div>`;
      }).join('') : '<div class="note">空闲——请择一项营建或征兵。</div>';
      {
        const gold = GAME.fac(P()).gold, rk = GAME.reliefCost(c), mk = GAME.migrateCost(c);
        const rOk = GAME.reliefReady(c), mOk = GAME.migrateOk(c);
        const mWhy = c.cap ? '都城不须' : c.pop >= Math.min(12, tier.pop) ? '户口已足' : '两年一次';
        h += `<div class="sec">安民</div><div class="btns">
          <button class="btn sm" data-act="relief" ${rOk && gold >= rk ? '' : 'disabled'} title="民心 +15，民变之势 −15；一年一次">赈济 ${rk} 贯${rOk ? '' : '（一年一次）'}</button>
          <button class="btn sm" data-act="migrate" ${mOk && gold >= mk ? '' : 'disabled'} title="户口 +1 万；户口十二万以下、非都城，两年一次">移民实边 ${mk} 贯${mOk ? '' : '（' + mWhy + '）'}</button></div>`;
      }
      h += `<div class="sec">知州</div>`;
      h += g ? `<div class="row">${PORTRAIT.img(g, 34)}<span class="grow">${g.name}　政 ${g.zheng}${g.skill ? ' <span class=skill>' + g.skill + '</span>' : ''}</span><button class="btn sm" data-act="govoff">卸任</button></div>` : `<div class="row"><span class="grow note">无人主政</span><button class="btn sm" data-act="govpick">任命</button></div>`;
      const buildings = Object.keys(c.buildings).filter(b => c.buildings[b]);
      const reserved = c.queue.filter(q => q.kind === 'b').length;
      h += `<div class="sec">已建 ${buildings.length}/${Number.isFinite(tier.buildings) ? tier.buildings : '不限'}${reserved ? ` · 营造中 ${reserved}` : ''}</div><div class="chips">${buildings.map(b =>
        `<button type="button" class="btn sm" data-act="demolish" data-arg="${b}" title="${B[b].desc}">拆 ${B[b].name}</button>`).join('') || '<span class="note">无</span>'}</div>`;
      h += `<div class="sec">可营建</div>`;
      if (GAME.buildingFull(c)) h += '<div class="note city-buildings-full">建筑已满，升等或拆除后方可再建。</div>';
      for (const b of GAME.buildOptions(c)) {
        const cost = GAME.buildingCost(c, b);
        h += `<div class="row click" data-act="build" data-arg="${b}"><span class="grow"><b>${B[b].name}</b><br><span class="note">${B[b].desc}</span></span><span class="cost">工 ${cost}<br>约 ${Math.ceil(cost / Math.max(0.1, y.prod * GAME.E()))} ${TU()}</span></div>`;
      }
    } else if (cityTab === 'mil') {
      const cap = c.garrison.length;
      const gcap = GAME.garrisonCap(c);
      h += `<div class="sec">守军（${cap}/${gcap} 营）${cap > gcap ? '<span class="neg">超编，可遣散</span>' : ''}</div>`;
      const picked = selectedUnits(c).length;
      const actions = `<button class="btn sm red" data-act="form">组建军团${picked ? '（' + picked + '）' : ''}</button><button class="btn sm" data-act="dismiss-garrison" ${picked ? '' : 'disabled'}>遣散所选</button>`;
      h += unitPanel(c, actions);
      if (cap) h += `<div class="note">点选守军营后组建军团（不选则全选）。围城时守军停补，平时每季休整 +${DATA.UNIT_RECOVERY.garrison}，耗用丁口。</div>`;
      const a = GAME.armyAt(c.tile);
      if (a && a.f === P()) h += `<div class="row click" data-act="selarmy" data-arg="${a.id}"><span class="grow">城中驻有：<b>${esc(GAME.armyName(a))}</b>（${a.units.length} 营）</span><span class="cost">选取 ›</span></div>`;
      h += `<div class="sec">征兵</div>`;
      for (const u of GAME.unitOptions(c)) {
        const k = GAME.unitCost(c, u), ok = GAME.canAffordUnit(c, u);
        h += `<div class="row ${ok ? 'click' : ''}" ${ok ? `data-act="recruit" data-arg="${u}"` : ''} style="${ok ? '' : 'opacity:.45'}">${UNITART.img(P(), u, 52, 'big')}<span class="grow"><b>${unitName(P(), u)}</b>${U[u].home ? ' <span class="chip">本地</span>' : ''} <span class="note">攻${U[u].atk} 守${U[u].def} 行${U[u].mv}</span><br><span class="note">${U[u].desc}</span></span><span class="cost">钱${k.gold} 兵${k.man}${k.horse ? ' 马' + k.horse : ''}${k.iron ? ' 铁' + k.iron : ''}<br>工${k.prod}·${Math.ceil(k.prod / Math.max(0.1, y.prod * GAME.E()))}${TU()}</span></div>`;
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
    return `<div class="ph">${facSeal(c.f, '')}<div><h2>${cityTitle(c)}</h2><div class="sub"><button type="button" class="record-link" data-act="nation" data-arg="${c.f}">${esc(facName(c.f))}</button> · ${c.cap ? '都城' : '城池'}</div></div><button class="x" data-act="desel">×</button></div>
      <div class="stat"><div><b>${c.pop}</b><span>户口</span></div><div><b>${vis ? Math.round(c.wall) : '?'}</b><span>城防</span></div><div><b>${vis ? c.garrison.length : '?'}</b><span>守军(营)</span></div><div><b>${c.f === 'rebel' ? '—' : Math.round(GAME.getRel(P(), c.f).op)}</b><span>好感</span></div></div>
      <p>关系：${c.f === 'rebel' ? '<span class=neg>乱军</span>' : relText(c.f)}</p>
      ${vis ? '' : '<p class="note">此城不在视野之内，所见为旧日情报。</p>'}
      <div class="btns"><button class="btn" data-act="dip">外交</button></div>`;
  }
  function genBlock(g, f) {
    if (!g) return `<div class="row"><span class="gseal" style="background:#777">军</span><span class="grow">偏师（无主将）<br><span class="note">统兵上限 4 营，战力 -10%</span></span></div>`;
    return `<div class="row card-link" data-act="genview" data-arg="${g.id}">${PORTRAIT.img(g, 64, 'alt=""')}<div class="grow"><button class="record-link" type="button"><b>${esc(g.name)}</b></button>${g.hist ? ' <span class="chip">史</span>' : ''} <span class="note">${S().year - g.birth}岁</span><br>
      <span class="gstats">统<b>${g.tong}</b> 武<b>${g.wu}</b> 智<b>${g.zhi}</b> 政<b>${g.zheng}</b></span>
      <div style="display:flex;align-items:center;gap:6px;font-size:12px">Lv${g.lv || 1}<div class="grow" style="flex:1">${meter((g.exp || 0) - 0, GAME.nextLv(g), 'gold')}</div><span class="cost">${Math.round(g.exp || 0)}/${GAME.nextLv(g)}</span></div>
      ${GAME.skillList(g).map(k => `<span class="skill" title="${esc(DATA.SKILLS[k] || '')}">【${esc(k)}】</span>`).join('')}${(g.items || []).map(i => `<span class="chip" title="${esc(DATA.ITEMS[i].desc)}">${esc(DATA.ITEMS[i].name)}</span>`).join(' ')}</div></div>`;
  }
  function armyHTML(a) {
    const c = GAME.cityAt(a.tile), inOwn = c && c.f === P();
    const near = S().armies.filter(o => o !== a && o.f === P() && GEO.dist(o.tile, a.tile) === 1);
    const fortHint = '驻守满一回合，守方战力 +10%；在本国城中，士气恢复 +50%。';
    const dismissal = GAME.dismissalReason(a);
    const locked = dismissal ? `disabled title="${esc(dismissal)}"` : '';
    let h = `<div class="ph"><div><h2>${esc(GAME.armyName(a))}</h2><div class="sub">${a.units.length}/${GAME.armyCap(a)} 营 · ${fmt(GAME.sumStr(a.units))} 人${inOwn ? ' · 驻' + c.name : ''}</div></div><button class="x" data-act="desel">×</button></div>`;
    h += genBlock(GAME.gen(a.gen), a.f);
    h += `<div class="row"><span>士气 ${Math.round(a.morale)}</span><div class="grow">${meter(a.morale, 100, a.morale < 40 ? 'red' : '')}</div><span class="cost">行军力 ${Math.round(a.mp * 10) / 10}/${Math.round(GAME.armyMP(a) * 10) / 10}</span></div>`;
    h += `<div class="btns"><button class="btn ${moveMode ? 'red' : ''}" data-act="movemode">行军${kb('M')}</button>${a.path && a.path.length ? `<button class="btn red" data-act="cont" ${a.mp > 0 ? '' : 'disabled'}>继续行军${kb('C')}</button><button class="btn" data-act="stop">取消路线</button>` : ''}<button class="btn" data-act="sentry" aria-pressed="${!!a.sentry}" title="${fortHint}">驻守（筑垒）${kb('␣')}</button><button class="btn" data-act="reward" ${GAME.rewardReady(a) && GAME.fac(P()).gold >= GAME.rewardCost(a) ? '' : 'disabled'} title="士气 +30，主将经验 +15；两季一次">犒军 ${GAME.rewardCost(a)} 贯</button><button class="btn" data-act="genpick">${a.gen != null ? '换将' : '任将'}</button>${inOwn ? '<button class="btn" data-act="disband" title="诸营并入守军，每营每季军饷编内 0.8 贯、超编 1.6 贯">解散入城</button>' : ''}<button class="btn" data-act="dismiss-army" ${locked}>遣散全军</button></div>`;
    h += `<p class="note">${a.fortT != null ? (GAME.fortified(a) ? '已筑垒。' : '筑垒中。') : ''}${fortHint}</p>`;
    const exposure = GAME.expeditionRate(a);
    if (exposure) h += `<p class="neg">水土不服，每季损员 ${Math.round(exposure * 100)}%${GEO.terrain[a.tile] === GEO.T.TUNDRA ? '（仅计冬日）' : ''}。</p>`;
    if (GAME.canSail(a)) h += `<p class="note">舟师足以载军，可横渡江海。</p>`;
    h += `<div class="sec">各营</div><div class="note army-upkeep">每季军饷 ${upkeepText(GAME.armyUpkeep(a))}</div>`;
    if (dismissal) h += `<div class="note neg">${esc(dismissal)}</div>`;
    h += unitPanel(a, '', locked);
    if (inOwn && c.garrison.length && a.units.length < GAME.armyCap(a)) {
      h += `<div class="sec">城中守军可补入</div>`;
      h += c.garrison.map((u, i) => `<div class="row click" data-act="toArmy" data-arg="${i}">${UNITART.img(P(), u.t, 34)}<span class="grow">${unitName(P(), u.t)}　${fmt(u.s * 5)} 人</span><span class="cost">补入 ›</span></div>`).join('');
    }
    if (near.length) h += `<div class="sec">相邻友军</div>` + near.map(o => `<div class="row"><span class="grow">${esc(GAME.armyName(o))}（${o.units.length} 营）</span><button class="btn sm" data-act="merge" data-arg="${o.id}">并入本军</button></div>`).join('');
    h += `<p class="note">${TOUCH.matches ? '轻点目标格看路线，再点一次（或点「出发」）即行军' : '选中后右键目标格行军，或左键点两次'}；目标为交战之敌则进攻。</p><p class="note">${recoveryText()}</p>`;
    return h;
  }
  function foreignArmyHTML(a) {
    const g = GAME.gen(a.gen);
    const cnt = {}; for (const u of a.units) cnt[u.t] = (cnt[u.t] || 0) + 1;
    return `<div class="ph">${facSeal(a.f, '')}<div><h2>${esc(GAME.armyName(a))}</h2><div class="sub">【${facName(a.f)}】${a.units.length} 营 · ${fmt(GAME.sumStr(a.units))} 人</div></div><button class="x" data-act="desel">×</button></div>
      ${genBlock(g, a.f)}
      <div class="chips">${Object.entries(cnt).map(([t, n]) => `<span class="chip uchip">${UNITART.img(a.f, t, 22)}${unitName(a.f, t)}×${n}</span>`).join('')}</div>
      <p>关系：${a.f === 'rebel' ? '<span class=neg>乱军</span>' : relText(a.f)}　士气 ${Math.round(a.morale)}</p>`;
  }

  function dismissSelected(owner, indices) {
    const result = GAME.dismissUnits(owner, indices);
    if (!result.ok) { toast(result.msg); return; }
    unitPick.clear();
    if (owner.units && !GAME.army(owner.id)) {
      const c = GAME.cityAt(owner.tile);
      select(c?.f === P() ? { type: 'city', id: c.id, tile: c.tile } : null);
    } else {
      showSavedPath(); refreshSide(); RENDER.markDirty();
    }
    refreshTop();
    const detail = result.abroad ? '客军散于异域，无可收还' : `收还丁口 ${fmtAmount(result.man)}`;
    toast(`已遣散 ${result.indices.length} 营。${detail}。`);
  }
  function confirmDismissArmy(a) {
    const indices = a.units.map((u, i) => i);
    const info = GAME.dismissalInfo(a, indices);
    if (!info.ok) { toast(info.msg); return; }
    const detail = info.abroad ? '客军散于异域，无可收还。' : `可收还丁口 ${fmtAmount(info.man)}。`;
    confirmBox(`遣散全军 ${indices.length} 营，每季可省${upkeepText(info.upkeep)}。${detail}可准此议？`, () => dismissSelected(a, indices));
  }
  function finishUnitOrder(result, text) {
    if (!result.ok) { toast(result.msg); return; }
    unitPick.clear();
    showSavedPath();
    refreshSide();
    refreshTop();
    RENDER.markDirty();
    toast(text(result));
  }

  // ---------- 动作 ----------
  function act(k, arg, el, ev) {
    const F = S() ? GAME.fac(P()) : null;
    const c = sel && sel.type === 'city' ? GAME.city(sel.id) : null;
    const a = sel && sel.type === 'army' ? GAME.army(sel.id) : null;
    switch (k) {
      case 'sound': toggleSound(); break;
      case 'menutoggle': setMenu(el.getAttribute('aria-expanded') !== 'true'); break;
      case 'maptoggle': setMini(el.getAttribute('aria-expanded') !== 'true'); break;
      case 'drawertoggle': setDrawer(el.getAttribute('aria-expanded') !== 'true'); break;
      case 'terrain': showTileTerrain(+arg); break;
      case 'inspect-town': {
        const town = GAME.cityAt(sel?.tile);
        if (town) select({ type: 'city', id: town.id, tile: town.tile });
        break;
      }
      case 'inspect-army': {
        const unit = GAME.armyAt(sel?.tile);
        if (unit && (unit.f === P() || S().visible[unit.tile])) select({ type: 'army', id: unit.id, tile: unit.tile });
        break;
      }
      case 'zoomin': zoomCenter(1.2); break;
      case 'zoomout': zoomCenter(1 / 1.2); break;
      case 'cancelpreview': cancelPreview(); break;
      case 'go': if (pendingTarget >= 0) orderMove(pendingTarget); break;
      case 'desel': select(null); break;
      case 'ctab': cityTab = arg; refreshSide(); break;
      case 'build': if (GAME.queueBuilding(c.id, arg)) guide('build'); refreshSide(); break;
      case 'city-upgrade': if (c?.f === P() && GAME.queueTier(c.id)) refreshSide(); break;
      case 'city-role-menu': if (c?.f === P()) showCityRoles(c); break;
      case 'city-role':
        if (c?.f === P() && GAME.setCityRole(c.id, arg)) { closeModal(); refreshSide(); refreshTop(); }
        break;
      case 'demolish':
        if (c?.f === P() && c.buildings[arg]) confirmBox(`拆除${c.name}的${B[arg].name}，可腾出一处，旧费不返。`, () => {
          GAME.demolishBuilding(c.id, arg); refreshSide(); refreshTop(); RENDER.markDirty();
        });
        break;
      case 'recruit': if (!GAME.queueUnit(c.id, arg)) toast('钱粮兵马不足'); else guide('recruit'); refreshSide(); refreshTop(); break;
      case 'deq': GAME.dequeue(c.id, +arg); refreshSide(); refreshTop(); break;
      case 'hurry': if (GAME.hurry(c.id)) toast('已加急，下季完工'); refreshSide(); refreshTop(); break;
      case 'relief': GAME.relief(c.id); refreshSide(); refreshTop(); break;
      case 'migrate': GAME.migrate(c.id); refreshSide(); refreshTop(); break;
      case 'reward': GAME.rewardArmy(a.id); refreshSide(); refreshTop(); break;
      case 'donate': { const d = GAME.donateInfo(P()); const n = arg === 'all' ? d.left : Math.ceil(d.cap / 4); const got = GAME.donate(P(), n); if (!got) toast('本季已捐满或国库不足'); showTech(); refreshTop(); break; }
      case 'govpick': pickGeneral('任命知州', g => true, g => g.zheng, gid => { GAME.assignGovernor(gid, c.id); guide('gov'); refreshSide(); }); break;
      case 'govoff': GAME.unassign(c.governor); refreshSide(); break;
      case 'gpick':
      case 'apick': {
        const u = (a?.units || c?.garrison)?.[+arg];
        if (u) { unitPick.has(u) ? unitPick.delete(u) : unitPick.add(u); refreshSide(); }
        break;
      }
      case 'reinforce-unit':
      case 'reinforce-all': {
        const result = GAME.reinforceUnits(a || c, k === 'reinforce-all' ? null : [+arg]);
        finishUnitOrder(result, r => `已补足 ${r.indices.length} 营，费${refillCostText(r.cost)}。`);
        break;
      }
      case 'consolidate-units': {
        const owner = a || c;
        finishUnitOrder(GAME.consolidateUnits(owner, selectedUnits(owner)), r => `已合 ${r.indices.length} 营为 ${r.retained} 营。`);
        break;
      }
      case 'dismiss-garrison': dismissSelected(c, selectedUnits(c)); break;
      case 'form': {
        if (GAME.armyAt(c.tile)) { toast('城中已驻一军，请先令其出城或将守军补入该军'); break; }
        const picked = selectedUnits(c), idx = picked.length ? picked : c.garrison.map((u, i) => i);
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
      case 'contall-panel': closeModal(); continueAll(); break;
      case 'nextidle': nextIdle(); break;
      case 'sentry': if (a && a.f === P()) sentryOrder(a); break;
      case 'genpick': pickGeneral(a.gen != null ? '更换主将' : '任命主将', g => true, g => g.tong, gid => { GAME.setArmyGeneral(a.id, gid); refreshSide(); }, true); break;
      case 'disband': GAME.disband(a.id); select({ type: 'city', id: GAME.cityAt(sel.tile).id, tile: sel.tile }); break;
      case 'dismiss-unit': dismissSelected(a, [+arg]); break;
      case 'dismiss-army': if (a) confirmDismissArmy(a); break;
      case 'toCity': GAME.transferToCity(a.id, +arg); if (!GAME.army(a.id)) select({ type: 'city', id: GAME.cityAt(sel.tile).id, tile: sel.tile }); else refreshSide(); RENDER.markDirty(); refreshTop(); break;
      case 'toArmy': if (!GAME.transferToArmy(a.id, +arg)) toast('军团已满'); refreshSide(); RENDER.markDirty(); refreshTop(); break;
      case 'merge': if (GAME.mergeArmies(a.id, +arg)) { refreshSide(); RENDER.markDirty(); refreshTop(); } break;
      case 'tech': showTech(); break;
      case 'treasury': showTreasury(); break;
      case 'settech': GAME.setResearch(P(), arg); guide('research'); showTech(); refreshTop(); break;
      case 'techfilter': techFilter = arg; showTech(); break;
      case 'techfold': {
        ev.preventDefault();
        const group = el.parentElement;
        group.open = !group.open;
        techFolds.set(arg, group.open);
        break;
      }
      case 'techcolumn': {
        const open = el.getAttribute('aria-expanded') !== 'true';
        techFolds.set('desktop:' + arg, open);
        el.setAttribute('aria-expanded', open);
        for (const col of $('modal').querySelectorAll(`.tech-era-cell[data-column="${arg}"] > div`)) col.classList.toggle('hidden', !open);
        break;
      }
      case 'techdesc': el.setAttribute('aria-expanded', el.getAttribute('aria-expanded') !== 'true'); break;
      case 'gens': showGenerals(); break;
      case 'genspage': if (arg === 'vault') showVault(); else showGenerals(); break;
      case 'genfilter': genFilter = arg; genPage = 0; showGenerals(); break;
      case 'genview': showGeneral(+arg); break;
      case 'dip': showDiplomacy(); break;
      case 'dipfilter': dipFilter = arg; showDiplomacy(); break;
      case 'nation': showNation(arg); break;
      case 'cities': showCities(); break;
      case 'city-filter': cityFilter = arg; showCities(); break;
      case 'city-sort': citySort = arg; showCities(); break;
      case 'armies': showArmies(arg); break;
      case 'chron': showChronicle(arg); break;
      case 'honors': showHonors(); break;
      case 'retire': confirmBox('禅位封卷，依当下功业结算本局。旧卷仍可从存档读取。', () => showSettlement('retire'), showSettings); break;
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
    if ($('modal-bg').classList.contains('hidden')) AUDIO.play('paper');
    modalLocked = !!opts.lock; modalOnClose = opts.onClose || null;
    const modal = $('modal');
    modal.onclick = null;
    modal.innerHTML = (opts.lock ? '' : '<button class="mclose" data-act="mclose" aria-label="关闭">×</button>') + '<div class="modal-content">' + html + '</div>';
    layoutText(modal);
    for (const table of modal.querySelectorAll('table.t')) {
      const scroll = document.createElement('div');
      scroll.className = 'table-scroll';
      table.replaceWith(scroll);
      scroll.append(table);
    }
    modal.style.width = opts.width || '';
    $('modal-bg').classList.remove('hidden');
  }
  const modalScroller = panel => phone.matches ? panel.closest('.modal-content') : panel;
  function closeModal() {
    if (!$('modal-bg').classList.contains('hidden')) AUDIO.play('paper');
    $('modal-bg').classList.add('hidden'); $('modal').innerHTML = '';
    const f = modalOnClose; modalOnClose = null; modalLocked = false;
    if (f) f();
    else setTimeout(processPending, 10);
  }
  function confirmBox(text, yes, cancel) {
    openModal(`<h1>请旨</h1><div class="story">${esc(text)}</div><div class="choices"><button class="choice" id="cy">准奏</button><button class="choice" id="cn">作罢</button></div>`, { width: '520px', onClose: cancel });
    $('cy').onclick = () => { modalOnClose = null; closeModal(); yes(); }; $('cn').onclick = closeModal;
  }
  function pickGeneral(title, filter, sortKey, cb, allowNone) {
    const list = S().generals.filter(g => g.f === P() && g.status === 'idle' && filter(g)).sort((x, y) => sortKey(y) - sortKey(x));
    const ready = '<p class="note">朝中暂无闲散之臣。可待科举取士、名士来投，或在将领名册中召回。</p>';
    const choose = id => `<button class="btn sm red" type="button" data-pg="${id}">选</button>`;
    if (phone.matches) {
      const cards = list.map(g => recordCard(
        `${PORTRAIT.img(g, 40, 'alt=""')}<button type="button" class="record-link" data-pg-gen="${g.id}">${generalName(g)}</button>
        <span class="note">${stanceTag(g)} · 可统 ${GAME.capFor(g.id)} 营</span>`,
        `<div class="chips">${generalStatChips(g)}</div>`, choose(g.id))).join('');
      const none = allowNone ? recordCard('<b>不设主将</b> <span class="note">可统 4 营</span>', '', choose(-1)) : '';
      openModal(`<h1>${title}</h1><div class="record-list">${none}${cards}${list.length ? '' : ready}</div>`, { width: '720px', onClose: () => {} });
    } else {
      let h = `<h1>${title}</h1><div class="scroll" style="max-height:60vh"><table class="t"><tr><th>姓名</th><th>年</th><th>统</th><th>武</th><th>智</th><th>政</th><th>特技</th><th>立场</th><th>统兵</th><th></th></tr>`;
      if (allowNone) h += `<tr><td>（不设主将）</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td>4</td><td><button class="btn sm" data-pg="-1">选</button></td></tr>`;
      for (const g of list) h += `<tr><td>${PORTRAIT.img(g, 30)} <b>${g.name}</b>${g.hist ? ' <span class=chip>史</span>' : ''}</td><td>${S().year - g.birth}</td><td>${g.tong}</td><td>${g.wu}</td><td>${g.zhi}</td><td>${g.zheng}</td><td>${GAME.skillList(g).map(k => `<span class="skill" title="${DATA.SKILLS[k]}">${k}</span>`).join(' ')}</td><td>${stanceTag(g)}</td><td>${GAME.capFor(g.id)}</td><td><button class="btn sm red" data-pg="${g.id}">选</button></td></tr>`;
      h += `</table>${list.length ? '' : ready}</div>`;
      openModal(h, { width: '720px', onClose: () => {} });
    }
    $('modal').onclick = e => {
      const info = e.target.closest('[data-pg-gen]');
      if (info) { showGeneral(+info.dataset.pgGen, { back: () => pickGeneral(title, filter, sortKey, cb, allowNone), readOnly: true }); return; }
      const b = e.target.closest('[data-pg]'); if (!b) return; const id = +b.dataset.pg;
      closeModal(); cb(id < 0 ? null : id); refreshTop();
    };
  }

  const TECH_BRANCHES = ['农桑', '工技', '兵学', '文治', '航海'];
  const techFolds = new Map();
  let techFilter = 'all';
  function filterTabs(action, label, choices, selected) {
    return `<div class="filter-tabs" role="group" aria-label="${label}">${choices.map(([id, name]) =>
      `<button type="button" class="btn ${selected === id ? 'red' : ''}" data-act="${action}" data-arg="${id}" aria-pressed="${selected === id}">${name}</button>`).join('')}</div>`;
  }
  function techCard({ id, t, known, can, cur }, sci) {
    const cost = GAME.techCost(P(), id);
    const name = `<b>${esc(t.name)}</b>`;
    const desc = esc(t.desc);
    const choose = `data-act="settech" data-arg="${id}"`;
    return `<article class="tech ${known ? 'known' : can ? 'avail' : 'lock'} ${cur ? 'cur' : ''}" ${can ? choose : ''}>
      <div class="tech-title">${can ? `<button type="button" class="tech-pick" ${choose}>${name}</button>` : name}
        ${known ? '<span class="note">已学</span>' : `<span class="cost">${cost}</span>`}</div>
      ${phone.matches ? `<p class="tech-desc">${desc}</p>` : `<button type="button" class="tech-desc" data-act="techdesc" title="${desc}" aria-expanded="false"><span>${desc}</span></button>`}
      ${t.req && !known ? `<span class="cost tech-req">需 ${t.req.map((r, i) => `<span class="keep">${esc(TECH[r].name)}${i + 1 < t.req.length ? '、' : ''}</span>`).join('')}</span>` : ''}
      ${cur ? meter(sci, cost, 'gold') : ''}</article>`;
  }
  function showTech() {
    const F = GAME.fac(P());
    const av = new Set(GAME.availableTechs(P()));
    const dn = GAME.donateInfo(P());
    const eras = (DATA.ERAS || ['', '中兴', '开海', '万国']).slice(1);
    const techs = Object.entries(TECH).map(([id, t]) => ({ id, t, known: !!F.techs[id], can: av.has(id), cur: F.research === id }));
    techs.sort((a, b) => a.t.cost - b.t.cost);
    const branchTech = TECH_BRANCHES.map(branch => techs.filter(x => x.t.branch === branch));
    const active = TECH[F.research]?.branch || branchTech.find(group => group.some(x => x.can))?.[0]?.t.branch || TECH_BRANCHES[0];
    const filtered = list => list.filter(x => techFilter === 'all' || (techFilter === 'available' ? x.can : x.known));
    const cards = list => filtered(list).map(x => techCard(x, F.sci)).join('');
    const branchTitle = (br, entries) => `<b>${br}</b> <span class="note">已学 ${entries.filter(x => x.known).length} / 共 ${entries.length}</span>
      ${entries.some(x => x.cur) ? '<span class="tech-current" aria-label="研究中">研</span>' : ''}`;
    const eraTech = (entries, index) => entries.filter(x => (x.t.era || 1) === index + 1);
    const mobileBranch = (br, index) => {
      const entries = branchTech[index];
      return `<details class="tech-branch" ${(techFolds.get(br) ?? (br === active)) ? 'open' : ''}>
        <summary data-act="techfold" data-arg="${br}">${branchTitle(br, entries)}</summary>
        ${eras.map((era, i) => {
          const list = eraTech(entries, i), content = cards(list);
          if (!content) return '';
          const key = br + ':' + i, open = techFolds.get(key) ?? !list.every(x => x.known);
          return `<details class="tech-era" ${open ? 'open' : ''}><summary data-act="techfold" data-arg="${key}">${era}</summary>${content}</details>`;
        }).join('') || '<p class="note">此分支暂无符合条件的科技。</p>'}</details>`;
    };
    const desktopOpen = TECH_BRANCHES.map((_, i) => techFolds.get('desktop:' + i) ?? true);
    const desktopTree = () => `<div class="techgrid tech-columns">${TECH_BRANCHES.map((br, i) =>
      `<button class="tech-column" type="button" data-act="techcolumn" data-arg="${i}" aria-expanded="${desktopOpen[i]}">${branchTitle(br, branchTech[i])}</button>`).join('')}</div>
      ${eras.map((era, i) => {
        const row = branchTech.map(entries => cards(eraTech(entries, i)));
        if (!row.some(Boolean)) return '';
        return `<section class="tech-era-row"><h2>${era}</h2><div class="techgrid">${row.map((content, col) =>
          `<div class="tech-era-cell" data-column="${col}"><div ${desktopOpen[col] ? '' : 'class="hidden"'}>${content}</div></div>`).join('')}</div></section>`;
      }).join('')}`;
    const h = `<h1>格物致知</h1><div class="note tech-intro">每季文教 ${F.income.sci || 0}　已积 ${Math.round(F.sci)}</div>
      <div class="note tech-intro">捐资助学 · 每 ${dn.rate} 贯折文教 1，本季尚可捐 ${dn.left}（上限为半季文教）
        <div class="tech-donations"><button class="btn sm" data-act="donate" data-arg="part" ${dn.left && F.gold >= dn.rate ? '' : 'disabled'}>捐 ${Math.min(dn.left, Math.ceil(dn.cap / 4)) * dn.rate} 贯</button>
        <button class="btn sm" data-act="donate" data-arg="all" ${dn.left && F.gold >= dn.rate ? '' : 'disabled'}>尽捐 ${dn.cost} 贯</button></div></div>
      ${filterTabs('techfilter', '科技筛选', [['all', '全部'], ['available', '只看可研'], ['known', '只看已学']], techFilter)}
      <div class="scroll tech-tree">${phone.matches ? TECH_BRANCHES.map(mobileBranch).join('') : desktopTree()}</div>`;
    openModal(h, { width: '1040px' });
  }

  const GEN_STATUSES = [['idle', '候命'], ['army', '统军'], ['gov', '知州'], ['court', '朝臣']];
  const GEN_SORT = [
    ['total', '综合', g => g.tong + g.wu + g.zhi + g.zheng],
    ...Object.entries(GAME.STAT_NAME).map(([k, title]) => [k, title, g => g[k]]),
    ['lv', '级', g => g.lv || 1], ['loyalty', '忠诚', g => g.loyalty ?? 0], ['wins', '战绩', g => g.wins || 0],
    ['age', '年龄', g => S().year - g.birth],
  ];
  const GEN_PAGE_SIZE = 48;
  let genFilter = 'all', genSort = 'total', genDir = -1, genPage = 0;
  function recordCard(head, detail, buttons, attrs = '') {
    return `<article class="record-card ${attrs ? 'card-link' : ''}" ${attrs}><div class="record-head">${head}</div>
      ${detail}${buttons ? `<div class="record-actions">${buttons}</div>` : ''}</article>`;
  }
  function sortControl(key, heading) {
    const current = genSort === key;
    return `<button type="button" class="${phone.matches ? 'btn sort-chip' : 'record-link'} ${current ? 'selected-sort' : ''}" data-g-sort="${key}"
      aria-pressed="${current}">${heading}${current ? (genDir < 0 ? ' ▼' : ' ▲') : ''}</button>`;
  }
  function generalStatChips(g) {
    return Object.entries(GAME.STAT_NAME).map(([key, label]) => `<span class="chip ${genSort === key ? 'red gen-sort-stat' : ''}">${label} <b>${g[key]}</b></span>`).join('');
  }
  function statusText(g) {
    if (g.status === 'army') { const a = GAME.army(g.loc); return a ? '统 ' + esc(GAME.armyName(a)) : '统军'; }
    if (g.status === 'gov') return '知 ' + esc(GAME.city(g.loc)?.name || '州府');
    if (g.status === 'idle') return '<span class="pos">候命</span>';
    if (g.status === 'court') { const o = COURT.OFFICES.find(o => o.id === COURT.officeOf(g)); return '<span class="skill">' + (o ? o.name : '朝臣') + '</span>'; }
    if (g.status === 'captive') {
      const where = generalLocation(g);
      return '陷于' + esc(facName(g.capBy)) + ' · ' + (where ? esc(GAME.city(where.id).name) : '下落未明');
    }
    return { dead: '已故', future: '未出仕', gone: '离任', cand: '待选' }[g.status] || '未详';
  }
  function captiveTenure(g) {
    const days = Math.max(0, Math.round(S().T * 90) - Math.round((g.capT ?? S().T) * 90));
    const seasons = Math.floor(days / 90), remainder = days % 90;
    return days ? '被俘 ' + [seasons && seasons + ' 季', remainder && remainder + ' 日'].filter(Boolean).join(' ') : '新近被俘';
  }
  function stanceTag(g) { COURT.ensure(g); const c = g.stance === 'war' ? 'neg' : g.stance === 'peace' ? 'pos' : ''; return `<span class="${c}">${COURT.STANCE_NAME[g.stance]}</span>`; }
  function generalName(g) {
    return `<b>${esc(g.name)}</b>${g.hist ? ' <span class="chip">史</span>' : ''}`;
  }
  function generalTags(g) {
    return GAME.skillList(g).map(k => `<span class="skill" title="${esc(DATA.SKILLS[k] || '')}">${esc(k)}</span>`).join(' ') +
      (g.items || []).map(i => ` <span class="chip" title="${esc(DATA.ITEMS[i].desc)}">${esc(DATA.ITEMS[i].name)}</span>`).join('');
  }
  function generalLocation(g) {
    if (g.status === 'army') {
      const a = GAME.army(g.loc);
      if (a && (a.f === P() || S().visible[a.tile])) return { type: 'army', id: a.id, tile: a.tile };
    }
    if (g.status === 'gov') {
      const c = GAME.city(g.loc);
      if (c && (c.f === P() || S().explored[c.tile])) return { type: 'city', id: c.id, tile: c.tile };
    }
    if (g.status === 'captive') {
      const c = GAME.city(g.jail);
      if (c && c.f === g.capBy && S().explored[c.tile]) return { type: 'city', id: c.id, tile: c.tile };
    }
    return null;
  }
  function generalButtons(g, detail = false, readOnly = false) {
    const button = (k, text, extra = '') => `<button type="button" class="btn sm ${k === 'recruit' || k === 'assign' ? 'red' : ''}" data-g="${k}" data-id="${g.id}" ${extra}>${text}</button>`;
    if (g.status === 'captive' && g.capBy === P() && !readOnly) {
      return button('recruit', '招降') + button('release', '释放') + button('exec', '斩');
    }
    if (g.status === 'captive' && g.f === P() && !readOnly) {
      return button('ransom', '赎回') + button('exchange', '换俘') + (!detail && generalLocation(g) ? button('find', '寻') : '');
    }
    if (readOnly || g.f !== P() || !GEN_STATUSES.some(([status]) => status === g.status)) return '';
    const rank = detail ? COURT.rankTerms(g) : null;
    return button('reward', '赏', 'aria-label="赏赐 50 贯" title="赏赐 50 贯，忠诚 +12"') +
      (rank ? button('rank', '封爵', `title="${rank.requirements}" ${rank.reason ? 'disabled' : ''}`) : '') +
      (g.status === 'idle' ? button('gov', '任知州') + (detail ? button('assign', '任将') : '') : button('recall', '召回')) +
      (generalLocation(g) ? button('find', '寻') : '');
  }
  function pickExchange(g, redraw) {
    const options = GAME.exchangeOptions(g);
    const rows = options.map(({ prisoner, cost }) => `<button type="button" class="choice" data-exchange="${prisoner.id}">${esc(prisoner.name)}
      <small>${cost ? '须补钱 ' + cost + ' 贯' : '以将易将，无须补钱'}</small></button>`).join('');
    openModal(`<h1 class="captive-exchange">择将换俘</h1><p class="note">与【${esc(facName(g.capBy))}】换回${esc(g.name)}，各遣其将归国。</p>
      <div class="scroll" style="max-height:56vh">${rows ? '<div class="choices">' + rows + '</div>' : '<p class="note">我朝手中并无该国俘将。</p>'}</div>
      <div class="record-actions"><button type="button" class="btn" data-general-back>返回</button></div>`, { width: '540px', onClose: redraw });
    $('modal').onclick = e => {
      if (e.target.closest('[data-general-back]')) { redraw(); return; }
      const chosen = e.target.closest('[data-exchange]');
      if (!chosen) return;
      const result = GAME.exchangeCaptive(g.id, +chosen.dataset.exchange);
      if (result.ok) { refreshTop(); refreshSide(); redraw(); }
      else toast(result.msg);
    };
  }
  function handleGeneralAction(k, id, redraw) {
    const g = GAME.gen(id);
    if (k === 'rank') {
      const terms = COURT.rankTerms(g);
      if (!terms || terms.reason) return;
      confirmBox(`晋封${g.name}为${terms.name}，费钱 ${terms.cost} 贯，忠诚 +${terms.loyalty}。`, () => {
        const result = COURT.grantRank(g);
        if (result.ok) AUDIO.play('rank');
        toast(result.msg); refreshTop(); refreshSide(); redraw();
      }, redraw);
      return;
    }
    if (k === 'find') {
      const where = generalLocation(g);
      if (where) { closeModal(); select(where); RENDER.centerOn(where.tile); }
      return;
    }
    if (k === 'ransom') {
      const { cost, chance, reason } = GAME.ransomInfo(g);
      if (reason) { toast(reason); return; }
      const terms = GAME.atWar(P(), g.capBy) ? `许赎约 ${Math.round(chance * 100)}%，不允则不费国帑，一季内不可再请。`
        : '两国未交兵，对方有意许赎。';
      confirmBox(`遣使赎${g.name}，若得归朝，须付钱 ${cost} 贯。\n${terms}`, () => {
        const result = GAME.ransomCaptive(id);
        if (!result.ok) toast(result.msg);
        refreshTop(); refreshSide(); redraw();
      }, redraw);
      return;
    }
    if (k === 'exchange') { pickExchange(g, redraw); return; }
    if (k === 'gov') {
      pickCity('任 ' + g.name + ' 为知州', () => true, cid => {
        if (GAME.assignGovernor(id, cid)) { guide('gov'); toast(`${g.name}出知${GAME.city(cid).name}`); }
        redraw();
      }, redraw);
      return;
    }
    if (k === 'assign') { pickArmyFor(g, redraw); return; }
    if (k === 'recall') GAME.unassign(id);
    if (k === 'reward') {
      if (COURT.reward(id)) { AUDIO.play('coin'); toast(`赏赐${g.name}，忠诚升至 ${Math.round(g.loyalty)}`); guide('reward'); }
      else toast('国库不足');
    }
    if (k === 'recruit') {
      const r = GAME.recruitCaptive(id, P());
      toast(r ? `${g.name}感恩归降！` : `${g.name}不屈，拒降。`);
    }
    if (k === 'release') { GAME.releaseCaptive(id); toast(`释放${g.name}，敌国感念`); }
    if (k === 'exec') { GAME.executeCaptive(id); toast(`斩${g.name}于市`); }
    refreshTop(); refreshSide(); RENDER.markDirty();
    redraw();
  }
  function showGenerals() {
    const seats = GAME.citiesOf(P()), filled = seats.filter(c => c.governor != null).length, vacancies = seats.length - filled;
    const mine = S().generals.filter(g => g.f === P() && GEN_STATUSES.some(([status]) => status === g.status)).map(g => COURT.ensure(g));
    const missing = S().generals.filter(g => g.f === P() && g.status === 'captive');
    const caps = S().generals.filter(g => g.status === 'captive' && g.capBy === P());
    const value = GEN_SORT.find(([id]) => id === genSort)[2];
    const roster = mine.filter(g => genFilter === 'all' || g.status === genFilter)
      .sort((a, b) => genDir * (value(a) - value(b)) || a.id - b.id);
    const pages = phone.matches && innerHeight >= innerWidth ? Math.max(1, Math.ceil(roster.length / GEN_PAGE_SIZE)) : 1;
    genPage = Math.min(genPage, pages - 1);
    const cards = pages > 1 ? roster.slice(genPage * GEN_PAGE_SIZE, (genPage + 1) * GEN_PAGE_SIZE) : roster;
    const pager = pages > 1 ? `<nav class="btns" aria-label="百官分页">
      <button type="button" class="btn sm" data-g-page="${genPage - 1}" ${genPage === 0 ? 'disabled' : ''}>上一页</button>
      <span class="note">${genPage + 1} / ${pages}</span>
      <button type="button" class="btn sm" data-g-page="${genPage + 1}" ${genPage === pages - 1 ? 'disabled' : ''}>下一页</button>
    </nav>` : '';
    const filters = [['all', '全部 ' + mine.length], ...GEN_STATUSES.map(([id, title]) => [id, title + ' ' + mine.filter(g => g.status === id).length])];
    const sortHead = (key, label) => `<th aria-sort="${genSort === key ? (genDir < 0 ? 'descending' : 'ascending') : 'none'}">${sortControl(key, label)}</th>`;
    const desktopName = g => `${PORTRAIT.img(g, 30, 'alt=""')} <button type="button" class="record-link">${generalName(g)}</button>`;
    const card = g => recordCard(
      `${PORTRAIT.img(g, 44, 'alt=""')} <div class="record-name"><button type="button" class="record-link">${generalName(g)}</button>
       <span class="note">${g.status === 'captive' ? g.f === P() ? statusText(g) + ' · ' + captiveTenure(g) : esc(facName(g.f)) + ' · 被俘' : statusText(g)}</span></div><span class="chip">Lv ${g.lv || 1}</span>`,
      `<div class="chips">${generalStatChips(g)}</div>${generalTags(g) ? `<div class="record-tags">${generalTags(g)}</div>` : ''}`,
      generalButtons(g), `data-general="${g.id}"`);
    const list = phone.matches ? `${pager}<div class="record-list">${cards.map(card).join('')}</div>${pager}` :
      `<table class="t general-table"><tr><th>姓名</th>${sortHead('total', '综合')}${sortHead('age', '年')}${sortHead('lv', '级')}
        ${Object.entries(GAME.STAT_NAME).map(([k, n]) => sortHead(k, n)).join('')}<th>特技 / 宝物</th><th>立场</th>${sortHead('loyalty', '忠诚')}<th>职守</th>${sortHead('wins', '战绩')}<th></th></tr>
      ${roster.map(g => `<tr class="card-link" data-general="${g.id}"><td>${desktopName(g)}</td><td>${GEN_SORT[0][2](g)}</td>
        <td>${S().year - g.birth}</td><td>${g.lv || 1}</td>${Object.keys(GAME.STAT_NAME).map(k => `<td>${g[k]}</td>`).join('')}
        <td>${generalTags(g)}</td><td>${stanceTag(g)}</td><td class="${g.loyalty < 40 ? 'neg' : ''}">${Math.round(g.loyalty)}${g.loyal ? ' 忠' : ''}</td>
        <td>${statusText(g)}</td><td>${g.wins || 0} 胜</td><td class="record-actions-cell">${generalButtons(g)}</td></tr>`).join('')}</table>`;
    const captiveList = phone.matches ? `<div class="record-list">${caps.map(card).join('')}</div>` :
      `<table class="t"><tr><th>姓名</th><th>原属</th><th>四维</th><th>特技</th><th></th></tr>${caps.map(g =>
        `<tr class="card-link" data-general="${g.id}"><td>${desktopName(g)}</td><td>${esc(facName(g.f))}</td><td>${generalStatChips(g)}</td><td>${generalTags(g)}</td><td class="record-actions-cell">${generalButtons(g)}</td></tr>`).join('')}</table>`;
    const missingList = phone.matches ? `<div class="record-list">${missing.map(card).join('')}</div>` :
      `<table class="t"><tr><th>姓名</th><th>羁押之所</th><th>时日</th><th>四维</th><th></th></tr>${missing.map(g =>
        `<tr class="card-link" data-general="${g.id}"><td>${desktopName(g)}</td><td>${statusText(g)}</td><td>${captiveTenure(g)}</td>
          <td>${generalStatChips(g)}</td><td class="record-actions-cell">${generalButtons(g)}</td></tr>`).join('')}</table>`;
    openModal(`<h1>文武百官</h1>
      ${generalTabs('roster')}
      <p class="note governor-count ${vacancies ? 'neg' : ''}">州郡 ${seats.length} 座，知州 ${filled} 员，缺 ${vacancies} 员</p>
      ${filterTabs('genfilter', '职守筛选', filters, genFilter)}
      ${phone.matches ? `<div class="sort-chips" role="group" aria-label="将领排序">${GEN_SORT.map(([key, title]) => sortControl(key, title)).join('')}</div>` : ''}
      <div class="scroll" data-general-roster style="max-height:68vh">${roster.length ? list : '<p class="note">此列暂无将领。</p>'}
      ${missing.length ? '<div class="sec">陷敌诸将</div>' + missingList : ''}
      ${caps.length ? '<div class="sec">囚中敌将</div>' + captiveList : ''}</div>`, { width: '1040px' });
    $('modal').onclick = e => {
      const sort = e.target.closest('[data-g-sort]');
      if (sort) {
        const key = sort.dataset.gSort;
        genDir = genSort === key ? -genDir : -1; genSort = key; genPage = 0;
        showGenerals();
        return;
      }
      const page = e.target.closest('[data-g-page]');
      if (page && !page.disabled) { genPage = +page.dataset.gPage; showGenerals(); return; }
      const button = e.target.closest('[data-g]');
      if (button) { handleGeneralAction(button.dataset.g, +button.dataset.id, showGenerals); return; }
      const row = e.target.closest('[data-general]');
      if (row) showGeneral(+row.dataset.general);
    };
  }
  function generalTabs(page) {
    return filterTabs('genspage', '百官与府库', [['roster', '百官'], ['vault', '府库']], page);
  }
  function showVault() {
    const officers = S().generals.filter(g => g.f === P() && GAME.itemOfficer(g));
    const groups = Object.entries(DATA.ITEM_SLOTS).map(([slot, title]) => {
      const items = S().vault.filter(id => DATA.ITEMS[id].slot === slot);
      if (!items.length) return '';
      return `<section><h2 class="sec">${title}</h2>${items.map(id => {
        const it = DATA.ITEMS[id], locked = GAME.itemMoveReason(id);
        const choices = officers.map(g => ({ g, gain: GAME.itemGain(g, id), reason: GAME.itemEquipReason(g, id) }))
          .sort((a, b) => b.gain - a.gain || a.g.id - b.g.id);
        const options = choices.map(({g, gain, reason}) => {
          const owner = GAME.isItemOldOwner(g, id) ? ' · 旧主' : '';
          return `<option value="${g.id}" ${reason ? 'disabled' : ''}>${esc(g.name)}${owner} · 四维 +${gain}${reason ? ' · ' + esc(reason) : ''}</option>`;
        }).join('');
        const available = choices.some(c => !c.reason);
        return `<article class="vault-item"><p class="general-term"><b>${esc(it.name)}</b> ${esc(it.desc)}</p>
          ${it.hist ? `<p class="note">${esc(it.hist)}</p>` : ''}<p class="note">旧主 ${esc(GAME.itemOldOwners(id).join('、') || '未详')}</p>
          <form class="vault-grant" data-vault-grant="${id}">
            <select aria-label="择将受赐${esc(it.name)}" ${locked || !available ? 'disabled' : ''}>
              <option value="">择将受赐</option>${options}</select>
            <button type="submit" class="btn sm" disabled>赐予</button>
          </form>${locked || !available ? `<p class="note">${esc(locked || '暂无合宜人选。')}</p>` : ''}</article>`;
      }).join('')}</section>`;
    }).join('');
    openModal(`<h1>文武百官</h1>${generalTabs('vault')}
      <div class="scroll" data-treasure-vault style="max-height:68vh">${groups || '<p class="note">府库暂无宝物。</p>'}</div>`, { width: '640px' });
    const panel = $('modal').querySelector('[data-treasure-vault]');
    for (const form of panel.querySelectorAll('[data-vault-grant]')) {
      const select = form.querySelector('select'), button = form.querySelector('button');
      select.onchange = () => { button.disabled = !select.value; };
      form.onsubmit = e => {
        e.preventDefault();
        if (!select.value) return;
        const reason = GAME.grantItem(GAME.gen(+select.value), form.dataset.vaultGrant);
        if (reason) { toast(reason, 'war'); return; }
        const top = modalScroller(panel).scrollTop;
        refreshSide(); showVault();
        modalScroller($('modal').querySelector('[data-treasure-vault]')).scrollTop = top;
      };
    }
  }
  function generalItems(g, readOnly) {
    const canRecover = !readOnly && g.f === P() && GAME.itemOfficer(g);
    return Object.entries(DATA.ITEM_SLOTS).map(([slot, title]) => {
      const items = (g.items || []).filter(id => DATA.ITEMS[id].slot === slot);
      const rows = items.map(id => {
        const it = DATA.ITEMS[id], locked = GAME.itemMoveReason(id);
        return `<div class="equipped-item"><span>${esc(it.name)} <small class="note">${esc(it.desc)}</small></span>
          ${canRecover ? `<button type="button" class="btn sm" data-recover-item="${id}" ${locked ? 'disabled' : ''}>收归府库</button>` : ''}</div>
          ${canRecover && locked ? `<small class="note">${esc(locked)}</small>` : ''}`;
      }).join('');
      return `<div class="general-term" data-item-slot="${slot}"><b>${title}</b>${rows || ' · 无'}</div>`;
    }).join('');
  }
  function showGeneral(id, { back = showGenerals, readOnly = false } = {}) {
    const g = GAME.gen(id);
    if (!g) return;
    if (g.f === P()) COURT.ensure(g);
    const service = S().flags.annals?.service?.[g.id];
    const chips = `<span class="chip">${Math.max(0, S().year - g.birth)} 岁</span><span class="chip">${esc(facName(g.f))}</span><span class="chip">${esc(CULTURE_NAME[g.cul || GAME.fac(g.f)?.culture] || '未详')}</span>`;
    const statBar = (label, val, max, css = '', suffix = '') => `<div class="row"><b>${label}</b><div class="grow">${meter(val, max, css)}</div><span>${val}${suffix}</span></div>`;
    const names = (pairs, empty) => pairs.length ? pairs.map(([name, desc]) => `<p class="general-term"><b>${esc(name)}</b> ${esc(desc)}</p>`).join('') : `<p class="note">${empty}</p>`;
    const skills = GAME.skillList(g).map(k => [k, DATA.SKILLS[k] || '']);
    const buttons = generalButtons(g, true, readOnly);
    const rank = readOnly ? null : COURT.rankTerms(g);
    const next = GAME.nextLv(g);
    openModal(`<h1>将领详情</h1><div class="scroll general-detail" style="max-height:72vh">
      <div class="record-head general-profile">${PORTRAIT.img(g, 96, 'alt=""')}
        <div class="record-name"><h2>${generalName(g)}</h2><div class="chips">${chips}</div><div class="general-duty">${statusText(g)}
         ${g.status === 'captive' ? ' · ' + captiveTenure(g) : ''}
         ${generalLocation(g) ? `<button type="button" class="btn sm" data-g="find" data-id="${g.id}">${g.status === 'captive' ? '寻' : '前往'}</button>` : ''}</div></div></div>
      <div class="general-bars">${Object.entries(GAME.STAT_NAME).map(([k, label]) => statBar(label, g[k] || 0, 100)).join('')}
        ${statBar('等级 ' + (g.lv || 1), Math.round(g.exp || 0), next, 'gold', ' / ' + next)}</div>
      <div class="general-detail-grid">
        <section><div class="sec">特技</div>${names(skills, '暂无特技。')}</section>
        <section><div class="sec">宝物</div>${generalItems(g, readOnly)}</section>
      </div>
      <div class="sec">心志</div><div class="chips">
        <span class="chip">立场 ${COURT.STANCE_NAME[g.stance] || '未详'}</span>
        <span class="chip">忠诚 ${g.loyalty == null ? '未详' : Math.round(g.loyalty)}</span>
        <span class="chip">野心 ${g.amb ?? '未详'}</span><span class="chip">精忠 ${g.loyal == null && g.f !== P() ? '未详' : g.loyal ? '是' : '否'}</span>
      </div><p class="note">立场关乎廷议，忠诚关系去留，野心越盛越易争权，精忠之臣较少离心。</p>
      <div class="sec">战绩</div><div class="chips"><span class="chip">胜 ${g.wins || 0} 阵</span>
        ${g.rank || rank ? `<span class="chip">爵位 ${DATA.RANKS[g.rank || 0].name}</span>` : ''}
        ${service ? `<span class="chip">本纪 · 胜 ${service.wins || 0} / 败 ${service.losses || 0}</span>` : ''}</div>
      ${rank ? `<p class="note">晋${rank.name}${rank.reason === '郡王二席已满。' ? ' · ' + rank.reason : ' · ' + rank.requirements}</p>` : ''}
      <p class="note">史臣曰，${esc(EVENTS.generalBio(g))}。</p>
      <div class="record-actions"><button class="btn" type="button" data-general-back>返回</button>${buttons}</div></div>`, { width: '640px' });
    $('modal').onclick = e => {
      if (e.target.closest('[data-general-back]')) { back(); return; }
      const recover = e.target.closest('[data-recover-item]');
      if (recover && !readOnly) {
        const reason = GAME.recoverItem(g, recover.dataset.recoverItem);
        if (reason) { toast(reason, 'war'); return; }
        const top = modalScroller($('modal').querySelector('.general-detail')).scrollTop;
        refreshSide(); showGeneral(id, { back, readOnly });
        modalScroller($('modal').querySelector('.general-detail')).scrollTop = top;
        return;
      }
      const button = e.target.closest('[data-g]');
      if (!button) return;
      const k = button.dataset.g;
      const redraw = k === 'release' || k === 'exec' ? back : () => showGeneral(id, { back, readOnly });
      handleGeneralAction(k, id, redraw);
    };
  }
  function pickArmyFor(g, back) {
    const armies = S().armies.filter(a => a.f === P());
    const cap = GAME.capFor(g.id);
    const rows = armies.map(a => {
      const leader = GAME.gen(a.gen);
      return `<div class="row"><div class="grow"><b>${esc(GAME.armyName(a))}</b><br><span class="note">${a.units.length} 营 · ${leader ? '现任 ' + esc(leader.name) : '主将空缺'}</span></div>
        <button class="btn sm" type="button" data-assign-army="${a.id}">${leader ? '改任' : '任将'}</button></div>`;
    }).join('');
    openModal(`<h1>择军任将</h1><p class="note">${esc(g.name)}可统 ${cap} 营。</p><div class="scroll" style="max-height:60vh">${rows || '<p class="note">暂无军团。</p>'}</div>
      <div class="record-actions"><button type="button" class="btn" data-general-back>返回</button></div>`, { width: '560px' });
    $('modal').onclick = e => {
      if (e.target.closest('[data-general-back]')) { back(); return; }
      const button = e.target.closest('[data-assign-army]');
      if (!button) return;
      const a = GAME.army(+button.dataset.assignArmy);
      if (!a || a.f !== P() || g.status !== 'idle') return;
      const appoint = () => {
        GAME.setArmyGeneral(a.id, g.id); refreshSide(); refreshTop(); RENDER.markDirty(); back();
      };
      if (a.units.length <= cap) { appoint(); return; }
      const home = GAME.cityAt(a.tile)?.f === P();
      confirmBox(`本军有 ${a.units.length} 营，超出统率的 ${a.units.length - cap} 营将${home ? '归入城中' : '离军'}。仍准改任？`, appoint);
    };
  }
  function pickCity(title, filter, cb, onBack) {
    const list = GAME.citiesOf(P()).filter(filter).sort((a, b) => b.pop - a.pop);
    let h = `<h1>${title}</h1><div class="scroll" style="max-height:60vh"><table class="t"><tr><th>城</th><th>户口</th><th>民心</th><th>现任知州</th><th></th></tr>`;
    for (const c of list) { const g = GAME.gen(c.governor); h += `<tr><td><b>${c.name}</b></td><td>${c.pop}</td><td>${Math.round(c.loyalty)}</td><td>${g ? g.name + '（政' + g.zheng + '）' : '—'}</td><td><button class="btn sm red" data-pc="${c.id}">选</button></td></tr>`; }
    h += `</table></div>`;
    openModal(h, { width: '600px', onClose: onBack || (() => {}) });
    $('modal').onclick = e => {
      const b = e.target.closest('[data-pc]'); if (!b) return;
      if (onBack) modalOnClose = null;
      closeModal(); cb(+b.dataset.pc); refreshSide();
    };
  }

  let dipFilter = 'all';
  function landNeighbors() {
    const near = new Set(), p = P();
    for (let tile = 0; tile < S().tileCity.length; tile++) {
      if (GAME.tileOwner(tile) !== p) continue;
      for (const next of GEO.NBR[tile]) {
        const neighbor = GAME.tileOwner(next);
        if (neighbor && neighbor !== p) near.add(neighbor);
      }
    }
    return near;
  }
  function powerText(f, myPower) {
    const ratio = GAME.totalPower(f) / (myPower + 1);
    return ratio > 1.5 ? '<span class="neg">远胜我</span>' : ratio > 1 ? '略胜我' :
      ratio > 0.5 ? '略逊' : '<span class="pos">弱小</span>';
  }
  function tributeText(r) {
    const vassal = r.vassal?.lord === P() ? `<span class="pos">藩贡 ${Math.round(DATA.VASSAL.tribute * 100)}%</span>` : '';
    if (!r.trib) return vassal || '无';
    const pay = r.trib.from === P();
    return `<span class="${pay ? 'neg' : 'pos'}">${pay ? '纳' : '收'} ${r.trib.amt} 贯/季</span> · 余 ${Math.ceil(r.trib.turns)} 季` + (vassal ? ' · ' + vassal : '');
  }
  function opinionText(r) {
    const op = Math.round(r.op), width = Math.min(100, Math.abs(op)) / 2;
    const color = op >= 0 ? 'pos' : 'neg';
    return `<span class="opinion ${color}">${op ? sgn(op) : 0}<span class="opinion-bar" aria-hidden="true"><i style="width:${width}%;left:${op < 0 ? 50 - width : 50}%"></i></span></span>`;
  }
  function diplomacyButtons(f, myPower) {
    const r = GAME.getRel(P(), f);
    const btn = (action, text, main, extra = '') => `<button type="button" class="btn sm ${main ? 'red' : ''}" data-d="${action}" data-f="${f}" ${extra}>${text}</button>`;
    const envoy = btn('envoy', `遣使 ${GAME.envoyCost(P())}`, !r.war);
    const member = GAME.leagueMember(f);
    const intrigue = member ? btn('intrigue', '离间') : '';
    const terms = GAME.vassalTerms(f, myPower);
    const invest = terms?.ok ? btn('vassal', '册封', false, 'title="册为藩属，罢兵输贡，从我征伐"') : '';
    const marry = GAME.marriageTerms(f)?.ok ? btn('marry', '联姻', false, 'title="宗室女下嫁，十二季内对方不犯边"') : '';
    if (r.war) return btn('peace', '议和', true, `title="和约 ${GAME.peaceTruce(P(), f)} 季"`) + envoy + intrigue +
      (member ? btn('separate', '单独媾和', false, 'title="愿纳岁币，换取此国单独罢兵退盟，和约二十四季"') : '') + invest;
    const truce = r.truce > 0 ? 'title="和约未满，背约则近邦与敌之盟国尤为不满"' : '';
    return envoy + btn('war', '宣战 · ' + GAME.casusBelli(P(), f).name, false, truce) +
      (r.ally ? '' : btn('ally', '结盟', false, 'title="远交结盟，可求援兵"')) + btn('trib', '索贡') + intrigue + invest + marry;
  }
  function showIntrigue(f, redraw, finish) {
    const others = S().flags.league?.members.filter(m => m !== f) || [];
    if (!GAME.leagueMember(f) || !others.length) { redraw(); return; }
    const choices = others.map(m => {
      const { cost, chance } = GAME.intrigueTerms(f, m);
      return `<button class="choice" data-intrigue="${m}">${esc(facName(m))}<small>费钱 ${cost} 贯，事成约 ${Math.round(chance * 100)}%</small></button>`;
    }).join('');
    openModal(`<h1>离间合纵</h1><div class="story">欲离间【${esc(facName(f))}】与何国？</div><div class="choices">${choices}</div>`, { width: '520px', onClose: redraw });
    $('modal').onclick = e => {
      const target = e.target.closest('[data-intrigue]');
      if (target) finish(GAME.intrigue(f, target.dataset.intrigue));
    };
  }
  function diplomacyAction(action, f, redraw) {
    const finish = result => { toast(result.msg); refreshTop(); redraw(); };
    if (action === 'envoy') { finish(GAME.sendEnvoy(P(), f)); return; }
    if (action === 'ally') { finish(GAME.proposeAlliance(P(), f)); return; }
    if (action === 'trib') { finish(GAME.demandTribute(P(), f)); return; }
    if (action === 'marry') {
      const terms = GAME.marriageTerms(f);
      if (!terms?.ok) { toast(terms?.msg || '此邦不可议婚。'); return; }
      confirmBox(`议以宗室女下嫁【${facName(f)}】，费钱 ${terms.cost} 贯，好感 +25。该国十二季内不犯边。`,
        () => finish(GAME.marry(f)), redraw);
      return;
    }
    if (action === 'vassal') {
      confirmBox(`册封【${facName(f)}】为藩。两国自此休兵结盟，其国每季以钱收入的 ${Math.round(DATA.VASSAL.tribute * 100)}% 入贡，并从我朝出征。`,
        () => { const result = GAME.investVassal(f); RENDER.buildPolitical(); finish(result); }, redraw);
      return;
    }
    if (action === 'intrigue') { showIntrigue(f, redraw, finish); return; }
    if (action === 'war') {
      const r = GAME.getRel(P(), f);
      const cause = GAME.casusBelli(P(), f);
      const opinion = cause.kind === 'none' ? '无名出师，依远近减他国好感 0.8 至 8。' : '出师有名，第三国不因举兵而减好感。';
      const breach = r.truce > 0 ? '和约未满，背约另减 1 至 10。' : '';
      const ties = cause.kind === 'none' || breach ? '敌国盟友所减加倍。' : '';
      const rivals = cause.kind === 'reclaim' ? '敌国之宿敌好感 +5。' : ties ? '其宿敌反增好感 +3。' : '';
      const terms = `出师名分：${cause.name}。\n${opinion}${breach}${ties}${rivals}敌国好感降至 −30 或更低，其盟国或应约参战。`;
      confirmBox(terms, () => courtVote('war', f, () => {
        GAME.declareWar(P(), f); RENDER.buildPolitical(); refreshTop(); redraw();
      }, cause.name, redraw), redraw);
      return;
    }
    if (action === 'peace' || action === 'separate') {
      const separate = action === 'separate';
      const terms = EVENTS.peaceTerms(f);
      const vote = () => courtVote('peace', f, () => {
        const result = GAME.proposePeace(P(), f, null, separate);
        if (!result.ok && result.counter) {
          const truce = GAME.peaceTruce(P(), f, { separate });
          confirmBox([result.msg + `　和约 ${truce} 季，允否？`, terms].filter(Boolean).join('\n\n'),
            () => finish(GAME.proposePeace(P(), f, result.counter, separate)), redraw);
        } else finish(result);
      }, esc(terms), redraw);
      if (terms) confirmBox(`拟与【${facName(f)}】议和。\n\n${terms}`, vote, redraw);
      else vote();
    }
  }
  function threatSummary() {
    const { score, parts, level } = GAME.playerThreat(), league = S().flags.league;
    const pct = n => (Math.round(n * 1000) / 10) + '%';
    const labels = [['share', '疆土', '我朝所辖城池占天下有主城池之比'], ['rank', '国力', '国力第一加四分，第二、第三加二分'],
      ['speed', '拓土', '近八季从他国所得城池，按其占比与难度计入'], ['broken', '背约', '近二十季每次背弃和约，按难度加计']];
    const chips = labels.map(([key, label, description]) => `<span class="chip" title="${description}">${label} ${pct(parts[key])}</span>`).join('');
    return `<div class="sec" title="疆土、国力、拓土与背约四项合计。诸国视此议定合纵。">天下侧目 ${pct(score)} · ${['安定', '警惕', '合纵', '共讨'][level]}</div>
      <div class="chips">${chips}</div>
      ${league ? `<p class="note"><b>${league.stage === 'war' ? '共讨诸国' : '合纵诸国'}</b>　${esc(facName(league.leader))}（盟主${GAME.leagueMember(league.leader) ? '' : '，已和'}）${league.members.filter(f => f !== league.leader).map(f => '、' + esc(facName(f))).join('')}</p>` : ''}`;
  }
  function showDiplomacy() {
    const me = GAME.fac(P()), myPower = GAME.totalPower(P());
    const near = dipFilter === 'neighbors' ? landNeighbors() : null;
    const list = Object.keys(me.met).filter(f => f !== P() && f !== 'rebel' && GAME.fac(f)?.alive)
      .filter(f => dipFilter === 'all' || (dipFilter === 'war' ? GAME.atWar(P(), f) :
        dipFilter === 'allies' ? GAME.allied(P(), f) : near.has(f)));
    list.sort((a, b) => (GAME.atWar(P(), b) - GAME.atWar(P(), a)) || (GAME.totalPower(b) - GAME.totalPower(a)));
    const choices = [['war', '交战中'], ['allies', '盟友'], ['neighbors', '邻国'], ['all', '全部']];
    const rows = list.map(f => {
      const r = GAME.getRel(P(), f), cities = GAME.citiesOf(f).length;
      const name = `<button type="button" class="record-link"><b>${esc(facName(f))}</b></button>` +
        (GAME.leagueMember(f) ? ' <span class="chip red">合纵</span>' : '') +
        (r.marriage ? ' <span class="chip">姻亲</span>' : '');
      const relation = relText(f), power = powerText(f, myPower), opinion = opinionText(r), tribute = tributeText(r);
      if (phone.matches) return recordCard(
        `${facSeal(f)} <div class="record-name">${name}</div><span class="chip">${relation}</span>`,
        `<div class="chips"><span class="chip">城 ${cities}</span><span class="chip">国力 ${power}</span><span class="chip">好感 ${opinion}</span>
          <span class="chip">岁币 ${tribute}</span></div>`, diplomacyButtons(f, myPower), `data-nation="${f}"`);
      return `<tr class="card-link" data-nation="${f}"><td>${facSeal(f)}</td><td>${name}</td><td>${cities}</td><td>${power}</td><td>${opinion}</td>
        <td>${relation}</td><td>${tribute}</td><td><div class="record-actions">${diplomacyButtons(f, myPower)}</div></td></tr>`;
    }).join('');
    const listHTML = !rows ? '<p class="note">此列暂无邦国。</p>' : phone.matches ? `<div class="record-list">${rows}</div>` :
      `<table class="t dip-table"><tr><th></th><th>国</th><th>城</th><th>国力</th><th>好感</th><th>关系</th><th>岁币</th><th>操作</th></tr>${rows}</table>`;
    openModal(`<h1>鸿胪寺</h1><div class="scroll dip-page" style="max-height:70vh">${threatSummary()}
      ${filterTabs('dipfilter', '外交筛选', choices, dipFilter)}${listHTML}
      <p class="note">列已结识之邦，邻国以陆地接壤为准。好感随遣使、通商而升。无名出师、背弃和约，近邦及敌之盟国多有非议。</p></div>`, { width: '980px' });
    $('modal').onclick = e => {
      const action = e.target.closest('[data-d]');
      if (action) { diplomacyAction(action.dataset.d, action.dataset.f, showDiplomacy); return; }
      const row = e.target.closest('[data-nation]');
      if (row) showNation(row.dataset.nation);
    };
  }
  function showNation(f) {
    const F = GAME.fac(f);
    if (!F || f === P()) return;
    const redraw = () => showNation(f);
    const original = DATA.FACTIONS.find(x => x.id === f)?.name;
    const nationName = original && original !== F.name ? `${F.name}（${original}）` : F.name;
    const history = DATA.FACTION_INFO[f + '@' + F.name] || DATA.FACTION_INFO[f];
    const cs = GAME.citiesOf(f), cap = GAME.city(F.capital);
    const population = cs.reduce((total, c) => total + c.pop, 0);
    const aggr = F.aggr >= 0.7 ? '好战' : F.aggr >= 0.5 ? '尚武' : F.aggr >= 0.3 ? '守成' : '恭顺';
    const r = GAME.getRel(P(), f);
    const front = [], allies = [];
    for (const [key, rel] of Object.entries(S().rel)) {
      const [a, b] = key.split('|');
      const other = a === f ? b : b === f ? a : null;
      if (!other || other === 'rebel' || !GAME.fac(other)?.alive) continue;
      if (rel.war) front.push(facName(other));
      if (rel.ally) allies.push(facName(other));
    }
    const value = GEN_SORT[0][2];
    const leaders = S().generals.filter(g => g.f === f && ['army', 'gov', 'court'].includes(g.status))
      .sort((a, b) => value(b) - value(a) || a.id - b.id).slice(0, 3);
    const leaderLinks = leaders.map(g => `<button type="button" class="record-link nation-leader" data-nation-gen="${g.id}">
      ${PORTRAIT.img(g, 36, 'alt=""')} ${generalName(g)}</button>`).join('');
    const row = (label, content) => `<div class="row"><b>${label}</b><span class="grow">${content}</span></div>`;
    openModal(`<h1>国家简介</h1><div class="scroll nation-detail" style="max-height:72vh">
      <div class="record-head general-profile">${facSeal(f, 'nation-seal')}<div class="record-name"><h2>${esc(nationName)}</h2>
        <div class="chips"><span class="chip">${esc(CULTURE_NAME[F.culture] || '未详')}</span><span class="chip">${aggr}</span></div></div></div>
      <div class="nation-grid">${row('都城', esc(cap?.name || '未定'))}${row('城数', cs.length)}
        ${row('户口', population + ' 万')}${row('国力', powerText(f, GAME.totalPower(P())))}</div>
      <div class="sec">与我关系</div><div class="chips"><span class="chip">${f === 'rebel' ? '交战' : relText(f)}</span>
        <span class="chip">好感 ${opinionText(r)}</span><span class="chip">岁币 ${tributeText(r)}</span>
        ${r.marriage ? '<span class="chip">姻亲</span>' : ''}</div>
      ${row('交战中', esc(front.join('、') || '无'))}${row('盟友', esc(allies.join('、') || '无'))}
      <div class="sec">名将</div><div class="nation-leaders">${leaderLinks || '<span class="note">未闻其将。</span>'}</div>
      <div class="sec">史略</div><p class="nation-history">${esc(history || '此为群起的义军，未有一朝可纪。')}</p>
      <div class="record-actions"><button type="button" class="btn sm" data-nation-back>返回</button><button type="button" class="btn sm" data-nation-map>舆图上查看</button>
        ${f !== 'rebel' && F.alive ? diplomacyButtons(f) : ''}</div><p class="note" role="status" id="nation-tip"></p>
      </div>`, { width: '660px' });
    $('modal').onclick = e => {
      if (e.target.closest('[data-nation-back]')) { showDiplomacy(); return; }
      if (e.target.closest('[data-nation-map]')) {
        if (!cap || !S().explored[cap.tile]) { $('nation-tip').textContent = '尚未探明其地'; return; }
        closeModal(); select({ type: 'city', id: cap.id, tile: cap.tile }); RENDER.centerOn(cap.tile);
        return;
      }
      const leader = e.target.closest('[data-nation-gen]');
      if (leader) { showGeneral(+leader.dataset.nationGen, { back: redraw, readOnly: true }); return; }
      const action = e.target.closest('[data-d]');
      if (action) diplomacyAction(action.dataset.d, f, redraw);
    };
  }
  // ---------- 廷议 ----------
  function courtVote(motion, f, onPass, extra, onCancel) {
    const res = COURT.vote(motion);
    const lean = S().court.lean;
    if (res.pass && ((motion === 'war' && lean > 40) || (motion === 'peace' && lean < -40))) { COURT.applyVote(res, false); toast('群臣附议，所议已施行'); refreshTop(); onPass(); return; }
    const list = arr => arr.map(([g, w]) => `<button type="button" class="vm record-link" data-v-gen="${g.id}" title="${COURT.STANCE_NAME[g.stance]} · 忠诚 ${Math.round(g.loyalty)}">${PORTRAIT.img(g, 26, 'alt=""')}${esc(g.name)}${w > 1 ? '<sup>' + w + '</sup>' : ''}</button>`).join('') || '<span class="note">无</span>';
    const tot = res.sw + res.ow || 1;
    const subj = motion === 'war' ? `向【${facName(f)}】宣战` : `与【${facName(f)}】议和`;
    let h = `<h1>廷　议</h1><div class="story" style="text-align:center;padding-bottom:4px">议题：<b>${subj}</b>${extra ? '<br><span class="note">' + extra + '</span>' : ''}</div>
      <div class="vote-bar"><i style="width:${res.sw / tot * 100}%"></i></div>
      <div style="display:flex;justify-content:space-between;font-size:14px;margin:2px 0 10px"><span class="pos">赞成 ${res.sw}</span><span>时议偏向${res.empSide === 'war' ? '主战' : '主和'}（${res.ew} 票）</span><span class="neg">反对 ${res.ow}</span></div>
      <div class="sec">赞成</div><div class="vlist">${list(res.sup)}</div>
      <div class="sec">反对</div><div class="vlist">${list(res.opp)}</div>
      ${res.abs.length ? `<div class="sec">缄默</div><div class="vlist">${list(res.abs)}</div>` : ''}
      <p class="note">宰相等朝臣三票，知州与统兵将领各一票。立场相合者赞成，中立者视忠诚与皇权而定。</p><div class="choices">`;
    if (res.pass) h += `<button class="choice" data-v="pass">依群臣所议施行<small>权威 +2</small></button>`;
    else h += `<button class="choice" data-v="force">乾纲独断，执意施行<small>权威 −12，反对者忠诚 −8</small></button>`;
    h += `<button class="choice" data-v="no">${res.pass ? '暂且作罢' : '从众作罢'}</button></div>`;
    const present = () => {
      openModal(h, { width: '720px', onClose: onCancel || (() => {}) });
      $('modal').onclick = e => {
        const info = e.target.closest('[data-v-gen]');
        if (info) { showGeneral(+info.dataset.vGen, { back: present, readOnly: true }); return; }
        const b = e.target.closest('[data-v]'); if (!b) return;
        const v = b.dataset.v;
        if (v !== 'no') modalOnClose = null;
        closeModal();
        if (v === 'no') return;
        COURT.applyVote(res, v === 'force');
        refreshTop();
        onPass();
      };
    };
    present();
  }
  function showCourt() {
    const C = S().court, emp = COURT.emperor();
    const fake = { id: 900000 + emp.birth, name: emp.name, f: P(), birth: emp.birth, art: emp.art, tong: 40, wu: 30, zhi: 70, zheng: 75, cul: 'han' };
    const mem = COURT.members().map(x => x[0]);
    const cnt = k => mem.filter(g => g.stance === k).length;
    const offices = COURT.OFFICES.map(o => {
      const g = COURT.holder(o.id);
      const pct = Math.round(COURT.bonus(o.id) * 100);
      const score = GAME.STAT_NAME[o.stat];
      const title = `<b>${o.name}</b>`;
      const holder = g ? `<button type="button" class="record-link" data-court-gen="${g.id}">${PORTRAIT.img(g, 32, 'alt=""')} ${esc(g.name)}</button>` : '<span class="note">虚位以待</span>';
      const actions = `<button type="button" class="btn sm red" data-o="set" data-k="${o.id}">${g ? '改任' : '任命'}</button>${g ? `<button type="button" class="btn sm" data-o="off" data-k="${o.id}">罢免</button>` : ''}`;
      if (phone.matches) {
        return recordCard(title + `<span class="court-effect">效果 +${pct}%</span>`,
          `<p class="note office-duty">${o.desc}</p><div class="office-holder">${holder}${g ? `<span class="chip office-score">看${score} ${g[o.stat]}</span>
          <span class="chip">${stanceTag(g)}</span><span class="chip">忠诚 ${Math.round(g.loyalty)}</span>` : ''}</div>`, actions);
      }
      return `<tr><td>${title}</td><td class="note office-duty">${o.desc}</td><td><div class="office-holder">${holder}${g ? `<span class="chip office-score">看${score} ${g[o.stat]}</span>` : ''}</div></td>
        <td>${g ? stanceTag(g) : ''}</td><td>${g ? Math.round(g.loyalty) : ''}</td><td>${g ? '+' + pct + '%' : ''}</td>
        <td class="record-actions-cell">${actions}</td></tr>`;
    }).join('');
    const logs = S().log.filter(e => /罢|独断|相位|叛|挂冠|即皇帝位|登第/.test(e.text)).slice(-6).reverse()
      .map(e => `<div><span class="d">${e.d}</span><span>${esc(e.text)}</span></div>`).join('');
    const h = `<h1>朝　堂</h1><div class="scroll court-page" style="max-height:74vh">
      <div class="court-top"><div class="court-emperor">${PORTRAIT.img(fake, 80, 'alt=""')}<h2>当今天子</h2><div class="note">${esc(emp.title)} ${esc(emp.name)} · ${S().year - emp.birth}岁<br>时议：${esc(COURT.reignNote(emp.title, emp.note))}</div></div>
      <div class="court-stats">
        <div class="row court-metric"><span>皇帝权威</span><div class="grow">${meter(C.auth, 100, 'gold')}</div><b>${Math.round(C.auth)}</b></div>
        <div class="row court-metric"><span>朝议倾向</span><div class="grow"><div class="lean big"><i style="left:${(C.lean + 100) / 2}%"></i></div><div class="court-lean-caption"><span class="pos">主和</span><span class="neg">主战</span></div></div><b>${Math.round(C.lean)}</b></div>
        <p class="note">权威决定民心与群臣忠诚，胜仗与克城可增，败绩与独断则减。朝议倾向受时议、朝臣立场与战局影响：与之相背而宣战或议和，须经廷议。</p>
        <div class="chips court-stances"><span class="chip red">主战 ${cnt('war')}</span><span class="chip">中立 ${cnt('mid')}</span><span class="chip pos">主和 ${cnt('peace')}</span>
          <span class="chip" title="每六季增一人，最多三人">宗室可下嫁 ${C.clan.brides} 人</span></div>
      </div></div>
      <div class="sec">百官</div>
      ${phone.matches ? `<div class="record-list office-list">${offices}</div>` :
        `<table class="t court-table"><tr><th>官职</th><th>职掌</th><th>现任</th><th>立场</th><th>忠诚</th><th>效果</th><th></th></tr>${offices}</table>`}
      <div class="sec">近日朝堂</div><div class="loglist court-log">${logs || '<div class="note">无事</div>'}</div></div>`;
    openModal(h, { width: '980px' });
    $('modal').onclick = e => {
      const info = e.target.closest('[data-court-gen]');
      if (info) { showGeneral(+info.dataset.courtGen, { back: showCourt }); return; }
      const b = e.target.closest('[data-o]'); if (!b) return;
      const k = b.dataset.k, O = COURT.OFFICES.find(o => o.id === k);
      if (b.dataset.o === 'off') { const g = COURT.holder(k); COURT.vacate(k); if (g) g.loyalty -= 10; showCourt(); refreshTop(); return; }
      pickGeneral('任' + O.name + '（看' + GAME.STAT_NAME[O.stat] + '）', g => true, g => g[O.stat], gid => { if (gid != null) { COURT.assign(k, gid); guide('office'); } setTimeout(showCourt, 20); });
    };
  }
  function showSettings() {
    const audio = AUDIO.getSettings();
    const opt = (k, v, label) => `<button class="btn sm ${SET[k] === v ? 'red' : ''}" data-set="${k}" data-v="${v}">${label}</button>`;
    const row = (name, inner) => `<div class="row"><span style="width:110px">${name}</span><span class="grow" style="display:flex;gap:5px;flex-wrap:wrap">${inner}</span></div>`;
    const volume = (key, name) => {
      const value = Math.round(audio[key] * 100);
      return row(name, `<span class="sound-level"><input type="range" min="0" max="100" value="${value}" aria-label="${name}" data-volume="${key}"><output>${value}%</output></span>`);
    };
    const h = `<h1>设　置</h1><div class="settings-body">
      ${row('回合动画', [0, 1, 2].map(v => `<button class="btn sm ${animSpeed === v ? 'red' : ''}" data-anim="${v}">${['关闭', '常速', '快速'][v]}</button>`).join(''))}
      ${row('敌军来犯', opt('defend', 'all', '逐战过问') + opt('defend', 'city', '仅守城时过问') + opt('defend', 'off', '皆交守将'))}
      ${row('敌方回合镜头', opt('follow', true, '跟随') + opt('follow', false, '不跟随'))}
      ${row('自动存档', opt('autosave', 'turn', '每回合') + opt('autosave', 'season', '每季') + opt('autosave', 'off', '关闭'))}
      ${row('界面字号', opt('ui', 0.9, '小') + opt('ui', 1, '中') + opt('ui', 1.15, '大') + opt('ui', 1.3, '特大'))}
      ${row('地图显示', opt('showRes', !SET.showRes, SET.showRes ? '隐藏物产' : '显示物产') + opt('showSites', !SET.showSites, SET.showSites ? '隐藏奇遇点' : '显示奇遇点') + opt('showNames', !SET.showNames, SET.showNames ? '隐藏国名' : '显示国名'))}
      ${volume('master', '总音量')}
      ${volume('music', '音乐')}
      ${volume('effects', '音效')}
      ${row('声音', `<button type="button" class="btn sm" data-act="sound" data-sound-switch aria-label="静音" aria-pressed="${audio.muted}">${audio.muted ? '已静音' : '静音'}</button>`)}
      ${row('新手引导', `<button class="btn sm" data-guide="1">${S() && S().guide && S().guide.off ? '重新显示' : '隐藏'}</button>`)}
      ${row('终局', `<button class="btn sm" data-act="retire" ${S().settlement ? 'disabled' : ''}>禅位·盖棺定论</button>`)}
      <p class="note">设置保存在本浏览器中。</p>
      <section class="settings-about" aria-labelledby="about-title">
        <h2 id="about-title" class="sec">关于</h2>
        <p><strong>还我河山</strong> <span class="note">v${VERSION}</span></p>
        <p class="note">大宋征服天下</p>
        <div class="row"><span>制作人</span><strong>${CREATOR}</strong></div>
        <div class="row"><span>微信</span><strong id="about-wechat">${WECHAT}</strong>
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
  function guide(k) { const s = S(); if (!s) return; s.guide = s.guide || {}; if (k === 'turns') { s.guide.nT = (s.guide.nT || 0) + 1; if (s.guide.nT < 3) return; } if (!s.guide[k]) { s.guide[k] = 1; if (!s.guide.off) toast('已成：' + GUIDE.find(x => x[0] === k)[1]); } }
  function guideHTML() {
    const g = S().guide || {};
    if (g.off) return '';
    const done = GUIDE.filter(x => g[x[0]]).length;
    if (done === GUIDE.length) return '';
    return `<div class="sec">初政指引 <span class="r cost">${done}/${GUIDE.length}　<a data-act="guideoff" style="cursor:pointer">收起</a></span></div>` +
      GUIDE.map(([k, t]) => `<div class="row" style="padding:2px 4px">${g[k] ? '<span class="pos">已</span>' : '<span class="note">未</span>'}<span class="${g[k] ? 'note' : ''}">${t}</span></div>`).join('');
  }
  function showCities() {
    const cs = GAME.citiesOf(P()).filter(c => cityFilter === 'all' || c.tier === +cityFilter)
      .sort((a, b) => (citySort === 'tier' ? b.tier - a.tier : 0) || b.pop - a.pop);
    const controls = (items, action, selected) => items.map(([value, label]) =>
      `<button type="button" class="btn sm ${selected === value ? 'red' : ''}" data-act="${action}" data-arg="${value}" aria-pressed="${selected === value}">${label}</button>`).join('');
    let h = `<h1>州府一览</h1><div class="btns" aria-label="按级别筛选">${controls([['all', '全境'], ...DATA.CITY_TIERS.map((tier, i) => [String(i), tier.name])], 'city-filter', cityFilter)}</div>
      <div class="btns" aria-label="排序">${controls([['pop', '按户口排序'], ['tier', '按级别排序']], 'city-sort', citySort)}</div>
      <div class="scroll" style="max-height:60vh"><table class="t"><tr><th>城</th><th>户口</th><th>民心</th><th>粮</th><th>工</th><th>钱</th><th>文</th><th>守军</th><th>营造</th><th>知州</th></tr>`;
    for (const c of cs) {
      const y = GAME.cityYield(c), q = c.queue[0], g = GAME.gen(c.governor);
      h += `<tr class="click" data-act="goto" data-arg="c:${c.id}" style="cursor:pointer"><td><b>${cityTitle(c)}</b></td><td>${c.pop}</td><td class="${c.loyalty < 30 ? 'neg' : ''}">${Math.round(c.loyalty)}</td><td>${sgn(y.food - y.foodNeed)}</td><td>${y.prod}</td><td>${y.gold}</td><td>${y.sci}</td><td>${c.garrison.length}</td><td>${q ? cityQueueName(c, q) : '<span class=neg>空闲</span>'}</td><td>${g ? g.name : ''}</td></tr>`;
    }
    if (!cs.length) h += '<tr><td colspan="10" class="note">境内暂无此等城池。</td></tr>';
    h += `</table></div>`;
    openModal(h, { width: '900px' });
  }
  function showArmies(sort) {
    const rows = S().armies.filter(a => a.f === P()).map(a => ({ a, upkeep: GAME.armyUpkeep(a) }));
    if (sort === 'gold' || sort === 'food') rows.sort((a, b) => b.upkeep[sort] - a.upkeep[sort]);
    const sortButtons = [['gold', '按钱饷排序'], ['food', '按粮饷排序']].map(([key, label]) =>
      `<button class="btn sm ${sort === key ? 'red' : ''}" type="button" data-act="armies" data-arg="${key}" aria-pressed="${sort === key}">${label}</button>`).join('');
    const ready = rows.filter(({ a }) => a.path?.length && a.mp > 0).length;
    const march = ready ? `<button type="button" class="btn sm red" data-act="contall-panel">${ready} 军待续 · 全军继续</button>` : '';
    let h = `<h1>诸军</h1><div class="btns">${sortButtons}${march}</div><div class="scroll" style="max-height:65vh"><table class="t"><tr><th>军</th><th>主将</th><th>营</th><th>兵力</th><th>士气</th><th>位置</th><th>状态</th><th>每季军饷</th></tr>`;
    for (const { a, upkeep } of rows) {
      const c = GAME.cityAt(a.tile), own = GAME.tileOwner(a.tile);
      const goal = a.path?.at(-1);
      const route = goal == null ? '' : `${a.mp > 0 ? '待续' : '已定路线'} · ${esc(GAME.cityAt(goal)?.name || GEO.TERRAIN[GEO.terrain[goal]]?.name || '野外')}`;
      h += `<tr data-act="goto" data-arg="a:${a.id}" style="cursor:pointer"><td><b>${esc(GAME.armyName(a))}</b></td><td>${a.gen != null ? GAME.gen(a.gen).name : '—'}</td><td>${a.units.length}</td><td>${fmt(GAME.sumStr(a.units))}</td><td>${Math.round(a.morale)}</td><td>${c ? c.name : (own ? facName(own) + '境内' : '荒野')}</td><td>${route || (a.sentry ? '驻守' : a.mp > 0 ? '<span class=pos>待命</span>' : '已动')}</td><td class="army-upkeep">${upkeepText(upkeep)}</td></tr>`;
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
  function returnToTitle() {
    closeModalQuiet();
    select(null);
    for (const id of ['top', 'side', 'endturn', 'minimap', 'tip', 'mobilebar', 'orderbar']) $(id).classList.add('hidden');
    titleScreen();
  }
  function exportSave() {
    const data = GAME.serialize();
    const blob = new Blob([data], { type: 'application/json' });
    downloadBlob(blob, `还我河山_${S().year}_${GAME.dateStr()}.json`);
  }
  function downloadBlob(blob, name) {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url; a.download = name;
    try {
      document.body.appendChild(a);
      a.click();
    } finally {
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
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
      if (s === 'title') returnToTitle();
    };
  }
  function difficultyDescription(d) {
    const { coalition: co, command: ai, occupation: c, debt } = d;
    const northernGuard = d.northGarrison < 0 ? `减 ${-d.northGarrison} 营（最低为零）` : `+${d.northGarrison} 营`;
    return `他国工钱 ${Math.round(d.aiYield * 100)}%、战力 ${Math.round(d.aiBattle * 100)}%。` +
      `金夏开局守营 ${northernGuard}，野战军最多加 ${d.northArmy} 营，对宋军团上限 +${ai.armies}。` +
      `开局前 ${co.warDelay} 季有宣战保护。威胁度达 ${Math.round(co.threat * 1000) / 10}% 时，接壤诸国合纵所需国力合计为我朝 ${Math.round(co.ratio * 100)}%，此后门槛随我朝威势而降。` +
      `共讨至多 ${co.waveMax} 国同日来犯，尽罢兵后至少隔 ${co.waveCool} 季再起。我朝可离间其盟、纳币单独媾和，或远交求援。` +
      `诸国军队再攻同一宋城，须相隔约 ${Math.round(ai.siegeInterval * 90)} 日。` +
      `新附城产出最多减 ${Math.round(c.production * 100)}%，历 ${c.seasons} 季。` +
      (debt.governance ? `四十城外每多一城，治理支出按基础支出的 ${Math.round(debt.governance * 1000) / 10}% 加计。` : '') +
      `欠饷每季士气减 ${debt.morale}，欠粮者民心下降${debt.famine ? '，久则户口减少' : ''}。` +
      (d.eraRecruit ? `他国迈入新时代可募 ${d.eraRecruit} 营。` : '') +
      (d.startReserve < 1 ? '大宋初始钱粮减半。' : d.startReserve > 1 ? `大宋初始钱粮增加 ${Math.round((d.startReserve - 1) * 100)}%。` : '') +
      (d.name === '严苛' || d.name === '地狱' ? REINFORCEMENT_DIFFICULTY_NOTE : '');
  }
  function terrainGuideHTML() {
    const { byTerrain, highGround, crossing, landing, water, expedition } = DATA.TERRAIN_COMBAT;
    const pct = m => (m < 1 ? '−' : '+') + (Math.round(Math.abs(m - 1) * 1000) / 10) + '%';
    const names = { cav: '骑兵', inf: '步兵', bow: '弓兵', defBow: '守方弓兵', fire: '火器', siege: '野战砲车' };
    const land = Object.entries(GEO.T).filter(([k]) => k !== 'SEA' && k !== 'LAKE');
    const perTile = land.map(([k, id]) => {
      const terrain = GEO.TERRAIN[id], row = byTerrain[k] || {};
      const rules = Object.entries(names).filter(([group]) => row[group] && row[group] !== 1)
        .map(([group, name]) => name + ' ' + pct(row[group]));
      if (terrain.def) rules.unshift('守方全军 ' + pct(1 + terrain.def));
      return `<div><dt>${terrain.name}</dt><dd>${rules.join('，') || '各营照常交兵'}</dd></div>`;
    }).join('');
    const terrains = keys => keys.map(k => GEO.TERRAIN[GEO.T[k]].name).join('、');
    return `<h3>地形与交战</h3><p>两军依守方所在格计地势。先按兵种调整各营战力，守方全军的地利与主将特技另行相乘。轻骑、骑射、甲骑、背嵬皆按骑兵计。砲车攻城时免受野战地形折减。</p>
      <dl class="terrain-guide">${perTile}</dl>
      <ul><li>居高临下。从${terrains(highGround.from)}攻${terrains(highGround.to)}，攻方全军 ${pct(highGround.mult)}。</li>
      <li>渡河强攻。从无河格攻入临河格，攻方 ${pct(crossing.att)}，守方 ${pct(crossing.def)}。守方的临河与本格守势相加。两军皆临河，依本格地形交战。</li>
      <li>舟师在临河陆地发挥 ${Math.round(water.riverNavy * 100)}% 战力，在其余陆地发挥 ${Math.round(water.landNavy * 100)}%。非水军在水面作战，战力为平日的 ${Math.round(water.embarked * 100)}%。</li>
      <li>自海面或湖面登岸，攻方非水军 ${pct(landing.mult)}。主将善「水战」，登岸折减减半，为 ${pct(1 - (1 - landing.mult) * (1 - landing.skillRelief))}。</li>
      <li>「守险」利守丘陵、山地、森林、高原。「水战」利于水面与临河作战。点开地块详情或长按已探明的地图格，可察该处地势。</li></ul>
      ${expedition.enabled ? `<p>军驻境外，按所余兵力每季折损，${Object.entries(expedition.rates).map(([k, rate]) => GEO.TERRAIN[GEO.T[k]].name + (k === 'TUNDRA' ? '冬季' : '') + ' ' + Math.round(rate * 100) + '%').join('、')}。军在本境，免此损耗。游牧诸部习沙漠与冻原，南洋、天竺诸部习雨林，驻于所习地势亦免。</p>` : ''}`;
  }
  function showHelp() {
    const prefecture = DATA.CITY_TIERS[1].upgrade, superior = DATA.CITY_TIERS[2].upgrade;
    openModal(`<h1>玩法说明</h1><div class="scroll help" style="max-height:72vh;max-width:760px">
      <h3>大势</h3><p>绍兴十年（1140）七月，岳飞郾城大捷。你是大宋天子（开局为宋高宗赵构），岳飞、韩世忠诸将皆为你麾下之臣。经营江南，北伐中原，进而西出玉门、南下天竺、远征大食与拂菻。<b>占领所有有主城池</b>即为一统天下。开局可选每回合推进一周、一旬、一月或一季；城池产出以“每季”计，按回合折算。</p>
      <h3>难度</h3><p>各档的邻国起兵门槛、合纵规模与新附城损耗各异。弱城与新附城易遭敌军窥伺，委任知州、赈济可缓和新附之患。</p>
      <ul class="difficulty-help">${DATA.DIFFICULTY.map(d => `<li><b>${d.name}</b>　${difficultyDescription(d)}</li>`).join('')}</ul>
      <h3>回合动画</h3><p>结束回合后，视野内的行军、交战会依次演示：兵锋推进、刀兵相交、伤亡跳字与胜负印章。点击地图或按空格可跳过；顶栏“动画”按钮可切换常速/快速/关闭。</p>
      ${TOUCH.matches ? '<h3>手机操作</h3><ul><li>单指拖动平移，双指捏合缩放，轻点选取城池或军队。</li><li>选中我军后，底部出现<b>军令条</b>：轻点地图上的目的地，军令条显示路程与胜算，点<b>「出发」</b>（或再点一次该格）即行军；点「取消」重选。</li><li>「详情」可展开军团或城池的全部信息；右下「下一周」结束回合。</li></ul>' : ''}
      <h3>${TOUCH.matches ? '键盘鼠标操作' : '操作'}</h3><ul><li>左键选城池/军队；拖动平移地图；滚轮缩放；点小地图跳转。</li><li>选中军队后<b>右键</b>目标格即行军，目标为交战之敌则发起进攻；或按 <kbd>M</kbd> 后左键。</li>
      <li>选中军队后<b>左键点目标格</b>先显示路线与抵达时间，<b>再点一次</b>即出发（右键可直接出发）。远途路线会保留，下回合按 <kbd>C</kbd> 或点“继续行军”接着走，<kbd>Shift+C</kbd>／“全军继续”令所有有路线的军团一齐前进。</li>
      <li>本回合行军力足以穿过本国军团并落在空格时，可由友军所在格经过。若行军力不足，驻足于友军之前，下回合可继续。</li>
      <li><kbd>Enter</kbd> 下一回合，<kbd>Tab</kbd> 下一支待命军，<kbd>空格</kbd> 令其驻守，<kbd>Esc</kbd> 取消。</li></ul>
      <h3>内政</h3><ul><li>城池按户口耕作周边地块，产出粮、工、钱、文。余粮使户口增长；工用于营建与征兵；钱用于军饷、加急；文推动科技。</li>
      <li>民心低于 25 易生民变。寺观、常平仓、知州、奢侈物产（茶丝瓷香料）可安民；战事日久则厌战。</li>
      <li>委任<b>政</b>高之臣为知州，可大增一城产出。</li></ul>
      <h3>城池等级与定位</h3><ul>
      <li>城分县、州、府、京。户口上限依次为 ${DATA.CITY_TIERS.map(t => t.pop).join('、')} 万，建筑限 ${DATA.CITY_TIERS.slice(0, 3).map(t => t.buildings).join('、')} 处，京城不限。营造中的建筑预占一处，拆除可腾地，旧费不返。</li>
      <li>县具 ${prefecture.pop} 万户口、${prefecture.buildings} 处建筑及知州，费工 ${prefecture.prod} 可升州。州须有 ${superior.pop} 万户口、${superior.buildings} 处建筑及政务 ${superior.governor} 的知州，城墙与草市、书院、市舶司、军营之一须建成，费工 ${superior.prod} 可升府。府无亲民之官，产出减一成。</li>
      <li>都城径授京级。迁都则旧京降府。易主降一等并清去旧定位。逾上限之户暂止增长。</li>
      <li>州以上可定为${Object.values(DATA.CITY_ROLES).map(r => r.name).join('、')}。初定免钱，即日施行。改制费钱八十贯，两季后施行，隔八季方可再改。</li></ul>
      <h3>军事</h3><ul><li>在城中“军务”页征兵，募成后为守军；点选守军并择将即可<b>组建军团</b>。主将<b>统</b>越高，可统营数越多（最多十营）。</li>
      <li>满营五百人。${recoveryText()}城中守军未受围时，每季回复 ${DATA.UNIT_RECOVERY.garrison} 点兵力，亦耗丁口。</li>
      <li>军团入本国城池后，可逐营补员或全军补员。城守可在“军务”补员。按缺额急募，钱与丁口加三成，马铁照缺额支用。每营补员后须满九十日方可再募，临敌或本回合交战后不可急募。</li>
      <li>在同一军团或同一城守军点选两营以上同兵种残营，可免费合营。余兵尽留，空营除籍，可省军饷。野外亦可合，本回合交战后不可。</li>
      <li>${REINFORCEMENT_DIFFICULTY_NOTE}</li>
      <li>遣散兵营可省军饷，在本国境内按现有兵力收还半数征募丁口。“解散入城”则将诸营并入守军。</li>
      <li>兵种相克：步卒克骑，弓弩克步，骑兵克弓与砲车。甲骑、背嵬军、火器营为强兵。攻城宜带砲车，城防降至三成以下且守军尽没方可破城。</li>
      <li>战力取决于兵力、相克、主将统武智、特技、地形与士气。</li>
      <li>舟师足够（每三营陆军配一营舟师）的军团可渡海。军队离境过远、粮尽或国库亏空会减员。</li></ul>
      ${terrainGuideHTML()}
      <h3>科举与将领</h3><ul><li>每三年春殿试放榜，可从候选中择优录用；史上名臣（朱熹、虞允文、陆游、范成大……）会在其登第之年出现。</li>
      <li>武将多会在其出仕之年“慕义来投”。战败的敌将可能被俘，可招降、释放或处斩。</li>
      <li>我朝将领陷敌，可由「文武百官 · 陷敌诸将」遣使赎回、以俘易俘，亦可克其羁押之城救人。和议既成，双方互归所俘将领；若欲招降，须先处置再议和。</li></ul>
      <h3>战前军议与临阵指挥</h3><ul><li>我军进攻时先开<b>战前军议</b>：可见双方将领、兵种、地形与胜算；可择一<b>计策</b>（火攻、夜袭、水淹、诱敌、激将、疑兵），成败取决于双方主将之智与地形时令。</li>
      <li>可选“自动决战”，也可于六角战场亲自调度。两种战法皆按军议所列地形调整各营战力。临阵每营每回合可移动后攻击一次，弓弩、火器、砲车可远射，砲车尤善破墙，包夹敌营可增伤。十回合内击溃敌军（兵力不足三成或士气崩溃）即胜。</li>
      <li><b>敌军来犯</b>：敌方回合结束后，凡敌军攻我城池或军团，逐一请示方略：可施守策（劫营、火攻、坚壁、疑兵），再选“亲自守城/迎战”或“交由守将”。亲自守御时敌军先攻，守满十回合即算守住。可在“设置”中改为仅守城时过问或全部交由守将。</li></ul>
      <h3>奇遇与将领成长</h3><ul><li>地图上的菱形标记为奇遇点：古战场（经验）、名山古刹（士气兵员）、隐士草庐（特技）、遗迹（宝物）、义军营寨（兵员）、牧马场、商队、屯粮所、藏书楼。带兵经过即可触发。</li>
      <li>将领作战与奇遇可得经验，升级时三选一：提升能力或习得新特技（至多三项）。</li>
      <li>宝物每人至多三件，同类只可佩一件，兵书与经籍可各佩一部。可在将领详情收归府库，再由「文武百官」的「府库」赐给他人，每件每季只可转手一次。俘获敌将可缴其宝物。</li>
      <li>本局首佩之将为旧主。收其旧物，忠诚减十五，赐还则增十五。其余将领收归减六、受赐增五。沥泉枪依说岳典故，岳飞亦视为旧主。</li></ul>
      <h3>朝堂</h3><ul><li>“朝堂”中可任命宰相、枢密使、三司使、翰林学士、御史中丞、殿前都指挥使，各按其能力提供全国加成。</li>
      <li>群臣分主战、主和、中立。宣战与议和须经<b>廷议</b>：附议者多，可依议施行；否则可乾纲独断，但损权威、失人心。</li>
      <li>皇帝权威影响民心与忠诚；将领忠诚过低会挂冠而去，甚至率部叛逃。可赏赐、任以要职，或设御史中丞纠察百官。历代宋帝依次继位，各朝时议随之而变。</li></ul>
      <h3>海贸</h3><ul><li>临海之城建<b>市舶司</b>后可开辟航线，与同一海域、已结识且未交战的外国港口通商。路途越远、对方越大，获利越丰；研习“远洋”后航线不限远近。</li></ul>
      <h3>用钱之道</h3><ul><li><b>捐资助学</b>（科技面板）：每 5 贯折文教 1，每季最多捐半季文教之数。</li><li><b>赈济</b>（城池·内政）：民心 +15、民变之势 −15，每城一年一次。</li><li><b>移民实边</b>（城池·内政）：户口 +1 万，限十二万以下且户口未盈的非都城，每城两年一次。</li><li><b>犒军</b>（军团）：士气 +30、主将经验 +15，每军两季一次。</li><li>电脑诸国库银充裕时也会如此用钱。</li></ul>
      <h3>外交</h3><p>鸿胪寺中可遣使修好、宣战、议和、结盟、索贡。诸国也会彼此征伐，天下大势随史而动。</p>
      <h3>合纵连横</h3><ul>
      <li>鸿胪寺的「天下侧目」合计疆土、国力名次、近季拓土与背约。势盛则邻国可遣使诘问，继而会盟，同日举兵共讨。</li>
      <li>出师有名，可陈情消嫌。厚礼屡遣则礼金渐增、免从合纵之期渐短。已至共讨之势，厚礼只可缓三季。</li>
      <li>可择盟中两国施离间计，使其失和退盟。交战时可用岁币单独媾和，换得二十四季和约。平日亦可远交结盟，共御来犯。</li></ul>
      <h3>封爵与册封藩属</h3><ul>
      <li>于将领详情可依等级、战功与君上权威，费钱逐等晋爵，以结其心。侯以上远镇重兵而失忠，或拥兵自重，须议召还、安抚或隐忍。</li>
      <li>有两名伯以上之将统兵，且权威足以服众，朝臣或请行杯酒释兵权，收诸功臣之兵柄。</li>
      <li>鸿胪寺可册封有好感或有意议和的弱国。藩属输贡从征，奉藩满二十季且好感达七十，或请纳土归附。</li></ul>
      <h3>宗室联姻</h3><ul>
      <li>两国休兵且交好，可由鸿胪寺遣宗室女下嫁。姻邦十二季内不犯我境，二十季内较难加入合纵。</li>
      <li>强邻或乘胜遣使求亲。可备嫁妆许亲、以岁币代之，或严词拒之。息兵之期随难度而异，交战时许亲可增对方议和之意，战事仍继续。</li>
      <li>联姻满三十季，姻邦势弱，或有外孙继统，请奉宋室为宗主。</li></ul>
      <h3>存档</h3><p>每季自动存档；可手动存于五栏，并可导出为文件长期保存。</p></div>`, { width: '820px' });
  }

  function showHonors() {
    const { entries, total, rating } = EVENTS.achievements();
    const cats = ['武功', '疆土', '文治', '人物', '外交', '奇遇', '挑战'];
    const groups = cats.map((cat, i) => {
      const group = entries.filter(x => x.cat === cat);
      const achieved = group.filter(x => x.date).length;
      const cards = group.map(x => {
        const hidden = !x.date && cat === '挑战';
        const name = hidden ? '？？' : x.name;
        const text = hidden ? '终局时依本局功业揭晓。' : x.desc;
        return recordCard(`<b>${name}</b><span class="chip ${x.date ? 'red' : ''}">+${x.pts}</span>`,
          `<div class="${x.date ? '' : 'note'}">${text}</div><span class="note">${esc(x.date || '待成')}</span>`, '');
      }).join('');
      return `<details class="honor-group" ${i === 0 ? 'open' : ''}><summary><b>${cat}</b> <span class="note">${achieved} / ${group.length}</span></summary>
        <div class="record-list honor-cards">${cards}</div></details>`;
    }).join('');
    openModal(`<h1>功业</h1><div class="honor-summary"><b>${total}</b> 功业分 <span class="chip red">${rating}</span></div>
      <div class="scroll honor-page" style="max-height:70vh">${groups}</div>`, { width: '760px' });
  }
  function hallEntries() {
    try {
      const raw = JSON.parse(localStorage.getItem(HALL_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter(x => x && Number.isFinite(x.total)).slice(0, 20) : [];
    } catch (e) { return []; }
  }
  function showHall() {
    const hall = hallEntries();
    const rows = hall.map(row => recordCard(
      `<b>${esc(row.rating)}</b><span class="chip red">${row.total} 分</span><span class="note">${esc(row.date)}</span>`,
      `<span class="note">${esc(row.result)} · ${DIFFICULTY_NAMES[row.difficulty] || DIFFICULTY_NAMES[1]} · ${GAME.SCALE_NAME[row.scale] || '回合'}制 · ${row.years} 年</span>`, '')).join('');
    openModal(`<h1>功业榜</h1><div class="scroll" style="max-height:72vh">${rows ? '<div class="record-list">' + rows + '</div>' :
      '<p class="note">此卷尚无题名。</p>'}</div>`, { width: '640px' });
  }
  function drawSettlementScroll(score) {
    const sheet = document.createElement('canvas');
    sheet.id = 'settlement-scroll';
    sheet.width = 1080;
    sheet.setAttribute('role', 'img');
    sheet.setAttribute('aria-label', `还我河山结算长卷，${score.title}，${score.rating}，${score.total} 分`);
    const ctx = sheet.getContext('2d');
    const draws = [], lettering = [];
    const ink = '#342b20', muted = '#6f5d44', cinnabar = '#a23227', paper = '#f5ead2';
    const left = 66, right = sheet.width - left, middle = sheet.width / 2, width = right - left;
    let y = 0;
    const face = (size, bold = false) => `${bold ? 'bold ' : ''}${size}px ${RENDER.FONT}`;
    const text = (value, x, top, size, opts = {}) => {
      draws.push(() => {
        ctx.font = face(size, opts.bold);
        ctx.textAlign = opts.align || 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = opts.color || ink;
        ctx.fillText(value, x, top, opts.width ?? sheet.width);
        lettering.push(value);
      });
    };
    const line = (x1, x2, top, color = '#c5b28b') => draws.push(() => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, top);
      ctx.lineTo(x2, top);
      ctx.stroke();
    });
    const section = title => {
      y += 48;
      text(title, left, y, 48, { bold: true });
    };
    const paragraph = (value, x, available, size, leading) => {
      ctx.font = face(size);
      let part = '';
      for (const char of value) {
        if (part && ctx.measureText(part + char).width > available) {
          text(part, x, y, size);
          y += leading;
          part = '';
        }
        part += char;
      }
      if (part) {
        text(part, x, y, size);
        y += leading;
      }
    };

    text('还我河山', middle, 136, 118, { align: 'center', bold: true });
    const seal = { unify: '一统', retire: '禅位', defeat: '社稷倾覆' }[score.type];
    draws.push(() => {
      ctx.save();
      ctx.translate(861, 143);
      ctx.rotate(-.105);
      const size = seal.length === 4 ? 98 : 86;
      ctx.fillStyle = cinnabar;
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.strokeStyle = paper;
      ctx.lineWidth = 2;
      ctx.strokeRect(6 - size / 2, 6 - size / 2, size - 12, size - 12);
      ctx.font = face(35, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = paper;
      if (seal.length === 4) {
        ctx.fillText(seal.slice(0, 2), 0, -19);
        ctx.fillText(seal.slice(2), 0, 19);
      } else ctx.fillText(seal, 0, 0);
      ctx.restore();
      lettering.push(seal);
    });
    text(`${score.rating}　·　${score.total} 分`, middle, 241, 54, { align: 'center', color: cinnabar, bold: true });
    const difficultyName = DIFFICULTY_NAMES[score.difficulty] || DIFFICULTY_NAMES[1];
    text(`公元 ${score.start}—${score.end} 年　·　历 ${score.years} 年　·　${difficultyName}　·　${GAME.SCALE_NAME[score.scale] || '回合'}制`,
      middle, 314, 33, { align: 'center', color: muted, width });
    y = 339;
    line(left, right, y, muted);

    const cities = GAME.citiesOf(P());
    const captured = Object.keys(S().flags.achievementProgress.capturedCapitals).map(id => GAME.city(+id)).filter(Boolean);
    const capital = cities.find(c => c.id === GAME.fac(P()).capital);
    const map = document.createElement('canvas');
    map.width = width;
    map.height = Math.round(width * RENDER.BH / RENDER.BW);
    RENDER.drawOverview(map.getContext('2d'), map.width, map.height, { captured, capital });
    section('占领舆图');
    const mapTop = y + 37;
    draws.push(() => ctx.drawImage(map, left, mapTop));
    y = mapTop + map.height + 34;
    let territory = 0;
    for (let tile = 0; tile < S().tileCity.length; tile++) if (GAME.tileOwner(tile) === P()) territory++;
    const people = cities.reduce((sum, c) => sum + c.pop, 0);
    const landShare = (territory / S().tileCity.length * 100).toFixed(1);
    text(`城池 ${cities.length} / ${S().cities.length}　·　户口 ${people} 万　·　疆域占全图 ${landShare}%`,
      left, y, 34, { color: muted, width });
    y += 38;
    line(left, right, y);

    section('积分');
    // 旧版结算档保存了分项数值，仍可从当时的局面读回同值分项的依据。
    const priorRows = score.rows.some(row => row.length < 3) ? EVENTS.finalScore(score.type, false).rows : [];
    for (const [i, [label, value, basis]] of score.rows.entries()) {
      const prior = priorRows[i];
      const matched = prior?.[0] === label && Math.abs(prior[1] - value) < .01 ? prior[2] : null;
      y += 58;
      text(label, left, y, 36);
      text(basis || matched || '依结算簿', left + 194, y, 33, { color: muted, width: 575 });
      text(String(value), right, y, 36, { align: 'right' });
      line(left, right, y + 29);
    }
    y += 66;
    text(`难度系数 ×${score.factor.toFixed(1)}`, left, y, 38);
    text(`总分 ${score.total}`, right, y, 46, { bold: true, color: cinnabar, align: 'right' });
    y += 34;

    section('本局功业');
    const honors = [...score.honors].sort((a, b) => b.pts - a.pts);
    const listed = honors.slice(0, 12);
    if (!honors.length) {
      y += 56;
      text('本卷尚无功业。', left, y, 34, { color: muted });
    }
    for (const [i, honor] of listed.entries()) {
      if (i % 2 === 0) y += 55;
      const x = i % 2 === 0 ? left : middle + 12;
      text(honor.name, x, y, 36, { width: 310 });
      text(`+${honor.pts}`, x + width / 2 - 27, y, 33, { color: cinnabar, align: 'right' });
    }
    if (honors.length > listed.length) {
      y += 50;
      text(`共 ${honors.length} 项，余 ${honors.length - listed.length} 项未列`, left, y, 34, { color: muted });
    }
    y += 42;
    line(left, right, y);

    const chronicle = EVENTS.settlementChronicle();
    section('大事记');
    y += 60;
    if (!chronicle.events.length) paragraph('本卷未记大事。', left, width, 35, 50);
    for (const [date, fact] of chronicle.events) {
      text(date, left, y, 33, { color: cinnabar, width: 268 });
      paragraph(fact, left + 294, width - 294, 35, 49);
      y += 8;
    }
    y += 8;
    text('史官评语', left, y, 36, { bold: true, color: cinnabar });
    y += 55;
    paragraph(score.assessment, left, width, 35, 52);
    y += 12;
    line(left, right, y);
    section('将相列传');
    y += 84;
    for (const [i, { g, wins }] of chronicle.generals.entries()) {
      const x = left + i * width / 3, top = y - 32;
      const drawPortrait = () => {
        ctx.drawImage(PORTRAIT.get(g, drawPortrait), x, top, 78, 78);
        ctx.strokeStyle = '#c5b28b';
        ctx.strokeRect(x, top, 78, 78);
      };
      draws.push(drawPortrait);
      text(g.name, x + 92, y - 7, 36, { bold: true, width: width / 3 - 105 });
      text(`胜 ${wins} 场`, x + 92, y + 34, 33, { color: muted });
    }
    if (!chronicle.generals.length) text('本卷尚无列传。', left, y, 34, { color: muted });
    y += 88;
    line(left, right, y);
    text(`制作人 ${CREATOR} · 微信 ${WECHAT}`, middle, y + 42, 31, { align: 'center', color: muted });
    text('更多游戏　小红书搜索「模拟游戏大全」', middle, y + 88, 31, { align: 'center', color: muted });
    sheet.height = y + 148;
    const wash = ctx.createLinearGradient(0, 0, sheet.width, 0);
    wash.addColorStop(0, '#e3cba1');
    wash.addColorStop(.09, paper);
    wash.addColorStop(.91, paper);
    wash.addColorStop(1, '#e3cba1');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    for (const [inset, weight, color] of [[19, 4, ink], [28, 1.5, muted]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = weight;
      ctx.strokeRect(inset, inset, sheet.width - inset * 2, sheet.height - inset * 2);
    }
    for (const draw of draws) draw();
    sheet._lettering = lettering;
    return sheet;
  }
  function previewSettlementPng(blob) {
    const dialog = document.createElement('dialog');
    dialog.className = 'settlement-preview';
    dialog.innerHTML = '<header><span>长按图片保存到相册</span><button type="button" class="btn">关闭</button></header><img alt="还我河山结算长卷">';
    const url = URL.createObjectURL(blob);
    function cleanup() { dialog.remove(); URL.revokeObjectURL(url); }
    try {
      dialog.querySelector('img').src = url;
      dialog.querySelector('button').onclick = () => dialog.close();
      dialog.addEventListener('close', cleanup, { once: true });
      document.body.append(dialog);
      dialog.showModal();
    } catch (error) {
      cleanup();
      throw error;
    }
  }
  async function saveSettlementScroll(canvas, score, button) {
    button.disabled = true;
    try {
      const blob = await new Promise((resolve, reject) => canvas.toBlob(
        png => png?.size ? resolve(png) : reject(new Error('空白长卷')), 'image/png'));
      if (!canvas.isConnected) return;
      const filename = `还我河山-结算-公元${score.end}-${score.rating}.png`;
      if (phone.matches || TOUCH.matches) {
        try {
          const data = { files: [new File([blob], filename, { type: 'image/png' })] };
          if (navigator.share && navigator.canShare?.(data)) {
            await navigator.share(data);
            return;
          }
        } catch (error) {
          if (error.name === 'AbortError') return;
          toast('分享未成，请长按图片保存。', 'scroll-error');
        }
        if (canvas.isConnected) previewSettlementPng(blob);
      } else downloadBlob(blob, filename);
    } catch (error) {
      toast('长卷未能保存，请再试。', 'scroll-error');
    } finally {
      button.disabled = false;
    }
  }
  function showSettlement(result) {
    const ending = GAME.finishGame(result);
    const score = ending.score = EVENTS.settlementScore(ending);
    let canvas;
    try { canvas = drawSettlementScroll(score); }
    catch (error) { toast('长卷未能绘成。', 'scroll-error'); }
    openModal(`<div class="scroll settlement-page">${canvas ? '' : `<h1>${esc(score.title)}</h1><p class="note">${esc(score.rating)} · ${score.total} 分</p>`}</div>
      <div class="record-actions">
        <button type="button" class="btn" data-settlement="title">再开天下</button>
        ${ending.type === 'unify' ? '<button type="button" class="btn" data-settlement="continue">继续经营</button>' : ''}
        <button type="button" class="btn" data-settlement="record" ${ending.recorded ? 'disabled' : ''}>${ending.recorded ? '已录入功业榜' : '录入功业榜'}</button>
        ${canvas ? '<button type="button" class="btn red" data-settlement="save">保存长卷</button>' : ''}
      </div><p class="note settlement-feedback" role="status"></p>`, { width: '820px', lock: true });
    if (canvas) $('modal').querySelector('.settlement-page').append(canvas);
    $('modal').onclick = e => {
      const b = e.target.closest('[data-settlement]');
      if (!b) return;
      if (b.dataset.settlement === 'save') { saveSettlementScroll(canvas, score, b); return; }
      if (b.dataset.settlement === 'title') { returnToTitle(); return; }
      if (b.dataset.settlement === 'continue') {
        ending.continued = true;
        closeModal();
        return;
      }
      if (ending.recorded) return;
      const entry = { date: new Date().toLocaleDateString('zh-CN'), rating: score.rating, total: score.total,
        difficulty: score.difficulty, scale: score.scale, result: score.title, years: score.years };
      const status = $('modal').querySelector('.settlement-feedback');
      try {
        localStorage.setItem(HALL_KEY, JSON.stringify([entry, ...hallEntries()].slice(0, 20)));
        ending.recorded = true;
        b.disabled = true; b.textContent = '已录入功业榜';
        status.textContent = '本局已题名。';
      } catch (e) {
        status.textContent = '未能入榜，请检查本浏览器存储空间。';
      }
    };
  }

  // ---------- 事件 ----------
  function processPending() {
    if (!S() || inTurn || RENDER.isAnimating() || $('tac-bg')?.classList.contains('hidden') === false ||
        !$('title').classList.contains('hidden') || !$('modal-bg').classList.contains('hidden')) return;
    if (battleQueue.length) { flushBattles(true); return; }
    if (S().defeat && !S().settlement) GAME.finishGame('defeat');
    const settlement = S().settlement;
    if (settlement && !settlement.continued) {
      const ev = settlement.type === 'unify' ? 'endingUnify' : 'endingDefeat';
      const index = S().pending.findIndex(p => p.ev === ev);
      if (index >= 0) showEvent(S().pending.splice(index, 1)[0], settlement.type);
      else showSettlement(settlement.type);
      return;
    }
    const p = S().pending.shift();
    if (!p) {
      while (marchEngagements.length) {
        const { aid, tile } = marchEngagements.shift(), a = GAME.army(aid);
        if (a?.f !== P() || a.mp <= 0 || !a.path?.length) continue;
        const step = GAME.routeStep(a, a.tile, a.path);
        if (step.kind !== 'attack' || step.to !== tile) continue;
        engage(aid, tile);
        return;
      }
      refreshTop(); refreshSide(); return;
    }
    if (!EVENTS.presentable(p)) return processPending();
    showEvent(p);
  }
  function showEvent(p, ending) {
    const cue = p.ev === 'levelup' ? 'rank' : p.ev === 'court_newemp' || p.ev === 'endingDefeat' ? 'major' : 'event';
    AUDIO.play(cue);
    const v = EVENTS.view(p);
    if (v.type === 'pick') {
      const chosen = new Set();
      const render = () => {
        let h = `<h1>${v.title}</h1><div class="story">${esc(v.text)}</div><div style="text-align:center">`;
        for (const id of v.options) {
          const g = GAME.gen(id);
          const track = p.ev === 'recommend' ? '荐士' : g.zheng >= g.wu ? '进士' : '武举';
          const home = g.kejuCity != null ? GAME.city(g.kejuCity) : null;
          h += `<div class="cand ${chosen.has(id) ? 'on' : ''}" data-c="${id}">${PORTRAIT.img(g, 56, 'style="float:right;width:56px;height:56px"')}<b>${esc(g.name)}</b>${g.hist ? ' <span class="chip red">史</span>' : ''}<br><span class="note">${track}　${S().year - g.birth}岁${home ? '<br>' + esc(home.name) + '籍' : ''}</span><br>统 ${g.tong}　武 ${g.wu}<br>智 ${g.zhi}　政 ${g.zheng}<br>${g.skill ? `<span class="skill">【${g.skill}】</span>` : '&nbsp;'}</div>`;
        }
        const decision = p.ev === 'recommend' ? (chosen.size ? `准录 ${chosen.size}/${v.max} 人入仕` : '悉遣诸士还乡') : `钦点 ${chosen.size}/${v.max} 人，放榜`;
        h += `</div><div class="choices" style="margin-top:10px"><button class="choice" id="kj">${decision}</button></div>`;
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
    v.choices.forEach((c, i) => { h += `<button class="choice" data-ch="${i}"${c.disabled ? ' disabled' : ''}>${esc(c.t)}${c.d ? `<small>${esc(c.d)}</small>` : ''}</button>`; });
    h += `</div>`;
    openModal(h, { lock: true, width: '700px' });
    $('modal').onclick = e => {
      const b = e.target.closest('[data-ch]'); if (!b || b.disabled) return;
      $('modal').onclick = null;
      const gold = GAME.fac(P()).gold;
      EVENTS.resolve(p, +b.dataset.ch);
      if (GAME.fac(P()).gold > gold) AUDIO.play('coin');
      if (ending) { showSettlement(ending); return; }
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
    const loot = battleLoot(r);
    return `<tr><td>${facSeal(r.att)} ${esc(r.attName)}</td><td>${fmt(r.before.a)} → ${fmt(r.after.a)}</td><td>攻</td><td>${facSeal(r.def)} ${esc(r.defName)}${r.city ? '（' + r.city + '）' : ''}</td><td>${fmt(r.before.d)} → ${fmt(r.after.d)}</td><td class="${win ? 'pos' : 'neg'}"><b>${esc(myResult(r))}</b>${r.captured ? '<br>' + esc(r.captured) : ''}${loot ? '<br>' + esc(loot) : ''}</td></tr>`;
  }
  function battleLoot(r) {
    const items = Object.values(r.loot || {}).flat();
    return items.length ? `缴得${GAME.itemNames(items)}，已入府库。` : '';
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
        <div class="bres ${win ? 'win' : 'lose'}">${win ? '捷' : '挫'}　${esc(myResult(r))}</div>${r.plan ? `<p class="note" style="text-align:center">${esc(r.plan)}</p>` : ''}${r.captured ? `<p style="text-align:center">${esc(r.captured)}</p>` : ''}${r.loot ? `<p style="text-align:center">${esc(battleLoot(r))}</p>` : ''}
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
    AUDIO.beginReplay();
    AUDIO.play('turn');
    inTurn = true; $('endbtn').classList.add('busy'); $('endbtn').querySelector('span').textContent = '运筹中';
    setTimeout(() => {
      let snap = null;
      try {
        GAME.takeAnim();
        snap = RENDER.snapshot();
        GAME.endTurn();
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
        runDefenses(() => { updateSoundMood(); flushDeferred(); processPending(); });
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
        if (n) {
          GAME.sweepItemTransfers(); // 亲自守御在回合演武后才结算。
          RENDER.buildPolitical(); RENDER.buildFog();
          if (sel && sel.type === 'army' && !GAME.army(sel.id)) select(null);
          refreshSide(); refreshTop();
        }
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
    layoutText(el);
    $('toasts').appendChild(el);
    while ($('toasts').children.length > 5) $('toasts').firstChild.remove();
    setTimeout(() => { el.style.transition = 'opacity .5s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 500); }, type === 'big' ? 2200 : 3800);
  }

  return { boot, select, toast, processPending, engage, showSettlement, layoutText };
})();
window.addEventListener('load', () => UI.boot());
