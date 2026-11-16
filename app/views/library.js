import { h, toast, form, confirmDialog } from '../ui.js';
import { loadDraft } from './builder.js';
import * as store from '../../lib/store.js';
import { buildQuery, SLOT_LABEL } from '../../lib/query.js';
import { uid, uniq } from '../../lib/util.js';

let tab = 'blocks';
let filter = '';

export const watches = (k) => k === 'blocks' || k.startsWith('tpl:');

const SLOT_OPTIONS = Object.entries(SLOT_LABEL).map(([k, v]) => [k, v]);

async function editBlock(block, blocks) {
  const cats = uniq(blocks.map((b) => b.cat));
  const v = await form(block ? 'Edit block' : 'New building block', [
    { name: 'cat', label: 'Category', value: block?.cat || 'My blocks', list: cats },
    { name: 'value', label: 'Value', value: block?.value || '', placeholder: 'Powered by Homestead', hint: 'Plain words get quoted. Text starting with an operator (inurl:, site:) or a quote is inserted as-is.' },
    { name: 'label', label: 'Label (optional)', value: block && block.label !== block.value ? block.label : '' },
    { name: 'slot', label: 'Goes into', type: 'select', value: block?.slot || 'signals', options: SLOT_OPTIONS },
  ], block ? 'Save' : 'Add block');
  if (!v || !v.value.trim()) return;
  const next = { id: block?.id || uid(), cat: v.cat.trim() || 'My blocks', value: v.value.trim(), label: v.label.trim() || v.value.trim(), slot: v.slot };
  const list = block ? blocks.map((b) => (b.id === block.id ? next : b)) : [...blocks, next];
  await store.setBlocks(list);
  toast(block ? 'Block saved' : 'Block added');
}

export async function render(root, app) {
  const [blocks, templates] = await Promise.all([store.getBlocks(), store.templates.list()]);
  const f = filter.toLowerCase();

  root.append(
    h('div', { class: 'row between wrap gap' },
      h('h1', {}, 'Library'),
      h('nav', { class: 'seg' },
        h('button', { class: tab === 'blocks' ? 'on' : '', onclick: () => { tab = 'blocks'; app.rerender(); } }, `Blocks (${blocks.length})`),
        h('button', { class: tab === 'templates' ? 'on' : '', onclick: () => { tab = 'templates'; app.rerender(); } }, `Templates (${templates.length})`))),
    h('input', { type: 'search', placeholder: 'Filter…', value: filter, 'data-key': 'lib-filter', oninput: (e) => { filter = e.target.value; app.rerender(); } }),
  );

  if (tab === 'blocks') {
    const cats = new Map();
    for (const b of blocks) {
      if (f && !`${b.cat} ${b.label} ${b.value}`.toLowerCase().includes(f)) continue;
      if (!cats.has(b.cat)) cats.set(b.cat, []);
      cats.get(b.cat).push(b);
    }
    root.append(
      h('div', { class: 'row wrap gap mt' },
        h('button', { class: 'primary', onclick: () => editBlock(null, blocks) }, '+ New block'),
        h('button', { onclick: async () => { const n = await store.restoreDefaultBlocks(); toast(n ? `Restored ${n} default blocks` : 'All default blocks are present'); } }, 'Restore defaults')),
      h('p', { class: 'muted small' }, 'Blocks are reusable query pieces. Each one targets a slot in the Builder. Add the footer credits you find on local sites (“Website by …”) as signals.'),
      [...cats.entries()].map(([cat, list]) => h('section', { class: 'card' },
        h('div', { class: 'row between' }, h('h2', {}, cat), h('span', { class: 'muted small' }, `→ ${SLOT_LABEL[list[0].slot] || list[0].slot}`)),
        h('div', { class: 'block-list' }, list.map((b) => h('div', { class: 'block-row' },
          h('span', { class: 'b-label' }, b.label),
          b.label !== b.value ? h('code', { class: 'small' }, b.value) : null,
          h('span', { class: 'spacer' }),
          h('button', { class: 'small', onclick: () => editBlock(b, blocks) }, 'Edit'),
          h('button', {
            class: 'small icon', title: 'Delete block',
            onclick: async () => { await store.setBlocks(blocks.filter((x) => x.id !== b.id)); },
          }, '×')))))));
    return;
  }

  const list = templates
    .filter((t) => !f || `${t.name} ${t.region} ${t.description}`.toLowerCase().includes(f))
    .sort((a, b) => (a.region || '').localeCompare(b.region || '') || a.name.localeCompare(b.name));
  root.append(
    h('div', { class: 'row wrap gap mt' },
      h('button', { onclick: () => app.go('builder') }, 'Build a new template'),
      h('button', { onclick: async () => { const n = await store.restoreDefaultTemplates(); toast(n ? `Restored ${n} default templates` : 'All default templates are present'); } }, 'Restore defaults')),
    h('p', { class: 'muted small' }, 'Templates are complete builder setups. Load one, swap the niche or city, then search or save it as a quest.'),
    h('div', { class: 'tpl-list' }, list.map((t) => h('section', { class: 'card' },
      h('div', { class: 'row between gap' }, h('strong', {}, t.name), h('span', { class: 'pill' }, t.region || 'Custom')),
      t.description ? h('p', { class: 'muted small' }, t.description) : null,
      h('code', { class: 'q-preview block' }, buildQuery(t.state)),
      h('div', { class: 'row wrap gap' },
        h('button', { class: 'small primary', onclick: () => { loadDraft(t.state, { templateName: t.name }); app.go('builder'); toast(`Loaded “${t.name}”`); } }, 'Load in builder'),
        h('button', {
          class: 'small',
          onclick: async () => {
            const v = await form('Rename template', [
              { name: 'name', label: 'Name', value: t.name },
              { name: 'region', label: 'Group', value: t.region || 'Custom' },
              { name: 'description', label: 'Description', type: 'textarea', rows: 2, value: t.description || '' },
            ]);
            if (v) await store.templates.put({ ...t, name: v.name.trim() || t.name, region: v.region.trim() || 'Custom', description: v.description });
          },
        }, 'Rename'),
        h('button', {
          class: 'small danger',
          onclick: async () => { if (await confirmDialog('Delete template?', t.name, 'Delete', true)) await store.templates.del(t.id); },
        }, 'Delete'))))));
}
