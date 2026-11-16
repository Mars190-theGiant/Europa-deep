// "Floresta aleatória" que escolhe qual cenário acontece (portada de ScenarioForest.cs).
// Cada árvore divide o estado da missão com cortes sorteados em atributos sorteados, como no Random Forest.
// Cada folha guarda pesos por cenário feitos por bootstrap (reamostragem) e pelas preferências de cada cenário.
// Na hora de sortear, todas as árvores votam, os votos são multiplicados pelo viés da missão e um cenário é sorteado.
import { tr } from './i18n.js';
import { mulberry } from './engine.js';

export const FEATURES = ['zona', 'ciclo', 'moral', 'casco', 'verba', 'energia', 'descobertas', 'missão'];
const MIN = [0, 1, 0, 0, 0, 0, 0, 0];
const MAX = [3, 12, 100, 100, 200, 140, 12, 3];

export class ScenarioForest {
  constructor(scenarios, seed, pickRng = Math.random, treeCount = 9, depth = 3) {
    this.pool = scenarios.filter(s => !s.branchOnly);
    this.rng = mulberry(seed);
    this.pickRng = pickRng;
    this.trees = [];
    for (let i = 0; i < treeCount; i++) this.trees.push(this.grow(MIN.slice(), MAX.slice(), depth));
    this.lastVotes = [];
  }
  R() { return this.rng(); }
  ri(n) { return Math.floor(this.R() * n); }
  grow(lo, hi, depth) {
    const n = { lo, hi };
    if (depth === 0) {
      n.bag = {};
      for (const s of this.pool) n.bag[s.id] = 0.25;
      for (let k = 0; k < this.pool.length; k++) n.bag[this.pool[this.ri(this.pool.length)].id] += 1;
      return n;
    }
    // subconjunto aleatório de atributos (raiz de 8 ≈ 3); fica o de maior intervalo ainda aberto
    let best = -1, bestSpan = -1;
    for (let k = 0; k < 3; k++) {
      const f = this.ri(FEATURES.length);
      const span = (hi[f] - lo[f]) / (MAX[f] - MIN[f]);
      if (span > bestSpan) { bestSpan = span; best = f; }
    }
    n.feature = best;
    n.threshold = lo[best] + (hi[best] - lo[best]) * (0.3 + 0.4 * this.R());
    const lhi = hi.slice(); lhi[best] = n.threshold;
    const rlo = lo.slice(); rlo[best] = n.threshold;
    n.left = this.grow(lo.slice(), lhi, depth - 1);
    n.right = this.grow(rlo, hi.slice(), depth - 1);
    return n;
  }
  leaf(n, x) { while (!n.bag) n = x[n.feature] <= n.threshold ? n.left : n.right; return n; }
  static affinity(s, leaf) {
    let a = 1;
    for (const p of s.prefs || []) {
      const mid = (leaf.lo[p.feature] + leaf.hi[p.feature]) / 2;
      const norm = (mid - MIN[p.feature]) / (MAX[p.feature] - MIN[p.feature]);
      if ((norm > 0.5) === p.high) a *= p.mult;
    }
    return a;
  }
  static featurize(g) {
    const S = g.S;
    const mi = g.db.missions.findIndex(m => m.id === S.missionId);
    return [S.zone, S.cycle, S.morale, S.hull, S.budget, S.energy, S.scans.length, Math.max(0, mi)];
  }
  static eligible(sc, g, dive) {
    const S = g.S;
    if (sc.branchOnly) return false;
    if (sc.once && S.seen.has(sc.id)) return false;
    if (dive && !sc.duringDive) return false;
    if (S.zone < sc.minZone || S.zone > sc.maxZone || S.cycle < sc.minCycle) return false;
    if (sc.requiresFlag && !S.flags.has(sc.requiresFlag)) return false;
    return true;
  }
  static bias(sc, mission) {
    let b = 1;
    for (const [tag, mult] of Object.entries(mission?.bias || {})) if (sc.tags.includes(tag)) b *= mult;
    return b;
  }
  pick(g, dive) {
    const x = ScenarioForest.featurize(g);
    const elig = this.pool.filter(sc => ScenarioForest.eligible(sc, g, dive));
    this.lastVotes = [];
    if (!elig.length) return null;
    const score = new Map(elig.map(e => [e, 0])), fav = new Map(elig.map(e => [e, 0]));
    for (const t of this.trees) {
      const lf = this.leaf(t, x);
      let sum = 0; const w = new Map();
      for (const e of elig) { const v = e.baseWeight * lf.bag[e.id] * ScenarioForest.affinity(e, lf); w.set(e, v); sum += v; }
      if (sum <= 0) continue;
      let best = null, bv = -1;
      for (const [e, v] of w) { score.set(e, score.get(e) + v / sum); if (v > bv) { bv = v; best = e; } }
      fav.set(best, fav.get(best) + 1);
    }
    let total = 0;
    for (const e of elig) { score.set(e, score.get(e) * ScenarioForest.bias(e, g.mission)); total += score.get(e); }
    this.lastVotes = elig.map(e => ({ sc: e, share: total ? score.get(e) / total : 0, trees: fav.get(e) })).sort((a, b) => b.share - a.share);
    let r = this.pickRng() * total;
    for (const e of elig) { r -= score.get(e); if (r <= 0) return e; }
    return elig[elig.length - 1];
  }
  explain(sc) {
    const v = this.lastVotes.find(x => x.sc === sc);
    if (!v) return '';
    const top = this.lastVotes.slice(0, 3).map(x => x.sc.title + ' ' + Math.round(x.share * 100) + '%');
    return tr('Floresta aleatória: {n} árvores votaram. Este cenário teve {p}% dos votos ({t} árvores o preferiram). Mais votados: {top}.',
      'Random forest: {n} trees voted. This scenario got {p}% of the votes ({t} trees preferred it). Most voted: {top}.',
      { n: this.trees.length, p: Math.round(v.share * 100), t: v.trees, top: top.join(', ') });
  }
  votes() { return this.lastVotes.map(v => ({ title: v.sc.title, share: v.share, trees: v.trees })); }
}
