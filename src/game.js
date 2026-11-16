// Abismo de Europa · controlador do jogo (interface 2D em HTML/CSS + cenas 3D em Three.js + regras em engine.js)
import { loadDB, Game, ACTIONS, CONFIG, dec, pad, thousands, pressureBar } from './engine.js';
import { PRESETS, REASON_TEXT } from './sim.js';
import { Stage, TitleScene, GlobeScene, BaseScene, OceanScene, EvaScene } from './world3d.js';
import { Audio, sfx } from './audio.js';
import { drawSurface, drawSection } from './map2d.js';
import { lineChart } from './charts.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wait = ms => new Promise(r => setTimeout(r, ms));
const TOUCH = matchMedia('(pointer: coarse)').matches;
if (TOUCH) document.body.classList.add('touch');

const db = await loadDB('data/');
const game = new Game(db);
const G = () => game.S;

// ------------------------------------------------------------------ 3D
let stage, scenes = {};
try {
  stage = new Stage($('#view'));
  scenes = { title: new TitleScene(), globe: new GlobeScene(db.missions), base: new BaseScene(db), ocean: new OceanScene(db), eva: new EvaScene(db) };
} catch (e) {
  console.warn('WebGL indisponível', e);
  document.body.style.background = 'radial-gradient(circle at 70% 40%, #1b3a4a, #02060a)';
  const fake = { setMode() {}, focus() {}, setBuilt() {}, setSub() {}, setView() {}, setZone() {}, spawnContact() {}, clearContact() {}, move() {}, scan() {}, bump() {}, begin() {}, step: () => [], update() {} };
  scenes = { title: fake, globe: fake, base: fake, ocean: Object.assign({}, fake), eva: Object.assign({}, fake) };
  stage = { show() {} };
}
const view = name => stage.show(scenes[name]);

// ------------------------------------------------------------------ estado da interface
let phase = 'title', busy = false, dlgOpen = false, musicLock = null, lockTimer = null, lastReport = null;
const portrait = id => id === 'me' ? 'img/crew/protagonista_' + G().protagonist + '.webp' : 'img/crew/' + id + '.webp';

function wantMusic() {
  if (phase === 'title') return 'title';
  if (phase === 'end') return G().win ? 'calm' : 'tension';
  if (dlgOpen || !$('#sheet').hidden) return 'calm';
  if (phase === 'design' || phase === 'plan') return 'planning';
  if (phase === 'eva') return 'common';
  if (musicLock) return musicLock;
  const S = G(), crit = S.o2 <= 25 || S.energy <= 20 || S.hull <= 25;
  return S.zone === 3 || crit ? 'tension' : 'common';
}
const updateMusic = () => Audio.set(wantMusic(), 2.5);
function lockMusic(name, ms) { musicLock = name; clearTimeout(lockTimer); updateMusic(); lockTimer = setTimeout(() => { musicLock = null; updateMusic(); }, ms); }

function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  $('#hud').hidden = !(id === 's-plan' || id === 's-dive');
}
const fadeEl = $('#fade');
async function fadeOut(text = '') { $('#fade-txt').textContent = text; fadeEl.classList.add('on'); await wait(520); }
async function fadeIn() { fadeEl.classList.remove('on'); await wait(300); }
let toastT;
function toast(html, ms = 3500) { const t = $('#toast'); t.innerHTML = html; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms); }

// ------------------------------------------------------------------ log do mergulho
let holdLogs = false, held = [];
game.hooks.log = (text, kind) => { if (holdLogs) held.push([text, kind]); else pushLog(text, kind); };
game.hooks.sfx = id => sfx.play(id);
function pushLog(text, kind = 'normal') {
  const p = document.createElement('p'); p.className = kind; p.textContent = text;
  const log = $('#log'); log.appendChild(p); while (log.children.length > 14) log.firstChild.remove();
}
function flushLogs() { holdLogs = false; for (const [t, k] of held) pushLog(t, k); held = []; }

// ------------------------------------------------------------------ HUD
function hud() {
  const S = G(), M = game.mods;
  const items = [
    ['O₂', Math.round(S.o2) + '%', S.o2, 'var(--o2)', S.o2 <= 25],
    ['Energia', Math.round(S.energy), S.energy / M.maxEnergy * 100, 'var(--energy)', S.energy <= 20],
    ['Casco', Math.round(S.hull) + '%', S.hull, 'var(--hull)', S.hull <= 25],
    ['Moral', Math.round(S.morale) + '%', S.morale, 'var(--morale)', S.morale <= 25],
    ['Verba', S.budget, Math.min(100, S.budget), 'var(--budget)', false],
    ['Dados', S.sciencePool, Math.min(100, S.sciencePool), 'var(--science)', false],
  ];
  $('#res').innerHTML = items.map(([n, v, pct, c, low]) => `<div class="r${low ? ' low' : ''}"><span>${n}</span><b>${v}</b><i><s style="width:${Math.max(0, Math.min(100, pct))}%;background:${c}"></s></i></div>`).join('');
  $('#hud-cycle').textContent = 'CICLO ' + pad(Math.min(S.cycle, CONFIG.maxCycles)) + '/' + CONFIG.maxCycles + (phase === 'dive' ? ' · TURNOS ' + S.turns : '');
  $('#b-mute').textContent = Audio.muted ? '🔇' : '🔊';
}

// ------------------------------------------------------------------ diálogo com retratos
const dlg = { resolve: null, typing: null, full: '' };
function who(id) {
  if (id === 'me') return { name: game.protagonistName(), role: 'você · cadete da missão', color: '#5fe0d0', img: portrait('me') };
  const c = db.C[id];
  return { name: c.name, role: c.role + ' · ' + c.origin, color: c.color, img: portrait(id) };
}
function showLine(line) {
  return new Promise(resolve => {
    const w = who(line.who);
    $('#dlg').hidden = false; dlgOpen = true; updateMusic();
    const box = $('.dlg-box'); box.style.setProperty('--c', w.color);
    $('#dlg-img').src = w.img; $('#dlg-img').alt = w.name;
    $('#dlg-name').textContent = w.name; $('#dlg-role').textContent = w.role;
    $('#dlg-note').textContent = line.note || '';
    const text = game.gender(line.text); dlg.full = text;
    const tx = $('#dlg-text'); tx.textContent = ''; let i = 0;
    clearInterval(dlg.typing);
    dlg.typing = setInterval(() => { i += 2; tx.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(dlg.typing); dlg.typing = null; } }, 16);
    const ch = $('#dlg-choices'); ch.innerHTML = '';
    const next = $('#dlg-next');
    const done = v => { clearInterval(dlg.typing); dlg.resolve = null; resolve(v); };
    if (line.choices) {
      next.hidden = true;
      line.choices.forEach((c, k) => {
        const b = document.createElement('button'); b.disabled = !!c.disabled;
        b.innerHTML = `${k + 1}. ${esc(c.label)}${c.sub ? `<small>${esc(c.sub)}</small>` : ''}`;
        b.onclick = () => { sfx.Click(); done(c.value ?? k); };
        ch.appendChild(b);
      });
      dlg.resolve = null;
    } else {
      next.hidden = false;
      dlg.resolve = () => done();
      next.onclick = () => { if (dlg.typing) { clearInterval(dlg.typing); dlg.typing = null; tx.textContent = text; return; } sfx.Click(); done(); };
    }
  });
}
async function say(lines) {
  let r;
  for (const l of lines) { r = await showLine(l); if (l.choices) break; }
  $('#dlg').hidden = true; dlgOpen = false; updateMusic();
  return r;
}
$('#dlg-text').addEventListener('click', () => { if (dlg.typing) { clearInterval(dlg.typing); dlg.typing = null; $('#dlg-text').textContent = dlg.full; } });

// ------------------------------------------------------------------ folhas (diário, mapa, ajuda)
function sheet(html, after) { $('#sheet-body').innerHTML = html; $('#sheet').hidden = false; updateMusic(); after?.(); }
function closeSheet() { $('#sheet').hidden = true; updateMusic(); }
$('#sheet-x').onclick = closeSheet;
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });

const HOW = `<h2>Como jogar</h2>
<p><b>Objetivo:</b> responder à pergunta científica da missão. Cada missão pede um número de descobertas em zonas específicas do oceano. Depois volte à Interface gelo-oceano e acople à base antes do fim do ciclo ${CONFIG.maxCycles}.</p>
<h3>1. Projeto</h3><p>Escolha quem você é, o destino no mapa, o foguete, a trajetória e a equipe. Foguete e equipe custam verba; tudo pesa. Se a verba ou a carga não fecharem, a missão não sai do chão.</p>
<h3>2. Planejamento (entre os ciclos)</h3><p>Construa módulos na base, instale upgrades no submarino (só com ele na Interface), pesquise instrumentos reais da Europa Clipper pagando com dados e divida 6 células de energia entre suporte vital, propulsão e instrumentos. Converse com a equipe: cada conversa por ciclo levanta a moral.</p>
<h3>3. Mergulho</h3><p>Cada ciclo tem ${CONFIG.turnsPerCycle} turnos. <b>Navegar</b> procura contatos, <b>Escanear</b> registra uma descoberta com um dado real da NASA, <b>Descer/Subir</b> muda de zona, <b>Recarregar</b> só no campo hidrotermal, <b>EVA</b> precisa da eclusa. No fim do ciclo o submarino gasta O₂ e energia, a pressão castiga o casco e a NASA manda verba conforme os dados enviados.</p>
<h3>Imprevistos</h3><p>Os cenários são sorteados por uma <b>floresta aleatória</b>: 9 árvores de decisão olham o estado da missão (zona, ciclo, moral, casco, verba, energia, descobertas e missão) e votam. A missão escolhida puxa os votos para os temas dela. Algumas escolhas abrem um segundo cenário (ramo da árvore).</p>
<h3>Teclado</h3><p>1–0, E e A: ações · Enter: encerrar ciclo · D: diário · M: mapa · S: som. Na EVA: WASD/setas, Espaço e C, Shift, E.</p>`;

function diaryHTML() {
  const S = G(), m = game.mission, zd = game.zonesDone();
  let h = `<h2>Diário da missão</h2><p class="kicker">${esc(m.name)} · ${esc(m.site)}</p><p><b>Pergunta:</b> ${esc(m.question)}</p><p class="goal">${esc(game.goalText())}</p>`;
  h += `<div class="zonechk">${m.requiredZones.map(z => `<span class="${zd.has(z) ? 'ok' : ''}">${zd.has(z) ? '✓' : '○'} ${db.zones[z].name}</span>`).join('')}</div>`;
  h += `<h3>Descobertas (${S.scans.length})</h3>`;
  if (!S.scans.length) h += '<p class="muted">Nenhuma ainda. Navegue e escaneie.</p>';
  for (const s of S.scans) { const t = db.T[s.id]; h += `<p><b>${t.code} · ${esc(t.name)}</b> <span class="muted">${db.zones[t.zone].name} · ciclo ${pad(s.cycle)} · +${s.science} dados</span><br>${esc(t.desc)}<br><span style="color:#c4eefc">Dado real: ${esc(t.fact)}</span> <span class="muted">[${esc(t.src)}]</span></p>`; }
  const left = [0, 1, 2, 3].map(z => game.remainingInZone(z));
  h += `<p class="muted">Ainda sem registro: ${left.map((n, z) => db.zones[z].short + ' ' + n).join(' · ')}</p>`;
  h += `<h3>Decisões</h3><ul>${S.decisions.map(d => `<li>${esc(d)}</li>`).join('')}${S.purchases.map(d => `<li class="muted">${esc(d)}</li>`).join('')}</ul>`;
  const res = db.research.filter(r => S.research.has(r.id));
  if (res.length) h += `<h3>Instrumentos pesquisados</h3>${res.map(r => `<p><b>${r.instrument}</b>: ${esc(r.fact)} <span class="muted">[${esc(r.src)}]</span></p>`).join('')}`;
  h += `<h3>Ciclos</h3>`;
  if (!S.diary.length) h += '<p class="muted">Nenhum ciclo encerrado ainda.</p>';
  for (const d of S.diary.slice().reverse()) h += `<p><b>Ciclo ${pad(d.cycle)}</b> · ${esc(d.zone)} · O₂ ${d.o2}% · energia ${d.energy} · casco ${d.hull}% · moral ${d.morale}% · +${d.budget} verba${d.scans.length ? '<br>Descobertas: ' + esc(d.scans.join(', ')) : ''}${d.event ? '<br><i class="muted">' + esc(d.event) + '</i>' : ''}</p>`;
  return h;
}
function openMap() {
  const S = G(), m = game.mission;
  sheet(`<h2>Mapa · corte de Europa</h2><p class="muted">Toque numa zona para ver os detalhes. ★ = zona exigida pela missão.</p><canvas id="section"></canvas><div id="zinfo" class="mcard"></div>`, () => {
    const info = { left: [0, 1, 2, 3].map(z => game.remainingInZone(z)), required: m.requiredZones };
    const c = $('#section');
    const zi = z => {
      const Z = db.zones[z];
      $('#zinfo').innerHTML = `<h3>${esc(Z.name)}</h3>${dec(Z.depthKm, 1)} km abaixo da superfície · ${thousands(pressureBar(Z.depthKm))} bar · ${Z.temp}<br>${esc(Z.arrival)}<br><span class="muted">${info.left[z]} descoberta(s) ainda sem registro${m.requiredZones.includes(z) ? ' · exigida pela missão' : ''}${Z.hullLevel ? ' · precisa de casco de titânio Nv' + Z.hullLevel : ''}${m.focusZones.includes(z) ? ' · foco da pergunta: +25% de dados' : ''}</span>`;
    };
    const pickZ = drawSection(c, db.zones, S.zone, info);
    c.onclick = e => { const r = c.getBoundingClientRect(); const z = pickZ(e.clientX - r.left, e.clientY - r.top); if (z != null) zi(z); };
    zi(S.zone);
  });
}
$('#b-map').onclick = openMap;
$('#b-diary').onclick = () => sheet(diaryHTML());
$('#b-mute').onclick = () => { Audio.unlock(); Audio.toggleMute(); hud(); };
$('#b-how').onclick = () => { Audio.unlock(); sheet(HOW); };

// ------------------------------------------------------------------ abertura
function toTitle() {
  phase = 'title'; showScreen('s-title'); view('title'); updateMusic(); Audio.setAmbient(false);
}
$('#b-start').onclick = () => { Audio.unlock(); sfx.Click(); startDesign(); };

// ------------------------------------------------------------------ projeto da missão
const STEPS = ['Cadete', 'Destino', 'Lançamento', 'Equipe'];
let step = 0, surfLoop = 0;
function startDesign(presetId) {
  game.reset();
  phase = 'design'; showScreen('s-design'); view('globe'); scenes.globe.setMode('real'); updateMusic();
  step = 0;
  const p = PRESETS.find(x => x.id === presetId);
  if (p) {
    game.selectMission(p.mission); game.selectLaunch(p.rocket); game.selectLaunch(p.trajectory);
    for (const id of p.crew) if (!G().crew.has(id)) game.toggleCrew(id);
    step = 0; toast(`Projeto pronto carregado: <b>${esc(p.name)}</b>. Escolha quem você é e confira cada etapa.`, 5000);
  }
  renderDesign();
}
function meters() {
  const b = game.designBudget(), b0 = game.mission.budget, mass = game.massUsed(), cap = game.capacity();
  const why = game.designProblem();
  $('#d-meters').innerHTML = `
    <div class="meter ${b < 0 ? 'bad' : ''}">Verba para a base <b>${b}</b> de ${b0}<i><s style="width:${Math.max(0, b / b0 * 100)}%;background:var(--budget)"></s></i></div>
    <div class="meter ${mass > cap ? 'bad' : ''}">Carga <b>${dec(mass, 1)}</b> de ${dec(cap, 1)} t<i><s style="width:${Math.min(100, mass / cap * 100)}%;background:${mass > cap ? 'var(--red)' : 'var(--cyan)'}"></s></i></div>
    ${why && step === 3 ? `<p class="d-why">⚠ ${esc(why)}</p>` : ''}`;
  const nx = $('#d-next');
  nx.textContent = step === 3 ? 'Lançar missão 🚀' : 'Próximo ▸';
  nx.disabled = step === 3 && !!why;
  $('#d-prev').style.visibility = step === 0 ? 'hidden' : 'visible';
}
function renderDesign() {
  cancelAnimationFrame(surfLoop);
  $('#steps').innerHTML = STEPS.map((s, i) => `<button class="${i === step ? 'on' : i < step ? 'done' : ''}" data-i="${i}">${i + 1}. ${s}</button>`).join('');
  $('#steps').querySelectorAll('button').forEach(b => b.onclick = () => { step = +b.dataset.i; renderDesign(); });
  const body = $('#d-body'), S = G();
  if (step === 0) {
    body.innerHTML = `<h2>Quem é você?</h2><p class="intro">Você é cadete na sua primeira missão. A escolha muda só o retrato e o astronauta da EVA; as regras são as mesmas.</p>
      <div class="who">${[['menina', 'Luísa Galvão', '“Galvão” ecoa Galileu, que descobriu Europa em 1610.'], ['menino', 'Téo Junqueira', '“Junqueira” ecoa Juno, a sonda que passou por Europa em 2022.']].map(([k, n, d]) =>
        `<button data-p="${k}" class="${S.protagonist === k ? 'on' : ''}"><img src="img/crew/protagonista_${k}.webp" alt="${n}"><b>Cadete ${n}</b><br><small class="muted">${d}</small></button>`).join('')}</div>`;
    body.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { game.setProtagonist(b.dataset.p); sfx.Click(); renderDesign(); });
    scenes.globe.focus(null);
  }
  if (step === 1) {
    body.innerHTML = `<h2>Para onde?</h2><p class="intro">Toque num local do mapa. Cada missão tem uma pergunta científica, uma verba e exige descobertas em zonas diferentes do oceano.</p>
      <div class="mtabs">${db.missions.map(m => `<button class="chip ${S.missionId === m.id ? 'on' : ''}" data-m="${m.id}">${esc(m.site)}</button>`).join('')}</div>
      <div class="mapwrap"><canvas id="surf"></canvas></div><div class="mcard" id="mcard"></div>`;
    const c = $('#surf');
    const pick = id => { game.selectMission(id); sfx.Ping(); renderDesign(); };
    body.querySelectorAll('[data-m]').forEach(b => b.onclick = () => pick(b.dataset.m));
    let hit = null;
    const loop = t => { hit = drawSurface(c, db.missions, S.missionId, t / 1000); surfLoop = requestAnimationFrame(loop); };
    surfLoop = requestAnimationFrame(loop);
    c.onclick = e => { const r = c.getBoundingClientRect(); const m = hit?.(e.clientX - r.left, e.clientY - r.top); if (m) pick(m.id); };
    const m = game.mission;
    $('#mcard').style.setProperty('--c', m.color);
    $('#mcard').innerHTML = `<span class="tag">${m.difficulty}</span> <span class="tag troca">verba ${m.budget}</span> <span class="tag">${m.scans} descobertas</span>
      <h3>${esc(m.name)} · ${esc(m.site)}</h3><p style="margin:0 0 6px">${esc(m.desc)}</p><p class="q" style="margin:0 0 6px">Pergunta: ${esc(m.question)}</p>
      <p style="margin:0 0 6px">Zonas exigidas: <b>${m.requiredZones.map(z => db.zones[z].name).join(', ')}</b>${m.requiredZones.includes(3) ? ' <span class="muted">(a Fenda abissal exige casco de titânio)</span>' : ''}</p>
      <p class="f" style="margin:0">Dado real: ${esc(m.fact)} [${esc(m.src)}]</p>`;
    scenes.globe.focus(m);
  }
  if (step === 2) {
    const card = l => {
      const on = l.trajectory ? S.trajectoryId === l.id : S.launchId === l.id;
      const nums = l.trajectory ? `${dec(l.years, 1)} anos · carga ×${dec(l.capacity, 2)}${l.morale ? ' · moral ' + (l.morale > 0 ? '+' : '') + l.morale : ''}${l.hull ? ' · casco ' + l.hull + '%' : ''}` : `−${l.cost} verba · ${dec(l.capacity, 0)} t de carga`;
      return `<button class="opt ${on ? 'on' : ''}" data-l="${l.id}"><b>${esc(l.name)}</b><span class="nums">${nums}</span><span>${esc(l.desc)}</span><span class="fact">${esc(l.fact)}</span></button>`;
    };
    body.innerHTML = `<h2>Foguete e trajetória</h2><p class="intro">Foguete maior leva mais carga, mas custa verba. Estilingues gravitacionais em planetas dão carga extra de graça, em troca de anos de viagem.</p>
      <p class="kicker">Foguete</p><div class="opts">${db.launches.filter(l => !l.trajectory).map(card).join('')}</div>
      <p class="kicker">Trajetória</p><div class="opts">${db.launches.filter(l => l.trajectory).map(card).join('')}</div>`;
    body.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { game.selectLaunch(b.dataset.l); sfx.Click(); renderDesign(); });
  }
  if (step === 3) {
    body.innerHTML = `<h2>Equipe</h2><p class="intro">O comandante e a Lúcia, no controle da missão, estão sempre na equipe. Cada pessoa a mais custa verba (salário) e 0,6 t de carga, e traz uma habilidade.</p>
      <div class="crew">${db.crew.filter(c => !c.atBase || c.mandatory).map(c => {
        const on = S.crew.has(c.id);
        return `<button class="cm ${on ? 'on' : ''} ${c.mandatory ? 'fixed' : ''}" data-c="${c.id}" ${c.mandatory ? 'aria-disabled="true"' : ''}>${c.mandatory ? '<span class="badge">SEMPRE</span>' : ''}<img src="${portrait(c.id)}" alt=""><b>${esc(c.name)}</b><span>${esc(c.role)} · ${esc(c.origin)}</span><span class="perk">${esc(c.perkText)}</span>${c.mandatory ? '' : `<span class="cost">−${c.salary} verba · 0,6 t</span>`}</button>`;
      }).join('')}</div>`;
    body.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
      const c = db.C[b.dataset.c];
      if (c.mandatory) { toast(esc(c.name) + ': ' + esc(c.bio), 4000); return; }
      game.toggleCrew(c.id); sfx.Click(); renderDesign();
    });
  }
  meters();
}
$('#d-prev').onclick = () => { if (step > 0) { step--; renderDesign(); } };
$('#d-next').onclick = () => { if (step < 3) { step++; renderDesign(); } else launch(); };

async function launch() {
  if (game.designProblem()) return;
  cancelAnimationFrame(surfLoop);
  game.confirmDesign();
  const r = game.rocket, t = game.trajectory, m = game.mission;
  sfx.Build();
  await fadeOut('T−0 · ' + r.name.toUpperCase());
  sfx.Motor(3);
  await wait(1400);
  $('#fade-txt').textContent = t.name.toUpperCase() + ' · ' + dec(t.years, 1).toUpperCase() + ' ANOS';
  await wait(1600);
  $('#fade-txt').textContent = 'CHEGADA A EUROPA · ' + m.site.toUpperCase();
  await wait(1400);
  scenes.base.setBuilt(G().modules); scenes.base.setSub(G().upgrades); scenes.base.setView('base');
  lastReport = { brief: true };
  enterPlanning(true);
  await fadeIn();
  // briefing
  const lines = [{ who: 'daniel', text: db.C.daniel.greeting }, { who: 'lucia', text: 'Aqui é a Lúcia, do controle da missão. Nossa pergunta: ' + m.question + ' ' + m.fact }];
  for (const c of db.crew) if (G().crew.has(c.id) && !c.mandatory && c.missionLines[m.id]) lines.push({ who: c.id, text: c.missionLines[m.id] });
  if (t.morale < 0) lines.push({ who: 'adwoa' in db.C && G().crew.has('adwoa') ? 'adwoa' : 'daniel', text: 'Foram ' + dec(t.years, 1) + ' anos de viagem. A equipe chegou cansada e o casco sentiu as passagens pelos planetas. Moral ' + t.morale + ', casco ' + t.hull + '%.' });
  lines.push({ who: 'me', text: 'Entendido. Primeiro planejar a base e o submarino, depois mergulhar.', note: 'Dica: na aba EQUIPE dá para conversar com cada pessoa. Uma conversa por ciclo levanta a moral.' });
  await say(lines);
  await afterPlanningOpen();
}

// ------------------------------------------------------------------ planejamento
const TABS = [['base', 'Base'], ['sub', 'Submarino'], ['res', 'Pesquisa'], ['pow', 'Energia'], ['crew', 'Equipe']];
let tab = 'base';
function enterPlanning() {
  phase = 'plan'; showScreen('s-plan'); view('base'); Audio.setAmbient(false); $('#card').hidden = true;
  scenes.base.setBuilt(G().modules); scenes.base.setSub(G().upgrades); scenes.base.setView(tab === 'sub' ? 'sub' : 'base');
  updateMusic(); renderPlan();
}
async function afterPlanningOpen() {
  const p = game.takePending();
  if (p) await playScenario(p.sc, p.explain);
  renderPlan();
}
function renderPlan() {
  const S = G(); hud();
  $('#plan-tabs').innerHTML = TABS.map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-t="${k}">${n}</button>`).join('');
  $('#plan-tabs').querySelectorAll('button').forEach(b => b.onclick = () => { tab = b.dataset.t; scenes.base.setView(tab === 'sub' ? 'sub' : 'base'); sfx.Click(); renderPlan(); });
  const body = $('#plan-body');
  const free = dec(game.capacity() - game.massUsed(), 1);
  if (tab === 'base') {
    body.innerHTML = `<p class="intro">Módulos da base Conamara, na superfície. Pagos com verba; cada um pesa no foguete (${free} t livres).</p>` + db.modules.map(m => {
      const own = S.modules.has(m.id), why = game.canBuyModule(m.id);
      return `<div class="item ${own ? 'owned' : ''}"><b>${esc(m.name)}</b><span class="eff">${esc(m.effect)}</span>${own ? '<span class="tag bom">pronto</span>' : `<button class="btn small ${why ? '' : 'primary'}" data-buy="${m.id}" ${why ? 'disabled title="' + esc(why) + '"' : ''}>${m.cost} verba</button>`}<span class="desc">${esc(m.desc)} · ${dec(m.mass, 1)} t${!own && why && why !== 'já construído' ? ' · <span style="color:var(--amber)">' + esc(why) + '</span>' : ''}</span></div>`;
    }).join('');
    body.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const id = b.dataset.buy; if (game.buyModule(id)) { sfx.Build(); scenes.base.setBuilt(S.modules); scenes.base.focus(id); toast('Construído: <b>' + esc(db.MOD[id].name) + '</b> · ' + esc(db.MOD[id].effect)); renderPlan(); } });
  }
  if (tab === 'sub') {
    body.innerHTML = `<p class="intro">Upgrades do submarino TÉTIS-7. ${S.zone === 0 ? 'O submarino está na doca: dá para instalar.' : '<b style="color:var(--amber)">O submarino está em outra zona: suba até a Interface para instalar.</b>'} ${free} t livres.</p>` + db.upgrades.map(u => {
      const lv = game.level(u.id), max = lv >= u.costs.length, why = game.canBuyUpgrade(u.id);
      return `<div class="item ${lv ? 'owned' : ''}"><b>${esc(u.name)}<span class="lv">Nv ${lv}/${u.costs.length}</span></b><span class="eff">${max ? esc(u.effects[lv - 1]) : 'próximo: ' + esc(u.effects[lv])}</span>${max ? '<span class="tag bom">máximo</span>' : `<button class="btn small ${why ? '' : 'primary'}" data-up="${u.id}" ${why ? 'disabled' : ''}>${u.costs[lv]} verba</button>`}<span class="desc">${esc(u.desc)}${max ? '' : ' · ' + dec(u.mass[lv], 1) + ' t'}${!max && why ? ' · <span style="color:var(--amber)">' + esc(why) + '</span>' : ''}</span></div>`;
    }).join('');
    body.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { const id = b.dataset.up; if (game.buyUpgrade(id)) { sfx.Build(); scenes.base.setSub(S.upgrades); const u = db.UP[id]; toast('Instalado: <b>' + esc(u.name) + ' Nv' + game.level(id) + '</b> · ' + esc(u.effects[game.level(id) - 1])); renderPlan(); } });
  }
  if (tab === 'res') {
    body.innerHTML = `<p class="intro">Instrumentos reais da Europa Clipper. A pesquisa é paga com <b>dados</b> (${S.sciencePool} disponíveis), não com verba.</p>` + db.research.map(r => {
      const own = S.research.has(r.id), why = game.canBuyResearch(r.id);
      return `<div class="item ${own ? 'owned' : ''}"><b>${r.instrument} · ${esc(r.name)}</b><span class="eff">${esc(r.effect)}</span>${own ? '<span class="tag bom">pronto</span>' : `<button class="btn small ${why ? '' : 'primary'}" data-r="${r.id}" ${why ? 'disabled' : ''}>${r.cost} dados</button>`}<span class="desc">${own ? esc(r.fact) + ' [' + esc(r.src) + ']' : esc(r.src)}</span></div>`;
    }).join('');
    body.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { const id = b.dataset.r; if (game.buyResearch(id)) { sfx.Build(); const r = db.R[id]; toast('<b>' + r.instrument + '</b>: ' + esc(r.fact), 7000); renderPlan(); } });
  }
  if (tab === 'pow') {
    const p = S.power, used = p.life + p.prop + p.instr, M = game.mods;
    const row = (k, n, eff) => `<div class="power"><span><b>${n}</b><br><small class="muted">${eff}</small></span><button class="btn small" data-p="${k}" data-d="-1">−</button><span class="cells">${[0, 1, 2, 3].map(i => `<i class="${i < p[k] ? 'on' : ''}"></i>`).join('')}</span><button class="btn small" data-p="${k}" data-d="1">+</button></div>`;
    body.innerHTML = `<p class="intro">Divida ${CONFIG.powerCells} células de energia do submarino (${used} em uso). Como nas sondas reais, energia é um orçamento.</p>
      ${row('life', 'Suporte vital', 'gasto de O₂ por ciclo: ' + M.o2PerCycle + '%')}
      ${row('prop', 'Propulsão', 'navegar ' + M.Explore + ' · descer ' + M.Descend + ' · subir ' + M.Ascend + ' de energia')}
      ${row('instr', 'Instrumentos', 'dados por scan ×' + dec(M.scienceMult, 2))}`;
    body.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { if (game.adjustPower(b.dataset.p, +b.dataset.d)) { sfx.Click(); renderPlan(); } });
  }
  if (tab === 'crew') {
    body.innerHTML = `<p class="intro">Conversar com cada pessoa uma vez por ciclo levanta a moral. As histórias trazem fatos reais de ciência e de exploração.</p>` + db.crew.filter(c => game.onBoard(c.id)).map(c =>
      `<div class="item crewrow"><img src="${portrait(c.id)}" alt=""><span><b>${esc(c.name)}</b><br><small class="muted">${esc(c.role)} · ${esc(c.perkText)}</small></span><button class="btn small ${S.talked.has(c.id) ? '' : 'primary'}" data-talk="${c.id}">${S.talked.has(c.id) ? 'conversar' : 'conversar ✦'}</button></div>`).join('');
    body.querySelectorAll('[data-talk]').forEach(b => b.onclick = () => talkTo(b.dataset.talk));
  }
  // lado direito: relatório do ciclo e meta
  const m = game.mission, zd = game.zonesDone();
  let side = `<h3>Missão · ${esc(m.site)}</h3><p class="goal">${esc(game.goalText())}</p><div class="zonechk">${m.requiredZones.map(z => `<span class="${zd.has(z) ? 'ok' : ''}">${zd.has(z) ? '✓' : '○'} ${db.zones[z].short}</span>`).join('')}</div>`;
  if (lastReport && !lastReport.brief) side += `<h3>Relatório do ciclo ${pad(lastReport.cycle)}</h3><p>${lastReport.lines.map(esc).join('<br>')}</p>${lastReport.event ? `<p class="muted"><i>${esc(lastReport.event)}</i></p>` : ''}`;
  else side += `<h3>Briefing</h3><p>Viagem de ${dec(game.trajectory.years, 1)} anos no ${esc(game.rocket.name)}. Carga ${dec(game.massUsed(), 1)}/${dec(game.capacity(), 1)} t. ${G().zone === 0 ? 'Monte o submarino antes do primeiro mergulho.' : ''}</p>`;
  side += `<h3>Submarino</h3><p class="muted">Zona: ${db.zones[S.zone].name} · ${dec(db.zones[S.zone].depthKm, 1)} km</p>`;
  $('#plan-side').innerHTML = side;
  $('#b-dive').textContent = 'Mergulhar · ciclo ' + pad(S.cycle) + ' ▸';
}
async function talkTo(id) {
  const c = db.C[id], S = G();
  const first = !(id in S.talkIdx); S.talkIdx[id] = 1;
  const opens = ['Oi, cadete. Sobre o que quer conversar?', 'Pode falar. Tenho uns minutos.', 'Que bom te ver por aqui.'];
  const choices = c.topics.map((t, i) => ({ label: t.title, sub: 'conversar', value: i })).concat([{ label: 'Até mais', sub: 'voltar ao planejamento', value: -1 }]);
  const k = await say([{ who: id, text: first ? c.greeting : opens[Math.floor(Math.random() * 3)], choices, note: c.bio }]);
  if (k < 0 || k == null) return;
  const gain = game.talk(id);
  const lines = c.topics[k].lines.map(t => ({ who: id, text: t }));
  if (gain) lines[lines.length - 1].note = 'Moral da equipe +' + Math.round(gain) + ' (uma conversa por pessoa conta a cada ciclo).';
  await say(lines);
  renderPlan();
}
$('#b-dive').onclick = () => { if (!dlgOpen && phase === 'plan') beginDive(); };

// ------------------------------------------------------------------ cenários (floresta aleatória)
async function playScenario(sc, explain) {
  let cur = sc, ex = explain;
  while (cur) {
    game.startScenario(cur);
    const sp = game.scenarioSpeaker(cur);
    const choices = cur.choices.map((c, i) => { const bl = game.choiceBlocked(c); return { label: c.label, sub: bl || game.effectSummary(c), disabled: !!bl, value: i }; });
    const title = { who: sp, text: cur.title.toUpperCase() + ' · ' + cur.text, choices, note: ex };
    const k = await say([title]);
    const c = cur.choices[k];
    const next = game.choose(cur, c);
    sfx.Click();
    await say([{ who: sp, text: c.result, note: game.effectSummary(c) }]);
    hud(); if (phase === 'plan') renderPlan(); if (phase === 'dive') renderActions();
    if (G().over) { await showEnd(); return; }
    cur = next; ex = 'Continuação da sua escolha anterior (ramo da árvore de cenários).';
  }
}

// ------------------------------------------------------------------ mergulho
async function beginDive() {
  const S = G();
  await fadeOut('CICLO ' + pad(S.cycle) + ' · ' + db.zones[S.zone].short.toUpperCase());
  phase = 'dive'; showScreen('s-dive'); view('ocean');
  scenes.ocean.setSub(S.upgrades); scenes.ocean.setZone(S.zone);
  Audio.setAmbient(true, S.zone); updateMusic();
  if (S.cycle === 1 && !S.scans.length && !$('#log').children.length) {
    pushLog('Sistemas ligados. Profundidade ' + dec(db.zones[0].depthKm, 1) + ' km, logo abaixo do gelo. A Lúcia acompanha pelo cabo de fibra.', 'sys');
    pushLog('Missão: ' + game.mission.name + ' · ' + game.mission.question, 'good');
    pushLog('Use NAVEGAR para procurar contatos e ESCANEAR para registrar. Cada ciclo tem ' + game.mods.turnsPerCycle + ' turnos.', 'sys');
  }
  pushLog(db.text.facts[(S.cycle - 1) % db.text.facts.length], 'fact');
  const crit = []; if (S.o2 <= 25) crit.push('O₂'); if (S.energy <= 20) crit.push('energia'); if (S.hull <= 25) crit.push('casco');
  if (crit.length) { pushLog('ATENÇÃO: nível crítico de ' + crit.join(', ') + '.', 'crit'); sfx.Alarm(); }
  const left = CONFIG.maxCycles - S.cycle + 1;
  if (left <= 3) pushLog('Faltam ' + left + ' ciclo' + (left > 1 ? 's' : '') + ' até a base recolher o cabo.' + (game.goalMet() ? ' Suba e acople.' : ''), 'warn');
  renderZone(); renderActions(); hud();
  await fadeIn();
}
function renderZone() {
  const S = G(), Z = db.zones[S.zone];
  $('#zone-box').className = 'zone-box panel';
  $('#zone-box').innerHTML = `<span class="kicker">${esc(Z.name)}</span><span class="depth">${dec(Z.depthKm, 1)} km</span><br>${thousands(pressureBar(Z.depthKm))} bar · ${Z.temp} · ${game.remainingInZone()} sem registro${game.mission.requiredZones.includes(S.zone) ? ' · ★ exigida' : ''}`;
}
const ICON = { Explore: '🧭', Scan: '🔬', Sonar: '📡', Electrolysis: '💧', Repair: '🔧', Descend: '⬇', Ascend: '⬆', VentCharge: '🔥', TalkBase: '📻', Rest: '🌙', Eva: '🧑‍🚀', Dock: '⚓' };
function renderActions() {
  const box = $('#actions');
  box.innerHTML = ACTIONS.map(a => {
    const why = busy || dlgOpen ? 'aguarde' : game.check(a.id);
    const cost = game.cost(a.id);
    const hot = !why && ((a.id === 'Scan') || (a.id === 'Dock'));
    return `<button class="act ${hot ? 'hot' : ''}" data-a="${a.id}" ${why ? 'disabled' : ''} title="${esc(why || a.eff)}"><span class="k">${a.key}</span><b>${ICON[a.id] || ''} ${a.name}</b><small>${why && why !== 'aguarde' ? esc(why) : cost ? '−' + cost + ' energia' : a.turn ? 'grátis' : 'sem turno'}</small></button>`;
  }).join('') + `<button class="act end" id="b-end" ${busy || dlgOpen ? 'disabled' : ''}><span class="k">ENTER</span><b>Encerrar ciclo</b><small>${G().turns} turnos</small></button>`;
  box.querySelectorAll('[data-a]').forEach(b => b.onclick = () => doAction(b.dataset.a));
  $('#b-end').onclick = endCycle;
}
async function doAction(id) {
  if (busy || dlgOpen || phase !== 'dive' || game.check(id)) return;
  busy = true; renderActions(); sfx.Click();
  holdLogs = true;
  const out = game.act(id);
  const oc = scenes.ocean;
  try {
    switch (id) {
      case 'Explore':
        if (out.contact) oc.spawnContact(out.contact); else oc.clearContact();
        sfx.Motor(2.6); sfx.bubbles(6); oc.move(2.6); await wait(2600);
        if (out.contact) sfx.Ping();
        if (out.bump) { oc.bump(); sfx.Clank(); }
        break;
      case 'Scan': {
        oc.scan(true); sfx.Scan(); await wait(2700); oc.scan(false);
        const t = out.target;
        const c = $('#card');
        c.innerHTML = `<span class="kicker">Descoberta ${t.code} · +${out.science} dados${out.focus ? ' · foco da missão' : ''}</span><h3>${esc(t.name)}</h3><p style="margin:0">${esc(t.desc)}</p><p class="fact"><b>Dado real.</b> ${esc(t.fact)}<br><span class="src">${esc(t.src)}</span></p><button class="btn small" id="card-x" style="margin-top:8px">OK</button>`;
        c.hidden = false; $('#card-x').onclick = () => { c.hidden = true; };
        setTimeout(() => { if (!c.hidden) c.hidden = true; }, 14000);
        sfx.Swell(); setTimeout(() => oc.clearContact(), 3000);
        break;
      }
      case 'Sonar': sfx.Ping(); await wait(400); break;
      case 'Electrolysis': sfx.bubbles(18, 0.05); await wait(900); break;
      case 'Repair': sfx.Clank(); await wait(500); sfx.Clank(); await wait(500); break;
      case 'Descend': case 'Ascend':
        sfx.Motor(2); sfx.Creak(); sfx.bubbles(10);
        await fadeOut((id === 'Descend' ? '▼ DESCENDO · ' : '▲ SUBINDO · ') + db.zones[G().zone].short.toUpperCase());
        oc.setZone(G().zone); Audio.setAmbient(true, G().zone); renderZone();
        await wait(500); await fadeIn();
        break;
      case 'VentCharge': sfx.Vent(); oc.bump(); await wait(1200); break;
      case 'TalkBase': lockMusic('calm', 14000); flushLogs(); await say([{ who: 'lucia', text: out.line }]); break;
      case 'Rest': lockMusic('calm', 9000); oc.darkT = 0.85; await wait(3800); oc.darkT = 0; break;
      case 'Eva': flushLogs(); await runEva(out.eva); break;
      case 'Dock': await wait(1500); break;
    }
  } finally {
    flushLogs();
  }
  busy = false;
  hud(); renderZone(); renderActions(); updateMusic();
  if (out.scenario && !G().over) { await playScenario(out.scenario.sc, out.scenario.explain); renderActions(); }
  if (G().over) { await showEnd(); return; }
  if (G().turns === 0) pushLog('Sem turnos neste ciclo. Encerre o ciclo de mergulho (Enter).', 'sys');
  if (game.goalMet() && G().zone !== 0 && !shownGoalHint) { shownGoalHint = true; toast('Meta cumprida! Suba até a <b>Interface</b> e use <b>Acoplar</b>.', 5000); }
}
let shownGoalHint = false;
async function endCycle() {
  if (busy || dlgOpen || phase !== 'dive') return;
  busy = true; renderActions(); sfx.Click(); lockMusic('calm', 6000);
  await fadeOut('FIM DO CICLO ' + pad(G().cycle) + ' · DESCANSO');
  holdLogs = true;
  lastReport = game.endCycle();
  flushLogs();
  if (lastReport.blackout) sfx.Alarm();
  busy = false;
  if (G().over) { await fadeIn(); await showEnd(); return; }
  enterPlanning();
  await wait(400); await fadeIn();
  await afterPlanningOpen();
}

// ------------------------------------------------------------------ EVA
const keys = new Set();
const stick = { x: 0, y: 0 }; let vert = 0;
async function runEva(eva) {
  await fadeOut('ECLUSA · ENCHENDO DE ÁGUA');
  sfx.bubbles(14, 0.05);
  phase = 'eva'; showScreen('s-eva'); view('eva');
  scenes.eva.begin(eva.zone, G().upgrades, G().protagonist, eva.samples);
  updateMusic();
  let suit = eva.seconds, done = false, aborted = false; const got = [];
  const total = eva.samples.length;
  $('#eva-count').textContent = 'AMOSTRAS 0/' + total;
  await wait(300); await fadeIn();
  if (eva.fact) toast('<b>Dado real.</b> ' + esc(eva.fact), 8000);
  const finish = (ab) => { if (done) return; if (!ab && !scenes.eva.nearHatch) { toast('Volte até a eclusa embaixo do submarino (seta amarela).', 2500); return; } aborted = ab; done = true; sfx.Clank(); };
  $('#eva-back').onclick = () => finish(false);
  evaFinish = finish;
  let last = performance.now();
  await new Promise(res => {
    const loop = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (done) { res(); return; }
      let mx = stick.x, my = stick.y, v = vert;
      if (keys.has('w') || keys.has('arrowup')) my += 1; if (keys.has('s') || keys.has('arrowdown')) my -= 1;
      if (keys.has('a') || keys.has('arrowleft')) mx -= 1; if (keys.has('d') || keys.has('arrowright')) mx += 1;
      if (keys.has(' ') || keys.has('q')) v += 1; if (keys.has('c')) v -= 1;
      const len = Math.hypot(mx, my); if (len > 1) { mx /= len; my /= len; }
      const n = scenes.eva.step(dt, { x: mx, y: my }, Math.max(-1, Math.min(1, v)), keys.has('shift'));
      for (const s of n) { got.push(s); sfx.Ping(); toast(`<b style="color:var(--teal)">AMOSTRA · ${esc(s.name.toUpperCase())}</b> · +${Math.round(s.science * game.mods.scienceMult)} dados<br>${esc(s.info)}`, 4500); }
      $('#eva-count').textContent = 'AMOSTRAS ' + got.length + '/' + total + (scenes.eva.nearHatch ? ' · ECLUSA ✓' : '');
      suit -= dt;
      $('#suit-bar').style.width = Math.max(0, suit / eva.seconds * 100) + '%';
      $('#suit-bar').style.background = suit < 15 ? 'var(--red)' : 'var(--cyan)';
      $('#suit-txt').textContent = Math.max(0, Math.ceil(suit)) + ' s';
      if (suit <= 0) finish(true);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  evaFinish = null;
  await fadeOut('DE VOLTA À CABINE');
  phase = 'dive'; showScreen('s-dive'); view('ocean');
  game.evaResult(got, aborted);
  hud(); updateMusic();
  await wait(300); await fadeIn();
}
let evaFinish = null;
// joystick de toque
(() => {
  const el = $('#stick'), knob = el.querySelector('i'); let id = null;
  const set = e => { const r = el.getBoundingClientRect(); let x = (e.clientX - r.left) / r.width * 2 - 1, y = (e.clientY - r.top) / r.height * 2 - 1; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } stick.x = x; stick.y = -y; knob.style.transform = `translate(${x * 38}px, ${y * 38}px)`; };
  el.addEventListener('pointerdown', e => { id = e.pointerId; el.setPointerCapture(id); set(e); e.preventDefault(); });
  el.addEventListener('pointermove', e => { if (e.pointerId === id) set(e); });
  const up = e => { if (e.pointerId !== id) return; id = null; stick.x = stick.y = 0; knob.style.transform = ''; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  const hold = (b, v) => { b.addEventListener('pointerdown', e => { vert = v; e.preventDefault(); }); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { vert = 0; }); };
  hold($('#eva-up'), 1); hold($('#eva-down'), -1);
})();

// ------------------------------------------------------------------ fim
function interpretGame() {
  const S = G(), out = [];
  const h = S.history, last = h[h.length - 1] || S;
  if (S.win) out.push({ tone: 'bom', text: `Missão concluída em ${Math.min(S.cycle, CONFIG.maxCycles)} ciclos, com ${S.scans.length} descobertas. A pergunta “${game.mission.question}” ganhou dados de verdade.` });
  else out.push({ tone: 'frágil', text: 'A missão terminou antes da resposta: ' + REASON_TEXT[S.endReason] + '.' });
  const low = Object.entries({ 'O₂': last.o2, energia: Math.min(100, last.energy), casco: last.hull, moral: last.morale }).sort((a, b) => a[1] - b[1])[0];
  out.push({ tone: low[1] < 30 ? 'atenção' : 'leitura', text: `No gráfico, o recurso que terminou mais baixo foi ${low[0]} (${Math.round(low[1])}). ${low[1] < 30 ? 'Foi ele que limitou a missão: da próxima vez, planeje margem para ele.' : 'Nenhum recurso chegou à zona de perigo: o projeto teve margem.'}` });
  const spentPct = S.budgetSpent + S.launchCost + S.crewSalaries;
  out.push({ tone: 'troca', text: `Foram ${S.launchCost} de verba no lançamento, ${S.crewSalaries} em salários e ${S.budgetSpent} na base e no submarino. Carga usada: ${dec(game.massUsed(), 1)} de ${dec(game.capacity(), 1)} t.` });
  if (S.evaCount) out.push({ tone: 'leitura', text: `Você saiu em ${S.evaCount} EVA${S.evaCount > 1 ? 's' : ''} e trouxe ${S.evaSamples} amostras.` });
  return out;
}
async function showEnd() {
  if (phase === 'end') return;
  if (phase === 'eva') evaFinish?.(true);
  phase = 'end'; busy = false; $('#card').hidden = true; $('#dlg').hidden = true; dlgOpen = false;
  Audio.setAmbient(false); updateMusic();
  if (G().win) sfx.Build(); else sfx.Alarm();
  const S = G(), E = game.ending();
  showScreen('s-end');
  const h = S.history;
  $('#end').innerHTML = `<div class="grade">${S.grade}</div><p class="kicker">${esc(E.kicker)}</p><h2>${esc(E.title)}</h2><p>${esc(E.body)}</p>
    <div class="stats"><div><b>${S.score}</b><span>pontos · nota ${S.grade}</span></div><div><b>${S.scans.length}</b><span>descobertas</span></div><div><b>${S.scienceTotal}</b><span>dados científicos</span></div><div><b>${Math.min(S.cycle, CONFIG.maxCycles)}</b><span>ciclos</span></div></div>
    <h3>Recursos ao longo da missão</h3><canvas class="chart" id="end-chart"></canvas>
    <div class="legend"><span><i style="background:var(--o2)"></i>O₂</span><span><i style="background:var(--energy)"></i>Energia</span><span><i style="background:var(--hull)"></i>Casco</span><span><i style="background:var(--morale)"></i>Moral</span><span class="muted">eixo x: ciclos · faixa vermelha: perigo</span></div>
    <h3>O que os números dizem</h3><div class="interp">${interpretGame().map(x => `<div><span class="tag ${x.tone}">${x.tone}</span>${esc(x.text)}</div>`).join('')}</div>
    <h3>Como suas escolhas moldaram a missão</h3><ul>${S.decisions.slice(0, 4).map(d => `<li>${esc(d)}</li>`).join('')}<li>Construído: ${S.modules.size} módulos, ${Object.values(S.upgrades).reduce((a, b) => a + b, 0)} níveis de upgrade, ${S.research.size} pesquisas · energia: vital ${S.power.life}, propulsão ${S.power.prop}, instrumentos ${S.power.instr}</li></ul>
    ${S.decisions.length > 4 ? `<p class="kicker">Decisões nos cenários (floresta aleatória)</p><ul class="dim">${S.decisions.slice(4).map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
    <div class="row"><button class="btn primary" id="end-again">Jogar de novo</button><a class="btn ghost" href="./#simulador">Comparar projetos no simulador</a><a class="btn ghost" href="./">Página inicial</a></div>`;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  lineChart($('#end-chart'), h.map(x => x.cycle === 1 ? 'início' : x.cycle - 1), [
    { color: css('--o2'), values: h.map(x => x.o2) }, { color: css('--energy'), values: h.map(x => Math.min(100, x.energy)) },
    { color: css('--hull'), values: h.map(x => x.hull) }, { color: css('--morale'), values: h.map(x => x.morale) }], { height: 200, danger: 25 });
  $('#end-again').onclick = () => { $('#log').innerHTML = ''; shownGoalHint = false; lastReport = null; tab = 'base'; startDesign(); };
}

// ------------------------------------------------------------------ teclado
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (phase === 'eva') { keys.add(k); if (k === 'e' || k === 'enter') evaFinish?.(false); if (k === ' ') e.preventDefault(); return; }
  if (k === 's' && phase !== 'eva') { Audio.unlock(); Audio.toggleMute(); hud(); return; }
  if (!$('#sheet').hidden) { if (k === 'escape' || k === 'd' || k === 'm') closeSheet(); return; }
  if (dlgOpen) {
    if (k === 'enter' || k === ' ') { if (dlg.resolve) { e.preventDefault(); $('#dlg-next').click(); } return; }
    const n = parseInt(k, 10); if (n >= 1) { const b = $('#dlg-choices').children[n - 1]; if (b && !b.disabled) b.click(); }
    return;
  }
  if (phase === 'title' && k === 'enter') { $('#b-start').click(); return; }
  if (phase === 'plan') { if (k === 'enter') $('#b-dive').click(); if (k === 'd') $('#b-diary').click(); if (k === 'm') openMap(); return; }
  if (phase !== 'dive') return;
  if (k === 'd') { $('#b-diary').click(); return; }
  if (k === 'm') { openMap(); return; }
  if (k === 'enter') { endCycle(); return; }
  const a = ACTIONS.find(x => x.key.toLowerCase() === k);
  if (a) doAction(a.id);
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
document.addEventListener('pointerdown', () => Audio.unlock(), { once: true });

// ------------------------------------------------------------------ celular em pé
const rot = $('#rotate'); let rotOk = false;
const checkRot = () => { rot.hidden = rotOk || !TOUCH || innerWidth > innerHeight || innerWidth > 820; };
$('#rot-ok').onclick = () => { rotOk = true; checkRot(); };
addEventListener('resize', checkRot); checkRot();
if ('wakeLock' in navigator) document.addEventListener('pointerdown', () => navigator.wakeLock.request('screen').catch(() => {}), { once: true });

// ------------------------------------------------------------------ início
const qs = new URLSearchParams(location.search);
toTitle();
if (qs.get('projeto')) { const id = qs.get('projeto'); $('#b-start').onclick = () => { Audio.unlock(); sfx.Click(); startDesign(id); }; $('#b-start').textContent = 'Começar com o projeto pronto'; }
window.__abismo = { game, db, scenes, doAction, endCycle, startDesign, launch, showEnd, phase: () => phase, say, playScenario };
