// Kozy startup + tiny hash router: #/home #/budget #/stock #/milk #/settings
import * as store from './store.js';
import { ensureItems } from './logic/stock.js';
import { ensureBills } from './logic/budget.js';
import * as home from './views/home.js';
import * as budgetView from './views/budget.js';
import * as stockView from './views/stock.js';
import * as milkView from './views/milk.js';
import * as settingsView from './views/settings.js';
import { openSpendSheet } from './views/spend-sheet.js';
import { renderLogin } from './views/login.js';
import { toast, closeSheet } from './ui.js';

const ROUTES = { home, budget: budgetView, stock: stockView, milk: milkView, settings: settingsView };

let current = null;
let viewEl = null;
let pending = false;
let afterRender = [];

function routeName() {
  const r = location.hash.replace(/^#\/?/, '') || 'home';
  return ROUTES[r] ? r : 'home';
}

function render() {
  const name = routeName();
  const mod = ROUTES[name];
  const main = document.getElementById('view');
  if (current !== name) {
    if (current) closeSheet(true); // a sheet never stays open over another screen
    current = name;
    viewEl = document.createElement('div');
    viewEl.className = `screen screen-${name}`;
    main.replaceChildren(viewEl);
    mod.bind(viewEl, rerender);
    window.scrollTo(0, 0);
    document.querySelectorAll('.tabbar a').forEach((a) => {
      const on = a.dataset.tab === name;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  // Keep the search box focused (with its cursor) when data changes while you type — e.g. the other phone syncs.
  const a = document.activeElement;
  const keep = a && viewEl.contains(a) && a.matches('[data-search]') ? [a.selectionStart, a.selectionEnd] : null;
  viewEl.innerHTML = mod.render();
  if (keep) {
    const n = viewEl.querySelector('[data-search]');
    if (n) { n.focus(); try { n.setSelectionRange(...keep); } catch { /* not supported */ } }
  }
  document.body.dataset.route = name;
  const cbs = afterRender;
  afterRender = [];
  cbs.forEach((cb) => cb());
}

// Re-render on data change, at most once per frame. Optional callback runs after (e.g. restore focus).
function rerender(cb) {
  if (typeof cb === 'function') afterRender.push(cb);
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; render(); });
}

function updateSyncDot() {
  const busy = store.pending() > 0 || !navigator.onLine;
  document.querySelectorAll('[data-sync]').forEach((d) => {
    d.classList.toggle('busy', busy);
    d.title = busy ? 'Saving…' : 'Synced';
  });
}

async function start() {
  const adapter = await store.initStore();
  const go = async () => {
    const role = store.role();
    if (!role) {
      const err = new Error('not-a-member');
      err.code = 'permission-denied';
      throw err;
    }
    document.body.classList.add(`role-${role}`);
    await store.loadData();
    await ensureItems();
    await ensureBills();
    store.subscribe((col) => (col === 'sync' ? updateSyncDot() : rerender()));
    window.addEventListener('hashchange', render);
    window.addEventListener('online', updateSyncDot);
    window.addEventListener('offline', () => { updateSyncDot(); toast('Offline — saving on this phone'); });
    document.getElementById('fab').addEventListener('click', () => openSpendSheet());
    if (adapter.preview) {
      const bar = document.createElement('div');
      bar.className = 'preview-bar';
      bar.innerHTML = `👀 Preview: ${role === 'viewer' ? 'view-only' : 'wife’s'} view <a href="${location.pathname}#/settings">Exit</a>`;
      document.body.prepend(bar);
    }
    render();
    document.body.classList.add('ready');
  };
  if (adapter.needsAuth && !adapter.isSignedIn()) renderLogin(adapter, () => go().catch(showError));
  else await go();
}

start().catch(showError);

function showError(e) {
  console.error(e);
  const denied = e?.code === 'permission-denied';
  const msg = denied
    ? 'This account cannot open the family data. Sign in with one of the family emails. If you just made an email + password account, open the verify link in your inbox first, then reload.'
    : String(e?.message || e);
  document.getElementById('view').innerHTML = `<div class="card stack"><h2>Kozy could not start</h2><p class="muted">${msg.replace(/</g, '&lt;')}</p>
    <button class="btn primary" onclick="location.reload()">Reload</button>
    ${denied ? '<button class="btn ghost" id="kz-signout">Sign out</button>' : ''}</div>`;
  document.getElementById('kz-signout')?.addEventListener('click', async () => {
    await store.getAdapter()?.signOut?.();
    location.reload();
  });
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW failed', e));
  });
  // A reminder arrived while Kozy is open → show it as a toast too.
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'kozy-push') toast(`🔔 ${e.data.title}`);
  });
}
