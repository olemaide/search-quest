import { h, chipField, toast, form, copyText, opts, confirmDialog } from '../ui.js';
import { openSearch } from '../actions.js';
import * as store from '../../lib/store.js';
import { SLOTS, SLOT_LABEL, buildQuery, countWords, yearTerms, emptyState, normalizeState, normalizeDomain } from '../../lib/query.js';
import { CITY_LISTS } from '../../lib/defaults.js';
import { uid, uniq, lines } from '../../lib/util.js';

let draft = null; // { state, meta: { questId, questName, templateName } }
let paletteFilter = '';
const years = { prefix: 'Copyright', from: 2010, to: 2018, step: 2 };
let openCats = new Set();
try { openCats = new Set(JSON.parse(localStorage.getItem('sq.openCats') || '["Copyright years","Old builders · US"]')); } catch { /* ignore */ }
const rememberCats = () => { try { localStorage.setItem('sq.openCats', JSON.stringify([...openCats])); } catch { /* ignore */ } };

/** Replace the builder contents from elsewhere (quests, library). */
export function loadDraft(state, meta = {}) {
  draft = { state: normalizeState(structuredClone(state)), meta };
  store.setDraft(draft);
}

export const watches = (k) => k === 'blocks' || k.startsWith('tpl:');

function isOn(st, b) {
  if (b.slot === 'site') return st.site === b.value;
  if (b.slot === 'extra') return st.extra.includes(b.value);
  if (b.slot === 'excludes') return st.excludes.includes(normalizeDomain(b.value));
  return (st[b.slot] || []).includes(b.value);
}

function toggle(st, b) {
  if (b.slot === 'site') st.site = st.site === b.value ? '' : b.value;
  else if (b.slot === 'extra') st.extra = isOn(st, b) ? st.extra.replace(b.value, '').replace(/\s+/g, ' ').trim() : (st.extra + ' ' + b.value).trim();
  else {
    const v = b.slot === 'excludes' ? normalizeDomain(b.value) : b.value;
    const arr = st[b.slot];
    st[b.slot] = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }
}

const defaultName = (st, withLocation = true) => {
  const n = st.profession[0] || 'Search';
  const where = withLocation && st.location.length === 1 ? ' · ' + st.location[0] : '';
  return n.charAt(0).toUpperCase() + n.slice(1) + where + (st.signals.length ? ' · old sites' : '');
};

export async function render(root, app) {
  if (!draft) draft = (await store.getDraft()) || { state: emptyState(), meta: {} };
  const [blocks, templates] = await Promise.all([store.getBlocks(), store.templates.list()]);
  const st = (draft.state = normalizeState(draft.state));
  const meta = (draft.meta ||= {});
  const query = buildQuery(st);
  const words = countWords(query);

  const commit = () => { store.setDraft(draft); app.rerender(); };

  // ------------------------------------------------ template picker
  const regions = uniq(templates.map((t) => t.region || 'Custom')).sort();
  const tplSelect = h('select', {
    'aria-label': 'Load a template',
    onchange: (e) => {
      const t = templates.find((x) => x.id === e.target.value);
      if (!t) return;
      loadDraft(t.state, { templateName: t.name });
      toast(`Loaded “${t.name}”`);
      app.rerender();
    },
  }, h('option', { value: '' }, 'Load a template…'),
  regions.map((r) => h('optgroup', { label: r }, templates.filter((t) => (t.region || 'Custom') === r)
    .sort((a, b) => a.name.localeCompare(b.name)).map((t) => h('option', { value: t.id }, t.name)))));

  const topbar = h('div', { class: 'row wrap gap' },
    tplSelect,
    h('button', {
      onclick: async () => {
        if (query && !(await confirmDialog('Clear the builder?', 'This empties every slot.', 'Clear'))) return;
        loadDraft(emptyState());
        app.rerender();
      },
    }, 'Clear'));

  const questBanner = meta.questId ? h('div', { class: 'banner info' },
    h('span', {}, `Editing quest “${meta.questName || ''}”. Changes stay here until you save them.`),
    h('div', { class: 'row gap' },
      h('button', {
        class: 'small primary',
        onclick: async () => {
          const q = await store.quests.get(meta.questId);
          if (!q) { toast('That quest no longer exists.', 'bad'); meta.questId = null; commit(); return; }
          q.state = structuredClone(st);
          q.updatedAt = Date.now();
          await store.quests.put(q);
          toast('Quest updated');
          app.go('quests', { questId: q.id });
        },
      }, 'Save to quest'),
      h('button', { class: 'small', onclick: () => { draft.meta = {}; commit(); } }, 'Stop editing'))) : null;

  // ------------------------------------------------ preview
  const meterCls = words > 32 ? 'bad' : words > 26 ? 'warn' : 'ok';
  const preview = h('section', { class: 'card preview' },
    h('div', { class: 'row between' },
      h('h2', {}, 'Query'),
      h('span', { class: 'meter ' + meterCls, title: 'Google reads about 32 words per query and silently drops the rest.' }, `${words} / 32 words`)),
    h('pre', { class: 'query' + (query ? '' : ' empty') }, query || 'Pick a template, or click building blocks below: a niche, a location and a few old-site signals.'),
    words > 32 ? h('p', { class: 'warn-text' }, 'Over Google’s ~32-word limit. Trailing terms (usually the -site: exclusions) will be ignored. Drop some OR terms or exclusions, or split the query.') : null,
    h('div', { class: 'row wrap gap' },
      h('button', { class: 'primary', disabled: !query, onclick: () => openSearch(query) }, 'Search Google'),
      h('button', { disabled: !query, onclick: () => copyText(query) }, 'Copy'),
      h('button', { disabled: !query, onclick: () => saveQuest(st, app) }, 'Save as quest'),
      h('button', { disabled: !query, onclick: () => saveTemplate(st) }, 'Save as template')));

  // ------------------------------------------------ slots
  const slotEl = (slot) => {
    const extra = slot.key === 'profession'
      ? h('label', { class: 'check small', title: 'Only pages with the niche in their title, mostly company homepages rather than directory listings' },
        h('input', { type: 'checkbox', checked: st.intitle, onchange: (e) => { st.intitle = e.target.checked; commit(); } }), ' intitle:')
      : null;
    return h('div', { class: 'slot' },
      h('div', { class: 'slot-head' }, h('span', { class: 'slot-label' }, slot.label), extra),
      chipField({
        items: st[slot.key], key: 'slot-' + slot.key, placeholder: slot.placeholder,
        format: slot.key === 'excludes' ? normalizeDomain : (s) => s,
        onChange: (items) => { st[slot.key] = items; commit(); },
      }),
      slot.key === 'signals' ? yearHelper(st, commit) : null,
      h('small', { class: 'hint' }, slot.hint));
  };

  const slots = h('section', { class: 'card slots' },
    h('h2', {}, 'Building slots'),
    SLOTS.map(slotEl),
    h('div', { class: 'grid2' },
      h('label', { class: 'field' }, h('span', { class: 'slot-label' }, 'Site filter'),
        h('input', { type: 'text', value: st.site, placeholder: '.de · weebly.com', 'data-key': 'site', oninput: (e) => { st.site = e.target.value; commit(); } }),
        h('small', { class: 'hint' }, 'Becomes site:… Free subdomains such as weebly.com mean the owner never bought a domain.')),
      h('label', { class: 'field' }, h('span', { class: 'slot-label' }, 'Raw operators'),
        h('input', { type: 'text', value: st.extra, placeholder: 'inurl:"index.php?option=com_content"', 'data-key': 'extra', oninput: (e) => { st.extra = e.target.value; commit(); } }),
        h('small', { class: 'hint' }, 'Inserted as typed.'))));

  // ------------------------------------------------ palette
  const f = paletteFilter.toLowerCase();
  const cats = new Map();
  for (const b of blocks) {
    if (!cats.has(b.cat)) cats.set(b.cat, []);
    cats.get(b.cat).push(b);
  }
  const palette = h('section', { class: 'card palette' },
    h('div', { class: 'row between' }, h('h2', {}, 'Building blocks'), h('button', { class: 'link', onclick: () => app.go('library') }, 'Manage')),
    h('input', { type: 'search', placeholder: 'Filter blocks…', value: paletteFilter, 'data-key': 'palette-filter', oninput: (e) => { paletteFilter = e.target.value; app.rerender(); } }),
    h('small', { class: 'hint' }, 'Click a block to add it to its slot, click again to remove it.'),
    [...cats.entries()].map(([cat, list]) => {
      const shown = f ? list.filter((b) => `${b.label} ${b.value} ${cat}`.toLowerCase().includes(f)) : list;
      if (!shown.length) return null;
      const on = shown.filter((b) => isOn(st, b)).length;
      const det = h('details', { class: 'cat', open: !!f || openCats.has(cat) },
        h('summary', {}, h('span', {}, cat), h('span', { class: 'muted small' }, ` → ${SLOT_LABEL[list[0].slot] || list[0].slot}`), on ? h('span', { class: 'count' }, on) : null),
        h('div', { class: 'chips' }, shown.map((b) => h('button', {
          class: 'chip-btn' + (isOn(st, b) ? ' on' : ''),
          title: `${b.value}  →  ${SLOT_LABEL[b.slot] || b.slot}`,
          onclick: () => { toggle(st, b); commit(); },
        }, b.label))));
      det.addEventListener('toggle', () => {
        if (f) return;
        det.open ? openCats.add(cat) : openCats.delete(cat);
        rememberCats();
      });
      return det;
    }));

  root.append(
    topbar,
    questBanner,
    h('div', { class: 'builder-grid' },
      h('div', { class: 'col' }, preview, slots),
      h('div', { class: 'col' }, palette)));
}

function yearHelper(st, commit) {
  return h('div', { class: 'years' },
    h('span', { class: 'muted small' }, 'Add years:'),
    h('select', { 'aria-label': 'Prefix', onchange: (e) => { years.prefix = e.target.value; } },
      opts([['Copyright'], ['last updated'], ['letzte Aktualisierung'], ['Stand']], years.prefix)),
    h('input', { type: 'number', 'aria-label': 'From year', value: years.from, min: 1995, max: 2030, onchange: (e) => { years.from = +e.target.value; } }),
    h('span', { class: 'muted small' }, 'to'),
    h('input', { type: 'number', 'aria-label': 'To year', value: years.to, min: 1995, max: 2030, onchange: (e) => { years.to = +e.target.value; } }),
    h('span', { class: 'muted small' }, 'every'),
    h('input', { type: 'number', 'aria-label': 'Step', value: years.step, min: 1, max: 10, onchange: (e) => { years.step = +e.target.value; } }),
    h('button', {
      class: 'small',
      onclick: () => {
        st.signals = uniq([...st.signals, ...yearTerms(years.from, years.to, years.step, years.prefix)]);
        commit();
      },
    }, 'Add'));
}

async function saveQuest(st, app) {
  const v = await form('Save as quest', [
    { name: 'name', label: 'Quest name', value: defaultName(st, false) },
    {
      name: 'locations', label: 'Locations, one search per line', type: 'textarea', rows: 6, value: st.location.join('\n'),
      hint: 'Each line replaces the Location slot for one search. Leave empty to run the query exactly as built.',
    },
    { name: 'cityList', label: 'Also add a city list', type: 'select', value: '', options: [['', '—'], ...Object.keys(CITY_LISTS).map((k) => [k, `${k} (${CITY_LISTS[k].length})`])] },
    { name: 'notes', label: 'Notes', type: 'textarea', rows: 2, value: '' },
  ], 'Create quest');
  if (!v) return;
  const locs = uniq([...lines(v.locations), ...(CITY_LISTS[v.cityList] || [])]);
  const quest = {
    id: uid(),
    name: v.name.trim() || 'Untitled quest',
    notes: v.notes,
    state: structuredClone(st),
    locations: locs.map((value) => ({ id: uid(), value, status: 'pending', runAt: null, runs: 0 })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await store.quests.put(quest);
  toast('Quest created');
  app.go('quests', { questId: quest.id });
}

async function saveTemplate(st) {
  const existing = await store.templates.list();
  const v = await form('Save as template', [
    { name: 'name', label: 'Name', value: defaultName(st) },
    { name: 'region', label: 'Group', value: 'Custom', list: uniq(['Custom', ...existing.map((t) => t.region).filter(Boolean)]) },
    { name: 'description', label: 'Description', type: 'textarea', rows: 2, value: '' },
  ]);
  if (!v) return;
  await store.templates.put({ id: uid(), name: v.name.trim() || 'Untitled', region: v.region.trim() || 'Custom', description: v.description, state: structuredClone(st) });
  toast('Template saved');
}
