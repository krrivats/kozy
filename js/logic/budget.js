// Budget maths. Month = 1st to last day of the calendar month (salary comes on the 1st).
import * as store from '../store.js';
import {
  today, monthKey, daysInMonth, diffDays, monthEnd, shiftMonth, monthShortName, addDays, parse, iso, pad,
} from './format.js';

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
  { id: 'bills', name: 'Other bills', emoji: '🧾', limit: 0 }, // 0 = no monthly limit (yearly / quarterly bills)
];

// How often a bill repeats.
export const FREQS = {
  monthly: { label: 'Monthly', months: 1 },
  '2m': { label: 'Every 2 months', months: 2 },
  quarterly: { label: 'Quarterly', months: 3 },
  half: { label: 'Every 6 months', months: 6 },
  yearly: { label: 'Yearly', months: 12 },
  days: { label: 'Every N days' },
};

// The first three are your monthly bills. The rest are paused examples: set amount + due date to turn them on.
export const DEFAULT_BILLS = [
  { id: 'b-solar', name: 'Solar EMI', emoji: '☀️', cat: 'solar', amount: 5000, freq: 'monthly', remind: 3, active: true },
  { id: 'b-wifi', name: 'WiFi + mobile + OTT', emoji: '📶', cat: 'wifi', amount: 1500, freq: 'monthly', remind: 3, active: true },
  { id: 'b-gas', name: 'Gas cylinder', emoji: '🔥', cat: 'gas', amount: 1100, freq: 'monthly', remind: 3, active: true },
  { id: 'b-elec', name: 'Electricity', emoji: '💡', cat: 'bills', amount: 0, freq: '2m', remind: 5, active: false },
  { id: 'b-recharge', name: 'Mobile recharge', emoji: '📱', cat: 'wifi', amount: 0, freq: 'days', everyDays: 84, remind: 3, active: false },
  { id: 'b-lic', name: 'LIC premium', emoji: '🛡️', cat: 'bills', amount: 0, freq: 'yearly', remind: 15, active: false },
  { id: 'b-vehicle', name: 'Vehicle insurance', emoji: '🏍️', cat: 'bills', amount: 0, freq: 'yearly', remind: 15, active: false },
  { id: 'b-school', name: 'School fees', emoji: '🎒', cat: 'bills', amount: 0, freq: 'quarterly', remind: 7, active: false },
  { id: 'b-ptax', name: 'Property tax', emoji: '🏛️', cat: 'bills', amount: 0, freq: 'yearly', remind: 15, active: false },
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

// 'ok' | 'warn' (≥80%) | 'over' (>100%) | 'none' (no limit set)
export function level(spent, limit) {
  if (!limit) return 'none';
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

// Who spent what this month: { Me: 12000, Wife: 3400 }
export function byPerson(mk = monthKey()) {
  const out = {};
  for (const e of entriesFor(mk)) {
    const who = e.by || 'Me';
    out[who] = (out[who] || 0) + Number(e.amount || 0);
  }
  return out;
}

export async function addEntry({ id, date, amount, cat: c, mode, note, source, ref, by }) {
  const doc = { date: date || today(), amount: Math.round(Number(amount) * 100) / 100, cat: c, mode: mode || 'UPI', note: note || '' };
  if (id) doc.id = id;
  if (source) doc.source = source;
  if (ref) doc.ref = ref;
  if (by) doc.by = by;
  return store.put('entries', doc);
}

function sumCat(catId, from = '') {
  return store.list('entries').filter((e) => e.cat === catId && e.date >= from).reduce((s, e) => s + Number(e.amount || 0), 0);
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

// ---------- Bills (any repeat) ----------
export function bills() {
  return store.meta('bills', DEFAULT_BILLS);
}

function addMonths(date, n) {
  const d = parse(date);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, last));
  return iso(target);
}

export function advance(date, bill) {
  if (bill.freq === 'days') return addDays(date, Number(bill.everyDays) || 30);
  return addMonths(date, FREQS[bill.freq]?.months || 1);
}

export function nextDue(bill) {
  const st = store.meta('billState', {})[bill.id];
  return st?.due || bill.firstDue || `${monthKey()}-01`;
}

// Active bills that are due within their reminder window (or overdue), soonest first.
export function dueBills(t = today()) {
  return bills()
    .filter((b) => b.active)
    .map((b) => ({ ...b, due: nextDue(b) }))
    .filter((b) => b.due <= addDays(t, Number(b.remind ?? 3)))
    .map((b) => ({ ...b, daysTo: diffDays(t, b.due) }))
    .sort((a, b) => a.due.localeCompare(b.due));
}

async function setBillState(id, patch) {
  const all = { ...store.meta('billState', {}) };
  all[id] = { ...(all[id] || {}), ...patch };
  await store.setMeta('billState', all);
}

export async function payBill(bill, amount = bill.amount) {
  const t = today();
  const due = nextDue(bill);
  await addEntry({ date: t, amount, cat: bill.cat, mode: 'UPI', note: bill.name, source: 'bill', ref: bill.id });
  await setBillState(bill.id, { due: advance(due, bill), lastPaid: t });
}

export async function skipBill(bill) {
  await setBillState(bill.id, { due: advance(nextDue(bill), bill), lastSkipped: today() });
}

// Owner, on start: save bills the first time (moving over the old monthly "recurring" list), add new categories.
export async function ensureBills() {
  if (!store.isOwner()) return;
  const cs = store.meta('cats', null);
  if (cs && !cs.some((c) => c.id === 'bills')) await store.setMeta('cats', [...cs, DEFAULT_CATS.find((c) => c.id === 'bills')]);
  if (store.meta('bills', null)) return;
  const mk = monthKey();
  const old = store.meta('recurring', null);
  const list = DEFAULT_BILLS.map((b) => ({ ...b, firstDue: `${mk}-01` }));
  if (old) {
    for (const r of old) {
      const id = { 'r-solar': 'b-solar', 'r-wifi': 'b-wifi', 'r-gas': 'b-gas' }[r.id] || `b-${r.id}`;
      const b = list.find((x) => x.id === id);
      if (b) Object.assign(b, { amount: r.amount, cat: r.cat, name: r.note });
      else list.push({ id, name: r.note, emoji: '🔁', cat: r.cat, amount: r.amount, freq: 'monthly', remind: 3, active: true, firstDue: `${mk}-01` });
    }
  }
  await store.setMeta('bills', list);
  const done = store.meta('recurringDone', {})[mk] || [];
  const state = { ...store.meta('billState', {}) };
  for (const rid of done) {
    const id = { 'r-solar': 'b-solar', 'r-wifi': 'b-wifi', 'r-gas': 'b-gas' }[rid] || `b-${rid}`;
    state[id] = { due: `${shiftMonth(mk, 1)}-01` };
  }
  await store.setMeta('billState', state);
}

// ---------- Goals ----------
// {id, name, emoji, target, by:'YYYY-MM-DD', cat, start:'YYYY-MM-DD'} — saved = spends in that category since start.
export function goals() {
  return store.meta('goals', []).map((g) => {
    const saved = sumCat(g.cat, g.start || '');
    const pct = g.target ? Math.min(1, saved / g.target) : 0;
    const daysLeft = g.by ? diffDays(today(), g.by) : null;
    return { ...g, saved, pct, daysLeft, left: Math.max(0, g.target - saved) };
  });
}

// ---------- Monthly summary ----------
export function monthSummary(mk = monthKey()) {
  const cur = summary(mk);
  const prevMk = shiftMonth(mk, -1);
  const prev = spentByCat(prevMk);
  const prevTotal = Object.values(prev).reduce((s, v) => s + v, 0);
  const rows = cats().map((c) => ({ ...c, spent: cur.by[c.id] || 0, prev: prev[c.id] || 0 }))
    .map((r) => ({ ...r, diff: r.spent - r.prev }))
    .filter((r) => r.spent || r.prev)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  const list = entriesFor(mk);
  const biggest = [...list].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const saved = SAVINGS_CATS.reduce((s, id) => s + (cur.by[id] || 0), 0);
  return { ...cur, prevMk, prevTotal, change: cur.spent - prevTotal, rows, people: byPerson(mk), biggest, saved, count: list.length };
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

export { pad };
