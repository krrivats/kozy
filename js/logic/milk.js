// Milk log maths. Several milk types (e.g. 🐃 Buffalo 2 L @ ₹70, 🐄 Cow 1.5 L @ ₹55), each with its own rate.
// One doc per day: {id:'YYYY-MM-DD', items: {buffalo: {litres, rate}, cow: {...}}, litres: total, skip}.
// Older days saved as {litres, rate} (one milk) are still read correctly.
import * as store from '../store.js';
import { today, monthKey, daysInMonth, pad } from './format.js';
import { addEntry, MILK_CAT } from './budget.js';

export const DEFAULT_TYPES = [
  { id: 'buffalo', name: 'Buffalo', emoji: '🐃', litres: 2, rate: 70 },
  { id: 'cow', name: 'Cow', emoji: '🐄', litres: 1.5, rate: 55 },
];
export const DEFAULT_MILK = { types: DEFAULT_TYPES, asked: false };

// Settings with the types list. Old single-milk settings {litres, rate} become one "Milk" type.
export function settings() {
  const raw = store.meta('milkSettings', {}) || {};
  let types = raw.types;
  if (!Array.isArray(types) || !types.length) {
    types = raw.litres != null || raw.rate != null
      ? [{ id: 'milk', name: 'Milk', emoji: '🥛', litres: Number(raw.litres ?? 4), rate: Number(raw.rate ?? 60) }]
      : DEFAULT_TYPES;
  }
  const litres = types.reduce((s, t) => s + Number(t.litres || 0), 0);
  const cost = types.reduce((s, t) => s + Number(t.litres || 0) * Number(t.rate || 0), 0);
  return { asked: !!raw.asked, types, litres, rate: litres ? cost / litres : 0, perDay: cost };
}

export function types() {
  return settings().types;
}

export function typeOf(id) {
  return types().find((t) => t.id === id) || { id, name: id === 'milk' ? 'Milk' : id, emoji: '🥛', litres: 0, rate: 0 };
}

export async function saveSettings(s) {
  const cur = settings();
  await store.setMeta('milkSettings', { types: s.types || cur.types, asked: true });
}

// "2 L 🐃 + 1.5 L 🐄"
export function defaultLabel(list = types()) {
  return list.filter((t) => Number(t.litres) > 0).map((t) => `${num(t.litres)} L ${t.emoji}`).join(' + ') || '0 L';
}

function num(n) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(n) || 0);
}

// ---------- one day ----------
export function day(date) {
  return store.get('milk', date);
}

// [{id, name, emoji, litres, rate}] for a saved day (old one-milk days → one "Milk" line).
export function dayItems(d) {
  if (!d || d.skip) return [];
  if (d.items) {
    return Object.entries(d.items).map(([id, v]) => ({ ...typeOf(id), id, litres: Number(v.litres || 0), rate: Number(v.rate || 0) }))
      .filter((x) => x.litres > 0);
  }
  return [{ id: 'milk', name: 'Milk', emoji: '🥛', litres: Number(d.litres || 0), rate: Number(d.rate || settings().rate) }];
}

export function dayLitres(d) {
  return dayItems(d).reduce((s, x) => s + x.litres, 0);
}

export function dayCost(d) {
  return dayItems(d).reduce((s, x) => s + x.litres * x.rate, 0);
}

// Save a day. amounts = {typeId: litres}. Each type keeps today's rate, so later rate changes don't touch old days.
export async function logDay(date, amounts) {
  const items = {};
  for (const t of types()) {
    const l = Number(amounts?.[t.id] ?? 0);
    if (l > 0) items[t.id] = { litres: l, rate: Number(t.rate) };
  }
  const litres = Object.values(items).reduce((s, v) => s + v.litres, 0);
  return store.replace('milk', { ...(day(date) || {}), id: date, items, litres, skip: false, rate: null, by: store.currentUserLabel(), createdAt: day(date)?.createdAt || Date.now() });
}

// The usual amounts of every type.
export function defaultAmounts() {
  return Object.fromEntries(types().map((t) => [t.id, Number(t.litres) || 0]));
}

export async function tickToday() {
  return logDay(today(), defaultAmounts());
}

export async function skipDay(date) {
  return store.replace('milk', { id: date, items: {}, litres: 0, skip: true, by: store.currentUserLabel(), createdAt: day(date)?.createdAt || Date.now() });
}

export async function clearDay(date) {
  return store.remove('milk', date);
}

// ---------- month ----------
export function month(mk = monthKey()) {
  const n = daysInMonth(mk);
  const days = [];
  let litres = 0, amount = 0, delivered = 0, skipped = 0;
  const byType = {};
  for (let i = 1; i <= n; i++) {
    const date = `${mk}-${pad(i)}`;
    const d = day(date);
    if (d && !d.skip) {
      for (const x of dayItems(d)) {
        litres += x.litres;
        amount += x.litres * x.rate;
        const b = byType[x.id] || (byType[x.id] = { id: x.id, name: x.name, emoji: x.emoji, litres: 0, amount: 0 });
        b.litres += x.litres;
        b.amount += x.litres * x.rate;
      }
      delivered++;
    } else if (d?.skip) skipped++;
    days.push({ date, d });
  }
  Object.values(byType).forEach((b) => { b.amount = Math.round(b.amount); });
  const billed = store.meta('milkBilled', {})[mk] || null;
  return { mk, days, litres, amount: Math.round(amount), delivered, skipped, billed, byType: Object.values(byType) };
}

// Milkman account, carried across months:
//   owed = every delivered day up to today (each type: litres × that day's rate)
//   paid = every spend in the Milk category (payments, older monthly bills, anything you gave him)
//   balance = owed − paid; "earlier" = what was still unpaid before this month (negative = paid ahead)
export function ledger(t = today()) {
  const mk = monthKey(t);
  const days = store.list('milk').filter((d) => !d.skip && d.id <= t);
  const owed = days.reduce((s, d) => s + dayCost(d), 0);
  const thisDays = days.filter((d) => d.id.startsWith(mk));
  const thisMonth = thisDays.reduce((s, d) => s + dayCost(d), 0);
  const payments = store.list('entries').filter((e) => e.cat === MILK_CAT && e.date <= t)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt - a.createdAt));
  const paid = payments.reduce((s, e) => s + Number(e.amount || 0), 0);
  return {
    owed: Math.round(owed), paid: Math.round(paid), balance: Math.round(owed - paid),
    thisMonth: Math.round(thisMonth), thisMonthLitres: thisDays.reduce((s, d) => s + dayLitres(d), 0),
    earlier: Math.round(owed - thisMonth - paid), payments,
  };
}

// Record money given to the milkman (full or part). It is a spend in the Milk category.
export async function pay(amount, date = today(), mode = 'Cash') {
  return addEntry({ date, amount, cat: MILK_CAT, mode, note: 'Paid milkman', source: 'milk-pay' });
}

// Older monthly "bill" entries (kept for old data; payments replaced this).
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
