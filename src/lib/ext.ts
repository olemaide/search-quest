// UI-side helpers around the shared extension logic in /lib (plain JS, also used by the service worker).
import { toast } from 'sonner';
import * as store from '@ext/store.js';
import { googleUrl } from '@ext/query.js';
import { confirmDialog } from '@/components/confirm';
import type { Settings } from '@/types';

export { store };

export async function bg<T = unknown>(type: string, data: Record<string, unknown> = {}): Promise<T> {
  const r = await chrome.runtime.sendMessage({ type, ...data });
  if (!r?.ok) throw new Error(r?.error || 'The background worker did not answer');
  return r.data as T;
}

export const getSettings = () => store.getSettings() as Promise<Settings>;

/** Open a Google search. Throttled by settings.minGapSec; ctx tags the run so saved results land in a quest. */
export async function openSearch(q: string, ctx: { questId?: string | null; locId?: string | null; location?: string | null } = {}) {
  const settings = await getSettings();
  const { lastSearchAt = 0 } = await chrome.storage.local.get('lastSearchAt');
  const gap = (Date.now() - (lastSearchAt as number)) / 1000;
  if (settings.minGapSec > 0 && gap < settings.minGapSec) {
    const ok = await confirmDialog({
      title: 'Search again so soon?',
      description: `Your last search was ${Math.round(gap)} s ago. Google shows CAPTCHAs when queries come in quickly. Wait ${Math.ceil(settings.minGapSec - gap)} s more, or search anyway.`,
      confirmLabel: 'Search anyway',
    });
    if (!ok) return false;
  }
  await chrome.storage.local.set({ lastSearchAt: Date.now() });
  if (ctx.questId) {
    await store.runs.put(q, { questId: ctx.questId, locId: ctx.locId || null, location: ctx.location || null, at: Date.now() });
  }
  const url = googleUrl(q, settings);
  if (settings.openIn === 'current') {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id != null && !(tab.url || '').startsWith(chrome.runtime.getURL(''))) {
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
    toast.error('Open a website tab first.');
    return;
  }
  if (/^https:\/\/www\.google\.[a-z.]+\/search/.test(tab.url)) {
    toast.info('That’s a Google results page. Use the Save buttons on the page instead.');
    return;
  }
  try {
    const r = await bg<{ added: string[]; dupes: string[] }>('sites:add', { items: [{ url: tab.url, title: tab.title }] });
    if (r.added.length) toast.success('Site saved', { description: 'Scanning it for emails…' });
    else toast.info('Already in your sites.');
  } catch (e) {
    toast.error('Could not save', { description: String((e as Error).message) });
  }
}

export async function copyText(text: string, label = 'Copied to clipboard') {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error('Copy failed. Select the text and press Ctrl+C.');
  }
}

export function download(filename: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const today = () => new Date().toISOString().slice(0, 10);
