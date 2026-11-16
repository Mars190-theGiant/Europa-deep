// Idioma da interface. Inglês é o padrão; português é opcional (?lang=pt ou o botão PT/EN).
// A escolha fica guardada no navegador.
const KEY = 'abismo-lang';
function detect() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'pt' || q === 'en') { try { localStorage.setItem(KEY, q); } catch (e) {} return q; }
  } catch (e) {}
  try { const s = localStorage.getItem(KEY); if (s === 'pt' || s === 'en') return s; } catch (e) {}
  return 'en';
}
export const LANG = typeof location !== 'undefined' ? detect() : (globalThis.ABISMO_LANG || 'pt');
export const EN = LANG === 'en';

const fill = (s, v) => v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s;
/** Texto nos dois idiomas: tr('português {x}', 'English {x}', { x }). */
export const tr = (pt, en, v) => fill(EN ? en : pt, v);
/** Escolhe entre dois valores quaisquer. */
export const pick = (pt, en) => (EN ? en : pt);

/** Troca os textos estáticos do HTML. O HTML está em inglês; elementos com data-pt recebem o português. */
export function applyStatic(root = document) {
  document.documentElement.lang = EN ? 'en' : 'pt-BR';
  if (!EN) {
    root.querySelectorAll('[data-pt]').forEach(el => { el.innerHTML = el.dataset.pt; });
    root.querySelectorAll('[data-pt-title]').forEach(el => { el.title = el.dataset.ptTitle; });
    root.querySelectorAll('[data-pt-aria]').forEach(el => { el.setAttribute('aria-label', el.dataset.ptAria); });
    const t = document.querySelector('meta[name="title-pt"]');
    if (t) document.title = t.content;
    const d = document.querySelector('meta[name="description"]'), dp = document.querySelector('meta[name="description-pt"]');
    if (d && dp) d.content = dp.content;
  }
  root.querySelectorAll('[data-lang-toggle]').forEach(b => {
    b.innerHTML = EN ? '<b>EN</b> · PT' : 'EN · <b>PT</b>';
    b.title = EN ? 'Mudar para português' : 'Switch to English';
    b.setAttribute('aria-label', b.title);
    b.addEventListener('click', () => setLang(EN ? 'pt' : 'en'));
  });
}

export function setLang(l) {
  try { localStorage.setItem(KEY, l); } catch (e) {}
  const u = new URL(location.href);
  u.searchParams.set('lang', l);
  location.href = u.toString();
}

/** Mescla a camada em inglês (data/en.json) nos dados em português. */
export function mergeEN(db, en) {
  const byId = (list, map) => { if (!map) return; for (const x of list) if (map[x.id]) deep(x, map[x.id]); };
  const deep = (dst, src) => {
    for (const [k, v] of Object.entries(src)) {
      if (Array.isArray(v) && Array.isArray(dst[k]) && v.length && typeof v[0] === 'object' && v[0] !== null) {
        v.forEach((o, i) => { if (dst[k][i] && typeof dst[k][i] === 'object') deep(dst[k][i], o); else dst[k][i] = o; });
      } else if (v && typeof v === 'object' && !Array.isArray(v) && dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])) deep(dst[k], v);
      else dst[k] = v;
    }
  };
  byId(db.missions, en.missions); byId(db.crew, en.crew); byId(db.launches, en.launches);
  byId(db.scenarios, en.scenarios); byId(db.targets, en.targets);
  byId(db.modules, en.modules); byId(db.upgrades, en.upgrades); byId(db.research, en.research);
  (en.zones || []).forEach((z, i) => db.zones[i] && Object.assign(db.zones[i], z));
  (en.events || []).forEach((e, i) => db.events[i] && Object.assign(db.events[i], e));
  if (en.text) for (const [k, v] of Object.entries(en.text)) db.text[k] = v;
}
