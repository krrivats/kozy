// STOCK — kitchen items. Two big buttons per item: Bought / खरीदा and Finished / ख़त्म.
import * as stock from '../logic/stock.js';
import * as store from '../store.js';
import { money, number, dayLabel, today, esc, relDay } from '../logic/format.js';
import { icon, openSheet, closeSheet, toast, confirmSheet, shareText, bump } from '../ui.js';
import { header } from './common.js';

const state = { filter: 'all', shopOpen: true };

const CHIP = {
  ok: ['In stock', 'ok'],
  low: ['Running low', 'warn'],
  finished: ['Finished', 'over'],
  none: ['Not tracked', 'none'],
};

function infoLine(a) {
  const u = a.item.unit;
  if (a.status === 'none') return 'Tap Bought when you buy it — Kozy learns how long it lasts.';
  if (a.status === 'finished') {
    return a.avgDays ? `Usually lasts ~${Math.round(a.avgDays)} days` : 'Finished — add to next shopping';
  }
  const parts = [];
  if (a.runout) parts.push(`${a.daysLeft === 0 ? 'May run out today' : `~${a.daysLeft} days left`} · ${dayLabel(a.runout)}`);
  else parts.push(`Bought ${relDay(a.open.date)} · ${number(a.open.qty)} ${a.open.unit || u}`);
  return parts.join(' · ');
}

function statsLine(a) {
  const bits = [];
  if (a.avgDays) bits.push(`lasts ${Math.round(a.avgDays)}d`);
  if (a.perWeek != null) bits.push(`${number(a.perWeek)} ${a.item.unit}/wk`);
  if (a.monthlyCost != null) bits.push(`${money(a.monthlyCost)}/mo`);
  return bits.join(' · ');
}

function itemCard(a) {
  const [label, cls] = CHIP[a.status];
  const sl = statsLine(a);
  return `<article class="card item" data-item="${a.item.id}" data-status="${a.status}">
    <button class="item-head" data-act="detail" data-id="${a.item.id}">
      <span class="item-name"><b>${esc(a.item.en)}</b> <span class="hi">/ ${esc(a.item.hi)}</span></span>
      <span class="chip ${cls}" data-test="chip">${label}</span>
    </button>
    <p class="item-info">${esc(infoLine(a))}</p>
    ${sl ? `<p class="item-stats">${esc(sl)}</p>` : ''}
    <div class="two-btn">
      <button class="btn bought" data-act="bought" data-id="${a.item.id}">${icon('plus')} Bought <span class="hi">/ खरीदा</span></button>
      <button class="btn finished" data-act="finished" data-id="${a.item.id}" ${a.open ? '' : 'disabled'}>${icon('check')} Finished <span class="hi">/ ख़त्म</span></button>
    </div>
  </article>`;
}

export function render() {
  const all = stock.allAnalyzed();
  const shop = stock.shoppingList();
  const counts = { all: all.length, low: all.filter((a) => a.status === 'low').length, finished: all.filter((a) => a.status === 'finished').length };
  const shown = state.filter === 'all' ? all : all.filter((a) => a.status === state.filter);

  return `
  ${header('Kitchen stock', `${counts.low} running low · ${counts.finished} finished`,
    `<button class="btn small ghost" data-act="add-item">${icon('plus')} Item</button>`)}

  <section class="card shop ${shop.length ? '' : 'empty-shop'}" data-test="shopping">
    <div class="card-head">
      <h2>${icon('cart')} Shopping list <span class="count">${shop.length}</span></h2>
      ${shop.length ? `<div class="row gap-s">
        <button class="icon-btn" data-act="copy" aria-label="Copy shopping list">${icon('copy')}</button>
        <button class="btn small primary" data-act="share">${icon('share')} Share</button></div>` : ''}
    </div>
    ${shop.length ? `<ul class="shop-list">${shop.map((a) => `<li data-shop="${a.item.id}">
        <span>${esc(a.item.en)} <span class="hi">/ ${esc(a.item.hi)}</span></span>
        <span class="chip ${a.status === 'finished' ? 'over' : 'warn'}">${a.status === 'finished' ? 'Finished' : `${a.daysLeft}d left`}</span>
      </li>`).join('')}</ul>` : '<p class="empty">Nothing to buy in the next 7 days 🎉</p>'}
  </section>

  <div class="seg filter" role="tablist">
    ${[['all', 'All'], ['low', 'Low'], ['finished', 'Finished']].map(([k, l]) =>
      `<button class="${state.filter === k ? 'on' : ''}" data-act="filter" data-f="${k}">${l} <span class="muted">${counts[k]}</span></button>`).join('')}
  </div>

  <div class="items" data-test="items">
    ${shown.length ? shown.map(itemCard).join('') : '<p class="empty">No items here.</p>'}
  </div>`;
}

function boughtSheet(item) {
  const a = stock.analyze(item);
  const last = a.lastBought;
  const el = openSheet(`
    <form class="stack" novalidate>
      <h2 class="sheet-title">Bought ${esc(item.en)} <span class="hi">/ ${esc(item.hi)}</span></h2>
      <div class="row gap">
        <label class="field grow"><span>Qty</span>
          <input name="qty" class="input" type="number" inputmode="decimal" step="any" min="0" value="${last?.qty ?? ''}" autofocus required></label>
        <label class="field"><span>Unit</span>
          <select name="unit" class="input">${stock.UNITS.map((u) => `<option ${u === (last?.unit || item.unit) ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
      </div>
      <div class="row gap">
        <label class="field grow"><span>Price ₹</span>
          <input name="price" class="input" type="number" inputmode="decimal" step="any" min="0" value="${last?.price || ''}" placeholder="0"></label>
        <label class="field"><span>Date</span><input name="date" class="input date" type="date" value="${today()}"></label>
      </div>
      <p class="muted small">Price is added to <b>Groceries + veg</b> automatically.</p>
      <p class="form-error" hidden></p>
      <button class="btn primary" type="submit">${icon('check')} Save</button>
    </form>`);
  const f = el.querySelector('form');
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const qty = Number(f.qty.value);
    if (!(qty > 0)) { const e = f.querySelector('.form-error'); e.textContent = 'Enter quantity'; e.hidden = false; return; }
    const price = Number(f.price.value) || 0;
    await stock.bought(item, { qty, unit: f.unit.value, price, date: f.date.value || today() });
    closeSheet(true);
    toast(price ? `${item.en} saved · ${money(price)} added to Groceries ✓` : `${item.en} saved ✓`);
  });
}

function itemForm(item = null) {
  const it = item || { en: '', hi: '', unit: 'kg', cat: 'Kitchen' };
  const el = openSheet(`
    <form class="stack" novalidate>
      <h2 class="sheet-title">${item ? 'Edit item' : 'New item'}</h2>
      <div class="row gap">
        <label class="field grow"><span>Name (English)</span><input name="en" class="input" value="${esc(it.en)}" autofocus required></label>
        <label class="field grow"><span>नाम (Hindi)</span><input name="hi" class="input" value="${esc(it.hi)}"></label>
      </div>
      <div class="row gap">
        <label class="field grow"><span>Unit</span><select name="unit" class="input">${stock.UNITS.map((u) => `<option ${u === it.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
        <label class="field grow"><span>Category</span><select name="cat" class="input">${stock.ITEM_CATS.map((c) => `<option ${c === it.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      </div>
      <p class="form-error" hidden></p>
      <div class="row gap">
        ${item ? `<button type="button" class="btn ghost danger-text" data-del>${icon('trash')} Delete</button>` : ''}
        <button class="btn primary grow" type="submit">Save</button>
      </div>
    </form>`);
  const f = el.querySelector('form');
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const en = f.en.value.trim();
    if (!en) { const e = f.querySelector('.form-error'); e.textContent = 'Enter a name'; e.hidden = false; return; }
    const order = item?.order ?? (Math.max(0, ...stock.items().map((x) => x.order ?? 0)) + 1);
    await store.put('items', { ...(item || {}), en, hi: f.hi.value.trim() || en, unit: f.unit.value, cat: f.cat.value, order });
    closeSheet(true);
    toast(`${en} saved ✓`);
  });
  f.querySelector('[data-del]')?.addEventListener('click', async () => {
    closeSheet(true);
    if (await confirmSheet({ title: `Delete ${esc(item.en)}?`, body: 'Its Bought / Finished history is removed too. Spends already added stay in the budget.', ok: 'Delete', danger: true })) {
      await stock.removeItem(item);
      toast('Item deleted');
    }
  });
}

function detailSheet(item) {
  const a = stock.analyze(item);
  const [label, cls] = CHIP[a.status];
  const evs = [...a.events].reverse();
  const el = openSheet(`
    <div class="sheet-head">
      <h2 class="sheet-title">${esc(item.en)} <span class="hi">/ ${esc(item.hi)}</span></h2>
      <span class="chip ${cls}">${label}</span>
    </div>
    <div class="stat-grid">
      <div><span class="k">Pack lasts</span><span class="v">${a.avgDays ? `${Math.round(a.avgDays)} days` : '—'}</span></div>
      <div><span class="k">Use / week</span><span class="v">${a.perWeek != null ? `${number(a.perWeek)} ${esc(item.unit)}` : '—'}</span></div>
      <div><span class="k">Runs out</span><span class="v">${a.runout ? dayLabel(a.runout) : a.status === 'finished' ? 'Finished' : '—'}</span></div>
      <div><span class="k">Cost / month</span><span class="v">${a.monthlyCost != null ? money(a.monthlyCost) : '—'}</span></div>
    </div>
    <h3 class="mini-title">History</h3>
    <div class="list hist">
      ${evs.length ? evs.map((e) => `<div class="hist-row">
        <span class="dot ${e.type}"></span>
        <span class="grow">${e.type === 'bought' ? `Bought ${number(e.qty)} ${esc(e.unit || item.unit)}${e.price ? ` · ${money(e.price)}` : ''}` : 'Finished'}
          <span class="muted small block">${dayLabel(e.date)} · ${esc(e.by || 'Me')}</span></span>
        <button class="icon-btn" data-del-ev="${e.id}" aria-label="Delete this record">${icon('trash')}</button>
      </div>`).join('') : '<p class="empty">No history yet.</p>'}
    </div>
    <div class="row gap"><button class="btn ghost grow" data-edit>${icon('edit')} Edit item</button></div>`);
  el.querySelector('[data-edit]').onclick = () => itemForm(item);
  el.querySelectorAll('[data-del-ev]').forEach((b) => b.addEventListener('click', async () => {
    const ev = store.get('stock', b.dataset.delEv);
    closeSheet(true);
    if (await confirmSheet({ title: 'Delete this record?', body: ev.entryId ? 'The linked grocery spend is deleted too.' : '', ok: 'Delete', danger: true })) {
      await stock.removeEvent(ev);
      toast('Deleted');
    }
    detailSheet(item);
  }));
}

export function bind(root, rerender) {
  root.addEventListener('click', async (ev) => {
    const t = ev.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    const item = t.dataset.id ? store.get('items', t.dataset.id) : null;
    if (act === 'bought') boughtSheet(item);
    else if (act === 'finished') {
      bump(t);
      await stock.finished(item);
      toast(`${item.en} finished — added to shopping list`);
    } else if (act === 'detail') detailSheet(item);
    else if (act === 'add-item') itemForm();
    else if (act === 'filter') { state.filter = t.dataset.f; rerender(); }
    else if (act === 'share' || act === 'copy') {
      const text = stock.shoppingText();
      let res;
      if (act === 'share') res = await shareText('Kozy shopping list', text);
      else {
        try { await navigator.clipboard.writeText(text); res = 'copied'; } catch { res = await shareText('Kozy shopping list', text); }
      }
      if (res === 'copied') toast('Shopping list copied ✓ Paste in WhatsApp');
      else if (res === 'shared') toast('Shared ✓');
      else if (res === 'failed') toast('Could not copy', 'err');
    }
  });
}

export { itemForm as openItemForm };
