import * as React from 'react';
import { detectSerp, type SerpInfo } from '@/lib/serp';

/** Tracks whether a Google results page is open (and how many of its results are new). */
export function useSerp(enabled = true) {
  const [serp, setSerp] = React.useState<SerpInfo | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  const refresh = React.useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try { setSerp(await detectSerp()); } catch { setSerp(null); }
    }, 200);
  }, []);

  React.useEffect(() => {
    if (!enabled) return;
    refresh();
    const onUpdated = (_id: number, info: chrome.tabs.OnUpdatedInfo) => { if (info.status === 'complete' || info.url) refresh(); };
    const onStorage = (changes: Record<string, unknown>, area: string) => {
      if (area === 'local' && Object.keys(changes).some((k) => k.startsWith('site:'))) refresh();
    };
    chrome.tabs.onActivated.addListener(refresh);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(refresh);
    chrome.windows.onFocusChanged.addListener(refresh);
    chrome.storage.onChanged.addListener(onStorage);
    return () => {
      clearTimeout(timer.current);
      chrome.tabs.onActivated.removeListener(refresh);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(refresh);
      chrome.windows.onFocusChanged.removeListener(refresh);
      chrome.storage.onChanged.removeListener(onStorage);
    };
  }, [enabled, refresh]);

  return [serp, refresh] as const;
}
