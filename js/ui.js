// Small shared UI helpers: icons, bottom sheet, toast, confirm.
import { esc } from './logic/format.js';

const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-5h4v5"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18"/><circle cx="16.5" cy="15" r="1.2" fill="currentColor"/><path d="M7 6V4.5h10V6"/>',
  box: '<path d="M3 8 12 3l9 5v8l-9 5-9-5Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
  milk: '<path d="M9 2h6v3l2 3v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8l2-3Z"/><path d="M7 12h10"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  share: '<path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.5 12h11L21 7H6"/>',
  repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  upload: '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>',
  minus: '<path d="M5 12h14"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7Z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  note: '<path d="M5 4h14v16H5z"/><path d="M9 9h6M9 13h6M9 17h3"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4Z"/><circle cx="12" cy="13" r="3.5"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16Z"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;
}

export function logo(size = 28) {
  // House + coin: a roof over a ₹ coin.
  return `<svg class="logo" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="16" fill="var(--brand)"/>
    <path d="M12 30 32 13l20 17" fill="none" stroke="var(--brand-ink)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="32" cy="38" r="13" fill="var(--coin)"/>
    <text x="32" y="44.5" text-anchor="middle" font-size="17" font-weight="800" font-family="system-ui, sans-serif" fill="var(--coin-ink)">₹</text>
  </svg>`;
}

// ---------- Bottom sheet ----------
let sheetEl = null;
let onCloseFn = null;

export function openSheet(html, { onClose, cls = '' } = {}) {
  closeSheet(true);
  const root = document.getElementById('overlay');
  root.innerHTML = `<div class="backdrop" data-close></div>
    <div class="sheet ${cls}" role="dialog" aria-modal="true">
      <div class="grabber" data-close></div>
      ${html}
    </div>`;
  root.hidden = false;
  sheetEl = root.querySelector('.sheet');
  onCloseFn = onClose || null;
  requestAnimationFrame(() => root.classList.add('open'));
  root.querySelector('.backdrop').addEventListener('click', () => closeSheet());
  root.querySelector('.grabber').addEventListener('click', () => closeSheet());
  const first = sheetEl.querySelector('[autofocus]');
  if (first) setTimeout(() => first.focus(), 60);
  return sheetEl;
}

export function closeSheet(silent = false) {
  const root = document.getElementById('overlay');
  if (!root || root.hidden) return;
  root.classList.remove('open');
  root.hidden = true;
  root.innerHTML = '';
  sheetEl = null;
  const fn = onCloseFn;
  onCloseFn = null;
  if (!silent && fn) fn();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
});

export function confirmSheet({ title, body = '', ok = 'Yes', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const el = openSheet(`
      <h2 class="sheet-title">${esc(title)}</h2>
      ${body ? `<p class="muted">${body}</p>` : ''}
      <div class="row gap">
        <button class="btn ghost grow" data-no>Cancel</button>
        <button class="btn grow ${danger ? 'danger' : 'primary'}" data-yes>${esc(ok)}</button>
      </div>`, { onClose: () => { if (!answered) resolve(false); } });
    el.querySelector('[data-no]').onclick = () => { answered = true; closeSheet(true); resolve(false); };
    el.querySelector('[data-yes]').onclick = () => { answered = true; closeSheet(true); resolve(true); };
  });
}

// ---------- Toast ----------
let toastTimer;
// toast('Saved') · toast('Oops', 'err') · toast('Deleted', { undo: async () => {...} }) → shows Undo for 5 s
export function toast(msg, opts = '') {
  const o = typeof opts === 'string' ? { kind: opts } : opts;
  const el = document.getElementById('toast');
  el.replaceChildren(document.createTextNode(msg));
  if (o.undo) {
    const b = document.createElement('button');
    b.className = 'toast-undo';
    b.textContent = 'Undo';
    b.onclick = async () => {
      clearTimeout(toastTimer);
      el.className = 'toast';
      try { await o.undo(); toast('Undone ✓'); } catch (e) { toast(e.message, 'err'); }
    };
    el.appendChild(b);
  }
  el.className = `toast show ${o.kind || ''} ${o.undo ? 'has-undo' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, o.undo ? 5000 : 2200);
}

// A blocked write (view-only user, or a member touching setup) shows a friendly message instead of failing silently.
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.name === 'ReadOnlyError') { e.preventDefault(); toast(e.reason.message, 'err'); }
});

export function bump(el) {
  if (!el) return;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
  try { navigator.vibrate?.(8); } catch { /* not supported on iPhone */ }
}

export function download(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function shareText(title, text) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok ? 'copied' : 'failed';
  }
}

export function bar(spent, limit, lvl) {
  const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
  return `<div class="bar ${lvl}" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct.toFixed(1)}%"></span></div>`;
}
