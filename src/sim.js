// Simulador: joga a mesma missão muitas vezes com um "piloto automático" e resume os resultados.
// Usado nas missões prontas (presets) da página inicial. As regras são as mesmas do jogo (engine.js).
import { Game, CONFIG, mulberry, dec } from './engine.js';

export const PRESETS = [
  {
    id: 'clipper', name: 'Receita da Clipper', mission: 'conamara', rocket: 'falcon', trajectory: 'mega', crew: ['anja', 'adwoa', 'jaciara'],
    pitch: 'Foguete comercial, estilingue em Marte e na Terra, equipe enxuta. A escolha que a NASA fez de verdade.',
    build: { modules: ['Lab', 'Antenna', 'Greenhouse'], upgrades: ['Hull', 'Thrusters', 'Battery'], research: ['Reason', 'Mise', 'Maspex', 'EThemis'] },
  },
  {
    id: 'sls', name: 'Força bruta (SLS)', mission: 'thera', rocket: 'sls', trajectory: 'direta', crew: ['sayaka'],
    pitch: 'O foguete mais potente, indo direto. Chega rápido e descansado, mas sobra pouca verba para a base.',
    build: { modules: ['Lab', 'Antenna'], upgrades: ['Hull', 'Battery'], research: ['Mise', 'Reason', 'Maspex'] },
  },
  {
    id: 'barato', name: 'Barato e lento', mission: 'plumas', rocket: 'atlas', trajectory: 'veega', crew: ['noor', 'jihoon'],
    pitch: 'Foguete pequeno e três passagens por planetas. Sobra verba, mas a viagem de 6,5 anos cansa a equipe e o casco.',
    build: { modules: ['Antenna', 'Quarters', 'Lab'], upgrades: ['Hull', 'Thrusters'], research: ['Mise', 'Gravity', 'Maspex'] },
  },
  {
    id: 'fundo', name: 'Mergulho profundo', mission: 'pwyll', rocket: 'falcon', trajectory: 'mega', crew: ['mikolaj', 'anja', 'sayaka', 'johann'],
    pitch: 'A missão mais difícil, até a fenda abissal. Equipe técnica forte, casco reforçado desde o primeiro dia.',
    build: { modules: ['RepairDock', 'Lab', 'Rtg'], upgrades: ['Hull', 'Hull', 'Thrusters', 'Battery'], research: ['EThemis', 'Ecm', 'Reason', 'Maspex'] },
  },
  {
    id: 'apertado', name: 'Economia demais', mission: 'pwyll', rocket: 'atlas', trajectory: 'direta', crew: [],
    pitch: 'O foguete mais barato indo direto, para sobrar verba. Parece esperto, mas sobram só 0,2 t de carga.',
    build: { modules: ['Lab', 'Antenna'], upgrades: ['Hull', 'Thrusters'], research: ['Mise', 'Reason'] },
  },
];

export function setupPreset(g, p, seed) {
  g.reset();
  g.selectMission(p.mission); g.selectLaunch(p.rocket); g.selectLaunch(p.trajectory);
  for (const id of p.crew) if (!g.S.crew.has(id)) g.toggleCrew(id);
  return g.confirmDesign(seed);
}

/** Decisões de planejamento do piloto automático: compra na ordem do preset quando dá. */
function plan(g, p) {
  for (const id of p.build.upgrades) if (!g.canBuyUpgrade(id)) g.buyUpgrade(id);
  for (const id of p.build.modules) if (!g.canBuyModule(id)) g.buyModule(id);
  for (const id of p.build.research) if (!g.canBuyResearch(id)) g.buyResearch(id);
  const S = g.S;
  // energia: mais suporte vital se o O2 estiver baixo
  if (S.o2 < 40 && S.power.life < 3) { g.adjustPower('instr', -1); g.adjustPower('life', 1); }
}

function playScenario(g, sc) {
  let cur = sc, guard = 0;
  while (cur && guard++ < 4) {
    g.startScenario(cur);
    const ok = cur.choices.filter(c => !g.choiceBlocked(c));
    // prefere a escolha que não machuca recurso crítico
    const S = g.S;
    const risky = c => (c.hull || 0) < 0 && S.hull < 45 || (c.energy || 0) < 0 && S.energy < 25 || (c.morale || 0) < 0 && S.morale < 35;
    const safe = ok.filter(c => !risky(c));
    const list = safe.length ? safe : ok;
    const c = list[Math.floor(g.R() * list.length)];
    cur = g.choose(cur, c);
    if (g.S.over) return;
  }
}

/** Escolhe a próxima ação do mergulho. */
function nextAction(g) {
  const S = g.S, can = id => !g.check(id), m = g.mission;
  // um jogador de verdade não joga perfeito: às vezes explora por curiosidade, conversa ou sai em EVA
  if (g.R() < 0.3) {
    const extra = ['Explore', 'Sonar', 'TalkBase', 'Rest', 'Eva', 'Explore'].filter(can);
    if (extra.length) return extra[Math.floor(g.R() * extra.length)];
  }
  if (S.o2 < 30 && can('Electrolysis')) return 'Electrolysis';
  if (S.hull < 40 && can('Repair')) return 'Repair';
  if (S.zone === 2 && S.energy < 45 && can('VentCharge')) return 'VentCharge';
  if (S.morale < 40 && can('TalkBase')) return 'TalkBase';
  if (can('Dock')) return 'Dock';
  if (S.contact && can('Scan')) return 'Scan';
  const done = g.zonesDone();
  const need = m.requiredZones.filter(z => !done.has(z));
  const goal = g.goalMet();
  let target;
  if (goal) target = 0;
  else if (need.length) target = need.reduce((a, b) => Math.abs(b - S.zone) < Math.abs(a - S.zone) ? b : a);
  else target = S.zone;
  if (!goal && target === S.zone && g.remainingInZone() === 0) {
    const others = [0, 1, 2, 3].filter(z => g.remainingInZone(z) > 0);
    if (others.length) target = others.reduce((a, b) => Math.abs(b - S.zone) < Math.abs(a - S.zone) ? b : a);
  }
  if (target > S.zone && can('Descend')) return 'Descend';
  if (target < S.zone && can('Ascend')) return 'Ascend';
  if (target === S.zone && !goal && can('Explore')) return 'Explore';
  if (S.energy < 30 && can('Rest')) return 'Rest';
  return null;
}

export function runOnce(db, p, seed) {
  const rng = mulberry(seed);
  const g = new Game(db, rng);
  if (!setupPreset(g, p, seed)) return { invalid: g.designProblem() };
  let guard = 0;
  while (!g.S.over && guard++ < 400) {
    const pend = g.takePending();
    if (pend) { playScenario(g, pend.sc); if (g.S.over) break; }
    plan(g, p);
    // mergulho
    let n = 0;
    while (!g.S.over && n++ < 12) {
      const id = nextAction(g);
      if (!id) break;
      const out = g.act(id);
      if (!out) break;
      if (out.scenario) playScenario(g, out.scenario.sc);
      if (out.eva) g.evaResult(out.eva.samples.slice(0, 3), false);
    }
    if (!g.S.over) g.endCycle();
  }
  return { state: g.S, game: g };
}

/** Roda N missões e resume. */
export function simulate(db, p, runs = 200, seed0 = 1) {
  const reasons = {}, grades = {}, curves = [];
  let wins = 0, score = 0, cycles = 0, scans = 0, invalid = null;
  for (let i = 0; i < runs; i++) {
    const r = runOnce(db, p, seed0 + i * 7919);
    if (r.invalid) { invalid = r.invalid; break; }
    const S = r.state;
    reasons[S.endReason] = (reasons[S.endReason] || 0) + 1;
    grades[S.grade] = (grades[S.grade] || 0) + 1;
    if (S.win) wins++;
    score += S.score; cycles += Math.min(S.cycle, CONFIG.maxCycles); scans += S.scans.length;
    curves.push(S.history);
  }
  if (invalid) return { invalid };
  // média por ciclo (só missões ainda em andamento naquele ciclo)
  const keys = ['o2', 'energy', 'hull', 'morale'];
  const avg = [];
  for (let c = 1; c <= CONFIG.maxCycles + 1; c++) {
    const at = curves.map(h => h.find(x => x.cycle === c)).filter(Boolean);
    if (at.length < runs * 0.15) break;
    const row = { cycle: c, n: at.length };
    for (const k of keys) row[k] = at.reduce((a, x) => a + x[k], 0) / at.length;
    avg.push(row);
  }
  return { runs, winRate: wins / runs, avgScore: score / runs, avgCycles: cycles / runs, avgScans: scans / runs, reasons, grades, avg };
}

export const REASON_TEXT = { win: 'missão concluída', o2: 'faltou oxigênio', hull: 'casco cedeu', energy: 'blecautes', morale: 'equipe exausta', time: 'tempo acabou' };

/** Interpretação em linguagem simples: o que os números querem dizer. */
export function interpret(r, p, db) {
  const out = [];
  const pct = Math.round(r.winRate * 100);
  const verdict = pct >= 70 ? ['bom', 'Este projeto é robusto: na maioria das simulações a missão voltou com a resposta.'] :
    pct >= 40 ? ['arriscado', 'Este projeto funciona, mas depende de sorte e de boas decisões no caminho.'] :
    ['frágil', 'Na maioria das simulações a missão não conseguiu responder à pergunta. O projeto precisa de ajustes.'];
  out.push({ tone: verdict[0], text: pct + '% de sucesso: ' + verdict[1] });
  const fails = Object.entries(r.reasons).filter(([k]) => k !== 'win').sort((a, b) => b[1] - a[1]);
  if (fails.length) {
    const [k, n] = fails[0];
    const advice = {
      hull: 'Reforce o casco de titânio cedo ou leve a Anja e a doca de manutenção.',
      o2: 'Dê mais células de energia ao suporte vital, construa a estufa ou pesquise o MASPEX.',
      energy: 'Instale baterias, construa o gerador RTG e recarregue nas fontes hidrotermais.',
      morale: 'Converse com a equipe, leve a Adwoa e construa o alojamento.',
      time: 'Escolha propulsores melhores e uma equipe que ache contatos mais rápido (Jaciara, Ji-hoon).',
    }[k] || '';
    const m0 = db.M[p.mission], cap = db.L[p.rocket].capacity * db.L[p.trajectory].capacity;
    const blocked = m0.requiredZones.includes(3) && cap < 7.6 + 0.8;
    out.push({ tone: 'atenção', text: 'Principal causa de fracasso: ' + REASON_TEXT[k] + ' (' + Math.round(n / r.runs * 100) + '% das missões). ' + (blocked ? '' : advice) });
    if (blocked) out.push({ tone: 'atenção', text: 'O detalhe que decide tudo: não sobra carga para o casco de titânio (0,8 t), e sem ele o submarino não pode descer até a Fenda abissal, que esta missão exige. Economizar no foguete custou a missão inteira.' });
  }
  const last = r.avg[r.avg.length - 1];
  if (last) {
    const low = Object.entries({ 'O₂': last.o2, energia: last.energy, casco: last.hull, moral: last.morale }).sort((a, b) => a[1] - b[1])[0];
    out.push({ tone: 'leitura', text: 'No gráfico, a linha que mais cai é ' + low[0] + ' (média de ' + Math.round(low[1]) + ' no fim). É o recurso que limita este projeto.' });
  }
  const m = db.M[p.mission], L = db.L[p.rocket], T = db.L[p.trajectory];
  out.push({ tone: 'troca', text: L.name + ' + ' + T.name + ': ' + dec(L.capacity * T.capacity, 1) + ' t de carga e ' + dec(T.years, 1) + ' anos de viagem. Missão ' + m.difficulty.toLowerCase() + ' em ' + m.site + '.' });
  return out;
}
