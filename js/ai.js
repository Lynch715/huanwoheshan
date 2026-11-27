// 电脑势力：内政、征兵、行军、外交
var AI = (function () {
  const U = DATA.UNITS;
  const S = () => GAME.S;
  const rand = Math.random;

  // 电脑之间的兵事节奏（单位：季）
  const AI_WAR_RATE = 0.14;    // 每季按好战度起衅的概率系数（原 0.06，对我朝仍为 0.06）
  const AI_WAR_COOLDOWN = 6;   // 上次宣战后至少隔一年半再起新衅（对我朝仍为 10）
  const AI_WAR_MIN = 4;        // 电脑之间开战至少一年后才议和
  const AI_ASSAULT = 0.8;      // 攻电脑城池时，军力达到城防的倍数即敢攻（原 0.9）

  function turn(f) {
    const F = GAME.fac(f);
    if (!F.alive) return;
    if (f === S().player) governSong(F);
    const cities = GAME.citiesOf(f);
    if (f === 'rebel' && !cities.length) { rebelArmies(); return; }
    research(f);
    const enemies = enemiesOf(f);
    maintainUnits(F);
    if (f === S().player) dismissForDebt(F, cities, enemies);
    economy(f, cities, enemies);
    const declared = f !== 'rebel' && diplomacy(f, enemies);
    military(f, cities, declared ? enemiesOf(f) : enemies);
  }

  function maintainUnits(F) {
    const s = S(), acted = s._unitMaintenance ||= {};
    if (acted[F.id] === s.turn) return;
    const reserve = Math.max(100, 2 * (F.income.upkeep || 0));
    let refill = null, regroup = null;
    for (const a of s.armies) {
      if (a.f !== F.id || a.frontier != null || a.battleTurn === s.turn) continue;
      const groups = {};
      a.units.forEach((u, i) => {
        if (u.s >= 100) return;
        const group = groups[u.t] ||= { indices: [], strength: 0 };
        group.indices.push(i);
        group.strength += u.s;
      });
      for (const { indices, strength } of Object.values(groups)) {
        if (indices.length < 2) continue;
        if (strength > (indices.length - 1) * 100 + 1e-9) {
          regroup ??= { a, indices };
          continue;
        }
        if (GAME.consolidateUnits(a, indices, true).ok) {
          acted[F.id] = s.turn;
          return;
        }
      }
      if (refill || F.gold <= reserve || GAME.cityAt(a.tile)?.f !== F.id) continue;
      for (let i = 0; i < a.units.length; i++) {
        if (a.units[i].s >= 75) continue;
        const info = GAME.reinforcementInfo(a, [i], true);
        if (info.ok && F.gold - info.cost.gold >= reserve) { refill = { a, i }; break; }
      }
    }
    if (regroup && GAME.consolidateUnits(regroup.a, regroup.indices, true).ok) acted[F.id] = s.turn;
    else if (refill && GAME.reinforceUnits(refill.a, [refill.i], true).ok) acted[F.id] = s.turn;
  }

  function dismissForDebt(F, cities, enemies) {
    const s = S(), season = s.year * 4 + s.season;
    const debt = (s._dismissalDebt ||= { since: null, season, dismissed: 0 });
    if (debt.season !== season) { debt.season = season; debt.dismissed = 0; }
    if (F.gold >= 0) { debt.since = null; return; }
    debt.since ??= s.T;
    if (debt.dismissed >= 4 || !GAME.coalitionDue(debt.since + 2)) return;
    const capital = GAME.city(F.capital);
    if (s.flags.league?.stage === 'war' || cities.length <= 3 || capital?.f !== F.id || GAME.enemyAdjacent(capital.tile, F.id)) return;

    function dismiss(owner, indices) {
      const result = GAME.dismissUnits(owner, indices.slice(0, 4 - debt.dismissed));
      if (result.ok) debt.dismissed += result.indices.length;
    }
    const over = c => c.garrison.length - GAME.garrisonCap(c);
    for (const c of cities.filter(c => over(c) > 0).sort((a, b) => over(b) - over(a))) {
      if (debt.dismissed >= 4) return;
      const cap = GAME.garrisonCap(c);
      dismiss(c, c.garrison.slice(cap).map((u, i) => cap + i));
    }
    if (debt.dismissed >= 4) return;

    const front = [...s.cities, ...s.armies].filter(o => enemies.includes(o.f)).map(o => o.tile);
    const armies = s.armies.filter(a => a.f === F.id && !GAME.dismissalReason(a)).map(a => ({
      a, distance: front.reduce((nearest, tile) => Math.min(nearest, GEO.dist(a.tile, tile)), Infinity), power: armyPower(a),
    }));
    armies.sort((a, b) => b.distance - a.distance || a.power - b.power);
    for (const { a } of armies) {
      if (debt.dismissed >= 4) break;
      const indices = a.units.map((u, i) => i).sort((i, j) => unitPower(a.units[i]) - unitPower(a.units[j]));
      dismiss(a, indices);
    }
  }

  function governSong(F) {
    const s = S(), flags = s.flags, season = s.year * 4 + s.season;
    const expenses = (F.income.upkeep || 0) + Math.max(0, -(F.income.trib || 0));
    if (flags.autoRankSeason !== season && F.gold >= expenses * 3) {
      let officer = null;
      for (const g of s.generals) {
        if (g.f !== s.player || !g.wins || (officer && officer.wins >= g.wins)) continue;
        const terms = COURT.rankTerms(g);
        if (terms && !terms.reason) officer = g;
      }
      if (officer && COURT.grantRank(officer).ok) flags.autoRankSeason = season;
    }
    if (flags.autoVassalT != null && !GAME.coalitionDue(flags.autoVassalT + 8)) return;
    const power = GAME.totalPower(s.player);
    let choice = null, opinion = DATA.VASSAL.opinion - 1;
    for (const f of GAME.playerBorders()) {
      const op = GAME.getRel(s.player, f).op;
      if (op > opinion && op >= DATA.VASSAL.opinion && GAME.vassalTerms(f, power)?.ok) {
        choice = f;
        opinion = op;
      }
    }
    if (choice && GAME.investVassal(choice).ok) flags.autoVassalT = s.T;
  }

  function marriageAnswer(p) {
    const { player, flags } = S();
    if (GAME.totalPower(player) > GAME.totalPower(p.from)) return 1;
    const terms = GAME.marriageRequestTerms(p.from);
    if (terms.war) {
      return terms.enabled && flags.lastCityLoss != null && !GAME.coalitionDue(flags.lastCityLoss + 2) ? 0 : 1;
    }
    const tribute = p.amt ?? GAME.marriageTribute(p.from);
    return GAME.fac(player).gold >= tribute * DATA.MARRIAGE.tributeSeasons ? 2 : 1;
  }

  function eventAnswer(p) {
    if (p.ev === 'marriageRequest') return marriageAnswer(p);
    if (p.ev === 'cityPromotion') {
      const c = GAME.city(p.city);
      return c.role ? 0 : Object.keys(DATA.CITY_ROLES).indexOf(preferredRole(c, isBorder(c, enemiesOf(c.f))));
    }
    if (p.ev === 'vassalAnnex') {
      const owned = S().cities.filter(c => c.f).length;
      const extraShare = GAME.citiesOf(p.from).length * (1 - DATA.VASSAL.share) / owned;
      return GAME.playerThreat().score + extraShare >= GAME.difficultyRules().coalition.threat ? 1 : 0;
    }
    return 0;
  }

  function enemiesOf(f) {
    const out = [];
    for (const x in S().factions) if (x !== f && GAME.fac(x).alive && GAME.atWar(f, x)) out.push(x);
    return out;
  }

  function prisonersTurn() {
    for (const g of S().generals) {
      if (g.status !== 'captive' || g.capBy === S().player || !GAME.fac(g.capBy)?.alive) continue;
      if (g.f === S().player) {
        if (typeof COURT !== 'undefined') COURT.ensure(g);
        if (!(g.hist && g.loyal) && rand() < 0.05) GAME.defectCaptive(g);
      } else GAME.recruitCaptive(g.id, g.capBy);
    }
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
      const base = DATA.unitBase(o);
      let v = 1;
      if (base === 'inf') v = nomad ? 1.5 : 3.5;
      if (base === 'bow') v = 2.5;
      if (base === 'cav') v = nomad ? 3 : 1.5;
      if (base === 'hbow') v = 4;
      if (base === 'hcav') v = 2.5;
      if (base === 'fire') v = 3;
      if (base === 'siege') v = atWarNow ? 0.8 : 0.1;
      if (base === 'navy') v = ['japan', 'england', 'venice', 'sicily', 'denmark', 'norway', 'goryeo', 'byz'].includes(c.f) ? 0.6 : 0.05;
      if (base === 'elite') v = 1.5;
      w[o] = U[o].home ? v * 0.5 : v;
    }
    let tot = 0; for (const k in w) tot += w[k];
    let x = rand() * tot;
    for (const k in w) { x -= w[k]; if (x <= 0) return k; }
    return opts[0];
  }

  let borderCache = { state: null, key: '', set: null };
  function isBorder(c, enemies) {
    const key = c.f + '|' + GAME.S.turn + '|' + enemies.length;
    if (borderCache.state !== S() || borderCache.key !== key) {
      const es = new Set(enemies); es.add('rebel');
      const foes = S().cities.filter(o => o.f !== c.f && es.has(o.f));
      const set = new Set();
      for (const m of GAME.citiesOf(c.f)) for (const o of foes) if (GEO.dist(o.tile, m.tile) <= 7) { set.add(m.id); break; }
      borderCache = { state: S(), key, set };
    }
    return borderCache.set.has(c.id);
  }

  // 富余程度 0–1：库存超出储备（约八季军费，至少 400）的部分，相对储备的倍数
  function richness(F) {
    const inc = F.income || {};
    const reserve = Math.max(400, (inc.upkeep || 0) * 8);
    return Math.max(0, Math.min(1, (F.gold - reserve) / (reserve * 3)));
  }

  function preferredRole(c, border) {
    if (c.port && c.buildings.shibosi) return 'commerce';
    if (border) return 'military';
    const capital = GAME.city(GAME.fac(c.f).capital);
    if (capital && GEO.dist(c.tile, capital.tile) <= 4) return 'learning';
    const y = GAME.cityYield(c);
    return [['grain', y.food], ['industry', y.prod], ['commerce', y.gold], ['learning', y.sci]]
      .reduce((best, entry) => entry[1] > best[1] ? entry : best)[0];
  }

  function governCities(f, cities) {
    const vacancies = cities.filter(c => c.governor == null);
    if (!vacancies.length) return;
    const civil = S().generals.filter(g => g.f === f && g.status === 'idle' && g.zheng >= g.tong)
      .sort((a, b) => b.zheng - a.zheng);
    if (!civil.length) return;
    vacancies.sort((a, b) => b.pop - a.pop);
    for (let i = 0; i < Math.min(vacancies.length, civil.length); i++) GAME.assignGovernor(civil[i].id, vacancies[i].id);
  }

  function economy(f, cities, enemies) {
    const F = GAME.fac(f);
    const rk = richness(F);
    const atWarNow = enemies.filter(e => e !== 'rebel').length > 0;
    const armies = S().armies.filter(a => a.f === f && a.frontier == null);
    const units = armies.reduce((s, a) => s + a.units.length, 0) + cities.reduce((s, c) => s + c.garrison.length, 0);
    const targetUnits = Math.round((cities.length * (atWarNow ? 3.2 : 2) + 2 + (F.mongolBoost ? 10 : 0)) * (1 + 0.5 * rk));
    const inc = F.income || {};
    // 量入为出：粮钱入不敷出时不再扩军
    const broke = (F.food < 150 && (inc.food || 0) - (inc.foodUp || 0) < 0) || (F.gold < 100 && (inc.gold || 0) + (inc.trib || 0) - (inc.upkeep || 0) < 0);
    if (f !== S().player && broke && F.food < 0) {
      // 粮尽：裁撤超额守军
      for (const c of cities) while (c.garrison.length > Math.max(1, GAME.garrisonCap(c) - 2)) c.garrison.pop();
    }
    governCities(f, cities);
    for (const c of cities) {
      if (c.tier > 0 && !c.role) GAME.setCityRole(c.id, preferredRole(c, isBorder(c, enemies)));
      if (c.queue.length) continue;
      const ready = GAME.canUpgradeCity(c);
      if (ready && c.pop >= GAME.cityTier(c).pop - 2 && GAME.queueTier(c.id)) continue;
      const border = isBorder(c, enemies);
      const full = c.garrison.length >= GAME.garrisonCap(c);
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
      if (!did && ready) did = GAME.queueTier(c.id);
      if (!did) {
        const opts = GAME.buildOptions(c);
        const needWalls = c.tier === 1 && GAME.buildingCount(c) >= GAME.cityTier(c).buildings - 2;
        const pri = [(border || needWalls) && 'walls', 'farm', 'market', 'temple', 'granary', 'academy', 'barracks', 'smithy', 'shibosi', DATA.NOMAD[F.culture] && 'stable', 'walls', 'workshop', c.port && rand() < 0.3 && 'dock'].filter(Boolean);
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
    // 每季拨一次加急工费；周制不能在同一季反复支用整季额度。
    if (F.gold > 350 && (S().turn === 0 || S().newSeason)) {
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

  function focusesOnSong(f) {
    const { player, difficulty } = S();
    return f !== player && f !== 'rebel' && GAME.atWar(f, player) &&
      (difficulty >= 2 || GAME.leagueMember(f));
  }
  function diplomacy(f, enemies) {
    const F = GAME.fac(f), P = S().player;
    const rules = GAME.difficultyRules().coalition;
    let changed = false;
    const focusSong = focusesOnSong(f);
    // 与电脑议和
    for (const e of enemies) {
      if (e === P || e === 'rebel') continue;
      const commonFoe = f !== P && enemies.includes(P) && GAME.atWar(e, P);
      // 电脑之间开战未满一年不议和（同仇抗宋者除外），免得刚交兵就罢手
      // 开局即有的战事没有 since，按开局（T=0）计
      const since = GAME.getRel(f, e).since ?? 0;
      if (f !== P && !focusSong && !commonFoe && S().T + 1e-9 < since + AI_WAR_MIN) continue;
      if (rand() < (commonFoe ? rules.peaceRate : 0.2) * GAME.E() &&
          GAME.aiWantsPeace(f, e) > (commonFoe ? -5 : 15) && GAME.aiWantsPeace(e, f) > (commonFoe ? -20 : -5)) {
        GAME.makePeace(f, e);
        changed = true;
      }
    }
    const realWars = enemies.filter(e => e !== 'rebel' && GAME.atWar(f, e)).length;
    const threat = f !== P ? GAME.playerThreat() : null;
    // 常规拓边。对我朝的宣战沿用原先的频率与门槛（难度已按此标定）；
    // 电脑之间更常兴兵，也敢打势均力敌或腹背受敌的邻国。玩家势力（含托管）一律沿用原规则。
    if (realWars >= 2 || focusSong) return changed;
    const lively = f !== P;
    const expansionReady = S().T - F.lastWar >= (lively ? AI_WAR_COOLDOWN : 10);
    const songReady = lively && S().T - (F.lastMainWar ?? -99) >= 10;
    if (!expansionReady && !songReady) return changed;
    const roll = rand();
    // 对我朝：仍是原先的概率与十季冷却，但冷却只看涉及我朝的宣战
    const songOk = songReady && roll <= F.aggr * 0.06 * GAME.E();
    const expansionOk = expansionReady && roll <= F.aggr * (lively ? AI_WAR_RATE : 0.06) * GAME.E();
    if (!songOk && !expansionOk) return changed;
    const myP = GAME.totalPower(f);
    const cands = neighbors(f).filter(o => {
      if (o === P ? !songOk : !expansionOk) return false;
      const OF = GAME.fac(o);
      if (!OF.alive) return false;
      const r = GAME.getRel(f, o);
      if (r.war || r.ally || r.truce > 0 || r.op > 25) return false;
      const ratio = myP / (GAME.totalPower(o) + 1);
      if (o === P) {
        if (GAME.marriageProtects(f) || S().T < rules.warDelay || (threat?.active && threat.border.has(f))) return false;
        return ratio > (F.aggr > 0.7 ? 1.0 : 1.35);
      }
      if (!lively) return ratio > (F.aggr > 0.7 ? 1.0 : 1.35);
      if (focusesOnSong(o)) return false;
      const busy = enemiesOf(o).some(x => x !== f && x !== P && x !== 'rebel');
      return ratio > (F.aggr > 0.7 ? 0.9 : 1.15) * (busy ? 0.8 : 1);
    });
    if (!cands.length) return changed;
    cands.sort((a, b) => GAME.totalPower(a) - GAME.totalPower(b));
    GAME.declareWar(f, cands[0]);
    return true;
  }

  // ---------- 军事 ----------
  function unitPower(u) { return (U[u.t].atk + U[u.t].def) / 2 * u.s / 100; }
  function armyPower(a) { return a.units.reduce((s, u) => s + unitPower(u), 0) * (a.gen != null ? 1.1 : 0.9); }
  function cityDefense(c) {
    let p = c.garrison.reduce((s, u) => s + U[u.t].def * u.s / 100, 0) * 1.2 + c.wall * 0.6 + 4;
    const a = GAME.armyAt(c.tile); if (a && a.f === c.f) p += armyPower(a) * 1.2;
    return p;
  }

  // 远处且尚无路线时仅计目标地势；行至阵前，再以真正接敌的一格复核渡河、登岸与高差。
  function opposition(a, tile) {
    const path = a.path;
    const origin = GEO.dist(a.tile, tile) === 1 ? a.tile :
      path?.length > 1 && path[path.length - 1] === tile ? path[path.length - 2] : tile;
    const { Pa, Pd } = GAME.previewBattle(a, tile, undefined, origin);
    return Pd / Math.max(Pa, 0.001);
  }

  function military(f, cities, enemies) {
    const F = GAME.fac(f);
    const atWarNow = enemies.length > 0;
    const fightSong = f !== S().player && f !== 'rebel' && enemies.includes(S().player);
    const rules = f !== S().player && f !== 'rebel' ? GAME.difficultyRules().command : null;
    let armies = S().armies.filter(a => a.f === f && a.frontier == null);
    const aiWar = f !== S().player && !fightSong && enemies.some(e => e !== 'rebel');
    const maxArmies = Math.max(1, Math.round(cities.length / 3) + (atWarNow ? 1 : 0) + (aiWar ? 1 : 0) + (F.mongolBoost ? 3 : 0) +
      Math.round(2 * richness(F)) + (fightSong ? rules.armies : 0));
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
    const ctx = { es, eCities: S().cities.filter(c => es.has(c.f)), eArmies: S().armies.filter(o => es.has(o.f) && o.frontier == null),
      frontier: undefined, rules, fightSong, focusSong: focusesOnSong(f) };
    for (const a of armies) {
      if (!S().armies.includes(a)) continue;
      try { armyAct(a, cities, enemies, ctx); } catch (e) { console.error('AI army', e); }
    }
  }

  function nearestOwnCity(a, cities, free = false) {
    let best = null, bd = 1e9;
    for (const c of cities) {
      if (c.f !== a.f || (free && c.tile !== a.tile && GAME.armyAt(c.tile))) continue;
      const d = GEO.dist(c.tile, a.tile);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  function siegeReady(c, rules) {
    return c?.f !== S().player || S().T + 1e-9 >= (c.lastSiege ?? -Infinity) + rules.siegeInterval;
  }

  function armyAct(a, cities, enemies, ctx) {
    const f = a.f;
    const here = GAME.cityAt(a.tile);
    // 城中补员
    if (here && here.f === f) {
      const keep = isBorder(here, enemies) ? 2 : 1;
      while (a.units.length < GAME.armyCap(a) && here.garrison.length > keep) {
        let bi = 0; for (let i = 1; i < here.garrison.length; i++) if (U[here.garrison[i].t].atk > U[here.garrison[bi].t].atk) bi = i;
        GAME.transferToArmy(a.id, bi);
      }
    }
    const avg = a.units.reduce((s, u) => s + u.s, 0) / Math.max(1, a.units.length);
    const myP = armyPower(a);
    const rules = ctx.rules;
    const estimates = new Map();
    const oddsAgainst = tile => {
      if (!estimates.has(tile)) estimates.set(tile, opposition(a, tile));
      return estimates.get(tile);
    };
    const assault = c => ctx.fightSong && c.f === S().player ? rules.assault : f === S().player ? 0.9 : AI_ASSAULT;
    const otherFront = owner => ctx.focusSong && owner !== S().player ? 8 : 0;
    let goal = null;
    const worn = avg < (rules?.retreat ?? 45) || a.morale < (rules?.morale ?? 30);
    const undermanned = rules && a.units.length <= 2 && a.units.length < GAME.armyCap(a) / 2;
    if (worn || undermanned) {
      // 围城不退：兵员和士气尚能一战，且紧邻的电脑城池守备已弱，方可续攻。
      const pressOn = !undermanned && f !== S().player && avg >= 30 && a.morale >= 15 &&
        ctx.eCities.find(c => ctx.es.has(c.f) && c.f !== S().player && c.f !== 'rebel' &&
          GEO.dist(c.tile, a.tile) === 1 && !(a.badTargets?.[c.id] > S().T) && oddsAgainst(c.tile) * AI_ASSAULT <= 1);
      const c = pressOn || nearestOwnCity(a, cities, !!rules);
      if (c && c.tile !== a.tile) goal = c.tile;
      else return;
    } else if (enemies.length) {
      // 威胁：敌军靠近我方城市
      let threat = null, td = 1e9;
      for (const o of ctx.eArmies) {
        if (!S().armies.includes(o)) continue;
        const d = GEO.dist(o.tile, a.tile);
        if (d > 9 || ctx.fightSong && !siegeReady(GAME.cityAt(o.tile), rules)) continue;
        const nearMine = cities.some(c => GEO.dist(c.tile, o.tile) <= 3);
        if (!nearMine && d > 4) continue;
        const risk = oddsAgainst(o.tile);
        const score = d + risk + otherFront(o.f);
        if (risk < 1.15 && score < td) { td = score; threat = o; }
      }
      // 进攻目标城市
      let tgt = null, best = 1e9;
      for (const c of ctx.eCities) {
        if (!ctx.es.has(c.f)) continue;
        const d = GEO.dist(c.tile, a.tile);
        if (d > 22) continue;
        if (a.badTargets && a.badTargets[c.id] > S().T) continue;
        const againstSong = ctx.fightSong && c.f === S().player;
        if (againstSong && !siegeReady(c, rules)) continue;
        const risk = oddsAgainst(c.tile), def = myP * risk;
        const reconquest = rules && c.recentCapture?.from === f && S().T - c.recentCapture.t < rules.reconquest;
        if (risk * assault(c) > 1) continue;
        const border = againstSong && cities.some(home => GEO.dist(home.tile, c.tile) <= 7);
        const north = f === 'jin' && border && S().T < 20 ? rules.northPush : 0;
        const weakness = border && c.recentCapture && S().T - c.recentCapture.t < rules.reconquest ? (100 - c.loyalty) * rules.unrestWeight : 0;
        const score = d + def / 15 * (border ? rules.defenseWeight : 1) - (c.cap ? 3 : 0) -
          north - weakness - (reconquest ? 8 : 0) + otherFront(c.f);
        if (score < best) { best = score; tgt = c; }
      }
      if (threat && (!tgt || td < GEO.dist(tgt.tile, a.tile) + oddsAgainst(tgt.tile) + otherFront(tgt.f))) goal = threat.tile;
      else if (tgt) goal = tgt.tile;
      else {
        // 集结于前线城市
        if (ctx.frontier === undefined) {
          let fr0 = null, fd = 1e9;
          for (const c of cities) {
            let ed = 1e9;
            for (const o of ctx.eCities) { const d = GEO.dist(o.tile, c.tile) + otherFront(o.f); if (d < ed) ed = d; }
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
      if (here && here.f === f && S().armies.filter(x => x.f === f && x.frontier == null).length > Math.max(2, cities.length / 3) && rand() < 0.05 * GAME.E()) { GAME.disband(a.id); return; }
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
    // 通过行军入口确认确实即将交战。排入待守队列时也计一次，免得同回合重复派兵。
    GAME.advance(a, (tile, defender) => {
      const city = GAME.cityAt(tile);
      const limit = city && city.f === defender ? 1 / assault(city) : 1.15;
      if (opposition(a, tile) > limit) {
        if (city && a.aiGoal === tile) (a.badTargets ||= {})[city.id] = S().T + 2;
        a.aiGoal = null; a.path = [];
        return false;
      }
      if (!ctx.fightSong || defender !== S().player) return true;
      if (!siegeReady(city, rules)) return false;
      if (city?.f === S().player) city.lastSiege = S().T;
      return true;
    });
  }

  function rebelArmies() {
    for (const a of S().armies.filter(x => x.f === 'rebel' && x.frontier == null)) {
      let tgt = null, bd = 1e9;
      for (const c of S().cities) {
        if (c.f === 'rebel') continue;
        const d = GEO.dist(c.tile, a.tile);
        if (d >= 10 || d >= bd) continue;
        const risk = opposition(a, c.tile);
        if (risk * AI_ASSAULT <= 1 && d + risk < bd) { bd = d + risk; tgt = c; }
      }
      if (tgt) {
        if (!a.path || !a.path.length || a.aiGoal !== tgt.tile) { a.path = GAME.findPath(a, tgt.tile, 1500) || []; a.aiGoal = tgt.tile; }
        GAME.advance(a, tile => opposition(a, tile) * AI_ASSAULT <= 1);
      }
      // 乱军渐散
      if (rand() < 0.04 * GAME.E()) for (const u of a.units) u.s -= 15;
    }
  }

  return { turn, prisonersTurn, armyPower, cityDefense, eventAnswer };
})();
if (typeof module !== 'undefined') module.exports = AI;
