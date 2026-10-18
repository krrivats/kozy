// Milk log maths. One doc per day: {id:'YYYY-MM-DD', litres, rate, skip}.
import * as store from '../store.js';
import { today, monthKey, daysInMonth, pad } from './format.js';
import { addEntry, MILK_CAT } from './budget.js';

export const DEFAULT_MILK = { litres: 4, rate: 60, asked: false };

export function settings() {
  return { ...DEFAULT_MILK, ...store.meta('milkSettings', {}) };
}

export async function saveSettings(s) {
  await store.setMeta('milkSettings', { ...settings(), ...s, asked: true });
}

export function day(date) {
  return store.get('milk', date);
}

export async function logDay(date, litres) {
  const s = settings();
  return store.put('milk', { id: date, litres: Number(litres), rate: s.rate, skip: false });
}

export async function skipDay(date) {
  return store.put('milk', { id: date, litres: 0, rate: settings().rate, skip: true });
}

export async function clearDay(date) {
  return store.remove('milk', date);
}

export async function tickToday() {
  return logDay(today(), settings().litres);
}

export function month(mk = monthKey()) {
  const n = daysInMonth(mk);
  const days = [];
  let litres = 0, amount = 0, delivered = 0, skipped = 0;
  for (let i = 1; i <= n; i++) {
    const date = `${mk}-${pad(i)}`;
    const d = day(date);
    if (d && !d.skip) {
      litres += Number(d.litres || 0);
      amount += Number(d.litres || 0) * Number(d.rate || settings().rate);
      delivered++;
    } else if (d?.skip) skipped++;
    days.push({ date, d });
  }
  const billed = store.meta('milkBilled', {})[mk] || null;
  return { mk, days, litres, amount: Math.round(amount), delivered, skipped, billed };
}

// Milkman account, carried across months:
//   owed = every delivered day up to today (litres × that day's rate)
//   paid = every spend in the Milk category (payments, older monthly bills, anything you gave him)
//   balance = owed − paid; "earlier" = what was still unpaid before this month (negative = paid ahead)
export function ledger(t = today()) {
  const mk = monthKey(t);
  const days = store.list('milk').filter((d) => !d.skip && d.id <= t);
  const cost = (d) => Number(d.litres || 0) * Number(d.rate || settings().rate);
  const owed = days.reduce((s, d) => s + cost(d), 0);
  const thisDays = days.filter((d) => d.id.startsWith(mk));
  const thisMonth = thisDays.reduce((s, d) => s + cost(d), 0);
  const payments = store.list('entries').filter((e) => e.cat === MILK_CAT && e.date <= t)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt - a.createdAt));
  const paid = payments.reduce((s, e) => s + Number(e.amount || 0), 0);
  return {
    owed: Math.round(owed), paid: Math.round(paid), balance: Math.round(owed - paid),
    thisMonth: Math.round(thisMonth), thisMonthLitres: thisDays.reduce((s, d) => s + Number(d.litres || 0), 0),
    earlier: Math.round(owed - thisMonth - paid), payments,
  };
}

// Record money given to the milkman (full or part). It is a spend in the Milk category.
export async function pay(amount, date = today(), mode = 'Cash') {
  return addEntry({ date, amount, cat: MILK_CAT, mode, note: 'Paid milkman', source: 'milk-pay' });
}

// Adds (or updates) the month's milk bill as a spend in the Milk category.
export async function addBill(mk, amount) {
  const all = { ...store.meta('milkBilled', {}) };
  const existing = all[mk] ? store.get('entries', all[mk]) : null;
  const t = today();
  const entry = await addEntry({
    id: existing?.id,
    date: existing?.date || (monthKey(t) === mk ? t : `${mk}-${pad(daysInMonth(mk))}`),
    amount, cat: MILK_CAT, mode: existing?.mode || 'Cash', note: `Milk bill ${mk}`, source: 'milk',
  });
  all[mk] = entry.id;
  await store.setMeta('milkBilled', all);
  return entry;
}
