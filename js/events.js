// 事件：开局抉择、科举、史实大事、随机事件
var EVENTS = (function () {
  const G = () => GAME.S;
  const fac = id => GAME.fac(id);
  const byName = n => G().cities.find(c => c.name === n);
  const genByName = n => G().generals.find(g => g.name === n);
  const alive = f => fac(f) && fac(f).alive;
  const P = () => G().player;
  const r = Math.random;

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
    if (g && !['idle', 'future'].includes(g.status)) g = null;
    if (g) { g.f = f; g.status = 'idle'; }
    else g = GAME.randomGeneral(f, 'mil', 62);
    const a = GAME.createArmyRaw(f, t, units.map(u => GAME.mkUnit(u)), g.id, name || '');
    a.morale = 90;
    return a;
  }
  const rep = (arr, n) => { const o = []; for (let i = 0; i < n; i++) o.push(arr[i % arr.length]); return o; };
  function renameFaction(f, name, seal) { const F = fac(f); F.name = name; if (seal) F.seal = seal; }
  function worldLog(text, fs) {
    if (!fs || fs.some(f => fac(P()).met[f])) GAME.log(text, 'world');
  }

  const owned = (id, f) => { const c = GAME.city(id); return alive(f) && c && c.f === f ? c : null; };
  const ownedName = (name, f) => { const c = byName(name); return c ? owned(c.id, f) : null; };
  const capital = f => alive(f) ? owned(fac(f).capital, f) : null;
  const changeLoyalty = (c, n) => { c.loyalty = GAME.clamp(c.loyalty + n, 0, 100); };
  const active = g => ['idle', 'army', 'gov', 'court'].includes(g.status);
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
    endingDefeat: {
      title: '社稷倾覆',
      text: '末府失守，符节不复得通，奔走之臣各收诰敕、图籍以避乱。仓卒之际，百姓携老幼离城，朝廷已无一州可诏。史臣于灯下检诸军旧牍，见经略并非一日尽失，往往先耗于调度，继失于人心。遂书此章，以存守土之士与流离之民，俟异日读者知一国之亡所由。',
    },
  };
  const endingEvent = (id, keepPlaying = '继续经营') => ({
    ...ENDINGS[id],
    choices: [{ t: keepPlaying, fn: () => {} }, { t: '就此封笔', fn: () => {} }],
  });

  const DEFS = {
    jinpai: {
      title: '十二道金牌',
      text: () => '郾城一战，金兀术拐子马、铁浮屠尽为岳家军所破，中原父老箪食壶浆以迎王师。然朝中秦桧力主和议，一日之内，十二道金字牌自临安飞驰而至，催岳飞班师。\n\n岳飞北望中原，泣曰：“十年之力，废于一旦！”\n\n陛下，此诏发与不发，在此一念。',
      choices: [
        { t: '奉诏班师，与金议和', d: '岁币 25 贯/季，和约二十年；岳家军南撤。', fn: () => {
          GAME.makePeace('song', 'jin', { from: 'song', to: 'jin', amt: 25, turns: 80 });
          GAME.getRel('song', 'jin').truce = 40;
          for (const a of G().armies.filter(a => a.f === 'song')) {
            const o = GAME.tileOwner(a.tile);
            if (o !== 'song') { const c = nearestOwnCity('song', a.tile); const t = freeTileNear(c.tile, 3); if (t >= 0) { a.tile = t; a.path = []; } }
          }
          G().flags.qin = 'power'; G().flags.morale = -3;
          G().pending.push({ ev: 'info', title: '御前须知', text: '和议既成，宋金暂息兵戈。陛下可趁此休养生息：兴修圩田、广设书院、开辟海路，待国力充盈，再图北伐。\n\n· 点选城池，在“内政”中营建、“军务”中征兵与组建军团。\n· 临海之城建市舶司，可与南洋、天竺、大食通商。\n· 和约期内宣战将失信于诸国。\n\n十年生聚，十年教训，河山终当归我。' });
          GAME.log('诏岳飞班师。绍兴和议成，宋金以淮水—大散关为界。', 'big');
        } },
        { t: '抗旨不遵，直捣黄龙', d: '战事继续，岳家军士气大振；朝中主和派必有反扑。', fn: () => {
          for (const a of G().armies.filter(a => a.f === 'song')) a.morale = 100;
          G().flags.qin = 'angry'; G().flags.qinTurn = G().T + 2; G().flags.morale = 3;
          G().pending.push({ ev: 'info', title: '御前须知', text: '岳家军已逼近汴京，然金兀术主力犹在，诸路金军虎视眈眈。\n\n· 点选军队，右键目标即可行军或进攻；攻城宜先以重兵扫清城外敌军。\n· 点选城池，在“内政”中营建、“军务”中征兵与组建军团。\n· 顶栏“研究”可定科技方向；“将领”中可委任知州。\n· 每三年春开科取士，史上名臣将陆续登场。\n\n愿陛下早日还我河山！' });
          GAME.log('岳飞拒奉金牌，上表曰：“臣愿提兵北上，迎还二圣，收复故疆。”陛下准之。', 'big');
        } },
      ],
    },
    qinhui: {
      title: '秦桧构陷',
      text: () => '宰相秦桧连上奏章，指岳飞拥兵自重、抗旨不遵，请以“莫须有”之罪下狱。主和派群臣附议，朝堂汹汹。\n\n韩世忠当廷质问：“‘莫须有’三字，何以服天下？”',
      choices: [
        { t: '罢黜秦桧，一意北伐', d: '秦桧去位，主战派当政；民心大振，金国震怒。', fn: () => {
          const q = genByName('秦桧'); if (q && q.status !== 'dead') { GAME.unassign(q.id); q.status = 'gone'; }
          G().flags.qin = 'gone'; G().flags.morale = 6;
          GAME.getRel('song', 'jin').op -= 20;
          GAME.log('诏罢秦桧相位，贬居永州。朝野称快，“还我河山”之声遍于江淮。', 'big');
        } },
        { t: '留用秦桧，以安朝局', d: '秦桧善于理财，每年额外入钱；但民心略降。', fn: () => {
          G().flags.qin = 'kept'; G().flags.morale = 0;
          GAME.log('陛下两存之。秦桧仍居相位，岳飞仍掌兵权，朝堂暗流涌动。', 'info');
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
      text: p => `敌将${p.name}已押至军前，诸将请定去留。其人或可为我用，然心志未明，须审其言。`,
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
      text: p => `${p.name}力战突围，身负重创。医者言须静养，今统 −${p.tong}、武 −${p.wu}，三季后可复。`,
      choices: [
        { t: '遣良医调治', d: '钱 −45，伤期缩短一季', fn: p => {
          const wound = G().flags.battleEvents?.wounds[p.gen];
          if (!wound || !playerGeneral(p.gen) || fac(P()).gold < 45) return;
          fac(P()).gold -= 45;
          wound.until = Math.max(G().T, wound.until - 1);
          recoverBattleWounds();
        } },
        { t: '令随军养伤', d: '按原期休养', fn: () => {} },
      ],
    },
    battleDeath: {
      title: '大将死事',
      text: p => `${p.name}殿后拒敌，终不复还。军报已至，众请收敛遗骸，记其军功于册。`,
      choices: [{ t: '收葬立籍', d: '军中循例抚恤', fn: () => {} }],
    },
    battleUnderdog: {
      title: '以少制众',
      text: p => `${p.name}所部未及敌军之半，奋战而胜。诸州争传捷书，请录其功以劝部伍。`,
      choices: [{ t: '有司叙功', d: '主将经验 +70，邻近我城民心 +4，权威 +2', fn: p => {
        const g = playerGeneral(p.gen), c = owned(p.city, P());
        if (g) GAME.gainExp(g.id, 70);
        if (c) changeLoyalty(c, 4);
        courtAuthority(2);
      } }],
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
      } }],
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
          const ol = GAME.city(fac(P()).capital), nw = byName('汴京');
          if (ol) ol.cap = false; nw.cap = true; fac(P()).capital = nw.id; G().flags.morale = (G().flags.morale || 0) + 4;
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
        { t: '许和', d: p => p.longxing ? '宋金休兵六年；宋付金 20 贯/季' : '停战，五年内不得再起兵戈', fn: p => {
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
        { t: '遣太医局施药', d: '钱 -50，人口 -1', fn: p => { fac(P()).gold -= 50; const c = GAME.city(p.city); c.pop = Math.max(1, c.pop - 1); } },
        { t: '听天由命', d: '人口 -3', fn: p => { const c = GAME.city(p.city); c.pop = Math.max(1, c.pop - 3); c.loyalty -= 5; } },
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
      text: () => '金主完颜亮弑君自立，迁都燕京，扬言“提兵百万西湖上，立马吴山第一峰”，尽起诸道兵马南下，号称六十万！',
      choices: [{ t: '命诸将严阵以待', d: '', fn: () => {} }],
    },
    temujin: {
      title: '铁木真称汗',
      text: () => '漠北传来消息：乞颜部铁木真统一蒙古诸部，于斡难河源大会，被尊为“成吉思汗”。草原之上，一股前所未有的力量正在崛起。',
      choices: [{ t: '知道了', d: '', fn: () => {} }],
    },
    temujinSong: {
      title: '铁木真来归',
      text: () => '斡难河已入我版图。乞颜部少年铁木真率部众来归，愿为大宋守边。此人雄才大略，非池中之物。',
      choices: [
        { t: '授以节度使，令守北疆', d: '获得将领铁木真', fn: () => { const g = genByName('铁木真'); if (g) { g.f = P(); g.status = 'idle'; } } },
        { t: '此人不可留', d: '', fn: () => { const g = genByName('铁木真'); if (g) g.status = 'dead'; } },
      ],
    },
    victory: { ...ENDINGS.victory, choices: [{ t: '继续经营', fn: () => {} }] },
    endingRestoration: endingEvent('endingRestoration'),
    endingHuanglong: endingEvent('endingHuanglong'),
    endingProsperity: endingEvent('endingProsperity'),
    endingMaritime: endingEvent('endingMaritime'),
    endingRetreat: endingEvent('endingRetreat'),
    endingDefeat: endingEvent('endingDefeat', '回看残局'),
    info: {
      title: p => p.title, text: p => p.text, choices: [{ t: '知道了', d: '', fn: () => {} }],
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
          const S = G(), g = GAME.gen(p.gen), it = DATA.ITEMS[p.item];
          if (!it || !g || g.f !== P() || !active(g) || (g.items || []).length >= 3) return;
          const taken = S.itemsTaken || (S.itemsTaken = {});
          if (taken[p.item]) return;
          (g.items || (g.items = [])).push(p.item);
          taken[p.item] = 1;
          for (const k of ['tong', 'wu', 'zhi', 'zheng']) if (it[k]) GAME.applyLevel(g, { k: 'stat', s: k, v: it[k] });
          GAME.log(`${g.name}获赐【${it.name}】。`, 'big');
        } },
        { t: '旌表其义，宝仍归民', d: '京城民心 +4', fn: () => {
          const c = capital(P()); if (c) changeLoyalty(c, 4);
        } },
      ],
    },
  };

  // ---------- 科举 ----------
  function kejuCandidates() {
    const S = G();
    const acad = S.cities.filter(c => c.f === P() && c.buildings.academy).length;
    const n = Math.min(7, 3 + Math.floor(acad / 3));
    const q = 42 + Math.min(18, acad * 1.5) + (GAME.hasTech(P(), 'lixue') ? 5 : 0);
    const out = [];
    for (const g of S.generals) if (g.f === P() && g.status === 'future' && S.year >= g.avail && g.zheng > g.wu + 5) { g.status = 'cand'; out.push(g.id); }
    while (out.length < n) {
      const mil = r() < 0.4;
      const g = GAME.randomGeneral(P(), mil ? 'mil' : 'civil', q);
      g.status = 'cand'; g.mil = mil;
      out.push(g.id);
    }
    return out;
  }
  function kejuResolve(p, chosen) {
    for (const id of p.options) {
      const g = GAME.gen(id);
      if (chosen.includes(id)) { g.status = 'idle'; GAME.log(`${g.name}${g.hist ? '（史）' : ''}登第入仕。`, 'sci'); }
      else g.status = g.hist ? 'future' : 'gone';
      if (!chosen.includes(id) && g.hist) g.avail = G().year + 3;
    }
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
      if (!alive('crusader')) return;
      const cap = GAME.city(fac('crusader').capital);
      if (alive('france')) spawnArmy('crusader', cap.tile, ['hcav', 'hcav', 'inf', 'inf', 'bow', 'cav'], null, '法兰克十字军');
      if (alive('hre')) spawnArmy('crusader', cap.tile, ['hcav', 'hcav', 'inf', 'inf', 'inf', 'bow'], null, '日耳曼十字军');
      if (alive('zengid')) GAME.declareWar('crusader', 'zengid', true);
      worldLog('第二次十字军东征：法兰克王与日耳曼王率军东来。', ['crusader', 'france', 'hre']);
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
      worldLog('古尔王朝“焚世者”阿拉丁起兵，攻伐伽色尼。', ['ghor', 'ghazni']);
    } },
    { y: 1161, s: 2, fn: () => {
      if (!alive('jin')) return;
      const S = G();
      const wl = genByName('完颜亮');
      if (wl && wl.status !== 'dead' && wl.f === 'jin') { /* ok */ }
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
      if (!alive('fatimid')) return;
      renameFaction('fatimid', '阿尤布', '尤');
      const sal = genByName('萨拉丁');
      if (sal && ['idle', 'future'].includes(sal.status)) { sal.f = 'fatimid'; sal.status = 'idle'; }
      const cap = GAME.city(fac('fatimid').capital);
      spawnArmy('fatimid', cap.tile, ['hcav', 'cav', 'cav', 'inf', 'inf', 'bow', 'bow'], '萨拉丁');
      worldLog('萨拉丁废法蒂玛哈里发，建立阿尤布王朝。', ['fatimid']);
    } },
    { y: 1187, s: 2, fn: () => {
      if (!alive('fatimid') || !alive('crusader')) return;
      GAME.declareWar('fatimid', 'crusader', true);
      const t = GAME.city(fac('crusader').capital).tile;
      spawnArmy('fatimid', t, ['hcav', 'hcav', 'cav', 'cav', 'inf', 'inf', 'bow', 'bow'], '萨拉丁');
      worldLog('哈丁之战：萨拉丁大破十字军，兵临耶路撒冷。', ['fatimid', 'crusader']);
    } },
    { y: 1189, s: 1, fn: () => {
      if (!alive('crusader')) return;
      const t = GAME.city(fac('crusader').capital).tile;
      if (alive('england')) spawnArmy('crusader', t, ['hcav', 'hcav', 'inf', 'inf', 'bow', 'bow', 'navy'], '狮心王理查', '英格兰十字军');
      if (alive('france')) spawnArmy('crusader', t, ['hcav', 'hcav', 'inf', 'inf', 'bow'], '腓力二世', '法兰克十字军');
      if (alive('hre')) spawnArmy('crusader', t, ['hcav', 'hcav', 'hcav', 'inf', 'inf', 'bow'], '腓特烈一世', '日耳曼十字军');
      worldLog('第三次十字军东征：英王“狮心”理查、法王腓力二世、德皇“红胡子”腓特烈联袂东征。', ['crusader', 'england', 'france', 'hre']);
    } },
    { y: 1180, s: 1, fn: () => {
      if (!alive('japan')) return;
      const c = byName('镰仓');
      if (c && c.f === 'japan') { GAME.rebellion(c); GAME.rebellion(c); worldLog('日本源平合战爆发，源氏举兵于关东。', ['japan']); }
    } },
    { y: 1206, s: 0, fn: () => {
      const S = G(), tm = genByName('铁木真');
      const onan = byName('斡难河');
      if (!alive('mongol')) {
        if (onan && onan.f === P()) { if (tm && tm.status !== 'dead') S.pending.push({ ev: 'temujinSong' }); return; }
        if (!onan || onan.f === 'rebel' || !tm || tm.status === 'dead') return;
        const F = fac('mongol'); F.alive = true;
        GAME.captureCity(onan, 'mongol'); onan.cap = true; F.capital = onan.id;
      }
      renameFaction('mongol', '大蒙古国', '蒙');
      const F = fac('mongol'); F.aggr = 1; F.techs.jiaqi = 1; F.gold += 600; F.horse += 200; F.man += 200;
      for (const f of ['kerait', 'naiman']) if (alive(f)) for (const c of GAME.citiesOf(f)) GAME.captureCity(c, 'mongol');
      const cap = GAME.city(F.capital) || onan;
      for (const n of ['铁木真', '木华黎', '哲别', '速不台', '博尔术']) spawnArmy('mongol', cap.tile, ['hbow', 'hbow', 'hbow', 'hbow', 'hcav', 'hcav', 'cav', 'cav'], n);
      F.mongolBoost = 1;
      S.pending.push({ ev: 'temujin' });
    } },
    { y: 1211, s: 1, fn: () => { if (alive('mongol') && fac('mongol').mongolBoost) { for (const f of ['jin', 'xia']) if (alive(f)) GAME.declareWar('mongol', f, true); worldLog('成吉思汗誓师伐金。', ['mongol', 'jin']); } } },
    { y: 1218, s: 1, fn: () => {
      if (!alive('mongol') || !fac('mongol').mongolBoost) return;
      if (alive('khwarazm')) GAME.declareWar('mongol', 'khwarazm', true);
      if (alive('xiliao')) GAME.declareWar('mongol', 'xiliao', true);
      let west = null, bx = 1e9;
      for (const c of GAME.citiesOf('mongol')) { const x = GEO.colOf(c.tile); if (x < bx) { bx = x; west = c; } }
      if (west) { spawnArmy('mongol', west.tile, rep(['hbow', 'hbow', 'hcav', 'cav'], 9), '哲别'); spawnArmy('mongol', west.tile, rep(['hbow', 'hbow', 'hcav', 'siege'], 9), '拖雷'); }
      worldLog('蒙古西征：成吉思汗以花剌子模杀使为由，挥师西进。', ['mongol', 'khwarazm']);
    } },
    { y: 1236, s: 1, fn: () => {
      if (!alive('mongol') || !fac('mongol').mongolBoost) return;
      for (const f of ['rus', 'cuman', 'bulgar', 'hungary', 'poland']) if (alive(f)) GAME.declareWar('mongol', f, true);
      let west = null, bx = 1e9;
      for (const c of GAME.citiesOf('mongol')) { const x = GEO.colOf(c.tile); if (x < bx) { bx = x; west = c; } }
      if (west) { spawnArmy('mongol', west.tile, rep(['hbow', 'hbow', 'hcav', 'cav'], 10), '拔都'); spawnArmy('mongol', west.tile, rep(['hbow', 'hcav', 'hcav', 'siege'], 10), '速不台'); }
      worldLog('长子西征：拔都、速不台率军横扫钦察、斡罗思。', ['mongol', 'rus']);
    } },

    { y: 1153, s: 0, fn: () => {
      const old = ownedName('会宁', 'jin'), next = ownedName('燕京', 'jin');
      if (!old || !next || fac('jin').capital !== old.id) return;
      old.cap = false; next.cap = true; fac('jin').capital = next.id;
      next.buildings.walls = 1; next.wall = GAME.maxWall(next);
      worldLog('金主自会宁移都燕京，号为中都，百司随驾南迁。', ['jin']);
    } },
    { y: 1164, s: 3, fn: () => {
      if (!ownedName('汴京', 'jin') || !ownedName('临安', 'song') || !GAME.atWar('song', 'jin') || GAME.warScore('song', 'jin') > 0) return;
      if (P() === 'song') G().pending.push({ ev: 'peaceoffer', from: 'jin', longxing: true });
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
      worldLog('源氏舟师会战于坛之浦，平氏覆亡；镰仓自此掌兵政，朝廷仍居平安京。', ['japan']);
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
        worldLog('第四次十字军攻入君士坦丁堡，威尼斯据其港城，拂菻诸臣奔走。', ['venice', 'crusader', 'byz']);
      } else worldLog('第四次十字军折往博斯普鲁斯，与威尼斯舟师会于君士坦丁堡城下。', ['venice', 'crusader', 'byz']);
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
      if (!c || !mayFight('mongol', 'khwarazm')) return;
      const base = nearCity('mongol', c.tile, 22);
      if (!base || !warArmy('mongol', 'khwarazm', base, ['hbow', 'hbow', 'hcav', 'cav', 'siege'], '察合台', '河中征军')) return;
      worldLog('蒙古军西度河中，花剌子模分兵守诸城，商路绝而使骑不通。', ['mongol', 'khwarazm']);
    } },
    { y: 1227, s: 2, fn: () => {
      const c = ownedName('兴庆', 'xia');
      if (!c || !alive('mongol') || !GAME.atWar('mongol', 'xia') || !nearCity('mongol', c.tile, 8) || !hasLead('mongol', 'xia', 1.75)) return;
      if (GAME.citiesOf('xia').length <= 2 && P() !== 'xia') {
        for (const town of GAME.citiesOf('xia')) GAME.captureCity(town, 'mongol');
        worldLog('兴庆开降，夏国诸城相继归附，河西尽入蒙古。', ['mongol', 'xia']);
      } else if (warArmy('mongol', 'xia', c, ['hbow', 'hbow', 'hcav', 'siege'], null, '河西征军')) {
        worldLog('兴庆已在两军锋镝之间，蒙古诸部合围夏都。', ['mongol', 'xia']);
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
      worldLog('基辅城破，诸公国闻报震动，蒙古兵锋遂指西境。', ['mongol', 'rus']);
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
      if (!c || !mayFight('mongol', 'abbasid') || !nearCity('mongol', c.tile, 14)) return;
      const a = warArmy('mongol', 'abbasid', c, ['hbow', 'hcav', 'inf', 'siege', 'siege'], '旭烈兀', '巴格达征军');
      if (!a) return;
      if (P() !== 'abbasid' && hasLead('mongol', 'abbasid', 1.4) && c.garrison.length <= 5) {
        GAME.captureCity(c, 'mongol');
        worldLog('旭烈兀军入巴格达，黑衣大食朝廷离散。', ['mongol', 'abbasid']);
      } else worldLog('巴格达合围，旭烈兀列砲城外，阿拔斯诸军闭门坚守。', ['mongol', 'abbasid']);
    } },
    { y: 1259, s: 1, fn: () => {
      const c = ownedName('合州', 'song') || ownedName('重庆', 'song');
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
      worldLog('马穆鲁克骑师北上，与蒙古前军相遇于艾因札鲁特，叙利亚诸城观望。', ['fatimid', 'mongol']);
    } },
    { y: 1268, s: 2, fn: () => {
      const c = ownedName('襄阳', 'song');
      if (!c || !mayFight('mongol', 'song') || !GAME.cityTiles(c).some(t => GEO.NBR[t].some(n => GAME.tileOwner(n) === 'mongol'))) return;
      if (!warArmy('mongol', 'song', c, ['hbow', 'hcav', 'inf', 'siege', 'siege'], '阿术', '襄樊围城军')) return;
      reinforce(c, ['inf', 'bow']);
      G().flags.xiangyangSiege = true;
      worldLog('襄樊围城：蒙古军沿汉水筑垒，宋发守卒保城，诸路援兵竞走江汉。', ['song', 'mongol']);
    } },
    { y: 1274, s: 3, fn: () => {
      const c = ownedName('博多', 'japan');
      const port = ownedName('庆州', 'mongol') || (GAME.allied('mongol', 'goryeo') && ownedName('庆州', 'goryeo'));
      if (!c || !mayFight('mongol', 'japan') || !(port || nearCity('mongol', c.tile, 14, x => x.port))) return;
      if (warArmy('mongol', 'japan', c, ['navy', 'navy', 'navy', 'inf', 'bow', 'cav'], null, '文永来航军')) {
        worldLog('蒙古舟师横海至筑前，镰仓诸将集兵博多，文永之役由此而起。', ['mongol', 'japan']);
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
        worldLog('保元之乱：平安京二院相争，源、平武士分赴两阵，宫城重设守备。', ['japan']);
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
        worldLog('占城袭吴哥：舟师循水道深入真腊，吴哥城垣受损，民多惊散。', ['champa', 'khmer']);
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
        if (!c || !ownedName('开罗', 'fatimid') || !GAME.atWar('fatimid', 'crusader') || P() === 'crusader') return;
        if (!G().armies.some(a => a.f === 'fatimid' && GEO.dist(a.tile, c.tile) <= 6)) return;
        if (c.garrison.length <= 4 && hasLead('fatimid', 'crusader', 1.15)) {
          GAME.captureCity(c, 'fatimid');
          worldLog('哈丁余波：阿尤布军接管耶路撒冷，守城诸人出城归去。', ['fatimid', 'crusader']);
        } else {
          c.wall = Math.max(0, c.wall - 22);
          worldLog('哈丁余波：阿尤布军进围耶路撒冷，守军闭门待援。', ['fatimid', 'crusader']);
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
        worldLog('英格兰大宪章：诸侯集于伦尼米德，国王许守成文之约，王库暂减征取。', ['england']);
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
        worldLog('雅法和约：腓特烈二世与卡米勒罢兵，耶路撒冷依约交予十字军。', ['hre', 'fatimid', 'crusader']);
      } },
      { y: 1231, s: 2, fn: () => {
        const c = ownedName('西京', 'goryeo');
        if (!c || !ownedName('开京', 'goryeo') || !mayFight('mongol', 'goryeo') || !nearCity('mongol', c.tile, 16)) return;
        if (!warArmy('mongol', 'goryeo', c, ['hbow', 'hbow', 'hcav', 'siege'], null, '蒙古东征军')) return;
        reinforce(c, ['inf']);
        worldLog('蒙古征高丽：兵入西京近境，高丽发守卒，令沿江诸寨坚壁。', ['mongol', 'goryeo']);
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
      if (g && g.status !== 'dead' && G().T < info.until) continue;
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
    const cooled = ev => (ledger.next[ev] ?? -1) <= S.T;
    const opened = ev => {
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
      } else if (cooled('captured')) opened('captured');
      else S.pending.splice(captureNotice, 1);
      if (ledger.lastPopup === S.T) return;
    }

    const ourStart = attacking ? rep.before.a : rep.before.d;
    const ourEnd = attacking ? rep.after.a : rep.after.d;
    const foeStart = attacking ? rep.before.d : rep.before.a;
    const losses = ourStart ? Math.max(0, 1 - ourEnd / ourStart) : 0;
    if (!won && g && losses > 0.5) {
      const roll = r();
      const deathChance = g.hist ? 0.005 : 0.01;
      if (cooled('battleDeath') && roll < deathChance) {
        GAME.killGeneral(g, '阵亡');
        queue('battleDeath', { gen: g.id, name: g.name });
        return;
      }
      if (cooled('battleWound') && !ledger.wounds[g.id] && roll >= deathChance && roll < deathChance + 0.10) {
        const tong = GAME.ri(10, 20), wu = GAME.ri(10, 20);
        g.tong -= tong;
        g.wu -= wu;
        ledger.wounds[g.id] = { tong, wu, until: S.T + 3 };
        queue('battleWound', { gen: g.id, name: g.name, tong, wu });
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
      queue('battleCaptive', { gen: captive.id, name: captive.name, army });
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
    if (S?.defeat) reachEnding('endingDefeat', true);
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
    if (type === 'big' && S.victory && text === '四海归一，万国来朝！') reachEnding('victory', true);
    else if (type === 'big' && S.defeat && text === '社稷倾覆……') reachEnding('endingDefeat', true);
    else if (type === 'war' && /失守于【[^】]+】！$/.test(text) && S.flags.milestones?.prosperity) {
      S.flags.milestones.prosperity.loss = true;
    }
  });
  // 旧档可能已覆亡或统一，读档后无法靠下一回合补记覆亡。
  GAME.on('change', recordTerminalEndings);

  // ---------- 本纪 ----------
  const ANNALS_LIMIT = 300;
  const ACHIEVEMENTS = [
    ['firstWin', '首胜', '取得一场胜利', f => f.wins >= 1],
    ['tenWins', '十战奏捷', '取得十场胜利', f => f.wins >= 10],
    ['underdog', '以少胜多', '兵力未及敌半而胜十次', f => f.underdogs >= 10],
    ['stratagems', '运筹帷幄', '施计成功五十次', f => f.plans >= 50],
    ['firstCity', '初拓一城', '首次攻取一城', f => f.captures >= 1],
    ['tenCities', '十克州城', '攻取城池十次', f => f.captures >= 10],
    ['fortress', '铁壁', '据城击退来犯十次', f => f.holds >= 10],
    ['manual', '临阵制胜', '亲自指挥获胜', f => f.manualWins >= 1],
    ['bian', '收复汴京', '占领汴京', f => f.bian],
    ['customs', '海港开埠', '一座港口设有市舶司', f => f.customs],
    ['threeReigns', '三朝元老', '同一大臣在三位皇帝治下担任朝官', f => f.threeReigns],
    ['distant', '千里奔袭', '距当朝都城至少二十格进攻获胜', f => f.distant],
    ['veteran', '宿将', '本朝一位将领升至十级', f => f.veteran],
    ['wealth', '府库充盈', '府库积钱一万贯', f => f.gold >= 10000],
    ['population', '户口殷阜', '治下户口达到五百万', f => f.population >= 500],
    ['scholarship', '格物大成', '拥有二十项科技', f => f.techs >= 20],
    ['restoration', '两京归宋', '达成还我河山', f => f.endings.endingRestoration],
    ['north', '北境勒功', '达成直捣黄龙', f => f.endings.endingHuanglong],
    ['flourishing', '五稔丰宁', '达成中兴之治', f => f.endings.endingProsperity],
    ['sea', '舶通四海', '达成海上称雄', f => f.endings.endingMaritime],
  ];
  let recordingHistory = false;

  function annalsState() {
    const S = G();
    return S.flags.annals || (S.flags.annals = {
      start: [S.year, S.season], events: [], eventCount: 0, reigns: [], service: {}, honors: {}, ministers: {},
      totals: { wins: 0, losses: 0, underdogs: 0, plans: 0, holds: 0, manualWins: 0, captures: 0 },
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
    if (!attacking && won && rep.city && byName(rep.city)?.f === P()) stats.holds++;
    const cap = capital(P());
    if (attacking && won && cap && Number.isInteger(rep.tile) && GEO.dist(cap.tile, rep.tile) >= 20) stats.distant = true;
    if (g && g.f === P()) {
      const service = generalService(book, g);
      if (won) service.wins++; else service.losses++;
      service.attributes = [g.tong, g.wu, g.zhi, g.zheng];
    }
    awardAchievements(book);
    return book;
  }
  function awardAchievements(book) {
    if (Object.keys(book.honors).length === ACHIEVEMENTS.length) return;
    const S = G(), p = P(), F = fac(p), cities = GAME.citiesOf(p);
    const facts = { ...book.totals, endings: S.flags.milestones?.reached || {}, threeReigns: book.threeReigns != null,
      bian: byName('汴京')?.f === p, customs: cities.some(c => c.port && c.buildings.shibosi),
      veteran: S.generals.some(g => g.f === p && g.lv >= 10), gold: F.gold, techs: Object.keys(F.techs).length,
      population: cities.reduce((sum, c) => sum + c.pop, 0) };
    for (const [id, name, , test] of ACHIEVEMENTS) {
      if (!book.honors[id] && test(facts)) {
        book.honors[id] = GAME.dateStr();
        GAME.log('功业 · ' + name, 'big');
      }
    }
  }
  GAME.on('log', ({ text, type }) => {
    const captured = type === 'war' && /^王师克复([^，]+)，/.exec(text);
    const fallen = type === 'war' && /^([^，。！]+)阵亡。$/.exec(text);
    const milestone = type === 'big' && /^(史官记曰：|四海归一，万国来朝|社稷倾覆)/.test(text);
    const opening = type === 'big' && /^绍兴十年七月，岳飞大破/.test(text);
    const lost = type === 'war' && /失守于【[^】]+】！$/.test(text);
    if (!captured && !fallen && !milestone && !opening && !lost && !(recordingHistory && type === 'world')) return;
    const book = annalsState();
    recordReign(book);
    if (captured) {
      book.totals.captures++;
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
    if (/史官记曰|万国来朝|社稷倾覆|即位/.test(text)) return 3;
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
  function generalBiographies(book) {
    const S = G();
    const ranks = S.generals.filter(g => g.f === P() && !['future', 'cand', 'gone'].includes(g.status))
      .map(g => {
        const service = book.service[g.id];
        return { g, service, wins: Math.max(g.hist ? g.wins || 0 : 0, service?.wins || 0) };
      }).sort((a, b) => b.wins - a.wins || a.g.id - b.g.id).slice(0, 5);
    return ranks.map(({ g, service, wins }) => {
      const attributes = g.status === 'dead' && !g.hist ? service?.attributes || [0, 0, 0, 0] : [g.tong, g.wu, g.zhi, g.zheng];
      const [tong, wu, zhi, zheng] = attributes;
      const descriptions = [[tong, '善整军伍'], [wu, '勇于锋镝'], [zhi, '长于谋划'], [zheng, '晓于民政']];
      descriptions.sort((a, b) => b[0] - a[0]);
      const end = service?.fallen ? '后殁于阵。' : g.status === 'dead' ? '其人已卒。' : '';
      const text = `${descriptions[0][1]}，统 ${tong}、武 ${wu}、智 ${zhi}、政 ${zheng}。计胜 ${wins} 阵，本纪记败 ${service?.losses || 0} 阵。${end}`;
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
    const honors = ACHIEVEMENTS.map(([id, name, description]) => {
      const reached = book.honors[id];
      return `<p class="${reached ? '' : 'note'}"><span class="chip">${reached ? annalEsc(reached) : '待成'}</span> <b>${name}</b>　${description}</p>`;
    }).join('');
    return `<div class="sec">史官评语</div><p class="story">${annalEsc(annalsAssessment(book))}</p>` +
      `<p class="note">本卷始录于${annalDate(book.start)}。${book.eventCount > book.events.length ? '本卷择录要事，不逾三百条。' : ''}</p>` +
      '<div class="sec">帝纪</div>' + (chapters || '<p class="note">本卷尚待入录。</p>') +
      '<div class="sec">大事年表</div>' + (chronology || '<p class="note">本卷尚无纪年大事。</p>') +
      '<div class="sec">将相列传</div>' + (generalBiographies(book) || '<p class="note">本卷尚无列传。</p>') +
      '<div class="sec">功业成就</div>' + honors;
  }

  // ---------- 每回合 ----------
  function turn() {
    const S = G(), p = P();
    recoverBattleWounds();
    // 史实
    for (let i = 0; i < HIST.length; i++) {
      const h = HIST[i];
      if (S.flags['h' + i]) continue;
      if (S.year > h.y || (S.year === h.y && S.season >= h.s)) {
        S.flags['h' + i] = 1;
        recordingHistory = true;
        try { h.fn(); } catch (e) { console.error(e); }
        finally { recordingHistory = false; }
      }
    }
    // 秦桧
    if (S.flags.qin === 'angry' && S.T >= S.flags.qinTurn && !S.flags.qinDone) { S.flags.qinDone = 1; S.pending.push({ ev: 'qinhui' }); }
    if (S.flags.qin === 'kept' && S.season === 3 && S.newSeason) fac(p).gold += 60;
    // 蒙古鼎盛期增援
    if (alive('mongol') && fac('mongol').mongolBoost && S.year < 1260 && S.season === 0 && S.newSeason && r() < 0.6) {
      const cs = GAME.citiesOf('mongol'); if (cs.length) { const c = GAME.pick(cs); c.garrison.push(GAME.mkUnit('hbow'), GAME.mkUnit('hbow'), GAME.mkUnit('cav')); }
    }
    // 科举：每三年春
    if (S.season === 0 && S.newSeason && S.year % 3 === 2 && alive(p)) {
      const opts = kejuCandidates();
      const max = 2 + (GAME.hasTech(p, 'kejugaige') ? 1 : 0);
      S.pending.push({ ev: 'keju', options: opts, max });
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
          S.pending.push({ ev: 'peaceoffer', from: f, trib });
        }
      } else if (!GAME.atWar(f, p) && !GAME.allied(f, p) && fac(p).met[f] && GAME.getRel(f, p).op > 60 && r() < 0.03 * GAME.E()) {
        S.pending.push({ ev: 'allyoffer', from: f });
      }
    }
    petitionEvents();
    // 随机事件
    if (r() < 0.22 * GAME.E() && alive(p)) randomEvent();
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
    if (S.T < (flags.nextPetition || 0) || r() >= 0.12 * GAME.E()) return;
    const cs = GAME.citiesOf(p), pool = [];
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
    if (pool.length) {
      flags.nextPetition = S.T + 6;
      S.pending.push(GAME.pick(pool));
    }
  }

  function localRandom(cs) {
    const S = G(), p = P(), city = GAME.pick(cs);
    const pool = [{ ev: 'plague', city: city.id }, { ev: 'earthquake', city: city.id }, { ev: 'comet' }];
    const hostile = Object.keys(S.factions).filter(f => f !== 'rebel' && alive(f) && GAME.atWar(p, f));
    for (const enemy of hostile) {
      const border = cs.find(c => nearCity(enemy, c.tile, 6));
      if (border) { pool.push({ ev: 'borderPetition', city: border.id, enemy }); break; }
    }
    const towns = cs.filter(c => !c.buildings.market);
    if (towns.length) pool.push({ ev: 'merchantProposal', city: GAME.pick(towns).id });
    const items = Object.keys(DATA.ITEMS).filter(id => !(S.itemsTaken && S.itemsTaken[id]) &&
      !S.pending.some(v => v.ev === 'offeredTreasure' && v.item === id));
    const gens = S.generals.filter(g => g.f === p && active(g) && (g.items || []).length < 3);
    if (items.length && gens.length) pool.push({ ev: 'offeredTreasure', item: GAME.pick(items), gen: GAME.pick(gens).id });
    S.pending.push(GAME.pick(pool));
  }

  function randomEvent() {
    const S = G(), p = P();
    const cs = GAME.citiesOf(p);
    if (!cs.length) return;
    if (r() < 0.32) { localRandom(cs); return; }
    const k = r();
    const c = GAME.pick(cs);
    if (k < 0.18) { const rc = cs.filter(x => GEO.river[x.tile]); if (rc.length) S.pending.push({ ev: 'flood', city: GAME.pick(rc).id }); }
    else if (k < 0.32) S.pending.push({ ev: 'drought', city: c.id });
    else if (k < 0.42) { const pc = cs.filter(x => x.port); if (pc.length) S.pending.push({ ev: 'pirates', city: GAME.pick(pc).id }); }
    else if (k < 0.6) { const mil = r() < 0.5; const g = GAME.randomGeneral(p, mil ? 'mil' : 'civil', 50 + r() * 12); g.status = 'cand'; S.pending.push({ ev: 'talent', gen: g.id, mil }); }
    else if (k < 0.76) {
      const far = Object.keys(S.factions).filter(f => f !== p && alive(f) && fac(p).met[f] && !GAME.atWar(f, p) && f !== 'rebel');
      if (far.length) S.pending.push({ ev: 'tribute', from: GAME.pick(far) });
    } else if (k < 0.88) {
      fac(p).food += 120; GAME.log('风调雨顺，诸路丰稔，入粮 120 石。', 'eco');
    } else {
      for (const x of cs) x.loyalty = Math.min(100, x.loyalty + 4);
      GAME.log(GAME.pick(['麒麟见于郊野', '甘露降于宫苑', '黄河清', '嘉禾生于籍田', '凤凰集于岐山']) + '，群臣称贺，天下民心稍安。', 'eco');
    }
  }

  function view(p) {
    const d = DEFS[p.ev];
    const val = (x) => typeof x === 'function' ? x(p) : x;
    if (p.ev === 'keju') return { title: d.title, text: val(d.text), type: 'pick', options: p.options, max: p.max };
    return { title: val(d.title), text: val(d.text), gen: p.gen, choices: val(d.choices).map(c => ({ t: val(c.t), d: val(c.d) || '' })) };
  }
  function resolve(p, choice) {
    const d = DEFS[p.ev];
    if (p.ev === 'keju') kejuResolve(p, choice || []);
    else (typeof d.choices === 'function' ? d.choices(p) : d.choices)[choice].fn(p);
    GAME.emit('change');
  }
  // 自动处理（无人值守/AI）
  return { turn, onBattle, annals, view, resolve, DEFS, spawnArmy };
})();
if (typeof module !== 'undefined') module.exports = EVENTS;
