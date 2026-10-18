// STOCK — two tabs: 🧺 Kitchen (countdown to run-out) and 🥬 Sabzi (price per kg history).
// One search box for both: if an item isn't there, "+ Add" creates it and it stays in the list.
import * as stock from '../logic/stock.js';
import * as store from '../store.js';
import { money, number, dayLabel, today, esc, relDay, pct } from '../logic/format.js';
import { icon, openSheet, closeSheet, toast, confirmSheet, shareText, bump } from '../ui.js';
import { header } from './common.js';
import { editPurchaseSheet } from './edit-entry.js';

// Folding: "In stock" / "Not tracked" fold only when something needs attention (low / finished) above them.
const state = { tab: 'kitchen', q: '', open: {} };
const LASTS = [7, 15, 30, 45];

const CHIP = {
  ok: ['In stock', 'ok'],
  low: ['Running low', 'warn'],
  finished: ['Finished', 'over'],
  none: ['Not tracked', 'none'],
};

// ---------- pieces ----------
function countdown(a) {
  if (a.status === 'none') return '<span class="cd muted">Not tracked yet — tap + when you buy it</span>';
  if (a.status === 'finished') return `<span class="cd over">Finished${a.avgDays ? ` · usually lasts ${Math.round(a.avgDays)}d` : ''}</span>`;
  if (!a.runout) return `<span class="cd muted">Bought ${relDay(a.open.date)} · tap to set days</span>`;
  if (a.runout < today()) return `<span class="cd over">⏳ Due since ${dayLabel(a.runout)} · tap ✓ when it's over</span>`;
  const left = a.daysLeft === 0 ? 'Runs out today' : `${a.daysLeft} day${a.daysLeft === 1 ? '' : 's'} left`;
  return `<span class="cd ${a.status === 'low' ? 'warn' : ''}">⏳ ${left} · ${dayLabel(a.runout)}</span>`;
}

function usedBar(a) {
  if (!a.open || a.open.used == null) return '';
  const p = Math.round(a.open.used * 100);
  const cls = a.daysLeft === 0 ? 'over' : a.status === 'low' ? 'warn' : 'ok';
  return `<div class="bar thin ${cls}" role="progressbar" aria-label="Pack used" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><span style="width:${p}%"></span></div>`;
}

function itemRow(a) {
  const [label, cls] = CHIP[a.status];
  const w = store.canWrite();
  return `<article class="irow" data-item="${a.item.id}" data-status="${a.status}">
    <button class="irow-main" data-act="detail" data-id="${a.item.id}">
      <span class="irow-top">
        <span class="item-name"><b>${esc(a.item.en)}</b> <span class="hi">${esc(a.item.hi)}</span>${a.item.note ? ` <span class="note-ic" title="${esc(a.item.note)}">📝</span>` : ''}</span>
        <span class="chip ${cls}" data-test="chip">${label}</span>
      </span>
      <span class="item-info">${countdown(a)}</span>
      ${usedBar(a)}
    </button>
    ${w ? `<button class="ibtn bought" data-act="bought" data-id="${a.item.id}" aria-label="Bought ${esc(a.item.en)}">${icon('plus')}<span>Bought</span></button>
    <button class="ibtn finished" data-act="finished" data-id="${a.item.id}" ${a.open ? '' : 'disabled'} aria-label="Finished ${esc(a.item.en)}">${icon('check')}<span>Finished</span></button>` : ''}
  </article>`;
}

function vegTile(v) {
  const st = stock.priceStats(v);
  const arrow = st?.trend === 'up' ? '<span class="over-text">▲</span>' : st?.trend === 'down' ? '<span class="ok-text">▼</span>' : '';
  return `<button class="vtile ${v.need ? 'need' : ''}" data-act="veg" data-id="${v.id}" data-item="${v.id}">
    <span class="vemo">${v.emoji || '🥬'}</span>
    <span class="vname">${esc(v.en)}</span>
    <span class="vhi">${esc(v.hi)}</span>
    <span class="vrate">${st ? `${money(st.last.rate)}/${esc(v.unit)} ${arrow}` : '<span class="muted">no price</span>'}</span>
    ${v.need ? '<span class="vneed" title="On shopping list">🛒</span>' : ''}
  </button>`;
}

function group(key, title, list, foldable, attention = true) {
  if (!list.length) return '';
  const open = !foldable || !!state.q || (state.open[key] ?? !attention);
  return `<section class="igroup" data-group="${key}">
    <button class="group-head" data-act="fold" data-key="${key}" ${foldable ? '' : 'disabled'}>
      <span>${title} <span class="muted">${list.length}</span></span>${foldable ? icon(open ? 'up' : 'down') : ''}
    </button>
    ${open ? `<div class="ilist">${list.map(itemRow).join('')}</div>` : ''}
  </section>`;
}

function shopCard() {
  const shop = stock.shoppingList();
  const w = store.canWrite();
  return `<section class="card shop tight ${shop.length ? '' : 'empty-shop'}" data-test="shopping">
    <div class="card-head">
      <h2>${icon('cart')} Shopping list <span class="count">${shop.length}</span></h2>
      ${shop.length ? `<div class="row gap-s">
        <button class="icon-btn" data-act="copy" aria-label="Copy shopping list">${icon('copy')}</button>
        <button class="icon-btn" data-act="share" aria-label="Share shopping list">${icon('share')}</button>
        ${w ? '<button class="btn small primary" data-act="shopmode">Shop ✓</button>' : ''}</div>` : ''}
    </div>
    ${shop.length ? `<div class="pills">${shop.map((a) => `<button class="pill ${a.status === 'finished' ? 'over' : a.status === 'need' ? 'need' : 'warn'}" data-act="${a.item.kind === 'veg' ? 'veg' : 'bought'}" data-id="${a.item.id}" data-shop="${a.item.id}">
        ${a.item.emoji ? `${a.item.emoji} ` : ''}${esc(a.item.en)}<span class="muted"> ${a.status === 'finished' ? 'out' : a.status === 'need' ? '' : a.daysLeft === 0 ? 'today' : `${a.daysLeft}d`}</span></button>`).join('')}</div>`
      : '<p class="empty small">Nothing to buy in the next few days 🎉</p>'}
  </section>`;
}

function todayStrip() {
  const list = stock.boughtOn(today());
  if (!list.length) return '';
  return `<section class="today-strip" data-test="bought-today">
    <span class="muted small">🛍️ Today:</span>
    ${list.map(({ ev, item }) => `<button class="pill soft" data-act="edit-ev" data-id="${ev.id}">${item.emoji ? `${item.emoji} ` : ''}${esc(item.en)} ${number(ev.qty)} ${esc(ev.unit)}<span class="muted"> · ${esc(ev.by || 'Me')}</span></button>`).join('')}
  </section>`;
}

// ---------- render ----------
export function render() {
  const all = stock.allAnalyzed();
  const counts = { low: all.filter((a) => a.status === 'low').length, finished: all.filter((a) => a.status === 'finished').length };
  const q = state.q.trim();
  const kitchenShown = all.filter((a) => stock.matches(a.item, q));
  const veg = stock.items('veg').filter((v) => stock.matches(v, q));
  const byLeft = (x, y) => (x.daysLeft ?? 999) - (y.daysLeft ?? 999);
  const noHits = q && !kitchenShown.length && !veg.length;
  const w = store.canWrite();

  return `
  ${header('Stock', `${counts.low} running low · ${counts.finished} finished`, '')}

  <div class="stock-top">
    <div class="seg tabs2" role="tablist">
      <button class="${state.tab === 'kitchen' ? 'on' : ''}" data-act="tab" data-tab="kitchen" role="tab">🧺 Kitchen</button>
      <button class="${state.tab === 'veg' ? 'on' : ''}" data-act="tab" data-tab="veg" role="tab">🥬 Sabzi</button>
      <button class="${state.tab === 'plan' ? 'on' : ''}" data-act="tab" data-tab="plan" role="tab">📅 Plan</button>
    </div>
    <label class="search-box" ${state.tab === 'plan' ? 'hidden' : ''}>${icon('search')}
      <input class="search-in" type="search" placeholder="Search item (atta, pyaz, आलू)…" value="${esc(state.q)}" data-search aria-label="Search items" autocomplete="off">
    </label>
  </div>

  ${state.tab === 'plan' ? planView() : `
  ${q && w ? `<button class="add-new" data-act="add-new" data-test="add-new">${icon('plus')} Add “${esc(q)}” as new ${state.tab === 'veg' ? 'sabzi' : 'item'}</button>` : ''}
  ${noHits ? '<p class="empty">No item found.</p>' : ''}

  ${!q ? shopCard() + todayStrip() : ''}

  ${state.tab === 'kitchen' ? `<div class="groups" data-test="items">
    ${group('low', '🟡 Running low', kitchenShown.filter((a) => a.status === 'low').sort(byLeft), false)}
    ${group('finished', '🔴 Finished', kitchenShown.filter((a) => a.status === 'finished'), false)}
    ${group('ok', '🟢 In stock', kitchenShown.filter((a) => a.status === 'ok').sort(byLeft), true, counts.low + counts.finished > 0)}
    ${group('none', '⚪ Not tracked', kitchenShown.filter((a) => a.status === 'none'), true, counts.low + counts.finished > 0)}
  </div>` : `<div data-test="veg">
    ${stock.VEG_CATS.map((c) => {
      const list = veg.filter((v) => (v.cat || 'Sabzi') === c);
      return list.length ? `<h3 class="mini-title">${c === 'Fruits' ? '🍎 Fruits' : '🥬 Sabzi'}</h3><div class="vgrid">${list.map(vegTile).join('')}</div>` : '';
    }).join('')}
  </div>`}`}`;
}

// 📅 Plan: what the family uses per month (from the last 3 months of purchases) and what to buy next month.
const qtyTxt = (n, unit) => number(['g', 'ml'].includes(unit) ? Math.round(n) : Math.round(n * 10) / 10);

function planView() {
  const p = stock.monthlyPlan();
  const w = store.canWrite();
  if (!p.kitchen.length && !p.veg.length) {
    return '<p class="empty">Buy a few things first. After a few weeks Kozy shows how much you use per month and what to buy next month.</p>';
  }
  const kRow = (r) => `<div class="plan-row" data-plan="${r.item.id}">
      <button class="grow go-row plan-open" data-act="detail" data-id="${r.item.id}"><b>${esc(r.item.en)}</b> <span class="hi">${esc(r.item.hi)}</span>
        <span class="muted small block">uses ${qtyTxt(r.perMonth, r.unit)} ${esc(r.unit)}/month · buy ${r.packs} × ${number(r.pack)} ${esc(r.unit)}</span></button>
      <span class="num plan-amt">${r.rate ? money(r.suggestCost) : '—'}</span>
      ${w ? `<button class="icon-btn ${r.item.need ? 'on' : ''}" data-act="plan-need" data-id="${r.item.id}" aria-label="${r.item.need ? 'Remove from' : 'Add to'} shopping list">${icon(r.item.need ? 'check' : 'plus')}</button>` : ''}
    </div>`;
  const vRow = (r) => `<div class="plan-row" data-plan="${r.item.id}">
      <button class="grow go-row plan-open" data-act="veg" data-id="${r.item.id}">${r.item.emoji || '🥬'} <b>${esc(r.item.en)}</b>
        <span class="muted small block">${qtyTxt(r.perMonth, r.unit)} ${esc(r.unit)}/month · ~${qtyTxt(r.perWeek, r.unit)} ${esc(r.unit)}/week${r.rate ? ` · avg ${money(r.rate)}/${esc(r.unit)}` : ''}</span></button>
      <span class="num plan-amt">${r.rate ? money(r.costPerMonth) : '—'}</span>
    </div>`;
  return `
  <section class="card tight" data-test="plan">
    <div class="sum3">
      <div><span class="k">Kitchen / month</span><span class="v">${money(p.kitchenTotal)}</span></div>
      <div><span class="k">Sabzi / month</span><span class="v">${money(p.vegTotal)}</span></div>
      <div><span class="k">Total</span><span class="v">${money(p.kitchenTotal + p.vegTotal)}</span></div>
    </div>
    <p class="muted tiny">From your purchases in the last 3 months. Suggested buys are rounded to the pack size you usually buy.</p>
  </section>
  <section class="card tight">
    <div class="card-head"><h2>🧺 Next month's kitchen buy</h2>
      ${w ? '<button class="btn small primary" data-act="plan-all">All to list</button>' : ''}</div>
    <div class="list">${p.kitchen.map(kRow).join('')}</div>
  </section>
  ${p.veg.length ? `<section class="card tight">
    <div class="card-head"><h2>🥬 Sabzi per month</h2></div>
    <div class="list">${p.veg.map(vRow).join('')}</div>
  </section>` : ''}`;
}

// ---------- sheets ----------
function sizeChips(unit, current) {
  const sizes = stock.SIZES[unit] || [1, 2, 5];
  return `<div class="sizes" data-sizes>${sizes.map((s) => `<button type="button" class="size ${Number(current) === s ? 'on' : ''}" data-size="${s}">${number(s)} ${esc(unit)}</button>`).join('')}</div>`;
}

function wireSizes(el) {
  const f = el.querySelector('form');
  const redraw = () => {
    const box = el.querySelector('[data-sizes]');
    box.outerHTML = sizeChips(f.unit.value, f.qty.value);
    wire();
  };
  const wire = () => {
    el.querySelectorAll('[data-size]').forEach((b) => b.addEventListener('click', () => {
      f.qty.value = b.dataset.size;
      el.querySelectorAll('[data-size]').forEach((x) => x.classList.toggle('on', x === b));
      f.qty.dispatchEvent(new Event('input', { bubbles: true }));
    }));
  };
  wire();
  f.unit.addEventListener('change', redraw);
  f.qty.addEventListener('input', () => el.querySelectorAll('[data-size]').forEach((x) => x.classList.toggle('on', Number(x.dataset.size) === Number(f.qty.value))));
}

function lastsPicker(selected, learned) {
  const auto = learned ? `<button type="button" class="${!selected ? 'on' : ''}" data-lasts="">Auto ~${Math.round(learned)}d</button>` : '';
  return `<div class="field"><span>Lasts about</span>
    <div class="seg lasts" role="radiogroup">
      ${auto}
      ${LASTS.map((d) => `<button type="button" class="${Number(selected) === d ? 'on' : ''}" data-lasts="${d}">${d}d</button>`).join('')}
      <input class="input lasts-custom" name="lastsCustom" type="number" min="1" inputmode="numeric" placeholder="days"
        value="${selected && !LASTS.includes(Number(selected)) ? selected : ''}" aria-label="Custom days">
    </div></div>`;
}

function wireLasts(el, initial) {
  let val = initial || '';
  const custom = el.querySelector('[name="lastsCustom"]');
  el.querySelectorAll('[data-lasts]').forEach((b) => b.addEventListener('click', () => {
    val = b.dataset.lasts;
    custom.value = '';
    el.querySelectorAll('[data-lasts]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  custom.addEventListener('input', () => {
    val = custom.value;
    el.querySelectorAll('[data-lasts]').forEach((x) => x.classList.remove('on'));
  });
  return () => Number(val) || null;
}

function priceLine(item) {
  const st = stock.priceStats(item);
  if (!st) return '';
  const u = esc(item.unit);
  const ch = st.change != null ? ` <span class="${st.change > 0 ? 'over-text' : 'ok-text'}">${st.change > 0 ? '▲' : st.change < 0 ? '▼' : ''} ${pct(st.change)}</span>` : '';
  return `<p class="price-line">Last <b>${money(st.last.rate)}/${u}</b> · ${relDay(st.last.date)}${ch}
    <span class="muted"> · low ${money(st.min)} · high ${money(st.max)}</span></p>`;
}

function boughtSheet(item) {
  const a = stock.analyze(item);
  const last = a.lastBought;
  const lastPrice = last ? stock.priceOf(last) : 0;
  const learnedDays = a.perWeek && last?.qty ? Number(last.qty) / (a.perWeek / 7) : a.avgDays;
  const preset = learnedDays ? '' : 15; // no history yet → a sensible guess you can change
  const unit = last?.unit || item.unit;
  const el = openSheet(`
    <form class="stack" novalidate>
      <h2 class="sheet-title">Bought ${esc(item.en)} <span class="hi">${esc(item.hi)}</span></h2>
      ${priceLine(item)}
      ${sizeChips(unit, last?.qty)}
      <div class="row gap">
        <label class="field grow"><span>Qty</span>
          <input name="qty" class="input" type="number" inputmode="decimal" step="any" min="0" value="${last?.qty ?? ''}" required></label>
        <label class="field"><span>Unit</span>
          <select name="unit" class="input">${stock.UNITS.map((u) => `<option ${u === unit ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
        <label class="field grow"><span>Price ₹</span>
          <input name="price" class="input" type="number" inputmode="decimal" step="any" min="0" value="${lastPrice || ''}" placeholder="0"></label>
      </div>
      ${lastsPicker(preset, learnedDays)}
      <div class="row gap">
        <input name="note" class="input grow" placeholder="Remark (brand, size…)" aria-label="Remark">
        <input name="date" class="input date" type="date" value="${today()}" aria-label="Date">
      </div>
      <p class="form-error" hidden></p>
      <button class="btn primary" type="submit">${icon('check')} Save</button>
    </form>`);
  const f = el.querySelector('form');
  wireSizes(el);
  const getLasts = wireLasts(el, preset);
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const qty = Number(f.qty.value);
    if (!(qty > 0)) { const e = f.querySelector('.form-error'); e.textContent = 'Enter quantity'; e.hidden = false; return; }
    const price = Number(f.price.value) || 0;
    await stock.bought(item, { qty, unit: f.unit.value, price, date: f.date.value || today(), lastsDays: getLasts(), note: f.note.value.trim() });
    closeSheet(true);
    toast(price ? `${item.en} saved · ${money(price)} added to Groceries ✓` : `${item.en} ${number(qty)} ${f.unit.value} saved ✓`);
  });
}

function vegSheet(item) {
  const st = stock.priceStats(item);
  const evs = stock.eventsFor(item.id).filter((e) => e.type === 'bought').reverse().slice(0, 8);
  const w = store.canWrite();
  const last = evs[0];
  const el = openSheet(`
    <form class="stack" novalidate>
      <div class="sheet-head">
        <h2 class="sheet-title">${item.emoji || '🥬'} ${esc(item.en)} <span class="hi">${esc(item.hi)}</span></h2>
        ${w ? `<button type="button" class="btn small ${item.need ? 'primary' : 'ghost'}" data-need>${item.need ? '🛒 On list' : '+ List'}</button>` : ''}
      </div>
      ${priceLine(item) || '<p class="muted small">No price yet. Your first purchase starts the history.</p>'}
      ${item.note ? `<p class="small">📝 ${esc(item.note)}</p>` : ''}
      ${w ? `${sizeChips(last?.unit || item.unit, last?.qty)}
      <div class="row gap">
        <label class="field grow"><span>Qty</span><input name="qty" class="input" type="number" inputmode="decimal" step="any" min="0" value="${last?.qty ?? ''}"></label>
        <label class="field"><span>Unit</span><select name="unit" class="input">${stock.UNITS.map((u) => `<option ${u === (last?.unit || item.unit) ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
      </div>
      <div class="row gap align-end">
        <label class="field grow"><span data-rate-label>₹ per ${esc(item.unit)}</span><input name="price" class="input" type="number" inputmode="decimal" step="any" min="0" placeholder="${st ? Math.round(st.last.rate) : '0'}"></label>
        <div class="seg small rate-mode"><button type="button" class="on" data-pm="rate">₹/unit</button><button type="button" data-pm="total">Total</button></div>
      </div>
      <p class="muted small" data-total-line></p>
      <div class="row gap">
        <input name="note" class="input grow" placeholder="Remark (optional)" aria-label="Remark">
        <input name="date" class="input date" type="date" value="${today()}" aria-label="Date">
      </div>
      <p class="form-error" hidden></p>
      <button class="btn primary" type="submit">${icon('check')} Save</button>` : ''}
      <h3 class="mini-title">Price history</h3>
      <div class="list hist">${evs.length ? evs.map((e, i) => {
        const p = stock.priceOf(e);
        const rate = p && e.qty ? p / e.qty : 0;
        const prevEv = evs[i + 1];
        const prevRate = prevEv && stock.priceOf(prevEv) && prevEv.qty ? stock.priceOf(prevEv) / prevEv.qty : 0;
        const tr = rate && prevRate ? (rate > prevRate * 1.02 ? '<span class="over-text">▲</span>' : rate < prevRate * 0.98 ? '<span class="ok-text">▼</span>' : '') : '';
        return `<div class="hist-row"><button type="button" class="grow hist-edit" data-edit-ev="${e.id}">${rate ? `<b>${money(rate)}/${esc(e.unit)}</b> ${tr}` : 'No price'} · ${number(e.qty)} ${esc(e.unit)}${p ? ` = ${money(p)}` : ''}
          <span class="muted small block">${dayLabel(e.date)} · ${esc(e.by || 'Me')}${e.note ? ` · ${esc(e.note)}` : ''}</span></button>
          ${w ? `<button type="button" class="icon-btn" data-del-ev="${e.id}" aria-label="Delete this record">${icon('trash')}</button>` : ''}</div>`;
      }).join('') : '<p class="empty">No purchases yet.</p>'}</div>
      ${w ? '<button type="button" class="btn ghost" data-edit>Edit item</button>' : ''}
    </form>`);
  const f = el.querySelector('form');
  el.querySelector('[data-edit]')?.addEventListener('click', () => itemForm(item));
  el.querySelector('[data-need]')?.addEventListener('click', async () => {
    await stock.toggleNeed(item);
    toast(item.need ? `${item.en} removed from list` : `${item.en} added to shopping list ✓`);
    closeSheet(true);
  });
  wireDeletes(el, () => vegSheet(store.get('items', item.id)));
  if (!w) return;
  wireSizes(el);
  let mode = 'rate';
  const totalLine = el.querySelector('[data-total-line]');
  const calc = () => {
    const qty = Number(f.qty.value) || 0;
    const v = Number(f.price.value) || 0;
    if (!qty || !v) { totalLine.textContent = ''; return; }
    totalLine.textContent = mode === 'rate' ? `Total ${money(v * qty)}` : `= ${money(v / qty)} per ${f.unit.value}`;
  };
  el.querySelectorAll('[data-pm]').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.pm;
    el.querySelectorAll('[data-pm]').forEach((x) => x.classList.toggle('on', x === b));
    el.querySelector('[data-rate-label]').textContent = mode === 'rate' ? `₹ per ${f.unit.value}` : 'Total ₹';
    calc();
  }));
  f.qty.addEventListener('input', calc);
  f.price.addEventListener('input', calc);
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const qty = Number(f.qty.value);
    if (!(qty > 0)) { const e = f.querySelector('.form-error'); e.textContent = 'Enter quantity'; e.hidden = false; return; }
    const v = Number(f.price.value) || 0;
    const price = mode === 'rate' ? Math.round(v * qty * 100) / 100 : v;
    await stock.bought(item, { qty, unit: f.unit.value, price, date: f.date.value || today(), note: f.note.value.trim() });
    closeSheet(true);
    toast(price ? `${item.emoji || ''} ${item.en} ${number(qty)} ${f.unit.value} · ${money(price)} ✓` : `${item.en} saved ✓`);
  });
}

function wireDeletes(el, reopen) {
  el.querySelectorAll('[data-edit-ev]').forEach((b) => b.addEventListener('click', () => {
    const ev = store.get('stock', b.dataset.editEv);
    if (ev) editPurchaseSheet(ev, { onDone: reopen });
  }));
  el.querySelectorAll('[data-del-ev]').forEach((b) => b.addEventListener('click', async () => {
    const ev = store.get('stock', b.dataset.delEv);
    closeSheet(true);
    if (await confirmSheet({ title: 'Delete this record?', body: ev.entryId ? 'The linked grocery spend is deleted too.' : '', ok: 'Delete', danger: true })) {
      const removed = await stock.removeEvent(ev);
      toast('Deleted', { undo: () => stock.restoreEvent(removed) });
    }
    reopen();
  }));
}

export function itemForm(item = null, preset = {}) {
  const kind = item?.kind || preset.kind || 'kitchen';
  const veg = kind === 'veg';
  const it = item || { en: preset.en || '', hi: '', unit: 'kg', cat: veg ? 'Sabzi' : 'Kitchen', emoji: veg ? '🥬' : '' };
  const el = openSheet(`
    <form class="stack" novalidate>
      <h2 class="sheet-title">${item ? 'Edit item' : veg ? 'New sabzi' : 'New item'}</h2>
      <div class="row gap">
        ${veg ? `<label class="field"><span>Emoji</span><input name="emoji" class="input emo-in" value="${esc(it.emoji || '')}" maxlength="4"></label>` : ''}
        <label class="field grow"><span>Name (English)</span><input name="en" class="input" value="${esc(it.en)}" ${item ? '' : 'autofocus'} required></label>
        <label class="field grow"><span>Hindi name</span><input name="hi" class="input" value="${esc(it.hi)}"></label>
      </div>
      <div class="row gap">
        <label class="field grow"><span>Unit</span><select name="unit" class="input">${stock.UNITS.map((u) => `<option ${u === it.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
        <label class="field grow"><span>Group</span><select name="cat" class="input">${(veg ? stock.VEG_CATS : stock.ITEM_CATS).map((c) => `<option ${c === it.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        ${veg ? '' : `<label class="field"><span>Warn at</span><select name="lowDays" class="input" aria-label="Low stock warning days">${[2, 3, 5, 7, 10, 14].map((d) => `<option value="${d}" ${(Number(it.lowDays) || stock.LOW_DAYS) === d ? 'selected' : ''}>${d} days</option>`).join('')}</select></label>`}
      </div>
      <input name="note" class="input" placeholder="Remark (brand, where to buy…)" value="${esc(it.note || '')}" aria-label="Remark">
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
    const fields = {
      en, hi: f.hi.value.trim() || en, unit: f.unit.value, cat: f.cat.value, note: f.note.value.trim(),
      ...(veg ? { emoji: f.emoji.value.trim() || '🥬' } : { lowDays: Number(f.lowDays.value) }),
    };
    let saved;
    if (item) saved = await store.put('items', { ...item, ...fields });
    else saved = await stock.addItem({ ...fields, kind });
    closeSheet(true);
    state.q = '';
    toast(`${en} saved ✓`);
    if (!item && preset.thenBuy) (veg ? vegSheet : boughtSheet)(saved);
  });
  f.querySelector('[data-del]')?.addEventListener('click', async () => {
    closeSheet(true);
    if (await confirmSheet({ title: `Delete ${esc(item.en)}?`, body: 'Its purchase history is removed too. Spends already added stay in the budget.', ok: 'Delete', danger: true })) {
      await stock.removeItem(item);
      toast('Item deleted');
    }
  });
}

function detailSheet(item) {
  const a = stock.analyze(item);
  const [label, cls] = CHIP[a.status];
  const evs = [...a.events].reverse().slice(0, 12);
  const w = store.canWrite();
  const el = openSheet(`
    <div class="sheet-head">
      <h2 class="sheet-title">${esc(item.en)} <span class="hi">${esc(item.hi)}</span></h2>
      <span class="chip ${cls}">${label}</span>
    </div>
    ${item.note ? `<p class="small">📝 ${esc(item.note)}</p>` : ''}
    <div class="stat-grid">
      <div><span class="k">Runs out</span><span class="v">${a.runout ? `${dayLabel(a.runout)} · ${a.daysLeft}d` : a.status === 'finished' ? 'Finished' : '—'}</span></div>
      <div><span class="k">Pack lasts</span><span class="v">${a.avgDays ? `${Math.round(a.avgDays)} days` : '—'}</span></div>
      <div><span class="k">Use / week</span><span class="v">${a.perWeek != null ? `${number(a.perWeek)} ${esc(item.unit)}` : '—'}</span></div>
      <div><span class="k">Cost / month</span><span class="v">${a.monthlyCost != null ? money(a.monthlyCost) : '—'}</span></div>
    </div>
    ${priceLine(item)}
    ${a.open && w ? `<form class="stack-s" data-lasts-form>${lastsPicker(a.open.lastsDays, a.learnedDays)}
      <button class="btn ghost" type="submit">Update run-out date</button></form>` : ''}
    <h3 class="mini-title">History · warns ${a.lowDays} days before</h3>
    <div class="list hist">
      ${evs.length ? evs.map((e) => {
        const p = stock.priceOf(e);
        return `<div class="hist-row">
        <span class="dot ${e.type}"></span>
        <button class="grow hist-edit" data-edit-ev="${e.id}">${e.type === 'bought' ? `Bought ${number(e.qty)} ${esc(e.unit || item.unit)}${p ? ` · ${money(p)}` : ''}${e.lastsDays ? ` · ~${e.lastsDays}d` : ''}` : 'Finished'}
          <span class="muted small block">${dayLabel(e.date)} · ${esc(e.by || 'Me')}${e.note ? ` · ${esc(e.note)}` : ''}</span></button>
        ${w ? `<button class="icon-btn" data-del-ev="${e.id}" aria-label="Delete this record">${icon('trash')}</button>` : ''}
      </div>`;
      }).join('') : '<p class="empty">No history yet.</p>'}
    </div>
    ${w ? `<div class="row gap"><button class="btn ghost grow" data-edit>${icon('edit')} Edit item</button>
      <button class="btn primary grow" data-buy>${icon('plus')} Bought</button></div>` : ''}`);
  el.querySelector('[data-edit]')?.addEventListener('click', () => itemForm(item));
  el.querySelector('[data-buy]')?.addEventListener('click', () => boughtSheet(item));
  const lf = el.querySelector('[data-lasts-form]');
  if (lf) {
    const getLasts = wireLasts(lf, a.open.lastsDays);
    lf.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      await stock.setLasts(a.open.ev, getLasts());
      closeSheet(true);
      const b = stock.analyze(item);
      toast(b.runout ? `${item.en}: runs out ~${dayLabel(b.runout)} ✓` : 'Saved ✓');
    });
  }
  wireDeletes(el, () => detailSheet(item));
}

// Shopping mode: tick what you picked up, then one Done saves them all.
function shopModeSheet() {
  const list = stock.shoppingList();
  const el = openSheet(`
    <form class="stack" novalidate>
      <h2 class="sheet-title">🛒 Shopping</h2>
      <p class="muted small">Tick what you picked up. Qty and price are optional (price = total for that item).</p>
      <div class="list shop-mode" data-test="shop-mode">
        ${list.map((a) => {
          const last = a.lastBought;
          return `<div class="sm-row" data-id="${a.item.id}">
            <label class="sm-check"><input type="checkbox" name="pick" value="${a.item.id}"><span>${a.item.emoji ? `${a.item.emoji} ` : ''}<b>${esc(a.item.en)}</b> <span class="hi">${esc(a.item.hi)}</span></span></label>
            <input class="input sm-qty" name="qty-${a.item.id}" type="number" inputmode="decimal" step="any" min="0" value="${last?.qty ?? ''}" placeholder="qty" aria-label="Qty ${esc(a.item.en)}">
            <span class="sm-unit muted small">${esc(last?.unit || a.item.unit)}</span>
            <input class="input sm-price" name="price-${a.item.id}" type="number" inputmode="decimal" min="0" placeholder="₹" aria-label="Price ${esc(a.item.en)}">
          </div>`;
        }).join('')}
      </div>
      <button class="btn primary" type="submit" data-done>Done</button>
    </form>`);
  const f = el.querySelector('form');
  const btn = el.querySelector('[data-done]');
  const count = () => { const n = f.querySelectorAll('[name="pick"]:checked').length; btn.textContent = n ? `Done · ${n} bought` : 'Done'; };
  f.addEventListener('change', count);
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const picked = [...f.querySelectorAll('[name="pick"]:checked')].map((c) => c.value);
    if (!picked.length) { closeSheet(true); return; }
    for (const id of picked) {
      const it = store.get('items', id);
      const last = stock.eventsFor(id).filter((e) => e.type === 'bought').pop();
      const qty = Number(f[`qty-${id}`].value) || last?.qty || 1;
      await stock.bought(it, { qty, unit: last?.unit || it.unit, price: Number(f[`price-${id}`].value) || 0 });
    }
    closeSheet(true);
    toast(`${picked.length} item${picked.length > 1 ? 's' : ''} bought ✓`);
  });
}

// "+" button for the item picker (used from smart add fallbacks).
export function openItemPicker() {
  state.tab = 'kitchen';
  location.hash = '#/stock';
  setTimeout(() => document.querySelector('[data-search]')?.focus(), 80);
}

export function bind(root, rerender) {
  root.addEventListener('click', async (ev) => {
    const t = ev.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    const item = t.dataset.id ? store.get('items', t.dataset.id) : null;
    if (act === 'bought') { if (store.canWrite()) boughtSheet(item); else detailSheet(item); }
    else if (act === 'veg') vegSheet(item);
    else if (act === 'edit-ev') { const ev2 = store.get('stock', t.dataset.id); if (ev2) editPurchaseSheet(ev2); }
    else if (act === 'plan-need') {
      await stock.setNeed(item, !item.need);
      toast(item.need ? `${item.en} removed from list` : `${item.en} added to shopping list ✓`);
    } else if (act === 'plan-all') {
      const p = stock.monthlyPlan();
      for (const r of p.kitchen) if (!r.item.need) await stock.setNeed(r.item, true);
      toast(`${p.kitchen.length} items added to the shopping list ✓`);
    }
    else if (act === 'finished') {
      bump(t);
      const ev2 = await stock.finished(item);
      toast(`${item.en} finished — on the shopping list`, { undo: () => store.remove('stock', ev2.id) });
    } else if (act === 'detail') detailSheet(item);
    else if (act === 'tab') { state.tab = t.dataset.tab; rerender(); }
    else if (act === 'fold') {
      const k = t.dataset.key;
      state.open[k] = !root.querySelector(`[data-group="${k}"] .ilist`);
      rerender();
    }
    else if (act === 'shopmode') shopModeSheet();
    else if (act === 'add-new') {
      const q = (root.querySelector('[data-search]')?.value || state.q).trim();
      itemForm(null, { en: q.replace(/^./, (c) => c.toUpperCase()), kind: state.tab, thenBuy: true });
    }
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
  // Search: re-render the list but keep the keyboard open and the cursor where it was.
  root.addEventListener('input', (ev) => {
    if (!ev.target.matches('[data-search]')) return;
    state.q = ev.target.value;
    const pos = ev.target.selectionStart;
    rerender(() => {
      const inp = root.querySelector('[data-search]');
      if (inp) { inp.focus(); try { inp.setSelectionRange(pos, pos); } catch { /* type=search */ } }
    });
  });
}

export { itemForm as openItemForm, vegSheet as openVegSheet };
