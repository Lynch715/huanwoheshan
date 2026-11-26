// 水墨风地图渲染
var RENDER = (function () {
  const SQ3 = Math.sqrt(3), HS = 20, PAD = 12;
  const W = GEO.W, H = GEO.H;
  const BW = Math.ceil(HS * SQ3 * (W + 0.5) + PAD * 2), BH = Math.ceil(HS * 1.5 * (H - 1) + HS * 2 + PAD * 2);
  const OX = HS * SQ3 / 2 + PAD, OY = HS + PAD;
  const HEX_CORNERS = Array.from({ length: 6 }, (_, k) => {
    const a = Math.PI / 180 * (60 * k - 30);
    return [Math.cos(a), Math.sin(a)];
  });
  const T = GEO.T;
  let base = null, polit = null, fog = null;
  let canvas, ctx, dpr = 1, layerScale = 1;
  const cam = { x: 0, y: 0, z: 0.7 };
  let dirty = true, miniDirty = true, frame = null;
  let gestureUntil = 0;
  let selectionPulseUntil = 0, touch;
  const FONT = '"Kaiti SC","STKaiti","KaiTi","楷体","BiauKai","Noto Serif CJK SC","Songti SC",serif';
  const PAPER = [236, 228, 208];
  const RUIN_INK = '#756e62';

  function tx(i) { const c = i % W, r = (i / W) | 0; return OX + HS * SQ3 * (c + 0.5 * (r & 1)); }
  function ty(i) { const r = (i / W) | 0; return OY + HS * 1.5 * r; }
  function llx(lon, lat) { const [fx, fy] = GEO.toColRow(lon, lat); return [OX + HS * SQ3 * fx, OY + HS * 1.5 * fy]; }
  function pixToHex(px, py) {
    const x = px - OX, y = py - OY;
    let q = (SQ3 / 3 * x - y / 3) / HS, r = (2 / 3 * y) / HS;
    let cx = q, cz = r, cy = -cx - cz;
    let rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
    const dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
    const row = rz, col = rx + (rz - (rz & 1)) / 2;
    if (col < 0 || col >= W || row < 0 || row >= H) return -1;
    return row * W + col;
  }
  function hexPath(c, x, y, s) {
    c.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 180 * (60 * k - 30); const px = x + s * Math.cos(a), py = y + s * Math.sin(a); k ? c.lineTo(px, py) : c.moveTo(px, py); }
    c.closePath();
  }
  function corners(i, s) { const x = tx(i), y = ty(i); return HEX_CORNERS.map(([dx, dy]) => [x + s * dx, y + s * dy]); }
  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  const h01 = (a, b, s) => GEO.hash(a, b, s);

  // ---------- 底图 ----------
  function boxBlur(src, w, h, r, ch) {
    const tmp = new Float32Array(src.length);
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < h; y++) for (let k = 0; k < ch; k++) {
        let acc = 0; const row = y * w;
        for (let x = -r; x <= r; x++) acc += src[(row + Math.min(w - 1, Math.max(0, x))) * ch + k];
        for (let x = 0; x < w; x++) {
          tmp[(row + x) * ch + k] = acc / (2 * r + 1);
          acc += src[(row + Math.min(w - 1, x + r + 1)) * ch + k] - src[(row + Math.max(0, x - r)) * ch + k];
        }
      }
      for (let x = 0; x < w; x++) for (let k = 0; k < ch; k++) {
        let acc = 0;
        for (let y = -r; y <= r; y++) acc += tmp[(Math.min(h - 1, Math.max(0, y)) * w + x) * ch + k];
        for (let y = 0; y < h; y++) {
          src[(y * w + x) * ch + k] = acc / (2 * r + 1);
          acc += tmp[(Math.min(h - 1, y + r + 1) * w + x) * ch + k] - tmp[(Math.max(0, y - r) * w + x) * ch + k];
        }
      }
    }
    return src;
  }
  const TINT = {};
  TINT[T.PLAIN] = [234, 225, 203]; TINT[T.STEPPE] = [224, 218, 180]; TINT[T.HILL] = [226, 214, 188]; TINT[T.MTN] = [218, 208, 188];
  TINT[T.FOREST] = [210, 213, 186]; TINT[T.DESERT] = [236, 214, 166]; TINT[T.PLATEAU] = [226, 219, 204]; TINT[T.JUNGLE] = [200, 207, 175]; TINT[T.TUNDRA] = [232, 232, 226];

  function buildBase(progress) {
    base = mkCanvas(Math.ceil(BW * layerScale), Math.ceil(BH * layerScale));
    const b = base.getContext('2d');
    const sx = base.width / BW, sy = base.height / BH;
    const SC = 4, mw = Math.ceil(BW / SC), mh = Math.ceil(BH / SC);
    const mask = new Float32Array(mw * mh), tint = new Float32Array(mw * mh * 3);
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      const i = pixToHex(x * SC + SC / 2, y * SC + SC / 2);
      const k = y * mw + x;
      let land = 0, tc = [214, 219, 208];
      if (i >= 0 && !GEO.isWater(i)) { land = 1; tc = TINT[GEO.terrain[i]] || TINT[T.PLAIN]; }
      mask[k] = land; tint[k * 3] = tc[0]; tint[k * 3 + 1] = tc[1]; tint[k * 3 + 2] = tc[2];
    }
    boxBlur(mask, mw, mh, 2, 1);
    boxBlur(tint, mw, mh, 2, 3);
    // 纸纹噪声
    const NZ = 256, noise = new Float32Array(NZ * NZ);
    for (let i = 0; i < noise.length; i++) noise[i] = Math.random();
    boxBlur(noise, NZ, NZ, 1, 1);
    const img = b.createImageData(base.width, base.height), d = img.data;
    const sample = (arr, fx, fy, ch, k) => {
      const x0 = Math.min(mw - 1, Math.max(0, Math.floor(fx))), y0 = Math.min(mh - 1, Math.max(0, Math.floor(fy)));
      const x1 = Math.min(mw - 1, x0 + 1), y1 = Math.min(mh - 1, y0 + 1), ax = fx - x0, ay = fy - y0;
      const v00 = arr[(y0 * mw + x0) * ch + k], v10 = arr[(y0 * mw + x1) * ch + k], v01 = arr[(y1 * mw + x0) * ch + k], v11 = arr[(y1 * mw + x1) * ch + k];
      return (v00 * (1 - ax) + v10 * ax) * (1 - ay) + (v01 * (1 - ax) + v11 * ax) * ay;
    };
    for (let row = 0; row < base.height; row++) {
      const y = row / sy;
      const fy = y / SC - 0.5;
      for (let col = 0; col < base.width; col++) {
        const x = col / sx;
        const fx = x / SC - 0.5;
        const v = sample(mask, fx, fy, 1, 0);
        const n = noise[(y & 255) * NZ + (x & 255)];
        const n2 = noise[((y >> 2) & 255) * NZ + ((x >> 2) & 255)];
        let R, G, Bc;
        if (v >= 0.5) {
          R = sample(tint, fx, fy, 3, 0); G = sample(tint, fx, fy, 3, 1); Bc = sample(tint, fx, fy, 3, 2);
          const k = 0.94 + 0.1 * n + 0.05 * (n2 - 0.5);
          R *= k; G *= k; Bc *= k;
          if (v < 0.62) { const w = (0.62 - v) / 0.12 * 0.1; R -= 60 * w; G -= 55 * w; Bc -= 45 * w; }
        } else {
          const t = Math.pow(v / 0.5, 2.2);
          R = 216 - 40 * t; G = 222 - 34 * t; Bc = 212 - 30 * t;
          const k = 0.97 + 0.05 * n;
          R *= k; G *= k; Bc *= k;
          const rip = Math.sin(y * 0.55 + n2 * 9 + x * 0.02);
          if (rip > 0.985 && v < 0.4) { R -= 14; G -= 10; Bc -= 6; }
        }
        const dd = Math.abs(v - 0.5);
        if (dd < 0.07) {
          const a = Math.pow(1 - dd / 0.07, 1.6) * (0.55 + 0.45 * n2) * 0.95;
          R = R * (1 - a) + 38 * a; G = G * (1 - a) + 37 * a; Bc = Bc * (1 - a) + 34 * a;
        }
        const o = (row * base.width + col) * 4;
        d[o] = R; d[o + 1] = G; d[o + 2] = Bc; d[o + 3] = 255;
      }
    }
    b.putImageData(img, 0, 0);
    b.setTransform(sx, 0, 0, sy, 0, 0);
    drawWaves(b);
    prepRivers();
    assignArt();
    chunkCache.clear(); chunkPixels = 0;
    drawSeaLabels(b);
    drawCartouche(b);
    miniDirty = true; markDirty();
  }

  // ---------- 海水纹（烘焙在底图） ----------
  function drawWaves(b) {
    b.lineCap = 'round';
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const i = r * W + c;
      if (!GEO.isWater(i) || GEO.terrain[i] === T.LAKE) continue;
      let coast = 0; for (const n of GEO.NBR[i]) if (!GEO.isWater(n)) coast++;
      const s1 = h01(c, r, 51), s2 = h01(c, r, 57);
      if (!coast && s1 > 0.16) continue;
      if (coast && s1 > 0.55) continue;
      const x = tx(i) + (s2 - 0.5) * 14, y = ty(i) + (h01(c, r, 61) - 0.5) * 10;
      const a = coast ? 0.42 : 0.26, sz = coast ? 1 : 1.25;
      // 一组鱼鳞状浪纹：三道同心弧
      b.strokeStyle = `rgba(70,96,104,${a})`;
      for (let k = 0; k < 3; k++) {
        const rr = (3 + k * 2.6) * sz;
        b.lineWidth = 0.9 - k * 0.18;
        b.beginPath(); b.arc(x, y + 2, rr, Math.PI * 1.12, Math.PI * 1.88); b.stroke();
      }
      if (coast && s2 < 0.5) { b.strokeStyle = `rgba(70,96,104,${a * 0.8})`; b.lineWidth = 0.7; b.beginPath(); b.arc(x + 9, y + 4, 4, Math.PI * 1.1, Math.PI * 1.9); b.stroke(); }
    }
  }

  // ---------- 地形图块（每帧按格贴图） ----------
  const ART_KINDS = ['mtn', 'snow', 'plateau', 'hill', 'forest', 'pine', 'jungle', 'steppe', 'desert', 'tundra', 'paddy', 'village', 'grove'];
  let artKind = null, artVar = null;
  function assignArt() {
    const N = W * H;
    artKind = new Int8Array(N).fill(-1); artVar = new Uint8Array(N);
    const K = k => ART_KINDS.indexOf(k);
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const i = r * W + c, t = GEO.terrain[i];
      const [lon, lat] = GEO.lonlatOf(c, r);
      const s1 = h01(c, r, 11), s3 = h01(c, r, 37);
      let k = -1;
      if (t === T.MTN) k = (lat > 44 || (lat > 27 && lon > 70 && lon < 104 && s3 > 0.35) || (lat > 40 && s3 > 0.7)) ? K('snow') : K('mtn');
      else if (t === T.PLATEAU) k = s3 > 0.85 ? K('snow') : s1 < 0.5 ? K('plateau') : -1;
      else if (t === T.HILL) k = K('hill');
      else if (t === T.FOREST) k = lat > 47 ? K('pine') : K('forest');
      else if (t === T.JUNGLE) k = K('jungle');
      else if (t === T.STEPPE) k = s1 < 0.7 ? K('steppe') : -1;
      else if (t === T.DESERT) k = s1 < 0.75 ? K('desert') : -1;
      else if (t === T.TUNDRA) k = s1 < 0.6 ? K('tundra') : -1;
      else if (t === T.PLAIN) {
        const wet = GEO.river[i] || (lat < 34 && lon > 100 && lon < 125);
        if (s1 < (wet ? 0.11 : 0.03)) k = K('paddy');
        else if (s1 < (wet ? 0.19 : 0.08)) k = K('village');
        else if (s1 < (wet ? 0.3 : 0.17)) k = K('grove');
      }
      artKind[i] = k;
      artVar[i] = (h01(c, r, 77) * 64) | 0;
    }
  }
  // ---------- 地形分块缓存：河流与地形图块按 256 世界像素分块预绘 ----------
  const CHUNK = 256;
  const chunkCache = new Map(); // key -> {c, bucket, used}
  let chunkPixels = 0, chunkFrame = 0;
  function chunkBudget() { return layerScale < 1 ? 10e6 : 28e6; }
  function bucketFor(z) {
    const want = z * dpr, maxB = layerScale < 1 ? 2 : 4;
    for (const b of [0.5, 1, 2, 4]) if (b >= want * 0.8 || b === maxB) return b;
    return maxB;
  }
  function renderChunk(cx, cy, bucket) {
    const px = Math.ceil(CHUNK * bucket);
    const cv = mkCanvas(px, px), g = cv.getContext('2d');
    g.setTransform(bucket, 0, 0, bucket, -cx * CHUNK * bucket, -cy * CHUNK * bucket);
    const x0 = cx * CHUNK, y0 = cy * CHUNK, x1 = x0 + CHUNK, y1 = y0 + CHUNK;
    // 底图与疆域着色（区块即合成好的整幅地图，逐帧只需贴块）
    const sw = Math.min(CHUNK, BW - x0), sh = Math.min(CHUNK, BH - y0);
    if (base && sw > 0 && sh > 0) {
      g.imageSmoothingQuality = 'high';
      const bx = base.width / BW, by = base.height / BH;
      g.drawImage(base, x0 * bx, y0 * by, sw * bx, sh * by, x0, y0, sw, sh);
      if (polit) { const ps = PS * layerScale; g.drawImage(polit, x0 * ps, y0 * ps, sw * ps, sh * ps, x0, y0, sw, sh); }
    }
    // 河流
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const rv of riverPts) {
      const b = rv.box; if (b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1) continue;
      const pts = rv.pts, total = pts.length - 1;
      for (let pass = 0; pass < 2; pass++) for (let k = 0; k < total; k++) {
        const t = (k + 0.5) / total;
        const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1];
        if (Math.max(p0[0], p1[0], p2[0]) < x0 - 12 || Math.min(p0[0], p1[0], p2[0]) > x1 + 12 || Math.max(p0[1], p1[1], p2[1]) < y0 - 12 || Math.min(p0[1], p1[1], p2[1]) > y1 + 12) continue;
        const m0 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2], m1 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
        g.beginPath();
        if (k === 0) { g.moveTo(p1[0], p1[1]); g.lineTo(m1[0], m1[1]); }
        else { g.moveTo(m0[0], m0[1]); g.quadraticCurveTo(p1[0], p1[1], m1[0], m1[1]); }
        if (k === total - 1) g.lineTo(p2[0], p2[1]);
        if (pass === 0) { g.strokeStyle = 'rgba(150,182,186,0.38)'; g.lineWidth = Math.max(2.5 / bucket, 2.5 + t * 6); }
        else { g.strokeStyle = 'rgba(58,86,98,0.82)'; g.lineWidth = Math.max(1 / bucket, 0.6 + t * 2.2); }
        g.stroke();
      }
    }
    // 地形图块（含相邻格伸入本块的部分）
    if (artKind && typeof INKART !== 'undefined') {
      const B = INKART.BOX, cw = HS * SQ3;
      const r0 = Math.max(0, Math.floor((y0 - B.h + B.ay - OY) / (HS * 1.5)) - 1), r1 = Math.min(H - 1, Math.ceil((y1 + B.ay - OY) / (HS * 1.5)) + 1);
      const c0 = Math.max(0, Math.floor((x0 - B.w - OX) / cw) - 1), c1 = Math.min(W - 1, Math.ceil((x1 + B.w - OX) / cw) + 1);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const i = r * W + c, k = artKind[i];
        if (k < 0) continue;
        const x = tx(i) - B.ax, y = ty(i) - B.ay;
        if (x > x1 || y > y1 || x + B.w < x0 || y + B.h < y0) continue;
        const img = INKART.get(ART_KINDS[k], artVar[i]);
        if (img) g.drawImage(img, x, y, B.w, B.h);
      }
    }
    return cv;
  }
  function drawTerrainArt(S, z) {
    if (!base) return;
    chunkFrame++;
    const bucket = bucketFor(z);
    const cx0 = Math.max(0, Math.floor(cam.x / CHUNK)), cy0 = Math.max(0, Math.floor(cam.y / CHUNK));
    const cx1 = Math.min(Math.ceil(BW / CHUNK) - 1, Math.floor((cam.x + innerWidth / z) / CHUNK)), cy1 = Math.min(Math.ceil(BH / CHUNK) - 1, Math.floor((cam.y + innerHeight / z) / CHUNK));
    let built = 0, missing = false;
    const maxBuild = gestureUntil || anim ? 2 : 6;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const key = cx + ',' + cy + '@' + bucket;
      let e = chunkCache.get(key);
      if (!e && built < maxBuild) {
        e = { c: renderChunk(cx, cy, bucket), used: 0 };
        chunkCache.set(key, e); chunkPixels += e.c.width * e.c.height; built++;
      }
      if (!e) {
        // 尚未绘好：先借用其他档位的同一块，下一帧再补
        missing = true;
        for (const b of [1, 2, 0.5, 4]) { const o = chunkCache.get(cx + ',' + cy + '@' + b); if (o) { e = o; break; } }
        if (!e) {
          const x0 = cx * CHUNK, y0 = cy * CHUNK, sw = Math.min(CHUNK, BW - x0), sh = Math.min(CHUNK, BH - y0);
          if (base && sw > 0 && sh > 0) {
            const bx = base.width / BW, by = base.height / BH;
            ctx.drawImage(base, x0 * bx, y0 * by, sw * bx, sh * by, x0, y0, sw, sh);
            if (polit) { const ps = PS * layerScale; ctx.drawImage(polit, x0 * ps, y0 * ps, sw * ps, sh * ps, x0, y0, sw, sh); }
          }
          continue;
        }
      }
      e.used = chunkFrame;
      ctx.drawImage(e.c, cx * CHUNK, cy * CHUNK, CHUNK, CHUNK);
    }
    if (missing) markDirty();
    // 超出内存预算时，丢弃最久未用的块
    if (chunkPixels > chunkBudget()) {
      const list = [...chunkCache.entries()].sort((a, b) => a[1].used - b[1].used);
      for (const [k, e] of list) { if (chunkPixels <= chunkBudget() * 0.8 || e.used === chunkFrame) break; chunkCache.delete(k); chunkPixels -= e.c.width * e.c.height; }
    }
  }
  // 河流：每帧矢量绘制。预先算好世界坐标与包围盒
  let riverPts = [];
  function prepRivers() {
    riverPts = GEO.RIVERS.map(rv => {
      const pts = rv.pts.map(p => llx(p[0], p[1]));
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      return { pts, box: [x0 - 10, y0 - 10, x1 + 10, y1 + 10] };
    });
  }
  function drawSeaLabels(b) {
    const L = [['东　海', 125.5, 29.5, 22], ['南　海', 114, 16, 26], ['黄海', 123.2, 35.6, 18], ['日本海', 134.5, 40.5, 18], ['天竺海', 64, 15.5, 26], ['注辇海', 88.5, 15, 22],
      ['拂菻海', 18, 35.2, 22], ['黑海', 34, 43.4, 18], ['宽田吉思海', 51, 42.5, 15], ['红海', 38.4, 20, 14], ['西　海', -11.5, 46, 22], ['北海', 2.5, 56.5, 16], ['东洋大海', 138, 26, 26], ['鄂霍次克', 145, 55, 14]];
    b.textAlign = 'center'; b.textBaseline = 'middle';
    for (const [t, lon, lat, sz] of L) {
      const [x, y] = llx(lon, lat);
      b.font = `${sz}px ${FONT}`;
      b.fillStyle = 'rgba(70,90,95,0.45)';
      const chars = [...t];
      b.save(); b.translate(x, y);
      b.fillText(t, 0, 0);
      b.restore();
    }
  }
  function drawCartouche(b) {
    const [x, y] = llx(-8, 60.5);
    b.save();
    b.fillStyle = 'rgba(244,238,222,0.85)';
    b.strokeStyle = 'rgba(40,36,30,0.8)'; b.lineWidth = 2;
    b.fillRect(x - 8, y - 6, 58, 250); b.strokeRect(x - 8, y - 6, 58, 250);
    b.strokeRect(x - 4, y - 2, 50, 242);
    b.font = `bold 34px ${FONT}`; b.fillStyle = 'rgba(25,22,20,0.9)'; b.textAlign = 'center';
    const t = '大宋天下輿圖';
    [...t].forEach((ch, k) => b.fillText(ch, x + 21, y + 34 + k * 37));
    b.fillStyle = 'rgba(178,40,32,0.85)'; b.fillRect(x + 8, y + 250 + 10, 28, 28);
    b.font = `bold 13px ${FONT}`; b.fillStyle = 'rgba(250,240,230,0.95)';
    b.fillText('紹興', x + 22, y + 279);
    b.restore();
  }

  // ---------- 政治层（半分辨率） ----------
  const PS = 0.5;
  let borderSegs = [];   // [x1,y1,x2,y2,color,isPlayer]，每帧以细墨线绘出
  let prevOwn = null;
  // 疆域或已探索范围变化：只作废受影响的区块
  function invalidateChunks(own) {
    if (!prevOwn || prevOwn.length !== own.length) { chunkCache.clear(); chunkPixels = 0; prevOwn = own; return; }
    const dead = new Set();
    for (let i = 0; i < own.length; i++) {
      if (own[i] === prevOwn[i]) continue;
      const x = tx(i), y = ty(i), m = 26;
      for (let cy = Math.floor((y - m) / CHUNK); cy <= Math.floor((y + m) / CHUNK); cy++)
        for (let cx = Math.floor((x - m) / CHUNK); cx <= Math.floor((x + m) / CHUNK); cx++) dead.add(cx + ',' + cy);
    }
    if (dead.size) for (const [k, e] of [...chunkCache]) if (dead.has(k.split('@')[0])) { chunkCache.delete(k); chunkPixels -= e.c.width * e.c.height; }
    prevOwn = own;
  }
  function cityFaction(id) {
    const faction = GAME.fac(id);
    return faction?.alive ? faction : null;
  }
  function politicalOwners(S) {
    const cities = S.cities.map(c => cityFaction(c.f)?.id || null);
    return Array.from(S.tileCity, id => cities[id] ?? null);
  }
  function territoryPaths(owners, explored) {
    // 合并同色各格，避免分别填色留下格线。
    const paths = {};
    for (let i = 0; i < owners.length; i++) {
      const owner = owners[i];
      if (!owner || !explored[i]) continue;
      const path = paths[owner] || (paths[owner] = new Path2D());
      const cs = corners(i, HS + 0.4);
      path.moveTo(...cs[0]);
      for (let k = 1; k < cs.length; k++) path.lineTo(...cs[k]);
      path.closePath();
    }
    return paths;
  }
  function buildPolitical() {
    const S = GAME.S;
    const cities = JSON.stringify(S.cities.map(c => [c.tile, c.f, opts.showNames ? c.pop : 0]));
    const factions = JSON.stringify(Object.values(S.factions).map(f => [f.id, f.alive, f.color, opts.showNames ? f.name : '']));
    if (politicalInput?.player === S.player && politicalInput.names === opts.showNames &&
        politicalInput.cities === cities && politicalInput.factions === factions &&
        S.tileCity.every((v, i) => v === politicalInput.tiles[i]) &&
        S.explored.every((v, i) => v === politicalInput.explored[i])) return;
    politicalInput = { player: S.player, names: opts.showNames, cities, factions,
      tiles: S.tileCity.slice(), explored: S.explored.slice() };
    const scale = PS * layerScale;
    if (!polit) polit = mkCanvas(Math.ceil(BW * scale), Math.ceil(BH * scale));
    const p = polit.getContext('2d');
    p.setTransform(1, 0, 0, 1, 0, 0);
    p.clearRect(0, 0, polit.width, polit.height);
    p.setTransform(scale, 0, 0, scale, 0, 0);
    const N = W * H;
    const own = politicalOwners(S);
    invalidateChunks(own.map((f, i) => f && S.explored[i] ? f : null));
    // 按势力合并为一条路径整体填色，避免逐格叠色留下格线
    const paths = territoryPaths(own, S.explored), edges = {};
    borderSegs = [];
    for (let i = 0; i < N; i++) {
      const f = own[i]; if (!f || !S.explored[i]) continue;
      let cs;
      const cx = tx(i), cy = ty(i);
      for (const n of GEO.NBR[i]) {
        if (own[n] === f) continue;
        cs ||= corners(i, HS);
        const water = GEO.isWater(n);
        const nx = tx(n), ny = ty(n);
        const pair = cs.map((pt, k) => [k, (pt[0] - nx) ** 2 + (pt[1] - ny) ** 2]).sort((a, b) => a[1] - b[1]).slice(0, 2).map(q => cs[q[0]]);
        (edges[f] || (edges[f] = [])).push([pair[0][0], pair[0][1], pair[1][0], pair[1][1], water]);
        if (water) continue;
        const ins = 1.6;
        borderSegs.push([pair[0][0] + (cx - pair[0][0]) * ins / HS, pair[0][1] + (cy - pair[0][1]) * ins / HS, pair[1][0] + (cx - pair[1][0]) * ins / HS, pair[1][1] + (cy - pair[1][1]) * ins / HS, GAME.fac(f).color, f === S.player]);
      }
    }
    p.lineCap = 'round'; p.lineJoin = 'round';
    for (const f in paths) {
      const F = GAME.fac(f), me = f === S.player;
      p.fillStyle = hexA(F.color, me ? 0.13 : 0.09); p.fill(paths[f]);
      // 国境内侧渐隐色带：裁到本国范围内，沿边界描粗笔
      p.save(); p.clip(paths[f]);
      for (const [w, a] of [[16, 0.10], [9, 0.14], [4, 0.2]]) {
        p.strokeStyle = hexA(F.color, me ? a * 1.3 : a); p.lineWidth = w;
        p.beginPath();
        for (const e of edges[f] || []) { if (e[4] && w > 9) continue; p.moveTo(e[0], e[1]); p.lineTo(e[2], e[3]); }
        p.stroke();
      }
      p.restore();
    }
    // 国名
    const groups = {};
    for (const c of S.cities) {
      if (!S.explored[c.tile] || !cityFaction(c.f)) continue;
      (groups[c.f] = groups[c.f] || []).push(c);
    }
    p.textAlign = 'center'; p.textBaseline = 'middle';
    for (const f in groups) {
      if (!opts.showNames) break;
      const cs = groups[f]; if (cs.length < 2 && f !== S.player) continue;
      let sx = 0, sy = 0, sw = 0;
      for (const c of cs) { const w = c.pop + 2; sx += tx(c.tile) * w; sy += ty(c.tile) * w; sw += w; }
      const F = GAME.fac(f);
      const sz = Math.min(64, 22 + Math.sqrt(cs.length) * 8);
      p.font = `bold ${sz}px ${FONT}`;
      p.fillStyle = hexA(F.color, 0.36);
      const name = F.name.split('').join(cs.length > 5 ? '　' : ' ');
      p.fillText(name, sx / sw, sy / sw + HS * 1.4);
    }
    miniDirty = true; markDirty();
  }
  let politicalInput = null;
  function drawOverview(context, width, height, { captured, capital }) {
    const S = GAME.S, kx = width / BW, ky = height / BH;
    const paint = territoryPaths(politicalOwners(S), S.explored);
    const visible = territoryPaths(Array(W * H).fill('visible'), S.explored).visible;
    const paper = '#f1e5cb', red = '#a83c32';
    context.save();
    context.fillStyle = paper;
    context.fillRect(0, 0, width, height);
    if (visible) {
      context.save();
      context.scale(kx, ky);
      context.clip(visible);
      if (base) context.drawImage(base, 0, 0, BW, BH);
      for (const [f, path] of Object.entries(paint)) {
        context.fillStyle = f === S.player ? hexA(red, .78) : hexA(GAME.fac(f).color, .32);
        context.fill(path);
      }
      context.restore();
    }
    context.strokeStyle = '#97856b';
    context.strokeRect(.5, .5, width - 1, height - 1);
    context.font = `bold 18px ${FONT}`;
    context.textBaseline = 'middle';
    context.textAlign = 'left';
    const used = [];
    const markers = capital ? [capital, ...captured.filter(c => c !== capital)] : captured;
    drawRuins(context, width, height, 4);
    for (const c of markers) {
      const x = tx(c.tile) * kx, y = ty(c.tile) * ky, ruler = cityFaction(c.f);
      const isCapital = c === capital && ruler, mark = ruler ? red : RUIN_INK;
      const textWidth = Math.ceil(context.measureText(c.name).width);
      const slot = (left, mid) => [Math.max(4, Math.min(width - textWidth - 4, left)), Math.max(12, Math.min(height - 12, mid))];
      const slots = [slot(x + 9, y), slot(x - textWidth - 9, y)];
      for (const gap of [16, -16, 32, -32, 48, -48]) {
        slots.push(slot(x + 9, y + gap), slot(x - textWidth - 9, y + gap), slot(x - textWidth / 2, y + gap));
      }
      const [left, mid] = slots.find(([lx, ly]) => used.every(([ux, uy, uw]) =>
        Math.abs(ly - uy) >= 20 || lx + textWidth + 4 < ux || lx > ux + uw + 4)) || slots[0];
      used.push([left, mid, textWidth]);
      if (Math.abs(mid - y) > 8) {
        context.strokeStyle = hexA(mark, .64);
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(Math.max(left, Math.min(x, left + textWidth)), mid);
        context.stroke();
      }
      context.fillStyle = mark;
      context.strokeStyle = paper;
      context.lineWidth = 2;
      if (isCapital) {
        context.fillRect(x - 6, y - 6, 12, 12);
        context.strokeRect(x - 6, y - 6, 12, 12);
      } else {
        context.beginPath();
        context.arc(x, y, 3.5, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      }
      context.lineWidth = 3.5;
      context.strokeText(c.name, left, mid);
      context.fillStyle = ruler ? '#682a22' : RUIN_INK;
      context.fillText(c.name, left, mid);
    }
    context.restore();
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // ---------- 迷雾（1/4 分辨率） ----------
  let fogNoise = null, fogTiles = null;
  let fogExplored = null, fogVisible = null;
  function buildFog() {
    const S = GAME.S, SC = 4 / layerScale, mw = Math.ceil(BW / SC), mh = Math.ceil(BH / SC);
    // 回放收尾、读档和事件都可能再次请求绘制同一份迷雾。
    const exploredChanged = !fogExplored || S.explored.some((v, i) => v !== fogExplored[i]);
    if (!exploredChanged && S.visible.every((v, i) => v === fogVisible[i])) return false;
    if (!fog) fog = mkCanvas(mw, mh);
    if (!fogNoise) {
      fogNoise = new Float32Array(mw * mh);
      // 保持与桌面相同的随机调用数，分辨率不影响随后使用同一随机源的逻辑。
      const fullSize = Math.ceil(BW / 4) * Math.ceil(BH / 4);
      for (let i = 0; i < fullSize; i++) { const n = Math.random(); if (i < fogNoise.length) fogNoise[i] = n; }
      boxBlur(fogNoise, mw, mh, 3, 1);
    }
    if (!fogTiles) {
      fogTiles = new Int16Array(mw * mh);
      for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
        fogTiles[y * mw + x] = pixToHex((x + 0.5) * SC, (y + 0.5) * SC);
      }
    }
    const u = new Float32Array(mw * mh), dm = new Float32Array(mw * mh);
    for (let k = 0; k < fogTiles.length; k++) {
      const i = fogTiles[k];
      if (i < 0 || !S.explored[i]) u[k] = 1;
      else if (!S.visible[i]) dm[k] = 1;
    }
    boxBlur(u, mw, mh, 3, 1); boxBlur(dm, mw, mh, 2, 1);
    const fc = fog.getContext('2d');
    const img = fc.createImageData(mw, mh), d = img.data;
    for (let k = 0; k < mw * mh; k++) {
      const a = Math.min(1, u[k] * 1.25), b2 = dm[k];
      const n = fogNoise[k];
      const cr = 232 + n * 14, cg = 224 + n * 14, cb = 204 + n * 12;
      const al = Math.max(a, b2 * 0.2 * (1 - a));
      const mix = a / (al + 0.0001);
      d[k * 4] = cr * mix + 70 * (1 - mix); d[k * 4 + 1] = cg * mix + 70 * (1 - mix); d[k * 4 + 2] = cb * mix + 64 * (1 - mix);
      d[k * 4 + 3] = Math.min(255, al * 255 * (a > 0.5 ? (0.93 + n * 0.07) : 1));
    }
    fc.putImageData(img, 0, 0);
    fogExplored = S.explored.slice();
    fogVisible = S.visible.slice();
    miniDirty = true; markDirty();
    return exploredChanged;
  }

  // ---------- 小地图 ----------
  let miniCanvas = null;
  function drawRuins(context, width, height, size) {
    const S = GAME.S;
    if (!S) return;
    context.fillStyle = RUIN_INK;
    for (const c of S.cities) {
      if (!S.explored[c.tile] || cityFaction(c.f)) continue;
      const x = tx(c.tile) * width / BW, y = ty(c.tile) * height / BH;
      context.fillRect(x - size / 2, y - size / 2, size, size);
    }
  }
  function buildMini() {
    if (!miniCanvas || !base) return;
    const m = miniCanvas.getContext('2d');
    m.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
    m.drawImage(base, 0, 0, miniCanvas.width, miniCanvas.height);
    if (riverPts.length) {
      const kx = miniCanvas.width / BW, ky = miniCanvas.height / BH;
      m.strokeStyle = 'rgba(70,96,110,0.6)'; m.lineWidth = 0.8;
      for (const rv of riverPts) { m.beginPath(); rv.pts.forEach(([x, y], k) => k ? m.lineTo(x * kx, y * ky) : m.moveTo(x * kx, y * ky)); m.stroke(); }
    }
    // 地形小记：山以墨点、林以绿点
    if (artKind) {
      const kx = miniCanvas.width / BW, ky = miniCanvas.height / BH;
      for (let i = 0; i < W * H; i++) {
        const k = artKind[i]; if (k < 0 || k > 6) continue;
        m.fillStyle = k <= 2 ? 'rgba(50,52,48,0.55)' : k === 3 ? 'rgba(110,110,80,0.35)' : 'rgba(60,90,60,0.4)';
        m.fillRect(tx(i) * kx - 0.6, ty(i) * ky - 0.6, k <= 2 ? 1.5 : 1.1, k <= 2 ? 1.5 : 1.1);
      }
    }
    if (polit) m.drawImage(polit, 0, 0, miniCanvas.width, miniCanvas.height);
    if (fog) m.drawImage(fog, 0, 0, miniCanvas.width, miniCanvas.height);
    drawRuins(m, miniCanvas.width, miniCanvas.height, 3);
  }

  // ---------- 主绘制 ----------
  const opts = { showRes: true, showSites: true, showNames: true };
  const state = { sel: null, hover: -1, path: null, pathTurns: null, flash: null };
  function init(cv, mc) {
    canvas = cv; ctx = canvas.getContext('2d'); miniCanvas = mc;
    touch = matchMedia('(pointer: coarse)');
    if (touch.matches) layerScale = 0.75;
    resize();
    window.addEventListener('resize', resize);
    for (const type of ['pointerdown', 'pointermove', 'keydown']) {
      window.addEventListener(type, wakeSelection, { passive: true });
    }
  }
  function resize() {
    canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
    clampCam(); markDirty();
  }
  function sizeBuffer() {
    dpr = Math.min(gestureUntil ? 1.25 : 2, window.devicePixelRatio || 1);
    const w = Math.floor(innerWidth * dpr), h = Math.floor(innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }
  function clampCam() {
    const vw = innerWidth / cam.z, vh = innerHeight / cam.z;
    cam.z = Math.max(minZoom(), Math.min(2.4, cam.z));
    const vw2 = innerWidth / cam.z, vh2 = innerHeight / cam.z;
    cam.x = Math.max(-vw2 * 0.3, Math.min(BW - vw2 * 0.7, cam.x));
    cam.y = Math.max(-vh2 * 0.3, Math.min(BH - vh2 * 0.7, cam.y));
  }
  function minZoom() { return Math.min(innerWidth / BW, innerHeight / BH) * 0.95; }
  function screenToWorld(sx, sy) { return [cam.x + sx / cam.z, cam.y + sy / cam.z]; }
  function tileAtScreen(sx, sy) { const [x, y] = screenToWorld(sx, sy); return pixToHex(x, y); }
  function centerOn(i, z) { if (z) cam.z = z; cam.x = tx(i) - innerWidth / 2 / cam.z; cam.y = ty(i) - innerHeight / 2 / cam.z; clampCam(); wakeSelection(); markDirty(); }
  function pan(dx, dy) { cam.x -= dx / cam.z; cam.y -= dy / cam.z; clampCam(); markGesture(); }
  function zoomAt(sx, sy, f) {
    const [wx, wy] = screenToWorld(sx, sy);
    cam.z *= f; clampCam();
    cam.x = wx - sx / cam.z; cam.y = wy - sy / cam.z; clampCam(); markGesture();
  }

  let t0 = performance.now();
  function scheduleFrame() { if (frame === null) frame = requestAnimationFrame(loop); }
  function markDirty() { dirty = true; if (canvas) scheduleFrame(); }
  function wakeSelection() {
    if (!state.sel) return;
    selectionPulseUntil = performance.now() + 3000;
    if (canvas) scheduleFrame();
  }
  function markGesture() {
    if (layerScale < 1) gestureUntil = performance.now() + 180;
    wakeSelection();
    markDirty();
  }
  function hasAnimation() { return (state.sel && selectionPulseUntil) || state.flash || anim || fx.floats.length || fx.stamps.length || fx.bursts.length; }
  function loop(now) {
    frame = null;
    if (gestureUntil && now >= gestureUntil) { gestureUntil = 0; dirty = true; }
    if (selectionPulseUntil && now >= selectionPulseUntil) { selectionPulseUntil = 0; dirty = true; }
    if (!dirty && !gestureUntil && !hasAnimation()) return;
    if (dirty || anim || fx.floats.length || now - t0 >= 50) {
      t0 = now; dirty = false;
      sizeBuffer();
      if (miniDirty && miniCanvas?.getClientRects().length) { miniDirty = false; buildMini(); }
      draw(now);
    }
    if (dirty || gestureUntil || hasAnimation()) scheduleFrame();
  }
  function draw(now) {
    const S = GAME.S;
    if (anim) stepAnim(now);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#e8dfc8'; ctx.fillRect(0, 0, innerWidth, innerHeight);
    if (!base) return;
    const z = cam.z;
    // 底图裁剪
    const sx = Math.max(0, cam.x), sy = Math.max(0, cam.y);
    const ex = Math.min(BW, cam.x + innerWidth / z), ey = Math.min(BH, cam.y + innerHeight / z);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.setTransform(dpr * z, 0, 0, dpr * z, -cam.x * z * dpr, -cam.y * z * dpr);
    drawTerrainArt(S, z);
    if (!S) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); drawMiniView(); return; }
    drawGrid(S, z);
    drawBorders(z);
    // 航线
    drawRoutes(S, cam.x, cam.y, cam.x + innerWidth / z, cam.y + innerHeight / z);
    // 选中格 / 悬停
    if (state.hover >= 0) { hexPath(ctx, tx(state.hover), ty(state.hover), HS - 1); ctx.strokeStyle = 'rgba(30,30,30,0.35)'; ctx.lineWidth = 1.5 / z + 0.5; ctx.stroke(); }
    if (state.sel && state.sel.tile != null) {
      const pulse = selectionPulseUntil ? 0.55 + 0.35 * Math.sin(now / 250) : 0.78;
      hexPath(ctx, tx(state.sel.tile), ty(state.sel.tile), HS - 1.5);
      ctx.strokeStyle = `rgba(196,150,40,${pulse})`; ctx.lineWidth = 3; ctx.stroke();
    }
    if (state.path) drawPath(state.path, state.pathTurns);
    // 迷雾
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (fog) {
      const SC = 4 / layerScale;
      ctx.drawImage(fog, sx / SC, sy / SC, (ex - sx) / SC, (ey - sy) / SC, (sx - cam.x) * z, (sy - cam.y) * z, (ex - sx) * z, (ey - sy) * z);
    }
    // 城市与军队（屏幕坐标）
    labels = []; labelBlocks = [];
    if (opts.showSites) drawSites(S, z);
    const cities = drawCityArt(S, z);
    drawArmies(S, z, now);
    drawCities(S, z, cities);
    drawLabels();
    drawFx(now);
    if (anim && anim.label) {
      ctx.save(); ctx.font = `bold 20px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const w = ctx.measureText(anim.label).width + 40, x = replayWidth() / 2, y = 92;
      ctx.fillStyle = 'rgba(34,30,25,0.88)'; ctx.fillRect(x - w / 2, y - 18, w, 36);
      ctx.fillStyle = anim.labelColor || '#a8302a'; ctx.fillRect(x - w / 2, y - 18, 6, 36);
      ctx.fillStyle = '#f4ecd8'; ctx.fillText(anim.label, x + 3, y + 1);
      ctx.font = `12px ${FONT}`; ctx.fillStyle = 'rgba(244,236,216,0.7)'; ctx.fillText(touch.matches ? '轻点地图跳过' : '点按地图或按空格跳过', x, y + 30);
      ctx.restore();
    }
    if (state.flash) {
      const f = state.flash, age = now - f.t;
      if (age > 1200) state.flash = null;
      // 战报可能在绘制途中开始闪圈，其起点会晚于本帧的时间戳。
      else if (age >= 0) {
        const [x, y] = w2s(tx(f.tile), ty(f.tile));
        ctx.strokeStyle = `rgba(170,30,20,${1 - age / 1200})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, 10 + age / 30, 0, 7); ctx.stroke();
      }
    }
    drawMiniView();
  }
  // 国界：细墨线，按屏幕像素定宽，任何缩放下都清晰
  function darken(hex, k) { const n = parseInt(hex.slice(1), 16); return `rgb(${((n >> 16) & 255) * k | 0},${((n >> 8) & 255) * k | 0},${(n & 255) * k | 0})`; }
  function drawBorders(z) {
    if (!borderSegs.length) return;
    const x0 = cam.x - 30, y0 = cam.y - 30, x1 = cam.x + innerWidth / z + 30, y1 = cam.y + innerHeight / z + 30;
    const groups = new Map();
    for (const sg of borderSegs) {
      if ((sg[0] < x0 && sg[2] < x0) || (sg[0] > x1 && sg[2] > x1) || (sg[1] < y0 && sg[3] < y0) || (sg[1] > y1 && sg[3] > y1)) continue;
      const key = sg[4] + (sg[5] ? '*' : '');
      let g = groups.get(key); if (!g) groups.set(key, g = []);
      g.push(sg);
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [key, list] of groups) {
      const me = key.endsWith('*'), col = key.replace('*', '');
      ctx.beginPath();
      for (const sg of list) { ctx.moveTo(sg[0], sg[1]); ctx.lineTo(sg[2], sg[3]); }
      ctx.strokeStyle = darken(col, 0.62); ctx.globalAlpha = 0.85;
      ctx.lineWidth = Math.max(0.8, (me ? 2.4 : 1.6) / z);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // 近看时浮现极淡的格线，方便数格行军
  function drawGrid(S, z) {
    if (z < 1.05) return;
    const a = Math.min(0.12, (z - 1.05) * 0.16);
    const r0 = Math.max(0, Math.floor((cam.y - OY) / (HS * 1.5)) - 1), r1 = Math.min(H - 1, Math.ceil((cam.y + innerHeight / z - OY) / (HS * 1.5)) + 1);
    const cw = HS * SQ3, c0 = Math.max(0, Math.floor((cam.x - OX) / cw) - 1), c1 = Math.min(W - 1, Math.ceil((cam.x + innerWidth / z - OX) / cw) + 1);
    ctx.beginPath();
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const i = r * W + c; if (GEO.isWater(i) || !S.explored[i]) continue;
      const cs = corners(i, HS);
      ctx.moveTo(cs[0][0], cs[0][1]); for (let k = 1; k < 6; k++) ctx.lineTo(cs[k][0], cs[k][1]); ctx.closePath();
    }
    ctx.strokeStyle = `rgba(60,52,40,${a})`; ctx.lineWidth = 0.8 / z; ctx.stroke();
  }
  function w2s(x, y) { return [(x - cam.x) * cam.z, (y - cam.y) * cam.z]; }
  function onScreen(x, y, m) { return x > -m && y > -m && x < innerWidth + m && y < innerHeight + m; }

  function drawRoutes(S, left, top, right, bottom) {
    ctx.save();
    ctx.setLineDash([5, 6]); ctx.lineWidth = 1.6;
    for (const c of S.cities) {
      if (!c.trade.length) continue;
      const mine = c.f === S.player;
      for (const t of c.trade) {
        const b = S.cities[t];
        if (!mine && b.f !== S.player) continue;
        if (!S.explored[c.tile] || !S.explored[b.tile]) continue;
        const x0 = tx(c.tile), y0 = ty(c.tile), x1 = tx(b.tile), y1 = ty(b.tile);
        // 二次曲线完全落在起点、终点和控制点的外接框内。
        if (Math.max(x0, x1) < left - 3 || Math.min(x0, x1) > right + 3 ||
            Math.min(y0, y1) > bottom + 3 || Math.max(y0, y1) + 200 < top - 3) continue;
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + Math.min(200, Math.hypot(x1 - x0, y1 - y0) * 0.18);
        if (Math.max(y0, y1, my) < top - 3) continue;
        ctx.strokeStyle = mine ? 'rgba(150,100,30,0.75)' : 'rgba(90,110,120,0.6)';
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawPath(path, turns) {
    ctx.save();
    ctx.strokeStyle = 'rgba(160,35,25,0.85)'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 5]); ctx.lineCap = 'round';
    ctx.beginPath();
    path.forEach((t, k) => { k ? ctx.lineTo(tx(t), ty(t)) : ctx.moveTo(tx(t), ty(t)); });
    ctx.stroke(); ctx.setLineDash([]);
    if (turns) for (const [t, n] of turns) {
      ctx.fillStyle = 'rgba(160,35,25,0.9)'; ctx.beginPath(); ctx.arc(tx(t), ty(t), 7, 0, 7); ctx.fill();
      ctx.fillStyle = '#f4ecd8'; ctx.font = `bold 10px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n, tx(t), ty(t) + 0.5);
    }
    const last = path[path.length - 1];
    hexPath(ctx, tx(last), ty(last), HS - 3); ctx.strokeStyle = 'rgba(160,35,25,0.9)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
  function drawCityArt(S, z) {
    const sz = Math.max(9, Math.min(24, 7 + 10 * z));
    const cities = [];
    for (const c of S.cities) {
      if (!S.explored[c.tile]) continue;
      const [x, y] = w2s(tx(c.tile), ty(c.tile));
      if (!onScreen(x, y, 60)) continue;
      const f = anim?.cityF.has(c.id) ? anim.cityF.get(c.id) : c.f;
      const F = cityFaction(f), capital = !!F && c.cap, s = capital ? sz * 1.25 : sz;
      cities.push({ c, x, y, F, capital, s });
      if (F && z >= 0.55) {
        const box = INKART.BOX, scale = Math.min(z, 1.65);
        const img = INKART.cityArt(c.tier, c.pop);
        ctx.drawImage(img, x - box.ax * scale, y - box.ay * scale - s * 0.43, box.w * scale, box.h * scale);
      }
    }
    return cities;
  }
  function drawCities(S, z, cities) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const { c, x, y, F, capital, s } of cities) {
      const tier = F ? c.tier : 0, big = c.tier >= 2, color = F?.color || RUIN_INK;
      if (z < 0.42 && !big) { ctx.fillStyle = color; ctx.fillRect(x - 2.5, y - 2.5, 5, 5); continue; }
      const edge = s / 2 + (tier >= 2 ? 2 : 0);
      labelBlocks.push([x - edge, y - edge, x + edge, y + edge, c]);
      // 印章
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(20,18,16,0.8)'; ctx.lineWidth = 1;
      const radius = tier === 1 ? s * 0.21 : 0;
      roundRect(ctx, -s / 2, -s / 2, s, s, radius); ctx.fill(); ctx.stroke();
      if (tier >= 2) {
        ctx.strokeStyle = tier === 3 ? '#a4382e' : color;
        ctx.strokeRect(-s / 2 - 2, -s / 2 - 2, s + 4, s + 4);
      }
      if (tier === 3) {
        ctx.strokeStyle = 'rgba(245,236,214,0.9)';
        ctx.strokeRect(-s / 2 + 2.5, -s / 2 + 2.5, s - 5, s - 5);
      }
      ctx.fillStyle = '#f6eedb'; ctx.font = `bold ${Math.round(s * 0.68)}px ${FONT}`;
      ctx.fillText(F ? c.name[0] : '荒', 0, 1);
      ctx.restore();
      // 城名
      if (z >= 0.5 || big) {
        const fs = Math.max(11, Math.min(18, 9 + 5 * z));
        const label = c.name + (F && z > 0.9 ? ' ' + c.pop + '万' : '');
        pushLabel(label, x, y + s / 2 + fs * 0.7, fs, F ? 'rgba(25,22,20,0.95)' : RUIN_INK,
          capital ? 115 : big ? 104 : 101, 3.5, { owner: c, bold: capital });
      }
      // 城防残损
      if (F && z > 0.7 && c.wall < GAME.maxWall(c) * 0.6) {
        const w = s; const r = c.wall / GAME.maxWall(c);
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - w / 2, y - s / 2 - 5, w, 3);
        ctx.fillStyle = 'rgba(180,40,30,0.9)'; ctx.fillRect(x - w / 2, y - s / 2 - 5, w * r, 3);
      }
      // 资源角标：守军数
      if (z > 1.6 && F?.id === S.player) {
        ctx.font = `10px ${FONT}`; ctx.fillStyle = 'rgba(40,30,20,0.8)';
        ctx.fillText('戍' + c.garrison.length, x + s * 0.9, y - s * 0.4);
      }
    }
    // 资源
    if (z > 1.6 && opts.showRes) {
      const [ax, ay] = screenToWorld(0, 0), [bx, by] = screenToWorld(innerWidth, innerHeight);
      ctx.font = `bold 10px ${FONT}`;
      for (let i = 0; i < W * H; i++) {
        const r = GEO.resource[i]; if (!r || !S.explored[i]) continue;
        const wx = tx(i), wy = ty(i); if (wx < ax - 30 || wx > bx + 30 || wy < ay - 30 || wy > by + 30) continue;
        if (GAME.cityAt(i)) continue;
        const [x, y] = w2s(wx + HS * 0.45, wy - HS * 0.45);
        ctx.fillStyle = 'rgba(245,238,220,0.85)'; ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(120,80,30,0.7)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = 'rgba(110,60,20,0.95)'; ctx.fillText(r[0], x, y + 0.5);
      }
    }
  }
  function drawSites(S, z) {
    if (!S.sites || z < 0.38) return;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const s = Math.max(9, Math.min(17, 5 + 8 * z));
    for (const st of S.sites) {
      if (st.used || !S.explored[st.tile]) continue;
      const [x, y] = w2s(tx(st.tile), ty(st.tile));
      if (!onScreen(x, y, 30)) continue;
      const T = DATA.SITES[st.type];
      const cd = T.repeat === 'season' && st.cd[S.player] > S.T;
      ctx.save(); ctx.globalAlpha = cd ? 0.45 : 1;
      ctx.translate(x, y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = st.famous ? '#efe2b8' : '#f3ead2'; ctx.strokeStyle = '#7a5418'; ctx.lineWidth = 1.6;
      ctx.fillRect(-s / 2, -s / 2, s, s); ctx.strokeRect(-s / 2, -s / 2, s, s);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = '#6a3e0e'; ctx.font = `bold ${Math.round(s * 0.78)}px ${FONT}`; ctx.fillText(T.glyph, 0, 1);
      ctx.restore();
      if (z >= 1.0 && st.famous) pushLabel(st.name, x, y + s * 0.95 + 4, Math.max(10, 9 + 2 * z), '#6a3e0e', 20, 3);
    }
  }
  // ---------- 标签避让 ----------
  let labels = [], labelBlocks = [];
  const cityLabelOffsets = [[0, 0], [10, 0], [-10, 0]];
  const armyLabelOffsets = [0, 11, 21].flatMap(dy => [0, 16, -16, 29, -29].map(dx => [dx, dy]));
  const countOffsets = [[0, 0], [12, 1], [-12, 1], [0, 11], [23, 2], [-23, 2], [14, 11], [-14, 11], [0, 22]];
  function pushLabel(text, x, y, size, fill, pri, sw, { owner, bold, count, radius } = {}) {
    labels.push({ text, x, y, size, fill, pri, sw, owner, bold, count, radius });
  }
  function drawLabels() {
    labels.sort((a, b) => b.pri - a.pri);
    const placed = labelBlocks;
    const clear = (left, top, right, bottom, owner) => !placed.some(q =>
      left < q[2] && right > q[0] && top < q[3] && bottom > q[1] && (owner == null || q[4] !== owner));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const hiddenArmyLabels = [];
    for (const L of labels) {
      const h = L.size + 2;
      ctx.font = `${L.bold ? 'bold ' : ''}${L.size}px ${FONT}`;
      const w = ctx.measureText(L.text).width + 4;
      const isArmy = L.count != null;
      let offsets = isArmy ? armyLabelOffsets : L.owner ? cityLabelOffsets : [[0, 0]];
      if (L.pri === 200) {
        const dx = L.radius + w / 2 + 4, dy = -(L.radius + L.size / 2 + 8);
        offsets = [...offsets, [dx, dy], [-dx, dy]];
      }
      const anchor = isArmy && L.x >= 0 && L.x < innerWidth ? Math.max(w / 2, Math.min(innerWidth - w / 2, L.x)) : L.x;
      const pos = offsets.find(([dx, dy]) => {
        const x = anchor + dx, y = L.y + dy;
        return clear(x - w / 2, y - h / 2, x + w / 2, y + h / 2, L.owner);
      });
      if (!pos) {
        if (L.count != null) hiddenArmyLabels.push(L);
        continue;
      }
      const x = anchor + pos[0], y = L.y + pos[1];
      placed.push([x - w / 2, y - h / 2, x + w / 2, y + h / 2]);
      ctx.lineWidth = L.sw; ctx.strokeStyle = 'rgba(242,234,214,0.95)'; ctx.strokeText(L.text, x, y);
      ctx.fillStyle = L.fill; ctx.fillText(L.text, x, y);
    }
    ctx.font = `bold 9px ${FONT}`;
    for (const L of hiddenArmyLabels) {
      const count = String(L.count), w = count.length * 5.5 + 4;
      const [dx, dy] = countOffsets.find(([dx, dy]) => {
        const x = L.x + dx, y = L.y - 8 + dy;
        return clear(x - w / 2, y - 5.5, x + w / 2, y + 5.5, L.owner);
      }) || countOffsets[0];
      const x = L.x + dx, y = L.y - 8 + dy;
      placed.push([x - w / 2, y - 5.5, x + w / 2, y + 5.5]);
      ctx.fillStyle = '#f0e4cb'; ctx.fillRect(x - w / 2, y - 5.5, w, 11);
      ctx.strokeStyle = 'rgba(73,53,32,0.7)'; ctx.lineWidth = 0.65; ctx.strokeRect(x - w / 2, y - 5.5, w, 11);
      ctx.fillStyle = L.fill; ctx.fillText(count, x, y);
    }
    labels = [];
  }
  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  // ---------- 军队绘制（含画像） ----------
  function transitXY(a) {
    let x = tx(a.tile), y = ty(a.tile);
    if (a.progTo != null && a.progFrac > 0 && GEO.dist(a.tile, a.progTo) === 1) { const k = Math.min(0.62, a.progFrac * 0.75); x += (tx(a.progTo) - x) * k; y += (ty(a.progTo) - y) * k; }
    return [x, y];
  }
  function armyMarker(tile, wx, wy, z) {
    let [x, y] = w2s(wx, wy);
    const low = z < 0.6;
    let radius = low ? Math.max(10, 8 + 11 * z) : Math.max(10, Math.min(19, 6 + 8 * z));
    if (Math.abs(wx - tx(tile)) < 0.5 && Math.abs(wy - ty(tile)) < 0.5) {
      if (GAME.cityAt(tile)) {
        x += radius * (low ? 0.75 : 1.36);
        y -= radius * (low ? 0.55 : 1.18);
        if (!low) radius *= 0.75;
      } else if (!low && z < 1.7) {
        let dx = 0, dy = 0, near = 0;
        for (const n of GEO.NBR[tile]) if (GAME.cityAt(n)) {
          dx += wx - tx(n); dy += wy - ty(n); near++;
        }
        if (near) {
          const len = Math.hypot(dx, dy) || 1;
          x += dx / len * radius * 0.46;
          y += dy / len * radius * 0.46;
          radius *= 0.87;
        }
      }
    }
    return { x, y, radius };
  }
  function armyAtScreen(x, y) {
    const S = GAME.S, z = cam.z;
    let hit = null, nearest = Infinity;
    for (let i = S.armies.length - 1; i >= 0; i--) {
      const a = S.armies[i];
      if (a.f !== S.player && !S.visible[a.tile]) continue;
      const p = armyMarker(a.tile, ...transitXY(a), z);
      const dx = x - p.x - (z < 0.6 ? p.radius * 0.05 : 0);
      const dy = y - p.y + (z < 0.6 ? p.radius * 0.44 : 0);
      const d = dx * dx + dy * dy, r = z < 0.6 ? p.radius * 0.6 : p.radius + 1.6;
      if (d <= r * r && d < nearest) { hit = a; nearest = d; }
    }
    return hit;
  }
  function dispOf(a, [x, y] = transitXY(a)) { return { id: a.id, f: a.f, tile: a.tile, x, y, gen: a.gen, n: a.units.length, str: GAME.sumStr(a.units), idle: a.mp > 0 && !(a.path && a.path.length) && !a.sentry, spent: a.mp <= 0, routed: !!(a.path && a.path.length), sentry: !!a.sentry }; }
  function drawArmies(S, z, now) {
    if (!anim) {
      for (const a of S.armies) {
        if (a.f !== S.player && !S.visible[a.tile]) continue;
        const pos = transitXY(a);
        const [x, y] = w2s(...pos);
        if (onScreen(x, y, 60)) drawArmyEntry(dispOf(a, pos), z, now, 1);
      }
      return;
    }
    for (const d of anim.disp.values()) {
      const mine = d.f === S.player;
      if (!mine && !(S.visible[d.tile] || (anim && anim.vis[d.tile]))) continue;
      let alpha = 1;
      if (d.dying) { alpha = Math.max(0, 1 - (now - d.dying) / d.dyingDur); }
      drawArmyEntry(d, z, now, alpha);
    }
  }
  function drawSentryMark(x, y) {
    ctx.save();
    ctx.font = `bold 11px ${FONT}`;
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#f6eedb'; ctx.fillStyle = '#463427';
    ctx.strokeText('垒', x, y); ctx.fillText('垒', x, y);
    ctx.restore();
  }
  function drawArmyEntry(d, z, now, alpha) {
    const S = GAME.S;
    let { x, y, radius } = armyMarker(d.tile, d.x, d.y, z);
    if (!onScreen(x, y, 60)) return;
    const F = GAME.fac(d.f);
    const g = GAME.gen(d.gen);
    const sel = state.sel && state.sel.army === d.id;
    const mine = d.f === S.player;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (d.shake) { x += d.shake[0]; y += d.shake[1]; }
    if (z < 0.6) {
      const s = radius;
      ctx.strokeStyle = 'rgba(30,25,20,0.95)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x - s * 0.45, y + s * 0.6); ctx.lineTo(x - s * 0.45, y - s * 0.75); ctx.stroke();
      ctx.fillStyle = F.color; ctx.fillRect(x - s * 0.45, y - s * 0.75, s, s * 0.62);
      ctx.strokeStyle = sel ? 'rgba(220,170,40,1)' : 'rgba(20,18,16,0.7)'; ctx.lineWidth = sel ? 2 : 1; ctx.strokeRect(x - s * 0.45, y - s * 0.75, s, s * 0.62);
      ctx.fillStyle = '#f6eedb'; ctx.font = `bold ${Math.round(s * 0.5)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(g ? g.name[0] : '军', x + s * 0.05, y - s * 0.44);
      if (d.sentry) drawSentryMark(x + s, y - s * 0.44);
      ctx.restore(); return;
    }
    const R = radius;
    const edge = R * 0.86;
    labelBlocks.push([x - edge, y - edge, x + edge, y + edge, d]);
    // 小旗
    const fx0 = x + R * 0.55, fy0 = y - R * 0.55;
    ctx.strokeStyle = 'rgba(30,25,20,0.9)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(fx0, fy0); ctx.lineTo(fx0, fy0 - R * 1.25); ctx.stroke();
    const wave = Math.sin(now / 280 + d.id) * 1.5;
    ctx.fillStyle = F.color;
    ctx.beginPath(); ctx.moveTo(fx0, fy0 - R * 1.25); ctx.quadraticCurveTo(fx0 + R * 0.45, fy0 - R * 1.25 + wave, fx0 + R * 0.9, fy0 - R * 1.1);
    ctx.lineTo(fx0 + R * 0.8, fy0 - R * 0.62 + wave * 0.5); ctx.quadraticCurveTo(fx0 + R * 0.4, fy0 - R * 0.62, fx0, fy0 - R * 0.62); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f6eedb'; ctx.font = `bold ${Math.round(R * 0.48)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(F.seal, fx0 + R * 0.42, fy0 - R * 0.93);
    if (d.sentry) drawSentryMark(fx0 + R + 7, fy0 - R * 0.93);
    // 画像圆章
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(x + 1.5, y + 2, R, 0, 7); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.clip();
    if (g) {
      const portrait = PORTRAIT.get(g);
      if (portrait.width === 64) ctx.drawImage(portrait, x - R, y - R, R * 2, R * 2);
      else ctx.drawImage(portrait, 8, 4, 80, 80, x - R, y - R, R * 2, R * 2);
    }
    else { ctx.fillStyle = F.color; ctx.fillRect(x - R, y - R, R * 2, R * 2); ctx.fillStyle = '#f6eedb'; ctx.font = `bold ${Math.round(R)}px ${FONT}`; ctx.fillText('军', x, y + 1); }
    ctx.restore();
    ctx.strokeStyle = F.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(20,18,16,0.85)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, R + 1.6, 0, 7); ctx.stroke();
    if (sel) { const pulse = selectionPulseUntil ? 0.5 + 0.5 * Math.sin(now / 220) : 0.67; ctx.strokeStyle = `rgba(214,166,40,${0.6 + 0.4 * pulse})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, R + 4 + pulse * 2, 0, 7); ctx.stroke(); }
    // 兵力条
    const bw = R * 2;
    const ratio = d.n ? Math.min(1, d.str / (d.n * 500)) : 0;
    ctx.fillStyle = 'rgba(20,18,16,0.6)'; ctx.fillRect(x - R, y + R + 3, bw, 4);
    ctx.fillStyle = mine ? 'rgba(80,140,60,0.95)' : 'rgba(176,52,40,0.95)'; ctx.fillRect(x - R, y + R + 3, bw * ratio, 4);
    // 名牌
    const fs = Math.max(11, Math.min(14, 8 + 3.8 * z));
    const name = g ? g.name : '偏师';
    const label = mine || z >= 0.9 ? name + ' ' + fmtNum(d.str) : name;
    pushLabel(label, x, y + R + fs / 2 + 8, fs, mine ? 'rgba(20,18,16,1)' : 'rgba(120,30,22,1)',
      sel ? 200 : mine ? 110 : 80, 3.2, { owner: d, bold: true, count: d.str, radius: R });
    if (mine && !anim && (d.spent || d.routed)) {
      const bx = x - R * 0.85, by = y - R * 0.85;
      ctx.fillStyle = d.spent ? 'rgba(120,115,105,0.95)' : 'rgba(168,48,42,0.95)'; ctx.beginPath(); ctx.arc(bx, by, 7, 0, 7); ctx.fill();
      ctx.strokeStyle = '#f4ecd8'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#f8f0dc'; ctx.font = `bold 9px ${FONT}`; ctx.fillText(d.spent ? '歇' : '行', bx, by + 0.5);
    }
    if (mine && d.idle && !anim) { ctx.fillStyle = 'rgba(214,160,30,1)'; ctx.beginPath(); ctx.arc(x - R * 0.8, y - R * 0.8, 3.5, 0, 7); ctx.fill(); ctx.strokeStyle = '#3a2a10'; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.restore();
  }
  function fmtNum(n) { n = Math.round(n); return n >= 10000 ? (n / 10000).toFixed(1) + '万' : String(n); }

  // ---------- 回合动画 ----------
  let anim = null;
  const fx = { floats: [], stamps: [], bursts: [] };
  function snapshot() {
    const S = GAME.S;
    const disp = new Map();
    for (const a of S.armies) disp.set(a.id, dispOf(a));
    const cityF = new Map(); for (const c of S.cities) cityF.set(c.id, c.f);
    return { disp, cityF, vis: S.visible.slice() };
  }
  function play(snap, events, speed, onDone, follow) {
    const S = GAME.S;
    const steps = [];
    let batch = null, batchF = null;
    const flush = () => { if (batch && batch.size) steps.push({ k: 'march', paths: batch, f: batchF }); batch = null; batchF = null; };
    for (const ev of events) {
      if (ev.k === 'mv' || ev.k === 'mvp') {
        if (batch && batchF !== ev.f) flush();
        if (!batch) { batch = new Map(); batchF = ev.f; }
        let p = batch.get(ev.id); if (!p) { p = [{ tile: ev.from }]; batch.set(ev.id, p); }
        if (ev.k === 'mv') p.push({ tile: ev.to, x: tx(ev.to), y: ty(ev.to) });
        else { const k = Math.min(0.62, ev.f1 * 0.75); p.push({ tile: ev.from, x: tx(ev.from) + (tx(ev.to) - tx(ev.from)) * k, y: ty(ev.from) + (ty(ev.to) - ty(ev.from)) * k, partial: true, to: ev.to }); }
      } else { flush(); steps.push({ k: ev.k, ev }); }
    }
    flush();
    if (!speed && follow == null && steps.some(st => st.k === 'march' && st.f === S.player)) AUDIO.play('march');
    if (!speed) {
      const change = steps.findLast(st => st.k === 'cap' && (st.ev.from === S.player || st.ev.to === S.player));
      if (change) AUDIO.play(change.ev.to === S.player ? 'capture' : 'lost', true);
    }
    anim = { disp: snap.disp, cityF: snap.cityF, vis: snap.vis, steps, i: 0, cur: null, speed: speed || 0, onDone, total: 0, follow: !!follow, label: '' };
    const vis = t => t >= 0 && (anim.vis[t] || S.visible[t]);
    const onscr = t => { const [x, y] = w2s(tx(t), ty(t)); return onScreen(x, y, 80); };
    // 预估时长
    let total = 0; const fxs = [], fys = [];
    for (const st of steps) {
      st.dur = 0;
      if (!speed) continue;
      if (st.k === 'march') {
        let m = 0;
        for (const [id, p] of st.paths) {
          const d = anim.disp.get(id);
          const mine = d && d.f === S.player;
          const ts = p.map(q => q.tile).concat(p.filter(q => q.to != null).map(q => q.to));
          if ((mine || ts.some(vis)) && (follow || ts.some(onscr))) {
            m = Math.max(m, Math.min(1000, 170 * Math.max(1, p.length - 1)));
            const q = p[p.length - 1]; fxs.push(q.x); fys.push(q.y);
          }
        }
        st.dur = m;
        if (fxs.length) { st.focus = [fxs[0], fys[0]]; }
        fxs.length = 0; fys.length = 0;
      } else if (st.k === 'bt') {
        const e = st.ev;
        if ((vis(e.tile) || vis(e.from)) && (follow || onscr(e.tile) || onscr(e.from))) { st.dur = 1350; st.focus = [tx(e.tile), ty(e.tile)]; st.f = e.af; }
      } else if (st.k === 'gain' && !st.ev.quiet) {
        if (vis(st.ev.tile) && (follow || onscr(st.ev.tile))) { st.dur = 450; st.focus = [tx(st.ev.tile), ty(st.ev.tile)]; st.f = st.ev.f; }
      } else if (st.k === 'die') {
        const d = anim.disp.get(st.ev.id);
        if (d && !st.ev.quiet && vis(d.tile) && onscr(d.tile)) st.dur = 450;
      }
      total += st.dur;
    }
    const k = (speed === 2 ? 0.5 : 1) * Math.min(1, 20000 / Math.max(1, total * (speed === 2 ? 0.5 : 1)));
    anim.k = k;
    for (const st of steps) st.dur *= k;
    markDirty();
    if (!steps.length) finishAnim();
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  const phoneReplay = matchMedia('(max-width: 600px), (max-height: 500px)');
  function replayWidth() { return phoneReplay.matches ? innerWidth : innerWidth - 380; }
  function inView(x, y) { const [sx, sy] = w2s(x, y); const w = replayWidth(); return sx > w * 0.12 && sx < w * 0.88 && sy > 90 && sy < innerHeight - 150; }
  function posOnPath(p, t) {
    if (p.length < 2) return [p[0].x, p[0].y, p[0].tile];
    const seg = t * (p.length - 1), i = Math.min(p.length - 2, Math.floor(seg)), f = seg - i;
    const a = p[i], b = p[i + 1];
    return [lerp(a.x, b.x, f), lerp(a.y, b.y, f), f < 0.5 ? a.tile : b.tile];
  }
  function stepAnim(now) {
    while (anim) {
      if (!anim.cur) {
        if (anim.i >= anim.steps.length) { finishAnim(); return; }
        anim.cur = anim.steps[anim.i++]; anim.cur.t0 = now; anim.cur.fired = {};
        const st0 = anim.cur;
        if (st0.dur > 0 && st0.f) { const F = GAME.fac(st0.f); anim.label = st0.f === GAME.S.player ? '' : `【${F.name}】行动中`; anim.labelColor = F.color; }
        if (anim.follow && st0.dur > 0 && st0.focus && !inView(st0.focus[0], st0.focus[1])) {
          const pd = 450 * (anim.k || 1) + 120;
          st0.pan = { x0: cam.x, y0: cam.y, x1: st0.focus[0] - replayWidth() / 2 / cam.z, y1: st0.focus[1] - innerHeight / 2 / cam.z, t0: now, d: pd };
          st0.t0 = now + pd;
        }
        beginStep(anim.cur, now);
        if (st0.k === 'sound') AUDIO.play(st0.ev.cue);
        if (st0.k === 'cap' && anim.speed) {
          const player = GAME.S.player;
          if (st0.ev.to === player) AUDIO.play('capture', true);
          else if (st0.ev.from === player) AUDIO.play('lost', true);
        }
      }
      const st = anim.cur;
      if (st.pan && now < st.t0) {
        const q = Math.min(1, (now - st.pan.t0) / st.pan.d), e = q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
        cam.x = lerp(st.pan.x0, st.pan.x1, e); cam.y = lerp(st.pan.y0, st.pan.y1, e); clampCam();
        return;
      }
      const p = st.dur > 0 ? (now - st.t0) / st.dur : 1;
      if (p >= 1) { endStep(st, now); anim.cur = null; continue; }
      runStep(st, p, now);
      return;
    }
  }
  function beginStep(st, now) {
    if (st.k === 'new') {
      const e = st.ev;
      if (!anim.disp.has(e.id)) anim.disp.set(e.id, { id: e.id, f: e.f, tile: e.tile, x: tx(e.tile), y: ty(e.tile), gen: e.gen, n: e.n, str: e.str });
    }
    if (st.k === 'die') { const d = anim.disp.get(st.ev.id); if (d && st.dur > 0) { d.dying = now; d.dyingDur = st.dur; } }
    if (st.k === 'gain' && st.dur > 0) fx.floats.push({ x: tx(st.ev.tile), y: ty(st.ev.tile) - 14, text: st.ev.text, color: '#8a6414', t0: now, dur: 1600 });
    if (st.k === 'march') for (const [id, p] of st.paths) { const d = anim.disp.get(id); const s0 = p[0]; s0.x = d ? d.x : tx(s0.tile); s0.y = d ? d.y : ty(s0.tile); }
  }
  function runStep(st, p, now) {
    if (st.k === 'march') {
      if (!st.fired.sound) { st.fired.sound = true; AUDIO.play('march'); }
      for (const [id, path] of st.paths) {
        const d = anim.disp.get(id); if (!d) continue;
        const [x, y, t] = posOnPath(path, Math.min(1, p));
        d.x = x; d.y = y; d.tile = t;
      }
    } else if (st.k === 'bt') {
      const e = st.ev, A = anim.disp.get(e.aid), D = e.did != null ? anim.disp.get(e.did) : null;
      if (!st.fired.sound) { st.fired.sound = true; if (!e.manual) AUDIO.play('battle', true); }
      const fx0 = tx(e.from), fy0 = ty(e.from), tx1 = tx(e.tile), ty1 = ty(e.tile);
      let k;
      if (p < 0.28) k = 0.5 * (p / 0.28);
      else if (p < 0.66) k = 0.5;
      else k = 0.5 * (1 - (p - 0.66) / 0.34);
      if (A) { A.x = lerp(fx0, tx1, k); A.y = lerp(fy0, ty1, k); A.shake = p > 0.28 && p < 0.66 ? [Math.sin(now / 25) * 2.5, Math.cos(now / 31) * 2] : null; }
      if (D) D.shake = p > 0.28 && p < 0.66 ? [Math.sin(now / 27 + 1) * 2.5, Math.cos(now / 23) * 2] : null;
      const mx = lerp(fx0, tx1, 0.72), my = lerp(fy0, ty1, 0.72);
      if (p >= 0.28 && !st.fired.clash) {
        st.fired.clash = 1;
        if (!e.manual) AUDIO.play('clash', true);
        fx.bursts.push({ x: mx, y: my, t0: now, dur: Math.max(400, st.dur * 0.45) });
        const fd = Math.max(900, st.dur * 1.1);
        if (e.lossA > 0) fx.floats.push({ x: lerp(fx0, tx1, 0.35), y: lerp(fy0, ty1, 0.35) - 10, text: '-' + fmtNum(e.lossA), color: e.af === GAME.S.player ? '#a8302a' : '#5a1810', t0: now, dur: fd });
        if (e.lossD > 0) fx.floats.push({ x: tx1 + 8, y: ty1 - 12, text: '-' + fmtNum(e.lossD), color: e.df === GAME.S.player ? '#a8302a' : '#5a1810', t0: now + 120, dur: fd });
      }
      if (p >= 0.62 && !st.fired.stamp) {
        st.fired.stamp = 1;
        const P = GAME.S.player;
        let ch = '战', good = null;
        if (e.af === P) { ch = e.capture ? '克' : e.win ? '捷' : '挫'; good = e.win; }
        else if (e.df === P) { ch = e.capture ? '陷' : e.win ? '败' : '守'; good = !e.win; }
        else if (e.capture) ch = '破';
        if (good !== null && !e.manual) AUDIO.play(good ? 'win' : 'lose', true);
        fx.stamps.push({ x: tx1, y: ty1 - 4, ch, good, t0: now, dur: Math.max(900, st.dur * 0.9) });
      }
    } else if (st.k === 'die') { /* 淡出 */ }
  }
  function endStep(st, now) {
    if (st.k === 'march') {
      for (const [id, path] of st.paths) { const d = anim.disp.get(id); if (!d) continue; const q = path[path.length - 1]; d.tile = q.tile; d.x = q.x; d.y = q.y; }
    } else if (st.k === 'bt') {
      const e = st.ev, A = anim.disp.get(e.aid), D = e.did != null ? anim.disp.get(e.did) : null;
      if (A) { A.shake = null; A.x = tx(e.from); A.y = ty(e.from); A.tile = e.from; A.str = e.aStr; A.n = e.aN; if (e.capture) { A.tile = e.tile; A.x = tx(e.tile); A.y = ty(e.tile); } }
      if (D) { D.shake = null; D.str = e.dStr; D.n = e.dN; if (e.retreat != null) { D.tile = e.retreat; D.x = tx(e.retreat); D.y = ty(e.retreat); } }
    } else if (st.k === 'gain' && st.ev.str != null) {
      const d = anim.disp.get(st.ev.id);
      if (d) { d.str = st.ev.str; d.n = st.ev.n; if (!d.n) anim.disp.delete(d.id); }
    } else if (st.k === 'die') anim.disp.delete(st.ev.id);
    else if (st.k === 'cap') { anim.cityF.set(st.ev.city, st.ev.to); }
  }
  function finishAnim() {
    if (!anim) return;
    const done = anim.onDone;
    anim = null;
    fx.floats = fx.floats.filter(f => performance.now() - f.t0 < f.dur);
    markDirty();
    if (done) done();
  }
  function skipAnim() {
    if (!anim) return;
    const now = performance.now();
    if (anim.cur) { endStep(anim.cur, now); anim.cur = null; }
    while (anim.i < anim.steps.length) { const st = anim.steps[anim.i++]; st.dur = 0; beginStep(st, now); endStep(st, now); }
    fx.bursts = []; fx.stamps = [];
    finishAnim();
  }
  function drawFx(now) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fx.bursts = fx.bursts.filter(b => now - b.t0 < b.dur);
    for (const b of fx.bursts) {
      const p = (now - b.t0) / b.dur;
      const [x, y] = w2s(b.x, b.y);
      const r = (8 + 26 * p) * Math.max(0.6, cam.z);
      ctx.fillStyle = `rgba(30,25,20,${0.35 * (1 - p)})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.strokeStyle = `rgba(180,40,30,${0.9 * (1 - p)})`; ctx.lineWidth = 3 * (1 - p) + 1;
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3 + b.t0 % 1;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4); ctx.lineTo(x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.1); ctx.stroke();
      }
      // 交叉刀
      ctx.strokeStyle = `rgba(20,18,16,${1 - p})`; ctx.lineWidth = 2.5;
      const L = 12 * Math.max(0.7, cam.z);
      ctx.beginPath(); ctx.moveTo(x - L, y - L); ctx.lineTo(x + L, y + L); ctx.moveTo(x + L, y - L); ctx.lineTo(x - L, y + L); ctx.stroke();
    }
    fx.floats = fx.floats.filter(f => now - f.t0 < f.dur);
    for (const f of fx.floats) {
      const p = (now - f.t0) / f.dur; if (p < 0) continue;
      const [x, y] = w2s(f.x, f.y);
      const fs = Math.max(14, Math.min(24, 12 + 8 * cam.z));
      ctx.font = `bold ${fs}px ${FONT}`;
      ctx.globalAlpha = p < 0.7 ? 1 : (1 - p) / 0.3;
      const yy = y - 34 * p;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(248,240,222,0.95)'; ctx.strokeText(f.text, x, yy);
      ctx.fillStyle = f.color; ctx.fillText(f.text, x, yy);
      ctx.globalAlpha = 1;
    }
    fx.stamps = fx.stamps.filter(s => now - s.t0 < s.dur);
    for (const s of fx.stamps) {
      const p = (now - s.t0) / s.dur;
      const [x, y] = w2s(s.x, s.y);
      const base = Math.max(26, Math.min(44, 20 + 14 * cam.z));
      const sc = p < 0.15 ? 1.8 - 0.8 * (p / 0.15) : 1;
      const sz = base * sc;
      ctx.save();
      ctx.globalAlpha = p > 0.75 ? (1 - p) / 0.25 : 1;
      ctx.translate(x, y); ctx.rotate(-0.12);
      ctx.fillStyle = s.good === true ? '#b3322a' : s.good === false ? '#221e19' : '#6b5a48';
      ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
      ctx.strokeStyle = 'rgba(248,239,220,0.8)'; ctx.lineWidth = 2; ctx.strokeRect(-sz / 2 + 3, -sz / 2 + 3, sz - 6, sz - 6);
      ctx.fillStyle = '#f8efdc'; ctx.font = `bold ${Math.round(sz * 0.7)}px ${FONT}`;
      ctx.fillText(s.ch, 0, 1);
      ctx.restore();
    }
  }
  function drawMiniView() {
    const mv = document.getElementById('miniview');
    if (!mv || !miniCanvas) return;
    const k = miniCanvas.clientWidth / BW;
    if (!k) return;
    mv.style.left = (cam.x * k) + 'px'; mv.style.top = (cam.y * k) + 'px';
    mv.style.width = (innerWidth / cam.z * k) + 'px'; mv.style.height = (innerHeight / cam.z * k) + 'px';
  }

  return {
    opts, init, buildBase, buildPolitical, buildFog, buildMini, drawOverview, cam, state, snapshot, play, skipAnim, isAnimating: () => !!anim, tileAtScreen, armyAtScreen, centerOn, pan, zoomAt, tx, ty, BW, BH, FONT, markDirty, wakeSelection,
    flash: (tile) => { state.flash = { tile, t: performance.now() }; markDirty(); }, minZoom,
  };
})();
