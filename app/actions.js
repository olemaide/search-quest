// Actions shared by several views.

import * as store from '../lib/store.js';
import { googleUrl } from '../lib/query.js';
import { confirmDialog, toast } from './ui.js';

export async function bg(type, data = {}) {
  const r = await chrome.runtime.sendMessage({ type, ...data });
  if (!r?.ok) throw new Error(r?.error || 'Background did not answer');
  return r.data;
}

/**
 * Open a Google search for q. Throttled by settings.minGapSec to avoid CAPTCHAs.
 * ctx = { questId, locId, location } tags the run so saved results land in the quest.
 */
export async function openSearch(q, ctx = {}) {
  const settings = await store.getSettings();
  const { lastSearchAt = 0 } = await chrome.storage.local.get('lastSearchAt');
  const gap = (Date.now() - lastSearchAt) / 1000;
  if (settings.minGapSec > 0 && gap < settings.minGapSec) {
    const ok = await confirmDialog(
      'Slow down?',
      `Your last search was ${Math.round(gap)} s ago. Google shows CAPTCHAs when queries come in fast. ` +
      `Wait ${Math.ceil(settings.minGapSec - gap)} s more, or search anyway?`,
      'Search anyway',
    );
    if (!ok) return false;
  }
  await chrome.storage.local.set({ lastSearchAt: Date.now() });
  if (ctx.questId) await store.runs.put(q, { questId: ctx.questId, locId: ctx.locId || null, location: ctx.location || null, at: Date.now() });
  const url = googleUrl(q, settings);
  if (settings.openIn === 'current') {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab && !(tab.url || '').startsWith(chrome.runtime.getURL(''))) {
      await chrome.tabs.update(tab.id, { url });
      return true;
    }
  }
  await chrome.tabs.create({ url });
  return true;
}

export async function saveCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.url || !/^https?:/.test(tab.url) || tab.url.startsWith(chrome.runtime.getURL(''))) {
    toast('Open a website tab first.', 'bad');
    return;
  }
  if (/^https:\/\/www\.google\.[a-z.]+\/search/.test(tab.url)) {
    toast('That is a Google results page. Use the Save buttons on the page instead.');
    return;
  }
  try {
    const r = await bg('sites:add', { items: [{ url: tab.url, title: tab.title }] });
    toast(r.added.length ? 'Saved. Scanning for emails…' : 'Already in your sites.');
  } catch (e) {
    toast('Could not save: ' + e.message, 'bad');
  }
}
