// Gráficos simples em Canvas 2D (sem biblioteca): linhas por ciclo e barras horizontais.
const css = (name, fb) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb;

function prep(canvas, h) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || canvas.parentElement.clientWidth || 320;
  canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.height = h + 'px';
  const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w, h };
}

/** series: [{label, color, values: [..]}], xs: rótulos do eixo x. Escala fixa 0–100. */
export function lineChart(canvas, xs, series, opts = {}) {
  const { g, w, h } = prep(canvas, opts.height || 200);
  const ink = css('--muted', '#8aa'), grid = css('--grid', 'rgba(255,255,255,.08)');
  const L = 34, R = 10, Tp = 10, B = 26, max = opts.max || 100;
  const X = i => L + (xs.length <= 1 ? 0 : i / (xs.length - 1)) * (w - L - R), Y = v => Tp + (1 - v / max) * (h - Tp - B);
  g.font = '11px system-ui, sans-serif'; g.fillStyle = ink; g.strokeStyle = grid; g.lineWidth = 1;
  for (let v = 0; v <= max; v += max / 4) { g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(w - R, Y(v)); g.stroke(); g.fillText(String(Math.round(v)), 4, Y(v) + 4); }
  if (opts.danger) { g.fillStyle = 'rgba(255,90,70,.13)'; g.fillRect(L, Y(opts.danger), w - L - R, Y(0) - Y(opts.danger)); g.fillStyle = ink; }
  const step = Math.max(1, Math.ceil(xs.length / 8));
  xs.forEach((x, i) => { if (i % step === 0 || i === xs.length - 1) g.fillText(String(x), X(i) - 4, h - 8); });
  if (opts.xLabel) { g.textAlign = 'right'; g.fillText(opts.xLabel, w - R, h - 8); g.textAlign = 'left'; }
  for (const s of series) {
    g.strokeStyle = s.color; g.lineWidth = 2.2; g.lineJoin = 'round'; g.beginPath();
    s.values.forEach((v, i) => { if (i === 0) g.moveTo(X(i), Y(v)); else g.lineTo(X(i), Y(v)); }); g.stroke();
    const li = s.values.length - 1; g.fillStyle = s.color; g.beginPath(); g.arc(X(li), Y(s.values[li]), 3.2, 0, 7); g.fill();
  }
}

/** items: [{label, value (0..1 ou número), color, text}] */
export function barChart(canvas, items, opts = {}) {
  const rowH = opts.rowH || 30;
  const { g, w, h } = prep(canvas, items.length * rowH + 6);
  const ink = css('--ink', '#e6f2f5'), muted = css('--muted', '#8aa'), track = css('--grid', 'rgba(255,255,255,.08)');
  const LW = Math.min(170, w * 0.42), max = opts.max || Math.max(...items.map(i => i.value), 1);
  g.font = '12px system-ui, sans-serif';
  items.forEach((it, i) => {
    const y = 4 + i * rowH;
    g.fillStyle = it.active ? ink : muted; g.fillText(it.label, 0, y + rowH / 2 + 2, LW - 8);
    g.fillStyle = track; g.fillRect(LW, y + 6, w - LW - 48, rowH - 12);
    g.fillStyle = it.color; g.fillRect(LW, y + 6, (w - LW - 48) * Math.max(0, it.value) / max, rowH - 12);
    g.fillStyle = ink; g.fillText(it.text ?? String(it.value), w - 42, y + rowH / 2 + 2);
  });
}

/** Barra empilhada com as causas de fim de missão. parts: [{label, value, color}] */
export function stackBar(canvas, parts, opts = {}) {
  const { g, w } = prep(canvas, opts.height || 34);
  const total = parts.reduce((a, p) => a + p.value, 0) || 1; let x = 0;
  for (const p of parts) { const pw = p.value / total * w; g.fillStyle = p.color; g.fillRect(x, 4, Math.max(0, pw - 2), 26); x += pw; }
}
