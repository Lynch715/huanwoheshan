// 核心规则：状态、经济、军事、外交、回合
var GAME = (function () {
  const T = GEO.T, TERR = GEO.TERRAIN, U = DATA.UNITS, B = DATA.BUILDINGS, TECH = DATA.TECHS;
  let S = null;
  const listeners = { log: [], battle: [], event: [], change: [] };
  const hooks = { engage: false, defend: null };
  // 敌军攻我：若 UI 接管（亲自守御），先记下，待敌方回合结束后逐一交战
  function deferDefense(a, next, df) {
    if (a.f === S.player || df !== S.player || !hooks.defend || !hooks.defend(a, next)) return false;
    (S._defQ = S._defQ || []).push({ aid: a.id, tile: next });
    a.mp = 0; a.path = [];
    return true;
  }
  function on(k, fn) { listeners[k].push(fn); }
  function emit(k, d) { for (const fn of listeners[k]) fn(d); }

  const SEASONS = ['春', '夏', '秋', '冬'];
  const ERAS = [[1131, '绍兴'], [1163, '隆兴'], [1165, '乾道'], [1174, '淳熙'], [1190, '绍熙'], [1195, '庆元'], [1201, '嘉泰'], [1205, '开禧'], [1208, '嘉定'], [1225, '宝庆'], [1228, '绍定'], [1234, '端平'], [1237, '嘉熙'], [1241, '淳祐'], [1253, '宝祐'], [1259, '开庆'], [1260, '景定'], [1265, '咸淳'], [1275, '德祐'], [1276, '景炎'], [1278, '祥兴'], [1280, '兴宋'], [1300, '大同'], [1340, '永昌']];
  const NUM = '〇一二三四五六七八九十';
  function cnNum(n) {
    if (n <= 10) return NUM[n];
    if (n < 20) return '十' + NUM[n - 10];
    const t = Math.floor(n / 10), o = n % 10;
    return NUM[t] + '十' + (o ? NUM[o] : '');
  }
  const MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
  function dayName(d) { if (d <= 10) return '初' + NUM[d]; if (d < 20) return '十' + NUM[d - 10]; if (d === 20) return '二十'; if (d < 30) return '廿' + NUM[d - 20]; return '三十'; }
  function eraYear(y) {
    let era = ERAS[0];
    for (const e of ERAS) if (y >= e[0]) era = e;
    const n = y - era[0] + 1;
    return era[1] + (n === 1 ? '元' : cnNum(n)) + '年';
  }
  function dateStr(y, s) {
    if (y) return eraYear(y) + SEASONS[s || 0];
    if (!S.scale || S.scale >= 90) return eraYear(S.year) + SEASONS[S.season];
    const m = Math.floor(S.doy / 30), d = S.doy % 30 + 1;
    return eraYear(S.year) + MONTHS[m] + dayName(d);
  }
  const SCALE_NAME = { 7: '周', 10: '旬', 30: '月', 90: '季' };
  function unitName() { return SCALE_NAME[S.scale] || '回合'; }
  function E() { return (S.scale || 90) / 90; }
  function mpFactor() { return { 7: 0.5, 10: 0.7, 30: 1, 90: 1 }[S.scale] || 1; }
  let ANIM = [];
  function rec(e) { ANIM.push(e); return e; }
  function takeAnim() { const a = ANIM; ANIM = []; return a; }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function difficultyRules() { return DATA.DIFFICULTY[S.difficulty] || DATA.DIFFICULTY[1]; }
  const northStart = f => f === 'jin' || f === 'xia';
  function reachedEra(F) {
    return Object.keys(F.techs).reduce((era, id) => Math.max(era, TECH[id]?.era || 1), 1);
  }

  // ---------- 初始化 ----------
  function fac(id) { return S.factions[id]; }
  function city(id) { return S.cities[id]; }
  function gen(id) { return id == null ? null : S.generals[id]; }
  function army(id) { return S.armies.find(a => a.id === id); }

  function newGame(opts) {
    opts = opts || {};
    GEO.generate();
    const N = GEO.W * GEO.H;
    S = {
      v: 2, turn: 0, year: 1140, season: 2, doy: 189, scale: opts.scale || 7, T: 0, player: 'song', factions: {}, cities: [], armies: [], generals: [],
      tileCity: new Int32Array(N).fill(-1), explored: new Uint8Array(N), visible: new Uint8Array(N),
      rel: {}, flags: { coalition: {}, coalitionT: null, recommendYear: null }, log: [], nextArmy: 1, difficulty: DATA.DIFFICULTY[opts.difficulty] ? +opts.difficulty : 1, victory: false, pending: [],
      settlement: null,
    };
    if (typeof EVENTS !== 'undefined') { EVENTS.initAchievements(S); EVENTS.initSchedule(S); }
    for (const d of DATA.FACTIONS) {
      S.factions[d.id] = {
        id: d.id, name: d.name, seal: d.seal, color: d.color, culture: d.culture, aggr: d.aggr,
        gold: 150, food: 200, man: 40, horse: 10, iron: 10, sci: 0, research: null, techs: {}, alive: true,
        warWeary: 0, met: {}, capital: -1, lastWar: -99, score: 0, income: {},
      };
      for (const t of (DATA.START_TECH[d.id] || [])) S.factions[d.id].techs[t] = 1;
      S.factions[d.id].recruitEra = reachedEra(S.factions[d.id]);
    }
    addRebelFaction();
    const song = fac('song');
    Object.assign(song, { gold: 600, food: 600, man: 120, horse: 30, iron: 40 });
    song.gold *= difficultyRules().startReserve; song.food *= difficultyRules().startReserve;
    Object.assign(fac('jin'), { gold: 400, food: 500, man: 120, horse: 80, iron: 40 });
    // 城市
    const occupied = [];
    for (const c of DATA.CITIES) {
      const t = placeCity(c.lon, c.lat, occupied);
      if (t < 0) continue;
      occupied.push(t);
      const id = S.cities.length;
      const cc = {
        id, name: c.name, f: c.f, origF: c.f, tile: t, pop: c.pop, store: 0, loyalty: 70, unrest: 0,
        buildings: {}, queue: [], garrison: [], wall: 0, governor: null, cap: c.cap, origCap: c.cap, trade: [], recentCapture: null, lastSiege: null,
        port: GEO.coastal(t), seas: [...GEO.seaBodiesOf(t)], culture: fac(c.f).culture,
      };
      S.cities.push(cc);
      if (c.cap) fac(c.f).capital = id;
    }
    for (const cc of S.cities) setupCity(cc);
    assignTerritory(true);
    // 将领
    for (const row of DATA.GEN) addHistorical(row);
    // 关系
    for (const a in S.factions) for (const b in S.factions) if (a < b) {
      const r = getRel(a, b);
      r.op = fac(a).culture === fac(b).culture ? ri(10, 30) : ri(-15, 15);
    }
    const wars = [['song', 'jin'], ['mongol', 'jin'], ['xiliao', 'seljuk'], ['zengid', 'crusader'], ['almoravid', 'castile'], ['almoravid', 'portugal'], ['ghor', 'ghazni'],
      ['chola', 'chalukya'], ['cuman', 'rus'], ['khmer', 'champa'], ['khmer', 'daviet'], ['sicily', 'byz'], ['georgia', 'seljuk'], ['naiman', 'kerait']];
    for (const [a, b] of wars) { const r = getRel(a, b); r.war = true; r.op = -40; }
    getRel('jin', 'xia').op = 30;
    getRel('song', 'dali').op = 25; getRel('song', 'goryeo').op = 20;
    setupStartArmies();
    generateSites();
    if (typeof COURT !== 'undefined') COURT.init();
    // 初始已知
    const knownF = ['song', 'jin', 'xia', 'dali', 'tubo', 'goryeo', 'japan', 'daviet', 'champa', 'khmer', 'pagan', 'mayi'];
    for (const cc of S.cities) {
      if (knownF.includes(cc.f)) for (const t of GEO.ring(cc.tile, 5)) S.explored[t] = 1;
    }
    for (const nm of ['坦焦尔', '甘吉', '波隆纳鲁瓦', '巴士拉', '尸罗夫', '忽鲁谟斯', '苏哈尔', '亚丁', '马拉巴尔', '勃固', '高达', '羯陵伽', '果阿']) {
      const cc = S.cities.find(x => x.name === nm);
      if (cc) for (const t of GEO.ring(cc.tile, 2)) S.explored[t] = 1;
    }
    for (const f of knownF.concat(['chola', 'lanka', 'abbasid', 'seljuk', 'oman', 'yemen', 'pala', 'chalukya'])) meet('song', f, true);
    updateVisibility();
    log('绍兴十年七月，岳飞大破金兀术于郾城，兵锋直指汴京。', 'big');
    S.pending.push({ ev: 'jinpai' });
    return S;
  }

  function addRebelFaction() {
    S.factions.rebel = {
      id: 'rebel', name: '义军', seal: '义', color: '#6b5a48', culture: 'han', aggr: 1, gold: 0, food: 0, man: 0, horse: 0, iron: 0, sci: 0, research: null,
      techs: {}, alive: true, warWeary: 0, met: {}, capital: -1, lastWar: 0, score: 0, income: {}, rebel: true,
    };
  }

  function placeCity(lon, lat, occupied) {
    const [c, r] = GEO.nearestHex(lon, lat);
    const start = GEO.idx(c, r);
    const cands = GEO.ring(start, 3);
    let best = -1, bd = 1e9;
    for (const t of cands) {
      if (GEO.isWater(t)) continue;
      let ok = true;
      for (const o of occupied) if (GEO.dist(o, t) < 2) { ok = false; break; }
      if (!ok) continue;
      const d = GEO.dist(start, t) + (t === start ? -0.5 : 0);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  function setupCity(c) {
    const f = fac(c.f);
    if (c.pop >= 7 || c.cap) c.buildings.walls = 1;
    if (c.pop >= 10) c.buildings.market = 1;
    if (c.f === 'song') {
      if (c.pop >= 7) c.buildings.farm = 1;
      if (c.pop >= 8) c.buildings.academy = 1;
      if (['泉州', '广州', '明州'].includes(c.name)) { c.buildings.shibosi = 1; c.buildings.dock = 1; }
      if (['楚州', '临安', '建康', '鄂州'].includes(c.name)) c.buildings.dock = 1;
    } else {
      if (c.pop >= 9 && Math.random() < 0.5) c.buildings.temple = 1;
      if (c.port && c.pop >= 8 && f.techs.zhinanzhen) c.buildings.shibosi = 1;
    }
    if (c.cap) c.buildings.temple = 1;
    c.wall = maxWall(c);
    const n = 1 + Math.floor(c.pop / 4) + (c.cap ? 2 : 0) + (c.f === 'song' ? 1 : 0) +
      (northStart(c.f) ? difficultyRules().northGarrison : 0);
    const nomad = DATA.NOMAD[f.culture];
    for (let i = 0; i < n; i++) {
      const t = nomad ? (i % 2 ? 'hbow' : (i % 3 === 0 ? 'inf' : 'cav')) : (i % 3 === 2 ? 'bow' : (i % 4 === 3 ? 'cav' : 'inf'));
      c.garrison.push(mkUnit(t));
    }
    c.loyalty = 65 + (c.cap ? 10 : 0);
  }
  function mkUnit(t, s) { return { t, s: s || 100 }; }

  function addGeneral(o) {
    const g = Object.assign({ id: S.generals.length, loc: null, loyalty: 80, exp: 0, wins: 0 }, o);
    if (!g.cul) g.cul = o.f === 'rebel' ? 'han' : fac(o.f).culture;
    S.generals.push(g);
    return g;
  }
  function addHistorical([name, f, birth, tong, wu, zhi, zheng, skill, avail = birth + 20]) {
    const g = addGeneral({ name, f, birth, tong, wu, zhi, zheng, skill, hist: true, avail, status: 'future' });
    if (avail <= S.year) enterService(g);
    return g;
  }
  function enterService(g) {
    if (!fac(g.f)?.alive) {
      const hosts = Object.values(S.factions).filter(F => F.alive && !F.rebel && F.culture === g.cul && citiesOf(F.id).length);
      if (!hosts.length) { g.status = 'gone'; return; }
      g.f = pick(hosts).id;
    }
    g.status = 'idle';
  }
  function genName(culture) {
    const N = DATA.NAMES[culture] || DATA.NAMES.han;
    const s = typeof N.s === 'string' ? N.s[ri(0, N.s.length - 1)] : pick(N.s);
    let g;
    if (typeof N.g === 'string') { g = N.g[ri(0, N.g.length - 1)]; if (Math.random() < 0.6) g += N.g[ri(0, N.g.length - 1)]; }
    else g = pick(N.g);
    return s + g;
  }
  function randomGeneral(f, type, q, culture) {
    q = q || 45;
    const st = () => clamp(Math.round(q + rnd(-12, 22)), 20, 92);
    const cul = culture || (f === 'rebel' ? 'han' : fac(f).culture);
    let g = { name: genName(cul), f, cul, birth: S.year - ri(22, 40), tong: st(), wu: st(), zhi: st(), zheng: st(), skill: '', hist: false, status: 'idle' };
    if (type === 'civil') { g.tong = clamp(g.tong - 20, 15, 80); g.wu = clamp(g.wu - 25, 10, 80); g.zheng = clamp(g.zheng + 12, 30, 95); g.zhi = clamp(g.zhi + 8, 30, 95); }
    if (type === 'mil') { g.zheng = clamp(g.zheng - 15, 15, 80); g.tong += 5; g.wu += 6; g.tong = Math.min(g.tong, 95); g.wu = Math.min(g.wu, 96); }
    if (Math.random() < 0.3) {
      const pool = type === 'civil' ? ['治世', '理财', '劝农', '教化'] : ['骁勇', '坚守', '守险', '铁骑', '神射', '攻城', '疾行', '水战'];
      g.skill = pick(pool);
    }
    return addGeneral(g);
  }

  function setupStartArmies() {
    const H = (lon, lat) => { const [c, r] = GEO.nearestHex(lon, lat); return GEO.idx(c, r); };
    const G = n => S.generals.find(g => g.name === n);
    const mk = (f, gname, tile, units, name) => {
      const g = gname ? G(gname) : null;
      const free = x => !GEO.isWater(x) && !armyAt(x) && (!cityAt(x) || cityAt(x).f === f);
      if (!free(tile)) tile = GEO.ring(tile, 3).find(free);
      if (tile == null) return null;
      if (northStart(f)) {
        const size = Math.min(units.length + difficultyRules().northArmy, capFor(g?.id));
        while (units.length < size) units.push(units.length % 2 ? 'bow' : 'cav');
      }
      const a = createArmyRaw(f, tile, units.map(t => mkUnit(t)), g ? g.id : null, name);
      a.morale = 90;
      return a;
    };
    mk('song', '岳飞', H(114.0, 33.6), ['elite', 'elite', 'cav', 'cav', 'inf', 'inf', 'inf', 'bow', 'bow'], '岳家军');
    mk('song', '张宪', H(113.6, 34.3), ['cav', 'inf', 'inf', 'bow'], '');
    mk('song', '韩世忠', city(S.cities.find(c => c.name === '楚州').id).tile, ['inf', 'inf', 'inf', 'bow', 'bow', 'navy', 'navy'], '韩家军');
    mk('song', '刘锜', H(115.8, 33.0), ['inf', 'inf', 'inf', 'bow', 'bow', 'bow'], '八字军');
    mk('song', '吴璘', S.cities.find(c => c.name === '兴元').tile, ['inf', 'inf', 'inf', 'bow', 'bow', 'cav'], '吴家军');
    mk('song', '张俊', S.cities.find(c => c.name === '庐州').tile, ['inf', 'inf', 'inf', 'bow', 'bow', 'cav'], '');
    mk('song', '杨沂中', S.cities.find(c => c.name === '临安').tile, ['inf', 'inf', 'bow', 'bow', 'cav'], '殿前司');
    mk('jin', '完颜宗弼', S.cities.find(c => c.name === '汴京').tile, ['hcav', 'hcav', 'cav', 'cav', 'cav', 'inf', 'inf', 'bow', 'bow'], '');
    mk('jin', '韩常', H(114.6, 34.0), ['cav', 'cav', 'inf', 'inf', 'bow'], '');
    mk('jin', '完颜撒离喝', S.cities.find(c => c.name === '京兆').tile, ['cav', 'cav', 'inf', 'inf', 'inf', 'bow'], '');
    mk('jin', '李成', S.cities.find(c => c.name === '洛阳').tile, ['inf', 'inf', 'inf', 'bow'], '');
    mk('jin', '孔彦舟', S.cities.find(c => c.name === '徐州').tile, ['inf', 'inf', 'inf', 'bow'], '');
    mk('jin', '完颜突合速', S.cities.find(c => c.name === '燕京').tile, ['hcav', 'cav', 'cav', 'inf', 'inf'], '');
    // 其余势力：每国将领领一军于都城
    for (const f in S.factions) {
      if (f === 'song' || f === 'jin' || f === 'rebel') continue;
      const F = fac(f);
      if (F.capital < 0) continue;
      const cap = city(F.capital);
      const gens = S.generals.filter(g => g.f === f && g.status === 'idle');
      const nomad = DATA.NOMAD[F.culture];
      const size = Math.min(7, 3 + Math.floor(cap.pop / 4));
      const gg = gens.sort((a, b) => b.tong - a.tong)[0] || randomGeneral(f, 'mil', 50);
      const units = [];
      for (let i = 0; i < size; i++) units.push(nomad ? (i % 2 ? 'hbow' : 'cav') : (i % 3 === 0 ? 'bow' : (i === 1 && F.techs.jiaqi ? 'hcav' : (i % 4 === 3 ? 'cav' : 'inf'))));
      mk(f, gg.name, cap.tile, units, '');
    }
  }

  // ---------- 关系 ----------
  function relKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
  function getRel(a, b) {
    const k = relKey(a, b);
    if (!S.rel[k]) S.rel[k] = { war: false, truce: 0, ally: false, op: 0, score: 0, trib: null };
    return S.rel[k];
  }
  function atWar(a, b) {
    if (a === b) return false;
    if (a === 'rebel' || b === 'rebel') return true;
    return getRel(a, b).war;
  }
  function allied(a, b) { return a !== b && a !== 'rebel' && b !== 'rebel' && getRel(a, b).ally; }
  // 从 a 视角的战争分
  function warScore(a, b) { const r = getRel(a, b); return a < b ? r.score : -r.score; }
  function addWarScore(a, b, v) { const r = getRel(a, b); r.score += a < b ? v : -v; }

  function meet(a, b, silent) {
    if (a === b || b === 'rebel') return;
    const A = fac(a), Bf = fac(b);
    if (!A || !Bf || A.met[b]) return;
    A.met[b] = 1; Bf.met[a] = 1;
    if (a === S.player && !silent) log(`遣使与【${Bf.name}】初通音讯。`, 'dip');
  }

  // 某势力的城池是否临近我朝（用于决定天下大事是否提示玩家）
  function nearPlayer(f, range = 10) {
    const mine = citiesOf(S.player);
    if (!mine.length) return false;
    for (const c of S.cities) if (c.f === f) for (const m of mine) if (GEO.dist(c.tile, m.tile) <= range) return true;
    return false;
  }
  function casusBelli(a, b) {
    if (citiesOf(b).some(c => c.origF === a || a === 'song' && DATA.SONG_RECLAIM.has(c.name))) return { kind: 'reclaim', name: '收复故土' };
    const relation = getRel(a, b);
    if (S.T - (relation.struckBy?.[b] ?? -Infinity) <= 4 || relation.brokenBy?.[b]) return { kind: 'provoked', name: '对方先犯' };
    if (Object.values(S.factions).some(F => F.alive && F.id !== a && F.id !== b && allied(a, F.id) && atWar(b, F.id))) {
      return { kind: 'ally', name: '援救盟国' };
    }
    return { kind: 'none', name: '无名之师' };
  }
  function landBorders(owned, excluded) {
    const border = new Set();
    for (const c of owned) for (const tile of cityTiles(c)) for (const next of GEO.NBR[tile]) {
      const owner = tileOwner(next);
      if (owner && !excluded.has(owner) && owner !== 'rebel') border.add(owner);
    }
    return border;
  }
  function warOpinions(a, b, cause, broken) {
    const base = (cause.kind === 'none' ? -8 : 0) - (broken ? 10 : 0);
    if (!base && cause.kind !== 'reclaim') return;
    const excluded = new Set([a, b]), seats = S.cities.filter(c => excluded.has(c.f));
    const border = base ? landBorders(seats, excluded) : new Set();
    const vicinity = new Set();
    if (base) for (const c of S.cities) {
      if (!c.f || excluded.has(c.f) || border.has(c.f) || vicinity.has(c.f)) continue;
      if (seats.some(seat => GEO.dist(seat.tile, c.tile) <= 15)) vicinity.add(c.f);
    }
    for (const F of Object.values(S.factions)) {
      if (!F.alive || F.rebel || excluded.has(F.id)) continue;
      const ties = getRel(F.id, b);
      const hostile = ties.war || ties.op < -30;
      const delta = hostile ? (cause.kind === 'reclaim' ? 5 : base ? 3 : 0)
        : base * (border.has(F.id) ? 1 : vicinity.has(F.id) ? 0.5 : 0.1) * (ties.ally ? 2 : 1);
      const opinion = getRel(F.id, a);
      opinion.op = clamp(opinion.op + delta, -100, 100);
    }
  }
  function declareWar(a, b, quiet) {
    if (a === b || atWar(a, b)) return;
    const r = getRel(a, b);
    const cause = casusBelli(a, b), broken = r.truce > 0;
    if (broken) (r.brokenBy ||= {})[a] = true;
    if (a === S.player) S.flags.lastSortie = { kind: cause.kind, t: S.T };
    warOpinions(a, b, cause, broken);
    r.war = true; r.ally = false; r.truce = 0; r.op = Math.min(r.op, -30); r.score = 0; r.trib = null; r.since = S.T;
    delete r.coalitionAlly;
    fac(a).lastWar = S.T;
    // 涉及我朝的宣战另记一笔：电脑之间的战事不应推迟其对我朝起衅的冷却
    if (a === S.player || b === S.player) fac(a).lastMainWar = S.T;
    breakRoutesBetween(a, b);
    if (!quiet) {
      if (b === S.player) log(`【${fac(a).name}】向我朝宣战！`, 'war');
      else if (a === S.player) log(`我朝以「${cause.name}」向【${fac(b).name}】宣战。`, 'war');
      else if (fac(S.player).met[a] && fac(S.player).met[b]) log(`【${fac(a).name}】与【${fac(b).name}】开战。`, 'world', null, nearPlayer(a) || nearPlayer(b));
    }
    // 盟友参战
    for (const f in S.factions) {
      if (f === a || f === b || !fac(f).alive || f === 'rebel') continue;
      if (allied(f, b) && !allied(f, a) && !atWar(f, a)) {
        if (a === S.player && getRel(f, b).coalitionAlly) continue;
        if (f === S.player) { EVENTS.offer({ ev: 'allycall', a: f, enemy: a, ally: b }, 'allianceCall'); }
        else declareWar(f, a, false);
      }
    }
  }
  function makePeace(a, b, trib) {
    const r = getRel(a, b);
    // 电脑之间和约三年，涉及我朝仍为六年
    r.war = false; r.truce = a === S.player || b === S.player ? 24 : 12; r.score = 0; r.op = Math.max(r.op, -10);
    r.trib = trib || null; // {from, to, amt, turns}
    fac(a).warWeary = Math.max(0, fac(a).warWeary - 20); fac(b).warWeary = Math.max(0, fac(b).warWeary - 20);
    if (a === S.player || b === S.player) {
      const o = a === S.player ? b : a;
      log(`与【${fac(o).name}】议和` + (trib ? `，${fac(trib.from).name}岁输 ${trib.amt} 贯，凡 ${trib.turns} 季。` : '。'), 'dip');
    } else if (fac(S.player).met[a] && fac(S.player).met[b]) log(`【${fac(a).name}】与【${fac(b).name}】议和。`, 'world');
    const { returning, releasing } = peaceCaptives(a, b);
    for (const g of [...returning, ...releasing]) returnCaptive(g);
    const home = a === S.player ? returning : b === S.player ? releasing : [];
    const away = a === S.player ? releasing : b === S.player ? returning : [];
    if (home.length) log(`和议既成，${home.map(g => g.name).join('、')}归朝。`, 'dip');
    if (away.length) log(`依和约遣还${away.map(g => g.name).join('、')}。`, 'dip');
  }

  // ---------- 势力强弱 ----------
  function unitPower(u) { const d = U[u.t]; return (d.atk + d.def) * u.s / 100; }
  function militaryPower(f) {
    let p = 0;
    for (const a of S.armies) if (a.f === f) for (const u of a.units) p += unitPower(u);
    for (const c of S.cities) if (c.f === f) for (const u of c.garrison) p += unitPower(u) * 0.8;
    return p;
  }
  function citiesOf(f) { return S.cities.filter(c => c.f === f); }
  function totalPower(f) { const cs = citiesOf(f); return militaryPower(f) + cs.reduce((s, c) => s + c.pop * 3, 0); }
  function playerThreat() {
    if (S._playerThreat?.turn === S.turn) return S._playerThreat;
    const p = S.player, power = totalPower(p), owned = citiesOf(p);
    const rank = 1 + Object.values(S.factions).filter(F => F.alive && F.id !== p && !F.rebel && totalPower(F.id) > power).length;
    const share = owned.length / Math.max(1, S.cities.filter(c => c.f).length);
    const score = share + (rank === 1 ? 0.04 : rank <= 3 ? 0.02 : 0);
    const active = score >= difficultyRules().coalition.threat;
    const border = active ? landBorders(owned, new Set([p])) : new Set();
    return S._playerThreat = { turn: S.turn, power, rank, share, score, active, border };
  }
  function coalitionCandidate(f) {
    const p = S.player, threat = playerThreat(), rules = difficultyRules().coalition, F = fac(f);
    if (!F?.alive || F.warWeary >= 70 || !threat.active || !threat.border.has(f) || S.T < rules.warDelay) return false;
    const r = getRel(f, p);
    if (r.war || r.ally || r.truce > 0 || r.op >= rules.opinion) return false;
    const others = Object.values(S.factions).filter(other => other.alive && !other.rebel && other.id !== f && other.id !== p);
    if (others.filter(other => atWar(f, other.id)).length >= 2) return false;
    const allies = others.filter(other => allied(f, other.id) && atWar(other.id, p));
    return totalPower(f) + allies.reduce((sum, other) => sum + totalPower(other.id), 0) >= threat.power * rules.ratio;
  }
  function coalitionTurn() {
    const record = S.flags.coalition;
    const members = [];
    for (const [f, entry] of Object.entries(record)) {
      if (entry.until > S.T + 1e-9) continue;
      if (!coalitionCandidate(f) || entry.until != null) delete record[f];
    }
    if (S.pending.some(p => p.ev === 'coalitionQuestion')) return;
    for (const f of playerThreat().border) {
      if (record[f] || !coalitionCandidate(f)) continue;
      record[f] = { asked: S.T };
      members.push(f);
      meet(S.player, f, true);
    }
    if (!members.length) return;
    const recent = S.flags.lastSortie;
    const justified = recent && recent.kind !== 'none' && S.T - recent.t <= 4;
    S.pending.push({ ev: 'coalitionQuestion', members, justified: !!justified, cost: 40 + 30 * members.length });
  }
  function answerCoalition(p, answer) {
    const members = p.members.filter(f => fac(f)?.alive && S.flags.coalition[f]);
    const F = fac(S.player);
    const gift = answer === 'gift' && F.gold >= p.cost;
    if (gift) F.gold -= p.cost;
    else if (answer === 'gift') log('国帑不足，厚礼未能遣出。', 'dip');
    const plus = gift ? 15 : answer === 'explain' && p.justified ? 8 : 0;
    for (const f of members) {
      const r = getRel(S.player, f), entry = S.flags.coalition[f];
      r.op = Math.min(100, r.op + plus);
      if (gift) entry.until = S.T + 8;
      else if (answer === 'ignore') entry.ready = true;
    }
  }
  function coalitionReady(f) {
    const { coalition, coalitionT } = S.flags, entry = coalition[f];
    if (!entry || entry.until != null || S.pending.some(p => p.ev === 'coalitionQuestion' && p.members.includes(f))) return false;
    if (coalitionT != null && Math.round(S.T * 90) - Math.round(coalitionT * 90) < 90) return false;
    return (entry.ready || Math.round(S.T * 90) - Math.round(entry.asked * 90) >= 180) && coalitionCandidate(f);
  }
  function coalitionWar(f) {
    if (!coalitionReady(f)) return false;
    S.flags.coalitionT = S.T;
    delete S.flags.coalition[f];
    declareWar(f, S.player);
    return true;
  }
  function conquestOpinion() {
    const loss = difficultyRules().coalition.dislike;
    for (const f in S.factions) if (f !== S.player && f !== 'rebel' && fac(f).alive) {
      const r = getRel(S.player, f);
      r.op = Math.max(-100, r.op - loss);
    }
  }
  function occupationPressure(c) {
    if (c.f !== S.player || !c.recentCapture || S.T - c.recentCapture.t >= difficultyRules().occupation.seasons) return 0;
    const governor = gen(c.governor), relief = c.reliefT != null && c.reliefT >= c.recentCapture.t && S.T - c.reliefT < 4;
    return (governor ? 0.65 : 1) * (relief ? 0.6 : 1);
  }

  // ---------- 领土 ----------
  function cityRadius(c) { return c.pop >= 14 ? 3 : 2; }
  function assignTerritory(full) {
    const N = GEO.W * GEO.H;
    const best = new Float32Array(N).fill(1e9);
    const owner = new Int32Array(N).fill(-1);
    for (const c of S.cities) {
      const R = cityRadius(c);
      for (const t of GEO.ring(c.tile, R)) {
        if (GEO.isWater(t)) continue;
        let d = GEO.dist(c.tile, t) - c.pop * 0.02;
        if (!full && S.tileCity[t] === c.id) d -= 0.6; // 粘性
        if (t === c.tile) d = -99;
        if (d < best[t]) { best[t] = d; owner[t] = c.id; }
      }
    }
    S.tileCity = owner;
    S._terrVer = (S._terrVer || 0) + 1;
  }
  function tileOwner(t) { const c = S.tileCity[t]; return c >= 0 ? S.cities[c].f : null; }
  function cityAt(t) { const c = S.tileCity[t]; if (c >= 0 && S.cities[c].tile === t) return S.cities[c]; return null; }
  function armyAt(t) { return S.armies.find(a => a.tile === t); }
  let ctCache = new Map(), ctVer = -1;
  function cityTiles(c) {
    if (ctVer !== S._terrVer) { ctCache = new Map(); ctVer = S._terrVer; }
    let out = ctCache.get(c.id);
    if (out) return out;
    out = [];
    for (const t of GEO.ring(c.tile, 3)) if (S.tileCity[t] === c.id) out.push(t);
    ctCache.set(c.id, out);
    return out;
  }

  // ---------- 城市产出 ----------
  function tileYield(t) {
    const tr = TERR[GEO.terrain[t]];
    let food = tr.food, prod = tr.prod, gold = tr.gold;
    if (GEO.river[t]) { food += 1; gold += 1; }
    const r = GEO.resource[t];
    if (r === '马' || r === '铁') prod += 1;
    else if (r === '茶' || r === '丝' || r === '瓷' || r === '香料') gold += 2;
    else if (r === '盐' || r === '毛皮') gold += 1;
    else if (r === '鱼') food += 2;
    return { food, prod, gold };
  }
  function hasTech(f, t) { return !!fac(f).techs[t]; }

  // ---------- 科技与建筑效果（数据驱动） ----------
  // 新条目在 DATA.TECHS[id].eff / DATA.BUILDINGS[id].eff 里写效果；旧条目没写 eff 时用下面的默认表。
  // 字段说明见 AGENTS.md「科技与建筑效果」。
  const LEGACY_TECH = {
    zhanchengdao: { foodPct: 0.1 }, nongshu: { foodPct: 0.1, growth: 0.2 }, mianfang: { goldPct: 0.1 },
    yinshua: { sciPct: 0.2 }, lixue: { sciPct: 0.1, happy: 5 }, chengfang: { wallPct: 0.5 },
    paoche: { siegePct: 0.5 }, huochong: { unit: { fire: 0.4 } }, shenbigong: { unit: { bow: 0.25 } },
    lianbing: { morale: 3 }, wujing: { unit: { all: 0.1 } }, kejugaige: { keju: 1 }, caoyun: { supply: 0.25 },
    yichuan: { landMP: 1 }, honglu: { diplo: 1 }, shuishi: { seaMP: 2, unit: { navy: 0.4 } },
    yuanyang: { tradePct: 0.5, tradeSlot: 1, tradeRange: true },
  };
  const LEGACY_BLD = {
    walls: { wall: 40 }, farm: { food: 3, riverFood: 2 }, granary: { food: 2, happy: 5, noFamine: true },
    market: { goldPct: 0.25 }, shibosi: { gold: 3, tradeSlot: 1 }, smithy: { prod: 3, iron: 1 },
    academy: { sci: 3, happy: 2, keju: 1 }, barracks: { recruitCost: 0.25 }, temple: { happy: 8 },
    dock: { dock: true }, stable: { horse: 2 }, workshop: { gold: 4, tradePct: 0.2 },
  };
  function techEff(id) { const t = DATA.TECHS[id]; return (t && t.eff) || LEGACY_TECH[id] || {}; }
  function bldEff(id) { const b = DATA.BUILDINGS[id]; return (b && b.eff) || LEGACY_BLD[id] || {}; }
  function mergeEff(out, e) {
    for (const k in e) {
      const v = e[k];
      if (typeof v === 'number') out[k] = (out[k] || 0) + v;
      else if (typeof v === 'boolean') out[k] = out[k] || v;
      else if (v && typeof v === 'object') { const o = out[k] || (out[k] = {}); for (const j in v) o[j] = (o[j] || 0) + v[j]; }
    }
    return out;
  }
  // 势力科技效果汇总（缓存在 F._fx，下划线字段不入存档）
  function techFx(f) {
    const F = fac(f); if (!F) return {};
    const ids = Object.keys(F.techs), key = ids.length;
    if (F._fx && F._fx.k === key) return F._fx.v;
    const v = {}; for (const id of ids) if (F.techs[id]) mergeEff(v, techEff(id));
    if (!v.unit) v.unit = {};
    F._fx = { k: key, v };
    return v;
  }
  // 城池建筑效果汇总（缓存在 c._bfx）
  function bldFx(c) {
    const bd = c.buildings, key = Object.keys(bd).filter(k => bd[k]).join(',');
    if (c._bfx && c._bfx.k === key) return c._bfx.v;
    const v = {}; for (const id in bd) if (bd[id]) mergeEff(v, bldEff(id));
    c._bfx = { k: key, v };
    return v;
  }
  function cityYield(c) {
    const f = c.f;
    const tiles = cityTiles(c).filter(t => t !== c.tile);
    if (c.port) for (const n of GEO.ring(c.tile, 1)) if (GEO.isWater(n)) tiles.push(n);
    const ys = tiles.map(t => tileYield(t)).sort((a, b) => (b.food * 1.3 + b.prod + b.gold * 0.9) - (a.food * 1.3 + a.prod + a.gold * 0.9));
    let food = 3, prod = 2, gold = 2, sci = 1 + c.pop * 0.25;
    const cy = tileYield(c.tile); food += cy.food; prod += cy.prod; gold += cy.gold;
    const n = Math.min(ys.length, c.pop + 1);
    for (let i = 0; i < n; i++) { food += ys[i].food; prod += ys[i].prod; gold += ys[i].gold; }
    gold += c.pop * 0.6;
    const bx = bldFx(c), tx = techFx(f);
    food += (bx.food || 0) + (bx.riverFood && GEO.river[c.tile] ? bx.riverFood : 0) + (bx.coastFood && c.port ? bx.coastFood : 0);
    prod += bx.prod || 0; gold += (bx.gold || 0) + (bx.coastGold && c.port ? bx.coastGold : 0); sci += bx.sci || 0;
    gold *= 1 + (bx.goldPct || 0);
    food *= 1 + (bx.foodPct || 0); prod *= 1 + (bx.prodPct || 0); sci *= 1 + (bx.sciPct || 0);
    let fm = 1 + (tx.foodPct || 0), pm = 1 + (tx.prodPct || 0), gm = 1 + (tx.goldPct || 0), sm = 1 + (tx.sciPct || 0);
    if (f === S.player && typeof COURT !== 'undefined' && S.court) { gm += COURT.bonus('zaixiang') * 0.7 + COURT.bonus('sansi') * 0.5; fm += COURT.bonus('sansi'); sm += COURT.bonus('hanlin') * 1.2; }
    const g = gen(c.governor);
    if (g) {
      let b = clamp((g.zheng - 45) / 110, 0, 0.45) * (hasSkill(g, '治世') ? 1.5 : 1);
      fm += b * 0.6; pm += b * 0.6; gm += b * 0.6;
      if (hasSkill(g, '理财')) gm += 0.3;
      if (hasSkill(g, '劝农')) fm += 0.3;
      if (hasSkill(g, '教化')) sci += 3;
      sci += g.zhi / 40;
    }
    const lm = clamp(0.45 + c.loyalty / 110, 0.5, 1.15);
    const trade = tradeIncome(c);
    const res = {
      food: Math.round(food * fm), prod: Math.round(prod * pm * lm), gold: Math.round(gold * gm * lm + trade), sci: Math.round(sci * sm * lm * 10) / 10, trade,
    };
    if (f !== S.player && f !== 'rebel') {
      const k = difficultyRules().aiYield;
      res.prod = Math.round(res.prod * k); res.gold = Math.round(res.gold * k);
    }
    const occupation = occupationPressure(c);
    if (occupation) {
      const multiplier = 1 - difficultyRules().occupation.production * occupation;
      res.food = Math.round(res.food * multiplier);
      res.prod = Math.round(res.prod * multiplier);
      res.gold = Math.round(res.gold * multiplier);
      res.sci = Math.round(res.sci * multiplier * 10) / 10;
    }
    res.foodNeed = Math.round(c.pop * 1.6);
    return res;
  }
  function loyaltyTarget(c) {
    const F = fac(c.f);
    let t = 58;
    t += (bldFx(c).happy || 0) + (techFx(c.f).happy || 0);
    const g = gen(c.governor);
    if (g) { t += (g.zheng - 50) / 8; if (hasSkill(g, '教化')) t += 10; }
    t += Math.min(10, luxuryCount(c.f) * 2);
    t -= Math.min(20, F.warWeary / 8);
    t -= c.unrest;
    if (c.pop > 12) t -= (c.pop - 12) * 1.2;
    if (F.food < 0) t -= 15;
    if (F.gold < 0) t -= 10;
    t += Math.min(3, c.garrison.length) * 2;
    if (c.cap) t += 10;
    if (c.culture !== F.culture) t -= 8;
    if (F.id === S.player && S.flags.morale) t += S.flags.morale;
    if (F.id === S.player && S.court && typeof COURT !== 'undefined') t += COURT.bonus('zaixiang') * 25 + (S.court.auth - 50) / 10;
    return clamp(Math.round(t), 0, 100);
  }
  const luxCache = {};
  function luxuryCount(f) {
    const ck = luxCache[f];
    if (ck && ck.t === S.turn && ck.v === S._terrVer) return ck.n;
    const n = luxuryCountRaw(f);
    luxCache[f] = { t: S.turn, v: S._terrVer, n };
    return n;
  }
  function luxuryCountRaw(f) {
    const set = new Set();
    for (const c of S.cities) if (c.f === f) for (const t of cityTiles(c)) { const r = GEO.resource[t]; if (r && r !== '马' && r !== '铁' && r !== '鱼') set.add(r); }
    return set.size;
  }
  function strategicIncome(f) {
    let horse = 0, iron = 0;
    for (const c of S.cities) if (c.f === f) {
      for (const t of cityTiles(c)) { const r = GEO.resource[t]; if (r === '马') horse += 0.5; if (r === '铁') iron += 0.5; if (GEO.terrain[t] === T.STEPPE) horse += 0.08; }
      const bx = bldFx(c); horse += bx.horse || 0; iron += bx.iron || 0;
    }
    horse += DATA.NOMAD[fac(f).culture] ? 2 : 1;
    { const tx = techFx(f); horse += tx.horse || 0; iron += tx.iron || 0; }
    if (f === 'song') horse += 2; // 茶马互市
    return { horse: Math.round(horse * 10) / 10, iron: Math.round(iron * 10) / 10 };
  }
  function growthTh(c) { return (10 + c.pop * 5) * (1 - Math.min(0.5, techFx(c.f).growth || 0)); }
  function garrisonCap(c) { return 4 + Math.floor(c.pop / 4) + (c.cap ? 2 : 0); }
  function maxWall(c) {
    let w = 10 + c.pop * 2;
    w += bldFx(c).wall || 0;
    if (c.f) w *= 1 + (techFx(c.f).wallPct || 0);
    if (c.cap) w += 15;
    if (c.cap && c.f === S.player && S.court && typeof COURT !== 'undefined') w *= 1 + COURT.bonus('dianqian') * 1.5;
    return Math.round(w);
  }

  // ---------- 海贸 ----------
  function tradeSlots(c) {
    const n = bldFx(c).tradeSlot || 0;
    return n ? n + (techFx(c.f).tradeSlot || 0) : 0;
  }
  function routeValue(a, b) {
    const d = GEO.dist(a.tile, b.tile);
    let v = 3 + d / 5 + b.pop / 2 + a.pop / 4;
    v *= 1 + (bldFx(a).tradePct || 0);
    v *= 1 + (techFx(a.f).tradePct || 0);
    return Math.round(v);
  }
  function tradeIncome(c) {
    let s = 0;
    for (const tid of c.trade) s += routeValue(c, city(tid));
    // 他国航线带来的收入
    if (c._inbound) s += Math.min(15, c._inbound);
    return s;
  }
  function canRoute(a, b) {
    if (!a.port || !b.port || a.f === b.f || atWar(a.f, b.f) || b.f === 'rebel') return false;
    if (!fac(a.f).met[b.f]) return false;
    if (a.trade.includes(b.id)) return false;
    if (!a.seas.some(s => b.seas.includes(s))) return false;
    if (!techFx(a.f).tradeRange && GEO.dist(a.tile, b.tile) > 48) return false;
    return true;
  }
  function routeTargets(a) { return S.cities.filter(b => canRoute(a, b)).sort((x, y) => routeValue(a, y) - routeValue(a, x)); }
  function openRoute(aid, bid) {
    const a = city(aid), b = city(bid);
    if (a.trade.length >= tradeSlots(a) || !canRoute(a, b)) return false;
    a.trade.push(bid);
    getRel(a.f, b.f).op += 5;
    if (a.f === S.player) log(`${a.name}市舶司开辟至【${fac(b.f).name}】${b.name}的海路。`, 'eco');
    if (b.f === S.player) log(`【${fac(a.f).name}】商船自${a.name}抵达${b.name}，互市开通。`, 'eco');
    return true;
  }
  function breakRoutesBetween(fa, fb) {
    for (const c of S.cities) {
      if (c.f !== fa && c.f !== fb) continue;
      c.trade = c.trade.filter(t => { const o = city(t).f; return !((c.f === fa && o === fb) || (c.f === fb && o === fa)); });
    }
  }
  function computeInbound() {
    for (const c of S.cities) c._inbound = 0;
    for (const c of S.cities) for (const t of c.trade) { const b = city(t); b._inbound += Math.round(routeValue(c, b) * 0.5); }
  }

  // ---------- 生产 ----------
  function buildOptions(c) {
    const out = [];
    for (const id in B) {
      const b = B[id];
      if (c.buildings[id]) continue;
      if (b.tech && !hasTech(c.f, b.tech)) continue;
      if (b.coastal && !c.port) continue;
      if (b.river && !GEO.river[c.tile]) continue;
      if (b.minPop && c.pop < b.minPop) continue;
      if (b.needB && ![].concat(b.needB).every(x => c.buildings[x])) continue;
      if (b.only && ![].concat(b.only).includes(c.f)) continue;
      if (b.capital && !c.cap) continue;
      if (c.queue.some(q => q.kind === 'b' && q.id === id)) continue;
      out.push(id);
    }
    return out;
  }
  function unitOptions(c) {
    const out = [];
    const F = fac(c.f);
    for (const id in U) {
      const u = U[id];
      if (u.tech && !hasTech(c.f, u.tech)) continue;
      if (id === 'elite' && c.f !== 'song') continue;
      if (u.nomad && !DATA.NOMAD[F.culture]) continue;
      if (u.needDock && !bldFx(c).dock) continue;
      out.push(id);
    }
    return out;
  }
  function unitCost(c, id) {
    const u = U[id];
    let prod = u.prod;
    { const rc = Math.min(0.6, bldFx(c).recruitCost || 0); if (rc) prod = Math.round(prod * (1 - rc)); }
    if (c.f === S.player && typeof COURT !== 'undefined' && S.court) prod = Math.round(prod * (1 - COURT.bonus('shumi')));
    return { prod, gold: u.gold, man: u.man, horse: u.horse || 0, iron: u.iron || 0 };
  }
  function canAffordUnit(c, id) {
    const F = fac(c.f), k = unitCost(c, id);
    return F.gold >= k.gold && F.man >= k.man && F.horse >= k.horse && F.iron >= k.iron && c.pop >= 2;
  }
  function queueUnit(cid, id) {
    const c = city(cid), F = fac(c.f);
    if (!canAffordUnit(c, id)) return false;
    const k = unitCost(c, id);
    F.gold -= k.gold; F.man -= k.man; F.horse -= k.horse; F.iron -= k.iron;
    c.queue.push({ kind: 'u', id, prog: 0, cost: k.prod });
    return true;
  }
  function queueBuilding(cid, id) {
    const c = city(cid);
    if (!buildOptions(c).includes(id)) return false;
    c.queue.push({ kind: 'b', id, prog: 0, cost: B[id].prod });
    return true;
  }
  function dequeue(cid, k) {
    const c = city(cid), q = c.queue[k];
    if (!q) return;
    if (q.kind === 'u') { const F = fac(c.f), uc = unitCost(c, q.id); F.gold += uc.gold; F.man += uc.man; F.horse += uc.horse; F.iron += uc.iron; }
    c.queue.splice(k, 1);
  }
  // ---------- 用钱之道：捐资助学、赈济、犒军、移民实边 ----------
  // 冷却以 S.T（季）计，与时间单位无关
  const DONATE_RATE = 5; // 每 5 贯折 1 分文教
  function donateInfo(f) {
    const F = fac(f);
    const cap = Math.max(10, Math.round(((F.income && F.income.sci) || 0) * 0.5)); // 每季可捐上限 = 半季文教
    const used = F.don && F.don.y === S.year && F.don.s === S.season ? F.don.v : 0;
    const left = Math.max(0, cap - used);
    return { rate: DONATE_RATE, cap, left, cost: left * DONATE_RATE };
  }
  function donate(f, sci) {
    const F = fac(f), d = donateInfo(f);
    sci = Math.min(Math.floor(sci), d.left, Math.floor(Math.max(0, F.gold) / DONATE_RATE));
    if (sci <= 0) return 0;
    F.gold -= sci * DONATE_RATE; F.sci += sci;
    F.don = { y: S.year, s: S.season, v: d.cap - d.left + sci };
    if (f === S.player) log(`捐资助学 ${sci * DONATE_RATE} 贯，文教 +${sci}。`, 'sci');
    return sci;
  }
  function reliefCost(c) { return Math.round(30 + c.pop * 12); }
  function reliefReady(c) { return !(c.reliefT != null && S.T - c.reliefT < 4); }
  function relief(cid) {
    const c = city(cid), F = fac(c.f), k = reliefCost(c);
    if (!reliefReady(c) || F.gold < k) return false;
    F.gold -= k; c.loyalty = Math.min(100, c.loyalty + 15); c.unrest = Math.max(0, c.unrest - 15); c.reliefT = S.T;
    if (c.f === S.player) log(`开仓赈济${c.name}，耗钱 ${k} 贯，民心大悦。`, 'eco', c.tile);
    return true;
  }
  function rewardCost(a) { return 20 + a.units.length * 12; }
  function rewardReady(a) { return !(a.rewT != null && S.T - a.rewT < 2); }
  function rewardArmy(aid) {
    const a = army(aid); if (!a) return false;
    const F = fac(a.f), k = rewardCost(a);
    if (!rewardReady(a) || F.gold < k) return false;
    F.gold -= k; a.morale = Math.min(100, a.morale + 30); a.rewT = S.T;
    if (a.gen != null) gainExp(a.gen, 15);
    if (a.f === S.player) log(`犒赏${armyName(a)}，耗钱 ${k} 贯，将士欢跃。`, 'mil', a.tile);
    return true;
  }
  function migrateCost(c) { return 120 + c.pop * 30; }
  function migrateOk(c) { return c.pop < 12 && !c.cap && !(c.migT != null && S.T - c.migT < 8); }
  function migrate(cid) {
    const c = city(cid), F = fac(c.f), k = migrateCost(c);
    if (!migrateOk(c) || F.gold < k) return false;
    F.gold -= k; c.pop++; c.store = 0; c.loyalty = Math.max(0, c.loyalty - 3); c.migT = S.T;
    if (c.f === S.player) log(`募民实${c.name}，耗钱 ${k} 贯，户口增至 ${c.pop} 万。`, 'eco', c.tile);
    return true;
  }
  function hurryCost(c) { const q = c.queue[0]; if (!q) return 0; return Math.max(0, Math.ceil((q.cost - q.prog) * 2.2)); }
  function hurry(cid) {
    const c = city(cid), F = fac(c.f), k = hurryCost(c);
    if (!c.queue[0] || F.gold < k) return false;
    F.gold -= k; c.queue[0].prog = c.queue[0].cost; return true;
  }

  // ---------- 军队 ----------
  const FORT_BONUS = 1.10;
  function fortified(a, time = S.T) {
    // 存档按两位小数记录季数，容许一整回合的时间差因取整而略短。
    return !!(a && a.sentry && a.fortT != null && time - a.fortT >= E() - 0.01);
  }
  function setSentry(a) {
    a.sentry = true;
    a.fortT ??= S.T;
    a.path = [];
    a.prog = 0; a.progTo = null; a.progFrac = 0;
  }
  function clearSentry(a) { a.sentry = false; a.fortT = null; }
  function createArmyRaw(f, tile, units, genId, name) {
    const a = { id: S.nextArmy++, f, tile, units, gen: genId, morale: 75, path: [], mp: 0, name: name || '', sentry: false, fortT: null, expeditionWarned: false };
    S.armies.push(a);
    if (genId != null) { const g = gen(genId); g.status = 'army'; g.loc = a.id; }
    a.mp = armyMP(a);
    rec({ k: 'new', id: a.id, f, tile, gen: genId, n: units.length, str: sumStr(units) });
    return a;
  }
  function armyCap(a) { const g = gen(a.gen); return Math.min(10, g ? 4 + Math.floor(g.tong / 20) : 4); }
  function capFor(genId) { const g = gen(genId); return Math.min(10, g ? 4 + Math.floor(g.tong / 20) : 4); }
  function armyName(a) {
    if (a.name) return a.name;
    const g = gen(a.gen);
    return g ? g.name + '部' : '偏师';
  }
  function canSail(a) {
    const nav = a.units.filter(u => u.t === 'navy').length;
    return nav > 0 && nav * 3 >= a.units.length - nav;
  }
  function armyMP(a, onWater) {
    let mv = 99;
    for (const u of a.units) if (u.t !== 'navy') mv = Math.min(mv, U[u.t].mv);
    if (mv === 99) mv = 6;
    mv += techFx(a.f).landMP || 0;
    const g = gen(a.gen);
    if (g) { if (hasSkill(g, '疾行')) mv += 2; if (hasSkill(g, '运筹') || hasSkill(g, '大汗')) mv += 1; mv += itemSum(g, 'mv'); }
    return mv * mpFactor();
  }
  function seaMP(a) { return 6 + (techFx(a.f).seaMP || 0); }
  function canEnter(f, t, a) {
    if (GEO.isWater(t)) return a ? canSail(a) && GEO.terrain[t] === T.SEA : false;
    const o = tileOwner(t);
    if (!o || o === f || atWar(f, o) || allied(f, o)) return true;
    return false;
  }
  function moveCost(a, from, to) {
    if (GEO.isWater(to)) return 6 / seaMP(a);
    let c = TERR[GEO.terrain[to]].move;
    if (GEO.isWater(from)) c = Math.max(c, 2); // 登陆
    return c;
  }
  function marchFoe(f, tile, occupant) {
    if (occupant && occupant.f !== f) return occupant.f;
    const c = cityAt(tile);
    return c && c.f !== f && !allied(f, c.f) ? c.f : null;
  }
  // 友军连占的各格必须作为一段走完，最后一格须能直接落脚。
  function routeStep(a, from, route, start = 0) {
    const f = a.f;
    let cost = 0, passing = false;
    for (let i = start; i < route.length; i++) {
      const to = route[i], o = armyAt(to);
      const valid = GEO.NBR[from]?.includes(to);
      const foe = valid && marchFoe(f, to, o);
      if (foe && !passing && atWar(f, foe)) return { kind: 'attack', to, foe };
      if (!valid || foe || !canEnter(f, to, a)) return { kind: passing ? 'wait' : 'blocked' };
      cost += moveCost(a, from, to);
      if (!o || o === a) return { kind: passing ? 'pass' : 'move', to, end: i, cost };
      passing = true;
      from = to;
    }
    return { kind: 'wait' };
  }
  // A* 寻路；目标可为敌方单位/城市所在格
  function findPath(a, goal, maxIter) {
    if (a.tile === goal) return [];
    maxIter = maxIter || 6000;
    const f = a.f;
    const occ = new Set(), friendly = new Set();
    let target = null;
    for (const o of S.armies) {
      if (o.tile === goal) target = o;
      (o.f === f ? friendly : occ).add(o.tile);
    }
    if (target && (target.f === f || !atWar(f, target.f))) return null;
    // 本次搜索内军队、邦交与地形均不变。仍用行军入口的规则求值，随后复用结果。
    const passage = new Map(), stepCosts = [[], []];
    const terrain = GEO.terrain;
    function passable(n, tt) {
      const key = tt === T.SEA || tt === T.LAKE ? tt : tileOwner(n);
      let allowed = passage.get(key);
      if (allowed === undefined) { allowed = canEnter(f, n, a); passage.set(key, allowed); }
      return allowed;
    }
    // 从空格展开。优先选择足以走完的穿营段，只有窄路时也可先定路线，待前军挪开再走。
    const maxMarch = Math.max(a.mp, armyMP(a));
    const gS = new Map(), came = new Map();
    // 二叉堆
    const hk = [], hv = [];
    const push = (k, v) => { hk.push(k); hv.push(v); let i = hk.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (hv[p] <= hv[i]) break; [hk[p], hk[i]] = [hk[i], hk[p]]; [hv[p], hv[i]] = [hv[i], hv[p]]; i = p; } };
    const pop = () => { const k = hk[0]; const lk = hk.pop(), lv = hv.pop(); if (hk.length) { hk[0] = lk; hv[0] = lv; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < hk.length && hv[l] < hv[m]) m = l; if (r < hk.length && hv[r] < hv[m]) m = r; if (m === i) break; [hk[m], hk[i]] = [hk[i], hk[m]]; [hv[m], hv[i]] = [hv[i], hv[m]]; i = m; } } return k; };
    gS.set(a.tile, 0); push(a.tile, GEO.dist(a.tile, goal));
    const closed = new Set();
    let it = 0;
    while (hk.length && it++ < maxIter) {
      const cur = pop();
      if (closed.has(cur)) continue;
      if (cur === goal) {
        const parts = [];
        let t = cur;
        while (came.has(t)) {
          const step = came.get(t);
          parts.push(step.tiles);
          t = step.from;
        }
        return parts.reverse().flat();
      }
      closed.add(cur);
      const gc = gS.get(cur);
      const offer = (n, stepCost, via) => {
        const ng = gc + stepCost;
        const old = gS.get(n);
        if (old === undefined || ng < old) {
          gS.set(n, ng);
          came.set(n, { from: cur, tiles: [...via, n] });
          push(n, ng + GEO.dist(n, goal));
        }
      };
      let bestPass = null;
      const branch = (from, used, via) => {
        const costs = stepCosts[GEO.isWater(from) ? 1 : 0];
        for (const n of GEO.NBR[from]) {
          const tt = terrain[n];
          if (closed.has(n) || !passable(n, tt)) continue;
          const passing = via.length > 0;
          if (occ.has(n) && (n !== goal || passing)) continue;
          const foe = marchFoe(f, n, n === goal ? target : null);
          if (foe && (n !== goal || passing || !atWar(f, foe))) continue;
          const nextCost = used + (costs[tt] ??= moveCost(a, from, n));
          const occupied = friendly.has(n);
          if (occupied) {
            bestPass ||= new Map();
            if (nextCost >= (bestPass.get(n) ?? Infinity)) continue;
            bestPass.set(n, nextCost);
            branch(n, nextCost, [...via, n]);
          } else {
            const wait = passing && nextCost > maxMarch + 1e-9 ? GEO.NBR.length : 0;
            // 等长时优先空地，以免队列变动后耽搁行军。
            offer(n, nextCost + wait + via.length * 0.001, via);
          }
        }
      };
      branch(cur, 0, []);
    }
    return null;
  }
  // 沿路径行进；遇敌即战。返回事件列表
  function advance(a, allowAttack) {
    const out = [];
    const origin = a.tile;
    if (a.path && a.path.length && a.sentry) clearSentry(a);
    while (a.path && a.path.length && a.mp > 0) {
      const step = routeStep(a, a.tile, a.path);
      if (step.kind === 'wait') {
        a.prog = 0; a.progTo = null; a.progFrac = 0;
        break;
      }
      if (step.kind === 'blocked') { a.path = []; break; }
      const next = step.to;
      if (step.kind === 'attack') {
        if (allowAttack && !allowAttack(next, step.foe)) break;
        a.path = [];
        if (a.f === S.player && hooks.engage) { out.push({ engage: true, aid: a.id, tile: next }); break; }
        if (deferDefense(a, next, step.foe)) break;
        out.push(attack(a, next));
        break;
      }
      if (step.kind === 'pass') {
        a.prog = 0; a.progTo = null; a.progFrac = 0;
        if (a.mp + 1e-9 < step.cost) break;
        const path = a.path.splice(0, step.end + 1);
        let from = a.tile;
        // 先落在已验证的空格，途经友军时只记录移动，不让两军同时占格。
        a.tile = next;
        a.mp = Math.max(0, a.mp - step.cost);
        for (const to of path) {
          rec({ k: 'mv', id: a.id, f: a.f, from, to });
          const st = siteAt(to); if (st) visitSite(a, st);
          if (a.f === S.player) revealAround(to, armySight(a));
          from = to;
        }
        if (GEO.isWater(a.tile) && !canSail(a)) { a.path = []; break; }
        continue;
      }
      const cost = step.cost;
      if (a.progTo !== next) { a.prog = 0; a.progTo = next; }
      const need = cost - a.prog;
      if (a.mp + 1e-9 < need) { // 行军力不足：在途推进，下回合继续
        const f0 = a.prog / cost;
        a.prog += a.mp; a.mp = 0; a.progFrac = a.prog / cost;
        rec({ k: 'mvp', id: a.id, f: a.f, from: a.tile, to: next, f0, f1: a.progFrac });
        break;
      }
      a.mp -= need; a.prog = 0; a.progTo = null; a.progFrac = 0;
      rec({ k: 'mv', id: a.id, f: a.f, from: a.tile, to: next });
      a.tile = next;
      const st = siteAt(next); if (st) visitSite(a, st);
      a.path.shift();
      if (a.f === S.player) revealAround(a.tile, armySight(a));
      if (GEO.isWater(a.tile) && !canSail(a)) { a.path = []; break; }
    }
    if (a.f === S.player && a.tile !== origin && S.armies.includes(a)) warnExpedition(a, expeditionRate(a));
    return out;
  }
  function moveArmyTo(aid, goal) {
    const a = army(aid);
    if (!a) return { ok: false };
    const p = findPath(a, goal);
    if (!p) return { ok: false, msg: '无路可达' };
    a.path = p;
    const res = advance(a);
    emit('change');
    return { ok: true, battles: res };
  }

  // ---------- 战斗 ----------
  const TC = DATA.TERRAIN_COMBAT;
  const terrainUnits = Object.fromEntries(Object.entries(TC.byTerrain).map(([key, row]) => [T[key], row]));
  const heights = new Set(TC.highGround.from.map(key => T[key]));
  const lowlands = new Set(TC.highGround.to.map(key => T[key]));
  function battleTerrain(origin, tile, city) {
    const tt = GEO.terrain[tile], water = GEO.isWater(tile), river = !!GEO.river[tile];
    return { tt, city, water, river, rough: tt === T.HILL || tt === T.MTN || tt === T.FOREST || tt === T.PLATEAU,
      downhill: heights.has(GEO.terrain[origin]) && lowlands.has(tt),
      crossing: river && !GEO.river[origin], landing: !water && GEO.isWater(origin) };
  }
  function unitTerrainMult(type, role, ctx) {
    const row = terrainUnits[ctx.tt], group = TC.groups[type];
    if (!row || (ctx.city && group === 'siege')) return 1;
    if (group === 'bow' && role === 'def' && row.defBow) return row.defBow;
    return row[group] || 1;
  }
  function navyLandMult(ctx) { return ctx.river ? TC.water.riverNavy : TC.water.landNavy; }
  function landingMult(g) { return hasSkill(g, '水战') ? TC.landing.mult + (1 - TC.landing.mult) * TC.landing.skillRelief : TC.landing.mult; }
  // 临阵反击可更换攻防属性，但地形所认的攻守两军从开战至终局不变。
  function terrainPower(type, statRole, role, ctx, g) {
    const unit = U[type];
    let base = statRole === 'att' ? unit.atk : unit.def;
    if (ctx.water) base = type === 'navy' ? unit.sea : base * TC.water.embarked;
    else if (type === 'navy') base *= navyLandMult(ctx);
    if (role === 'att') {
      if (ctx.downhill) base *= TC.highGround.mult;
      if (ctx.crossing) base *= TC.crossing.att;
      if (ctx.landing && type !== 'navy') base *= landingMult(g);
    }
    return base * unitTerrainMult(type, role, ctx);
  }
  // 原临河守势与本格守势相加；兵种适应和将领特技另乘。
  function terrainDefense(ctx, noTerrain) {
    return noTerrain ? 1 : (ctx.crossing ? TC.crossing.def : 1) + TERR[ctx.tt].def;
  }
  const terrainGroupName = { cav: '骑兵', inf: '步卒', bow: '弓弩', fire: '火器', siege: '砲车', navy: '舟师' };
  const terrainAction = { [T.PLAIN]: '驰平原', [T.STEPPE]: '驰草原', [T.HILL]: '据丘陵', [T.MTN]: '入山',
    [T.FOREST]: '入林', [T.JUNGLE]: '入雨林', [T.PLATEAU]: '上高原' };
  function battleTerrainRows(B, M = {}) {
    const ctx = B.ctx, rows = [];
    const add = (role, label, mult) => rows.push({ role, label, mult });
    for (const [role, side] of [['att', B.A], ['def', B.D]]) {
      const groups = new Set(side.units.filter(u => u.s > 0).map(u => TC.groups[u.t]));
      if (!groups.size) continue;
      const g = gen(side.gen), hasLand = [...groups].some(t => t !== 'navy');
      for (const group of groups) {
        const mult = unitTerrainMult(group, role, ctx);
        if (mult !== 1) add(role, terrainGroupName[group] + terrainAction[ctx.tt], mult);
      }
      if (groups.has('navy') && !ctx.water) add(role, ctx.river ? '舟师入河' : '舟师陆战', navyLandMult(ctx));
      if (hasLand && ctx.water) add(role, '陆军舟上交锋', TC.water.embarked);
      if (role === 'att') {
        if (ctx.downhill) add(role, '居高临下', TC.highGround.mult);
        if (ctx.crossing) add(role, '渡河强攻', TC.crossing.att);
        if (ctx.landing && hasLand) add(role, hasSkill(g, '水战') ? '陆军登岸（水战减损）' : '陆军登岸', landingMult(g));
      } else {
        if (!M.noTerrain && TERR[ctx.tt].def) add(role, TERR[ctx.tt].name + '守势', 1 + TERR[ctx.tt].def);
        if (!M.noTerrain && ctx.crossing) add(role, '据河待渡', TC.crossing.def);
        if (ctx.rough && hasSkill(g, '守险')) add(role, '主将守险', TC.skills.roughDefense);
      }
      if ((ctx.river || ctx.water) && hasSkill(g, '水战')) add(role, '主将水战', TC.skills.waterBattle);
    }
    return rows;
  }
  function tileTerrainRows(tile) {
    const ctx = battleTerrain(tile, tile, !!cityAt(tile)), tt = ctx.tt, rows = [];
    const add = (role, label, mult) => rows.push({ role, label, mult });
    if (TERR[tt].def) add('def', TERR[tt].name + '守势', 1 + TERR[tt].def);
    for (const [key, mult] of Object.entries(terrainUnits[tt] || {})) {
      if (key === 'siege' && ctx.city) continue;
      const group = key === 'defBow' ? 'bow' : key;
      add(key === 'defBow' ? 'def' : 'both', terrainGroupName[group] + terrainAction[tt] + (key === 'siege' ? '野战' : ''), mult);
    }
    if (heights.has(tt)) add('att', '自此下攻平原、草原或沙漠', TC.highGround.mult);
    if (lowlands.has(tt)) add('att', '自丘陵或山地下攻此地', TC.highGround.mult);
    if (ctx.river) {
      add('att', '自无河格渡河强攻', TC.crossing.att);
      add('def', '敌自无河格来，据河待渡', TC.crossing.def);
    }
    if (ctx.water) add('both', '陆军舟上交锋', TC.water.embarked);
    else add('both', ctx.river ? '舟师入河' : '舟师陆战', navyLandMult(ctx));
    if (ctx.water || GEO.NBR[tile].some(GEO.isWater)) add('att', '陆军自水面登岸（水战减损一半）', TC.landing.mult);
    return rows;
  }
  function skillMult(g, u, ctx, role, terrainRole = role) {
    if (!g) return 1;
    let m = 1;
    const H = x => hasSkill(g, x);
    if (H('撼山')) m *= 1.2;
    if (H('大汗')) m *= 1.25;
    if (H('骁勇') && role === 'att') m *= 1.15;
    if (H('坚守') && role === 'def' && ctx.city) m *= 1.35;
    if (H('守险') && terrainRole === 'def' && ctx.rough) m *= TC.skills.roughDefense;
    if (H('攻城') && role === 'att' && ctx.city) m *= 1.4;
    if (H('水战') && (ctx.water || ctx.river)) m *= TC.skills.waterBattle;
    if (H('铁骑') && ['cav', 'hcav', 'hbow', 'elite'].includes(u.t)) m *= 1.25;
    if (H('神射') && ['bow', 'hbow'].includes(u.t)) m *= 1.3;
    return m;
  }
  function sidePower(side, enemy, role, ctx) {
    const counts = {}; let tot = 0;
    for (const u of enemy.units) { counts[u.t] = (counts[u.t] || 0) + u.s; tot += u.s; }
    let p = 0, siegeP = 0;
    const f = side.f, g = gen(side.gen), tech = techFx(f);
    // 一侧同种各营的敌情、地势与主将均相同，兵力仍逐营按原顺序结算。
    const perUnit = {};
    for (const u of side.units) {
      if (perUnit[u.t] === undefined) {
        let m = 1;
        if (tot > 0) {
          for (const e of DATA.BEATS[u.t] || []) if (counts[e]) m += 0.4 * counts[e] / tot;
          for (const et in counts) if ((DATA.BEATS[et] || []).includes(u.t)) m -= 0.3 * counts[et] / tot;
        }
        m *= (1 + (tech.unit[u.t] || 0)) * (1 + (tech.unit.all || 0));
        if (u.t === 'bow' && g) m *= 1 + itemSum(g, 'bow');
        m *= skillMult(g, u, ctx, role);
        perUnit[u.t] = terrainPower(u.t, role, role, ctx, g) * m;
      }
      let v = perUnit[u.t] * u.s / 100;
      if (u.t === 'siege' && role === 'att' && ctx.city) { const sv = v * U.siege.siege * (1 + (tech.siegePct || 0)); siegeP += sv; v = sv * 0.5; }
      p += v;
    }
    if (g) {
      if (role === 'att') p *= 1 + (g.wu - 50) / 180 + (g.tong - 50) / 300;
      else p *= 1 + (g.tong - 50) / 180 + (g.zhi - 50) / 300;
    } else p *= 0.9;
    if (g && role === 'def') p *= 1 + itemSum(g, 'armor');
    p *= 0.55 + 0.45 * clamp(side.morale, 0, 100) / 100;
    if (f !== S.player && f !== 'rebel') p *= difficultyRules().aiBattle;
    return { p, siegeP };
  }
  // 双方战力（不含随机、不修改状态）
  function battleSides(a, tile, M, originTile = a.tile) {
    const defArmy = armyAt(tile);
    const c = cityAt(tile);
    const ctx = battleTerrain(originTile, tile, !!(c && c.f !== a.f));
    const defF = defArmy ? defArmy.f : c.f;
    const D = { f: defF, units: [], gen: null, morale: 70 };
    if (defArmy) { D.units.push(...defArmy.units); D.gen = defArmy.gen; D.morale = defArmy.morale; }
    if (c && c.f === defF) { D.units.push(...c.garrison); if (D.gen == null) D.gen = c.governor; }
    const A = { f: a.f, units: a.units, gen: a.gen, morale: a.morale };
    const fortMult = fortified(defArmy) ? FORT_BONUS : 1;
    return { defArmy, c, water: ctx.water, tt: ctx.tt, ctx, defF, D, A, fortMult };
  }
  function battlePowers(B, M, wall = B.c?.wall) {
    M = M || {};
    const { A, D, ctx, c, defF } = B;
    const A2 = Object.assign({}, A, { morale: clamp(A.morale + (M.aMorale || 0), 5, 100) });
    const D2 = Object.assign({}, D, { morale: clamp(D.morale + (M.dMorale || 0), 5, 100) });
    const pa = sidePower(A2, D, 'att', ctx);
    const pd = sidePower(D2, A, 'def', ctx);
    let Pd = pd.p * terrainDefense(ctx, M.noTerrain);
    if (c && c.f === defF && !M.noWall) Pd = Pd * 1.2 + wall * 0.6 + 4;
    else if (c && c.f === defF) Pd += 4;
    let Pa = pa.p;
    Pa *= M.aMult || 1; Pd *= (M.dMult || 1) * B.fortMult;
    return { pa, pd, Pa, Pd };
  }
  // 自动战双方战力各乘一个独立的均匀扰动
  const NOISE = [0.85, 1.15];
  function winChance(r) {
    const k = r / Math.max(1e-6, 1 - r), [lo, hi] = NOISE, n = 48;
    let p = 0;
    for (let i = 0; i < n; i++) { const u = lo + (hi - lo) * (i + 0.5) / n; p += clamp((k * u - lo) / (hi - lo), 0, 1); }
    return p / n;
  }
  function previewBattle(a, tile, M, originTile = a.tile) {
    M = M || {};
    const B = battleSides(a, tile, M, originTile);
    const sd = M.preD ? 1 - M.preD : 1, sa = M.preA ? 1 - M.preA : 1;
    const c = B.c;
    const wall = c && M.wallHit ? Math.max(0, c.wall - Math.round(maxWall(c) * M.wallHit)) : c?.wall;
    let { Pa, Pd } = battlePowers(B, M, wall);
    Pa *= sa; Pd *= sd;
    const r = Pa / (Pa + Pd + 0.001);
    const ls = { 7: 0.7, 10: 0.8 }[S.scale] || 1;
    return { r, Pa, Pd, lossA: (0.08 + 0.55 * (1 - r) * (1 - r)) * ls + (M.preA || 0), lossD: (0.08 + 0.55 * r * r) * ls + (M.preD || 0), aStr: sumStr(B.A.units), dStr: sumStr(B.D.units), B };
  }
  function attack(a, tile, opts) {
    opts = opts || {};
    if (a.sentry) clearSentry(a);
    const M = opts.mods || {};
    const B = battleSides(a, tile, M);
    const { defArmy, c, tt, defF, D, A } = B;
    meet(a.f, defF);
    if (a.f !== 'rebel' && defF !== 'rebel' && defF !== a.f) (getRel(a.f, defF).struckBy ||= {})[a.f] = S.T;
    const before = opts.manual ? opts.manual.before : { a: sumStr(A.units), d: sumStr(D.units), wall: c ? c.wall : 0 };
    const fullWall = a.f === S.player && c?.f === defF && before.wall >= maxWall(c) - 0.01;
    const apply = (units, loss) => { for (const u of units) u.s = Math.round(u.s * (1 - clamp(loss * rnd(0.75, 1.25), 0, 0.95))); };
    let r, wallLoss = 0;
    if (M.aMorale) a.morale = clamp(a.morale + M.aMorale, 5, 100);
    if (M.dMorale && defArmy) defArmy.morale = clamp(defArmy.morale + M.dMorale, 5, 100);
    if (M.preA) apply(A.units, M.preA);
    if (M.preD) apply(D.units, M.preD);
    if (M.wallHit && c && c.f === defF) c.wall = Math.max(0, c.wall - Math.round(maxWall(c) * M.wallHit));
    if (opts.manual) {
      r = opts.manual.r;
      if (c && c.f === defF && opts.manual.wall != null) { wallLoss = Math.max(0, Math.round(c.wall - opts.manual.wall)); c.wall = Math.max(0, opts.manual.wall); }
    } else {
      const { pa, Pa: Pa0, Pd: Pd0 } = battlePowers(B, M);
      const Pa = Pa0 * rnd(NOISE[0], NOISE[1]), Pd = Pd0 * rnd(NOISE[0], NOISE[1]);
      r = Pa / (Pa + Pd + 0.001);
      const ls = { 7: 0.7, 10: 0.8 }[S.scale] || 1;
      const lossD = (0.08 + 0.55 * r * r) * ls, lossA = (0.08 + 0.55 * (1 - r) * (1 - r)) * ls;
      apply(A.units, lossA);
      apply(D.units, lossD);
      if (c && c.f === defF) { wallLoss = Math.round(pa.siegeP * 0.6 + Pa * 0.08 * r); c.wall = Math.max(0, c.wall - wallLoss); }
    }
    // 清除残兵
    const prune = arr => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i].s < 10) arr.splice(i, 1); };
    prune(a.units);
    if (defArmy) prune(defArmy.units);
    if (c) prune(c.garrison);
    const attWin = r > 0.5;
    const bt = rec({ k: 'bt', aid: a.id, af: a.f, from: a.tile, tile, did: defArmy ? defArmy.id : null, df: defF, city: c ? c.id : null });
    const defTile0 = defArmy ? defArmy.tile : -1;
    const rep = {
      tile, att: a.f, def: defF, attName: armyName(a), attGen: a.gen, defGen: D.gen, defName: defArmy ? armyName(defArmy) : (c ? c.name + '守军' : ''),
      city: c ? c.name : null, before, after: { a: sumStr(a.units), d: sumStr(D.units.filter(u => u.s >= 10)), wall: c ? c.wall : 0 }, ratio: r, result: '', captured: null, wallLoss,
    };
    a.mp = 0;
    const F_a = fac(a.f), F_d = fac(defF);
    addWarScore(a.f, defF, attWin ? 2 : -2);
    if (attWin) { a.morale = Math.min(100, a.morale + 8); bumpExp(a.gen, true); }
    const xk = S.scale < 30 ? 0.8 : 1.2;
    gainExp(a.gen, Math.round((attWin ? 12 + (before.d - sumStr(D.units.filter(u => u.s >= 10))) / 150 : 6) * xk));
    if (D.gen != null) gainExp(D.gen, Math.round((attWin ? 6 : 12 + (before.a - sumStr(a.units)) / 150) * xk));
    else { a.morale = Math.max(5, a.morale - 15); }
    // 处理守方野战军
    if (defArmy) {
      if (!attWin) defArmy.morale = Math.min(100, defArmy.morale + 8), bumpExp(defArmy.gen, true);
      else defArmy.morale = Math.max(5, defArmy.morale - 20);
      if (defArmy.units.length === 0) { rep.result = '守军全军覆没'; destroyArmy(defArmy, a.f, rep); }
      else if (attWin && !c) {
        const back = retreatTile(defArmy, a.tile);
        if (back >= 0 && r < 0.8) { defArmy.tile = back; defArmy.path = []; clearSentry(defArmy); rep.result = '敌军败退'; }
        else { rep.result = '敌军溃散'; destroyArmy(defArmy, a.f, rep); }
      }
    }
    if (a.units.length === 0) { rep.result = (rep.result ? rep.result + '；' : '') + '我军攻势受挫，全军覆没'; destroyArmy(a, defF, rep); }
    // 攻城
    if (c && c.f === defF && a.units.length) {
      const stillDef = (armyAt(tile) && armyAt(tile).f === defF) || c.garrison.length > 0;
      if (!stillDef && (c.wall <= maxWall(c) * 0.4 || r > 0.65)) {
        rep.result = '城破';
        rep.captured = c.name;
        captureCity(c, a.f, a);
        a.tile = tile;
      } else if (!stillDef) rep.result = '守军尽没，城墙尚坚';
      else rep.result = rep.result || (attWin ? '攻城小胜' : '攻城不利');
    }
    if (!rep.result) rep.result = attWin ? '获胜' : '失利';
    rep.win = attWin;
    if (opts.plan) rep.plan = opts.plan;
    if (opts.manual) rep.manual = true;
    if (a.f === S.player || defF === S.player) {
      rep.fullWall = fullWall;
      rep.enemyArmyEliminated = a.f === S.player ? !!defArmy && !S.armies.includes(defArmy) : !S.armies.includes(a);
    }
    Object.assign(bt, {
      win: attWin, result: rep.result, lossA: before.a - rep.after.a, lossD: before.d - rep.after.d,
      aStr: S.armies.includes(a) ? sumStr(a.units) : 0, aN: a.units.length,
      dStr: defArmy && S.armies.includes(defArmy) ? sumStr(defArmy.units) : 0, dN: defArmy ? defArmy.units.length : 0,
      retreat: defArmy && S.armies.includes(defArmy) && defArmy.tile !== defTile0 ? defArmy.tile : null,
      capture: rep.captured && S.armies.includes(a) && a.tile === tile, player: a.f === S.player || defF === S.player,
    });
    if (typeof COURT !== 'undefined' && S.court) {
      if (a.f === S.player) attWin ? COURT.onWin(!!rep.captured) : COURT.onLoss(false);
      else if (defF === S.player) attWin ? COURT.onLoss(!!rep.captured) : COURT.onWin(false);
    }
    if (a.f === S.player || defF === S.player) emit('battle', rep);
    if (typeof EVENTS !== 'undefined' && EVENTS.onBattle) { try { EVENTS.onBattle(rep); } catch (e) { console.error(e); } }
    if (a.f !== S.player && defF !== S.player && c && rep.captured && fac(S.player).met[a.f]) log(`【${F_a.name}】攻陷【${F_d.name}】${c.name}。`, 'world');
    return rep;
  }
  // 取出待决的守御战（仍然有效者）
  function takeDefenses() {
    const q = S._defQ || []; S._defQ = [];
    return q;
  }
  function defenseValid(d) {
    const a = army(d.aid);
    if (!a || !a.units.length || GEO.dist(a.tile, d.tile) !== 1) return null;
    const ea = armyAt(d.tile), c = cityAt(d.tile);
    const df = ea ? ea.f : c ? c.f : null;
    if (df !== S.player || !atWar(a.f, df)) return null;
    return a;
  }
  function sumStr(units) { return units.reduce((s, u) => s + u.s, 0) * 5; }
  function bumpExp(gid, win) { const g = gen(gid); if (g && win) g.wins++; }
  // ---------- 将领成长 ----------
  const LV = [0, 0, 40, 100, 180, 280, 400, 550, 730, 940, 1200];
  function hasSkill(g, x) { return !!g && (g.skill === x || (g.skills || []).includes(x)); }
  function skillList(g) { return [g.skill, ...(g.skills || [])].filter(Boolean); }
  function itemSum(g, k) { let v = 0; for (const id of (g.items || [])) v += DATA.ITEMS[id][k] || 0; return v; }
  function nextLv(g) { return LV[Math.min(10, (g.lv || 1) + 1)]; }
  const STAT_NAME = { tong: '统', wu: '武', zhi: '智', zheng: '政' };
  function levelOptions(g) {
    const stats = ['tong', 'wu', 'zhi', 'zheng'].sort((a, b) => (g[b] + Math.random() * 25) - (g[a] + Math.random() * 25));
    const opts = [{ k: 'stat', s: stats[0], v: 3 }, { k: 'stat', s: stats[1], v: 3 }];
    const own = skillList(g);
    const mil = g.tong + g.wu >= g.zhi + g.zheng;
    const pool = DATA.SKILL_POOL.filter(x => !own.includes(x) && (mil ? !['治世', '理财', '劝农', '教化'].includes(x) || Math.random() < 0.2 : ['治世', '理财', '劝农', '教化', '运筹', '坚守'].includes(x) || Math.random() < 0.3));
    if (own.length < 3 && pool.length) opts.push({ k: 'skill', s: pick(pool) });
    else opts.push({ k: 'stat', s: stats[2], v: 4 });
    return opts;
  }
  function optText(o) { return o.k === 'stat' ? `${STAT_NAME[o.s]} +${o.v}` : `习得特技【${o.s}】`; }
  function applyLevel(g, o) {
    if (o.k === 'stat') g[o.s] = Math.min(120, g[o.s] + o.v);
    else if (!g.skill) g.skill = o.s; else { g.skills = g.skills || []; if (!g.skills.includes(o.s)) g.skills.push(o.s); }
  }
  function gainExp(gid, amt) {
    const g = gen(gid); if (!g || g.status === 'dead') return;
    g.lv = g.lv || 1; g.exp = (g.exp || 0) + amt;
    while (g.lv < 10 && g.exp >= nextLv(g)) {
      g.lv++;
      if (g.f === S.player) { S.pending.push({ ev: 'levelup', gen: g.id, lv: g.lv, opts: levelOptions(g) }); log(`${g.name}积功晋升至 ${g.lv} 级。`, 'mil'); }
      else applyLevel(g, pick(levelOptions(g)));
    }
  }
  function giveItem(g, id) {
    g.items = g.items || [];
    if (g.items.length >= 3) return false;
    g.items.push(id);
    const it = DATA.ITEMS[id];
    for (const k of ['tong', 'wu', 'zhi', 'zheng']) if (it[k]) g[k] = Math.min(120, g[k] + it[k]);
    S.itemsTaken = S.itemsTaken || {}; S.itemsTaken[id] = 1;
    return true;
  }

  // ---------- 奇遇点 ----------
  function siteAt(t) { if (!S.sites) return null; for (const st of S.sites) if (st.tile === t && !st.used) return st; return null; }
  function siteName(type, t) {
    const own = tileOwner(t), cul = own ? fac(own).culture : '';
    if (type === 'temple') {
      if (['arab', 'turkic', 'persian', 'moorish'].includes(cul)) return '清真古寺';
      if (['frankish', 'english', 'german', 'iberian', 'italian', 'polish', 'magyar', 'norse', 'greek', 'rus', 'georgian'].includes(cul)) return '修道院';
      if (cul === 'indian') return '古神庙';
      return pick(['名山古刹', '道观', '石窟寺', '古刹']);
    }
    if (type === 'volunteers' && own === 'jin') return '抗金义军';
    if (type === 'volunteers') return pick(['义军营寨', '乡勇寨', '山寨豪杰']);
    if (type === 'caravan') return ['arab', 'turkic', 'persian'].includes(cul) ? '驼队' : '商队';
    return DATA.SITES[type].name;
  }
  function generateSites() {
    S.sites = [];
    const occupied = t => cityAt(t) || S.sites.some(x => GEO.dist(x.tile, t) < 2);
    for (const [name, type, lon, lat] of DATA.LANDMARKS) {
      const [c, r] = GEO.nearestHex(lon, lat);
      const t = GEO.ring(GEO.idx(c, r), 2).find(x => !GEO.isWater(x) && !occupied(x));
      if (t != null) S.sites.push({ id: S.sites.length, tile: t, type, name, used: false, cd: {}, gens: [], famous: true });
    }
    const W = [['battlefield', 14], ['temple', 12], ['hermit', 7], ['ruins', 11], ['volunteers', 10], ['stud', 9], ['caravan', 12], ['granary', 10], ['library', 7]];
    const tot = W.reduce((s, x) => s + x[1], 0);
    const land = [];
    for (let i = 0; i < GEO.W * GEO.H; i++) if (!GEO.isWater(i) && GEO.terrain[i] !== GEO.T.TUNDRA) land.push(i);
    for (let i = land.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [land[i], land[j]] = [land[j], land[i]]; }
    let n = 0;
    for (const t of land) {
      if (n >= 150) break;
      if (cityAt(t) || S.sites.some(x => GEO.dist(x.tile, t) < 4) || S.cities.some(c => GEO.dist(c.tile, t) < 2)) continue;
      let x = Math.random() * tot, type = 'caravan';
      for (const [k, w] of W) { x -= w; if (x <= 0) { type = k; break; } }
      if (type === 'stud' && GEO.terrain[t] !== GEO.T.STEPPE) type = 'granary';
      if (type === 'caravan' && GEO.terrain[t] === GEO.T.MTN) type = 'hermit';
      S.sites.push({ id: S.sites.length, tile: t, type, name: siteName(type, t), used: false, cd: {}, gens: [] });
      n++;
    }
  }
  function siteUsable(st, a) {
    if (st.used) return false;
    const T = DATA.SITES[st.type];
    if (T.repeat === 'season') return !(st.cd[a.f] > S.T);
    if (T.repeat === 'gen') return a.gen != null && !st.gens.includes(a.gen);
    if (st.type === 'hermit') return a.gen != null;
    return true;
  }
  function visitSite(a, st) {
    if (!siteUsable(st, a)) return;
    const g = gen(a.gen), F = fac(a.f), me = a.f === S.player;
    let msg = '', short = '', big = false;
    switch (st.type) {
      case 'battlefield': gainExp(g.id, 80); st.gens.push(g.id); msg = `${g.name}凭吊${st.name}，遥想当年金戈铁马，于兵法若有所悟。`; short = '经验+80'; break;
      case 'temple': st.cd[a.f] = S.T + 1; a.morale = 100; for (const u of a.units) u.s = Math.min(100, u.s + 20); msg = `大军驻于${st.name}，将士焚香祈福，士气大振。`; short = '士气全满'; break;
      case 'hermit': {
        st.used = true; big = true;
        const own = skillList(g);
        const pool = DATA.SKILL_POOL.filter(x => !own.includes(x));
        if (own.length < 3 && pool.length) { const sk = pick(pool); applyLevel(g, { k: 'skill', s: sk }); msg = `${g.name}三顾草庐，隐士授以秘策，习得特技【${sk}】。`; short = '特技【' + sk + '】'; }
        else { const k = pick(['tong', 'wu', 'zhi', 'zheng']); g[k] = Math.min(120, g[k] + 4); msg = `${g.name}得隐士指点，${STAT_NAME[k]} +4。`; short = STAT_NAME[k] + '+4'; }
        break;
      }
      case 'ruins': {
        st.used = true; big = true;
        S.itemsTaken = S.itemsTaken || {};
        const left = Object.keys(DATA.ITEMS).filter(k => !S.itemsTaken[k]);
        const id = left.length && Math.random() < 0.75 ? pick(left) : null;
        if (id && g && giveItem(g, id)) { msg = `于${st.name}掘得宝物【${DATA.ITEMS[id].name}】（${DATA.ITEMS[id].desc}），归${g.name}所有。`; short = '得' + DATA.ITEMS[id].name; }
        else { const v = ri(150, 300); F.gold += v; msg = `于${st.name}掘得金银 ${v} 贯。`; short = '钱+' + v; }
        break;
      }
      case 'volunteers': {
        st.used = true; big = true;
        const n = ri(2, 3); let joined = 0, extra = [];
        for (let i = 0; i < n; i++) { const u = mkUnit(Math.random() < 0.6 ? 'inf' : 'bow', 80); if (a.units.length < armyCap(a)) { a.units.push(u); joined++; } else extra.push(u); }
        if (extra.length) { const c = citiesOf(a.f).sort((x, y) => GEO.dist(x.tile, a.tile) - GEO.dist(y.tile, a.tile))[0]; if (c) c.garrison.push(...extra); }
        msg = `${st.name}豪杰闻王师至，率众来投，得 ${n} 营` + (extra.length ? `（${extra.length} 营因军团已满，归入附近城池）` : '') + '。';
        short = '义军' + n + '营'; break;
      }
      case 'stud': st.cd[a.f] = S.T + 1; F.horse += 15; msg = `于${st.name}收得良马十五匹。`; short = '马+15'; break;
      case 'caravan': { st.used = true; const v = ri(120, 260); F.gold += v; msg = `截获${st.name}，得钱 ${v} 贯。`; short = '钱+' + v; break; }
      case 'granary': st.used = true; F.food += 200; msg = `缴获${st.name}存粮二百石。`; short = '粮+200'; break;
      case 'library': { st.used = true; big = true; const add = F.research ? Math.round(techCost(a.f, F.research) * 0.3) : 120; F.sci += add; msg = `于${st.name}得古籍善本，学士研读，格物大进（文教 +${add}）。`; short = '文+' + add; break; }
    }
    rec({ k: 'gain', tile: st.tile, text: short, f: a.f });
    if (me) S.flags.achievementProgress.visits[st.id] = true;
    if (me) { log(msg, big ? 'big' : 'eco', st.tile); if (big) S.pending.push({ ev: 'info', title: st.name, text: msg }); }
  }
  function continueArmy(aid) { const a = army(aid); if (!a || !a.path || !a.path.length) return []; const r = advance(a); emit('change'); return r; }
  function retreatTile(a, fromTile) {
    let best = -1, bs = -1e9;
    for (const n of GEO.NBR[a.tile]) {
      if (n === fromTile || armyAt(n) || GEO.isWater(n)) continue;
      const o = tileOwner(n);
      if (o && o !== a.f && !allied(a.f, o)) { if (!atWar(a.f, o)) continue; }
      const c = cityAt(n); if (c && c.f !== a.f) continue;
      const s = GEO.dist(n, fromTile) * 2 + (o === a.f ? 3 : 0) + Math.random();
      if (s > bs) { bs = s; best = n; }
    }
    return best;
  }
  function destroyArmy(a, byF, rep) {
    const g = gen(a.gen);
    if (g) {
      const roll = Math.random();
      const famous = g.hist && g.tong >= 90;
      if (roll < 0.35 && byF && byF !== 'rebel') {
        takeCaptive(g, byF, rep?.tile ?? a.tile);
        if (rep) rep.captured = (rep.captured ? rep.captured + '，' : '') + '俘获' + g.name;
        if (byF === S.player) log(`生擒敌将${g.name}！`, 'war');
        else if (g.f === S.player) log(`${g.name}兵败，为【${fac(byF).name}】所俘！`, 'war');
      }
      else if (roll < 0.45 && !famous) { killGeneral(g, '阵亡'); if (rep) rep.result += `，${g.name}阵亡`; }
      else { g.status = 'idle'; g.loc = null; }
    }
    S.armies = S.armies.filter(x => x !== a);
    rec({ k: 'die', id: a.id });
  }
  function killGeneral(g, why) {
    if (g.status === 'army') { const a = army(g.loc); if (a) a.gen = null; }
    if (g.status === 'gov') { const c = S.cities.find(c => c.governor === g.id); if (c) c.governor = null; }
    if (g.status === 'court' && S.court) { for (const k in S.court.offices) if (S.court.offices[k] === g.id) delete S.court.offices[k]; }
    if (g.f === S.player && g.hist && ['idle','army','gov','court'].includes(g.status)) S.flags.lastOfficerDeath = { gen: g.id, t: S.T };
    if (g.status === 'captive') clearCaptivity(g);
    g.status = 'dead'; g.loc = null;
    if (g.f === S.player) log(`${g.name}${why}。`, why === '阵亡' ? 'war' : 'info');
  }
  function captureCity(c, f, byArmy) {
    const old = c.f, F_old = fac(old), F_new = fac(f);
    const hostileCapital = f === S.player && old !== 'rebel' && old !== f && c.cap;
    const wasCap = c.cap;
    if (!S.flags.capLost && old === S.player && f !== old && F_old.capital === c.id) S.flags.capLost = true;
    rec({ k: 'cap', city: c.id, from: old, to: f });
    // 知州
    const g = gen(c.governor);
    if (g) {
      g.status = 'idle'; g.loc = null;
      if (Math.random() < 0.4 && f !== 'rebel') takeCaptive(g, f, c.tile);
    }
    c.governor = null;
    for (const a of S.armies.filter(x => x.tile === c.tile && x.f === old)) destroyArmy(a, f);
    c.garrison = []; c.queue = [];
    const loot = c.pop * 12;
    F_new.gold += loot;
    c.f = f; c.loyalty = 30; c.unrest = 30; c.pop = Math.max(1, c.pop - 1);
    for (const prisoner of S.generals) {
      if (prisoner.status !== 'captive' || prisoner.jail !== c.id) continue;
      if (prisoner.f === f) {
        returnCaptive(prisoner);
        if (f === S.player) log(`王师克复${c.name}，救出${prisoner.name}。`, 'war', c.tile);
      } else prisoner.capBy = f;
    }
    c.siegeStart = c.siegeLast = null;
    c.recentCapture = { from: old, t: S.T };
    S._playerThreat = null;
    if (f === S.player && old !== f) {
      const occupation = difficultyRules().occupation;
      c.loyalty = occupation.loyalty; c.unrest = occupation.unrest;
    }
    c.trade = [];
    for (const o of S.cities) o.trade = o.trade.filter(t => !(t === c.id && atWar(o.f, f)));
    c.wall = Math.round(maxWall(c) * 0.3);
    addWarScore(f, old, 8);
    if (c.cap) {
      c.cap = false;
      const rest = citiesOf(old).sort((a, b) => b.pop - a.pop);
      if (rest.length) { rest[0].cap = true; F_old.capital = rest[0].id; }
      if (old === S.player && rest.length) log(`都城陷落！朝廷移跸${rest[0].name}。`, 'war');
    }
    if (f === S.player) {
      log(`王师克复${c.name}，缴获钱 ${loot} 贯。`, 'war', c.tile);
      const notice = { ev: 'captured', city: c.id };
      if (byArmy) S.pending.push(notice); // 战后按实况改为处置或撤去。
      else EVENTS.offer(notice, 'battle');
      revealAround(c.tile, 3);
      if (old !== f && old !== 'rebel' && Math.random() < 0.3) EVENTS.offerFormerOfficial(c, F_old.culture);
    }
    if (old === S.player) log(`${c.name}失守于【${F_new.name}】！`, 'war', c.tile);
    // 天下大事：电脑之间攻城略地
    if (old !== S.player && f !== S.player && old !== f && old !== 'rebel' && f !== 'rebel') {
      const known = fac(S.player).met[f] || fac(S.player).met[old];
      const near = citiesOf(S.player).some(m => GEO.dist(m.tile, c.tile) <= 12);
      if (wasCap && known) log(`【${F_new.name}】攻陷【${F_old.name}】都城${c.name}！`, 'world', c.tile, true);
      else if (near && known) log(`【${F_new.name}】攻取【${F_old.name}】之${c.name}。`, 'world', c.tile);
    }
    if (f === 'rebel' && c.f === 'rebel') { F_new.capital = F_new.capital >= 0 ? F_new.capital : c.id; }
    if (citiesOf(old).length === 0 && old !== 'rebel') factionDies(old, f);
    else if (hostileCapital) conquestOpinion();
    if (old === S.player || f === S.player) checkVictory();
  }
  function factionDies(f, by) {
    const F = fac(f);
    if (F.alive && f !== S.player && f !== 'rebel' && by === S.player) {
      S.flags.achievementProgress.conquests++;
      conquestOpinion();
    }
    F.alive = false;
    for (const g of S.generals) if (g.status === 'captive' && g.capBy === f) {
      returnCaptive(g);
      if (g.f === S.player && g.status === 'idle') {
        log(by === g.f ? `王师灭【${F.name}】，救回${g.name}。` : `【${F.name}】已亡，${g.name}脱囚归朝。`, 'war');
      } else if (by === g.f && g.status === 'idle') log(`【${fac(by).name}】灭【${F.name}】，救回${g.name}。`, 'world');
    }
    for (const a of S.armies.filter(a => a.f === f)) destroyArmy(a, by);
    for (const g of S.generals) if (g.f === f && (g.status === 'idle' || g.status === 'future')) {
      if (g.status === 'idle' && by && by !== 'rebel' && Math.random() < 0.5) takeCaptive(g, by, city(F.capital)?.tile);
      else if (g.status === 'idle') g.status = 'gone';
      else g.f = by === 'rebel' ? f : g.f; // 未出仕者
    }
    for (const k in S.rel) { if (k.split('|').includes(f)) { S.rel[k].war = false; S.rel[k].ally = false; S.rel[k].trib = null; } }
    if (f === S.player) {
      S.defeat = true;
      if (S.settlement?.continued) log('社稷倾覆……', 'big');
      else finishGame('defeat');
    }
    else if (fac(S.player).met[f] || by === S.player) log(`【${F.name}】亡国。`, by === S.player ? 'big' : 'world', null, by !== S.player);
  }

  // ---------- 将领管理 ----------
  function assignGovernor(gid, cid) {
    const g = gen(gid), c = city(cid);
    if (!g || !c || g.f !== c.f) return false;
    unassign(gid);
    if (c.governor != null) { const og = gen(c.governor); og.status = 'idle'; og.loc = null; }
    c.governor = gid; g.status = 'gov'; g.loc = cid;
    return true;
  }
  function unassign(gid) {
    const g = gen(gid);
    if (g.status === 'court' && S.court) { for (const k in S.court.offices) if (S.court.offices[k] === gid) delete S.court.offices[k]; }
    if (g.status === 'gov') { const c = city(g.loc); if (c) c.governor = null; }
    if (g.status === 'army') { const a = army(g.loc); if (a) a.gen = null; }
    g.status = 'idle'; g.loc = null;
  }
  function setArmyGeneral(aid, gid) {
    const a = army(aid);
    if (a.gen != null) { const og = gen(a.gen); og.status = 'idle'; og.loc = null; }
    a.gen = null;
    if (gid != null) { unassign(gid); a.gen = gid; const g = gen(gid); g.status = 'army'; g.loc = a.id; }
    while (a.units.length > armyCap(a)) { const u = a.units.pop(); const c = cityAt(a.tile); if (c && c.f === a.f) c.garrison.push(u); }
  }
  // 由城中守军组建军团
  function formArmy(cid, gid, unitIdx) {
    const c = city(cid);
    if (armyAt(c.tile)) return null;
    const cap = capFor(gid);
    const idx = unitIdx.slice().sort((a, b) => b - a).slice(0, cap);
    const units = [];
    for (const i of idx) if (c.garrison[i]) units.unshift(c.garrison.splice(i, 1)[0]);
    if (!units.length) return null;
    if (gid != null) unassign(gid);
    const a = createArmyRaw(c.f, c.tile, units, gid, '');
    a.mp = armyMP(a) / 2;
    emit('change');
    return a;
  }
  function transferToArmy(aid, gidx) {
    const a = army(aid), c = cityAt(a.tile);
    if (!c || c.f !== a.f) return false;
    if (a.units.length >= armyCap(a) || !c.garrison[gidx]) return false;
    a.units.push(c.garrison.splice(gidx, 1)[0]);
    clearSentry(a);
    return true;
  }
  function transferToCity(aid, uidx) {
    const a = army(aid), c = cityAt(a.tile);
    if (!c || c.f !== a.f || !a.units[uidx]) return false;
    c.garrison.push(a.units.splice(uidx, 1)[0]);
    clearSentry(a);
    if (!a.units.length) disband(aid);
    return true;
  }
  function disband(aid) {
    const a = army(aid); if (!a) return;
    clearSentry(a);
    const c = cityAt(a.tile);
    if (c && c.f === a.f) c.garrison.push(...a.units);
    if (a.gen != null) { const g = gen(a.gen); g.status = 'idle'; g.loc = null; }
    S.armies = S.armies.filter(x => x !== a);
    rec({ k: 'die', id: a.id, quiet: true });
  }
  function mergeArmies(aid, bid) { // b 并入 a（相邻）
    const a = army(aid), b = army(bid);
    if (!a || !b || a.f !== b.f || GEO.dist(a.tile, b.tile) > 1) return false;
    if (a === b || a.units.length >= armyCap(a) || !b.units.length) return false;
    clearSentry(a); clearSentry(b);
    while (b.units.length && a.units.length < armyCap(a)) a.units.push(b.units.shift());
    if (!b.units.length) { if (b.gen != null) { const g = gen(b.gen); g.status = 'idle'; g.loc = null; } S.armies = S.armies.filter(x => x !== b); }
    return true;
  }
  function nearestJail(f, tile) {
    const capital = city(fac(f)?.capital);
    let best = capital?.f === f ? capital : null, distance = Infinity;
    if (best && tile == null) return best.id;
    for (const c of S.cities) {
      if (c.f !== f) continue;
      if (tile == null) return c.id;
      const steps = GEO.dist(c.tile, tile);
      if (steps < distance) { best = c; distance = steps; }
    }
    return best?.id ?? null;
  }
  function takeCaptive(g, f, tile) {
    g.status = 'captive'; g.capBy = f; g.loc = null;
    g.jail = nearestJail(f, tile); g.capT = S.T;
    delete g.capRansomT;
  }
  function clearCaptivity(g) {
    delete g.capBy; delete g.jail; delete g.capT; delete g.capRansomT;
    g.loc = null;
  }
  function returnCaptive(g) {
    g.status = fac(g.f)?.alive ? 'idle' : 'gone';
    clearCaptivity(g);
  }
  function repairCaptivity(g) {
    if (!fac(g.capBy)?.alive) { returnCaptive(g); return; }
    const jail = city(g.jail);
    if (!jail || jail.f !== g.capBy) g.jail = nearestJail(g.capBy, jail?.tile);
    g.capT ??= S.T;
    g.loc = null;
  }
  function peaceCaptives(a, b) {
    const returning = [], releasing = [];
    for (const g of S.generals) if (g.status === 'captive') {
      if (g.f === a && g.capBy === b) returning.push(g);
      else if (g.f === b && g.capBy === a) releasing.push(g);
    }
    return { returning, releasing };
  }
  function joinCaptor(g, f) {
    if (f === S.player) S.flags.achievementProgress.recruits++;
    g.f = f; g.status = 'idle'; g.loyalty = 55;
    clearCaptivity(g);
  }
  function recruitCaptive(gid, f) {
    const g = gen(gid);
    if (!g || g.status !== 'captive' || g.capBy !== f) return null;
    let ch = g.hist ? 0.3 : 0.6;
    if (g.loyalty > 90) ch -= 0.2;
    if (g.name === '完颜宗弼') ch = 0.1;
    if (Math.random() < ch) {
      joinCaptor(g, f);
      return true;
    }
    g.loyalty -= 10;
    return false;
  }
  function releaseCaptive(gid) {
    const g = gen(gid);
    if (!g || g.status !== 'captive') return;
    const by = g.capBy;
    returnCaptive(g);
    if (by && fac(g.f)?.alive) getRel(by, g.f).op += 12;
  }
  function executeCaptive(gid) {
    const g = gen(gid); if (g?.status !== 'captive') return;
    const by = g.capBy;
    g.status = 'dead'; clearCaptivity(g);
    if (by && fac(g.f)?.alive) getRel(by, g.f).op -= 15;
  }
  function ransomCost(g) {
    const base = (g.tong + g.wu + g.zhi + g.zheng) * 1.2 + (g.hist ? 120 : 0);
    const opinion = g.capBy ? clamp(getRel(g.f, g.capBy).op, -100, 100) : 0;
    return Math.round(base * difficultyRules().ransom * (1 - opinion / 500));
  }
  function heldAbroad(g) {
    return g?.status === 'captive' && g.f === S.player && g.capBy !== g.f && fac(g.capBy)?.alive;
  }
  function ransomInfo(g) {
    if (!heldAbroad(g)) return { reason: '此将并未陷于敌国。' };
    const by = g.capBy, cost = ransomCost(g), atWarNow = atWar(g.f, by), r = getRel(g.f, by);
    if (!atWarNow && r.op < -30) return { reason: `【${fac(by).name}】怨意未消，不许赎归。` };
    const chance = atWarNow ? clamp(0.35 + r.op / 200 - Math.max(0, warScore(g.f, by)) / 200, 0, 1) : 1;
    const reason = g.capRansomT != null && Math.round(S.T * 90) - Math.round(g.capRansomT * 90) < 90 ? '一季之内，不可再请赎此将。'
      : fac(g.f).gold < cost ? '国库不足。' : '';
    return { cost, chance, reason };
  }
  function ransomCaptive(gid) {
    const g = gen(gid), { cost, chance, reason } = ransomInfo(g);
    if (reason) return { ok: false, msg: reason };
    const by = g.capBy, r = getRel(g.f, by);
    g.capRansomT = S.T;
    if (Math.random() >= chance) {
      r.op = clamp(r.op - 5, -100, 100);
      return { ok: false, msg: `【${fac(by).name}】不许赎归，未费国帑，好感 −5。` };
    }
    fac(g.f).gold -= cost; fac(by).gold += cost;
    r.op = clamp(r.op + 5, -100, 100);
    returnCaptive(g);
    const msg = `费钱 ${cost} 贯，赎得${g.name}归朝。`;
    log(msg, 'dip');
    return { ok: true, msg };
  }
  function exchangeOptions(g) {
    if (!heldAbroad(g)) return [];
    const minimum = Math.ceil(ransomCost(g) * 0.8);
    return S.generals.filter(prisoner => prisoner.status === 'captive' && prisoner.f === g.capBy && prisoner.capBy === g.f)
      .map(prisoner => ({ prisoner, cost: Math.max(0, minimum - ransomCost(prisoner)) }));
  }
  function exchangeCaptive(gid, otherId) {
    const g = gen(gid), option = exchangeOptions(g).find(({ prisoner }) => prisoner.id === otherId);
    if (!option) return { ok: false, msg: '无此俘将可换。' };
    const { prisoner, cost } = option;
    if (cost && fac(g.f).gold < cost) return { ok: false, msg: '国库不足。' };
    fac(g.f).gold -= cost; fac(prisoner.f).gold += cost;
    returnCaptive(g); returnCaptive(prisoner);
    const msg = `与【${fac(prisoner.f).name}】交换俘将，${g.name}归朝。`;
    log(msg, 'dip');
    return { ok: true, msg };
  }
  function defectCaptive(g) {
    if (!heldAbroad(g)) return;
    const by = g.capBy;
    joinCaptor(g, by);
    log(`${g.name}在囚受降，已转投【${fac(by).name}】。`, 'dip', null, true);
  }
  function captivityTurn() {
    for (const g of S.generals) {
      if (g.status !== 'captive') continue;
      if (S.newSeason) repairCaptivity(g);
      if (!heldAbroad(g)) continue;
      const cunning = hasSkill(g, '运筹') ? 0.01 : 0;
      const chance = 0.02 + Math.max(0, g.wu - 70) / 1000 + Math.max(0, g.zhi - 70) / 1000 + cunning;
      if (Math.random() < chance * E()) {
        returnCaptive(g);
        log(`${g.name}伺隙脱身，间道归朝。`, 'dip', null, true);
      }
    }
  }

  // ---------- 外交（玩家发起） ----------
  function envoyCost(f) { return Math.round(60 / (1 + (techFx(f).diplo || 0))); }
  function sendEnvoy(f, to) {
    const F = fac(f), k = envoyCost(f);
    if (F.gold < k) return { ok: false, msg: '国库不足' };
    F.gold -= k;
    const r = getRel(f, to);
    r.op = Math.min(100, r.op + 15 + 7 * (techFx(f).diplo || 0));
    return { ok: true, msg: `使者带去厚礼，【${fac(to).name}】好感升至 ${Math.round(r.op)}。` };
  }
  function aiWantsPeace(ai, other) {
    const r = getRel(ai, other);
    const ws = warScore(ai, other);
    const ratio = (totalPower(other) + 1) / (totalPower(ai) + 1);
    let w = -ws * 2 + (ratio - 1) * 40 + fac(ai).warWeary / 3 + r.op / 4;
    if (S.T - fac(ai).lastWar < 6) w -= 25;
    return w;
  }
  function proposePeace(f, to, payTrib) {
    const w = aiWantsPeace(to, f) + (payTrib ? 30 : 0);
    if (w > 10) {
      makePeace(f, to, payTrib ? { from: f, to, amt: payTrib, turns: 20 } : null);
      return { ok: true, msg: `【${fac(to).name}】许和。` };
    }
    // 对方索要岁币
    if (w > -25 && !payTrib) {
      const amt = Math.round(10 + totalPower(to) / 60);
      return { ok: false, counter: amt, msg: `【${fac(to).name}】要求岁币 ${amt} 贯/季方可议和。` };
    }
    return { ok: false, msg: `【${fac(to).name}】拒绝议和。` };
  }
  function demandTribute(f, to) {
    const ratio = totalPower(f) / (totalPower(to) + 1);
    const r = getRel(f, to);
    if (ratio > 2.2 && !r.war) {
      const amt = Math.max(5, Math.round(citiesOf(to).reduce((s, c) => s + c.pop, 0) * 0.6));
      r.trib = { from: to, to: f, amt, turns: 24 }; r.op -= 25;
      return { ok: true, msg: `【${fac(to).name}】畏我兵威，愿岁贡 ${amt} 贯，凡六年。` };
    }
    r.op -= 10;
    return { ok: false, msg: `【${fac(to).name}】怒斥我使，拒不纳贡。` };
  }
  function proposeAlliance(f, to) {
    const r = getRel(f, to);
    let common = false;
    for (const x in S.factions) if (fac(x).alive && atWar(f, x) && atWar(to, x) && x !== 'rebel') common = true;
    if (r.war) return { ok: false, msg: '交战之国，何谈结盟。' };
    if (r.op >= 70 || (r.op >= 40 && common)) { r.ally = true; delete r.coalitionAlly; return { ok: true, msg: `与【${fac(to).name}】歃血为盟。` }; }
    return { ok: false, msg: `【${fac(to).name}】婉拒结盟（需好感 70，或 40 且有共同之敌）。` };
  }

  // ---------- 视野 ----------
  function armySight(a) { return a.units.some(u => ['cav', 'hbow', 'hcav', 'elite'].includes(u.t)) ? 3 : 2; }
  function revealAround(t, r) {
    for (const x of GEO.ring(t, r)) {
      S.explored[x] = 1; S.visible[x] = 1;
      const o = tileOwner(x); if (o && o !== S.player) meet(S.player, o);
    }
  }
  function updateVisibility() {
    S.visible.fill(0);
    for (const c of S.cities) if (c.f === S.player) revealAround(c.tile, c.pop >= 10 ? 3 : 2);
    for (const a of S.armies) if (a.f === S.player) revealAround(a.tile, armySight(a));
    for (const c of S.cities) if (c.f === S.player) for (const t of c.trade) revealAround(city(t).tile, 1);
    for (const c of S.cities) if (c.f !== S.player && c.trade.some(t => city(t).f === S.player)) revealAround(c.tile, 1);
    for (const a of S.armies) if (a.f !== S.player && S.visible[a.tile]) meet(S.player, a.f);
  }

  // ---------- 科技 ----------
  function availableTechs(f) {
    const out = [];
    for (const id in TECH) {
      if (hasTech(f, id)) continue;
      const t = TECH[id];
      if (t.req && !t.req.every(r => hasTech(f, r))) continue;
      out.push(id);
    }
    return out;
  }
  const ERA_COST = { 1: 1, 2: 1.3, 3: 2.1 }; // 后期时代加价，见 BALANCE_REPORT 第六批
  function techCost(f, id) {
    const n = Object.keys(fac(f).techs).length;
    const era = TECH[id].era || 1;
    return Math.round(TECH[id].cost * 5 * (1 + n * 0.05) * (ERA_COST[era] || 1));
  }
  function setResearch(f, id) { fac(f).research = id; }

  // ---------- 回合结算 ----------
  function log(text, type, tile, hot) {
    const e = { t: S.turn, d: dateStr(), text, type: type || 'info' };
    if (tile != null && tile >= 0) e.tile = tile;
    if (hot) e.hot = true; // 天下大事：回合结束时弹出提示
    S.log.push(e);
    if (S.log.length > 400) S.log.shift();
    emit('log', e);
  }

  function processFaction(f) {
    const F = fac(f);
    if (!F.alive) return;
    const cs = citiesOf(f);
    if (!cs.length && f !== 'rebel') { factionDies(f, null); return; }
    let goldIn = 0, foodIn = 0, sciIn = 0, popTot = 0, prodTot = 0;
    const e = E();
    const player = f === S.player, rules = difficultyRules();
    for (const c of cs) {
      const y = cityYield(c);
      goldIn += y.gold; sciIn += y.sci; popTot += c.pop; prodTot += y.prod;
      // 生长
      const surplus = y.food - y.foodNeed;
      c.store += surplus * e;
      foodIn += Math.round(c.pop * 0.5 + Math.max(0, surplus) * 0.3);
      const th = growthTh(c);
      if (c.store >= th && c.pop < 30) { c.pop++; c.store = 0; }
      else if (c.store < -10) {
        if (bldFx(c).noFamine) c.store = 0;
        else { c.pop = Math.max(1, c.pop - 1); c.store = 0; if (f === S.player) log(`${c.name}乏粮，民有饥色，户口减少。`, 'eco'); }
      }
      if (player && F.food <= -30 && c.pop > 1 && !bldFx(c).noFamine && Math.random() < rules.debt.famine * e) {
        c.pop--;
        log(`${c.name}仓粮久绌，户口减一万。`, 'eco', c.tile);
      }
      // 生产
      const q = c.queue[0];
      if (q) {
        q.prog += y.prod * e;
        if (q.prog >= q.cost) {
          c.queue.shift();
          if (q.kind === 'b') { c.buildings[q.id] = 1; if (q.id === 'walls') c.wall = maxWall(c); if (f === S.player) log(`${c.name}建成${B[q.id].name}。`, 'eco'); }
          else {
            const u = mkUnit(q.id, 100);
            c.garrison.push(u);
            c.pop = Math.max(1, c.pop - (U[q.id].man >= 5 ? 0 : 0));
            if (f === S.player) log(`${c.name}新募${U[q.id].name}一营。`, 'mil');
          }
        }
      }
      // 民心
      c.unrest = Math.max(0, c.unrest - 2 * e);
      const tg = loyaltyTarget(c);
      c.loyalty += clamp(tg - c.loyalty, -4 * e, 4 * e);
      if (player && F.food < 0) c.loyalty = Math.max(0, c.loyalty - rules.debt.hunger * e);
      // 城防恢复
      const mw = maxWall(c);
      const besieged = GEO.NBR[c.tile].some(n => { const a = armyAt(n); return a && atWar(a.f, f); });
      if (!besieged) c.wall = Math.min(mw, c.wall + Math.max(3, mw * 0.1) * e);
      // 守军休整
      if (!besieged) for (const u of c.garrison) u.s = Math.min(100, u.s + 15 * e);
      // 民变
      const revolt = (c.loyalty < 25 ? 0.12 : 0) + (c.loyalty < 45 ? rules.occupation.revolt * occupationPressure(c) : 0);
      if (revolt > 0 && f !== 'rebel' && Math.random() < revolt * e) rebellion(c);
    }
    // 军费
    let upGold = 0, upFood = 0;
    const foodMul = 1 - Math.min(0.6, techFx(f).supply || 0);
    for (const a of S.armies) if (a.f === f) {
      const g = gen(a.gen);
      const fm = foodMul * (g && hasSkill(g, '运筹') ? 0.5 : 1);
      for (const u of a.units) { upGold += ['hcav', 'elite', 'fire'].includes(u.t) ? 2.5 : (['cav', 'hbow', 'navy'].includes(u.t) ? 2 : 1.5); upFood += U[u.t].food * fm; }
    }
    for (const c of cs) { upGold += Object.keys(c.buildings).length * 0.5; const gc = garrisonCap(c); c.garrison.forEach((u, i) => { const over = i >= gc; upGold += over ? 1.6 : 0.8; upFood += (over ? 1 : 0.5) * foodMul; }); }
    const salaries = S.generals.filter(g => g.f === f && ['idle', 'army', 'gov', 'court'].includes(g.status)).length * 2;
    // 岁币
    let trib = 0;
    for (const k in S.rel) {
      const r = S.rel[k];
      if (!r.trib) continue;
      if (r.trib.from === f) {
        trib -= r.trib.amt;
        if (f === S.player && r.trib.amt > 0) S.flags.achievementProgress.paidTribute = true;
      }
      if (r.trib.to === f) trib += r.trib.amt;
    }
    const st = strategicIncome(f);
    const upkeep = upGold + salaries;
    const governance = player ? upkeep * Math.max(0, cs.length - 40) * rules.debt.governance : 0;
    F.income = { gold: Math.round(goldIn), upkeep: Math.round(upkeep + governance), governance: Math.round(governance), trib, food: foodIn, foodUp: Math.round(upFood), sci: Math.round(sciIn * 10) / 10, horse: st.horse, iron: st.iron, man: Math.round(popTot * 0.12 * 10) / 10, prod: prodTot };
    F.gold += (goldIn - upkeep - governance + trib) * e;
    F.food += (foodIn - upFood) * e;
    F.man = Math.min(popTot * 1.6 + 20, F.man + popTot * 0.12 * e);
    F.horse = Math.min(300, F.horse + st.horse * e);
    F.iron = Math.min(300, F.iron + st.iron * e);
    if (F.food < -50) F.food = -50;
    if (F.gold < -200) F.gold = -200;
    // 科研
    if (!F.research || hasTech(f, F.research)) F.research = null;
    if (!F.research && f === S.player) { const av = availableTechs(f).sort((a, b) => TECH[a].cost - TECH[b].cost); if (av.length) { F.research = av[0]; log(`有司自择研习【${TECH[av[0]].name}】（可于科技中更改）。`, 'sci'); } }
    if (F.research) {
      F.sci += sciIn * e;
      const cost = techCost(f, F.research);
      if (F.sci >= cost) {
        F.sci -= cost; F.techs[F.research] = 1;
        if (f === S.player) { S.flags.lastStudy = { id: F.research, t: S.T }; log(`格物有成：习得【${TECH[F.research].name}】。`, 'sci'); }
        else if (f !== 'rebel' && rules.eraRecruit) {
          const era = TECH[F.research].era || 1;
          if (era > F.recruitEra) {
            F.recruitEra = era;
            const ordered = cs.slice().sort((a, b) => b.pop - a.pop);
            for (let i = 0; i < rules.eraRecruit; i++) {
              const c = ordered.find(c => c.garrison.length < garrisonCap(c)) || ordered[i % ordered.length];
              c.garrison.push(mkUnit(i % 2 ? 'bow' : DATA.NOMAD[F.culture] ? 'cav' : 'inf'));
            }
          }
        }
        F.research = null;
      }
    } else F.sci += sciIn * 0.5 * e;
    // 厌战
    let wars = 0;
    for (const x in S.factions) if (x !== f && fac(x).alive && x !== 'rebel' && atWar(f, x)) wars++;
    F.warWeary = clamp(F.warWeary + (wars ? 0.8 * wars : -3) * e, 0, 160);
    F.score = popTot + cs.length * 5 + Object.keys(F.techs).length * 3;
  }

  function rebellion(c) {
    const n = Math.max(2, Math.floor(c.pop / 3));
    let t = -1;
    for (const x of GEO.ring(c.tile, 2)) if (x !== c.tile && !GEO.isWater(x) && !armyAt(x) && !cityAt(x)) { t = x; break; }
    if (t < 0) return;
    const R = fac('rebel'); R.alive = true;
    const g = randomGeneral('rebel', 'mil', 40);
    createArmyRaw('rebel', t, Array.from({ length: n }, () => mkUnit(Math.random() < 0.7 ? 'inf' : 'bow', 80)), g.id, '');
    c.loyalty = 40; c.pop = Math.max(1, c.pop - 1);
    if (c.f === S.player) log(`${c.name}民变蜂起，乱民聚众 ${n * 500} 人！`, 'war', c.tile);
  }

  const expeditionRates = Object.fromEntries(Object.entries(TC.expedition.rates).map(([key, rate]) => [T[key], rate]));
  function expeditionTime(tt) {
    const e = E();
    if (tt !== T.TUNDRA) return e;
    // 军需先于历日推进结算。跨季一步只计其中落在冬季的天数。
    const start = S.doy / 90;
    return Math.max(0, Math.min(4, start + e) - Math.max(3, start));
  }
  function expeditionRate(a) {
    const tt = GEO.terrain[a.tile], rate = expeditionRates[tt];
    if (!TC.expedition.enabled || !rate || tileOwner(a.tile) === a.f || cityAt(a.tile)?.f === a.f) return 0;
    const culture = fac(a.f).culture;
    if ((tt === T.DESERT || tt === T.TUNDRA) && DATA.NOMAD[culture]) return 0;
    if (tt === T.JUNGLE && TC.expedition.jungleCultures.includes(culture)) return 0;
    return expeditionTime(tt) > 0 ? rate : 0;
  }
  function warnExpedition(a, rate) {
    if (rate && !a.expeditionWarned) {
      const terrain = GEO.TERRAIN[GEO.terrain[a.tile]].name;
      log(`${armyName(a)}屯于境外${terrain}，水土不服，每季损员 ${Math.round(rate * 100)}%。`, 'mil', a.tile);
    }
    a.expeditionWarned = !!rate;
  }
  function armyUpkeepTurn() {
    const e = E();
    const debt = difficultyRules().debt;
    for (const a of S.armies) {
      const F = fac(a.f);
      const own = tileOwner(a.tile) === a.f;
      const inCity = cityAt(a.tile) && cityAt(a.tile).f === a.f;
      let heal = inCity ? 20 : own ? 8 : (allied(a.f, tileOwner(a.tile)) ? 4 : 0);
      if (!own && !inCity) {
        let nd = 99;
        for (const c of S.cities) if (c.f === a.f) nd = Math.min(nd, GEO.dist(c.tile, a.tile));
        if (nd > 8) heal -= 4;
        if (!TC.expedition.enabled && GEO.terrain[a.tile] === T.DESERT) heal -= 3;
      }
      if (F.food < 0) heal -= 10;
      if (F.gold < 0) { heal -= 3; a.morale -= (a.f === S.player ? debt.morale : 5) * e; }
      const hk = heal > 0 ? Math.min(1, e * 2) : e;
      const rate = expeditionRate(a);
      if (a.f === S.player) warnExpedition(a, rate);
      const retained = rate ? Math.pow(1 - rate, expeditionTime(GEO.terrain[a.tile])) : 1;
      for (const u of a.units) u.s = clamp(u.s * retained + heal * hk, 1, 100);
      a.units = a.units.filter(u => u.s >= 8);
      if (rate) rec({ k: 'gain', id: a.id, f: a.f, tile: a.tile, n: a.units.length, str: sumStr(a.units), quiet: true });
      if (a.f === S.player && F.gold <= -100 && a.units.length && Math.random() < debt.desertion * e) {
        const weakest = a.units.reduce((index, u, i) => u.s < a.units[index].s ? i : index, 0);
        a.units.splice(weakest, 1);
        rec({ k: 'gain', tile: a.tile, f: a.f, text: '欠饷逃卒' });
        log(`${armyName(a)}欠饷，逃散一营。`, 'mil', a.tile);
      }
      const mr = 5 + (techFx(a.f).morale || 0) + (a.f === S.player && S.court && typeof COURT !== 'undefined' ? COURT.bonus('shumi') * 20 : 0);
      const moraleRecovery = (a.morale < 75 ? mr : 1) * Math.min(1, e * 2);
      const fortRecovery = inCity && fortified(a, S.T + e) ? 1.5 : 1;
      a.morale = clamp(a.morale + moraleRecovery * fortRecovery, 5, 100);
      a.mp = armyMP(a);
      if (a.progTo != null && (!a.path || a.path[0] !== a.progTo || GEO.dist(a.tile, a.progTo) !== 1)) { a.prog = 0; a.progTo = null; a.progFrac = 0; }
    }
    S.armies = S.armies.filter(a => { if (!a.units.length) { if (a.gen != null) { const g = gen(a.gen); g.status = 'idle'; g.loc = null; } return false; } return true; });
  }

  function diplomacyTurn() {
    const e = E();
    const p = S.player, rules = difficultyRules().coalition;
    const united = new Set(Object.keys(S.factions).filter(f => f !== p && f !== 'rebel' && fac(f).alive && atWar(p, f)));
    for (const k in S.rel) {
      const r = S.rel[k];
      if (r.truce > 0) r.truce = Math.max(0, r.truce - e);
      if (r.trib) { r.trib.turns -= e; if (r.trib.turns <= 0) r.trib = null; }
      if (r.war) r.op = Math.max(-100, r.op - 0.5 * e);
      if (united.size >= 2) {
        const [a, b] = k.split('|');
        if (united.has(a) && united.has(b)) {
          r.op = Math.min(100, r.op + rules.rapport * 0.5 * e);
          if (!r.war && !r.ally && r.op >= rules.allyAt && Math.random() < 0.25 * e) { r.ally = true; r.coalitionAlly = true; }
        }
      }
      else r.op += (r.op > 0 ? -0.3 : 0.5) * e;
      r.op = clamp(r.op, -100, 100);
    }
    // 航线增好感
    for (const c of S.cities) for (const t of c.trade) { const r = getRel(c.f, city(t).f); r.op = Math.min(100, r.op + 0.5 * e); }
  }

  function generalsTurn() {
    for (const g of S.generals) {
      if (g.status === 'future' && S.year >= g.avail) {
        if (g.f === S.player && fac(g.f).alive && g.zheng > g.wu + 5) continue;
        enterService(g);
        if (g.f === S.player && g.status === 'idle') {
          log(`${g.name}慕义来投，愿效犬马。`, 'big');
          emit('event', { kind: 'newgen', gen: g.id });
        }
      }
    }
    if (S.season === 3 && S.newSeason) {
      for (const g of S.generals) {
        if (['dead', 'gone', 'future'].includes(g.status)) continue;
        const age = S.year - g.birth;
        if (age > 52 && Math.random() < (age - 52) * 0.012) killGeneral(g, `病逝，享年${age}`);
      }
    }
    // AI 自动补将
    const idle = {}, seats = {};
    for (const g of S.generals) if (g.status === 'idle') idle[g.f] = (idle[g.f] || 0) + 1;
    for (const c of S.cities) if (c.f) seats[c.f] = (seats[c.f] || 0) + 1;
    for (const f in S.factions) if (f !== S.player && f !== 'rebel' && fac(f).alive && (idle[f] || 0) < Math.ceil((seats[f] || 0) / 6) && Math.random() < 0.3 * E()) {
      randomGeneral(f, Math.random() < 0.8 ? 'mil' : 'civil', 45 + Math.min(20, seats[f]));
    }
  }

  function endTurn() {
    if (S.defeat) return;
    S._defQ = [];
    // AI 行动
    for (const f in S.factions) if (f !== S.player && fac(f).alive) AI.turn(f);
    computeInbound();
    for (const f in S.factions) processFaction(f);
    armyUpkeepTurn();
    diplomacyTurn();
    // 时间推进
    S.turn++;
    S.T += E();
    const oldSeason = S.season, oldYear = S.year;
    S.doy += S.scale;
    while (S.doy >= 360) { S.doy -= 360; S.year++; }
    S.season = Math.floor(Math.floor(S.doy / 30) / 3);
    S.newSeason = S.season !== oldSeason || S.year !== oldYear;
    S.newYear = S.year !== oldYear;
    generalsTurn();
    captivityTurn();
    if (S.newYear) AI.prisonersTurn();
    if (S.newSeason) assignTerritory(false);
    coalitionTurn();
    EVENTS.turn();
    if (typeof COURT !== 'undefined') COURT.turn();
    updateVisibility();
    const reps = [];
    checkVictory();
    emit('change');
    return reps;
  }

  function checkVictory() {
    let cityCount = 0, own = 0, capCount = 0, ownCaps = 0;
    for (const c of S.cities) {
      if (c.f) cityCount++;
      if (c.f === S.player) own++;
      if (c.origCap) {
        capCount++;
        if (c.f === S.player) ownCaps++;
      }
    }
    S.capProgress = { own: ownCaps, total: capCount };
    if (!S.victory && capCount > 0 && ownCaps === capCount) {
      S.victory = true;
      log('史官记曰：万国来朝。', 'big');
    }
    if (!own) { S.defeat = true; finishGame('defeat'); }
    else if (own === cityCount) finishGame('unify');
  }
  function finishGame(type) {
    if (S.settlement) return S.settlement;
    S.settlement = { type, score: null, continued: false, recorded: false };
    const ev = type === 'unify' ? 'endingUnify' : type === 'defeat' ? 'endingDefeat' : null;
    if (ev && !S.pending.some(p => p.ev === ev)) S.pending.unshift({ ev });
    if (type === 'unify') log('史官记曰：海内一统。', 'big');
    if (type === 'defeat') log('社稷倾覆……', 'big');
    return S.settlement;
  }

  // ---------- 存档 ----------
  function encodeTA(ta) { let s = ''; const u8 = new Uint8Array(ta.buffer); for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); }
  function decodeTA(str, Ctor) { const bin = atob(str); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new Ctor(u8.buffer); }
  function serialize() {
    const o = {};
    for (const k in S) if (k[0] !== '_') o[k] = S[k];
    o.tileCity = encodeTA(new Int16Array(S.tileCity)); o.tileCityFmt = 16; o.explored = encodeTA(S.explored); o.visible = undefined;
    // 已故/离去的非史实人物只留名
    o.generals = S.generals.map(g => (!g.hist && (g.status === 'dead' || g.status === 'gone')) ? { id: g.id, name: g.name, f: g.f, status: g.status, birth: g.birth, tong: 0, wu: 0, zhi: 0, zheng: 0 } : g);
    return JSON.stringify(o, (k, v) => typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v);
  }
  function deserialize(str) {
    GEO.generate();
    const o = JSON.parse(str);
    o.tileCity = o.tileCityFmt === 16 ? Int32Array.from(decodeTA(o.tileCity, Int16Array)) : decodeTA(o.tileCity, Int32Array);
    o.explored = decodeTA(o.explored, Uint8Array);
    o.visible = new Uint8Array(GEO.W * GEO.H);
    o.pending = o.pending || [];
    if (!o.scale) { o.scale = 90; o.doy = o.season * 90 + 1; o.T = o.turn; }
    S = o;
    S.settlement ??= null;
    if (typeof EVENTS !== 'undefined') { EVENTS.initAchievements(S); EVENTS.initSchedule(S); }
    S.difficulty = DATA.DIFFICULTY[S.difficulty] ? +S.difficulty : 1;
    S.flags.coalition ??= {};
    S.flags.coalitionT ??= null;
    S.flags.recommendYear ??= null;
    for (const c of S.cities) {
      c.recentCapture ??= null;
      c.lastSiege ??= null;
    }
    for (const F of Object.values(S.factions)) {
      F.recruitEra ??= reachedEra(F);
      F.lastMainWar ??= -99;
    }
    for (const r of Object.values(S.rel)) if (r.war) r.since ??= 0;
    for (const a of S.armies) { a.fortT ??= null; a.expeditionWarned ??= false; }
    for (const g of S.generals) {
      if (!g.cul) g.cul = fac(g.f)?.culture || 'han';
      if (g.status === 'captive') repairCaptivity(g);
    }
    const knownNames = new Set(S.generals.map(g => g.name));
    for (const row of DATA.GEN_ADDITIONS) if (!knownNames.has(row[0])) {
      addHistorical(row);
      knownNames.add(row[0]);
    }
    if (!S.sites) generateSites();
    if (typeof COURT !== 'undefined') {
      COURT.init();
      if (S.court.genEmp) COURT.updateEmperorArt(S.court.genEmp, S.year);
    }
    updateVisibility();
    emit('change');
    return S;
  }

  return {
    terrainPower, terrainDefense, battleTerrainRows, tileTerrainRows, expeditionRate,
    get S() { return S; }, on, emit, newGame, garrisonCap, hooks, donateInfo, donate, reliefCost, reliefReady, relief, rewardCost, rewardReady, rewardArmy, migrateCost, migrateOk, migrate, techFx, bldFx, techEff, bldEff, growthTh, winChance, takeDefenses, defenseValid, previewBattle, battleSides, sidePowerPub: (...x) => sidePower(...x), skillMult: (...x) => skillMult(...x), itemSum: (...x) => itemSum(...x), hasSkill, skillList, levelOptions, optText, applyLevel, gainExp, nextLv, siteAt, siteUsable, continueArmy, STAT_NAME, takeAnim, E, unitName, mpFactor, SCALE_NAME, serialize, deserialize, endTurn, log, dateStr, cnNum,
    fac, city, gen, army, armyAt, cityAt, tileOwner, cityTiles, cityYield, tileYield, loyaltyTarget, maxWall, strategicIncome, luxuryCount,
    buildOptions, unitOptions, unitCost, canAffordUnit, queueUnit, queueBuilding, dequeue, hurry, hurryCost,
    createArmyRaw, formArmy, transferToArmy, transferToCity, disband, mergeArmies, setSentry, fortified, armyCap, capFor, armyName, armyMP, canSail, findPath, routeStep, advance, moveArmyTo, attack, mkUnit,
    assignGovernor, unassign, setArmyGeneral, recruitCaptive, releaseCaptive, executeCaptive, randomGeneral, addGeneral, killGeneral,
    ransomCost, ransomInfo, ransomCaptive, exchangeOptions, exchangeCaptive, peaceCaptives, defectCaptive,
    getRel, atWar, allied, warScore, casusBelli, declareWar, makePeace, meet, sendEnvoy, envoyCost, proposePeace, demandTribute, proposeAlliance, aiWantsPeace,
    coalitionReady, coalitionWar, answerCoalition,
    totalPower, militaryPower, playerThreat, difficultyRules, citiesOf, hasTech, availableTechs, techCost, setResearch, tradeSlots, routeTargets, routeValue, openRoute, canRoute, captureCity,
    nearPlayer, updateVisibility, revealAround, assignTerritory, sumStr, rebellion, factionDies, checkVictory, finishGame, rnd, ri, pick, clamp,
  };
})();
if (typeof module !== 'undefined') module.exports = GAME;
