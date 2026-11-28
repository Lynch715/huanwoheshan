// 电脑势力：内政、征兵、行军、外交
var AI = (function () {
  const U = DATA.UNITS;
  const S = () => GAME.S;
  const rand = Math.random;

  // 电脑之间的兵事节奏（单位：季）
  const AI_WAR_RATE = 0.14;    // 每季按好战度起衅的概率系数（原 0.06，对我朝仍为 0.06）
  const AI_WAR_COOLDOWN = 6;   // 上次宣战后至少隔一年半再起新衅（对我朝仍为 10）
  const AI_WAR_MIN = 4;        // 电脑之间开战至少一年后才议和
  const MARCHES_PER_SEASON = 2;
  const AI_ASSAULT = 0.8;      // 攻电脑城池时，军力达到城防的倍数即敢攻（原 0.9）

  function turn(f) {
    const F = GAME.fac(f);
    if (!F.alive) return;
    const cities = GAME.citiesOf(f);
    if (f === S().player && GAME.seasonPulses(1)) {
      governSong(F);
      seekRespite(F, cities);
    }
    // 本次任官、组军只改将领身份，复用归属名单，挑选时仍读最新身份。
    let officers;
    const roster = () => officers ??= S().generals.filter(g => g.f === f);
    fillDeputies(f, S().armies, roster);
    if (f === 'rebel' && !cities.length) {
      for (let i = GAME.seasonPulses(MARCHES_PER_SEASON); i > 0; i--) rebelArmies();
      return;
    }
    research(f);
    const enemies = enemiesOf(f);
    maintainUnits(F);
    if (f === S().player) dismissForDebt(F, cities, enemies);
    economy(f, cities, enemies, roster);
    const declared = f !== 'rebel' && diplomacy(f, enemies);
    military(f, cities, declared ? enemiesOf(f) : enemies, roster);
  }

  function maintainUnits(F) {
    const s = S(), acted = s._unitMaintenance ||= {};
    if (!GAME.seasonPulses(1) || acted[F.id] === s.turn) return;
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

  function shoreUpDefenses(f, cities) {
    const { peaceCities } = GAME.difficultyRules().command;
    return f === S().player && peaceCities && S().year >= 1195 && cities.length <= peaceCities;
  }

  function seekRespite(F, cities) {
    if (!shoreUpDefenses(F.id, cities)) return;
    const rivals = enemiesOf(F.id).filter(f => f !== 'rebel').sort((a, b) => GAME.warScore(F.id, a) - GAME.warScore(F.id, b));
    for (const rival of rivals) {
      const separate = GAME.leagueMember(rival);
      const terms = GAME.proposePeace(F.id, rival, false, separate);
      if (terms.ok) break;
      if (terms.counter && F.gold >= terms.counter * 20 && GAME.proposePeace(F.id, rival, terms.counter, separate).ok) break;
    }
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
    if (p.ev === 'allycall' && GAME.mongolCampaign(p.enemy) && S().year < DATA.MONGOL_RISE.songWarYear) return 1;
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
    // 每项先抽一次浮动，排序只比较固定分数。浮动价差仍在六十之内。
    const options = av.map(id => ({ id, score: DATA.TECHS[id].cost * (1 - (F.techLessons[id] || 0) * 0.2) + rand() * 60 }));
    options.sort((a, b) => a.score - b.score);
    F.research = options[0].id;
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
      w[o] = o === 'mongol_keshig' && GAME.mongolCampaign(c.f) ? 6 : U[o].home ? v * 0.5 : v;
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

  function governCities(cities, roster) {
    const vacancies = cities.filter(c => c.governor == null);
    if (!vacancies.length) return;
    const civil = roster().filter(g => g.status === 'idle' && g.zheng >= g.tong)
      .sort((a, b) => b.zheng - a.zheng);
    if (!civil.length) return;
    vacancies.sort((a, b) => b.pop - a.pop);
    for (let i = 0; i < Math.min(vacancies.length, civil.length); i++) GAME.assignGovernor(civil[i].id, vacancies[i].id);
  }

  function bestBuilding(options, border, c) {
    let best = null, high = 0;
    for (const id of options) {
      const e = GAME.bldEff(id), B = DATA.BUILDINGS[id];
      const food = (e.food || 0) * 1.3 + (e.foodPct || 0) * 25;
      const prod = (e.prod || 0) + (e.prodPct || 0) * 20;
      const gold = (e.gold || 0) + (e.goldPct || 0) * 20 + (e.tradeSlot || 0) * 6;
      const sci = (e.sci || 0) * 0.8 + (e.sciPct || 0) * 10;
      const def = (e.wall || 0) * (border ? 0.15 : 0.04) + (e.recruitCost || 0) * 10;
      const bias = c ? { grain: food, industry: prod, commerce: gold, military: def, learning: sci }[c.role] || 0 : 0;
      const need = c ? (c.store < 0 ? food : 0) + (c.loyalty < 40 ? (e.happy || 0) : 0) : 0;
      const val = (food + prod + gold + sci + def + bias + need + (e.happy || 0) * 0.5 +
        (e.horse || 0) * 2 + (e.iron || 0) * 2) / Math.max(30, B.prod || 50);
      if (val > high) { best = id; high = val; }
    }
    return high > 0.04 ? best : null;
  }
  function delegatedTurn() {
    const s = S(), F = GAME.fac(s.player), report = [];
    if (!F.alive || s.defeat) return;
    for (const c of GAME.citiesOf(s.player)) {
      if (!c.delegated || c.governor == null) continue;
      if (c.loyalty < 35 && F.gold - GAME.reliefCost(c) >= s.delegationReserve && GAME.relief(c.id, true)) report.push(c.name + '赈济');
      if (c.queue.length) continue;
      if (GAME.queueTier(c.id, true)) { report.push(c.name + '筹备升等'); continue; }
      const short = c.garrison.length < GAME.garrisonCap(c) * 0.6;
      if (short && F.gold > s.delegationReserve) {
        const unit = GAME.unitOptions(c).filter(u => !['siege', 'navy'].includes(DATA.unitBase(u)) &&
          F.gold - GAME.unitCost(c, u).gold >= s.delegationReserve && GAME.canAffordUnit(c, u))
          .sort((a, b) => U[b].def - U[a].def || U[b].atk - U[a].atk)[0];
        if (unit && GAME.queueUnit(c.id, unit)) { report.push(c.name + '募' + U[unit].name + '一营'); continue; }
      }
      const building = bestBuilding(GAME.buildOptions(c), short, c);
      if (building && GAME.queueBuilding(c.id, building)) report.push(c.name + '营' + DATA.BUILDINGS[building].name);
    }
    if (report.length) GAME.log('诸州委政：' + report.join('，') + '。', 'eco');
  }

  function economy(f, cities, enemies, roster) {
    const orders = GAME.seasonPulses(1);
    if (!orders && !S().newSeason) return;
    const F = GAME.fac(f);
    const rk = richness(F);
    const atWarNow = enemies.filter(e => e !== 'rebel').length > 0;
    const armies = S().armies.filter(a => a.f === f && a.frontier == null);
    const units = armies.reduce((s, a) => s + a.units.length, 0) + cities.reduce((s, c) => s + c.garrison.length, 0);
    const targetUnits = Math.round((cities.length * (atWarNow ? 3.2 : 2) + 2 + (GAME.mongolCampaign(f) ? 10 : 0)) * (1 + 0.5 * rk));
    const inc = F.income || {};
    // 量入为出：粮钱入不敷出时不再扩军
    const broke = (F.food < 150 && (inc.food || 0) - (inc.foodUp || 0) < 0) || (F.gold < 100 && (inc.gold || 0) + (inc.trib || 0) - (inc.upkeep || 0) < 0);
    if (f !== S().player && broke && F.food < 0) {
      // 粮尽：裁撤超额守军
      for (const c of cities) while (c.garrison.length > Math.max(1, GAME.garrisonCap(c) - 2)) {
        const free = c.garrison.findLastIndex(u => u.training == null);
        if (free < 0) break;
        c.garrison.splice(free, 1);
      }
    }
    if (orders) governCities(cities, roster);
    if (S().newSeason && !broke && f !== 'rebel' && F.gold >= DATA.STATE_ECONOMY.projectReserve) {
      const reserve = Math.max(DATA.STATE_ECONOMY.projectReserve, (F.income.upkeep || 0) * 4);
      if (S().newYear && armies.some(a => a.morale < 85)) {
        const reward = GAME.hostReward(f);
        if (reward.ok && F.gold - reward.cost >= reserve) GAME.hostReward(f, true);
      }
      for (const c of cities) {
        if (F.gold <= reserve || c.queue.length || c.tier < 2 || GAME.enemyAdjacent(c.tile, f)) continue;
        const id = GAME.workOptions(c).find(id => F.gold - DATA.GREAT_WORKS[id].gold >= reserve);
        if (id) GAME.queueWork(c.id, id);
      }
    }
    if (!orders) return;
    const defending = shoreUpDefenses(f, cities) && atWarNow;
    const reserve = Math.max(500, (F.income.upkeep || 0) * 3);
    const canRush = c => F.gold - GAME.hurryCost(c) >= reserve;
    for (const c of cities) {
      if (c.tier > 0 && !c.role) GAME.setCityRole(c.id, preferredRole(c, isBorder(c, enemies)));
      const border = isBorder(c, enemies);
      const emergency = defending && (border || c.cap);
      if (c.queue.length) {
        const pending = c.queue[0];
        if (emergency && (pending.kind === 'u' || pending.kind === 'b' && pending.id === 'walls') && canRush(c)) GAME.hurry(c.id);
        continue;
      }
      if (emergency && c.garrison.length < GAME.garrisonCap(c)) {
        const unit = GAME.unitOptions(c).filter(type => !['navy', 'siege'].includes(DATA.unitBase(type)) && GAME.canAffordUnit(c, type))
          .sort((a, b) => U[b].def - U[a].def || U[b].atk - U[a].atk)[0];
        if (unit && GAME.queueUnit(c.id, unit)) {
          if (canRush(c)) GAME.hurry(c.id);
          continue;
        }
      }
      const ready = GAME.canUpgradeCity(c);
      if (ready && c.pop >= GAME.cityTier(c).pop - 2 && GAME.queueTier(c.id)) continue;
      const full = c.garrison.length >= GAME.garrisonCap(c);
      const wantG = 1 + (border ? 2 : 0) + (c.cap ? 1 : 0);
      let did = false;
      if (!full && (c.garrison.length < wantG || (!broke && units < targetUnits && rand() < 0.6)) && F.gold > 40) {
        const u = chooseUnit(c, atWarNow);
        if (u && GAME.queueUnit(c.id, u)) did = true;
      }
      if (!did && !broke && F.gold > 250 && c.buildings.barracks) did = improveEquipment(c, F);
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
        const pri = [(border || needWalls) && 'walls', 'farm', 'quechang', 'market', 'temple', 'granary', 'academy', 'barracks', 'smithy', 'shibosi', DATA.NOMAD[F.culture] && 'stable', 'walls', 'workshop', c.port && rand() < 0.3 && 'dock'].filter(Boolean);
        let b = pri.find(p => opts.includes(p));
        // 清单以外的新建筑：按效果粗估价值，择优而建
        if (!b && opts.length) {
          const LEG = ['walls', 'farm', 'market', 'temple', 'granary', 'academy', 'barracks', 'smithy', 'shibosi', 'stable', 'workshop', 'dock'];
          b = bestBuilding(opts.filter(id => !LEG.includes(id)), border);
        }
        if (b) GAME.queueBuilding(c.id, b);
        else if (F.gold > 60 && !full && !broke) { const u = chooseUnit(c, atWarNow); if (u) GAME.queueUnit(c.id, u); }
      }
    }
    // 每季拨一次加急工费；周制不能在同一季反复支用整季额度。
    if (F.gold > 350 && (S().turn === 0 || S().newSeason)) {
      const cs = cities.filter(c => c.queue.length && c.queue[0].kind !== 'work').sort((a, b) => (isBorder(b, enemies) ? 1 : 0) - (isBorder(a, enemies) ? 1 : 0));
      for (const c of cs.slice(0, 2 + Math.round(6 * rk))) if (F.gold - GAME.hurryCost(c) > 200) GAME.hurry(c.id);
    }
    // 海贸
    if (S().newSeason) for (const c of cities) {
      while (c.trade.length < GAME.tradeSlots(c)) {
        const t = GAME.routeTargets(c)[0];
        if (!t || !GAME.openRoute(c.id, t.id).ok) break;
      }
    }
  }
  function improveEquipment(c, F) {
    const stationed = GAME.armyAt(c.tile);
    const owners = stationed?.f === c.f && !stationed.path?.length ? [c, stationed] : [c];
    let best = null;
    for (const owner of owners) {
      const orders = new Map();
      (owner.units || owner.garrison).forEach((u, index) => {
        if (u.training != null) return;
        if (!orders.has(u.t)) orders.set(u.t, GAME.upgradeInfo(owner, index, true));
        const order = orders.get(u.t);
        if (!order.ok || F.gold - order.cost.gold < 200) return;
        const next = U[order.id], prev = U[u.t];
        const gain = (next.atk + next.def - prev.atk - prev.def) + (next.sea || 0) - (prev.sea || 0);
        const score = gain * (u.s / 100) * (1 + 0.1 * GAME.unitRank(u)) / (1 + order.cost.gold + order.work * 2);
        if (!best || score > best.score) best = { owner, index, score };
      });
    }
    return !!best && GAME.queueUpgrade(best.owner, best.index, true).ok;
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
      if (o.f === f || o.f === 'rebel' || GAME.steppeProtected(o)) continue;
      for (const m of mine) if (GEO.dist(o.tile, m.tile) <= 10) { set.add(o.f); break; }
    }
    const list = [...set];
    S0._nb[f] = { t: S0.T, list };
    return list;
  }

  function protectedTown(c, f) {
    return GAME.steppeProtected(c) || c?.name === '兴庆' && c.f === 'xia' && f !== 'mongol' &&
      GAME.mongolCampaign('mongol') && S().year < DATA.MONGOL_RISE.songWarYear;
  }

  function focusesOnSong(f) {
    const { player, difficulty } = S();
    return f !== player && f !== 'rebel' && GAME.atWar(f, player) &&
      ((GAME.difficultyRules().command.focusSong ?? difficulty >= 2) || GAME.leagueMember(f));
  }
  function diplomacy(f, enemies) {
    const F = GAME.fac(f), P = S().player;
    const rules = GAME.difficultyRules().coalition;
    let changed = false;
    const focusSong = focusesOnSong(f);
    // 与电脑议和
    for (const e of enemies) {
      if (e === P || e === 'rebel') continue;
      if (S().year < DATA.MONGOL_RISE.musterEnd && GAME.fac('jin').alive &&
          (GAME.mongolCampaign(f) && DATA.MONGOL_RISE.opponents.includes(e) ||
           GAME.mongolCampaign(e) && DATA.MONGOL_RISE.opponents.includes(f))) continue;
      if ((GAME.mongolCampaign(f) || GAME.mongolCampaign(e)) && S().T - (GAME.getRel(f, e).since ?? 0) < 20) continue;
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
    if (realWars >= 2 || focusSong || GAME.mongolCampaign(f) &&
        enemies.some(e => DATA.MONGOL_RISE.opponents.includes(e)) && GAME.citiesOf(f).length < DATA.MONGOL_RISE.westCities) return changed;
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
      if (f === P && GAME.mongolCampaign(o) && S().year < DATA.MONGOL_RISE.songWarYear) return false;
      const OF = GAME.fac(o);
      if (!OF.alive) return false;
      const r = GAME.getRel(f, o);
      if (r.war || r.ally || r.truce > 0 || r.op > 25) return false;
      const ratio = myP / (GAME.totalPower(o) + 1);
      if (o === P) {
        if (GAME.mongolCampaign(f) && S().year < DATA.MONGOL_RISE.songWarYear) return false;
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
  function unitPower(u) { return (U[u.t].atk + U[u.t].def) / 2 * u.s / 100 * (1 + 0.1 * GAME.unitRank(u)); }
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
    const { Pa, Pd } = GAME.previewBattle(a, tile, undefined, origin, true);
    return Pd / Math.max(Pa, 0.001);
  }

  function fillDeputies(f, armies, roster) {
    const vacancies = armies.filter(a => a.f === f && a.frontier == null && a.gen != null && a.deputy == null);
    if (!vacancies.length) return;
    const idle = roster().filter(g => g.status === 'idle' && !(g.wound > 0));
    const civilian = idle.filter(GAME.civil);
    const military = idle.filter(g => !GAME.civil(g));
    for (const a of vacancies) {
      const pool = civilian.length ? civilian : military;
      if (!pool.length) break;
      const chief = GAME.gen(a.gen);
      const supplement = g => Math.max(0, g.tong - chief.tong) + Math.max(0, g.wu - chief.wu) + Math.max(0, g.zhi - chief.zhi);
      let best = 0;
      for (let i = 1; i < pool.length; i++) {
        const gain = supplement(pool[i]) - supplement(pool[best]);
        if (gain > 0 || (gain === 0 && pool[i].zhi > pool[best].zhi)) best = i;
      }
      GAME.setDeputy(a.id, pool.splice(best, 1)[0].id);
    }
  }

  function military(f, cities, enemies, roster) {
    const F = GAME.fac(f);
    const atWarNow = enemies.length > 0;
    const fightSong = f !== S().player && f !== 'rebel' && enemies.includes(S().player);
    const rules = f !== S().player && f !== 'rebel' ? GAME.difficultyRules().command : null;
    const horde = GAME.mongolCampaign(f) && f !== S().player;
    const rate = Math.max(horde ? DATA.MONGOL_RISE.sorties : MARCHES_PER_SEASON, fightSong ? rules.sorties ?? 0 : 0);
    const sorties = GAME.seasonPulses(rate);
    const acted = S()._militaryTurn ||= {};
    if (!sorties || acted[f] === S().turn) return;
    acted[f] = S().turn;
    const armies = S().armies.filter(a => a.f === f && a.frontier == null);
    const aiWar = f !== S().player && !fightSong && enemies.some(e => e !== 'rebel');
    const maxArmies = Math.max(1, Math.round(cities.length / 3) + (atWarNow ? 1 : 0) + (aiWar ? 1 : 0) + (GAME.mongolCampaign(f) ? 3 : 0) +
      Math.round(2 * richness(F)) + (fightSong ? rules.armies : 0));
    const defending = atWarNow && shoreUpDefenses(f, cities);
    const lead = () => {
      let best;
      for (const g of roster()) if (g.status === 'idle' && !(g.wound > 0) && (!best || g.tong > best.tong)) best = g;
      return best;
    };
    // 组建
    if (armies.length < maxArmies) {
      const cs = cities.slice().sort((a, b) => b.garrison.length - a.garrison.length);
      for (const c of cs) {
        if (armies.length >= maxArmies) break;
        const keep = isBorder(c, enemies) ? (defending ? 4 : 2) : 1;
        if (c.garrison.length < keep + 3 || GAME.armyAt(c.tile)) continue;
        if (!atWarNow && rand() > 0.15) continue;
        const g = lead()?.id ?? null;
        const cap = GAME.capFor(g);
        const take = Math.min(cap, c.garrison.length - keep);
        const idx = c.garrison.map((u, i) => i).sort((i, j) => (U[c.garrison[j].t].atk) - (U[c.garrison[i].t].atk)).slice(0, take);
        const a = GAME.formArmy(c.id, g, idx);
        if (a) armies.push(a);
      }
    }
    // 补将
    for (const a of armies) if (a.gen == null) {
      const g = lead();
      if (g && g.tong > g.zheng - 10) GAME.setArmyGeneral(a.id, g.id);
    }
    fillDeputies(f, armies, roster);
    const es = new Set(enemies);
    const finalSiege = fightSong && rules.finalSiegeInterval && GAME.citiesOf(S().player).length <= rules.finalSiegeCities;
    const ctx = { f, es, finalSiege, defending, eCities: S().cities.filter(c => es.has(c.f) && !protectedTown(c, f)), eArmies: S().armies.filter(o => es.has(o.f) && o.frontier == null && !protectedTown(GAME.cityAt(o.tile), f)),
      frontier: undefined, rules, fightSong, focusSong: focusesOnSong(f) };
    for (let round = 0; round < sorties; round++) for (const a of armies) {
      if (!S().armies.includes(a) || S()._defQ?.some(item => item.aid === a.id)) continue;
      if (round && a.mp > 0 && a.aiGoal == null) continue;
      a.mp = GAME.armyMP(a) / GAME.mpFactor();
      ctx.time = GAME.seasonPulseTime(rate, round);
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

  function siegeReady(c, ctx) {
    if (!c) return true;
    const state = S(), f = ctx.f;
    if (c.f !== f && GAME.mongolCampaign(f) && f !== state.player &&
        state.T + 1e-9 < (GAME.fac(f).mongolCaptureT ?? -Infinity) + DATA.MONGOL_RISE.captureInterval) return false;
    if (c.f !== state.player) return true;
    if (state._defQ?.some(item => item.tile === c.tile)) return false;
    const { siegeInterval, lateSiegeInterval } = ctx.rules;
    const interval = ctx.finalSiege ? ctx.rules.finalSiegeInterval : state.T >= 4 ? lateSiegeInterval ?? siegeInterval : siegeInterval;
    return ctx.time + 1e-9 >= (c.lastSiege ?? -Infinity) + interval;
  }

  function armyAct(a, cities, enemies, ctx) {
    if (GAME.trainingArmy(a)) return;
    const f = a.f;
    const here = GAME.cityAt(a.tile);
    // 城中补员
    if (here && here.f === f) {
      const keep = isBorder(here, enemies) ? (ctx.defending ? 4 : 2) : 1;
      while (a.units.length < GAME.armyCap(a) && here.garrison.length > keep) {
        let bi = -1;
        for (let i = 0; i < here.garrison.length; i++) {
          const u = here.garrison[i];
          if (u.training == null && (bi < 0 || U[u.t].atk > U[here.garrison[bi].t].atk)) bi = i;
        }
        if (bi < 0 || !GAME.transferToArmy(a.id, bi)) break;
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
    const horde = GAME.mongolCampaign(f) && f !== S().player;
    const assault = c => ctx.fightSong && c.f === S().player ? (ctx.finalSiege ? rules.finalAssault : rules.assault) : f === S().player ? 0.9 : horde ? DATA.MONGOL_RISE.assault : AI_ASSAULT;
    const front = horde ? facCampaignFront(f, ctx.es) : ctx.focusSong ? S().player : null;
    const otherFront = owner => front && owner !== front ? (horde ? 15 : 8) : 0;
    let goal = null;
    const worn = avg < (horde ? 32 : rules?.retreat ?? 45) || a.morale < (horde ? 20 : rules?.morale ?? 30);
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
        const d = GEO.dist(o.tile, a.tile);
        if (d > 9 || !S().armies.includes(o)) continue;
        if (ctx.fightSong && !siegeReady(GAME.cityAt(o.tile), ctx)) continue;
        if (d > 4 && !cities.some(c => GEO.dist(c.tile, o.tile) <= 3)) continue;
        const risk = oddsAgainst(o.tile);
        const score = d + risk + otherFront(o.f);
        if (risk < 1.15 && score < td) { td = score; threat = o; }
      }
      // 进攻目标城市
      let tgt = null, best = 1e9;
      for (const c of ctx.eCities) {
        if (!ctx.es.has(c.f)) continue;
        if (ctx.defending && c.origF !== f && !cities.some(own => GEO.dist(own.tile, c.tile) <= 4)) continue;
        const d = GEO.dist(c.tile, a.tile);
        if (d > 22) continue;
        if (a.badTargets && a.badTargets[c.id] > S().T) continue;
        const againstSong = ctx.fightSong && c.f === S().player;
        if (againstSong && !siegeReady(c, ctx)) continue;
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
      if (threat && (!tgt || td < GEO.dist(tgt.tile, a.tile) + oddsAgainst(tgt.tile) + otherFront(tgt.f) - (horde ? 4 : 0))) goal = threat.tile;
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
      if (protectedTown(city, f) || city?.f === defender && (horde || ctx.fightSong) && !siegeReady(city, ctx)) return false;
      const limit = city && city.f === defender ? 1 / assault(city) : 1.15;
      if (opposition(a, tile) > limit) {
        if (city && a.aiGoal === tile) (a.badTargets ||= {})[city.id] = S().T + 2;
        a.aiGoal = null; a.path = [];
        return false;
      }
      if (ctx.fightSong && defender === S().player && city?.f === S().player) city.lastSiege = ctx.time;
      return true;
    });
  }

  function facCampaignFront(f, enemies) {
    const front = GAME.fac(f).mongolFront;
    return enemies.has(front) ? front : null;
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
        a.mp = GAME.armyMP(a) / GAME.mpFactor();
        if (!a.path || !a.path.length || a.aiGoal !== tgt.tile) { a.path = GAME.findPath(a, tgt.tile, 1500) || []; a.aiGoal = tgt.tile; }
        GAME.advance(a, tile => opposition(a, tile) * AI_ASSAULT <= 1);
      }
      // 乱军渐散
      if (rand() < 0.04 / MARCHES_PER_SEASON) for (const u of a.units) u.s -= 15;
    }
  }

  return { turn, delegatedTurn, prisonersTurn, armyPower, cityDefense, eventAnswer };
})();
if (typeof module !== 'undefined') module.exports = AI;
