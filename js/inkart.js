// 水墨地形图块：预先以高分辨率绘制若干变体，地图每帧按格贴图，放大不糊。
// 坐标约定：图块以格心为原点，单位为世界像素（格半径 HS = 20）。
var INKART = (function () {
  const SR = 3;               // 图块分辨率倍数
  const BOX = { w: 64, h: 70, ax: 32, ay: 44 }; // 图块世界尺寸与格心锚点
  const cache = {};

  function rng(seed) {
    let a = seed >>> 0;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function mk() {
    const c = document.createElement('canvas');
    c.width = BOX.w * SR; c.height = BOX.h * SR;
    const g = c.getContext('2d');
    g.setTransform(SR, 0, 0, SR, BOX.ax * SR, BOX.ay * SR);
    g.lineCap = 'round'; g.lineJoin = 'round';
    return [c, g];
  }
  const ink = (a) => `rgba(34,34,30,${a})`;

  // 一笔有粗细变化的墨线：沿点列画两侧偏移的填充形
  function brush(g, pts, w0, w1, col) {
    if (pts.length < 2) return;
    const L = [], R = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      let dx = q[0] - o[0], dy = q[1] - o[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const t = i / (pts.length - 1), w = (w0 + (w1 - w0) * t) * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, t * 1.2 + 0.1))) / 2;
      L.push([p[0] - dy * w, p[1] + dx * w]); R.push([p[0] + dy * w, p[1] - dx * w]);
    }
    g.beginPath(); g.moveTo(L[0][0], L[0][1]);
    for (const p of L) g.lineTo(p[0], p[1]);
    for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
    g.closePath(); g.fillStyle = col; g.fill();
  }
  function wash(g, x, y, rx, ry, col, a) {
    g.save(); g.translate(x, y); g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
  }

  // ---------- 山 ----------
  function peak(g, r, px, by, w, h, opt) {
    const top = by - h, pk = px + (r() - 0.5) * w * 0.2;
    // 左右坡各两三处转折
    const left = [[px - w / 2, by]], right = [[pk, top]];
    const nk = 2 + (r() * 2 | 0);
    for (let k = 1; k <= nk; k++) { const t = k / (nk + 1); left.push([px - w / 2 + (pk - (px - w / 2)) * t + (r() - 0.5) * w * 0.08, by - h * Math.pow(t, 0.9) + (r() - 0.3) * h * 0.08]); }
    left.push([pk, top]);
    for (let k = 1; k <= nk; k++) { const t = k / (nk + 1); right.push([pk + (px + w / 2 - pk) * t + (r() - 0.5) * w * 0.08, top + h * Math.pow(t, 1.15) + (r() - 0.5) * h * 0.08]); }
    right.push([px + w / 2, by]);
    const body = left.concat(right.slice(1));
    // 山体：上浓下淡
    const gr = g.createLinearGradient(0, top, 0, by);
    gr.addColorStop(0, opt.top); gr.addColorStop(0.55, opt.mid); gr.addColorStop(1, 'rgba(236,228,206,0)');
    g.beginPath(); g.moveTo(body[0][0], body[0][1]); for (const p of body) g.lineTo(p[0], p[1]); g.closePath();
    g.fillStyle = gr; g.fill();
    // 阳面提亮
    g.beginPath(); g.moveTo(pk, top); for (const p of right.slice(1)) g.lineTo(p[0], p[1]); g.lineTo(pk + w * 0.06, by); g.closePath();
    g.fillStyle = 'rgba(250,244,228,0.28)'; g.fill();
    // 主脊：左坡重笔、右坡轻笔
    brush(g, left, opt.lw * 0.5, opt.lw * 1.4, ink(opt.ia));
    brush(g, right, opt.lw * 0.9, opt.lw * 0.3, ink(opt.ia * 0.55));
    // 披麻皴：自脊线向下的短笔
    const nc = opt.cun;
    for (let k = 0; k < nc; k++) {
      const t = 0.15 + r() * 0.7, side = r() < 0.65 ? left : right;
      const i = Math.min(side.length - 2, Math.floor(t * (side.length - 1)));
      const a = side[i], b = side[i + 1], u = r();
      const sx = a[0] + (b[0] - a[0]) * u, sy = a[1] + (b[1] - a[1]) * u;
      const len = h * (0.12 + r() * 0.2), dir = side === left ? 0.35 : -0.25;
      brush(g, [[sx + (side === left ? 1 : -1), sy + 1], [sx + dir * len * 0.5 + (side === left ? 1.5 : -1.5), sy + len * 0.55], [sx + dir * len + (side === left ? 2 : -2), sy + len]], 0.9, 0.2, ink(opt.ia * 0.35));
    }
    // 苔点
    for (let k = 0; k < opt.dots; k++) {
      const t = 0.1 + r() * 0.5, x = pk + (r() - 0.5) * w * t * 0.9, y = top + h * t * 0.8;
      g.fillStyle = ink(0.55); g.beginPath(); g.ellipse(x, y, 0.9 + r() * 0.6, 0.6 + r() * 0.4, r() * 3, 0, Math.PI * 2); g.fill();
    }
    if (opt.snow) {
      g.beginPath(); g.moveTo(pk, top);
      const sl = left.filter(p => p[1] < top + h * 0.34), sr = right.filter(p => p[1] < top + h * 0.3);
      const L = sl.length ? sl[0] : left[left.length - 2], R2 = sr.length > 1 ? sr[sr.length - 1] : right[1];
      g.lineTo(L[0] + (pk - L[0]) * 0.1, top + h * 0.3);
      g.lineTo(pk - w * 0.05, top + h * 0.22); g.lineTo(pk + w * 0.02, top + h * 0.3); g.lineTo(pk + w * 0.1, top + h * 0.2);
      g.lineTo(R2[0], Math.min(R2[1], top + h * 0.28)); g.closePath();
      g.fillStyle = 'rgba(253,252,247,0.92)'; g.fill();
    }
  }
  function mountain(seed, kind) {
    const [c, g] = mk(), r = rng(seed);
    const snow = kind === 'snow', plateau = kind === 'plateau';
    wash(g, 0, 6, 30, 12, '120,125,118', plateau ? 0.12 : 0.18);
    const n = plateau ? 1 + (r() < 0.35 ? 1 : 0) : 2 + (r() < 0.55 ? 1 : 0);
    const peaks = [];
    for (let k = 0; k < n; k++) {
      const main = k === 0;
      const w = (plateau ? 36 : 24) * (main ? 1.05 + r() * 0.2 : 0.65 + r() * 0.25);
      const h = plateau ? 6 + r() * 4 : (main ? 30 + r() * 10 : 17 + r() * 9);
      const px = main ? (r() - 0.5) * 6 : (k === 1 ? -1 : 1) * (11 + r() * 6);
      peaks.push({ px, w, h, by: (main ? 9 : 5 + r() * 3), main });
    }
    peaks.sort((a, b) => (a.main ? 1 : 0) - (b.main ? 1 : 0)); // 侧峰在后，主峰在前
    for (const p of peaks) {
      const back = !p.main;
      if (plateau) {
        // 台地：平顶，赭灰
        const top = p.by - p.h, l = p.px - p.w / 2, rr = p.px + p.w / 2;
        const gr = g.createLinearGradient(0, top, 0, p.by);
        gr.addColorStop(0, 'rgba(150,132,104,0.55)'); gr.addColorStop(1, 'rgba(210,196,166,0)');
        g.beginPath(); g.moveTo(l, p.by); g.lineTo(l + p.w * 0.18, top + 1); g.lineTo(rr - p.w * 0.2, top); g.lineTo(rr, p.by); g.closePath(); g.fillStyle = gr; g.fill();
        brush(g, [[l + p.w * 0.1, top + p.h * 0.5], [l + p.w * 0.18, top + 1], [rr - p.w * 0.2, top]], 0.4, 1.1, ink(0.5));
        brush(g, [[rr - p.w * 0.2, top], [rr - p.w * 0.08, top + p.h * 0.6]], 0.9, 0.2, ink(0.3));
        // 台地侧壁：两三道浅淡的横向层理
        for (let k = 0; k < 2; k++) { const yy = top + p.h * (0.35 + k * 0.25); brush(g, [[l + p.w * 0.22, yy], [rr - p.w * 0.25, yy + (r() - 0.5)]], 0.3, 0.6, ink(0.18)); }
        continue;
      }
      peak(g, r, p.px, p.by, p.w, p.h, {
        top: back ? 'rgba(92,100,96,0.62)' : 'rgba(46,52,50,0.86)',
        mid: back ? 'rgba(150,156,146,0.42)' : 'rgba(112,124,112,0.55)',
        lw: back ? 1.1 : 1.8, ia: back ? 0.55 : 0.92, cun: back ? 3 : 6, dots: back ? 1 : 3,
        snow: snow && (p.main || r() < 0.5),
      });
    }
    // 山脚云气
    wash(g, (r() - 0.5) * 14, 10, 14, 4, '248,244,232', 0.55);
    return c;
  }

  // ---------- 丘陵 ----------
  function hills(seed) {
    const [c, g] = mk(), r = rng(seed);
    const n = 2 + (r() < 0.6 ? 1 : 0);
    const ms = [];
    for (let k = 0; k < n; k++) ms.push({ x: (k - (n - 1) / 2) * 12 + (r() - 0.5) * 5, y: 6 - (k % 2) * 4 + r() * 3, w: 10 + r() * 5, h: 7 + r() * 5 });
    ms.sort((a, b) => a.y - b.y);
    for (const m of ms) {
      const gr = g.createLinearGradient(0, m.y - m.h, 0, m.y);
      gr.addColorStop(0, 'rgba(118,128,92,0.5)'); gr.addColorStop(1, 'rgba(200,196,160,0)');
      g.beginPath(); g.moveTo(m.x - m.w, m.y);
      g.bezierCurveTo(m.x - m.w * 0.6, m.y - m.h * 1.05, m.x + m.w * 0.5, m.y - m.h * 1.15, m.x + m.w, m.y);
      g.closePath(); g.fillStyle = gr; g.fill();
      const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10, u = 1 - t; pts.push([u * u * u * (m.x - m.w) + 3 * u * u * t * (m.x - m.w * 0.6) + 3 * u * t * t * (m.x + m.w * 0.5) + t * t * t * (m.x + m.w), u * u * u * m.y + 3 * u * u * t * (m.y - m.h * 1.05) + 3 * u * t * t * (m.y - m.h * 1.15) + t * t * t * m.y]); }
      brush(g, pts.slice(0, 9), 0.4, 1.3, ink(0.7));
      for (let k = 0; k < 3; k++) { const p = pts[2 + (r() * 6 | 0)]; g.fillStyle = ink(0.5); g.beginPath(); g.ellipse(p[0] + (r() - 0.5) * 3, p[1] + 1.5 + r() * 2, 0.9, 0.6, 0, 0, Math.PI * 2); g.fill(); }
    }
    if (r() < 0.5) tree(g, r, (r() - 0.5) * 18, 9, 'pine', 0.8);
    return c;
  }

  // ---------- 树 ----------
  function tree(g, r, x, y, type, s) {
    s = s || 1;
    wash(g, x, y + 0.5, 4 * s, 1.4 * s, '60,60,50', 0.18);
    if (type === 'pine') {
      brush(g, [[x, y + 1], [x + (r() - 0.5) * 1.2, y - 9 * s]], 0.9 * s, 0.4 * s, ink(0.7));
      for (let k = 0; k < 4; k++) {
        const yy = y - 3 * s - k * 2.3 * s, ww = (5.5 - k * 1.1) * s;
        g.fillStyle = `rgba(${32 + k * 4},${48 + k * 4},${40},${0.78 - k * 0.06})`;
        g.beginPath(); g.ellipse(x + (r() - 0.5) * 1.2, yy, ww, 1.3 * s, (r() - 0.5) * 0.25, 0, Math.PI * 2); g.fill();
      }
    } else if (type === 'palm') {
      brush(g, [[x, y + 1], [x + 1.5 * s, y - 5 * s], [x + 1 * s, y - 10 * s]], 1 * s, 0.5 * s, ink(0.65));
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k - 2) * 0.62, L = 6 * s;
        brush(g, [[x + s, y - 10 * s], [x + s + Math.cos(a) * L * 0.6, y - 10 * s + Math.sin(a) * L * 0.4 - 1], [x + s + Math.cos(a) * L, y - 10 * s + Math.sin(a) * L * 0.5 + 2.5 * s]], 1.6 * s, 0.2, 'rgba(44,72,48,0.75)');
      }
    } else {
      brush(g, [[x, y + 1], [x, y - 4 * s]], 1 * s, 0.6 * s, ink(0.65));
      const tone = r() < 0.5 ? [58, 78, 52] : [72, 86, 58];
      for (let k = 0; k < 7; k++) {
        const a = r() * Math.PI * 2, d = r() * 3 * s;
        g.fillStyle = `rgba(${tone[0] + k * 3},${tone[1] + k * 3},${tone[2]},${0.55 + r() * 0.25})`;
        g.beginPath(); g.ellipse(x + Math.cos(a) * d, y - 6.5 * s + Math.sin(a) * d * 0.7, (2.2 + r() * 1.2) * s, (1.8 + r()) * s, 0, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = ink(0.35); g.beginPath(); g.ellipse(x - 0.5, y - 4.5 * s, 3 * s, 1 * s, 0, 0, Math.PI * 2); g.fill();
    }
  }
  function forest(seed, kind) {
    const [c, g] = mk(), r = rng(seed);
    const n = kind === 'jungle' ? 10 : 7;
    const ts = [];
    for (let k = 0; k < n; k++) ts.push({ x: (r() - 0.5) * 30, y: (r() - 0.5) * 22 + 2 });
    ts.sort((a, b) => a.y - b.y);
    wash(g, 0, 3, 20, 11, kind === 'jungle' ? '70,100,70' : '90,110,80', 0.16);
    for (const t of ts) {
      const type = kind === 'jungle' ? (r() < 0.3 ? 'palm' : 'broad') : kind === 'pine' ? (r() < 0.8 ? 'pine' : 'broad') : (r() < 0.45 ? 'pine' : 'broad');
      tree(g, r, t.x, t.y, type, 0.8 + r() * 0.35);
    }
    return c;
  }

  // ---------- 草原、沙漠、冻土、平原 ----------
  function steppe(seed) {
    const [c, g] = mk(), r = rng(seed);
    wash(g, (r() - 0.5) * 10, 2, 18, 9, '170,170,110', 0.18);
    for (let k = 0; k < 7; k++) {
      const x = (r() - 0.5) * 30, y = (r() - 0.5) * 22 + 3;
      for (let j = 0; j < 3; j++) { const a = -1.9 + j * 0.4 + (r() - 0.5) * 0.3, L = 3 + r() * 3; brush(g, [[x + j * 0.8, y], [x + j * 0.8 + Math.cos(a) * L * 0.5, y + Math.sin(a) * L * 0.6], [x + j * 0.8 + Math.cos(a) * L, y + Math.sin(a) * L]], 0.8, 0.1, 'rgba(98,104,54,0.6)'); }
    }
    return c;
  }
  function desert(seed) {
    const [c, g] = mk(), r = rng(seed);
    for (let k = 0; k < 2 + (r() < 0.5 ? 1 : 0); k++) {
      const x = (k - 0.8) * 13 + (r() - 0.5) * 6, y = (r() - 0.5) * 14 + 4, w = 9 + r() * 5, h = 4 + r() * 3;
      g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x - w * 0.1, y - h * 1.6, x + w, y + 1); g.quadraticCurveTo(x + w * 0.1, y - h * 0.3, x - w, y);
      g.fillStyle = 'rgba(186,138,70,0.38)'; g.fill();
      const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8, u = 1 - t; pts.push([u * u * (x - w) + 2 * u * t * (x - w * 0.1) + t * t * (x + w), u * u * y + 2 * u * t * (y - h * 1.6) + t * t * (y + 1)]); }
      brush(g, pts, 0.3, 1.1, 'rgba(120,86,44,0.7)');
    }
    for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(140,100,55,0.45)'; g.beginPath(); g.arc((r() - 0.5) * 30, (r() - 0.5) * 22, 0.6, 0, 7); g.fill(); }
    return c;
  }
  function tundra(seed) {
    const [c, g] = mk(), r = rng(seed);
    wash(g, (r() - 0.5) * 8, 2, 16, 7, '255,255,252', 0.5);
    for (let k = 0; k < 4; k++) { const x = (r() - 0.5) * 26, y = (r() - 0.5) * 18; brush(g, [[x - 5, y], [x, y - 0.5], [x + 5, y + 0.3]], 0.3, 0.9, 'rgba(110,118,120,0.45)'); }
    if (r() < 0.4) tree(g, r, (r() - 0.5) * 16, 6, 'pine', 0.6);
    return c;
  }
  function plainDeco(seed, kind) {
    const [c, g] = mk(), r = rng(seed);
    if (kind === 'paddy') {
      // 稻田：几块大小不一、略微倾斜的淡绿田块，田埂只描半边
      const nf = 3 + (r() * 2 | 0);
      for (let k = 0; k < nf; k++) {
        const cx = (r() - 0.5) * 20, cy = (r() - 0.5) * 12 + 2, w = 5 + r() * 5, h = 3 + r() * 2.5, sk = (r() - 0.5) * 2.5;
        g.beginPath(); g.moveTo(cx - w / 2 + sk, cy - h / 2); g.lineTo(cx + w / 2 + sk, cy - h / 2 + (r() - 0.5)); g.lineTo(cx + w / 2 - sk, cy + h / 2); g.lineTo(cx - w / 2 - sk, cy + h / 2 + (r() - 0.5)); g.closePath();
        g.fillStyle = `rgba(${140 + (r() * 20 | 0)},${168 + (r() * 14 | 0)},${110},${0.2 + r() * 0.12})`; g.fill();
        g.strokeStyle = 'rgba(100,112,72,0.35)'; g.lineWidth = 0.45;
        g.beginPath(); g.moveTo(cx - w / 2 - sk, cy + h / 2); g.lineTo(cx + w / 2 - sk, cy + h / 2); g.lineTo(cx + w / 2 + sk, cy - h / 2); g.stroke();
      }
      if (r() < 0.6) tree(g, r, 13, 7, 'broad', 0.7);
    } else if (kind === 'village') {
      for (let k = 0; k < 3; k++) {
        const x = (k - 1) * 7 + (r() - 0.5) * 3, y = (k % 2) * 4 + (r() - 0.5) * 2;
        g.fillStyle = 'rgba(232,224,204,0.9)'; g.fillRect(x - 3, y - 2.5, 6, 3.5);
        g.strokeStyle = ink(0.55); g.lineWidth = 0.5; g.strokeRect(x - 3, y - 2.5, 6, 3.5);
        g.beginPath(); g.moveTo(x - 4.2, y - 2.3); g.quadraticCurveTo(x, y - 5.8, x + 4.2, y - 2.3); g.closePath(); g.fillStyle = ink(0.72); g.fill();
      }
      tree(g, r, -11, 6, 'broad', 0.75); tree(g, r, 10, 7, r() < 0.5 ? 'pine' : 'broad', 0.7);
    } else {
      tree(g, r, (r() - 0.5) * 12, 4, r() < 0.5 ? 'pine' : 'broad', 0.85);
      if (r() < 0.6) tree(g, r, (r() - 0.5) * 20, 8, 'broad', 0.7);
    }
    return c;
  }

  // ---------- 取图 ----------
  const KINDS = {
    mtn: [6, s => mountain(s, 'mtn')], snow: [4, s => mountain(s, 'snow')], plateau: [4, s => mountain(s, 'plateau')],
    hill: [6, hills], forest: [5, s => forest(s, 'mixed')], pine: [4, s => forest(s, 'pine')], jungle: [5, s => forest(s, 'jungle')],
    steppe: [5, steppe], desert: [5, desert], tundra: [4, tundra],
    paddy: [4, s => plainDeco(s, 'paddy')], village: [4, s => plainDeco(s, 'village')], grove: [4, s => plainDeco(s, 'grove')],
  };
  function get(kind, v) {
    const K = KINDS[kind]; if (!K) return null;
    const list = cache[kind] || (cache[kind] = []);
    const i = v % K[0];
    if (!list[i]) list[i] = K[1](1000 + i * 7919 + kind.length * 104729);
    return list[i];
  }
  function count(kind) { return KINDS[kind] ? KINDS[kind][0] : 0; }
  function warm() { for (const k in KINDS) for (let i = 0; i < KINDS[k][0]; i++) get(k, i); }
  return { get, count, warm, BOX, SR };
})();
