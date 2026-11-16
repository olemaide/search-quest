// Small helpers shared by the service worker, the app pages and the tests.

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const uniq = (arr) => [...new Set(arr)];

/** Hostname without "www.", lower-cased. "" when the URL is invalid. */
export function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

/** Key used to match a Google results page back to the quest that opened it. */
export const normQuery = (q) => (q || '').trim().replace(/\s+/g, ' ').toLowerCase();

/** Split a textarea value into trimmed, non-empty lines. */
export const lines = (s) => (s || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

/** Turn "example.com/foo" into "https://example.com/foo". Returns null when it can't be a web URL. */
export function toUrl(raw) {
  let s = (raw || '').trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
  try {
    const u = new URL(s);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null;
    u.hash = '';
    return u.href;
  } catch {
    return null;
  }
}

/** RFC 4180 CSV with a guard against spreadsheet formula injection. */
export function toCsv(rows) {
  const cell = (c) => {
    let s = c == null ? '' : Array.isArray(c) ? c.join('; ') : String(c);
    if (/^[=@\t\r]/.test(s) || /^[+-][^\d\s(]/.test(s)) s = "'" + s;
    return /[",\r\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

export function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  return Math.round(s / 86400) + ' d ago';
}
