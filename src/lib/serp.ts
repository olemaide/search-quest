// Read the organic results from an open Google results page, from the side panel or full view.
// Uses chrome.scripting so it also works on Google tabs opened before the extension was (re)loaded,
// where the content script isn't running.
import { bg } from '@/lib/ext';

export interface SerpResult { url: string; title: string; snippet: string }
export interface SerpData { query: string; results: SerpResult[]; captcha: boolean }
export interface SerpInfo extends SerpData { tabId: number; fresh: number }

const GOOGLE_SERP = /^https:\/\/www\.google\.[a-z.]+\/(search\?|sorry\/)/i;
export const isSerpUrl = (u?: string) => !!u && GOOGLE_SERP.test(u);

/** Runs inside the Google tab: must be self-contained (no closures). */
function extractSerp(): SerpData {
  const query = new URLSearchParams(location.search).get('q') || '';
  const scope = document.querySelector('#rso') || document.querySelector('#search') || document.body;
  const out: SerpResult[] = [];
  const seen = new Set<string>();
  for (const a of Array.from(scope.querySelectorAll<HTMLAnchorElement>('a[href]:has(h3)'))) {
    if (a.closest('#tads, #bottomads, [data-text-ad]')) continue;
    let href = a.href;
    try {
      const u = new URL(href);
      if (/(^|\.)google\.[a-z.]+$/i.test(u.hostname)) {
        if (u.pathname !== '/url') continue;
        href = u.searchParams.get('q') || u.searchParams.get('url') || '';
      }
    } catch { continue; }
    if (!/^https?:\/\//i.test(href) || seen.has(href)) continue;
    seen.add(href);
    const box = a.closest('.MjjYud, .g, [data-hveid]') || a.parentElement;
    const snip = box?.querySelector('.VwiC3b, [data-sncf="1"], [style*="line-clamp"]');
    out.push({ url: href, title: (a.querySelector('h3')?.textContent || '').trim(), snippet: (snip?.textContent || '').trim().slice(0, 400) });
  }
  return { query, results: out, captcha: location.pathname.startsWith('/sorry') };
}

/** The Google results tab to use: the active one, else the most recently used one. */
export async function findSerpTab(): Promise<chrome.tabs.Tab | null> {
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (active && isSerpUrl(active.url)) return active;
  const tabs = (await chrome.tabs.query({})).filter((t) => isSerpUrl(t.url));
  tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  return tabs[0] || null;
}

export async function readSerp(tabId: number): Promise<SerpData | null> {
  const [r] = await chrome.scripting.executeScript({ target: { tabId }, func: extractSerp });
  return (r?.result as SerpData) || null;
}

/** Detect + read + count how many results aren't saved yet. */
export async function detectSerp(): Promise<SerpInfo | null> {
  const tab = await findSerpTab();
  if (!tab?.id) return null;
  const data = await readSerp(tab.id);
  if (!data) return null;
  let fresh = data.results.length;
  if (data.results.length) {
    const saved = await bg<(string | null)[]>('sites:check', { urls: data.results.map((r) => r.url) });
    fresh = saved.filter((s) => !s).length;
  }
  return { tabId: tab.id, ...data, fresh };
}

export async function importSerp(serp: SerpData, opts: { questId?: string | null; scan?: boolean } = {}) {
  return bg<{ added: string[]; dupes: string[] }>('sites:add', {
    items: serp.results,
    query: serp.query,
    ...(opts.questId ? { questId: opts.questId } : {}),
    ...(opts.scan === undefined ? {} : { scan: opts.scan }),
  });
}
