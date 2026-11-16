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
      :host { all: initial; }
      .bar { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; width: 290px;
        font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1b1d29;
        background: #fff; border: 1px solid #dfe1ea; border-radius: 12px;
        box-shadow: 0 8px 30px rgba(20, 22, 40, .18); overflow: hidden; }
      @media (prefers-color-scheme: dark) {
        .bar { background: #1b1d27; color: #e7e8ef; border-color: #2f3344; }
        .sub, .status { color: #9aa0b5 !important; }
        button.ghost { color: #e7e8ef; border-color: #3a3f52; }
      }
      header { display: flex; align-items: center; gap: 8px; padding: 10px 12px 6px; }
      .logo { width: 18px; height: 18px; border-radius: 5px; background: #4f46e5; color: #fff;
        display: grid; place-items: center; font-weight: 700; font-size: 11px; }
      .title { font-weight: 650; flex: 1; }
      .sub { padding: 0 12px; color: #6b7084; font-size: 12px; }
      .row { display: flex; gap: 6px; padding: 10px 12px 12px; }
      button { font: inherit; font-weight: 600; border-radius: 8px; padding: 7px 10px; cursor: pointer;
        border: 1px solid #4f46e5; background: #4f46e5; color: #fff; }
      button:disabled { opacity: .5; cursor: default; }
      button.ghost { background: transparent; color: #1b1d29; border-color: #dfe1ea; }
      button.min { border: 0; background: transparent; color: inherit; padding: 2px 6px; font-size: 16px; }
      .status { padding: 0 12px 10px; color: #6b7084; font-size: 12px; }
      .status:empty { display: none; }
      .bar.collapsed .sub, .bar.collapsed .row, .bar.collapsed .status { display: none; }
      .bar.collapsed { width: auto; }
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
