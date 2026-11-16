// Página inicial: globo de Europa com filtros, simulador de projetos prontos e quiz.
import { loadDB } from './engine.js';
import { PRESETS, simulate, interpret, REASON_TEXT } from './sim.js';
import { lineChart, barChart, stackBar } from './charts.js';
import { Stage, GlobeScene } from './world3d.js';

const $ = s => document.querySelector(s);
const FILTERS = {
  real: 'Cor natural, aproximada: gelo claro riscado por <b>lineae</b>, fraturas avermelhadas onde sal e outros compostos do oceano podem ter chegado à superfície.',
  realce: 'Cor realçada, como os mosaicos da Galileo e da Juno: o contraste exagerado mostra o gelo mais puro em azul e as fraturas e o terreno caótico em marrom-avermelhado.',
  termico: 'Ilustrativo: como seria procurar pontos mais quentes com a câmera térmica <b>E-THEMIS</b> da Europa Clipper. Regiões quentes podem indicar água perto da superfície.',
  corte: 'Por dentro (modelo da NASA): casca de gelo de 15 a 25 km, oceano salgado de 60 a 150 km, manto de rocha e núcleo de ferro. Arraste para girar.',
};
const REASON_COLOR = { win: '#7fff9a', o2: '#7fe0ff', hull: '#c9d4dc', energy: '#ffc46a', morale: '#ff9ac8', time: '#8a7aa8' };

const db = await loadDB('data/');

// ------------------------------------------------------------------ globo
let globe = null;
try {
  const stage = new Stage($('#globo'));
  globe = new GlobeScene(db.missions);
  const baseUpdate = globe.update.bind(globe);
  globe.update = (dt, d) => {
    const wide = stage.aspect > 1.05;
    globe.root.position.x += ((wide ? 2.3 : 0) - globe.root.position.x) * Math.min(1, dt * 4);
    globe.root.position.y += ((wide ? 0 : -1.15) - globe.root.position.y) * Math.min(1, dt * 4);
    globe.camera.position.z = wide ? 8.5 : 11;
    baseUpdate(dt, d);
  };
  stage.show(globe);
} catch (e) { console.warn('WebGL indisponível', e); $('#globo').style.background = 'radial-gradient(circle at 70% 45%, #d8cfc0 0 22%, #04090f 23%)'; }

const setFilter = mode => {
  document.querySelectorAll('.chips .chip').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  $('#filtro-txt').innerHTML = FILTERS[mode];
  globe?.setMode(mode);
};
document.querySelectorAll('.chips .chip').forEach(b => b.addEventListener('click', () => setFilter(b.dataset.mode)));
setFilter('real');

// locais das missões: clicar gira o globo até o lugar
const sites = $('#sites');
let card = null;
for (const m of db.missions) {
  const b = document.createElement('button');
  b.innerHTML = `<i style="background:${m.color}"></i>${m.site}`;
  b.addEventListener('click', () => {
    const on = !b.classList.contains('on');
    sites.querySelectorAll('button').forEach(x => x.classList.remove('on'));
    card?.remove(); card = null;
    if (!on) { globe?.focus(null); return; }
    b.classList.add('on'); if (globe?.mode === 'corte') setFilter('real');
    globe?.focus(m);
    card = document.createElement('div'); card.className = 'site-card';
    card.innerHTML = `<span class="tag">${m.difficulty}</span> <b>${m.name}</b><br>${m.question}<br><span class="muted">${m.fact}</span>`;
    sites.after(card);
  });
  sites.appendChild(b);
}

// ------------------------------------------------------------------ simulador
const results = {};
const presetsEl = $('#presets');
for (const p of PRESETS) {
  const L = db.L[p.rocket], Tj = db.L[p.trajectory], M = db.M[p.mission];
  const b = document.createElement('button');
  b.className = 'preset'; b.dataset.id = p.id;
  b.innerHTML = `<b>${p.name}</b><span class="spec">${M.site} · ${L.name}<br>${Tj.name.replace('Estilingue ', '')}</span><p>${p.pitch}</p><span class="pct" data-pct>simular ▸<i><s style="width:0"></s></i></span>`;
  b.addEventListener('click', () => show(p.id, true));
  presetsEl.appendChild(b);
}
function runPreset(p) {
  if (!results[p.id]) results[p.id] = simulate(db, p, 200, 1);
  const r = results[p.id];
  const el = presetsEl.querySelector(`[data-id="${p.id}"] [data-pct]`);
  el.innerHTML = `${Math.round(r.winRate * 100)}% de sucesso<i><s style="width:${r.winRate * 100}%;background:${r.winRate >= 0.7 ? 'var(--green)' : r.winRate >= 0.4 ? 'var(--amber)' : 'var(--red)'}"></s></i>`;
  return r;
}
function show(id, scroll) {
  const p = PRESETS.find(x => x.id === id), r = runPreset(p);
  presetsEl.querySelectorAll('.preset').forEach(b => b.classList.toggle('on', b.dataset.id === id));
  $('#result').hidden = false;
  $('#r-win').textContent = Math.round(r.winRate * 100) + '%';
  $('#r-win').style.color = r.winRate >= 0.7 ? 'var(--green)' : r.winRate >= 0.4 ? 'var(--amber)' : 'var(--red)';
  $('#r-cyc').textContent = r.avgCycles.toFixed(1).replace('.', ',');
  $('#r-score').textContent = Math.round(r.avgScore);
  $('#r-scans').textContent = r.avgScans.toFixed(1).replace('.', ',');
  $('#r-play').href = 'jogo.html?projeto=' + p.id;
  const xs = r.avg.map(a => a.cycle === 1 ? 'início' : a.cycle - 1);
  const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  lineChart($('#c-lines'), xs, [
    { label: 'O₂', color: cssv('--o2'), values: r.avg.map(a => a.o2) },
    { label: 'Energia', color: cssv('--energy'), values: r.avg.map(a => Math.min(100, a.energy)) },
    { label: 'Casco', color: cssv('--hull'), values: r.avg.map(a => a.hull) },
    { label: 'Moral', color: cssv('--morale'), values: r.avg.map(a => a.morale) },
  ], { height: 230, danger: 25 });
  const order = ['win', 'time', 'o2', 'hull', 'energy', 'morale'];
  const parts = order.filter(k => r.reasons[k]).map(k => ({ label: REASON_TEXT[k], value: r.reasons[k], color: REASON_COLOR[k] }));
  stackBar($('#c-stack'), parts);
  $('#stack-legend').innerHTML = parts.map(p2 => `<span><i style="background:${p2.color}"></i>${p2.label}: ${Math.round(p2.value / r.runs * 100)}%</span>`).join('');
  // comparação com todos os projetos (roda os que faltam)
  for (const q of PRESETS) runPreset(q);
  barChart($('#c-bars'), PRESETS.map(q => ({ label: q.name, value: results[q.id].winRate, max: 1, text: Math.round(results[q.id].winRate * 100) + '%', active: q.id === id,
    color: q.id === id ? 'var(--amber)' : 'rgba(127,224,255,.45)' })).map(i => Object.assign(i, { color: i.color.startsWith('var') ? cssv(i.color.slice(4, -1)) : i.color })), { max: 1 });
  $('#interp').innerHTML = interpret(r, p, db).map(x => `<div><span class="tag ${x.tone}">${x.tone}</span>${x.text}</div>`).join('');
  if (scroll) $('#result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
// roda o primeiro projeto quando o simulador aparecer na tela
const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { show('clipper', false); io.disconnect(); } }, { rootMargin: '200px' });
io.observe($('#simulador'));
let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { const on = presetsEl.querySelector('.preset.on'); if (on) show(on.dataset.id, false); }, 200); });

// ------------------------------------------------------------------ quiz
const QUIZ = [
  { q: 'A Europa Clipper ia voar num SLS, direto para Júpiter. Por que a NASA trocou por um Falcon Heavy?', o: ['O SLS não aguentava o peso da sonda', 'Custo: o Falcon Heavy era bem mais barato, mesmo com uma viagem mais longa', 'O Falcon Heavy é mais rápido que o SLS'], a: 1, why: 'A troca foi principalmente por custo. Em troca, a Clipper faz um “estilingue” em Marte (2025) e na Terra (2026) e só chega a Júpiter em 2030. No jogo, essa é a trajetória MEGA.' },
  { q: 'Por que a Europa Clipper vai sobrevoar Europa 49 vezes em vez de ficar em órbita dela?', o: ['Para passar pouco tempo dentro do cinturão de radiação de Júpiter', 'Porque Europa não tem gravidade suficiente', 'Para economizar combustível de pouso'], a: 0, why: 'A superfície de Europa recebe cerca de 5,4 sievert de radiação por dia. Passar rápido e se afastar protege os eletrônicos, que ainda ficam num cofre de alumínio e zinco.' },
  { q: 'Qual medição da sonda Galileo foi a melhor pista de que existe um oceano salgado sob o gelo?', o: ['Fotos de peixes na superfície', 'Um campo magnético induzido, que muda junto com o de Júpiter', 'A temperatura de 30 °C no equador'], a: 1, why: 'Água salgada conduz eletricidade. O magnetômetro da Galileo mediu um campo induzido em Europa, e a explicação mais simples é uma camada de água salgada embaixo do gelo.' },
  { q: 'Em 2003, a NASA jogou a sonda Galileo dentro de Júpiter de propósito. Por quê?', o: ['Para medir a atmosfera de Júpiter até o fim', 'Para ela nunca cair em Europa e contaminar um possível oceano com vida', 'Porque o combustível ia acabar e não havia outra opção'], a: 1, why: 'Isso se chama proteção planetária: não levar micróbios da Terra para um lugar que pode ter vida. No jogo, algumas escolhas dos cenários giram em torno dessa mesma ideia.' },
];
let qi = 0, score = 0;
function renderQuiz() {
  const box = $('#quiz-box');
  if (qi >= QUIZ.length) {
    box.innerHTML = `<p class="kicker">Resultado</p><p class="quiz-q">${score} de ${QUIZ.length} certas. ${score === QUIZ.length ? 'Pronta(o) para projetar a próxima missão.' : 'As respostas estão todas no jogo, em cada scan e em cada conversa com a equipe.'}</p><div class="cta"><a class="btn primary" href="jogo.html">Jogar</a><button class="btn ghost" id="qz-again">Refazer</button></div>`;
    $('#qz-again').onclick = () => { qi = 0; score = 0; renderQuiz(); };
    return;
  }
  const Q = QUIZ[qi];
  box.innerHTML = `<p class="kicker">Pergunta ${qi + 1} de ${QUIZ.length}</p><p class="quiz-q">${Q.q}</p><div class="quiz-opts">${Q.o.map((o, i) => `<button data-i="${i}">${o}</button>`).join('')}</div><p class="quiz-why" hidden></p><div class="quiz-nav"><span class="muted">${score} certa${score === 1 ? '' : 's'}</span><button class="btn small" id="qz-next" hidden>Próxima ▸</button></div>`;
  box.querySelectorAll('.quiz-opts button').forEach(b => b.addEventListener('click', () => {
    if (box.dataset.done === '1') return; box.dataset.done = '1';
    const i = +b.dataset.i; if (i === Q.a) score++;
    box.querySelectorAll('.quiz-opts button').forEach(x => { const k = +x.dataset.i; if (k === Q.a) x.classList.add('ok'); else if (k === i) x.classList.add('no'); });
    const w = box.querySelector('.quiz-why'); w.hidden = false; w.innerHTML = (i === Q.a ? '<b>Isso!</b> ' : '<b>Quase.</b> ') + Q.why;
    $('#qz-next').hidden = false;
  }));
  box.dataset.done = '0';
  $('#qz-next').onclick = () => { qi++; renderQuiz(); };
}
renderQuiz();
