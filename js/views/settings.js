// SETTINGS — limits, categories, recurring bills, card due, milk defaults, items, data tools.
import * as store from '../store.js';
import * as budget from '../logic/budget.js';
import * as milk from '../logic/milk.js';
import { loadDemo } from '../logic/demo.js';
import { ensureItems, items } from '../logic/stock.js';
import { money, esc, today } from '../logic/format.js';
import { icon, toast, confirmSheet, download } from '../ui.js';
import { header } from './common.js';
import { openItemForm } from './stock.js';
import { APP_VERSION, USE_FIREBASE } from '../config.js';

const EMOJIS = ['🧾', '🎓', '💊', '🚗', '🎁', '👕', '🍽️', '📚', '🐄', '🛠️'];

export function render() {
  const cs = budget.cats();
  const rec = budget.recurring();
  const ms = milk.settings();
  const adapter = store.getAdapter();
  return `
  ${header('Settings', `Total budget ${money(budget.totalLimit())} / month`)}

  <section class="card">
    <div class="card-head"><h2>💰 Monthly limits</h2><span class="muted small" data-total>${money(budget.totalLimit())}</span></div>
    <form data-form="cats" class="stack-s">
      ${cs.map((c, i) => `<div class="limit-row" data-i="${i}">
        <input class="input emo-in" name="emoji" value="${esc(c.emoji)}" aria-label="Emoji" maxlength="4">
        <input class="input grow" name="name" value="${esc(c.name)}" aria-label="Category name">
        <input class="input num lim" name="limit" type="number" inputmode="numeric" min="0" step="100" value="${c.limit}" aria-label="${esc(c.name)} limit">
        <button type="button" class="icon-btn" data-act="cat-del" data-i="${i}" aria-label="Delete ${esc(c.name)}">${icon('trash')}</button>
      </div>`).join('')}
      <div class="row gap">
        <button type="button" class="btn ghost grow" data-act="cat-add">${icon('plus')} Category</button>
        <button type="submit" class="btn primary grow">Save limits</button>
      </div>
    </form>
  </section>

  <section class="card">
    <h2>🔁 Monthly bills</h2>
    <p class="muted small">Shown on Home each month. One tap to confirm.</p>
    <form data-form="rec" class="stack-s">
      ${rec.map((r, i) => `<div class="limit-row" data-i="${i}">
        <input class="input grow" name="note" value="${esc(r.note)}" aria-label="Bill name">
        <select class="input cat-sel" name="cat" aria-label="Category">${cs.map((c) => `<option value="${c.id}" ${c.id === r.cat ? 'selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join('')}</select>
        <input class="input num lim" name="amount" type="number" inputmode="numeric" min="0" value="${r.amount}" aria-label="Amount">
        <button type="button" class="icon-btn" data-act="rec-del" data-i="${i}" aria-label="Delete bill">${icon('trash')}</button>
      </div>`).join('')}
      <div class="row gap">
        <button type="button" class="btn ghost grow" data-act="rec-add">${icon('plus')} Bill</button>
        <button type="submit" class="btn primary grow">Save bills</button>
      </div>
    </form>
  </section>

  <div class="quick2">
    <section class="card">
      <h2>💳 Card due</h2>
      <form data-form="cc" class="stack-s">
        <label class="field"><span>Starting due ₹</span><input class="input" name="start" type="number" inputmode="numeric" min="0" value="${store.meta('ccStart', budget.DEFAULT_CC_START)}"></label>
        <button class="btn primary" type="submit">Save</button>
      </form>
    </section>
    <section class="card">
      <h2>🥛 Milk</h2>
      <form data-form="milk" class="stack-s">
        <div class="row gap-s">
          <label class="field grow"><span>L/day</span><input class="input" name="litres" type="number" step="0.5" min="0" inputmode="decimal" value="${ms.litres}"></label>
          <label class="field grow"><span>₹/L</span><input class="input" name="rate" type="number" min="0" inputmode="decimal" value="${ms.rate}"></label>
        </div>
        <button class="btn primary" type="submit">Save</button>
      </form>
    </section>
  </div>

  <section class="card">
    <div class="card-head"><h2>🧺 Kitchen items</h2><span class="muted small">${items().length} items</span></div>
    <div class="row gap">
      <button class="btn ghost grow" data-act="item-add">${icon('plus')} Add item</button>
      <a class="btn ghost grow" href="#/stock">Edit in Stock ${icon('chevron')}</a>
    </div>
    <p class="muted tiny">Tap an item's name on the Stock screen to edit or delete it.</p>
  </section>

  <section class="card">
    <h2>🗂️ Data</h2>
    <div class="stack-s">
      <button class="btn ghost" data-act="demo">✨ Load demo data</button>
      <div class="row gap">
        <button class="btn ghost grow" data-act="export">${icon('download')} Backup (JSON)</button>
        <label class="btn ghost grow file-btn">${icon('upload')} Restore<input type="file" accept="application/json,.json" data-act="import" hidden></label>
      </div>
      <button class="btn danger-outline" data-act="reset">${icon('trash')} Reset all data</button>
    </div>
  </section>

  <section class="card">
    <h2>👤 Account</h2>
    ${USE_FIREBASE && adapter?.isSignedIn?.() ? `
      <p class="small">Signed in as <b>${esc(adapter.userEmail())}</b> (${esc(adapter.userLabel())}). Data syncs between both phones.</p>
      <button class="btn ghost" data-act="signout">Sign out</button>` : `
      <p class="small">Local mode: data is saved only in this browser. Make a backup before clearing the browser.</p>`}
    <p class="muted tiny">Kozy v${APP_VERSION} · ${adapter?.name === 'firestore' ? 'Firebase' : 'Local'} storage</p>
  </section>`;
}

function readRows(form, fields) {
  return [...form.querySelectorAll('.limit-row')].map((row) => Object.fromEntries(fields.map((f) => [f, row.querySelector(`[name="${f}"]`).value])));
}

export function bind(root, rerender) {
  root.addEventListener('click', async (ev) => {
    const t = ev.target.closest('[data-act]');
    if (!t || t.tagName === 'INPUT') return;
    const act = t.dataset.act;
    if (act === 'cat-add') {
      const cs = [...budget.cats(), { id: `c${Date.now().toString(36)}`, name: 'New category', emoji: EMOJIS[budget.cats().length % EMOJIS.length], limit: 0 }];
      await store.setMeta('cats', cs);
    } else if (act === 'cat-del') {
      const cs = budget.cats();
      const c = cs[Number(t.dataset.i)];
      const used = store.list('entries').some((e) => e.cat === c.id);
      if (await confirmSheet({ title: `Delete ${esc(c.name)}?`, body: used ? 'Old spends in this category stay, but you can’t pick it any more.' : '', ok: 'Delete', danger: true })) {
        await store.setMeta('cats', cs.filter((x) => x.id !== c.id));
        toast('Category deleted');
      }
    } else if (act === 'rec-add') {
      await store.setMeta('recurring', [...budget.recurring(), { id: `r-${Date.now().toString(36)}`, cat: 'misc', amount: 0, note: 'New bill' }]);
    } else if (act === 'rec-del') {
      await store.setMeta('recurring', budget.recurring().filter((_, i) => i !== Number(t.dataset.i)));
      toast('Bill removed');
    } else if (act === 'item-add') {
      openItemForm();
    } else if (act === 'demo') {
      if (await confirmSheet({ title: 'Load demo data?', body: 'This <b>replaces all your data</b> with a 3-month sample. Make a backup first if needed.', ok: 'Load demo' })) {
        await loadDemo();
        toast('Demo data loaded ✓');
        location.hash = '#/home';
      }
    } else if (act === 'export') {
      download(`kozy-backup-${today()}.json`, JSON.stringify(store.exportAll(), null, 1), 'application/json');
      toast('Backup saved ✓');
    } else if (act === 'reset') {
      if (await confirmSheet({ title: 'Reset ALL data?', body: 'Every spend, stock record, milk day and setting is deleted. <b>This cannot be undone.</b>', ok: 'Yes, delete everything', danger: true })) {
        await store.clearAll();
        await ensureItems();
        toast('All data reset');
        location.hash = '#/home';
      }
    } else if (act === 'signout') {
      await store.getAdapter().signOut();
      location.reload();
    }
  });

  root.addEventListener('change', async (ev) => {
    if (ev.target.dataset.act !== 'import') return;
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (await confirmSheet({ title: 'Restore this backup?', body: `This replaces all current data with <b>${esc(file.name)}</b>.`, ok: 'Restore' })) {
        await store.importAll(data);
        toast('Backup restored ✓');
      }
    } catch (e) {
      toast(`Could not restore: ${e.message}`, 'err');
    }
    ev.target.value = '';
  });

  root.addEventListener('input', (ev) => {
    if (ev.target.name === 'limit') {
      const sum = [...root.querySelectorAll('[name="limit"]')].reduce((s, i) => s + (Number(i.value) || 0), 0);
      const el = root.querySelector('[data-total]');
      if (el) el.textContent = money(sum);
    }
  });

  root.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const kind = f.dataset.form;
    if (kind === 'cats') {
      const rows = readRows(f, ['emoji', 'name', 'limit']);
      const cs = budget.cats().map((c, i) => ({ ...c, emoji: rows[i].emoji.trim() || '•', name: rows[i].name.trim() || c.name, limit: Number(rows[i].limit) || 0 }));
      await store.setMeta('cats', cs);
      toast(`Limits saved · ${money(budget.totalLimit())}/month ✓`);
    } else if (kind === 'rec') {
      const rows = readRows(f, ['note', 'cat', 'amount']);
      const rec = budget.recurring().map((r, i) => ({ ...r, note: rows[i].note.trim() || r.note, cat: rows[i].cat, amount: Number(rows[i].amount) || 0 }));
      await store.setMeta('recurring', rec);
      toast('Monthly bills saved ✓');
    } else if (kind === 'cc') {
      await store.setMeta('ccStart', Number(f.start.value) || 0);
      toast('Card due saved ✓');
    } else if (kind === 'milk') {
      await milk.saveSettings({ litres: Number(f.litres.value) || 0, rate: Number(f.rate.value) || 0 });
      toast('Milk settings saved ✓');
    }
    rerender();
  });
}
