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
