// Fetches a site's homepage plus its contact / imprint / about pages and extracts
// emails, phones, social links and signs that the site is old.
//
// Runs inside the MV3 service worker, which has no DOMParser, so parsing is regex-based.
// Everything except scanSite() is pure and unit-tested in tests/scanner.test.mjs.

const MAX_BYTES = 2_500_000;

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', trade: '™',
  commat: '@', period: '.', ndash: '–', mdash: '—', hellip: '…', middot: '·', bull: '•',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
  eacute: 'é', egrave: 'è', aacute: 'á', agrave: 'à', ccedil: 'ç', raquo: '»', laquo: '«',
};

export function decodeEntities(s) {
  return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(n); } catch { return m; }
    }
    return NAMED[e] ?? NAMED[e.toLowerCase()] ?? m;
  });
}

export function htmlToText(html) {
  return decodeEntities(String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(?:br|hr|\/p|\/div|\/li|\/tr|\/td|\/th|\/table|\/h[1-6]|\/section|\/footer)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/ ?\n[\s]*/g, '\n')
    .trim();
}

export function parseAttrs(s) {
  const o = {};
  String(s || '').replace(/([^\s=/>"']+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g, (m, k, a, b, c) => {
    const key = k.toLowerCase();
    if (!(key in o)) o[key] = decodeEntities(a ?? b ?? c ?? '');
    return '';
  });
  return o;
}

export function metas(html) {
  const out = {};
  for (const m of String(html).matchAll(/<meta\b([^>]*)>/gi)) {
    const a = parseAttrs(m[1]);
    const k = (a.name || a.property || a['http-equiv'] || '').toLowerCase();
    if (k && a.content != null && !(k in out)) out[k] = a.content.trim();
  }
  return out;
}

export function extractLinks(html, base) {
  const raw = [];
  for (const m of String(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
    const a = parseAttrs(m[1]);
    if (a.href) raw.push({ href: a.href.trim(), text: htmlToText(m[2]).slice(0, 100) });
  }
  // Framesets and image maps: very old sites hide their contact pages here.
  for (const m of String(html).matchAll(/<(?:frame|iframe)\b([^>]*)>/gi)) {
    const a = parseAttrs(m[1]);
    if (a.src) raw.push({ href: a.src.trim(), text: '', frame: true });
  }
  for (const m of String(html).matchAll(/<area\b([^>]*)>/gi)) {
    const a = parseAttrs(m[1]);
    if (a.href) raw.push({ href: a.href.trim(), text: a.alt || '' });
  }
  return raw.map((l) => {
    let abs = null;
    try { abs = new URL(l.href, base).href; } catch { /* ignore */ }
    return { ...l, abs };
  });
}

// ---------------------------------------------------------------- emails

export function cfDecode(hex) {
  try {
    const k = parseInt(hex.slice(0, 2), 16);
    let s = '';
    for (let i = 2; i < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ k);
    return s;
  } catch {
    return '';
  }
}

const EMAIL_RE = /[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9_%+-])?@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}/gi;
const BAD_EXT = /\.(?:png|jpe?g|gif|svg|webp|bmp|ico|css|js|tiff?|avif|mp4|woff2?)$/i;
const BAD_DOMAIN = /(?:^|\.)(?:example\.(?:com|org|net|de)|domain\.(?:com|de|tld)|yourdomain\.\w+|yoursite\.\w+|mysite\.com|test\.com|sentry\.io|wixpress\.com|sentry-next\.wixpress\.com|beispiel\.de|musterfirma\.de|mustermann\.de|ihre-?domain\.de|email\.com|company\.com|website\.com)$/i;
const BAD_LOCAL = /^(?:[0-9a-f]{16,}|name|email|e-mail|your-?\.?name|you|user|username|vorname\.nachname|max\.mustermann|john\.?doe|jane\.?doe|someone)$/i;

export function extractEmails(html) {
  let s = String(html || '')
    .replace(/data-cfemail=["']?([0-9a-f]{4,})/gi, (m, h) => ' ' + cfDecode(h) + ' ')
    .replace(/\/cdn-cgi\/l\/email-protection#([0-9a-f]{4,})/gi, (m, h) => ' ' + cfDecode(h) + ' ')
    .replace(/mailto:([^"'\s>?]+)/gi, (m, a) => {
      try { return ' ' + decodeURIComponent(a) + ' '; } catch { return ' ' + a + ' '; }
    });
  s = decodeEntities(s)
    .replace(/\\u0040/gi, '@')
    .replace(/\s*[[({]\s*(?:at|ät|@)\s*[\])}]\s*/gi, '@')
    .replace(/\s*[[({]\s*(?:dot|punkt|\.)\s*[\])}]\s*/gi, '.');
  const found = new Set();
  for (const m of s.matchAll(EMAIL_RE)) {
    const e = m[0].toLowerCase().replace(/^(?:u00[0-9a-f]{2})+/, '').replace(/^[._%+-]+/, '');
    const at = e.indexOf('@');
    if (at < 1) continue;
    const local = e.slice(0, at), dom = e.slice(at + 1);
    if (BAD_EXT.test(e) || BAD_DOMAIN.test(dom) || BAD_LOCAL.test(local)) continue;
    if (/^\d+x$/.test(dom.split('.')[0])) continue; // logo@2x.png style leftovers
    found.add(e);
  }
  return [...found];
}

// ---------------------------------------------------------------- phones & socials

export function extractPhones(text, links = []) {
  const out = new Map();
  const add = (raw) => {
    const p = String(raw).replace(/[^\d+()/.\-\s–]/g, '').replace(/\s+/g, ' ').trim().replace(/[\s.\-/–]+$/, '');
    const digits = p.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return;
    // "+1 (937) 555-0100" and "(937) 555-0100" are the same number.
    for (const k of out.keys()) if (k.endsWith(digits) || digits.endsWith(k)) return;
    out.set(digits, p);
  };
  for (const l of links) {
    if (/^tel:/i.test(l.href)) {
      try { add(decodeURIComponent(l.href.slice(4))); } catch { add(l.href.slice(4)); }
    }
  }
  const re = /\b(tel(?:efon)?|phone|ph|fon|call(?: us)?|office|mobil|handy|fax)\b\.?\s*(?:[:.]|nr\.?)?\s*((?:\+|\(|\d)[\d\s()/.\-–]{5,22}\d)/gi;
  for (const m of String(text || '').matchAll(re)) {
    if (/^fax$/i.test(m[1])) continue;
    add(m[2]);
  }
  return [...out.values()].slice(0, 6);
}

const SOCIAL = [
  ['facebook', /^https?:\/\/(?:[a-z]+\.)?facebook\.com\/(?!sharer|share|dialog|plugins|tr\b|login)/i],
  ['instagram', /^https?:\/\/(?:www\.)?instagram\.com\/(?!p\/|share)/i],
  ['linkedin', /^https?:\/\/(?:[a-z]+\.)?linkedin\.com\/(?:company|in)\//i],
  ['x', /^https?:\/\/(?:www\.)?(?:twitter|x)\.com\/(?!intent|share|home)/i],
  ['youtube', /^https?:\/\/(?:www\.)?youtube\.com\/(?:channel|c|user|@)/i],
  ['yelp', /^https?:\/\/(?:www\.)?yelp\.[a-z.]+\/biz\//i],
];

export function extractSocials(links) {
  const out = {};
  for (const l of links) {
    if (!l.abs) continue;
    for (const [name, re] of SOCIAL) if (!out[name] && re.test(l.abs)) out[name] = l.abs;
  }
  return out;
}

// ---------------------------------------------------------------- age signals

const BUILDERS = [
  // [name, pattern, old]
  ['Microsoft FrontPage', /frontpage/i, true],
  ['NetObjects Fusion', /netobjects/i, true],
  ['Adobe GoLive', /golive/i, true],
  ['Dreamweaver template', /InstanceBegin template|dreamweaver/i, true],
  ['Microsoft Word', /<meta[^>]+content=["']?microsoft word/i, true],
  ['Apple iWeb', /<meta[^>]+content=["']?iweb/i, true],
  ['Homestead', /homestead\.com|powered by homestead|created with homestead|homestead sitebuilder/i, true],
  ['Yahoo! Sitebuilder', /yahoo!? ?(?:small business|web hosting|sitebuilder|site builder)|geocities/i, true],
  ['Vistaprint', /vistaprint/i, true],
  ['Zeta Producer', /zeta producer/i, true],
  ['WebsiteBaker', /websitebaker/i, true],
  ['Weebly', /weebly|editmysite\.com/i, false],
  ['Jimdo', /jimdo/i, false],
  ['Wix', /wix\.com|wixstatic\.com|parastorage\.com/i, false],
  ['GoDaddy Builder', /img1\.wsimg\.com|godaddy website builder|powered by godaddy|godaddysites\.com/i, false],
  ['IONOS / 1&1 MyWebsite', /1&(?:amp;)?1 (?:homepage|mywebsite)|mywebsite-editor|ionos mywebsite|1und1/i, false],
  ['STRATO', /strato[- ]?(?:homepage|baukasten|website)|strato-editor/i, false],
  ['Webnode', /webnode/i, false],
  ['Squarespace', /squarespace/i, false],
  ['Duda', /dudaone|multiscreensite|irp\.cdn-website\.com/i, false],
  ['Webflow', /webflow/i, false],
  ['Shopify', /cdn\.shopify\.com/i, false],
  ['Joomla', /joomla|option=com_/i, false],
  ['Drupal', /drupal/i, false],
  ['TYPO3', /typo3/i, false],
  ['WordPress', /wp-content|wp-includes/i, false],
  ['FrontRunner (funeral)', /frontrunnerpro|frontrunner professional/i, false],
  ['FuneralOne', /funeralone/i, false],
  ['Tribute Technology', /tributetech|tribute technology/i, false],
  ['ProSites (dental)', /prosites/i, false],
  ['Officite (dental)', /officite/i, false],
  ['FindLaw (legal)', /findlaw\.com\/[^"']*lawyer-?websites|lawyermarketing/i, false],
];

export function detectBuilders(html, generator = '') {
  const hay = generator + '\n' + html;
  const found = [];
  for (const [name, re, old] of BUILDERS) {
    if (re.test(hay)) found.push({ name, old, gen: !!generator && re.test(generator) });
  }
  // Whatever the generator meta tag names wins; otherwise keep list order.
  found.sort((a, b) => Number(b.gen) - Number(a.gen));
  return found.map(({ name, old }) => ({ name, old }));
}

const SIGNALS = [
  ['counter', 'Visitor counter', (h, t) => /besucher\s*(?:nr|nummer)|besucherz(?:ä|ae)hler|you are visitor|visitor (?:number|no\.?|#)|hit counter|webcounter|counter\.digits/i.test(t + h)],
  ['guestbook', 'Guestbook', (h, t) => /guest ?book|g(?:ä|ae)stebuch/i.test(t)],
  ['ie', '"Best viewed in…" notice', (h, t) => /best viewed|optimiert f(?:ü|ue)r (?:den )?(?:internet explorer|ie\b|netscape)|internet explorer \d|netscape navigator/i.test(t)],
  ['resolution', 'Screen-resolution notice', (h, t) => /\b(?:800\s*[x×]\s*600|1024\s*[x×]\s*768)\b/i.test(t)],
  ['flash', 'Flash content', (h) => /\.swf\b|x-shockwave-flash|adobe flash player|get flash/i.test(h)],
  ['frames', 'Frameset layout', (h) => /<frameset\b/i.test(h)],
  ['marquee', '<marquee> / <blink>', (h) => /<(?:marquee|blink)\b/i.test(h)],
  ['font', '<font> tags', (h) => /<font\b/i.test(h)],
  ['construction', '"Under construction"', (h, t) => /under construction|seite (?:ist )?im aufbau|website im aufbau/i.test(t)],
  ['spacer', 'Spacer GIFs', (h) => /spacer\.gif|blank\.gif|pixel\.gif/i.test(h)],
  ['jquery1', 'jQuery 1.x', (h) => /jquery[.-]1\.\d|jquery\/1\.\d/i.test(h)],
];

export function detectSignals(html, text) {
  return SIGNALS.filter(([, , test]) => test(html, text)).map(([key, label]) => ({ key, label }));
}

export function copyrightYears(text, now = new Date().getFullYear()) {
  const out = [];
  const re = /(?:©|\(c\)|copyright)[^\d\n]{0,60}?((?:19|20)\d{2})(?:\s*[-–—/]\s*((?:19|20)\d{2}))?/gi;
  for (const m of String(text || '').matchAll(re)) {
    const y = +(m[2] || m[1]);
    if (y >= 1995 && y <= now + 1) out.push(y);
  }
  return out;
}

export function lastUpdatedYears(text, now = new Date().getFullYear()) {
  const out = [];
  const re = /(?:last (?:updated|modified)|letzte (?:aktualisierung|änderung)|zuletzt (?:aktualisiert|geändert)|stand)\s*:?\s*(?:[a-zäöü]+\.?\s+|\d{1,2}[./]\s*(?:\d{1,2}[./]\s*)?)?((?:19|20)\d{2})/gi;
  for (const m of String(text || '').matchAll(re)) {
    const y = +m[1];
    if (y >= 1995 && y <= now + 1) out.push(y);
  }
  return out;
}

function oldCmsVersion(generator) {
  const g = generator || '';
  let m = /wordpress\s+(\d+)\.(\d+)/i.exec(g);
  if (m && +m[1] < 5) return `WordPress ${m[1]}.${m[2]}`;
  m = /joomla!?\s*(?:-\s*open source content management\s*)?(?:version\s*)?(1\.\d|2\.5|3\.\d)/i.exec(g);
  if (m) return `Joomla ${m[1]}`;
  m = /drupal\s+([5-7])\b/i.exec(g);
  if (m) return `Drupal ${m[1]}`;
  m = /typo3\s+(?:cms\s+)?([4-8])\.\d/i.exec(g);
  if (m) return `TYPO3 ${m[1]}`;
  return null;
}

/** 0–100. Higher = older looking site = better lead for a redesign pitch. */
export function ageScore({ copyrightYear, mobile, https, oldBuilder, signals = [], oldCms }, now = new Date().getFullYear()) {
  let s = 0;
  if (copyrightYear) {
    const age = now - copyrightYear;
    s += age >= 12 ? 35 : age >= 9 ? 28 : age >= 6 ? 18 : age >= 4 ? 8 : 0;
  }
  if (mobile === false) s += 25;
  if (https === false) s += 15;
  if (oldBuilder || oldCms) s += 15;
  s += Math.min(20, signals.length * 7);
  return Math.min(100, s);
}

/** Pure analysis of one HTML document. */
export function analyze(html, baseUrl) {
  const h = String(html || '');
  const text = htmlToText(h);
  const meta = metas(h);
  const links = extractLinks(h, baseUrl);
  const generator = meta.generator || '';
  return {
    title: htmlToText(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(h)?.[1] || '').replace(/\s+/g, ' ').slice(0, 200),
    description: (meta.description || meta['og:description'] || '').slice(0, 300),
    generator,
    viewport: 'viewport' in meta,
    links,
    emails: extractEmails(h),
    phones: extractPhones(text, links),
    socials: extractSocials(links),
    copyrightYears: copyrightYears(text),
    lastUpdated: lastUpdatedYears(text),
    builders: detectBuilders(h, generator),
    oldCms: oldCmsVersion(generator),
    signals: detectSignals(h, text),
    isFrameset: /<frameset\b/i.test(h),
  };
}

// ---------------------------------------------------------------- crawling

const PAGE_RULES = [
  [/impressum|imprint|legal-?notice|mentions-legales|aviso-legal/i, 1],
  [/kontakt|contact|contacto|get-?in-?touch|reach-?us|email-?us/i, 2],
  [/about|(?:ue|ü|u)ber-?uns|wir-?(?:ue|ü)ber-?uns|our-?(?:team|firm|staff|story)|who-?we-?are|team\b|staff/i, 3],
  [/location|directions|anfahrt|find-?us|hours|so-?finden/i, 4],
];

const bareHost = (u) => { try { return new URL(u).hostname.replace(/^www\./i, '').toLowerCase(); } catch { return ''; } };

export function pickCandidates(links, baseUrl) {
  const host = bareHost(baseUrl);
  const out = [];
  for (const l of links) {
    if (!l.abs || !/^https?:/i.test(l.abs)) continue;
    let u;
    try { u = new URL(l.abs); } catch { continue; }
    if (bareHost(u.href) !== host) continue;
    if (/\.(?:pdf|jpe?g|png|gif|zip|docx?|xlsx?|mp[34]|webp|svg|ics|vcf)$/i.test(u.pathname)) continue;
    let path = u.pathname + ' ' + u.search;
    try { path = decodeURIComponent(path); } catch { /* keep raw */ }
    const hay = path + ' ' + l.text;
    let prio = l.frame ? 0.5 : null;
    for (const [re, p] of PAGE_RULES) if (re.test(hay)) prio = Math.min(prio ?? 99, p);
    if (prio != null) {
      u.hash = '';
      out.push({ href: u.href, prio });
    }
  }
  return out;
}

function decodeBody(buf, contentType) {
  let cs = /charset=["']?([\w-]+)/i.exec(contentType || '')?.[1];
  if (!cs) {
    const head = new TextDecoder('latin1').decode(buf.slice(0, 4096));
    cs = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  }
  try { return new TextDecoder(cs || 'utf-8').decode(buf); } catch { return new TextDecoder('utf-8').decode(buf); }
}

export async function fetchPage(url, { timeout = 15000, fetchImpl = globalThis.fetch } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, redirect: 'follow', credentials: 'omit', cache: 'no-store' });
    const ct = res.headers.get('content-type') || '';
    const finalUrl = res.url || url;
    if (ct && !/html|xml|text\/plain/i.test(ct)) return { url: finalUrl, status: res.status, ok: res.ok, html: '' };
    let buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) buf = buf.slice(0, MAX_BYTES);
    return { url: finalUrl, status: res.status, ok: res.ok, html: decodeBody(buf, ct) };
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('Timed out');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const stripHash = (u) => u.replace(/#.*$/, '');

/**
 * Scan a site: start URL, its homepage, then up to maxPages total pages,
 * preferring imprint/contact/about pages. Returns merged findings.
 */
export async function scanSite(startUrl, { maxPages = 4, timeout = 15000, fetchImpl = globalThis.fetch } = {}) {
  const opts = { timeout, fetchImpl };
  let first;
  try {
    first = await fetchPage(startUrl, opts);
  } catch (e) {
    // Old sites often have no (or a broken) certificate. Retry over plain HTTP.
    if (/^https:/i.test(startUrl)) first = await fetchPage(startUrl.replace(/^https:/i, 'http:'), opts);
    else throw e;
  }
  if (!first.ok && !first.html) throw new Error(`HTTP ${first.status}`);

  const pages = [];
  const visited = new Set();
  const queue = [];
  const results = [];

  const take = (page) => {
    visited.add(stripHash(page.url));
    const a = analyze(page.html, page.url);
    results.push(a);
    pages.push({ url: page.url, status: page.status, emails: a.emails.length });
    if (results.length <= 2) {
      for (const c of pickCandidates(a.links, page.url)) {
        if (!visited.has(stripHash(c.href)) && !queue.some((q) => q.href === c.href)) queue.push(c);
      }
      queue.sort((x, y) => x.prio - y.prio);
    }
    return a;
  };

  const home = take(first);
  const origin = new URL(first.url).origin + '/';
  if (!visited.has(origin)) queue.unshift({ href: origin, prio: 0 });

  while (pages.length < maxPages && queue.length) {
    const { href } = queue.shift();
    if (visited.has(stripHash(href))) continue;
    visited.add(stripHash(href));
    try {
      const p = await fetchPage(href, opts);
      if (p.html) take(p);
    } catch { /* one broken subpage shouldn't fail the scan */ }
  }

  const ownDomain = bareHost(first.url);
  const emails = [...new Set(results.flatMap((r) => r.emails))]
    .sort((a, b) => Number(b.endsWith('@' + ownDomain) || b.endsWith('.' + ownDomain)) - Number(a.endsWith('@' + ownDomain) || a.endsWith('.' + ownDomain)));
  const phones = extractPhones('', results.flatMap((r) => r.phones).map((p) => ({ href: 'tel:' + p })));
  const socials = Object.assign({}, ...results.map((r) => r.socials).reverse());
  const years = results.flatMap((r) => r.copyrightYears);
  const updated = results.flatMap((r) => r.lastUpdated);
  const builders = [...new Map(results.flatMap((r) => r.builders).map((b) => [b.name, b])).values()];
  const signals = [...new Map(results.flatMap((r) => r.signals).map((s) => [s.key, s])).values()];
  const oldCms = results.map((r) => r.oldCms).find(Boolean) || null;
  const generator = results.map((r) => r.generator).find(Boolean) || '';
  const https = /^https:/i.test(first.url);
  // A frameset homepage has no viewport itself; judge mobile-friendliness on the first real page.
  const mobile = home.isFrameset && results[1] ? results[1].viewport : home.viewport;
  const copyrightYear = years.length ? Math.max(...years) : null;
  const oldBuilder = builders.find((b) => b.old)?.name || null;

  return {
    finalUrl: first.url,
    https,
    mobile,
    title: home.title || results.find((r) => r.title)?.title || '',
    description: home.description,
    generator,
    builder: builders[0]?.name || null,
    builders: builders.map((b) => b.name),
    oldBuilder,
    oldCms,
    emails,
    phones,
    socials,
    copyrightYear,
    lastUpdated: updated.length ? Math.max(...updated) : null,
    signals: signals.map((s) => s.label),
    score: ageScore({ copyrightYear, mobile, https, oldBuilder, signals, oldCms }),
    pages,
  };
}
