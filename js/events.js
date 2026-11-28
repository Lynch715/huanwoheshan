// 事件：开局抉择、科举、史实大事、随机事件
var EVENTS = (function () {
  const G = () => GAME.S;
  const fac = id => GAME.fac(id);
  const byName = n => G().cities.find(c => c.name === n);
  const genByName = n => G().generals.find(g => g.name === n);
  const alive = f => fac(f) && fac(f).alive;
  const P = () => G().player;
  const r = () => Math.random();

  function nearestOwnCity(f, tile) {
    let best = null, bd = 1e9;
    for (const c of G().cities) if (c.f === f) { const d = GEO.dist(c.tile, tile); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  function freeTileNear(t, rad) {
    for (const x of GEO.ring(t, rad || 3)) if (!GEO.isWater(x) && !GAME.armyAt(x) && !GAME.cityAt(x)) return x;
    return -1;
  }
  function spawnArmy(f, nearTile, units, genName, name) {
    let t = nearTile;
    if (GAME.armyAt(t) || GEO.isWater(t) || (GAME.cityAt(t) && GAME.cityAt(t).f !== f)) t = freeTileNear(nearTile, 4);
    if (t < 0) return null;
    let g = genName ? genByName(genName) : null;
    if (g && (!['idle', 'future'].includes(g.status) || g.wound > 0 || g.f === P() && f !== P())) g = null;
    if (g) { g.f = f; g.status = 'idle'; }
    else g = GAME.randomGeneral(f, 'mil', 62);
    const a = GAME.createArmyRaw(f, t, units.map(u => GAME.mkUnit(u)), g.id, name || '');
    a.morale = 90;
    return a;
  }
  const rep = (arr, n) => { const o = []; for (let i = 0; i < n; i++) o.push(arr[i % arr.length]); return o; };
  function renameFaction(f, name, seal) { const F = fac(f); F.name = name; if (seal) F.seal = seal; }
  function worldLog(text, fs, response) {
    if (response) historyDispatch.set(response, text);
    if (response || recordingHistory || !fs || fs.some(f => fac(P()).met[f])) GAME.log(text, 'world');
  }

  const owned = (id, f) => { const c = GAME.city(id); return alive(f) && c && c.f === f ? c : null; };
  const ownedName = (name, f) => { const c = byName(name); return c ? owned(c.id, f) : null; };
  const capital = f => alive(f) ? owned(fac(f).capital, f) : null;
  const changeLoyalty = (c, n) => { c.loyalty = GAME.clamp(c.loyalty + n, 0, 100); };
  const active = g => ['idle', 'army', 'gov', 'court'].includes(g.status);
  function activeIn(name, f) {
    const g = genByName(name);
    return g?.hist && g.f === f && active(g);
  }
  const reinforce = (c, types) => c.garrison.push(...types.map(t => GAME.mkUnit(t, 80)));
  const mayFight = (a, b) => alive(a) && alive(b) && !GAME.allied(a, b) &&
    (GAME.atWar(a, b) || GAME.getRel(a, b).truce <= 0);
  const hasLead = (a, b, ratio) => GAME.totalPower(a) >= GAME.totalPower(b) * ratio;
  function nearCity(f, tile, radius, accept = () => true) {
    let best = null, dist = radius + 1;
    for (const c of GAME.citiesOf(f)) {
      const n = GEO.dist(c.tile, tile);
      if (n < dist && accept(c)) { best = c; dist = n; }
    }
    return best;
  }
  function warArmy(a, b, city, units, leader, name) {
    if (!mayFight(a, b)) return null;
    const g = leader && genByName(leader);
    const army = spawnArmy(a, city.tile, units, g && g.f === a && active(g) ? leader : null, name);
    if (army) GAME.declareWar(a, b, true);
    return army;
  }
  function mongolCampaignOrders(stage) {
    if (!GAME.mongolCampaign('mongol')) return;
    const F = fac('mongol'), seats = GAME.citiesOf('mongol');
    if (!seats.length) return;
    const east = DATA.MONGOL_RISE.opponents.slice().reverse().find(alive);
    const west = ['xiliao', 'khwarazm', F.mongolWestRival, westernSuccessor()].find(f => alive(f) && !GAME.allied('mongol', f));
    const south = G().year >= DATA.MONGOL_RISE.songWarYear && alive('song') &&
      GAME.totalPower('song') > GAME.totalPower('jin') && r() < 0.30;
    const openWest = G().year >= 1211 && east === 'jin' && GAME.citiesOf('jin').length <= 3;
    const target = (openWest && west) || east || (south ? 'song' : west);
    if (!target) return;
    F.mongolFront = target;
    if (!GAME.atWar('mongol', target)) GAME.declareWar('mongol', target, true);
    if (stage === 'west' && target === west) {
      const seat = seats.reduce((a, b) => GEO.colOf(a.tile) <= GEO.colOf(b.tile) ? a : b);
      spawnArmy('mongol', seat.tile, rep(['hbow', 'hbow', 'hcav', 'cav'], 9), '哲别');
      spawnArmy('mongol', seat.tile, rep(['hbow', 'hbow', 'hcav', 'siege'], 9), '拖雷');
    }
    worldLog(`蒙古诸军誓师，兵锋指向${fac(target).name}。`, ['mongol', target]);
  }
  function westernSuccessor() {
    const holdings = {};
    for (const c of G().cities) {
      if (!['xiliao', 'khwarazm'].includes(c.origF) || ['mongol', 'rebel', P()].includes(c.f) || !alive(c.f)) continue;
      holdings[c.f] = (holdings[c.f] || 0) + 1;
    }
    return Object.keys(holdings).sort((a, b) => holdings[b] - holdings[a])[0] || null;
  }
  function mongolMuster(first = false) {
    const rule = DATA.MONGOL_RISE, year = G().year;
    if (!GAME.mongolCampaign('mongol') || (!first && year >= rule.musterEnd)) return;
    const F = fac('mongol');
    if (first && !alive('jin')) F.mongolWestRival = westernSuccessor();
    const west = F.mongolWestRival;
    if (!first && !alive('jin') && !alive('xia') && !alive(west)) return;
    const cities = GAME.citiesOf('mongol');
    if (!cities.length || F.mongolMusterYear === year) return;
    F.mongolMusterYear = year;
    const front = alive('xia') ? 'xia' : alive('jin') ? 'jin' : west;
    if (!F.mongolFront || !alive(F.mongolFront) || front && !GAME.atWar('mongol', front)) mongolCampaignOrders('annual');
    // 奉诸部岁馈养兵，以实际军费补窠缺，避免扩军后连年欠饷。
    const { gold = 0, upkeep = 0, food = 0, foodUp = 0 } = F.income;
    F.gold += Math.max(0, upkeep - gold) * 4;
    F.food += Math.max(0, foodUp - food) * 4;
    if (first) F.gold += rule.gold;
    // 诸部原属城留足戍军，野战兵额另算。
    for (const c of cities) {
      if (!rule.tribes.includes(c.origF)) continue;
      while (c.garrison.length < rule.garrison) c.garrison.push(GAME.mkUnit('hbow', 85));
    }
    const totals = { mongol: 0, jin: 0, xia: 0 };
    if (alive(west)) totals[west] = 0;
    for (const a of G().armies) if (Object.hasOwn(totals, a.f) && a.frontier == null) totals[a.f] += GAME.sumStr(a.units);
    const rival = rule.opponents.concat(alive(west) ? west : []).reduce((a, b) => totals[a] >= totals[b] ? a : b);
    const xia = GAME.citiesOf('xia');
    // 孤城可受近军招抚。久战无援时，即使远离牙帐也可遣使纳附。
    F.mongolXiaAloneYear = xia.length === 1 ? F.mongolXiaAloneYear ?? year : null;
    const host = Math.max(totals.mongol, rule.fieldFloor);
    const nearby = xia.length === 1 && totals.xia * 4 < host && cities.some(c => GEO.dist(c.tile, xia[0].tile) <= 12);
    const stranded = F.mongolXiaAloneYear != null && year - F.mongolXiaAloneYear >= 2 && totals.xia * 2 < host;
    if (xia.length === 1 && GAME.atWar('mongol', 'xia') && (nearby || stranded)) {
      GAME.captureCity(xia[0], 'mongol');
      F.mongolCaptureT = G().T;
      worldLog(`西夏孤城失援，${xia[0].name}纳附蒙古。`, ['mongol', 'xia']);
      mongolCampaignOrders('annual');
    }
    const target = Math.max(totals[rival] * rule.armyShare, rule.fieldFloor);
    const units = Math.max(0, Math.ceil((target - totals.mongol) / 500));
    if (!units) return;
    const leaders = first ? ['铁木真', '木华黎', '哲别', '速不台', '博尔术'] : [];
    const formations = Math.ceil(units / 7);
    const types = ['siege', 'mongol_keshig_guard', 'mongol_keshig', 'hbow', 'hcav', 'cav', 'hbow'];
    const focus = F.mongolFront && alive(F.mongolFront) ? F.mongolFront : rival;
    const frontier = GAME.citiesOf(focus);
    const distance = c => frontier.reduce((nearest, target) => Math.min(nearest, GEO.dist(c.tile, target.tile)), Infinity);
    cities.sort((a, b) => distance(a) - distance(b));
    const bases = cities.slice(0, Math.max(2, Math.ceil(cities.length / 2)));
    let mobilized = 0;
    for (let i = 0, remaining = units; i < formations; i++) {
      const count = Math.ceil(remaining / (formations - i));
      remaining -= count;
      const a = spawnArmy('mongol', bases[i % bases.length].tile, types.slice(0, count), leaders[i]);
      if (a) { a.morale = GAME.moraleCap('mongol'); mobilized += count; }
    }
    F.gold += mobilized * 36;
    F.horse = Math.min(300, F.horse + mobilized * 3);
    F.man += mobilized * 5;
    F.food += mobilized * 12;
  }
  function plagueLoss(p, pop, morale, spread) {
    const origin = GAME.city(p.city);
    if (origin?.f !== P()) return;
    const factor = COURT.holder('taiyi') ? 0.5 : 1;
    const affected = spread ? GAME.citiesOf(P()).filter(c => GEO.dist(c.tile, origin.tile) <= 5) : [origin];
    for (const c of affected) {
      c.pop = Math.max(1, c.pop - (c === origin ? pop : 2) * factor);
      changeLoyalty(c, -(c === origin ? morale : 6) * factor);
    }
  }

  // ---------- 玩家抉择事件 ----------
  const ENDINGS = {
    endingRestoration: {
      title: '还我河山',
      text: '东援汴水，西抵伊洛，两京旧疆复闻宋鼓。父老持壶浆迎于道，守臣校城券、清版籍，使离散之民得寻故里。诏先葺桥梁仓廪，次修庙学，宽新附之地租役。史臣书曰：守土易言，复土最艰。自南渡以来数世之望，至是得偿。愿后之治斯土者，念田庐复业之难，勿以新得之地轻试兵锋。',
    },
    endingHuanglong: {
      title: '直捣黄龙',
      text: '北音迭至，燕山以外城邑更主，金国旧势至此瓦解。宋廷集边臣议守御，择通其语言者出使沿边，约束行伍，毋扰部落。史臣追记诸将北望之日，往往只求渡河一步；至于今日，山河形势已非南渡之初。昔日誓言尚传江左，至于塞上人家，其所盼者，亦不过岁岁安耕。',
    },
    endingProsperity: {
      title: '中兴之治',
      text: '五稔之间，边城无一易帜，州县输纳有度，官仓积粟，府库有余。闾里稍息流亡之苦，士习礼让，农得尽力于畎亩。天子召有司录其盈虚，告诫诸臣，毋因岁富而滋横敛。史臣曰：战功可刻于碑，民生须验于户。能使远近各安其业，持此以久，斯可称中兴之治。',
    },
    endingMaritime: {
      title: '海上称雄',
      text: '诸港相望，海舶依信风往返，带异域香药而来，载丝帛瓷器而去。市舶所入渐为经费之大宗，守臣修澳补仓，量潮立表，使客舟有所凭依。史臣曰：先朝以漕渠济京师，今又得沧海之利。善守此业者，宜平交易，禁侵渔，恤覆舟之客，使四方商旅乐与宋人相市。',
    },
    victory: {
      title: '万国来朝',
      text: '自绍兴北伐，累朝遣将守边，转粟千里，始克一城，终拓万方。旧日列国都城，悉入大宋版图；道路复通，远近使者以节相见。礼官陈图于殿上，百官贺而天子命减新附诸州之赋。史臣书曰：能克其城，武功也；能纳殊俗，各安所业，乃治功也。此后史笔未歇，愿见海内长治。',
    },
    endingRetreat: {
      title: '偏安江南',
      text: '岁至一二七九，江南犹奉宋朔，北望汴都，旧宫仍在封域之外。舟楫能通，仓廪尚存，州县按籍而治，宗祀未绝；然南渡父老多已谢世，子孙但从家牒知故乡之名。史臣掩卷良久，记曰：存社稷者有功，负收复之志者有憾。江山事业付于后人，今日所守，仍可为异日立足之地。',
    },
    endingUnify: {
      title: '海内一统',
      text: '诸州尽奉宋朔，舆图归于一统。史臣展卷，次第录疆土、文治与武功，俾后人观一代得失。',
    },
    endingDefeat: {
      title: '社稷倾覆',
      text: '末府失守，符节不复得通，奔走之臣各收诰敕、图籍以避乱。仓卒之际，百姓携老幼离城，朝廷已无一州可诏。史臣于灯下检诸军旧牍，见经略并非一日尽失，往往先耗于调度，继失于人心。遂书此章，以存守土之士与流离之民，俟异日读者知一国之亡所由。',
    },
  };
  const endingEvent = (id, keepPlaying = '继续经营') => ({
    ...ENDINGS[id],
    choices: [{ t: keepPlaying, fn: () => {} }, { t: '就此封笔', fn: () => {} }],
  });

  function peaceTerms(other) {
    const { returning, releasing } = GAME.peaceCaptives(P(), other);
    if (!returning.length && !releasing.length) return '';
    const names = list => list.map(g => g.name).join('、') || '无';
    return `和约互归俘将。归朝：${names(returning)}；放回：${names(releasing)}。若欲招降所俘敌将，须先处置，再议和。`;
  }

  const DEFS = {
    frontierSpoils: {
      title: '寨破善后',
      text: p => {
        const { name, rule } = GAME.campSpoils(p.point);
        return `${name}已破，钱 ${rule.gold}、粮 ${rule.food}已缴入官。降众候命，寨中所藏亦待清点，请陛下裁处。`;
      },
      choices: [
        { t: '招降入籍', d: p => {
          const { g, rule } = GAME.campSpoils(p.point);
          return `丁口 +${rule.man}${g ? '，' + g.name + '来归，可任军职' : ''}`;
        }, fn: p => GAME.resolveCampSpoils(p.point, 'recruit') },
        { t: '收缴寨藏', d: p => {
          const { item } = GAME.campSpoils(p.point);
          return item ? `【${DATA.ITEMS[item].name}】入府库 · ${DATA.ITEMS[item].desc}` :
            `钱 +${DATA.FRONTIER.bonusGold}，铁 +${DATA.FRONTIER.bonusIron}`;
        }, fn: p => GAME.resolveCampSpoils(p.point, 'loot') },
      ],
    },
    jinpai: {
      title: '十二道金牌',
      text: () => '郾城一战，金兀术拐子马、铁浮屠尽为岳家军所破，中原父老箪食壶浆以迎王师。然朝中秦桧力主和议，奏请急发十二道金字牌，催岳飞班师。\n\n岳飞北望中原，上表请乘胜北进。\n\n陛下，此诏发与不发，在此一念。',
      choices: [
        { t: '发金牌，召岳飞班师，与金议和', d: () => `岁币 25 贯/季，和约 ${GAME.peaceTruce('song', 'jin', { truce: 40 })} 季；岳家军南撤。` + peaceTerms('jin'), fn: () => {
          GAME.makePeace('song', 'jin', { from: 'song', to: 'jin', amt: 25, turns: 80 }, { truce: 40 });
          for (const a of G().armies.filter(a => a.f === 'song')) {
            const o = GAME.tileOwner(a.tile);
            if (o !== 'song') { const c = nearestOwnCity('song', a.tile); const t = freeTileNear(c.tile, 3); if (t >= 0) { a.tile = t; a.path = []; } }
          }
          G().flags.qin = 'power'; G().flags.morale = -3;
          G().pending.push({ ev: 'info', title: '御前须知', text: '和议既成，宋金暂息兵戈。陛下可趁此休养生息：兴修圩田、广设书院、开辟海路，待国力充盈，再图北伐。\n\n· 点选城池，在「内政」中营建、「军务」中征兵与组建军团。\n· 临海之城建市舶司，可与南洋、天竺、大食通商。\n· 和约未满而兴兵，则近邦与敌之盟国多有非议。\n\n十年生聚，十年教训，河山终当归我。' });
          GAME.log('诏岳飞班师。绍兴和议成，宋金以淮水—大散关为界。', 'big');
        } },
        { t: '金牌留中不发，命岳飞乘胜北进', d: '战事继续，岳家军士气大振；主和诸臣必有反扑', fn: () => {
          for (const a of G().armies.filter(a => a.f === 'song')) a.morale = 100;
          G().flags.qin = 'angry'; G().flags.qinTurn = G().T + 2; G().flags.morale = 3;
          G().pending.push({ ev: 'info', title: '御前须知', marchGuide: true, text: '岳家军已逼近汴京，然金兀术主力犹在，诸路金军虎视眈眈。\n\n· 点选军队，右键目标即可行军或进攻。攻城宜先以重兵扫清城外敌军。\n· 点选城池，在「内政」中营建、「军务」中征兵与组建军团。\n· 顶栏「研究」可定科技方向；「将领」中可委任知州。\n· 每三年春开科取士，史上名臣将陆续登场。\n\n愿陛下早日还我河山！' });
          GAME.log('金牌留中不发。诏岳飞乘胜北进，直捣黄龙。岳飞上表谢恩：「臣愿提兵北上，迎还二圣，收复故疆。」', 'big');
        } },
      ],
    },
    qinhui: {
      title: '秦桧构陷',
      text: () => '宰相秦桧连上奏章，指岳飞拥兵自重、跋扈难制，请以「莫须有」之罪下狱。主和派群臣附议，朝堂汹汹。\n\n韩世忠当廷质问：「『莫须有』三字，何以服天下？」',
      choices: [
        { t: '罢黜秦桧，一意北伐', d: '秦桧去位，主战派当政；民心大振，金国震怒', fn: () => {
          const q = genByName('秦桧'); if (q && q.status !== 'dead') { GAME.unassign(q.id); q.status = 'gone'; }
          G().flags.qin = 'gone'; G().flags.morale = 6;
          GAME.getRel('song', 'jin').op -= 20;
          GAME.log('诏罢秦桧相位，贬居永州。朝野称快，「还我河山」之声遍于江淮。', 'big');
        } },
        { t: '留用秦桧，以安朝局', d: '秦桧善于理财，每年额外入钱；但民心略降', fn: () => {
          G().flags.qin = 'kept'; G().flags.morale = 0;
          GAME.log('诏留秦桧于相位，岳飞仍掌兵权。朝堂暗流涌动。', 'info');
        } },
      ],
    },
    captured: {
      title: c => '克复' + GAME.city(c.city).name,
      text: c => { const cc = GAME.city(c.city); return `王师入${cc.name}，城中户口约 ${cc.pop} 万。将士请示：如何处置城中百姓与府库？`; },
      choices: [
        { t: '出榜安民，开仓赈济', d: c => `钱 -${GAME.city(c.city).pop * 8}，民心 +20`, fn: c => { const cc = GAME.city(c.city); fac(P()).gold -= cc.pop * 8; cc.loyalty = Math.min(100, cc.loyalty + 20); cc.unrest = Math.max(0, cc.unrest - 15); } },
        { t: '犒赏三军，清点府库', d: '无额外得失', fn: () => {} },
        { t: '纵兵劫掠', d: c => `钱 +${GAME.city(c.city).pop * 25}，人口 -2，民心大降`, fn: c => { const cc = GAME.city(c.city); fac(P()).gold += cc.pop * 25; cc.pop = Math.max(1, cc.pop - 2); cc.loyalty = Math.max(0, cc.loyalty - 15); cc.unrest += 20; } },
      ],
    },
    battleCaptive: {
      title: '阵前获将',
      text: p => `敌将${p.name}已押至军前。${p.loot?.length ? `缴得${GAME.itemNames(p.loot)}，已入府库。` : ''}诸将请定去留。此人或可为我用，然心志未明，须审其言。`,
      choices: [
        { t: '晓以恩义，试令来降', d: '俘将越忠于故主、越有智略，越难招降', fn: p => {
          const g = battlePrisoner(p.gen);
          if (!g) return;
          const chance = GAME.clamp(0.95 - Math.max(0, g.zhi - 45) / 120 - Math.max(0, g.loyalty - 75) / 150, 0.25, 0.95);
          const joined = r() < chance && GAME.recruitCaptive(p.gen, P());
          GAME.log(joined ? `${p.name}愿归本朝，候补军职。` : `${p.name}暂无归意，仍收军中。`, 'war');
        } },
        { t: '依军法处斩', d: '若敌国尚存，其好感 −25，胜军士气 +10', fn: p => {
          const g = battlePrisoner(p.gen);
          if (!g) return;
          const enemy = g.f;
          GAME.executeCaptive(g.id);
          if (alive(enemy)) GAME.getRel(P(), enemy).op = Math.max(-100, GAME.getRel(P(), enemy).op - 10);
          moraleAfterBattle(p.army, 10);
        } },
        { t: '释归故国', d: '若敌国尚存，其好感 +12。朝议倾和，主和朝臣忠诚 +4', fn: p => {
          if (!battlePrisoner(p.gen)) return;
          GAME.releaseCaptive(p.gen);
          const court = G().court;
          if (!court) return;
          court.lean = GAME.clamp(court.lean - 6, -100, 100);
          for (const id of Object.values(court.offices)) {
            const g = GAME.gen(id);
            if (g && g.f === P() && g.stance === 'peace') g.loyalty = GAME.clamp(g.loyalty + 4, 0, 100);
          }
        } },
      ],
    },
    battleWound: {
      title: '大将负创',
      text: p => `${p.name}力战负创。医者请留之调养，创愈方可复领兵。`,
      choices: [
        { t: '遣良医调治', d: '钱 −45，伤期缩短一季', fn: p => {
          const g = playerGeneral(p.gen);
          if (!g || !(g.wound > 0) || fac(P()).gold < 45) return;
          fac(P()).gold -= 45;
          g.wound = Math.max(0, g.wound - 1);
          recoverBattleWounds();
        } },
        { t: '令归家养伤', d: '按原期休养', fn: () => {} },
      ],
    },
    battleDeath: {
      title: '大将死事',
      text: p => `${p.name}殿后拒敌，终不复还。军报已至，众请收敛遗骸，记其军功于册。`,
      choices: [{ t: '收葬立籍', d: '依军中旧例安葬', fn: () => {} },
        { t: '赐帛恤其家', d: '钱 −40，权威 +2', fn: () => { fac(P()).gold -= 40; courtAuthority(2); } }],
    },
    battleUnderdog: {
      title: '以少制众',
      text: p => `${p.name}所部未及敌军之半，奋战而胜。诸州争传捷书，请录其功以劝部伍。`,
      choices: [{ t: '有司叙功', d: '主将经验 +70，邻近我城民心 +4，权威 +2', fn: p => {
        const g = playerGeneral(p.gen), c = owned(p.city, P());
        if (g) GAME.gainExp(g.id, 70);
        if (c) changeLoyalty(c, 4);
        courtAuthority(2);
      } }, { t: '颁缗犒士', d: '钱 −40，兵源 +10', fn: () => { fac(P()).gold -= 40; fac(P()).man += 10; } }],
    },
    battleOccupation: {
      title: p => `${p.name}城破`,
      text: p => `王师入${p.name}，户口尚众，诸坊闭户以待军令。可禁军中扰民，发帑犒师，亦可迁其豪族并籍余赀。`,
      choices: [
        { t: '秋毫无犯', d: '民心 +18，动乱 −12', fn: p => {
          const c = owned(p.city, P());
          if (!c) return;
          changeLoyalty(c, 18);
          c.unrest = Math.max(0, c.unrest - 12);
        } },
        { t: '发帑犒军', d: '钱 −90，克城军士气 +22', fn: p => {
          const a = playerArmy(p.army);
          if (!a || !owned(p.city, P()) || fac(P()).gold < 90) return;
          fac(P()).gold -= 90;
          moraleAfterBattle(a.id, 22);
        } },
        { t: '迁其豪族', d: '钱 +140，民心 −12，动乱 +10', fn: p => {
          const c = owned(p.city, P());
          if (!c) return;
          fac(P()).gold += 140;
          changeLoyalty(c, -12);
          c.unrest += 10;
        } },
      ],
    },
    battleHeld: {
      title: '坚城有功',
      text: p => `${p.name}拒敌保全，知州${p.governor}督诸坊输薪运粮，戍卒得以再战。军民候朝廷诏赏。`,
      choices: [
        { t: '论功褒奖', d: '知州忠诚 +10，本城民心 +5', fn: p => {
          const c = owned(p.city, P()), g = playerGeneral(p.gen);
          if (!c || !g || c.governor !== g.id) return;
          g.loyalty = GAME.clamp(g.loyalty + 10, 0, 100);
          changeLoyalty(c, 5);
        } },
        { t: '令其整饬守具', d: '本城恢复 18 城防', fn: p => {
          const c = owned(p.city, P());
          if (c) c.wall = Math.min(GAME.maxWall(c), c.wall + 18);
        } },
      ],
    },
    battleLost: {
      title: '失城问罪',
      text: p => `${p.name}已失，溃卒赴关，守臣去向不一。${p.governor ? `朝议请核知州${p.governor}守备之责。` : '朝议请按验军籍，追查守备诸臣。'}`,
      choices: [
        { t: '遣台臣核责', d: p => p.gen == null ? '权威 +2' : '权威 +2，知州仍在任用者忠诚 −12', fn: p => {
          const g = playerGeneral(p.gen);
          if (g) g.loyalty = GAME.clamp(g.loyalty - 12, 0, 100);
          courtAuthority(2);
        } },
        { t: '收抚溃卒，再议处分', d: '粮 −55，兵源 +8', fn: () => {
          const f = fac(P());
          if (f.food >= 55) { f.food -= 55; f.man += 8; }
        } },
      ],
    },
    battleFame: {
      title: '以谋名军',
      text: p => `${p.name}屡以奇策得手，近又用${p.plan}，军吏相传其法。请奖其能，令诸军取法。`,
      choices: [{ t: '录其筹策', d: p => p.skill ? `习得【${p.skill}】` : '记名嘉勉，经验 +60', fn: p => {
        const g = playerGeneral(p.gen);
        if (!g) return;
        if (p.skill && !GAME.hasSkill(g, p.skill) && GAME.skillList(g).length < 3) GAME.applyLevel(g, { k: 'skill', s: p.skill });
        else GAME.gainExp(g.id, 60);
      } }, { t: '付学官编入武经讲义', d: '文教 +45，权威 +1', fn: () => { fac(P()).sci += 45; courtAuthority(1); } }],
    },
    battleStalled: {
      title: '屯兵坚城之下',
      text: p => `${p.name}久攻未克，前队折损。偏将请撤下重整，军中亦有请发帑犒疲卒者。`,
      choices: [
        { t: '发帑整军', d: '钱 −60，本部士气 +14', fn: p => {
          if (!playerArmy(p.army) || fac(P()).gold < 60) return;
          fac(P()).gold -= 60;
          moraleAfterBattle(p.army, 14);
        } },
        { t: '暂收营伍', d: '本部士气 +4', fn: p => moraleAfterBattle(p.army, 4) },
      ],
    },
    battleRally: {
      title: '收拢败卒',
      text: () => '战后散卒陆续还营，沿路多有人扶病求归。军前报请，或给粟收留，或令乡县领归。',
      choices: [
        { t: '给粟收拢', d: '粮 −50，兵源 +10', fn: () => {
          const f = fac(P());
          if (f.food >= 50) { f.food -= 50; f.man += 10; }
        } },
        { t: '遣归休养', d: '邻近我城民心 +3', fn: p => {
          const c = owned(p.city, P());
          if (c) changeLoyalty(c, 3);
        } },
      ],
    },
    hdjd: {
      title: '还于旧都',
      text: () => '汴京克复！宗庙社稷、艮岳宫阙，虽经兵燹，犹见旧观。群臣议：是否还都汴京，以示恢复中原之志？',
      choices: [
        { t: '还都汴京', d: '都城迁至汴京，全国民心长期 +4', fn: () => {
          const next = ownedName('汴京', P());
          if (!next) return;
          GAME.setCapital(next);
          G().flags.morale = (G().flags.morale || 0) + 4;
          GAME.log('车驾北还，告祭太庙于汴京。', 'big');
        } },
        { t: '仍驻临安', d: '江南富庶，暂不迁都', fn: () => {} },
      ],
    },
    keju: {
      title: '殿试放榜',
      type: 'pick',
      text: p => `三年大比，礼部会试已毕，诸进士、武举人集于集英殿候旨。可录 ${p.max} 人入仕（每人俸禄 2 贯/季）。`,
    },
    recommend: {
      title: '州郡荐举',
      type: 'pick',
      text: p => `春诏求才，诸州举其通晓吏事者入阙。请择贤授职，至多录 ${p.max} 人；亦可悉留乡里。`,
    },
    oldOfficial: {
      title: '旧吏请降',
      text: p => `${GAME.city(p.city).name}初定，旧吏${GAME.gen(p.gen).name}奉籍来见，愿为新朝效力。`,
      choices: [
        { t: '纳其所献，留用旧吏', d: '得文臣一员，忠诚 45', fn: p => settleFormerOfficial(p, true) },
        { t: '不授官，遣归乡里', d: '', fn: p => settleFormerOfficial(p, false) },
      ],
    },
    coalitionQuestion: {
      title: '诸国遣使诘问',
      text: p => `${p.members.map(f => fac(f).name).join('、')}遣使至阙，问我朝举兵之由。若不释其疑，诸国或于一二季内歃血会盟。`,
      choices: [
        { t: '厚礼安抚', d: p => {
          const { cost, opinion, terms } = GAME.coalitionGiftTerms(p), durations = new Map();
          for (const { f, seasons } of terms) {
            if (!durations.has(seasons)) durations.set(seasons, []);
            durations.get(seasons).push(fac(f).name);
          }
          const wait = durations.size === 1 ? `各国 ${terms[0].seasons} 季内不从合纵` :
            [...durations].map(([seasons, names]) => `${names.join('、')} ${seasons} 季内不从合纵`).join('；');
          return `费钱 ${cost} 贯，各国好感 +${opinion}${wait ? '，' + wait : ''}`;
        }, fn: p => GAME.answerCoalition(p, 'gift') },
        { t: '上表陈情', d: p => p.justified ? '出师有名，各国好感 +8' : '出师无可陈之名，此议不增好感', fn: p => GAME.answerCoalition(p, 'explain') },
        { t: '置之不理', d: '使臣空返，诸国可于一季后会盟', fn: p => GAME.answerCoalition(p, 'ignore') },
      ],
    },
    leagueMuster: {
      title: '诸国会盟',
      text: p => `【${fac(p.leader).name}】执诸国牛耳，与${p.members.filter(f => f !== p.leader).map(f => fac(f).name).join('、')}歃血为盟。探报诸国约于${p.delay === 1 ? '下季' : '两季之后'}同日犯境，宜早为之备。`,
      choices: [{ t: '朕知之', fn: () => {} }],
    },
    vassalAnnex: {
      title: p => fac(p.from).name + '请纳土',
      text: p => `【${fac(p.from).name}】奉藩有年，今遣使携版籍至阙，愿尽纳山川城邑，编户为我朝之民。`,
      choices: [
        { t: '准其纳土归附', d: '诸城并入我朝，计入一统', fn: p => GAME.annexVassal(p.from) },
        { t: '仍令奉藩如故', d: '保有其国，照旧进贡', fn: () => {} },
      ],
    },
    marriageRequest: {
      title: p => fac(p.from).name + '遣使求亲',
      text: p => `【${fac(p.from).name}】挟兵威遣使至阙，请我朝下嫁宗室女。群臣以为此议有损国体，然边患未息，亦有主张姑为缓计者。`,
      choices: [
        { t: '许之', d: p => {
            const terms = GAME.marriageRequestTerms(p.from);
            const effect = terms.war ? '两军仍战，彼国议和意愿 +20' : `彼国 ${terms.protection} 季内不犯边`;
            return `宗室女 −1，嫁妆 ${terms.cost} 贯，好感 +30。${effect}。权威 −6，朝议偏和 10，主战者忠诚 −5${terms.enabled ? '' : '。国帑不足'}`;
          }, disabled: p => !GAME.marriageRequestTerms(p.from).enabled, fn: p => GAME.answerMarriageRequest(p.from, 'accept') },
        { t: '严词拒之', d: '好感 −30，权威 +4，主战者忠诚 +5。彼国或于两季内举兵', fn: p => GAME.answerMarriageRequest(p.from, 'refuse') },
        { t: '以岁币代之', d: p => `季输 ${p.amt ?? GAME.marriageTribute(p.from)} 贯，凡十二季，好感 +10`,
          fn: p => GAME.answerMarriageRequest(p.from, 'tribute', p.amt) },
      ],
    },
    marriageHeir: {
      title: p => fac(p.from).name + '嗣君，宋室之甥也',
      text: p => `【${fac(p.from).name}】新君，我宗室女之子也。今奉表认亲，愿受册奉藩，岁修职贡。`,
      choices: [
        { t: '准其奉藩', d: '册为藩属，输贡从征', fn: p => GAME.acceptMarriageHeir(p.from) },
        { t: '仍叙姻亲之好', fn: () => {} },
      ],
    },
    allycall: {
      title: '盟邦求援',
      text: p => `盟国【${fac(p.ally).name}】遭【${fac(p.enemy).name}】攻伐，遣使求援。`,
      choices: [
        { t: '依约出兵', d: '向其敌宣战，盟好 +20', fn: p => { GAME.declareWar(P(), p.enemy); GAME.getRel(P(), p.ally).op += 20; } },
        { t: '婉言推辞', d: '盟约解除，好感大降', fn: p => { const rr = GAME.getRel(P(), p.ally); rr.ally = false; rr.op -= 35; } },
      ],
    },
    peaceoffer: {
      title: p => p.longxing ? '隆兴和议' : fac(p.from).name + '遣使求和',
      text: p => p.longxing ? '江淮交兵日久，行阵疲敝，沿边百姓屡离故土。金使持书至阙，愿议叔侄之礼，减岁币而罢两国戍兵。诸臣各陈可否：一谓休民为急，一谓关河未复，不宜以此时伏甲。和战之议，请陛下决之。' : `【${fac(p.from).name}】使臣入朝，愿罢兵言和` + (p.trib ? `，并岁输钱 ${p.trib} 贯，凡五年。` : '。'),
      choices: [
        { t: '许和', d: p => `两国休兵 ${GAME.peaceTruce(P(), p.from)} 季。` +
          (p.longxing ? '宋付金 20 贯/季。' : '') + peaceTerms(p.from), fn: p => {
          if (!alive(p.from) || !GAME.atWar(P(), p.from)) return;
          const tribute = p.longxing ? { from: P(), to: p.from, amt: 20, turns: 24 } :
            p.trib ? { from: p.from, to: P(), amt: p.trib, turns: 20 } : null;
          GAME.makePeace(P(), p.from, tribute);
        } },
        { t: '不许，战事继续', d: '', fn: () => {} },
      ],
    },
    allyoffer: {
      title: p => fac(p.from).name + '请盟',
      text: p => `【${fac(p.from).name}】遣使，愿与我朝结为盟好，共御外侮。`,
      choices: [
        { t: '结盟', d: '一方被攻，另一方将应召参战', fn: p => { GAME.getRel(P(), p.from).ally = true; GAME.log(`与【${fac(p.from).name}】结盟。`, 'dip'); } },
        { t: '谢绝', d: '', fn: p => { GAME.getRel(P(), p.from).op -= 5; } },
      ],
    },
    flood: {
      title: p => GAME.city(p.city).name + '水患',
      text: p => `${GAME.city(p.city).name}连日暴雨，江河泛滥，田庐漂没，饥民遍野。`,
      choices: [
        { t: '发帑赈济', d: '钱 -80，民心 +8', fn: p => { fac(P()).gold -= 80; GAME.city(p.city).loyalty += 8; } },
        { t: '令地方自救', d: '人口 -2，民心 -15', fn: p => { const c = GAME.city(p.city); c.pop = Math.max(1, c.pop - 2); c.loyalty -= 15; } },
      ],
    },
    drought: {
      title: p => GAME.city(p.city).name + '旱蝗',
      text: p => `${GAME.city(p.city).name}一带大旱，继以蝗灾，赤地千里。`,
      choices: [
        { t: '开常平仓放粮', d: '粮 -60，民心 +6', fn: p => { fac(P()).food -= 60; GAME.city(p.city).loyalty += 6; } },
        { t: '减免赋税', d: '钱 -40，民心 +3', fn: p => { fac(P()).gold -= 40; GAME.city(p.city).loyalty += 3; } },
        { t: '捐资赈灾，平粜济民', d: '钱 −160，民心 +12', fn: p => {
          if (fac(P()).gold < 160) return;
          fac(P()).gold -= 160;
          changeLoyalty(GAME.city(p.city), 12);
        } },
        { t: '置之不理', d: '人口 -1，民心 -12', fn: p => { const c = GAME.city(p.city); c.pop = Math.max(1, c.pop - 1); c.loyalty -= 12; } },
      ],
    },
    pirates: {
      title: '海寇犯境',
      text: p => `海寇数十艘劫掠${GAME.city(p.city).name}沿海，商舶不敢出港。`,
      choices: [
        { t: '遣水军剿灭', d: '钱 -60，城中新增舟师一营', fn: p => { fac(P()).gold -= 60; GAME.city(p.city).garrison.push(GAME.mkUnit('navy', 90)); } },
        { t: '招安海寇', d: '钱 -30，好坏参半', fn: p => { fac(P()).gold -= 30; if (r() < 0.5) GAME.city(p.city).garrison.push(GAME.mkUnit('navy', 70)); else GAME.city(p.city).loyalty -= 6; } },
        { t: '闭港自守', d: '本城海贸中断', fn: p => { GAME.city(p.city).trade = []; } },
      ],
    },
    talent: {
      title: '名士求见',
      text: p => { const g = GAME.gen(p.gen); return `有${g.name}者，${p.mil ? '弓马娴熟，通晓兵法' : '博学多才，素有治声'}，投书阙下，自陈愿效驱驰。\n\n统 ${g.tong}　武 ${g.wu}　智 ${g.zhi}　政 ${g.zheng}` + (g.skill ? `　特技【${g.skill}】` : ''); },
      choices: [
        { t: '礼聘入朝', d: '钱 -50', fn: p => { fac(P()).gold -= 50; GAME.gen(p.gen).status = 'idle'; } },
        { t: '不予录用', d: '', fn: p => { GAME.gen(p.gen).status = 'gone'; } },
      ],
    },
    plague: {
      title: p => GAME.city(p.city).name + '疫疠',
      text: p => `${GAME.city(p.city).name}疫疠渐炽，里巷闭户，市井寥落。医者请置药局，给贫民汤剂，又令病家暂勿出入。府吏言仓帑皆有常额，须请旨发之；若只令各乡自救，恐沿河诸邑亦闻疫耗。`,
      choices: [
        { t: '捐资赈灾，设药局救民', d: '钱 −150，本城损户，疫止于城', fn: p => {
          if (fac(P()).gold < 150) { plagueLoss(p, 4, 10, true); return; }
          fac(P()).gold -= 150;
          plagueLoss(p, 2, 4, false);
        } },
        { t: '令诸县各自安辑', d: '本城及邻城损户、民心下降', fn: p => plagueLoss(p, 4, 10, true) },
      ],
    },
    tribute: {
      title: p => fac(p.from).name + '来朝',
      text: p => `【${fac(p.from).name}】遣使泛海而来，进献方物，愿通朝贡。`,
      choices: [
        { t: '厚赐回礼，怀柔远人', d: '钱 -30，好感 +20', fn: p => { fac(P()).gold -= 30; GAME.getRel(P(), p.from).op += 20; } },
        { t: '受其贡物', d: '钱 +40', fn: p => { fac(P()).gold += 40; } },
      ],
    },
    wanyanliang: {
      title: '完颜亮南侵',
      text: () => '金主完颜亮弑君自立，迁都燕京，扬言「提兵百万西湖上，立马吴山第一峰」，尽起诸道兵马南下，号称六十万！',
      choices: [{ t: '命诸将严阵以待', d: '', fn: () => {} }],
    },
    temujin: {
      title: '铁木真称汗',
      text: () => '漠北传来消息：乞颜部铁木真统一蒙古诸部，于斡难河源大会，被尊为「成吉思汗」。草原之上，一股前所未有的力量正在崛起。',
      choices: [{ t: '知道了', d: '', fn: () => {} }],
    },
    temujinSong: {
      title: '铁木真来归',
      text: () => '斡难河已入我版图。乞颜部少年铁木真率部众来归，愿为大宋守边。此人雄才大略，非池中之物。',
      choices: [
        { t: '授以节度使，令守北疆', d: '获得将领铁木真', fn: () => {
          const g = genByName('铁木真');
          if (g?.status === 'captive' && g.capBy === P()) GAME.defectCaptive(g);
          else if (g && ['idle', 'future', 'gone'].includes(g.status)) { g.f = P(); g.status = 'idle'; g.loc = null; }
        } },
        { t: '此人不可留', d: '', fn: () => { const g = genByName('铁木真'); if (g && (g.capBy === P() || ['idle', 'future', 'gone'].includes(g.status))) GAME.killGeneral(g, '伏诛'); } },
      ],
    },
    victory: { ...ENDINGS.victory, choices: [{ t: '继续经营', fn: () => {} }] },
    endingRestoration: endingEvent('endingRestoration'),
    endingHuanglong: endingEvent('endingHuanglong'),
    endingProsperity: endingEvent('endingProsperity'),
    endingMaritime: endingEvent('endingMaritime'),
    endingRetreat: endingEvent('endingRetreat'),
    endingUnify: { ...ENDINGS.endingUnify, choices: [{ t: '展卷论功', fn: () => {} }] },
    endingDefeat: { ...ENDINGS.endingDefeat, choices: [{ t: '展卷论功', fn: () => {} }] },
    info: {
      title: p => p.title, text: p => p.text, choices: [{ t: '知道了', d: '', fn: () => {} }],
    },
    cityPromotion: {
      title: p => GAME.cityPromotionText(GAME.city(p.city).name, p.before, p.tier),
      text: p => GAME.city(p.city).role ? '营造既毕，州府版籍已定。' : '营造既毕，请择一业，使民有所专。',
      choices: p => GAME.city(p.city).role ? [{ t: '知道了', fn: () => {} }] : Object.entries(DATA.CITY_ROLES).map(([id, role]) => ({
        t: role.name, d: role.desc, fn: () => GAME.setCityRole(p.city, id),
      })),
    },
    levelup: {
      title: '积功晋升',
      text: p => `${GAME.gen(p.gen).name}历阵有功，今升至第 ${p.lv} 级。可择一项精修，以备日后驱驰。`,
      choices: p => p.opts.map(opt => ({
        t: GAME.optText(opt),
        fn: () => {
          const g = GAME.gen(p.gen);
          if (g && g.f === P() && !['dead', 'gone', 'captive'].includes(g.status)) GAME.applyLevel(g, opt);
        },
      })),
    },
    yueVolunteers: {
      title: '父老迎师',
      text: () => `王师北出，汴京城南父老携浆酒相迎。诸乡推壮士数百，愿执戈随岳将军，并献渡口津梁之图。然其家室尚在金境，若尽驱之赴阵，恐反累乡里。军前请旨：当授之兵甲，抑令各还村社，为王师通问？`,
      choices: [
        { t: '收为义勇', d: '粮 −80，指定城池步卒、弓弩各一营', fn: p => {
          const c = owned(p.city, 'song');
          if (c && fac('song').food >= 80) { fac('song').food -= 80; reinforce(c, ['inf', 'bow']); }
          else GAME.log('义勇暂归乡社，俟粮饷齐备再议。', 'info');
        } },
        { t: '令护乡里', d: '指定城池民心 +8；粮 +50', fn: p => {
          const c = owned(p.city, 'song');
          if (c) { changeLoyalty(c, 8); fac('song').food += 50; }
        } },
      ],
    },
    zhuxiAcademy: {
      title: '朱子讲学',
      text: () => '朱熹寓书于朝，言教不明则俗不厚，愿集诸生讲明经义，复师友问学之风。诸郡士子负箧而来，讲舍为之一空。有司请扩太学以延名儒，或先付诸郡书院试行三年，再观其成。国用方广，取舍当由宸断。',
      choices: [
        { t: '开太学，礼延诸儒', d: '钱 −180，京城设书院并增文教 90', fn: p => {
          const c = owned(p.city, P());
          if (c && fac(P()).gold >= 180) { fac(P()).gold -= 180; c.buildings.academy = 1; fac(P()).sci += 90; }
        } },
        { t: '先令郡学开讲', d: '文教 +35', fn: () => { fac(P()).sci += 35; } },
      ],
    },
    kaixiCampaign: {
      title: '开禧议兵',
      text: () => '韩侂胄遣人献边图，言金朝内耗，诸军可分道并进，以复中原。又有老将奏称：江淮刍粮尚少，关陕诸寨声息未通，轻举则两路难以相援。诸军已陈兵淮上，诏下便发；是即日北向，还是先整守备？',
      choices: [
        { t: '下诏北伐', d: '钱 −120、粮 −160，向金宣战，边城添三营', fn: p => {
          const c = owned(p.city, 'song'), F = fac('song');
          if (!c || !alive('jin') || F.gold < 120 || F.food < 160) { GAME.log('粮饷未集，北伐诏权且留中。', 'info'); return; }
          F.gold -= 120; F.food -= 160;
          GAME.declareWar('song', 'jin'); reinforce(c, ['inf', 'cav', 'siege']);
        } },
        { t: '休兵护边', d: '边城民心 +6，金国好感 +8', fn: p => {
          const c = owned(p.city, 'song');
          if (c) changeLoyalty(c, 6);
          if (alive('jin')) GAME.getRel('song', 'jin').op += 8;
        } },
      ],
    },
    powerfulMinister: {
      title: '权相壅蔽',
      text: p => `${GAME.gen(p.gen).name}位居机要，百司多仰其门。近日边郡奏牍数月不达，台谏欲论，辄有人以私书相阻。亦有百官言其素习财计，骤夺其权，恐诸务无所归。今当分其所掌，广听群言，还是姑令仍任？`,
      choices: [
        { t: '分其职掌，令台谏直奏', d: '其忠诚 −18；京城民心 +7', fn: p => {
          const g = GAME.gen(p.gen), c = capital(P());
          if (g && active(g) && g.f === P()) g.loyalty = Math.max(0, g.loyalty - 18);
          if (c) changeLoyalty(c, 7);
        } },
        { t: '姑委其事，以观后效', d: '钱 +90；京城民心 −6', fn: () => {
          fac(P()).gold += 90;
          const c = capital(P()); if (c) changeLoyalty(c, -6);
        } },
      ],
    },
    disputedHeir: {
      title: '东宫未定',
      text: () => '东宫未建，两位皇子各有师傅，各得近臣推许。朝臣或请早立元良，以安天下之望；或请先命二王分掌礼学、赈务，以观器度。宫中私谒日多，州郡亦有人揣摩风旨。迟一日而议不决，党论便长一日。',
      choices: [
        { t: '召群臣公议，册立储君', d: '钱 −100；京城民心 +10', fn: () => {
          const c = capital(P());
          if (c && fac(P()).gold >= 100) { fac(P()).gold -= 100; changeLoyalty(c, 10); }
        } },
        { t: '命二王习政，暂缓册立', d: '文教 +40；京城民心 −4', fn: () => {
          fac(P()).sci += 40;
          const c = capital(P()); if (c) changeLoyalty(c, -4);
        } },
      ],
    },
    customsLevy: {
      title: '市舶议抽解',
      text: p => `${GAME.city(p.city).name}市舶司呈籍，言蕃舶云集，香药、珠犀之货盈仓。度支请加抽解，以济军国急用；海商则陈，自渡海以来风涛难测，征敛过重，明岁船舶恐改泊别港。库吏捧簿而立，所征轻重，请朝廷裁定。`,
      choices: [
        { t: '增抽一岁，权济军需', d: '钱 +150；港城民心 −8', fn: p => {
          const c = owned(p.city, P());
          if (c) { fac(P()).gold += 150; changeLoyalty(c, -8); }
        } },
        { t: '从轻抽解，通商招徕', d: '钱 +45；港城民心 +8', fn: p => {
          const c = owned(p.city, P());
          if (c) { fac(P()).gold += 45; changeLoyalty(c, 8); }
        } },
      ],
    },
    yellowRiverShift: {
      title: '黄河复徙',
      text: p => `连旬大雨，河堤夜决，黄流背故道而走。${GAME.city(p.city).name}急报田庐多没，旧渡已在沙碛，邻县粮舟无处泊岸。水官请发卒夫修堤，乡老则言强挽水势恐重决，当循新道而安其民。奏牍同至，赈工难以两全。`,
      choices: [
        { t: '拨帑护堤，设仓赈济', d: '钱 −140；民心 +6', fn: p => {
          const c = owned(p.city, P());
          if (c && fac(P()).gold >= 140) { fac(P()).gold -= 140; changeLoyalty(c, 6); }
          else if (c) { c.pop = Math.max(1, c.pop - 1); changeLoyalty(c, -8); }
        } },
        { t: '顺水迁民，另置新渡', d: '人口 −1，民心 −8', fn: p => {
          const c = owned(p.city, P()); if (c) { c.pop = Math.max(1, c.pop - 1); changeLoyalty(c, -8); }
        } },
      ],
    },
    indianMonk: {
      title: '天竺僧入朝',
      text: () => '有天竺僧自海舶至，携梵经数箧，历陈其国风土、水行里程，兼言药草施用之法。礼官请馆于京寺，使通译校书；行人则请厚给路粮，令其归时传我修好之意。僧俟于殿外，行装未解，愿听命而行。',
      choices: [
        { t: '馆于京寺，延译其书', d: '钱 −60，文教 +95', fn: () => {
          const F = fac(P()); if (F.gold >= 60) { F.gold -= 60; F.sci += 95; }
        } },
        { t: '给粮遣归，厚结邻好', d: '粮 −40，来处好感 +18', fn: p => {
          const F = fac(P()); if (F.food >= 40 && alive(p.from)) { F.food -= 40; GAME.getRel(P(), p.from).op += 18; }
        } },
      ],
    },
    earthquake: {
      title: '地动坏城',
      text: p => `${GAME.city(p.city).name}深夜地动，钟鼓自鸣，城垣有圮处，民庐倾仆甚众。天明有司清点户口，伤者露处街衢。修城急则役夫不得归顾妻子，先赈民则城隙未塞，盗贼或得乘间。地方请发一策，以定先后。`,
      choices: [
        { t: '先救庐舍', d: '钱 −75，粮 −45；民心 +5，城防 −12', fn: p => {
          const c = owned(p.city, P()), F = fac(P()); if (!c) return;
          c.wall = Math.max(0, c.wall - 12);
          if (F.gold >= 75 && F.food >= 45) { F.gold -= 75; F.food -= 45; changeLoyalty(c, 5); }
          else changeLoyalty(c, -6);
        } },
        { t: '急葺城垣', d: '钱 −60；民心 −8', fn: p => {
          const c = owned(p.city, P()), F = fac(P()); if (!c) return;
          if (F.gold >= 60) F.gold -= 60; else c.wall = Math.max(0, c.wall - 12);
          changeLoyalty(c, -8);
        } },
      ],
    },
    comet: {
      title: '彗出北辰',
      text: () => '司天官奏：夜有彗星见于北方，光芒扫过紫微，三更方没。街陌传言四起，京畿有民罢市而归。台谏以为宜减膳求言，弭民间疑惧；亦有人请晓谕州县，此星自有躔度，不必兴土木禳之。',
      choices: [
        { t: '减膳求直言', d: '钱 −35，京城民心 +6', fn: () => {
          const c = capital(P()); if (c && fac(P()).gold >= 35) { fac(P()).gold -= 35; changeLoyalty(c, 6); }
        } },
        { t: '命太史据历推占', d: '文教 +24，京城民心 −3', fn: () => {
          fac(P()).sci += 24; const c = capital(P()); if (c) changeLoyalty(c, -3);
        } },
      ],
    },
    borderPetition: {
      title: '边将请战',
      text: p => `${GAME.city(p.city).name}飞骑来奏，言据哨探所报，${fac(p.enemy).name}边寨新撤一军，关河未冻，正可遣偏师前出。监军忧守卒不足、后援难继，请勿轻动。可增一营、输数旬粮以壮其势，亦可戒诸军安守部伍。`,
      choices: [
        { t: '付粮增兵，准其整军', d: '粮 −85；边城添轻骑一营', fn: p => {
          const c = owned(p.city, P()), F = fac(P());
          if (c && GAME.atWar(P(), p.enemy) && F.food >= 85) { F.food -= 85; reinforce(c, ['cav']); }
        } },
        { t: '令执成算，坚壁候援', d: '边城民心 +4', fn: p => {
          const c = owned(p.city, P()); if (c) changeLoyalty(c, 4);
        } },
      ],
    },
    merchantProposal: {
      title: '商贾献策',
      text: p => `${GAME.city(p.city).name}豪商进言：农隙车马闲置，愿出私财招聚脚户，使外郡余货入市。所请者，官给牙帖，减其关征。父老以为开市诚便，惟恐豪右专其利、细民不得交易。请议其约，乃许行之。`,
      choices: [
        { t: '许开公市，令百商共入', d: '钱 −80；本城设草市，民心 +4', fn: p => {
          const c = owned(p.city, P()), F = fac(P());
          if (c && !c.buildings.market && F.gold >= 80) { F.gold -= 80; c.buildings.market = 1; changeLoyalty(c, 4); }
        } },
        { t: '照常行商，受其输助', d: '钱 +70，民心 −3', fn: p => {
          const c = owned(p.city, P()); if (c) { fac(P()).gold += 70; changeLoyalty(c, -3); }
        } },
      ],
    },
    offeredTreasure: {
      title: '民间献宝',
      text: p => `有乡人于故宅整地，得【${DATA.ITEMS[p.item].name}】，封裹而进。郡吏考其铭识，云系前朝传物，主人但愿为官府所用。可颁赏收存，赐与${GAME.gen(p.gen).name}；亦可旌其义行，还其所藏，使子孙自守。`,
      choices: [
        { t: '受其所献，赐予臣下', d: p => DATA.ITEMS[p.item].desc, fn: p => {
          const g = playerGeneral(p.gen);
          if (!g || G().itemsTaken[p.item] || !GAME.equipItem(g, p.item)) return;
          GAME.log(`${g.name}获赐${GAME.itemNames([p.item])}。`, 'big');
        } },
        { t: '旌表其义，宝仍归民', d: '京城民心 +4', fn: () => {
          const c = capital(P()); if (c) changeLoyalty(c, 4);
        } },
      ],
    },
  };

  // ---------- 科举 ----------
  DEFS.longxingPeace = DEFS.peaceoffer;

  function civilQuality(academies) { return 42 + Math.min(18, academies * 1.5) + (GAME.hasTech(P(), 'lixue') ? 5 : 0); }
  function kejuCandidates(max, academies, cities) {
    const S = G(), n = Math.max(max + 2, Math.min(7, 3 + Math.floor(academies / 3)));
    const q = civilQuality(academies);
    const out = [];
    let total = 0;
    const homes = cities.map(c => [c.id, total += c.pop * (1 + (GAME.cityRoleFx(c).keju || 0))]);
    for (const g of S.generals) if (g.f === P() && g.status === 'future' && S.year >= g.avail && g.zheng > g.wu + 5) { g.status = 'cand'; out.push(g.id); }
    while (out.length < n) {
      const roll = r(), mil = roll < 0.4;
      const g = GAME.randomGeneral(P(), mil ? 'mil' : 'civil', q);
      const draw = total * (mil ? roll / 0.4 : (roll - 0.4) / 0.6);
      g.kejuCity = homes.find(([, ceiling]) => draw < ceiling)?.[0];
      g.status = 'cand'; g.mil = mil;
      out.push(g.id);
    }
    return out;
  }
  function resolveCandidates(p, chosen) {
    const admitted = new Set(chosen.filter(id => p.options.includes(id) && GAME.gen(id)?.status === 'cand').slice(0, p.max));
    for (const id of p.options) {
      const g = GAME.gen(id);
      if (g?.status !== 'cand') continue;
      if (admitted.has(id)) {
        g.status = 'idle';
        GAME.log(p.ev === 'keju' ? `${g.name}${g.hist ? '（史）' : ''}登第入仕。` : `${g.name}以荐举入仕，听候差遣。`, 'sci');
      }
      else g.status = g.hist ? 'future' : 'gone';
      if (!admitted.has(id) && g.hist) g.avail = G().year + 3;
    }
  }
  function offerFormerOfficial(city, formerCulture) {
    const g = GAME.randomGeneral(P(), 'civil', 42, city.culture || formerCulture);
    g.status = 'cand'; g.loyalty = 45;
    G().pending.push({ ev: 'oldOfficial', city: city.id, gen: g.id });
  }
  function settleFormerOfficial(p, accept) {
    const g = GAME.gen(p.gen);
    if (g?.status !== 'cand') return;
    g.status = accept && owned(p.city, P()) ? 'idle' : 'gone';
    if (g.status === 'idle') GAME.log(`${g.name}归附，录为我朝官员。`, 'sci');
  }

  // ---------- 史实大事 ----------
  const HIST = [
    { y: 1141, s: 3, fn: () => {
      if (alive('xiliao') && alive('seljuk') && GAME.atWar('xiliao', 'seljuk')) {
        for (const a of G().armies.filter(a => a.f === 'seljuk')) for (const u of a.units) u.s = Math.round(u.s * 0.6);
        worldLog('卡特万之战：耶律大石大破塞尔柱苏丹桑贾尔，西辽威震中亚。', ['xiliao', 'seljuk']);
      }
    } },
    { y: 1144, s: 3, fn: () => {
      const c = byName('埃德萨');
      if (c && c.f === 'crusader' && alive('zengid')) { GAME.captureCity(c, 'zengid'); worldLog('赞吉攻陷埃德萨，十字军诸国震动。', ['zengid', 'crusader']); }
    } },
    { y: 1147, s: 1, fn: () => {
      if (!alive('crusader') || !alive('zengid') || !mayFight('crusader','zengid') || !(alive('france') || alive('hre')) || !ownedName('埃德萨','zengid')) return;
      const cap = GAME.city(fac('crusader').capital);
      if (alive('france')) spawnArmy('crusader', cap.tile, ['hcav', 'hcav', 'inf', 'inf', 'bow', 'cav'], null, '法兰克十字军');
      if (alive('hre')) spawnArmy('crusader', cap.tile, ['hcav', 'hcav', 'inf', 'inf', 'inf', 'bow'], null, '日耳曼十字军');
      if (alive('zengid')) GAME.declareWar('crusader', 'zengid', true);
      worldLog('第二次十字军东征，西方援军渡海东来。', ['crusader', 'france', 'hre'], 'secondCross');
    } },
    { y: 1147, s: 2, fn: () => {
      if (!alive('almoravid')) return;
      renameFaction('almoravid', '穆瓦希德', '瓦');
      const cap = GAME.city(fac('almoravid').capital);
      spawnArmy('almoravid', cap.tile, ['cav', 'cav', 'inf', 'inf', 'bow', 'bow'], '阿卜杜勒·穆明');
      worldLog('马格里布的穆瓦希德派推翻穆拉比特王朝，新的柏柏尔帝国兴起。', ['almoravid']);
    } },
    { y: 1150, s: 1, fn: () => {
      if (!alive('ghor')) return;
      const cap = GAME.city(fac('ghor').capital);
      spawnArmy('ghor', cap.tile, ['cav', 'cav', 'hcav', 'inf', 'inf', 'bow'], '阿拉丁·侯赛因');
      if (alive('ghazni')) GAME.declareWar('ghor', 'ghazni', true);
      worldLog('古尔王朝「焚世者」阿拉丁起兵，攻伐伽色尼。', ['ghor', 'ghazni']);
    } },
    { y: 1161, s: 2, fn: () => {
      if (!alive('jin')) return;
      const S = G();
      const wl = genByName('完颜亮');
      if (!wl || wl.f !== 'jin' || !active(wl) || !mayFight('jin','song')) return;
      if (!GAME.citiesOf('song').length) return;
      if (!GAME.atWar('jin', 'song')) GAME.declareWar('jin', 'song', true);
      // 选距临安最近的金城
      const lin = GAME.city(fac('song').capital);
      let best = null, bd = 1e9;
      for (const c of GAME.citiesOf('jin')) { const d = GEO.dist(c.tile, lin.tile); if (d < bd) { bd = d; best = c; } }
      if (!best) return;
      spawnArmy('jin', best.tile, ['hcav', 'hcav', 'cav', 'cav', 'cav', 'inf', 'inf', 'bow', 'bow', 'siege'], '完颜亮', '完颜亮大军');
      spawnArmy('jin', best.tile, ['cav', 'cav', 'inf', 'inf', 'inf', 'bow', 'bow', 'siege'], '纥石烈志宁');
      spawnArmy('jin', best.tile, ['cav', 'inf', 'inf', 'inf', 'bow', 'navy', 'navy', 'navy'], null, '金国水军');
      S.pending.push({ ev: 'wanyanliang' });
    } },
    { y: 1171, s: 0, fn: () => {
      const sal = genByName('萨拉丁');
      if (!ownedName('开罗', 'fatimid') || !sal || !['zengid', 'fatimid'].includes(sal.f) || !['idle', 'future'].includes(sal.status)) return;
      renameFaction('fatimid', '阿尤布', '尤');
      if (sal && ['idle', 'future'].includes(sal.status)) { sal.f = 'fatimid'; sal.status = 'idle'; }
      const cap = GAME.city(fac('fatimid').capital);
      spawnArmy('fatimid', cap.tile, ['hcav', 'cav', 'cav', 'inf', 'inf', 'bow', 'bow'], '萨拉丁');
      worldLog('萨拉丁废法蒂玛哈里发，建立阿尤布王朝。', ['fatimid']);
    } },
    { y: 1187, s: 2, fn: () => {
      if (!activeIn('萨拉丁', 'fatimid') || !ownedName('耶路撒冷','crusader') || fac('fatimid').name !== '阿尤布' || !mayFight('fatimid','crusader')) return;
      GAME.declareWar('fatimid', 'crusader', true);
      const t = GAME.city(fac('crusader').capital).tile;
      spawnArmy('fatimid', t, ['hcav', 'hcav', 'cav', 'cav', 'inf', 'inf', 'bow', 'bow'], '萨拉丁');
      worldLog('哈丁战云起，萨拉丁麾下诸军向耶路撒冷集结。', ['fatimid', 'crusader']);
    } },
    { y: 1189, s: 1, fn: () => {
      if (!alive('crusader') || !ownedName('耶路撒冷','fatimid') || !['england','france','hre'].some(alive)) return;
      const t = GAME.city(fac('crusader').capital).tile;
      if (alive('england')) spawnArmy('crusader', t, ['hcav', 'hcav', 'inf', 'inf', 'bow', 'bow', 'navy'], '狮心王理查', '英格兰十字军');
      if (alive('france')) spawnArmy('crusader', t, ['hcav', 'hcav', 'inf', 'inf', 'bow'], '腓力二世', '法兰克十字军');
      if (alive('hre')) spawnArmy('crusader', t, ['hcav', 'hcav', 'hcav', 'inf', 'inf', 'bow'], '腓特烈一世', '日耳曼十字军');
      worldLog('第三次十字军东征，西方诸军再赴地中海东岸。', ['crusader', 'england', 'france', 'hre'], 'thirdCross');
    } },
    { y: 1180, s: 1, fn: () => {
      if (!alive('japan')) return;
      const c = byName('镰仓');
      if (c && c.f === 'japan') { GAME.rebellion(c); GAME.rebellion(c); worldLog('日本源平合战爆发，源氏举兵于关东。', ['japan']); }
    } },
    { y: 1206, s: 0, fn: () => {
      const S = G(), tm = genByName('铁木真');
      const onan = byName('斡难河');
      if (onan?.f === P() && P() !== 'mongol') {
        if (tm && (tm.capBy === P() || ['idle', 'future', 'gone'].includes(tm.status))) S.pending.push({ ev: 'temujinSong' });
        return;
      }
      if (!alive('mongol')) {
        if (!onan || onan.f === 'rebel' || !tm || tm.status === 'dead') return;
        const F = fac('mongol'); F.alive = true;
        GAME.captureCity(onan, 'mongol'); GAME.setCapital(onan);
      }
      renameFaction('mongol', '大蒙古国', '蒙');
      const F = fac('mongol'); F.aggr = 1; F.techs.jiaqi = 1;
      for (const f of ['kerait', 'naiman']) if (alive(f)) for (const c of GAME.citiesOf(f)) GAME.captureCity(c, 'mongol');
      F.mongolBoost = 1;
      mongolCampaignOrders('initial');
      mongolMuster(true);
      if (fac(P()).met.mongol || GAME.nearPlayer('mongol')) S.pending.push({ ev: 'temujin' });
      else worldLog('斡难河诸部会盟，漠北改号大蒙古国。', ['mongol']);
    } },
    { y: 1211, s: 1, fn: () => mongolCampaignOrders('east') },
    { y: 1218, s: 1, fn: () => mongolCampaignOrders('west') },
    { y: 1236, s: 1, fn: () => {
      if (!alive('mongol') || !fac('mongol').mongolBoost) return;
      const targets = ['rus', 'cuman', 'bulgar', 'hungary', 'poland'].filter(f => mayFight('mongol', f));
      if (!targets.length || !activeIn('拔都','mongol')) return;
      for (const f of targets) GAME.declareWar('mongol', f, true);
      let west = null, bx = 1e9;
      for (const c of GAME.citiesOf('mongol')) { const x = GEO.colOf(c.tile); if (x < bx) { bx = x; west = c; } }
      if (west) { spawnArmy('mongol', west.tile, rep(['hbow', 'hbow', 'hcav', 'cav'], 10), '拔都'); spawnArmy('mongol', west.tile, rep(['hbow', 'hcav', 'hcav', 'siege'], 10), '速不台'); }
      worldLog('长子西征，拔都集诸部兵马，进向西境。', ['mongol', 'rus'], 'batuWest');
    } },

    { y: 1153, s: 0, fn: () => {
      const old = ownedName('会宁', 'jin'), next = ownedName('燕京', 'jin');
      if (!old || !next || fac('jin').capital !== old.id) return;
      GAME.setCapital(next);
      next.buildings.walls = 1; next.wall = GAME.maxWall(next);
      worldLog('金主自会宁移都燕京，号为中都，百司随驾南迁。', ['jin'], 'jinCapital');
    } },
    { y: 1164, s: 3, fn: () => {
      if (!ownedName('汴京', 'jin') || !ownedName('临安', 'song') || !GAME.atWar('song', 'jin') || GAME.warScore('song', 'jin') > 0) return;
      if (P() === 'song') G().pending.push({ ev: 'longxingPeace', from: 'jin', longxing: true });
    } },
    { y: 1170, s: 2, fn: () => {
      const c = ownedName('开京', 'goryeo');
      if (!c) return;
      GAME.rebellion(c);
      worldLog('高丽开京武臣举事，朝官奔散，京畿军民聚众相抗。', ['goryeo']);
    } },
    { y: 1185, s: 1, fn: () => {
      const c = ownedName('镰仓', 'japan');
      if (!c || !ownedName('平安京', 'japan')) return;
      renameFaction('japan', '镰仓幕府', '和');
      worldLog('源氏舟师会战于坛之浦，平氏覆亡；镰仓自此掌兵政，朝廷仍居平安京。', ['japan'], 'kamakura');
    } },
    { y: 1192, s: 2, fn: () => {
      const c = ownedName('德里', 'rajput');
      if (!c || !ownedName('阿杰梅尔', 'rajput') || !mayFight('ghor', 'rajput')) return;
      const base = nearCity('ghor', c.tile, 16);
      if (!base || !warArmy('ghor', 'rajput', base, ['cav', 'cav', 'hcav', 'bow', 'inf'], '穆罕默德·古尔', '塔拉因征军')) return;
      if (P() !== 'rajput' && hasLead('ghor', 'rajput', 1.2) && c.garrison.length <= 4) GAME.captureCity(c, 'ghor');
      worldLog('古尔骑军再出塔拉因，拉杰普特诸部列阵，德里门户为之震动。', ['ghor', 'rajput']);
    } },
    { y: 1204, s: 1, fn: () => {
      const c = ownedName('君士坦丁堡', 'byz');
      if (!c || !ownedName('威尼斯', 'venice') || !alive('crusader') || !mayFight('venice', 'byz')) return;
      const force = warArmy('venice', 'byz', c, ['navy', 'navy', 'hcav', 'inf', 'siege', 'bow'], '恩里科·丹多洛', '第四次十字军');
      if (!force) return;
      if (mayFight('crusader', 'byz')) GAME.declareWar('crusader', 'byz', true);
      if (P() !== 'byz' && (c.garrison.length <= 3 || GAME.warScore('venice', 'byz') >= 12)) {
        GAME.captureCity(c, 'venice');
        worldLog('第四次十字军攻入君士坦丁堡，威尼斯据其港城，拂菻诸臣奔走。', ['venice', 'crusader', 'byz'], 'fourthCross');
      } else worldLog('第四次十字军折往博斯普鲁斯，与威尼斯舟师会于君士坦丁堡城下。', ['venice', 'crusader', 'byz'], 'fourthCross');
    } },
    { y: 1206, s: 1, fn: () => {
      if (!ownedName('德里', 'ghor')) return;
      renameFaction('ghor', '德里苏丹国', '德');
      worldLog('古尔故将据德里自立，诸路宣示新号，德里苏丹国由是肇基。', ['ghor']);
    } },
    { y: 1215, s: 1, fn: () => {
      const c = ownedName('燕京', 'jin');
      if (!c || !alive('mongol') || !GAME.atWar('mongol', 'jin') || !nearCity('mongol', c.tile, 10) || !hasLead('mongol', 'jin', 1.1)) return;
      GAME.captureCity(c, 'mongol');
      worldLog('蒙古诸军入中都，金人南走，燕云形势大变。', ['mongol', 'jin']);
    } },
    { y: 1219, s: 2, fn: () => {
      const c = ownedName('玉龙杰赤', 'khwarazm');
      if (!c || !activeIn('铁木真', 'mongol') || !mayFight('mongol', 'khwarazm')) return;
      const base = nearCity('mongol', c.tile, 22);
      if (!base || !warArmy('mongol', 'khwarazm', base, ['hbow', 'hbow', 'hcav', 'cav', 'siege'], '察合台', '河中征军')) return;
      worldLog('成吉思汗西征花剌子模，蒙古军进向河中，西路商旅暂驻以待。', ['mongol', 'khwarazm'], 'khwarazmRoad');
    } },
    { y: 1227, s: 2, fn: () => {
      const c = ownedName('兴庆', 'xia');
      if (!c || !alive('mongol') || !GAME.atWar('mongol', 'xia') || !nearCity('mongol', c.tile, 8) || !hasLead('mongol', 'xia', 1.75)) return;
      if (GAME.citiesOf('xia').length <= 2 && P() !== 'xia') {
        for (const town of GAME.citiesOf('xia')) GAME.captureCity(town, 'mongol');
        worldLog('兴庆开降，夏国诸城相继归附，河西尽入蒙古。', ['mongol', 'xia'], 'tangutFall');
      } else if (warArmy('mongol', 'xia', c, ['hbow', 'hbow', 'hcav', 'siege'], null, '河西征军')) {
        worldLog('兴庆已在两军锋镝之间，蒙古诸部合围夏都。', ['mongol', 'xia'], 'tangutFall');
      }
    } },
    { y: 1234, s: 0, fn: () => {
      const c = ownedName('蔡州', 'jin');
      if (!c || !alive('mongol') || !GAME.atWar('mongol', 'jin') || GAME.citiesOf('jin').length > 2 ||
          !nearCity('mongol', c.tile, 8) || !hasLead('mongol', 'jin', 1.35)) return;
      GAME.captureCity(c, 'mongol');
      worldLog(alive('jin') ? '蔡州陷落，金兵仅余孤城。' : '蔡州陷落，金祚告终。', ['mongol', 'jin']);
      if (alive('song') && ownedName('襄阳', 'song')) {
        const luo = byName('洛阳');
        if (luo && luo.f !== 'song') {
          const b = nearCity('song', luo.tile, 9);
          if (b) {
            fac('song').food += 100; reinforce(b, ['inf', 'bow']);
            worldLog('端平议复三京：宋廷输刍粮至中原边寨，诸将请进兵洛阳。', ['song', 'mongol']);
          }
        }
      }
    } },
    { y: 1240, s: 3, fn: () => {
      const c = ownedName('基辅', 'rus');
      if (!c || !alive('mongol') || !GAME.atWar('mongol', 'rus') || !nearCity('mongol', c.tile, 12) || !hasLead('mongol', 'rus', 1.15)) return;
      GAME.captureCity(c, 'mongol');
      worldLog('基辅城破，诸公国闻报震动，蒙古兵锋遂指西境。', ['mongol', 'rus'], 'kyiv');
    } },
    { y: 1241, s: 1, fn: () => {
      if (!alive('mongol')) return;
      for (const [f, name, battle, general] of [
        ['poland', '克拉科夫', '列格尼卡', '拜答儿'], ['hungary', '埃斯泰尔戈姆', '莫希', '拔都'],
      ]) {
        const c = ownedName(name, f);
        if (!c || !mayFight('mongol', f) || !nearCity('mongol', c.tile, 16)) continue;
        if (warArmy('mongol', f, c, ['hbow', 'hbow', 'hcav', 'cav', 'cav'], general, battle + '征军')) {
          worldLog(`蒙古西军出于${battle}，${fac(f).name}诸军列阵以拒，西境诸城戒严。`, ['mongol', f]);
        }
      }
    } },
    { y: 1250, s: 1, fn: () => {
      const c = ownedName('开罗', 'fatimid');
      if (!c || fac('fatimid').name !== '阿尤布') return;
      renameFaction('fatimid', '马穆鲁克', '马');
      reinforce(c, ['hcav', 'cav']);
      worldLog('开罗马穆鲁克诸将控制宫廷，新朝改立，骑军益盛。', ['fatimid']);
    } },
    { y: 1258, s: 0, fn: () => {
      const c = ownedName('巴格达', 'abbasid');
      if (!c || !activeIn('旭烈兀', 'mongol') || !mayFight('mongol', 'abbasid') || !nearCity('mongol', c.tile, 14)) return;
      const a = warArmy('mongol', 'abbasid', c, ['hbow', 'hcav', 'inf', 'siege', 'siege'], '旭烈兀', '巴格达征军');
      if (!a) return;
      if (P() !== 'abbasid' && hasLead('mongol', 'abbasid', 1.4) && c.garrison.length <= 5) {
        GAME.captureCity(c, 'mongol');
        worldLog('旭烈兀军入巴格达，黑衣大食朝廷离散。', ['mongol', 'abbasid'], 'baghdad');
      } else worldLog('巴格达合围，旭烈兀列砲城外，阿拔斯诸军闭门坚守。', ['mongol', 'abbasid'], 'baghdad');
    } },
    { y: 1259, s: 1, fn: () => {
      const c = ownedName('重庆', 'song');
      if (!c || !alive('mongol') || !GAME.atWar('song', 'mongol') || !nearCity('mongol', c.tile, 12)) return;
      c.buildings.walls = 1; c.wall = GAME.maxWall(c); reinforce(c, ['inf', 'bow']);
      worldLog(`蒙古兵入蜀。王师据钓鱼山修为坚垒，增发${c.name}守兵，以扼嘉陵水道。`, ['song', 'mongol']);
    } },
    { y: 1260, s: 2, fn: () => {
      const c = ownedName('大马士革', 'mongol');
      const base = ownedName('开罗', 'fatimid');
      if (!c || !base || fac('fatimid').name !== '马穆鲁克' || !mayFight('fatimid', 'mongol')) return;
      if (!warArmy('fatimid', 'mongol', c, ['hcav', 'hcav', 'cav', 'bow'], '拜伯尔斯', '艾因札鲁特征军')) return;
      if (P() !== 'mongol' && c.garrison.length <= 4) GAME.captureCity(c, 'fatimid');
      worldLog('马穆鲁克骑师北上，与蒙古前军相遇于艾因札鲁特，叙利亚诸城观望。', ['fatimid', 'mongol'], 'ainJalut');
    } },
    { y: 1268, s: 2, fn: () => {
      const c = ownedName('襄阳', 'song');
      if (!c || !mayFight('mongol', 'song') || !GAME.cityTiles(c).some(t => GEO.NBR[t].some(n => GAME.tileOwner(n) === 'mongol'))) return;
      if (!warArmy('mongol', 'song', c, ['hbow', 'hcav', 'inf', 'siege', 'siege'], '阿术', '襄樊围城军')) return;
      reinforce(c, ['inf', 'bow']);
      G().flags.xiangyangSiege = true;
      worldLog('襄樊围城：蒙古军沿汉水筑垒，宋发守卒保城，诸路援兵竞走江汉。', ['song', 'mongol'], 'xiangfan');
    } },
    { y: 1274, s: 3, fn: () => {
      const c = ownedName('博多', 'japan');
      const port = ownedName('庆州', 'mongol') || (GAME.allied('mongol', 'goryeo') && ownedName('庆州', 'goryeo'));
      if (!c || !mayFight('mongol', 'japan') || !(port || nearCity('mongol', c.tile, 14, x => x.port))) return;
      if (warArmy('mongol', 'japan', c, ['navy', 'navy', 'navy', 'inf', 'bow', 'cav'], null, '文永来航军')) {
        worldLog('蒙古舟师横海至筑前，镰仓诸将集兵博多，文永之役由此而起。', ['mongol', 'japan'], 'hakata');
      }
    } },
    { y: 1279, s: 0, fn: () => {
      if (!alive('song') || !capital('song')) return;
      const strong = P() === 'song' && GAME.citiesOf('song').length >= 28 &&
        (!alive('mongol') || hasLead('song', 'mongol', 1.15));
      if (strong) {
        fac('song').gold += 180; fac('song').food += 200;
        G().pending.push({ ev: 'info', title: '崖山不亡', text: '群臣望南海，昔日传言宋室将困于崖山，今日王师方盛、仓廪俱实，海上商舶亦皆奉正朔。岭南父老陈舟列帜，输帑一百八十贯、粟二百石，愿与朝廷共守河山。诏嘉其义，记此日为不亡之会。' });
        return;
      }
      const c = ownedName('广州', 'song');
      if (!c || !alive('mongol') || !GAME.atWar('mongol', 'song') || !nearCity('mongol', c.tile, 8)) return;
      if (warArmy('mongol', 'song', c, ['navy', 'navy', 'navy', 'inf', 'bow'], null, '崖山追军')) {
        reinforce(c, ['navy', 'navy']);
        worldLog('宋军据崖山结舟为阵，蒙古舟师自岭海来攻，宋室存亡在此一战。', ['song', 'mongol']);
      }
    } },

    // 第二批事件只在当年检查，避免旧档加载后集中补演。
    ...[
      { y: 1147, s: 3, fn: () => {
        const c = ownedName('科英布拉', 'portugal');
        if (!c || !ownedName('塞维利亚', 'almoravid')) return;
        fac('portugal').gold += 90;
        reinforce(c, ['inf', 'bow']);
        worldLog('里斯本之围：西来十字军助葡人取城，科英布拉得来兵与海贸之资。', ['portugal', 'almoravid']);
      } },
      { y: 1153, s: 0, fn: () => {
        const c = ownedName('波隆纳鲁瓦', 'lanka');
        if (!c) return;
        c.buildings.farm = 1;
        c.store += 40;
        changeLoyalty(c, 6);
        worldLog('细兰归一：波罗迦罗摩婆诃入主波隆纳鲁瓦，修渠蓄水，安集乡民。', ['lanka']);
      } },
      { y: 1154, s: 1, fn: () => {
        const c = ownedName('大马士革', 'seljuk'), base = ownedName('阿勒颇', 'zengid');
        if (!c || !base || P() === 'seljuk' || GAME.allied('seljuk', 'zengid')) return;
        if (c.garrison.length > 5 && !GAME.atWar('seljuk', 'zengid')) return;
        GAME.captureCity(c, 'zengid');
        reinforce(c, ['inf', 'bow']);
        worldLog('努尔丁入大马士革：布里旧朝去位，城署及戍军改奉赞吉。', ['zengid', 'seljuk']);
      } },
      { y: 1156, s: 2, fn: () => {
        const c = ownedName('平安京', 'japan');
        if (!c || !ownedName('镰仓', 'japan')) return;
        changeLoyalty(c, -10);
        c.unrest += 12;
        reinforce(c, ['inf']);
        worldLog('保元之乱：平安京二院相争，源、平武士分赴两阵，宫城重设守备。', ['japan'], 'hogen');
      } },
      { y: 1159, s: 3, fn: () => {
        const c = ownedName('平安京', 'japan');
        if (!c || !ownedName('博多', 'japan')) return;
        reinforce(c, ['bow']);
        fac('japan').gold -= Math.min(50, Math.max(0, fac('japan').gold));
        worldLog('平治之乱：京都举兵，乱后官府给钱抚军，武家益居朝廷要津。', ['japan']);
      } },
      { y: 1174, s: 3, fn: () => {
        const c = ownedName('大马士革', 'zengid');
        if (!c || !ownedName('开罗', 'fatimid') || fac('fatimid').name !== '阿尤布' || P() === 'zengid') return;
        if (c.garrison.length > 5 || GAME.allied('fatimid', 'zengid')) return;
        GAME.captureCity(c, 'fatimid');
        c.unrest = 10;
        changeLoyalty(c, 20);
        worldLog('萨拉丁入叙利亚：大马士革开门归阿尤布，埃及与叙境自此连为一势。', ['fatimid', 'zengid']);
      } },
      { y: 1176, s: 1, fn: () => {
        const c = ownedName('米兰', 'hre');
        if (!c || !ownedName('法兰克福', 'hre')) return;
        GAME.rebellion(c);
        c.unrest += 10;
        worldLog('莱尼亚诺之战：伦巴第诸城举众抗帝，米兰郊野共起。', ['hre']);
      } },
      { y: 1177, s: 1, fn: () => {
        const c = ownedName('吴哥', 'khmer');
        if (!c || !ownedName('毗阇耶', 'champa') || !GAME.atWar('champa', 'khmer')) return;
        if (!warArmy('champa', 'khmer', c, ['inf', 'bow', 'navy', 'navy'], null, '占城舟军')) return;
        c.wall = Math.max(0, c.wall - 18);
        c.unrest += 10;
        worldLog('占城袭吴哥：舟师循水道深入真腊，吴哥城垣受损，民多惊散。', ['champa', 'khmer'], 'angkorRaid');
      } },
      { y: 1181, s: 0, fn: () => {
        const c = ownedName('吴哥', 'khmer');
        if (!c) return;
        c.buildings.temple = 1;
        reinforce(c, ['inf', 'bow']);
        changeLoyalty(c, 8);
        worldLog('吴哥中兴：阇耶跋摩七世整军修都，增立寺院，招抚离散之民。', ['khmer']);
      } },
      { y: 1187, s: 1, fn: () => {
        const c = ownedName('波隆纳鲁瓦', 'lanka');
        if (!c) return;
        c.buildings.temple = 1;
        fac('lanka').sci += 90;
        changeLoyalty(c, 5);
        worldLog('细兰立石：尼桑迦摩罗立碑记政，修缮佛寺，招致讲经之士。', ['lanka']);
      } },
      { y: 1187, s: 3, fn: () => {
        const c = ownedName('耶路撒冷', 'crusader');
        if (!c || !activeIn('萨拉丁', 'fatimid') || !ownedName('开罗', 'fatimid') || fac('fatimid').name !== '阿尤布' || !GAME.atWar('fatimid', 'crusader') || P() === 'crusader') return;
        if (!G().armies.some(a => a.f === 'fatimid' && GEO.dist(a.tile, c.tile) <= 6)) return;
        if (c.garrison.length <= 4 && hasLead('fatimid', 'crusader', 1.15)) {
          GAME.captureCity(c, 'fatimid');
          worldLog('哈丁余波：阿尤布军接管耶路撒冷，守城诸人出城归去。', ['fatimid', 'crusader'], 'jerusalem');
        } else {
          c.wall = Math.max(0, c.wall - 22);
          worldLog('哈丁余波：阿尤布军进围耶路撒冷，守军闭门待援。', ['fatimid', 'crusader'], 'jerusalem');
        }
      } },
      { y: 1209, s: 2, fn: () => {
        const c = ownedName('升龙', 'daviet');
        if (!c || fac('daviet').name !== '交趾') return;
        GAME.rebellion(c);
        c.unrest += 8;
        worldLog('交趾郭卜之乱：乱军入升龙，李氏宫廷出避，京师重新征民守城。', ['daviet']);
      } },
      { y: 1210, s: 2, fn: () => {
        const c = ownedName('塔剌思', 'xiliao'), base = ownedName('玉龙杰赤', 'khwarazm');
        if (!c || !base || !mayFight('khwarazm', 'xiliao')) return;
        if (!warArmy('khwarazm', 'xiliao', c, ['cav', 'hbow', 'hcav', 'inf'], '摩诃末', '河中前军')) return;
        if (P() !== 'xiliao' && c.garrison.length <= 4 && hasLead('khwarazm', 'xiliao', 1.15)) GAME.captureCity(c, 'khwarazm');
        worldLog('塔剌思再战：花剌子模举兵东向，西辽河中守军震动。', ['khwarazm', 'xiliao']);
      } },
      { y: 1212, s: 2, fn: () => {
        const c = ownedName('科尔多瓦', 'almoravid'), base = ownedName('托莱多', 'castile');
        if (!c || !base || !mayFight('castile', 'almoravid')) return;
        if (!warArmy('castile', 'almoravid', base, ['hcav', 'inf', 'bow', 'cav'], '纳瓦斯的迭戈·洛佩斯二世', '纳瓦斯联军')) return;
        fac('almoravid').warWeary = Math.min(160, fac('almoravid').warWeary + 16);
        worldLog('拉斯纳瓦斯之战：卡斯蒂利亚诸军南出，穆瓦希德战费益重。', ['castile', 'almoravid']);
      } },
      { y: 1215, s: 1, fn: () => {
        const c = ownedName('伦敦', 'england');
        if (!c || !ownedName('温切斯特', 'england')) return;
        fac('england').gold -= Math.min(100, Math.max(0, fac('england').gold));
        changeLoyalty(c, 10);
        worldLog('英格兰大宪章：诸侯集于伦尼米德，国王许守成文之约，王库暂减征取。', ['england'], 'charter');
      } },
      { y: 1219, s: 0, fn: () => {
        const c = ownedName('开京', 'goryeo');
        if (!c || !ownedName('西京', 'goryeo')) return;
        reinforce(c, ['inf', 'bow']);
        c.unrest += 8;
        worldLog('高丽崔氏承政：崔忠献去世，崔怡继掌机务，开京宿卫益严。', ['goryeo']);
      } },
      { y: 1219, s: 3, fn: () => {
        const c = ownedName('亚历山大', 'fatimid');
        if (!c || (!ownedName('耶路撒冷', 'crusader') && !ownedName('安条克', 'crusader')) ||
          !mayFight('crusader', 'fatimid')) return;
        if (!warArmy('crusader', 'fatimid', c, ['inf', 'bow', 'siege', 'navy', 'navy'], null, '尼罗河口十字军')) return;
        c.wall = Math.max(0, c.wall - 18);
        worldLog('第五次十字军至达米埃塔：尼罗河口受兵，亚历山大戍城亦告急。', ['fatimid', 'crusader']);
      } },
      { y: 1225, s: 3, fn: () => {
        const c = ownedName('升龙', 'daviet');
        if (!c || fac('daviet').name !== '交趾') return;
        renameFaction('daviet', '大越陈朝', '越');
        c.unrest = Math.max(0, c.unrest - 10);
        changeLoyalty(c, 10);
        worldLog('升龙受禅：李氏让国，陈氏入承国统，诸州仍奉大越之号。', ['daviet']);
      } },
      { y: 1229, s: 0, fn: () => {
        const c = ownedName('耶路撒冷', 'fatimid');
        if (!c || !ownedName('开罗', 'fatimid') || !ownedName('法兰克福', 'hre')) return;
        const base = capital('crusader');
        if (!base || P() === 'fatimid' || c.garrison.length > 5 || fac('fatimid').name !== '阿尤布') return;
        // 协议交城，免除常规攻占的人口与缴获变化。
        const pop = c.pop, gold = fac('crusader').gold, loyalty = c.loyalty, unrest = c.unrest;
        GAME.captureCity(c, 'crusader');
        c.pop = pop; c.loyalty = loyalty; c.unrest = unrest;
        fac('crusader').gold = gold;
        GAME.makePeace('crusader', 'fatimid');
        if (GAME.atWar('hre', 'fatimid')) GAME.makePeace('hre', 'fatimid');
        worldLog('雅法和约：腓特烈二世与卡米勒罢兵，耶路撒冷依约交予十字军。', ['hre', 'fatimid', 'crusader'], 'jaffa');
      } },
      { y: 1231, s: 2, fn: () => {
        const c = ownedName('西京', 'goryeo');
        if (!c || !ownedName('开京', 'goryeo') || !mayFight('mongol', 'goryeo') || !nearCity('mongol', c.tile, 16)) return;
        if (!warArmy('mongol', 'goryeo', c, ['hbow', 'hbow', 'hcav', 'siege'], null, '蒙古东征军')) return;
        reinforce(c, ['inf']);
        worldLog('蒙古征高丽：兵入西京近境，高丽发守卒，令沿江诸寨坚壁。', ['mongol', 'goryeo'], 'koreaBorder');
      } },
      { y: 1235, s: 1, fn: () => {
        const c = ownedName('蒲甘', 'pagan');
        if (!c) return;
        c.buildings.temple = 1;
        fac('pagan').sci += 80;
        changeLoyalty(c, 4);
        worldLog('蒲甘讲经：迦娑瓦延请通晓三藏之僧，修寺聚徒，国中讲学渐兴。', ['pagan']);
      } },
      { y: 1241, s: 3, fn: () => {
        const c = ownedName('拉合尔', 'ghor');
        if (!c || !ownedName('德里', 'ghor') || !alive('mongol') || !GAME.atWar('mongol', 'ghor') ||
          !nearCity('mongol', c.tile, 20)) return;
        c.wall = Math.max(0, c.wall - 20);
        reinforce(c, ['inf', 'bow']);
        worldLog('蒙军徇拉合尔：德里闻西北告急，调卒列守，城防仍有缺处。', ['ghor', 'mongol']);
      } },
      { y: 1242, s: 1, fn: () => {
        const c = ownedName('诺夫哥罗德', 'rus');
        if (!c || !ownedName('普斯科夫', 'rus') || !alive('hre')) return;
        const g = genByName('亚历山大·涅夫斯基');
        if (!g || g.f !== 'rus' || !active(g)) return;
        reinforce(c, ['inf', 'bow']);
        changeLoyalty(c, 7);
        worldLog('冰湖之战：诺夫哥罗德诸军自楚德湖归，城民设戍以备条顿骑士再至。', ['rus', 'hre']);
      } },
      { y: 1249, s: 3, fn: () => {
        const c = ownedName('镰仓', 'japan');
        if (!c || !ownedName('平安京', 'japan') || fac('japan').name !== '镰仓幕府') return;
        c.unrest = Math.max(0, c.unrest - 10);
        changeLoyalty(c, 6);
        fac('japan').sci += 60;
        worldLog('镰仓设引付：北条时赖置引付众，诸方田讼有司理断，御家人各得呈词。', ['japan']);
      } },
      { y: 1251, s: 2, fn: () => {
        const c = ownedName('坦焦尔', 'chola');
        if (!c || !ownedName('甘吉', 'chola')) return;
        changeLoyalty(c, -12);
        c.unrest += 15;
        fac('chola').warWeary = Math.min(160, fac('chola').warWeary + 12);
        worldLog('潘地亚兴起：南方诸部改奉新主，注辇旧都坦焦尔军民多有二心。', ['chola']);
      } },
      { y: 1269, s: 2, fn: () => {
        const c = ownedName('马拉喀什', 'almoravid');
        if (!c || !ownedName('非斯', 'almoravid') || fac('almoravid').name !== '穆瓦希德') return;
        renameFaction('almoravid', '马林王朝', '马');
        reinforce(c, ['cav', 'inf']);
        worldLog('马林代穆瓦希德：非斯诸部入马拉喀什，西极政权改奉马林王朝。', ['almoravid']);
      } },
      { y: 1282, s: 0, fn: () => {
        const c = ownedName('巴勒莫', 'sicily');
        if (!c || !ownedName('萨拉戈萨', 'aragon') || !mayFight('aragon', 'sicily')) return;
        GAME.rebellion(c);
        if (warArmy('aragon', 'sicily', c, ['navy', 'navy', 'inf', 'bow'], '彼得三世', '阿拉贡渡海军')) {
          worldLog('西西里晚祷：巴勒莫市民起事，阿拉贡舰队应请渡海。', ['sicily', 'aragon']);
        }
      } },
      { y: 1287, s: 3, fn: () => {
        const c = ownedName('蒲甘', 'pagan');
        if (!c || !alive('mongol') || !GAME.atWar('mongol', 'pagan') || !nearCity('mongol', c.tile, 14)) return;
        if (GAME.citiesOf('pagan').length === 1 && hasLead('mongol', 'pagan', 1.8) && P() !== 'pagan') {
          GAME.captureCity(c, 'mongol');
          worldLog('蒲甘末局：王都孤悬，蒙古军入城，蒲甘旧政解体。', ['pagan', 'mongol']);
        } else {
          GAME.rebellion(c);
          worldLog('蒲甘末局：北军逼境，蒲甘朝廷离乱，京师聚众自保。', ['pagan', 'mongol']);
        }
      } },
      { y: 1288, s: 1, fn: () => {
        const c = ownedName('升龙', 'daviet');
        if (!c || fac('daviet').name !== '大越陈朝' || !alive('mongol') || !GAME.atWar('mongol', 'daviet')) return;
        reinforce(c, ['navy', 'navy', 'bow']);
        fac('daviet').food += 140;
        worldLog('白藤江拒元：陈朝调集舟军扼守潮汐水道，升龙广备军粮。', ['daviet', 'mongol']);
      } },
    ].map(({ y, s, fn }) => ({ y, s, fn: () => { if (G().year === y) fn(); } })),
    { y: 1230, s: 1, fn: () => { if (G().year === 1230) mongolCampaignOrders('return'); } },
    { y: 1235, s: 1, fn: () => { if (G().year === 1235) mongolCampaignOrders('return'); } },
  ];

  // ---------- 战后事件 ----------
  // 冷却以季计。lastPopup 用同一时刻限制连战只弹一次。
  const BATTLE_WAIT = {
    captured: 1, battleCaptive: 2, battleWound: 2, battleDeath: 4, battleUnderdog: 3,
    battleOccupation: 1, battleHeld: 2, battleLost: 2, battleFame: 3, battleStalled: 2, battleRally: 3,
  };
  const PLAN_SKILLS = {
    fire: '运筹', dfire: '运筹', flood: '水战', tower_ships: '水战',
    inside_gate: '攻城', mine_wall: '攻城', open_gate: '攻城', dry_siege: '攻城',
    half_crossed: '水战', empty_city: '坚守', shield_wall: '坚守', sally: '坚守', firm: '坚守',
    valley_ambush: '守险', mud_hold: '守险', broken_bridge: '守险',
    armored_charge: '铁骑', mounted_skirmish: '神射', crossbow_volley: '神射',
    ice_crossing: '疾行', night: '疾行', raid: '疾行',
  };

  function playerGeneral(id) {
    const g = GAME.gen(id);
    return g && g.f === P() && active(g) ? g : null;
  }
  function battlePrisoner(id) {
    const g = GAME.gen(id);
    return g && g.status === 'captive' && g.capBy === P() ? g : null;
  }
  function playerArmy(id) {
    const a = id == null ? null : GAME.army(id);
    return a && a.f === P() ? a : null;
  }
  function moraleAfterBattle(id, change) {
    const a = playerArmy(id);
    if (a) a.morale = GAME.clamp(a.morale + change, 5, 100);
  }
  function courtAuthority(change) {
    const c = G().court;
    if (c) c.auth = GAME.clamp(c.auth + change, 0, 100);
  }
  function recoverBattleWounds() {
    const wounds = G().flags.battleEvents?.wounds;
    if (!wounds) return;
    for (const [id, info] of Object.entries(wounds)) {
      const g = GAME.gen(Number(id));
      if (g && g.status !== 'dead' && g.wound > 0) continue;
      if (g && g.status !== 'dead') {
        g.tong += info.tong;
        g.wu += info.wu;
        if (g.f === P()) GAME.log(`${g.name}伤愈，统武如初。`, 'mil');
      }
      delete wounds[id];
    }
  }

  function successfulPlan(side, text) {
    if (typeof text !== 'string' || typeof STRATAGEMS === 'undefined') return null;
    // 手动战报会在计策文字后附临阵指挥；守方指挥另加「守方」前缀。
    const prefix = side === 'def' ? '守方' : '';
    return STRATAGEMS.find(x => (x.side === side || x.side === 'both') && text.startsWith(prefix + x.name + '成功：'));
  }
  function trackSuccessfulPlan(ledger, g, plan) {
    if (!g || !plan) return;
    const count = ledger.plans[g.id] || (ledger.plans[g.id] = { count: 0 });
    if (count.awarded) return;
    count.count = Math.min(3, count.count + 1);
    count.id = plan.id;
    count.name = plan.name;
  }

  function onBattle(rep) {
    if (rep.draw) return;
    const player = P(), attacking = rep.att === player;
    if (!attacking && rep.def !== player) return;
    const won = attacking ? rep.win : !rep.win;
    const c = rep.city ? byName(rep.city) : null;
    const cityTaken = c && c.f === rep.att && rep.captured === c.name;
    const plan = successfulPlan(attacking ? 'att' : 'def', rep.plan);
    const ours = attacking ? rep.before.a : rep.before.d, theirs = attacking ? rep.before.d : rep.before.a;
    const underdog = won && ours > 0 && ours * 2 < theirs;
    const g = GAME.gen(attacking ? rep.attGen : rep.defGen);
    const book = recordAnnalsBattle(rep, attacking, won, plan, underdog, g);
    if (won && g && (cityTaken || (attacking ? rep.before.d - rep.after.d : rep.before.a - rep.after.a) > 180 || underdog)) G().flags.lastVictory = { gen: g.id, t: G().T };
    if (!attacking && c?.f === player) {
      if (c.siegeLast == null || G().T - c.siegeLast > 2) c.siegeStart = G().T;
      c.siegeLast = G().T;
    }
    battleEvents(rep, { attacking, won, c, cityTaken, plan });

    const foe = GAME.gen(attacking ? rep.defGen : rep.attGen);
    const foeFallen = foe?.hist && foe.status === 'dead';
    // 州城易主和本朝将领阵亡已由大事日志入纪。
    if (!underdog && !foeFallen && (cityTaken || g?.status === 'dead')) return;
    const place = annalsBattlePlace(rep);
    if (underdog || foeFallen) {
      const outcome = underdog ? ['王师以少胜多'] : [];
      if (foeFallen) outcome.push(foe.name + '阵亡');
      writeAnnalsFact(book, place + '会战，' + outcome.join('，') + '。');
    } else recordSeasonBattle(book, place, won);
  }

  function battleEvents(rep, { attacking, won, c, cityTaken, plan }) {
    const S = G(), player = P();
    const ledger = S.flags.battleEvents || (S.flags.battleEvents = { next: {}, wounds: {}, plans: {} });
    const cooled = ev => (ledger.next[ev] ?? -1) <= S.T && eligible(ev, 'battle');
    const opened = ev => {
      scheduleState().groups.battle = S.T;
      ledger.lastPopup = S.T;
      ledger.next[ev] = S.T + BATTLE_WAIT[ev];
    };
    const queue = (ev, details) => {
      S.pending.push({ ev, ...details });
      opened(ev);
    };

    const g = playerGeneral(attacking ? rep.attGen : rep.defGen);
    const enemy = attacking ? rep.def : rep.att;
    const captureNotice = attacking && cityTaken ? S.pending.findLastIndex(p => p.ev === 'captured' && p.city === c.id) : -1;
    trackSuccessfulPlan(ledger, g, plan);

    if (ledger.lastPopup === S.T) {
      // captureCity 已经结算易主与缴获；这里只撤去同一回合多余的处置弹窗。
      if (captureNotice >= 0) S.pending.splice(captureNotice, 1);
      return;
    }

    const tile = Number.isInteger(rep.tile) ? rep.tile : c?.tile;
    const a = g?.status === 'army' ? playerArmy(g.loc) : tile == null ? null : GAME.armyAt(tile);
    const army = a?.f === player ? a.id : null;
    const nearby = tile == null ? capital(player) : nearestOwnCity(player, tile);
    const city = nearby?.id;
    if (captureNotice >= 0) {
      // 攻陷时人口至少保留 1，原人口 ≥8 的城此时人口 ≥7。
      if (c.pop >= 7 && cooled('battleOccupation')) {
        S.pending[captureNotice] = { ev: 'battleOccupation', city: c.id, name: c.name, army };
        opened('battleOccupation');
      } else {
        const pending = S.pending.splice(captureNotice, 1)[0];
        if (cooled('captured')) { S.pending.splice(captureNotice, 0, pending); opened('captured'); }
      }
      if (ledger.lastPopup === S.T) return;
    }

    const ourStart = attacking ? rep.before.a : rep.before.d;
    const ourEnd = attacking ? rep.after.a : rep.after.d;
    const foeStart = attacking ? rep.before.d : rep.before.a;
    const losses = ourStart ? Math.max(0, 1 - ourEnd / ourStart) : 0;
    if (!won && g && rep.wounded?.includes(g.id) && cooled('battleWound')) {
      queue('battleWound', { gen: g.id, name: g.name });
      return;
    }
    if (!won && g && losses > 0.5) {
      const roll = r();
      const deathChance = g.hist ? 0.005 : 0.01;
      if (cooled('battleDeath') && roll < deathChance) {
        GAME.killGeneral(g, '阵亡');
        queue('battleDeath', { gen: g.id, name: g.name });
        return;
      }
    }

    if (!attacking && cityTaken && cooled('battleLost')) {
      // 无野战军带队时，战报里的守将才可确认来自该城知州。
      const governor = rep.defName === c.name + '守军' ? GAME.gen(rep.defGen) : null;
      queue('battleLost', { city: c.id, name: c.name, gen: governor?.id, governor: governor?.name });
      return;
    }
    if (g && won && ourStart > 0 && ourStart * 2 < foeStart && cooled('battleUnderdog')) {
      queue('battleUnderdog', { gen: g.id, name: g.name, city });
      return;
    }
    const captive = battlePrisoner(attacking ? rep.defGen : rep.attGen);
    if (won && captive && captive.f === enemy && cooled('battleCaptive') && r() < 0.55) {
      queue('battleCaptive', { gen: captive.id, name: captive.name, army, loot: rep.loot?.[captive.id] });
      return;
    }
    const fame = g && ledger.plans[g.id];
    if (fame && fame.count >= 3 && !fame.awarded && cooled('battleFame')) {
      const skill = PLAN_SKILLS[fame.id] || '运筹';
      const learn = !GAME.hasSkill(g, skill) && GAME.skillList(g).length < 3;
      fame.awarded = true;
      queue('battleFame', { gen: g.id, name: g.name, plan: fame.name, skill: learn ? skill : null });
      return;
    }
    const governor = !attacking && won && c?.f === player && playerGeneral(c.governor);
    if (governor && cooled('battleHeld') && r() < 0.35) {
      queue('battleHeld', { city: c.id, name: c.name, governor: governor.name, gen: governor.id });
      return;
    }
    if (attacking && c?.f === enemy && !cityTaken && rep.before.wall > 0 && army != null &&
        losses >= 0.25 && cooled('battleStalled') && r() < 0.22) {
      queue('battleStalled', { name: c.name, army });
      return;
    }
    if (!won && losses > 0.5 && cooled('battleRally') && r() < 0.25) queue('battleRally', { city });
  }

  // ---------- 结局 ----------
  // 城表的两京走廊只落位汴京与洛阳；上京在城表中名为会宁。
  const RESTORATION_CITIES = ['汴京', '洛阳'];
  const PROSPERITY_SEASONS = 20;
  function reigningEmperor() {
    const court = G().court;
    if (!court || typeof COURT === 'undefined') return null;
    return COURT.EMPERORS[court.emp] || court.genEmp || null;
  }
  function milestoneState() {
    const flags = G().flags;
    return flags.milestones || (flags.milestones = { reached: {} });
  }
  function reachEnding(id, engineLogged = false) {
    const S = G(), reached = milestoneState().reached;
    if (reached[id]) return;
    reached[id] = { y: S.year, s: S.season, date: GAME.dateStr() };
    if (id !== 'victory' && !S.pending.some(event => event.ev === id)) S.pending.push({ ev: id });
    if (!engineLogged) GAME.log(`史官记曰：${ENDINGS[id].title}。`, 'big');
  }
  function checkProsperity(state, cities) {
    const S = G(), F = fac(P()), emperor = reigningEmperor();
    if (!emperor || S.year >= emperor.end) return; // COURT.turn() 接着结算更替。
    const previous = state.prosperity;
    const owned = new Set(cities.map(c => c.id));
    const lost = previous?.loss || previous?.owned.some(id => !owned.has(id));
    const loyalty = cities.reduce((sum, c) => sum + c.loyalty, 0) / cities.length;
    const ready = F.gold >= 1000 && F.food >= 1000 && loyalty >= 75;
    const since = !ready ? null : previous?.reign === emperor.start && previous.since != null && !lost ? previous.since : S.T;
    state.prosperity = { reign: emperor.start, owned: Array.from(owned), since };
    if (since != null && S.T - since >= PROSPERITY_SEASONS - 1e-6) {
      reachEnding('endingProsperity');
      delete state.prosperity;
    }
  }
  function maritimeShare(gold) {
    // 与市舶收入的实际计算一致，入港分账每城最多十五贯。
    let trade = 0;
    const player = P();
    const inbound = new Map();
    for (const city of G().cities) {
      for (const id of city.trade || []) {
        const target = GAME.city(id);
        if (!target || (city.f !== player && target.f !== player)) continue;
        const value = GAME.routeValue(city, target);
        if (city.f === player) trade += value;
        if (target.f === player) inbound.set(id, (inbound.get(id) || 0) + Math.round(value / 2));
      }
    }
    for (const value of inbound.values()) trade += Math.min(15, value);
    return trade / gold;
  }
  function recordTerminalEndings() {
    const S = G();
    if (S?.victory) reachEnding('victory', true);
    if (S?.settlement?.type === 'unify') reachEnding('endingUnify', true);
    if (S?.defeat && !S.settlement?.continued) reachEnding('endingDefeat', true);
  }
  function checkEndings() {
    const S = G(), p = P();
    recordTerminalEndings();
    if (S.defeat || !alive(p)) return;
    const state = milestoneState(), reached = state.reached;
    if (!reached.endingRestoration && RESTORATION_CITIES.every(name => byName(name)?.f === p)) reachEnding('endingRestoration');
    if (!reached.endingHuanglong && (!alive('jin') || ['会宁', '燕京'].every(name => byName(name)?.f === p))) reachEnding('endingHuanglong');
    if (!reached.endingRetreat && S.year >= 1279 && byName('汴京')?.f !== p) reachEnding('endingRetreat');
    if (reached.endingProsperity && (reached.endingMaritime || !S.newSeason)) return;
    const cities = GAME.citiesOf(p);
    if (!cities.length) return;
    if (!reached.endingProsperity) checkProsperity(state, cities);
    const gold = fac(p).income.gold;
    if (!reached.endingMaritime && S.newSeason && gold > 0 &&
        cities.filter(c => c.port).length >= 8 && maritimeShare(gold) >= 0.25) reachEnding('endingMaritime');
  }
  GAME.on('log', ({ text, type }) => {
    const S = G();
    // 原引擎在 EVENTS.turn 后可宣布统一，玩家亲自守城也可能在回合结算后覆亡。
    if (type === 'big' && S.victory && text === '史官记曰：万国来朝。') reachEnding('victory', true);
    else if (type === 'big' && S.settlement?.type === 'unify' && text === '史官记曰：海内一统。') reachEnding('endingUnify', true);
    else if (type === 'big' && S.defeat && !S.settlement?.continued && text === '社稷倾覆……') reachEnding('endingDefeat', true);
    else if (type === 'war' && /失守于【[^】]+】！$/.test(text) && S.flags.milestones?.prosperity) {
      S.flags.milestones.prosperity.loss = true;
    }
  });
  // 旧档可能已覆亡或统一，读档后无法靠下一回合补记覆亡。
  GAME.on('change', recordTerminalEndings);

  // ---------- 本纪 ----------
  const ANNALS_LIMIT = 300;
  const customUnlocks = new Set(['customUnify', 'customNorth', 'customLong']);
  const customUnlockKey = 'hwhs_custom_unlocks';
  function customUnlockState() {
    try { return new Set(JSON.parse(localStorage.getItem(customUnlockKey) || '[]').filter(id => customUnlocks.has(id))); }
    catch (err) { return new Set(); }
  }
  function customSlots() { return Math.min(3, 1 + customUnlockState().size); }
  function storeCustomUnlocks(honors) {
    const earned = [...customUnlocks].filter(id => honors[id]);
    if (!earned.length) return;
    const past = customUnlockState(), before = past.size;
    for (const id of earned) past.add(id);
    if (past.size === before) return;
    try { localStorage.setItem(customUnlockKey, JSON.stringify([...past])); } catch (err) { /* 禁用本地存储时照常游戏。 */ }
  }
  const ACHIEVEMENTS = [
    ['customUnify', '一统天下', '海内一统；以后开局自创名额 +1', f => f.unify, 100, '武功'],
    ['customNorth', '收复燕云', '占有燕京、大同；以后开局自创名额 +1', f => f.owns.has('燕京') && f.owns.has('大同'), 50, '疆土'],
    ['customLong', '绝境十年', '绝境开局存续十年；以后开局自创名额 +1', f => f.difficulty === 3 && f.elapsed >= 10 && f.cities > 0, 50, '武功'],
    ['firstWin', '首胜', '取得一场胜利', f => f.wins >= 1, 10, '武功'],
    ['tenWins', '十战奏捷', '取得十场胜利', f => f.wins >= 10, 25, '武功'],
    ['underdog', '以少胜多', '兵力未及敌半而胜十次', f => f.underdogs >= 10, 50, '武功'],
    ['stratagems', '运筹帷幄', '施计成功五十次', f => f.plans >= 50, 50, '武功'],
    ['firstCity', '初拓一城', '首次攻取一城', f => f.captures >= 1, 10, '疆土'],
    ['tenCities', '十克州城', '攻取城池十次', f => f.captures >= 10, 25, '疆土'],
    ['fortress', '铁壁', '据城击退来犯十次', f => f.holds >= 10, 25, '武功'],
    ['manual', '临阵制胜', '亲自指挥获胜', f => f.manualWins >= 1, 10, '武功'],
    ['bian', '收复汴京', '占领汴京', f => f.bian, 25, '疆土'],
    ['customs', '海港开埠', '一座港口设有市舶司', f => f.customs, 10, '文治'],
    ['threeReigns', '三朝元老', '同一大臣在三位皇帝治下担任朝官', f => f.threeReigns, 50, '人物'],
    ['distant', '千里奔袭', '距当朝都城至少二十格进攻获胜', f => f.distant, 25, '武功'],
    ['veteran', '宿将', '本朝一位将领升至十级', f => f.veteran, 25, '人物'],
    ['wealth', '府库充盈', '府库积钱一万贯', f => f.gold >= 10000, 25, '文治'],
    ['population', '户口殷阜', '治下户口达到五百万', f => f.population >= 500, 25, '文治'],
    ['scholarship', '格物大成', '拥有二十项科技', f => f.techs >= 20, 25, '文治'],
    ['restoration', '两京归宋', '达成还我河山', f => f.endings.endingRestoration, 50, '疆土'],
    ['north', '北境勒功', '达成直捣黄龙', f => f.endings.endingHuanglong, 50, '疆土'],
    ['flourishing', '五稔丰宁', '达成中兴之治', f => f.endings.endingProsperity, 50, '文治'],
    ['sea', '舶通四海', '达成海上称雄', f => f.endings.endingMaritime, 50, '外交'],
    ['hundredWins', '百战百胜', '取得一百场胜利', f => f.wins >= 100, 50, '武功'],
    ['eliminateArmy', '歼敌一军', '一战使敌军团覆没', f => f.annihilate, 25, '武功'],
    ['outnumbered', '一敌三军', '兵力不及敌军三分之一而胜', f => f.threefold, 50, '武功'],
    ['captureStreak', '岁内五捷', '一年之内攻取五城', f => f.captureStreak, 25, '武功'],
    ['waterWin', '楼船奏捷', '在水上战场获胜', f => f.waterWin, 25, '武功'],
    ['fullWall', '拔坚城', '攻克战前城防全满的城池', f => f.fullWall, 25, '武功'],
    ['generalThirty', '名将三十捷', '一位将领独胜三十场', f => f.heroWins >= 30, 50, '武功'],
    ['landSixty', '六十州图', '坐拥六十座城池', f => f.cities >= 60, 25, '疆土'],
    ['landHundred', '百州归心', '坐拥一百座城池', f => f.cities >= 100, 50, '疆土'],
    ['landTwoHundred', '二百州归宋', '坐拥二百座城池', f => f.cities >= 200, 50, '疆土'],
    ['yanjing', '克复燕京', '占领燕京', f => f.owns.has('燕京'), 25, '疆土'],
    ['baghdad', '兵临巴格达', '占领巴格达', f => f.owns.has('巴格达'), 50, '疆土'],
    ['constantinople', '兵临拂菻', '占领君士坦丁堡', f => f.owns.has('君士坦丁堡'), 50, '疆土'],
    ['danube', '饮马多瑙河', '占领多瑙河畔的埃斯泰尔戈姆', f => f.owns.has('埃斯泰尔戈姆'), 50, '疆土'],
    ['india', '王师至天竺', '占领一座天竺诸邦原有的城池', f => f.india, 25, '疆土'],
    ['allCapitals', '万国来朝', '占领诸国原都城', f => f.capitals, 100, '疆土'],
    ['techThirty', '百工竞巧', '拥有三十项科技', f => f.techs >= 30, 25, '文治'],
    ['techAll', '诸术毕备', '拥有全部科技', f => f.allTechs, 50, '文治'],
    ['tenMillion', '户盈千万', '治下户口达到一千万', f => f.population >= 1000, 50, '文治'],
    ['wealthThirty', '藏金三万', '府库积钱三万贯', f => f.gold >= 30000, 50, '文治'],
    ['tenPeacefulYears', '十载无乱', '连续十年治下未生民变', f => f.peaceful >= 40, 50, '文治'],
    ['tenVeterans', '十将并起', '麾下同时有十位十级将领', f => f.maxed >= 10, 50, '人物'],
    ['tenRecruits', '降将归心', '招降十位敌将', f => f.recruits >= 10, 25, '人物'],
    ['fullCourt', '六官咸备', '朝堂六官同时任满', f => f.fullCourt, 10, '人物'],
    ['yueNatural', '武穆考终', '岳飞活过五十二岁，病逝于任上或退居时', f => f.yueNatural, 25, '人物'],
    ['fiveAllies', '五国连盟', '同时与五国结盟', f => f.allies >= 5, 25, '外交'],
    ['threeTributes', '三邦输币', '同时收入三国岁币', f => f.tributes >= 3, 25, '外交'],
    ['fiveConquests', '五国归版图', '由我方攻灭五国', f => f.conquests >= 5, 25, '外交'],
    ['tenConquests', '十国归版图', '由我方攻灭十国', f => f.conquests >= 10, 50, '外交'],
    ['twentyConquests', '列国归版图', '由我方攻灭二十国', f => f.conquests >= 20, 50, '外交'],
    ['thirtySites', '名迹三十访', '亲访三十处不同奇遇', f => f.visits >= 30, 25, '奇遇'],
    ['fiveTreasures', '五宝在廷', '我朝将领与府库合有五种不同宝物', f => f.treasures >= 5, 25, '奇遇'],
    ['hardUnify', '逆势一统', '以' + DATA.DIFFICULTY.slice(2).map(d => d.name).join('或') + '难度一统天下', f => f.unify && f.difficulty >= 2, 100, '挑战'],
    ['quickUnify', '百载定鼎', '百年之内一统天下', f => f.unify && f.elapsed <= 100, 100, '挑战'],
    ['noTribute', '不输一贯', '一统天下，未曾向外邦纳岁币', f => f.unify && !f.paidTribute, 100, '挑战'],
    ['safeCapital', '社稷无虞', '一统天下，而京师未尝陷落', f => f.unify && !f.capLost, 100, '挑战'],
    ['greatWork', '百工告成', '竣工一项大工程', f => f.works > 0, 25, '文治'],
  ];
  let recordingHistory = false;
  const BATTLE_TOTALS = {
    wins: 0, losses: 0, underdogs: 0, plans: 0, holds: 0, manualWins: 0, captures: 0,
    distant: false, annihilate: false, threefold: false, waterWin: false, fullWall: false, heroWins: 0,
  };
  const INDIA_FACTIONS = new Set(DATA.FACTIONS.filter(f => f.culture === 'indian').map(f => f.id));
  const INDIA_CITIES = new Set(DATA.CITIES.filter(c => INDIA_FACTIONS.has(c.f)).map(c => c.name));
  function initAchievements(S) {
    S.flags ||= {};
    S.flags.capLost ??= false;
    const defaults = { recruits: 0, conquests: 0, paidTribute: false, visits: {}, captureTimes: [], lastRevolt: S.T, yueNatural: false, works: 0 };
    const book = S.flags.annals;
    const progress = S.flags.achievementProgress = Object.assign(defaults, S.flags.achievementProgress);
    if (!progress.capturedCapitals) {
      const recorded = new Set((book?.events || []).map(([, , text]) => /^王师克复(.+)。$/.exec(text)?.[1]));
      const foreign = new Set(DATA.CITIES.filter(c => c.cap && c.f !== S.player).map(c => c.name));
      progress.capturedCapitals = {};
      for (const c of S.cities) {
        if (c.origCap && (recorded.has(c.name) || c.f === S.player && foreign.has(c.name))) progress.capturedCapitals[c.id] = true;
      }
    }
    if (book) book.totals = Object.assign({}, BATTLE_TOTALS, book.totals);
  }

  function annalsState() {
    const S = G();
    return S.flags.annals || (S.flags.annals = {
      start: [S.year, S.season], events: [], eventCount: 0, reigns: [], service: {}, honors: {}, ministers: {},
      totals: { ...BATTLE_TOTALS },
    });
  }
  function writeAnnalsFact(book, text, battle) {
    const S = G(), chars = Array.from(text.trim().replace(/\s+/g, ' '));
    if (!chars.length) return;
    const short = chars.length <= 40 ? chars.join('') : chars.slice(0, 39).join('') + '…';
    book.events.push(battle ? [S.year, S.season, short, battle] : [S.year, S.season, short]);
    book.eventCount++;
    if (book.events.length > ANNALS_LIMIT) {
      // 优先保留即位、结局和城池易主等节点。
      const battle = book.events.findIndex(([, , text]) => annalPriority(text) === 1);
      const ordinary = battle < 0 ? book.events.findIndex(([, , text]) => annalPriority(text) === 2) : battle;
      const remove = Math.max(0, ordinary);
      book.events.splice(remove, 1);
      for (const reign of book.reigns) if (reign.first > remove) reign.first--;
    }
  }
  function recordReign(book) {
    const S = G(), emperor = reigningEmperor();
    if (!emperor) return;
    const last = book.reigns.at(-1);
    if (last?.id === emperor.start) return;
    const today = [S.year, S.season];
    if (last) last.until = today;
    const from = last ? today : [Math.max(1140, emperor.start), emperor.start <= 1140 ? 2 : 0];
    book.reigns.push({ id: emperor.start, from, name: emperor.name, title: emperor.title, first: book.events.length });
    if (last) writeAnnalsFact(book, emperor.title + '即位。');
  }
  function recordMinisters(book) {
    const S = G(), reign = book.reigns.at(-1)?.id;
    if (reign == null || book.threeReigns != null) return;
    for (const id of Object.values(S.court?.offices || {})) {
      const minister = GAME.gen(id);
      if (!minister || minister.f !== P() || minister.status !== 'court') continue;
      const last = book.ministers[id];
      if (last?.[0] === reign) continue;
      const terms = (last?.[1] || 0) + 1;
      if (terms === 3) {
        book.threeReigns = id;
        delete book.ministers;
        return;
      }
      book.ministers[id] = [reign, terms];
    }
  }
  function generalService(book, g) {
    return book.service[g.id] || (book.service[g.id] = { wins: 0, losses: 0 });
  }
  function annalsBattlePlace(rep) {
    if (rep.city) return rep.city;
    if (Number.isInteger(rep.tile) && GEO.NBR[rep.tile]) {
      // ring 按距离从近到远返回五格内的战场周边格子。
      for (const tile of GEO.ring(rep.tile, 5)) {
        const city = GAME.cityAt(tile);
        if (city) return city.name + '近郊';
      }
    }
    return '郊野';
  }
  function seasonBattleText(battle) {
    const count = value => value < 100 ? GAME.cnNum(value) : String(value);
    const wins = battle.wins ? count(battle.wins) + '捷' : '';
    const losses = battle.losses ? count(battle.losses) + '挫' : '';
    return `${battle.place || '诸路'}会战${count(battle.wins + battle.losses)}次，${wins}${losses}。`;
  }
  function mergeSeasonBattle(total, battle) {
    total.wins += battle.wins;
    total.losses += battle.losses;
    if (total.place !== battle.place) total.place = null;
  }
  function recordSeasonBattle(book, place, won) {
    const { year, season } = G();
    const battle = { wins: won ? 1 : 0, losses: won ? 0 : 1, place };
    const first = book.reigns.at(-1)?.first ?? 0;
    for (let i = book.events.length - 1; i >= first; i--) {
      const fact = book.events[i];
      if (fact[0] !== year || fact[1] !== season) break;
      if (fact[3]) {
        mergeSeasonBattle(fact[3], battle);
        fact[2] = seasonBattleText(fact[3]);
        return;
      }
    }
    writeAnnalsFact(book, seasonBattleText(battle), battle);
  }
  function recordAnnalsBattle(rep, attacking, won, plan, underdog, g) {
    const book = annalsState(), stats = book.totals;
    recordReign(book);
    if (won) stats.wins++; else stats.losses++;
    if (plan) stats.plans++;
    if (underdog) stats.underdogs++;
    if (won && rep.manual) stats.manualWins++;
    if (won) {
      if (rep.enemyArmyEliminated) stats.annihilate = true;
      const ours = attacking ? rep.before.a : rep.before.d, theirs = attacking ? rep.before.d : rep.before.a;
      if (ours > 0 && ours * 3 <= theirs) stats.threefold = true;
      if (Number.isInteger(rep.tile) && GEO.isWater(rep.tile)) stats.waterWin = true;
    }
    if (attacking && rep.fullWall && rep.city && rep.captured === rep.city) stats.fullWall = true;
    if (!attacking && won && rep.city && byName(rep.city)?.f === P()) stats.holds++;
    const cap = capital(P());
    if (attacking && won && cap && Number.isInteger(rep.tile) && GEO.dist(cap.tile, rep.tile) >= 20) stats.distant = true;
    if (g && g.f === P()) {
      const service = generalService(book, g);
      if (won) service.wins++; else service.losses++;
      stats.heroWins = Math.max(stats.heroWins, g.wins || 0, service.wins);
      service.attributes = [g.tong, g.wu, g.zhi, g.zheng];
    }
    awardAchievements(book);
    return book;
  }
  function awardAchievements(book, result) {
    if (Object.keys(book.honors).length === ACHIEVEMENTS.length) {
      storeCustomUnlocks(book.honors);
      return;
    }
    const S = G(), p = P(), F = fac(p), cities = GAME.citiesOf(p);
    const progress = S.flags.achievementProgress;
    const owns = new Set(cities.map(c => c.name));
    const ranks = S.generals.filter(g => g.f === p && active(g));
    const maxed = ranks.filter(g => g.lv >= 10).length;
    let allies = 0, tributes = 0;
    for (const f in S.factions) if (f !== p && f !== 'rebel' && alive(f)) {
      const rel = GAME.getRel(p, f);
      if (rel.ally) allies++;
      if (rel.trib?.to === p && rel.trib.amt > 0) tributes++;
    }
    const techs = Object.keys(F.techs).length;
    const times = progress.captureTimes;
    const facts = { ...book.totals, ...progress, endings: S.flags.milestones?.reached || {}, threeReigns: book.threeReigns != null,
      bian: owns.has('汴京'), customs: cities.some(c => c.port && c.buildings.shibosi),
      veteran: maxed > 0, maxed, gold: F.gold, techs, allTechs: techs === Object.keys(DATA.TECHS).length,
      population: cities.reduce((sum, c) => sum + c.pop, 0), cities: cities.length, owns,
      india: cities.some(c => INDIA_CITIES.has(c.name)), capitals: S.victory || S.cities.every(c => !c.origCap || c.f === p),
      peaceful: S.T - progress.lastRevolt, fullCourt: typeof COURT !== 'undefined' && COURT.OFFICES.slice(0, 6).every(o => COURT.holder(o.id)),
      captureStreak: times.length === 5 && times[4] - times[0] <= 4, visits: Object.keys(progress.visits).length,
      treasures: new Set(S.vault.concat(ranks.flatMap(g => g.items || []))).size, allies, tributes,
      unify: result === 'unify', capLost: S.flags.capLost, difficulty: S.difficulty, elapsed: S.T / 4 };
    for (const [id, name, , test, pts, cat] of ACHIEVEMENTS) {
      if ((cat !== '挑战' || result) && !book.honors[id] && test(facts)) {
        book.honors[id] = GAME.dateStr();
        GAME.log(`功业 · ${name} +${pts}`, 'big');
      }
    }
    storeCustomUnlocks(book.honors);
  }
  GAME.on('log', ({ text, type, tile }) => {
    const S = G(), progress = S.flags.achievementProgress;
    if (type === 'war' && /民变蜂起，乱民聚众/.test(text)) progress.lastRevolt = S.T;
    if (type === 'info' && /^岳飞病逝，享年/.test(text)) progress.yueNatural = true;
    const captured = type === 'war' && /^王师克复([^，]+)，/.exec(text);
    const fallen = type === 'war' && /^([^，。！]+)阵亡。$/.exec(text);
    const milestone = type === 'big' && /^(史官记曰：|四海归一，万国来朝|社稷倾覆)/.test(text);
    const conquest = type === 'big' && /^【[^】]+】亡国。$/.test(text);
    const opening = type === 'big' && /^绍兴十年七月，岳飞大破/.test(text);
    const lost = type === 'war' && /失守于【[^】]+】！$/.test(text);
    if (!captured && !fallen && !milestone && !conquest && !opening && !lost && !(recordingHistory && type === 'world')) return;
    const book = annalsState();
    recordReign(book);
    if (captured) {
      book.totals.captures++;
      const city = GAME.cityAt(tile);
      if (city?.origCap) progress.capturedCapitals[city.id] = true;
      progress.captureTimes.push(S.T);
      if (progress.captureTimes.length > 5) progress.captureTimes.shift();
      writeAnnalsFact(book, '王师克复' + captured[1] + '。');
    } else writeAnnalsFact(book, text);
    if (fallen) {
      const g = G().generals.find(g => g.f === P() && g.status === 'dead' && g.name === fallen[1]);
      if (g) {
        const service = generalService(book, g);
        service.fallen = true;
        service.attributes = [g.tong, g.wu, g.zhi, g.zheng];
      }
    }
  });
  GAME.on('change', () => {
    if (!G()) return;
    const book = annalsState();
    recordReign(book);
    recordMinisters(book);
  });

  const annalEsc = value => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
  const annalDate = date => annalEsc(GAME.dateStr(date[0], date[1]));
  function annalPriority(text) {
    if (/史官记曰|万国来朝|社稷倾覆|即位|亡国。|岳飞大破/.test(text)) return 3;
    if (/克复|失守|阵亡|以少胜多|岳飞大破/.test(text)) return 2;
    return 1;
  }
  function groupAnnalsBattles(events) {
    const groups = new Map(), facts = [];
    for (const fact of events) {
      const [year, season, text, battle] = fact;
      const legacy = !battle && /^(.+)会战，王师(告捷|受挫)。$/.exec(text);
      if (!battle && !legacy) { facts.push(fact); continue; }
      const entry = battle || { wins: legacy[2] === '告捷' ? 1 : 0, losses: legacy[2] === '受挫' ? 1 : 0,
        place: legacy[1] === '两军' ? '郊野' : legacy[1] };
      const key = year * 4 + season;
      const existing = groups.get(key);
      if (existing) mergeSeasonBattle(existing[3], entry);
      else {
        const group = [year, season, text, { ...entry }];
        groups.set(key, group);
        facts.push(group);
      }
    }
    for (const group of groups.values()) group[2] = seasonBattleText(group[3]);
    return facts;
  }
  function annalsAssessment(book) {
    const S = G(), p = P(), F = fac(p), cities = GAME.citiesOf(p);
    const people = cities.reduce((sum, c) => sum + c.pop, 0);
    const wars = book.totals;
    const home = DATA.CITIES.filter(c => c.f === p).length;
    const extent = S.defeat ? '而今朝廷已无寸土可守。' : cities.length > home ? '较南渡时版图已有开拓，仍当抚辑新附之民。' :
      cities.length < home ? '州县较开国初卷有所收缩，宜先固存城。' : '疆域与卷首大体相若，民户赖州县而居。';
    const funds = F.gold < 0 ? '军国之费尚赖权宜筹措。' : F.gold >= 1000 ? '府库有余，尤贵量入为出。' : '钱谷尚须审节，庶可备不虞。';
    const rounded = value => Math.round(Math.round(value * 100) / 100);
    return `史臣据州县簿书而论，今辖 ${cities.length} 州，计户口 ${people} 万。${extent}库钱 ${rounded(F.gold)} 贯，仓粮 ${rounded(F.food)} 石。${funds}入卷以来，行阵得胜 ${wars.wins} 次，失利 ${wars.losses} 次，攻城 ${wars.captures} 次。军报之功，当与民力消长并观，方可知一代兴替。`;
  }
  const SCORE_RULES = {
    city: 10, population: 0.5, capital: 50, tech: 8, treasuryCap: 20000, treasuryDivisor: 100,
    win: 2, loss: 1, conquest: 40, speedYears: 200, speedPoints: 5, unify: 1000, defeat: 0.5,
    difficulties: [0.6, 1, 1.4, 2],
    ratings: [[12000, '千古一帝'], [7000, '中兴英主'], [3500, '守成之君'], [900, '偏安之主'], [0, '亡国之君']],
  };
  const RESULT_TITLE = { unify: '海内一统', defeat: '社稷倾覆', retire: '禅位封卷' };
  const scoreRating = score => (SCORE_RULES.ratings.find(([min]) => score >= min) || SCORE_RULES.ratings.at(-1))[1];
  const speedBasis = elapsed => `(${SCORE_RULES.speedYears} − ${elapsed}) 年 × ${SCORE_RULES.speedPoints}` +
    (elapsed > SCORE_RULES.speedYears ? '（最低 0）' : '');
  function scoreBreakdown(result, factor, rows) {
    const R = SCORE_RULES;
    const rounded = rows.map(([label, value, basis]) => [label, Math.round(value), basis]);
    const subtotal = rounded.reduce((sum, [, value]) => sum + value, 0);
    const outcome = result === 'unify' ? R.unify : result === 'defeat' ? Math.round(subtotal * (R.defeat - 1)) : 0;
    const beforeDifficulty = subtotal + outcome;
    const total = Math.round(beforeDifficulty * factor);
    rounded.push(
      ['结局', outcome, result === 'defeat' ? `${subtotal} × (${R.defeat} − 1)` : RESULT_TITLE[result]],
      ['难度调整', total - beforeDifficulty, `${beforeDifficulty} × (${factor.toFixed(1)} − 1)`],
    );
    return { rows: rounded, total, rating: scoreRating(total) };
  }
  function settlementScore(ending) {
    const score = ending.score;
    if (!score) return finalScore(ending.type);
    if (score.rows.at(-1)?.[0] === '难度调整') return score;
    // 旧档已有结算快照时，按保存的分项重算，保留当时的功业与评语。
    const rows = score.rows.filter(([label]) => label !== '结局').map(row => {
      if (ending.type !== 'unify' || row[0] !== '用时加成') return row;
      const elapsed = row[1] > 0 ? SCORE_RULES.speedYears - row[1] / SCORE_RULES.speedPoints : score.years;
      return [row[0], row[1], speedBasis(Math.round(elapsed * 100) / 100)];
    });
    return { ...score, ...scoreBreakdown(ending.type, score.factor, rows) };
  }
  function achievements() {
    const honors = annalsState().honors;
    const entries = ACHIEVEMENTS.map(([id, name, desc, , pts, cat]) => ({ id, name, desc, pts, cat, date: honors[id] || '' }));
    const total = entries.reduce((sum, row) => sum + (row.date ? row.pts : 0), 0);
    return { entries, total, rating: finalScore(null, false, total).rating };
  }
  function finalScore(result = G().settlement?.type, settle = true, progressPoints = null) {
    const S = G(), player = P(), F = fac(player), book = annalsState(), R = SCORE_RULES;
    if (settle && result) awardAchievements(book, result);
    const earned = ACHIEVEMENTS.filter(([id]) => book.honors[id]);
    const points = progressPoints ?? earned.reduce((sum, [, , , , pts]) => sum + pts, 0);
    const cities = GAME.citiesOf(player), elapsed = S.T / 4;
    const population = cities.reduce((sum, c) => sum + c.pop, 0);
    const capitals = cities.filter(c => c.origCap).length;
    const techs = Object.keys(F.techs).length, treasury = Math.min(F.gold, R.treasuryCap);
    const { wins, losses } = book.totals, { conquests } = S.flags.achievementProgress;
    const speed = result === 'unify' ? Math.max(0, R.speedYears - elapsed) : 0;
    const round = n => Math.round(n * 100) / 100;
    const rows = [
      ['疆域', cities.length * R.city, `${cities.length} 城 × ${R.city}`],
      ['户口', population * R.population, `${population} 万 × ${R.population}`],
      ['都城', capitals * R.capital, `${capitals} 座 × ${R.capital}`],
      ['文治', techs * R.tech, `${techs} 项 × ${R.tech}`],
      ['府库', treasury / R.treasuryDivisor, `${round(treasury)} 贯 ÷ ${R.treasuryDivisor}`],
      ['武功', Math.max(0, wins * R.win - losses * R.loss), `${wins} 胜 × ${R.win} − ${losses} 负 × ${R.loss}，最低 0`],
      ['功业', points, `${earned.length} 项合计`],
      ['灭国', conquests * R.conquest, `${conquests} 国 × ${R.conquest}`],
      ['用时加成', speed * R.speedPoints, result === 'unify' ? speedBasis(round(elapsed)) : '一统时计入'],
    ];
    const factor = R.difficulties[S.difficulty] ?? 1;
    return { type: result, title: RESULT_TITLE[result], ...scoreBreakdown(result, factor, rows),
      factor, assessment: settle ? annalsAssessment(book) : '', turns: S.turn, years: Math.round(elapsed * 10) / 10,
      start: book.start?.[0] || 1140, end: S.year, difficulty: S.difficulty, scale: S.scale,
      honors: earned.map(([, name, , , pts]) => ({ name, pts })) };
  }
  function biographyStats(g, service) {
    return g.status === 'dead' && !g.hist ? service?.attributes || [0, 0, 0, 0] : [g.tong, g.wu, g.zhi, g.zheng];
  }
  function generalBio(g) {
    const stats = biographyStats(g, G()?.flags?.annals?.service?.[g.id]);
    return ['善整军伍', '勇于锋镝', '长于谋划', '晓于民政'][stats.indexOf(Math.max(...stats))] || '功业尚待史笔';
  }
  function leadingGenerals(book, count) {
    const S = G();
    return S.generals.filter(g => g.f === P() && !['future', 'cand', 'gone'].includes(g.status))
      .map(g => {
        const service = book.service[g.id];
        return { g, service, wins: Math.max(g.hist ? g.wins || 0 : 0, service?.wins || 0) };
      }).sort((a, b) => b.wins - a.wins || a.g.id - b.g.id).slice(0, count);
  }
  function settlementChronicle() {
    const book = annalsState();
    const events = groupAnnalsBattles(book.events).map((event, index) => ({ event, index }));
    events.sort((a, b) => annalPriority(b.event[2]) - annalPriority(a.event[2]) || b.index - a.index);
    return {
      events: events.slice(0, 12).sort((a, b) => a.event[0] - b.event[0] || a.event[1] - b.event[1] || a.index - b.index)
        .map(({ event: [year, season, text] }) => {
          const date = GAME.dateStr(year, season);
          const reignYear = date.slice(0, -1);
          if (!text.startsWith(reignYear)) return [date, text];
          const body = text.slice(reignYear.length);
          const suffix = /^(?:[春夏秋冬]季?|[正冬腊一二三四五六七八九十]{1,2}月(?:[初廿一二三四五六七八九十]{1,3}日?)?)?[，、,：:]\s*/.exec(body);
          return [date, suffix ? body.slice(suffix[0].length) : text];
        }),
      generals: leadingGenerals(book, 3),
    };
  }
  function generalBiographies(book) {
    return leadingGenerals(book, 5).map(({ g, service, wins }) => {
      const [tong, wu, zhi, zheng] = biographyStats(g, service);
      const end = service?.fallen ? '后殁于阵。' : g.status === 'dead' ? '此人已卒。' : '';
      const text = `${generalBio(g)}，统 ${tong}、武 ${wu}、智 ${zhi}、政 ${zheng}。计胜 ${wins} 阵，本纪记败 ${service?.losses || 0} 阵。${end}`;
      return `<p><b>${annalEsc(g.name)}</b>　${annalEsc(text)}</p>`;
    }).join('');
  }
  function annals() {
    const S = G();
    if (!S) return '';
    const book = S.flags.annals || {
      start: [S.year, S.season], events: [], eventCount: 0, reigns: [], service: {}, honors: {},
      totals: { wins: 0, losses: 0, captures: 0 },
    };
    const chapters = book.reigns.map((e, i) => {
      const next = book.reigns[i + 1]?.first ?? book.events.length;
      const related = groupAnnalsBattles(book.events.slice(e.first, next)).reverse();
      const selected = related.sort((a, b) => annalPriority(b[2]) - annalPriority(a[2])).slice(0, 8);
      selected.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const end = e.until ? annalDate(e.until) : annalDate([S.year, S.season]) + '（在位）';
      return `<p><b>${annalEsc(e.title)} ${annalEsc(e.name)}</b>　<span class="note">${annalDate(e.from)} 至 ${end}</span></p>` +
        (selected.length ? `<ul>${selected.map(fact => `<li><span class="note">${annalDate(fact)}</span>　${annalEsc(fact[2])}</li>`).join('')}</ul>` : '<p class="note">本卷尚无此朝大事。</p>');
    }).join('');
    const years = new Map();
    for (const [year, season, text] of groupAnnalsBattles(book.events).reverse()) {
      if (!years.has(year)) years.set(year, []);
      years.get(year).push([season, text]);
    }
    const chronology = Array.from(years, ([year, entries]) => `<p><b>公元 ${annalEsc(year)} 年</b><br>` +
      entries.sort((a, b) => annalPriority(b[1]) - annalPriority(a[1])).slice(0, 3).sort((a, b) => a[0] - b[0])
        .map(([season, text]) => `<span class="note">${annalDate([year, season])}</span>　${annalEsc(text)}`).join('<br>') + '</p>').join('');
    const honors = ACHIEVEMENTS.filter(([id]) => book.honors[id]).length;
    return `<div class="sec">史官评语</div><p class="story">${annalEsc(annalsAssessment(book))}</p>` +
      `<p class="note">本卷始录于${annalDate(book.start)}。${book.eventCount > book.events.length ? '本卷择录要事，不逾三百条。' : ''}</p>` +
      '<div class="sec">帝纪</div>' + (chapters || '<p class="note">本卷尚待入录。</p>') +
      '<div class="sec">大事年表</div>' + (chronology || '<p class="note">本卷尚无纪年大事。</p>') +
      '<div class="sec">大工程</div>' + (S.cities.flatMap(c => Object.entries(c.works || {}).filter(([, work]) => work.f === P()).map(([id, work]) =>
        `<p>${annalEsc(work.date)}　${annalEsc(c.name)}${DATA.GREAT_WORKS[id].name}竣工</p>`)).join('') || '<p class="note">尚无大工程竣工。</p>') +
      '<div class="sec">将相列传</div>' + (generalBiographies(book) || '<p class="note">本卷尚无列传。</p>') +
      `<div class="sec">功业成就</div><p>已成 ${honors} / ${ACHIEVEMENTS.length} 项 <button class="btn sm" data-act="honors">详见功业</button></p>`;
  }

  // ---------- 每回合 ----------
  function turn() {
    const S = G(), p = P();
    recoverBattleWounds();
    // 史实
    historyDispatch.clear();
    for (let i = 0; i < HIST.length; i++) {
      const h = HIST[i];
      if (S.flags['h' + i]) continue;
      if (S.year > h.y || (S.year === h.y && S.season >= h.s)) {
        S.flags['h' + i] = 1;
        recordingHistory = true;
        try { h.fn(); } catch (cause) { throw new Error(`史事 ${h.y} 年第 ${h.s + 1} 季（${i}）结算失败`, { cause }); }
        finally { recordingHistory = false; }
      }
    }
    historyChoices();
    if (S.newYear) mongolMuster();
    // 秦桧
    if (S.flags.qin === 'angry' && S.T >= S.flags.qinTurn && !S.flags.qinDone) { S.flags.qinDone = 1; S.pending.push({ ev: 'qinhui' }); }
    if (S.flags.qin === 'kept' && S.season === 3 && S.newSeason) fac(p).gold += 60;
    // 蒙古鼎盛期增援
    if (alive('mongol') && fac('mongol').mongolBoost && S.year < 1260 && S.season === 0 && S.newSeason && r() < 0.6) {
      const cs = GAME.citiesOf('mongol'); if (cs.length) { const c = GAME.pick(cs); c.garrison.push(GAME.mkUnit('hbow'), GAME.mkUnit('hbow'), GAME.mkUnit('cav')); }
    }
    // 科举：每三年春
    if (S.season === 0 && S.newSeason && alive(p)) {
      const cities = GAME.citiesOf(p), academies = cities.filter(c => c.buildings.academy).length;
      if (S.year % 3 === 2) {
        const max = Math.min(6, 3 + (GAME.hasTech(p, 'kejugaige') ? 1 : 0) + Math.floor(cities.length / 15));
        S.pending.push({ ev: 'keju', options: kejuCandidates(max, academies, cities), max });
      }
      if (S.flags.recommendYear !== S.year) {
        S.flags.recommendYear = S.year;
        const max = GAME.clamp(Math.floor(cities.length / 8), 1, 4);
        const options = Array.from({ length: max }, () => {
          const g = GAME.randomGeneral(p, 'civil', civilQuality(academies) - 4);
          g.status = 'cand';
          return g.id;
        });
        S.pending.push({ ev: 'recommend', options, max });
      }
    }
    // 汴京
    const bj = byName('汴京');
    if (bj && bj.f === p && !S.flags.hdjd && p === 'song') { S.flags.hdjd = 1; S.pending.push({ ev: 'hdjd' }); }
    const yj = byName('会宁');
    if (yj && yj.f === p && !S.flags.huanglong) { S.flags.huanglong = 1; S.flags.morale = (S.flags.morale || 0) + 3; S.pending.push({ ev: 'info', title: '克复会宁', text: '王师克金上京会宁府，诸将献捷，朝野称贺。\n\n（全国民心 +3）' }); }
    // AI 求和 / 请盟
    for (const f in S.factions) {
      if (f === p || f === 'rebel' || !alive(f)) continue;
      if (GAME.atWar(f, p) && r() < 0.15 * GAME.E()) {
        const w = GAME.aiWantsPeace(f, p);
        if (w > 25 && !S.pending.some(x => x.ev === 'peaceoffer' && x.from === f)) {
          const trib = w > 50 ? Math.round(5 + GAME.totalPower(f) / 80) : 0;
          offer({ ev: 'peaceoffer', from: f, trib }, 'diplomacy');
        }
      } else if (!GAME.atWar(f, p) && !GAME.allied(f, p) && fac(p).met[f] && GAME.getRel(f, p).op > 60 && r() < 0.03 * GAME.E()) {
        offer({ ev: 'allyoffer', from: f }, 'diplomacy');
      }
    }
    petitionEvents();
    scheduleChoices();
    if (alive(p) && r() < 0.22 * 0.68 * 0.24 * GAME.E()) {
      if (r() < 0.5) {
        fac(p).food += 120;
        GAME.log('风调雨顺，诸路丰稔，入粮一百二十石。', 'eco');
      } else {
        for (const c of GAME.citiesOf(p)) changeLoyalty(c, 4);
        GAME.log(GAME.pick(['麒麟见于郊野', '甘露降于宫苑', '黄河清', '嘉禾生于籍田', '凤凰集于岐山']) + '，群臣称贺，天下民心稍安。', 'eco');
      }
    }
    checkEndings();
    const book = annalsState();
    recordReign(book);
    recordMinisters(book);
    awardAchievements(book);
  }
  // 史实抉择有各自的时窗；民政抉择可依局势出现。
  function petitionEvents() {
    const S = G(), p = P(), cap = capital(p), flags = S.flags;
    if (!cap) return;
    if (p === 'song') {
      const yue = genByName('岳飞'), bian = ownedName('汴京', 'jin');
      if (!flags.yueVolunteers && S.year <= 1142 && yue && yue.f === p && yue.status === 'army' && bian && GAME.atWar(p, 'jin')) {
        const a = GAME.army(yue.loc);
        if (a && GEO.dist(a.tile, bian.tile) <= 4) {
          const c = nearCity(p, a.tile, 12);
          if (c) { flags.yueVolunteers = true; S.pending.push({ ev: 'yueVolunteers', city: c.id }); }
        }
      }
      const zhu = genByName('朱熹');
      if (S.newSeason && !flags.zhuxiAcademy && S.year >= 1175 && S.year <= 1200 && zhu && active(zhu) && zhu.f === p) {
        flags.zhuxiAcademy = true;
        S.pending.push({ ev: 'zhuxiAcademy', city: cap.id });
      }
      if (S.newSeason && !flags.kaixiCampaign && S.year === 1206 && S.season <= 1 && mayFight(p, 'jin')) {
        const target = ownedName('汴京', 'jin');
        const c = target && nearCity(p, target.tile, 12);
        if (c) { flags.kaixiCampaign = true; S.pending.push({ ev: 'kaixiCampaign', city: c.id }); }
      }
    }
    if (flags.xiangyangSiege && S.year >= 1273) {
      delete flags.xiangyangSiege;
      const c = byName('襄阳');
      if (c && ['song', 'mongol'].includes(c.f)) {
        worldLog(c.f === 'song' ? '襄樊久围，守臣仍奉宋朔。诸道转输，汉水粮路未绝。' :
          '襄阳城易主，汉水门户大开，江汉诸城闻报戒严。', ['song', 'mongol']);
      }
    }
  }

  function legacyPool(cs) {
    const S = G(), p = P(), pool = [];
    const minister = typeof COURT !== 'undefined' && S.court ? COURT.holder('zaixiang') : null;
    const g = minister || cs.map(c => GAME.gen(c.governor)).find(g => g && g.zheng >= 83);
    if (g && g.f === p && active(g)) pool.push({ ev: 'powerfulMinister', gen: g.id });
    if (p === 'song') pool.push({ ev: 'disputedHeir' });
    const ports = cs.filter(c => c.port && c.buildings.shibosi);
    if (ports.length) pool.push({ ev: 'customsLevy', city: GAME.pick(ports).id });
    const floodplain = cs.filter(c => {
      const [lon, lat] = GEO.lonlatOf(GEO.colOf(c.tile), GEO.rowOf(c.tile));
      return GEO.river[c.tile] && lon >= 105 && lon <= 119 && lat >= 33 && lat <= 39;
    });
    if (floodplain.length) pool.push({ ev: 'yellowRiverShift', city: GAME.pick(floodplain).id });
    const india = ['chola', 'lanka', 'pala', 'gahad', 'chalukya', 'rajput'].filter(f => f !== p &&
      alive(f) && fac(p).met[f] && !GAME.atWar(p, f));
    if (india.length && ports.length) pool.push({ ev: 'indianMonk', from: GAME.pick(india) });
    const city = GAME.pick(cs);
    pool.push({ ev: 'plague', city: city.id }, { ev: 'earthquake', city: city.id }, { ev: 'comet' },
      { ev: 'drought', city: city.id }, { ev: 'talent' });
    const river = GAME.pick(cs.filter(x => GEO.river[x.tile])), port = GAME.pick(cs.filter(x => x.port));
    if (river) pool.push({ ev: 'flood', city: river.id });
    if (port) pool.push({ ev: 'pirates', city: port.id });
    const friendly = GAME.pick(Object.keys(S.factions).filter(f => f !== p && f !== 'rebel' && alive(f) && fac(p).met[f] && !GAME.atWar(p, f)));
    if (friendly) pool.push({ ev: 'tribute', from: friendly });
    const hostile = Object.keys(S.factions).filter(f => f !== 'rebel' && alive(f) && GAME.atWar(p, f));
    for (const enemy of hostile) {
      const border = cs.find(c => nearCity(enemy, c.tile, 6));
      if (border) { pool.push({ ev: 'borderPetition', city: border.id, enemy }); break; }
    }
    const towns = cs.filter(c => !c.buildings.market);
    if (towns.length) pool.push({ ev: 'merchantProposal', city: GAME.pick(towns).id });
    const items = Object.keys(DATA.ITEMS).filter(id => !S.itemsTaken[id] &&
      !S.pending.some(v => v.ev === 'offeredTreasure' && v.item === id));
    const gens = S.generals.filter(g => g.f === p && active(g) && (g.items || []).length < 3);
    const eligible = items.filter(id => gens.some(g => !GAME.itemEquipReason(g, id)));
    if (eligible.length) {
      const item = GAME.pick(eligible);
      pool.push({ ev: 'offeredTreasure', item, gen: GAME.pick(gens.filter(g => !GAME.itemEquipReason(g, item))).id });
    }
    return pool;
  }

  // 冷却以季计；年度从玩家开局之日算起，换刻度不重开年度。
  const categoryWait = { local: 0.4, situation: 0.45, person: 1, court: 2, diplomacy: 1, battle: 0.5, 农事: 1.5, 灾异: 2, 风俗: 1.5, 工役: 1.5, 释道: 2, 市易: 1.5, 学术: 1.5, 乡政: 1.5, 宾客: 2 };
  const systemEvents = new Set(['levelup', 'info', 'cityPromotion', 'frontierSpoils', 'leagueMuster', 'keju', 'recommend', ...Object.keys(ENDINGS), 'wanyanliang', 'temujin']);
  const registry = [];
  const elapsedDays = () => (G().year - 1140) * 360 + G().doy - 189;
  const isDecision = id => !systemEvents.has(id);

  function initSchedule(s) {
    s.flags ||= {};
    const day = (s.year - 1140) * 360 + s.doy - 189;
    const year = Math.floor(day / 360);
    // 旧档从本年度已经过去的位置接续，避免补发多年积压的奏疏。
    if (s.flags.eventSchedule) return;
    const last = {}, lastDay = {};
    // 旧版战后账簿可反推最近一次弹窗。其余旧剧情没有可靠的出现日期。
    for (const [id, next] of Object.entries(s.flags.battleEvents?.next || {})) {
      if (BATTLE_WAIT[id] != null) {
        last[id] = next - BATTLE_WAIT[id];
        lastDay[id] = day - Math.round((s.T - last[id]) * 90);
      }
    }
    s.flags.eventSchedule = { last, lastDay, groups: {}, history: {}, year,
      count: Math.floor((day - year * 360) * 7 / 360) };
  }
  function scheduleState() {
    const ledger = G().flags.eventSchedule, year = Math.floor(elapsedDays() / 360);
    if (ledger.year !== year) { ledger.year = year; ledger.count = 0; }
    return ledger;
  }
  function eligible(id, group) {
    const s = G(), d = scheduleState();
    // S.T 在压缩旧档里只留两位小数；以历日复核，反复读档也不会缩短十年。
    return (d.lastDay[id] == null || elapsedDays() - d.lastDay[id] >= 3600) &&
      (d.last[id] == null || s.T - d.last[id] >= 40 - 1e-8) &&
      (d.groups[group] == null || s.T - d.groups[group] >= (categoryWait[group] || 0) - 1e-8) &&
      !s.pending.some(p => p.ev === id);
  }
  function offer(p, group) {
    if (!eligible(p.ev, group)) return false;
    G().pending.push(p);
    scheduleState().groups[group] = G().T;
    return true;
  }
  function declare(row) {
    if (DEFS[row.id]) throw new Error('事件重名 ' + row.id);
    registry.push(row);
    DEFS[row.id] = { person: row.group === 'person' ? row.people[0] : null, title: row.title, text: p => {
      const city = GAME.city(p.city), g = GAME.gen(p.gen);
      return [p.news, row.text.replaceAll('{城}', city?.name || '本州').replaceAll('{人}', g?.name || '此人')
        .replaceAll('{迹}', p.site || '道旁旧迹').replaceAll('{学}', DATA.TECHS[p.tech]?.name || '新法')].filter(Boolean).join('\n\n');
    }, choices: row.choices.map(([t, effects]) => ({
      t, d: p => [describeEffects(effects, p)
        .replaceAll('本城', GAME.city(p.city)?.name || '本城')
        .replaceAll('本人', GAME.gen(p.gen)?.name || '本人')
        .replaceAll('两国好感', (fac(p.from)?.name || '对方') + '好感'), effects.peace && peaceTerms(p.from)].filter(Boolean).join('。'),
      fn: p => applyEffects(p, effects),
    })) };
  }
  const effectNames = { gold: '钱', food: '粮', man: '兵源', sci: '文教', auth: '权威',
    happy: '本城民心', wall: '本城城防', loyalty: '本人忠诚', tong: '本人统率', wu: '本人武勇',
    zhi: '本人智略', zheng: '本人政略', morale: '本军士气', opinion: '两国好感', retire: '致仕', peace: '议和', inf: '守军步营' };
  function describeEffects(effects, p) {
    return Object.entries(effects).map(([k, n]) => {
      if (!(k in effectNames) || !Number.isFinite(n)) throw new Error('事件效果有误 ' + k);
      if (k === 'retire') return '本人解职归田，退出仕籍';
      if (k === 'peace') return '两国息兵' + (alive(p.from) ? GAME.peaceTruce(P(), p.from, { truce: n }) : n) + '季';
      return effectNames[k] + (n > 0 ? ' +' : ' −') + Math.abs(n);
    }).join('，');
  }
  function applyEffects(p, effects) {
    const f = fac(P()), c = owned(p.city, P()), g = playerGeneral(p.gen), a = playerArmy(p.army);
    for (const [k, n] of Object.entries(effects)) {
      if (['gold', 'food', 'sci', 'man'].includes(k)) f[k] = GAME.clamp(f[k] + n, k === 'gold' ? -200 : k === 'food' ? -50 : 0, Infinity);
      else if (k === 'happy' && c) changeLoyalty(c, n);
      else if (k === 'wall' && c) c.wall = GAME.clamp(c.wall + n, 0, GAME.maxWall(c));
      else if (k === 'inf' && c) reinforce(c, Array(n).fill('inf'));
      else if (k === 'auth') courtAuthority(n);
      else if (k === 'morale' && a) moraleAfterBattle(a.id, n);
      else if (k === 'retire' && g) { GAME.unassign(g.id); g.status = 'gone'; }
      else if (k === 'opinion' && alive(p.from)) {
        const rel = GAME.getRel(P(), p.from); rel.op = GAME.clamp(rel.op + n, -100, 100);
      } else if (k === 'peace' && alive(p.from) && GAME.atWar(P(), p.from)) {
        GAME.makePeace(P(), p.from, null, { truce: n });
      } else if (g && k === 'loyalty') {
        COURT.ensure(g);
        g.loyalty = GAME.clamp(g.loyalty + n, 0, 100);
      } else if (g && ['tong', 'wu', 'zhi', 'zheng'].includes(k)) GAME.applyLevel(g, { k: 'stat', s: k, v: n });
    }
  }

  function draw(pool) {
    let roll = r() * pool.reduce((sum, entry) => sum + entry.weight, 0);
    for (const entry of pool) { roll -= entry.weight; if (roll < 0) return entry; }
    return pool[pool.length - 1];
  }
  function scheduleChoices() {
    const s = G(), cs = GAME.citiesOf(P());
    if (!cs.length) return;
    const d = scheduleState(), day = elapsedDays() % 360;
    const target = Math.min(7, Math.floor((day + s.scale) * 7 / 360));
    let missing = target - d.count - s.pending.filter(p => isDecision(p.ev)).length;
    if (missing <= 0) return;
    const base = legacyPool(cs).map(p => ({ p, group: 'local', weight: 1 }));
    if (s.court) for (const p of COURT.candidates()) base.push({ p, group: 'court', weight: 2 });
    for (const row of registry) {
      const group = row.family || row.group;
      if (group === 'history' || !eligible(row.id, group)) continue;
      const ctx = row.context(cs);
      if (ctx) base.push({ p: { ev: row.id, ...ctx }, group, weight: row.weight || 1 });
    }
    while (missing-- > 0) {
      const choices = base.filter(x => eligible(x.p.ev, x.group));
      if (!choices.length) break;
      const { p, group } = draw(choices);
      if (p.ev === 'talent') {
        p.mil = r() < 0.5;
        const g = GAME.randomGeneral(P(), p.mil ? 'mil' : 'civil', 50 + r() * 12);
        g.status = 'cand'; p.gen = g.id;
      }
      offer(p, group);
    }
  }

  // 十一批史事按年季排列。news 行须收到同一季世界规则的实报，故城破、守住各从本局；
  // 其余行列出城主、在职人物、交战双方等前提。旧 HIST 的下标是旧档键，不重排。
  const historyLine = (y, season, id, title, need, text, choices) =>
    ({ y, season, id, title, ...need, text, choices, group: 'history',
      condition: need.news ? '当季收到对应实报，已通问或我城距有关势力十格以内' : '按表中城主、人物与战局裁定',
      cities: Object.keys(need.seats || {}), people: Object.keys(need.service || {}) });
  const HISTORY_CHOICES = [
    historyLine(1147, 1, 'secondCross', '东征军过海', { news: true, foreign: ['crusader','france','hre'] },
      '西来舶主请凭公牒护货，译者则愿往诸港，探问兵后道路。', [
        ['给牒通商，收其舶税', { gold: 55, auth: -1 }], ['遣译者持节问道', { gold: -35, opinion: 10 }]]),
    historyLine(1153, 0, 'jinCapital', '燕京新都', { news: true, foreign: ['jin'] },
      '金人迁治，往来文书皆须改道。有司议遣使更定程驿，边臣请先访北地道里。', [
        ['致书新都', { gold: -35, opinion: 9 }], ['购求道里图经', { gold: -25, sci: 45 }]]),
    historyLine(1156, 2, 'hogen', '京都两院之争', { news: true, foreign: ['japan'] },
      '日本客舟留泊，请给归程之粮。国子监亦请留其通汉字者，校所携旧钞。', [
        ['给粮送归', { food: -45, opinion: 10 }], ['馆其书手', { gold: -35, sci: 55 }]]),
    historyLine(1162, 0, 'xinReturn', '辛弃疾南归', { seats: { 济南:'jin', 建康:'song' }, service: { 辛弃疾:'song' } },
      '辛弃疾自山东南归，具陈义军离合，随行者多无田可归。是籍其壮者为兵，还是先给田粮安家？', [
        ['给饷录壮士', { gold: -55, man: 14, loyalty: 3 }], ['给粮安其家', { food: -65, happy: 6, loyalty: 6 }]]),
    historyLine(1163, 1, 'fuli', '隆兴北伐议符离', { seats: { 寿州:'song', 徐州:'jin' }, service: { 张浚:'song' }, war: ['song','jin'] },
      '张浚奏淮北军情。师出符离一路，进则转饷路长，留屯则可护新集之民。诸将请定进止。', [
        ['发粮接济前军', { food: -85, man: 14, loyalty: 4 }], ['先固淮上诸寨', { gold: -45, wall: 18, happy: 3 }]]),
    historyLine(1177, 1, 'angkorRaid', '真腊告警', { news: true, foreign: ['khmer','champa'] },
      '南海商舶见江口戒严，载米者愿赴急，载货者请改泊别澳。', [
        ['赈米以济远人', { food: -55, opinion: 12 }], ['允其转售，收商税', { gold: 50, opinion: -3 }]]),
    historyLine(1185, 1, 'kamakura', '镰仓掌兵', { news: true, foreign: ['japan'] },
      '东国武家握兵柄，京都朝仪仍旧。市舶司请定渡海商人所持书牒。', [
        ['遣通事往问关津', { gold: -35, opinion: 10 }], ['准海商自具保状', { gold: 50, auth: -1 }]]),
    historyLine(1187, 3, 'jerusalem', '耶路撒冷军报', { news: true, foreign: ['fatimid','crusader'] },
      '圣城兵革未息，东返驼队中有避乱之家，亦有熟识西市之人。', [
        ['发粟收容流寓', { food: -60, happy: 6 }], ['馆译人录西域程途', { gold: -40, sci: 55 }]]),
    historyLine(1189, 1, 'thirdCross', '诸王再举东征', { news: true, foreign: ['crusader','england','france','hre'] },
      '海道多征舟，商人求并船远行。馆伴请访西国使者，问诸港可泊之处。', [
        ['给资遣使', { gold: -40, opinion: 12 }], ['许商人合舶输货', { gold: 50, auth: -1 }]]),
    historyLine(1195, 3, 'qingyuan', '庆元论学', { seats: { 临安:'song' }, service: { 朱熹:'song' } },
      '近臣攻道学者渐众，请以所习经说别士人进退。朱熹门人惧及师友，上书自明。', [
        ['诏学官听各家讲说', { auth: -2, sci: 60, loyalty: 6 }], ['令有司覆核选籍', { auth: 3, loyalty: -6 }]]),
    historyLine(1204, 1, 'fourthCross', '拂菻城下', { news: true, foreign: ['byz','venice','crusader'] },
      '拂菻来客携旧抄求寄，海商则请厚酬引水人，绕兵船行货。', [
        ['收其旧抄，廪给来客', { food: -50, sci: 60 }], ['给凭改道行商', { gold: 55, auth: -1 }]]),
    historyLine(1208, 2, 'jiading', '嘉定和议', { seats: { 楚州:'song', 汴京:'jin' }, war: ['song','jin'], from: 'jin' },
      '开禧兵后，宋金边民俱疲。金使至淮上言和，欲先定礼物、罢边兵。守臣亦言守备稍修，尚可持重。', [
        ['出帑遣使，约罢边兵', { gold: -100, peace: 20 }], ['留使更议，募兵护边', { gold: -45, man: 12 }]]),
    historyLine(1215, 1, 'charter', '英王与诸侯立约', { news: true, foreign: ['england'] },
      '西客传其国君臣以书约束征敛。太学请译所闻，商旅则请问津税新例。', [
        ['令学官访其条目', { gold: -35, sci: 50 }], ['遣使问商税', { gold: -25, opinion: 8 }]]),
    historyLine(1219, 2, 'khwarazmRoad', '河中商路', { news: true, foreign: ['khwarazm','mongol'] },
      '西来贾人所携商引已难通行，愿以所知道路换取归资。边吏亦请留其善马者。', [
        ['给资录山川', { gold: -35, sci: 55 }], ['给粮募为驿卒', { food: -45, man: 11 }]]),
    historyLine(1227, 2, 'tangutFall', '河西来报', { news: true, foreign: ['xia','mongol'] },
      '河西兵尘起，边市有人持蕃汉旧籍来求食，有人愿就地编户。', [
        ['购其典籍', { gold: -45, sci: 65 }], ['开廪安集编户', { food: -60, man: 8, happy: 4 }]]),
    historyLine(1229, 0, 'jaffa', '雅法约成', { news: true, foreign: ['crusader','fatimid','hre'] },
      '西海暂息兵，往朝圣地者复上路。商人请给公凭，僧侣中亦有能译诸国语者。', [
        ['许复商行', { gold: 50, auth: -1 }], ['延译人通书问', { gold: -40, opinion: 10 }]]),
    historyLine(1231, 2, 'koreaBorder', '高丽北境', { news: true, foreign: ['goryeo','mongol'] },
      '海东客船抵岸，称沿江人家离散。守臣请赈渡海之民，或致书问其虚实。', [
        ['给粮置舍', { food: -55, happy: 6 }], ['遣使问讯', { gold: -35, opinion: 10 }]]),
    historyLine(1233, 2, 'joinAgainstJin', '联蒙攻金之议', { seats: { 襄阳:'song', 蔡州:'jin' }, war: ['mongol','jin'], from:'mongol', peaceWith:'mongol' },
      '金师困于中原，北使议夹攻蔡州，求通我粮道。边臣或欲连兵，或虑金亡而北军即与我接境。', [
        ['输粮相助，约使通问', { food: -90, opinion: 15 }], ['留粮守襄，益戍一营', { food: -45, inf: 1, opinion: -5 }]]),
    historyLine(1234, 1, 'luoyang', '端平入洛之议', { seats: { 襄阳:'song' }, lost:'jin', beyond:'洛阳' },
      '金亡，议者请自淮、汉进取洛阳。河南久经兵燹，路无宿储，若止师不进，又恐坐失机会。', [
        ['给转饷，募前军向洛', { food: -95, man: 18 }], ['留戍汉上，修仓城', { gold: -55, wall: 20, happy: 3 }]]),
    historyLine(1236, 1, 'batuWest', '长子军西去', { news: true, foreign: ['mongol','rus','bulgar','cuman','hungary','poland'] },
      '北方诸王子集军西行，旧驿多征马。商旅请以货赎道，行人欲遣译骑访知诸部向背。', [
        ['拨缗遣译骑', { gold: -35, opinion: 11 }], ['许其更道卖货', { gold: 50, auth: -1 }]]),
    historyLine(1240, 3, 'kyiv', '基辅陷后', { news: true, foreign: ['rus','mongol'] },
      '自西北来者述城中工匠离散，愿随商队东行。其老弱亦求附籍。', [
        ['厚给匠食，录其技业', { food: -50, sci: 55 }], ['赎其流户，给籍安居', { gold: -50, happy: 7 }]]),
    historyLine(1258, 0, 'baghdad', '巴格达书厄', { news: true, foreign: ['abbasid','mongol'] },
      '两河书贾携抄本入商队，行囊有数，不能尽载。使臣问所当先取。', [
        ['以缗购历算图书', { gold: -50, sci: 70 }], ['先给流人归粮', { food: -60, happy: 7 }]]),
    historyLine(1259, 2, 'diaoyu', '钓鱼城军报', { seats: { 重庆:'song' }, service: { 蒙哥:'mongol' }, war: ['song','mongol'], fieldDeath: true },
      '蜀中奏至，蒙哥亲征钓鱼城，殁于军中。守臣请乘其诸部未定招集乡兵，转运司则请先息夫役。', [
        ['出帑募川中义兵', { gold: -65, man: 16 }], ['赈恤挽夫，令归治田', { food: -55, happy: 8 }]]),
    historyLine(1260, 2, 'ainJalut', '艾因贾鲁交兵', { news: true, foreign: ['fatimid','mongol'] },
      '叙利亚诸城消息不一，商队止于通衢。若使译人先行，可问关津，若收滞货，可济商困。', [
        ['厚给译人，使通关问', { gold: -40, opinion: 12 }], ['收货转售以济商旅', { gold: 45, auth: -1 }]]),
    historyLine(1263, 1, 'publicFields', '公田之议', { seats: { 临安:'song' }, service: { 贾似道:'song' } },
      '贾似道议买浙西田，以租入供军。田价若轻，民必失所，若仍和籴，又费官帑。有司具两策请裁。', [
        ['试买公田，收租济饷', { gold: -45, food: 105, happy: -5 }], ['仍循和籴，从市给价', { gold: -75, food: 65, happy: 4 }]]),
    historyLine(1268, 2, 'xiangfan', '襄樊待援', { news: true, seats: { 襄阳:'song' } },
      '守臣报汉水舟行日艰，所乏者粮与守城卒。仓舟能载之物有限，请择先后。', [
        ['发粮舟接济军民', { food: -80, happy: 9 }], ['调卒实城', { man: -10, inf: 1, wall: 12 }]]),
    historyLine(1274, 3, 'hakata', '博多海防', { news: true, foreign: ['japan','mongol'] },
      '北来舟师出海，日本诸津留客船备守。明州市舶司议如何接应归舶。', [
        ['给还乡舶水粮', { food: -50, opinion: 10 }], ['访潮汐港澳，录为海图', { gold: -40, sci: 60 }]]),
    historyLine(1275, 0, 'wenRises', '文天祥起兵', { seats: { 赣州:'song' }, service: { 文天祥:'song' }, war: ['song','mongol'] },
      '文天祥请集义士勤王，乡里输财赴募。众未习行阵，给饷即行与留州整伍，两说未决。', [
        ['发饷应募，集兵赴援', { gold: -75, man: 16, loyalty: 5 }], ['益赣州守备，徐图进取', { food: -55, inf: 1, zheng: 1 }]]),
  ];
  const historyDispatch = new Map();
  for (const row of HISTORY_CHOICES) {
    if (row.beyond) row.cities.push(row.beyond);
    declare(row);
  }
  function historyChoices() {
    const s = G(), book = scheduleState().history;
    for (const h of HISTORY_CHOICES) {
      if (s.year !== h.y || s.season !== h.season || book[h.id]) continue;
      book[h.id] = true;
      const news = historyDispatch.get(h.id);
      if (h.news && !news) continue;
      if (!Object.entries(h.seats || {}).every(([n, f]) => ownedName(n, f))) continue;
      if (!Object.entries(h.service || {}).every(([n, f]) => activeIn(n, f))) continue;
      if (h.war && (!h.war.every(alive) || !GAME.atWar(...h.war))) continue;
      if (h.lost && alive(h.lost) || h.beyond && byName(h.beyond)?.f === P() || h.peaceWith && GAME.atWar(P(), h.peaceWith)) continue;
      const city = h.cities.map(byName).find(c => c?.f === P()) || capital(P());
      if (!city) continue;
      const g = genByName(h.people[0]);
      if (h.fieldDeath) {
        const a = g.status === 'army' && GAME.army(g.loc);
        if (!a || GEO.dist(a.tile, city.tile) > 6) continue;
        GAME.killGeneral(g, '征蜀时卒于军中');
      }
      if (!news) GAME.log(h.text, 'world');
      const from = h.foreign?.find(f => fac(P()).met[f] || GAME.nearPlayer(f)) || h.from;
      if (h.foreign && !from) continue;
      // 易主或亡国后，通问的对象改取当前仍存且与我相识的相关政权。
      const envoy = h.foreign?.find(f => alive(f) && (fac(P()).met[f] || GAME.nearPlayer(f))) || from;
      if (h.choices.some(([, fx]) => fx.opinion) && !alive(envoy)) continue;
      if (envoy && alive(envoy)) GAME.meet(P(), envoy, true);
      s.pending.push({ ev: h.id, city: city.id, gen: g?.f === P() ? g.id : undefined, from: envoy, news });
    }
  }

  // 情境从本局状态取对象，只把稳定的 id 存入待决奏疏。
  function townWhere(cs, predicate) {
    const c = GAME.pick(cs.filter(predicate));
    return c && { city: c.id };
  }
  function officerWhere(test) {
    const g = GAME.pick(G().generals.filter(g => g.f === P() && active(g) && test(g)));
    return g && { gen: g.id };
  }
  function armyWhere(test) {
    const a = GAME.pick(G().armies.filter(a => a.f === P() && test(a)));
    return a && { army: a.id, gen: a.gen };
  }
  const ownTown = cs => ({ city: GAME.pick(cs).id });
  const recent = (fact, seasons = 2) => fact && G().T - fact.t <= seasons;
  function situation(id, title, condition, context, text, ...choices) {
    declare({ id, title, group: 'situation', weight: 2.4, condition, context, text, choices });
  }
  situation('victoryMerit', '捷后论功', '两季内我朝大捷，主将仍效力', () => {
    const v = G().flags.lastVictory;
    return recent(v) && playerGeneral(v.gen) && { gen: v.gen };
  }, '捷书既达，{人}先呈阵亡军士之籍，继呈将佐功状。赏格有限，当自何者始？',
    ['厚恤军士之家', { gold: -55, man: 12 }], ['擢主将，命校阵图', { tong: 1, loyalty: 5, auth: -1 }]);
  situation('proudRanks', '胜卒争席', '有士气九十以上且主将曾获胜的军团', () =>
    armyWhere(a => a.morale >= 90 && GAME.gen(a.gen)?.wins > 0), '凯旋之卒入市求酒，恃功争坐上席。军正以违令上闻，主将请以新功宽之。',
    ['申明军令', { morale: -6, auth: 3 }], ['赐酒于营，责将自约', { gold: -45, loyalty: 5 }]);
  situation('longInvestment', '围城缺薪', '同一宋城连续受攻已满一季，攻势间隔不逾两季，最近一季仍有攻城', cs =>
    townWhere(cs, c => c.siegeStart != null && G().T - c.siegeStart >= 1 && recent({t:c.siegeLast},1)),
    '{城}屡受围攻，炊烟渐稀。守臣请发夫输薪，百姓则求开仓就食，省却往来之劳。',
    ['发夫输薪固守', { man: -8, wall: 20 }], ['赈粟宽城中之役', { food: -65, happy: 8 }]);
  situation('newOaths', '新附乡约', '两年内归宋的异国城池', cs =>
    townWhere(cs, c => c.recentCapture?.from !== P() && c.recentCapture && G().T - c.recentCapture.t <= 8),
    '{城}初附，诸姓不肯遽出旧户籍，请先明赋役之数。守臣欲择乡老为保，用其言取信。',
    ['缓征而验户', { gold: -55, happy: 9 }], ['即日立保，募乡兵', { man: 12, happy: -4 }]);
  situation('faminePrice', '米贵闭籴', '国粮不足四十', cs => fac(P()).food < 40 && ownTown(cs),
    '{城}米廛空闭，里长候于县门求籴。官仓亦乏，可出钱求邻郡粟，亦可暂借富户之积。',
    ['以帑钱籴米', { gold: -65, food: 100 }], ['向大户借粟', { food: 65, happy: -4 }]);
  situation('emptyVault', '府藏见底', '府钱不足六十', cs => fac(P()).gold < 60 && ownTown(cs),
    '度支展出库簿，常费将无所出。{城}商户愿预输一季课钱，条件是放宽牙税；亦可移卖仓粟。',
    ['出粟平粜', { food: -65, gold: 75 }], ['预借商课，许其议价', { gold: 85, auth: -3 }]);
  situation('arrears', '戍卒索饷', '国库亏空且有士气不足七十的军团', () =>
    fac(P()).gold < 0 && armyWhere(a => a.morale < 70), '戍卒持券问饷，军吏恐聚而生怨。权给口粮可以济急，亦可令不堪久戍者归田。',
    ['给粮抵饷', { food: -55, morale: 10 }], ['汰冗籍，发还乡资', { man: -6, gold: 40, morale: 4 }]);
  situation('overmighty', '边将自专', '掌兵之将野心过七十且忠诚未及七十五', () =>
    officerWhere(g => g.status === 'army' && g.amb > 70 && g.loyalty < 75),
    '{人}未经枢府覆奏，自辟幕职。台官欲追问所由，边臣却言临敌易令难行。',
    ['收回辟署之权', { auth: 4, loyalty: -8 }], ['宽其一任，责以成效', { loyalty: 8, auth: -2 }]);
  situation('rivalOfficers', '两营争长', '有两位立场不同的现役主将', () => {
    const gs = G().generals.filter(g => g.f === P() && g.status === 'army');
    const a = gs.find(g => gs.some(h => h.stance && g.stance && h.stance !== g.stance));
    return a && { gen: a.id, army: a.loc };
  }, '{人}与别营主将各持一议，军书相诘，莫肯先署。是命一人总其事，还是付军正会勘？',
    ['令其总署，专责成败', { loyalty: 6, tong: 1, auth: -2 }], ['遣军正勘核两营', { gold: -35, auth: 3, morale: -2 }]);
  situation('oldCampaigner', '宿将请药', '在职史实将领年满五十八', () =>
    officerWhere(g => g.hist && G().year-g.birth >= 58), '{人}老病，执笔久则手颤，所记边事尚详。随侍言其愿口授旧闻，医官请先解繁务。',
    ['延医给假', { gold: -40, loyalty: 10 }], ['令属吏笔受所述', { sci: 50, loyalty: -3 }]);
  situation('lastMemorial', '故臣遗表', '一年内有当朝史实人物身故', () => {
    const f = G().flags.lastOfficerDeath;
    return recent(f,4) && GAME.gen(f.gen)?.status === 'dead' && { gen: f.gen };
  }, '{人}身后，家人奉上未竟之表，并旧日案牍一箧。史馆请收其稿，故吏愿先为遗属市田。',
    ['赐田恤孤', { gold: -55, auth: 3 }], ['抄录遗表入史馆', { gold: -25, sci: 55 }]);
  situation('guestTraders', '番商寄帑', '本港已有海贸航线', cs => townWhere(cs, c => c.port && c.trade.length),
    '{城}番商借民仓寄货，雨侵香药，主客相讼。市舶吏请立官仓收直，亦可令客商自行具保。',
    ['设仓，官为掌钥', { gold: -45, happy: 7 }], ['准商保货，按契收钱', { gold: 55, happy: -3 }]);
  situation('finishedLearning', '新法颁行', '一季内刚完成一项研究', cs => recent(G().flags.lastStudy,1) && { ...ownTown(cs), tech: G().flags.lastStudy.id },
    '格物新得「{学}」，{城}工师请领官样传习。学宫却言成书未校，恐各地所传异同。',
    ['先出官样', { gold: -40, happy: 6 }], ['付书局校定', { food: -35, sci: 55 }]);
  situation('siteRumour', '道旁旧迹', '我朝已探明尚未踏访的奇遇', cs => {
    const site = G().sites.find(x => !x.used && !x.gens?.length && !Object.keys(x.cd || {}).length && G().explored[x.tile] && nearCity(P(),x.tile,7));
    const c = site && nearestOwnCity(P(),site.tile);
    return c && { city:c.id, site:site.name };
  }, '{城}驿卒报近郊有「{迹}」，行人说其来历各异。请使儒生采录，或令乡民护其地以候后访。',
    ['给资访求旧闻', { gold: -30, sci: 45 }], ['免其地役，令民看守', { gold: -20, happy: 4 }]);
  situation('wanderers', '流户叩关', '厌战过十五或有新占城', cs =>
    (fac(P()).warWeary > 15 || cs.some(c => c.recentCapture && G().T-c.recentCapture.t < 4)) && ownTown(cs),
    '流户扶老至{城}，愿占闲田。其间有能执弓者，亦有扶犁者，请分别安置。',
    ['给种还耕', { food: -55, happy: 7 }], ['募壮者为乡兵', { gold: -40, man: 13 }]);
  situation('bandits', '乡道失行', '本城民心低于五十或动乱过十五', cs => townWhere(cs,c => c.loyalty < 50 || c.unrest > 15),
    '{城}负贩者结伴方敢出门。乡老请设巡铺，县尉则欲招纳饥寒入伙之人，使相保归农。',
    ['雇巡丁守道', { gold: -40, auth: 2, wall: 8 }], ['发粟招归', { food: -50, happy: 7 }]);
  situation('landEngrossed', '大户并田', '本城户口至少八万', cs => townWhere(cs,c => c.pop >= 8),
    '{城}数村佃户递状，称旧田典尽，连祖墓亦在他人契下。检契须费时日，富室愿出粟助官以息讼。',
    ['给食留诉，逐契核验', { food: -45, happy: 7 }], ['收粟，责富室许佃', { food: 60, auth: -2 }]);
  situation('copperDrain', '海舶载钱', '有港口和集市', cs => townWhere(cs,c => c.port && c.buildings.market),
    '{城}铺户以铜钱难得告急，港中舶货却多以贯计价。若严验出港，则商税亦减。',
    ['严验出港钱贯', { gold: -40, happy: 6 }], ['许折货计税', { gold: 55, happy: -3 }]);
  situation('feverHamlets', '邻坊相染', '本城人口过八万且民心低于六十五', cs => townWhere(cs,c => c.pop > 8 && c.loyalty < 65),
    '{城}数坊相继报病，药铺前候者日众。县官请就坊给药，仓官请先给不能执业之家口粮。',
    ['买药延医入坊', { gold: -55, happy: 8 }], ['按籍给口粮', { food: -45, happy: 5 }]);
  situation('goodHarvest', '谷贱伤农', '秋季且国粮超过四百', cs => G().season === 2 && fac(P()).food > 400 && ownTown(cs),
    '{城}谷熟，场上新粟堆积，商贩所给不偿耕本。常平吏请籴入，度支却欲以余粮济军。',
    ['加价收籴', { gold: -65, food: 90, happy: 3 }], ['给军粮，减本季转饷', { food: -65, gold: 65 }]);
  situation('shortGarrison', '守籍多虚', '本城守军不足三营', cs => townWhere(cs,c => c.garrison.length < 3),
    '{城}更卒轮值，城楼多缺守者。有司请拨人实伍，或先缮城门，聚守卒于要处。',
    ['拨丁实伍', { man: -10, inf: 1 }], ['雇匠缮门', { gold: -40, wall: 15 }]);
  situation('wallCracks', '雨后城隙', '城防比上限少十五以上', cs => townWhere(cs,c => GAME.maxWall(c)-c.wall >= 15),
    '{城}守吏遍巡城脚，数处夯土松裂。差夫急补可省钱，给值雇工则春田少误。',
    ['募工给值', { gold: -50, wall: 20 }], ['按籍差夫', { happy: -4, wall: 16 }]);
  situation('idleScholars', '待阙之臣', '本朝有闲职且政略七十五以上的臣僚', () =>
    officerWhere(g => g.status === 'idle' && g.zheng >= 75), '{人}久候差遣，旅居费重。此人愿领校书之职，亦可给券还乡访察民事。',
    ['廪给校勘', { gold: -35, sci: 40, loyalty: 3 }], ['授券访察乡曲', { food: -30, zheng: 1 }]);
  situation('countySchool', '郡庠缺师', '本城建有书院', cs => townWhere(cs,c => c.buildings.academy),
    '{城}诸生所习经说不一，教谕请延宿儒会讲。州学粮廪有限，亦可令诸生分赴乡塾讲授。',
    ['具礼延师', { gold: -45, sci: 65 }], ['给粮散教乡里', { food: -40, happy: 6 }]);
  situation('springSeed', '春耕借种', '春季且本城人口至少三万', cs => G().season === 0 && townWhere(cs,c => c.pop >= 3),
    '{城}春田已解，贫户有牛无种。仓吏欲出陈粟贷之，里正愿代为市种而请暂宽课钱。',
    ['借仓粟作种', { food: -45, happy: 6 }], ['缓其征，听乡里自市', { gold: -30, happy: 4 }]);
  situation('winterClothes', '冬衣未至', '冬季有驻军', cs => G().season === 3 && townWhere(cs,c => c.garrison.length),
    '{城}守卒旧袍多敝，军监请先缮军衣。乡中织户愿输布，求以官粟易之。',
    ['以粮易布', { food: -45, happy: 5 }], ['出钱雇工，兼募缝补之人', { gold: -50, man: 10 }]);
  situation('riverFerry', '两岸争渡', '本城临河', cs => townWhere(cs,c => GEO.river[c.tile]),
    '{城}两岸争收渡钱，军使过河亦须久候。若设官渡须常给篙工，若付乡社则可省县费。',
    ['官给篙工，免过渡钱', { gold: -40, happy: 6 }], ['令乡社认渡纳课', { gold: 45, auth: -1 }]);
  situation('governorBooks', '知州呈簿', '本城有在任知州', cs => townWhere(cs,c => c.governor != null),
    '{城}知州核积年欠券，民户久亡而额尚存。可一并除籍，也可先追豪户替输之契。',
    ['尽销亡户旧额', { gold: -40, happy: 7 }], ['覆契追缴大户', { gold: 60, happy: -3 }]);
  situation('grainSurplus', '陈粟满廪', '国粮超过八百', cs => fac(P()).food > 800 && ownTown(cs),
    '{城}仓中经年之粟将陈，仓吏请趁晴日出粜。沿道役夫却愿折领旧粮，免给工钱。',
    ['平价粜民', { food: -70, gold: 40, happy: 3 }], ['给役夫折工值', { food: -55, gold: 55 }]);
  situation('frontierMart', '榷场换马', '有相识而未交战的陆邻', cs => {
    const f = Object.keys(fac(P()).met).find(f => f !== P() && alive(f) && !GAME.atWar(P(),f) && GAME.nearPlayer(f,6));
    return f && { ...ownTown(cs), from:f };
  }, '边市有部人驱马而至，请准以绢相易。市官欲先率其税，译者谓薄征可以长通音问。',
    ['从轻征算，遣译致问', { gold: -20, opinion: 9 }], ['照额收税', { gold: 45, opinion: -3 }]);
  situation('portPilots', '港汊易道', '本城为港口', cs => townWhere(cs,c => c.port),
    '{城}老梢工言沙汊已移，客舶依旧图易搁。置标须出官费，亦可许梢工受直引船。',
    ['立标画水道', { gold: -40, sci: 45 }], ['给引船之凭，收牙税', { gold: 35, happy: -2 }]);
  situation('summerCanal', '夏渠分水', '夏季且本城临河', cs => G().season === 1 && townWhere(cs,c => GEO.river[c.tile]),
    '{城}上乡筑堰，水不及下田。县官请重开旧渠，田主愿出粟自分灌期。',
    ['发工浚渠', { gold: -45, happy: 7 }], ['从其分期，收粟入仓', { food: 50, auth: -1 }]);

  function personal(id, name, title, text, ...choices) {
    declare({ id, group: 'person', title, text, choices, people: [name], weight: 6,
      condition: name + '为宋臣，在世且未被俘、未去职',
      context: () => {
        const g = genByName(name);
        return g?.hist && playerGeneral(g.id) && { gen: g.id };
      } });
  }
  personal('yueRoll', '岳飞', '岳家军点名', '岳飞呈军籍，老卒之子多请隶旧营。有人善骑，有人愿奉母归耕，将军不忍一概点发。',
    ['许将军亲试而录', { gold: -40, tong: 1, man: 6 }], ['释独子归养，给其家粟', { food: -45, loyalty: 8 }]);
  personal('yueCounsel', '岳飞', '帐下议粮', '岳飞奏兵行赖粮，请使将佐各习转输。度支以为将佐分心，欲专付熟吏。',
    ['使将佐习计', { food: -35, zheng: 2 }], ['给吏佐以专军务', { gold: -45, tong: 1, loyalty: 3 }]);
  personal('hanDrum', '韩世忠', '梁夫人桴鼓', '韩世忠追述黄天荡旧战，梁夫人执桴击鼓，江上诸舟闻声相应。今有司请录其事，水军则欲取其节奏教新卒。',
    ['命世忠亲授鼓节', { gold: -35, tong: 2 }], ['录梁夫人事付史馆', { sci: 35, loyalty: 6 }]);
  personal('hanRetire', '韩世忠', '韩将军请闲', '韩世忠以久历行阵，请少息肩。其部曲尚愿从之，朝廷若留，当明所以留之之礼。',
    ['厚礼留任，令训后进', { gold: -65, loyalty: 9 }], ['许其归休，以成其志', { retire: 1, auth: 4 }]);
  personal('liuDrill', '刘锜', '顺昌旧伍', '刘锜请取顺昌守御旧法，教新兵轮番更戍。师旅方集，若力专城守，则野外驰驱之业须缓。',
    ['练步阵以固垒', { food: -45, tong: 2 }], ['命其编守御条目', { gold: -30, zhi: 1, sci: 25 }]);
  personal('wuLegacy', '吴璘', '仙人关旧牍', '吴璘检得亡兄吴玠守蜀旧牍，内列关隘、雨雪与运粮所费。其墨迹将泐，请择熟地形者补图。',
    ['使吴璘躬自校绘', { gold: -40, zhi: 2 }], ['存原牍入阁，旌其兄功', { sci: 30, loyalty: 6 }]);
  personal('wuFields', '吴璘', '军田借水', '吴璘言山口运粮甚艰，若使军民共修沟堰，则戍卒可就近得食。然修渠之日，操练必减。',
    ['令其督修军田', { gold: -50, food: 60, zheng: 1 }], ['仍专守御，发粟犒军', { food: -45, tong: 1, loyalty: 4 }]);
  personal('yuBoats', '虞允文', '江面舟籍', '虞允文请访舟人，逐一核其船之吃水、转舵所须。江防与商渡常争舟，簿成当先付何司？',
    ['付军府，令允文校阅', { gold: -40, tong: 2 }], ['付转运司，先济民渡', { food: -30, zheng: 1, loyalty: 4 }]);
  personal('xinEssay', '辛弃疾', '论恢复形势', '辛弃疾陈南北形势，请择识边者同议。议者欲刊其说以广见闻，枢府恐军情泄露，欲留中细读。',
    ['令其入对论兵', { gold: -35, zhi: 2 }], ['摘其民事付州县', { sci: 40, loyalty: 3 }]);
  personal('xinRiders', '辛弃疾', '骑卒选练', '辛弃疾言诸营马步异宜，募得乡勇宜分材而使。州县忧抽去壮丁，请先薄募。',
    ['委其自择将校', { gold: -50, tong: 1, loyalty: 4 }], ['少募而精试其艺', { food: -40, wu: 2 }]);
  personal('luMaps', '陆游', '山川行记', '陆游请访驿程山川，以补图经所缺。若亲历其地可识民情，若留馆校前人舆记则成书较速。',
    ['给传往来，察乡俗', { gold: -40, zheng: 2 }], ['令居馆勘旧本', { food: -30, sci: 35, loyalty: 3 }]);
  personal('zhuGranary', '朱熹', '社仓息米', '朱熹论乡社储粟，言青黄不接之时尤宜出贷。州县愿领其事，乡老却忧吏胥因而扰民。',
    ['付乡老，令熹按籍', { food: -60, zheng: 2, loyalty: 3 }], ['先令州学讲明其法', { gold: -30, sci: 45, zhi: 1 }]);
  personal('chenEssay', '陈亮', '论事取士', '陈亮进论，谓士当知当世之务。学官欲令其设问于郡学，近臣欲留之阙下，备问边情。',
    ['试以边事，留备顾问', { gold: -40, zhi: 2 }], ['令讲论于郡学', { food: -35, sci: 45, loyalty: 3 }]);
  personal('mengCamps', '孟珙', '营屯安户', '孟珙言归附之众有父母妻子，若只籍壮丁，老弱将无所归。军司请筑屯安家，转运司请先给归粮。',
    ['令其分屯授田', { gold: -55, zheng: 2, man: 5 }], ['先给归粮，缓行编籍', { food: -50, loyalty: 8 }]);
  personal('mengDefence', '孟珙', '江汉守图', '孟珙展图，请沿江诸屯互报水涨水落。军吏熟于烽候，舟人熟于滩碛，两者皆可为师。',
    ['委珙总阅烽候', { gold: -40, tong: 2 }], ['给舟师食，访诸水程', { food: -45, zhi: 1, sci: 25 }]);
  personal('yuJieHills', '余玠', '山城择址', '余玠延父老论山城，首问泉脉、耕地，可容几家，再问险易。军中催请速筑，匠者欲先遍视诸山。',
    ['许遍访山民', { gold: -40, zhi: 2 }], ['先筑小垒以验其法', { food: -45, tong: 1, loyalty: 4 }]);
  personal('wenSeal', '文天祥', '义士呈籍', '文天祥携乡士名籍入奏，所陈有文才者，亦有愿守土者。留之幕下与分任乡事，各有其用。',
    ['令其择士佐幕', { gold: -45, tong: 1, man: 5 }], ['分往郡县，约束乡役', { food: -35, zheng: 1, loyalty: 4 }]);
  personal('luxiuBooks', '陆秀夫', '行朝图籍', '陆秀夫请将州县版籍另缮副本，免一处有警而文书俱失。吏手不足，礼典与户籍须择一先录。',
    ['先备户籍以便治民', { gold: -45, zheng: 2 }], ['先录礼典以存朝仪', { gold: -35, auth: 2, loyalty: 5 }]);
  personal('zhangFleet', '张世杰', '舟中习令', '张世杰言海上相去虽近，风声常夺人语，应使诸舟各识旗号。旧将请先选善舟之卒为教头。',
    ['委其亲校舟师', { food: -45, tong: 2 }], ['给赏择教头', { gold: -45, man: 8, loyalty: 4 }]);
  personal('fanEnvoy', '范成大', '使行所见', '范成大愿将沿途耳目所及写为一编。馆阁要录风土，道路司则需簿记关津里数。',
    ['命详记关津', { gold: -35, zhi: 2 }], ['许采风土成书', { sci: 40, loyalty: 4 }]);
  personal('yangPlain', '杨万里', '州县直言', '杨万里疏言吏牍辗转，细民一诉经岁不决。若容直陈，可省淹滞，亦须增人覆核。',
    ['许径陈而命其覆案', { gold: -45, zheng: 2 }], ['先录积案以备朝议', { sci: 35, loyalty: 4 }]);

  // 地方杂奏分题设冷却。即使远交断绝、名臣凋零，小国仍有不依赖特定人物的地方事务。
  function local(id, family, title, text, ...choices) {
    const guest = family === '宾客';
    const context = cs => {
      if (!guest) return ownTown(cs);
      const from = GAME.pick(Object.keys(fac(P()).met).filter(f => f !== P() && f !== 'rebel' && alive(f) && !GAME.atWar(P(),f)));
      return from && { ...ownTown(cs), from };
    };
    declare({ id, family, group: 'local', title, text, choices, context,
      condition: (guest ? '有通问的和平外邦' : '我朝尚有州城') + '，' + family + '类未在冷却' });
  }
  local('frostSilk','农事','晚霜伤桑','{城}蚕户将收新叶，一夜有霜。邻乡尚有桑园，肯出叶者求兑官粮，肯出钱者求缓春税。',
    ['出粟易叶', { food: -45, happy: 6 }], ['听其缓输春税', { gold: -30, happy: 4 }]);
  local('hailTiles','灾异','雹穿民瓦','{城}城外雹下如豆，茅屋多漏。窑户请领工钱烧瓦，乡社欲先借仓中盖席度雨。',
    ['给匠钱烧瓦', { gold: -45, happy: 7 }], ['发仓席，役卒助补', { man: -5, happy: 5 }]);
  local('fallenOak','灾异','社木夜折','{城}社前老木夜半折断，乡人惊而罢市。县尉欲支木于桥，父老请留材修社屋。',
    ['以材修桥，免征桥料', { gold: 30, happy: -2 }], ['听民修社，给工食', { food: -30, happy: 5 }]);
  local('doubleEar','灾异','一茎两穗','{城}农人以一茎两穗之禾进献，吏欲绘图称瑞，老农只愿留种再试。',
    ['命画工记之，旌其乡', { gold: -30, auth: 2 }], ['还禾试种，给牛耕之费', { gold: -35, sci: 40 }]);
  local('strangeStone','风俗','泉旁有石','{城}樵者掘得纹石，远望似字，观者塞路。县官请收藏，石工愿买来为乡桥作础。',
    ['拓其纹送学官辨视', { gold: -25, sci: 40 }], ['付石工为桥础', { happy: 4, auth: -1 }]);
  local('nightLight','灾异','泽畔夜光','{城}夜行者见水泽间时有微光，传为神灯。驿卒不肯独行，请置候火，或遣学官往察。',
    ['设更火安行人', { gold: -35, happy: 5 }], ['遣人实录见闻', { food: -25, sci: 35 }]);
  local('bellCasting','工役','破钟改铸','{城}报时旧钟有罅，声传不过巷口。匠人请重铸，巡铺愿改用木柝，省铜留作公用。',
    ['给工重铸', { gold: -40, happy: 6 }], ['改柝留铜', { gold: 35, happy: -2 }]);
  local('templeLodging','释道','寺舍留客','{城}寺旁有空寮，行旅多投宿。僧人求给米作粥，驿吏请赁作传舍以减官费。',
    ['给米留行旅', { food: -40, happy: 6 }], ['赁作传舍，移省驿费', { gold: 40, happy: -2 }]);
  local('pilgrimRoad','释道','香客阻道','{城}乡人春秋往来进香，集日车马难通。守臣欲辟旁径，市户愿分日赴集以免出工。',
    ['雇工开旁径', { gold: -35, happy: 6 }], ['令分日开市，收地钱', { gold: 35, happy: -2 }]);
  local('sutraCopy','释道','残经待补','{城}僧人收得残经两本，各有阙文。请给纸墨互校，纸坊却愿买其空页重抄常课。',
    ['给纸墨校经', { gold: -30, sci: 45 }], ['施空页于乡塾', { sci: 20, happy: 3 }]);
  local('daoCalendar','释道','观中旧仪','{城}道观藏有候晷旧器，铜表尚完。道士欲再立以测日影，匠户请取其式教徒。',
    ['给资立表记影', { gold: -40, sci: 55 }], ['许匠人摹式传习', { sci: 25, happy: 2 }]);
  local('villageRites','风俗','两社争祭','{城}两社共祀一祠，各以先后争献，耽误农事。父老议轮年主祭，县令欲亲往平之。',
    ['听两社轮祭，给祭粟', { food: -25, happy: 5 }], ['遣官核旧籍定序', { gold: -30, auth: 2 }]);
  local('lostGenealogy','风俗','合谱寻亲','{城}流寓数家同姓，兵后谱牒散失，欲合抄族谱。县吏虑其冒同宗取产，求验旧券。',
    ['给纸笔访故老', { gold: -25, happy: 5 }], ['据券编录入案', { sci: 35, happy: -2 }]);
  local('burialGround','风俗','义冢无主','{城}城外旧冢岁久无识，拓道将及其地。乡老愿迁葬而乏资，工匠亦可绕道。',
    ['赐钱迁葬，录姓名', { gold: -40, auth: 2 }], ['给役夫粮，另辟新道', { food: -40, happy: 6 }]);
  local('operaFair','风俗','村场演史','{城}村场演旧朝故事，远近来观。学官嫌其失实，愿正其词；市吏只求定场日、清道路。',
    ['访掌故，校其曲辞', { gold: -25, sci: 40 }], ['许开场日，收摊课', { gold: 35, auth: -1 }]);
  local('wellDrawing','工役','巷井失绠','{城}巷井滑轮已坏，妇孺汲水甚难。作坊可制铜辖，邻里亦肯出木轮自修。',
    ['官出铜辖，雇匠修井', { gold: -30, happy: 6 }], ['命里社出木，给役粮', { food: -25, happy: 4 }]);
  local('oldBridge','工役','古桥题名','{城}老桥石栏崩落，商家愿助修而请刻名。石工请留旧题，工钱由官出。',
    ['留旧题，官给工钱', { gold: -40, happy: 5 }], ['许商人刻名助修', { gold: 30, auth: -1 }]);
  local('milestones','工役','驿路里堠','{城}递夫谓前后两堠所记里数不合。重丈可明程限，另给脚钱亦可免递夫赔程。',
    ['命吏重丈，绘为程图', { gold: -30, sci: 45 }], ['先给递夫脚钱', { gold: -20, happy: 4 }]);
  local('postMules','工役','驿畜疲惫','{城}驿畜负重趾伤，公牍堆于递铺。可出缗赁民畜代行，或给徒步递夫口粮。',
    ['赁畜轮行', { gold: -40, auth: 2 }], ['给步递工食', { food: -40, happy: 5 }]);
  local('kilnSmoke','工役','窑烟入里','{城}砖窑近舍，风起则烟满街。窑户愿移地而乏本，守臣欲留窑供修城之砖。',
    ['给迁窑之费', { gold: -40, happy: 6 }], ['留窑取砖缮城', { wall: 15, happy: -3 }]);
  local('stonesMeasure','市易','市石有轻重','{城}米市大小二斛并用，斗户各持旧例。官可置样斛受众验，亦可免牙钱，令行户自校。',
    ['铸官样，定争讼', { gold: -30, auth: 2 }], ['免牙钱，使行户共校', { gold: -20, happy: 5 }]);
  local('badDye','市易','染帛褪色','{城}染户售帛，遇雨色落，客商执券索偿。行老愿代保，条件是给一季公染之役。',
    ['付行老公染，责其偿客', { gold: 35, auth: -1 }], ['官为试染，记其法', { gold: -35, sci: 45 }]);
  local('fishLease','市易','鱼陂之租','{城}废陂畜水成鱼，贫户久来以网取食。富家请承其租，言岁可输钱。',
    ['许纳租，限网取之时', { gold: 50, happy: -3 }], ['留供贫户，责其葺岸', { food: 30, happy: 3 }]);
  local('silkContract','市易','机户争样','{城}机户称客商订纹后久不取货，所积丝帛已满架。可代购作赏，或令行老持契平价转售。',
    ['出钱买帛备赏', { gold: -40, auth: 2 }], ['听行老转售，量收市课', { gold: 30, happy: -1 }]);
  local('lampOil','市易','灯油夜市','{城}夜市延至三更，灯油价昂。铺户求官给油以守更，城门吏请早闭以节巡卒。',
    ['给钱助巡更', { gold: -35, happy: 5 }], ['早闭市，调余卒守门', { wall: 12, happy: -2 }]);
  local('bookBlocks','学术','书板半蠹','{城}书肆旧板为蠹所蚀，一卷将不可辨。坊主愿售好板，塾师愿合诸家藏本重校。',
    ['购板重刻', { gold: -45, sci: 60 }], ['给塾师食，令互校', { food: -30, sci: 35 }]);
  local('starNotes','学术','漏刻迟速','{城}谯楼更筹每较日影略迟。善历者请校漏壶，守卒请以更鼓为准，省换壶之费。',
    ['给铜校漏', { gold: -35, sci: 50 }], ['给食教更卒候影', { food: -25, happy: 4 }]);
  local('medicineNames','学术','药名互异','{城}两家药肆一物异名，远客求药辄误。医者请画图示形，药商则愿出赀立市例。',
    ['雇工绘药图', { gold: -40, sci: 55 }], ['许立市例，责商共验', { gold: 30, auth: -1 }]);
  local('inkRecipe','学术','墨工献样','{城}墨工进新墨两丸，一利写经，一耐湿藏。史馆与学舍各请其一，惟造墨之松烟有限。',
    ['给资制耐藏墨', { gold: -35, sci: 50 }], ['给乡学试写，宽工课', { gold: -20, happy: 4 }]);
  local('stoneRubbing','学术','雨蚀古碑','{城}荒院碑阴尚有前代郡名，雨蚀日深。学正求拓本，乡老愿移碑入亭，使道路有识。',
    ['拓本入图经', { gold: -30, sci: 45 }], ['给工食建亭护碑', { food: -35, happy: 5 }]);
  local('disputedScript','学术','两本异文','{城}郡学有同经二本，字句互异。教官请会讲质疑，士子亦可分赴邻州借本相校。',
    ['具礼会讲', { gold: -40, sci: 55 }], ['给粮遣生访书', { food: -30, sci: 35 }]);
  local('orphanCraft','乡政','孤幼学艺','{城}工匠愿收孤幼为徒，请官保其衣食。乡社则愿轮养，俟其稍长自择所业。',
    ['给匠家廪食，立师徒契', { food: -40, sci: 35 }], ['出钱助乡社轮养', { gold: -35, happy: 6 }]);
  local('widowsDebt','乡政','寡户欠券','{城}寡户以旧屋质钱，今卷末有改墨，债家不肯减息。官可代为清偿，亦可延书手验契。',
    ['发缗赎屋', { gold: -45, happy: 7 }], ['验契定例以断后诉', { gold: -25, auth: 2 }]);
  local('nightWatch','乡政','坊更请代','{城}诸坊轮更，力弱之家往往雇人，久成争端。可定钱雇壮者，也可给粮使邻保互代。',
    ['雇壮者专更', { gold: -35, wall: 14 }], ['给粟许邻保互代', { food: -30, happy: 5 }]);
  local('lostChildren','乡政','庙集寻亲','{城}庙集散后数家幼子失其所亲。县门可设棚给食，亦可雇熟路之人循乡求访。',
    ['设棚给食候亲', { food: -30, happy: 5 }], ['雇乡导遍访各保', { gold: -30, auth: 2 }]);
  local('commons','乡政','公山采薪','{城}旧例听贫民入山樵采，近来大户请包纳山租，禁旁人持斧。县吏持两议请裁。',
    ['留公山，定日樵采', { happy: 6, gold: -20 }], ['收山租，留小径给贫户', { gold: 45, happy: -2 }]);
  local('oldAccounts','乡政','火后寻簿','{城}吏舍失火，旧簿残缺。士绅家藏抄契可资参照，亦可令里户自陈，再行覆实。',
    ['雇书手合校诸契', { gold: -35, sci: 40 }], ['许里户自陈，缓其输额', { gold: -25, happy: 5 }]);
  local('seedTools','农事','耕具共用','{城}数村共一铁犁，误时常起争端。铁匠请赀添作，村社请给粟雇牛易日轮耕。',
    ['出缗添犁', { gold: -40, food: 60 }], ['给粮轮借耕牛', { food: -30, happy: 6 }]);
  local('beeHives','农事','蜂群入圃','{城}蜂群迁于公圃，圃吏欲卖蜜纳钱，药肆求留蜜和丸。守臣言两用难兼。',
    ['课蜜入市', { gold: 35, happy: -1 }], ['给药肆配丸施贫', { gold: -20, happy: 5 }]);
  local('reedBeds','农事','荒洼生苇','{城}官洼尽生芦苇，里人求割以覆屋，军匠请留作修城之束。正当收割，须定分给。',
    ['给军匠修垒', { wall: 14, happy: -2 }], ['许民割用，输少粟入仓', { food: 28, happy: 3 }]);
  local('oldMulberry','农事','老桑让路','{城}拟通田间小径，须伐老桑数十株。蚕户愿改道而助出工，车户愿输费求直路。',
    ['改道存桑，给工食', { food: -30, happy: 6 }], ['从车户议，收助修钱', { gold: 40, happy: -2 }]);
  local('rainGauge','灾异','雨泽失记','{城}所报雨泽与邻县相左，田家恐误征期。吏请别置承雨之器，里老愿以禾苗高下作验。',
    ['置器验雨，留日录', { gold: -30, sci: 45 }], ['遣人按苗，听缓输租', { gold: -25, happy: 5 }]);
  local('whiteBird','灾异','白羽来庭','{城}有人捕得白羽之鸟，请献为瑞。禽人言此物久羁恐死，画师愿图其形，旋即放归。',
    ['图其形，纵归林野', { gold: -25, sci: 35 }], ['赐捕者粟，诏勿复扰', { food: -25, happy: 5 }]);
  local('iceStore','工役','藏冰旧窖','{城}旧窖墙基尚固，医家求修以藏暑月用冰，粮吏愿改为蔬窖，备军厨之需。',
    ['修窖济病家', { gold: -35, happy: 6 }], ['改藏蔬，省厨费', { gold: -25, food: 50 }]);
  local('weightsSchool','学术','算题入塾','{城}塾师以仓粮出入为算题，童子易晓。仓吏愿取能算者为书手，父兄恐妨经业。',
    ['赐纸笔编为算书', { gold: -35, sci: 50 }], ['请仓吏课余授算', { food: -25, happy: 4 }]);
  local('paperDuty','市易','纸槽歇作','{城}纸户称槽池待修，无力供官牍。可先以缗钱定买来岁之纸，亦可拨学舍余纸以济急。',
    ['预给纸价，使得修槽', { gold: -40, sci: 45 }], ['暂借学纸，省官用钱', { gold: 35, sci: -15 }]);
  local('quiltFund','乡政','百衲寒衣','{城}女工缀余布成衣，求以数领抵户役。县官可收为义衣，军寨亦求购以给守夜者。',
    ['折役给贫寒户', { gold: -25, happy: 6 }], ['出钱买衣，补巡卒之缺', { gold: -35, man: 9 }]);
  local('almanacMarket','学术','历日误刊','{城}坊本历日有一叶倒刻，分送已远。书坊请官出牒追改，亦可使乡学逐村讲正。',
    ['出牒收版重校', { gold: -30, auth: 2 }], ['给食令诸生行乡', { food: -30, sci: 35 }]);
  local('foreignEnvoys','宾客','译使问俗','远客随商旅入朝，携本国问候之书。馆伴欲厚其归赆，学官愿留译人问方言、历日之异。',
    ['备礼遣归', { gold: -35, opinion: 10 }], ['延译人校方言', { food: -35, sci: 45 }]);
  local('foreignMeasures','宾客','客商持尺','外商随使者持本国尺来，请与官尺校准，以便买卖布帛。译吏亦请录两地权衡之别。',
    ['校尺给契，宽其市税', { gold: -25, opinion: 8 }], ['馆译吏录其权衡', { food: -30, sci: 40 }]);
  local('foreignGifts','宾客','使橐留香','远使以香料为礼，礼官欲回赠土绢，使者却请换取沿途口粮，分赐从人。',
    ['依礼回赠土绢', { gold: -40, opinion: 12 }], ['加给从人归粮', { food: -30, opinion: 8 }]);
  local('quarrelFlock','农事','羊群践苗','{城}牧户与田户争堤边草场，夜间羊入新苗。可留草场而定赔额，亦可遣人开荒作牧地。',
    ['雇人开荒分牧', { gold: -35, happy: 6 }], ['定赔额，征牧户草课', { food: 35, happy: -1 }]);
  local('bambooRafts','工役','桥匠论竹','{城}木桥板朽，竹匠愿结排代渡以待修。桥户亦愿即伐材重造，工费当倍。',
    ['雇桥户重造', { gold: -45, happy: 7 }], ['暂用竹排，发粟养渡者', { food: -25, happy: 4 }]);
  local('mutePetition','乡政','画地陈情','{城}有民不能言，以炭绘屋界于县门。吏莫解其意，邻人愿具证，学官则请亲往量地。',
    ['给费按图丈地', { gold: -30, auth: 2 }], ['集证人听断，给往来食', { food: -25, happy: 5 }]);
  local('templeOrchard','释道','寺田果熟','{城}寺田果熟，僧众请分给病户，市人愿出钱尽买，修寺外遮雨之棚。',
    ['令僧分果，官助舆费', { gold: -20, happy: 5 }], ['许市果修棚，留供行旅', { gold: 25, happy: 2 }]);
  local('betrothalLaw','风俗','婚书失印','{城}数户旧婚书年月不明，里正疑其印非真。州学藏有旧印式，邻老尚能辨当年执笔者。',
    ['校印式，存本于官', { gold: -25, sci: 35 }], ['延邻老作证，免其券费', { gold: -20, happy: 5 }]);

  function presentable(p) {
    if (p.ev === 'battleWound') return playerGeneral(p.gen)?.wound > 0;
    if (p.ev === 'plague') return !!owned(p.city, P());
    if (p.ev === 'frontierSpoils') return !!GAME.campSpoils(p.point);
    if (p.ev === 'cityPromotion') return owned(p.city, P())?.tier === p.tier;
    if (p.ev === 'hdjd') return !!ownedName('汴京', P());
    if (p.ev === 'offeredTreasure') return !G().itemsTaken[p.item] && !GAME.itemEquipReason(playerGeneral(p.gen), p.item);
    if (p.ev === 'peaceoffer' || p.ev === 'longxingPeace') return alive(p.from) && GAME.atWar(P(), p.from);
    if (p.ev === 'leagueMuster') return G().flags.league?.stage === 'ally' && G().flags.league.leader === p.leader;
    if (p.ev === 'vassalAnnex') return GAME.canAnnexVassal(p.from);
    if (p.ev === 'marriageRequest') return alive(p.from) && G().court?.clan?.brides > 0;
    if (p.ev === 'marriageHeir') return GAME.canAcceptMarriageHeir(p.from);
    if (p.ev === 'court_overmighty') return !!COURT.powerBase(p.gen);
    const row = DEFS[p.ev];
    return !row?.person || (GAME.gen(p.gen)?.name === row.person && !!playerGeneral(p.gen));
  }

  function view(p, touch = false) {
    const d = DEFS[p.ev];
    const val = (x) => typeof x === 'function' ? x(p) : x;
    if (d.type === 'pick') return { title: val(d.title), text: val(d.text), type: 'pick', options: p.options, max: p.max };
    let text = val(d.text);
    if (touch && p.ev === 'info' && (p.marchGuide || p.title === '御前须知')) {
      text = text.replace(/点选军队，右键目标即可行军或进攻[。；]/, '点选军队，轻点目标格看路线，再点一次即出发；目标为敌则进攻。');
    }
    return { title: val(d.title), text, gen: p.gen,
      choices: val(d.choices).map(c => ({ t: val(c.t), d: (val(c.d) || '').trimEnd().replace(/。$/, ''), disabled: !!val(c.disabled) })) };
  }
  function resolve(p, choice) {
    const d = DEFS[p.ev];
    if (!presentable(p)) return;
    const option = d.type === 'pick' ? null : (typeof d.choices === 'function' ? d.choices(p) : d.choices)[choice];
    if (d.type !== 'pick' && (!option || (typeof option.disabled === 'function' ? option.disabled(p) : option.disabled))) return;
    if (isDecision(p.ev)) {
      const state = scheduleState();
      state.count++;
      state.last[p.ev] = G().T;
      state.lastDay[p.ev] = elapsedDays();
    }
    if (d.type === 'pick') resolveCandidates(p, choice || []);
    else option.fn(p);
    GAME.emit('change');
  }
  // 自动处理（无人值守/AI）
  return { presentable, initSchedule, isDecision, offer, offerFormerOfficial, registry, turn, onBattle, annals, generalBio, initAchievements, achievements, customSlots, finalScore, settlementScore, settlementChronicle, view, resolve, peaceTerms, DEFS, spawnArmy };
})();
if (typeof module !== 'undefined') module.exports = EVENTS;
