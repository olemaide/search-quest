import { h, toast, copyText, confirmDialog, opts } from '../ui.js';
import { openSearch } from '../actions.js';
import { loadDraft } from './builder.js';
import * as store from '../../lib/store.js';
import { buildQuery } from '../../lib/query.js';
import { CITY_LISTS } from '../../lib/defaults.js';
import { uid, uniq, lines, timeAgo } from '../../lib/util.js';

let openId = null;
let addText = '';

export const watches = (k) => k.startsWith('quest:') || k.startsWith('site:');

const variantQuery = (q, loc) => buildQuery(q.state, loc ? { location: [loc.value] } : {});

export async function render(root, app) {
  if (app.params.questId) { openId = app.params.questId; app.params = {}; }
  const [quests, sites] = await Promise.all([store.quests.list(), store.sites.list()]);
  if (openId) {
    const q = quests.find((x) => x.id === openId);
    if (q) return renderDetail(root, app, q, sites);
    openId = null;
  }
  renderList(root, app, quests, sites);
}

function renderList(root, app, quests, sites) {
  quests.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  root.append(
    h('div', { class: 'row between wrap gap' },
      h('h1', {}, 'Search quests'),
      h('button', { class: 'primary', onclick: () => app.go('builder') }, 'New quest in Builder')),
    h('p', { class: 'muted' }, 'A quest is a saved query plus a list of locations. Run one location at a time, save results straight from Google, and the quest remembers where you stopped.'),
    quests.length ? null : h('div', { class: 'card empty-state' },
      h('p', {}, 'No quests yet.'),
      h('p', { class: 'muted' }, 'Build a query in the Builder (or load a template), then click “Save as quest” and add some cities.')),
    h('div', { class: 'quest-list' }, quests.map((q) => {
      const total = q.locations.length;
      const done = q.locations.filter((l) => l.status === 'done').length;
      const mine = sites.filter((s) => s.questId === q.id);
      const withEmail = mine.filter((s) => s.emails?.length).length;
      return h('button', { class: 'card quest-card', onclick: () => { openId = q.id; app.rerender(); } },
        h('div', { class: 'row between gap' }, h('strong', {}, q.name), h('span', { class: 'muted small' }, timeAgo(q.updatedAt))),
        h('code', { class: 'q-preview' }, buildQuery(q.state, total ? { location: ['{location}'] } : {})),
        total ? h('div', { class: 'progress', title: `${done} of ${total} searched` }, h('span', { style: `width:${Math.round((done / total) * 100)}%` })) : null,
        h('div', { class: 'muted small' },
          total ? `${done}/${total} locations searched · ` : (q.lastRunAt ? 'searched · ' : 'not searched yet · '),
          `${mine.length} sites · ${withEmail} with email`));
    })));
}

function renderDetail(root, app, q, sites) {
  const save = async () => { q.updatedAt = Date.now(); await store.quests.put(q); };
  const mine = sites.filter((s) => s.questId === q.id);
  const total = q.locations.length;
  const done = q.locations.filter((l) => l.status === 'done').length;

  const run = async (loc) => {
    const ok = await openSearch(variantQuery(q, loc), { questId: q.id, locId: loc?.id, location: loc?.value || null });
    if (!ok) return;
    if (loc) { loc.status = 'done'; loc.runAt = Date.now(); loc.runs = (loc.runs || 0) + 1; } else q.lastRunAt = Date.now();
    await save();
  };

  const addLocs = async (vals) => {
    const have = new Set(q.locations.map((l) => l.value.toLowerCase()));
    const fresh = uniq(vals).filter((v) => !have.has(v.toLowerCase()));
    q.locations.push(...fresh.map((value) => ({ id: uid(), value, status: 'pending', runAt: null, runs: 0 })));
    await save();
    toast(fresh.length ? `Added ${fresh.length} location${fresh.length > 1 ? 's' : ''}` : 'Nothing new to add');
  };

  const next = q.locations.find((l) => l.status !== 'done');

  root.append(
    h('button', { class: 'link back', onclick: () => { openId = null; app.rerender(); } }, '← All quests'),
    h('section', { class: 'card' },
      h('input', { class: 'title-input', value: q.name, 'data-key': 'q-name', 'aria-label': 'Quest name', onchange: (e) => { q.name = e.target.value.trim() || q.name; save(); } }),
      h('code', { class: 'q-preview block' }, buildQuery(q.state, total ? { location: ['{location}'] } : {})),
      h('div', { class: 'muted small' },
        total ? `${done}/${total} locations searched · ` : '',
        `${mine.length} sites saved · ${mine.filter((s) => s.emails?.length).length} with email`),
      h('div', { class: 'row wrap gap mt' },
        total
          ? h('button', { class: 'primary', disabled: !next, onclick: () => run(next) }, next ? `Search next: ${next.value}` : 'All locations searched')
          : h('button', { class: 'primary', onclick: () => run(null) }, 'Search Google'),
        h('button', { onclick: () => { loadDraft(q.state, { questId: q.id, questName: q.name }); app.go('builder'); } }, 'Edit query'),
        h('button', { disabled: !mine.length, onclick: () => app.go('sites', { questId: q.id }) }, `View sites (${mine.length})`),
        h('button', {
          onclick: async () => {
            const copy = { ...structuredClone(q), id: uid(), name: q.name + ' (copy)', createdAt: Date.now(), updatedAt: Date.now(), lastRunAt: null };
            copy.locations = copy.locations.map((l) => ({ ...l, id: uid(), status: 'pending', runAt: null, runs: 0 }));
            await store.quests.put(copy);
            openId = copy.id;
            toast('Duplicated');
          },
        }, 'Duplicate'),
        h('button', {
          class: 'danger',
          onclick: async () => {
            if (!(await confirmDialog('Delete quest?', `“${q.name}” will be deleted. Its ${mine.length} saved sites stay in your Sites list.`, 'Delete', true))) return;
            await store.quests.del(q.id);
            openId = null;
          },
        }, 'Delete'))),

    h('section', { class: 'card' },
      h('div', { class: 'row between wrap gap' },
        h('h2', {}, `Locations (${total})`),
        total ? h('button', {
          class: 'small',
          onclick: async () => { q.locations.forEach((l) => { l.status = 'pending'; }); await save(); },
        }, 'Reset all to pending') : null),
      total ? null : h('p', { class: 'muted' }, 'No locations: the query runs exactly as built. Add cities, ZIP codes or regions to get one search each.'),
      h('div', { class: 'loc-list' }, q.locations.map((l) => {
        const n = mine.filter((s) => s.location === l.value).length;
        return h('div', { class: 'loc-row' + (l.status === 'done' ? ' done' : '') },
          h('span', { class: 'pill ' + (l.status === 'done' ? 'ok' : '') }, l.status === 'done' ? 'searched' : 'pending'),
          h('span', { class: 'loc-name', title: variantQuery(q, l) }, l.value),
          h('span', { class: 'muted small' }, `${n} site${n === 1 ? '' : 's'}${l.runAt ? ' · ' + timeAgo(l.runAt) : ''}`),
          h('div', { class: 'row gap' },
            h('button', { class: 'small primary', onclick: () => run(l) }, 'Search'),
            h('button', { class: 'small', title: 'Copy this query', onclick: () => copyText(variantQuery(q, l)) }, 'Copy'),
            h('button', {
              class: 'small', title: l.status === 'done' ? 'Mark as pending' : 'Mark as searched',
              onclick: async () => { l.status = l.status === 'done' ? 'pending' : 'done'; await save(); },
            }, l.status === 'done' ? '↺' : '✓'),
            h('button', {
              class: 'small icon', title: 'Remove location',
              onclick: async () => { q.locations = q.locations.filter((x) => x.id !== l.id); await save(); },
            }, '×')));
      })),
      h('div', { class: 'add-locs' },
        h('textarea', { rows: 3, placeholder: 'Add locations, one per line: Dayton, OH · 45402 · Montgomery County', value: addText, 'data-key': 'q-add', oninput: (e) => { addText = e.target.value; } }),
        h('div', { class: 'row wrap gap' },
          h('button', { onclick: async () => { const v = lines(addText); addText = ''; if (v.length) await addLocs(v); } }, 'Add'),
          h('select', {
            'aria-label': 'Add a city list',
            onchange: async (e) => { const list = CITY_LISTS[e.target.value]; if (list) await addLocs(list); },
          }, h('option', { value: '' }, 'Add a city list…'), opts(Object.keys(CITY_LISTS).map((k) => [k, `${k} (${CITY_LISTS[k].length})`])))))),

    h('section', { class: 'card' },
      h('h2', {}, 'Notes'),
      h('textarea', { rows: 3, value: q.notes || '', 'data-key': 'q-notes', placeholder: 'Pitch angle, what worked, what to skip…', onchange: (e) => { q.notes = e.target.value; save(); } })),
  );
}
