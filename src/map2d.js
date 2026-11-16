// Mapas 2D em Canvas: superfície de Europa com os locais das missões e o corte gelo/oceano com as zonas.
import { europaCanvas } from './world3d.js';
import { pressureBar, thousands, dec } from './engine.js';
import { tr } from './i18n.js';

let surf = null;
function fit(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { g, w, h };
}

/** Mapa da superfície (projeção equiretangular). Devolve a função que acha a missão sob um clique. */
export function drawSurface(canvas, missions, selectedId, t = 0) {
  const { g, w, h } = fit(canvas);
  if (!surf) surf = europaCanvas('realce', 1024);
  g.drawImage(surf, 0, 0, w, h);
  g.fillStyle = 'rgba(2,10,16,.18)'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1;
  for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(w * i / 6, 0); g.lineTo(w * i / 6, h); g.stroke(); }
  for (let i = 1; i < 4; i++) { g.strokeStyle = i === 2 ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(0, h * i / 4); g.lineTo(w, h * i / 4); g.stroke(); }
  g.font = '600 10px system-ui'; g.fillStyle = 'rgba(2,12,18,.75)'; g.fillText(tr('equador', 'equator'), 6, h / 2 - 5); g.fillText(tr('polo sul', 'south pole'), 6, h - 6); g.fillText(tr('polo norte', 'north pole'), 6, 13);
  const pts = [];
  for (const m of missions) {
    const x = m.map[0] * w, y = (1 - m.map[1]) * h, sel = m.id === selectedId;
    const r = sel ? 13 + Math.sin(t * 4) * 2 : 9;
    g.fillStyle = m.color + '55'; g.beginPath(); g.arc(x, y, r + 8, 0, 7); g.fill();
    g.fillStyle = m.color; g.strokeStyle = '#02121a'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, sel ? 8 : 6, 0, 7); g.fill(); g.stroke();
    g.font = (sel ? '700 13px' : '600 12px') + ' system-ui';
    const label = m.site, tw = g.measureText(label).width;
    const lx = Math.min(w - tw - 8, Math.max(4, x - tw / 2)), ly = y - 18 < 14 ? y + 26 : y - 16;
    g.fillStyle = 'rgba(2,12,18,.8)'; g.fillRect(lx - 4, ly - 12, tw + 8, 16);
    g.fillStyle = sel ? '#ffc46a' : '#e6f2f5'; g.fillText(label, lx, ly);
    pts.push({ m, x, y });
  }
  return (cx, cy) => { let best = null, bd = 40; for (const p of pts) { const d = Math.hypot(p.x - cx, p.y - cy); if (d < bd) { bd = d; best = p.m; } } return best; };
}

/** Corte vertical: gelo, oceano e fundo, com as quatro zonas e o submarino. Devolve um localizador de zona por clique. */
export function drawSection(canvas, zones, current, info = {}) {
  const { g, w, h } = fit(canvas);
  const maxKm = 125, top = 22, Y = km => top + km / maxKm * (h - top - 8);
  const sky = g.createLinearGradient(0, 0, 0, top); sky.addColorStop(0, '#02040a'); sky.addColorStop(1, '#0b1626'); g.fillStyle = sky; g.fillRect(0, 0, w, top);
  const ice = g.createLinearGradient(0, top, 0, Y(20)); ice.addColorStop(0, '#f2f7fb'); ice.addColorStop(1, '#a8d4e6'); g.fillStyle = ice; g.fillRect(0, top, w, Y(20) - top);
  const sea = g.createLinearGradient(0, Y(20), 0, h); sea.addColorStop(0, '#0e5a7a'); sea.addColorStop(0.6, '#06263a'); sea.addColorStop(1, '#030f18'); g.fillStyle = sea; g.fillRect(0, Y(20), w, h - Y(20));
  // fundo rochoso com a fenda
  g.fillStyle = '#3a2a22'; g.beginPath(); g.moveTo(0, Y(100));
  for (let x = 0; x <= w; x += 8) { const rift = Math.abs(x - w * 0.72) < w * 0.07; g.lineTo(x, Y(rift ? 116 + Math.sin(x) * 1.5 : 99 + Math.sin(x * 0.05) * 1.5)); }
  g.lineTo(w, h); g.lineTo(0, h); g.fill();
  // poço do cryobot e base
  g.fillStyle = '#1a3a4a'; g.fillRect(w * 0.12 - 3, top, 6, Y(20) - top);
  g.fillStyle = '#5fe0d0'; g.font = '700 11px system-ui'; g.fillText(tr('BASE CONAMARA ▲', 'CONAMARA BASE ▲'), w * 0.12 - 8, 15);
  g.fillStyle = 'rgba(2,12,18,.55)'; g.font = '600 10px system-ui'; g.fillText(tr('CASCA DE GELO · 15 a 25 km', 'ICE SHELL · 15 to 25 km'), w * 0.3, Y(10));
  g.fillStyle = 'rgba(230,242,245,.6)'; g.fillText(tr('OCEANO SALGADO · 60 a 150 km', 'SALTY OCEAN · 60 to 150 km'), w * 0.3, Y(36));
  // chaminés
  g.fillStyle = '#ff7a3a'; for (const x of [0.38, 0.45, 0.52]) { g.fillRect(w * x, Y(97), 4, Y(99) - Y(97)); g.globalAlpha = 0.35; g.beginPath(); g.arc(w * x + 2, Y(96), 5, 0, 7); g.fill(); g.globalAlpha = 1; }
  const xs = [0.2, 0.3, 0.48, 0.72];
  const hits = [];
  zones.forEach((z, i) => {
    const x = w * xs[i], y = Y(z.depthKm);
    const sel = i === current;
    g.setLineDash([3, 4]); g.strokeStyle = sel ? 'rgba(255,196,106,.8)' : 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); g.setLineDash([]);
    g.fillStyle = sel ? '#ffc46a' : '#e6f2f5'; g.font = (sel ? '700' : '600') + ' 11px system-ui';
    const label = z.short.toUpperCase() + ' · ' + dec(z.depthKm, 1) + ' km';
    g.fillText(label, Math.min(w - g.measureText(label).width - 6, x + 14), y - 5);
    if (info.left) { g.fillStyle = 'rgba(230,242,245,.65)'; g.font = '500 10px system-ui'; g.fillText((info.required?.includes(i) ? '★ ' : '') + info.left[i] + tr(' a descobrir · ', ' to discover · ') + thousands(pressureBar(z.depthKm)) + ' bar', Math.min(w - 150, x + 14), y + 12); }
    hits.push({ i, y });
  });
  // submarino
  const sx = w * xs[current], sy = Y(zones[current].depthKm);
  g.fillStyle = '#ffc46a'; g.beginPath(); g.ellipse(sx, sy, 11, 5, 0, 0, 7); g.fill(); g.fillRect(sx - 2, sy - 9, 5, 5);
  return (cx, cy) => { let best = null, bd = 30; for (const p of hits) { const d = Math.abs(p.y - cy); if (d < bd) { bd = d; best = p.i; } } return best; };
}
