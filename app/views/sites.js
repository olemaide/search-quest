import { h, toast, copyText, confirmDialog, form, modal, download, opts } from '../ui.js';
import { bg, openSearch } from '../actions.js';
import * as store from '../../lib/store.js';
import { STATUSES } from '../../lib/defaults.js';
import { toCsv, toUrl, lines, fmtDate, timeAgo, uniq } from '../../lib/util.js';

const F = { text: '', status: '', questId: '', email: '', scan: '', minScore: 0, sort: 'new' };
let selected = new Set();
let limit = 150;

export const watches = (k) => k.startsWith('site:') || k.startsWith('quest:');

const SORTS = [
  ['new', 'Newest first'], ['old', 'Oldest first'], ['score', 'Old-site score ↓'],
  ['year', 'Copyright year ↑'], ['domain', 'Domain A–Z'], ['status', 'Status'],
];

const safeHref = (u) => (/^https?:\/\//i.test(u || '') ? u : null);

function scanText(s) {
  switch (s.scanState) {
    case 'queued': return 'queued…';
    case 'scanning': return 'scanning…';
    case 'error': return 'scan failed';
    case 'done': return 'no email found';
    default: return 'not scanned';
  }
}

function scoreBadge(s) {
  const v = s.scan?.score;
  if (v == null) return h('span', { class: 'score none', title: 'Not scanned yet' }, '–');
  const cls = v >= 60 ? 'hi' : v >= 30 ? 'mid' : 'lo';
  return h('span', { class: 'score ' + cls, title: 'Old-site score: higher = older-looking site' }, v);
}

function applyFilters(sites) {
  const t = F.text.trim().toLowerCase();
  let out = sites.filter((s) => {
    if (F.status && s.status !== F.status) return false;
    if (F.questId === '_none' ? s.questId : F.questId && s.questId !== F.questId) return false;
    if (F.email === 'yes' && !s.emails?.length) return false;
    if (F.email === 'no' && s.emails?.length) return false;
    if (F.scan === 'none' && s.scanState && s.scanState !== 'none') return false;
    if (F.scan === 'error' && s.scanState !== 'error') return false;
    if (F.minScore && (s.scan?.score ?? -1) < F.minScore) return false;
    if (t) {
      const hay = [s.title, s.domain, s.notes, s.location, ...(s.emails || []), ...(s.tags || []), s.scan?.builder].join(' ').toLowerCase();
      if (!hay.includes(t)) return false;
    }
    return true;
  });
  const by = {
    new: (a, b) => b.createdAt - a.createdAt,
    old: (a, b) => a.createdAt - b.createdAt,
    score: (a, b) => (b.scan?.score ?? -1) - (a.scan?.score ?? -1),
    year: (a, b) => (a.scan?.copyrightYear ?? 9999) - (b.scan?.copyrightYear ?? 9999),
    domain: (a, b) => a.domain.localeCompare(b.domain),
    status: (a, b) => STATUSES.findIndex((x) => x[0] === a.status) - STATUSES.findIndex((x) => x[0] === b.status),
  }[F.sort];
  out.sort(by || ((a, b) => b.createdAt - a.createdAt));
  return out;
}

export function sitesCsv(list, qmap) {
  const rows = [['domain', 'url', 'title', 'emails', 'phones', 'status', 'old_site_score', 'copyright_year', 'builder', 'https', 'mobile_friendly', 'signals', 'quest', 'location', 'tags', 'notes', 'query', 'saved_at', 'scanned_at']];
  for (const s of list) {
    rows.push([
      s.domain, s.url, s.title, s.emails || [], s.phones || [], s.status, s.scan?.score ?? '', s.scan?.copyrightYear ?? '',
      s.scan?.builder ?? '', s.scan ? (s.scan.https ? 'yes' : 'no') : '', s.scan ? (s.scan.mobile ? 'yes' : 'no') : '',
      s.scan?.signals || [], qmap.get(s.questId)?.name || '', s.location || '', s.tags || [], s.notes || '', s.query || '',
      s.createdAt ? new Date(s.createdAt).toISOString() : '', s.scannedAt ? new Date(s.scannedAt).toISOString() : '',
    ]);
  }
  return '﻿' + toCsv(rows);
}

export async function render(root, app) {
  if (app.params.questId) { F.questId = app.params.questId; app.params = {}; }
  const [sites, quests] = await Promise.all([store.sites.list(), store.quests.list()]);
  const qmap = new Map(quests.map((q) => [q.id, q]));
  const ids = new Set(sites.map((s) => s.id));
  selected = new Set([...selected].filter((id) => ids.has(id)));
  const list = applyFilters(sites);
  const target = selected.size ? sites.filter((s) => selected.has(s.id)) : list;
  const targetLabel = selected.size ? `${selected.size} selected` : `${list.length} shown`;
  const set = (k, v) => { F[k] = v; limit = 150; app.rerender(); };

  const unscanned = sites.filter((s) => !s.scanState || s.scanState === 'none' || s.scanState === 'error');
  const busy = sites.filter((s) => s.scanState === 'queued' || s.scanState === 'scanning').length;

  root.append(
    h('div', { class: 'row between wrap gap' },
      h('h1', {}, 'Sites'),
      h('div', { class: 'row wrap gap' },
        h('button', { onclick: () => addUrls(quests) }, '+ Add URLs'),
        unscanned.length ? h('button', { onclick: async () => { const n = await bg('sites:scan', { ids: unscanned.map((s) => s.id) }); toast(`Scanning ${n} sites`); } }, `Scan unscanned (${unscanned.length})`) : null)),

    h('div', { class: 'card filters' },
      h('input', { type: 'search', placeholder: 'Search title, domain, email, notes…', value: F.text, 'data-key': 's-text', oninput: (e) => set('text', e.target.value) }),
      h('div', { class: 'row wrap gap' },
        h('select', { 'aria-label': 'Status', onchange: (e) => set('status', e.target.value) }, opts([['', 'Any status'], ...STATUSES], F.status)),
        h('select', { 'aria-label': 'Quest', onchange: (e) => set('questId', e.target.value) }, opts([['', 'All quests'], ['_none', 'No quest'], ...quests.map((q) => [q.id, q.name])], F.questId)),
        h('select', { 'aria-label': 'Email', onchange: (e) => set('email', e.target.value) }, opts([['', 'Email: any'], ['yes', 'Has email'], ['no', 'No email']], F.email)),
        h('select', { 'aria-label': 'Scan', onchange: (e) => set('scan', e.target.value) }, opts([['', 'Scan: any'], ['none', 'Not scanned'], ['error', 'Scan failed']], F.scan)),
        h('select', { 'aria-label': 'Minimum score', onchange: (e) => set('minScore', +e.target.value) }, opts([[0, 'Any score'], [30, 'Score ≥ 30'], [50, 'Score ≥ 50'], [70, 'Score ≥ 70']], F.minScore)),
        h('select', { 'aria-label': 'Sort', onchange: (e) => set('sort', e.target.value) }, opts(SORTS, F.sort)))),

    h('div', { class: 'row between wrap gap bulk' },
      h('span', { class: 'muted small' },
        `${list.length} of ${sites.length} sites · ${list.filter((s) => s.emails?.length).length} with email`,
        busy ? ` · scanning ${busy}…` : '',
        selected.size ? ` · ${selected.size} selected` : ''),
      h('div', { class: 'row wrap gap' },
        selected.size ? [
          h('button', { class: 'small', onclick: async () => { await bg('sites:scan', { ids: [...selected] }); toast('Scan queued'); } }, 'Scan'),
          h('select', {
            class: 'small', 'aria-label': 'Set status',
            onchange: async (e) => { if (!e.target.value) return; await bg('sites:patch', { ids: [...selected], patch: { status: e.target.value } }); toast('Status updated'); },
          }, opts([['', 'Set status…'], ...STATUSES])),
          h('button', {
            class: 'small danger',
            onclick: async () => {
              if (!(await confirmDialog('Delete sites?', `Delete ${selected.size} selected sites? This can't be undone.`, 'Delete', true))) return;
              await bg('sites:delete', { ids: [...selected] });
              selected.clear();
            },
          }, 'Delete'),
          h('button', { class: 'small', onclick: () => { selected.clear(); app.rerender(); } }, 'Clear selection'),
        ] : null,
        h('button', {
          class: 'small', disabled: !target.length, title: `Copy the emails of ${targetLabel}`,
          onclick: () => {
            const emails = uniq(target.flatMap((s) => s.emails || []));
            if (!emails.length) return toast('No emails in these sites yet.');
            copyText(emails.join('\n'), `Copied ${emails.length} emails`);
          },
        }, 'Copy emails'),
        h('button', {
          class: 'small', disabled: !target.length, title: `Export ${targetLabel} as CSV`,
          onclick: () => download(`searchquest-sites-${new Date().toISOString().slice(0, 10)}.csv`, sitesCsv(target, qmap), 'text/csv;charset=utf-8'),
        }, 'Export CSV'))),

    sites.length ? null : h('div', { class: 'card empty-state' },
      h('p', {}, 'No saved sites yet.'),
      h('p', { class: 'muted' }, 'Run a search, then click “+ Save” next to a Google result (or “Save all new” in the floating bar). You can also save the current tab, right-click a link, or paste URLs.')),

    list.length ? h('div', { class: 'stable' },
      h('div', { class: 'srow shead' },
        h('input', {
          type: 'checkbox', 'aria-label': 'Select all shown',
          checked: list.length > 0 && list.every((s) => selected.has(s.id)),
          indeterminate: list.some((s) => selected.has(s.id)) && !list.every((s) => selected.has(s.id)),
          onchange: (e) => { list.forEach((s) => (e.target.checked ? selected.add(s.id) : selected.delete(s.id))); app.rerender(); },
        }),
        h('span', {}, 'Site'), h('span', {}, 'Email'), h('span', { title: 'Old-site score' }, 'Score'), h('span', {}, '©'), h('span', {}, 'Builder'), h('span', {}, 'Status'), h('span', {})),
      list.slice(0, limit).map((s) => row(s, qmap, app)),
      list.length > limit ? h('button', { class: 'more', onclick: () => { limit += 300; app.rerender(); } }, `Show more (${list.length - limit} hidden)`) : null) : null,
  );
}

function row(s, qmap, app) {
  const quest = qmap.get(s.questId);
  return h('div', { class: 'srow' + (selected.has(s.id) ? ' sel' : '') },
    h('input', { type: 'checkbox', 'aria-label': 'Select ' + s.domain, checked: selected.has(s.id), onchange: (e) => { e.target.checked ? selected.add(s.id) : selected.delete(s.id); app.rerender(); } }),
    h('button', { class: 's-main', onclick: () => openDetail(s.id, qmap) },
      h('span', { class: 's-title' }, s.title || s.domain),
      h('span', { class: 's-sub' }, s.domain, quest ? ` · ${quest.name}` : '', s.location ? ` · ${s.location}` : '')),
    h('div', { class: 's-emails' }, s.emails?.length
      ? [h('button', { class: 'email', title: 'Copy ' + s.emails[0], onclick: () => copyText(s.emails[0]) }, s.emails[0]), s.emails.length > 1 ? h('span', { class: 'muted small' }, ` +${s.emails.length - 1}`) : null]
      : h('span', { class: 'muted small' + (s.scanState === 'error' ? ' bad-text' : ''), title: s.scanError || '' }, scanText(s))),
    h('div', { class: 's-score' }, scoreBadge(s)),
    h('div', { class: 's-year' }, s.scan?.copyrightYear ?? '–'),
    h('div', { class: 's-builder', title: (s.scan?.builders || []).join(', ') }, s.scan?.builder || ''),
    h('select', { class: 's-status st-' + s.status, 'aria-label': 'Status', onchange: (e) => bg('sites:patch', { ids: [s.id], patch: { status: e.target.value } }) }, opts(STATUSES, s.status)),
    h('button', {
      class: 'icon s-scan' + (s.scanState === 'scanning' || s.scanState === 'queued' ? ' spin' : ''), title: 'Scan again',
      onclick: () => bg('sites:scan', { ids: [s.id] }),
    }, '⟳'));
}

async function addUrls(quests) {
  const v = await form('Add sites', [
    { name: 'urls', label: 'URLs, one per line', type: 'textarea', rows: 8, placeholder: 'mueller-dach.de\nhttps://www.smith-funeral-home.com' },
    { name: 'questId', label: 'Add to quest', type: 'select', value: '', options: [['', 'No quest'], ...quests.map((q) => [q.id, q.name])] },
    { name: 'scan', label: 'Scan them for emails right away', type: 'checkbox', value: true },
  ], 'Add');
  if (!v) return;
  const items = lines(v.urls).map(toUrl).filter(Boolean).map((url) => ({ url }));
  if (!items.length) return toast('No valid URLs found.', 'bad');
  const r = await bg('sites:add', { items, questId: v.questId || null, scan: v.scan });
  toast(`Added ${r.added.length}${r.dupes.length ? `, ${r.dupes.length} already saved` : ''}`);
}

// ------------------------------------------------------------ detail dialog

async function openDetail(id, qmap) {
  const body = h('div', { class: 'detail' });
  const draw = async () => {
    const s = await store.sites.get(id);
    if (!s) { body.replaceChildren(h('p', { class: 'muted' }, 'This site was deleted.')); return; }
    body.replaceChildren(...detail(s, qmap).filter(Boolean));
  };
  await draw();
  const onChange = (ch, area) => {
    if (area !== 'local' || !ch['site:' + id]) return;
    const ae = document.activeElement;
    if (body.contains(ae) && /^(INPUT|TEXTAREA)$/.test(ae.tagName)) return; // don't clobber typing
    draw();
  };
  chrome.storage.onChanged.addListener(onChange);
  await modal({ title: 'Site details', body, wide: true, actions: [] });
  chrome.storage.onChanged.removeListener(onChange);
}

function kv(label, value) {
  return value == null || value === '' ? null : h('div', { class: 'kv' }, h('span', { class: 'k' }, label), h('span', { class: 'v' }, value));
}

function detail(s, qmap) {
  const patch = (p) => bg('sites:patch', { ids: [s.id], patch: p });
  const sc = s.scan;
  const quest = qmap.get(s.questId);
  let newEmail = '';

  return [
    h('div', { class: 'detail-head' },
      h('div', {},
        h('div', { class: 'detail-title' }, s.title || s.domain),
        h('a', { href: safeHref(s.url), target: '_blank', rel: 'noopener noreferrer', class: 'small' }, s.url)),
      h('div', { class: 'row wrap gap' },
        h('select', { 'aria-label': 'Status', class: 'st-' + s.status, onchange: (e) => patch({ status: e.target.value }) }, opts(STATUSES, s.status)),
        h('button', { class: 'small', onclick: () => bg('sites:scan', { ids: [s.id] }) }, s.scanState === 'scanning' || s.scanState === 'queued' ? 'Scanning…' : sc ? 'Rescan' : 'Scan'),
        h('button', {
          class: 'small danger',
          onclick: async () => {
            if (!(await confirmDialog('Delete site?', s.domain, 'Delete', true))) return;
            await bg('sites:delete', { ids: [s.id] });
            document.querySelector('dialog.modal[open] header .icon')?.click();
          },
        }, 'Delete'))),

    s.scanState === 'error' ? h('p', { class: 'bad-text small' }, 'Last scan failed: ' + (s.scanError || 'unknown error') + '. The site may be down, slow, or block bots.') : null,

    h('div', { class: 'detail-grid' },
      h('section', {},
        h('h3', {}, 'Contact'),
        s.emails?.length ? h('ul', { class: 'plain' }, s.emails.map((e) => h('li', { class: 'row gap' },
          h('button', { class: 'email', title: 'Copy', onclick: () => copyText(e) }, e),
          h('a', { href: 'mailto:' + e, class: 'small' }, 'mail'),
          h('button', { class: 'icon small', title: 'Remove', onclick: () => patch({ emails: s.emails.filter((x) => x !== e) }) }, '×'))))
          : h('p', { class: 'muted small' }, s.scanState === 'done' ? 'No email found on the scanned pages. Try the contact form or call.' : scanText(s)),
        h('div', { class: 'row gap' },
          h('input', { type: 'email', placeholder: 'Add email manually', oninput: (e) => { newEmail = e.target.value; } }),
          h('button', {
            class: 'small',
            onclick: () => {
              const e = newEmail.trim().toLowerCase();
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return toast('That doesn’t look like an email.', 'bad');
              patch({ emails: uniq([...(s.emails || []), e]) });
            },
          }, 'Add')),
        s.phones?.length ? h('div', { class: 'mt' }, h('span', { class: 'k' }, 'Phone '), s.phones.map((p) => h('a', { href: 'tel:' + p.replace(/[^\d+]/g, ''), class: 'tag' }, p))) : null,
        sc?.socials && Object.keys(sc.socials).length ? h('div', { class: 'mt' }, Object.entries(sc.socials).map(([k, u]) => h('a', { href: safeHref(u), target: '_blank', rel: 'noopener noreferrer', class: 'tag' }, k))) : null),

      h('section', {},
        h('h3', {}, 'Old-site signals'),
        sc ? [
          h('div', { class: 'row gap' }, scoreBadge(s), h('span', { class: 'muted small' }, 'Old-site score (0–100)')),
          kv('Copyright year', sc.copyrightYear),
          kv('Last updated', sc.lastUpdated),
          kv('Builder / CMS', sc.builders?.join(', ')),
          kv('Generator tag', sc.generator),
          kv('Outdated CMS', sc.oldCms),
          kv('HTTPS', sc.https ? 'yes' : 'no ⚠'),
          kv('Mobile viewport', sc.mobile ? 'yes' : 'no ⚠'),
          sc.signals?.length ? h('div', { class: 'tags' }, sc.signals.map((x) => h('span', { class: 'tag warn' }, x))) : null,
        ] : h('p', { class: 'muted small' }, scanText(s)))),

    h('section', {},
      h('h3', {}, 'Notes'),
      h('textarea', { rows: 3, value: s.notes || '', placeholder: 'What to pitch, who you talked to…', onchange: (e) => patch({ notes: e.target.value }) }),
      h('label', { class: 'field' }, h('span', {}, 'Tags (comma separated)'),
        h('input', { type: 'text', value: (s.tags || []).join(', '), onchange: (e) => patch({ tags: uniq(e.target.value.split(',').map((t) => t.trim()).filter(Boolean)) }) }))),

    h('section', { class: 'source' },
      h('h3', {}, 'Source'),
      kv('Quest', quest ? quest.name + (s.location ? ' · ' + s.location : '') : s.location || null),
      s.query ? h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Query'),
        h('span', { class: 'v' }, h('code', {}, s.query), ' ',
          h('button', { class: 'link small', onclick: () => copyText(s.query) }, 'copy'), ' ',
          h('button', { class: 'link small', onclick: () => openSearch(s.query, s.questId ? { questId: s.questId, location: s.location } : {}) }, 're-run'))) : null,
      kv('Google snippet', s.snippet),
      kv('Description', sc?.description),
      kv('Saved', fmtDate(s.createdAt)),
      kv('Scanned', s.scannedAt ? `${fmtDate(s.scannedAt)} (${timeAgo(s.scannedAt)})` : null),
      sc?.pages?.length ? h('details', {}, h('summary', { class: 'small' }, `${sc.pages.length} pages scanned`),
        h('ul', { class: 'plain small' }, sc.pages.map((p) => h('li', {}, h('a', { href: safeHref(p.url), target: '_blank', rel: 'noopener noreferrer' }, p.url), ` · ${p.status} · ${p.emails} email${p.emails === 1 ? '' : 's'}`)))) : null),
  ];
}
