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
  // Salary-day checklist: money you move every month on the 1st (shown together on Home, one tap each)
  ...checklistDefaults(),
];

function checklistDefaults() {
  return [
    { id: 'c-festival', group: 'checklist', name: 'Festival saving', emoji: '🪔', cat: 'festival', amount: 1500, freq: 'monthly', remind: 0, active: true },
    { id: 'c-emergency', group: 'checklist', name: 'Emergency saving', emoji: '🛟', cat: 'emergency', amount: 1500, freq: 'monthly', remind: 0, active: true },
    { id: 'c-card', group: 'checklist', name: 'Credit card payment', emoji: '💳', cat: 'cc', amount: 3000, freq: 'monthly', remind: 0, active: true },
  ];
}

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

// Your monthly budget (Settings → Budget). If not set, it is the sum of the category limits.
export function budgetTotal() {
  const v = Number(store.meta('budgetTotal', 0));
  return v > 0 ? v : totalLimit();
}

// How much of the budget is given to categories, and how much is still free to assign.
export function allocation() {
  const total = budgetTotal();
  const alloc = totalLimit();
  return { total, alloc, left: total - alloc };
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
  const limit = budgetTotal();
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
  const mk = monthKey();
  if (store.meta('bills', null)) {
    // v1.2: add the salary-day checklist once, for people who already had bills
    if (!store.meta('checklistSeeded')) {
      const have = bills();
      const add = checklistDefaults().filter((c) => !have.some((b) => b.id === c.id)).map((c) => ({ ...c, firstDue: `${mk}-01` }));
      await store.setMeta('bills', [...have, ...add]);
      const st = { ...store.meta('billState', {}) };
      for (const c of add) if (entriesFor(mk).some((e) => e.cat === c.cat)) st[c.id] = { due: `${shiftMonth(mk, 1)}-01` };
      await store.setMeta('billState', st);
      await store.setMeta('checklistSeeded', true);
    }
    return;
  }
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
  await store.setMeta('checklistSeeded', true);
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

// ---------- Family spends (names found in notes) ----------
export const DEFAULT_FAMILY = ['Maa', 'Papa', 'Dadi', 'Dada', 'Bhaiya', 'Didi', 'Kids'];

export function familyNames() {
  return store.meta('family', DEFAULT_FAMILY);
}

// Does the note mention this name as a whole word? ("papa" yes, "papaya" no). Hindi names: plain match.
export function mentionsName(note, name) {
  const n = String(name || '').trim().toLowerCase();
  const text = String(note || '').toLowerCase();
  if (!n) return false;
  if (!/^[a-z0-9 ]+$/.test(n)) return text.includes(n);
  return text.split(/[^a-z0-9]+/).includes(n) || (n.includes(' ') && text.includes(n));
}

// { name, total, count, entries } for every family name written in a spend's note this month.
export function familySpends(mk = monthKey()) {
  const list = entriesFor(mk);
  return familyNames().map((name) => {
    const es = list.filter((e) => mentionsName(e.note, name));
    return { name, total: es.reduce((s, e) => s + Number(e.amount || 0), 0), count: es.length, entries: es };
  }).filter((f) => f.count).sort((a, b) => b.total - a.total);
}

// ---------- Usual spend + insights ----------
// Average of the last n months before mk that have any spends (category catId, or all when null).
export function usual(catId, mk = monthKey(), n = 3) {
  const vals = [];
  for (let i = 1; i <= 12 && vals.length < n; i++) {
    const es = entriesFor(shiftMonth(mk, -i));
    if (!es.length) continue;
    vals.push(es.filter((e) => !catId || e.cat === catId).reduce((s, e) => s + Number(e.amount || 0), 0));
  }
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
}

const FIXED_SOURCES = ['bill', 'recurring', 'milk'];

function fmt(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.round(n));
}

// Plain-English lines: pace for the month, categories above/below usual, usual monthly total.
export function insights(mk = monthKey()) {
  const t = today();
  const s = summary(mk);
  const out = [];
  const dim = daysInMonth(mk);
  const isCur = mk === monthKey(t);
  const day = isCur ? Number(t.slice(8, 10)) : dim;
  const frac = day / dim;
  const list = entriesFor(mk);
  const fixed = list.filter((e) => FIXED_SOURCES.includes(e.source)).reduce((a, e) => a + Number(e.amount), 0);
  const variable = s.spent - fixed;
  const usualTotal = usual(null, mk);

  if (isCur && day >= 5 && day < dim) {
    const proj = Math.round(fixed + (variable / day) * dim);
    out.push({ id: 'pace', level: proj > s.limit ? 'over' : proj > s.limit * 0.95 ? 'warn' : 'ok', amount: proj,
      text: `At this pace you will spend about ${fmt(proj)} this month (budget ${fmt(s.limit)}).` });
  }
  const rows = cats().map((c) => {
    const u = usual(c.id, mk);
    const spent = s.by[c.id] || 0;
    const fixedCat = list.some((e) => e.cat === c.id && FIXED_SOURCES.includes(e.source));
    const expected = fixedCat ? u : u * frac; // compare with "usual by this day"
    return { c, u, spent, expected, diff: spent - expected };
  }).filter((r) => r.u > 0 && Math.abs(r.diff) >= 300 && Math.abs(r.diff) / Math.max(r.expected, 1) >= 0.15);
  for (const r of rows.filter((x) => x.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 2)) {
    out.push({ id: `up-${r.c.id}`, level: 'warn', cat: r.c.id,
      text: `${r.c.emoji} ${r.c.name}: ${fmt(r.spent)} so far, usually ${fmt(r.expected)} by now (+${Math.round((r.diff / Math.max(r.expected, 1)) * 100)}%).` });
  }
  for (const r of rows.filter((x) => x.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 1)) {
    out.push({ id: `down-${r.c.id}`, level: 'ok', cat: r.c.id, text: `${r.c.emoji} ${r.c.name}: ${fmt(-r.diff)} below your usual so far.` });
  }
  if (usualTotal) out.push({ id: 'usual', level: 'info', text: `You usually spend ${fmt(usualTotal)} a month (last 3 months).` });
  return out;
}

// ---------- Year view (Indian financial year, April–March) ----------
export function fyOf(date = today()) {
  const [y, m] = date.split('-').map(Number);
  return m >= 4 ? y : y - 1;
}

export function yearSummary(fy = fyOf()) {
  const t = monthKey();
  const months = Array.from({ length: 12 }, (_, i) => {
    const mk = shiftMonth(`${fy}-04`, i);
    const spent = entriesFor(mk).reduce((s, e) => s + Number(e.amount || 0), 0);
    return { mk, label: monthShortName(mk), spent, future: mk > t };
  });
  const total = months.reduce((s, m) => s + m.spent, 0);
  const counted = months.filter((m) => !m.future && m.spent > 0).length || 1;
  const byCat = {};
  for (const m of months) for (const [id, v] of Object.entries(spentByCat(m.mk))) byCat[id] = (byCat[id] || 0) + v;
  const catRows = Object.entries(byCat).map(([id, v]) => ({ ...cat(id), total: v, avg: v / counted })).sort((a, b) => b.total - a.total);
  const highest = [...months].sort((a, b) => b.spent - a.spent)[0];
  return { fy, label: `FY ${fy}–${String(fy + 1).slice(2)}`, months, total, avg: total / counted, counted, catRows, highest, budget: budgetTotal() };
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
  return { ...cur, prevMk, prevTotal, change: cur.spent - prevTotal, rows, people: byPerson(mk), biggest, saved, count: list.length, family: familySpends(mk) };
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

