// Trilha e efeitos. A trilha é original (pasta audio/); os efeitos são gerados na hora com Web Audio.
// Estados ("snapshots") com crossfade: título, planejamento, calmo, comum, tensão (com passa-baixa) e silêncio.
const FILES = {
  title: 'abismo_europa_vibrante_ganza',
  planning: 'abismo_europa_calmo_mergulho',
  calm: 'abismo_europa_calma',
  common: 'abismo_europa_animada_maracas',
  tension: 'abismo_europa_ambiente',
};
const SNAP = {
  title: { title: 0.8 }, planning: { planning: 0.7 }, calm: { calm: 0.75 }, common: { common: 0.55 },
  tension: { tension: 0.9, cutoff: 620 }, silence: {},
};
const rnd = (a, b) => a + Math.random() * (b - a);

export const Audio = {
  ctx: null, tracks: {}, want: 'title', ready: false, muted: false, mode: null, ambientOn: false, zone: 0,
  base: 'audio/',
  init() {
    if (this.ctx) return;
    try { this.muted = localStorage.getItem('abismo-mudo') === '1'; } catch (e) {}
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.9; this.master.connect(c.destination);
    this.music = c.createGain(); this.music.connect(this.master);
    this.fx = c.createGain(); this.fx.gain.value = 0.85; this.fx.connect(this.master);
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 20000; this.lp.connect(this.music);
    this.makeNoise(); this.ambience();
    const ext = document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3';
    const src = k => this.base + FILES[k] + '.' + ext;
    if (location.protocol === 'file:') { this.useElements(src); return; }
    // carrega a música do título primeiro, as outras em seguida
    const load = k => fetch(src(k)).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(b => new Promise((res, rej) => c.decodeAudioData(b, res, rej)))
      .then(buf => {
        const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
        const g = c.createGain(); g.gain.value = 0; s.connect(g); g.connect(k === 'tension' ? this.lp : this.music); s.start();
        this.tracks[k] = { g }; this.mode = 'webaudio'; this.ready = true; this.apply(this.want, 1.5);
      });
    const order = [this.want, ...Object.keys(FILES).filter(k => k !== this.want)].filter(k => FILES[k]);
    order.reduce((p, k) => p.then(() => load(k)), Promise.resolve()).catch(() => { if (!this.mode) this.useElements(src); });
  },
  useElements(src) {
    for (const k of Object.keys(FILES)) { const el = new window.Audio(src(k)); el.loop = true; el.volume = 0; this.tracks[k] = { el, vol: 0, target: 0 }; el.play().catch(() => {}); }
    this.mode = 'element'; this.ready = true; this.apply(this.want, 1.5);
    const tick = () => { for (const t of Object.values(this.tracks)) { if (!t.el) continue; t.vol += (t.target - t.vol) * 0.06; t.el.volume = Math.max(0, Math.min(1, t.vol * (this.muted ? 0 : 1))); } setTimeout(tick, 50); };
    tick();
  },
  unlock() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    if (this.mode === 'element') for (const t of Object.values(this.tracks)) if (t.el.paused) t.el.play().catch(() => {});
  },
  set(name, fade = 2.5) { if (name === this.want) return; this.want = name; if (this.ready) this.apply(name, fade); },
  apply(name, fade) {
    const snap = SNAP[name] || {};
    if (this.mode === 'webaudio') {
      const now = this.ctx.currentTime;
      for (const [k, t] of Object.entries(this.tracks)) { const p = t.g.gain; p.cancelScheduledValues(now); p.setValueAtTime(p.value, now); p.linearRampToValueAtTime(snap[k] || 0, now + fade); }
      const f = this.lp.frequency; f.cancelScheduledValues(now); f.setValueAtTime(f.value, now); f.exponentialRampToValueAtTime(snap.cutoff || 20000, now + fade);
    } else if (this.mode === 'element') for (const [k, t] of Object.entries(this.tracks)) t.target = (snap[k] || 0) * (k === 'tension' ? 0.7 : 1);
  },
  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('abismo-mudo', this.muted ? '1' : '0'); } catch (e) {}
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
    return this.muted;
  },
  makeNoise() {
    const c = this.ctx, n = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, n, c.sampleRate); const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.brownBuf = c.createBuffer(1, n, c.sampleRate); const b = this.brownBuf.getChannelData(0); let l = 0;
    for (let i = 0; i < n; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = l * 3.5; }
  },
  ambience() {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.brownBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 120;
    this.humGain = c.createGain(); this.humGain.gain.value = 0; s.connect(f); f.connect(this.humGain); this.humGain.connect(this.fx); s.start();
    const bub = () => { if (this.ambientOn && !document.hidden) sfx.bubbles(Math.random() < 0.3 ? 3 : 1, 0.025); setTimeout(bub, rnd(600, 2600)); }; bub();
    const cr = () => { if (this.ambientOn && !document.hidden) sfx.creak(0.06 + this.zone * 0.03); setTimeout(cr, rnd(15000, 32000)); }; setTimeout(cr, 9000);
  },
  setAmbient(on, zone = 0) { this.ambientOn = on; this.zone = zone; if (this.humGain) this.humGain.gain.setTargetAtTime(on ? 0.12 : 0, this.ctx.currentTime, 0.5); },
};

export const sfx = {
  tone(f, dur, o = {}) {
    const c = Audio.ctx; if (!c) return;
    const t = c.currentTime + (o.at || 0);
    const osc = c.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || 0.1, t + (o.a || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; node.connect(fl); node = fl; }
    node.connect(g); g.connect(Audio.fx);
    if (o.echo) { const dl = c.createDelay(1); dl.delayTime.value = 0.42; const fb = c.createGain(); fb.gain.value = 0.35; g.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(Audio.fx); setTimeout(() => { fb.gain.value = 0; }, 4000); }
    osc.start(t); osc.stop(t + dur + 0.05);
  },
  noise(dur, o = {}) {
    const c = Audio.ctx; if (!c) return;
    const t = c.currentTime + (o.at || 0);
    const s = c.createBufferSource(); s.buffer = o.brown ? Audio.brownBuf : Audio.noiseBuf; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = o.type || 'lowpass'; fl.frequency.setValueAtTime(o.f || 800, t); fl.Q.value = o.q || 0.8;
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || 0.1, t + (o.a || 0.02)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(Audio.fx); s.start(t); s.stop(t + dur + 0.05);
  },
  Click() { this.tone(520, 0.06, { vol: 0.05, lp: 1800 }); },
  bubble(v) { const f = rnd(220, 460); this.tone(f, rnd(0.08, 0.16), { vol: v || 0.035, f2: f * rnd(1.8, 2.8), lp: 1400 }); },
  bubbles(n, v) { for (let i = 0; i < n; i++) setTimeout(() => this.bubble(v), i * rnd(40, 160)); },
  Bubbles() { this.bubbles(6); },
  creak(v = 0.15) {
    const c = Audio.ctx; if (!c) return;
    const t = c.currentTime, d = rnd(1.2, 2.4);
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(rnd(48, 60), t); o.frequency.linearRampToValueAtTime(rnd(70, 95), t + d * 0.4); o.frequency.linearRampToValueAtTime(rnd(40, 55), t + d);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = rnd(260, 420); f.Q.value = 5;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(f); f.connect(g); g.connect(Audio.fx); o.start(t); o.stop(t + d + 0.1);
  },
  Creak() { this.creak(0.15); },
  Knock() { for (let i = 0; i < 3; i++) { this.tone(90, 0.25, { vol: 0.25, f2: 50, at: i * 0.35 }); } },
  Clank() { this.tone(130, 0.5, { type: 'square', vol: 0.06, f2: 90, lp: 700 }); this.noise(0.35, { vol: 0.1, type: 'bandpass', f: 900, q: 3 }); },
  Alarm() { this.tone(420, 0.22, { type: 'square', vol: 0.03, lp: 1100 }); this.tone(320, 0.3, { type: 'square', vol: 0.03, lp: 1100, at: 0.28 }); },
  Ping() { this.tone(470, 2.2, { vol: 0.08, f2: 440, lp: 800, echo: true, a: 0.02 }); },
  Scan() { this.noise(2.3, { vol: 0.045, type: 'bandpass', f: 300, f2: 1800, q: 4 }); [294, 370, 440, 587].forEach((f, i) => this.tone(f, 0.6, { vol: 0.03, at: 0.5 + i * 0.4, lp: 1200 })); },
  Motor(dur = 2.5) { this.noise(dur, { brown: true, vol: 0.3, f: 180, a: 0.6 }); this.tone(46, dur, { vol: 0.05, a: 0.6, lp: 200 }); },
  Vent() { this.noise(2.6, { brown: true, vol: 0.35, f: 300, a: 0.3 }); this.bubbles(14, 0.04); },
  Swell() { [196, 247, 294, 392].forEach((f, i) => this.tone(f, 3, { vol: 0.03, a: 1.2, at: i * 0.15, lp: 1200 })); },
  Build() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.35, { vol: 0.05, at: i * 0.08, lp: 3000 })); this.noise(0.3, { vol: 0.05, type: 'bandpass', f: 2000, q: 2 }); },
  Coin() { this.tone(880, 0.12, { vol: 0.04 }); this.tone(1320, 0.2, { vol: 0.04, at: 0.08 }); },
  play(id, ...a) { if (id && this[id]) this[id](...a); },
};
