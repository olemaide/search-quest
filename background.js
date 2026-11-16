// Service worker: owns every write to saved sites (serialised to avoid races),
// runs the scan queue, and wires up the side panel and context menus.

import * as store from './lib/store.js';
import { scanSite } from './lib/scanner.js';
import { uid, domainOf, uniq } from './lib/util.js';

chrome.runtime.onInstalled.addListener(async () => {
  await store.seedDefaults();
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'sq-page', title: 'Save this site to SearchQuest', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'sq-link', title: 'Save linked site to SearchQuest', contexts: ['link'] });
  });
});

chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'sq-page' && tab?.url) addSites([{ url: tab.url, title: tab.title }]);
  if (info.menuItemId === 'sq-link' && info.linkUrl) addSites([{ url: info.linkUrl, title: info.selectionText || '' }]);
});

// ---------------------------------------------------------------- serialised writes

let lock = Promise.resolve();
function serial(fn) {
  const run = lock.then(fn);
  lock = run.catch(() => {});
  return run;
}

const keyFor = (url, byDomain) => (byDomain ? domainOf(url) : url.replace(/#.*$/, '').replace(/\/$/, ''));

async function addSites(items, { query = '', questId = null, location = null, scan } = {}) {
  const settings = await store.getSettings();
  const run = query && !questId ? await store.runs.get(query) : null;
  const res = await serial(async () => {
    const existing = await store.sites.list();
    const byKey = new Map(existing.map((s) => [keyFor(s.url, settings.dedupeByDomain), s]));
    const added = [];
    const dupes = [];
    for (const it of items || []) {
      let url;
      try { url = new URL(it.url); } catch { continue; }
      if (!/^https?:$/.test(url.protocol)) continue;
      url.hash = '';
      const k = keyFor(url.href, settings.dedupeByDomain);
      if (byKey.has(k)) { dupes.push(byKey.get(k).id); continue; }
      const site = {
        id: uid(),
        url: url.href,
        domain: domainOf(url.href),
        title: String(it.title || '').slice(0, 200),
        snippet: String(it.snippet || '').slice(0, 500),
        query: query || it.query || '',
        questId: questId || run?.questId || null,
        location: location || run?.location || null,
        status: 'new',
        tags: [],
        notes: '',
        emails: [],
        phones: [],
        scan: null,
        scanState: 'none',
        createdAt: Date.now(),
      };
      byKey.set(k, site);
      added.push(site);
    }
    await store.sites.putMany(added);
    return { added: added.map((s) => s.id), dupes };
  });
  if (res.added.length && (scan ?? settings.autoScan)) enqueue(res.added);
  return res;
}

async function patchMany(ids, patch) {
  return serial(async () => {
    const out = [];
    for (const id of ids) {
      const cur = await store.sites.get(id);
      if (cur) out.push({ ...cur, ...patch });
    }
    await store.sites.putMany(out);
    return out.length;
  });
}

async function checkUrls(urls) {
  const settings = await store.getSettings();
  const existing = await store.sites.list();
  const have = new Map(existing.map((s) => [keyFor(s.url, settings.dedupeByDomain), s.id]));
  return (urls || []).map((u) => have.get(keyFor(u, settings.dedupeByDomain)) || null);
}

// ---------------------------------------------------------------- scan queue

const queue = [];
const queued = new Set();
let active = 0;

async function enqueue(ids) {
  const fresh = uniq(ids).filter((id) => !queued.has(id));
  if (!fresh.length) return 0;
  fresh.forEach((id) => queued.add(id));
  await patchMany(fresh, { scanState: 'queued' });
  queue.push(...fresh);
  pump();
  return fresh.length;
}

async function pump() {
  const { scanConcurrency, scanMaxPages } = await store.getSettings();
  while (active < Math.max(1, scanConcurrency) && queue.length) {
    const id = queue.shift();
    active++;
    scanOne(id, scanMaxPages).finally(() => {
      active--;
      queued.delete(id);
      pump();
    });
  }
}

async function scanOne(id, maxPages) {
  const site = await store.sites.get(id);
  if (!site) return;
  await patchMany([id], { scanState: 'scanning' });
  try {
    const r = await scanSite(site.url, { maxPages: Math.max(1, Math.min(10, maxPages || 4)) });
    await serial(async () => {
      const cur = await store.sites.get(id);
      if (!cur) return;
      await store.sites.put({
        ...cur,
        scan: r,
        scanState: 'done',
        scanError: null,
        scannedAt: Date.now(),
        emails: uniq([...(cur.emails || []), ...r.emails]),
        phones: uniq([...(cur.phones || []), ...r.phones]),
        title: cur.title || r.title,
      });
    });
  } catch (e) {
    await patchMany([id], { scanState: 'error', scanError: String(e?.message || e), scannedAt: Date.now() });
  }
}

// Resume scans that were cut off when the worker was stopped.
(async () => {
  const all = await store.sites.list();
  const stuck = all.filter((s) => s.scanState === 'queued' || s.scanState === 'scanning').map((s) => s.id);
  if (stuck.length) {
    stuck.forEach((id) => queued.add(id));
    queue.push(...stuck);
    pump();
  }
})();

// ---------------------------------------------------------------- messages

async function serpContext(query) {
  const [run, settings] = await Promise.all([store.runs.get(query), store.getSettings()]);
  const quest = run?.questId ? await store.quests.get(run.questId) : null;
  return { quest: quest ? { id: quest.id, name: quest.name } : null, location: run?.location || null, autoScan: settings.autoScan };
}

const handlers = {
  'sites:add': (m) => addSites(m.items, m),
  'sites:check': (m) => checkUrls(m.urls),
  'sites:patch': (m) => patchMany(m.ids, m.patch),
  'sites:delete': (m) => serial(() => store.sites.del(m.ids)),
  'sites:scan': (m) => enqueue(m.ids),
  'serp:context': (m) => serpContext(m.query),
  'serp:captcha': () => chrome.storage.local.set({ lastCaptchaAt: Date.now() }),
};

chrome.runtime.onMessage.addListener((msg, sender, send) => {
  const fn = handlers[msg?.type];
  if (!fn) return false;
  Promise.resolve()
    .then(() => fn(msg, sender))
    .then((data) => send({ ok: true, data }), (e) => send({ ok: false, error: String(e?.message || e) }));
  return true;
});
