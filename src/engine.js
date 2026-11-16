// Abismo de Europa · motor de regras (sem gráficos).
// Portado do GameManager da versão Unity v2. O mesmo motor roda o jogo e o simulador da página inicial.
import { ScenarioForest } from './forest.js';

export const CONFIG = {
  maxCycles: 12, turnsPerCycle: 5,
  startO2: 84, startEnergy: 80, startHull: 90, startMorale: 82,
  generator: 10, systems: 16, lifeO2: 12,
  baseFunding: 10, fundingPerScience: 0.5,
  powerCells: 6, maxCellsPerSystem: 4,
  baseMassT: 7, // submarino básico + habitat + cryobot
  G: 1.315, iceKm: 20,
};

export const ACTIONS = [
  { id: 'Explore', key: '1', name: 'Navegar', turn: true, eff: 'procura um contato' },
  { id: 'Scan', key: '2', name: 'Escanear', turn: true, eff: 'dado real da NASA', why: 'sem contato' },
  { id: 'Sonar', key: '3', name: 'Sonar', turn: false, eff: 'não gasta turno' },
  { id: 'Electrolysis', key: '4', name: 'Eletrólise', turn: true, eff: '+O₂' },
  { id: 'Repair', key: '5', name: 'Reparar', turn: true, eff: '+casco' },
  { id: 'Descend', key: '6', name: 'Descer ▼', turn: true, eff: 'zona mais funda', why: 'já no fundo' },
  { id: 'Ascend', key: '7', name: 'Subir ▲', turn: true, eff: 'zona mais rasa', why: 'já no gelo' },
  { id: 'VentCharge', key: '8', name: 'Recarregar', turn: true, eff: '+energia na fonte', why: 'só no campo hidrotermal' },
  { id: 'TalkBase', key: '9', name: 'Falar c/ base', turn: true, eff: '+moral' },
  { id: 'Rest', key: '0', name: 'Descansar', turn: true, eff: '+8 moral, +4 energia' },
  { id: 'Eva', key: 'E', name: 'Sair (EVA)', turn: true, eff: 'caminhada com o traje', why: 'precisa da eclusa' },
  { id: 'Dock', key: 'A', name: 'Acoplar', turn: true, eff: 'termina a missão', why: 'falta cumprir a meta' },
];

export const EVA_SAMPLES = {
  0: [['Cristal de salmoura', 'Gelo com tanto sal que não congela por inteiro.'], ['Gelo com bolhas antigas', 'Bolhas de gás presas no gelo guardam a química de antes.'], ['Crosta de sal', 'Sal que veio de baixo e grudou no teto de gelo.'], ['Amostra de gelo azul', 'Gelo muito compactado, sem bolhas, absorve o vermelho e parece azul.']],
  2: [['Mineral de sulfeto', 'Minerais que a água quente deposita ao esfriar, como nas chaminés da Terra.'], ['Tapete laranja', 'Pode ser vida microbiana ou só ferro oxidado. Só o laboratório vai dizer.'], ['Frasco de água quente', 'Água a 60 °C, rica em minerais dissolvidos.'], ['Basalto', 'Rocha vulcânica: o fundo de Europa pode ter vulcanismo.']],
  3: [['Sedimento fino', 'Pó que se acumula devagar no fundo há milhões de anos.'], ['Cristal de sal do fundo', 'Sais crescendo onde a água fica parada.'], ['Rocha da fenda', 'Uma rocha nova, exposta quando o fundo se abriu.'], ['Água da fenda', 'Água mais quente que a do entorno: sinal de calor interno.']],
};

const FILES = ['missoes', 'tripulacao', 'lancamento', 'cenarios', 'zonas', 'alvos', 'eventos', 'modulos', 'upgrades', 'pesquisa', 'textos'];

export async function loadDB(base = 'data/') {
  const parts = await Promise.all(FILES.map(f => fetch(base + f + '.json').then(r => { if (!r.ok) throw new Error(f + ': ' + r.status); return r.json(); })));
  const [missions, crew, launches, scenarios, zones, targets, events, modules, upgrades, research, text] = parts;
  const db = { missions, crew, launches, scenarios, zones, targets, events, modules, upgrades, research, text };
  const idx = (list) => Object.fromEntries(list.map(x => [x.id, x]));
  db.M = idx(missions); db.C = idx(crew); db.L = idx(launches); db.S = idx(scenarios); db.T = idx(targets);
  db.MOD = idx(modules); db.UP = idx(upgrades); db.R = idx(research);
  return db;
}

export const pressureBar = km => {
  const ice = Math.min(km, CONFIG.iceKm) * 1000, water = Math.max(0, km - CONFIG.iceKm) * 1000;
  return Math.round((917 * CONFIG.G * ice + 1030 * CONFIG.G * water) / 1e5);
};
export const dec = (v, d) => v.toFixed(d).replace('.', ',');
export const thousands = v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const pad = n => String(n).padStart(2, '0');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Gerador pseudoaleatório com semente (mulberry32), para o simulador repetir resultados. */
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export class Game {
  constructor(db, rng = Math.random) {
    this.db = db; this.rng = rng;
    this.hooks = {}; // log(text, kind), sfx(id), scenario(sc, explain, speaker)
    this.reset();
  }
  R() { return this.rng(); }
  pick(list) { return list && list.length ? list[Math.floor(this.R() * list.length)] : undefined; }
  log(text, kind = 'normal') { (this.hooks.log || (() => {}))(text, kind); }
  sfx(id, ...a) { (this.hooks.sfx || (() => {}))(id, ...a); }

  reset() {
    this.S = {
      cycle: 1, turns: CONFIG.turnsPerCycle, zone: 0, blackouts: 0, anomalies: 0, deepest: 0,
      o2: CONFIG.startO2, energy: CONFIG.startEnergy, hull: CONFIG.startHull, morale: CONFIG.startMorale,
      contact: null, found: new Set(), scans: [], diary: [],
      budget: 0, sciencePool: 0, scienceTotal: 0, scienceThisCycle: 0, budgetSpent: 0,
      modules: new Set(), upgrades: {}, research: new Set(), power: { life: 2, prop: 2, instr: 2 },
      protagonist: 'menina', missionId: this.db.missions[0].id, launchId: 'falcon', trajectoryId: 'mega',
      crew: new Set(this.db.crew.filter(c => c.mandatory).map(c => c.id)),
      flags: new Set(), seen: new Set(), talked: new Set(), talkIdx: {}, decisions: [], purchases: [],
      evaCount: 0, evaSamples: 0, crewSalaries: 0, launchCost: 0,
      over: false, win: false, endReason: null, history: [],
    };
    this.pending = null;
    this.forest = null;
    this.recompute();
  }

  // ------------------------------------------------------------------ atalhos
  get mission() { return this.db.M[this.S.missionId]; }
  get rocket() { return this.db.L[this.S.launchId]; }
  get trajectory() { return this.db.L[this.S.trajectoryId]; }
  level(id) { return this.S.upgrades[id] || 0; }
  has(id) { return this.S.modules.has(id) || this.S.research.has(id); }
  onBoard(id) { const c = this.db.C[id]; return !!c && (c.atBase || this.S.crew.has(id)); }
  protagonistName() { return this.S.protagonist === 'menina' ? 'Cadete Luísa' : 'Cadete Téo'; }
  gender(s) { return (s || '').replace(/\{o\}/g, this.S.protagonist === 'menina' ? 'a' : 'o'); }

  // ------------------------------------------------------------------ modificadores (MissionModifiers.cs)
  recompute() {
    const S = this.S, m = {};
    const thr = this.level('Thrusters'), scn = this.level('Scanner'), flood = this.level('Floodlight');
    const prop = S.power.prop - 2, instr = S.power.instr - 2, life = S.power.life - 2;
    const crew = id => S.crew.has(id);
    m.maxEnergy = 100 + 20 * this.level('Battery');
    m.Explore = Math.max(3, 8 - prop - thr * 2);
    m.Descend = Math.max(4, 10 - prop - thr * 2);
    m.Ascend = Math.max(3, 8 - prop - thr * 2);
    m.Scan = Math.max(2, 6 - scn * 2);
    m.Sonar = S.modules.has('SonarStation') ? 0 : 3;
    m.Electrolysis = 14; m.Repair = 10; m.Eva = 6;
    m.scienceMult = Math.max(0.4, 1 + (S.modules.has('Lab') ? 0.5 : 0) + 0.15 * instr + 0.25 * scn + (S.research.has('Mise') ? 0.25 : 0));
    m.o2PerCycle = Math.max(3, CONFIG.lifeO2 - 2 * life - (S.modules.has('Greenhouse') ? 5 : 0));
    m.generator = CONFIG.generator + (S.modules.has('Rtg') ? 6 : 0);
    m.systems = CONFIG.systems;
    m.pressureReduction = this.level('Hull');
    m.moraleLossReduction = flood + (S.modules.has('Commons') ? 1 : 0);
    m.contactChance = 0.85 + 0.05 * flood + (S.research.has('Reason') ? 0.15 : 0);
    if (S.modules.has('SonarStation')) m.contactChance = 1;
    m.contactChance = Math.min(1, m.contactChance);
    const thermal = S.research.has('EThemis');
    m.ventEnergy = thermal ? 45 : 30; m.ventHull = thermal ? 3 : 6;
    m.electroO2 = S.research.has('Maspex') ? 26 : 18;
    m.turnsPerCycle = CONFIG.turnsPerCycle + (S.research.has('EuropaUvs') ? 1 : 0);
    m.negativeEventMult = S.research.has('Gravity') ? 0.6 : 1;
    m.currentDamageMult = S.research.has('Ecm') ? 0.5 : 1;
    m.budgetPerCycle = CONFIG.baseFunding + (S.modules.has('Antenna') ? 8 : 0);
    m.budgetPerScan = S.research.has('Eis') ? 4 : 0;
    m.talkBonus = S.modules.has('Commons') ? 5 : 0;
    m.dockRepair = S.modules.has('RepairDock') ? 10 : 0;
    m.repairAmount = 16; m.riskHullMult = 1;
    if (crew('adwoa')) { m.moraleLossReduction += 2; m.talkBonus += 4; }
    if (crew('anja')) { m.repairAmount += 10; if (m.dockRepair > 0) m.dockRepair += 5; }
    if (crew('sayaka')) m.scienceMult += 0.2;
    if (crew('jaciara')) { m.contactChance = Math.min(1, m.contactChance + 0.1); m.Explore = Math.max(2, m.Explore - 1); }
    if (crew('noor')) m.budgetPerCycle += 6;
    if (crew('johann')) m.riskHullMult = 0.7;
    if (crew('mikolaj')) { m.Descend = Math.max(2, m.Descend - 2); m.Ascend = Math.max(2, m.Ascend - 2); }
    if (crew('jihoon')) { m.Sonar = 0; m.Scan = Math.max(1, m.Scan - 1); m.contactChance = Math.min(1, m.contactChance + 0.05); }
    m.moralePerCycle = S.modules.has('Quarters') ? 4 : 0;
    const air = this.level('Airlock');
    m.evaAllowed = air >= 1; m.evaSuitSeconds = air >= 2 ? 84 : 60;
    this.mods = m;
    S.energy = Math.min(S.energy, m.maxEnergy);
    return m;
  }
  cost(id) { return this.mods[id] || 0; }

  // ------------------------------------------------------------------ projeto da missão
  setProtagonist(p) { this.S.protagonist = p; }
  selectMission(id) { this.S.missionId = id; }
  selectLaunch(id) { const l = this.db.L[id]; if (l.trajectory) this.S.trajectoryId = id; else this.S.launchId = id; }
  toggleCrew(id) { const c = this.db.C[id]; if (!c || c.mandatory) return; if (!this.S.crew.delete(id)) this.S.crew.add(id); this.recompute(); }
  crewSalaries() { return this.db.crew.filter(c => this.S.crew.has(c.id)).reduce((a, c) => a + c.salary, 0); }
  designBudget() { return (this.mission ? this.mission.budget : 200) - (this.rocket ? this.rocket.cost : 0) - (this.trajectory ? this.trajectory.cost : 0) - this.crewSalaries(); }
  capacity() { return (this.rocket ? this.rocket.capacity : 18) * (this.trajectory ? this.trajectory.capacity : 1); }
  massUsed() {
    let m = CONFIG.baseMassT;
    for (const c of this.db.crew) if (this.S.crew.has(c.id)) m += c.mass;
    for (const md of this.db.modules) if (this.S.modules.has(md.id)) m += md.mass;
    for (const u of this.db.upgrades) for (let i = 0; i < this.level(u.id); i++) m += u.mass[i];
    return m;
  }
  designProblem() {
    if (!this.mission) return 'escolha uma missão no mapa';
    if (this.designBudget() < 0) return 'a verba não fecha: tire alguém da equipe ou escolha um foguete mais barato';
    if (this.massUsed() > this.capacity() + 1e-6) return 'carga demais para este foguete e trajetória';
    return null;
  }
  confirmDesign(seed) {
    if (this.designProblem()) return false;
    const S = this.S, m = this.mission, r = this.rocket, t = this.trajectory;
    S.budget = this.designBudget();
    S.launchCost = r.cost + t.cost; S.crewSalaries = this.crewSalaries();
    S.morale = clamp(S.morale + t.morale, 10, 100);
    S.hull = clamp(S.hull + t.hull, 10, 100);
    S.decisions = [
      'Missão: ' + m.name + ' (' + m.site + ')',
      'Foguete: ' + r.name + ' · −' + r.cost + ' de verba · ' + dec(r.capacity, 0) + ' t',
      'Trajetória: ' + t.name + ' · ' + dec(t.years, 1) + ' anos · carga ×' + dec(t.capacity, 2) +
        (t.morale ? ' · moral ' + (t.morale > 0 ? '+' : '') + t.morale : '') + (t.hull ? ' · casco ' + t.hull + '%' : ''),
    ];
    const extra = this.db.crew.filter(c => S.crew.has(c.id) && !c.mandatory).map(c => c.short);
    S.decisions.push('Equipe extra: ' + (extra.length ? extra.join(', ') : 'ninguém (só o comandante)') + ' · salários −' + S.crewSalaries);
    this.forest = new ScenarioForest(this.db.scenarios, seed ?? Math.floor(this.R() * 1e9), this.rng);
    this.recompute();
    this.snapshot();
    return true;
  }
  goalText() {
    const m = this.mission;
    const zones = m.requiredZones.map(z => this.db.zones[z].short).join(', ');
    return m.scans + ' descobertas, com pelo menos uma em: ' + zones + '. Depois volte à Interface e acople até o ciclo ' + CONFIG.maxCycles + '. Agora: ' + this.S.scans.length + '/' + m.scans + '.';
  }

  // ------------------------------------------------------------------ planejamento
  canBuyModule(id) {
    const m = this.db.MOD[id];
    if (!m || this.S.modules.has(id)) return 'já construído';
    if (this.S.budget < m.cost) return 'verba insuficiente';
    if (this.massUsed() + m.mass > this.capacity() + 1e-3) return 'sem capacidade no foguete (' + dec(this.capacity() - this.massUsed(), 1) + ' t livres)';
    return null;
  }
  buyModule(id) {
    if (this.canBuyModule(id)) return false;
    const m = this.db.MOD[id];
    this.S.budget -= m.cost; this.S.budgetSpent += m.cost; this.S.modules.add(id);
    this.S.purchases.push('Construído: ' + m.name + ' (ciclo ' + this.S.cycle + ')');
    this.recompute(); return true;
  }
  canBuyUpgrade(id) {
    const u = this.db.UP[id], lv = this.level(id);
    if (!u || lv >= u.costs.length) return 'nível máximo';
    if (this.S.zone !== 0) return 'só com o submarino na Interface';
    if (this.S.budget < u.costs[lv]) return 'verba insuficiente';
    if (this.massUsed() + u.mass[lv] > this.capacity() + 1e-3) return 'sem capacidade no foguete (' + dec(this.capacity() - this.massUsed(), 1) + ' t livres)';
    return null;
  }
  buyUpgrade(id) {
    if (this.canBuyUpgrade(id)) return false;
    const u = this.db.UP[id], lv = this.level(id);
    this.S.budget -= u.costs[lv]; this.S.budgetSpent += u.costs[lv];
    this.S.upgrades[id] = lv + 1;
    if (id === 'Battery') this.S.energy += 20;
    this.S.purchases.push('Instalado: ' + u.name + ' Nv' + (lv + 1) + ' (ciclo ' + this.S.cycle + ')');
    this.recompute(); return true;
  }
  canBuyResearch(id) {
    const r = this.db.R[id];
    if (!r || this.S.research.has(id)) return 'já pesquisado';
    if (this.S.sciencePool < r.cost) return 'faltam dados';
    return null;
  }
  buyResearch(id) {
    if (this.canBuyResearch(id)) return false;
    const r = this.db.R[id];
    this.S.sciencePool -= r.cost; this.S.research.add(id);
    this.S.purchases.push('Pesquisa: ' + r.instrument + ' (ciclo ' + this.S.cycle + ')');
    this.recompute(); return true;
  }
  adjustPower(sys, d) {
    const p = this.S.power, v = p[sys] + d, used = p.life + p.prop + p.instr + d;
    if (v < 0 || v > CONFIG.maxCellsPerSystem || used > CONFIG.powerCells) return false;
    p[sys] = v; this.recompute(); return true;
  }

  // ------------------------------------------------------------------ regras
  zonesDone() { const z = new Set(); for (const s of this.S.scans) z.add(this.db.T[s.id].zone); return z; }
  goalMet() {
    const zd = this.zonesDone();
    return this.mission.requiredZones.every(z => zd.has(z)) && this.S.scans.length >= this.mission.scans;
  }
  remainingInZone(z = this.S.zone) { return this.db.targets.filter(t => t.zone === z && !this.S.found.has(t.id)).length; }

  check(id) {
    const S = this.S, a = ACTIONS.find(x => x.id === id);
    if (!a || S.over) return 'indisponível';
    if (a.turn && S.turns <= 0) return 'sem turnos';
    if (S.energy < this.cost(id)) return 'sem energia';
    switch (id) {
      case 'Scan': return S.contact ? null : a.why;
      case 'Descend': {
        if (S.zone >= this.db.zones.length - 1) return a.why;
        const nx = this.db.zones[S.zone + 1];
        if (this.level('Hull') < nx.hullLevel) return 'precisa de casco Nv' + nx.hullLevel;
        return null;
      }
      case 'Ascend': return S.zone > 0 ? null : a.why;
      case 'VentCharge': return S.zone === 2 ? null : a.why;
      case 'Dock': return S.zone === 0 && this.goalMet() ? null : (S.zone !== 0 && this.goalMet() ? 'suba até a Interface' : a.why);
      case 'Eva':
        if (!this.mods.evaAllowed) return a.why;
        if (S.zone === 1) return 'sem chão nem teto aqui';
        return null;
    }
    return null;
  }

  /** Executa uma ação. Devolve um objeto com o que a interface precisa animar. */
  act(id) {
    if (this.check(id)) return null;
    const S = this.S, a = ACTIONS.find(x => x.id === id), out = { id };
    S.energy -= this.cost(id);
    switch (id) {
      case 'Explore': {
        const left = this.db.targets.filter(t => t.zone === S.zone && !S.found.has(t.id));
        const prev = S.contact; S.contact = null;
        let tgt = null;
        if (left.length && this.R() < this.mods.contactChance) {
          const pool = left.filter(t => t.id !== prev);
          tgt = this.pick(pool.length ? pool : left);
        }
        out.contact = tgt;
        if (tgt) { S.contact = tgt.id; this.log('Contato ' + tgt.code + ' a 14 m. Assinatura desconhecida. O scanner pode identificar.'); }
        else if (!left.length) this.log('O sonar não encontra nada novo nesta zona. Tudo aqui já foi registrado.', 'sys');
        else this.log('Só neve marinha passando pelo farol. Nenhum contato.', 'sys');
        if (this.R() < 0.18 && this.forest) {
          const sc = this.forest.pick(this, true);
          if (sc) out.scenario = { sc, explain: this.forest.explain(sc) };
        }
        if (!out.scenario && S.zone >= 2 && this.R() < 0.15) {
          const d = Math.round((3 + this.R() * 3) * this.mods.currentDamageMult);
          S.hull -= d; out.bump = true;
          this.log('Você raspou numa rocha que o farol não mostrou. Casco −' + d + '%.', 'warn');
        }
        break;
      }
      case 'Scan': {
        const t = this.db.T[S.contact];
        const focus = this.mission.focusZones.includes(t.zone);
        const sci = Math.round(t.science * this.mods.scienceMult * (focus ? 1.25 : 1));
        S.found.add(t.id); S.scans.push({ id: t.id, cycle: S.cycle, science: sci });
        S.morale += t.morale; S.contact = null;
        S.sciencePool += sci; S.scienceTotal += sci; S.scienceThisCycle += sci;
        S.budget += this.mods.budgetPerScan;
        out.target = t; out.science = sci; out.focus = focus;
        this.log('SCAN ' + t.code + ' · ' + t.name.toUpperCase() + ' · +' + sci + ' dados' + (this.mods.budgetPerScan ? ' · +' + this.mods.budgetPerScan + ' verba' : ''), 'disc');
        this.log(t.desc);
        this.log('DADO REAL · ' + t.fact + ' [' + t.src + ']', 'fact');
        if (focus) this.log('Este alvo responde à pergunta da missão: +25% de dados.', 'good');
        if (this.goalMet()) this.log('Objetivo científico cumprido. Volte para a Interface gelo-oceano e acople à base.', 'good');
        else this.log('Descobertas: ' + S.scans.length + '/' + this.mission.scans + '.', 'sys');
        break;
      }
      case 'Sonar': {
        const left = this.remainingInZone();
        out.left = left;
        this.log('Sonar: ' + (left > 0 ? left + ' assinatura' + (left > 1 ? 's' : '') + ' sem registro nesta zona.' : 'nada novo nesta zona.'), 'sys');
        break;
      }
      case 'Electrolysis':
        S.o2 += this.mods.electroO2;
        this.log('Eletrólise: a água do mar vira hidrogênio e oxigênio. +' + this.mods.electroO2 + '% O₂.', 'good');
        break;
      case 'Repair':
        S.hull += this.mods.repairAmount;
        this.log('Soldas reforçadas com o braço robótico. +' + this.mods.repairAmount + '% casco.' + (S.crew.has('anja') ? ' (A Anja ajudou.)' : ''), 'good');
        break;
      case 'Descend': case 'Ascend': {
        const dir = id === 'Descend' ? 1 : -1, from = S.zone;
        S.zone += dir; S.contact = null; S.deepest = Math.max(S.deepest, S.zone);
        const Z = this.db.zones[S.zone];
        out.dir = dir;
        this.log((dir > 0 ? 'Lastro cheio. Descendo' : 'Lastro vazio. Subindo') + ' para: ' + Z.name.toUpperCase() + ', ' + dec(Z.depthKm, 1) + ' km abaixo da superfície do gelo.', 'sys');
        this.log(Z.arrival);
        if (from === 0 && S.zone === 1) this.log('Dica: cada zona tem 4 coisas para descobrir.', 'sys');
        if (S.zone === 0) this.log('De volta à Interface. No próximo planejamento dá para instalar upgrades no submarino.', 'sys');
        break;
      }
      case 'VentCharge':
        S.energy += this.mods.ventEnergy; S.hull -= this.mods.ventHull; S.morale -= 1;
        this.log('Gerador termoelétrico encostado na fonte. A água a 300 °C esquenta o casco por fora. +' + this.mods.ventEnergy + ' energia, −' + this.mods.ventHull + '% casco.', 'good');
        break;
      case 'TalkBase': {
        let line, gain;
        if (S.morale > 60) { line = this.pick(this.db.text.baseCalm); gain = 10; }
        else if (S.morale > 45) { line = this.pick(this.db.text.baseWorried); gain = 6; }
        else { line = this.pick(this.db.text.baseTired); gain = 4; }
        gain += this.mods.talkBonus;
        S.morale += gain;
        out.line = line.replace(/^LÚCIA[^:]*:\s*/, '');
        this.log(line + ' (moral +' + gain + ')');
        break;
      }
      case 'Rest':
        S.morale += 8; S.energy += 4;
        this.log('Luzes apagadas. Só o zumbido do gerador e as bolhas. +8 moral, +4 energia.', 'good');
        break;
      case 'Eva':
        S.evaCount++;
        out.eva = { zone: S.zone, seconds: this.mods.evaSuitSeconds, fact: this.db.text.eva[this.db.zones[S.zone].short] || '',
          samples: EVA_SAMPLES[S.zone].map(([name, info]) => ({ name, info, science: 6 + Math.floor(this.R() * 5) })) };
        break;
      case 'Dock':
        this.log('Acoplando ao cryobot… travas fechadas.', 'good');
        out.finish = 'win';
        break;
    }
    if (a.turn) S.turns--;
    this.clamp();
    if (out.finish) this.finish(out.finish);
    else this.checkEnd();
    return out;
  }

  evaResult(collected, aborted) {
    const S = this.S;
    let sci = 0;
    for (const s of collected) sci += Math.round(s.science * this.mods.scienceMult);
    S.sciencePool += sci; S.scienceTotal += sci; S.scienceThisCycle += sci; S.evaSamples += collected.length;
    S.o2 -= 3;
    if (aborted) { S.morale -= 5; this.log('O oxigênio do traje acabou e o cabo de segurança puxou você de volta. Susto, mas tudo bem. Moral −5.', 'warn'); }
    else S.morale += 4;
    this.log('EVA concluída: ' + collected.length + ' amostras · +' + sci + ' dados · O₂ do submarino −3% (eclusa).', 'disc');
    this.clamp(); this.checkEnd();
    return sci;
  }

  // ------------------------------------------------------------------ cenários
  effectSummary(c) {
    const parts = [];
    const P = (v, n) => { if (v && Math.abs(v) > 0.01) parts.push((v > 0 ? '+' : '') + Math.round(v) + ' ' + n); };
    P(c.science, 'dados'); P(c.budget, 'verba'); P(c.energy, 'energia'); P(c.hull, 'casco'); P(c.o2, 'O₂'); P(c.morale, 'moral');
    return parts.length ? parts.join(' · ') : 'sem custo';
  }
  choiceBlocked(c) {
    if (c.needCrew && !this.onBoard(c.needCrew)) return 'precisa de ' + (this.db.C[c.needCrew]?.short || c.needCrew) + ' na equipe';
    if (c.needBudget && this.S.budget < c.needBudget) return 'verba insuficiente';
    return null;
  }
  scenarioSpeaker(sc) { return this.onBoard(sc.speaker) ? sc.speaker : 'daniel'; }
  startScenario(sc) { this.S.seen.add(sc.id); this.log('CENÁRIO · ' + sc.title, 'sys'); }
  /** Aplica a escolha. Devolve o cenário seguinte (ramo), se houver. */
  choose(sc, c) {
    const S = this.S;
    const hull = (c.hull || 0) < 0 ? c.hull * this.mods.riskHullMult : (c.hull || 0);
    const sci = Math.round((c.science || 0) * this.mods.scienceMult);
    S.o2 += c.o2 || 0; S.energy += c.energy || 0; S.hull += hull; S.morale += c.morale || 0; S.budget += c.budget || 0;
    S.sciencePool += sci; S.scienceTotal += sci; S.scienceThisCycle += sci;
    if (c.setFlag) S.flags.add(c.setFlag);
    this.clamp();
    S.decisions.push('Ciclo ' + S.cycle + ' · ' + sc.title + ': ' + c.label);
    this.log(sc.title + ': ' + c.label + '. ' + c.result + ' (' + this.effectSummary(c) + ')', (c.hull < 0 || c.morale < 0) ? 'warn' : 'good');
    this.recompute();
    if (!S.over) this.checkEnd();
    return c.next ? this.db.S[c.next] : null;
  }
  takePending() { const p = this.pending; this.pending = null; return p; }

  // ------------------------------------------------------------------ conversas
  talk(id) {
    if (this.S.talked.has(id)) return 0;
    this.S.talked.add(id);
    const gain = 3 + this.mods.talkBonus * 0.5;
    this.S.morale = Math.min(100, this.S.morale + gain);
    return gain;
  }

  // ------------------------------------------------------------------ fim de ciclo
  endCycle() {
    const S = this.S, M = this.mods, Z = this.db.zones[S.zone], c0 = S.cycle;
    let pressure = Math.max(0, Z.hullLoss - M.pressureReduction);
    const moraleLoss = Math.max(0, Z.moraleLoss - M.moraleLossReduction);
    if (S.zone === 0 && S.crew.has('mikolaj')) pressure = Math.max(0, pressure - 1);
    S.energy += M.generator - M.systems;
    S.o2 -= M.o2PerCycle; S.hull -= pressure; S.morale -= moraleLoss; S.morale += M.moralePerCycle;
    const report = { cycle: c0, zone: Z.name, lines: [] };
    report.lines.push('Gerador +' + M.generator + ', sistemas −' + M.systems + ' energia · suporte vital −' + M.o2PerCycle + '% O₂ · pressão −' + pressure + '% casco');
    this.log('— CICLO ' + pad(c0) + ' encerrado. Gerador +' + M.generator + ', sistemas −' + M.systems + ' energia. Suporte vital −' + M.o2PerCycle + '% O₂. Pressão −' + pressure + '% casco.', 'sys');
    let note = '';
    if (S.energy <= 0) {
      S.energy = 0; S.blackouts++; S.o2 -= 8; S.morale -= 8; note = 'blecaute';
      this.log('BLECAUTE. O farol, o aquecedor e o sonar apagaram por horas.' + (S.blackouts >= 2 ? ' De novo.' : ' Se acontecer de novo, a base vai ter que puxar você.'), 'crit');
      report.lines.push('BLECAUTE no fim do ciclo.'); report.blackout = true;
    } else S.blackouts = 0;
    if (S.hull < 35) { S.o2 -= 4; this.log('O casco fraco está deixando entrar água nas juntas. O₂ −4%.', 'warn'); }
    if (S.zone === 0 && M.dockRepair > 0) { S.hull += M.dockRepair; report.lines.push('Doca de manutenção: +' + M.dockRepair + '% casco'); }
    let ev = '';
    if (this.R() < 0.75) { const e = this.pickEvent(); if (e) ev = this.runEvent(e); }
    if (ev) report.event = ev;
    if (this.forest && this.R() <= 0.7) {
      const sc = this.forest.pick(this, false);
      if (sc) this.pending = { sc, explain: this.forest.explain(sc) };
    }
    S.talked.clear();
    const fromScience = Math.round(S.scienceThisCycle * CONFIG.fundingPerScience);
    const funding = M.budgetPerCycle + fromScience;
    S.budget += funding;
    report.funding = funding;
    report.lines.push('Verba recebida da NASA: +' + funding + ' (' + M.budgetPerCycle + ' fixa + ' + fromScience + ' pelos ' + S.scienceThisCycle + ' dados do ciclo)');
    this.clamp();
    S.diary.push({ cycle: c0, zone: Z.name, o2: Math.round(S.o2), energy: Math.round(S.energy), hull: Math.round(S.hull), morale: Math.round(S.morale),
      budget: funding, science: S.scienceThisCycle, scans: S.scans.filter(s => s.cycle === c0).map(s => this.db.T[s.id].name), event: ev, note });
    S.cycle++; S.scienceThisCycle = 0;
    this.recompute();
    S.turns = this.mods.turnsPerCycle;
    this.snapshot();
    this.checkEnd();
    return report;
  }
  snapshot() {
    const S = this.S;
    S.history.push({ cycle: S.cycle, o2: Math.round(S.o2), energy: Math.round(S.energy), hull: Math.round(S.hull), morale: Math.round(S.morale), budget: S.budget, science: S.scienceTotal, scans: S.scans.length, zone: S.zone });
  }
  pickEvent() {
    const S = this.S;
    const pool = this.db.events.filter(e => (e.minZone < 0 || S.zone >= e.minZone) && (e.exactZone < 0 || S.zone === e.exactZone));
    const W = e => e.weight * (e.negative ? this.mods.negativeEventMult : 1) * (e.countsAnomaly ? 0.5 : 1);
    let r = this.R() * pool.reduce((a, e) => a + W(e), 0);
    for (const e of pool) { r -= W(e); if (r <= 0) return e; }
    return pool[pool.length - 1];
  }
  runEvent(e) {
    const S = this.S;
    let hull = e.hull - (e.hullRandom > 0 ? this.R() * e.hullRandom : 0);
    if (e.isCurrent) hull *= this.mods.currentDamageMult;
    hull = Math.round(hull);
    S.o2 += e.o2; S.energy += e.energy; S.hull += hull; S.morale += e.morale; S.budget += e.budget;
    if (e.countsAnomaly) S.anomalies++;
    let line = this.pick(e.lines).replace('{bar}', thousands(pressureBar(this.db.zones[S.zone].depthKm)));
    if (e.isCurrent) line += ' Casco ' + hull + '%.';
    const kind = { Warn: 'warn', Good: 'good', Strange: 'strange', Sys: 'sys' }[e.kind] || 'normal';
    this.log(line, kind);
    this.sfx(e.sfx);
    return line;
  }

  // ------------------------------------------------------------------ finais
  clamp() {
    const S = this.S;
    S.o2 = clamp(S.o2, 0, 100); S.energy = clamp(S.energy, 0, this.mods.maxEnergy);
    S.hull = clamp(S.hull, 0, 100); S.morale = clamp(S.morale, 0, 100); S.budget = Math.max(0, S.budget);
  }
  checkEnd() {
    const S = this.S;
    if (S.over) return S.endReason;
    let why = null;
    if (S.o2 <= 0) why = 'o2'; else if (S.hull <= 0) why = 'hull'; else if (S.morale <= 0) why = 'morale';
    else if (S.blackouts >= 2) why = 'energy'; else if (S.cycle > CONFIG.maxCycles) why = 'time';
    if (why) this.finish(why);
    return why;
  }
  finish(why) {
    const S = this.S;
    if (S.over) return;
    S.over = true; S.win = why === 'win'; S.endReason = why;
    S.score = this.score(); S.grade = this.grade(S.score);
    if (!S.history.length || S.history[S.history.length - 1].cycle !== S.cycle || true) this.snapshot();
  }
  score() { const S = this.S; return S.scienceTotal + S.modules.size * 15 + S.research.size * 10 + Object.values(S.upgrades).reduce((a, b) => a + b, 0) * 8 + (S.win ? 100 : 0) + S.evaSamples * 5 + Math.round(S.morale / 2); }
  grade(score) { return this.S.win ? (score >= 380 ? 'S' : score >= 300 ? 'A' : score >= 220 ? 'B' : 'C') : (score >= 200 ? 'C' : 'D'); }

  ending() {
    const S = this.S, Z = this.db.zones[S.zone], tired = S.win && S.morale < 35;
    const E = {
      win: [tired ? 'Missão concluída, com custo' : 'Missão concluída', 'De volta ao gelo',
        'A TÉTIS-7 encaixou no cryobot. Os dados de ' + S.scans.length + ' descobertas sobem pelo cabo, atravessam 20 km de gelo e partem para a Terra. ' + this.mission.win + (tired ? ' A equipe está exausta: da próxima vez, mais descanso.' : ' A Lúcia abre a escotilha e diz que vocês estão com cheiro de mar.')],
      o2: ['Missão abortada · suporte vital', 'Reserva de ar no limite', 'O CO₂ subiu e o alarme não parou mais. A base acionou o resgate de emergência e puxou a TÉTIS-7 pelo cabo, 20 km para cima. Você chegou tont' + (S.protagonist === 'menina' ? 'a' : 'o') + ', mas viv' + (S.protagonist === 'menina' ? 'a' : 'o') + '. Lição: oxigênio é o recurso que não perdoa.'],
      hull: ['Missão abortada · falha estrutural', 'O casco não aguentou', 'A ' + dec(Z.depthKm, 1) + ' km de profundidade, a pressão passa de ' + thousands(pressureBar(Z.depthKm)) + ' bar. Uma junta cedeu, o lastro de emergência soltou e o submarino subiu sozinho até o poço. Todos estão bem, mas a missão acabou. Lição de engenharia: casco é investimento, não gasto.'],
      energy: ['Missão abortada · falha de energia', 'Escuridão total', 'Dois blecautes seguidos. A base puxou o cabo devagar, por horas. Lição de engenharia: o orçamento de energia precisa de margem, como o das sondas reais.'],
      morale: ['Missão abortada · equipe exausta', 'Hora de voltar', 'A moral da equipe chegou a zero: ninguém dormia direito e os erros começaram a aparecer. A Lúcia mandou recolher o cabo. Lição: pessoas também são um recurso da missão.'],
      time: ['Missão encerrada', 'O cabo foi recolhido', 'O ciclo ' + CONFIG.maxCycles + ' terminou e a base precisou recolher o cryobot antes que o gelo fechasse o furo. Os dados coletados seguem para a Terra, mas a pergunta da missão ficou sem resposta completa.'],
    };
    const [kicker, title, body] = E[S.endReason] || E.time;
    return { kicker, title, body };
  }
}
