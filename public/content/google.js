// Runs on Google results pages. Adds a "+ Save" button to each organic result and a small
// floating bar ("Save all new"). It never runs searches by itself and only reads the page you opened.
(() => {
  if (window.__searchQuest) return;
  window.__searchQuest = true;

  const send = (type, data = {}) =>
    chrome.runtime.sendMessage({ type, ...data }).then((r) => {
      if (!r?.ok) throw new Error(r?.error || 'No response');
      return r.data;
    });

  // ------------------------------------------------------------ floating bar (shadow DOM)
  const host = document.createElement('div');
  host.id = 'sq-host';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      /* shadcn/ui "neutral" tokens, mirrored from src/index.css (kept vanilla: no React on Google pages). */
      :host { all: initial; }
      .bar { --bg: #fff; --fg: #0a0a0a; --muted: #737373; --border: #e5e5e5; --primary: #171717; --primary-fg: #fafafa;
        --secondary: #f5f5f5; --ring: #a3a3a3; --radius: 10px;
        position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; width: 300px;
        font: 13px/1.45 "Geist Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        color: var(--fg); background: var(--bg); border: 1px solid var(--border); border-radius: calc(var(--radius) + 4px);
        box-shadow: 0 10px 30px -10px rgba(0,0,0,.25), 0 2px 6px rgba(0,0,0,.06); overflow: hidden; }
      @media (prefers-color-scheme: dark) {
        .bar { --bg: #171717; --fg: #fafafa; --muted: #a1a1a1; --border: rgba(255,255,255,.1); --primary: #e5e5e5;
          --primary-fg: #171717; --secondary: #262626; --ring: #737373; }
      }
      header { display: flex; align-items: center; gap: 8px; padding: 12px 12px 4px 14px; }
      .logo { width: 18px; height: 18px; border-radius: 5px; background: #4f46e5; color: #fff;
        display: grid; place-items: center; font-weight: 700; font-size: 9px; letter-spacing: -.02em; }
      .title { font-weight: 600; flex: 1; letter-spacing: -.01em; }
      .sub { padding: 0 14px; color: var(--muted); font-size: 12px; }
      .ctx { color: var(--fg); }
      .row { display: flex; gap: 6px; padding: 12px 14px 14px; }
      button { font: inherit; font-weight: 500; font-size: 12.5px; height: 32px; padding: 0 12px; border-radius: calc(var(--radius) - 2px);
        cursor: pointer; border: 1px solid transparent; background: var(--primary); color: var(--primary-fg);
        transition: opacity .15s, background .15s; }
      button:hover { opacity: .9; }
      button:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 50%, transparent); }
      button:disabled { opacity: .5; cursor: default; }
      button.ghost { background: var(--bg); color: var(--fg); border-color: var(--border); }
      button.ghost:hover { background: var(--secondary); opacity: 1; }
      button.min { height: 24px; width: 24px; padding: 0; border: 0; background: transparent; color: var(--muted); font-size: 16px; line-height: 1; }
      button.min:hover { background: var(--secondary); color: var(--fg); opacity: 1; }
      .all { flex: 1; }
      .status { margin: 0 14px 12px; padding: 8px 10px; border-radius: calc(var(--radius) - 2px); background: var(--secondary); color: var(--muted); font-size: 12px; }
      .status:empty { display: none; }
      .bar.collapsed .sub, .bar.collapsed .row, .bar.collapsed .status { display: none; }
      .bar.collapsed { width: auto; }
      .bar.collapsed header { padding-bottom: 12px; }
    </style>
    <div class="bar">
      <header><span class="logo">SQ</span><span class="title">SearchQuest</span><button class="min" title="Minimise">–</button></header>
      <div class="sub ctx"></div>
      <div class="sub counts"></div>
      <div class="row"><button class="all">Save all new</button><button class="ghost again">Re-check</button></div>
      <div class="status"></div>
    </div>`;
  const $ = (s) => root.querySelector(s);
  const bar = $('.bar');
  const setStatus = (t) => { $('.status').textContent = t || ''; };
  $('.min').addEventListener('click', () => {
    bar.classList.toggle('collapsed');
    $('.min').textContent = bar.classList.contains('collapsed') ? '+' : '–';
    try { sessionStorage.setItem('sq-collapsed', bar.classList.contains('collapsed') ? '1' : ''); } catch { /* ignore */ }
  });
  try { if (sessionStorage.getItem('sq-collapsed')) { bar.classList.add('collapsed'); $('.min').textContent = '+'; } } catch { /* ignore */ }
  document.documentElement.append(host);

  // ------------------------------------------------------------ CAPTCHA page
  if (location.pathname.startsWith('/sorry') || document.querySelector('#captcha-form')) {
    send('serp:captcha').catch(() => {});
    $('.ctx').textContent = 'Google is showing a CAPTCHA.';
    $('.counts').textContent = 'Solve it, then slow down: wait a minute or two between searches.';
    $('.row').remove();
    return;
  }

  const query = new URLSearchParams(location.search).get('q') || '';
  if (!query) { host.remove(); return; }

  /** url -> { url, title, snippet, btns: [], saved } */
  const results = new Map();

  function resultUrl(a) {
    let href = a.href;
    try {
      const u = new URL(href);
      if (/(^|\.)google\.[a-z.]+$/i.test(u.hostname)) {
        if (u.pathname !== '/url') return null;
        href = u.searchParams.get('q') || u.searchParams.get('url') || '';
      }
    } catch { return null; }
    return /^https?:\/\//i.test(href) ? href : null;
  }

  function markSaved(url) {
    const r = results.get(url);
    if (!r) return;
    r.saved = true;
    for (const b of r.btns) { b.textContent = '✓ Saved'; b.classList.add('saved'); }
  }

  function updateCounts() {
    const all = [...results.values()];
    const fresh = all.filter((r) => !r.saved).length;
    $('.counts').textContent = `${all.length} results on this page · ${all.length - fresh} saved`;
    $('.all').textContent = fresh ? `Save all new (${fresh})` : 'All saved';
    $('.all').disabled = !fresh;
  }

  async function recheck(urls) {
    if (!urls.length) return;
    try {
      const saved = await send('sites:check', { urls });
      saved.forEach((id, i) => { if (id) markSaved(urls[i]); });
    } catch (e) {
      setStatus('Extension not reachable. Reload this page if you just updated SearchQuest.');
    }
    updateCounts();
  }

  async function save(urls) {
    const items = urls.map((u) => results.get(u)).filter((r) => r && !r.saved)
      .map(({ url, title, snippet }) => ({ url, title, snippet }));
    if (!items.length) return;
    setStatus('Saving…');
    try {
      const res = await send('sites:add', { items, query });
      items.forEach((i) => markSaved(i.url));
      const scan = ctx?.autoScan ? ' Scanning for emails in the background.' : '';
      setStatus(`Saved ${res.added.length}${res.dupes.length ? `, ${res.dupes.length} already in your list` : ''}.${res.added.length ? scan : ''}`);
      // Dedupe-by-domain can make other results on the page duplicates too.
      recheck([...results.values()].filter((r) => !r.saved).map((r) => r.url));
    } catch (e) {
      setStatus('Could not save: ' + e.message);
    }
    updateCounts();
  }

  function collect() {
    const scope = document.querySelector('#rso') || document.querySelector('#search');
    if (!scope) return;
    const fresh = [];
    for (const a of scope.querySelectorAll('a[href]:has(h3)')) {
      if (a.dataset.sqDone) continue;
      a.dataset.sqDone = '1';
      if (a.closest('#tads, #bottomads, [data-text-ad]')) continue;
      const url = resultUrl(a);
      if (!url) continue;
      const title = (a.querySelector('h3')?.textContent || '').trim();
      const box = a.closest('.MjjYud, .g, [data-hveid]') || a.parentElement;
      const snip = box?.querySelector('.VwiC3b, [data-sncf="1"], [style*="line-clamp"]');
      const snippet = (snip?.textContent || '').trim().slice(0, 400);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sq-save';
      btn.textContent = '+ Save';
      btn.title = 'Save this site to SearchQuest';
      btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); save([url]); });
      const wrap = document.createElement('div');
      wrap.className = 'sq-wrap';
      wrap.append(btn);
      a.insertAdjacentElement('afterend', wrap);

      const r = results.get(url) || { url, title, snippet, btns: [], saved: false };
      r.btns.push(btn);
      if (r.saved) markSaved(url);
      results.set(url, r);
      fresh.push(url);
    }
    if (fresh.length) recheck(fresh);
    updateCounts();
  }

  let ctx = null;
  send('serp:context', { query }).then((c) => {
    ctx = c;
    $('.ctx').textContent = c.quest
      ? `Quest: ${c.quest.name}${c.location ? ' · ' + c.location : ''}`
      : 'Not part of a quest. Saved sites stay unassigned.';
  }).catch(() => { $('.ctx').textContent = 'Extension not reachable. Reload this page.'; });

  $('.all').addEventListener('click', () => save([...results.keys()]));
  $('.again').addEventListener('click', () => recheck([...results.keys()]));

  collect();
  let t = null;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(collect, 400); })
    .observe(document.body, { childList: true, subtree: true });
})();
