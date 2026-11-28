// 兵种立绘：按兵种与文化程序绘制的水墨兵像（仅用 Canvas，不引外部图片）
var UNITART = (function () {
  const SZ = 200;            // 画布像素，逻辑坐标 100×100
  const cache = new Map(), urls = new Map();
  const INK = '#221e19';

  // ---------- 文化 → 样式 ----------
  const STYLE_OF = {
    han: 'han', korean: 'han', bai: 'han',
    jurchen: 'steppe', khitan: 'steppe', mongol: 'steppe', tangut: 'steppe', cuman: 'steppe',
    turkic: 'islam', persian: 'islam', arab: 'islam', moorish: 'islam',
    frankish: 'euro', english: 'euro', german: 'euro', iberian: 'euro', italian: 'euro', polish: 'euro', magyar: 'euro', norse: 'euro',
    greek: 'byz', georgian: 'byz', rus: 'byz',
    viet: 'south', cham: 'south', khmer: 'south', burmese: 'south', filipino: 'south', indian: 'south', ethiopian: 'south',
    tibetan: 'tibet', japanese: 'wa',
  };
  const CROSSBOW = { han: 1, bai: 1, korean: 1, frankish: 1, german: 1, iberian: 1, italian: 1, polish: 1, greek: 1 };
  const NORSE_SAIL = { norse: 1, english: 1, frankish: 1, german: 1, polish: 1, rus: 1 };
  function style(cul) { return STYLE_OF[cul] || 'han'; }
  function skin(cul) {
    if (cul === 'indian' || cul === 'ethiopian') return '#b98a5e';
    if (style(cul) === 'south') return '#d4aa7c';
    if (style(cul) === 'islam') return '#dcb68e';
    if (style(cul) === 'euro' || style(cul) === 'byz') return '#ecd2ba';
    return '#e8cda6';
  }
  function rgb(hex) { const n = parseInt(String(hex).slice(1), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgba(hex, a) { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; }
  function shade(hex, k) { const [r, g, b] = rgb(hex).map(v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)))); return `rgb(${r},${g},${b})`; }
  function rnd(seed) { let s = seed % 233280; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  function seedOf(str) { let h = 7; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100003; return h; }

  // ---------- 笔墨工具 ----------
  function line(x, pts, w, col, cap) {
    x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
    x.lineWidth = w; x.strokeStyle = col || INK; x.lineCap = cap || 'round'; x.lineJoin = 'round'; x.stroke();
  }
  function curve(x, a, c, b, w, col) {
    x.beginPath(); x.moveTo(a[0], a[1]); x.quadraticCurveTo(c[0], c[1], b[0], b[1]);
    x.lineWidth = w; x.strokeStyle = col || INK; x.lineCap = 'round'; x.stroke();
  }
  function poly(x, pts, fill, stroke, w) {
    x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
    x.closePath();
    if (fill) { x.fillStyle = fill; x.fill(); }
    if (stroke) { x.lineWidth = w || 1; x.strokeStyle = stroke; x.lineJoin = 'round'; x.stroke(); }
  }
  function ell(x, cx, cy, rx, ry, rot, fill, stroke, w) {
    x.beginPath(); x.ellipse(cx, cy, rx, ry, rot || 0, 0, Math.PI * 2);
    if (fill) { x.fillStyle = fill; x.fill(); }
    if (stroke) { x.lineWidth = w || 1; x.strokeStyle = stroke; x.stroke(); }
  }
  function wash(x, cx, cy, rx, ry, col, a) {
    x.save(); x.translate(cx, cy); x.scale(1, ry / rx);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, rx, 0, Math.PI * 2); x.fill(); x.restore();
  }
  // 在当前路径内画甲片纹
  function lamellar(x, x0, y0, x1, y1, col, step) {
    x.save(); x.clip();
    x.strokeStyle = col; x.lineWidth = 0.5;
    step = step || 2.6;
    for (let y = y0, row = 0; y < y1; y += step, row++) {
      x.beginPath(); x.moveTo(x0, y); x.lineTo(x1, y); x.stroke();
      for (let xx = x0 + (row & 1) * step * 0.6; xx < x1; xx += step * 1.2) { x.beginPath(); x.moveTo(xx, y); x.lineTo(xx, y + step); x.stroke(); }
    }
    x.restore();
  }
  function mail(x, x0, y0, x1, y1, col) {
    x.save(); x.clip(); x.fillStyle = col;
    for (let y = y0, r = 0; y < y1; y += 1.6, r++) for (let xx = x0 + (r & 1) * 0.8; xx < x1; xx += 1.6) x.fillRect(xx, y, 0.6, 0.6);
    x.restore();
  }

  // ---------- 背景 ----------
  function paper(x, color, seed) {
    const R = rnd(seed);
    const g = x.createRadialGradient(50, 42, 6, 50, 50, 72);
    g.addColorStop(0, '#f7f1e0'); g.addColorStop(1, '#d9cba8');
    x.fillStyle = g; x.fillRect(0, 0, 100, 100);
    // 远山
    x.save(); x.globalAlpha = 0.16; x.fillStyle = '#4a4238';
    x.beginPath(); x.moveTo(0, 62);
    let px = 0;
    while (px < 100) { const w = 14 + R() * 18, h = 10 + R() * 16; x.quadraticCurveTo(px + w * 0.5, 62 - h * 2, px + w, 62); px += w; }
    x.lineTo(100, 100); x.lineTo(0, 100); x.closePath(); x.fill(); x.restore();
    wash(x, 80, 20, 30, 22, color, 0.18);
    // 地面墨晕
    wash(x, 50, 90, 52, 9, '#2a241e', 0.35);
    x.save(); x.globalAlpha = 0.5;
    line(x, [[6, 89], [30, 88.2], [58, 89.4], [94, 88.4]], 0.9, 'rgba(34,30,25,0.6)');
    x.restore();
  }

  // ---------- 头盔与面部 ----------
  function head(x, hx, hy, st, sk, color, o) {
    o = o || {};
    // 脸
    ell(x, hx, hy, 5.6, 6.6, 0, sk, 'rgba(40,30,20,0.8)', 0.6);
    // 眉眼（面右）
    line(x, [[hx + 1.2, hy - 1.6], [hx + 4.2, hy - 2.2]], 0.9, INK);
    ell(x, hx + 3, hy - 0.4, 0.7, 0.6, 0, INK);
    // 须
    if (st === 'islam' || st === 'byz' || st === 'euro' && o.beard || st === 'tibet' || o.beard) {
      poly(x, [[hx - 1, hy + 3], [hx + 5.5, hy + 2.4], [hx + 3.6, hy + 7.5], [hx + 0.5, hy + 6.8]], 'rgba(34,30,25,0.85)');
    } else {
      line(x, [[hx + 2.4, hy + 3.6], [hx + 5, hy + 3]], 0.7, INK);
    }
    const gold = o.elite ? '#c9a23a' : null;
    const steel = '#6f6c66', dark = '#37322b';
    switch (st) {
      case 'han': {
        // 兜鍪：圆顶、护耳、顶缨
        x.beginPath(); x.moveTo(hx - 7, hy + 0.5); x.quadraticCurveTo(hx - 7.5, hy - 10, hx, hy - 10.5); x.quadraticCurveTo(hx + 7, hy - 10, hx + 6.8, hy - 2.5);
        x.lineTo(hx + 5.6, hy - 3.4); x.quadraticCurveTo(hx, hy - 4.6, hx - 3, hy - 1); x.lineTo(hx - 3, hy + 6); x.lineTo(hx - 7.4, hy + 5.6); x.closePath();
        x.fillStyle = dark; x.fill(); x.strokeStyle = INK; x.lineWidth = 0.8; x.stroke();
        line(x, [[hx - 6.6, hy - 3.6], [hx + 6.4, hy - 3.6]], 1.2, gold || '#8a7b5e');
        line(x, [[hx, hy - 10.5], [hx, hy - 14]], 1, INK);
        ell(x, hx - 0.4, hy - 15, 2.4, 2, 0, '#b8352a');
        if (o.elite) { line(x, [[hx, hy - 16], [hx - 7, hy - 21], [hx - 12, hy - 19]], 1.4, '#b8352a'); }
        break;
      }
      case 'steppe': {
        // 尖顶盔、皮毛帽檐、后垂护颈
        poly(x, [[hx - 6.5, hy - 2.5], [hx - 3, hy - 9.5], [hx + 0.5, hy - 15], [hx + 3.5, hy - 9.5], [hx + 6.5, hy - 2.5]], o.elite ? '#4a4034' : steel, INK, 0.8);
        x.beginPath(); x.moveTo(hx - 6.5, hy - 2); x.quadraticCurveTo(hx - 10, hy + 4, hx - 7.5, hy + 9); x.lineTo(hx - 3, hy + 6); x.lineTo(hx - 3, hy - 1); x.closePath();
        x.fillStyle = rgba(color, 0.95); x.fill(); x.strokeStyle = INK; x.lineWidth = 0.6; x.stroke();
        ell(x, hx, hy - 2.6, 7.4, 2, 0, '#6b5238', INK, 0.5);
        line(x, [[hx + 0.5, hy - 15], [hx + 0.5, hy - 17.5]], 1, INK);
        if (gold) line(x, [[hx - 3, hy - 9.5], [hx + 3.5, hy - 9.5]], 1, gold);
        break;
      }
      case 'islam': {
        // 缠头盔：尖盔外缠头巾
        poly(x, [[hx - 4.5, hy - 6], [hx + 0.5, hy - 16], [hx + 5, hy - 6]], o.elite ? '#8f7a3a' : steel, INK, 0.7);
        ell(x, hx, hy - 4.4, 7.2, 3.4, 0, '#f1e9d6', INK, 0.6);
        curve(x, [hx - 6.6, hy - 4], [hx, hy - 1.6], [hx + 6.8, hy - 5.4], 0.5, 'rgba(60,50,40,0.6)');
        curve(x, [hx - 6.4, hy - 6], [hx, hy - 4], [hx + 6.4, hy - 6.8], 0.5, 'rgba(60,50,40,0.6)');
        if (o.mail) { x.beginPath(); x.moveTo(hx - 6.5, hy - 2); x.lineTo(hx - 7, hy + 7); x.lineTo(hx - 2.5, hy + 7.5); x.lineTo(hx - 3, hy - 1); x.closePath(); x.fillStyle = steel; x.fill(); }
        break;
      }
      case 'euro': {
        if (o.great) {
          // 平顶大盔
          x.beginPath(); x.moveTo(hx - 6.6, hy - 9); x.lineTo(hx + 6.8, hy - 9); x.lineTo(hx + 7, hy + 6.5); x.lineTo(hx - 6.8, hy + 7); x.closePath();
          x.fillStyle = '#86847f'; x.fill(); x.strokeStyle = INK; x.lineWidth = 0.8; x.stroke();
          line(x, [[hx - 1, hy - 1.6], [hx + 7, hy - 1.6]], 1.3, INK);
          line(x, [[hx + 3.4, hy + 0.5], [hx + 3.4, hy + 6]], 0.7, INK);
          if (o.crest) { ell(x, hx, hy - 11.5, 4, 2.6, 0, color, INK, 0.5); }
        } else {
          // 护鼻尖盔 + 锁子头巾
          x.beginPath(); x.moveTo(hx - 7.2, hy - 1); x.lineTo(hx - 7.6, hy + 8); x.lineTo(hx + 1, hy + 8.4); x.lineTo(hx + 1, hy + 4); x.lineTo(hx - 3, hy + 3); x.lineTo(hx - 3, hy - 1); x.closePath();
          x.fillStyle = '#8b8a85'; x.fill(); mail(x, hx - 8, hy - 1, hx + 2, hy + 9, 'rgba(40,40,40,0.55)');
          poly(x, [[hx - 6.8, hy - 2], [hx, hy - 12.5], [hx + 6.8, hy - 2]], '#8a8984', INK, 0.8);
          line(x, [[hx + 4.6, hy - 2.4], [hx + 5.3, hy + 2.6]], 1.4, '#6f6d68');
        }
        break;
      }
      case 'byz': {
        // 洋葱尖盔 + 锁子护颈
        x.beginPath(); x.moveTo(hx - 6.6, hy - 2.4); x.quadraticCurveTo(hx - 7, hy - 10, hx, hy - 12); x.quadraticCurveTo(hx + 7, hy - 10, hx + 6.6, hy - 2.4); x.closePath();
        x.fillStyle = o.elite ? '#9c8442' : '#7d7a73'; x.fill(); x.strokeStyle = INK; x.lineWidth = 0.8; x.stroke();
        line(x, [[hx, hy - 12], [hx, hy - 16]], 1, INK);
        x.beginPath(); x.moveTo(hx - 6.6, hy - 2); x.lineTo(hx - 7.4, hy + 7.5); x.lineTo(hx - 2.6, hy + 7.8); x.lineTo(hx - 3, hy - 1); x.closePath();
        x.fillStyle = '#7d7a73'; x.fill(); mail(x, hx - 8, hy - 2, hx - 2, hy + 8, 'rgba(30,30,30,0.6)');
        break;
      }
      case 'south': {
        // 包头巾、顶髻
        x.beginPath(); x.moveTo(hx - 6.2, hy - 1.5); x.quadraticCurveTo(hx - 6.5, hy - 8.5, hx, hy - 8.6); x.quadraticCurveTo(hx + 6.4, hy - 8.5, hx + 6, hy - 2.8); x.quadraticCurveTo(hx, hy - 5, hx - 6.2, hy - 1.5);
        x.fillStyle = o.elite ? '#c9a23a' : color; x.fill(); x.strokeStyle = INK; x.lineWidth = 0.6; x.stroke();
        ell(x, hx - 1.5, hy - 10, 2.4, 2.2, 0, o.elite ? '#c9a23a' : shade(color, -0.25), INK, 0.5);
        line(x, [[hx - 6, hy - 3], [hx - 10, hy + 2]], 1.2, color);
        break;
      }
      case 'tibet': {
        // 宽檐毡帽、皮毛
        ell(x, hx, hy - 3.2, 8.4, 2.4, 0, '#7a5a3a', INK, 0.6);
        x.beginPath(); x.moveTo(hx - 5, hy - 4); x.quadraticCurveTo(hx - 4, hy - 13, hx + 1, hy - 13); x.quadraticCurveTo(hx + 6, hy - 12, hx + 5, hy - 4); x.closePath();
        x.fillStyle = o.elite ? '#c9a23a' : '#a33a2c'; x.fill(); x.strokeStyle = INK; x.lineWidth = 0.6; x.stroke();
        line(x, [[hx - 6, hy - 2], [hx - 9, hy + 8]], 1.6, '#2a241e');
        break;
      }
      case 'wa': {
        // 盔：层叠护颈、前立
        x.beginPath(); x.moveTo(hx - 6, hy - 3); x.quadraticCurveTo(hx - 6.5, hy - 11, hx, hy - 11); x.quadraticCurveTo(hx + 6.5, hy - 11, hx + 6, hy - 3); x.closePath();
        x.fillStyle = '#2f2a25'; x.fill(); x.strokeStyle = INK; x.lineWidth = 0.7; x.stroke();
        for (let k = 0; k < 3; k++) {
          x.beginPath(); x.moveTo(hx - 5.5, hy - 3 + k * 2.6); x.quadraticCurveTo(hx - 10 - k * 1.5, hy - 1 + k * 3, hx - 11 - k * 1.6, hy + 2 + k * 3);
          x.lineTo(hx - 8 - k, hy + 2 + k * 3.2); x.quadraticCurveTo(hx - 6, hy + k * 2.4, hx - 3, hy - 1 + k * 2.4); x.closePath();
          x.fillStyle = k & 1 ? rgba(color, 0.95) : '#3a332c'; x.fill(); x.strokeStyle = INK; x.lineWidth = 0.4; x.stroke();
        }
        x.beginPath(); x.moveTo(hx + 1, hy - 9); x.quadraticCurveTo(hx - 2, hy - 15, hx - 3.5, hy - 19); x.moveTo(hx + 2, hy - 9); x.quadraticCurveTo(hx + 6, hy - 14, hx + 7, hy - 19);
        x.strokeStyle = '#c9a23a'; x.lineWidth = 1.2; x.stroke();
        break;
      }
    }
  }

  // ---------- 躯干 ----------
  function armorCol(st, elite) {
    if (st === 'euro' || st === 'byz') return '#8b8984';
    if (st === 'south') return null;
    if (st === 'islam') return '#7b7770';
    return elite ? '#2d2924' : '#3d372f';
  }
  // 立姿躯干：髋部在 (0,0)，肩部约 (0,-18)
  function torso(x, st, color, sk, o) {
    o = o || {};
    const ac = armorCol(st, o.elite);
    // 下摆（袍）
    poly(x, [[-8.5, -4], [8.5, -4], [11.5, 11], [-11.5, 11]], color, INK, 0.7);
    if (ac) {
      // 甲裙
      x.beginPath(); x.moveTo(-8.6, -5); x.lineTo(8.6, -5); x.lineTo(10, 7); x.lineTo(1, 8); x.lineTo(0, 3); x.lineTo(-1, 8); x.lineTo(-10, 7); x.closePath();
      x.fillStyle = ac; x.fill(); x.strokeStyle = INK; x.lineWidth = 0.7; x.stroke();
      if (st === 'euro' || st === 'byz' || st === 'islam') mail(x, -11, -6, 11, 9, 'rgba(30,30,30,0.5)');
      else lamellar(x, -11, -6, 11, 9, 'rgba(230,215,180,0.24)', 3.2);
    }
    // 胸背
    x.beginPath(); x.moveTo(-7.5, -19); x.lineTo(7.8, -19); x.quadraticCurveTo(9.5, -10, 8.6, -4); x.lineTo(-8.6, -4); x.quadraticCurveTo(-9.5, -10, -7.5, -19); x.closePath();
    if (st === 'euro') {
      x.fillStyle = color; x.fill(); x.strokeStyle = INK; x.lineWidth = 0.7; x.stroke();
      // 罩袍十字
      line(x, [[0.5, -17], [0.5, -6]], 1.6, '#f1e9d6'); line(x, [[-4.5, -13.5], [5.5, -13.5]], 1.6, '#f1e9d6');
    } else if (!ac) {
      x.fillStyle = color; x.fill(); x.strokeStyle = INK; x.lineWidth = 0.7; x.stroke();
      line(x, [[-6, -19], [5, -7]], 1.4, o.elite ? '#c9a23a' : '#efe3c8');
    } else {
      x.fillStyle = ac; x.fill(); x.strokeStyle = INK; x.lineWidth = 0.7; x.stroke();
      if (st === 'byz' || st === 'islam') mail(x, -10, -20, 10, -3, 'rgba(30,30,30,0.5)');
      else lamellar(x, -10, -20, 10, -3, 'rgba(230,215,180,0.24)', 3.2);
      // 束甲带
      line(x, [[-8.4, -6.5], [8.4, -6.5]], 1.4, color);
      if (st === 'han' || st === 'steppe') ell(x, 1.5, -13, 2.8, 2.8, 0, o.elite ? '#c9a23a' : '#a9a294', INK, 0.5); // 护心镜
      if (st === 'islam') { poly(x, [[-6, -19], [6, -19], [3, -8], [-3, -8]], rgba(color, 0.9)); }
    }
    // 肩
    if (ac || st === 'euro') {
      ell(x, -7, -17.5, 4.2, 3, -0.3, st === 'euro' ? '#8b8984' : color, INK, 0.6);
    }
    // 颈
    x.fillStyle = sk; x.fillRect(-1.8, -22, 3.6, 3.4);
  }
  function legs(x, st, color, pose) {
    const trou = st === 'south' ? shade(color, -0.35) : '#2e2924';
    const boot = st === 'euro' || st === 'byz' ? '#5d5a55' : '#1f1b17';
    const sp = pose === 'wide' ? 1.4 : 1;
    line(x, [[-3, 8], [-6 * sp, 20], [-8 * sp, 30]], 3.4, trou);
    line(x, [[3, 8], [6 * sp, 19], [8 * sp, 30]], 3.4, trou);
    line(x, [[-8 * sp, 30], [-4.5 * sp, 30.6]], 2.4, boot); line(x, [[8 * sp, 30], [11.5 * sp, 30.4]], 2.4, boot);
    if (st === 'south') { line(x, [[-6.5 * sp, 23], [-8 * sp, 29]], 2.2, '#d4aa7c'); line(x, [[6.6 * sp, 22], [8 * sp, 29]], 2.2, '#d4aa7c'); }
  }
  function arm(x, from, mid, to, col, sk) {
    line(x, [from, mid, to], 3, col || '#3d372f');
    ell(x, to[0], to[1], 1.6, 1.6, 0, sk || '#e8cda6');
  }

  // ---------- 盾 ----------
  function shield(x, st, cx, cy, color, s) {
    s = s || 1;
    x.save(); x.translate(cx, cy); x.scale(s, s);
    if (st === 'han') {
      // 旁牌（长圆牌）带兽面
      ell(x, 0, 0, 6.8, 11.5, 0, shade(color, -0.1), INK, 1);
      ell(x, 0, 0, 5, 9.5, 0, null, 'rgba(240,225,190,0.5)', 0.6);
      ell(x, -1.8, -2.5, 1.1, 0.8, 0, '#f1e1b8'); ell(x, 1.8, -2.5, 1.1, 0.8, 0, '#f1e1b8');
      curve(x, [-2.6, 2.4], [0, 4.6], [2.6, 2.4], 0.8, '#f1e1b8');
    } else if (st === 'euro') {
      x.beginPath(); x.moveTo(-6.5, -10); x.quadraticCurveTo(0, -12.5, 6.5, -10); x.quadraticCurveTo(7, 2, 0, 13); x.quadraticCurveTo(-7, 2, -6.5, -10); x.closePath();
      x.fillStyle = color; x.fill(); x.strokeStyle = INK; x.lineWidth = 1; x.stroke();
      x.beginPath(); x.moveTo(-6.5, -3); x.lineTo(0, 3.5); x.lineTo(6.6, -3); x.strokeStyle = '#efe3c8'; x.lineWidth = 2; x.stroke();
    } else if (st === 'south') {
      ell(x, 0, 0, 8.4, 8.4, 0, '#b89a5c', INK, 1);
      for (let r = 2.5; r < 8; r += 2) ell(x, 0, 0, r, r, 0, null, 'rgba(70,50,25,0.55)', 0.5);
      ell(x, 0, 0, 1.6, 1.6, 0, color);
    } else if (st === 'wa') {
      // 无盾
    } else {
      ell(x, 0, 0, 8.4, 8.4, 0, st === 'islam' ? '#e9dfc6' : shade(color, -0.05), INK, 1);
      ell(x, 0, 0, 6.2, 6.2, 0, null, st === 'islam' ? rgba(color, 0.9) : 'rgba(240,225,190,0.5)', st === 'islam' ? 1.6 : 0.6);
      ell(x, 0, 0, 2, 2, 0, '#8a8478', INK, 0.5);
    }
    x.restore();
  }

  // ---------- 立姿兵卒 ----------
  // 足底中心 (fx, fy)，s 缩放；人高约 60*s
  function footman(x, fx, fy, s, k, st, cul, color, sk, o) {
    o = o || {};
    x.save(); x.translate(fx, fy - 30 * s); x.scale(s, s);
    // 以髋为原点
    const ac = armorCol(st, o.elite) || shade(color, -0.2);
    if (k === 'inf') {
      line(x, [[-12, 24], [22, o.pike ? -57 : -48]], o.pike ? 2.2 : 1.5, '#5a4632');
      if (o.axe) {
        poly(x, [[19, -46], [22, -51], [34, -53], [33, -43], [28, -37], [24, -45]], '#98938a', INK, 0.7);
      } else if (o.pike) {
        poly(x, [[22, -54], [20, -59], [26, -69], [26, -58]], '#a29d8d', INK, 0.7);
        ell(x, 22, -54, 2, 1.5, 0, '#ac3931');
      } else {
        poly(x, [[22, -48], [21.6, -55], [25.5, -50.6]], '#8a8984', INK, 0.5);
        ell(x, 21, -46.5, 1.8, 1.4, 0, '#b8352a');
      }
      legs(x, st, color, 'wide');
      torso(x, st, color, sk, o);
      if (o.armored) {
        poly(x, [[-10,-22],[-4,-25],[3,-22],[1,-15],[-9,-15]], '#62686a', INK, 0.8);
        for (const y of [-21,-18,-15]) line(x, [[-8,y],[1,y]], 0.7, '#c0b8a7');
      }
      head(x, 1, -28.5, st, sk, color, o);
      arm(x, [-6, -17], [-3, -8], [4.2, -12.5], ac, sk);   // 后臂握枪
      if (o.armored) {
        poly(x, [[3,-14],[16,-14],[16,7],[9,13],[3,7]], '#363c3c', INK, 1.4);
        line(x, [[5,-12],[14,-12],[14,6],[9,10],[5,6],[5,-12]], 0.7, '#baaa83');
        ell(x, 9, -2, 2.5, 2.5, 0, shade(color, 0.15), '#cab78f', 0.7);
      } else shield(x, st, 9, -7, color, 1);
      if (st === 'wa') arm(x, [5, -17], [9, -10], [10.5, -17.5], ac, sk);
      else arm(x, [5, -17], [8, -12], [8.6, -8], ac, sk);
    } else if (k === 'bow') {
      legs(x, st, color, 'wide');
      if (CROSSBOW[cul] || o.crossbow) {
        torso(x, st, color, sk, o);
        head(x, 1, -28.5, st, sk, color, o);
        // 神臂弩平端
        line(x, [[-3, -20], [24, -22.5]], 2.2, '#5a4632');
        curve(x, [22, -32], [27.5, -22.5], [22, -13], 1.8, INK);
        line(x, [[22, -32], [14, -22], [22, -13]], 0.5, 'rgba(34,30,25,0.8)');
        line(x, [[14, -22.5], [26, -23.2]], 0.7, '#3a3027');
        arm(x, [-5, -17], [-1, -14], [5, -20], ac, sk);
        arm(x, [5, -17], [10, -16], [14, -22], ac, sk);
        // 箭囊
        poly(x, [[-10, -16], [-6, -18], [-3, -2], [-7, -1]], '#5d4a35', INK, 0.5);
      } else {
        torso(x, st, color, sk, o);
        head(x, 1, -28.5, st, sk, color, o);
        // 张弓满月
        const top = o.longbow ? -54 : -44, tip = o.longbow ? 8 : -2;
        x.beginPath(); x.moveTo(17, top); x.bezierCurveTo(26, top + 8, 26, tip - 8, 17, tip); x.lineWidth = 1.9; x.strokeStyle = INK; x.stroke();
        line(x, [[17, top], [3, -24], [17, tip]], 0.5, 'rgba(34,30,25,0.85)');
        line(x, [[3, -24], [28, -23.5]], 0.8, '#5a4632');
        poly(x, [[28, -23.5], [25.5, -25], [25.5, -22]], INK);
        arm(x, [5, -17], [13, -21], [23.2, -23.4], ac, sk);
        arm(x, [-5, -17], [-3, -21], [3, -24], ac, sk);
        poly(x, [[-10, -16], [-6, -18], [-3, -2], [-7, -1]], '#5d4a35', INK, 0.5);
        line(x, [[-8, -17], [-9.5, -22]], 0.6, INK); line(x, [[-6.5, -17.5], [-7, -23]], 0.6, INK);
      }
    } else if (k === 'fire') {
      legs(x, st, color, 'wide');
      torso(x, st, color, sk, o);
      head(x, 1, -28.5, st, sk, color, o);
      // 突火枪：竹筒长柄
      line(x, [[-6, -6], [16, -22]], 1.8, '#5a4632');
      line(x, [[14, -20.5], [29, -31]], 4, st === 'euro' || st === 'byz' ? '#5d5a55' : '#6e5a35');
      for (let i = 0; i < 3; i++) { const t = 0.25 + i * 0.28; line(x, [[14 + 15 * t - 1.2, -20.5 - 10.5 * t - 1.8], [14 + 15 * t + 1.2, -20.5 - 10.5 * t + 1.8]], 0.8, INK); }
      // 火光与烟
      poly(x, [[29.5, -31.5], [36, -37], [33, -31], [37.5, -29], [31, -29.5]], '#d9822b');
      ell(x, 31, -32, 1.8, 1.6, 0, '#f2c14e');
      x.save(); x.globalAlpha = 0.45;
      ell(x, 38, -41, 5.5, 4, 0, '#8c8478'); ell(x, 44, -46, 6.5, 4.6, 0, '#a59d90'); ell(x, 34, -45, 4, 3, 0, '#9a9284');
      x.restore();
      arm(x, [-5, -17], [0, -11], [6, -14.5], ac, sk);
      arm(x, [5, -17], [11, -16], [17, -23], ac, sk);
      // 火药葫芦
      ell(x, -7, 1, 2.4, 3, 0, '#8a6a32', INK, 0.5);
      // 引火绳
      curve(x, [6, -14.5], [3, -5], [8, 2], 0.6, '#b8352a');
    }
    x.restore();
  }

  // ---------- 马 ----------
  // 马蹄落地 y=0，中心 x=0，面右；马身约 54 宽
  function horse(x, o) {
    const body = o.coat || '#5c4835';
    const ink = INK;
    const stroke = (pts, w, c) => line(x, pts, w, c || body);
    // 后侧腿（远）
    stroke([[-17, -22], [-23, -12], [-29, -2]], 3.2, shade(body, -0.25));
    stroke([[14, -22], [22, -15], [27, -9]], 3.2, shade(body, -0.25));
    // 尾
    x.beginPath(); x.moveTo(-23, -31); x.quadraticCurveTo(-33, -30, -38, -18); x.quadraticCurveTo(-33, -25, -24, -27);
    x.fillStyle = '#231e19'; x.fill();
    // 身
    x.beginPath();
    x.moveTo(-24, -30); x.bezierCurveTo(-25, -40, -12, -40, 0, -38.5); x.bezierCurveTo(10, -38, 14, -42, 19, -46);
    x.lineTo(26, -60); x.quadraticCurveTo(29, -64, 33, -62); x.lineTo(41, -53); x.quadraticCurveTo(42.5, -50, 39.5, -49.5); x.lineTo(33, -52); x.quadraticCurveTo(29, -44, 24, -34);
    x.bezierCurveTo(22, -24, 12, -22, 0, -22.5); x.bezierCurveTo(-12, -22, -22, -22, -24, -30); x.closePath();
    x.fillStyle = body; x.fill(); x.strokeStyle = ink; x.lineWidth = 0.9; x.stroke();
    // 明暗
    x.save(); x.clip(); wash(x, 2, -36, 22, 8, '#f3e7cc', 0.22); x.restore();
    // 鬃
    x.beginPath(); x.moveTo(18, -47); x.quadraticCurveTo(22, -58, 30, -63); x.lineTo(28, -57); x.quadraticCurveTo(23, -52, 20, -44); x.closePath(); x.fillStyle = '#1f1a16'; x.fill();
    ell(x, 33.5, -57.5, 0.9, 0.8, 0, ink);
    line(x, [[31, -63], [30, -66.5]], 1.2, '#231e19');
    // 近侧腿
    stroke([[-20, -25], [-17, -12], [-21, -1]], 3.6);
    stroke([[17, -26], [14, -13], [17, -1]], 3.6);
    for (const [hx2, hy2] of [[-21, -1], [17, -1], [-29, -2], [27, -9]]) ell(x, hx2 + 1, hy2 + 0.5, 2.2, 1.2, 0, '#1a1612');
    // 鞍辔
    line(x, [[33, -60], [38, -52], [24, -46]], 0.6, '#3a2a1a');
    if (o.barding) {
      // 马铠
      x.beginPath();
      x.moveTo(-24, -32); x.bezierCurveTo(-24, -40, -10, -40, 2, -38.5); x.lineTo(20, -46); x.lineTo(29, -59); x.lineTo(35, -55); x.lineTo(26, -42);
      x.bezierCurveTo(25, -32, 21, -25, 16, -22); x.lineTo(-20, -21); x.quadraticCurveTo(-25, -24, -24, -32); x.closePath();
      x.fillStyle = o.bardCol || '#3a342d'; x.fill(); x.strokeStyle = ink; x.lineWidth = 0.8; x.stroke();
      if (o.mail) mail(x, -26, -62, 36, -20, 'rgba(30,30,30,0.3)'); else lamellar(x, -26, -62, 36, -20, 'rgba(230,215,180,0.2)', 3.4);
      // 缘饰
      line(x, [[-20, -21], [16, -22]], 1.8, o.trim || '#b8352a');
      for (let i = -18; i < 16; i += 3.4) line(x, [[i, -21.5], [i - 0.4, -18.6]], 1, o.trim || '#b8352a');
    } else {
      // 鞍褥
      poly(x, [[-9, -39], [6, -39], [8, -27], [-10, -27]], o.saddle || '#b8352a', ink, 0.6);
    }
  }

  // 骑手：鞍上 (0,-38) 起
  function rider(x, k, st, cul, color, sk, o) {
    o = o || {};
    const ac = armorCol(st, o.elite) || shade(color, -0.2);
    x.save(); x.translate(-1, -37);
    // 腿
    line(x, [[0, 0], [6, 6], [4, 14]], 3.4, st === 'south' ? shade(color, -0.35) : '#2e2924');
    line(x, [[4, 14], [7.5, 14.4]], 2.4, '#1f1b17');
    x.save(); x.scale(0.92, 0.92); x.translate(0, 2);
    // 上身（复用躯干但去下摆）
    torso(x, st, color, sk, o);
    head(x, 1, -28.5, st, sk, color, o);
    x.restore();
    if (k === 'cav') {
      if (st === 'euro' || st === 'han' || st === 'byz') {
        // 平端长枪
        line(x, [[-18, -12], [40, -24]], 1.6, '#5a4632');
        poly(x, [[40, -24], [46, -25.6], [40.4, -21.6]], '#8a8984', INK, 0.4);
        if (st === 'euro') poly(x, [[34, -23], [30, -29], [27, -21.8]], color, INK, 0.4);
        else ell(x, 38, -22, 1.6, 1.3, 0, '#b8352a');
        arm(x, [4, -16], [10, -12], [16, -15.5], ac, sk);
        shield(x, st, -4, -10, color, 0.75);
      } else {
        // 高举弯刀
        arm(x, [4, -16], [10, -22], [12, -30], ac, sk);
        x.beginPath(); x.moveTo(12, -30); x.quadraticCurveTo(10, -42, 2, -50); x.lineWidth = 1.7; x.strokeStyle = '#8f8d88'; x.lineCap = 'round'; x.stroke();
        line(x, [[10.5, -31], [13.5, -29]], 1.4, INK);
        shield(x, st, -5, -10, color, 0.7);
      }
    } else if (k === 'hbow') {
      x.beginPath(); x.moveTo(18, -38); x.bezierCurveTo(25, -31, 25, -11, 18, -4); x.lineWidth = 1.7; x.strokeStyle = INK; x.stroke();
      line(x, [[18, -38], [6, -21], [18, -4]], 0.5, 'rgba(34,30,25,0.85)');
      line(x, [[6, -21], [28, -21]], 0.8, '#5a4632');
      poly(x, [[28, -21], [25.5, -22.5], [25.5, -19.5]], INK);
      arm(x, [5, -16], [13, -19], [22.5, -21], ac, sk);
      arm(x, [-4, -16], [-1, -20], [6, -21], ac, sk);
      poly(x, [[-12, -4], [-7, -6], [-4, 6], [-9, 7]], '#5d4a35', INK, 0.5);
    } else if (k === 'hcav') {
      line(x, [[-20, -10], [44, -20]], 2, '#4a3a2a');
      poly(x, [[44, -20], [51, -21], [44.4, -17.5]], '#8a8984', INK, 0.4);
      if (st === 'euro') poly(x, [[37, -19], [32, -27], [29, -18]], color, INK, 0.4);
      else ell(x, 41, -18.5, 1.8, 1.5, 0, '#b8352a');
      arm(x, [4, -16], [10, -11], [16, -12], ac, sk);
      if (st !== 'wa') shield(x, st, -5, -10, color, 0.72);
    } else if (k === 'elite') {
      // 背旗
      line(x, [[-6, -14], [-10, -52]], 1.1, '#3a2a1a');
      poly(x, [[-10, -52], [-26, -50], [-25, -36], [-8.6, -38]], color, INK, 0.6);
      line(x, [[-10, -52], [-26, -50]], 1, '#c9a23a');
      line(x, [[-25, -36], [-8.6, -38]], 1, '#c9a23a');
      // 偃月大刀
      arm(x, [4, -16], [11, -20], [14, -27], ac, sk);
      line(x, [[2, 4], [24, -54]], 1.8, '#4a3a2a');
      x.beginPath(); x.moveTo(23, -50); x.quadraticCurveTo(31, -56, 28, -66); x.quadraticCurveTo(26, -58, 21.5, -55); x.closePath();
      x.fillStyle = '#a7a5a0'; x.fill(); x.strokeStyle = INK; x.lineWidth = 0.6; x.stroke();
      ell(x, 22, -50, 2, 1.4, 0.5, '#b8352a');
    }
    x.restore();
  }

  function mounted(x, fx, fy, s, k, st, cul, color, sk, o) {
    o = o || {};
    x.save(); x.translate(fx, fy); x.scale(s, s);
    const heavy = k === 'hcav' || k === 'elite';
    const coat = st === 'steppe' || st === 'tibet' ? '#7a6447' : st === 'euro' ? '#4a3c30' : st === 'islam' ? '#9a8466' : '#5c4835';
    horse(x, {
      coat, barding: heavy,
      bardCol: st === 'euro' ? color : heavy && o.elite ? '#2b2621' : '#3a342d',
      mail: st === 'euro' || st === 'byz' || st === 'islam',
      trim: o.elite ? '#c9a23a' : st === 'euro' ? '#efe3c8' : '#b8352a',
      saddle: color,
    });
    rider(x, k, st, cul, color, sk, o);
    x.restore();
  }

  // ---------- 砲车 ----------
  function siege(x, st, cul, color, sk) {
    const wood = '#5a4632', dark = '#3a2b1d';
    // 架
    line(x, [[38, 88], [52, 44]], 2.6, wood); line(x, [[68, 88], [54, 44]], 2.6, wood);
    line(x, [[44, 70], [62, 70]], 1.8, wood);
    line(x, [[30, 88], [76, 88]], 2.6, dark);
    ell(x, 53, 44, 2.2, 2.2, 0, dark);
    // 梢杆
    line(x, [[18, 22], [68, 54]], 2.8, wood);
    // 投索与石
    curve(x, [18, 22], [10, 34], [14, 46], 0.7, INK);
    ell(x, 14, 47, 3.4, 3, 0, '#77716a', INK, 0.6);
    const traction = st === 'han' || st === 'steppe' || st === 'tibet' || st === 'wa';
    if (traction) {
      // 拽索
      for (const tx of [62, 66, 70]) line(x, [[68, 54], [tx + 6, 68]], 0.6, 'rgba(34,30,25,0.8)');
      // 拽砲手
      for (let i = 0; i < 2; i++) {
        const bx = 76 + i * 9, by = 88;
        x.save(); x.translate(bx, by); x.scale(0.42, 0.42); x.translate(0, -30);
        legs(x, st, color, 'wide'); torso(x, st, color, sk, {}); head(x, 1, -28.5, st, sk, color, {});
        arm(x, [-4, -17], [-10, -22], [-16, -30], '#3d372f', sk);
        x.restore();
      }
    } else {
      // 配重箱
      poly(x, [[62, 54], [74, 54], [76, 68], [60, 68]], dark, INK, 0.8);
      line(x, [[62, 58], [74, 58]], 0.6, 'rgba(230,215,180,0.4)');
      x.save(); x.translate(84, 88); x.scale(0.42, 0.42); x.translate(0, -30);
      legs(x, st, color, 'wide'); torso(x, st, color, sk, {}); head(x, 1, -28.5, st, sk, color, {});
      arm(x, [-4, -17], [-8, -14], [-14, -16], '#3d372f', sk);
      x.restore();
    }
    // 旗
    line(x, [[52, 44], [52, 18]], 1, dark);
    poly(x, [[52, 18], [64, 20], [61, 25], [52, 26]], color, INK, 0.5);
    // 飞石尘烟
    x.save(); x.globalAlpha = 0.35; ell(x, 30, 89, 10, 2.4, 0, '#5a5046'); x.restore();
  }

  // ---------- 舟师 ----------
  function navy(x, st, cul, color, sk, galley) {
    // 水波
    x.save();
    const g = x.createLinearGradient(0, 70, 0, 100); g.addColorStop(0, 'rgba(70,100,115,0.35)'); g.addColorStop(1, 'rgba(70,100,115,0.6)');
    x.fillStyle = g; x.fillRect(0, 74, 100, 26); x.restore();
    for (let i = 0; i < 4; i++) {
      x.beginPath();
      for (let px = -10 + i * 6; px < 110; px += 16) { x.moveTo(px, 80 + i * 5); x.quadraticCurveTo(px + 4, 77 + i * 5, px + 8, 80 + i * 5); }
      x.strokeStyle = 'rgba(34,40,45,0.5)'; x.lineWidth = 0.7; x.stroke();
    }
    const junk = st === 'han' || st === 'steppe' || st === 'wa' || st === 'tibet';
    const lateen = galley || st === 'islam' || st === 'south';
    const longship = NORSE_SAIL[cul];
    // 船身
    x.beginPath();
    if (longship) { x.moveTo(8, 62); x.quadraticCurveTo(14, 76, 30, 77); x.lineTo(72, 77); x.quadraticCurveTo(88, 76, 93, 60); x.lineTo(88, 66); x.lineTo(14, 67); x.closePath(); }
    else { x.moveTo(6, 60); x.lineTo(20, 62); x.lineTo(80, 62); x.lineTo(94, 54); x.quadraticCurveTo(90, 72, 76, 77); x.lineTo(24, 77); x.quadraticCurveTo(10, 72, 6, 60); x.closePath(); }
    x.fillStyle = '#4a3726'; x.fill(); x.strokeStyle = INK; x.lineWidth = 1; x.stroke();
    x.save(); x.clip(); for (let y = 64; y < 78; y += 3.4) line(x, [[0, y], [100, y]], 0.5, 'rgba(230,210,170,0.35)'); x.restore();
    if (galley) for (let i = 0; i < 7; i++) line(x, [[25 + 8 * i, 68], [19 + 8 * i, 84]], 1.1, '#7f6041');
    if (longship) { for (let i = 0; i < 6; i++) ell(x, 24 + i * 9, 66, 3, 3, 0, i & 1 ? color : '#d9cba8', INK, 0.5); line(x, [[93, 60], [96, 52]], 1.6, '#4a3726'); }
    if (!longship) {
      // 艉楼
      poly(x, [[10, 52], [26, 52], [26, 62], [8, 61]], '#5a4632', INK, 0.7);
      line(x, [[10, 52], [26, 52]], 1.4, color);
    }
    // 桅帆
    if (junk) {
      line(x, [[52, 62], [52, 10]], 1.6, '#3a2b1d');
      x.beginPath(); x.moveTo(53, 12); x.quadraticCurveTo(72, 14, 76, 18); x.lineTo(80, 56); x.quadraticCurveTo(66, 58, 53, 57); x.closePath();
      x.fillStyle = '#c7a978'; x.fill(); x.strokeStyle = INK; x.lineWidth = 0.8; x.stroke();
      for (let y = 18; y < 56; y += 6) curve(x, [53, y], [66, y + 1.2], [77.6 + (y - 18) * 0.06, y + 1.5], 0.6, 'rgba(60,40,20,0.7)');
      line(x, [[32, 62], [32, 30]], 1.2, '#3a2b1d');
      x.beginPath(); x.moveTo(33, 31); x.lineTo(46, 34); x.lineTo(47, 58); x.lineTo(33, 57); x.closePath();
      x.fillStyle = '#bea06f'; x.fill(); x.strokeStyle = INK; x.lineWidth = 0.6; x.stroke();
      for (let y = 37; y < 57; y += 5) line(x, [[33, y], [46.5, y + 0.6]], 0.5, 'rgba(60,40,20,0.7)');
    } else if (lateen) {
      line(x, [[54, 62], [54, 20]], 1.6, '#3a2b1d');
      line(x, [[30, 56], [78, 8]], 1.2, '#3a2b1d');
      x.beginPath(); x.moveTo(78, 8); x.lineTo(32, 55); x.quadraticCurveTo(58, 52, 76, 56); x.quadraticCurveTo(82, 32, 78, 8); x.closePath();
      x.fillStyle = '#ece2c9'; x.fill(); x.strokeStyle = INK; x.lineWidth = 0.8; x.stroke();
      line(x, [[60, 50], [77, 26]], 2, rgba(color, 0.8));
    } else {
      line(x, [[50, 64], [50, 10]], 1.6, '#3a2b1d');
      line(x, [[30, 16], [70, 16]], 1.2, '#3a2b1d');
      x.beginPath(); x.moveTo(31, 17); x.quadraticCurveTo(50, 20, 69, 17); x.quadraticCurveTo(73, 38, 69, 56); x.quadraticCurveTo(50, 58, 31, 56); x.quadraticCurveTo(27, 38, 31, 17); x.closePath();
      x.fillStyle = '#ece2c9'; x.fill();
      x.save(); x.clip(); for (let i = 0; i < 3; i++) { x.fillStyle = rgba(color, 0.85); x.fillRect(34 + i * 13, 10, 6, 52); } x.restore();
      x.strokeStyle = INK; x.lineWidth = 0.8; x.stroke();
    }
    // 旗
    const mx = junk ? 52 : lateen ? 54 : 50, top = junk ? 10 : lateen ? 20 : 10;
    poly(x, [[mx, top], [mx + 12, top + 2], [mx, top + 6]], color, INK, 0.4);
    // 兵卒小影
    for (let i = 0; i < 3; i++) {
      const bx = 36 + i * 12;
      x.save(); x.translate(bx, 62); x.scale(0.3, 0.3); x.translate(0, -30);
      torso(x, st, color, sk, {}); head(x, 1, -28.5, st, sk, color, {});
      line(x, [[2, -18], [14, -42]], 1.8, '#5a4632');
      x.restore();
    }
  }

  function elephant(x, st, cul, color, sk) {
    const hide = '#777267', dark = '#49453d', gold = '#c9a23a';
    line(x, [[30, 65], [27, 82], [31, 88]], 7, dark);
    line(x, [[65, 66], [64, 86], [68, 88]], 7, dark);
    curve(x, [21, 55], [11, 60], [14, 76], 1.8, dark);
    ell(x, 47, 59, 29, 20, 0.04, hide, INK, 0.9);
    line(x, [[27, 65], [24, 87], [28, 88]], 8, hide);
    line(x, [[66, 67], [69, 88], [73, 88]], 8, hide);
    poly(x, [[30, 40], [59, 39], [62, 65], [33, 66]], color, INK, 0.9);
    line(x, [[33, 62], [60, 61]], 1.4, gold);
    footman(x, 46, 39, 0.48, 'inf', st, cul, color, sk, { elite: true });
    ell(x, 73, 52, 14, 14, 0.24, hide, INK, 0.9);
    ell(x, 68, 57, 7, 10, -0.28, '#645e56', dark, 0.7);
    curve(x, [83, 57], [92, 75], [91, 67], 7, hide);
    curve(x, [81, 60], [91, 62], [95, 55], 2.2, '#ede2c7');
    ell(x, 80, 51, 1.2, 0.9, 0, INK);
    line(x, [[73, 42], [83, 45], [86, 50]], 1.5, color);
  }

  // ---------- 组合 ----------
  function paint(t, cul, color) {
    const c = document.createElement('canvas'); c.width = c.height = SZ;
    const x = c.getContext('2d');
    x.scale(SZ / 100, SZ / 100);
    const st = style(cul), sk = skin(cul);
    paper(x, color, seedOf(t + cul));
    const id = t;
    const unit = DATA.UNITS[t];
    t = DATA.unitBase(t);
    const elite = t === 'elite' || !!unit?.home || !!unit?.upgradeOnly;
    const o = { elite, great: st === 'euro' && (t === 'hcav' || t === 'elite'), crest: elite, beard: t === 'hcav' || elite, mail: t === 'hcav' || id === 'armored_inf' };
    const tradition = id.replace(/_guard$/, '');
    o.axe = tradition === 'byz_varangian';
    o.crossbow = tradition === 'daviet_bow' || id === 'shenbi';
    o.longbow = tradition === 'england_longbow';
    o.pike = id === 'pike' || id === 'armored_inf';
    o.armored = id === 'armored_inf';
    if (unit?.group === 'elephant') {
      elephant(x, st, cul, color, sk);
    } else if (id === 'bed_bow') {
      footman(x, 24, 84, 0.75, 'bow', st, cul, color, sk, { ...o, crossbow: true });
      line(x, [[45, 85], [59, 53], [74, 85]], 3, '#624b34');
      line(x, [[52, 68], [66, 68]], 2, '#624b34');
      poly(x, [[39, 55], [83, 47], [86, 51], [42, 60]], '#8b6a45', INK, 1.2);
      curve(x, [71, 30], [87, 48], [78, 73], 3, '#4e3a2a');
      line(x, [[71, 30], [56, 54], [78, 73]], 1.1, INK);
      line(x, [[53, 54], [92, 48]], 1.2, INK);
      poly(x, [[92, 48], [86, 46], [88, 51]], '#8b8479', INK, 0.7);
    } else if (t === 'inf' || t === 'bow' || t === 'fire') {
      // 后排虚影成阵
      x.save(); x.globalAlpha = 0.28;
      footman(x, 26, 80, 0.72, t, st, cul, '#6b6258', '#9b9080', o);
      footman(x, 76, 78, 0.66, t, st, cul, '#6b6258', '#9b9080', o);
      x.restore();
      footman(x, 46, 92, o.pike ? 0.92 : 1.05, t, st, cul, color, sk, o);
    } else if (t === 'cav' || t === 'hbow' || t === 'hcav' || t === 'elite') {
      x.save(); x.globalAlpha = 0.22;
      mounted(x, 22, 74, 0.55, t, st, cul, '#6b6258', '#9b9080', o);
      x.restore();
      mounted(x, 44, 92, elite || t === 'hcav' ? 0.98 : 1, t, st, cul, color, sk, o);
      if (t === 'cav' || t === 'hbow') { x.save(); x.globalAlpha = 0.35; ell(x, 10, 90, 9, 2.5, 0, '#6a5e50'); ell(x, 4, 87, 6, 2, 0, '#8a7e70'); x.restore(); }
    } else if (t === 'siege') {
      siege(x, st, cul, color, sk);
    } else if (t === 'navy') {
      navy(x, st, cul, color, sk, tradition === 'venice_galley');
    }
    if (id.endsWith('_guard') || id === 'guard_hbow') {
      poly(x, [[75, 29], [91, 29], [86, 37], [91, 44], [75, 43]], id === 'beiwei_guard' ? '#af884a' : shade(color, 0.15), INK, 0.8);
      line(x, [[75, 25], [75, 60]], 1.2, '#554532');
    }
    // 边框墨痕
    x.strokeStyle = 'rgba(34,30,25,0.55)'; x.lineWidth = 1.2; x.strokeRect(0.6, 0.6, 98.8, 98.8);
    return c;
  }

  function facInfo(f, t) {
    const F = typeof GAME !== 'undefined' && GAME.fac ? GAME.fac(f) : null;
    const home = DATA.UNITS[t]?.home;
    const native = home && (F ? GAME.fac(home) : DATA.FACTIONS.find(faction => faction.id === home));
    return { cul: native?.culture || F?.culture || 'han', color: F?.color || '#b3322a' };
  }
  // 取画布（缓存）
  function get(t, cul, color) {
    const key = t + '|' + style(cul) + '|' + (CROSSBOW[cul] ? 1 : 0) + (NORSE_SAIL[cul] ? 1 : 0) + '|' + skin(cul) + '|' + color;
    let c = cache.get(key);
    if (!c) { c = paint(t, cul, color); cache.set(key, c); }
    return c;
  }
  function forFac(f, t) { const i = facInfo(f, t); return get(t, i.cul, i.color); }
  // 近景：按 CROP 截取主体，小尺寸时更易辨认
  function bust(c, t) {
    const box = crop(t), k = SZ / 100, sw = box[2] * k;
    const o = document.createElement('canvas'); o.width = o.height = 128;
    o.getContext('2d').drawImage(c, box[0] * k - sw / 2, box[1] * k - sw / 2, sw, sw, 0, 0, 128, 128);
    return o;
  }
  function url(f, t, close) {
    const i = facInfo(f, t);
    const key = t + '|' + i.cul + '|' + i.color + (close ? '|c' : '');
    let u = urls.get(key);
    if (!u) { const c = get(t, i.cul, i.color); u = (close ? bust(c, t) : c).toDataURL('image/png'); urls.set(key, u); }
    return u;
  }
  // HTML 小像：44 像素以下用近景
  function img(f, t, size, cls) {
    size = size || 32;
    return `<img class="unit-art${cls ? ' ' + cls : ''}" src="${url(f, t, size < 44)}" width="${size}" height="${size}" alt="" draggable="false">`;
  }
  // 画布上的圆章：用于六角小战场
  const CROP = { inf: [48, 58, 64], bow: [52, 58, 64], fire: [54, 56, 66], cav: [48, 56, 76], hbow: [48, 56, 76], hcav: [50, 54, 78], elite: [46, 52, 80], siege: [52, 52, 90], navy: [50, 46, 92] };
  Object.assign(CROP, { pike: [49, 52, 76], armored_inf: [49, 51, 78], shenbi: [52, 58, 68], bed_bow: [57, 58, 80],
    guard_hbow: [49, 54, 78], song_bazi: [48, 58, 64] });
  for (const id of Object.values(DATA.UPGRADES)) if (id.endsWith('_guard')) CROP[id] = CROP[DATA.unitBase(id)];
  CROP.beiwei_guard = [51, 48, 86];
  const ELEPHANT_CROP = [55, 50, 88];
  function crop(t) { return DATA.UNITS[t]?.group === 'elephant' ? ELEPHANT_CROP : CROP[t] || CROP[DATA.unitBase(t)] || CROP.inf; }
  function token(ctx, f, t, cx, cy, r, opt) {
    opt = opt || {};
    const c = forFac(f, t);
    const F = facInfo(f);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(cx + 1.5, cy + 2, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    // 取画面中部偏上，略放大
    const box = crop(t);   // [中心x, 中心y, 边长]
    const k = SZ / 100, sw = box[2] * k, sx = box[0] * k - sw / 2, sy = box[1] * k - sw / 2;
    if (opt.flip) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }
    ctx.drawImage(c, sx, sy, sw, sw, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = F.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = opt.sel ? '#d4a02a' : 'rgba(20,18,16,0.9)'; ctx.lineWidth = opt.sel ? 3.5 : 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, r + (opt.sel ? 2.4 : 1.6), 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  function clear() { cache.clear(); urls.clear(); }
  return { get, forFac, url, img, token, style, clear };
})();
