// 电脑势力：内政、征兵、行军、外交
var AI = (function () {
  const U = DATA.UNITS;
  const S = () => GAME.S;
  const rand = Math.random;

  function turn(f) {
    const F = GAME.fac(f);
    if (!F.alive) return;
    const cities = GAME.citiesOf(f);
    if (f === 'rebel' && !cities.length) { rebelArmies(); return; }
    research(f);
    const enemies = enemiesOf(f);
    economy(f, cities, enemies);
    if (f !== 'rebel') diplomacy(f, cities, enemies);
    military(f, cities, enemies);
  }

  function enemiesOf(f) {
    const out = [];
    for (const x in S().factions) if (x !== f && GAME.fac(x).alive && GAME.atWar(f, x)) out.push(x);
    return out;
  }

  function research(f) {
    const F = GAME.fac(f);
    if (F.research) return;
    const av = GAME.availableTechs(f);
    if (!av.length) return;
    av.sort((a, b) => DATA.TECHS[a].cost - DATA.TECHS[b].cost + (rand() - 0.5) * 120);
    F.research = av[0];
  }

  function chooseUnit(c, atWarNow) {
    const F = GAME.fac(c.f);
    const opts = GAME.unitOptions(c).filter(u => GAME.canAffordUnit(c, u));
    if (!opts.length) return null;
    const nomad = DATA.NOMAD[F.culture];
    const w = {};
    for (const o of opts) {
      let v = 1;
      if (o === 'inf') v = nomad ? 1.5 : 3.5;
      if (o === 'bow') v = 2.5;
      if (o === 'cav') v = nomad ? 3 : 1.5;
      if (o === 'hbow') v = 4;
      if (o === 'hcav') v = 2.5;
      if (o === 'fire') v = 3;
      if (o === 'siege') v = atWarNow ? 0.8 : 0.1;
      if (o === 'navy') v = ['japan', 'england', 'venice', 'sicily', 'denmark', 'norway', 'goryeo', 'byz'].includes(c.f) ? 0.6 : 0.05;
      if (o === 'elite') v = 1.5;
      w[o] = v;
    }
    let tot = 0; for (const k in w) tot += w[k];
    let x = rand() * tot;
    for (const k in w) { x -= w[k]; if (x <= 0) return k; }
    return opts[0];
  }

  let borderCache = { key: '', set: null };
  function isBorder(c, enemies) {
    const key = c.f + '|' + GAME.S.turn + '|' + enemies.length;
    if (borderCache.key !== key) {
      const es = new Set(enemies); es.add('rebel');
      const foes = S().cities.filter(o => o.f !== c.f && es.has(o.f));
      const set = new Set();
      for (const m of GAME.citiesOf(c.f)) for (const o of foes) if (GEO.dist(o.tile, m.tile) <= 7) { set.add(m.id); break; }
      borderCache = { key, set };
    }
    return borderCache.set.has(c.id);
  }

  // 富余程度 0–1：库存超出储备（约八季军费，至少 400）的部分，相对储备的倍数
  function richness(F) {
    const inc = F.income || {};
    const reserve = Math.max(400, (inc.upkeep || 0) * 8);
    return Math.max(0, Math.min(1, (F.gold - reserve) / (reserve * 3)));
  }

  function economy(f, cities, enemies) {
    const F = GAME.fac(f);
    const rk = richness(F);
    const atWarNow = enemies.filter(e => e !== 'rebel').length > 0;
    const armies = S().armies.filter(a => a.f === f);
    const units = armies.reduce((s, a) => s + a.units.length, 0) + cities.reduce((s, c) => s + c.garrison.length, 0);
    const targetUnits = Math.round((cities.length * (atWarNow ? 3.2 : 2) + 2 + (F.mongolBoost ? 10 : 0)) * (1 + 0.5 * rk));
    const inc = F.income || {};
    // 量入为出：粮钱入不敷出时不再扩军
    const broke = (F.food < 150 && (inc.food || 0) - (inc.foodUp || 0) < 0) || (F.gold < 100 && (inc.gold || 0) + (inc.trib || 0) - (inc.upkeep || 0) < 0);
    if (broke && F.food < 0) {
      // 粮尽：裁撤超额守军
      for (const c of cities) while (c.garrison.length > Math.max(1, GAME.garrisonCap(c) - 2)) c.garrison.pop();
    }
    for (const c of cities) {
      if (c.queue.length) continue;
      const full = c.garrison.length >= GAME.garrisonCap(c);
      const border = isBorder(c, enemies);
      const wantG = 1 + (border ? 2 : 0) + (c.cap ? 1 : 0);
      let did = false;
      if (!full && (c.garrison.length < wantG || (!broke && units < targetUnits && rand() < 0.6)) && F.gold > 40) {
        const u = chooseUnit(c, atWarNow);
        if (u && GAME.queueUnit(c.id, u)) did = true;
      }
      // 富余而守军已满：淘汰残兵与步卒，换练精兵
      if (!did && full && rk > 0.2 && !broke && rand() < 0.5 * rk) {
        const better = chooseUnit(c, atWarNow);
        if (better && better !== 'inf' && better !== 'siege' && better !== 'navy') {
          let wi = -1, ws = 1e9;
          for (let i = 0; i < c.garrison.length; i++) { const u = c.garrison[i]; const sc = U[u.t].atk + U[u.t].def + u.s / 20; if ((u.t === 'inf' || u.s < 60) && sc < ws) { ws = sc; wi = i; } }
          if (wi >= 0 && U[better].atk + U[better].def > U[c.garrison[wi].t].atk + U[c.garrison[wi].t].def) { c.garrison.splice(wi, 1); if (GAME.queueUnit(c.id, better)) did = true; }
        }
      }
      if (!did) {
        const opts = GAME.buildOptions(c);
        const pri = [border && 'walls', 'farm', 'market', 'temple', 'granary', 'academy', 'barracks', 'smithy', 'shibosi', DATA.NOMAD[F.culture] && 'stable', 'walls', 'workshop', c.port && rand() < 0.3 && 'dock'].filter(Boolean);
        let b = pri.find(p => opts.includes(p));
        // 清单以外的新建筑：按效果粗估价值，择优而建
        if (!b && opts.length) {
          const val = id => { const e = GAME.bldEff(id), B = DATA.BUILDINGS[id];
            let v = (e.food || 0) * 1.3 + (e.prod || 0) + (e.gold || 0) + (e.sci || 0) * 0.8 + (e.happy || 0) * 0.5 + (e.wall || 0) * (border ? 0.15 : 0.04)
              + (e.goldPct || 0) * 20 + (e.foodPct || 0) * 25 + (e.prodPct || 0) * 20 + (e.sciPct || 0) * 10 + (e.horse || 0) * 2 + (e.iron || 0) * 2 + (e.tradeSlot || 0) * 6 + (e.recruitCost || 0) * 10;
            return v / Math.max(30, B.prod || 50); };
          const LEG = ['walls', 'farm', 'market', 'temple', 'granary', 'academy', 'barracks', 'smithy', 'shibosi', 'stable', 'workshop', 'dock'];
          const best = opts.filter(id => !LEG.includes(id)).map(id => [id, val(id)]).sort((x, y) => y[1] - x[1])[0];
          if (best && best[1] > 0.04) b = best[0];
        }
        if (b) GAME.queueBuilding(c.id, b);
        else if (F.gold > 60 && !full && !broke) { const u = chooseUnit(c, atWarNow); if (u) GAME.queueUnit(c.id, u); }
      }
    }
    // 加急
    if (F.gold > 350) {
      const cs = cities.filter(c => c.queue.length).sort((a, b) => (isBorder(b, enemies) ? 1 : 0) - (isBorder(a, enemies) ? 1 : 0));
      for (const c of cs.slice(0, 2 + Math.round(6 * rk))) if (F.gold - GAME.hurryCost(c) > 200) GAME.hurry(c.id);
    }
    // 海贸
    if (S().newSeason) for (const c of cities) {
      while (c.trade.length < GAME.tradeSlots(c)) {
        const t = GAME.routeTargets(c)[0];
        if (!t || !GAME.openRoute(c.id, t.id)) break;
      }
    }
    // 知州
    const idle = S().generals.filter(g => g.f === f && g.status === 'idle');
    const civil = idle.filter(g => g.zheng >= g.tong).sort((a, b) => b.zheng - a.zheng);
    for (const g of civil) {
      const c = cities.filter(c => c.governor == null).sort((a, b) => b.pop - a.pop)[0];
      if (!c) break;
      GAME.assignGovernor(g.id, c.id);
    }
  }

  // ---------- 外交 ----------
  function neighbors(f) {
    const S0 = S();
    S0._nb = S0._nb || {};
    const cache = S0._nb[f];
    if (cache && S0.T - cache.t < 8) return cache.list;
    const mine = GAME.citiesOf(f);
    const set = new Set();
    for (const o of S0.cities) {
      if (o.f === f || o.f === 'rebel') continue;
      for (const m of mine) if (GEO.dist(o.tile, m.tile) <= 10) { set.add(o.f); break; }
    }
    const list = [...set];
    S0._nb[f] = { t: S0.T, list };
    return list;
  }

  function diplomacy(f, cities, enemies) {
    const F = GAME.fac(f), P = S().player;
    // 与电脑议和
    for (const e of enemies) {
      if (e === P || e === 'rebel') continue;
      if (rand() < 0.2 * GAME.E() && GAME.aiWantsPeace(f, e) > 15 && GAME.aiWantsPeace(e, f) > -5) GAME.makePeace(f, e);
    }
    // 宣战
    const realWars = enemies.filter(e => e !== 'rebel').length;
    if (realWars >= 2 || S().T - F.lastWar < 10) return;
    if (rand() > F.aggr * 0.06 * GAME.E()) return;
    const myP = GAME.totalPower(f);
    const cands = neighbors(f).filter(o => {
      const OF = GAME.fac(o);
      if (!OF.alive) return false;
      const r = GAME.getRel(f, o);
      if (r.war || r.ally || r.truce > 0 || r.op > 25) return false;
      if (o === P && S().T < 6) return false;
      const ratio = myP / (GAME.totalPower(o) + 1);
      return ratio > (F.aggr > 0.7 ? 1.0 : 1.35);
    });
    if (!cands.length) return;
    cands.sort((a, b) => GAME.totalPower(a) - GAME.totalPower(b));
    GAME.declareWar(f, cands[0]);
  }

  // ---------- 军事 ----------
  function armyPower(a) { return a.units.reduce((s, u) => s + (U[u.t].atk + U[u.t].def) / 2 * u.s / 100, 0) * (a.gen != null ? 1.1 : 0.9); }
  function cityDefense(c) {
    let p = c.garrison.reduce((s, u) => s + U[u.t].def * u.s / 100, 0) * 1.2 + c.wall * 0.6 + 4;
    const a = GAME.armyAt(c.tile); if (a && a.f === c.f) p += armyPower(a) * 1.2;
    return p;
  }

  function military(f, cities, enemies) {
    const F = GAME.fac(f);
    const atWarNow = enemies.length > 0;
    let armies = S().armies.filter(a => a.f === f);
    const maxArmies = Math.max(1, Math.round(cities.length / 3) + (atWarNow ? 1 : 0) + (F.mongolBoost ? 3 : 0) + Math.round(2 * richness(F)));
    // 组建
    if (armies.length < maxArmies) {
      const cs = cities.slice().sort((a, b) => b.garrison.length - a.garrison.length);
      for (const c of cs) {
        if (armies.length >= maxArmies) break;
        const keep = isBorder(c, enemies) ? 2 : 1;
        if (c.garrison.length < keep + 3 || GAME.armyAt(c.tile)) continue;
        if (!atWarNow && rand() > 0.15) continue;
        const idle = S().generals.filter(g => g.f === f && g.status === 'idle').sort((a, b) => b.tong - a.tong);
        const g = idle[0] ? idle[0].id : null;
        const cap = GAME.capFor(g);
        const take = Math.min(cap, c.garrison.length - keep);
        const idx = c.garrison.map((u, i) => i).sort((i, j) => (U[c.garrison[j].t].atk) - (U[c.garrison[i].t].atk)).slice(0, take);
        const a = GAME.formArmy(c.id, g, idx);
        if (a) armies.push(a);
      }
    }
    // 补将
    for (const a of armies) if (a.gen == null) {
      const g = S().generals.filter(g => g.f === f && g.status === 'idle').sort((x, y) => y.tong - x.tong)[0];
      if (g && g.tong > g.zheng - 10) GAME.setArmyGeneral(a.id, g.id);
    }
    const es = new Set(enemies);
    const ctx = { es, eCities: S().cities.filter(c => es.has(c.f)), eArmies: S().armies.filter(o => es.has(o.f)), defs: new Map(), frontier: undefined };
    for (const a of armies) {
      if (!S().armies.includes(a)) continue;
      try { armyAct(a, cities, enemies, ctx); } catch (e) { console.error('AI army', e); }
    }
  }

  function nearestOwnCity(a, cities) {
    let best = null, bd = 1e9;
    for (const c of cities) { const d = GEO.dist(c.tile, a.tile); if (d < bd) { bd = d; best = c; } }
    return best;
  }

  function armyAct(a, cities, enemies, ctx) {
    const f = a.f;
    const avg = a.units.reduce((s, u) => s + u.s, 0) / Math.max(1, a.units.length);
    const here = GAME.cityAt(a.tile);
    // 城中补员
    if (here && here.f === f) {
      const keep = isBorder(here, enemies) ? 2 : 1;
      while (a.units.length < GAME.armyCap(a) && here.garrison.length > keep) {
        let bi = 0; for (let i = 1; i < here.garrison.length; i++) if (U[here.garrison[i].t].atk > U[here.garrison[bi].t].atk) bi = i;
        GAME.transferToArmy(a.id, bi);
      }
    }
    const myP = armyPower(a);
    let goal = null;
    if (avg < 45 || a.morale < 30) {
      const c = nearestOwnCity(a, cities);
      if (c && c.tile !== a.tile) goal = c.tile;
      else return;
    } else if (enemies.length) {
      // 威胁：敌军靠近我方城市
      let threat = null, td = 1e9;
      for (const o of ctx.eArmies) {
        if (!S().armies.includes(o)) continue;
        const d = GEO.dist(o.tile, a.tile);
        if (d > 9) continue;
        const nearMine = cities.some(c => GEO.dist(c.tile, o.tile) <= 3);
        const op = armyPower(o);
        if (op < myP * 1.15 && (nearMine || d <= 4) && d < td) { td = d; threat = o; }
      }
      // 进攻目标城市
      let tgt = null, best = 1e9;
      for (const c of ctx.eCities) {
        if (!ctx.es.has(c.f)) continue;
        const d = GEO.dist(c.tile, a.tile);
        if (d > 22) continue;
        if (a.badTargets && a.badTargets[c.id] > S().T) continue;
        let def = ctx.defs.get(c.id); if (def === undefined) { def = cityDefense(c); ctx.defs.set(c.id, def); }
        if (myP < def * 0.9 && !(def < 30 && a.units.some(u => u.t === 'siege'))) continue;
        const score = d + def / 15 - (c.cap ? 3 : 0);
        if (score < best) { best = score; tgt = c; }
      }
      if (threat && (!tgt || td < GEO.dist(tgt.tile, a.tile))) goal = threat.tile;
      else if (tgt) goal = tgt.tile;
      else {
        // 集结于前线城市
        if (ctx.frontier === undefined) {
          let fr0 = null, fd = 1e9;
          for (const c of cities) {
            let ed = 1e9;
            for (const o of ctx.eCities) { const d = GEO.dist(o.tile, c.tile); if (d < ed) ed = d; }
            if (ed < fd) { fd = ed; fr0 = c; }
          }
          ctx.frontier = fr0;
        }
        const fr = ctx.frontier;
        if (fr && fr.tile !== a.tile && !GAME.armyAt(fr.tile)) goal = fr.tile;
      }
    } else {
      let site = null, sd = 6;
      if (a.gen != null && GAME.S.sites) for (const st of GAME.S.sites) { const d = GEO.dist(st.tile, a.tile); if (d < sd && GAME.siteUsable(st, a) && !GAME.armyAt(st.tile)) { const o = GAME.tileOwner(st.tile); if (!o || o === f || GAME.allied(f, o)) { sd = d; site = st; } } }
      if (site) { goal = site.tile; }
      const c = site || (here && here.f === f) ? null : nearestOwnCity(a, cities);
      if (c && !GAME.armyAt(c.tile)) goal = c.tile;
      // 和平时期：多余军团解散
      if (here && here.f === f && S().armies.filter(x => x.f === f).length > Math.max(2, cities.length / 3) && rand() < 0.05 * GAME.E()) { GAME.disband(a.id); return; }
    }
    if (goal == null) return;
    if (a.aiGoal !== goal || !a.path || !a.path.length) {
      const p = GAME.findPath(a, goal, 2500);
      if (!p) {
        a.badTargets = a.badTargets || {};
        const c = GAME.cityAt(goal); if (c) a.badTargets[c.id] = S().T + 2;
        a.aiGoal = null; a.path = [];
        return;
      }
      a.path = p; a.aiGoal = goal;
    }
    GAME.advance(a);
  }

  function rebelArmies() {
    const P = S().player;
    for (const a of S().armies.filter(x => x.f === 'rebel')) {
      let tgt = null, bd = 1e9;
      for (const c of S().cities) { if (c.f === 'rebel') continue; const d = GEO.dist(c.tile, a.tile); if (d < bd && d < 10) { bd = d; tgt = c; } }
      if (!tgt) continue;
      if (!a.path || !a.path.length || a.aiGoal !== tgt.tile) { a.path = GAME.findPath(a, tgt.tile, 1500) || []; a.aiGoal = tgt.tile; }
      GAME.advance(a);
      // 乱军渐散
      if (rand() < 0.04 * GAME.E()) for (const u of a.units) u.s -= 15;
    }
  }

  return { turn, armyPower, cityDefense };
})();
if (typeof module !== 'undefined') module.exports = AI;
