// Budget maths. Month = 1st to last day of the calendar month (salary comes on the 1st).
import * as store from '../store.js';
import { today, monthKey, daysInMonth, diffDays, monthEnd, shiftMonth, monthShortName } from './format.js';

export const DEFAULT_CATS = [
  { id: 'milk', name: 'Milk', emoji: '🥛', limit: 8000 },
  { id: 'grocery', name: 'Groceries + veg', emoji: '🥬', limit: 8000 },
  { id: 'solar', name: 'Solar EMI', emoji: '☀️', limit: 5000 },
  { id: 'travel', name: 'Office travel', emoji: '🚌', limit: 5000 },
  { id: 'gas', name: 'Gas cylinder', emoji: '🔥', limit: 1100 },
  { id: 'wifi', name: 'WiFi + mobile + OTT', emoji: '📶', limit: 1500 },
  { id: 'misc', name: 'Home misc', emoji: '🏠', limit: 2500 },
  { id: 'family', name: 'Family cash', emoji: '👪', limit: 2000 },
  { id: 'cc', name: 'Credit card payoff', emoji: '💳', limit: 3000 },
  { id: 'festival', name: 'Festival fund', emoji: '🪔', limit: 1500 },
  { id: 'emergency', name: 'Emergency fund', emoji: '🛟', limit: 1500 },
  { id: 'buffer', name: 'Buffer', emoji: '🧺', limit: 900 },
];

export const DEFAULT_RECURRING = [
  { id: 'r-solar', cat: 'solar', amount: 5000, note: 'Solar EMI' },
  { id: 'r-wifi', cat: 'wifi', amount: 1500, note: 'WiFi + mobile + OTT' },
  { id: 'r-gas', cat: 'gas', amount: 1100, note: 'Gas cylinder' },
];

export const MODES = ['UPI', 'Cash', 'Card'];
export const SAVINGS_CATS = ['festival', 'emergency'];
export const CC_CAT = 'cc';
export const GROCERY_CAT = 'grocery';
export const MILK_CAT = 'milk';
export const DEFAULT_CC_START = 10000;

export function cats() {
  return store.meta('cats', DEFAULT_CATS);
}

export function cat(id) {
  return cats().find((c) => c.id === id) || { id, name: id, emoji: '•', limit: 0 };
}

export function recurring() {
  return store.meta('recurring', DEFAULT_RECURRING);
}

export function totalLimit() {
  return cats().reduce((s, c) => s + (Number(c.limit) || 0), 0);
}

export function entriesFor(mk) {
  return store.list('entries')
    .filter((e) => e.date?.startsWith(mk))
    .sort((a, b) => (b.date.localeCompare(a.date)) || (b.createdAt - a.createdAt));
}

export function spentByCat(mk) {
  const out = {};
  for (const e of entriesFor(mk)) out[e.cat] = (out[e.cat] || 0) + Number(e.amount || 0);
  return out;
}

// 'ok' | 'warn' (≥80%) | 'over' (>100%)
export function level(spent, limit) {
  if (!limit) return spent > 0 ? 'over' : 'ok';
  const p = spent / limit;
  if (p > 1) return 'over';
  if (p >= 0.8) return 'warn';
  return 'ok';
}

export function summary(mk = monthKey()) {
  const t = today();
  const limit = totalLimit();
  const by = spentByCat(mk);
  const spent = Object.values(by).reduce((s, v) => s + v, 0);
  const left = limit - spent;
  const isCurrent = mk === monthKey(t);
  const daysLeft = isCurrent ? diffDays(t, monthEnd(mk)) + 1 : (mk > monthKey(t) ? daysInMonth(mk) : 0);
  const safeDaily = daysLeft > 0 ? Math.max(0, left) / daysLeft : 0;
  const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([id, amount]) => ({ ...cat(id), amount }));
  return { mk, limit, spent, left, daysLeft, safeDaily, by, top };
}

// Recurring bills not yet confirmed or skipped this month.
export function pendingRecurring(mk = monthKey()) {
  const done = store.meta('recurringDone', {})[mk] || [];
  return recurring().filter((r) => !done.includes(r.id));
}

export async function markRecurring(mk, id) {
  const all = { ...store.meta('recurringDone', {}) };
  all[mk] = [...new Set([...(all[mk] || []), id])];
  await store.setMeta('recurringDone', all);
}

export async function confirmRecurring(r, mk = monthKey()) {
  const t = today();
  const date = monthKey(t) === mk ? t : `${mk}-01`;
  await addEntry({ date, amount: r.amount, cat: r.cat, mode: 'UPI', note: r.note, source: 'recurring', ref: r.id });
  await markRecurring(mk, r.id);
}

export async function addEntry({ id, date, amount, cat: c, mode, note, source, ref, by }) {
  const doc = { date: date || today(), amount: Math.round(Number(amount) * 100) / 100, cat: c, mode: mode || 'UPI', note: note || '' };
  if (id) doc.id = id;
  if (source) doc.source = source;
  if (ref) doc.ref = ref;
  if (by) doc.by = by;
  return store.put('entries', doc);
}

function sumCat(catId) {
  return store.list('entries').filter((e) => e.cat === catId).reduce((s, e) => s + Number(e.amount || 0), 0);
}

export function savings() {
  return SAVINGS_CATS.map((id) => ({ ...cat(id), total: sumCat(id) }));
}

export function creditCard() {
  const start = Number(store.meta('ccStart', DEFAULT_CC_START));
  const paid = sumCat(CC_CAT);
  return { start, paid, remaining: Math.max(0, start - paid), pct: start ? Math.min(1, paid / start) : 1 };
}

export function history(n = 6, endMk = monthKey()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const mk = shiftMonth(endMk, -i);
    const spent = entriesFor(mk).reduce((s, e) => s + Number(e.amount || 0), 0);
    out.push({ mk, label: monthShortName(mk), spent });
  }
  return out;
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function monthCsv(mk) {
  const rows = [['Date', 'Category', 'Amount (INR)', 'Mode', 'Note', 'Added by']];
  for (const e of [...entriesFor(mk)].reverse()) {
    rows.push([e.date, cat(e.cat).name, e.amount, e.mode, e.note, e.by]);
  }
  const s = summary(mk);
  rows.push([]);
  rows.push(['', 'Total spent', s.spent]);
  rows.push(['', 'Budget', s.limit]);
  rows.push(['', 'Left', s.left]);
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}
