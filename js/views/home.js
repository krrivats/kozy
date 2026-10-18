// HOME — one screen, no scrolling: money left, "Needs you" chips, top categories, recent activity.
import * as budget from '../logic/budget.js';
import * as milk from '../logic/milk.js';
import { reminders } from '../logic/reminders.js';
import { activity } from '../logic/activity.js';
import { money, monthName, monthKey, today, esc, number, dayLabel } from '../logic/format.js';
import { icon, logo, bar, toast, bump, openSheet, closeSheet } from '../ui.js';
import { activityRow, syncDot, roleBadge } from './common.js';
import { openEntry } from './edit-entry.js';
import * as store from '../store.js';

function chips() {
  const t = today();
  const rem = reminders(t, 'all');
  const bills = rem.filter((r) => r.kind === 'bill');
  const out = [];
  const check = budget.dueBills(t).filter((b) => b.group === 'checklist');
  if (check.length) {
    out.push(`<button class="nchip warn" data-act="checklist" data-test="chip-checklist">✅ Salary day · ${check.length} to do</button>`);
  }
  if (bills.length) {
    out.push(`<button class="nchip warn" data-act="bills" data-test="chip-bills">🔁 ${bills.length} bill${bills.length > 1 ? 's' : ''} due</button>`);
  }
  const shop = rem.find((r) => r.kind === 'stock');
  if (shop) out.push(`<a class="nchip warn" href="#/stock" data-test="chip-stock">🛒 ${esc(shop.title.split(':')[0])}</a>`);
  const md = milk.day(t);
  if (!md) out.push(`<button class="nchip" data-act="milk-tick" data-test="chip-milk">🥛 Tick milk ${number(milk.settings().litres)} L</button>`);
  else out.push(`<a class="nchip ok" href="#/milk" data-test="chip-milk">🥛 ${md.skip ? 'Milk skipped' : `Milk ✓ ${number(md.litres)} L`}</a>`);
  for (const g of budget.goals().slice(0, 2)) {
    out.push(`<a class="nchip" href="#/budget" data-test="chip-goal">${g.emoji || '🎯'} ${esc(g.name)} ${Math.round(g.pct * 100)}%</a>`);
  }
  return out.join('');
}

export function render() {
  const mk = monthKey();
  const s = budget.summary(mk);
  const overallLvl = budget.level(s.spent, s.limit);
  const feed = activity(4);

  return `
  <header class="top">
    <div class="brand">${logo(30)}<div><h1>Kozy ${syncDot()}</h1><p class="sub">${monthName(mk)}</p></div></div>
    <div class="top-right">${roleBadge()}</div>
  </header>

  <section class="card hero ${s.left < 0 ? 'neg' : ''}" data-test="hero">
    <div class="row between"><p class="label">Left this month</p><p class="label">of ${money(s.limit)}</p></div>
    <p class="big" data-test="left">${money(s.left)}</p>
    ${bar(s.spent, s.limit, overallLvl)}
    <p class="hero-line"><span data-test="days-left">${s.daysLeft}</span> days left · <b data-test="safe-daily">${money(s.safeDaily)}</b>/day safe · spent ${money(s.spent)}</p>
  </section>

  <section class="needs" data-test="needs" aria-label="Needs you">${chips()}</section>

  <section class="card tight">
    <div class="card-head"><h2>Top spends</h2><a class="link" href="#/budget">All ${icon('chevron')}</a></div>
    ${s.top.length ? s.top.map((c) => {
      const lvl = budget.level(c.amount, c.limit);
      return `<div class="cat-mini">
        <div class="row between"><span class="cat-name">${c.emoji} ${esc(c.name)}</span><span class="num ${lvl}">${money(c.amount)}<span class="muted"> / ${money(c.limit)}</span></span></div>
        ${bar(c.amount, c.limit, lvl)}
      </div>`;
    }).join('') : '<p class="empty">Nothing spent yet this month.</p>'}
  </section>

  <section class="card tight">
    <div class="card-head"><h2>Recent</h2><button class="link" data-act="activity">See all ${icon('chevron')}</button></div>
    <div class="list" data-test="recent">${feed.length ? feed.map(activityRow).join('') : '<p class="empty">Nothing yet. Tap <b>+</b> to add.</p>'}</div>
  </section>`;
}

function billsSheet(group = 'bills') {
  const isCheck = group === 'checklist';
  const due = budget.dueBills(today()).filter((b) => (b.group === 'checklist') === isCheck);
  const can = store.canWrite();
  const reopen = () => (budget.dueBills(today()).some((b) => (b.group === 'checklist') === isCheck) ? billsSheet(group) : closeSheet(true));
  const el = openSheet(`
    <h2 class="sheet-title">${isCheck ? '✅ Salary-day checklist' : 'Bills due'}</h2>
    ${isCheck ? '<p class="muted small">Money you move every month. Tap ✓ when done — it is added to that category.</p>' : ''}
    <div class="list" data-test="bills-sheet">
      ${due.length ? due.map((b) => `<form class="bill-row" data-bill="${b.id}">
        <span class="emo-badge">${b.emoji || '🧾'}</span>
        <span class="grow"><b>${esc(b.name)}</b>
          <span class="small block ${b.daysTo < 0 ? 'over-text' : 'muted'}">${b.daysTo < 0 ? `Overdue · ${dayLabel(b.due)}` : b.daysTo === 0 ? 'Due today' : `Due ${dayLabel(b.due)}`}</span></span>
        ${can ? `<input class="input np-in" name="amount" type="number" inputmode="decimal" min="0" value="${b.amount || ''}" placeholder="₹" aria-label="Amount for ${esc(b.name)}">
        <button class="icon-btn" type="button" data-skip="${b.id}" aria-label="Skip ${esc(b.name)} this time">${icon('x')}</button>
        <button class="btn small primary" type="submit">${isCheck ? '✓ Done' : 'Paid'}</button>` : `<b class="num">${money(b.amount)}</b>`}
      </form>`).join('') : '<p class="empty">Nothing due 🎉</p>'}
    </div>
    ${store.isOwner() ? `<a class="btn ghost" href="#/settings" data-close-sheet>${isCheck ? 'Change the checklist in Settings' : 'All bills in Settings'}</a>` : ''}`);
  el.querySelector('[data-close-sheet]')?.addEventListener('click', () => closeSheet(true));
  el.querySelectorAll('[data-bill]').forEach((f) => f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const b = budget.bills().find((x) => x.id === f.dataset.bill);
    const amount = Number(f.amount.value);
    if (!(amount > 0)) { f.amount.focus(); return; }
    await budget.payBill(b, amount);
    toast(`${b.name} ${money(amount)} ${isCheck ? 'done' : 'paid'} ✓`);
    reopen();
  }));
  el.querySelectorAll('[data-skip]').forEach((btn) => btn.addEventListener('click', async () => {
    const b = budget.bills().find((x) => x.id === btn.dataset.skip);
    await budget.skipBill(b);
    toast(`${b.name} skipped this time`);
    reopen();
  }));
}

export function activitySheet() {
  const el = openSheet(`<h2 class="sheet-title">Activity</h2>
    <p class="muted small">Tap any line to change or delete it.</p>
    <div class="list act-full" data-test="activity">${activity(60).map(activityRow).join('') || '<p class="empty">Nothing yet.</p>'}</div>`);
  el.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openEntry(b.dataset.open, b.dataset.ref)));
}

export function bind(root) {
  root.addEventListener('click', async (ev) => {
    const o = ev.target.closest('[data-open]');
    if (o) { openEntry(o.dataset.open, o.dataset.ref); return; }
    const t = ev.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'bills') billsSheet();
    else if (act === 'checklist') billsSheet('checklist');
    else if (act === 'activity') activitySheet();
    else if (act === 'milk-tick') {
      bump(t);
      await milk.tickToday();
      toast(`Milk ${number(milk.settings().litres)} L logged ✓`, { undo: () => milk.clearDay(today()) });
    }
  });
}
