// Kozy startup + tiny hash router: #/home #/budget #/stock #/milk #/settings
import * as store from './store.js';
import { ensureItems } from './logic/stock.js';
import { ensureBills } from './logic/budget.js';
import { GUEST, GUEST_KEY } from './config.js';
import * as home from './views/home.js';
import * as budgetView from './views/budget.js';
import * as stockView from './views/stock.js';
import * as milkView from './views/milk.js';
import * as settingsView from './views/settings.js';
import { openSpendSheet } from './views/spend-sheet.js';
import { runGate } from './views/auth.js';
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
    viewEl.className = `screen screen-${name} enter`; // entrance animation, only when the screen changes
    const el = viewEl;
    setTimeout(() => el.classList.remove('enter'), 900);
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
    if (!role) throw new Error('No household found for this account.');
    document.body.classList.add(`role-${role}`);
    if (adapter.name === 'firestore') { adapter.onAccessLost = accessLost; watchMembership(adapter); }
    await store.loadData();
    await applySetup(adapter);
    if (GUEST && !store.list('entries').length) {
      const { loadDemo } = await import('./logic/demo.js'); // a guest starts with a realistic sample month
      await loadDemo();
    }
    await ensureItems();
    await ensureBills();
    store.subscribe((col) => (col === 'sync' ? updateSyncDot() : rerender()));
    window.addEventListener('hashchange', render);
    window.addEventListener('online', updateSyncDot);
    window.addEventListener('offline', () => { updateSyncDot(); toast('Offline — saving on this phone'); });
    document.getElementById('fab').addEventListener('click', () => openSpendSheet());
    if (GUEST) {
      const bar = document.createElement('div');
      bar.className = 'preview-bar';
      bar.dataset.test = 'guest-bar';
      bar.innerHTML = '👤 Guest mode · sample data on this phone only <button type="button">Sign in</button>';
      bar.querySelector('button').onclick = () => { try { localStorage.removeItem(GUEST_KEY); } catch { /* ignore */ } location.reload(); };
      document.body.prepend(bar);
    }
    if (adapter.preview) {
      const bar = document.createElement('div');
      bar.className = 'preview-bar';
      bar.innerHTML = `👀 Preview: ${role === 'viewer' ? 'view-only' : 'wife’s'} view <a href="${location.pathname}#/settings">Exit</a>`;
      document.body.prepend(bar);
    }
    render();
    document.body.classList.add('ready');
  };
  if (adapter.needsAuth) await runGate(adapter); // sign in / verify email / create household, then start
  await go();
}

// First run of a brand-new household: apply what was chosen on the onboarding screen (once).
async function applySetup(adapter) {
  const setup = adapter.pendingSetup;
  if (!setup) return;
  adapter.pendingSetup = null;
  if (setup.demo) {
    const { loadDemo } = await import('./logic/demo.js');
    await loadDemo();
  }
  if (setup.budget) await store.setMeta('budgetTotal', setup.budget);
}

// An admin may remove this person or change their role while the app is open: look again when the app comes
// back to the front, and once a minute while it is showing.
function watchMembership(adapter) {
  let busy = false;
  const check = async () => {
    if (busy || document.visibilityState === 'hidden') return;
    busy = true;
    const r = await adapter.checkMembership();
    busy = false;
    if (r === 'removed') accessLost();
    else if (r === 'changed') location.reload(); // new role = new rights: start again
  };
  window.addEventListener('focus', check);
  document.addEventListener('visibilitychange', check);
  setInterval(check, 60000);
}

// Firestore stopped letting us read: the admin removed this person while the app was open.
function accessLost() {
  document.body.classList.add('no-tabs');
  document.getElementById('view').innerHTML = `<div class="card stack" data-test="access-lost"><h2>You are no longer in this household</h2>
    <p class="muted">An admin removed you, so Kozy can’t show its data any more. You can start your own household or ask to be added again.</p>
    <button class="btn primary" onclick="location.reload()">OK</button>
    <button class="btn ghost" id="kz-signout">Sign out</button></div>`;
  document.getElementById('kz-signout').addEventListener('click', async () => {
    await store.getAdapter()?.signOut?.();
    location.reload();
  });
}

start().catch(showError);

// Says exactly what failed, so it can be fixed: which account, and whether it's the app's family list or Firebase's rules.
function showError(e) {
  console.error(e);
  const email = store.getAdapter()?.userEmail?.() || '';
  const denied = e?.code === 'permission-denied';
  const msg = denied
    ? `Firebase refused ${email || 'this account'}. Usually the rules in Firebase console are an older copy — publish the latest firestore.rules (Firestore Database → Rules → paste → Publish), then tap Reload. Or an admin just removed you from the household.`
    : String(e?.message || e);
  const detail = [e?.code, email].filter(Boolean).join(' · ');
  document.getElementById('view').innerHTML = `<div class="card stack" data-test="start-error"><h2>Kozy could not start</h2><p class="muted">${msg.replace(/</g, '&lt;')}</p>
    ${detail ? `<p class="muted tiny">Details: ${detail.replace(/</g, '&lt;')}</p>` : ''}
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
