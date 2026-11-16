// App shell: header, navigation, live re-rendering on storage changes.

import { h } from './ui.js';
import { saveCurrentTab } from './actions.js';
import { timeAgo } from '../lib/util.js';
import * as builder from './views/builder.js';
import * as quests from './views/quests.js';
import * as sites from './views/sites.js';
import * as library from './views/library.js';
import * as settings from './views/settings.js';

const VIEWS = [
  ['builder', 'Builder', builder],
  ['quests', 'Quests', quests],
  ['sites', 'Sites', sites],
  ['library', 'Library', library],
  ['settings', 'Settings', settings],
];

const isPanel = document.body.dataset.mode === 'panel';
const root = document.getElementById('app');
const header = h('header', { class: 'top' });
const banner = h('div', { class: 'banner-slot' });
const main = h('main', { class: 'main' });
root.append(header, banner, main);

let saved = 'builder';
try { saved = localStorage.getItem('sq.view') || 'builder'; } catch { /* ignore */ }
const hashView = location.hash.slice(1);

const app = {
  isPanel,
  view: VIEWS.some((v) => v[0] === hashView) ? hashView : VIEWS.some((v) => v[0] === saved) ? saved : 'builder',
  params: {},
  go(view, params = {}) {
    this.view = view;
    this.params = params;
    try { localStorage.setItem('sq.view', view); } catch { /* ignore */ }
    renderHeader();
    window.scrollTo(0, 0);
    this.rerender();
  },
  rerender,
};

const current = () => VIEWS.find((v) => v[0] === app.view)[2];

function renderHeader() {
  header.replaceChildren(
    h('div', { class: 'brand' },
      h('img', { src: '../icons/icon32.png', alt: '', width: 20, height: 20 }),
      h('span', {}, 'SearchQuest'),
      h('div', { class: 'spacer' }),
      h('button', { class: 'small', title: 'Save the website in the active tab and scan it', onclick: saveCurrentTab }, '+ Save tab'),
      isPanel ? h('button', {
        class: 'small', title: 'Open the full-page view',
        onclick: () => chrome.tabs.create({ url: chrome.runtime.getURL('app/app.html#' + app.view) }),
      }, 'Full view ↗') : null),
    h('nav', { class: 'tabs' }, VIEWS.map(([id, label]) =>
      h('button', { class: id === app.view ? 'on' : '', 'aria-current': id === app.view ? 'page' : null, onclick: () => app.go(id) }, label))),
  );
}

async function renderBanner() {
  const { lastCaptchaAt = 0, captchaDismissed = 0 } = await chrome.storage.local.get(['lastCaptchaAt', 'captchaDismissed']);
  const recent = Date.now() - lastCaptchaAt < 30 * 60 * 1000 && lastCaptchaAt > captchaDismissed;
  banner.replaceChildren(recent ? h('div', { class: 'banner warn' },
    h('span', {}, `Google showed a CAPTCHA ${timeAgo(lastCaptchaAt)}. Space out your searches; quests remember where you stopped.`),
    h('button', { class: 'small', onclick: () => chrome.storage.local.set({ captchaDismissed: Date.now() }) }, 'Dismiss')) : '');
}

let seq = 0;
async function rerender() {
  const my = ++seq;
  const tmp = document.createElement('div');
  // Views pass optional pieces (null/false) and arrays to append(); the native one would stringify them.
  tmp.append = (...kids) => Element.prototype.append.apply(tmp, kids.flat(Infinity).filter((k) => k != null && k !== false && k !== true));
  try {
    await current().render(tmp, app);
  } catch (e) {
    console.error(e);
    tmp.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'bad-text' }, 'Something went wrong: ' + (e?.message || e))));
  }
  if (my !== seq) return;
  // Keep focus and caret in the same input across re-renders.
  const ae = document.activeElement;
  const key = ae?.dataset?.key;
  let sel = null;
  const typed = key && /^(INPUT|TEXTAREA)$/.test(ae.tagName) && ae.type !== 'checkbox' ? ae.value : null;
  if (key) { try { sel = [ae.selectionStart, ae.selectionEnd]; } catch { /* not a text input */ } }
  const y = window.scrollY;
  main.replaceChildren(...tmp.childNodes);
  if (key) {
    const el = main.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (el) {
      if (typed != null && el.value !== typed) el.value = typed; // don't lose unsaved typing
      el.focus({ preventScroll: true });
      if (sel && sel[0] != null) { try { el.setSelectionRange(sel[0], sel[1]); } catch { /* ignore */ } }
    }
  }
  window.scrollTo(0, y);
}

let pending = null;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const keys = Object.keys(changes);
  if (keys.some((k) => k === 'lastCaptchaAt' || k === 'captchaDismissed')) renderBanner();
  const w = current().watches;
  if (w && keys.some(w)) {
    clearTimeout(pending);
    pending = setTimeout(rerender, 250);
  }
});

renderHeader();
renderBanner();
rerender();
