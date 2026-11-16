import * as React from 'react';

/**
 * Load data from chrome.storage and reload whenever a matching key changes
 * (the service worker writes scan results while the UI is open).
 */
export function useExtData<T>(load: () => Promise<T>, watch: (key: string) => boolean, deps: React.DependencyList = []) {
  const [data, setData] = React.useState<T | undefined>(undefined);
  const [version, setVersion] = React.useState(0);
  const loadRef = React.useRef(load);
  loadRef.current = load;
  const watchRef = React.useRef(watch);
  watchRef.current = watch;

  React.useEffect(() => {
    let alive = true;
    loadRef.current().then((d) => { if (alive) setData(d); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);

  React.useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local' || !Object.keys(changes).some((k) => watchRef.current(k))) return;
      clearTimeout(t);
      t = setTimeout(() => setVersion((v) => v + 1), 150);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => { clearTimeout(t); chrome.storage.onChanged.removeListener(onChange); };
  }, []);

  const reload = React.useCallback(() => setVersion((v) => v + 1), []);
  return [data, reload] as const;
}
