import { h, toast, confirmDialog, download, opts } from '../ui.js';
import * as store from '../../lib/store.js';
import { GOOGLE_DOMAINS } from '../../lib/defaults.js';
import { sitesCsv } from './sites.js';

export const watches = (k) => k === 'settings';

export async function render(root) {
  const s = await store.getSettings();
  const set = (k) => (e) => {
    const el = e.target;
    let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Math.max(+el.min || 0, Math.min(+el.max || 9999, +el.value || 0)) : el.value.trim();
    store.setSettings({ [k]: v }).then(() => toast('Saved'));
  };
  const num = (k, min, max) => h('input', { type: 'number', min, max, value: s[k], onchange: set(k) });

  const fileInput = h('input', {
    type: 'file', accept: 'application/json,.json', hidden: true,
    onchange: async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const n = Object.keys(data?.data || {}).length;
        if (!(await confirmDialog('Import data?', `Merge ${n} records from “${file.name}” into your data? Records with the same id are overwritten.`, 'Import'))) return;
        const done = await store.importAll(data);
        toast(`Imported ${done} records`);
      } catch (err) {
        toast('Import failed: ' + err.message, 'bad');
      }
    },
  });

  root.append(
    h('h1', {}, 'Settings'),
    h('section', { class: 'card form' },
      h('h2', {}, 'Google searches'),
      h('label', { class: 'field' }, h('span', {}, 'Google domain'), h('select', { onchange: set('googleDomain') }, opts(GOOGLE_DOMAINS.map((d) => [d]), s.googleDomain))),
      h('div', { class: 'grid2' },
        h('label', { class: 'field' }, h('span', {}, 'Interface language (hl)'), h('input', { type: 'text', value: s.hl, placeholder: 'en, de…', onchange: set('hl') })),
        h('label', { class: 'field' }, h('span', {}, 'Country (gl)'), h('input', { type: 'text', value: s.gl, placeholder: 'us, de…', onchange: set('gl') }))),
      h('label', { class: 'field' }, h('span', {}, 'Open searches in'), h('select', { onchange: set('openIn') }, opts([['tab', 'A new tab'], ['current', 'The current tab']], s.openIn))),
      h('label', { class: 'field' }, h('span', {}, 'Minimum seconds between searches'), num('minGapSec', 0, 600),
        h('small', { class: 'hint' }, 'Asks before searching again sooner than this. Rapid queries trigger Google CAPTCHAs. 0 turns the check off.'))),

    h('section', { class: 'card form' },
      h('h2', {}, 'Saving & scanning'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.dedupeByDomain, onchange: set('dedupeByDomain') }), ' One entry per domain (skip results from a domain you already saved)'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.autoScan, onchange: set('autoScan') }), ' Scan sites for emails and old-site signals as soon as they are saved'),
      h('div', { class: 'grid2' },
        h('label', { class: 'field' }, h('span', {}, 'Pages per site'), num('scanMaxPages', 1, 10),
          h('small', { class: 'hint' }, 'Homepage first, then imprint / contact / about pages.')),
        h('label', { class: 'field' }, h('span', {}, 'Sites scanned in parallel'), num('scanConcurrency', 1, 6)))),

    h('section', { class: 'card' },
      h('h2', {}, 'Data'),
      h('p', { class: 'muted small' }, 'Everything is stored locally in this browser profile (chrome.storage). Nothing is sent anywhere except the Google searches you open and the fetches of the sites you save.'),
      h('div', { class: 'row wrap gap' },
        h('button', { onclick: async () => download(`searchquest-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await store.exportAll(), null, 1), 'application/json') }, 'Export backup (JSON)'),
        h('button', { onclick: () => fileInput.click() }, 'Import backup'),
        h('button', {
          onclick: async () => {
            const [sites, quests] = await Promise.all([store.sites.list(), store.quests.list()]);
            download(`searchquest-sites-${new Date().toISOString().slice(0, 10)}.csv`, sitesCsv(sites, new Map(quests.map((q) => [q.id, q]))), 'text/csv;charset=utf-8');
          },
        }, 'Export all sites (CSV)'),
        fileInput)),

    h('section', { class: 'card danger-zone' },
      h('h2', {}, 'Danger zone'),
      h('div', { class: 'row wrap gap' },
        h('button', {
          class: 'danger',
          onclick: async () => {
            const sites = await store.sites.list();
            if (!(await confirmDialog('Delete all sites?', `This removes all ${sites.length} saved sites. Quests, templates and blocks stay.`, 'Delete all sites', true))) return;
            await chrome.runtime.sendMessage({ type: 'sites:delete', ids: sites.map((x) => x.id) });
            toast('All sites deleted');
          },
        }, 'Delete all sites'),
        h('button', {
          class: 'danger',
          onclick: async () => {
            if (!(await confirmDialog('Reset everything?', 'Deletes all sites, quests, templates, blocks and settings, then restores the defaults. Export a backup first if you might need it.', 'Reset everything', true))) return;
            await chrome.storage.local.clear();
            await store.seedDefaults();
            location.reload();
          },
        }, 'Reset everything'))),

    h('p', { class: 'muted small' }, 'Outreach note: US cold email (CAN-SPAM) needs a real sender address and an opt-out. Germany (UWG §7) generally requires prior consent for B2B email advertising. Check the rules for your market. This is not legal advice.'),
  );
}
