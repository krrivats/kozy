// Kozy startup + tiny hash router: #/home #/budget #/stock #/milk #/settings
import * as store from './store.js';
import { ensureItems } from './logic/stock.js';
import * as home from './views/home.js';
import * as budgetView from './views/budget.js';
import * as stockView from './views/stock.js';
import * as milkView from './views/milk.js';
import * as settingsView from './views/settings.js';
import { openSpendSheet } from './views/spend-sheet.js';
import { renderLogin } from './views/login.js';
import { toast } from './ui.js';

const ROUTES = { home, budget: budgetView, stock: stockView, milk: milkView, settings: settingsView };

let current = null;
let viewEl = null;
let pending = false;

function routeName() {
  const r = location.hash.replace(/^#\/?/, '') || 'home';
  return ROUTES[r] ? r : 'home';
}

function render() {
  const name = routeName();
  const mod = ROUTES[name];
  const main = document.getElementById('view');
  if (current !== name) {
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
  viewEl.innerHTML = mod.render();
  document.body.dataset.route = name;
}

// Re-render on data change, at most once per frame.
function rerender() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; render(); });
}

async function start() {
  const adapter = await store.initStore();
  const go = async () => {
    await store.loadData();
    await ensureItems();
    store.subscribe(rerender);
    window.addEventListener('hashchange', render);
    document.getElementById('fab').addEventListener('click', () => openSpendSheet());
    render();
    document.body.classList.add('ready');
  };
  if (adapter.needsAuth && !adapter.isSignedIn()) renderLogin(adapter, go);
  else await go();
}

start().catch((e) => {
  console.error(e);
  document.getElementById('view').innerHTML = `<div class="card"><h2>Kozy could not start</h2><p class="muted">${String(e?.message || e)}</p></div>`;
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW failed', e));
  });
}

window.addEventListener('offline', () => toast('Offline — saving on this phone'));
