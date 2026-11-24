// 乐与声：实时合成。所有缓冲均在内存生成。
var AUDIO = (function () {
  const KEY = 'hwhs_audio', DEFAULTS = { master: 0.8, music: 0.3, effects: 0.6, muted: false };
  const MAX_VOICES = 16, FADE = 5, SCALE = [0, 2, 4, 7, 9];
  const instruments = {
    qin: '古琴', flute: '箫', drum: '战鼓', stone: '磬', bell: '编钟',
    gong: '锣', metal: '金铁交击', paper: '卷轴纸张', wood: '木击', coin: '铜钱',
  };
  const tracks = new Map(), voices = new Set(), samples = new Map(), lastCue = new Map();
  const settings = { ...DEFAULTS };
  let context, noise, master, musicBus, fxBus, desired = null, current = null, timer = null;
  let initialized = false, persist = true, resumePending = null, battleCount = 0;
  let seed = Date.now() >>> 0 || 1;
  function random() {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  }
  const hz = midi => 440 * 2 ** ((midi - 69) / 12);
  function getSettings() { return { ...settings }; }
  function setSetting(key, value) {
    if (typeof window === 'undefined' || !Object.hasOwn(DEFAULTS, key)) return;
    if (key === 'muted') settings.muted = value === true;
    else if (Number.isFinite(value)) settings[key] = Math.max(0, Math.min(1, value));
    if (persist) {
      try { window.localStorage.setItem(KEY, JSON.stringify(settings)); } catch (_) {}
    }
    gains();
  }
  function gains() {
    if (!context) return;
    const now = context.currentTime;
    master.gain.setTargetAtTime(settings.muted ? 0 : settings.master, now, 0.025);
    musicBus.gain.setTargetAtTime(settings.music * 0.55, now, 0.035);
    fxBus.gain.setTargetAtTime(settings.effects * 0.72, now, 0.025);
  }
  function pcm(seconds, sample) {
    const rate = context.sampleRate;
    const buffer = context.createBuffer(1, Math.ceil(seconds * rate), rate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = sample(i / rate, i);
    return buffer;
  }
  function createGraph(Constructor) {
    context = new Constructor();
    noise = pcm(3, () => 2 * random() - 1);
    const rate = context.sampleRate;
    const impulse = context.createBuffer(2, Math.ceil(rate * 1.05), rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch), predelay = Math.round(rate * (0.019 + 0.004 * ch));
      for (let i = predelay; i < data.length; i++) data[i] = (2 * random() - 1) * (1 - i / data.length) ** 4;
    }
    master = context.createGain();
    musicBus = context.createGain();
    fxBus = context.createGain();
    const mix = context.createGain(), room = context.createConvolver(), wet = context.createGain();
    room.buffer = impulse; wet.gain.value = 0.16;
    musicBus.connect(mix); fxBus.connect(mix);
    mix.connect(master); mix.connect(room); room.connect(wet); wet.connect(master);
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -12; limiter.ratio.value = 4;
    master.connect(limiter); limiter.connect(context.destination);
    gains();
    context.onstatechange = syncClock;
  }
  function supported() {
    return typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
  }
  async function unlock() {
    if (!supported() || document.hidden) return false;
    if (resumePending) return resumePending;
    try {
      if (!context) createGraph(window.AudioContext || window.webkitAudioContext);
      if (context.state !== 'running') {
        resumePending = context.resume().then(() => {
          syncClock();
          return context.state === 'running';
        }, () => false).finally(() => { resumePending = null; });
        return resumePending;
      }
      syncClock();
      return true;
    } catch (_) {
      // 系统中断或拒绝播放时，待下一次手势再试。
      if (!master) context = null;
      return false;
    }
  }
  function init({ persist: saveSettings = true, buttonSounds = true } = {}) {
    if (initialized || typeof window === 'undefined') return;
    initialized = true;
    persist = saveSettings;
    try {
      const saved = persist ? JSON.parse(window.localStorage.getItem(KEY)) : null;
      for (const key of Object.keys(DEFAULTS)) {
        const v = saved?.[key];
        if (key === 'muted' && typeof v === 'boolean') settings.muted = v;
        else if (key !== 'muted' && Number.isFinite(v)) settings[key] = Math.max(0, Math.min(1, v));
      }
    } catch (_) {}
    if (!supported()) return;
    const gesture = e => { if (e.isTrusted) unlock(); };
    // Safari 的触摸解锁须发生在手势处理过程中。
    document.addEventListener('touchend', gesture, { capture: true, passive: true });
    document.addEventListener('pointerup', gesture, true);
    document.addEventListener('click', gesture, true);
    if (buttonSounds) document.addEventListener('click', e => {
      const control = e.target.closest('button:not(:disabled), .click[data-act], a[data-act], summary');
      if (e.isTrusted && control && control.dataset.act !== 'sound') {
        if (context?.state === 'running') play('click');
        else unlock().then(ready => { if (ready) play('click'); });
      }
    }, true);
    document.addEventListener('visibilitychange', () => {
      if (!context) return;
      if (document.hidden) {
        syncClock();
        context.suspend().then(() => { if (!document.hidden) unlock(); }).catch(() => {});
      } else unlock();
    });
  }
  function syncClock() {
    if (!context || context.state !== 'running' || document.hidden || (!desired && !tracks.size)) {
      clearInterval(timer); timer = null;
      return;
    }
    if (timer === null) timer = setInterval(tick, 90);
  }

  // Karplus–Strong。短噪声激振，经分数延迟和低通回授形成拨弦。
  function qin(midi) {
    const f = hz(midi), delay = context.sampleRate / f - 0.5, lag = Math.floor(delay);
    const fraction = delay - lag, ring = new Float32Array(lag + 2);
    const raw = noise.getChannelData(0), damping = Math.exp(-4.2 / (f * 3.2));
    const decay = Math.exp(-0.52 / context.sampleRate);
    let sum = 0, smooth = 0, last = 0, cursor = 0, envelope = 1;
    for (let i = 0; i < ring.length; i++) {
      smooth += 0.54 * (raw[i + 127 + midi] - smooth);
      ring[i] = smooth; sum += smooth;
    }
    for (let i = 0; i < ring.length; i++) ring[i] -= sum / ring.length;
    return pcm(3.2, (t, i) => {
      const a = (cursor + 2) % ring.length, b = (cursor + 1) % ring.length;
      const wave = ring[a] * (1 - fraction) + ring[b] * fraction;
      ring[cursor] = i < lag ? ring[cursor] : damping * (0.54 * wave + 0.46 * last);
      const out = ring[cursor];
      last = wave; cursor = (cursor + 1) % ring.length;
      envelope *= decay;
      return out * Math.min(1, t * 550) * envelope * 1.12;
    });
  }
  const TAU = Math.PI * 2;
  function resonances(midi, partials, length, grit = 0, band = 0.6) {
    const rate = context.sampleRate, root = TAU * hz(midi) / rate;
    const buffer = context.createBuffer(1, Math.ceil(length * rate), rate), data = buffer.getChannelData(0);
    // 每个衰减正弦由前两点推算，首次触发时也无需逐点求三角函数。
    for (const [ratio, level, decay] of partials) {
      const step = root * ratio, damping = Math.exp(-decay / rate);
      const feedback = 2 * damping * Math.cos(step), squared = damping * damping;
      let previous = -level * Math.sin(step) / damping, value = 0;
      for (let i = 0; i < data.length; i++) {
        data[i] += value;
        const next = feedback * value - squared * previous;
        previous = value; value = next;
      }
    }
    if (grit) {
      const raw = noise.getChannelData(0), decay = Math.exp(-8 / rate);
      let smooth = 0, envelope = grit;
      for (let i = 0; i < data.length; i++) {
        smooth += band * (raw[i] - smooth);
        data[i] += envelope * (raw[i] - smooth);
        envelope *= decay;
      }
    }
    for (let i = 0; i < data.length; i++) {
      const t = i / rate;
      data[i] *= Math.min(t * 500, 1) * Math.min((length - t) * 20, 1);
    }
    return buffer;
  }
  function flute(midi) {
    const f = TAU * hz(midi), raw = noise.getChannelData(0);
    let smooth = 0, slow = 0;
    return pcm(2.9, (t, i) => {
      smooth += 0.13 * (raw[i] - smooth);
      slow += 0.016 * (smooth - slow);
      const phase = f * t + 0.23 * Math.sin(TAU * 4.1 * t);
      return (0.52 * Math.sin(phase) + 0.05 * Math.sin(2 * phase) + 0.19 * (smooth - slow)) *
        (0.94 + 0.06 * Math.sin(TAU * 3.7 * t));
    });
  }
  function drum(midi) {
    const f = hz(midi), raw = noise.getChannelData(0);
    let skin = 0;
    return pcm(0.78, (t, i) => {
      skin += 0.22 * (raw[i] - skin);
      const phase = TAU * f * (t + 0.061 * (1 - Math.exp(-21 * t)));
      return Math.min(1, t * 850) * ((0.74 * Math.sin(phase) + 0.14 * Math.sin(phase * 2.06)) * Math.exp(-7.1 * t) +
        0.32 * skin * Math.exp(-48 * t));
    });
  }
  const generators = {
    qin, flute, drum,
    stone: n => resonances(n, [[1, 0.53, 1.6], [1.51, 0.25, 2.7], [2.66, 0.15, 4.5], [4.08, 0.08, 7]], 2.8),
    bell: n => resonances(n, [[1, 0.50, 1.2], [2.37, 0.24, 2.3], [2.91, 0.16, 3.2], [4.74, 0.09, 5.8]], 3.2),
    gong: n => resonances(n, [[1, 0.36, 1.4], [1.43, 0.20, 1.7], [2.83, 0.16, 2.4], [4.25, 0.12, 3.8], [7.13, 0.10, 4.8]], 2.7, 0.39, 0.34),
    coin: n => resonances(n, [[1, 0.42, 12], [1.38, 0.27, 16], [2.14, 0.17, 24], [3.61, 0.12, 38]], 0.38, 0.15),
    wood: n => resonances(n, [[1, 0.53, 58], [1.84, 0.31, 93]], 0.10),
  };
  function sampleFor(tone, midi) {
    if (!Object.hasOwn(generators, tone)) return noise;
    const key = tone + ':' + midi;
    if (!samples.has(key)) samples.set(key, generators[tone](midi));
    return samples.get(key);
  }
  function release(voice) {
    voices.delete(voice);
    try { voice.source.stop(); } catch (_) {}
    voice.source.disconnect(); voice.gain.disconnect(); voice.filter?.disconnect();
  }
  function note(output, tone, midi, at, level, option = null) {
    const buffer = sampleFor(tone, midi), source = context.createBufferSource(), gain = context.createGain();
    at = Math.max(context.currentTime + 0.005, at);
    source.buffer = buffer;
    gain.gain.setValueAtTime(0, at);
    let filter, length = buffer.duration;
    if (tone === 'paper' || tone === 'metal') {
      filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      const paper = tone === 'paper', f = paper ? 720 : 2100 + random() * 2900;
      length = paper ? 0.31 : 0.11 + random() * 0.07;
      filter.frequency.setValueAtTime(f, at);
      filter.frequency.exponentialRampToValueAtTime(paper ? f * 2.6 : f * 0.58, at + length);
      filter.Q.value = paper ? 0.68 : 2.9;
      source.connect(filter); filter.connect(gain);
      gain.gain.linearRampToValueAtTime(level, at + (paper ? 0.060 : 0.004));
      if (paper) {
        gain.gain.linearRampToValueAtTime(level * 0.33, at + 0.12);
        gain.gain.linearRampToValueAtTime(level * 0.75, at + 0.17);
      }
      gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    } else {
      source.connect(gain);
      gain.gain.linearRampToValueAtTime(level, at + (tone === 'flute' ? 0.19 : 0.005));
      if (tone === 'flute') {
        length = option?.length || 2.45;
        gain.gain.setValueAtTime(level * 0.84, at + length - 0.42);
        gain.gain.linearRampToValueAtTime(0, at + length);
      }
      if (tone === 'qin' && option?.ornament) {
        const bend = option.ornament === 'slide';
        const motion = Float32Array.from({ length: 49 }, (_, i) => {
          const t = i / 48;
          const cents = 8 * Math.sin(TAU * 4.3 * t) * Math.sin(Math.PI * t) - (bend ? Math.max(0, 1 - t * 5) * 37 : 0);
          return 2 ** (cents / 1200);
        });
        source.playbackRate.setValueCurveAtTime(motion, at, 1.7);
      }
    }
    if (voices.size >= MAX_VOICES) release(voices.values().next().value);
    const voice = { source, gain, filter, output };
    gain.connect(output);
    voices.add(voice);
    source.onended = () => { if (voices.has(voice)) release(voice); };
    source.start(at, filter ? random() * 2.5 : 0);
    source.stop(at + length);
  }

  const cues = {
    click: ['轻叩', [[0, 'wood', 68, 0.15]]],
    paper: ['开合卷轴', [[0, 'paper', 60, 0.30]]],
    turn: ['结束回合', [[0, 'stone', 74, 0.30]]],
    march: ['行军', [[0, 'drum', 40, 0.25], [0.13, 'drum', 42, 0.13]]],
    battle: ['开战', [[0, 'drum', 35, 0.55], [0.18, 'drum', 35, 0.36], [0.36, 'drum', 32, 0.53]]],
    clash: ['交锋', [[0, 'metal', 60, 0.31], [0.038, 'metal', 60, 0.21], [0.09, 'metal', 60, 0.15]]],
    win: ['战捷', [[0, 'gong', 48, 0.42], [0.24, 'bell', 69, 0.35], [0.45, 'bell', 74, 0.31]]],
    lose: ['战挫', [[0, 'drum', 32, 0.39], [0.18, 'qin', 57, 0.44], [0.43, 'qin', 55, 0.42], [0.74, 'qin', 50, 0.40]]],
    capture: ['克城', [[0, 'gong', 50, 0.51]]],
    lost: ['失城', [[0, 'stone', 52, 0.53]]],
    coin: ['赏赐与岁贡', [[0, 'coin', 88, 0.32], [0.07, 'coin', 93, 0.27], [0.14, 'coin', 90, 0.18]]],
    rank: ['晋升与封爵', [[0, 'bell', 62, 0.35], [0.23, 'bell', 66, 0.32], [0.49, 'bell', 69, 0.30]]],
    event: ['奏疏', [[0, 'stone', 79, 0.21]]],
    major: ['天下大事', [[0, 'gong', 43, 0.58], [0.16, 'drum', 32, 0.48], [0.46, 'drum', 33, 0.42], [0.90, 'drum', 31, 0.34]]],
  };
  function beginReplay() { battleCount = 0; }
  function canSound() { return context?.state === 'running' && !document.hidden && !settings.muted && settings.master > 0 && settings.effects > 0; }
  function play(id, replay = false) {
    if (!canSound() || !Object.hasOwn(cues, id)) return;
    const now = context.currentTime;
    if (now - (lastCue.get(id) ?? -Infinity) < 0.3 || (replay && battleCount >= 4)) return;
    lastCue.set(id, now);
    if (replay) battleCount++;
    for (const [offset, tone, midi, level] of cues[id][1]) note(fxBus, tone, midi, now + 0.018 + offset, level);
  }
  function audition(tone) {
    if (!canSound() || !Object.hasOwn(instruments, tone)) return;
    const pitches = { qin: 50, flute: 69, drum: 35, stone: 72, bell: 67, gong: 45, metal: 60, paper: 60, wood: 68, coin: 89 };
    note(fxBus, tone, pitches[tone], context.currentTime + 0.02, 0.52, tone === 'qin' ? { ornament: 'slide' } : null);
  }

  const moods = { title: '开卷', peace: '太平', war: '兵戈', crisis: '危局' };
  const tempos = { title: 1.03, peace: 0.84, war: 0.59, crisis: 0.94 };
  function scalePitch(root, step) {
    return root + SCALE[(step % 5 + 5) % 5] + 12 * Math.floor(step / 5);
  }
  function phrase(track) {
    const mood = track.mood, start = track.next, beat = tempos[mood];
    const add = (offset, tone, midi, level, option) => track.queue.push([start + offset * beat, tone, midi, level, option]);
    const wartime = mood === 'war', opening = mood === 'title';
    if (mood === 'crisis') {
      add(0, 'stone', scalePitch(50, Math.floor(random() * 3)), 0.32);
      add(2.5 + Math.floor(random() * 2), 'drum', 32, 0.31);
      if (random() < 0.35) add(6, 'stone', 57, 0.18);
      track.next += (8 + Math.floor(random() * 3)) * beat;
    } else {
      const count = wartime ? 5 : 3 + Math.floor(random() * 3);
      const root = wartime ? 43 : opening ? 48 : 50;
      let slot = 0;
      for (let i = 0; i < count; i++) {
        track.degree = Math.max(-2, Math.min(7, track.degree + [-2, -1, 0, 1, 1, 2][Math.floor(random() * 6)]));
        if (i === count - 1 && random() < 0.55) track.degree = track.degree < 3 ? 0 : 3;
        const decoration = random();
        add(slot, 'qin', scalePitch(root, track.degree), 0.36 + random() * 0.14,
          decoration < 0.22 ? { ornament: decoration < 0.07 ? 'slide' : 'vibrato' } : null);
        slot += wartime ? 1 + (random() < 0.38 ? 0.5 : 0) : 0.75 + 0.5 * Math.floor(random() * 3);
      }
      if (wartime) {
        for (const [beatNo, volume] of [[0, 0.35], [1.5, 0.19], [3, 0.28], [4, 0.32], [5.5, 0.19]]) add(beatNo, 'drum', 35, volume);
      } else if (!opening && random() < 0.60) {
        add(2, 'flute', scalePitch(root + 12, track.degree), 0.19, { length: 1.75 + random() * 0.74 });
      }
      track.next += (wartime ? 8 : Math.max(7, slot + 1.65)) * beat;
    }
    track.queue.sort((a, b) => a[0] - b[0]);
  }
  function fade(track, to, seconds, now) {
    const f = track.fade, progress = Math.max(0, Math.min(1, (now - f.at) / f.seconds));
    const from = f.from + (f.to - f.from) * progress;
    track.gain.gain.cancelScheduledValues(now);
    track.gain.gain.setValueAtTime(from, now);
    track.gain.gain.linearRampToValueAtTime(to, now + seconds);
    track.fade = { at: now, from, to, seconds };
  }
  function switchTrack(now) {
    if (current === desired) return;
    const wasPlaying = tracks.size > 0;
    const former = tracks.get(current);
    if (former) { fade(former, 0, FADE, now); former.end = now + FADE; }
    current = desired;
    if (!desired) return;
    let track = tracks.get(desired);
    if (!track) {
      const gain = context.createGain();
      gain.gain.value = 0; gain.connect(musicBus);
      track = { mood: desired, gain, next: now + 0.06, degree: 0, queue: [], fade: { from: 0, to: 0, at: now, seconds: 1 } };
      tracks.set(desired, track);
    }
    track.end = Infinity;
    fade(track, 1, wasPlaying ? FADE : 0.9, now);
  }
  function tick() {
    const now = context.currentTime, horizon = now + 0.21;
    switchTrack(now);
    for (const [id, track] of tracks) {
      if (now >= track.end) {
        for (const voice of voices) if (voice.output === track.gain) release(voice);
        track.gain.disconnect(); tracks.delete(id);
        continue;
      }
      if (track.next < now - 0.5) { track.queue.length = 0; track.next = now + 0.06; }
      if (track.next <= horizon) phrase(track);
      while (track.queue.length && track.queue[0][0] <= horizon) {
        const [at, tone, midi, level, option] = track.queue.shift();
        if (!settings.muted && settings.master > 0 && settings.music > 0 && at < track.end && at >= now - 0.1) {
          note(track.gain, tone, midi, at, level, option);
        }
      }
    }
    if (!tracks.size) syncClock();
  }
  function setMusic(mood) {
    if (mood !== null && !Object.hasOwn(moods, mood)) return;
    desired = mood;
    syncClock();
  }
  function stop() {
    desired = current = null;
    for (const voice of voices) release(voice);
    for (const track of tracks.values()) track.gain.disconnect();
    tracks.clear(); lastCue.clear();
    syncClock();
  }
  return { init, unlock, supported, getSettings, setSetting, beginReplay, play, audition, setMusic, stop,
    instruments, moods, cueNames: Object.fromEntries(Object.entries(cues).map(([key, [name]]) => [key, name])) };
})();
if (typeof module !== 'undefined') module.exports = AUDIO;
