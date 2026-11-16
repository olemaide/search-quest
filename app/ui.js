// Tiny DOM toolkit: h() element builder, chips input, dialogs, toasts.
// All dynamic text goes through text nodes, never innerHTML.

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  append(el, kids);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (['value', 'checked', 'selected', 'open', 'disabled', 'indeterminate'].includes(k)) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  return el;
}

function append(el, kids) {
  for (const k of kids) {
    if (k == null || k === false || k === true) continue;
    if (Array.isArray(k)) append(el, k);
    else el.append(k instanceof Node ? k : String(k));
  }
}

export const opts = (pairs, selected) =>
  pairs.map(([v, l]) => h('option', { value: v, selected: String(v) === String(selected) }, l ?? v));

// ------------------------------------------------------------ toasts

let toastBox;
export function toast(msg, kind = '') {
  if (!toastBox) { toastBox = h('div', { class: 'toasts' }); document.body.append(toastBox); }
  const t = h('div', { class: 'toast ' + kind }, msg);
  toastBox.append(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3000);
}

export async function copyText(text, label = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    toast(label);
  } catch {
    toast('Copy failed. Select the text and press Ctrl+C.', 'bad');
  }
}

export function download(filename, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ------------------------------------------------------------ chips input

export function chipField({ items, onChange, placeholder, key, format = (s) => s }) {
  const add = (raw) => {
    const vals = String(raw).split(/\r?\n/).map((s) => format(s.trim())).filter(Boolean);
    if (!vals.length) return;
    const next = [...items];
    for (const v of vals) if (!next.includes(v)) next.push(v);
    onChange(next);
  };
  const input = h('input', {
    type: 'text', placeholder, 'data-key': key, 'aria-label': placeholder,
    onkeydown: (e) => {
      if (e.key === 'Enter') { e.preventDefault(); const v = e.target.value; e.target.value = ''; add(v); }
      else if (e.key === 'Backspace' && !e.target.value && items.length) onChange(items.slice(0, -1));
    },
    onpaste: (e) => {
      const t = e.clipboardData.getData('text');
      if (/\r?\n/.test(t)) { e.preventDefault(); add(t); }
    },
    onblur: (e) => { const v = e.target.value; if (v.trim()) { e.target.value = ''; add(v); } },
  });
  return h('div', { class: 'chipfield', onclick: (e) => { if (e.target === e.currentTarget) input.focus(); } },
    items.map((it, i) => h('span', { class: 'chip' },
      h('span', { class: 'chip-text', title: it }, it),
      h('button', { type: 'button', class: 'chip-x', title: 'Remove', 'aria-label': 'Remove ' + it,
        onclick: () => onChange(items.filter((_, j) => j !== i)) }, '×'))),
    input);
}

// ------------------------------------------------------------ dialogs

export function modal({ title, body, actions = [{ label: 'Close' }], wide = false }) {
  return new Promise((resolve) => {
    let done = false;
    const close = (v) => {
      if (done) return;
      done = true;
      dlg.close();
      dlg.remove();
      resolve(v);
    };
    const dlg = h('dialog', { class: 'modal' + (wide ? ' wide' : '') },
      h('header', {}, h('h3', {}, title), h('button', { class: 'icon', title: 'Close', onclick: () => close(null) }, '×')),
      h('div', { class: 'modal-body' }, body),
      actions.length ? h('footer', {}, actions.map((a) => h('button', {
        class: a.primary ? 'primary' : a.danger ? 'danger' : '',
        onclick: async () => {
          const v = a.value ? await a.value() : a.label;
          if (v !== false) close(v);
        },
      }, a.label))) : null);
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(null); });
    document.body.append(dlg);
    dlg.showModal();
    dlg.querySelector('input:not([type=checkbox]), textarea, select')?.focus();
  });
}

export async function confirmDialog(title, message, okLabel = 'OK', danger = false) {
  const r = await modal({
    title,
    body: h('p', {}, message),
    actions: [{ label: 'Cancel', value: () => null }, { label: okLabel, primary: !danger, danger, value: () => true }],
  });
  return r === true;
}

/**
 * fields: [{ name, label, type: text|textarea|select|checkbox|number, value, options, hint, placeholder, list }]
 * Resolves to an object of values, or null when cancelled.
 */
export async function form(title, fields, okLabel = 'Save') {
  const els = {};
  const body = h('div', { class: 'form' }, fields.map((f) => {
    let input;
    const id = 'f-' + f.name;
    if (f.type === 'textarea') input = h('textarea', { id, rows: f.rows || 5, placeholder: f.placeholder || '', value: f.value ?? '' });
    else if (f.type === 'select') input = h('select', { id }, opts(f.options, f.value));
    else if (f.type === 'checkbox') input = h('input', { id, type: 'checkbox', checked: !!f.value });
    else input = h('input', { id, type: f.type || 'text', placeholder: f.placeholder || '', value: f.value ?? '', list: f.list ? id + '-list' : null });
    els[f.name] = input;
    const dl = f.list ? h('datalist', { id: id + '-list' }, f.list.map((v) => h('option', { value: v }))) : null;
    if (f.type === 'checkbox') return h('label', { class: 'check' }, input, ' ', f.label);
    return h('label', { class: 'field', for: id }, h('span', {}, f.label), input, dl, f.hint ? h('small', { class: 'hint' }, f.hint) : null);
  }));
  const r = await modal({
    title, body,
    actions: [{ label: 'Cancel', value: () => null }, {
      label: okLabel, primary: true,
      value: () => Object.fromEntries(Object.entries(els).map(([k, el]) => [k, el.type === 'checkbox' ? el.checked : el.value])),
    }],
  });
  return r && typeof r === 'object' ? r : null;
}
