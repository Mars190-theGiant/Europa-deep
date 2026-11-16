// Simulador: joga a mesma missão muitas vezes com um "piloto automático" e resume os resultados.
// Usado nas missões prontas (presets) da página inicial. As regras são as mesmas do jogo (engine.js).
import { Game, CONFIG, mulberry, dec } from './engine.js';
import { EN, tr } from './i18n.js';

export const PRESETS = [
  {
    id: 'clipper', name: tr('Receita da Clipper', 'The Clipper recipe'), mission: 'conamara', rocket: 'falcon', trajectory: 'mega', crew: ['anja', 'adwoa', 'jaciara'],
    pitch: tr('Foguete comercial, estilingue em Marte e na Terra, equipe enxuta. A escolha que a NASA fez de verdade.', 'Commercial rocket, slingshots at Mars and Earth, a lean crew. The choice NASA really made.'),
    build: { modules: ['Lab', 'Antenna', 'Greenhouse'], upgrades: ['Hull', 'Thrusters', 'Battery'], research: ['Reason', 'Mise', 'Maspex', 'EThemis'] },
  },
  {
    id: 'sls', name: tr('Força bruta (SLS)', 'Brute force (SLS)'), mission: 'thera', rocket: 'sls', trajectory: 'direta', crew: ['sayaka'],
    pitch: tr('O foguete mais potente, indo direto. Chega rápido e descansado, mas sobra pouca verba para a base.', 'The most powerful rocket, flying direct. You arrive fast and rested, but little budget is left for the base.'),
    build: { modules: ['Lab', 'Antenna'], upgrades: ['Hull', 'Battery'], research: ['Mise', 'Reason', 'Maspex'] },
  },
  {
    id: 'barato', name: tr('Barato e lento', 'Cheap and slow'), mission: 'plumas', rocket: 'atlas', trajectory: 'veega', crew: ['noor', 'jihoon'],
    pitch: tr('Foguete pequeno e três passagens por planetas. Sobra verba, mas a viagem de 6,5 anos cansa a equipe e o casco.', 'A small rocket and three planetary flybys. Budget to spare, but the 6.5-year trip wears out the crew and the hull.'),
    build: { modules: ['Antenna', 'Quarters', 'Lab'], upgrades: ['Hull', 'Thrusters'], research: ['Mise', 'Gravity', 'Maspex'] },
  },
  {
    id: 'fundo', name: tr('Mergulho profundo', 'Deep dive'), mission: 'pwyll', rocket: 'falcon', trajectory: 'mega', crew: ['mikolaj', 'anja', 'sayaka', 'johann'],
    pitch: tr('A missão mais difícil, até a fenda abissal. Equipe técnica forte, casco reforçado desde o primeiro dia.', 'The hardest mission, down to the abyssal rift. A strong technical crew and a reinforced hull from day one.'),
    build: { modules: ['RepairDock', 'Lab', 'Rtg'], upgrades: ['Hull', 'Hull', 'Thrusters', 'Battery'], research: ['EThemis', 'Ecm', 'Reason', 'Maspex'] },
  },
  {
    id: 'apertado', name: tr('Economia demais', 'Too much saving'), mission: 'pwyll', rocket: 'atlas', trajectory: 'direta', crew: [],
    pitch: tr('O foguete mais barato indo direto, para sobrar verba. Parece esperto, mas sobram só 0,2 t de carga.', 'The cheapest rocket flying direct, to save budget. It looks smart, but only 0.2 t of cargo is left.'),
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

export const REASON_TEXT = EN ? { win: 'mission complete', o2: 'ran out of oxygen', hull: 'hull failed', energy: 'blackouts', morale: 'crew exhausted', time: 'time ran out' }
  : { win: 'missão concluída', o2: 'faltou oxigênio', hull: 'casco cedeu', energy: 'blecautes', morale: 'equipe exausta', time: 'tempo acabou' };

/** Interpretação em linguagem simples: o que os números querem dizer. */
export function interpret(r, p, db) {
  const out = [];
  const pct = Math.round(r.winRate * 100);
  const verdict = pct >= 70 ? ['bom', tr('Este projeto é robusto: na maioria das simulações a missão voltou com a resposta.', 'This design is robust: in most simulations the mission came back with the answer.')] :
    pct >= 40 ? ['arriscado', tr('Este projeto funciona, mas depende de sorte e de boas decisões no caminho.', 'This design works, but it depends on luck and good decisions along the way.')] :
    ['frágil', tr('Na maioria das simulações a missão não conseguiu responder à pergunta. O projeto precisa de ajustes.', 'In most simulations the mission could not answer the question. The design needs changes.')];
  out.push({ tone: verdict[0], text: pct + tr('% de sucesso: ', '% success: ') + verdict[1] });
  const fails = Object.entries(r.reasons).filter(([k]) => k !== 'win').sort((a, b) => b[1] - a[1]);
  if (fails.length) {
    const [k, n] = fails[0];
    const advice = (EN ? {
      hull: 'Reinforce the titanium hull early, or bring Anja and the repair dock.',
      o2: 'Give more power cells to life support, build the greenhouse or research MASPEX.',
      energy: 'Install batteries, build the RTG generator and recharge at the hydrothermal vents.',
      morale: 'Talk with the crew, bring Adwoa and build the quarters.',
      time: 'Pick better thrusters and a crew that finds contacts faster (Jaciara, Ji-hoon).',
    } : {
      hull: 'Reforce o casco de titânio cedo ou leve a Anja e a doca de manutenção.',
      o2: 'Dê mais células de energia ao suporte vital, construa a estufa ou pesquise o MASPEX.',
      energy: 'Instale baterias, construa o gerador RTG e recarregue nas fontes hidrotermais.',
      morale: 'Converse com a equipe, leve a Adwoa e construa o alojamento.',
      time: 'Escolha propulsores melhores e uma equipe que ache contatos mais rápido (Jaciara, Ji-hoon).',
    })[k] || '';
    const m0 = db.M[p.mission], cap = db.L[p.rocket].capacity * db.L[p.trajectory].capacity;
    const blocked = m0.requiredZones.includes(3) && cap < 7.6 + 0.8;
    out.push({ tone: 'atenção', text: tr('Principal causa de fracasso: {r} ({p}% das missões). ', 'Main cause of failure: {r} ({p}% of missions). ', { r: REASON_TEXT[k], p: Math.round(n / r.runs * 100) }) + (blocked ? '' : advice) });
    if (blocked) out.push({ tone: 'atenção', text: tr('O detalhe que decide tudo: não sobra carga para o casco de titânio (0,8 t), e sem ele o submarino não pode descer até a Fenda abissal, que esta missão exige. Economizar no foguete custou a missão inteira.', 'The detail that decides everything: there is no cargo left for the titanium hull (0.8 t), and without it the sub cannot go down to the Abyssal rift, which this mission requires. Saving on the rocket cost the whole mission.') });
  }
  const last = r.avg[r.avg.length - 1];
  if (last) {
    const low = Object.entries({ 'O₂': last.o2, [tr('energia', 'energy')]: last.energy, [tr('casco', 'hull')]: last.hull, [tr('moral', 'morale')]: last.morale }).sort((a, b) => a[1] - b[1])[0];
    out.push({ tone: 'leitura', text: tr('No gráfico, a linha que mais cai é {k} (média de {v} no fim). É o recurso que limita este projeto.', 'On the chart, the line that drops the most is {k} (average of {v} at the end). That is the resource limiting this design.', { k: low[0], v: Math.round(low[1]) }) });
  }
  const m = db.M[p.mission], L = db.L[p.rocket], T = db.L[p.trajectory];
  out.push({ tone: 'troca', text: L.name + ' + ' + T.name + ': ' + tr('{c} t de carga e {y} anos de viagem. Missão {d} em {s}.', '{c} t of cargo and {y} years of travel. {D} mission at {s}.', { c: dec(L.capacity * T.capacity, 1), y: dec(T.years, 1), d: m.difficulty.toLowerCase(), D: m.difficulty, s: m.site }) });
  return out;
}
