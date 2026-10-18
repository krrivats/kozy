// MILK — one tap per day, calendar for the month, and the milkman's running balance
// (what the milk cost minus what you paid him; anything unpaid carries into the next month).
import * as milk from '../logic/milk.js';
import * as store from '../store.js';
import { money, number, monthKey, shiftMonth, today, parse, dayLabel, monthShortName, esc } from '../logic/format.js';
import { icon, openSheet, closeSheet, toast, bump } from '../ui.js';
import { header, monthSwitch, entryRow } from './common.js';
import { openSpendSheet } from './spend-sheet.js';

const state = { mk: monthKey() };

function stepper(name, value) {
  return `<div class="stepper">
    <button type="button" class="icon-btn" data-step="-0.25" aria-label="Less">${icon('minus')}</button>
    <input name="${name}" class="input num" type="number" inputmode="decimal" step="0.25" min="0" value="${value}" aria-label="Litres">
    <button type="button" class="icon-btn" data-step="0.25" aria-label="More">${icon('plus')}</button>
  </div>`;
}

// Milk types editor (used here on first run and in Settings): emoji · name · L/day · ₹/L.
export function typesEditor(list, disabled = false) {
  const dis = disabled ? 'disabled' : '';
  return `<div class="stack-s" data-types>
    ${list.map((t) => `<div class="limit-row mtype" data-type="${esc(t.id)}">
      <input class="input emo-in" name="t-emoji" value="${esc(t.emoji || '🥛')}" maxlength="4" aria-label="Emoji" ${dis}>
      <input class="input grow" name="t-name" value="${esc(t.name)}" aria-label="Milk name" ${dis}>
      <label class="mini-field"><input class="input num" name="t-litres" type="number" step="0.25" min="0" inputmode="decimal" value="${t.litres}" aria-label="${esc(t.name)} litres per day" ${dis}><span>L/day</span></label>
      <label class="mini-field"><input class="input num" name="t-rate" type="number" step="1" min="0" inputmode="decimal" value="${t.rate}" aria-label="${esc(t.name)} rate per litre" ${dis}><span>₹/L</span></label>
      ${disabled ? '' : `<button type="button" class="icon-btn" data-act="mtype-del" aria-label="Remove ${esc(t.name)}">${icon('trash')}</button>`}
    </div>`).join('')}
    ${disabled ? '' : `<button type="button" class="btn ghost small" data-act="mtype-add">${icon('plus')} Milk type</button>`}
  </div>`;
}

export function readTypes(root) {
  return [...root.querySelectorAll('.mtype')].map((row) => {
    const name = row.querySelector('[name="t-name"]').value.trim() || 'Milk';
    return {
      id: row.dataset.type || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name, emoji: row.querySelector('[name="t-emoji"]').value.trim() || '🥛',
      litres: Number(row.querySelector('[name="t-litres"]').value) || 0,
      rate: Number(row.querySelector('[name="t-rate"]').value) || 0,
    };
  });
}

// Add / remove rows inside a types editor (works in any container).
export function wireTypesEditor(root) {
  root.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-act="mtype-add"],[data-act="mtype-del"]');
    if (!t) return;
    ev.preventDefault();
    ev.stopPropagation();
    const box = t.closest('[data-types]');
    if (t.dataset.act === 'mtype-del') { t.closest('.mtype').remove(); return; }
    const tmp = document.createElement('div');
    tmp.innerHTML = typesEditor([{ id: `m${Date.now().toString(36)}`, name: 'Milk', emoji: '🥛', litres: 1, rate: 60 }]);
    box.insertBefore(tmp.querySelector('.mtype'), t);
  }, true);
}

function wireStepper(el) {
  el.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
    const inp = b.parentElement.querySelector('input');
    inp.value = Math.max(0, Math.round(((Number(inp.value) || 0) + Number(b.dataset.step)) * 100) / 100);
  }));
}

function balanceCard(w) {
  const L = milk.ledger();
  const t = today();
  const mk = monthKey(t);
  return `<section class="card tight balance-card" data-test="milk-balance">
    <div class="row between">
      <div><p class="label">Milkman · to pay</p>
        <p class="big2 num ${L.balance > 0 ? '' : 'ok-text'}" data-test="milk-due">${L.balance > 0 ? money(L.balance) : L.balance < 0 ? `${money(-L.balance)} advance` : 'All paid ✓'}</p></div>
      ${w && L.balance > 0 ? '<button class="btn primary small" data-act="pay" data-test="pay-milk">Pay</button>' : ''}
    </div>
    <div class="bal-lines">
      <span>${monthShortName(mk)} so far <b>${money(L.thisMonth)}</b> · ${number(L.thisMonthLitres)} L</span>
      ${L.earlier > 0 ? `<span class="warn-text" data-test="milk-earlier">Earlier unpaid <b>${money(L.earlier)}</b></span>`
        : L.earlier < 0 ? `<span class="ok-text">Paid ahead <b>${money(-L.earlier)}</b></span>` : ''}
    </div>
    ${L.payments.length ? `<h3 class="mini-title">Paid</h3><div class="list" data-test="milk-payments">${L.payments.slice(0, 3).map(entryRow).join('')}</div>` : ''}
  </section>`;
}

export function render() {
  const s = milk.settings();
  const t = today();
  const td = milk.day(t);
  const m = milk.month(state.mk);
  const w = store.canWrite();

  const first = parse(`${state.mk}-01`).getDay(); // 0 = Sunday
  const lead = (first + 6) % 7; // Monday first
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="cal-cell blank"></span>');
  for (const { date, d } of m.days) {
    const n = Number(date.slice(8));
    const future = date > t;
    const cls = d ? (d.skip ? 'skip' : 'got') : (future ? 'future' : 'none');
    const val = d ? (d.skip ? 'skip' : `${number(milk.dayLitres(d))}L`) : '';
    cells.push(`<button class="cal-cell ${cls} ${date === t ? 'today' : ''}" data-day="${date}" ${future || !w ? 'disabled' : ''} aria-label="${dayLabel(date)} ${val}">
      <span class="d">${n}</span><span class="l">${val}</span></button>`);
  }

  return `
  ${header('Milk log', `${milk.defaultLabel()} · ${money(s.perDay)}/day`)}

  ${!s.asked && store.isOwner() ? `
  <section class="card setup" data-test="milk-setup">
    <h2>🥛 Your daily milk</h2>
    <p class="muted small">Litres that come every day and the rate per litre, for each kind of milk.</p>
    <form class="stack-s" data-form="setup">
      ${typesEditor(s.types)}
      <button class="btn primary" type="submit">Save</button>
    </form>
  </section>` : ''}

  <section class="card today-milk ${td ? (td.skip ? 'skipped' : 'done') : ''}" data-test="milk-today">
    ${td ? `
      <div class="row between">
        <div><p class="label">Today</p><p class="big2">${td.skip ? 'Skipped' : `✓ ${number(milk.dayLitres(td))} L`}</p>
          ${td.skip ? '' : `<p class="muted small">${milk.dayItems(td).map((x) => `${x.emoji} ${number(x.litres)} L`).join(' · ')}</p>`}</div>
        ${w ? `<button class="btn ghost small" data-act="edit-day" data-day="${t}">${icon('edit')} Change</button>` : ''}
      </div>` : `
      ${w ? `<div class="row gap">
        <button class="btn primary grow tick" data-act="tick"><span>Today's milk ✓</span><span class="muted-ink">${milk.defaultLabel()}</span></button>
        <button class="btn ghost" data-act="edit-day" data-day="${t}" aria-label="Different amount">${icon('edit')}</button>
        <button class="btn ghost" data-act="skip-today">Skip</button>
      </div>` : '<p class="muted">Today: not logged yet</p>'}`}
  </section>

  ${balanceCard(w)}

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
    ${m.byType.length > 1 ? `<div class="list type-split" data-test="milk-by-type">${m.byType.map((b) => `<div class="mv-row">
      <span>${b.emoji} ${esc(b.name)}</span><span class="num">${number(b.litres)} L · <b>${money(b.amount)}</b></span></div>`).join('')}</div>` : ''}
  </section>`;
}

export function openMilkDay(date) {
  const d = milk.day(date);
  const saved = Object.fromEntries(milk.dayItems(d).map((x) => [x.id, x.litres]));
  const start = d && !d.skip ? saved : milk.defaultAmounts();
  // Show every current type, plus any older type this day has (e.g. "Milk" from before types existed).
  const list = [...milk.types(), ...milk.dayItems(d).filter((x) => !milk.types().some((t) => t.id === x.id))];
  const el = openSheet(`
    <form class="stack" data-test="milk-day">
      <h2 class="sheet-title">Milk · ${dayLabel(date)}</h2>
      ${list.map((t) => `<div class="mday-row"><span class="mday-name">${t.emoji} ${esc(t.name)}<span class="muted small block">${money(t.rate)}/L</span></span>
        ${stepper(`l-${t.id}`, start[t.id] ?? 0)}</div>`).join('')}
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
    const amounts = Object.fromEntries(list.map((t) => [t.id, Number(f[`l-${t.id}`].value) || 0]));
    await milk.logDay(date, amounts);
    closeSheet(true);
    toast(`${dayLabel(date)}: ${number(Object.values(amounts).reduce((a, b) => a + b, 0))} L ✓`);
  });
  el.querySelector('[data-skip]').onclick = async () => { await milk.skipDay(date); closeSheet(true); toast(`${dayLabel(date)} skipped`); };
  el.querySelector('[data-clear]')?.addEventListener('click', async () => { await milk.clearDay(date); closeSheet(true); toast('Cleared'); });
}

// Pay the milkman: full balance pre-filled, change it for a part payment.
export function openPayMilk() {
  const L = milk.ledger();
  const el = openSheet(`
    <form class="stack" data-test="pay-sheet" novalidate>
      <h2 class="sheet-title">🥛 Pay milkman</h2>
      <p class="small">Due <b>${money(Math.max(0, L.balance))}</b>${L.earlier > 0 ? ` (incl. earlier ${money(L.earlier)})` : ''}. Change the amount for a part payment — the rest carries over.</p>
      <label class="amount-field"><span>₹</span>
        <input name="amount" type="number" inputmode="decimal" min="0" step="any" value="${Math.max(0, L.balance)}" aria-label="Amount paid"></label>
      <div class="seg" role="radiogroup" aria-label="Mode">
        <button type="button" class="on" data-mode="Cash">Cash</button><button type="button" data-mode="UPI">UPI</button>
      </div>
      <input name="date" class="input" type="date" value="${today()}" aria-label="Date">
      <button class="btn primary" type="submit" data-save>${icon('check')} Paid</button>
    </form>`);
  const f = el.querySelector('form');
  let mode = 'Cash';
  el.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    el.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x === b));
  }));
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const amount = Number(f.amount.value);
    if (!(amount > 0)) { f.amount.focus(); return; }
    const e = await milk.pay(amount, f.date.value || today(), mode);
    closeSheet(true);
    const left = milk.ledger().balance;
    toast(`Paid ${money(amount)}${left > 0 ? ` · ${money(left)} left` : ' · all clear'} ✓`, { undo: () => store.remove('entries', e.id) });
  });
}

export function bind(root, rerender) {
  root.addEventListener('click', async (ev) => {
    const en = ev.target.closest('[data-entry]');
    if (en) { const e = store.get('entries', en.dataset.entry); if (e) openSpendSheet(e); return; }
    const t = ev.target.closest('[data-act],[data-day]');
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'tick') { bump(t); await milk.tickToday(); toast(`Milk ${milk.defaultLabel()} logged ✓`, { action: { label: 'Change', fn: () => openMilkDay(today()) } }); }
    else if (act === 'skip-today') { await milk.skipDay(today()); toast('Skipped today'); }
    else if (act === 'pay') openPayMilk();
    else if (act === 'month-prev') { state.mk = shiftMonth(state.mk, -1); rerender(); }
    else if (act === 'month-next') { state.mk = shiftMonth(state.mk, 1); rerender(); }
    else if (t.dataset.day) openMilkDay(t.dataset.day);
  });
  root.addEventListener('submit', async (ev) => {
    const f = ev.target;
    ev.preventDefault();
    if (f.dataset.form === 'setup') {
      await milk.saveSettings({ types: readTypes(f) });
      toast('Milk saved ✓');
    }
  });
  wireTypesEditor(root);

}
