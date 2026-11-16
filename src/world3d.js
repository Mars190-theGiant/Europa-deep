// Abismo de Europa · cenas 3D (Three.js r128, carregado como script global THREE).
// Europa e Júpiter, a base na superfície, o submarino montável, o oceano por zona e a caminhada (EVA).
const T = window.THREE;
import { EN } from './i18n.js';

// ------------------------------------------------------------------ utilidades
export function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const col = c => new T.Color(c);
const lerp = (a, b, t) => a + (b - a) * t;
function std(color, o = {}) { return new T.MeshStandardMaterial(Object.assign({ color: col(color), roughness: 0.6, metalness: 0.1 }, o)); }
function glow(color, opacity = 1) { return new T.MeshBasicMaterial({ color: col(color), transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }); }
function add(parent, geo, mat, x = 0, y = 0, z = 0) { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; }
function haloSprite(color, size = 2, opacity = 0.6) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), color: col(color), transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending }));
  s.scale.set(size, size, 1); return s;
}
function stars(n = 1500, r = 400) {
  const g = new T.BufferGeometry(), p = new Float32Array(n * 3), rnd = seeded(7);
  for (let i = 0; i < n; i++) { const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u); p[i * 3] = r * s * Math.cos(th); p[i * 3 + 1] = r * u; p[i * 3 + 2] = r * s * Math.sin(th); }
  g.setAttribute('position', new T.BufferAttribute(p, 3));
  return new T.Points(g, new T.PointsMaterial({ color: 0xcfe6ff, size: 1.2, sizeAttenuation: false }));
}

// ------------------------------------------------------------------ texturas procedurais de Europa e Júpiter
// Filtros: 'real' (cor natural), 'realce' (cor realçada, como os mosaicos da NASA), 'termico' (ilustrativo), 'corte'.
const lineaeCache = {};
function europaLayers(W, H) {
  if (lineaeCache[W]) return lineaeCache[W];
  const rnd = seeded(2030);
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const lin = mk(), lg = lin.getContext('2d');
  lg.lineCap = 'round';
  // lineae: faixas longas e curvas que dão a volta na lua
  for (let i = 0; i < 70; i++) {
    let x = rnd() * W, y = rnd() * H, a = rnd() * Math.PI * 2, w = 0.6 + rnd() * (i < 18 ? 3.5 : 1.6);
    const len = 80 + rnd() * 500, curve = (rnd() - 0.5) * 0.012;
    lg.strokeStyle = `rgba(255,255,255,${0.35 + rnd() * 0.6})`; lg.lineWidth = w * W / 1024;
    lg.beginPath(); lg.moveTo(x, y);
    for (let s = 0; s < len; s += 6) { a += curve + (rnd() - 0.5) * 0.03; x += Math.cos(a) * 6 * W / 1024; y += Math.sin(a) * 3 * W / 1024; lg.lineTo(((x % W) + W) % W === x ? x : x, y); }
    lg.stroke();
  }
  // terreno caótico (manchas): Conamara e Thera
  const chaos = mk(), cg = chaos.getContext('2d');
  const spot = (u, v, r, n) => { for (let k = 0; k < n; k++) { const x = u * W + (rnd() - 0.5) * r * 2, y = (1 - v) * H + (rnd() - 0.5) * r * 1.2, rr = (1 + rnd() * 4) * W / 1024; cg.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.45})`; cg.beginPath(); cg.ellipse(x, y, rr * 1.4, rr, rnd() * 3, 0, 7); cg.fill(); } };
  spot(0.24, 0.55, 55 * W / 1024, 420); spot(0.50, 0.24, 36 * W / 1024, 300); spot(0.70, 0.62, 45 * W / 1024, 160); spot(0.88, 0.40, 35 * W / 1024, 140);
  // cratera Pwyll com raios claros
  const rays = mk(), rg = rays.getContext('2d');
  const px = 0.25 * W, py = (1 - 0.36) * H;
  for (let k = 0; k < 40; k++) { const a = rnd() * Math.PI * 2, L = (30 + rnd() * 120) * W / 1024; rg.strokeStyle = `rgba(255,255,255,${0.2 + rnd() * 0.4})`; rg.lineWidth = (1 + rnd() * 2) * W / 1024; rg.beginPath(); rg.moveTo(px, py); rg.lineTo(px + Math.cos(a) * L, py + Math.sin(a) * L * 0.6); rg.stroke(); }
  rg.fillStyle = 'rgba(255,255,255,.9)'; rg.beginPath(); rg.arc(px, py, 5 * W / 1024, 0, 7); rg.fill();
  // ruído suave de fundo
  const noise = mk(), ng = noise.getContext('2d');
  for (let k = 0; k < 900; k++) { ng.fillStyle = `rgba(255,255,255,${rnd() * 0.08})`; ng.beginPath(); ng.arc(rnd() * W, rnd() * H, (6 + rnd() * 40) * W / 1024, 0, 7); ng.fill(); }
  return (lineaeCache[W] = { lin, chaos, rays, noise });
}
function tint(src, color, W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, W, H); return c;
}
export function europaCanvas(mode = 'real', W = 1024) {
  const H = W / 2, L = europaLayers(W, H);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const P = {
    real: { bg: '#d8cfc0', bg2: '#c9bba3', noise: 'rgba(150,130,105,.9)', lin: 'rgba(150,95,60,.75)', chaos: 'rgba(160,110,75,.7)', rays: 'rgba(255,255,250,.9)' },
    realce: { bg: '#cfe4ef', bg2: '#a9c9dc', noise: 'rgba(90,140,180,.9)', lin: 'rgba(170,60,30,.95)', chaos: 'rgba(180,80,40,.85)', rays: 'rgba(255,255,255,1)' },
    termico: { bg: '#1b1446', bg2: '#2a1a5e', noise: 'rgba(70,40,140,.9)', lin: 'rgba(255,150,40,.95)', chaos: 'rgba(255,220,90,.9)', rays: 'rgba(120,90,220,.8)' },
  }[mode] || {};
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, P.bg2); gr.addColorStop(0.5, P.bg); gr.addColorStop(1, P.bg2);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.drawImage(tint(L.noise, P.noise, W, H), 0, 0);
  g.drawImage(tint(L.chaos, P.chaos, W, H), 0, 0);
  g.drawImage(tint(L.lin, P.lin, W, H), 0, 0);
  g.drawImage(tint(L.rays, P.rays, W, H), 0, 0);
  if (mode === 'termico') { // brilho nas regiões caóticas: onde a água pode estar mais perto
    g.globalCompositeOperation = 'lighter'; g.filter = 'blur(6px)';
    g.drawImage(tint(L.chaos, 'rgba(255,90,40,.6)', W, H), 0, 0); g.filter = 'none'; g.globalCompositeOperation = 'source-over';
  }
  return c;
}
function jupiterCanvas(W = 1024) {
  const H = W / 2, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), rnd = seeded(1610);
  const bands = ['#e9dcc4', '#c99f74', '#f1e6d0', '#b5835a', '#ead9bd', '#a8714c', '#efe0c6', '#c8a27c', '#e4d2b4', '#9e6f50', '#e8dac2', '#c6a07a', '#ddd0b8'];
  let y = 0;
  while (y < H) { const h = (10 + rnd() * 36) * H / 512; g.fillStyle = bands[Math.floor(rnd() * bands.length)]; g.fillRect(0, y, W, h + 1); y += h; }
  g.globalAlpha = 0.25;
  for (let i = 0; i < 2500; i++) { const yy = rnd() * H; g.fillStyle = bands[Math.floor(rnd() * bands.length)]; g.fillRect(rnd() * W, yy, (20 + rnd() * 120) * W / 1024, (1 + rnd() * 3) * H / 512); }
  g.globalAlpha = 1;
  g.fillStyle = '#b8553a'; g.beginPath(); g.ellipse(W * 0.62, H * 0.66, 42 * W / 1024, 20 * H / 512, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(240,200,170,.6)'; g.beginPath(); g.ellipse(W * 0.62, H * 0.66, 26 * W / 1024, 10 * H / 512, 0, 0, 7); g.fill();
  return c;
}
export function latLonToVec(lat, lon, r) {
  const phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
  return new T.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
}
export const mapToLatLon = ([u, v]) => ({ lat: (v - 0.5) * 180, lon: u * 360 - 180 });

// ------------------------------------------------------------------ renderizador e controle de órbita
export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputEncoding = T.sRGBEncoding;
    this.current = null; this.clock = new T.Clock();
    this.drag = { on: false, x: 0, y: 0, dx: 0, dy: 0 };
    const down = (x, y) => { this.drag.on = true; this.drag.x = x; this.drag.y = y; };
    const move = (x, y) => { if (!this.drag.on) return; this.drag.dx += x - this.drag.x; this.drag.dy += y - this.drag.y; this.drag.x = x; this.drag.y = y; };
    canvas.addEventListener('pointerdown', e => { down(e.clientX, e.clientY); canvas.setPointerCapture?.(e.pointerId); });
    canvas.addEventListener('pointermove', e => move(e.clientX, e.clientY));
    window.addEventListener('pointerup', () => { this.drag.on = false; });
    canvas.addEventListener('pointercancel', () => { this.drag.on = false; });
    this.resize(); window.addEventListener('resize', () => this.resize());
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      if (!this.current) return;
      const d = { dx: this.drag.dx, dy: this.drag.dy, on: this.drag.on }; this.drag.dx = this.drag.dy = 0;
      this.current.update(dt, d);
      this.renderer.render(this.current.scene, this.current.camera);
    };
    loop();
  }
  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.aspect = w / h;
    if (this.current) { this.current.camera.aspect = this.aspect; this.current.camera.updateProjectionMatrix(); }
  }
  show(sc) {
    if (this.current === sc) return;
    this.current = sc;
    if (sc) { sc.camera.aspect = this.aspect; sc.camera.updateProjectionMatrix(); sc.onShow?.(); }
  }
}

// ------------------------------------------------------------------ globo de Europa (página inicial e projeto)
export class GlobeScene {
  constructor(missions = []) {
    this.scene = new T.Scene(); this.scene.background = col('#03070c');
    this.camera = new T.PerspectiveCamera(38, 1, 0.1, 2000); this.camera.position.set(0, 0.6, 8.5);
    this.scene.add(stars());
    this.scene.add(new T.AmbientLight(0x6688aa, 0.35));
    const sun = new T.DirectionalLight(0xfff4e0, 1.25); sun.position.set(-6, 3, 6); this.scene.add(sun);
    this.root = new T.Group(); this.scene.add(this.root); this.root.rotation.z = 0.05;
    this.tex = {}; this.mode = 'real';
    this.ice = new T.Mesh(new T.SphereGeometry(2.4, 96, 64), std('#ffffff', { roughness: 0.85 }));
    this.root.add(this.ice);
    // camadas internas para o modo "corte" (fatia de 90° aberta)
    this.layers = new T.Group(); this.layers.visible = false; this.root.add(this.layers);
    const shell = (r, color, o = {}) => { const m = add(this.layers, new T.SphereGeometry(r, 64, 48, 0, Math.PI * 1.5), std(color, Object.assign({ side: T.DoubleSide }, o))); return m; };
    shell(2.4, '#e6eef4', { roughness: 0.9 }); shell(2.27, '#1f6fa8', { roughness: 0.25, metalness: 0.2, emissive: col('#08304f'), emissiveIntensity: 0.6 });
    shell(2.05, '#8a6a52'); shell(1.1, '#9a9aa4', { metalness: 0.6, roughness: 0.4 });
    // faces do corte: meias-coroas nos dois planos da fatia aberta, mostrando a espessura de cada camada
    const faceGroup = (rot) => {
      const g = new T.Group(); g.rotation.y = rot; this.layers.add(g);
      const ring = (r0, r1, c) => add(g, new T.RingGeometry(r0, r1, 64, 1, -Math.PI / 2, Math.PI), std(c, { side: T.DoubleSide, roughness: 0.7 }));
      ring(2.27, 2.4, '#f2f7fb'); ring(2.05, 2.27, '#2d86c4'); ring(1.1, 2.05, '#8a6a52'); ring(0.001, 1.1, '#a7a7b0');
    };
    faceGroup(Math.PI); faceGroup(Math.PI / 2);
    // marcadores das missões
    this.markers = new T.Group(); this.ice.add(this.markers);
    for (const m of missions) {
      const { lat, lon } = mapToLatLon(m.map);
      const p = latLonToVec(lat, lon, 2.42);
      const s = haloSprite(m.color, 0.55, 0.95); s.position.copy(p); s.userData.id = m.id; this.markers.add(s);
      const dot = add(this.markers, new T.SphereGeometry(0.045, 12, 8), glow(m.color)); dot.position.copy(p);
    }
    this.selected = null; this.spin = 0.12; this.yaw = 2.2; this.pitch = 0.15; this.targetYaw = null;
    this.setMode('real');
  }
  setMode(mode) {
    this.mode = mode;
    if (mode === 'corte') { this.ice.visible = false; this.layers.visible = true; return; }
    this.ice.visible = true; this.layers.visible = false;
    if (!this.tex[mode]) { const t = new T.CanvasTexture(europaCanvas(mode, 1024)); t.encoding = T.sRGBEncoding; t.anisotropy = 4; this.tex[mode] = t; }
    this.ice.material.map = this.tex[mode];
    this.ice.material.emissive = col(mode === 'termico' ? '#ffffff' : '#000000');
    this.ice.material.emissiveMap = mode === 'termico' ? this.tex[mode] : null;
    this.ice.material.emissiveIntensity = mode === 'termico' ? 0.75 : 0;
    this.ice.material.needsUpdate = true;
  }
  focus(mission) {
    this.selected = mission?.id || null;
    if (!mission) { this.targetYaw = null; return; }
    const { lat, lon } = mapToLatLon(mission.map);
    const v = latLonToVec(lat, lon, 1);
    this.targetYaw = -Math.atan2(v.x, v.z); this.targetPitch = Math.asin(v.y) * 0.8;
  }
  update(dt, d) {
    if (d.on || Math.abs(d.dx) > 0) { this.yaw += d.dx * 0.008; this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch + d.dy * 0.006)); this.targetYaw = null; }
    else if (this.targetYaw != null) {
      let dy = this.targetYaw - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += dy * Math.min(1, dt * 3); this.pitch += (this.targetPitch - this.pitch) * Math.min(1, dt * 3);
    } else this.yaw += this.spin * dt;
    this.ice.rotation.set(this.pitch, this.yaw, 0, 'XYZ');
    this.layers.rotation.set(this.pitch * 0.5, this.yaw * 0.5 + 0.6, 0);
    const t = performance.now() / 1000;
    this.markers.children.forEach(m => { if (m.isSprite) { const s = (m.userData.id === this.selected ? 0.9 : 0.5) * (1 + 0.15 * Math.sin(t * 3)); m.scale.set(s, s, 1); } });
  }
}

// ------------------------------------------------------------------ abertura: Júpiter e Europa
export class TitleScene {
  constructor() {
    this.scene = new T.Scene(); this.scene.background = col('#02050a');
    this.camera = new T.PerspectiveCamera(45, 1, 0.1, 3000);
    this.scene.add(stars(2200, 900));
    this.scene.add(new T.AmbientLight(0x334455, 0.5));
    const sun = new T.DirectionalLight(0xfff1dd, 1.4); sun.position.set(-10, 2, 6); this.scene.add(sun);
    const jt = new T.CanvasTexture(jupiterCanvas(1024)); jt.encoding = T.sRGBEncoding;
    this.jupiter = add(this.scene, new T.SphereGeometry(60, 96, 64), std('#ffffff', { map: jt, roughness: 0.9 }), 70, 8, -160);
    this.jupiter.rotation.z = 0.05;
    const et = new T.CanvasTexture(europaCanvas('real', 1024)); et.encoding = T.sRGBEncoding;
    this.europa = add(this.scene, new T.SphereGeometry(6, 96, 64), std('#ffffff', { map: et, roughness: 0.85 }), -6, -2, -18);
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    this.jupiter.rotation.y += dt * 0.02; this.europa.rotation.y += dt * 0.05;
    this.camera.position.set(Math.sin(this.t * 0.05) * 6, 1 + Math.sin(this.t * 0.07) * 1.2, 14);
    this.camera.lookAt(10, 2, -60);
  }
}

// ------------------------------------------------------------------ submarino montável
export function buildSub(levels = {}, opts = {}) {
  const g = new T.Group();
  const hullLv = levels.Hull || 0;
  const paint = std(hullLv >= 2 ? '#d98a2b' : '#f0a63a', { roughness: 0.45, metalness: 0.25 });
  const titanium = std('#9aa6b2', { roughness: 0.35, metalness: 0.8 });
  const dark = std('#2b3440', { roughness: 0.6 });
  const body = add(g, new T.CylinderGeometry(0.9, 0.9, 3.2, 32), paint); body.rotation.x = Math.PI / 2;
  add(g, new T.SphereGeometry(0.9, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), paint, 0, 0, -1.6).rotation.x = -Math.PI / 2;
  const tail = add(g, new T.ConeGeometry(0.9, 1.5, 32), paint, 0, 0, 2.35); tail.rotation.x = Math.PI / 2;
  // cúpula de vidro na frente
  const dome = add(g, new T.SphereGeometry(0.72, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: col('#7fe0ff'), transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.4, emissive: col('#1a6070'), emissiveIntensity: 0.6 }), 0, 0.05, -2.2);
  dome.rotation.x = -Math.PI / 2;
  // torre
  add(g, new T.BoxGeometry(0.7, 0.55, 1.1), paint, 0, 0.95, -0.2);
  add(g, new T.CylinderGeometry(0.05, 0.05, 0.6, 8), dark, 0.15, 1.45, 0);
  // aletas
  for (const s of [-1, 1]) { const f = add(g, new T.BoxGeometry(0.9, 0.06, 0.5), paint, s * 0.95, 0, 2.2); f.rotation.z = s * 0.1; }
  add(g, new T.BoxGeometry(0.06, 0.8, 0.5), paint, 0, 0.6, 2.3);
  // propulsor principal
  const thr = levels.Thrusters || 0;
  const duct = add(g, new T.TorusGeometry(0.42 + thr * 0.08, 0.07, 8, 24), dark, 0, 0, 3.05);
  const prop = new T.Group(); prop.position.set(0, 0, 3.05); g.add(prop);
  for (let i = 0; i < 4; i++) { const b = add(prop, new T.BoxGeometry(0.08, 0.36 + thr * 0.06, 0.03), titanium); b.rotation.z = i * Math.PI / 2; b.position.set(Math.cos(i * Math.PI / 2) * 0.01, 0, 0); }
  g.userData.prop = prop;
  if (thr >= 2) for (const s of [-1, 1]) { const p = add(g, new T.CylinderGeometry(0.18, 0.18, 0.6, 16), dark, s * 1.15, -0.25, 1.2); p.rotation.x = Math.PI / 2; }
  // casco de titânio: anéis de reforço
  for (let i = 0; i < hullLv * 2; i++) { const r = add(g, new T.TorusGeometry(0.93, 0.05, 8, 32), titanium, 0, 0, -1.2 + i * (2.4 / Math.max(1, hullLv * 2 - 1))); }
  // baterias: casulos na barriga
  const bat = levels.Battery || 0;
  for (let i = 0; i < bat; i++) { const b = add(g, new T.CapsuleGeometry ? new T.CylinderGeometry(0.22, 0.22, 1.4, 16) : new T.CylinderGeometry(0.22, 0.22, 1.4, 16), std('#3a7bd5', { metalness: 0.4, emissive: col('#103060'), emissiveIntensity: 0.5 }), (i ? 0.45 : -0.45), -0.85, 0.2); b.rotation.x = Math.PI / 2; }
  // scanner espectral: antena em leque no topo
  const scn = levels.Scanner || 0;
  if (scn) { const dish = add(g, new T.SphereGeometry(0.35, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), titanium, 0, 1.35, -0.6); dish.rotation.x = -0.8; if (scn >= 2) add(g, new T.BoxGeometry(0.9, 0.08, 0.3), std('#b49cff', { emissive: col('#4a2a90'), emissiveIntensity: 0.8 }), 0, 1.25, 0.25); }
  // farol
  const fl = levels.Floodlight || 0;
  const lampMat = glow('#fff6d8');
  for (let i = 0; i <= fl; i++) for (const s of [-1, 1]) add(g, new T.SphereGeometry(0.09 + fl * 0.02, 12, 8), lampMat, s * (0.55 + i * 0.15), -0.45 + i * 0.1, -2.05);
  // eclusa
  const air = levels.Airlock || 0;
  if (air) { add(g, new T.BoxGeometry(0.8, 0.45, 0.9), titanium, 0, -1.05, -0.3); add(g, new T.TorusGeometry(0.25, 0.05, 8, 20), dark, 0, -1.28, -0.3).rotation.x = Math.PI / 2; }
  // braço robótico
  const arm = add(g, new T.CylinderGeometry(0.05, 0.05, 0.8, 8), dark, 0.55, -0.7, -1.7); arm.rotation.x = 1.0;
  g.userData.levels = Object.assign({}, levels);
  if (opts.light) {
    const sp = new T.SpotLight(0xfff2d0, 2.2 + fl * 0.8, 40, 0.42 + fl * 0.05, 0.5, 1.2); sp.position.set(0, 0, -2.2);
    sp.target.position.set(0, -0.6, -12); g.add(sp); g.add(sp.target); g.userData.spot = sp;
    const beam = add(g, new T.ConeGeometry(2.8 + fl * 0.6, 12, 32, 1, true), new T.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.05, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }), 0, -0.3, -8.2);
    beam.rotation.x = -Math.PI / 2; g.userData.beam = beam;
  }
  return g;
}

// ------------------------------------------------------------------ base na superfície + estaleiro do submarino
const MODULE_BUILDERS = {
  Lab: (g, c) => { add(g, new T.CylinderGeometry(1.6, 1.6, 0.8, 32), std('#dfe8ee'), 0, 0.4, 0); add(g, new T.SphereGeometry(1.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), std(c, { transparent: true, opacity: 0.7, roughness: 0.1, emissive: col(c), emissiveIntensity: 0.25 }), 0, 0.8, 0); },
  Greenhouse: (g, c) => { add(g, new T.BoxGeometry(3, 1.4, 2), new T.MeshStandardMaterial({ color: col('#dff'), transparent: true, opacity: 0.35, roughness: 0.05 }), 0, 0.7, 0); for (let i = 0; i < 6; i++) add(g, new T.BoxGeometry(0.35, 0.5, 1.6), std(c, { emissive: col('#1c6a2c'), emissiveIntensity: 0.6 }), -1.1 + i * 0.44, 0.35, 0); },
  Rtg: (g, c) => { add(g, new T.CylinderGeometry(0.6, 0.7, 1.6, 16), std('#5a5f66', { metalness: 0.6 }), 0, 0.8, 0); for (let i = 0; i < 8; i++) { const f = add(g, new T.BoxGeometry(0.08, 1.4, 0.7), std('#6c727a', { metalness: 0.6 }), 0, 0.8, 0); f.rotation.y = i * Math.PI / 8; f.translateZ(0.7); } add(g, new T.SphereGeometry(0.25, 12, 8), glow(c), 0, 1.75, 0); },
  Antenna: (g, c) => { add(g, new T.CylinderGeometry(0.12, 0.2, 2.2, 12), std('#9aa6b2', { metalness: 0.6 }), 0, 1.1, 0); const d = add(g, new T.SphereGeometry(1.4, 32, 12, 0, Math.PI * 2, 0, Math.PI / 4), std(c, { side: T.DoubleSide, metalness: 0.4 }), 0, 2.6, 0); d.rotation.x = -2.4; },
  Commons: (g, c) => { const b = add(g, new T.CylinderGeometry(1, 1, 3.4, 24), std('#e8e2d6'), 0, 1, 0); b.rotation.z = Math.PI / 2; for (let i = 0; i < 4; i++) add(g, new T.BoxGeometry(0.35, 0.3, 0.05), glow(c), -1.2 + i * 0.8, 1.2, 1.0); },
  RepairDock: (g, c) => { add(g, new T.BoxGeometry(2.6, 0.3, 2.6), std('#6c747c'), 0, 0.15, 0); add(g, new T.BoxGeometry(0.25, 3, 0.25), std('#f0c040'), -1, 1.6, -1); const arm = add(g, new T.BoxGeometry(2.4, 0.2, 0.2), std('#f0c040'), 0.1, 3, -1); arm.rotation.z = -0.1; add(g, new T.CylinderGeometry(0.02, 0.02, 1.6, 6), std('#333'), 1.1, 2.2, -1); },
  SonarStation: (g, c) => { add(g, new T.CylinderGeometry(0.1, 0.1, 3, 8), std('#9aa6b2', { metalness: 0.6 }), 0, 1.5, 0); for (let i = 0; i < 3; i++) add(g, new T.TorusGeometry(0.4 + i * 0.25, 0.04, 6, 24), glow(c, 0.8), 0, 3 + i * 0.2, 0).rotation.x = Math.PI / 2; },
  Quarters: (g, c) => { add(g, new T.BoxGeometry(4, 1.3, 1.8), std('#efe9e0'), 0, 0.65, 0); for (let i = 0; i < 5; i++) add(g, new T.BoxGeometry(0.4, 0.3, 0.05), glow(c), -1.6 + i * 0.8, 0.8, 0.92); },
};
export class BaseScene {
  constructor(db) {
    this.db = db;
    this.scene = new T.Scene(); this.scene.background = col('#03060b'); this.scene.fog = new T.Fog(0x03060b, 60, 160);
    this.camera = new T.PerspectiveCamera(42, 1, 0.1, 3000);
    this.scene.add(stars(1600, 900));
    this.scene.add(new T.HemisphereLight(0x9cc8ff, 0x203040, 0.4));
    const sun = new T.DirectionalLight(0xfff1dd, 0.9); sun.position.set(-30, 25, 20); this.scene.add(sun);
    const jt = new T.CanvasTexture(jupiterCanvas(1024)); jt.encoding = T.sRGBEncoding;
    const jup = add(this.scene, new T.SphereGeometry(70, 64, 48), std('#fff', { map: jt, roughness: 0.9 }), 90, 30, -240); jup.material.fog = false;
    // gelo
    const geo = new T.PlaneGeometry(240, 240, 80, 80), pos = geo.attributes.position, rnd = seeded(5);
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), r = Math.hypot(x, y); pos.setZ(i, r < 14 ? 0 : (Math.sin(x * 0.15) * Math.cos(y * 0.13) * 0.8 + rnd() * 0.5) * Math.min(1, (r - 14) / 10)); }
    geo.computeVertexNormals();
    const ice = add(this.scene, geo, std('#8ea4b2', { roughness: 0.95 })); ice.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 26; i++) { const a = rnd() * 6.28, r = 20 + rnd() * 70; const l = add(this.scene, new T.BoxGeometry(0.2 + rnd() * 0.5, 0.05, 8 + rnd() * 30), std('#9a6a4a', { roughness: 1 }), Math.cos(a) * r, 0.03, Math.sin(a) * r); l.rotation.y = rnd() * 3; }
    // habitat central e poço do cryobot
    add(this.scene, new T.CylinderGeometry(2.4, 2.6, 1.2, 32), std('#e8eef2'), 0, 0.6, 0);
    add(this.scene, new T.SphereGeometry(2.3, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), std('#f4f6f8'), 0, 1.2, 0);
    add(this.scene, new T.CylinderGeometry(0.3, 0.3, 0.1, 16), glow('#7fe0ff'), 0, 3.5, 0);
    const tower = new T.Group(); tower.position.set(4.6, 0, -1); this.scene.add(tower);
    for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) add(tower, new T.CylinderGeometry(0.06, 0.06, 6, 6), std('#f0c040'), x, 3, z);
    for (let i = 0; i < 6; i++) add(tower, new T.BoxGeometry(1.3, 0.06, 1.3), std('#f0c040'), 0, 0.6 + i, 0);
    add(tower, new T.CylinderGeometry(1.1, 1.1, 0.12, 24), std('#20303c'), 0, 0.02, 0);
    add(tower, new T.CylinderGeometry(0.35, 0.35, 1.6, 16), std('#e05030', { metalness: 0.3 }), 0, 4.6, 0);
    const lab = document.createElement('canvas'); lab.width = 512; lab.height = 64; const lg = lab.getContext('2d'); lg.fillStyle = '#7fe0ff'; lg.font = 'bold 40px sans-serif'; lg.textAlign = 'center'; lg.fillText(EN ? 'CONAMARA BASE' : 'BASE CONAMARA', 256, 46);
    const sign = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(lab), transparent: true, depthWrite: false })); sign.scale.set(9, 1.1, 1); sign.position.set(0, 5.4, 0); this.scene.add(sign);
    // módulos
    this.slots = {};
    for (const m of db.modules) {
      const g = new T.Group(); g.position.set(m.slot[0] * 1.5, 0, m.slot[1] * 1.5); this.scene.add(g);
      const ghost = add(g, new T.RingGeometry(1.6, 1.8, 32), new T.MeshBasicMaterial({ color: col(m.color), transparent: true, opacity: 0.45, side: T.DoubleSide }), 0, 0.05, 0); ghost.rotation.x = -Math.PI / 2;
      const built = new T.Group(); built.visible = false; g.add(built); MODULE_BUILDERS[m.id]?.(built, m.color);
      const tube = add(this.scene, new T.CylinderGeometry(0.25, 0.25, 1, 8), std('#c8d0d8'), g.position.x / 2, 0.3, g.position.z / 2);
      tube.scale.y = g.position.length() - 3; tube.rotation.x = Math.PI / 2; tube.lookAt(0, 0.3, 0); tube.rotateX(Math.PI / 2); tube.visible = false;
      this.slots[m.id] = { g, ghost, built, tube, t: 1 };
    }
    // submarino na doca (aparece na aba do submarino)
    this.subHolder = new T.Group(); this.subHolder.position.set(0, 2.2, 14); this.scene.add(this.subHolder);
    const pad = add(this.scene, new T.CylinderGeometry(3, 3, 0.2, 32), std('#3a4652'), 0, 0.1, 14);
    const pl = new T.PointLight(0x9fe8ff, 0.8, 14); pl.position.set(0, 5, 14); this.scene.add(pl);
    this.view = 'base'; this.yaw = 0.6; this.pitch = 0.3; this.dist = 34; this.target = new T.Vector3(0, 0, 0); this.wantTarget = new T.Vector3();
  }
  setBuilt(set) { for (const [id, s] of Object.entries(this.slots)) { const b = set.has(id); if (b && !s.built.visible) s.t = 0; s.built.visible = b; s.ghost.visible = !b; s.tube.visible = b; } }
  setSub(levels) {
    const key = JSON.stringify(levels);
    if (key === this.subKey) return; this.subKey = key;
    this.subHolder.clear(); this.sub = buildSub(levels); this.sub.scale.setScalar(1.3); this.subHolder.add(this.sub);
  }
  focus(id) { const s = this.slots[id]; if (s) { this.view = 'base'; this.wantTarget.copy(s.g.position); this.dist = 20; } }
  setView(v) { this.view = v; if (v === 'sub') { this.wantTarget.set(0, 2.2, 14); this.dist = 10; } else { this.wantTarget.set(0, 0, 0); this.dist = 34; } }
  update(dt, d) {
    if (d.on || d.dx) { this.yaw -= d.dx * 0.006; this.pitch = Math.max(0.12, Math.min(1.2, this.pitch + d.dy * 0.004)); }
    else this.yaw += dt * 0.05;
    this.target.lerp(this.wantTarget, Math.min(1, dt * 2.5));
    const r = this.dist;
    this.camera.position.set(this.target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * r, this.target.y + Math.sin(this.pitch) * r, this.target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * r);
    this.camera.lookAt(this.target);
    for (const s of Object.values(this.slots)) if (s.t < 1) { s.t = Math.min(1, s.t + dt * 1.5); const k = 1 - Math.pow(1 - s.t, 3); s.built.scale.set(1, Math.max(0.01, k), 1); }
    if (this.sub) { this.sub.rotation.y += dt * 0.4; this.sub.userData.prop.rotation.z += dt * 3; }
  }
}

// ------------------------------------------------------------------ criaturas e estruturas (formas por tipo de alvo)
export function buildTarget(t) {
  const g = new T.Group(), c = t.color, rnd = seeded(t.code.charCodeAt(2) * 31 + t.code.charCodeAt(3));
  const em = (o = 0.6) => std(c, { emissive: col(c), emissiveIntensity: o, roughness: 0.4 });
  const tr = (op = 0.5) => new T.MeshStandardMaterial({ color: col(c), emissive: col(c), emissiveIntensity: 0.7, transparent: true, opacity: op, roughness: 0.2, side: T.DoubleSide, depthWrite: false });
  const S = {
    Jelly: () => { add(g, new T.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), tr(0.55)); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; const tn = add(g, new T.CylinderGeometry(0.02, 0.005, 2.5 + rnd() * 1.5, 4), tr(0.6), Math.cos(a) * 0.7, -1.4, Math.sin(a) * 0.7); g.userData.tent = (g.userData.tent || []).concat(tn); } },
    Fish: () => { const b = add(g, new T.SphereGeometry(0.5, 16, 12), std('#1b2c34', { roughness: 0.5 })); b.scale.set(1, 0.6, 3.2); for (let i = 0; i < 9; i++) add(g, new T.SphereGeometry(0.06, 6, 4), glow(c), 0.42, 0, -1.3 + i * 0.32); for (let i = 0; i < 9; i++) add(g, new T.SphereGeometry(0.06, 6, 4), glow(c), -0.42, 0, -1.3 + i * 0.32); add(g, new T.ConeGeometry(0.4, 0.8, 8), std('#1b2c34'), 0, 0, 1.9).rotation.x = Math.PI / 2; },
    Orb: () => { add(g, new T.IcosahedronGeometry(1.2, 1), new T.MeshBasicMaterial({ color: col(c), wireframe: true, transparent: true, opacity: 0.7 })); add(g, new T.SphereGeometry(0.3, 12, 8), glow(c)); },
    School: () => { const fishG = new T.ConeGeometry(0.08, 0.35, 5); fishG.rotateX(Math.PI / 2); const im = new T.InstancedMesh(fishG, std(c, { metalness: 0.9, roughness: 0.2, emissive: col('#334'), emissiveIntensity: 0.4 }), 120); g.add(im); g.userData.school = im; g.userData.seeds = Array.from({ length: 120 }, () => [rnd() * 6.28, 1 + rnd() * 2, (rnd() - 0.5) * 1.5]); },
    Crystal: () => { for (let i = 0; i < 9; i++) { const k = add(g, new T.OctahedronGeometry(0.3 + rnd() * 0.5, 0), tr(0.75), (rnd() - 0.5) * 2, (rnd() - 0.5) * 1, (rnd() - 0.5) * 2); k.scale.y = 2 + rnd() * 2; k.rotation.set(rnd(), rnd(), rnd() * 0.6); } },
    IceBlocks: () => { for (let i = 0; i < 6; i++) { const b = add(g, new T.BoxGeometry(1.2 + rnd(), 0.8 + rnd(), 1.2 + rnd()), std(c, { roughness: 0.2, transparent: true, opacity: 0.85 }), (rnd() - 0.5) * 3, (rnd() - 0.5) * 0.6, (rnd() - 0.5) * 3); b.rotation.set(rnd() * 0.5, rnd() * 3, rnd() * 0.5); } },
    Brinicle: () => { const b = add(g, new T.ConeGeometry(0.35, 6, 12), tr(0.8), 0, -1.5, 0); b.rotation.x = Math.PI; },
    Vent: () => { add(g, new T.CylinderGeometry(0.5, 1.2, 4, 10), std('#2a1a14', { roughness: 1 }), 0, 0, 0); add(g, new T.SphereGeometry(0.5, 10, 8), glow(c, 0.8), 0, 2.1, 0); },
    Worms: () => { for (let i = 0; i < 40; i++) { const x = (rnd() - 0.5) * 3, z = (rnd() - 0.5) * 3, h = 0.6 + rnd() * 1.2; add(g, new T.CylinderGeometry(0.05, 0.06, h, 5), std('#f2efe8'), x, h / 2, z); add(g, new T.SphereGeometry(0.09, 6, 4), em(0.5), x, h, z); } },
    Mat: () => { const m = add(g, new T.CircleGeometry(2.2, 32), std(c, { emissive: col(c), emissiveIntensity: 0.4, side: T.DoubleSide })); m.rotation.x = -Math.PI / 2; g.userData.mat = m; },
    Crab: () => { const b = add(g, new T.SphereGeometry(0.7, 16, 10), std(c, { roughness: 0.4 })); b.scale.set(1.3, 0.5, 1); for (let i = 0; i < 6; i++) { const s = i < 3 ? -1 : 1, z = (i % 3 - 1) * 0.4; const l = add(g, new T.CylinderGeometry(0.04, 0.03, 0.9, 5), std(c), s * 0.95, -0.15, z); l.rotation.z = s * 1.1; } },
    Ribs: () => { for (let i = 0; i < 6; i++) { const r = add(g, new T.TorusGeometry(3, 0.25, 8, 24, Math.PI), std(c, { roughness: 0.9 }), 0, 0, -6 + i * 2.4); r.rotation.y = Math.PI / 2; } },
    Eye: () => { add(g, new T.SphereGeometry(1.8, 24, 16), std('#22303a', { roughness: 0.6 })); for (let i = 0; i < 40; i++) { const v = new T.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(1.82); add(g, new T.SphereGeometry(0.08 + rnd() * 0.08, 6, 4), glow(c), v.x, v.y, v.z); } add(g, new T.SphereGeometry(0.5, 12, 8), glow(c, 0.9), 0, 0, 1.6); },
    Plate: () => { add(g, new T.BoxGeometry(2.2, 0.1, 1.4), std(c, { metalness: 0.9, roughness: 0.25 })); add(g, new T.BoxGeometry(0.2, 0.6, 0.2), std('#555'), 0, -0.35, 0); },
  };
  (S[t.shape] || S.Orb)();
  g.add(haloSprite(c, 5 * (t.size || 1), 0.25));
  g.scale.setScalar(t.size || 1);
  g.userData.shape = t.shape; g.userData.t0 = Math.random() * 10;
  return g;
}
function animateTarget(g, t) {
  const u = g.userData, k = t + u.t0;
  if (u.shape === 'Jelly') { g.children[0].scale.set(1 + Math.sin(k * 2) * 0.1, 1 - Math.sin(k * 2) * 0.12, 1 + Math.sin(k * 2) * 0.1); g.position.y += Math.sin(k) * 0.003; }
  if (u.shape === 'Fish') { g.rotation.y = Math.sin(k * 0.4) * 0.6; }
  if (u.shape === 'Orb') { g.children[0].rotation.y = k * 0.4; g.children[0].rotation.x = k * 0.2; }
  if (u.shape === 'Eye') { g.rotation.y = Math.sin(k * 0.2) * 0.3; }
  if (u.school) { const m = new T.Matrix4(), q = new T.Quaternion(), p = new T.Vector3(), s = new T.Vector3(1, 1, 1);
    u.seeds.forEach(([a, r, y], i) => { const ang = a + k * (0.6 + (i % 5) * 0.05); p.set(Math.cos(ang) * r * 1.6, y + Math.sin(k + i) * 0.1, Math.sin(ang) * r); q.setFromAxisAngle(new T.Vector3(0, 1, 0), -ang); m.compose(p, q, s); u.school.setMatrixAt(i, m); });
    u.school.instanceMatrix.needsUpdate = true; }
}

// ------------------------------------------------------------------ ambiente de cada zona (compartilhado entre mergulho e EVA)
function buildZoneEnv(zoneIdx, zone, rnd, span = 80) {
  const env = new T.Group(); const feats = [];
  const Z = zoneIdx;
  if (Z === 0) {
    const geo = new T.PlaneGeometry(span * 2, span * 2, 60, 60), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 0.2) * Math.cos(p.getY(i) * 0.17) * 1.2 + rnd() * 0.6);
    geo.computeVertexNormals();
    const ceil = add(env, geo, std('#bfe6ee', { roughness: 0.3, emissive: col('#16424e'), emissiveIntensity: 0.6, side: T.DoubleSide }), 0, 9, 0); ceil.rotation.x = Math.PI / 2;
    for (let i = 0; i < 70; i++) { const h = 1 + rnd() * 5; const ic = add(env, new T.ConeGeometry(0.2 + rnd() * 0.5, h, 6), std('#e0f4ff', { roughness: 0.2, emissive: col('#2a6a7a'), emissiveIntensity: 0.4 }), (rnd() - 0.5) * 50, 9 - h / 2, -span + rnd() * span * 1.4); ic.rotation.x = Math.PI; feats.push(ic); }
  }
  if (Z >= 2) {
    const fy = Z === 2 ? -7 : -10;
    const geo = new T.PlaneGeometry(span * 2, span * 2, 70, 70), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 0.15) * Math.cos(p.getY(i) * 0.12) * 1.5 + rnd() * 0.8 + (Z === 3 ? Math.max(0, Math.abs(p.getX(i)) - 10) * 0.9 : 0));
    geo.computeVertexNormals();
    const fl = add(env, geo, std(Z === 2 ? '#4a3428' : '#2a3a40', { roughness: 1, emissive: col(Z === 2 ? '#1a0c06' : '#06141a'), emissiveIntensity: 0.6 }), 0, fy, 0); fl.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 40; i++) { const r = add(env, new T.DodecahedronGeometry(0.4 + rnd() * 1.4, 0), std(Z === 2 ? '#3a2a22' : '#24323a', { roughness: 1 }), (rnd() - 0.5) * 40, fy + 0.3, -span + rnd() * span * 1.4); r.scale.y = 0.6; feats.push(r); }
    if (Z === 2) {
      for (let i = 0; i < 9; i++) {
        const v = new T.Group(); v.position.set((rnd() < 0.5 ? -1 : 1) * (5 + rnd() * 12), fy, -span + rnd() * span * 1.4); env.add(v); feats.push(v);
        const h = 3 + rnd() * 5; add(v, new T.CylinderGeometry(0.4, 1.2, h, 8), std('#2a1a14', { roughness: 1 }), 0, h / 2, 0);
        add(v, new T.SphereGeometry(0.35, 8, 6), glow('#ff7a3a', 0.9), 0, h, 0); const s = haloSprite('#ff7a3a', 4, 0.5); s.position.y = h; v.add(s);
        const pl = new T.PointLight(0xff7a3a, 0.8, 10); pl.position.y = h + 0.5; v.add(pl);
      }
    }
    if (Z === 3) {
      for (const s of [-1, 1]) for (let i = 0; i < 8; i++) { const w = add(env, new T.BoxGeometry(4, 20 + rnd() * 10, 10), std('#1a2a32', { roughness: 1 }), s * (16 + rnd() * 4), fy + 6, -span + i * 20); w.rotation.z = s * (0.05 + rnd() * 0.15); feats.push(w); }
    }
  }
  if (Z === 1) for (let i = 0; i < 30; i++) { const s = haloSprite(['#7fe0ff', '#8affd8', '#9fb8ff'][i % 3], 0.8 + rnd() * 1.5, 0.4); s.position.set((rnd() - 0.5) * 60, (rnd() - 0.5) * 30, -span + rnd() * span * 1.4); env.add(s); feats.push(s); }
  return { env, feats, floorY: Z === 2 ? -7 : Z === 3 ? -10 : null, ceilY: Z === 0 ? 9 : null };
}
function snow(n = 1600, box = 40) {
  const g = new T.BufferGeometry(), p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - 0.5) * box; p[i * 3 + 1] = (Math.random() - 0.5) * box * 0.6; p[i * 3 + 2] = (Math.random() - 0.5) * box * 1.6; }
  g.setAttribute('position', new T.BufferAttribute(p, 3));
  const pts = new T.Points(g, new T.PointsMaterial({ color: 0xe8f6ff, size: 0.07, transparent: true, opacity: 0.8, depthWrite: false }));
  pts.userData.box = box; return pts;
}

// ------------------------------------------------------------------ mergulho
export class OceanScene {
  constructor(db) {
    this.db = db;
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(55, 1, 0.1, 400);
    this.hemi = new T.HemisphereLight(0x5aa0b8, 0x0a1418, 0.6); this.scene.add(this.hemi);
    this.amb = new T.AmbientLight(0x204050, 0.5); this.scene.add(this.amb);
    this.snow = snow(); this.scene.add(this.snow);
    this.subHolder = new T.Group(); this.scene.add(this.subHolder);
    this.contact = null; this.speed = 0; this.yaw = 0.5; this.pitch = 0.18; this.t = 0; this.shake = 0; this.dark = 0; this.darkT = 0;
    this.scanBeam = add(this.scene, new T.CylinderGeometry(0.05, 1.6, 1, 16, 1, true), new T.MeshBasicMaterial({ color: 0x6dffb0, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
    this.scanBeam.visible = false;
  }
  setSub(levels) { const k = JSON.stringify(levels); if (k === this.subKey) return; this.subKey = k; this.subHolder.clear(); this.sub = buildSub(levels, { light: true }); this.subHolder.add(this.sub); }
  setZone(z) {
    const Z = this.db.zones[z]; this.zone = z;
    if (this.envObj) this.scene.remove(this.envObj.env);
    this.envObj = buildZoneEnv(z, Z, seeded(100 + z)); this.scene.add(this.envObj.env);
    const fogC = col(Z.fog).multiplyScalar(1.4);
    this.scene.background = fogC; this.scene.fog = new T.FogExp2(fogC, Z.fogDensity * 0.55);
    this.hemi.color = col(Z.ambient).multiplyScalar(1.6); this.amb.color = col(Z.ambient);
    this.clearContact();
  }
  spawnContact(t) {
    this.clearContact();
    const g = buildTarget(t);
    const side = Math.random() < 0.5 ? -1 : 1;
    let y = t.y; if (this.envObj.ceilY != null) y = Math.min(y, this.envObj.ceilY - 2); if (this.envObj.floorY != null) y = Math.max(t.y, this.envObj.floorY + 0.5);
    if (t.shape === 'Brinicle' && this.envObj.ceilY != null) y = this.envObj.ceilY - 3.5;
    g.position.set(side * (3 + Math.random() * 3), y, -40);
    g.userData.goal = new T.Vector3(side * (3 + Math.random() * 2), y, -13);
    this.scene.add(g); this.contact = g;
  }
  clearContact() { if (this.contact) { this.contact.userData.leaving = true; this.leaving = this.contact; } this.contact = null; }
  move(sec = 2.6) { this.moveT = sec; this.moveTotal = sec; }
  scan(on) { this.scanning = on; this.scanBeam.visible = on && !!this.contact; }
  bump() { this.shake = 0.6; }
  update(dt, d) {
    this.t += dt;
    if (d.on || d.dx) { this.yaw -= d.dx * 0.006; this.pitch = Math.max(-0.5, Math.min(1.1, this.pitch + d.dy * 0.004)); }
    // deslocamento do ambiente (o submarino fica no centro e o mundo passa)
    let v = 0.6;
    if (this.moveT > 0) { this.moveT -= dt; const k = 1 - this.moveT / this.moveTotal; v = 0.6 + Math.sin(Math.PI * Math.min(1, k)) * 14; }
    const dz = v * dt;
    if (this.envObj) for (const f of this.envObj.feats) { f.position.z += dz; if (f.position.z > 30) f.position.z -= 110; }
    if (this.envObj) { const e = this.envObj.env.children[0]; if (e && e.geometry.type === 'PlaneGeometry') { e.position.z = (e.position.z + dz) % 20; } }
    const sp = this.snow.geometry.attributes.position, box = this.snow.userData.box;
    for (let i = 0; i < sp.count; i++) { let z = sp.getZ(i) + dz * 1.0, y = sp.getY(i) - dt * 0.15; if (z > box * 0.8) z -= box * 1.6; if (y < -box * 0.3) y += box * 0.6; sp.setZ(i, z); sp.setY(i, y); }
    sp.needsUpdate = true;
    if (this.sub) {
      this.sub.position.y = Math.sin(this.t * 0.8) * 0.15; this.sub.rotation.z = Math.sin(this.t * 0.6) * 0.03;
      this.sub.userData.prop.rotation.z += dt * (3 + v * 2);
      if (this.shake > 0) { this.shake -= dt; this.sub.position.x = (Math.random() - 0.5) * this.shake * 0.6; } else this.sub.position.x = 0;
    }
    if (this.contact) { const g = this.contact; g.position.lerp(g.userData.goal, Math.min(1, dt * (this.moveT > 0 ? 2.5 : 0.8))); animateTarget(g, this.t); }
    if (this.leaving) { const g = this.leaving; g.position.z += dt * 12; g.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = Math.max(0, (o.material.opacity ?? 1) - dt * 0.8); } }); if (g.position.z > 20) { this.scene.remove(g); this.leaving = null; } }
    if (this.scanBeam.visible && this.contact) {
      const a = new T.Vector3(0, 0.2, -2.4), b = this.contact.getWorldPosition(new T.Vector3()), mid = a.clone().add(b).multiplyScalar(0.5);
      this.scanBeam.position.copy(mid); this.scanBeam.scale.set(1, a.distanceTo(b), 1);
      this.scanBeam.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), b.clone().sub(a).normalize());
      this.scanBeam.material.opacity = 0.18 + Math.sin(this.t * 12) * 0.08;
    }
    // escuridão (descanso / troca de zona)
    this.dark += (this.darkT - this.dark) * Math.min(1, dt * 2);
    if (this.sub?.userData.spot) this.sub.userData.spot.intensity = (2.4) * (1 - this.dark);
    if (this.sub?.userData.beam) this.sub.userData.beam.material.opacity = 0.05 * (1 - this.dark);
    this.hemi.intensity = 0.6 * (1 - this.dark * 0.8);
    const r = 9;
    this.camera.position.set(Math.sin(this.yaw) * Math.cos(this.pitch) * r, 1 + Math.sin(this.pitch) * r, Math.cos(this.yaw) * Math.cos(this.pitch) * r + 1);
    this.camera.lookAt(0, 0, -3);
  }
}

// ------------------------------------------------------------------ EVA: astronauta e amostras
export function buildAstronaut(protagonist = 'menina') {
  const g = new T.Group();
  const suit = std('#eef2f5', { roughness: 0.7 }), trim = std(protagonist === 'menina' ? '#1aa6a6' : '#ff8a3a', { roughness: 0.5 }), dark = std('#3a4450');
  const torso = add(g, new T.CylinderGeometry(0.32, 0.28, 0.75, 16), suit, 0, 1.15, 0);
  add(g, new T.TorusGeometry(0.3, 0.04, 8, 20), trim, 0, 1.3, 0).rotation.x = Math.PI / 2;
  add(g, new T.BoxGeometry(0.5, 0.6, 0.3), suit, 0, 1.2, 0.3);
  add(g, new T.BoxGeometry(0.16, 0.12, 0.05), glow('#7fe0ff'), 0, 1.25, -0.28);
  const head = add(g, new T.SphereGeometry(0.28, 20, 14), new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.3 }), 0, 1.78, 0);
  add(g, new T.SphereGeometry(0.2, 16, 10), std(protagonist === 'menina' ? '#c08a64' : '#7a4e30'), 0, 1.76, 0.02);
  const visor = add(g, new T.SphereGeometry(0.285, 20, 14, Math.PI * 0.75, Math.PI * 0.5, Math.PI * 0.3, Math.PI * 0.35), std('#e0a83a', { metalness: 0.9, roughness: 0.1 }), 0, 1.78, 0);
  const lamp = add(g, new T.SphereGeometry(0.05, 8, 6), glow('#fff6d8'), 0.18, 1.98, -0.12);
  const spot = new T.SpotLight(0xfff2d0, 1.6, 18, 0.5, 0.6, 1.2); spot.position.set(0.18, 1.98, -0.12); spot.target.position.set(0, 1, -6); g.add(spot); g.add(spot.target);
  const limb = (x, y, h, r, m) => { const p = new T.Group(); p.position.set(x, y, 0); g.add(p); add(p, new T.CylinderGeometry(r, r * 0.9, h, 10), m, 0, -h / 2, 0); add(p, new T.SphereGeometry(r * 1.1, 8, 6), trim, 0, -h, 0); return p; };
  g.userData.armL = limb(-0.4, 1.45, 0.62, 0.09, suit); g.userData.armR = limb(0.4, 1.45, 0.62, 0.09, suit);
  g.userData.legL = limb(-0.15, 0.78, 0.72, 0.11, suit); g.userData.legR = limb(0.15, 0.78, 0.72, 0.11, suit);
  g.userData.torso = torso; g.userData.visor = visor; g.userData.head = head;
  return g;
}
export class EvaScene {
  constructor(db) {
    this.db = db;
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(60, 1, 0.1, 300);
    this.scene.add(new T.HemisphereLight(0x5aa0b8, 0x0a1418, 0.7));
    this.snow = snow(1000, 30); this.scene.add(this.snow);
    this.yaw = 0; this.pitch = 0.3; this.t = 0;
  }
  begin(zone, levels, protagonist, samples) {
    const Z = this.db.zones[zone]; this.zone = zone;
    if (this.root) this.scene.remove(this.root);
    this.root = new T.Group(); this.scene.add(this.root);
    const e = buildZoneEnv(zone, Z, seeded(300 + zone), 60); this.root.add(e.env); this.envObj = e;
    const fogC = col(Z.fog).multiplyScalar(1.5); this.scene.background = fogC; this.scene.fog = new T.FogExp2(fogC, Z.fogDensity * 0.7);
    this.ceiling = e.ceilY != null;
    const baseY = this.ceiling ? e.ceilY - 4.2 : e.floorY + 0.1;
    this.minY = this.ceiling ? baseY - 4 : baseY; this.maxY = this.ceiling ? e.ceilY - 2.2 : baseY + 5;
    this.sub = buildSub(levels, { light: true }); this.sub.position.set(0, this.ceiling ? baseY + 1.2 : baseY + 2.4, 0); this.sub.rotation.y = 0.35; this.root.add(this.sub);
    this.hatch = new T.Vector3(0, this.sub.position.y - 1.3, -0.3).applyAxisAngle(new T.Vector3(0, 1, 0), 0).add(new T.Vector3(0, 0, 0));
    this.hatch.set(this.sub.position.x + Math.sin(0.35) * -0.3, this.sub.position.y - 1.6, this.sub.position.z + Math.cos(0.35) * -0.3);
    this.arrow = add(this.root, new T.ConeGeometry(0.3, 0.7, 12), glow('#ffc46a'), this.hatch.x, this.hatch.y + 0.2, this.hatch.z); this.arrow.rotation.x = Math.PI;
    const sc = zone === 2 ? '#ff9a40' : zone === 3 ? '#b3ffbf' : '#80f2ff';
    this.samples = samples.map((s, i) => {
      const a = i / samples.length * Math.PI * 2 + (Math.random() - 0.5) * 0.8, d = 7 + Math.random() * 8;
      const g = new T.Group(); g.position.set(Math.cos(a) * d, this.ceiling ? this.maxY + 0.6 : baseY + 0.5, Math.sin(a) * d - 3);
      add(g, new T.IcosahedronGeometry(0.35, 0), std(sc, { emissive: col(sc), emissiveIntensity: 0.8 })); g.add(haloSprite(sc, 2.4, 0.5));
      const beacon = add(g, new T.CylinderGeometry(0.02, 0.02, 6, 4), glow(sc, 0.25), 0, this.ceiling ? -3 : 3, 0);
      this.root.add(g); return Object.assign({}, s, { obj: g, got: false });
    });
    this.astro = buildAstronaut(protagonist);
    this.pos = new T.Vector3(this.hatch.x, this.ceiling ? this.hatch.y - 1.5 : baseY, this.hatch.z + 1.5);
    this.vel = new T.Vector3(); this.facing = 0; this.yaw = 0; this.pitch = 0.35;
    this.root.add(this.astro);
  }
  /** move: {x,y} de −1 a 1 (frente = y), vert de −1 a 1. Devolve as amostras coletadas agora. */
  step(dt, move, vert, run) {
    const got = [];
    const fwd = new T.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), right = new T.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const want = fwd.multiplyScalar(move.y).add(right.multiplyScalar(move.x)).multiplyScalar(run ? 4.5 : 2.8);
    this.vel.x += (want.x - this.vel.x) * Math.min(1, dt * 3); this.vel.z += (want.z - this.vel.z) * Math.min(1, dt * 3);
    // gravidade de Europa (1,3 m/s²) quase anulada pelo empuxo da água: o traje afunda devagar
    const vy = vert * 2.2 + (this.ceiling ? 0 : -0.5);
    this.vel.y += (vy - this.vel.y) * Math.min(1, dt * 2.5);
    this.pos.addScaledVector(this.vel, dt);
    this.pos.y = Math.max(this.minY, Math.min(this.maxY, this.pos.y));
    const r = Math.hypot(this.pos.x, this.pos.z + 3); if (r > 22) { this.pos.x *= 22 / r; this.pos.z = (this.pos.z + 3) * 22 / r - 3; }
    if (Math.hypot(this.vel.x, this.vel.z) > 0.2) this.facing = Math.atan2(-this.vel.x, -this.vel.z);
    for (const s of this.samples) if (!s.got && s.obj.position.distanceTo(this.pos.clone().add(new T.Vector3(0, 1, 0))) < 1.8) { s.got = true; s.obj.visible = false; got.push(s); }
    this.nearHatch = this.pos.clone().add(new T.Vector3(0, 1, 0)).distanceTo(this.hatch) < 2.6;
    return got;
  }
  update(dt, d) {
    this.t += dt;
    if (!this.astro) return;
    if (d.on || d.dx) { this.yaw -= d.dx * 0.007; this.pitch = Math.max(-0.2, Math.min(1.0, this.pitch + d.dy * 0.004)); }
    if (this.keyYaw) this.yaw += this.keyYaw * dt * 1.8;
    const a = this.astro; a.position.copy(this.pos);
    let df = this.facing - a.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); a.rotation.y += df * Math.min(1, dt * 6);
    const sp = Math.hypot(this.vel.x, this.vel.z), sw = Math.sin(this.t * 5) * Math.min(1, sp / 2.5) * 0.6;
    a.userData.legL.rotation.x = sw; a.userData.legR.rotation.x = -sw; a.userData.armL.rotation.x = -sw * 0.7; a.userData.armR.rotation.x = sw * 0.7;
    a.position.y += Math.sin(this.t * 1.3) * 0.04;
    this.arrow.position.y = this.hatch.y + 0.4 + Math.sin(this.t * 3) * 0.2; this.arrow.rotation.y += dt;
    this.samples.forEach((s, i) => { s.obj.rotation.y += dt; s.obj.position.y += Math.sin(this.t * 2 + i) * 0.003; });
    const sp2 = this.snow.geometry.attributes.position; for (let i = 0; i < sp2.count; i++) { let y = sp2.getY(i) - dt * 0.2; if (y < -9) y += 18; sp2.setY(i, y); } sp2.needsUpdate = true;
    this.snow.position.copy(this.pos);
    const r = 6;
    const target = this.pos.clone().add(new T.Vector3(0, 1.3, 0));
    this.camera.position.set(target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * r, target.y + Math.sin(this.pitch) * r, target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * r);
    this.camera.lookAt(target);
  }
}
