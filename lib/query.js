// Turns a structured builder state into a Google query string.
//
// State shape:
// {
//   profession: string[]   OR-group, optionally wrapped in intitle:
//   intitle:    boolean
//   location:   string[]   OR-group (a quest swaps in one value per search)
//   signals:    string[]   OR-group of old-site traces / builder credits / copyright years
//   required:   string[]   each one is ANDed
//   site:       string     site: filter, e.g. ".de" or "weebly.com"
//   excludes:   string[]   domains -> -site:domain
//   extra:      string     raw text appended as-is
// }

import { uniq } from './util.js';

export const SLOTS = [
  { key: 'profession', label: 'Niche / profession', placeholder: 'e.g. funeral home', hint: 'Synonyms are OR-combined. Tick intitle: to keep only pages with the niche in their title (mostly company homepages).' },
  { key: 'location', label: 'Location', placeholder: 'e.g. Dayton, OH · 33602 · Kreis Gütersloh', hint: 'City, "City, ST", ZIP or region, OR-combined. In a quest, each location becomes its own search.' },
  { key: 'signals', label: 'Old-site signals', placeholder: 'e.g. Copyright 2014 · Erstellt mit Jimdo', hint: 'Copyright years, builder credits and old-site traces, OR-combined. Google ignores ©, so write "Copyright 2015".' },
  { key: 'required', label: 'Must also contain', placeholder: 'e.g. Gästebuch', hint: 'Every term here is required (AND).' },
  { key: 'excludes', label: 'Exclude sites', placeholder: 'e.g. yelp.com', hint: 'Directories and social networks. Each becomes -site:domain.' },
];

export const SLOT_LABEL = {
  profession: 'Niche', location: 'Location', signals: 'Signals', required: 'Must contain',
  excludes: 'Exclude', site: 'Site filter', extra: 'Raw operator',
};

export const emptyState = () => ({
  profession: [], intitle: false, location: [], signals: [], required: [], site: '', excludes: [], extra: '',
});

export function normalizeState(s) {
  const e = emptyState();
  const src = s || {};
  for (const k of Object.keys(e)) {
    if (Array.isArray(e[k])) e[k] = Array.isArray(src[k]) ? src[k].map(String) : [];
    else if (typeof e[k] === 'boolean') e[k] = !!src[k];
    else e[k] = typeof src[k] === 'string' ? src[k] : '';
  }
  return e;
}

/** Terms that already carry operators, quotes or groups are inserted verbatim. */
export function isRaw(t) {
  return /^-?[a-z]+:/i.test(t) || t.startsWith('"') || t.startsWith('(') || /\sOR\s/.test(t);
}

export function fmtTerm(t, intitle = false) {
  const s = String(t || '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  if (isRaw(s)) return s;
  const q = '"' + s.replace(/"/g, '') + '"';
  return intitle ? 'intitle:' + q : q;
}

export function group(terms, intitle = false) {
  const parts = uniq((terms || []).map((t) => fmtTerm(t, intitle)).filter(Boolean));
  if (!parts.length) return '';
  return parts.length === 1 ? parts[0] : '(' + parts.join(' OR ') + ')';
}

export function normalizeDomain(d) {
  return String(d || '').trim().toLowerCase()
    .replace(/^-?site:/, '')
    .replace(/^[a-z]+:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[/?#].*$/, '');
}

export function buildQuery(state, overrides = {}) {
  const s = { ...normalizeState(state), ...overrides };
  const parts = [group(s.profession, s.intitle), group(s.location), group(s.signals)];
  for (const t of s.required) parts.push(fmtTerm(t));
  const site = s.site.trim().replace(/^site:/i, '');
  if (site) parts.push('site:' + site);
  if (s.extra.trim()) parts.push(s.extra.trim().replace(/\s+/g, ' '));
  for (const d of uniq(s.excludes.map(normalizeDomain).filter(Boolean))) parts.push('-site:' + d);
  return parts.filter(Boolean).join(' ');
}

/**
 * Rough count against Google's ~32-word query limit. Phrases count per word,
 * operators like site:x count once, the OR keyword is not counted.
 */
export function countWords(q) {
  return String(q || '')
    .replace(/[()"]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && w !== 'OR' && w !== '-' && w !== '|').length;
}

/** "Copyright 2010" … "Copyright 2018". */
export function yearTerms(from, to, step = 1, prefix = 'Copyright') {
  const a = Math.min(+from, +to), b = Math.max(+from, +to), st = Math.max(1, +step || 1);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return [];
  const out = [];
  for (let y = a; y <= b && out.length < 40; y += st) out.push(`${prefix} ${y}`.trim());
  return out;
}

export function googleUrl(q, settings = {}) {
  const p = new URLSearchParams({ q });
  if (settings.hl) p.set('hl', settings.hl);
  if (settings.gl) p.set('gl', settings.gl);
  return `https://www.${settings.googleDomain || 'google.com'}/search?${p}`;
}
