// MILK — one tap per day, calendar for the month, total to compare with the milkman's bill.
import * as milk from '../logic/milk.js';
import * as store from '../store.js';
import { money, number, monthKey, shiftMonth, today, parse, dayLabel, esc, monthName } from '../logic/format.js';
import { icon, openSheet, closeSheet, toast, bump } from '../ui.js';
import { header, monthSwitch } from './common.js';

const state = { mk: monthKey() };

function stepper(name, value) {
  return `<div class="stepper">
    <button type="button" class="icon-btn" data-step="-0.5" aria-label="Less">${icon('minus')}</button>
    <input name="${name}" class="input num" type="number" inputmode="decimal" step="0.5" min="0" value="${value}" aria-label="Litres">
    <button type="button" class="icon-btn" data-step="0.5" aria-label="More">${icon('plus')}</button>
  </div>`;
}

function wireStepper(el) {
  el.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
    const inp = b.parentElement.querySelector('input');
    inp.value = Math.max(0, (Number(inp.value) || 0) + Number(b.dataset.step));
  }));
}

export function render() {
  const s = milk.settings();
  const t = today();
  const td = milk.day(t);
  const m = milk.month(state.mk);
  const isCur = state.mk === monthKey(t);
  const billed = m.billed ? store.get('entries', m.billed) : null;

  const first = parse(`${state.mk}-01`).getDay(); // 0 = Sunday
  const lead = (first + 6) % 7; // Monday first
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="cal-cell blank"></span>');
  for (const { date, d } of m.days) {
    const n = Number(date.slice(8));
    const future = date > t;
    const cls = d ? (d.skip ? 'skip' : 'got') : (future ? 'future' : 'none');
    const val = d ? (d.skip ? 'skip' : `${number(d.litres)}L`) : '';
    cells.push(`<button class="cal-cell ${cls} ${date === t ? 'today' : ''}" data-day="${date}" ${future ? 'disabled' : ''} aria-label="${dayLabel(date)} ${val}">
      <span class="d">${n}</span><span class="l">${val}</span></button>`);
  }

  return `
  ${header('Milk log', `${number(s.litres)} L/day · ${money(s.rate)}/L`)}

  ${!s.asked ? `
  <section class="card setup" data-test="milk-setup">
    <h2>🥛 Set your daily milk</h2>
    <p class="muted small">How much milk comes every day, and the rate per litre?</p>
    <form class="row gap align-end" data-form="setup">
      <label class="field grow"><span>Litres / day</span><input name="litres" class="input" type="number" step="0.5" min="0" inputmode="decimal" value="${s.litres}"></label>
      <label class="field grow"><span>₹ / litre</span><input name="rate" class="input" type="number" step="1" min="0" inputmode="decimal" value="${s.rate}"></label>
      <button class="btn primary" type="submit">Save</button>
    </form>
  </section>` : ''}

  <section class="card today-milk ${td ? (td.skip ? 'skipped' : 'done') : ''}" data-test="milk-today">
    ${td ? `
      <div class="row between">
        <div><p class="label">Today</p><p class="big2">${td.skip ? 'Skipped' : `✓ ${number(td.litres)} L`}</p></div>
        <button class="btn ghost small" data-act="edit-day" data-day="${t}">${icon('edit')} Change</button>
      </div>` : `
      <button class="btn primary huge" data-act="tick">${icon('check')} Today's milk ✓ <span class="muted-ink">${number(s.litres)} L</span></button>
      <div class="row gap">
        <button class="btn ghost grow" data-act="edit-day" data-day="${t}">Different amount</button>
        <button class="btn ghost grow" data-act="skip-today">Skip today</button>
      </div>`}
  </section>

  ${monthSwitch(state.mk)}
  <section class="card">
    <div class="cal-head">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<span>${d}</span>`).join('')}</div>
    <div class="cal" data-test="calendar">${cells.join('')}</div>
    <div class="cal-legend small muted"><span><i class="lg got"></i> got milk</span><span><i class="lg skip"></i> skipped</span><span>Tap a day to change</span></div>
  </section>

  <section class="card" data-test="milk-total">
    <div class="sum3">
      <div><span class="k">Litres</span><span class="v" data-test="milk-litres">${number(m.litres)}</span></div>
      <div><span class="k">Amount</span><span class="v" data-test="milk-amount">${money(m.amount)}</span></div>
      <div><span class="k">Days</span><span class="v">${m.delivered}<span class="muted small"> · ${m.skipped} skip</span></span></div>
    </div>
  </section>

  <section class="card">
    <h2>🧾 Milkman's bill · ${monthName(state.mk)}</h2>
    <p class="muted small">${billed ? `Added to Milk spend: <b>${money(billed.amount)}</b>.` : 'Compare his bill with Kozy’s total, then add it to your Milk spend.'}</p>
    <form class="row gap align-end" data-form="bill">
      <label class="field grow"><span>Bill amount ₹</span><input name="amount" class="input" type="number" min="0" inputmode="decimal" value="${billed ? billed.amount : m.amount}"></label>
      <button class="btn primary" type="submit" data-test="add-bill">${billed ? 'Update' : 'Add to Milk spend'}</button>
    </form>
    <p class="muted tiny" data-bill-diff></p>
  </section>`;
}

function daySheet(date) {
  const d = milk.day(date);
  const s = milk.settings();
  const el = openSheet(`
    <form class="stack">
      <h2 class="sheet-title">Milk · ${dayLabel(date)}</h2>
      ${stepper('litres', d && !d.skip ? d.litres : s.litres)}
      <button class="btn primary" type="submit">${icon('check')} Save</button>
      <div class="row gap">
        <button type="button" class="btn ghost grow" data-skip>Skip this day</button>
        ${d ? '<button type="button" class="btn ghost grow danger-text" data-clear>Clear</button>' : ''}
      </div>
    </form>`);
  wireStepper(el);
  const f = el.querySelector('form');
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    await milk.logDay(date, Number(f.litres.value) || 0);
    closeSheet(true);
    toast(`${dayLabel(date)}: ${number(f.litres.value)} L ✓`);
  });
  el.querySelector('[data-skip]').onclick = async () => { await milk.skipDay(date); closeSheet(true); toast(`${dayLabel(date)} skipped`); };
  el.querySelector('[data-clear]')?.addEventListener('click', async () => { await milk.clearDay(date); closeSheet(true); toast('Cleared'); });
}

export function bind(root, rerender) {
  root.addEventListener('click', async (ev) => {
    const t = ev.target.closest('[data-act],[data-day]');
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'tick') { bump(t); await milk.tickToday(); toast(`Milk ${number(milk.settings().litres)} L logged ✓`); }
    else if (act === 'skip-today') { await milk.skipDay(today()); toast('Skipped today'); }
    else if (act === 'month-prev') { state.mk = shiftMonth(state.mk, -1); rerender(); }
    else if (act === 'month-next') { state.mk = shiftMonth(state.mk, 1); rerender(); }
    else if (t.dataset.day) daySheet(t.dataset.day);
  });
  root.addEventListener('submit', async (ev) => {
    const f = ev.target;
    ev.preventDefault();
    if (f.dataset.form === 'setup') {
      await milk.saveSettings({ litres: Number(f.litres.value) || 0, rate: Number(f.rate.value) || 0 });
      toast('Milk settings saved ✓');
    } else if (f.dataset.form === 'bill') {
      const amount = Number(f.amount.value);
      if (!(amount > 0)) { toast('Enter the bill amount', 'err'); return; }
      await milk.addBill(state.mk, amount);
      toast(`${money(amount)} added to Milk spend ✓`);
    }
  });
  root.addEventListener('input', (ev) => {
    if (ev.target.closest('[data-form="bill"]')) {
      const m = milk.month(state.mk);
      const diff = Number(ev.target.value) - m.amount;
      const p = root.querySelector('[data-bill-diff]');
      if (p) p.textContent = diff === 0 ? 'Matches Kozy ✓' : `Bill is ${money(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} than Kozy's ${money(m.amount)}`;
    }
  });
}
