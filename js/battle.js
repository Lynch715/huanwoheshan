// 战斗体验：战前军议（计策、胜算）与临阵指挥（六角小战场）
var TACTIC = (function () {
  const U = DATA.UNITS, COMBAT = DATA.COMBAT;
  const S = () => GAME.S;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const T = GEO.T;
  const isPhone = () => matchMedia('(max-width: 600px), (max-height: 500px)').matches;
  let root = null;
  let boardResize = null;
  function overlay(html, wide) {
    if (!root) { root = document.createElement('div'); root.id = 'tac-bg'; document.body.appendChild(root); }
    const previous = root.firstElementChild;
    if (!previous) AUDIO.play('paper');
    const scroll = previous?.querySelector('.tac-body');
    const scrollTop = isPhone() ? scroll?.scrollTop : previous?.scrollTop;
    root.innerHTML = `<div id="tac" class="${wide ? 'wide' : ''}">${html}</div>`;
    root.classList.remove('hidden');
    const panel = root.firstElementChild;
    UI.layoutText(panel);
    if (scrollTop && !wide) {
      const region = isPhone() ? panel.querySelector('.tac-body') : panel;
      if (region) region.scrollTop = scrollTop;
    }
    return panel;
  }
  function close() {
    boardResize?.disconnect();
    boardResize = null;
    if (root && !root.classList.contains('hidden')) {
      AUDIO.play('paper'); root.classList.add('hidden'); root.innerHTML = '';
    }
  }
  function unitName(f, t) { return DATA.CULTURE_UNIT_NAME[GAME.fac(f).culture]?.[t] || U[t].name; }
  function seal(f) { const F = GAME.fac(f); return `<span class="seal sm" style="background:${F.color}">${F.seal}</span>`; }
  function winProb(r) { return GAME.winChance(r); }
  function commandNotes(side) {
    const g = GAME.gen(side.gen), d = GAME.gen(side.deputy);
    const adviser = GAME.adviserBonus(side);
    return (g && GAME.weakCommand(g) < 1 ? '<div class="neg">主将不知兵</div>' : '') +
      (d ? `<div class="note">${GAME.civil(d) ? '参军' : '副将'} ${esc(d.name)}${GAME.civil(d) ? ' · 计策 ' + (adviser >= 0 ? '+' : '−') + Math.abs(Math.round(adviser * 100)) + '%' : ''}</div>` : '');
  }
  function lineupCounters(own, enemy) {
    const main = GAME.primaryType(GAME.strengthByType(enemy.units));
    if (!main) return '';
    const rows = own.units.map((u, i) => {
      const { label, rate } = DATA.matchup(u.t, main);
      return `<li data-counter="${label}">${i + 1} 营 · ${esc(unitName(own.f, u.t))} <b title="平原交锋胜面 ${rate}%" class="${rate > 65 ? 'pos' : rate < 35 ? 'neg' : ''}">${label}</b></li>`;
    }).join('');
    return `<section class="lineup-counters"><b>各营对位 · 敌军主力 ${esc(unitName(enemy.f, main))}</b><ul>${rows}</ul></section>`;
  }

  // ---------- 计策（数据见 js/stratagems.js） ----------
  const MODKEY = { att: { foeLoss: 'preD', myLoss: 'preA', foeMorale: 'dMorale', myMorale: 'aMorale', foeMult: 'dMult', myMult: 'aMult' },
                   def: { foeLoss: 'preA', myLoss: 'preD', foeMorale: 'aMorale', myMorale: 'dMorale', foeMult: 'aMult', myMult: 'dMult' } };
  const EFF_TEXT = { foeLoss: v => `敌兵员 −${Math.round(v * 100)}%`, myLoss: v => `我军折损 ${Math.round(v * 100)}%`, foeMorale: v => `敌士气 ${v > 0 ? '+' : '−'}${Math.abs(v)}`, myMorale: v => `我军士气 ${v > 0 ? '+' : '−'}${Math.abs(v)}`,
    foeMult: v => `敌战力 ${v < 1 ? '−' : '+'}${Math.round(Math.abs(1 - v) * 100)}%`, myMult: v => `我军战力 ${v < 1 ? '−' : '+'}${Math.round(Math.abs(1 - v) * 100)}%`, noTerrain: () => '敌不得地利', noWall: () => '敌不得城防', wallHit: v => `城防 −${Math.round(v * 100)}%` };
  function toMods(eff, side, city) {
    const m = {};
    for (const k in eff || {}) {
      if (MODKEY[side][k]) {
        const mk = MODKEY[side][k];
        m[mk] = k.endsWith('Mult') ? (m[mk] || 1) * eff[k] : (m[mk] || 0) + eff[k];
      } else if (side === 'att' && (k === 'noTerrain' || k === 'noWall' || (k === 'wallHit' && city))) m[k] = eff[k];
    }
    return m;
  }
  function effText(eff, side, city) {
    return Object.keys(eff || {}).filter(k => EFF_TEXT[k] && (MODKEY[side][k] || (side === 'att' && (k !== 'wallHit' || city)))).map(k => EFF_TEXT[k](eff[k])).join('，');
  }
  function plansFor(a, tile, side) {
    side = side || 'att';
    const B = GAME.battleSides(a, tile);
    const myUnits = side === 'att' ? a.units : B.D.units;
    const own = side === 'att' ? B.A : B.D, foe = side === 'att' ? B.D : B.A;
    const g = GAME.campaignCommand(own, side, B.ctx), eg = GAME.campaignCommand(foe, side === 'att' ? 'def' : 'att', B.ctx);
    const zd = ((g ? g.zhi : 40) - (eg ? eg.zhi : 45)) / 100;
    const sk = g ? (GAME.hasSkill(g, '运筹') ? 0.1 : 0) + (g.zhi >= 85 ? 0.05 : 0) + (side === 'def' && GAME.hasSkill(g, '坚守') ? 0.05 : 0) : 0;
    const tkey = Object.keys(T).find(k => T[k] === GEO.terrain[tile]);
    const season = S().season, river = !!GEO.river[tile];
    const city = !!(B.c && B.c.f === B.defF);
    const cav = myUnits.filter(u => DATA.TERRAIN_COMBAT.groups[u.t] === 'cav').length / Math.max(1, myUnits.length);
    const test = n => {
      if (!n) return true;
      if (n.anyOf && !n.anyOf.some(test)) return false;
      if (n.terrain && !n.terrain.includes(tkey)) return false;
      if (n.river && !river) return false;
      if (n.city === true && !city) return false;
      if (n.city === false && city) return false;
      if (n.water != null && n.water !== !!B.water) return false;
      if (n.season && !n.season.includes(season)) return false;
      if (n.foeZhiMax != null && eg && eg.zhi > n.foeZhiMax) return false;
      if (n.cavMin != null && cav < n.cavMin) return false;
      if (n.unitAny && !myUnits.some(u => n.unitAny.includes(DATA.unitBase(u.t)))) return false;
      if (n.skill && !(g && GAME.hasSkill(g, n.skill))) return false;
      return true;
    };
    const list = [];
    for (const x of (window.STRATAGEMS || [])) {
      if (x.side !== side && x.side !== 'both') continue;
      const n = x.need || {};
      const needGen = n.needGen != null ? n.needGen : side === 'att';
      if (needGen && !g) continue;
      const b = x.bonus || {};
      let ch = x.base + zd + sk + GAME.adviserBonus(own) + ((b.season || {})[season] || 0) + ((b.terrain || {})[tkey] || 0) + (b.cav || 0) * cav;
      if (b.foeZhiLow) ch += eg ? (60 - eg.zhi) / 100 : 0.2;
      if (!g) ch -= 0.1;
      const mods = toMods(x.eff, side, city), failMods = toMods(x.failEff, side, city);
      const et = effText(x.eff, side, city), ft = effText(x.failEff, side, city);
      list.push({ id: x.id, name: x.name, chance: clamp(ch, 0.05, 0.85), desc: x.desc + (et ? '：' + et : ''), fail: x.fail + (ft ? '：' + ft : ''),
        mods, failMods, ok: test(n), why: x.why || '形势不合', hist: x.hist });
    }
    return { list, g, eg, note: !g ? (side === 'att' ? '偏师无主将，无从施计。' : '守军无主将，计策难成') : null };
  }

  // 计策列表：只列可施之策，不合形势者收起
  let showAllPlans = false;
  function planGrid(list, pick) {
    const ok = list.filter(x => x.ok), no = list.filter(x => !x.ok);
    const btn = x => `<button class="plan ${pick === x.id ? 'on' : ''}" data-p="${x.id}" ${x.ok ? (x.hist ? 'title="' + esc(x.hist) + '"' : '') : 'disabled title="' + esc(x.hist || '') + '"'}><span class="plan-head"><b>${x.name}</b><span class="cost ${x.ok ? '' : 'plan-condition note'}">${x.ok ? Math.round(x.chance * 100) + '%' : x.why}</span></span><span class="note">${x.desc}</span></button>`;
    return `<div class="plans">${ok.length ? ok.map(btn).join('') : '<span class="note">眼下形势，无计可施。</span>'}</div>` +
      (no.length ? `<button type="button" class="note plan-more" data-more="1" aria-expanded="${showAllPlans}">${showAllPlans ? '收起' : '展开'} 不合形势之策 ${no.length} 条</button>` + (showAllPlans ? `<div class="plans">${no.map(btn).join('')}</div>` : '') : '');
  }
  // ---------- 战前军议 ----------
  function terrainRowsHTML(rows) {
    if (!rows.length) return '<p class="note terrain-neutral">此处交兵，地形无加减。</p>';
    const sides = { att: '攻方', def: '守方', both: '两军' };
    return '<ul class="terrain-mods" aria-label="地形修正">' + rows.map(({ role, label, mult }) => {
      const pct = Math.round(Math.abs(mult - 1) * 1000) / 10;
      return `<li><span class="note">${sides[role]}</span> ${esc(label)} <b class="${mult > 1 ? 'pos' : 'neg'}">${mult > 1 ? '+' : '−'}${pct}%</b></li>`;
    }).join('') + '</ul>';
  }
  function prebattle(a, tile, done) {
    const B = GAME.battleSides(a, tile);
    const P = plansFor(a, tile, 'att');
    const g = GAME.gen(a.gen), eg = GAME.gen(B.D.gen);
    const c = B.c && B.c.f === B.defF ? B.c : null;
    let pick = null;
    const terr = GEO.TERRAIN[B.tt];
    const unitsHTML = (units, f) => { const m = {}; for (const u of units) m[u.t] = (m[u.t] || 0) + 1; return Object.entries(m).map(([t, n]) => `<span class="chip uchip">${UNITART.img(f, t, 22)}${unitName(f, t)}×${n}</span>`).join(' '); };
    const canManual = !B.water;
    const render = () => {
      const plan = pick ? P.list.find(x => x.id === pick) : null;
      const base = GAME.previewBattle(a, tile, {});
      const pv = plan ? GAME.previewBattle(a, tile, plan.mods) : base;
      const p0 = winProb(base.r), p1 = winProb(pv.r);
      const pExp = plan ? plan.chance * p1 + (1 - plan.chance) * winProb(GAME.previewBattle(a, tile, plan.failMods).r) : p0;
      const fmt = n => n >= 10000 ? (n / 10000).toFixed(1) + '万' : Math.round(n);
      const side = (title, gg, f, units, extra) => `<div class="tside">${gg ? PORTRAIT.img(gg, 64) : seal(f)}<div><b style="font-size:18px">${esc(title)}</b><br>${gg ? `${gg.name}　统${gg.tong} 武${gg.wu} 智${gg.zhi}` : '无主将'}${gg && GAME.skillList(gg).length ? '<br><span class="skill">' + GAME.skillList(gg).map(k => '【' + k + '】').join('') + '</span>' : ''}<br>${unitsHTML(units, f)}<br><span class="note">${extra}</span></div></div>`;
      const h = `<div class="tac-body"><h1>战前军议</h1>
        <div class="tvs">${side(GAME.armyName(a), g, a.f, a.units, `兵 ${fmt(GAME.sumStr(a.units))}　士气 ${Math.round(a.morale)}`)}
        <div class="vsx">战</div>
        ${side(B.defArmy ? GAME.armyName(B.defArmy) : c.name + '守军', eg, B.defF, B.D.units, `兵 ${fmt(GAME.sumStr(B.D.units))}　士气 ${Math.round(B.D.morale)}${c ? '　城防 ' + Math.round(c.wall) : ''}`)}</div>
        <div class="note" style="text-align:center">战场 · ${terr.name}${GEO.river[tile] ? ' · 临河' : ''}${c ? '　攻城战' : ''}${B.water ? '　水战' : ''}${commandNotes(B.A)}${commandNotes(B.D)}</div>
        ${B.fortMult > 1 ? '<div class="note" style="text-align:center">守方 · 筑垒 +10%</div>' : ''}
        <div class="odds"><span>胜面</span><div class="obar"><i style="width:${Math.round(pExp * 100)}%"></i></div><b>${Math.round(pExp * 100)}%</b></div>
        ${terrainRowsHTML(GAME.battleTerrainRows(B, plan?.mods))}
        ${lineupCounters(B.A, B.D)}
        <div class="note" style="text-align:center">预计我军折损约 ${Math.round(pv.lossA * 100)}%，敌军折损约 ${Math.round(Math.min(0.95, pv.lossD) * 100)}%${plan ? `（计成时；计策成功率 ${Math.round(plan.chance * 100)}%）` : ''}</div>
        <div class="sec">计策 <span class="r note">${P.note || (eg ? `我将智 ${g.zhi} 对敌将智 ${eg.zhi}` : '敌无主将，计策易成')}</span></div>
        ${planGrid(P.list, pick)}</div>
        <div class="choices tac-actions">
          <button class="choice" data-go="auto">${plan ? '施' + plan.name + '，' : ''}自动决战<small>由主将临机指挥，即刻分晓</small></button>
          ${canManual ? `<button class="choice" data-go="manual">${plan ? '施' + plan.name + '，' : ''}临阵指挥<small>亲自布阵调度，于六角战场上逐营交锋</small></button>` : ''}
          <button class="choice" data-go="cancel">按兵不动<small>暂不交战，军队留在原地</small></button>
        </div>`;
      const el = overlay(h);
      el.onclick = e => {
        if (e.target.closest('[data-more]')) { showAllPlans = !showAllPlans; render(); return; }
        const pb = e.target.closest('[data-p]');
        if (pb && !pb.disabled) { pick = pick === pb.dataset.p ? null : pb.dataset.p; render(); return; }
        const go = e.target.closest('[data-go]'); if (!go) return;
        const k = go.dataset.go;
        if (k === 'cancel') { close(); done(null); return; }
        // 施计
        let mods = {}, planText = '';
        if (plan) {
          const ok = Math.random() < plan.chance;
          mods = ok ? plan.mods : plan.failMods;
          planText = `${plan.name}${ok ? '成功：' + plan.desc.split('：').pop() : '失败：' + plan.fail.split('：').pop()}`;
          if (window.UI && UI.toast) UI.toast(`${plan.name}${ok ? '得手！' : '未成……'}`, ok ? 'big' : 'war');
        }
        if (k === 'auto') { close(); done({ mods, plan: planText }); }
        else { close(); field(a, tile, Object.assign({}, mods, { dMult: (mods.dMult || 1) * B.fortMult }), planText, done); }
      };
    };
    render();
  }

  // ---------- 临阵指挥 ----------
  const COLS = 11, ROWS = 7, R = 34, SQ = Math.sqrt(3);
  const OX = 40, OY = 44;
  const TER = { P: 0, HILL: 1, FOREST: 2, RIVER: 3, WALL: 4, ROCK: 5 };
  const TNAME = ['平地', '丘陵', '林地', '河道', '城墙', '乱石'];
  const MV = { inf: 2, bow: 2, siege: 1, fire: 2, navy: 1, cav: 4, hbow: 4, hcav: 3, elite: 3 };
  const RNG = { bow: 3, hbow: 2, fire: 2, siege: 3 };
  for (const [id, unit] of Object.entries(U)) {
    if (!unit.base) continue;
    MV[id] = unit.tacticalMove ?? MV[unit.base];
    RNG[id] = unit.tacticalRange ?? RNG[unit.base];
  }
  const hx = (c, r) => OX + R * SQ * (c + 0.5 * (r & 1)), hy = r => OY + R * 1.5 * r;
  function nbrs(c, r) {
    const d = (r & 1) ? [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]] : [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]];
    return d.map(([dc, dr]) => [c + dc, r + dr]).filter(([x, y]) => x >= 0 && x < COLS && y >= 0 && y < ROWS);
  }
  function cube(c, r) { const x = c - (r - (r & 1)) / 2; return [x, -x - r, r]; }
  function hdist(a, b) { const A = cube(a[0], a[1]), B = cube(b[0], b[1]); return Math.max(Math.abs(A[0] - B[0]), Math.abs(A[1] - B[1]), Math.abs(A[2] - B[2])); }

  function field(a, tile, mods, planText, done, me) {
    AUDIO.play('battle');
    me = me || 0; const ai = 1 - me;
    const B = GAME.battleSides(a, tile);
    const city = B.c && B.c.f === B.defF ? B.c : null;
    const before = { a: GAME.sumStr(a.units), d: GAME.sumStr(B.D.units), wall: city ? city.wall : 0 };
    const unitBefore = { a: GAME.strengthByType(a.units), d: GAME.strengthByType(B.D.units) };
    // 施计（与自动战同口径）
    const preApply = (units, loss) => { for (const u of units) u.s = Math.max(1, Math.round(u.s * (1 - loss * rnd(0.8, 1.2)))); };
    if (mods.preA) preApply(a.units, mods.preA);
    if (mods.preD) preApply(B.D.units, mods.preD);
    if (mods.wallHit && city) city.wall = Math.max(0, city.wall - Math.round(GAME.maxWall(city) * mods.wallHit * GAME.siegeDamage(a.f)));
    // 地形
    const grid = [];
    const tt = B.tt;
    for (let r = 0; r < ROWS; r++) { grid.push([]); for (let c = 0; c < COLS; c++) {
      let t = TER.P; const h = Math.random();
      if (c >= 2 && c <= COLS - 3) {
        if ((tt === T.HILL || tt === T.PLATEAU) && h < 0.35) t = TER.HILL;
        else if ((tt === T.FOREST || tt === T.JUNGLE) && h < 0.35) t = TER.FOREST;
        else if (tt === T.MTN) t = h < 0.3 ? TER.HILL : h < 0.42 ? TER.ROCK : TER.P;
        else if (h < 0.08) t = TER.HILL; else if (h < 0.13) t = TER.FOREST;
      }
      grid[r].push(t);
    } }
    if (GEO.river[tile]) for (let r = 0; r < ROWS; r++) grid[r][5] = (r === 2 || r === 5) ? TER.P : TER.RIVER;
    const wallCol = 8;
    if (city && !mods.noWall) for (let r = 0; r < ROWS; r++) grid[r][wallCol] = r === 3 ? TER.P : TER.WALL;
    if (mods.noTerrain) for (let r = 0; r < ROWS; r++) for (let c = 6; c < COLS; c++) if (grid[r][c] === TER.HILL || grid[r][c] === TER.FOREST) grid[r][c] = TER.P;
    // 布阵
    const units = [];
    const place = (list, side, cols) => {
      const melee = list.filter(u => !RNG[u.t]), ranged = list.filter(u => RNG[u.t]);
      const order = side === 0 ? [...melee, ...ranged] : [...melee, ...ranged];
      const slots = [];
      for (const c of cols) for (const r of [3, 2, 4, 1, 5, 0, 6]) slots.push([c, r]);
      let k = 0;
      for (const u of order) {
        while (k < slots.length && grid[slots[k][1]][slots[k][0]] === TER.ROCK) k++;
        if (k >= slots.length) break;
        const [c, r] = slots[k++];
        units.push({ side, u, t: u.t, hp: u.s, hp0: u.s, c, r, done: false, mvLeft: 0 });
      }
    };
    place(a.units, 0, [2, 1, 0]);
    place(B.D.units, 1, city && !mods.noWall ? [wallCol, 9, 10] : [8, 9, 10]);
    const st = {
      round: 1, maxR: 10, sel: null, hover: null, busy: false, log: [], floats: [],
      morale: [clamp(a.morale + (mods.aMorale || 0), 5, GAME.moraleCap(a.f)), clamp(B.D.morale + (mods.dMorale || 0), 5, GAME.moraleCap(B.defF))],
      gens: [GAME.gen(a.gen), GAME.gen(B.D.gen)], facs: [a.f, B.defF], wall: city ? city.wall : 0, wallMax: city ? GAME.maxWall(city) : 1,
      total0: [units.filter(x => x.side === 0).reduce((s, x) => s + x.hp, 0), units.filter(x => x.side === 1).reduce((s, x) => s + x.hp, 0)],
      dMult: mods.dMult || 1, aMult: mods.aMult || 1, over: false,
    };
    const combatGens = [GAME.campaignCommand(B.A, 'att', B.ctx), GAME.campaignCommand(B.D, 'def', B.ctx)];
    const at = (c, r) => units.find(x => x.hp > 0 && x.c === c && x.r === r);
    const alive = side => units.filter(x => x.side === side && x.hp > 0);
    const frac = side => alive(side).reduce((s, x) => s + x.hp, 0) / Math.max(1, st.total0[side]);

    // ---- 战力计算 ----
    function combatPower(x, role, foe) {
      const g = combatGens[x.side], f = st.facs[x.side];
      const armyRole = x.side === 0 ? 'att' : 'def';
      let m = GAME.terrainPower(x.t, role, armyRole, B.ctx, g);
      if (armyRole === 'def') m *= GAME.terrainDefense(B.ctx, mods.noTerrain);
      if (g) {
        m *= role === 'att' ? 1 + (g.wu - 50) / 180 + (g.tong - 50) / 300 : 1 + (g.tong - 50) / 180 + (g.zhi - 50) / 300;
        const ter = grid[(role === 'def' ? x : foe).r][(role === 'def' ? x : foe).c];
        const skillCtx = { ...B.ctx, city: ter === TER.WALL || (city && role === 'att' && x.side === 0) };
        m *= GAME.skillMult(g, x, skillCtx, role, armyRole);
        if (role === 'def') m *= 1 + GAME.itemSum(g, 'armor');
        if (DATA.unitBase(x.t) === 'bow') m *= 1 + GAME.itemSum(g, 'bow');
      } else m *= 0.9;
      { const tu = GAME.techFx(f).unit; m *= (1 + (tu[DATA.unitBase(x.t)] || 0)) * (1 + (tu.all || 0)); }
      if (f !== S().player && f !== 'rebel') m *= GAME.difficultyRules().aiBattle;
      if (armyRole === 'att' && role === 'att') m *= GAME.campaignOffense(f);
      m *= (0.6 + 0.4 * st.morale[x.side] / 100) * GAME.weakCommand(st.gens[x.side]) * (1 + 0.1 * GAME.unitRank(x.u));
      if (x.side === 1) m *= st.dMult; else m *= st.aMult;
      return m;
    }
    function damage(att, def, ranged) {
      let A = combatPower(att, 'att', def), D = combatPower(def, 'def', att);
      const close = hdist([att.c, att.r], [def.c, def.r]) === 1;
      const factors = close ? COMBAT.closeFactors : COMBAT.factors;
      A *= factors[COMBAT.index[att.t]][COMBAT.index[def.t]];
      const dt = grid[def.r][def.c];
      if (dt === TER.WALL) {
        D *= U[att.t].siege ? 1.15 : 1.6;
        if (U[att.t].siege) A *= U[att.t].siege;
      }
      const flank = nbrs(def.c, def.r).filter(([c, r]) => { const o = at(c, r); return o && o.side === att.side && o !== att; }).length;
      A *= 1 + 0.12 * Math.min(2, flank);
      let d = 24 * Math.pow(A / D, 0.8) * (0.4 + 0.6 * att.hp / 100) * rnd(0.85, 1.15);
      if (ranged && close) d *= 0.7;
      return Math.max(1, d);
    }
    function hit(att, def, ranged) {
      AUDIO.play('clash');
      const d = Math.min(def.hp, damage(att, def, ranged));
      def.hp -= d;
      push(def, -Math.round(d * 5), '#b3322a');
      if (U[att.t].siege && city && grid[def.r][def.c] === TER.WALL) {
        const damage = (att.t === 'siege' ? 5 : 3) * (att.side === 0 ? GAME.siegeDamage(a.f) : 1);
        st.wall = Math.max(0, st.wall - damage);
      }
      let back = 0;
      if (!ranged && def.hp > 0) {
        back = Math.min(att.hp, damage(def, att, false) * (RNG[def.t] ? 0.3 : 0.55));
        att.hp -= back;
        push(att, -Math.round(back * 5), '#7a1d16');
      }
      const close = hdist([att.c, att.r], [def.c, def.r]) === 1;
      const matches = close ? COMBAT.closeMatches : COMBAT.matches;
      const ai = COMBAT.index[att.t], di = COMBAT.index[def.t];
      if (def.hp <= 0.5 && matches[ai][di] > 0) att.counterWin = true;
      if (att.hp <= 0.5 && matches[di][ai] > 0) def.counterWin = true;
      for (const x of [def, att]) if (x.hp <= 0.5) { x.hp = 0; st.morale[x.side] = Math.max(0, st.morale[x.side] - 8); st.morale[1 - x.side] = Math.min(GAME.moraleCap(st.facs[1 - x.side]), st.morale[1 - x.side] + 3); log(`${sideName(x.side)}${unitName(st.facs[x.side], x.t)}一营溃灭`); }
      st.morale[def.side] = Math.max(0, st.morale[def.side] - d / 12);
      flash = { a: [att.c, att.r], b: [def.c, def.r], t: performance.now() };
    }
    function sideName(s) { return s === me ? '我军' : '敌军'; }
    function push(x, v, color) { st.floats.push({ c: x.c, r: x.r, text: v.toString(), color, t: performance.now() }); }
    function log(t) { st.log.unshift(t); if (st.log.length > 6) st.log.pop(); }
    let flash = null;

    // ---- 移动 ----
    function cost(x, c, r) {
      const t = grid[r][c];
      if (t === TER.ROCK) return 99;
      if (t === TER.RIVER) return 3;
      if (t === TER.HILL || t === TER.FOREST) return 2;
      if (t === TER.WALL) return x.side === 1 ? 1 : 2;
      return 1;
    }
    function zoc(x, c, r) { return nbrs(c, r).some(([cc, rr]) => { const o = at(cc, rr); return o && o.side !== x.side; }); }
    function reach(x) {
      const mv = MV[x.t] || 2;
      const best = new Map(); const key = (c, r) => c * 100 + r;
      best.set(key(x.c, x.r), mv);
      const q = [[x.c, x.r, mv]];
      while (q.length) {
        const [c, r, m] = q.shift();
        if (m <= 0) continue;
        if (!(c === x.c && r === x.r) && zoc(x, c, r)) continue;
        for (const [nc, nr] of nbrs(c, r)) {
          if (at(nc, nr)) continue;
          const k = cost(x, nc, nr);
          if (k >= 99) continue;
          const left = m - k >= 0 ? m - k : (m === mv ? 0 : -1);
          if (left < 0) continue;
          const kk = key(nc, nr);
          if (!best.has(kk) || best.get(kk) < left) { best.set(kk, left); q.push([nc, nr, left]); }
        }
      }
      best.delete(key(x.c, x.r));
      return [...best.keys()].map(k => [Math.floor(k / 100), k % 100]);
    }
    function targets(x, fromC, fromR) {
      const rng = RNG[x.t] || 1;
      return units.filter(o => o.hp > 0 && o.side !== x.side && hdist([fromC, fromR], [o.c, o.r]) <= rng);
    }

    // ---- 电脑行动 ----
    function aiAct(x) {
      if (x.hp <= 0 || st.over) return;
      const foes = alive(1 - x.side);
      if (!foes.length) return;
      const score = o => {
        const matches = hdist([x.c, x.r], [o.c, o.r]) === 1 ? COMBAT.closeMatches : COMBAT.matches;
        const match = matches[COMBAT.index[x.t]][COMBAT.index[o.t]];
        return 2000 - o.hp * 10 + (match > 0 ? 600 : match < 0 ? -500 : 0);
      };
      const holdWall = x.side === 1 && city && grid[x.r][x.c] === TER.WALL;
      if (RNG[x.t]) {
        let ts = targets(x, x.c, x.r);
        if (!ts.length && !holdWall) {
          const opts = reach(x).filter(([c, r]) => targets(x, c, r).length);
          if (opts.length) { opts.sort((p, q) => Math.min(...foes.map(o => hdist(q, [o.c, o.r]))) - Math.min(...foes.map(o => hdist(p, [o.c, o.r])))); [x.c, x.r] = opts[0]; }
          else moveToward(x, foes);
          ts = targets(x, x.c, x.r);
        }
        if (ts.length) { ts.sort((p, q) => score(q) - score(p)); hit(x, ts[0], true); }
        return;
      }
      // 近战：寻可攻之敌
      let best = null, bs = -1e9;
      const spots = [[x.c, x.r], ...reach(x)];
      for (const [c, r] of spots) for (const [nc, nr] of nbrs(c, r)) {
        const o = at(nc, nr); if (!o || o.side === x.side) continue;
        let sc = score(o) - (c === x.c && r === x.r ? 0 : 20);
        if (holdWall && !(c === x.c && r === x.r)) sc -= 400;
        if (sc > bs) { bs = sc; best = [c, r, o]; }
      }
      if (best && (!holdWall || bs > 0)) { x.c = best[0]; x.r = best[1]; hit(x, best[2], false); return; }
      if (holdWall && foes.some(o => hdist([o.c, o.r], [x.c, x.r]) <= 3)) return;
      moveToward(x, foes);
    }
    function moveToward(x, foes) {
      const opts = reach(x); if (!opts.length) return;
      const d = p => Math.min(...foes.map(o => hdist(p, [o.c, o.r])));
      opts.sort((p, q) => d(p) - d(q));
      if (d(opts[0]) < d([x.c, x.r])) [x.c, x.r] = opts[0];
    }

    // ---- 胜负 ----
    function check() {
      for (const s of [0, 1]) {
        if (!alive(s).length || frac(s) < 0.28 || st.morale[s] < 12) { end(s === 0 ? 'def' : 'att', s); return true; }
      }
      return false;
    }
    function end(winner, routed) {
      if (st.over) return;
      st.over = true;
      const fa = frac(0), fd = frac(1);
      let r;
      if (winner === 'att') r = clamp(0.62 + 0.3 * fa, 0.62, 0.92);
      else if (winner === 'def') r = clamp(0.38 - 0.25 * fd, 0.08, 0.38);
      else r = city ? Math.min(0.45, 0.5 + (fa - fd) / 2) : clamp(0.5 + (fa - fd) / 2, 0.3, 0.62);
      // 回写兵力
      for (const x of units) x.u.s = Math.max(0, Math.round(x.hp));
      let wall = st.wall;
      if (city && winner === 'att') { for (const x of units) if (x.side === 1) x.u.s = 0; wall = 0; }
      const text = me === 0
        ? (winner === 'att' ? (routed === 1 ? '敌军阵脚大乱，溃不成军！' : '敌军全线崩溃！') : winner === 'def' ? (routed === 0 && st.retreat ? '我军鸣金收兵，退出战场。' : '我军攻势受挫，被迫收兵。') : (city ? '鏖战竟日，城池未下，鸣金收兵。' : '两军相持，各自收兵。'))
        : (winner === 'def' ? (routed === 0 ? '来犯之敌阵脚大乱，狼狈退走！' : '敌军攻势瓦解，铩羽而归！') : winner === 'att' ? (st.retreat ? (city ? '我军弃城突围。' : '我军撤出战场。') : (city ? '守军崩溃，城池失陷！' : '我军阵线崩溃，败退而走。')) : (city ? '敌军久攻不下，城池固守无虞。' : '两军相持，各自收兵。'));
      const res = (winner === 'att') === (me === 0) ? 'win' : winner === 'none' ? (me === 1 && city ? 'win' : 'draw') : 'lose';
      setTimeout(() => {
        const attended = [0, 1].map(side => units.filter(x => x.side === side).map(x => x.u));
        const counterWins = units.filter(x => x.counterWin).map(x => x.u);
        overlayEnd(text, res, () => { close(); done({ manual: { r, before, wall, unitBefore, winner, attended, counterWins }, plan: (planText ? planText + '；' : '') + '临阵指挥：' + text }); });
      }, 500);
    }

    // ---- 界面 ----
    const W = Math.ceil(OX * 2 + R * SQ * (COLS + 0.5)), H = Math.ceil(OY + R * 1.5 * (ROWS - 1) + R + 26);
    const el = overlay(`<div class="thead"><div class="tg">${st.gens[0] ? PORTRAIT.img(st.gens[0], 42) : seal(a.f)}<div><b>${esc(GAME.armyName(a))}</b><div class="mbar"><i id="m0"></i></div></div></div>
      <div class="tround"><div id="tround"></div><div class="note">${planText ? esc(planText) : ''}</div></div>
      <div class="tg r"><div style="text-align:right"><b>${B.defArmy ? esc(GAME.armyName(B.defArmy)) : esc(city.name) + '守军'}</b><div class="mbar red"><i id="m1"></i></div></div>${st.gens[1] ? PORTRAIT.img(st.gens[1], 42) : seal(B.defF)}</div></div>
      <div class="tboard"><canvas id="tcv" width="${W}" height="${H}" aria-label="六角战场"></canvas></div>
      <div class="field-controls"><button type="button" class="btn" id="field-drawer" aria-controls="field-orders" aria-expanded="false">军令</button>
      <div id="field-orders"><div class="field-summary"><div id="field-round"></div>${planText ? '<div class="note">' + esc(planText) + '</div>' : ''}</div>
      <div class="tfoot"><div id="tinfo" class="note"></div><div class="btns"><button class="btn red" id="tend">结束本回合</button><button class="btn" id="tauto">全军自动</button><button class="btn" id="tretreat">鸣金撤退</button></div></div>
      <div id="tlog" class="note"></div></div></div>`, true);
    const cv = el.querySelector('#tcv'), cx = cv.getContext('2d');
    const board = cv.parentElement;
    const drawer = el.querySelector('#field-drawer');
    let portrait = null, dpr = 1, zoom = 1, panX = 0, panY = 0;
    const view = { fit: 1, scale: 1, x: 0, y: 0, width: W, height: H };
    const point = (c, r) => {
      const x = hx(c, r), y = hy(r);
      if (!portrait) return [x, y];
      return me === 0 ? [y, W - x] : [H - y, x];
    };
    function updateView() {
      view.scale = view.fit * zoom;
      const x = (view.width - H * view.scale) / 2, y = (view.height - W * view.scale) / 2;
      panX = clamp(panX, -Math.max(0, -x), Math.max(0, -x));
      panY = clamp(panY, -Math.max(0, -y), Math.max(0, -y));
      view.x = portrait ? x + panX : 0;
      view.y = portrait ? y + panY : 0;
      cv.dataset.zoom = zoom.toFixed(2);
    }
    const resizeBoard = () => {
      const vertical = innerWidth < innerHeight;
      if (portrait !== vertical) {
        portrait = vertical; zoom = 1; panX = panY = 0;
        el.classList.toggle('field-portrait', portrait);
        cv.dataset.layout = portrait ? 'portrait' : 'landscape';
      }
      const fit = portrait ? board.clientWidth / H : Math.min(1, board.clientWidth / W, isPhone() ? board.clientHeight / H : 1);
      if (fit <= 0) return;
      dpr = window.devicePixelRatio || 1;
      view.width = portrait ? board.clientWidth : W * fit;
      view.height = portrait ? board.clientHeight : H * fit;
      view.fit = fit;
      cv.style.width = view.width + 'px';
      cv.style.height = view.height + 'px';
      const w = Math.round(view.width * dpr), h = Math.round(view.height * dpr);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      updateView();
    };
    drawer.onclick = () => {
      const open = drawer.getAttribute('aria-expanded') === 'true';
      drawer.setAttribute('aria-expanded', String(!open));
    };
    resizeBoard();
    boardResize = new ResizeObserver(resizeBoard);
    boardResize.observe(board);
    const FONT = RENDER.FONT;
    let reachSet = [], tgtSet = [];
    function draw() {
      const now = performance.now();
      cx.setTransform(1, 0, 0, 1, 0, 0);
      cx.fillStyle = '#e9dfc6'; cx.fillRect(0, 0, cv.width, cv.height);
      if (portrait) cx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, view.x * dpr, view.y * dpr);
      else cx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const [x, y] = point(c, r), t = grid[r][c];
        cx.beginPath(); for (let k = 0; k < 6; k++) { const ang = Math.PI / 180 * (60 * k + (portrait ? 60 : -30)); const px = x + (R - 1) * Math.cos(ang), py = y + (R - 1) * Math.sin(ang); k ? cx.lineTo(px, py) : cx.moveTo(px, py); } cx.closePath();
        cx.fillStyle = ['#ece3cb', '#ddd0b0', '#cfd5b6', '#b9c9c9', '#a8a090', '#8f8a80'][t]; cx.fill();
        cx.strokeStyle = 'rgba(40,35,30,0.25)'; cx.lineWidth = 1; cx.stroke();
        if (reachSet.some(([a1, b1]) => a1 === c && b1 === r)) { cx.fillStyle = 'rgba(80,140,60,0.25)'; cx.fill(); }
        cx.fillStyle = 'rgba(40,35,30,0.55)'; cx.font = `11px ${FONT}`; cx.textAlign = 'center';
        if (t === TER.HILL) { cx.beginPath(); cx.moveTo(x - 12, y + 8); cx.quadraticCurveTo(x, y - 8, x + 12, y + 8); cx.strokeStyle = 'rgba(60,55,45,0.6)'; cx.lineWidth = 1.5; cx.stroke(); }
        if (t === TER.FOREST) for (const [dx, dy] of [[-8, 4], [6, -2], [0, 10]]) { cx.fillStyle = 'rgba(60,80,55,0.55)'; cx.beginPath(); cx.arc(x + dx, y + dy, 5, 0, 7); cx.fill(); }
        if (t === TER.RIVER) { cx.strokeStyle = 'rgba(70,100,115,0.7)'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(x - 10, y - 4); cx.quadraticCurveTo(x, y + 4, x + 10, y - 4); cx.stroke(); }
        if (t === TER.WALL) { cx.fillStyle = 'rgba(60,50,40,0.85)'; cx.fillRect(x - 14, y - 6, 28, 12); for (let k = -12; k <= 8; k += 8) cx.fillRect(x + k, y - 11, 5, 5); }
        if (t === TER.ROCK) { cx.fillStyle = 'rgba(60,55,50,0.7)'; cx.beginPath(); cx.moveTo(x - 10, y + 8); cx.lineTo(x - 2, y - 10); cx.lineTo(x + 10, y + 8); cx.fill(); }
      }
      // 目标
      for (const o of tgtSet) { cx.strokeStyle = 'rgba(180,40,30,0.9)'; cx.lineWidth = 3; cx.beginPath(); cx.arc(...point(o.c, o.r), R * 0.7, 0, 7); cx.stroke(); }
      if (flash && now - flash.t < 400) {
        cx.strokeStyle = `rgba(180,40,30,${1 - (now - flash.t) / 400})`; cx.lineWidth = 3;
        cx.beginPath(); cx.moveTo(...point(...flash.a)); cx.lineTo(...point(...flash.b)); cx.stroke();
      }
      // 单位
      for (const x of units) {
        if (x.hp <= 0) continue;
        const [px, py] = point(x.c, x.r);
        const F = GAME.fac(st.facs[x.side]);
        cx.globalAlpha = x.side === me && x.done && !st.over ? 0.55 : 1;
        // 兵种立绘圆章：攻方面右、守方面左
        UNITART.token(cx, st.facs[x.side], x.t, px, py - 7, R * 0.66, { flip: x.side === 1, sel: st.sel === x });
        const tag = unitName(st.facs[x.side], x.t).slice(0, 2);
        cx.font = `bold 10px ${FONT}`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
        const tw = cx.measureText(tag).width + 8;
        cx.fillStyle = F.color; cx.fillRect(px - tw / 2, py + 9, tw, 12);
        cx.strokeStyle = 'rgba(20,18,16,0.8)'; cx.lineWidth = 1; cx.strokeRect(px - tw / 2, py + 9, tw, 12);
        cx.fillStyle = '#f6eedb'; cx.fillText(tag, px, py + 15.5);
        cx.fillStyle = 'rgba(0,0,0,0.5)'; cx.fillRect(px - 16, py + 22, 32, 4);
        cx.fillStyle = x.side === me ? '#5f9a4a' : '#c0463a'; cx.fillRect(px - 16, py + 22, 32 * x.hp / 100, 4);
        cx.globalAlpha = 1;
      }
      st.floats = st.floats.filter(f => now - f.t < 1100);
      for (const f of st.floats) {
        const p = (now - f.t) / 1100, [x, y] = point(f.c, f.r), rise = y - 10 - 24 * p;
        cx.globalAlpha = 1 - p; cx.font = `bold 15px ${FONT}`; cx.lineWidth = 3;
        cx.strokeStyle = '#f4ecd8'; cx.strokeText(f.text, x, rise); cx.fillStyle = f.color; cx.fillText(f.text, x, rise); cx.globalAlpha = 1;
      }
      el.querySelector('#m0').style.width = (100 * st.morale[0] / GAME.moraleCap(st.facs[0])) + '%';
      el.querySelector('#m1').style.width = (100 * st.morale[1] / GAME.moraleCap(st.facs[1])) + '%';
      const round = `第 <b>${st.round}</b> / ${st.maxR} 回合　我军 ${Math.round(frac(me) * 100)}%　敌军 ${Math.round(frac(ai) * 100)}%${city ? '　城防 ' + Math.round(st.wall) : ''}`;
      el.querySelector('#tround').innerHTML = el.querySelector('#field-round').innerHTML = round;
      const label = `军令 · 第 ${st.round} / ${st.maxR} 回合`;
      if (drawer.textContent !== label) drawer.textContent = label;
      el.querySelector('#tlog').innerHTML = st.log.map(esc).join('　·　');
      if (!st.over && document.body.contains(cv)) requestAnimationFrame(draw);
    }
    function info(x) {
      const panel = el.querySelector('#tinfo');
      if (!x) panel.textContent = '点选我军各营：绿色为可移动范围，红圈为可攻击之敌。每营每回合可移动后攻击一次。弓弩、火器、砲车可远射。';
      else {
        const t = grid[x.r][x.c];
        panel.innerHTML = `${UNITART.img(st.facs[x.side], x.t, 56, 'tinfo-art' + (x.side === 1 ? ' flip' : ''))}<b>${unitName(st.facs[x.side], x.t)}</b>　兵 ${Math.round(x.hp * 5)}　士气 ${Math.round(st.morale[x.side])}　攻 ${U[x.t].atk} 守 ${U[x.t].def} 行 ${MV[x.t] || 2}${RNG[x.t] ? ' 射程 ' + RNG[x.t] : ''}　地形：${TNAME[t]}　${U[x.t].desc}`;
      }
      UI.layoutText(panel);
    }
    function selectUnit(x) {
      st.sel = x; reachSet = []; tgtSet = [];
      if (x && !x.done) { reachSet = x.moved ? [] : reach(x); tgtSet = targets(x, x.c, x.r); }
      info(x);
    }
    function pickHex(mx, my) {
      let best = null, bd = 1e9;
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const [x, y] = point(c, r), d = (x - mx) ** 2 + (y - my) ** 2;
        if (d < bd) { bd = d; best = [c, r]; }
      }
      return bd < (portrait ? Math.max(R, 22 / view.scale) : R) ** 2 ? best : null;
    }
    const fingers = new Map();
    const tapDelay = 350;
    let gestured = false, ignoreClick = 0, lastTap = null;
    const pos = e => { const rect = cv.getBoundingClientRect(); return [e.clientX - rect.left, e.clientY - rect.top]; };
    const separation = ([a, b]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const resetView = () => { zoom = 1; panX = panY = 0; updateView(); };
    function finishTap(apply) {
      const tap = lastTap;
      lastTap = null;
      if (!tap) return;
      clearTimeout(tap.timer);
      if (apply) tap.order?.();
    }
    cv.onpointerdown = e => {
      if (!portrait || e.button !== 0) return;
      if (!fingers.size) gestured = false;
      fingers.set(e.pointerId, pos(e));
      if (fingers.size > 1) { gestured = true; finishTap(false); }
      cv.setPointerCapture(e.pointerId);
    };
    cv.onpointermove = e => {
      if (!fingers.has(e.pointerId)) return;
      const p = pos(e), old = fingers.get(e.pointerId);
      if (fingers.size === 1) {
        if (!gestured && Math.hypot(p[0] - old[0], p[1] - old[1]) < 5) return;
        gestured = true;
        panX += p[0] - old[0]; panY += p[1] - old[1];
        fingers.set(e.pointerId, p);
      } else if (fingers.size === 2) {
        const prev = [...fingers.values()], dist = separation(prev);
        fingers.set(e.pointerId, p);
        const next = [...fingers.values()];
        const scale = clamp(zoom * separation(next) / Math.max(1, dist), 0.65, 3);
        const ratio = scale / zoom, cx = (prev[0][0] + prev[1][0]) / 2, cy = (prev[0][1] + prev[1][1]) / 2;
        panX += (cx - view.x) * (1 - ratio) + (next[0][0] + next[1][0]) / 2 - cx + H * view.fit * (scale - zoom) / 2;
        panY += (cy - view.y) * (1 - ratio) + (next[0][1] + next[1][1]) / 2 - cy + W * view.fit * (scale - zoom) / 2;
        zoom = scale;
      }
      if (gestured) finishTap(false);
      updateView();
    };
    cv.onpointerup = cv.onpointercancel = e => {
      if (!fingers.has(e.pointerId)) return;
      fingers.delete(e.pointerId);
      if (gestured || e.type === 'pointercancel') {
        finishTap(false); ignoreClick = performance.now() + 300;
      } else if (portrait && !fingers.size) tapAt(e);
    };
    cv.onclick = e => {
      if (portrait) return;
      const rc = cv.getBoundingClientRect();
      const [xPos, yPos] = pos(e);
      actAt(pickHex(xPos * W / rc.width, yPos * H / rc.height));
    };
    function tapAt(e) {
      if (st.busy || st.over) return;
      const [xPos, yPos] = pos(e);
      const now = performance.now();
      if (now < ignoreClick) return;
      if (lastTap && now - lastTap.t < tapDelay && Math.hypot(xPos - lastTap.x, yPos - lastTap.y) < 20) {
        finishTap(false); resetView(); return;
      }
      finishTap(true);
      const h = pickHex((xPos - view.x) / view.scale, (yPos - view.y) / view.scale);
      const tap = lastTap = { x: xPos, y: yPos, t: now };
      const selected = st.sel, round = st.round;
      // 选兵即时响应，移动和攻击等双击窗口结束再执行。
      if (h && selected && !selected.done && at(h[0], h[1])?.side !== me) {
        tap.order = () => { if (st.sel === selected && st.round === round) actAt(h); };
        tap.timer = setTimeout(() => finishTap(true), tapDelay);
      } else actAt(h);
    }
    function actAt(h) {
      if (!h || st.busy || st.over || !cv.isConnected) return;
      const o = at(h[0], h[1]);
      const x = st.sel;
      if (o && o.side === me) { selectUnit(o); return; }
      if (!x || x.done) { if (o) info(o); return; }
      if (o && o.side === ai) {
        if (tgtSet.includes(o)) { hit(x, o, !!RNG[x.t]); x.done = true; selectUnit(null); if (!check()) autoEndIfDone(); return; }
        // 近战：移动到敌旁并攻击
        if (!RNG[x.t] && !x.moved) {
          const spot = reachSet.filter(([c, r]) => hdist([c, r], [o.c, o.r]) === 1).sort((p, q) => (grid[q[1]][q[0]] === TER.HILL) - (grid[p[1]][p[0]] === TER.HILL))[0];
          if (spot) { x.c = spot[0]; x.r = spot[1]; hit(x, o, false); x.done = true; selectUnit(null); if (!check()) autoEndIfDone(); return; }
        }
        info(o); return;
      }
      if (reachSet.some(([c, r]) => c === h[0] && r === h[1])) {
        x.c = h[0]; x.r = h[1]; x.moved = true;
        const ts = targets(x, x.c, x.r);
        if (!ts.length) x.done = true;
        selectUnit(x.done ? null : x);
        autoEndIfDone();
      }
    }
    function autoEndIfDone() { if (alive(me).every(x => x.done)) setTimeout(endRound, 250); }
    // 敌方行动阶段（攻方总是先动：我为守方时，敌先手）
    function aiPhase(next) {
      st.busy = true; selectUnit(null);
      const list = alive(ai).sort((p, q) => (RNG[q.t] ? 1 : 0) - (RNG[p.t] ? 1 : 0));
      let i = 0;
      const step = () => {
        if (st.over) return;
        if (i >= list.length) { next(); return; }
        aiAct(list[i++]);
        if (check()) return;
        setTimeout(step, 260);
      };
      step();
    }
    function newRound() {
      st.round++;
      if (st.round > st.maxR) { end('none'); return false; }
      for (const x of units) { x.done = false; x.moved = false; }
      return true;
    }
    function playerTurn() { st.busy = false; info(null); }
    function endRound() {
      if (st.busy || st.over) return;
      if (me === 0) aiPhase(() => { if (newRound()) playerTurn(); });
      else if (newRound()) aiPhase(playerTurn);
    }
    function autoAll() {
      if (st.over) return;
      st.busy = true; selectUnit(null);
      let guard = 0;
      while (!st.over && guard++ < 400) {
        for (const x of alive(me).filter(x => !x.done)) { aiAct(x); x.done = true; if (check()) break; }
        if (st.over) break;
        if (me === 0) { for (const x of alive(ai)) { aiAct(x); if (check()) break; } if (st.over) break; }
        if (!newRound()) break;
        if (me === 1) { for (const x of alive(ai)) { aiAct(x); if (check()) break; } if (st.over) break; }
      }
    }
    el.querySelector('#tend').onclick = () => { finishTap(true); for (const x of alive(me)) x.done = true; endRound(); };
    el.querySelector('#tauto').onclick = () => { finishTap(true); autoAll(); };
    el.querySelector('#tretreat').onclick = () => { finishTap(true); if (st.over || st.busy) return; st.retreat = true; end(me === 0 ? 'def' : 'att', me); };
    if (me === 1) { if (city) el.querySelector('#tretreat').style.display = 'none'; else el.querySelector('#tretreat').textContent = '撤出战场'; }
    info(null);
    requestAnimationFrame(draw);
    if (me === 1) aiPhase(playerTurn); // 敌军先攻
  }

  // ---------- 敌军来犯：守方军议 ----------
  function defend(a, tile, done, left) {
    const B = GAME.battleSides(a, tile);
    const P = plansFor(a, tile, 'def');
    const g = GAME.gen(B.D.gen), eg = GAME.gen(a.gen);
    const c = B.c && B.c.f === B.defF ? B.c : null;
    let pick = null;
    const terr = GEO.TERRAIN[B.tt];
    const unitsHTML = (units, f) => { const m = {}; for (const u of units) m[u.t] = (m[u.t] || 0) + 1; return Object.entries(m).map(([t, n]) => `<span class="chip uchip">${UNITART.img(f, t, 22)}${unitName(f, t)}×${n}</span>`).join(' '); };
    const fmt = n => n >= 10000 ? (n / 10000).toFixed(1) + '万' : Math.round(n);
    const defName = B.defArmy ? GAME.armyName(B.defArmy) : c.name + '守军';
    const render = () => {
      const plan = pick ? P.list.find(x => x.id === pick) : null;
      const pv = GAME.previewBattle(a, tile, plan ? plan.mods : {});
      const pOk = 1 - winProb(pv.r);
      const pExp = plan ? plan.chance * pOk + (1 - plan.chance) * (1 - winProb(GAME.previewBattle(a, tile, plan.failMods).r)) : pOk;
      const side = (title, gg, f, units, extra) => `<div class="tside">${gg ? PORTRAIT.img(gg, 64) : seal(f)}<div><b style="font-size:18px">${esc(title)}</b><br>${gg ? `${gg.name}　统${gg.tong} 武${gg.wu} 智${gg.zhi}` : '无主将'}${gg && GAME.skillList(gg).length ? '<br><span class="skill">' + GAME.skillList(gg).map(k => '【' + k + '】').join('') + '</span>' : ''}<br>${unitsHTML(units, f)}<br><span class="note">${extra}</span></div></div>`;
      const h = `<div class="tac-body"><h1 style="color:#8e2a20">敌军来犯</h1>
        <div class="story" style="text-align:center">${seal(a.f)} ${esc(GAME.fac(a.f).name)}${esc(GAME.armyName(a))}进逼${c ? '【' + esc(c.name) + '】' : '我军营垒'}，${g ? esc(g.name) + '请示方略' : '守军待命'}。</div>
        <div class="tvs">${side(defName, g, B.defF, B.D.units, `兵 ${fmt(GAME.sumStr(B.D.units))}　士气 ${Math.round(B.D.morale)}${c ? '　城防 ' + Math.round(c.wall) : ''}`)}
        <div class="vsx">守</div>
        ${side(GAME.armyName(a), eg, a.f, a.units, `兵 ${fmt(GAME.sumStr(a.units))}　士气 ${Math.round(a.morale)}`)}</div>
        <div class="note" style="text-align:center">战场 · ${terr.name}${GEO.river[tile] ? ' · 临河' : ''}${c ? '　守城战' : ''}${B.water ? '　水战' : ''}${commandNotes(B.D)}${commandNotes(B.A)}</div>
        ${B.fortMult > 1 ? '<div class="note" style="text-align:center">我军 · 筑垒 +10%</div>' : ''}
        <div class="odds"><span>守住</span><div class="obar"><i style="width:${Math.round(pExp * 100)}%"></i></div><b>${Math.round(pExp * 100)}%</b></div>
        ${terrainRowsHTML(GAME.battleTerrainRows(B, plan?.mods))}
        ${lineupCounters(B.D, B.A)}
        <div class="note" style="text-align:center">预计我军折损约 ${Math.round(Math.min(0.95, pv.lossD) * 100)}%，敌军折损约 ${Math.round(pv.lossA * 100)}%${plan ? `（计成时；计策成功率 ${Math.round(plan.chance * 100)}%）` : ''}</div>
        <div class="sec">守策 <span class="r note">${!g ? '守军无主将，计策难成' : eg ? `我将智 ${g.zhi} 对敌将智 ${eg.zhi}` : '敌无主将，计策易成'}</span></div>
        ${planGrid(P.list, pick)}</div>
        <div class="choices tac-actions">
          ${!B.water ? `<button class="choice" data-go="manual">${plan ? '施' + plan.name + '，' : ''}亲自${c ? '守城' : '迎战'}<small>于六角战场上调度各营，敌军先攻</small></button>` : ''}
          <button class="choice" data-go="auto">${plan ? '施' + plan.name + '，' : ''}交由守将<small>自动结算，即刻分晓</small></button>
          ${left > 0 ? `<button class="choice" data-go="all">本回合其余 ${left + 1} 战皆交守将<small>不再逐一过问</small></button>` : ''}
        </div>`;
      const el = overlay(h);
      el.onclick = e => {
        if (e.target.closest('[data-more]')) { showAllPlans = !showAllPlans; render(); return; }
        const pb = e.target.closest('[data-p]');
        if (pb && !pb.disabled) { pick = pick === pb.dataset.p ? null : pb.dataset.p; render(); return; }
        const go = e.target.closest('[data-go]'); if (!go) return;
        const k = go.dataset.go;
        if (k === 'all') { close(); done({ mods: {}, skipAll: true }); return; }
        let mods = {}, planText = '';
        if (plan) {
          const ok = Math.random() < plan.chance;
          mods = ok ? plan.mods : plan.failMods;
          planText = `守方${plan.name}${ok ? '成功：' + plan.desc.split('：').pop() : '失败：' + plan.fail.split('：').pop()}`;
          if (window.UI && UI.toast) UI.toast(`${plan.name}${ok ? '得手！' : '未成……'}`, ok ? 'big' : 'war');
        }
        close();
        if (k === 'auto') done({ mods, plan: planText });
        else field(a, tile, Object.assign({}, mods, { dMult: (mods.dMult || 1) * B.fortMult }), planText, done, 1);
      };
    };
    render();
  }
  function overlayEnd(text, winner, cb) {
    if (winner !== 'draw') AUDIO.play(winner === 'win' ? 'win' : 'lose');
    const box = document.createElement('div');
    box.className = 'tresult ' + (winner === 'win' ? 'win' : 'lose');
    box.innerHTML = `<div class="stamp">${winner === 'win' ? '捷' : winner === 'lose' ? '败' : '和'}</div><div>${esc(text)}</div><button class="btn red">收兵回营</button>`;
    UI.layoutText(box);
    document.getElementById('tac').appendChild(box);
    box.querySelector('button').onclick = cb;
  }
  return { prebattle, defend, field, plansFor, close, terrainRowsHTML };
})();
