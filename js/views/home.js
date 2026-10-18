// HOME — one screen, no scrolling: money left, "Needs you" chips, top categories, recent activity.
import * as budget from '../logic/budget.js';
import * as milk from '../logic/milk.js';
import { reminders } from '../logic/reminders.js';
import { activity } from '../logic/activity.js';
import { money, monthName, monthKey, today, esc, number, dayLabel } from '../logic/format.js';
import { icon, logo, bar, toast, bump, openSheet, closeSheet } from '../ui.js';
import { activityRow, syncDot, roleBadge, gearLink } from './common.js';
import { openSpendSheet } from './spend-sheet.js';
import { shoppingList } from '../logic/stock.js';
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
  // (items to buy show on the Shop quick action instead of a chip)
  for (const g of budget.goals().slice(0, 2)) {
    out.push(`<a class="nchip" href="#/budget" data-test="chip-goal">${g.emoji || '🎯'} ${esc(g.name)} ${Math.round(g.pct * 100)}%</a>`);
  }
  return out.join('');
}

// Quick actions: the four things you do most, one tap each.
function quickActions() {
  const t = today();
  const md = milk.day(t);
  const w = store.canWrite();
  const shopN = shoppingList().length;
  const milkBtn = !md
    ? `<button class="qa-btn" data-act="milk-tick" data-test="chip-milk" ${w ? '' : 'disabled'}><span class="qa-ic">${icon('milk')}</span><span class="qa-t">Tick milk ${number(milk.settings().litres)} L</span></button>`
    : `<a class="qa-btn done" href="#/milk" data-test="chip-milk"><span class="qa-ic">${icon('check')}</span><span class="qa-t">${md.skip ? 'Milk skipped' : `Milk ✓ ${number(md.litres)} L`}</span></a>`;
  return `<section class="qa" data-test="quick">
    <button class="qa-btn primary" data-act="qa-add" ${w ? '' : 'disabled'}><span class="qa-ic">${icon('plus')}</span><span class="qa-t">Add</span></button>
    <button class="qa-btn" data-act="qa-scan" ${w ? '' : 'disabled'}><span class="qa-ic">${icon('camera')}</span><span class="qa-t">Scan bill</span></button>
    ${milkBtn}
    <a class="qa-btn ${shopN ? 'warn' : ''}" href="#/stock"><span class="qa-ic">${icon('cart')}</span><span class="qa-t">Shop${shopN ? ` · ${shopN}` : ''}</span></a>
  </section>`;
}

// Ring gauge: how much of the month's budget is used.
function gauge(spent, limit, lvl) {
  const used = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
  return `<div class="gauge ${lvl}" role="img" aria-label="${used}% of budget used">
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="g-a"/><stop offset="1" class="g-b"/></linearGradient></defs>
      <circle class="g-track" cx="60" cy="60" r="50"/>
      <circle class="g-fill" cx="60" cy="60" r="50" pathLength="100" stroke-dasharray="${used} 100"/>
    </svg>
    <div class="g-center"><span class="g-pct">${used}%</span><span class="g-k">used</span></div>
  </div>`;
}

export function render() {
  const mk = monthKey();
  const s = budget.summary(mk);
  const overallLvl = budget.level(s.spent, s.limit);
  const feed = activity(4);

  return `
  <header class="top">
    <div class="brand">${logo(32)}<div><h1>Kozy ${syncDot()}</h1><p class="sub">${monthName(mk)}</p></div></div>
    <div class="top-right">${roleBadge()}${gearLink()}</div>
  </header>

  <section class="card hero ${s.left < 0 ? 'neg' : ''}" data-test="hero">
    ${gauge(s.spent, s.limit, overallLvl)}
    <div class="hero-main">
      <p class="label">Left this month</p>
      <p class="big" data-test="left">${money(s.left)}</p>
      <p class="hero-sub">spent ${money(s.spent)} of ${money(s.limit)}</p>
      <div class="hero-stats">
        <span><b data-test="days-left">${s.daysLeft}</b> days left</span>
        <span><b data-test="safe-daily">${money(s.safeDaily)}</b> /day safe</span>
      </div>
    </div>
  </section>

  ${quickActions()}

  ${chips() ? `<section class="needs" data-test="needs" aria-label="Needs you">${chips()}</section>` : ''}

  <section class="card tight">
    <div class="card-head"><h2>Top spends</h2><a class="link" href="#/budget">All ${icon('chevron')}</a></div>
    ${s.top.length ? s.top.map((c) => {
      const lvl = budget.level(c.amount, c.limit);
      return `<a class="cat-mini go-row" href="#/budget">
        <span class="row between"><span class="cat-name">${c.emoji} ${esc(c.name)}</span><span class="num ${lvl}">${money(c.amount)}<span class="muted"> / ${money(c.limit)}</span></span></span>
        ${bar(c.amount, c.limit, lvl)}
      </a>`;
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
    else if (act === 'qa-add') openSpendSheet();
    else if (act === 'qa-scan') { const m = await import('./scan-sheet.js'); m.openScanSheet(); }
    else if (act === 'activity') activitySheet();
    else if (act === 'milk-tick') {
      bump(t);
      await milk.tickToday();
      toast(`Milk ${number(milk.settings().litres)} L logged ✓`, { undo: () => milk.clearDay(today()) });
    }
  });
}
