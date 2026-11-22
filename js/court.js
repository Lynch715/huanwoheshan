// 朝堂：皇帝、官职、主战/主和、权威、廷议、忠诚与叛逃
var COURT = (function () {
  const S = () => GAME.S;
  const P = () => GAME.S.player;
  const rnd = Math.random;

  const OFFICES = [
    { id: 'zaixiang', name: '宰相', stat: 'zheng', desc: '总领百官：全国钱 +，民心 +' },
    { id: 'shumi', name: '枢密使', stat: 'tong', desc: '掌天下兵马：征兵工耗 −，士气恢复 +' },
    { id: 'sansi', name: '三司使', stat: 'zheng', desc: '掌钱谷：全国粮 +，钱 +' },
    { id: 'hanlin', name: '翰林学士', stat: 'zhi', desc: '掌制诰文教：全国文 +' },
    { id: 'yushi', name: '御史中丞', stat: 'zhi', desc: '纠察百官：将领忠诚 +，权臣难起' },
    { id: 'dianqian', name: '殿前都指挥使', stat: 'tong', desc: '宿卫京师：都城城防 +，权威 +' },
  ];
  const EMPERORS = [
    { name: '赵构', art: 'emperor_赵构', title: '宋高宗', birth: 1107, start: 1127, end: 1162, lean: -35, note: '南渡未久，朝中和议之声甚盛' },
    { name: '赵昚', art: 'emperor_赵昚', title: '宋孝宗', birth: 1127, start: 1162, end: 1189, lean: 30, note: '朝野思奋，恢复之议复起' },
    { name: '赵惇', art: 'emperor_赵惇', title: '宋光宗', birth: 1147, start: 1189, end: 1194, lean: -5, note: '内廷多事，百官观望' },
    { name: '赵扩', art: 'emperor_赵扩', title: '宋宁宗', birth: 1168, start: 1194, end: 1224, lean: 10, note: '权在宰辅，朝议纷纭' },
    { name: '赵昀', art: 'emperor_赵昀', title: '宋理宗', birth: 1205, start: 1224, end: 1264, lean: 5, note: '理学大兴，清议日盛' },
    { name: '赵禥', art: 'emperor_赵禥', title: '宋度宗', birth: 1240, start: 1264, end: 1274, lean: -15, note: '承平日久，朝中多偷安之议' },
  ];
  const LATE_REIGN_NOTE = '朝局未定，百官共议边备与民生';
  const WAR = ['岳飞', '韩世忠', '刘锜', '吴璘', '岳云', '张宪', '牛皋', '杨再兴', '王贵', '李显忠', '张浚', '赵鼎', '虞允文', '辛弃疾', '陆游', '魏胜', '李宝', '毕再遇', '孟珙', '余玠', '文天祥', '王坚', '张珏', '陈亮', '胡铨', '韩侂胄', '岳雷', '吴挺', '赵葵', '李庭芝', '张世杰', '陆秀夫', '王彦', '杜杲', '彭义斌', '向士璧'];
  const PEACE = ['秦桧', '张俊', '万俟卨', '史浩', '史弥远', '汤思退', '贾似道', '刘光世', '范文虎', '丁大全'];
  const LOYAL = ['岳飞', '韩世忠', '岳云', '张宪', '岳雷', '文天祥', '陆秀夫', '张世杰', '孟珙', '余玠', '王坚', '张珏', '辛弃疾', '虞允文', '李庭芝', '刘锜', '姜才'];
  const AMB = { '秦桧': 95, '韩侂胄': 82, '史弥远': 88, '贾似道': 92, '张俊': 60, '吴曦': 90, '刘整': 70, '吕文焕': 55, '范文虎': 65 };
  const STANCE_NAME = { war: '主战', peace: '主和', mid: '中立' };

  function init() {
    const s = S();
    if (s.court) return;
    s.court = { auth: 55, lean: -20, offices: {}, emp: 0, wins: 0, losses: 0, lastEv: -9, log: [] };
    // 开局朝臣
    const byName = n => s.generals.find(g => g.name === n && g.f === P() && g.status === 'idle');
    const put = (o, n) => { const g = byName(n); if (g) assign(o, g.id); };
    put('zaixiang', '秦桧'); put('shumi', '张浚'); put('hanlin', '赵鼎');
  }
  function ensure(g) {
    if (g.stance) return g;
    if (WAR.includes(g.name)) g.stance = 'war';
    else if (PEACE.includes(g.name)) g.stance = 'peace';
    else {
      const mil = g.tong + g.wu >= g.zhi + g.zheng;
      const r = GEO.hash(g.id, 17, 5);
      g.stance = mil ? (r < 0.55 ? 'war' : r < 0.9 ? 'mid' : 'peace') : (r < 0.25 ? 'war' : r < 0.6 ? 'mid' : 'peace');
    }
    g.amb = AMB[g.name] != null ? AMB[g.name] : Math.round(15 + GEO.hash(g.id, 3, 9) * 45);
    if (LOYAL.includes(g.name)) g.loyal = true;
    if (g.loyalty == null) g.loyalty = 75;
    return g;
  }
  function emperor() {
    const s = S(); const c = s.court;
    if (c.emp < EMPERORS.length) return EMPERORS[c.emp];
    if (!c.genEmp) c.genEmp = { name: '赵' + GAME.pick(['昕', '昶', '昱', '昉', '晟', '暄', '曜', '曦']), title: '宋' + GAME.pick(['世宗', '显宗', '睿宗', '宪宗', '昭宗', '宣宗']), birth: s.year - 22, start: s.year, end: s.year + 25 + Math.floor(rnd() * 15), lean: Math.round(rnd() * 60 - 25), note: LATE_REIGN_NOTE };
    updateEmperorArt(c.genEmp, s.year);
    return c.genEmp;
  }
  function updateEmperorArt(emp, year) {
    const age = year - emp.birth;
    const band = age >= 50 ? 'old' : age >= 35 ? 'middle' : 'young';
    let hash = 0;
    for (let i = 0; i < emp.name.length; i++) hash = Math.imul(hash, 31) + emp.name.charCodeAt(i);
    const variant = ((hash >>> 0) % (band === 'middle' ? 4 : 3)) + 1;
    emp.art = `generic/emperor_${band}_${variant}`;
  }
  // 旧档可能保留当时的性情说明或已经排队的即位文案。
  function reignNote(title, note) {
    return EMPERORS.find(emp => emp.title === title)?.note || (note && note !== '宗室入继大统' ? note : LATE_REIGN_NOTE);
  }
  function officeOf(g) { const o = S().court.offices; for (const k in o) if (o[k] === g.id) return k; return null; }
  function holder(k) { const s = S(); if (!s.court) return null; const id = s.court.offices[k]; return id == null ? null : GAME.gen(id); }
  function assign(k, gid) {
    const c = S().court;
    const g = GAME.gen(gid);
    if (!g || g.f !== P()) return false;
    GAME.unassign(gid);
    const old = holder(k); if (old) { old.status = 'idle'; old.loc = null; }
    c.offices[k] = gid; g.status = 'court'; g.loc = k;
    ensure(g);
    g.loyalty = Math.min(100, (g.loyalty || 70) + 5);
    return true;
  }
  function vacate(k) { const c = S().court; const g = holder(k); if (g) { g.status = 'idle'; g.loc = null; } delete c.offices[k]; }
  // 官职加成（0~0.25 量级）
  function bonus(k) {
    if (!S() || !S().court) return 0;
    const g = holder(k); if (!g) return 0;
    const O = OFFICES.find(o => o.id === k);
    return Math.max(0, (g[O.stat] - 45) / 220);
  }

  // ---------- 廷议 ----------
  // motion: 'war' | 'peace'
  function members() {
    const s = S(); const out = [];
    for (const g of s.generals) {
      if (g.f !== P()) continue;
      let w = 0;
      if (g.status === 'court') w = 3; else if (g.status === 'gov') w = 1; else if (g.status === 'army') w = 1; else if (g.status === 'idle' && g.hist) w = 1;
      if (w) out.push([ensure(g), w]);
    }
    return out;
  }
  function vote(motion) {
    const c = S().court;
    const sup = [], opp = [], abs = [];
    for (const [g, w] of members()) {
      let v;
      if (g.stance === motion) v = 1;
      else if (g.stance === 'mid') v = (g.loyalty > 55 || c.auth > 60) ? 1 : 0;
      else v = g.loyalty > 88 && c.auth > 70 ? 0 : -1;
      (v > 0 ? sup : v < 0 ? opp : abs).push([g, w]);
    }
    const sw = sup.reduce((s, x) => s + x[1], 0), ow = opp.reduce((s, x) => s + x[1], 0);
    // 时议加权
    const emp = emperor();
    const ew = Math.round(Math.abs(emp.lean) / 10);
    const empSide = emp.lean >= 0 ? 'war' : 'peace';
    const supT = sw + (empSide === motion ? ew : 0), oppT = ow + (empSide !== motion ? ew : 0);
    return { motion, sup, opp, abs, sw: supT, ow: oppT, pass: supT >= oppT, emp, empSide, ew };
  }
  function applyVote(res, forced) {
    const c = S().court;
    if (res.pass) { c.auth = Math.min(100, c.auth + 2); c.lean += res.motion === 'war' ? 6 : -6; }
    else if (forced) {
      c.auth = Math.max(0, c.auth - 12);
      for (const [g] of res.opp) g.loyalty = Math.max(0, g.loyalty - 8);
      c.lean += res.motion === 'war' ? 3 : -3;
      GAME.log(`陛下乾纲独断，${res.motion === 'war' ? '决意兴兵' : '决意议和'}。反对者${res.opp.length}人，心怀怏怏。`, 'big');
    }
    c.lean = Math.max(-100, Math.min(100, c.lean));
  }

  // ---------- 每回合 ----------
  function turn() {
    const s = S(); if (!s.court || !GAME.fac(P()).alive) return;
    const c = s.court, e = GAME.E();
    // 皇帝更替
    const emp = emperor();
    if (s.year >= emp.end) {
      const old = emp;
      if (c.emp < EMPERORS.length) c.emp++; else c.genEmp = null;
      const nw = emperor();
      c.auth = Math.round(50 + (c.auth - 50) / 2);
      if (!EVENTS.offer({ ev: 'court_newemp', old: old.title, name: nw.title, nm: nw.name, note: nw.note }, 'succession')) GAME.log(nw.title + '即位，百司奉诏如常。', 'big');
    }
    // 朝议倾向随时议与群臣立场变化
    let st = 0, n = 0;
    for (const k in c.offices) { const g = GAME.gen(c.offices[k]); if (g) { ensure(g); st += g.stance === 'war' ? 1 : g.stance === 'peace' ? -1 : 0; n++; } }
    c.mom = (c.mom || 0) * Math.max(0, 1 - 0.25 * e * 4);
    const target = emperor().lean * 0.6 + (n ? st / n * 40 : 0) + c.mom * 1.5;
    const weary = GAME.fac(P()).warWeary;
    c.lean += ((target - weary / 4) - c.lean) * 0.15 * e * 4;
    c.lean = Math.max(-100, Math.min(100, c.lean));
    c.auth = Math.max(0, Math.min(100, c.auth));
    // 权威回归
    c.auth += ((50 + (holder('dianqian') ? 5 : 0)) - c.auth) * 0.05 * e * 4;
    // 将领忠诚
    const yb = holder('yushi') ? 2 : 0;
    for (const g of s.generals) {
      if (g.f !== P() || !['idle', 'army', 'gov', 'court'].includes(g.status)) continue;
      ensure(g);
      let t = 65 + (c.auth - 50) / 2 + (g.status === 'court' || g.status === 'gov' ? 8 : 0) + (g.status === 'army' ? 4 : 0) + yb * 3;
      if (g.stance === 'war' && c.lean < -30) t -= 10;
      if (g.stance === 'peace' && c.lean > 30) t -= 10;
      if (g.amb > 70) t -= (g.amb - 70) / 2;
      if (g.loyal) t = Math.max(t, 80);
      g.loyalty += Math.max(-3 * e * 4, Math.min(3 * e * 4, t - g.loyalty));
      g.loyalty = Math.max(0, Math.min(100, g.loyalty));
      // 叛逃 / 辞官
      if (!g.loyal && g.loyalty < 25 && rnd() < 0.08 * e) desert(g);
    }
  }
  function desert(g) {
    const s = S();
    if (g.status === 'army') {
      const a = GAME.army(g.loc);
      let to = null, bd = 9;
      if (a) for (const o of s.cities) if (o.f !== P() && o.f !== 'rebel' && GAME.atWar(P(), o.f)) { const d = GEO.dist(o.tile, a.tile); if (d < bd) { bd = d; to = o.f; } }
      if (a && to) {
        a.f = to; a.path = []; g.f = to; g.status = 'army';
        GAME.log(`${g.name}积怨已久，竟率所部 ${a.units.length} 营叛投【${GAME.fac(to).name}】！`, 'war', a.tile);
        s.pending.push({ ev: 'info', title: '将领叛逃', text: `${g.name}久怀不满，今率部众叛投【${GAME.fac(to).name}】。朝野震动。\n\n（提示：将领忠诚过低会叛逃。可在“将领”中赏赐，或在“朝堂”中任御史中丞以纠察百官。）` });
        S().court.auth = Math.max(0, S().court.auth - 6);
        return;
      }
    }
    GAME.unassign(g.id);
    g.status = 'gone';
    GAME.log(`${g.name}心灰意冷，挂冠而去。`, 'war');
  }
  function candidates() {
    const s = S(), c = s.court;
    const wars = Object.values(s.factions).some(f => f.alive && f.id !== 'rebel' && f.id !== P() && GAME.atWar(P(), f.id));
    const weary = GAME.fac(P()).warWeary, pool = [];
    const zx = holder('zaixiang');
    if (wars && c.lean < -25 && weary > 25) pool.push({ ev: 'court_peace' });
    if (!wars && c.lean > 35) pool.push({ ev: 'court_war' });
    if (zx && zx.amb > 70 && c.auth < 55 && !holder('yushi')) pool.push({ ev: 'court_powerful', gen: zx.id });
    const mem = members().map(x => x[0]);
    const hawks = mem.filter(g => g.stance === 'war'), doves = mem.filter(g => g.stance === 'peace');
    if (hawks.length && doves.length) pool.push({ ev: 'court_feud', a: GAME.pick(hawks).id, b: GAME.pick(doves).id });
    pool.push({ ev: 'court_remon', gen: (GAME.pick(mem) || {}).id });
    const low = mem.filter(g => g.loyalty < 45 && !g.loyal);
    if (low.length) pool.push({ ev: 'court_grudge', gen: GAME.pick(low).id });
    return pool.filter(p => p.ev !== 'court_remon' || p.gen != null);
  }
  // 由战斗/攻城调用
  function onWin(big) { const c = S().court; if (!c) return; c.mom = Math.min(20, (c.mom || 0) + (big ? 4 : 0.6)); c.auth = Math.min(100, c.auth + (big ? 2 : 0.3)); }
  function onLoss(big) { const c = S().court; if (!c) return; c.mom = Math.max(-20, (c.mom || 0) - (big ? 5 : 0.6)); c.auth = Math.max(0, c.auth - (big ? 4 : 0.4)); }
  function reward(gid) {
    const g = GAME.gen(gid), F = GAME.fac(P());
    if (F.gold < 50) return false;
    F.gold -= 50; ensure(g); g.loyalty = Math.min(100, g.loyalty + 12);
    return true;
  }

  // ---------- 朝堂事件 ----------
  const G = id => GAME.gen(id);
  const DEFS = {
    court_newemp: {
      title: '新君即位',
      text: p => `先帝${p.old}龙驭上宾（或内禅退位），陛下以${p.name}${p.nm}即皇帝位，承继大统。时，${reignNote(p.name, p.note)}。百官各怀心思，朝局为之一变。`,
      choices: [
        { t: '大赦天下，安抚百官', d: '钱 −100，群臣忠诚 +8，权威 +5', fn: () => { GAME.fac(P()).gold -= 100; for (const g of S().generals) if (g.f === P() && g.loyalty != null) g.loyalty = Math.min(100, g.loyalty + 8); S().court.auth += 5; } },
        { t: '整肃朝纲', d: '权威 +10，群臣忠诚 −3', fn: () => { S().court.auth = Math.min(100, S().court.auth + 10); for (const g of S().generals) if (g.f === P() && g.loyalty != null) g.loyalty -= 3; } },
      ],
    },
    court_peace: {
      title: '主和派上书',
      text: () => '连年用兵，府库空虚，主和诸臣联名上书：“兵连祸结，民不聊生。愿陛下遣使议和，与民休息。”',
      choices: [
        { t: '准奏，遣使议和', d: '与最强之敌议和（需对方同意），主和派忠诚 +5', fn: () => {
          const s = S(); let best = null, bp = -1;
          for (const f in s.factions) if (f !== P() && f !== 'rebel' && GAME.fac(f).alive && GAME.atWar(P(), f)) { const pw = GAME.totalPower(f); if (pw > bp) { bp = pw; best = f; } }
          for (const g of members().map(x => x[0])) if (g.stance === 'peace') g.loyalty += 5;
          if (best) { const r = GAME.proposePeace(P(), best); GAME.log(r.msg, 'dip'); }
        } },
        { t: '驳回，战事继续', d: '主和派忠诚 −6，朝议倾向主战 +8', fn: () => { for (const g of members().map(x => x[0])) if (g.stance === 'peace') g.loyalty -= 6; S().court.lean += 8; } },
      ],
    },
    court_war: {
      title: '北伐之议',
      text: () => '主战诸臣慷慨陈词：“中原遗民，南望王师又一年！今兵精粮足，正宜挥师北上，克复神州。”',
      choices: [
        { t: '嘉其忠勇，厉兵秣马', d: '主战派忠诚 +6，权威 +2（不必立即开战）', fn: () => { for (const g of members().map(x => x[0])) if (g.stance === 'war') g.loyalty += 6; S().court.auth += 2; } },
        { t: '时机未到', d: '主战派忠诚 −6，朝议倾向主和', fn: () => { for (const g of members().map(x => x[0])) if (g.stance === 'war') g.loyalty -= 6; S().court.lean -= 8; } },
      ],
    },
    court_powerful: {
      title: '权臣擅权',
      text: p => `宰相${G(p.gen).name}久居相位，门生故吏遍布朝野，台谏噤声，奏章多不得上达天听。`,
      choices: [
        { t: '罢其相位', d: p => `${G(p.gen).name}去职，权威 −8，其忠诚大降`, fn: p => { const g = G(p.gen); vacate('zaixiang'); g.loyalty -= 30; S().court.auth -= 8; GAME.log(`罢${g.name}相位。`, 'big'); } },
        { t: '优容之', d: '权威 −5，钱 +80（权臣进献）', fn: () => { S().court.auth -= 5; GAME.fac(P()).gold += 80; } },
        { t: '任御史中丞以制衡', d: '需在朝堂中任命御史中丞；本次权威 −2', fn: () => { S().court.auth -= 2; } },
      ],
    },
    court_feud: {
      title: '文武相争',
      text: p => `主战的${G(p.a).name}与主和的${G(p.b).name}于朝堂之上争执不下，互相弹劾。`,
      choices: p => [
        { t: `支持${G(p.a).name}`, d: '朝议倾向主战 +12，对方忠诚 −12', fn: () => { S().court.lean += 12; G(p.b).loyalty -= 12; G(p.a).loyalty += 5; } },
        { t: `支持${G(p.b).name}`, d: '朝议倾向主和 +12，对方忠诚 −12', fn: () => { S().court.lean -= 12; G(p.a).loyalty -= 12; G(p.b).loyalty += 5; } },
        { t: '各打五十大板', d: '双方忠诚 −5，权威 +3', fn: () => { G(p.a).loyalty -= 5; G(p.b).loyalty -= 5; S().court.auth += 3; } },
      ],
    },
    court_remon: {
      title: '谏臣直言',
      text: p => `${G(p.gen).name}上疏直言时弊，言辞激切，指斥宫闱用度奢靡、边备废弛。`,
      choices: [
        { t: '虚心纳谏', d: '钱 −40，全国民心略升，进谏者忠诚 +10', fn: p => { GAME.fac(P()).gold -= 40; G(p.gen).loyalty += 10; for (const c of GAME.citiesOf(P())) c.loyalty = Math.min(100, c.loyalty + 2); } },
        { t: '留中不发', d: '无事', fn: () => {} },
        { t: '治其谤讪之罪', d: '权威 +4，群臣忠诚 −4', fn: p => { S().court.auth += 4; for (const g of members().map(x => x[0])) g.loyalty -= 4; } },
      ],
    },
    court_grudge: {
      title: '将相怨望',
      text: p => `${G(p.gen).name}屡有怨言，自称功高而赏薄。左右密奏，恐其生变。`,
      choices: [
        { t: '厚加封赏', d: '钱 −120，其忠诚 +30', fn: p => { GAME.fac(P()).gold -= 120; G(p.gen).loyalty += 30; } },
        { t: '温言抚慰', d: '其忠诚 +10，权威 −2', fn: p => { G(p.gen).loyalty += 10; S().court.auth -= 2; } },
        { t: '削其兵权', d: '解除其职务，忠诚 −15，权威 +3', fn: p => { GAME.unassign(p.gen); G(p.gen).loyalty -= 15; S().court.auth += 3; } },
      ],
    },
  };
  function register() { if (typeof EVENTS !== 'undefined') Object.assign(EVENTS.DEFS, DEFS); }
  register();
  return { candidates, OFFICES, EMPERORS, STANCE_NAME, init, ensure, emperor, updateEmperorArt, reignNote, holder, assign, vacate, bonus, officeOf, vote, applyVote, turn, onWin, onLoss, reward, members };
})();
if (typeof module !== 'undefined') module.exports = COURT;
