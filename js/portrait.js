// 将领画像：按文化与文武程序化生成的小像
var PORTRAIT = (function () {
  const cache = new Map(), urls = new Map();
  const art = new Map(), artCanvases = new Map();
  const historicalKeys = new Map((typeof DATA === 'undefined' ? [] : DATA.GEN)
    .map(([name, faction, birth]) => [name + '\n' + birth, faction + '_' + name]));
  const available = new Set(typeof PORTRAIT_ASSETS === 'undefined' ? [] : PORTRAIT_ASSETS);
  const SZ = 96;
  function rnd(seed) { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  const EURO = { frankish: 1, english: 1, german: 1, iberian: 1, italian: 1, polish: 1, magyar: 1, norse: 1 };
  const TURBAN = { turkic: 1, persian: 1, arab: 1, moorish: 1 };
  const SEA = { viet: 1, cham: 1, khmer: 1, burmese: 1, filipino: 1 };
  function skin(cul) {
    if (cul === 'indian' || cul === 'ethiopian') return '#c99a6e';
    if (SEA[cul]) return '#dcb488';
    if (TURBAN[cul]) return '#e2bf98';
    if (EURO[cul] || cul === 'rus' || cul === 'greek' || cul === 'georgian') return '#f1d9c4';
    return '#efd6b2';
  }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

  function draw(g, color, cul, year) {
    const c = document.createElement('canvas'); c.width = c.height = SZ;
    const x = c.getContext('2d');
    x.scale(SZ / 64, SZ / 64);
    const R = rnd(g.id * 7 + g.name.length * 131 + (g.name.charCodeAt(0) || 0));
    const mil = (g.tong + g.wu) >= (g.zhi + g.zheng);
    const age = (year || 1140) - g.birth;
    const ink = '#211d18';
    // 底
    const bg = x.createRadialGradient(32, 28, 4, 32, 32, 34);
    bg.addColorStop(0, '#f5eedb'); bg.addColorStop(1, '#ddcfae');
    x.fillStyle = bg; x.fillRect(0, 0, 64, 64);
    // 身
    x.beginPath(); x.moveTo(2, 66); x.quadraticCurveTo(8, 48, 20, 47); x.lineTo(44, 47); x.quadraticCurveTo(56, 48, 62, 66); x.closePath();
    if (mil) {
      x.fillStyle = '#4a433a'; x.fill();
      x.strokeStyle = ink; x.lineWidth = 1.2; x.stroke();
      // 甲片
      x.strokeStyle = 'rgba(230,215,180,0.35)'; x.lineWidth = 0.7;
      for (let yy = 52; yy < 64; yy += 3.5) { x.beginPath(); x.moveTo(10, yy); x.lineTo(54, yy); x.stroke(); }
      x.fillStyle = color; x.beginPath(); x.moveTo(24, 47); x.lineTo(32, 58); x.lineTo(40, 47); x.closePath(); x.fill();
      x.fillStyle = hexA(color, 0.9); x.beginPath(); x.ellipse(13, 52, 7, 4, -0.5, 0, 7); x.ellipse(51, 52, 7, 4, 0.5, 0, 7); x.fill();
    } else {
      x.fillStyle = color; x.fill(); x.strokeStyle = ink; x.lineWidth = 1.2; x.stroke();
      x.strokeStyle = 'rgba(250,240,220,0.8)'; x.lineWidth = 1.6;
      x.beginPath(); x.moveTo(25, 47); x.lineTo(32, 56); x.lineTo(39, 47); x.stroke();
    }
    // 颈与脸
    const sk = skin(cul);
    x.fillStyle = sk; x.fillRect(28, 40, 8, 9);
    const fw = 10.5 + R() * 2.5, fh = 13 + R() * 1.5;
    x.beginPath(); x.ellipse(32, 31, fw, fh, 0, 0, 7); x.fillStyle = sk; x.fill();
    x.strokeStyle = 'rgba(40,30,20,0.75)'; x.lineWidth = 1; x.stroke();
    // 耳
    x.beginPath(); x.ellipse(32 - fw, 32, 2, 3, 0, 0, 7); x.ellipse(32 + fw, 32, 2, 3, 0, 0, 7); x.fillStyle = sk; x.fill();
    // 眉眼
    x.strokeStyle = ink; x.lineWidth = 1.5; x.lineCap = 'round';
    const tilt = mil ? 2 : 0.6;
    x.beginPath(); x.moveTo(24, 27 + tilt * 0.3); x.lineTo(30, 26 - tilt * 0.4); x.moveTo(40, 27 + tilt * 0.3); x.lineTo(34, 26 - tilt * 0.4); x.stroke();
    x.lineWidth = 1.2;
    x.beginPath(); x.moveTo(25.5, 30.5); x.quadraticCurveTo(27.5, 29.5, 29.5, 30.5); x.moveTo(34.5, 30.5); x.quadraticCurveTo(36.5, 29.5, 38.5, 30.5); x.stroke();
    x.fillStyle = ink; x.beginPath(); x.arc(27.5, 30.8, 0.9, 0, 7); x.arc(36.5, 30.8, 0.9, 0, 7); x.fill();
    x.strokeStyle = 'rgba(60,40,30,0.7)'; x.lineWidth = 0.9;
    x.beginPath(); x.moveTo(32, 32); x.lineTo(31, 36); x.lineTo(33, 36.3); x.stroke();
    if (age > 50) { x.strokeStyle = 'rgba(80,60,40,0.4)'; x.beginPath(); x.moveTo(25, 34); x.lineTo(27, 37); x.moveTo(39, 34); x.lineTo(37, 37); x.stroke(); }
    // 胡须
    const gray = age > 56;
    let hair = gray ? '#9a948a' : '#1e1a16';
    if (EURO[cul] || cul === 'rus' || cul === 'norse') { const h = R(); hair = gray ? '#a8a298' : h < 0.35 ? '#6b4a2a' : h < 0.55 ? '#b08a4a' : h < 0.7 ? '#8a3a20' : '#2a2018'; }
    const bt = R();
    x.fillStyle = hair; x.strokeStyle = hair;
    if (cul === 'han' || cul === 'korean' || cul === 'bai' || cul === 'viet' || cul === 'tangut') {
      if (age > 26 && bt < 0.85) {
        x.lineWidth = 1.6; x.beginPath(); x.moveTo(28, 38.5); x.quadraticCurveTo(25, 39.5, 24, 41); x.moveTo(36, 38.5); x.quadraticCurveTo(39, 39.5, 40, 41); x.stroke();
        if (bt < 0.6) { // 三绺长髯
          x.lineWidth = 1.4;
          for (const dx of [-3, 0, 3]) { x.beginPath(); x.moveTo(32 + dx * 0.6, 41); x.quadraticCurveTo(32 + dx, 48, 32 + dx * 1.3, 54 + (dx ? 0 : 3)); x.stroke(); }
        }
      }
    } else if (cul === 'japanese') {
      if (bt < 0.5) { x.lineWidth = 1.4; x.beginPath(); x.moveTo(28, 38.5); x.lineTo(25, 40); x.moveTo(36, 38.5); x.lineTo(39, 40); x.stroke(); }
    } else if (bt < 0.8) {
      x.beginPath(); x.moveTo(32 - fw + 1, 32); x.quadraticCurveTo(32 - fw + 1, 44, 32, 46 + bt * 4); x.quadraticCurveTo(32 + fw - 1, 44, 32 + fw - 1, 32);
      x.quadraticCurveTo(32 + fw - 3, 41, 32, 40); x.quadraticCurveTo(32 - fw + 3, 41, 32 - fw + 1, 32); x.fill();
    } else { x.lineWidth = 1.6; x.beginPath(); x.moveTo(28, 38.5); x.quadraticCurveTo(25, 39, 23.5, 37); x.moveTo(36, 38.5); x.quadraticCurveTo(39, 39, 40.5, 37); x.stroke(); }
    x.strokeStyle = 'rgba(80,40,30,0.8)'; x.lineWidth = 1; x.beginPath(); x.moveTo(30, 39); x.lineTo(34, 39); x.stroke();
    // 冠帽
    hat(x, cul, mil, R, color, hair, fw);
    // 边框
    x.strokeStyle = 'rgba(30,25,20,0.55)'; x.lineWidth = 1.5; x.strokeRect(0.75, 0.75, 62.5, 62.5);
    return c;
  }

  function hat(x, cul, mil, R, color, hair, fw) {
    const ink = '#1f1b17';
    const dome = (col, top) => { x.fillStyle = col; x.beginPath(); x.moveTo(32 - fw - 1.5, 26); x.quadraticCurveTo(32 - fw, top, 32, top - 1); x.quadraticCurveTo(32 + fw, top, 32 + fw + 1.5, 26); x.closePath(); x.fill(); x.strokeStyle = ink; x.lineWidth = 1; x.stroke(); };
    if (cul === 'han' || cul === 'bai') {
      if (mil) {
        const hc = ['#3b3a36', '#5c4a36', '#6e6c66', '#2f3a44'][Math.floor(R() * 4)];
        dome(hc, 9);
        x.fillStyle = hc; x.fillRect(32 - fw - 2, 24, 4, 14); x.fillRect(32 + fw - 2, 24, 4, 14);
        x.fillStyle = '#c4a24a'; x.fillRect(32 - fw - 1, 24, fw * 2 + 2, 2.4);
        x.fillStyle = R() < 0.7 ? '#b3322a' : '#2a2622'; x.beginPath(); x.ellipse(32, 6, 3.5, 4.5, 0, 0, 7); x.fill();
        x.strokeStyle = '#c4a24a'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(32, 10); x.lineTo(32, 8); x.stroke();
      } else { // 展脚幞头
        x.fillStyle = '#1d1a17';
        x.beginPath(); x.moveTo(20, 25); x.lineTo(20, 16); x.quadraticCurveTo(32, 6, 44, 16); x.lineTo(44, 25); x.closePath(); x.fill();
        x.fillRect(1, 18.5, 22, 2.6); x.fillRect(41, 18.5, 22, 2.6);
      }
    } else if (cul === 'jurchen' || cul === 'khitan' || cul === 'tangut' || cul === 'cuman') {
      dome(mil ? '#5a4a35' : '#6b4a2e', 11);
      x.fillStyle = '#c8b28a'; x.beginPath(); x.ellipse(32, 24.5, fw + 3, 3.5, 0, 0, 7); x.fill();
      if (cul === 'jurchen') { x.strokeStyle = hair; x.lineWidth = 2; x.beginPath(); x.moveTo(32 - fw - 1, 28); x.quadraticCurveTo(32 - fw - 4, 38, 32 - fw - 2, 46); x.stroke(); }
      if (mil) { x.fillStyle = '#b3322a'; x.beginPath(); x.arc(32, 10, 2.2, 0, 7); x.fill(); }
    } else if (cul === 'mongol') {
      x.fillStyle = '#7a5a3a'; x.beginPath(); x.moveTo(32 - fw - 2, 27); x.quadraticCurveTo(32, -2, 32 + fw + 2, 27); x.closePath(); x.fill(); x.strokeStyle = ink; x.stroke();
      x.fillStyle = '#d6c29a'; x.fillRect(32 - fw - 4, 22, 6, 14); x.fillRect(32 + fw - 2, 22, 6, 14);
      x.beginPath(); x.ellipse(32, 25, fw + 3, 3, 0, 0, 7); x.fill();
    } else if (cul === 'tibetan') {
      x.fillStyle = '#b8862a'; x.beginPath(); x.moveTo(32 - fw - 2, 26); x.lineTo(32, 2); x.lineTo(32 + fw + 2, 26); x.closePath(); x.fill(); x.strokeStyle = ink; x.stroke();
      x.fillStyle = '#9a2b22'; x.fillRect(32 - fw - 2, 22, fw * 2 + 4, 4);
    } else if (cul === 'korean') {
      if (mil) { dome('#3b3a36', 10); x.fillStyle = '#b3322a'; x.beginPath(); x.arc(32, 8, 2.5, 0, 7); x.fill(); }
      else { x.fillStyle = '#1d1a17'; x.fillRect(24, 10, 16, 14); x.globalAlpha = 0.85; x.beginPath(); x.ellipse(32, 23, 24, 3.5, 0, 0, 7); x.fill(); x.globalAlpha = 1; }
    } else if (cul === 'japanese') {
      if (mil) {
        dome('#2a2622', 11);
        x.fillStyle = '#2a2622'; x.beginPath(); x.moveTo(32 - fw - 6, 30); x.lineTo(32 - fw, 24); x.lineTo(32 + fw, 24); x.lineTo(32 + fw + 6, 30); x.closePath(); x.fill();
        x.strokeStyle = '#d4a93a'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(32, 14); x.lineTo(22, 1); x.moveTo(32, 14); x.lineTo(42, 1); x.stroke();
      } else { x.fillStyle = '#1d1a17'; x.beginPath(); x.moveTo(23, 24); x.lineTo(25, 4); x.quadraticCurveTo(32, 0, 40, 6); x.lineTo(41, 24); x.closePath(); x.fill(); }
    } else if (SEA[cul]) {
      x.fillStyle = '#c4a24a'; x.beginPath(); x.moveTo(32 - fw, 25); x.lineTo(32 - fw + 3, 14); x.lineTo(32, 1); x.lineTo(32 + fw - 3, 14); x.lineTo(32 + fw, 25); x.closePath(); x.fill(); x.strokeStyle = ink; x.lineWidth = 1; x.stroke();
      x.strokeStyle = '#8a6a1a'; x.beginPath(); x.moveTo(32 - fw + 2, 19); x.lineTo(32 + fw - 2, 19); x.stroke();
    } else if (cul === 'indian' || cul === 'ethiopian') {
      const tc = cul === 'ethiopian' ? '#f2efe6' : ['#e0902a', '#f0ead8', '#c0402a', '#e8c040'][Math.floor(R() * 4)];
      x.fillStyle = tc; x.beginPath(); x.ellipse(32, 18, fw + 4, 10, 0, 0, 7); x.fill(); x.strokeStyle = ink; x.lineWidth = 1; x.stroke();
      x.strokeStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.moveTo(20, 20); x.quadraticCurveTo(32, 12, 44, 18); x.stroke();
      if (cul === 'indian') { x.fillStyle = '#2a6a8a'; x.beginPath(); x.arc(32, 16, 2.4, 0, 7); x.fill(); }
    } else if (TURBAN[cul]) {
      if (mil) {
        x.fillStyle = '#6a6660'; x.beginPath(); x.moveTo(32 - fw, 22); x.lineTo(32, 0); x.lineTo(32 + fw, 22); x.closePath(); x.fill(); x.strokeStyle = ink; x.stroke();
        x.fillStyle = '#f2ece0'; x.beginPath(); x.ellipse(32, 23, fw + 3, 4.5, 0, 0, 7); x.fill(); x.stroke();
      } else {
        x.fillStyle = cul === 'persian' ? '#f2ece0' : (R() < 0.3 ? '#2a2a2a' : '#f2ece0');
        x.beginPath(); x.ellipse(32, 17, fw + 4, 10.5, 0, 0, 7); x.fill(); x.strokeStyle = ink; x.lineWidth = 1; x.stroke();
        x.strokeStyle = 'rgba(0,0,0,0.2)'; for (const yy of [13, 17, 21]) { x.beginPath(); x.moveTo(22, yy + 2); x.quadraticCurveTo(32, yy - 3, 42, yy); x.stroke(); }
      }
    } else if (cul === 'greek' || cul === 'georgian') {
      if (mil) { dome('#8a7a5a', 9); x.fillStyle = '#c4a24a'; x.fillRect(32 - fw - 1, 23, fw * 2 + 2, 3); }
      else {
        x.fillStyle = hair; x.beginPath(); x.ellipse(32, 22, fw + 1.5, 9, 0, Math.PI, 0); x.fill();
        x.fillStyle = '#d4a93a'; x.fillRect(32 - fw, 15, fw * 2, 5); x.fillStyle = '#8a2a5a'; x.beginPath(); x.arc(32, 17.5, 1.8, 0, 7); x.fill();
      }
    } else if (cul === 'rus') {
      if (mil) { x.fillStyle = '#7a7a76'; x.beginPath(); x.moveTo(32 - fw - 1, 26); x.quadraticCurveTo(32 - fw + 2, 10, 32, 0); x.quadraticCurveTo(32 + fw - 2, 10, 32 + fw + 1, 26); x.closePath(); x.fill(); x.strokeStyle = ink; x.stroke(); }
      else { dome('#5a3a2a', 12); x.fillStyle = '#c8b28a'; x.beginPath(); x.ellipse(32, 25, fw + 3, 3.5, 0, 0, 7); x.fill(); }
    } else if (EURO[cul]) {
      if (mil) {
        if (R() < 0.5) { // 桶盔
          x.fillStyle = '#8a8a86'; x.beginPath(); x.moveTo(32 - fw - 1, 41); x.lineTo(32 - fw - 1, 13); x.quadraticCurveTo(32, 7, 32 + fw + 1, 13); x.lineTo(32 + fw + 1, 41); x.closePath(); x.fill(); x.strokeStyle = ink; x.lineWidth = 1.2; x.stroke();
          x.fillStyle = '#1a1816'; x.fillRect(32 - fw + 2, 27, fw * 2 - 4, 2.4); x.fillRect(31, 27, 2, 10);
          x.fillStyle = color; x.fillRect(32 - fw - 1, 33, 3, 7);
        } else { // 护鼻盔
          x.fillStyle = '#8a8a86'; x.beginPath(); x.moveTo(32 - fw - 1, 25); x.lineTo(32, 4); x.lineTo(32 + fw + 1, 25); x.closePath(); x.fill(); x.strokeStyle = ink; x.stroke();
          x.fillStyle = '#8a8a86'; x.fillRect(30.8, 24, 2.4, 10);
          x.fillStyle = '#b0aca2'; x.beginPath(); x.moveTo(32 - fw - 1, 25); x.quadraticCurveTo(32 - fw - 3, 38, 32 - fw + 1, 44); x.lineTo(32 - fw + 3, 44); x.lineTo(32 - fw + 1, 25); x.fill();
          x.beginPath(); x.moveTo(32 + fw + 1, 25); x.quadraticCurveTo(32 + fw + 3, 38, 32 + fw - 1, 44); x.lineTo(32 + fw - 3, 44); x.lineTo(32 + fw - 1, 25); x.fill();
        }
      } else {
        x.fillStyle = hair; x.beginPath(); x.ellipse(32, 22, fw + 2, 10, 0, Math.PI, 0); x.fill();
        x.fillRect(32 - fw - 2, 22, 4, 12); x.fillRect(32 + fw - 2, 22, 4, 12);
        if (R() < 0.6) { x.fillStyle = '#d4a93a'; x.beginPath(); x.moveTo(32 - fw, 16); for (let k = 0; k <= 4; k++) { x.lineTo(32 - fw + k * fw / 2, k % 2 ? 9 : 14); } x.lineTo(32 + fw, 16); x.closePath(); x.fill(); }
      }
    } else {
      x.fillStyle = hair; x.beginPath(); x.ellipse(32, 22, fw + 1.5, 9, 0, Math.PI, 0); x.fill();
      x.fillStyle = color; x.fillRect(32 - fw - 1, 19, fw * 2 + 2, 3);
    }
  }

  function classicKey(g) { return g.art ? `${g.id}:${g.art}` : g.id; }

  function classic(g) {
    if (!g) return null;
    const k = classicKey(g);
    let c = cache.get(k);
    if (c && c._f === g.f) return c;
    const F = GAME.fac(g.f) || { color: '#555', culture: 'han' };
    const cul = g.cul || F.culture;
    c = draw(g, F.color, cul, GAME.S ? GAME.S.year : 1140);
    c._f = g.f;
    cache.set(k, c); urls.delete(k);
    return c;
  }
  function url(g) {
    if (!g) return '';
    const c = classic(g);
    const k = classicKey(g);
    let u = urls.get(k);
    if (!u || u._f !== g.f) { u = new String(c.toDataURL()); u._f = g.f; urls.set(k, u); }
    return String(u);
  }

  function imagePath(g) {
    if (!available.size || !g) return '';
    let key = g.art;
    if (!key && (!Number.isInteger(g.id) || g.id < 0)) return '';
    if (!key && g.hist) {
      key = historicalKeys.get(g.name + '\n' + g.birth);
    } else if (!key && g.hist === false) {
      const culture = g.cul || GAME.fac(g.f)?.culture;
      const role = g.zheng > g.wu + 5 ? 'civil' : 'military';
      const age = (GAME.S?.year || 1140) - g.birth;
      const band = age >= 50 ? 'old' : age >= 35 ? 'middle' : 'young';
      const variant = ((Math.imul(g.id, 2654435761) >>> 28) % 4) + 1;
      key = `generic/${culture}_${role}_${band}_${variant}`;
    }
    if (!available.has(key)) return '';
    return 'portraits/' + key.split('/').map(encodeURIComponent).join('/') + '.webp';
  }

  function color(g) {
    const ink = GAME.fac(g.f)?.color;
    return /^#[0-9a-f]{6}$/i.test(ink) ? ink : '#555555';
  }

  function finish(path, image) {
    const old = art.get(path);
    if (old?.ready) return;
    if (image?.parentNode) {
      // 弹窗中的图片会连着父节点，只缓存地图圆章所需的像素。
      const source = document.createElement('canvas');
      source.width = source.height = 64;
      source.getContext('2d').drawImage(image, 0, 0, 64, 64);
      image = source;
    }
    art.set(path, { ready: true, image });
    if (!image) return;
    if (typeof RENDER !== 'undefined') RENDER.markDirty();
    for (const redraw of old?.redraws || []) redraw();
  }

  function get(g, redraw) {
    if (!g) return null;
    // 本地文件图片的来源可能不透明，避免影响长卷导出。
    if (typeof location !== 'undefined' && location.protocol === 'file:') return classic(g);
    const path = imagePath(g);
    if (!path || typeof Image === 'undefined') return classic(g);
    let asset = art.get(path);
    if (!asset) {
      const image = new Image();
      asset = { ready: false, redraws: new Set() };
      art.set(path, asset);
      image.onload = () => finish(path, image);
      image.onerror = () => finish(path, null);
      image.src = path;
    }
    if (!asset.ready && redraw) asset.redraws.add(redraw);
    if (!asset.image) return classic(g);
    const ink = color(g);
    const key = path + ink;
    let canvas = artCanvases.get(key);
    if (canvas) return canvas;
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(asset.image, 0, 0, 64, 64);
    ctx.strokeStyle = ink;
    ctx.strokeRect(.5, .5, 63, 63);
    artCanvases.set(key, canvas);
    return canvas;
  }

  function onImageLoad(image) {
    const path = image.getAttribute('src');
    if (path.startsWith('portraits/')) finish(path, image);
  }

  function onImageError(image) {
    const path = image.getAttribute('src');
    if (!path.startsWith('portraits/')) return;
    finish(path, null);
    if (image.dataset.portraitFallback) {
      image.src = image.dataset.portraitFallback;
      return;
    }
    const general = GAME.S?.generals?.[Number(image.dataset.portraitGeneral)];
    if (general && imagePath(general) === path) image.src = url(general);
  }

  function img(g, size, extra) {
    if (!g) return `<span class="pimg none" style="width:${size}px;height:${size}px">军</span>`;
    const path = imagePath(g);
    if (!path || art.get(path)?.image === null) {
      return `<img class="pimg" src="${url(g)}" style="width:${size}px;height:${size}px" ${extra || ''}>`;
    }
    const fallback = g.art ? `data-portrait-fallback="${url(g)}"` : `data-portrait-general="${g.id}"`;
    return `<img class="pimg" src="${path}" loading="lazy" decoding="async" ${fallback} onload="PORTRAIT.onImageLoad(this)" onerror="PORTRAIT.onImageError(this)" style="width:${size}px;height:${size}px;border-color:${color(g)}" ${extra || ''}>`;
  }
  function clear() { cache.clear(); urls.clear(); artCanvases.clear(); }
  return { get, url, img, clear, onImageLoad, onImageError };
})();
