// HOME — the money picture for this month at a glance.
import * as budget from '../logic/budget.js';
import * as milk from '../logic/milk.js';
import { shoppingList } from '../logic/stock.js';
import { money, monthName, monthKey, today, esc, number } from '../logic/format.js';
import { icon, logo, bar, toast, bump } from '../ui.js';
import { entryRow } from './common.js';
import { openSpendSheet } from './spend-sheet.js';
import * as store from '../store.js';

export function render() {
  const mk = monthKey();
  const s = budget.summary(mk);
  const pending = budget.pendingRecurring(mk);
  const last5 = budget.entriesFor(mk).slice(0, 5);
  const todayMilk = milk.day(today());
  const ms = milk.settings();
  const shop = shoppingList();
  const overallLvl = budget.level(s.spent, s.limit);

  return `
  <header class="top">
    <div class="brand">${logo(30)}<div><h1>Kozy</h1><p class="sub">${monthName(mk)}</p></div></div>
    <div class="top-right"><span class="who-chip">${esc(store.currentUserLabel())}</span></div>
  </header>

  <section class="card hero ${s.left < 0 ? 'neg' : ''}" data-test="hero">
    <p class="label">Left this month</p>
    <p class="big" data-test="left">${money(s.left)}</p>
    ${bar(s.spent, s.limit, overallLvl)}
    <div class="stats3">
      <div><span class="k">Days left</span><span class="v" data-test="days-left">${s.daysLeft}</span></div>
      <div><span class="k">Safe / day</span><span class="v" data-test="safe-daily">${money(s.safeDaily)}</span></div>
      <div><span class="k">Spent</span><span class="v">${money(s.spent)}</span></div>
    </div>
  </section>

  ${pending.length ? `
  <section class="card recurring" data-test="recurring">
    <div class="card-head"><h2>${icon('repeat')} Monthly bills due</h2>
      ${pending.length > 1 ? `<button class="btn small primary" data-act="rec-all">Confirm all</button>` : ''}</div>
    <div class="list">
      ${pending.map((r) => {
        const c = budget.cat(r.cat);
        return `<div class="rec-row">
          <span class="emo-badge">${c.emoji}</span>
          <span class="grow"><b>${esc(r.note)}</b><span class="muted small block">${money(r.amount)} · ${esc(c.name)}</span></span>
          <button class="icon-btn" data-act="rec-skip" data-id="${r.id}" aria-label="Skip ${esc(r.note)} this month">${icon('x')}</button>
          <button class="btn small primary" data-act="rec-ok" data-id="${r.id}" aria-label="Confirm ${esc(r.note)}">${icon('check')} Paid</button>
        </div>`;
      }).join('')}
    </div>
  </section>` : ''}

  <div class="quick2">
    <button class="card tile ${todayMilk && !todayMilk.skip ? 'done' : ''}" data-act="milk-tick" data-test="home-milk">
      <span class="tile-ic">${icon('milk')}</span>
      <span class="tile-t">${todayMilk ? (todayMilk.skip ? 'Milk skipped today' : `Milk ✓ ${number(todayMilk.litres)} L`) : "Today's milk"}</span>
      <span class="tile-s">${todayMilk ? 'Tap Milk tab to change' : `Tap to log ${number(ms.litres)} L`}</span>
    </button>
    <a class="card tile ${shop.length ? 'warn' : ''}" href="#/stock">
      <span class="tile-ic">${icon('cart')}</span>
      <span class="tile-t">${shop.length ? `${shop.length} to buy` : 'Stock OK'}</span>
      <span class="tile-s">${shop.length ? esc(shop.slice(0, 3).map((a) => a.item.en).join(', ')) : 'Nothing running low'}</span>
    </a>
  </div>

  <section class="card">
    <div class="card-head"><h2>Top spends</h2><a class="link" href="#/budget">All categories ${icon('chevron')}</a></div>
    ${s.top.length ? s.top.map((c) => {
      const lvl = budget.level(c.amount, c.limit);
      return `<div class="cat-mini">
        <div class="row between"><span>${c.emoji} ${esc(c.name)}</span><span class="num ${lvl}">${money(c.amount)} <span class="muted">/ ${money(c.limit)}</span></span></div>
        ${bar(c.amount, c.limit, lvl)}
      </div>`;
    }).join('') : '<p class="empty">Nothing spent yet this month.</p>'}
  </section>

  <section class="card">
    <div class="card-head"><h2>Last 5 spends</h2><a class="link" href="#/budget">See all ${icon('chevron')}</a></div>
    <div class="list" data-test="last5">${last5.length ? last5.map(entryRow).join('') : '<p class="empty">No spends yet. Tap <b>+</b> to add one.</p>'}</div>
  </section>`;
}

export function bind(root) {
  root.addEventListener('click', async (ev) => {
    const t = ev.target.closest('[data-act],[data-entry]');
    if (!t) return;
    if (t.dataset.entry) {
      const e = store.get('entries', t.dataset.entry);
      if (e) openSpendSheet(e);
      return;
    }
    const act = t.dataset.act;
    const mk = monthKey();
    if (act === 'rec-ok') {
      const r = budget.recurring().find((x) => x.id === t.dataset.id);
      bump(t);
      await budget.confirmRecurring(r, mk);
      toast(`${r.note} ${money(r.amount)} added ✓`);
    } else if (act === 'rec-skip') {
      await budget.markRecurring(mk, t.dataset.id);
      toast('Skipped for this month');
    } else if (act === 'rec-all') {
      const list = budget.pendingRecurring(mk);
      for (const r of list) await budget.confirmRecurring(r, mk);
      toast(`${list.length} bills added ✓`);
    } else if (act === 'milk-tick') {
      if (milk.day(today())) { location.hash = '#/milk'; return; }
      bump(t);
      await milk.tickToday();
      toast(`Milk ${number(milk.settings().litres)} L logged ✓`);
    }
  });
}
