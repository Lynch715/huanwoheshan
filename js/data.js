// 静态数据：势力、城市、将领、兵种、建筑、科技、人名
var DATA = (function () {
  // ---------- 势力 ----------
  // id, 名, 印字, 颜色, 文化, 好战度, 初始科技
  const F = [
    ['song', '南宋', '宋', '#b3322a', 'han', 0.5],
    ['jin', '金', '金', '#34507a', 'jurchen', 0.8],
    ['xia', '西夏', '夏', '#9a7034', 'tangut', 0.5],
    ['dali', '大理', '理', '#5f8a45', 'bai', 0.15],
    ['tubo', '吐蕃诸部', '蕃', '#7d5a93', 'tibetan', 0.2],
    ['xiliao', '西辽', '辽', '#3e7f78', 'khitan', 0.6],
    ['mongol', '蒙古', '蒙', '#2b2b2b', 'mongol', 0.85],
    ['kerait', '克烈', '克', '#6a6250', 'mongol', 0.5],
    ['naiman', '乃蛮', '乃', '#7b6a8a', 'mongol', 0.5],
    ['goryeo', '高丽', '丽', '#4f7cab', 'korean', 0.2],
    ['japan', '日本', '和', '#a24f7c', 'japanese', 0.35],
    ['daviet', '交趾', '越', '#5d9666', 'viet', 0.35],
    ['champa', '占城', '占', '#b7883e', 'cham', 0.4],
    ['khmer', '真腊', '腊', '#8f6a3f', 'khmer', 0.5],
    ['pagan', '蒲甘', '甘', '#b07b2e', 'burmese', 0.35],
    ['ghazni', '伽色尼', '伽', '#5f6c33', 'turkic', 0.4],
    ['ghor', '古尔', '古', '#8a5a2a', 'persian', 0.7],
    ['rajput', '拉杰普特诸邦', '拉', '#c07a35', 'indian', 0.4],
    ['gahad', '曲女城', '曲', '#c48f52', 'indian', 0.3],
    ['pala', '波罗', '波', '#995a5a', 'indian', 0.25],
    ['chalukya', '遮娄其', '遮', '#a5683f', 'indian', 0.4],
    ['chola', '注辇', '辇', '#6d4a80', 'indian', 0.45],
    ['lanka', '细兰', '兰', '#4f8a6f', 'indian', 0.2],
    ['seljuk', '塞尔柱', '塞', '#356b5b', 'turkic', 0.6],
    ['khwarazm', '花剌子模', '花', '#857035', 'turkic', 0.6],
    ['abbasid', '黑衣大食', '食', '#3d3d33', 'arab', 0.3],
    ['zengid', '赞吉', '赞', '#6e4a25', 'turkic', 0.75],
    ['fatimid', '绿衣大食', '绿', '#3f7b3a', 'arab', 0.35],
    ['hejaz', '汉志', '志', '#9b8a55', 'arab', 0.1],
    ['yemen', '也门', '门', '#7f6a4a', 'arab', 0.2],
    ['oman', '阿曼', '曼', '#5a7a8a', 'arab', 0.2],
    ['crusader', '耶路撒冷', '耶', '#7d8597', 'frankish', 0.6],
    ['rum', '罗姆', '罗', '#9c6745', 'turkic', 0.5],
    ['byz', '拂菻', '拂', '#6b2c5c', 'greek', 0.45],
    ['georgia', '谷儿只', '谷', '#8d3a3a', 'georgian', 0.4],
    ['rus', '斡罗思', '斡', '#4a5c8f', 'rus', 0.45],
    ['cuman', '钦察', '钦', '#8b8a42', 'cuman', 0.6],
    ['bulgar', '不里阿耳', '阿', '#647a55', 'turkic', 0.3],
    ['hungary', '马札儿', '札', '#5f8d58', 'magyar', 0.45],
    ['poland', '孛烈儿', '孛', '#a83f3f', 'polish', 0.4],
    ['hre', '日耳曼', '日', '#8a7726', 'german', 0.55],
    ['france', '法兰克', '法', '#3a5d9e', 'frankish', 0.45],
    ['england', '英格兰', '英', '#9e2b2b', 'english', 0.5],
    ['scotland', '苏格兰', '苏', '#4a6e8e', 'english', 0.3],
    ['ireland', '爱尔兰', '爱', '#4f8a4f', 'english', 0.2],
    ['castile', '卡斯蒂利亚', '卡', '#a07b25', 'iberian', 0.5],
    ['portugal', '葡萄牙', '葡', '#3d7a5f', 'iberian', 0.35],
    ['aragon', '阿拉贡', '贡', '#b8902e', 'iberian', 0.4],
    ['almoravid', '穆拉比特', '穆', '#5b3c25', 'moorish', 0.5],
    ['zirid', '齐里', '齐', '#8a6a4f', 'moorish', 0.3],
    ['sicily', '西西里', '西', '#3e8aa3', 'italian', 0.5],
    ['papal', '教皇国', '教', '#c4b05a', 'italian', 0.2],
    ['venice', '威尼斯', '威', '#8d2a3e', 'italian', 0.3],
    ['denmark', '丹麦', '丹', '#a93636', 'norse', 0.45],
    ['sweden', '瑞典', '瑞', '#3a6ba3', 'norse', 0.35],
    ['norway', '挪威', '挪', '#6a5a8a', 'norse', 0.35],
    ['nubia', '努比亚', '努', '#8a5a3a', 'ethiopian', 0.2],
    ['abyssinia', '阿比西尼亚', '比', '#6a8a3a', 'ethiopian', 0.2],
    ['mayi', '麻逸', '麻', '#5a8a7a', 'filipino', 0.1],
  ];
  const FACTIONS = F.map(a => ({ id: a[0], name: a[1], seal: a[2], color: a[3], culture: a[4], aggr: a[5] }));
  const SONG_RECLAIM = new Set(['汴京', '洛阳', '大名', '济南', '益都', '太原', '真定', '河间', '京兆', '秦州', '延安', '徐州', '海州', '蔡州', '寿州', '临洮', '燕京', '大同']);
  const DIFFICULTY = [
    { name: '宽仁', aiYield: 0.60, aiBattle: 0.52, startReserve: 1.5, northGarrison: -3, northArmy: 0, eraRecruit: 0, ransom: 0.8,
      coalition: { threat: 0.21, ratio: 0.08, opinion: 5, rapport: 2, allyAt: 55, peaceRate: 0.3, dislike: 3, warDelay: 6 },
      command: { armies: 0, defenseWeight: 1, unrestWeight: 0.02, assault: 1.12, retreat: 45, morale: 30, reconquest: 2, northPush: 0, siegeInterval: 0.82 },
      occupation: { seasons: 1, production: 0.02, loyalty: 48, unrest: 8, revolt: 0 },
      debt: { governance: 0, morale: 1, desertion: 0, hunger: 0.5, famine: 0 } },
    { name: '中庸', aiYield: 1, aiBattle: 0.90, startReserve: 1.14, northGarrison: -2, northArmy: 0, eraRecruit: 0, ransom: 1,
      coalition: { threat: 0.21, ratio: 0.8, opinion: -12, rapport: 4, allyAt: 42, peaceRate: 0.45, dislike: 5, warDelay: 2 },
      command: { armies: 1, defenseWeight: 1.4, unrestWeight: 0.09, assault: 1.08, retreat: 46, morale: 32, reconquest: 4, northPush: 1, siegeInterval: 0.72 },
      occupation: { seasons: 4, production: 0.2, loyalty: 26, unrest: 35, revolt: 0.06 },
      debt: { governance: 0.013, morale: 10, desertion: 0.09, hunger: 5, famine: 0.035 } },
    { name: '严苛', aiYield: 1.11, aiBattle: 1.092, startReserve: 1, northGarrison: 1, northArmy: 0, eraRecruit: 4, ransom: 1.15,
      coalition: { threat: 0.16, ratio: 0.6, opinion: 0, rapport: 6, allyAt: 32, peaceRate: 0.65, dislike: 8, warDelay: 1 },
      command: { armies: 2, defenseWeight: 1.75, unrestWeight: 0.14, assault: 1.02, retreat: 50, morale: 35, reconquest: 6, northPush: 2, siegeInterval: 0.50 },
      occupation: { seasons: 6, production: 0.32, loyalty: 22, unrest: 42, revolt: 0.11 },
      debt: { governance: 0.023, morale: 15, desertion: 0.20, hunger: 8, famine: 0.055 } },
    { name: '地狱', aiYield: 1.22, aiBattle: 1.22, startReserve: 0.5, northGarrison: 2, northArmy: 1, eraRecruit: 6, ransom: 1.3,
      coalition: { threat: 0.135, ratio: 0.45, opinion: 12, rapport: 9, allyAt: 24, peaceRate: 0.85, dislike: 10, warDelay: 0 },
      command: { armies: 3, defenseWeight: 2.05, unrestWeight: 0.17, assault: 0.98, retreat: 54, morale: 38, reconquest: 8, northPush: 3, siegeInterval: 0.30 },
      occupation: { seasons: 8, production: 0.42, loyalty: 18, unrest: 48, revolt: 0.19 },
      debt: { governance: 0.035, morale: 22, desertion: 0.34, hunger: 12, famine: 0.09 } },
  ];


  // 约绍兴十年各地之史略。改号词条记各政权实际兴起后的沿革。
  // 海国参《宋史》卷四八八至四八九、《诸蕃志》；中亚参 Encyclopaedia Iranica 的呼罗珊、西辽及诸王朝条目。
  // 西洋与红海诸邦参大都会艺术博物馆 Heilbrunn 年表及各地遗址说明。史料有异者从略。
  const FACTION_INFO = {
    song: '靖康之变后，赵构于应天继统，朝廷南渡而驻临安。绍兴十年前后，宋金争淮汉、中原，江南财赋与沿江重镇为朝廷所赖。',
    jin: '完颜阿骨打自女真起兵，兴金灭辽，继取北宋都畿。熙宗朝仍以上京会宁为根本，兼有燕云与中原州郡，南与宋军相持。',
    xia: '党项李元昊据河西诸州称帝，建大夏，国都兴庆。绍兴间其国横扼河西道，东与金国相接，西通沙州诸郡，农牧商旅并盛。',
    dali: '段氏据洱海立大理，高氏尝一度代立，旋复段氏，而高氏仍世执国政。其地连滇中山川，诸部各守其土，佛寺颇盛。',
    tubo: '吐蕃旧朝瓦解后，高原诸地由地方王族、部落与寺院各据一方。青唐、雅砻、阿里等地各有沿革，十二世纪并无共主。',
    xiliao: '辽亡之际，耶律大石率众西行，合契丹旧部与天山诸势力，以巴拉沙衮一带为根本。其势渐及河中，与塞尔柱相争。',
    mongol: '漠北蒙古诸部沿斡难、克鲁伦诸水牧居，乞颜等部渐结联盟。其时各部尚有分合，与金国北疆时通使、时相攻。',
    kerait: '克烈部牧于漠北中部，是当时草原诸部之一。各部以水草迁徙，部酋藉婚盟聚众，其上层曾受到东方教会的影响。',
    naiman: '乃蛮诸部活跃于漠北西部及阿尔泰一带，以牧地和部众为本。与克烈及邻近各部时有争衡，后来为蒙古诸部所并。',
    goryeo: '王氏高丽以开京为都，统有半岛大部。仁宗朝平西京之乱未久，朝廷与金通使，也仍借海道与南宋商旅往还。',
    japan: '平安京为天皇朝廷所在，鸟羽上皇以院政主政。诸寺与公家多有庄园，源、平等武士家族渐在地方与宫廷间掌兵。',
    daviet: '李氏以升龙为都，国号大越，宋人多称交趾。其国以红河平原为根本，北与宋通使贸易，南与占城诸部相接。',
    champa: '占城诸聚落分布在南海西岸，王城与沿海港埠相联。其人与宋舶有香木等货之往来，北接大越，西南与真腊相争。',
    khmer: '真腊以吴哥一带为王畿，苏利耶跋摩二世时营建吴哥寺。其国凭湄公河水系与洞里萨湖蓄养民户，并与邻邦争衡。',
    pagan: '蒲甘王朝立都于伊洛瓦底江曲，舟楫贯通上缅甸诸地。王室与民间营建佛塔寺院，灌溉农田与江运为国用所依。',
    ghazni: '伽色尼一系起自突厥军人，昔日势及呼罗珊与印度西北。绍兴间巴赫拉姆沙仍据伽色尼，奉塞尔柱为宗主，东有旁遮普之地。',
    ghor: '古尔据兴都库什西南山地，由善萨巴尼家族治其诸堡。绍兴前后其酋尚受塞尔柱牵制，继而渐与伽色尼相抗。',
    rajput: '拉杰普特诸邦散居天竺西北与中部，诸王族各依城堡、田土立国。阿杰梅尔一带有乔汉家族，诸邦之间时盟时战。',
    gahad: '曲女城在恒河流域，其时为加哈达瓦拉王朝的重要王城。瞿频达旃陀罗治下兼有波罗奈，凭恒河要津与中原沃壤而兴。',
    pala: '波罗王朝起于孟加拉，曾据摩揭陀，护持那烂陀等佛寺。十二世纪王势渐衰，东部塞纳诸侯兴起，恒河下游多有争夺。',
    chalukya: '西遮娄其以迦梨耶尼为中心，列国于德干高原。十二世纪王室与地方诸侯势力并立，南面又与注辇屡争边地。',
    chola: '注辇乃南天竺朱罗王朝，根本在高韦里河流域。历朝兴建大寺，诸港舟航通南海，绍兴间仍为南印度强邦之一。',
    lanka: '细兰为印度洋海岛，波隆纳鲁沃是时人所据的王都之一。岛中诸王族各有根基，内陆重灌溉，沿海有香料、珠宝之贸。',
    seljuk: '塞尔柱诸王族分据伊朗、两河与小亚细亚。其时大苏丹桑贾尔以木鹿治呼罗珊，声势尚盛，东北则与西辽相接。',
    khwarazm: '花剌子模据阿姆河下游，绿洲城镇为河中、西域商路之会。阿即思原奉大塞尔柱，绍兴前后屡图自立，国势渐张。',
    abbasid: '黑衣大食为阿拔斯哈里发一系，巴格达仍是其宗教与政令所出。诸地苏丹多各自执兵，哈里发在两河近畿渐恢复权柄。',
    zengid: '赞吉出自塞尔柱麾下，得摩苏尔而并阿勒颇，横跨幼发拉底河两岸。其国与叙利亚诸城、十字军边堡之间攻守频仍。',
    fatimid: '绿衣大食为法蒂玛哈里发一系，自北非经营埃及，以开罗为都。十二世纪朝政多出于宰相，海陆商税仍为国家所赖。',
    hejaz: '汉志临红海，有麦加、麦地那二圣城，商舶与朝觐之人往来不绝。圣城地方首领各有其治，并受埃及与巴格达诸势力影响。',
    yemen: '也门地处阿拉伯西南，高地诸族与滨海城邦分立其间。苏莱希一系衰后，亚丁等港仍通红海与印度洋，贸易不绝。',
    oman: '阿曼据阿拉伯半岛东南海隅，山地、绿洲与商港各有根基。伊巴德派在内地有深厚传统，滨海商舶往还波斯湾与印度洋。',
    crusader: '十字军入黎凡特后，立耶路撒冷王国及埃德萨、安条克等诸国。其城堡与港口沿海陆要道分布，与北方赞吉诸军相抗。',
    rum: '塞尔柱一支经营小亚细亚，世称罗姆苏丹国，以科尼亚为治所。其地居安纳托利亚之中，与拂菻及东方诸侯相邻。',
    byz: '拂菻即东罗马，以君士坦丁堡为都。科穆宁王朝经营巴尔干与小亚细亚，东与罗姆相争，海上仍倚诸港通商。',
    georgia: '谷儿只即格鲁吉亚，巴格拉季昂王室据高加索南麓。大卫四世取第比利斯之后，其子德米特里仍赖山道与城邑维系统治。',
    rus: '斡罗思乃罗斯诸公国之通称，基辅仍有首席之望，诸支宗室各有封邑。十二世纪中叶王位迭争，边地与钦察诸部往还。',
    cuman: '钦察诸部牧于黑海北岸至里海以北的草原，西人亦称库曼。诸酋并立，时与罗斯公侯交战，时因婚盟而合兵。',
    bulgar: '不里阿耳在伏尔加河与卡马河交汇一带，国人多奉伊斯兰。其市通罗斯诸公国与中亚诸路，毛皮与诸般货物由此转输。',
    hungary: '马札儿立国于多瑙河中游诸平原，由阿尔帕德王族相继为君。国中奉拉丁教会，南与拂菻及巴尔干诸地相通。',
    poland: '孛烈儿为波兰诸地旧译。波列斯瓦夫三世于一一三八年身后分封诸子，诸公各据一方，克拉科夫仍为首席公爵所在。',
    hre: '日耳曼诸公国、主教领与北意大利诸地奉罗马帝国之名。绍兴间康拉德三世由诸侯推立，王室仍须与公爵诸家共治。',
    france: '法兰西卡佩王室以巴黎周边为本，境内诸公爵各据大片封地。路易七世初立，迎娶阿基坦女公爵，王家势力及于南方。',
    england: '诺曼征服后，英格兰由诺曼诸王及其亲族继统。亨利一世死后，斯蒂芬与玛蒂尔达争位，绍兴间诸郡多有兵争。',
    scotland: '苏格兰王大卫一世招纳南来的贵族与修士，营建城镇和修院。王家势力自中部诸地扩展，其南境与英格兰相接。',
    ireland: '爱尔兰多由各地王族分治，诸王时争全岛共主之名。都柏林等城兼有北欧移民的遗绪，以海港联结不列颠与外洋。',
    castile: '卡斯蒂利亚与莱昂合奉阿方索七世，其王尝于莱昂称帝。诸城自高原向南延展，边境与穆拉比特及伊比利亚诸邦相接。',
    portugal: '葡萄牙起于伊比利亚西北的伯爵领，阿方索·恩里克斯称王，渐与莱昂分立。绍兴初年，国势自米尼奥河向南拓展。',
    aragon: '阿拉贡为比利牛斯山南诸邦之一。拉米罗二世以女佩德罗妮拉许配巴塞罗那伯爵，两个继承体系由此相联。',
    almoravid: '穆拉比特起自撒哈拉柏柏尔诸部，建都马拉喀什，势及伊比利亚南部。十二世纪中叶，阿特拉斯山中的穆瓦希德渐起而争其地。',
    zirid: '齐里王朝起自马格里布，曾受法蒂玛委任治伊弗里基亚。部族东来后，王廷转据马赫迪耶一带，与西西里隔海相望。',
    sicily: '诺曼诸侯在南意大利与西西里立国，罗杰二世以巴勒莫为治所。其辖地民俗多元，兼有希腊、拉丁及阿拉伯诸传统。',
    papal: '教皇在罗马兼领教会与意大利中部若干土地。十二世纪教廷一面与帝国及诺曼王国周旋，一面与罗马城中诸势力相持。',
    venice: '威尼斯以潟湖诸岛为本，推举总督而治。借亚得里亚海之便，其商人远通君士坦丁堡与东地中海诸港，商贸颇盛。',
    denmark: '丹麦王国跨日德兰与海峡诸岛，海路可通北海与波罗的海。绍兴间埃里克三世在位，王室倚诸地贵族与教会而治。',
    sweden: '十二世纪瑞典王权始渐联结斯韦阿兰与约塔兰，斯韦克尔一世一系兴起。各地仍循旧有习惯法，教会渐广其影响。',
    norway: '挪威王国沿西海诸峡湾而立，舟楫交通沿海城邑。西居尔一世去世后，王族各支争立，十二世纪中叶内战方炽。',
    nubia: '努比亚诸王国沿尼罗河中游而列，马库里亚以栋古拉为重镇，南有阿洛迪亚。河谷农地与基督教堂见证其诸国之盛。',
    abyssinia: '阿比西尼亚高地承阿克苏姆以来的基督教传统，地方权力渐向内陆移转。十二世纪前后，扎格维王朝兴于高地。',
    mayi: '麻逸为宋人所记南海交易地名，赵汝适后有专条记其港市。土货见有黄蜡、吉贝、真珠等，其确切所在与范围尚难定论。',
    'almoravid@穆瓦希德': '穆瓦希德起于阿特拉斯山，伊本·图马尔特首倡其教，阿卜杜勒·穆明继领其众。一一四七年据马拉喀什，继而经营北非及安达卢斯。',
    'fatimid@阿尤布': '萨拉丁掌埃及政事后，于一一七一年终结法蒂玛哈里发一系。阿尤布诸支兼治埃及与叙利亚诸地，围绕黎凡特城港与十字军争衡。',
    'mongol@大蒙古国': '铁木真兼并漠北诸部，于一二〇六年被推为成吉思汗。其所建大蒙古国自草原向四方拓展，诸军分道远征，势及中亚。',
    'japan@镰仓幕府': '源赖朝以镰仓为根本，平氏覆亡后渐领诸国武家。朝廷仍在京都，征夷大将军与武臣藉守护、地头等主持地方军政。',
    'ghor@德里苏丹国': '古尔诸军进入北印度后，其将库特布丁·艾巴克承接当地基业。德里渐为诸苏丹政令所出，版图随诸王之战事而屡变。',
    'fatimid@马穆鲁克': '埃及马穆鲁克军人于十三世纪中叶取代当地阿尤布君主，继以开罗为国都。其后军政势力展至叙利亚，扼东西商路。',
    'daviet@大越陈朝': '陈氏于十三世纪承李氏而治大越，仍以升龙为都，凭红河州郡为本。诸王族分掌军政，后来屡御自北而来的元军。',
    'almoravid@马林王朝': '马林氏出自北非柏柏尔诸部，十三世纪取代马格里布的穆瓦希德王朝。以非斯为重心，时涉直布罗陀两岸之争。',
  };

  // ---------- 城市 ----------
  // [名, 势力, 经度, 纬度, 人口, 是否都城]
  const C = [
    // 南宋
    ['临安', 'song', 120.17, 30.27, 16, 1], ['建康', 'song', 118.78, 32.06, 11], ['扬州', 'song', 119.42, 32.39, 7], ['楚州', 'song', 119.15, 33.5, 5],
    ['庐州', 'song', 117.05, 31.49, 6], ['鄂州', 'song', 114.3, 30.6, 9], ['江陵', 'song', 112.24, 30.33, 7], ['襄阳', 'song', 112.14, 32.04, 8],
    ['潭州', 'song', 112.94, 28.23, 8], ['洪州', 'song', 115.89, 28.68, 8], ['明州', 'song', 121.55, 29.87, 7], ['温州', 'song', 120.7, 28.0, 6],
    ['福州', 'song', 119.3, 26.08, 8], ['泉州', 'song', 118.59, 24.91, 9], ['广州', 'song', 113.26, 23.13, 10], ['潮州', 'song', 116.62, 23.66, 5],
    ['赣州', 'song', 114.93, 25.83, 5], ['衡州', 'song', 112.6, 26.9, 5], ['桂州', 'song', 110.29, 25.27, 6], ['邕州', 'song', 108.32, 22.82, 4],
    ['雷州', 'song', 110.1, 20.9, 3], ['琼州', 'song', 110.35, 19.8, 3], ['成都', 'song', 104.07, 30.67, 12], ['兴元', 'song', 107.03, 33.07, 6],
    ['利州', 'song', 105.84, 32.43, 4], ['夔州', 'song', 109.5, 31.0, 4], ['重庆', 'song', 106.55, 29.56, 7], ['信州', 'song', 117.97, 28.45, 5],
    ['辰州', 'song', 110.4, 28.4, 3], ['金州', 'song', 109.0, 32.7, 3], ['泸州', 'song', 105.3, 28.2, 4], ['光州', 'song', 115.1, 32.1, 3],
    // 金
    ['会宁', 'jin', 126.96, 45.55, 9, 1], ['燕京', 'jin', 116.4, 39.9, 13], ['汴京', 'jin', 114.35, 34.8, 13], ['大名', 'jin', 115.48, 36.28, 8],
    ['济南', 'jin', 117.0, 36.65, 8], ['益都', 'jin', 118.5, 36.7, 6], ['太原', 'jin', 112.55, 37.87, 9], ['大同', 'jin', 113.3, 40.08, 7],
    ['真定', 'jin', 114.5, 38.05, 7], ['河间', 'jin', 116.1, 38.44, 5], ['洛阳', 'jin', 112.45, 34.62, 8], ['京兆', 'jin', 108.94, 34.27, 10],
    ['秦州', 'jin', 105.72, 34.58, 5], ['延安', 'jin', 109.49, 36.6, 5], ['徐州', 'jin', 117.18, 34.26, 6], ['海州', 'song', 119.13, 34.57, 4],
    ['辽阳', 'jin', 123.18, 41.27, 7], ['大定', 'jin', 119.0, 41.6, 6], ['临潢', 'jin', 119.2, 43.95, 5], ['黄龙府', 'jin', 124.8, 44.0, 5],
    ['蔡州', 'jin', 114.0, 33.0, 5], ['寿州', 'song', 116.8, 32.6, 4], ['胡里改', 'jin', 129.6, 46.3, 3], ['恤品', 'jin', 131.9, 43.8, 3],
    ['临洮', 'jin', 103.85, 35.4, 3], ['咸平', 'jin', 124.0, 42.5, 4],
    // 西夏
    ['兴庆', 'xia', 106.27, 38.47, 9, 1], ['夏州', 'xia', 109.0, 38.3, 4], ['西凉', 'xia', 102.64, 37.93, 6], ['甘州', 'xia', 100.45, 38.93, 5],
    ['肃州', 'xia', 98.5, 39.75, 4], ['沙州', 'xia', 94.66, 40.14, 4], ['黑水城', 'xia', 101.0, 41.9, 3],
    // 大理
    ['大理', 'dali', 100.23, 25.6, 8, 1], ['善阐', 'dali', 102.7, 25.04, 6], ['建昌', 'dali', 102.27, 27.9, 4], ['银生', 'dali', 100.83, 24.45, 3], ['永昌', 'dali', 98.8, 24.5, 3],
    // 吐蕃
    ['逻些', 'tubo', 91.13, 29.65, 6, 1], ['萨迦', 'tubo', 88.0, 28.9, 3], ['古格', 'tubo', 79.8, 31.5, 3], ['青唐', 'tubo', 101.78, 36.62, 5], ['昌都', 'tubo', 97.17, 31.14, 3], ['玉树', 'tubo', 96.0, 33.5, 2],
    // 西辽
    ['虎思斡耳朵', 'xiliao', 75.3, 42.75, 8, 1], ['喀什噶尔', 'xiliao', 75.99, 39.47, 7], ['于阗', 'xiliao', 79.92, 37.11, 5], ['高昌', 'xiliao', 89.19, 42.94, 6],
    ['撒马尔罕', 'seljuk', 66.96, 39.65, 10], ['布哈拉', 'seljuk', 64.42, 39.95, 8], ['塔剌思', 'xiliao', 71.4, 42.9, 4], ['龟兹', 'xiliao', 82.96, 41.72, 4], ['阿力麻里', 'xiliao', 80.8, 44.0, 3],
    // 蒙古诸部
    ['斡难河', 'mongol', 110.5, 48.8, 4, 1], ['克鲁伦', 'mongol', 115.5, 47.5, 3],
    ['土拉河', 'kerait', 106.9, 47.9, 4, 1], ['哈拉和林', 'kerait', 102.8, 47.2, 3],
    ['乃蛮帐', 'naiman', 91.5, 48.0, 4, 1], ['也儿的石', 'naiman', 86.5, 48.5, 3],
    // 高丽 日本
    ['开京', 'goryeo', 126.55, 37.97, 10, 1], ['西京', 'goryeo', 125.75, 39.03, 6], ['庆州', 'goryeo', 129.21, 35.85, 6], ['全州', 'goryeo', 127.15, 35.82, 5], ['咸州', 'goryeo', 127.5, 39.9, 3],
    ['平安京', 'japan', 135.76, 35.01, 12, 1], ['镰仓', 'japan', 139.55, 35.32, 6], ['博多', 'japan', 130.4, 33.59, 6], ['平泉', 'japan', 141.1, 38.99, 5], ['出云', 'japan', 132.76, 35.37, 4], ['伊予', 'japan', 132.77, 33.84, 3],
    // 东南亚
    ['升龙', 'daviet', 105.85, 21.03, 9, 1], ['义安', 'daviet', 105.68, 18.67, 5], ['谅州', 'daviet', 106.7, 21.9, 3],
    ['毗阇耶', 'champa', 109.05, 13.9, 6, 1], ['因陀罗补罗', 'champa', 108.2, 15.88, 4],
    ['吴哥', 'khmer', 103.86, 13.41, 12, 1], ['披迈', 'khmer', 102.5, 15.2, 5], ['罗斛', 'khmer', 100.6, 14.8, 5], ['湄公', 'khmer', 105.9, 11.5, 4],
    ['蒲甘', 'pagan', 94.86, 21.17, 9, 1], ['勃固', 'pagan', 96.48, 17.34, 5], ['阿拉干', 'pagan', 93.2, 20.5, 3],
    ['麻逸', 'mayi', 121.2, 14.6, 3, 1],
    // 天竺
    ['加兹尼', 'ghazni', 68.42, 33.55, 7, 1], ['拉合尔', 'ghazni', 74.33, 31.55, 9], ['木尔坦', 'ghazni', 71.47, 30.2, 5],
    ['菲鲁兹库赫', 'ghor', 64.5, 34.4, 4, 1],
    ['阿杰梅尔', 'rajput', 74.64, 26.45, 7, 1], ['德里', 'rajput', 77.2, 28.6, 8], ['乌贾因', 'rajput', 75.78, 23.18, 7], ['安希尔瓦拉', 'rajput', 72.1, 23.85, 7],
    ['曲女城', 'gahad', 79.9, 27.05, 10, 1], ['贝拿勒斯', 'gahad', 82.97, 25.32, 8],
    ['高达', 'pala', 88.13, 24.87, 9, 1], ['羯陵伽', 'pala', 85.8, 20.3, 6],
    ['卡利亚尼', 'chalukya', 76.95, 17.88, 9, 1], ['德瓦吉里', 'chalukya', 75.2, 19.95, 6], ['瓦朗加尔', 'chalukya', 79.6, 18.0, 6], ['果阿', 'chalukya', 74.0, 15.4, 5],
    ['坦焦尔', 'chola', 79.13, 10.79, 10, 1], ['甘吉', 'chola', 79.7, 12.83, 8], ['马拉巴尔', 'chola', 75.8, 11.2, 5],
    ['波隆纳鲁瓦', 'lanka', 81.0, 7.94, 6, 1],
    // 中亚 波斯
    ['梅尔夫', 'seljuk', 61.83, 37.66, 10, 1], ['内沙布尔', 'seljuk', 58.8, 36.2, 9], ['赫拉特', 'seljuk', 62.2, 34.35, 8], ['赖伊', 'seljuk', 51.43, 35.6, 9],
    ['伊斯法罕', 'seljuk', 51.67, 32.65, 10], ['哈马丹', 'seljuk', 48.5, 34.8, 6], ['设拉子', 'seljuk', 52.53, 29.6, 7], ['克尔曼', 'seljuk', 57.08, 30.28, 5],
    ['巴尔赫', 'seljuk', 66.9, 36.76, 7], ['大不里士', 'seljuk', 46.3, 38.08, 7], ['尸罗夫', 'seljuk', 52.6, 27.8, 4], ['忽鲁谟斯', 'seljuk', 56.5, 27.1, 4],
    ['玉龙杰赤', 'khwarazm', 59.15, 42.3, 8, 1], ['阿模里', 'khwarazm', 63.6, 39.1, 3],
    // 阿拉伯
    ['巴格达', 'abbasid', 44.4, 33.3, 14, 1], ['巴士拉', 'abbasid', 47.8, 30.5, 8], ['库法', 'abbasid', 44.4, 32.0, 5],
    ['摩苏尔', 'zengid', 43.13, 36.34, 8, 1], ['阿勒颇', 'zengid', 37.16, 36.2, 8], ['大马士革', 'seljuk', 36.30, 33.51, 9],
    ['开罗', 'fatimid', 31.24, 30.04, 15, 1], ['亚历山大', 'fatimid', 29.92, 31.2, 9], ['阿斯旺', 'fatimid', 32.9, 24.09, 4], ['艾伊扎布', 'fatimid', 35.5, 22.3, 3], ['库斯', 'fatimid', 32.8, 26.6, 4],
    ['麦加', 'hejaz', 39.83, 21.42, 6, 1], ['麦地那', 'hejaz', 39.6, 24.47, 5],
    ['亚丁', 'yemen', 45.0, 12.8, 5, 1], ['萨那', 'yemen', 44.2, 15.35, 5],
    ['苏哈尔', 'oman', 56.7, 24.35, 4, 1], ['马斯喀特', 'oman', 58.5, 23.0, 3],
    ['耶路撒冷', 'crusader', 35.21, 31.77, 7, 1], ['安条克', 'crusader', 35.9, 35.6, 6], ['埃德萨', 'crusader', 38.8, 37.15, 5],
    ['科尼亚', 'rum', 32.48, 37.87, 7, 1], ['开塞利', 'rum', 35.48, 38.72, 5], ['锡瓦斯', 'rum', 37.0, 39.75, 5], ['安卡拉', 'rum', 32.85, 39.93, 5],
    // 拂菻 高加索
    ['君士坦丁堡', 'byz', 28.98, 41.01, 16, 1], ['塞萨洛尼基', 'byz', 22.94, 40.64, 8], ['士麦那', 'byz', 27.14, 38.42, 6], ['阿塔利亚', 'byz', 30.7, 36.9, 5],
    ['特拉布宗', 'byz', 39.72, 41.0, 5], ['雅典', 'byz', 23.73, 37.98, 5], ['都拉斯', 'byz', 19.45, 41.32, 4], ['索非亚', 'byz', 23.32, 42.7, 5],
    ['锡诺普', 'byz', 35.15, 42.02, 4], ['尼科西亚', 'byz', 33.36, 35.17, 4], ['坎迪亚', 'byz', 25.13, 35.34, 4], ['尼西亚', 'byz', 30.04, 39.55, 5],
    ['第比利斯', 'georgia', 44.79, 41.72, 7, 1], ['库塔伊西', 'georgia', 42.7, 42.27, 4],
    // 东欧 草原
    ['基辅', 'rus', 30.52, 50.45, 10, 1], ['诺夫哥罗德', 'rus', 31.27, 58.52, 8], ['弗拉基米尔', 'rus', 40.4, 56.13, 7], ['斯摩棱斯克', 'rus', 32.04, 54.78, 6],
    ['加利奇', 'rus', 24.7, 49.1, 6], ['梁赞', 'rus', 39.7, 54.6, 5], ['波洛茨克', 'rus', 28.8, 55.5, 5], ['切尔尼戈夫', 'rus', 31.3, 51.9, 6], ['普斯科夫', 'rus', 28.3, 57.8, 4],
    ['钦察大帐', 'cuman', 38.5, 48.0, 5, 1], ['东钦察', 'cuman', 52.0, 50.0, 4], ['康里', 'cuman', 61.0, 49.0, 4], ['阿速', 'cuman', 44.0, 44.5, 3],
    ['比勒尔', 'bulgar', 50.4, 54.95, 7, 1], ['苏瓦尔', 'bulgar', 48.5, 54.0, 3],
    ['埃斯泰尔戈姆', 'hungary', 18.74, 47.79, 8, 1], ['佩奇', 'hungary', 18.2, 46.07, 4], ['克卢日', 'hungary', 23.6, 46.77, 4],
    ['克拉科夫', 'poland', 19.94, 50.06, 7, 1], ['格涅兹诺', 'poland', 17.6, 52.53, 5], ['普沃茨克', 'poland', 19.7, 52.55, 4],
    // 西欧
    ['法兰克福', 'hre', 8.68, 50.11, 7, 1], ['科隆', 'hre', 6.96, 51.2, 8], ['维也纳', 'hre', 16.37, 48.2, 6], ['米兰', 'hre', 9.19, 45.46, 10],
    ['布拉格', 'hre', 14.42, 50.08, 7], ['马格德堡', 'hre', 11.63, 52.13, 6], ['汉堡', 'hre', 10.0, 53.55, 5], ['纽伦堡', 'hre', 11.08, 49.45, 5], ['苏黎世', 'hre', 8.5, 47.3, 4],
    ['巴黎', 'france', 2.35, 48.86, 12, 1], ['图卢兹', 'france', 1.44, 43.6, 7], ['里昂', 'hre', 4.83, 45.76, 6], ['波尔多', 'france', -0.58, 44.84, 6], ['兰斯', 'france', 4.03, 49.26, 5], ['南特', 'france', -1.55, 47.2, 4],
    ['伦敦', 'england', -0.13, 51.51, 9, 1], ['约克', 'england', -1.08, 53.96, 5], ['鲁昂', 'england', 1.1, 49.44, 6], ['温切斯特', 'england', -1.9, 51.0, 4],
    ['爱丁堡', 'scotland', -3.19, 55.95, 4, 1], ['都柏林', 'ireland', -6.26, 53.35, 4, 1],
    ['托莱多', 'castile', -4.02, 39.86, 7, 1], ['莱昂', 'castile', -5.57, 42.6, 6], ['布尔戈斯', 'castile', -3.4, 42.0, 5],
    ['科英布拉', 'portugal', -8.43, 40.2, 5, 1],
    ['萨拉戈萨', 'aragon', -0.88, 41.65, 6, 1], ['巴塞罗那', 'aragon', 2.17, 41.39, 7],
    ['马拉喀什', 'almoravid', -7.99, 31.63, 9, 1], ['科尔多瓦', 'almoravid', -4.78, 37.88, 11], ['非斯', 'almoravid', -5.0, 34.03, 8], ['格拉纳达', 'almoravid', -3.0, 37.18, 6], ['塞维利亚', 'almoravid', -6.3, 37.0, 7], ['特莱姆森', 'almoravid', -1.32, 34.88, 5], ['巴伦西亚', 'almoravid', -0.4, 39.4, 6],
    ['马赫迪耶', 'zirid', 11.06, 35.5, 6, 1], ['贝贾亚', 'zirid', 5.07, 36.75, 5], ['的黎波里', 'zirid', 13.18, 32.9, 4],
    ['巴勒莫', 'sicily', 13.36, 38.12, 9, 1], ['那不勒斯', 'sicily', 14.27, 40.85, 7], ['巴里', 'sicily', 16.87, 41.12, 5],
    ['罗马', 'papal', 12.5, 41.9, 7, 1], ['威尼斯', 'venice', 12.34, 45.44, 8, 1], ['拉古萨', 'byz', 18.11, 42.64, 3],
    ['罗斯基勒', 'denmark', 12.08, 55.64, 5, 1], ['隆德', 'denmark', 13.2, 55.7, 3],
    ['乌普萨拉', 'sweden', 17.64, 59.86, 5, 1], ['卑尔根', 'norway', 5.32, 60.39, 4, 1], ['奥斯陆', 'norway', 10.75, 59.91, 3],
    ['栋古拉', 'nubia', 30.48, 18.2, 4, 1], ['拉利贝拉', 'abyssinia', 39.05, 12.03, 5, 1], ['阿克苏姆', 'abyssinia', 38.7, 14.1, 4],
  ];
  const CITIES = C.map(a => ({ name: a[0], f: a[1], lon: a[2], lat: a[3], pop: a[4], cap: !!a[5] }));

  // ---------- 兵种 ----------
  const UNITS = {
    inf: { name: '步卒', atk: 8, def: 11, mv: 3, prod: 8, gold: 15, man: 5, food: 1, desc: '枪盾步阵，克骑兵' },
    bow: { name: '弓弩', atk: 11, def: 9, mv: 3, prod: 9, gold: 20, man: 5, food: 1, desc: '弓弩手，克步卒' },
    cav: { name: '骑兵', atk: 13, def: 8, mv: 5, prod: 11, gold: 30, man: 5, food: 2, horse: 3, desc: '轻骑，克弓弩与砲车' },
    hbow: { name: '弓骑', atk: 12, def: 8, mv: 5, prod: 11, gold: 26, man: 5, food: 2, horse: 3, nomad: true, desc: '游牧弓骑，克步卒' },
    hcav: { name: '甲骑', atk: 17, def: 13, mv: 4, prod: 18, gold: 50, man: 6, food: 2, horse: 3, iron: 2, tech: 'jiaqi', desc: '人马俱甲的重骑' },
    elite: { name: '背嵬军', atk: 19, def: 16, mv: 4, prod: 22, gold: 70, man: 6, food: 2, horse: 3, iron: 2, tech: 'beiwei', desc: '岳家军精锐亲兵' },
    siege: { name: '砲车', atk: 5, def: 4, mv: 2, prod: 12, gold: 25, man: 3, food: 1, siege: 3, desc: '攻城器械，破城防' },
    fire: { name: '火器营', atk: 17, def: 15, mv: 3, prod: 17, gold: 45, man: 5, food: 1, iron: 2, tech: 'tuhuoqiang', desc: '突火枪与火药兵' },
    navy: { name: '舟师', atk: 5, def: 6, sea: 16, mv: 6, prod: 14, gold: 30, man: 4, food: 1, tech: 'haichuan', needDock: true, desc: '战船，可载军渡海' },
  };
  // 按交战目标格取值。defBow 仅限守军弓营，siege 列只在野战生效；缺省为一倍。
  const TERRAIN_COMBAT = {
    groups: { cav: 'cav', hbow: 'cav', hcav: 'cav', elite: 'cav', inf: 'inf', bow: 'bow', fire: 'fire', siege: 'siege', navy: 'navy' },
    byTerrain: {
      PLAIN: { cav: 1.10 },
      STEPPE: { cav: 1.15 },
      HILL: { cav: 0.90, defBow: 1.15, siege: 0.80 },
      MTN: { cav: 0.70, inf: 1.10, defBow: 1.15, siege: 0.60 },
      FOREST: { cav: 0.75, inf: 1.10, bow: 0.90, siege: 0.70 },
      JUNGLE: { cav: 0.70, inf: 1.10, bow: 0.85, fire: 0.85, siege: 0.70 },
      PLATEAU: { cav: 0.90, siege: 0.80 },
    },
    highGround: { from: ['HILL', 'MTN'], to: ['PLAIN', 'STEPPE', 'DESERT'], mult: 1.10 },
    crossing: { att: 0.85, def: 1.15 },
    landing: { mult: 0.75, skillRelief: 0.50 },
    water: { riverNavy: 0.80, landNavy: 0.50, embarked: 0.30 },
    skills: { roughDefense: 1.30, waterBattle: 1.40 },
    expedition: {
      enabled: true, // 关闭即恢复原有境外沙漠的固定损耗。
      rates: { DESERT: 0.03, JUNGLE: 0.03, TUNDRA: 0.03, MTN: 0.01 },
      jungleCultures: ['viet', 'cham', 'khmer', 'burmese', 'filipino', 'indian'],
    },
  };
  // 克制：a 克 b
  const BEATS = {
    inf: ['cav', 'hbow'], bow: ['inf', 'siege'], cav: ['bow', 'siege', 'hbow'], hbow: ['inf', 'siege'],
    hcav: ['inf', 'bow', 'siege'], elite: ['inf', 'bow', 'cav', 'hbow', 'siege'], fire: ['cav', 'hcav', 'inf', 'hbow'], siege: [], navy: [],
  };
  const CULTURE_UNIT_NAME = {
    han: { inf: '步卒', bow: '神臂弩手', cav: '游奕骑', hbow: '弓马军', hcav: '具装骑',
      elite: '背嵬军', siege: '砲车', fire: '火器营', navy: '舟师' },
    jurchen: { inf: '女真步军', bow: '强弓手', cav: '拐子马', hbow: '射骑军', hcav: '铁浮屠',
      elite: '合扎亲军', siege: '行砲军', fire: '震雷军', navy: '战舸' },
    tangut: { inf: '步跋子', bow: '硬弓军', cav: '擒生骑', hbow: '弓马军', hcav: '铁鹞子',
      elite: '御围军', siege: '泼喜军', fire: '火铳军', navy: '河曲舟军' },
    mongol: { inf: '签军', bow: '手弩营', cav: '探马赤军', hbow: '蒙古弓骑', hcav: '怯薛',
      elite: '宿卫军', siege: '回回砲', fire: '火砲军', navy: '渡江舟师' },
    khitan: { inf: '契丹步军', bow: '长弓队', cav: '斥候骑', hbow: '属珊骑', hcav: '铁林军',
      elite: '皮室军', siege: '攻城砲', fire: '火药营', navy: '河防水军' },
    tibetan: { inf: '蕃兵', bow: '山弓手', cav: '高原轻骑', hbow: '马弓手', hcav: '铁札骑',
      elite: '赞普亲军', siege: '山砲营', fire: '火管队', navy: '渡河舟兵' },
    bai: { inf: '大理步军', bow: '白弩手', cav: '游哨骑', hbow: '弓马手', hcav: '重甲骑',
      elite: '都府亲军', siege: '抛石架', fire: '火药军', navy: '湖上舟队' },
    korean: { inf: '长枪军', bow: '弓手', cav: '神骑军', hbow: '骑射手', hcav: '别武甲骑',
      elite: '三别抄', siege: '城砲军', fire: '火器都', navy: '海上船军' },
    japanese: { inf: '武士', bow: '弓武士', cav: '早马骑', hbow: '骑射武士', hcav: '甲胄骑',
      elite: '御家人', siege: '攻城车', fire: '火器众', navy: '水军众' },
    viet: { inf: '长矛兵', bow: '强弩手', cav: '哨骑', hbow: '弓骑队', hcav: '象兵',
      elite: '禁卫军', siege: '石砲车', fire: '火铳手', navy: '交趾战船' },
    cham: { inf: '持盾兵', bow: '林弓手', cav: '巡哨骑', hbow: '骑射队', hcav: '象兵',
      elite: '王卫军', siege: '砲车队', fire: '火管手', navy: '占城舟师' },
    khmer: { inf: '长矛军', bow: '密林弓手', cav: '趋骑军', hbow: '弓马队', hcav: '象兵',
      elite: '吴哥卫军', siege: '石砲车', fire: '火药营', navy: '湖舟军' },
    burmese: { inf: '持枪卒', bow: '山地弓手', cav: '游骑军', hbow: '马背弓手', hcav: '象兵',
      elite: '宫门卫军', siege: '攻寨砲车', fire: '火器手', navy: '江上舟队' },
    indian: { inf: '长矛队', bow: '竹弓手', cav: '轻骑', hbow: '弓骑', hcav: '象兵',
      elite: '王帐卫士', siege: '投石机', fire: '火药营', navy: '洋舶军' },
    turkic: { inf: '矛盾兵', bow: '弓手', cav: '游牧轻骑', hbow: '骑射手', hcav: '马穆鲁克',
      elite: '苏丹卫队', siege: '牵引砲', fire: '火铳队', navy: '海船队' },
    persian: { inf: '矛阵步军', bow: '长弓手', cav: '传骑', hbow: '弓马手', hcav: '重甲骑',
      elite: '王家卫队', siege: '投石架', fire: '火药队', navy: '波斯舟师' },
    arab: { inf: '持矛步军', bow: '弓手', cav: '贝都因骑', hbow: '骑射手', hcav: '马穆鲁克',
      elite: '苏丹亲卫', siege: '抛石砲', fire: '火器队', navy: '大食海军' },
    greek: { inf: '盾矛步兵', bow: '弓手', cav: '侦骑', hbow: '弓骑队', hcav: '具装骑兵',
      elite: '瓦兰吉卫', siege: '投石机', fire: '火器队', navy: '桨战船' },
    georgian: { inf: '山地枪兵', bow: '山弓手', cav: '侦哨轻骑', hbow: '弓马骑', hcav: '阿兹甲骑',
      elite: '王室卫队', siege: '石弹砲', fire: '火药营', navy: '黑海舟军' },
    rus: { inf: '持矛兵', bow: '步射手', cav: '游骑兵', hbow: '弓骑手', hcav: '亲兵队',
      elite: '王公卫队', siege: '投石车', fire: '火铳手', navy: '内河舟师' },
    cuman: { inf: '扈从步兵', bow: '短弓兵', cav: '轻帐骑', hbow: '钦察弓骑', hcav: '甲胄骑',
      elite: '汗帐亲兵', siege: '拖砲营', fire: '火药队', navy: '河防舟队' },
    magyar: { inf: '枪盾步兵', bow: '长弓营', cav: '马札儿骑', hbow: '游弓骑', hcav: '重甲骑',
      elite: '宫卫骑士', siege: '砲架营', fire: '火铳手', navy: '多瑙舟军' },
    polish: { inf: '盾矛兵', bow: '弓手', cav: '边地游骑', hbow: '骑弓手', hcav: '波兰骑士',
      elite: '公爵亲卫', siege: '石弹车', fire: '火器营', navy: '河上舟队' },
    german: { inf: '矛盾步兵', bow: '弩手', cav: '侍从轻骑', hbow: '弓骑兵', hcav: '帝国骑士',
      elite: '条顿骑士', siege: '抛石机', fire: '火铳手', navy: '桨船队' },
    frankish: { inf: '长矛步兵', bow: '弓弩手', cav: '侍从骑', hbow: '弓骑手', hcav: '披甲骑士',
      elite: '圣殿骑士', siege: '配重砲', fire: '火器队', navy: '战桨船' },
    english: { inf: '枪矛兵', bow: '长弓手', cav: '哨骑', hbow: '骑弓手', hcav: '披甲骑士',
      elite: '御前骑士', siege: '抛石机', fire: '火铳兵', navy: '王家舟军' },
    iberian: { inf: '持盾步兵', bow: '弩手', cav: '边疆轻骑', hbow: '弓骑手', hcav: '重铠骑士',
      elite: '圣地骑士', siege: '石弹砲', fire: '火器营', navy: '桨战船' },
    moorish: { inf: '步矛队', bow: '安达卢弓', cav: '驰突轻骑', hbow: '弓马骑', hcav: '甲胄骑',
      elite: '宫卫精军', siege: '抛石车', fire: '火铳队', navy: '海峡战船' },
    italian: { inf: '持枪步兵', bow: '弩手', cav: '轻矛骑', hbow: '弓骑手', hcav: '披甲骑士',
      elite: '城邦禁卫', siege: '配重投砲', fire: '火器队', navy: '桨帆战舰' },
    norse: { inf: '持斧卫士', bow: '弓手', cav: '巡地轻骑', hbow: '马弓手', hcav: '锁甲骑',
      elite: '王帐侍卫', siege: '砲石车', fire: '火铳队', navy: '北海长船' },
    ethiopian: { inf: '高地枪兵', bow: '山地弓手', cav: '哨马骑', hbow: '弓骑手', hcav: '甲盾骑',
      elite: '王庭亲卫', siege: '投石架', fire: '火器手', navy: '湖河舟师' },
    filipino: { inf: '持矛武士', bow: '竹弓手', cav: '侦骑', hbow: '弓骑队', hcav: '甲胄骑',
      elite: '首领近卫', siege: '攻寨砲', fire: '火铳队', navy: '巴朗盖舟' },
  };
  const NOMAD = { mongol: 1, cuman: 1, khitan: 1, tangut: 1, jurchen: 1, turkic: 1 };

  // ---------- 建筑 ----------
  const BUILDINGS = {
    walls: { name: '城墙', prod: 55, desc: '城防 +40' },
    farm: { name: '圩田', prod: 45, tech: 'weitian', desc: '粮 +3（临河再 +2）' },
    granary: { name: '常平仓', prod: 50, tech: 'changping', desc: '粮 +2，民心 +5，免饥荒' },
    market: { name: '草市', prod: 50, desc: '钱 +25%' },
    shibosi: { name: '市舶司', prod: 80, tech: 'zhinanzhen', coastal: true, desc: '钱 +3，可开海贸航线 1 条' },
    smithy: { name: '冶铁务', prod: 65, tech: 'yetie', desc: '工 +3，铁 +1/季' },
    academy: { name: '书院', prod: 55, tech: 'shuyuan', desc: '文 +3，民心 +2，科举多一名候选' },
    barracks: { name: '军营', prod: 55, tech: 'lianbing', desc: '征兵工耗 -25%，新兵士气 +10' },
    temple: { name: '寺观', prod: 40, desc: '民心 +8' },
    dock: { name: '船坞', prod: 55, coastal: true, tech: 'haichuan', desc: '可造舟师' },
    stable: { name: '马监', prod: 55, desc: '马 +2/季' },
    workshop: { name: '官窑织造', prod: 75, desc: '钱 +4，海贸收益 +20%' },

    shecang: { name: '社仓', prod: 75, tech: 'shecang', needB: 'granary', minPop: 5,
      desc: '粮 +3，民心 +3', eff: { food: 3, happy: 3 } },
    yanqu: { name: '堰渠', prod: 75, tech: 'tangyan', needB: 'farm', river: true, minPop: 5,
      desc: '临河粮 +5', eff: { food: 3, riverFood: 2 } },
    haitang: { name: '海塘', prod: 85, tech: 'haitang', needB: 'farm', coastal: true, minPop: 7,
      desc: '港口粮 +5，民心 +2', eff: { food: 3, coastFood: 2, happy: 2 } },
    duliaochang: { name: '都料场', prod: 70, tech: 'yingzao', needB: 'smithy',
      desc: '工 +3，钱 +1', eff: { prod: 3, gold: 1 } },
    jingyechang: { name: '精冶场', prod: 105, tech: 'jingye', needB: 'duliaochang', minPop: 8,
      desc: '工 +3，铁 +2/季', eff: { prod: 3, iron: 2 } },
    dujiaochang: { name: '都教场', prod: 75, tech: 'junzheng', needB: 'barracks', minPop: 6,
      desc: '征兵工耗 -15%，城防 +20，民心 +2', eff: { recruitCost: 0.15, wall: 20, happy: 2 } },
    wengcheng: { name: '瓮城', prod: 100, tech: 'wengcheng', needB: 'walls', minPop: 9,
      desc: '城防 +40，民心 +4，钱 +1', eff: { wall: 40, happy: 4, gold: 1 } },
    zhenshi: { name: '镇市', prod: 75, tech: 'shiyi', needB: 'market', minPop: 6,
      desc: '钱 +5，本城钱产 +15%', eff: { gold: 5, goldPct: 0.15 } },
    jiaoyinpu: { name: '交引铺', prod: 105, tech: 'yanchao', needB: 'zhenshi', minPop: 8, only: ['song', 'jin', 'xia', 'goryeo', 'daviet'],
      desc: '钱 +7，本城钱产 +18%，限宋、金、西夏、高丽、交趾', eff: { gold: 7, goldPct: 0.18 } },
    zhouxue: { name: '州学', prod: 80, tech: 'zhoukuan', needB: 'academy', minPop: 7,
      desc: '文 +4，民心 +2', eff: { sci: 4, happy: 2 } },
    taixue: { name: '太学', prod: 120, tech: 'taixue', needB: 'zhouxue', capital: true, minPop: 10,
      desc: '文 +7，民心 +3', eff: { sci: 7, happy: 3 } },
    haichuanchang: { name: '海船场', prod: 98, tech: 'shuigecang', needB: 'dock', coastal: true, minPop: 7,
      desc: '工 +4，钱 +1，可造舟师', eff: { prod: 4, gold: 1, dock: true } },
    boboyuan: { name: '泊舶院', prod: 112, tech: 'hangcheng', needB: ['shibosi', 'haichuanchang'], coastal: true, minPop: 8,
      desc: '钱 +6，可开海贸航线 1 条，本城海贸 +12%', eff: { gold: 6, tradeSlot: 1, tradePct: 0.12 } },
  };

  // ---------- 科技 ----------
  const ERAS = ['', '中兴', '开海', '万国'];
  const TECHS = {
    zhanchengdao: { name: '占城稻', branch: '农桑', era: 1, cost: 80, desc: '全国粮产 +10%' },
    weitian: { name: '圩田', branch: '农桑', era: 1, cost: 60, desc: '解锁圩田' },
    changping: { name: '常平法', branch: '农桑', era: 1, cost: 120, req: ['weitian'], desc: '解锁常平仓' },
    nongshu: { name: '农书', branch: '农桑', era: 1, cost: 200, req: ['zhanchengdao'], desc: '粮产 +10%，人口增长加快' },
    mianfang: { name: '棉纺', branch: '农桑', era: 1, cost: 280, req: ['nongshu'], desc: '钱 +10%' },
    yetie: { name: '冶铁', branch: '工技', era: 1, cost: 60, desc: '解锁冶铁务' },
    huoyao: { name: '火药', branch: '工技', era: 1, cost: 120, req: ['yetie'], desc: '火器之基' },
    paoche: { name: '霹雳炮', branch: '工技', era: 1, cost: 200, req: ['huoyao'], desc: '砲车攻城 +50%' },
    tuhuoqiang: { name: '突火枪', branch: '工技', era: 1, cost: 340, req: ['paoche'], desc: '解锁火器营' },
    yinshua: { name: '活字印刷', branch: '工技', era: 1, cost: 220, desc: '文 +20%' },
    huochong: { name: '铜火铳', branch: '工技', era: 2, cost: 520, req: ['tuhuoqiang'], desc: '火器营 +40%' },
    shenbigong: { name: '神臂弓', branch: '兵学', era: 1, cost: 80, desc: '弓弩 +25%' },
    lianbing: { name: '练兵法', branch: '兵学', era: 1, cost: 110, desc: '解锁军营，士气恢复加快' },
    jiaqi: { name: '甲骑', branch: '兵学', era: 1, cost: 180, desc: '解锁甲骑' },
    beiwei: { name: '背嵬法', branch: '兵学', era: 1, cost: 280, req: ['lianbing', 'jiaqi'], desc: '解锁背嵬军（仅宋）' },
    chengfang: { name: '城防术', branch: '兵学', era: 1, cost: 150, desc: '城防 +50%' },
    wujing: { name: '武经总要', branch: '兵学', era: 1, cost: 320, req: ['lianbing'], desc: '全军战力 +10%' },
    shuyuan: { name: '书院', branch: '文治', era: 1, cost: 60, desc: '解锁书院' },
    lixue: { name: '理学', branch: '文治', era: 1, cost: 260, req: ['shuyuan'], desc: '民心 +5，文 +10%' },
    kejugaige: { name: '科举改革', branch: '文治', era: 1, cost: 200, req: ['shuyuan'], desc: '每科多录一人' },
    caoyun: { name: '漕运', branch: '文治', era: 1, cost: 180, desc: '军粮消耗 -25%' },
    yichuan: { name: '驿传', branch: '文治', era: 1, cost: 220, desc: '陆路行军 +1' },
    honglu: { name: '鸿胪寺', branch: '文治', era: 1, cost: 150, desc: '外交好感增长加倍，遣使减半' },
    zhinanzhen: { name: '指南针', branch: '航海', era: 1, cost: 80, desc: '解锁市舶司' },
    haichuan: { name: '海船', branch: '航海', era: 1, cost: 120, desc: '解锁船坞与舟师' },
    shuishi: { name: '水师', branch: '航海', era: 1, cost: 260, req: ['haichuan'], desc: '舟师 +40%，航速 +2' },
    yuanyang: { name: '远洋', branch: '航海', era: 2, cost: 420, req: ['zhinanzhen', 'shuishi'], desc: '海贸 +50%，航线不限远近' },

    // 农桑
    shecang: { name: '社仓之法', branch: '农桑', era: 1, cost: 180, req: ['changping'], desc: '解锁社仓' },
    tangyan: { name: '陂塘灌田', branch: '农桑', era: 2, cost: 445, req: ['weitian', 'nongshu'], desc: '粮产 +8%，解锁堰渠', eff: { foodPct: 0.08 } },
    haitang: { name: '海塘修筑', branch: '农桑', era: 2, cost: 580, req: ['tangyan', 'haichuan'], desc: '解锁海塘' },
    canmulue: { name: '蚕桑谱', branch: '农桑', era: 2, cost: 725, req: ['mianfang', 'yinshua'], desc: '钱 +12%', eff: { goldPct: 0.12 } },
    nongsangtupu: { name: '农桑图谱', branch: '农桑', era: 3, cost: 1050, req: ['tangyan', 'canmulue'], desc: '粮产 +8%，增长所需存粮 -8%', eff: { foodPct: 0.08, growth: 0.08 } },
    quanji: { name: '乡里劝农', branch: '农桑', era: 3, cost: 1460, req: ['shecang', 'nongsangtupu'], desc: '粮产 +6%，民心 +2', eff: { foodPct: 0.06, happy: 2 } },
    liangzhong: { name: '良种留储', branch: '农桑', era: 3, cost: 1780, req: ['quanji', 'haitang'], desc: '粮产 +9%，增长所需存粮 -10%', eff: { foodPct: 0.09, growth: 0.10 } },

    // 工技
    yingzao: { name: '营造法式', branch: '工技', era: 1, cost: 215, req: ['yetie'], desc: '解锁都料场' },
    jingye: { name: '精冶法', branch: '工技', era: 2, cost: 455, req: ['yingzao', 'yetie'], desc: '铁 +1/季，解锁精冶场', eff: { iron: 1 } },
    shuilizhuan: { name: '水力转轮', branch: '工技', era: 2, cost: 640, req: ['jingye', 'tangyan'], desc: '工 +12%', eff: { prodPct: 0.12 } },
    huihuipao: { name: '回回砲', branch: '工技', era: 2, cost: 870, req: ['paoche', 'yingzao'], desc: '砲车攻城 +20%', eff: { siegePct: 0.20 } },
    baigong: { name: '百工会造', branch: '工技', era: 3, cost: 1130, req: ['jingye', 'shuilizhuan'], desc: '工 +10%，铁 +1/季', eff: { prodPct: 0.10, iron: 1 } },
    qiyang: { name: '器样通式', branch: '工技', era: 3, cost: 1520, req: ['baigong', 'yinshua'], desc: '工 +8%，文 +4%', eff: { prodPct: 0.08, sciPct: 0.04 } },
    kaogong: { name: '工部程式', branch: '工技', era: 3, cost: 1880, req: ['qiyang', 'huihuipao'], desc: '工 +12%', eff: { prodPct: 0.12 } },

    // 兵学
    junzheng: { name: '军伍簿', branch: '兵学', era: 1, cost: 205, req: ['lianbing'], desc: '军团士气恢复 +1，解锁都教场', eff: { morale: 1 } },
    huojian: { name: '火箭营法', branch: '兵学', era: 2, cost: 600, req: ['huoyao', 'shenbigong'], desc: '弓弩 +10%，火器营 +5%', eff: { unit: { bow: 0.10, fire: 0.05 } } },
    wengcheng: { name: '瓮城制', branch: '兵学', era: 2, cost: 780, req: ['chengfang', 'yingzao'], desc: '城防 +18%，解锁瓮城', eff: { wallPct: 0.18 } },
    jiaye: { name: '甲仗整治', branch: '兵学', era: 3, cost: 1100, req: ['jiaqi', 'jingye', 'junzheng'], desc: '甲骑 +18%，步卒 +8%', eff: { unit: { hcav: 0.18, inf: 0.08 } } },
    jiangtaolue: { name: '将略新编', branch: '兵学', era: 3, cost: 1510, req: ['huojian', 'wujing'], desc: '全军战力 +8%，弓弩另加 7%', eff: { unit: { all: 0.08, bow: 0.07 } } },
    zhenwu: { name: '兵制通纂', branch: '兵学', era: 3, cost: 1840, req: ['jiaye', 'jiangtaolue', 'wengcheng'], desc: '全军战力 +8%，轻骑另加 12%，弓骑另加 10%，城防 +20%', eff: { unit: { all: 0.08, cav: 0.12, hbow: 0.10 }, wallPct: 0.20 } },

    // 文治
    shiyi: { name: '市易法', branch: '文治', era: 1, cost: 245, req: ['honglu'], desc: '钱 +4%，解锁镇市', eff: { goldPct: 0.04 } },
    zhoukuan: { name: '州学课士', branch: '文治', era: 2, cost: 475, req: ['shuyuan', 'yinshua'], desc: '文 +7%，解锁州学', eff: { sciPct: 0.07 } },
    yanchao: { name: '盐钞法', branch: '文治', era: 2, cost: 655, req: ['shiyi', 'mianfang'], desc: '钱 +12%，解锁交引铺', eff: { goldPct: 0.12 } },
    xiangyue: { name: '乡约', branch: '文治', era: 2, cost: 810, req: ['lixue', 'zhoukuan'], desc: '民心 +3', eff: { happy: 3 } },
    taixue: { name: '太学条法', branch: '文治', era: 3, cost: 1100, req: ['zhoukuan', 'kejugaige', 'xiangyue'], desc: '文 +12%，解锁太学', eff: { sciPct: 0.12 } },
    tongzhi: { name: '州县图经', branch: '文治', era: 3, cost: 1450, req: ['taixue', 'yingzao'], desc: '文 +8%，民心 +2', eff: { sciPct: 0.08, happy: 2 } },
    liangce: { name: '钱谷会计', branch: '文治', era: 3, cost: 1900, req: ['yanchao', 'tongzhi'], desc: '钱 +14%，民心 +2', eff: { goldPct: 0.14, happy: 2 } },

    // 航海
    gangxu: { name: '海舶市例', branch: '航海', era: 1, cost: 210, req: ['zhinanzhen'], desc: '海贸 +7%', eff: { tradePct: 0.07 } },
    shuigecang: { name: '水密隔舱', branch: '航海', era: 2, cost: 485, req: ['haichuan', 'gangxu'], desc: '舟师 +10%，解锁海船场', eff: { unit: { navy: 0.10 } } },
    qianxing: { name: '牵星术', branch: '航海', era: 2, cost: 660, req: ['shuigecang', 'zhinanzhen'], desc: '航速 +1', eff: { seaMP: 1 } },
    hangcheng: { name: '海舶程簿', branch: '航海', era: 2, cost: 850, req: ['qianxing', 'yuanyang'], desc: '海贸 +8%，解锁泊舶院', eff: { tradePct: 0.08 } },
    jinhaidu: { name: '海舶护航', branch: '航海', era: 3, cost: 1370, req: ['qianxing', 'huojian', 'caoyun'], desc: '舟师 +15%，军粮消耗 -12%', eff: { unit: { navy: 0.15 }, supply: 0.12 } },
    sihai: { name: '四海舆程', branch: '航海', era: 3, cost: 1900, req: ['hangcheng', 'jinhaidu', 'yichuan'], desc: '航速 +1，陆路行军 +0.6，海贸 +10%', eff: { seaMP: 1, landMP: 0.60, tradePct: 0.10 } },
  };
  const START_TECH = {
    song: ['weitian', 'yetie', 'huoyao', 'shenbigong', 'shuyuan', 'zhinanzhen', 'haichuan'],
    jin: ['weitian', 'yetie', 'jiaqi', 'shuyuan', 'lianbing'],
    xia: ['yetie', 'jiaqi'], goryeo: ['weitian', 'shuyuan'], japan: ['yetie', 'haichuan'], byz: ['yetie', 'jiaqi', 'chengfang', 'haichuan'],
    seljuk: ['jiaqi', 'yetie'], fatimid: ['haichuan', 'weitian'], venice: ['haichuan', 'zhinanzhen'], sicily: ['haichuan', 'jiaqi'],
    france: ['jiaqi'], hre: ['jiaqi', 'chengfang'], england: ['jiaqi'], crusader: ['jiaqi', 'chengfang'], abbasid: ['shuyuan', 'weitian'],
    chola: ['haichuan'], xiliao: ['jiaqi', 'yetie'], daviet: ['weitian'], khmer: ['weitian'],
  };

  // ---------- 将领 ----------
  // 名, 势力, 生年, 统, 武, 智, 政, 特技, 出仕年(默认生年+20)
  const GEN = [
    ['岳飞', 'song', 1103, 98, 96, 90, 82, '撼山'], ['韩世忠', 'song', 1089, 92, 93, 80, 65, '水战'], ['刘锜', 'song', 1098, 90, 85, 86, 70, '坚守'],
    ['吴璘', 'song', 1102, 88, 84, 84, 72, '守险'], ['张俊', 'song', 1086, 75, 76, 70, 68, '理财'], ['岳云', 'song', 1119, 82, 95, 70, 50, '骁勇'],
    ['张宪', 'song', 1100, 85, 86, 78, 60, '骁勇'], ['牛皋', 'song', 1087, 78, 88, 60, 50, '骁勇'], ['杨再兴', 'song', 1104, 76, 97, 58, 40, '骁勇'],
    ['王贵', 'song', 1100, 80, 78, 70, 60, '坚守'], ['李显忠', 'song', 1109, 84, 86, 72, 60, '铁骑'], ['杨沂中', 'song', 1102, 80, 80, 74, 66, '坚守'],
    ['张浚', 'song', 1097, 72, 55, 80, 85, '治世'], ['赵鼎', 'song', 1085, 40, 30, 85, 92, '治世'], ['秦桧', 'song', 1090, 30, 30, 88, 82, '理财'],
    ['刘光世', 'song', 1089, 70, 70, 62, 60, '守险'], ['王彦', 'song', 1090, 76, 78, 70, 60, '守险'],
    ['虞允文', 'song', 1110, 86, 60, 92, 90, '运筹', 1154], ['辛弃疾', 'song', 1140, 77, 88, 88, 80, '骁勇', 1162], ['陆游', 'song', 1125, 49, 45, 82, 78, '教化', 1154],
    ['朱熹', 'song', 1130, 30, 30, 92, 90, '教化', 1148], ['范成大', 'song', 1126, 40, 30, 85, 90, '劝农', 1154], ['杨万里', 'song', 1127, 30, 30, 84, 85, '教化', 1154],
    ['毕再遇', 'song', 1148, 86, 92, 75, 55, '骁勇', 1168], ['孟珙', 'song', 1195, 94, 88, 90, 82, '攻城', 1215], ['余玠', 'song', 1198, 86, 70, 88, 86, '守险', 1225],
    ['赵葵', 'song', 1186, 84, 78, 82, 75, '坚守', 1210], ['王坚', 'song', 1200, 85, 80, 80, 70, '坚守', 1235], ['文天祥', 'song', 1236, 62, 54, 88, 90, '治世', 1256],
    ['叶适', 'song', 1150, 50, 40, 88, 85, '理财', 1178], ['吴挺', 'song', 1138, 80, 82, 74, 66, '守险', 1160], ['魏胜', 'song', 1120, 80, 85, 70, 55, '骁勇', 1161],
    ['李宝', 'song', 1105, 82, 80, 76, 60, '水战', 1150], ['岳雷', 'song', 1122, 74, 84, 66, 55, '骁勇', 1142], ['张珏', 'song', 1220, 87, 86, 80, 70, '坚守', 1245],
    ['完颜宗弼', 'jin', 1096, 90, 90, 78, 70, '铁骑'], ['韩常', 'jin', 1100, 80, 85, 65, 55, '骁勇'], ['完颜亮', 'jin', 1122, 80, 82, 76, 60, '铁骑'],
    ['完颜雍', 'jin', 1123, 78, 70, 82, 88, '治世'], ['纥石烈志宁', 'jin', 1120, 86, 84, 80, 65, '铁骑'], ['仆散忠义', 'jin', 1118, 85, 82, 80, 70, '铁骑'],
    ['完颜撒离喝', 'jin', 1090, 80, 80, 70, 60, '守险'], ['孔彦舟', 'jin', 1107, 70, 75, 60, 50, '骁勇'], ['李成', 'jin', 1093, 72, 80, 60, 50, '骁勇'],
    ['完颜突合速', 'jin', 1092, 75, 82, 60, 50, '铁骑'], ['完颜陈和尚', 'jin', 1192, 82, 95, 70, 50, '骁勇', 1212], ['完颜合达', 'jin', 1180, 82, 80, 76, 70, '坚守', 1210],
    ['仆散揆', 'jin', 1151, 84, 80, 80, 70, '攻城', 1180], ['耶律楚材', 'jin', 1190, 35, 30, 92, 96, '治世', 1212],
    ['李仁孝', 'xia', 1124, 70, 60, 80, 88, '治世', 1140], ['任得敬', 'xia', 1100, 76, 70, 80, 70, '理财'], ['嵬名察哥', 'xia', 1095, 85, 85, 75, 60, '铁骑'],
    ['合不勒', 'mongol', 1100, 82, 84, 70, 55, '铁骑'], ['俺巴孩', 'mongol', 1110, 78, 80, 70, 55, '铁骑'], ['忽图剌', 'mongol', 1120, 80, 92, 65, 50, '骁勇'],
    ['也速该', 'mongol', 1134, 82, 86, 72, 55, '铁骑', 1152], ['铁木真', 'mongol', 1162, 100, 92, 98, 90, '大汗', 1182], ['木华黎', 'mongol', 1170, 95, 90, 90, 85, '铁骑', 1190],
    ['哲别', 'mongol', 1180, 90, 95, 82, 60, '神射', 1200], ['速不台', 'mongol', 1176, 98, 92, 92, 70, '疾行', 1196], ['者勒蔑', 'mongol', 1170, 85, 88, 75, 60, '骁勇', 1190],
    ['博尔术', 'mongol', 1162, 90, 88, 82, 70, '铁骑', 1185], ['拖雷', 'mongol', 1192, 88, 88, 84, 70, '铁骑', 1210], ['窝阔台', 'mongol', 1186, 82, 78, 84, 85, '治世', 1205],
    ['拔都', 'mongol', 1209, 88, 84, 82, 75, '疾行', 1228], ['蒙哥', 'mongol', 1209, 86, 84, 84, 80, '铁骑', 1228], ['忽必烈', 'mongol', 1215, 88, 80, 92, 95, '治世', 1235],
    ['旭烈兀', 'mongol', 1217, 88, 86, 84, 75, '攻城', 1237], ['伯颜', 'mongol', 1236, 94, 86, 92, 85, '攻城', 1256],
    ['王罕', 'kerait', 1130, 80, 76, 74, 70, '铁骑', 1150], ['太阳汗', 'naiman', 1150, 70, 65, 62, 60, '铁骑', 1170], ['屈出律', 'naiman', 1180, 72, 78, 70, 50, '铁骑', 1200],
    ['耶律大石', 'xiliao', 1087, 95, 88, 92, 88, '铁骑'], ['萧斡里剌', 'xiliao', 1100, 82, 84, 72, 60, '铁骑'], ['耶律夷列', 'xiliao', 1123, 76, 70, 80, 82, '治世'],
    ['金富轼', 'goryeo', 1075, 66, 50, 88, 90, '治世'], ['郑仲夫', 'goryeo', 1106, 80, 85, 62, 45, '骁勇'], ['崔忠献', 'goryeo', 1149, 82, 80, 80, 78, '治世', 1170],
    ['平清盛', 'japan', 1118, 86, 82, 88, 85, '水战'], ['源义朝', 'japan', 1123, 82, 86, 76, 60, '骁勇'], ['源赖朝', 'japan', 1147, 88, 75, 92, 90, '治世', 1165],
    ['源义经', 'japan', 1159, 94, 96, 90, 50, '疾行', 1177], ['木曾义仲', 'japan', 1154, 84, 90, 70, 45, '骁勇', 1172], ['平重盛', 'japan', 1138, 80, 80, 82, 80, '治世', 1156],
    ['苏宪诚', 'daviet', 1102, 78, 72, 80, 76, '治世'], ['杜英武', 'daviet', 1114, 70, 65, 80, 82, '治世'],
    ['苏利耶跋摩二世', 'khmer', 1094, 88, 85, 85, 80, '攻城'], ['阇耶跋摩七世', 'khmer', 1122, 90, 82, 90, 92, '治世', 1145],
    ['阿拉丁·侯赛因', 'ghor', 1110, 82, 86, 70, 55, '骁勇'], ['穆罕默德·古尔', 'ghor', 1149, 88, 86, 84, 75, '疾行', 1170], ['艾巴克', 'ghor', 1150, 84, 88, 74, 70, '攻城', 1180],
    ['普里特维拉贾', 'rajput', 1166, 86, 92, 76, 70, '骁勇', 1185],
    ['桑贾尔', 'seljuk', 1086, 88, 84, 80, 80, '铁骑'], ['阿即思', 'khwarazm', 1098, 82, 80, 82, 76, '铁骑'], ['摩诃末', 'khwarazm', 1169, 76, 74, 70, 70, '', 1190],
    ['札兰丁', 'khwarazm', 1199, 90, 96, 80, 60, '骁勇', 1218],
    ['赞吉', 'zengid', 1085, 88, 86, 80, 70, '攻城'], ['努尔丁', 'zengid', 1118, 90, 84, 86, 88, '治世'], ['希尔库', 'zengid', 1115, 86, 88, 76, 60, '骁勇'],
    ['萨拉丁', 'zengid', 1137, 96, 88, 94, 92, '运筹', 1160],
    ['鲍德温三世', 'crusader', 1130, 82, 82, 76, 70, '坚守', 1145], ['鲍德温四世', 'crusader', 1161, 86, 80, 88, 80, '坚守', 1175], ['雷纳德', 'crusader', 1125, 78, 88, 60, 40, '骁勇', 1145],
    ['约翰二世', 'byz', 1087, 86, 80, 84, 85, '治世'], ['曼努埃尔一世', 'byz', 1118, 88, 88, 82, 80, '铁骑'],
    ['德米特里一世', 'georgia', 1093, 82, 80, 76, 72, '铁骑'], ['塔玛尔', 'georgia', 1160, 80, 60, 90, 92, '治世', 1184],
    ['尤里·多尔戈鲁基', 'rus', 1099, 78, 76, 76, 74, '坚守'], ['安德烈', 'rus', 1111, 82, 84, 78, 76, '运筹'], ['亚历山大·涅夫斯基', 'rus', 1221, 90, 88, 88, 85, '坚守', 1240],
    ['康拉德三世', 'hre', 1093, 78, 80, 70, 70, '运筹'], ['腓特烈一世', 'hre', 1122, 92, 90, 84, 82, '铁骑', 1147], ['腓特烈二世', 'hre', 1194, 84, 76, 96, 92, '治世', 1212],
    ['路易七世', 'france', 1120, 70, 70, 70, 72, '运筹'], ['腓力二世', 'france', 1165, 88, 80, 92, 92, '治世', 1180],
    ['斯蒂芬', 'england', 1092, 72, 78, 60, 60, '坚守'], ['亨利二世', 'england', 1133, 88, 82, 88, 90, '治世', 1150], ['狮心王理查', 'england', 1157, 96, 99, 82, 60, '骁勇', 1175],
    ['阿方索七世', 'castile', 1105, 82, 80, 78, 78, '铁骑'], ['拉蒙·贝伦格尔', 'aragon', 1113, 80, 78, 80, 80, '治世'], ['阿方索·恩里克斯', 'portugal', 1109, 84, 86, 76, 70, '骁勇'],
    ['阿卜杜勒·穆明', 'almoravid', 1094, 88, 82, 86, 86, '铁骑'], ['罗杰二世', 'sicily', 1095, 86, 80, 92, 92, '水战'], ['恩里科·丹多洛', 'venice', 1107, 84, 60, 96, 90, '水战', 1190],
    ['盖萨二世', 'hungary', 1130, 70, 70, 70, 70, '坚守', 1141], ['博莱斯瓦夫四世', 'poland', 1122, 72, 72, 70, 70, '治世'], ['孔查克', 'cuman', 1140, 82, 86, 70, 50, '铁骑', 1165],
    ['瓦尔德马一世', 'denmark', 1131, 84, 82, 80, 80, '水战', 1155], ['纳赛尔', 'abbasid', 1158, 76, 60, 88, 88, '治世', 1180], ['穆克塔菲', 'abbasid', 1096, 70, 60, 80, 82, '治世'],

    // 南宋
    ['王德', 'song', 1087, 84, 90, 66, 55, '骁勇', 1127],
    ['解元', 'song', 1089, 79, 87, 65, 54, '骁勇', 1128],
    ['成闵', 'song', 1094, 79, 85, 64, 54, '坚守', 1131],
    ['邵隆', 'song', 1090, 78, 81, 69, 61, '守险', 1131], // 生年约。
    ['刘子羽', 'song', 1097, 79, 70, 84, 75, '运筹', 1131],
    ['马扩', 'song', 1095, 76, 77, 86, 70, '运筹', 1127],
    ['折彦质', 'song', 1089, 75, 69, 78, 74, '坚守', 1125],
    ['李横', 'song', 1089, 77, 80, 66, 54, '骁勇', 1130],
    ['刘锡', 'song', 1090, 72, 75, 64, 56, '骁勇', 1130], // 生年约。
    ['王庶', 'song', 1080, 75, 65, 80, 69, '运筹', 1130], // 生年约。
    ['关师古', 'song', 1090, 74, 78, 65, 51, '坚守', 1130], // 生年约。
    ['李贵', 'song', 1100, 75, 84, 62, 48, '骁勇', 1135], // 生年约。
    ['徐庆', 'song', 1105, 75, 84, 65, 48, '骁勇', 1130], // 生年约。
    ['董先', 'song', 1101, 78, 82, 64, 52, '坚守', 1133], // 生年约。
    ['傅选', 'song', 1100, 76, 81, 64, 50, '骁勇', 1134], // 生年约。
    ['杨钦', 'song', 1104, 77, 83, 68, 49, '水战', 1135], // 生年约。
    ['寇成', 'song', 1105, 71, 83, 59, 48, '骁勇', 1135], // 生年约。
    ['姚政', 'song', 1105, 73, 83, 60, 50, '骁勇', 1135], // 生年约。
    ['庞荣', 'song', 1110, 69, 80, 58, 45, '骁勇', 1135], // 生年约。
    ['邵云', 'song', 1105, 72, 82, 62, 48, '坚守', 1141], // 生年约。
    ['王友直', 'song', 1126, 76, 82, 69, 52, '骁勇', 1161], // 生年约。
    ['张荣', 'song', 1090, 82, 85, 76, 57, '水战', 1131], // 生年约。
    ['呼延通', 'song', 1104, 73, 86, 62, 49, '骁勇', 1135], // 生年约。
    ['王权', 'song', 1098, 69, 74, 56, 44, '', 1135], // 生年约。
    ['高世则', 'song', 1080, 60, 58, 75, 63, '', 1110], // 生年约。
    ['吴拱', 'song', 1127, 80, 84, 72, 59, '守险', 1152],
    ['郭浩', 'song', 1087, 81, 86, 73, 63, '守险', 1114],
    ['姚仲', 'song', 1101, 75, 80, 62, 54, '守险', 1131], // 生年约。
    ['杨从义', 'song', 1105, 79, 86, 70, 57, '守险', 1131], // 生年约。
    ['田晟', 'song', 1100, 76, 82, 66, 53, '坚守', 1131], // 生年约。
    ['李道', 'song', 1107, 75, 81, 71, 62, '坚守', 1136], // 生年约。
    ['李舜举', 'song', 1110, 70, 79, 63, 53, '骁勇', 1141], // 生年约。
    ['李捧', 'song', 1100, 72, 81, 61, 49, '守险', 1133], // 生年约。
    ['魏杞', 'song', 1121, 55, 45, 84, 82, '治世', 1142],
    ['周必大', 'song', 1126, 50, 41, 89, 93, '治世', 1151],
    ['陈亮', 'song', 1143, 55, 48, 93, 80, '教化', 1193],
    ['张孝祥', 'song', 1132, 58, 41, 88, 86, '教化', 1154],
    ['史浩', 'song', 1106, 58, 45, 89, 91, '治世', 1145],
    ['王十朋', 'song', 1112, 56, 42, 85, 87, '教化', 1157],
    ['魏了翁', 'song', 1178, 55, 43, 88, 88, '教化', 1199],
    ['王刚中', 'song', 1103, 70, 56, 82, 86, '运筹', 1145],
    ['刘章', 'song', 1097, 54, 42, 85, 86, '教化', 1145],
    ['洪迈', 'song', 1123, 51, 42, 91, 84, '教化', 1145],
    ['洪适', 'song', 1117, 59, 48, 86, 88, '治世', 1142],
    ['王淮', 'song', 1126, 58, 43, 86, 88, '理财', 1145],
    ['留正', 'song', 1129, 56, 45, 85, 87, '理财', 1154],
    ['赵汝愚', 'song', 1140, 58, 51, 91, 92, '治世', 1166],
    ['吕祖谦', 'song', 1137, 50, 40, 93, 87, '教化', 1163],
    ['楼钥', 'song', 1137, 55, 44, 85, 89, '治世', 1163],
    ['黄度', 'song', 1138, 60, 44, 84, 86, '治世', 1163],
    ['黄裳', 'song', 1146, 58, 45, 87, 84, '教化', 1169],
    ['杨简', 'song', 1141, 46, 35, 89, 83, '教化', 1169],
    ['陈傅良', 'song', 1137, 55, 42, 89, 87, '教化', 1172],
    ['尤袤', 'song', 1127, 49, 38, 84, 86, '教化', 1148],
    ['陈居仁', 'song', 1129, 55, 47, 80, 85, '理财', 1151],
    ['史弥远', 'song', 1164, 58, 46, 91, 86, '理财', 1187],
    ['杜杲', 'song', 1173, 89, 82, 90, 81, '坚守', 1196],
    ['李庭芝', 'song', 1219, 90, 81, 88, 88, '坚守', 1241],
    ['姜才', 'song', 1230, 88, 90, 79, 57, '骁勇', 1259], // 生年约。
    ['张世杰', 'song', 1230, 89, 89, 78, 65, '水战', 1258], // 生年约。
    ['陆秀夫', 'song', 1236, 60, 51, 86, 90, '治世', 1256],
    ['刘整', 'song', 1212, 86, 88, 82, 57, '水战', 1232],
    ['吕文德', 'song', 1205, 87, 84, 81, 70, '守险', 1230], // 生年约。
    ['吕文焕', 'song', 1220, 83, 83, 74, 60, '坚守', 1240], // 生年约。
    ['范文虎', 'song', 1230, 72, 74, 64, 48, '水战', 1257], // 生年约。
    ['向士璧', 'song', 1210, 83, 77, 84, 82, '守险', 1232],
    ['彭义斌', 'song', 1185, 82, 88, 66, 55, '骁勇', 1218], // 生年约。
    ['吴曦', 'song', 1162, 77, 82, 73, 65, '守险', 1180],
    ['孟宗政', 'song', 1165, 84, 86, 78, 67, '坚守', 1190], // 生年约。
    ['孟璟', 'song', 1190, 78, 82, 71, 63, '坚守', 1212], // 生年约。
    ['曹友闻', 'song', 1190, 87, 87, 84, 77, '守险', 1226], // 生年约。
    ['李芾', 'song', 1220, 83, 79, 81, 79, '坚守', 1240], // 生年约。
    ['马塈', 'song', 1230, 82, 84, 76, 63, '坚守', 1256], // 生年约。
    ['张顺', 'song', 1235, 79, 88, 68, 48, '水战', 1269], // 生年约。
    ['张贵', 'song', 1235, 79, 86, 70, 51, '水战', 1269], // 生年约。
    ['李全', 'song', 1180, 81, 88, 74, 60, '骁勇', 1218], // 生年约。
    ['杨妙真', 'song', 1193, 83, 94, 76, 59, '骁勇', 1218],
    ['陈敏', 'song', 1113, 81, 84, 76, 62, '坚守', 1136],
    ['洪皓', 'song', 1088, 54, 52, 89, 85, '运筹', 1115],
    ['真德秀', 'song', 1178, 55, 40, 90, 89, '教化', 1199],

    // 金
    ['郦琼', 'jin', 1104, 81, 85, 71, 56, '骁勇', 1127],
    ['完颜昂', 'jin', 1078, 78, 80, 73, 71, '铁骑', 1114],
    ['张浩', 'jin', 1091, 75, 59, 85, 89, '理财', 1123],
    ['完颜希尹', 'jin', 1080, 84, 79, 92, 85, '运筹', 1114], // 生年约。
    ['完颜宗干', 'jin', 1093, 80, 74, 85, 87, '治世', 1115],
    ['完颜宗固', 'jin', 1110, 76, 76, 75, 81, '治世', 1135], // 生年约。
    ['完颜宗贤', 'jin', 1090, 76, 80, 73, 69, '铁骑', 1120], // 生年约。
    ['完颜宗本', 'jin', 1110, 69, 70, 72, 74, '治世', 1138], // 生年约。
    ['完颜秉德', 'jin', 1115, 77, 76, 76, 76, '铁骑', 1140], // 生年约。
    ['韩企先', 'jin', 1082, 54, 49, 84, 90, '治世', 1122],
    ['蔡松年', 'jin', 1107, 60, 47, 83, 85, '理财', 1139],
    ['宇文虚中', 'jin', 1079, 55, 52, 89, 83, '教化', 1129],
    ['完颜亨', 'jin', 1136, 74, 80, 67, 66, '铁骑', 1156],
    ['完颜允恭', 'jin', 1146, 65, 66, 75, 81, '教化', 1166],
    ['完颜永济', 'jin', 1168, 61, 59, 65, 65, '', 1188],
    ['完颜璟', 'jin', 1168, 72, 66, 85, 88, '教化', 1189],
    ['完颜珣', 'jin', 1163, 71, 65, 72, 68, '', 1186],
    ['完颜守绪', 'jin', 1198, 75, 72, 76, 77, '坚守', 1224],
    ['完颜承麟', 'jin', 1202, 75, 83, 66, 60, '坚守', 1227], // 生年约。
    ['纥石烈执中', 'jin', 1164, 78, 85, 73, 55, '铁骑', 1184],
    ['术虎高琪', 'jin', 1165, 76, 81, 73, 59, '铁骑', 1185], // 生年约。
    ['完颜承晖', 'jin', 1160, 77, 68, 86, 86, '守险', 1185], // 生年约。
    ['移剌蒲阿', 'jin', 1190, 81, 87, 72, 63, '铁骑', 1215], // 生年约。
    ['武仙', 'jin', 1180, 80, 86, 71, 49, '守险', 1214], // 生年约。
    ['崔立', 'jin', 1190, 66, 77, 65, 43, '', 1220], // 生年约。
    ['徒单镒', 'jin', 1156, 56, 56, 87, 88, '治世', 1173],
    ['胥鼎', 'jin', 1164, 78, 67, 85, 88, '理财', 1185],
    ['张行信', 'jin', 1163, 55, 52, 84, 86, '治世', 1190],
    ['贾益谦', 'jin', 1147, 54, 52, 82, 87, '治世', 1168],
    ['赵秉文', 'jin', 1159, 56, 45, 87, 85, '教化', 1185],
    ['王若虚', 'jin', 1174, 54, 43, 86, 78, '教化', 1197],
    ['元好问', 'jin', 1190, 58, 43, 89, 80, '教化', 1221],
    ['李纯甫', 'jin', 1177, 51, 44, 86, 79, '教化', 1197],
    ['党怀英', 'jin', 1134, 56, 45, 83, 85, '教化', 1170],
    ['任询', 'jin', 1133, 55, 48, 80, 81, '教化', 1154],
    ['赵沨', 'jin', 1150, 55, 45, 81, 80, '教化', 1182], // 生年约。
    ['张万公', 'jin', 1131, 76, 62, 83, 88, '理财', 1155],
    ['夹谷清臣', 'jin', 1133, 83, 82, 80, 74, '铁骑', 1158],
    ['完颜襄', 'jin', 1140, 88, 85, 83, 78, '铁骑', 1158],
    ['完颜纲', 'jin', 1160, 76, 74, 81, 80, '运筹', 1185], // 生年约。

    // 蒙古与后继汗国
    ['术赤', 'mongol', 1182, 87, 88, 78, 70, '铁骑', 1204], // 生年约。
    ['察合台', 'mongol', 1183, 84, 85, 77, 74, '铁骑', 1206],
    ['哈撒儿', 'mongol', 1164, 81, 91, 71, 58, '神射', 1184], // 生年约。
    ['别勒古台', 'mongol', 1165, 82, 91, 72, 59, '骁勇', 1185], // 生年约。
    ['赤老温', 'mongol', 1165, 85, 89, 75, 62, '铁骑', 1189], // 生年约。
    ['忽必来', 'mongol', 1165, 85, 89, 76, 62, '疾行', 1189], // 生年约。
    ['兀良合台', 'mongol', 1201, 90, 91, 85, 73, '疾行', 1221],
    ['阿术', 'mongol', 1227, 90, 89, 85, 69, '水战', 1253],
    ['张柔', 'mongol', 1190, 88, 87, 81, 74, '攻城', 1218],
    ['史天泽', 'mongol', 1202, 89, 83, 89, 90, '治世', 1225],
    ['严实', 'mongol', 1182, 83, 79, 78, 79, '运筹', 1220],
    ['郭侃', 'mongol', 1217, 85, 88, 81, 68, '攻城', 1237],
    ['刘秉忠', 'mongol', 1216, 58, 51, 94, 94, '治世', 1242],
    ['廉希宪', 'mongol', 1231, 78, 62, 89, 92, '治世', 1251],
    ['安童', 'mongol', 1245, 60, 54, 87, 89, '治世', 1265],
    ['郭守敬', 'mongol', 1231, 55, 44, 93, 85, '运筹', 1262],
    ['许衡', 'mongol', 1209, 54, 37, 91, 88, '教化', 1254],
    ['王恂', 'mongol', 1235, 48, 35, 90, 82, '教化', 1262],
    ['王文统', 'mongol', 1218, 58, 49, 90, 88, '理财', 1259],
    ['姚枢', 'mongol', 1201, 58, 45, 91, 90, '教化', 1232],
    ['赵璧', 'mongol', 1220, 77, 68, 86, 85, '运筹', 1245],
    ['董文炳', 'mongol', 1217, 86, 84, 83, 80, '运筹', 1235],
    ['董俊', 'mongol', 1186, 80, 83, 73, 67, '铁骑', 1215],
    ['李璮', 'mongol', 1207, 76, 81, 69, 58, '水战', 1227],
    ['巴而术阿而忒的斤', 'mongol', 1180, 77, 79, 82, 80, '运筹', 1209], // 生年约。
    ['郭宝玉', 'mongol', 1165, 86, 88, 84, 70, '运筹', 1211], // 生年约。
    ['郭德海', 'mongol', 1195, 84, 87, 80, 66, '攻城', 1215], // 生年约。
    ['阿里不哥', 'mongol', 1219, 79, 81, 76, 71, '铁骑', 1245], // 生年约。
    ['贵由', 'mongol', 1206, 82, 83, 77, 72, '铁骑', 1227],
    ['阔端', 'mongol', 1206, 79, 79, 82, 80, '运筹', 1226],
    ['阔出', 'mongol', 1208, 78, 80, 71, 63, '铁骑', 1228], // 生年约。
    ['别儿哥', 'mongol', 1209, 84, 79, 85, 86, '治世', 1236], // 生年约。
    ['昔班', 'mongol', 1208, 87, 86, 78, 72, '疾行', 1236], // 生年约。
    ['合丹', 'mongol', 1212, 85, 88, 74, 62, '疾行', 1236], // 生年约。
    ['拜答儿', 'mongol', 1206, 84, 86, 74, 64, '铁骑', 1236], // 生年约。
    ['海都', 'mongol', 1236, 89, 87, 85, 77, '疾行', 1258],
    ['笃哇', 'mongol', 1255, 84, 86, 81, 79, '铁骑', 1275], // 生年约。
    ['忙哥帖木儿', 'mongol', 1240, 79, 80, 80, 83, '治世', 1266], // 生年约。
    ['乞台不花', 'mongol', 1200, 84, 88, 78, 66, '铁骑', 1251], // 生年约。
    ['阿里海牙', 'mongol', 1227, 87, 85, 85, 79, '攻城', 1258],

    // 东亚与东南亚
    ['李纯祐', 'xia', 1177, 73, 67, 76, 80, '治世', 1193],
    ['李安全', 'xia', 1170, 67, 70, 72, 67, '铁骑', 1190],
    ['李遵顼', 'xia', 1163, 66, 62, 84, 76, '教化', 1183],
    ['李德旺', 'xia', 1181, 71, 71, 75, 69, '坚守', 1201],
    ['李睍', 'xia', 1200, 68, 74, 66, 61, '坚守', 1226], // 生年约。
    ['斡道冲', 'xia', 1120, 58, 43, 84, 86, '教化', 1140],
    ['罗世昌', 'xia', 1210, 56, 47, 76, 80, '教化', 1230], // 生年约。
    ['耶律直鲁古', 'xiliao', 1150, 71, 72, 72, 70, '铁骑', 1177], // 生年约。
    ['耶律普速完', 'xiliao', 1135, 74, 58, 79, 84, '治世', 1163], // 生年约。
    ['萧朵鲁不', 'xiliao', 1130, 74, 76, 71, 64, '铁骑', 1163], // 生年约。
    ['萧朴古只沙里', 'xiliao', 1135, 74, 79, 70, 72, '铁骑', 1170], // 生年约。
    ['段正兴', 'dali', 1120, 72, 65, 77, 81, '治世', 1147], // 生年约。
    ['段智兴', 'dali', 1145, 74, 65, 80, 83, '治世', 1171], // 生年约。
    ['段智祥', 'dali', 1180, 70, 60, 78, 82, '教化', 1205], // 生年约。
    ['段兴智', 'dali', 1230, 68, 65, 73, 69, '守险', 1251], // 生年约。
    ['萨迦班智达', 'tubo', 1182, 50, 36, 91, 87, '教化', 1202],
    ['八思巴', 'tubo', 1235, 55, 38, 90, 86, '教化', 1253],
    ['崔怡', 'goryeo', 1166, 78, 77, 85, 86, '治世', 1196],
    ['李义方', 'goryeo', 1121, 78, 83, 70, 61, '骁勇', 1170],
    ['庆大升', 'goryeo', 1154, 80, 82, 74, 68, '坚守', 1170],
    ['李义旼', 'goryeo', 1120, 76, 88, 61, 49, '骁勇', 1150], // 生年约。
    ['金允侯', 'goryeo', 1195, 84, 82, 80, 62, '坚守', 1232], // 生年约。
    ['金就砺', 'goryeo', 1172, 86, 86, 80, 72, '守险', 1192], // 生年约。
    ['李奎报', 'goryeo', 1168, 51, 37, 89, 82, '教化', 1190],
    ['北条时政', 'japan', 1138, 74, 76, 85, 82, '理财', 1160],
    ['北条义时', 'japan', 1163, 80, 77, 88, 89, '治世', 1180],
    ['北条泰时', 'japan', 1183, 81, 76, 89, 92, '治世', 1203],
    ['北条时宗', 'japan', 1251, 83, 77, 85, 89, '坚守', 1268],
    ['源赖政', 'japan', 1104, 80, 87, 77, 67, '神射', 1125],
    ['熊谷直实', 'japan', 1141, 77, 89, 62, 53, '骁勇', 1160],
    ['梶原景时', 'japan', 1140, 78, 81, 85, 78, '运筹', 1160],
    ['和田义盛', 'japan', 1147, 84, 87, 74, 67, '神射', 1180],
    ['藤原定家', 'japan', 1162, 44, 34, 87, 76, '教化', 1180],
    ['九条兼实', 'japan', 1149, 55, 42, 84, 88, '治世', 1166],
    ['陈守度', 'daviet', 1194, 82, 80, 89, 88, '治世', 1224],
    ['陈国峻', 'daviet', 1228, 96, 88, 92, 83, '守险', 1257], // 生年约。
    ['陈日燏', 'daviet', 1255, 87, 82, 87, 81, '运筹', 1275],
    ['陈光启', 'daviet', 1241, 87, 80, 87, 87, '治世', 1261],
    ['陈庆余', 'daviet', 1240, 85, 84, 79, 69, '水战', 1260], // 生年约。
    ['李英宗', 'daviet', 1136, 67, 66, 77, 78, '治世', 1156],
    ['阇耶诃梨跋摩一世', 'champa', 1110, 83, 82, 78, 76, '骁勇', 1147], // 生年约。
    ['因陀罗跋摩二世', 'khmer', 1180, 75, 69, 79, 80, '治世', 1201], // 生年约。
    ['那罗波帝悉都', 'pagan', 1138, 81, 76, 83, 89, '治世', 1160],
    ['梯罗明罗', 'pagan', 1175, 70, 62, 78, 82, '教化', 1195],

    // 中东、天竺与北非
    ['拜伯尔斯', 'fatimid', 1223, 95, 92, 89, 86, '铁骑', 1240], // 生年约。
    ['忽都思', 'fatimid', 1220, 89, 89, 85, 78, '铁骑', 1250], // 生年约。
    ['艾伯克', 'fatimid', 1197, 78, 83, 78, 73, '铁骑', 1237], // 生年约。
    ['嘉拉温', 'fatimid', 1222, 88, 85, 85, 84, '治世', 1250], // 生年约。
    ['法里斯丁·阿克泰', 'fatimid', 1210, 81, 86, 74, 65, '铁骑', 1240], // 生年约。
    ['阿迪勒一世', 'fatimid', 1145, 85, 80, 90, 90, '治世', 1169],
    ['卡米勒', 'fatimid', 1177, 83, 75, 86, 88, '理财', 1196],
    ['萨利赫·阿尤布', 'fatimid', 1205, 85, 81, 84, 82, '铁骑', 1229],
    ['舍哲尔·杜尔', 'fatimid', 1220, 60, 52, 88, 89, '治世', 1250], // 生年约。
    ['阿迪德', 'fatimid', 1151, 56, 48, 68, 67, '', 1169],
    ['哈菲兹', 'fatimid', 1075, 72, 63, 81, 80, '治世', 1132], // 生年约。
    ['塔莱伊·本·鲁齐克', 'fatimid', 1102, 77, 73, 80, 87, '理财', 1144],
    ['奥萨马·伊本·蒙基兹', 'zengid', 1095, 78, 84, 86, 78, '运筹', 1138],
    ['赛义夫丁·加齐一世', 'zengid', 1110, 79, 80, 77, 75, '铁骑', 1146], // 生年约。
    ['库特布丁·毛杜德', 'zengid', 1120, 78, 77, 78, 79, '运筹', 1149], // 生年约。
    ['伊本·艾西尔', 'zengid', 1160, 52, 39, 91, 81, '教化', 1180],
    ['图格里勒三世', 'seljuk', 1168, 81, 87, 73, 65, '铁骑', 1187],
    ['马苏德', 'seljuk', 1108, 79, 80, 77, 73, '铁骑', 1133],
    ['阿尔斯兰沙', 'seljuk', 1133, 75, 76, 72, 71, '铁骑', 1161],
    ['塔乞失', 'khwarazm', 1144, 86, 83, 84, 80, '铁骑', 1172],
    ['伊尔·阿尔斯兰', 'khwarazm', 1127, 80, 80, 79, 76, '铁骑', 1156],
    ['穆斯坦绥尔', 'abbasid', 1192, 72, 65, 84, 88, '教化', 1226],
    ['穆斯台绥木', 'abbasid', 1213, 62, 57, 72, 67, '', 1242],
    ['穆斯坦吉德', 'abbasid', 1124, 71, 62, 83, 85, '治世', 1160],
    ['穆斯塔迪', 'abbasid', 1142, 66, 59, 80, 81, '教化', 1170],
    ['基利杰阿尔斯兰二世', 'rum', 1115, 88, 87, 85, 83, '守险', 1156],
    ['凯霍斯鲁一世', 'rum', 1168, 82, 84, 79, 76, '铁骑', 1192], // 生年约。
    ['凯卡乌斯一世', 'rum', 1180, 85, 80, 83, 85, '水战', 1211],
    ['凯库巴德一世', 'rum', 1188, 90, 84, 89, 90, '治世', 1211],
    ['凯霍斯鲁二世', 'rum', 1221, 68, 69, 65, 67, '', 1237],
    ['伊勒图特米什', 'ghor', 1192, 89, 87, 86, 91, '治世', 1211],
    ['巴尔班', 'ghor', 1200, 90, 87, 88, 86, '坚守', 1233],
    ['拉齐娅', 'ghor', 1205, 79, 72, 84, 83, '治世', 1236],
    ['纳西鲁丁·马哈茂德', 'ghor', 1229, 67, 56, 75, 80, '教化', 1246],
    ['塔杰丁·伊尔迪兹', 'ghor', 1160, 82, 85, 74, 66, '铁骑', 1185], // 生年约。
    ['纳西鲁丁·卡巴查', 'ghor', 1163, 81, 84, 76, 71, '守险', 1190], // 生年约。
    ['阇耶旃陀罗', 'gahad', 1145, 80, 81, 80, 78, '坚守', 1170], // 生年约。
    ['库洛通伽三世', 'chola', 1160, 87, 82, 84, 84, '水战', 1178], // 生年约。
    ['拉金德拉三世', 'chola', 1215, 82, 79, 76, 73, '坚守', 1246], // 生年约。
    ['波罗迦罗摩婆诃一世', 'lanka', 1123, 89, 82, 90, 92, '劝农', 1140],
    ['毗阇耶婆诃二世', 'lanka', 1150, 63, 52, 83, 80, '教化', 1186], // 生年约。
    ['阿诺德·德·托罗哈', 'crusader', 1122, 75, 79, 80, 77, '运筹', 1142], // 生年约。

    // 欧洲
    ['安德洛尼卡一世', 'byz', 1118, 80, 86, 87, 72, '骁勇', 1140],
    ['约翰·杜卡斯·瓦塔泽斯', 'byz', 1192, 88, 82, 88, 92, '劝农', 1212],
    ['狄奥多尔一世·拉斯卡里斯', 'byz', 1175, 87, 86, 84, 86, '坚守', 1195], // 生年约。
    ['阿莱克修斯·布拉纳斯', 'byz', 1140, 84, 86, 80, 68, '铁骑', 1165], // 生年约。
    ['尼基塔斯·霍尼亚提斯', 'byz', 1155, 51, 39, 90, 83, '教化', 1177], // 生年约。
    ['迈克尔八世·帕列奥列格', 'byz', 1223, 88, 83, 92, 88, '治世', 1243],
    ['狮子亨利', 'hre', 1129, 87, 86, 85, 83, '铁骑', 1147],
    ['美因茨的克里斯蒂安', 'hre', 1130, 80, 76, 86, 84, '运筹', 1160], // 生年约。
    ['条顿骑士团的赫尔曼·冯·萨尔扎', 'hre', 1165, 81, 76, 91, 88, '治世', 1209], // 生年约。
    ['皮耶尔·德拉·维尼亚', 'hre', 1190, 55, 41, 90, 89, '理财', 1220], // 生年约。
    ['奥托四世', 'hre', 1175, 79, 83, 74, 72, '铁骑', 1198],
    ['叙热', 'france', 1081, 57, 38, 88, 92, '治世', 1122],
    ['布朗什', 'france', 1188, 60, 56, 88, 91, '治世', 1200],
    ['路易九世', 'france', 1214, 83, 78, 86, 92, '治世', 1234],
    ['蒙莫朗西的马蒂厄二世', 'france', 1174, 84, 86, 78, 73, '铁骑', 1194], // 生年约。
    ['威廉·马歇尔', 'england', 1146, 91, 95, 89, 87, '铁骑', 1166], // 生年约。
    ['西蒙·德·蒙福尔', 'england', 1208, 86, 85, 89, 85, '运筹', 1231], // 生年约。
    ['托马斯·贝克特', 'england', 1120, 57, 44, 86, 85, '教化', 1142],
    ['罗伯特·格罗斯泰斯特', 'england', 1175, 48, 36, 91, 84, '教化', 1195], // 生年约。
    ['斐迪南三世', 'castile', 1200, 91, 86, 89, 92, '攻城', 1217], // 生年约。
    ['阿方索十世', 'castile', 1221, 72, 67, 93, 89, '教化', 1240],
    ['海梅一世', 'aragon', 1208, 92, 88, 87, 90, '水战', 1225],
    ['彼得三世', 'aragon', 1239, 89, 88, 86, 84, '水战', 1259],
    ['马约内·迪·巴里', 'sicily', 1110, 56, 45, 86, 89, '理财', 1139], // 生年约。
    ['坦克雷德', 'sicily', 1138, 81, 83, 79, 75, '坚守', 1156],
    ['彼得罗·齐亚尼', 'venice', 1153, 76, 67, 85, 91, '水战', 1175], // 生年约。
    ['洛伦佐·提埃波洛', 'venice', 1210, 80, 77, 85, 87, '水战', 1230], // 生年约。
    ['丹尼尔·罗曼诺维奇', 'rus', 1201, 88, 84, 88, 89, '守险', 1219],
    ['弗谢沃洛德三世', 'rus', 1154, 86, 84, 83, 88, '治世', 1176],
    ['贝拉四世', 'hungary', 1206, 80, 76, 88, 92, '治世', 1220],
    ['亨里克二世', 'poland', 1196, 87, 87, 80, 82, '坚守', 1216], // 生年约。

    // 第二批：南宋中后期
    ['冉琎', 'song', 1203, 78, 62, 87, 65, '守险', 1242], // 生年约。
    ['冉璞', 'song', 1207, 76, 64, 86, 66, '运筹', 1242], // 生年约。
    ['王立', 'song', 1238, 80, 79, 80, 72, '坚守', 1275], // 生年约。
    ['王夔', 'song', 1197, 75, 85, 57, 46, '骁勇', 1236], // 生年约。
    ['姚世安', 'song', 1207, 75, 79, 67, 53, '守险', 1245], // 生年约。
    ['杨成', 'song', 1205, 75, 83, 70, 59, '守险', 1245], // 生年约。
    ['昝万寿', 'song', 1228, 85, 83, 76, 67, '坚守', 1258], // 生年约。
    ['杨巨源', 'song', 1170, 78, 81, 81, 64, '守险', 1205], // 生年约。
    ['李好义', 'song', 1175, 83, 88, 74, 63, '疾行', 1205], // 生年约。
    ['赵方', 'song', 1158, 86, 74, 85, 87, '治世', 1181],
    ['赵范', 'song', 1183, 81, 78, 76, 72, '坚守', 1221],
    ['李曾伯', 'song', 1198, 86, 78, 86, 82, '坚守', 1229],
    ['王登', 'song', 1216, 81, 83, 80, 77, '守险', 1246],
    ['高达', 'song', 1210, 87, 87, 80, 60, '坚守', 1240], // 生年约。
    ['贾似道', 'song', 1213, 58, 42, 84, 82, '理财', 1238],
    ['江万里', 'song', 1198, 55, 40, 86, 91, '教化', 1226],
    ['王应麟', 'song', 1223, 48, 36, 93, 88, '教化', 1241],
    ['谢枋得', 'song', 1226, 70, 54, 87, 85, '教化', 1256],
    ['留梦炎', 'song', 1219, 53, 42, 82, 84, '治世', 1244],
    ['姚勉', 'song', 1216, 47, 38, 83, 83, '教化', 1253],
    ['方逢辰', 'song', 1221, 51, 40, 87, 84, '教化', 1250],
    ['文及翁', 'song', 1218, 52, 38, 83, 83, '教化', 1253],
    ['陈宜中', 'song', 1234, 56, 53, 83, 79, '治世', 1262],
    ['程珌', 'song', 1164, 57, 45, 88, 87, '理财', 1193],
    ['袁甫', 'song', 1188, 55, 46, 88, 88, '教化', 1214],
    ['洪咨夔', 'song', 1176, 54, 40, 88, 88, '治世', 1202],
    ['杜范', 'song', 1182, 58, 54, 88, 91, '治世', 1208],
    ['董槐', 'song', 1186, 63, 53, 86, 89, '运筹', 1211],
    ['乔行简', 'song', 1156, 60, 51, 86, 87, '理财', 1193],
    ['郑清之', 'song', 1176, 59, 46, 85, 86, '治世', 1202],
    ['史嵩之', 'song', 1189, 74, 65, 86, 87, '理财', 1220],
    ['林希逸', 'song', 1193, 47, 35, 86, 81, '教化', 1235],
    ['叶梦鼎', 'song', 1200, 56, 43, 84, 87, '治世', 1232],
    ['赵与訔', 'song', 1194, 59, 46, 81, 86, '理财', 1226],

    // 第二批：金与西夏
    ['完颜白撒', 'jin', 1185, 67, 77, 62, 48, '铁骑', 1213], // 生年约。
    ['徒单兀典', 'jin', 1180, 77, 80, 73, 65, '坚守', 1215], // 生年约。
    ['蒲察官奴', 'jin', 1199, 85, 88, 75, 46, '骁勇', 1220], // 生年约。
    ['完颜仲德', 'jin', 1183, 82, 80, 85, 82, '坚守', 1205],
    ['石盏女鲁欢', 'jin', 1183, 82, 83, 76, 65, '坚守', 1214], // 生年约。
    ['完颜赛不', 'jin', 1175, 79, 82, 76, 69, '铁骑', 1205], // 生年约。
    ['完颜斜烈', 'jin', 1185, 83, 88, 71, 55, '骁勇', 1221], // 生年约。
    ['完颜从坦', 'jin', 1185, 76, 77, 71, 60, '坚守', 1214], // 生年约。
    ['完颜庆山奴', 'jin', 1190, 83, 86, 77, 54, '铁骑', 1217], // 生年约。
    ['张天纲', 'jin', 1185, 56, 49, 87, 86, '治世', 1215], // 生年约。
    ['乌古论庆寿', 'jin', 1170, 78, 79, 80, 74, '运筹', 1198], // 生年约。
    ['粘割贞', 'jin', 1160, 55, 56, 83, 84, '治世', 1182], // 生年约。
    ['孙铎', 'jin', 1150, 56, 49, 84, 85, '理财', 1176], // 生年约。
    ['侯挚', 'jin', 1155, 57, 57, 82, 85, '治世', 1180], // 生年约。
    ['完颜弼', 'jin', 1164, 82, 80, 77, 71, '铁骑', 1185],
    ['夹谷石里哥', 'jin', 1150, 81, 84, 74, 63, '铁骑', 1182], // 生年约。
    ['仆散安贞', 'jin', 1170, 86, 82, 80, 77, '攻城', 1195], // 生年约。
    ['纥石烈牙吾塔', 'jin', 1180, 79, 83, 73, 59, '铁骑', 1210], // 生年约。
    ['李德任', 'xia', 1185, 76, 68, 82, 78, '守险', 1223], // 生年约。
    ['高良惠', 'xia', 1180, 60, 57, 85, 86, '治世', 1215], // 生年约。
    ['斡扎箦', 'xia', 1188, 77, 81, 73, 61, '守险', 1218], // 生年约。

    // 第二批：蒙古与元初
    ['郝经', 'mongol', 1223, 57, 40, 90, 87, '教化', 1252],
    ['王鹗', 'mongol', 1190, 58, 45, 89, 89, '教化', 1232],
    ['赛典赤·赡思丁', 'mongol', 1211, 75, 64, 89, 94, '劝农', 1229],
    ['阿合马', 'mongol', 1230, 57, 49, 88, 84, '理财', 1262], // 生年约。
    ['董士选', 'mongol', 1253, 77, 75, 84, 87, '治世', 1269],
    ['董文用', 'mongol', 1224, 70, 63, 86, 90, '理财', 1248],
    ['张弘范', 'mongol', 1238, 91, 88, 86, 74, '水战', 1259],
    ['史格', 'mongol', 1234, 82, 81, 78, 77, '攻城', 1260],
    ['史枢', 'mongol', 1221, 82, 85, 75, 61, '骁勇', 1241],
    ['刘黑马', 'mongol', 1200, 86, 85, 78, 76, '铁骑', 1215],
    ['焦德裕', 'mongol', 1218, 79, 83, 76, 71, '坚守', 1238],
    ['王珣', 'mongol', 1176, 81, 80, 76, 75, '运筹', 1215],
    ['王善', 'mongol', 1184, 80, 85, 72, 68, '骁勇', 1215],
    ['李守贤', 'mongol', 1189, 80, 82, 74, 68, '攻城', 1217],
    ['汪世显', 'mongol', 1195, 85, 87, 82, 75, '守险', 1235],
    ['汪德臣', 'mongol', 1224, 86, 90, 79, 65, '骁勇', 1243],
    ['汪良臣', 'mongol', 1231, 83, 84, 81, 77, '守险', 1252],
    ['阔阔出·帖卜腾格里', 'mongol', 1160, 49, 40, 75, 73, '教化', 1185], // 生年约。
    ['镇海', 'mongol', 1169, 72, 66, 86, 89, '理财', 1203],
    ['塔塔统阿', 'mongol', 1160, 52, 41, 90, 85, '教化', 1204], // 生年约。
    ['绰儿马罕', 'mongol', 1185, 89, 87, 85, 73, '疾行', 1215], // 生年约。
    ['拜住', 'mongol', 1195, 87, 86, 83, 72, '铁骑', 1228], // 生年约。
    ['阔里吉思', 'mongol', 1190, 57, 48, 87, 89, '理财', 1230], // 生年约。
    ['阿儿浑阿合', 'mongol', 1215, 69, 61, 87, 88, '理财', 1243], // 生年约。
    ['阿八哈', 'mongol', 1234, 85, 82, 82, 81, '铁骑', 1256],
    ['孛罗', 'mongol', 1240, 75, 68, 86, 88, '治世', 1260], // 生年约。
    ['那海', 'mongol', 1240, 89, 87, 86, 78, '疾行', 1260], // 生年约。
    ['撒里答', 'mongol', 1225, 82, 80, 79, 78, '铁骑', 1244], // 生年约。
    ['忙哥撒儿', 'mongol', 1200, 78, 78, 81, 81, '运筹', 1228], // 生年约。
    ['锡格图忽都忽', 'mongol', 1180, 80, 78, 88, 90, '治世', 1206], // 生年约。

    // 第二批：东亚、南亚及东南亚
    ['达波拉杰', 'tubo', 1079, 42, 34, 87, 83, '教化', 1100],
    ['札合敢不', 'kerait', 1150, 78, 82, 78, 73, '铁骑', 1170], // 生年约。
    ['桑昆', 'kerait', 1165, 76, 84, 65, 58, '骁勇', 1188], // 生年约。
    ['不亦鲁黑汗', 'naiman', 1150, 78, 83, 73, 66, '铁骑', 1173], // 生年约。
    ['崔沆', 'goryeo', 1209, 64, 66, 71, 69, '', 1230],
    ['金方庆', 'goryeo', 1212, 87, 85, 81, 76, '水战', 1240],
    ['朴犀', 'goryeo', 1180, 84, 84, 80, 72, '坚守', 1220], // 生年约。
    ['赵冲', 'goryeo', 1171, 82, 79, 85, 85, '运筹', 1190],
    ['林衍', 'goryeo', 1215, 79, 85, 73, 62, '骁勇', 1240], // 生年约。
    ['裴仲孙', 'goryeo', 1225, 83, 85, 78, 63, '水战', 1254], // 生年约。
    ['崔滋', 'goryeo', 1188, 51, 39, 87, 85, '教化', 1212],
    ['源实朝', 'japan', 1192, 52, 48, 82, 77, '教化', 1203],
    ['北条重时', 'japan', 1198, 76, 70, 83, 87, '治世', 1217],
    ['北条时赖', 'japan', 1227, 79, 77, 85, 90, '治世', 1246],
    ['安达泰盛', 'japan', 1231, 71, 64, 87, 89, '理财', 1252],
    ['三浦义村', 'japan', 1168, 80, 82, 88, 77, '运筹', 1188],
    ['畠山重忠', 'japan', 1164, 85, 93, 75, 59, '骁勇', 1180],
    ['佐佐木高纲', 'japan', 1160, 84, 88, 77, 64, '疾行', 1180],
    ['大江广元', 'japan', 1148, 59, 47, 91, 92, '治世', 1184],
    ['竹崎季长', 'japan', 1246, 73, 88, 71, 52, '神射', 1266],
    ['陈太宗', 'daviet', 1218, 82, 79, 84, 85, '治世', 1238],
    ['陈圣宗', 'daviet', 1240, 84, 78, 88, 88, '治世', 1258],
    ['陈仁宗', 'daviet', 1258, 85, 76, 89, 91, '教化', 1278],
    ['陈平仲', 'daviet', 1259, 76, 89, 75, 60, '骁勇', 1277],
    ['范五老', 'daviet', 1255, 89, 91, 82, 68, '骁勇', 1279],
    ['阇耶因陀罗跋摩三世', 'champa', 1110, 82, 83, 75, 71, '水战', 1139], // 生年约。
    ['毗底耶难陀那', 'champa', 1170, 86, 87, 80, 71, '水战', 1190], // 生年约。
    ['阇耶跋摩八世', 'khmer', 1205, 73, 67, 78, 81, '坚守', 1230], // 生年约。
    ['迦娑瓦', 'pagan', 1198, 68, 56, 79, 83, '教化', 1235], // 生年约。
    ['乌沙那', 'pagan', 1216, 68, 67, 72, 70, '', 1251], // 生年约。
    ['那罗梯诃波帝', 'pagan', 1238, 62, 69, 66, 67, '', 1256],
    ['巴赫拉姆沙', 'ghazni', 1084, 82, 79, 84, 78, '铁骑', 1117],
    ['霍斯鲁沙', 'ghazni', 1115, 72, 73, 73, 73, '治世', 1152], // 生年约。
    ['霍斯鲁·马立克', 'ghazni', 1135, 76, 79, 75, 73, '坚守', 1160], // 生年约。
    ['加亚斯丁·穆罕默德', 'ghor', 1139, 86, 81, 88, 87, '运筹', 1163],
    ['米纳杰·西拉杰·朱兹贾尼', 'ghor', 1193, 47, 37, 86, 81, '教化', 1227],
    ['维格拉哈拉贾四世', 'rajput', 1128, 86, 84, 82, 80, '攻城', 1150], // 生年约。
    ['索梅什瓦拉', 'rajput', 1140, 78, 77, 73, 75, '铁骑', 1169], // 生年约。
    ['哥文达旃陀罗', 'gahad', 1094, 84, 76, 83, 87, '治世', 1114], // 生年约。
    ['毗阇耶旃陀罗', 'gahad', 1125, 81, 79, 80, 79, '坚守', 1155], // 生年约。
    ['摩陀那波罗', 'pala', 1120, 75, 75, 75, 76, '坚守', 1144], // 生年约。
    ['哥文达波罗', 'pala', 1135, 72, 70, 71, 75, '治世', 1161], // 生年约。
    ['拉克什曼纳·塞纳', 'pala', 1119, 81, 75, 83, 86, '教化', 1178], // 生年约。
    ['阇伽德迦马罗二世', 'chalukya', 1105, 76, 75, 74, 79, '铁骑', 1138], // 生年约。
    ['泰拉三世', 'chalukya', 1120, 72, 73, 69, 68, '坚守', 1151], // 生年约。
    ['索梅什瓦拉四世', 'chalukya', 1155, 80, 79, 80, 78, '铁骑', 1177], // 生年约。
    ['罗阇罗阇二世', 'chola', 1115, 73, 69, 78, 83, '水战', 1146], // 生年约。
    ['罗阇地罗阇二世', 'chola', 1147, 82, 80, 78, 75, '水战', 1166], // 生年约。
    ['罗阇罗阇三世', 'chola', 1190, 55, 61, 69, 71, '', 1216], // 生年约。
    ['尼桑迦摩罗', 'lanka', 1157, 70, 67, 81, 86, '治世', 1187],

    // 第二批：中东、北非与红海
    ['艾哈迈德·本·阿卜杜拉·金迪', 'oman', 1100, 45, 34, 85, 86, '教化', 1132], // 生年约。
    ['纳西尔·优素福', 'fatimid', 1228, 75, 69, 81, 80, '坚守', 1250],
    ['阿齐兹·奥斯曼', 'fatimid', 1171, 78, 78, 80, 82, '铁骑', 1193],
    ['扎希尔·加齐', 'fatimid', 1172, 82, 80, 83, 84, '坚守', 1186],
    ['阿什拉夫·穆萨', 'fatimid', 1178, 82, 77, 81, 84, '铁骑', 1201],
    ['穆阿扎姆·伊萨', 'fatimid', 1176, 84, 82, 86, 82, '坚守', 1200],
    ['凯卡乌斯二世', 'rum', 1235, 71, 73, 74, 73, '', 1246],
    ['基利杰阿尔斯兰四世', 'rum', 1236, 69, 71, 73, 76, '铁骑', 1249], // 生年约。
    ['穆因丁·佩尔瓦内', 'rum', 1225, 72, 62, 88, 88, '理财', 1256], // 生年约。
    ['贾拉勒丁·鲁米', 'rum', 1207, 42, 32, 91, 81, '教化', 1228],
    ['塔什芬·伊本·阿里', 'almoravid', 1110, 82, 83, 76, 71, '铁骑', 1138], // 生年约。
    ['阿布·雅库布·优素福', 'almoravid', 1135, 84, 76, 87, 86, '教化', 1156],
    ['雅库布·曼苏尔', 'almoravid', 1160, 91, 86, 89, 86, '铁骑', 1184],
    ['穆罕默德·纳西尔', 'almoravid', 1181, 75, 74, 76, 74, '坚守', 1199],
    ['阿布·优素福·雅库布', 'almoravid', 1212, 87, 84, 86, 86, '攻城', 1244],
    ['哈桑·伊本·阿里', 'zirid', 1109, 73, 69, 80, 78, '水战', 1129],
    ['叶海亚·伊本·阿卜杜勒阿齐兹', 'zirid', 1106, 72, 71, 76, 80, '坚守', 1121], // 生年约。
    ['阿布·扎卡里亚·叶海亚', 'zirid', 1203, 83, 77, 87, 89, '理财', 1229],
    ['哈希姆·伊本·富莱塔', 'hejaz', 1108, 72, 68, 76, 78, '治世', 1133], // 生年约。
    ['卡塔达·伊本·伊德里斯', 'hejaz', 1130, 81, 84, 76, 73, '铁骑', 1160], // 生年约。
    ['哈桑·伊本·卡塔达', 'hejaz', 1175, 74, 78, 74, 70, '坚守', 1200], // 生年约。
    ['阿里·伊本·马赫迪', 'yemen', 1100, 84, 80, 82, 74, '攻城', 1136], // 生年约。
    ['穆阿扎姆·图兰沙', 'yemen', 1137, 86, 85, 79, 78, '攻城', 1167], // 生年约。
    ['努尔丁·欧麦尔·拉苏勒', 'yemen', 1190, 83, 78, 84, 86, '理财', 1229], // 生年约。
    ['马利克·伊本·阿里', 'oman', 1080, 74, 66, 79, 81, '治世', 1115], // 生年约。
    ['法拉赫·伊本·穆赫辛', 'oman', 1150, 68, 63, 75, 78, '理财', 1180], // 生年约。
    ['马库里亚的乔治', 'nubia', 1099, 74, 72, 80, 85, '治世', 1130], // 生年约。
    ['摩西·乔治', 'nubia', 1126, 79, 74, 84, 86, '治世', 1155], // 生年约。
    ['约埃尔', 'nubia', 1130, 59, 49, 79, 84, '理财', 1155], // 生年约。
    ['马库里亚的达维德', 'nubia', 1242, 81, 78, 74, 68, '水战', 1268], // 生年约。
    ['拉利贝拉', 'abyssinia', 1162, 69, 55, 84, 88, '教化', 1185], // 生年约。
    ['纳库托·莱阿布', 'abyssinia', 1195, 71, 55, 80, 83, '教化', 1225], // 生年约。
    ['耶库诺·阿姆拉克', 'abyssinia', 1238, 85, 81, 87, 87, '铁骑', 1260], // 生年约。

    // 第二批：欧洲、高加索与草原西部
    ['雅库布·伊本·努曼', 'bulgar', 1059, 47, 35, 86, 87, '治世', 1110], // 生年约。
    ['苏莱曼·伊本·达乌德·萨克西尼', 'bulgar', 1105, 45, 33, 83, 82, '教化', 1130], // 生年约。
    ['古列尔莫·博卡内格拉', 'france', 1205, 73, 69, 86, 85, '水战', 1262], // 生年约。
    ['乔治三世', 'georgia', 1121, 85, 78, 82, 84, '铁骑', 1156], // 生年约。
    ['扎卡里亚·姆哈尔格泽利', 'georgia', 1160, 88, 88, 82, 74, '守险', 1187], // 生年约。
    ['库滕', 'cuman', 1170, 83, 85, 80, 68, '铁骑', 1200], // 生年约。
    ['巴什科德', 'cuman', 1115, 77, 80, 72, 67, '铁骑', 1140], // 生年约。
    ['库尔·加利', 'bulgar', 1183, 44, 34, 84, 82, '教化', 1212], // 生年约。
    ['安德烈二世', 'hungary', 1177, 76, 75, 80, 82, '铁骑', 1197],
    ['康拉德一世', 'poland', 1187, 78, 79, 77, 73, '铁骑', 1200], // 生年约。
    ['大卫一世', 'scotland', 1084, 82, 79, 86, 88, '治世', 1124], // 生年约。
    ['威廉一世', 'scotland', 1143, 79, 80, 77, 80, '铁骑', 1165],
    ['亚历山大三世', 'scotland', 1241, 83, 77, 84, 88, '水战', 1260],
    ['德莫特·麦克默罗', 'ireland', 1110, 78, 81, 77, 67, '铁骑', 1133], // 生年约。
    ['罗里·奥康纳', 'ireland', 1116, 83, 79, 82, 78, '坚守', 1156], // 生年约。
    ['布赖恩·奥尼尔', 'ireland', 1213, 82, 82, 79, 72, '骁勇', 1238], // 生年约。
    ['桑乔一世', 'portugal', 1154, 83, 80, 82, 87, '劝农', 1174],
    ['阿方索三世', 'portugal', 1210, 82, 77, 86, 89, '治世', 1245],
    ['尤金三世', 'papal', 1080, 52, 39, 81, 82, '教化', 1145], // 生年约。
    ['教宗亚历山大三世', 'papal', 1100, 54, 37, 88, 89, '治世', 1159], // 生年约。
    ['英诺森三世', 'papal', 1160, 56, 42, 92, 94, '治世', 1198],
    ['阿布萨隆', 'denmark', 1128, 85, 79, 86, 89, '水战', 1158], // 生年约。
    ['瓦尔德马二世', 'denmark', 1170, 88, 86, 87, 86, '水战', 1192],
    ['斯韦克尔一世', 'sweden', 1100, 74, 74, 77, 82, '治世', 1130], // 生年约。
    ['查理七世', 'sweden', 1132, 76, 78, 77, 77, '铁骑', 1161], // 生年约。
    ['比尔格·雅尔', 'sweden', 1210, 84, 80, 88, 90, '治世', 1240], // 生年约。
    ['西居尔二世', 'norway', 1133, 75, 77, 69, 69, '水战', 1151],
    ['斯韦雷', 'norway', 1151, 89, 88, 87, 85, '水战', 1177], // 生年约。
    ['哈康四世', 'norway', 1204, 84, 80, 84, 89, '水战', 1223],
    ['伊贝林的巴利安', 'crusader', 1143, 85, 82, 87, 85, '坚守', 1166], // 生年约。
    ['吕济尼昂的居伊', 'crusader', 1150, 72, 74, 68, 69, '铁骑', 1180], // 生年约。
    ['康拉德·冯·图林根', 'hre', 1206, 81, 83, 82, 79, '铁骑', 1228],
    ['安茹的查理', 'sicily', 1226, 89, 86, 89, 86, '攻城', 1265],
    ['维塔莱·米凯莱二世', 'venice', 1115, 75, 68, 80, 81, '水战', 1156], // 生年约。
    ['拉涅里·泽诺', 'venice', 1200, 80, 72, 85, 88, '水战', 1231], // 生年约。
    ['狄奥多尔二世·拉斯卡里斯', 'byz', 1221, 83, 76, 89, 88, '教化', 1254],
    ['乔治·阿克罗波利特', 'byz', 1217, 54, 42, 90, 88, '教化', 1237],
    ['纳瓦斯的迭戈·洛佩斯二世', 'castile', 1152, 86, 85, 85, 79, '铁骑', 1170], // 生年约。
    ['布拉斯科·德·阿拉贡', 'aragon', 1190, 84, 85, 81, 74, '坚守', 1210], // 生年约。
  ];
  const GEN_ADDITIONS = [
    ['高量成', 'dali', 1115, 64, 52, 82, 89, '治世', 1140], // 生年约。
    ['高贞寿', 'dali', 1115, 58, 46, 76, 80, '理财', 1140], // 生年约。
    ['高明清', 'dali', 1119, 53, 43, 75, 79, '教化', 1144], // 生年约。
    ['高观音政', 'dali', 1129, 64, 56, 78, 81, '教化', 1158], // 生年约。
    ['高泰', 'dali', 1180, 66, 54, 78, 84, '治世', 1205], // 生年约。
    ['赵寿', 'dali', 1184, 53, 50, 75, 75, '理财', 1207], // 生年约。
    ['高隆', 'dali', 1195, 67, 63, 73, 74, '守险', 1226], // 生年约。
    ['高泰祥', 'dali', 1210, 77, 70, 79, 83, '坚守', 1240], // 生年约。
    ['萨迦·贡噶宁波', 'tubo', 1092, 38, 32, 89, 83, '教化', 1111],
    ['帕木竹巴·多吉杰布', 'tubo', 1110, 42, 36, 86, 77, '教化', 1140],
    ['都松钦巴', 'tubo', 1110, 45, 35, 86, 78, '教化', 1159],
    ['索南孜摩', 'tubo', 1142, 36, 32, 85, 76, '教化', 1164],
    ['扎巴坚赞', 'tubo', 1147, 36, 31, 88, 82, '教化', 1172],
    ['吉天颂恭', 'tubo', 1143, 44, 35, 87, 81, '教化', 1179],
    ['达隆塘巴·扎西贝', 'tubo', 1142, 38, 32, 82, 78, '教化', 1180],
    ['藏巴嘉热', 'tubo', 1161, 40, 33, 83, 77, '教化', 1193],
    ['噶玛拔希', 'tubo', 1204, 44, 34, 89, 81, '教化', 1233], // 生年约。
    ['萧塔不烟', 'xiliao', 1110, 63, 52, 83, 85, '治世', 1140], // 生年约。
    ['塔剌思太王', 'xiliao', 1168, 83, 79, 76, 72, '铁骑', 1198], // 生年约。
    ['马哈木·伯克', 'xiliao', 1178, 47, 38, 75, 81, '理财', 1204], // 生年约。
    ['布剌克·哈只卜', 'xiliao', 1175, 80, 75, 84, 84, '运筹', 1200], // 生年约。
    ['哈米德·普尔', 'xiliao', 1175, 63, 55, 81, 82, '理财', 1200], // 生年约。
    ['忽儿札胡思', 'kerait', 1115, 78, 76, 76, 80, '铁骑', 1144], // 生年约。
    ['古儿罕·克烈', 'kerait', 1133, 75, 74, 68, 64, '铁骑', 1165], // 生年约。
    ['也力可哈剌', 'kerait', 1154, 73, 74, 68, 63, '铁骑', 1180], // 生年约。
    ['亦难察·必勒格', 'naiman', 1138, 82, 79, 78, 81, '铁骑', 1162], // 生年约。
    ['曲薛吾·撒八剌', 'naiman', 1160, 78, 80, 73, 62, '铁骑', 1190], // 生年约。
    ['古儿别速', 'naiman', 1162, 49, 39, 78, 81, '治世', 1192], // 生年约。
    ['阇耶诃梨跋摩二世', 'champa', 1146, 67, 63, 70, 70, '坚守', 1167], // 生年约。
    ['阇耶因陀罗跋摩四世', 'champa', 1128, 82, 79, 77, 76, '水战', 1167], // 生年约。
    ['阇耶波罗密首罗跋摩二世', 'champa', 1191, 76, 72, 79, 80, '坚守', 1220], // 生年约。
    ['陀罗尼因陀罗跋摩二世', 'khmer', 1107, 75, 71, 76, 80, '治世', 1150], // 生年约。
    ['耶输跋摩二世', 'khmer', 1127, 71, 68, 73, 74, '坚守', 1160], // 生年约。
    ['三界日跋摩', 'khmer', 1133, 74, 73, 72, 69, '骁勇', 1166], // 生年约。
    ['阿隆悉都', 'pagan', 1090, 75, 71, 79, 85, '治世', 1112], // 生年约。
    ['那腊都', 'pagan', 1118, 69, 68, 72, 66, '坚守', 1167], // 生年约。
    ['觉苏瓦', 'pagan', 1250, 62, 57, 73, 72, '治世', 1287], // 生年约。
    ['赛义德·哈桑·伽色尼', 'ghazni', 1097, 38, 34, 82, 72, '教化', 1120], // 生年约。
    ['纳斯鲁拉·蒙希', 'ghazni', 1110, 41, 35, 86, 83, '治世', 1140], // 生年约。
    ['阿布·伯克尔·鲁哈尼', 'ghazni', 1100, 35, 32, 77, 70, '教化', 1140], // 生年约。
    ['波罗摩提', 'rajput', 1145, 73, 76, 71, 76, '坚守', 1165], // 生年约。
    ['哥文陀罗阇·乔汉', 'rajput', 1172, 71, 73, 71, 73, '守险', 1192], // 生年约。
    ['哈米尔·提婆', 'rajput', 1256, 82, 85, 76, 72, '守险', 1282], // 生年约。
    ['库玛拉提维', 'gahad', 1097, 40, 33, 77, 82, '教化', 1120], // 生年约。
    ['诃利旃陀罗', 'gahad', 1174, 71, 68, 75, 75, '坚守', 1194], // 生年约。
    ['阿瓦达卡马拉', 'gahad', 1204, 62, 63, 69, 73, '理财', 1237], // 生年约。
    ['毗阇耶·塞纳', 'pala', 1095, 78, 75, 78, 82, '治世', 1145], // 生年约。
    ['跋罗罗·塞纳', 'pala', 1120, 65, 60, 82, 84, '教化', 1160], // 生年约。
    ['毗湿婆鲁波·塞纳', 'pala', 1179, 65, 61, 75, 76, '坚守', 1206], // 生年约。
    ['比阇罗二世', 'chalukya', 1112, 82, 80, 78, 77, '骁勇', 1140], // 生年约。
    ['巴萨瓦', 'chalukya', 1131, 38, 31, 87, 84, '教化', 1157], // 生年约。
    ['索梅什瓦拉·迦罗朱里', 'chalukya', 1145, 70, 71, 71, 73, '守险', 1167], // 生年约。
    ['库洛通伽二世', 'chola', 1105, 71, 67, 78, 83, '治世', 1133], // 生年约。
    ['莉拉瓦蒂', 'lanka', 1168, 52, 42, 77, 81, '治世', 1197], // 生年约。
    ['萨哈萨·马拉', 'lanka', 1170, 70, 68, 74, 73, '坚守', 1200], // 生年约。
    ['迦陵伽·摩伽', 'lanka', 1186, 82, 79, 78, 71, '水战', 1215], // 生年约。
    ['马立克沙三世', 'seljuk', 1128, 69, 67, 73, 73, '铁骑', 1152], // 生年约。
    ['穆罕默德二世·塞尔柱', 'seljuk', 1128, 77, 76, 77, 76, '铁骑', 1153], // 生年约。
    ['苏莱曼沙·塞尔柱', 'seljuk', 1118, 70, 70, 72, 71, '坚守', 1160], // 生年约。
    ['伊尔德古兹', 'seljuk', 1110, 86, 82, 86, 88, '运筹', 1140], // 生年约。
    ['贾汗·帕赫拉万', 'seljuk', 1136, 84, 79, 84, 83, '铁骑', 1160], // 生年约。
    ['克孜勒·阿尔斯兰', 'seljuk', 1140, 81, 80, 81, 77, '铁骑', 1175], // 生年约。
    ['图兰沙二世·克尔曼', 'seljuk', 1153, 70, 72, 71, 70, '铁骑', 1177], // 生年约。
    ['穆罕默德沙·克尔曼', 'seljuk', 1159, 69, 70, 71, 72, '守险', 1183], // 生年约。
    ['苏丹沙', 'khwarazm', 1153, 80, 76, 79, 76, '铁骑', 1172], // 生年约。
    ['秃儿罕可敦', 'khwarazm', 1160, 52, 42, 86, 89, '治世', 1180], // 生年约。
    ['帖木儿·马立克', 'khwarazm', 1170, 87, 87, 81, 70, '坚守', 1200], // 生年约。
    ['亦纳勒术', 'khwarazm', 1172, 81, 82, 68, 66, '坚守', 1205], // 生年约。
    ['施哈卜丁·奈萨维', 'khwarazm', 1198, 46, 37, 86, 82, '教化', 1224], // 生年约。
    ['吉亚斯丁·皮尔沙', 'khwarazm', 1198, 72, 73, 72, 69, '铁骑', 1220], // 生年约。
    ['鲁克纳丁·古尔桑赤', 'khwarazm', 1198, 70, 72, 70, 67, '坚守', 1220], // 生年约。
    ['伊萨·本·富莱塔', 'hejaz', 1116, 70, 69, 72, 77, '治世', 1161], // 生年约。
    ['达乌德·本·伊萨', 'hejaz', 1148, 70, 70, 71, 73, '坚守', 1176], // 生年约。
    ['穆克西尔·本·伊萨', 'hejaz', 1146, 72, 71, 75, 71, '坚守', 1176], // 生年约。
    ['穆伊兹·伊斯玛仪', 'yemen', 1172, 75, 71, 72, 73, '坚守', 1197], // 生年约。
    ['穆扎法尔·优素福一世', 'yemen', 1222, 77, 69, 84, 88, '治世', 1249], // 生年约。
    ['阿什拉夫·欧麦尔', 'yemen', 1242, 45, 36, 86, 85, '教化', 1272], // 生年约。
    ['穆萨·本·纳贾德', 'oman', 1100, 64, 56, 79, 80, '治世', 1140], // 生年约。
    ['穆罕默德·法拉赫', 'oman', 1118, 76, 73, 77, 79, '守险', 1154], // 生年约。
    ['欧麦尔·本·纳卜汉', 'oman', 1239, 75, 73, 74, 78, '守险', 1275], // 生年约。
    ['约翰三世·瓦塔泽斯', 'byz', 1192, 88, 81, 88, 92, '治世', 1222], // 生年约。
    ['乔治·帕基梅雷斯', 'byz', 1242, 35, 32, 87, 79, '教化', 1265],
    ['伊瓦涅·姆哈尔格泽利', 'georgia', 1160, 85, 82, 82, 82, '攻城', 1190], // 生年约。
    ['大卫七世·乌鲁', 'georgia', 1215, 75, 76, 74, 76, '守险', 1247],
    ['雅罗斯拉夫二世', 'rus', 1191, 79, 78, 79, 83, '坚守', 1212],
    ['科比亚克', 'cuman', 1145, 78, 83, 71, 66, '铁骑', 1170], // 生年约。
    ['别格柳克', 'cuman', 1158, 74, 77, 69, 64, '铁骑', 1185], // 生年约。
    ['尤里·孔恰科维奇', 'cuman', 1179, 82, 81, 77, 73, '铁骑', 1203], // 生年约。
    ['斯蒂芬三世·马札儿', 'hungary', 1147, 76, 72, 77, 78, '坚守', 1162],
    ['贝拉三世', 'hungary', 1148, 81, 75, 84, 90, '治世', 1172], // 生年约。
    ['拉斯洛四世', 'hungary', 1262, 77, 78, 72, 67, '铁骑', 1277],
    ['卡齐米日二世', 'poland', 1138, 77, 73, 82, 85, '治世', 1166],
    ['亨里克一世·西里西亚', 'poland', 1165, 82, 77, 86, 89, '治世', 1201], // 生年约。
    ['博莱斯瓦夫五世', 'poland', 1226, 68, 62, 80, 83, '治世', 1243],
    ['马尔科姆四世', 'scotland', 1141, 69, 65, 74, 76, '坚守', 1159],
    ['亨廷登的戴维', 'scotland', 1152, 73, 72, 76, 78, '坚守', 1174], // 生年约。
    ['亚历山大二世·苏格兰', 'scotland', 1198, 81, 76, 82, 86, '治世', 1214],
    ['托尔洛赫·奥康纳', 'ireland', 1088, 85, 81, 85, 87, '运筹', 1106],
    ['多纳尔·莫尔·奥布赖恩', 'ireland', 1142, 78, 76, 77, 80, '守险', 1168], // 生年约。
    ['多纳赫·凯尔布雷赫·奥布赖恩', 'ireland', 1182, 75, 72, 78, 79, '坚守', 1210], // 生年约。
    ['桑乔三世·卡斯蒂利亚', 'castile', 1134, 74, 72, 77, 78, '铁骑', 1157],
    ['阿方索八世', 'castile', 1155, 86, 80, 82, 85, '铁骑', 1169],
    ['阿方索二世·葡萄牙', 'portugal', 1185, 61, 55, 82, 84, '治世', 1211],
    ['桑乔二世', 'portugal', 1209, 77, 77, 71, 72, '攻城', 1226],
    ['迪尼斯一世', 'portugal', 1261, 68, 62, 86, 91, '劝农', 1279],
    ['阿方索二世·阿拉贡', 'aragon', 1157, 78, 74, 81, 85, '治世', 1174],
    ['佩德罗二世', 'aragon', 1178, 83, 83, 76, 78, '铁骑', 1196], // 生年约。
    ['穆斯坦绥尔·哈夫斯', 'zirid', 1228, 72, 66, 84, 86, '治世', 1249],
    ['阿布·扎卡里亚·叶海亚二世', 'zirid', 1250, 69, 66, 74, 76, '坚守', 1277], // 生年约。
    ['阿布·伊斯哈克·易卜拉欣', 'zirid', 1235, 73, 71, 77, 78, '坚守', 1279], // 生年约。
    ['威廉一世·西西里', 'sicily', 1121, 75, 72, 73, 76, '水战', 1151],
    ['威廉二世·西西里', 'sicily', 1153, 78, 71, 80, 84, '水战', 1171],
    ['格里高利九世', 'papal', 1170, 51, 35, 89, 91, '治世', 1227], // 生年约。
    ['英诺森四世', 'papal', 1195, 51, 38, 89, 89, '治世', 1243], // 生年约。
    ['尼古拉三世', 'papal', 1216, 48, 34, 84, 86, '理财', 1277], // 生年约。
    ['塞巴斯蒂亚诺·齐亚尼', 'venice', 1102, 70, 61, 85, 90, '理财', 1172], // 生年约。
    ['克努特六世', 'denmark', 1163, 80, 76, 82, 84, '水战', 1182],
    ['安德斯·苏内森', 'denmark', 1167, 61, 48, 86, 85, '教化', 1201], // 生年约。
    ['埃里克四世·丹麦', 'denmark', 1216, 75, 72, 77, 76, '水战', 1241],
    ['克努特一世·瑞典', 'sweden', 1150, 76, 73, 78, 83, '治世', 1167], // 生年约。
    ['埃里克十一世', 'sweden', 1216, 58, 53, 74, 77, '治世', 1234],
    ['马格努斯三世·瑞典', 'sweden', 1240, 76, 73, 84, 87, '治世', 1275], // 生年约。
    ['英格一世·挪威', 'norway', 1135, 70, 63, 77, 79, '坚守', 1153],
    ['马格努斯五世·挪威', 'norway', 1156, 79, 76, 74, 77, '水战', 1172],
    ['马格努斯六世·挪威', 'norway', 1238, 62, 56, 85, 91, '治世', 1263],
    ['舍坎达', 'nubia', 1246, 71, 68, 73, 73, '坚守', 1276], // 生年约。
    ['塞马蒙', 'nubia', 1256, 82, 79, 78, 76, '坚守', 1286], // 生年约。
    ['耶姆雷哈纳·克雷斯托斯', 'abyssinia', 1080, 49, 39, 82, 84, '教化', 1110], // 生年约。
    ['哈贝', 'abyssinia', 1126, 73, 70, 77, 78, '守险', 1152], // 生年约。
    ['耶特巴拉克', 'abyssinia', 1225, 74, 69, 74, 75, '守险', 1255], // 生年约。
  ];
  GEN.push(...GEN_ADDITIONS);
  const SKILLS = {
    '撼山': '全军攻守 +20%，士气不易溃', '水战': '水上与临河作战 +40%', '坚守': '守城 +35%', '守险': '山地丘陵防守 +30%', '理财': '任知州时钱 +30%',
    '骁勇': '进攻 +15%', '铁骑': '骑兵 +25%', '神射': '弓弩与弓骑 +30%', '运筹': '军粮消耗减半，行军 +1，脱囚几率每季 +1 个百分点', '治世': '任知州效果 ×1.5', '劝农': '任知州时粮 +30%',
    '教化': '任知州时民心 +10、文 +3', '攻城': '攻城 +40%', '疾行': '行军 +2', '大汗': '全军攻守 +25%，行军 +1',
  };

  // ---------- 人名生成 ----------
  const NAMES = {
    han: { s: '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦许何吕施张孔曹严华金魏陶姜谢邹章苏潘葛范彭鲁韦马方任袁柳鲍史唐费薛雷贺倪汤罗毕郝安常傅齐康余顾孟黄萧尹姚邵汪毛狄米贝明臧计伏成戴宋庞熊纪舒屈项祝董梁杜阮蓝闵季贾路江童颜郭梅盛林钟徐邱骆高夏蔡田胡凌霍虞万柯卢莫房解应宗丁宣邓单杭洪包左石崔吉龚程邢裴陆荣翁荀甄家封储靳段侯全班仰秋仲伊宫宁仇栾甘厉戎祖武符刘景詹龙叶幸司黎溥印宿白怀蒲邰从鄂索咸籍赖卓蔺屠蒙池乔阴胥能苍双闻莘党翟谭贡劳姬申扶堵冉宰郦雍桑桂濮牛寿通边扈燕冀郏浦尚农温别庄晏柴瞿阎充慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡国文寇广禄东欧殳沃利蔚越夔隆师巩厍聂晁勾敖融冷訾辛阚那简饶空曾毋沙乜养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公阿哀爱柏拜保葆薄闭卞卜布才岑车谌迟淳丛寸代但刁典鼎冬窦端多恩樊凡繁斐芾风奉佛福付干皋根弓苟谷固辜官管贯圭贵归衮海黑赫花滑环皇淮徽惠基蓟稽祭甲焦角揭介晋京经井敬境鸠巨隗郐邝库乐隶栗练励廉濂莲凉良聊列留楼露鹿落麻买麦茂茅茆密宓麋麴苗名墨牟木沐穆牧纳南年念辇庖盆逄皮毗平朴杞祁綦漆戚岐祈契千潜强侨桥樵郗郄郤钦芩覃青清庆丘求裘区渠曲泉阙阕仁仍如儒汝润芮赛山闪陕善商赏韶少审深神胜生时守受疏帅霜水四寺似颂粟素肃随隋遂锁台谈桃滕藤特铁佟同涂徒土吐拓佗外危委味位尉问乌巫吾伍务戊希奚席洗冼鲜宪乡肖信新星刑杏休修续玄轩学雅闫延言仵尧瑶冶野衣夷仪义意佚弋殷隐英郢营邕永尤邮由攸俞于於愚渔禹羽隅玉郁宇元员原源爰岳云郧恽郓蔗展湛占仉仝肇折臻针贞征知支植直郅挚执种重舟诸主渚竹涿濯拙兹淄纵佐胙阼作逢洑虢郇邬睦菅藺夙俟卬娄闾馀綝', g: '世忠彦文武德明光远道宗元正之仲伯叔安国邦华士良信义仁礼智勇刚毅弘谦泰俊杰英豪雄伟卿相廷亮成章思孝立显达观恕宣辅弼韬略甫翼克允珪璋璞璟璠珩琛琦钰珏玮琰玠珣琮琚琇璧琬璘璨琢瑜瑾瑛琏璜琨珉瑑玙瑀瑄璇韫蕴昶晟昀煜晖晔晏晞晗晁旭昉曜昕熹炳炜烨炯烜敏俭廉清恭厚朴质' },
    jurchen: { s: ['完颜', '纥石烈', '仆散', '徒单', '乌古论', '夹谷', '蒲察', '温迪罕', '术虎', '裴满', '纳兰', '纥石', '乌林答', '斜卯', '唐括', '忒里辟', '兀颜', '术甲', '颜盏', '移剌', '石抹'], g: ['阿骨', '斡离', '宗', '撒', '阿鲁', '迪古', '讹可', '胡沙', '合喜', '蒲鲁', '兀', '突合', '习不失', '阿里', '粘没', '蒲家奴', '骨赧', '银术可', '银可术', '阿邻', '本睹', '阿琐', '合住', '胡剌', '溪列', '吾都补', '斜钵', '宗秀', '宗道', '宗望'] },
    tangut: { s: ['嵬名', '野利', '没藏', '梁', '任', '罔', '仁多', '咩布', '嵬立', '讹藏', '赏', '扑', '昝', '史', '苏', '米'], g: ['察哥', '遇乞', '旺荣', '乞', '保忠', '令公', '浪', '讹庞', '多', '额尔德', '命遇', '仁孝', '克茂', '德明', '遵顼', '承祯', '守福', '长寿', '宁国'] },
    mongol: { s: ['孛儿只斤', '札剌亦儿', '兀良哈', '弘吉剌', '巴鲁剌思', '塔塔儿', '蔑儿乞', '泰赤乌', '克烈', '乃蛮', '汪古', '亦乞列思', '豁罗剌思', '朵鲁班', '巴阿邻', '玉里伯牙吾'], g: ['也先', '帖木儿', '脱脱', '阿术', '不花', '撒里', '忽鲁', '察罕', '答里台', '别勒古台', '阔阔出', '赤老温', '纳牙', '合撒儿', '唆都', '孛罗', '脱欢', '合丹', '耶律台', '忽儿察', '阿勒坦', '伯颜', '也先不花', '镇海', '阔阔台', '阿剌罕'] },
    khitan: { s: ['耶律', '萧', '大贺', '审密'], g: ['大石', '斡里剌', '直鲁古', '朮者', '查剌', '夷列', '敌烈', '阿保', '朴古', '挞烈', '胡睹', '术烈', '盆奴', '朵鲁不', '得里底', '移辛', '朴里哥', '留哥'] },
    tibetan: { s: ['朗达', '赤', '桑杰', '贡噶', '扎巴', '索南', '多吉', '娘', '噶尔', '达波', '巴', '戴', '敦', '珠尔'], g: ['坚赞', '旺秋', '仁钦', '嘉措', '顿珠', '次仁', '罗布', '扎西', '益西', '丹增', '丹巴', '多杰', '洛追', '贡布'] },
    bai: { s: ['段', '高', '杨', '董', '李', '赵', '尹', '寸', '王', '张', '何', '周'], g: ['思廉', '思明', '正严', '正兴', '智廉', '智祥', '明兴', '廉义', '祥庆', '福顺', '寿昌', '惠和', '永祚', '广仁', '世庆', '德和', '世勋', '继隆', '昭义', '明远', '承祐', '义齐'] },
    korean: { s: ['金', '李', '崔', '郑', '朴', '尹', '韩', '柳', '林', '吴', '姜', '宋', '权', '申', '任', '文', '白', '蔡', '许', '洪'], g: ['元弼', '允侯', '守文', '就砺', '义旼', '继烈', '子深', '顗章', '永年', '重辅', '敬信', '元直', '世昌', '行简', '孝诚', '成吉', '富轼', '仲夫', '忠献', '俊彦', '义方', '致远', '公著', '允恭', '敬纯', '仁范', '尹恭', '尚正', '允谦', '玄锡', '允弼', '仁信'] },
    japanese: { s: ['源', '平', '藤原', '橘', '大江', '佐藤', '北条', '足利', '新田', '楠木', '中臣', '三浦', '和田', '梶原', '九条', '千叶', '畠山', '佐佐木', '土肥', '安达'], g: ['义家', '为义', '经盛', '重衡', '知盛', '赖政', '景时', '时政', '义贞', '正成', '义光', '清经', '重忠', '时连', '景季', '广常', '忠常', '盛纲', '高纲', '政村', '经时', '实朝', '业时', '兼实'] },
    viet: { s: ['李', '陈', '黎', '阮', '杜', '苏', '范', '吴', '武', '丁', '胡', '黄', '潘', '郑', '裴'], g: ['光启', '日燏', '国峻', '庆余', '世忠', '公谨', '大义', '维常', '文道', '宗正', '明仁', '天祚', '公著', '永贞', '仲明', '德顺', '国用', '文安', '友亮', '仁泽', '廷贵', '敏达'] },
    cham: { s: ['阇耶', '诃梨', '因陀罗', '鸠摩罗', '波', '罗阇', '瑟利', '毗阇耶'], g: ['跋摩', '帝婆', '僧伽', '提婆', '跋陀罗', '威阇耶', '跋达罗', '婆罗'] },
    khmer: { s: ['阇耶', '苏利耶', '因陀罗', '陀罗尼', '诃利', '乌陀耶', '达罗', '湿婆'], g: ['跋摩', '帝婆', '摩诃', '迦罗', '因陀罗', '跋曼', '梵摩', '僧伽'] },
    burmese: { s: ['阿奴', '江喜', '那罗', '阿隆', '敏', '阿散伽', '惹娑', '提诃'], g: ['律陀', '陀', '悉都', '波帝', '悉多', '德伽', '娑浮', '修摩'] },
    indian: { s: ['拉贾', '毗摩', '阇耶', '维克拉玛', '普里特维', '德瓦', '桑格拉玛', '罗阇拉阇', '室利', '阿难陀', '罗摩', '毗阇耶', '库洛通伽', '波罗迦罗摩'], g: ['提婆', '辛哈', '钵罗', '跋摩', '罗阇', '纳拉', '乾陀罗', '特拉', '婆诃', '吉提', '苏罗', '伐摩'] },
    turkic: { s: ['阿尔斯兰', '马利克', '托格鲁尔', '阿特斯兹', '阿勒普', '凯霍斯鲁', '阿即思', '塔乞失', '桑贾尔', '卡拉', '拜伯尔斯', '别格'], g: ['沙', '贝伊', '帕夏', '阿塔贝格', '汗', '加齐', '帖勤', '·忽都', '·阿塔', '·赛义德', '·乌古兹', '·札兰丁'] },
    persian: { s: ['阿里', '侯赛因', '穆罕默德', '贾拉勒', '纳斯尔', '巴赫拉姆', '阿布·曼苏尔', '巴赫蒂亚尔', '奈吉姆', '卡伊霍斯鲁', '萨阿德', '伊斯玛仪'], g: ['丁', '沙', '伊本·苏莱曼', '伊本·哈桑', '阿布·法德勒', '·萨尼', '·希拉齐', '·朱韦尼', '·拉齐', '·加兹尼'] },
    arab: { s: ['优素福', '阿布·贝克尔', '哈桑', '欧麦尔', '哈立德', '阿卜杜拉', '萨利赫', '易卜拉欣', '乌萨马', '穆阿扎姆', '欧斯曼', '雅各布', '艾哈迈德', '马哈茂德', '苏莱曼', '伊斯哈格'], g: ['伊本·阿里', '伊本·哈米德', '伊本·穆萨', '·阿德勒', '·纳绥尔', '·伊本·马立克', '·本·鲁齐克', '·萨利赫', '·马斯里', '·伊本·蒙基兹'] },
    greek: { s: ['约翰', '安德洛尼卡', '阿列克修斯', '米哈伊尔', '狄奥多尔', '君士坦丁', '尼基弗鲁斯', '米海尔', '斯特凡诺斯', '狄米特里奥斯', '马努埃尔', '伊萨克', '乔治', '尼基塔斯'], g: ['·科穆宁', '·杜卡斯', '·安格洛斯', '·帕列奥列格', '·瓦塔泽斯', '·康托斯特法诺斯', '·拉斯卡里斯', '·布拉纳斯', '·梅利西诺斯', '·帕库里亚诺斯', '·斯格罗斯', '·塔尔哈尼奥提斯'] },
    georgian: { s: ['乔治', '大卫', '巴格拉特', '扎卡里亚', '伊瓦内', '伊利亚', '沙尔瓦', '格里戈尔', '鲁苏丹', '贝卡'], g: ['·姆哈尔格泽利', '·奥尔贝利', '·达迪亚尼', '·贾凯利', '·苏拉梅利', '·阿哈尔齐赫利'] },
    rus: { s: ['伊戈尔', '弗拉基米尔', '姆斯季斯拉夫', '斯维亚托斯拉夫', '雅罗斯拉夫', '弗谢沃洛德', '罗曼', '丹尼尔', '罗斯季斯拉夫', '格列布', '德米特里', '罗季翁', '斯维亚托波尔克', '米哈伊尔', '鲁里克', '瓦西里'], g: ['·奥尔戈维奇', '·莫诺马霍维奇', '·罗斯季斯拉维奇', '·尤里耶维奇', '·雅罗斯拉维奇', '·弗拉基米罗维奇', '·格列博维奇', '·罗曼诺维奇'] },
    cuman: { s: ['孔查克', '巴什基尔', '库坦', '博尼亚克', '塔斯', '托古尔', '科比亚克', '也勒吐', '陀格尔', '沙鲁坎'], g: ['汗', '伯克', '特勤', '阔思', '齐亚', '格勒'] },
    magyar: { s: ['拉斯洛', '贝拉', '伊什特万', '盖萨', '安德拉什', '伊姆雷', '佐尔坦', '巴纳巴斯', '阿鲍', '萨姆埃尔'], g: ['·阿尔帕德', '·乌伊拉基', '·肖普', '·恰克', '·赫德尔', '·博尔肖'] },
    polish: { s: ['博莱斯瓦夫', '梅什科', '卡齐米日', '亨里克', '莱谢克', '瓦迪斯瓦夫', '普热梅斯瓦夫', '康拉德', '耶日', '雅库布'], g: ['·皮雅斯特', '·瓦布热齐克', '·格里菲塔', '·波梅拉尼亚', '·格里马瓦', '·奥德罗翁日'] },
    german: { s: ['亨利', '腓特烈', '康拉德', '奥托', '卢道夫', '赫尔曼', '韦尔夫', '洛泰尔', '阿尔布雷希特', '贝尔托尔德', '鲁道夫', '埃伯哈德', '里夏德', '迪特里希'], g: ['·冯·施陶芬', '·冯·巴本堡', '·冯·维特尔斯巴赫', '·冯·哈布斯堡', '·韦尔夫', '·冯·安哈尔特', '·冯·萨尔扎', '·冯·迈森', '·冯·策林根', '·冯·韦廷'] },
    frankish: { s: ['路易', '腓力', '雷蒙', '博希蒙德', '鲍德温', '戈弗雷', '于格', '罗贝尔', '马蒂厄', '吉约姆', '若弗鲁瓦', '若昂', '安德烈', '埃德', '拉乌尔', '蒂博'], g: ['·德·图卢兹', '·德·布永', '·德·吕西尼昂', '·德·沙蒂永', '·德·布卢瓦', '·德·内韦尔', '·德·蒙莫朗西', '·德·拉罗什', '·德·沙特尔', '·德·维勒阿杜安'] },
    english: { s: ['威廉', '理查', '约翰', '亨利', '罗伯特', '杰弗里', '沃尔特', '埃德蒙', '哈罗德', '休', '西蒙', '斯蒂芬', '吉尔伯特', '罗杰'], g: ['·马歇尔', '·德·克莱尔', '·菲茨杰拉德', '·德·蒙福尔', '·比戈德', '·德·布罗厄斯', '·德·沃伦', '·德·博恩', '·德·珀西', '·菲茨艾伦'] },
    iberian: { s: ['阿方索', '桑乔', '费尔南多', '罗德里戈', '佩德罗', '海梅', '贡萨洛', '马丁', '努尼奥', '拉蒙', '加尔西亚', '路易斯'], g: ['·迪亚斯', '·冈萨雷斯', '·费尔南德斯', '·德·拉拉', '·德·阿罗', '·门德斯', '·佩雷斯', '·恩里克斯', '·德·卡斯特罗', '·德·乌尔赫尔'] },
    moorish: { s: ['优素福', '阿里', '塔什芬', '阿卜杜勒', '伊本·图马特', '叶海亚', '穆罕默德', '穆萨', '雅各布', '易卜拉欣', '曼苏尔', '伊德里斯'], g: ['·伊本·塔什芬', '·伊本·加尼亚', '·伊本·马达尼什', '·伊本·鲁世德', '·伊本·祖赫尔', '·伊本·艾哈默尔'] },
    italian: { s: ['罗杰', '威廉', '坦克雷德', '恩里科', '彼得罗', '乔瓦尼', '洛伦佐', '安德烈亚', '马泰奥', '马里诺', '雅各波', '乌戈'], g: ['·德·欧特维尔', '·丹多洛', '·齐亚尼', '·莫罗西尼', '·孔蒂', '·雷尼耶', '·奥尔塞奥洛', '·格拉德尼戈', '·普拉托', '·卡波恰'] },
    norse: { s: ['瓦尔德马', '斯韦恩', '克努特', '马格努斯', '哈拉尔', '埃里克', '西居尔', '哈康', '比尔格', '特里格韦', '拉格纳', '奥拉夫', '阿斯比约恩', '斯诺里'], g: ['·埃斯特里德森', '·哈拉尔德森', '·斯韦克', '·乔尔', '·尔松', '·埃里克松', '·斯泰因松', '·雅尔松'] },
    ethiopian: { s: ['拉利贝拉', '耶库诺', '格布雷', '纳阿库托', '盖布雷', '塔克拉', '格尔玛', '沃尔德'], g: ['·梅斯克尔', '·阿姆拉克', '·拉阿布', '·塞拉西', '·海马诺特', '·埃格济'] },
    filipino: { s: ['拉惹', '达图', '苏莱曼', '盖特', '洛纳', '邦巴'], g: ['·拉坎', '·普提', '·巴尼', '·帕苏', '·达曼', '·达里'] },
  };


  // ---------- 宝物 ----------
  const ITEMS = {
    liquan: { name: '沥泉枪', desc: '武 +6', wu: 6 }, zhanlu: { name: '湛卢剑', desc: '武 +4，统 +2', wu: 4, tong: 2 },
    wumu: { name: '武穆遗书', desc: '统 +6，智 +2', tong: 6, zhi: 2 }, sunzi: { name: '孙子兵法', desc: '智 +6', zhi: 6 },
    taigong: { name: '太公兵法', desc: '统 +4，智 +4', tong: 4, zhi: 4 }, wuzhui: { name: '乌骓马', desc: '行军 +1', mv: 1 },
    chitu: { name: '赤兔马', desc: '行军 +1，武 +2', mv: 1, wu: 2 }, dilu: { name: '的卢马', desc: '行军 +1，智 +1', mv: 1, zhi: 1 },
    mingguang: { name: '明光铠', desc: '全军防御 +10%', armor: 0.1 }, liannu: { name: '诸葛连弩图', desc: '弓弩 +20%', bow: 0.2 },
    yuxi: { name: '传国玉玺', desc: '政 +6，统 +2', zheng: 6, tong: 2 }, zhenguan: { name: '贞观政要', desc: '政 +6', zheng: 6 },
    tongjian: { name: '资治通鉴', desc: '政 +4，智 +3', zheng: 4, zhi: 3 }, mengxi: { name: '梦溪笔谈', desc: '智 +4，政 +2', zhi: 4, zheng: 2 },
    hufu: { name: '虎符', desc: '统 +5', tong: 5 }, qinggang: { name: '青釭剑', desc: '武 +5', wu: 5 },
    baodao: { name: '西域宝刀', desc: '武 +4', wu: 4 }, xingpan: { name: '大食星盘', desc: '智 +3，行军 +1（海上）', zhi: 3 },
    shengqiang: { name: '朗基努斯圣枪', desc: '武 +3，统 +3', wu: 3, tong: 3 }, jinpai: { name: '御赐金牌', desc: '统 +3，士气不易溃', tong: 3, armor: 0.05 },
    // 旧物、传本与传说名器
    dingqin: { name: '定秦剑', desc: '武 +5，统 +2', wu: 5, tong: 2 },
    qixing: { name: '七星宝刀', desc: '武 +5', wu: 5 },
    wuxue: { name: '武经总要', desc: '统 +4，智 +3', tong: 4, zhi: 3 },
    wujing: { name: '武经七书', desc: '统 +5，智 +3', tong: 5, zhi: 3 },
    wuzijing: { name: '吴子兵法', desc: '统 +4，智 +2', tong: 4, zhi: 2 },
    yuejueshu: { name: '越绝书', desc: '智 +4，政 +2', zhi: 4, zheng: 2 },
    qimin: { name: '齐民要术', desc: '政 +5，智 +2', zheng: 5, zhi: 2 },
    yingzao: { name: '营造法式', desc: '智 +4，政 +3', zhi: 4, zheng: 3 },
    tangliudian: { name: '唐六典', desc: '政 +6，智 +1', zheng: 6, zhi: 1 },
    datangxiyu: { name: '大唐西域记', desc: '智 +4，政 +2', zhi: 4, zheng: 2 },
    yixian: { name: '仪象法要', desc: '智 +5，政 +2', zhi: 5, zheng: 2 },
    yuchang: { name: '鱼肠剑', desc: '武 +6', wu: 6 },
    longquan: { name: '龙泉剑', desc: '武 +4，统 +2', wu: 4, tong: 2 },
    zhaoyebai: { name: '照夜白', desc: '行军 +1，统 +2', mv: 1, tong: 2 },
    damascus: { name: '大马士革刀', desc: '武 +5，统 +1', wu: 5, tong: 1 },
    shahnameh: { name: '列王纪', desc: '智 +4，政 +3', zhi: 4, zheng: 3 },
    canon: { name: '医典', desc: '智 +5，政 +2', zhi: 5, zheng: 2 },
    joyeuse: { name: '咎瓦尤斯剑', desc: '武 +3，统 +4', wu: 3, tong: 4 },
    varangian: { name: '瓦兰吉长斧', desc: '武 +4，统 +1', wu: 4, tong: 1 },
    mail: { name: '拂菻锁子甲', desc: '武 +2，全军防御 +8%', wu: 2, armor: 0.08 },
  };
  // ---------- 奇遇点 ----------
  const SITES = {
    battlefield: { name: '古战场', glyph: '碑', desc: '凭吊古战场，主将经验 +80（每位将领一次）', repeat: 'gen' },
    temple: { name: '名山古刹', glyph: '寺', desc: '士气全满，各营恢复兵员 +20（每季一次）', repeat: 'season' },
    hermit: { name: '隐士草庐', glyph: '隐', desc: '主将得高人指点，习得新特技或能力提升（一次）', repeat: 'once' },
    ruins: { name: '遗迹', glyph: '宝', desc: '发掘宝物（一次）', repeat: 'once' },
    volunteers: { name: '义军营寨', glyph: '义', desc: '义军来投，补入数营（一次）', repeat: 'once' },
    stud: { name: '牧马场', glyph: '马', desc: '得马 15 匹（每季一次）', repeat: 'season' },
    caravan: { name: '商队', glyph: '商', desc: '截获商货，得钱若干（一次）', repeat: 'once' },
    granary: { name: '屯粮所', glyph: '粮', desc: '获粮 200 石（一次）', repeat: 'once' },
    library: { name: '藏书楼', glyph: '书', desc: '典籍助学，当前科研进度大增（一次）', repeat: 'once' },
  };
  const LANDMARKS = [
    ['梁山泊', 'volunteers', 116.1, 35.8], ['太行八字军寨', 'volunteers', 113.6, 36.6], ['少林寺', 'temple', 113.0, 34.5], ['武当山', 'temple', 111.0, 32.4],
    ['峨眉山', 'temple', 103.3, 29.5], ['泰山', 'temple', 117.1, 36.2], ['赤壁', 'battlefield', 113.9, 29.9], ['长平', 'battlefield', 112.9, 35.8],
    ['垓下', 'battlefield', 117.6, 33.3], ['莫高窟', 'library', 94.4, 39.8], ['怛罗斯', 'battlefield', 72.0, 42.3], ['高加米拉', 'battlefield', 43.5, 36.6],
    ['曼齐刻尔特', 'battlefield', 42.5, 39.1], ['温泉关', 'battlefield', 22.5, 38.8], ['坎尼', 'battlefield', 16.1, 41.3], ['阿索斯圣山', 'temple', 24.3, 40.2],
    ['卡帕多奇亚石窟', 'temple', 34.8, 38.6], ['那烂陀寺', 'library', 85.4, 25.1], ['费尔干纳马场', 'stud', 71.8, 40.6], ['河曲马场', 'stud', 102.0, 34.8],
    ['秦始皇陵', 'ruins', 109.3, 34.4], ['金字塔', 'ruins', 31.1, 29.6], ['波斯波利斯', 'ruins', 52.9, 29.9], ['巴比伦', 'ruins', 44.4, 32.5],
    ['楼兰古城', 'ruins', 89.9, 40.5], ['终南山', 'hermit', 108.9, 33.9], ['白鹿洞书院', 'library', 115.98, 29.55], ['武夷山', 'hermit', 117.9, 27.7],
    ['天山隐者', 'hermit', 84.0, 43.0], ['阿拉木图马场', 'stud', 77.0, 43.3], ['斡难河牧场', 'stud', 112.0, 49.0], ['蒙特卡西诺', 'temple', 13.8, 41.5],
    ['特洛伊', 'ruins', 26.2, 39.9], ['帕尔米拉', 'ruins', 38.3, 34.6], ['五台山', 'temple', 113.6, 39.0], ['崆峒山', 'hermit', 106.5, 35.5],
    // 中国内地（15）
    ['岳阳楼', 'library', 113.10, 29.38], ['滕王阁', 'library', 115.88, 28.68], ['黄鹤楼', 'library', 114.30, 30.55],
    ['雁门关', 'battlefield', 112.89, 39.17], ['虎牢关', 'battlefield', 113.15, 34.86], ['褒斜道', 'granary', 107.31, 33.82],
    ['桃花源', 'hermit', 111.43, 28.78], ['大明寺', 'temple', 119.42, 32.43], ['醉翁亭', 'hermit', 118.29, 32.30],
    ['龙门石窟', 'temple', 112.47, 34.55], ['大相国寺', 'temple', 114.35, 34.79], ['青莲故里', 'hermit', 104.73, 31.77],
    ['法门寺', 'temple', 107.90, 34.44], ['浮梁茶市', 'caravan', 117.24, 29.34], ['端溪砚坑', 'ruins', 112.48, 23.07],
    // 草原与西域（10）
    ['回鹘牙帐城', 'ruins', 102.66, 47.43], ['杭爱牧场', 'stud', 100.11, 47.44], ['鄂尔浑碑林', 'ruins', 102.83, 47.56],
    ['鹿石古冢', 'ruins', 100.08, 49.57], ['玉门关', 'caravan', 93.86, 40.35], ['伊吾驿', 'caravan', 93.51, 42.83],
    ['交河故城', 'ruins', 89.06, 42.94], ['苏巴什佛寺', 'temple', 83.04, 41.87], ['铁门关', 'granary', 86.18, 41.80],
    ['碎叶故城', 'ruins', 75.20, 42.80],
    // 天竺与东南亚（8）
    ['桑奇大塔', 'temple', 77.74, 23.48], ['菩提伽耶', 'temple', 84.99, 24.70], ['阿旃陀石窟', 'temple', 75.70, 20.55],
    ['鹿野苑', 'temple', 83.02, 25.38], ['阿努拉德普勒大寺', 'library', 80.40, 8.35], ['吴哥寺', 'temple', 103.87, 13.41],
    ['美山圣地', 'temple', 108.12, 15.77], ['卑谬古城', 'ruins', 95.29, 18.81],
    // 中东（6）
    ['佩特拉', 'ruins', 35.44, 30.33], ['巴米扬石窟', 'temple', 67.82, 34.83], ['尼萨古城', 'ruins', 58.21, 37.95],
    ['贝希斯敦崖铭', 'ruins', 47.44, 34.39], ['尼扎米亚书院', 'library', 44.42, 33.33], ['马里卜古坝', 'ruins', 45.26, 15.41],
    // 欧洲（5）
    ['圣但尼修道院', 'temple', 2.36, 48.94], ['圣地亚哥朝圣地', 'temple', -8.54, 42.88], ['克吕尼修道院', 'library', 4.66, 46.43],
    ['罗马万神殿', 'ruins', 12.48, 41.90], ['乌普萨拉古冢', 'ruins', 17.63, 59.90],
  ];
  const SKILL_POOL = ['骁勇', '坚守', '守险', '铁骑', '神射', '攻城', '疾行', '水战', '运筹', '治世', '理财', '劝农', '教化'];

  return { ITEMS, SITES, LANDMARKS, SKILL_POOL, FACTIONS, FACTION_INFO, DIFFICULTY, SONG_RECLAIM, CITIES, UNITS, TERRAIN_COMBAT, BEATS, CULTURE_UNIT_NAME, NOMAD, BUILDINGS, ERAS, TECHS, START_TECH, GEN, GEN_ADDITIONS, SKILLS, NAMES };
})();
if (typeof module !== 'undefined') module.exports = DATA;
