// chrome.storage.local wrapper. Sites, quests and templates live under their own
// keys ("site:<id>") so concurrent writers rarely touch the same record.

import { DEFAULT_BLOCKS, DEFAULT_TEMPLATES, DEFAULT_SETTINGS } from './defaults.js';
import { normQuery } from './util.js';

const L = () => chrome.storage.local;

async function listPrefix(prefix) {
  const all = await L().get(null);
  const out = [];
  for (const k in all) if (k.startsWith(prefix)) out.push(all[k]);
  return out;
}

function collection(prefix) {
  return {
    prefix,
    list: () => listPrefix(prefix),
    get: async (id) => (await L().get(prefix + id))[prefix + id] || null,
    put: (obj) => L().set({ [prefix + obj.id]: obj }),
    putMany: async (arr) => { if (arr.length) await L().set(Object.fromEntries(arr.map((o) => [prefix + o.id, o]))); },
    del: (ids) => L().remove([].concat(ids).map((i) => prefix + i)),
  };
}

export const sites = collection('site:');
export const quests = collection('quest:');
export const templates = collection('tpl:');

// Remembers which quest/location opened a Google query, so saving from the results page can tag sites.
export const runs = {
  get: async (q) => { const k = 'run:' + normQuery(q); return (await L().get(k))[k] || null; },
  put: (q, v) => L().set({ ['run:' + normQuery(q)]: v }),
};

export async function getSettings() {
  const { settings } = await L().get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

export async function setSettings(patch) {
  const cur = await getSettings();
  await L().set({ settings: { ...cur, ...patch } });
}

export async function getBlocks() {
  const { blocks } = await L().get('blocks');
  return Array.isArray(blocks) ? blocks : DEFAULT_BLOCKS;
}

export const setBlocks = (blocks) => L().set({ blocks });

export async function getDraft() {
  const { draft } = await L().get('draft');
  return draft || null;
}

export const setDraft = (draft) => L().set({ draft });

export async function seedDefaults() {
  const { seeded } = await L().get('seeded');
  if (seeded) return;
  await L().set({ blocks: DEFAULT_BLOCKS, seeded: 1 });
  await templates.putMany(DEFAULT_TEMPLATES);
}

export async function restoreDefaultBlocks() {
  const cur = await getBlocks();
  const have = new Set(cur.map((b) => b.id));
  const missing = DEFAULT_BLOCKS.filter((b) => !have.has(b.id));
  await setBlocks([...cur, ...missing]);
  return missing.length;
}

export async function restoreDefaultTemplates() {
  const cur = await templates.list();
  const have = new Set(cur.map((t) => t.id));
  const missing = DEFAULT_TEMPLATES.filter((t) => !have.has(t.id));
  await templates.putMany(missing);
  return missing.length;
}

const EXPORT_KEY = /^(site:|quest:|tpl:|blocks$|settings$)/;

export async function exportAll() {
  const all = await L().get(null);
  const data = {};
  for (const k in all) if (EXPORT_KEY.test(k)) data[k] = all[k];
  return { app: 'SearchQuest', version: 1, exportedAt: new Date().toISOString(), data };
}

/** Merge an export back in. Blocks are merged by id; everything else overwrites by key. */
export async function importAll(payload) {
  const data = payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object' ? payload.data : null;
  if (!data) throw new Error('Not a SearchQuest export file.');
  const out = {};
  let n = 0;
  for (const [k, v] of Object.entries(data)) {
    if (!EXPORT_KEY.test(k) || !v || typeof v !== 'object') continue;
    if (k === 'blocks') {
      if (!Array.isArray(v)) continue;
      const cur = await getBlocks();
      const byId = new Map(cur.map((b) => [b.id, b]));
      for (const b of v) if (b && b.id && b.value) byId.set(b.id, b);
      out.blocks = [...byId.values()];
    } else if (k === 'settings') {
      out.settings = { ...(await getSettings()), ...v };
    } else {
      if (!v.id) continue;
      out[k] = v;
    }
    n++;
  }
  await L().set(out);
  return n;
}
