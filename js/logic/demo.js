// "Load demo data": about 3 months of realistic sample data ending today,
// so every screen has something to show. Replaces all current data.
import * as store from '../store.js';
import { today, addDays, monthKey, shiftMonth, daysInMonth, pad, parse } from './format.js';
import { DEFAULT_CATS, DEFAULT_BILLS, DEFAULT_CC_START } from './budget.js';
import { DEFAULT_ITEMS, DEFAULT_VEG } from './stock.js';
import { DEFAULT_MILK } from './milk.js';

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// [item id, pack qty, price, days a pack lasts]
const PACKS = {
  atta: [10, 420, 11], rice: [5, 380, 14], dal: [2, 290, 13], oil: [2, 330, 19], ghee: [1, 620, 28],
  sugar: [2, 92, 12], tea: [500, 270, 20], salt: [1, 28, 40], spices: [1, 150, 30], besan: [1, 95, 24],
  maida: [1, 45, 45], suji: [1, 48, 38], poha: [1, 70, 26], soap: [4, 160, 21], detergent: [2, 230, 25],
  toothpaste: [2, 190, 30], shampoo: [1, 199, 34],
};
// These are left "finished" (not bought again) so the shopping list has something in it.
const LEAVE_FINISHED = ['poha', 'besan'];
// Sabzi: [veg id, usual qty, usual ₹ per unit]
const VEG = [['onion', 2, 40], ['potato', 3, 25], ['tomato', 2, 35], ['chilli', 0.25, 80], ['coriander', 1, 10],
  ['cauliflower', 1, 40], ['okra', 1, 50], ['spinach', 1, 30], ['lauki', 1, 30], ['banana', 1, 60], ['apple', 1, 140], ['peas', 1, 80]];

export function buildDemo(t = today()) {
  const r = rng(20261017);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const who = () => (r() < 0.55 ? 'Me' : 'Wife');
  let n = 0;
  const id = (p) => `demo-${p}-${(n++).toString(36)}`;
  const at = (date) => parse(date).getTime() + 9 * 3600000 + n * 1000;

  const entries = [];
  const stock = [];
  const milk = [];
  const entry = (date, cat, amount, note, mode = 'UPI', extra = {}) => {
    const e = { id: id('e'), date, cat, amount, note, mode, by: who(), createdAt: at(date), updatedAt: at(date), ...extra };
    entries.push(e);
    return e;
  };

  const mkNow = monthKey(t);
  const months = [shiftMonth(mkNow, -2), shiftMonth(mkNow, -1), mkNow];
  const start = `${months[0]}-01`;
  const billState = {};
  const milkBilled = {};
  const vegById = Object.fromEntries(DEFAULT_VEG.map((v) => [v.id.replace('veg-', ''), v]));
  const buyVeg = (date, key, qtyBase, rateBase) => {
    const v = vegById[key];
    const qty = qtyBase * pick([1, 1, 1.5, 2]);
    const rate = Math.round(rateBase * (0.8 + r() * 0.5));
    const price = Math.max(5, Math.round(rate * qty));
    const e = entry(date, 'grocery', price, `${v.emoji} ${v.en} / ${v.hi} ${qty} ${v.unit} @ ₹${Math.round(price / qty)}/${v.unit}`, pick(['UPI', 'Cash']), { source: 'stock' });
    stock.push({ id: id('s'), itemId: v.id, type: 'bought', date, qty, unit: v.unit, entryId: e.id, by: e.by, createdAt: e.createdAt, updatedAt: e.createdAt });
  };

  for (const mk of months) {
    const last = mk === mkNow ? Number(t.slice(8, 10)) : daysInMonth(mk);
    const d = (day) => `${mk}-${pad(day)}`;
    const has = (day) => day <= last;

    // Monthly bills
    if (has(1)) entry(d(1), 'solar', 5000, 'Solar EMI', 'UPI', { source: 'bill', ref: 'b-solar' });
    if (has(2)) entry(d(2), 'wifi', 1500, 'WiFi + mobile + OTT', 'UPI', { source: 'bill', ref: 'b-wifi' });
    if (has(9)) entry(d(9), 'gas', 1100, 'Gas cylinder', 'Cash', { source: 'bill', ref: 'b-gas' });
    if (mk === mkNow) {
      const next = `${shiftMonth(mk, 1)}-01`;
      billState['b-solar'] = { due: has(1) ? next : d(1) };
      billState['b-wifi'] = { due: has(2) ? next : d(1) };
      billState['b-gas'] = { due: has(9) ? next : d(1) };
    }

    for (let day = 1; day <= last; day++) {
      const date = d(day);
      const dow = parse(date).getDay();
      // Office travel on weekdays
      if (dow >= 1 && dow <= 5) entry(date, 'travel', pick([180, 200, 220, 240]), pick(['Bus + auto', 'Auto', 'Bus to office']), pick(['UPI', 'Cash']));
      // Sabzi every ~2 days: 3 items, prices go up and down a little
      if (day % 2 === 0) {
        const picks = new Set([0, 1, 2].map(() => Math.floor(r() * VEG.length)));
        if (day % 6 === 0) picks.add(0); // onion often
        for (const i of picks) buyVeg(date, ...VEG[i]);
      }
      // Milk: 4 L most days, skip a couple, 5 L on a guest day
      const skip = day === 7 || day === 21;
      const litres = day === 12 ? 5 : 4;
      const isToday = date === t;
      if (!isToday) milk.push({ id: date, litres: skip ? 0 : litres, rate: 60, skip, by: who(), createdAt: at(date), updatedAt: at(date) });
    }

    if (has(5)) entry(d(5), 'cc', 3000, 'Credit card payment', 'UPI');
    if (has(3)) entry(d(3), 'family', 1000, 'Cash for Maa', 'Cash');
    if (has(15)) entry(d(15), 'family', 800, 'Kids pocket money', 'Cash');
    if (has(6)) entry(d(6), 'festival', 1500, 'Festival saving', 'UPI');
    if (has(6)) entry(d(6), 'emergency', 1500, 'Emergency saving', 'UPI');
    if (has(4)) entry(d(4), 'misc', 650, 'Bulbs + extension board', 'UPI');
    if (has(11)) entry(d(11), 'misc', 1200, 'Plumber — kitchen tap', 'Cash');
    if (has(14)) entry(d(14), 'misc', mk === mkNow ? 1100 : 380, mk === mkNow ? 'Mixer repair' : 'Cleaning stuff', 'UPI');
    if (has(13)) entry(d(13), 'buffer', 450, 'Medicine', 'UPI');

    if (mk !== mkNow) {
      const total = milk.filter((m) => m.id.startsWith(mk) && !m.skip).reduce((s, m) => s + m.litres * m.rate, 0);
      milkBilled[mk] = entry(d(daysInMonth(mk)), 'milk', total, `Milk bill ${mk}`, 'Cash', { source: 'milk' }).id;
    }
  }

  // Kitchen stock history
  for (const item of DEFAULT_ITEMS) {
    const key = item.id.replace('item-', '');
    const [qty, price, lasts] = PACKS[key];
    let b = addDays(start, Math.floor(r() * lasts));
    let guard = 0;
    while (b <= t && guard++ < 40) {
      const ev = { id: id('s'), itemId: item.id, type: 'bought', date: b, qty, unit: item.unit, by: who(), createdAt: at(b), updatedAt: at(b) };
      if (b >= start) {
        ev.entryId = entry(b, 'grocery', price, `${item.en} / ${item.hi} ${qty} ${item.unit}`, 'UPI', { source: 'stock' }).id;
      }
      stock.push(ev);
      const end = addDays(b, Math.round(lasts * (0.85 + r() * 0.3)));
      if (end > t) break;
      stock.push({ id: id('s'), itemId: item.id, type: 'finished', date: end, by: who(), createdAt: at(end) + 1, updatedAt: at(end) + 1 });
      if (LEAVE_FINISHED.includes(key) && addDays(end, lasts) > t) break;
      b = end;
    }
  }

  // Today the wife bought besan (shows in "Bought today" and the activity feed).
  const besan = entry(t, 'grocery', 95, 'Besan / बेसन 1 kg', 'Cash', { source: 'stock', by: 'Wife' });
  stock.push({ id: id('s'), itemId: 'item-besan', type: 'bought', date: t, qty: 1, unit: 'kg', lastsDays: 21, note: 'Rajdhani 1 kg', entryId: besan.id, by: 'Wife', createdAt: Date.now() - 20 * 60000, updatedAt: Date.now() - 20 * 60000 });

  const bills = DEFAULT_BILLS.map((b) => ({ ...b, firstDue: `${mkNow}-01` }));
  const lic = bills.find((b) => b.id === 'b-lic');
  Object.assign(lic, { active: true, amount: 12400, firstDue: addDays(t, 9) });
  const goals = [{ id: 'g-diwali', name: 'Diwali', emoji: '🪔', target: 6000, by: addDays(t, 22), cat: 'festival', start }];

  const meta = [
    { id: 'cats', value: DEFAULT_CATS },
    { id: 'bills', value: bills },
    { id: 'billState', value: billState },
    { id: 'goals', value: goals },
    { id: 'vegSeeded', value: true },
    { id: 'milkBilled', value: milkBilled },
    { id: 'milkSettings', value: { ...DEFAULT_MILK, asked: true } },
    { id: 'ccStart', value: DEFAULT_CC_START },
    { id: 'itemsSeeded', value: true },
    { id: 'demo', value: true },
  ].map((m) => ({ ...m, by: 'Me', createdAt: Date.now(), updatedAt: Date.now() }));

  const notes = { 'item-atta': 'Aashirvaad 10 kg bag', 'item-oil': 'Fortune mustard oil' };
  const need = ['veg-tomato', 'veg-coriander'];
  const items = [...DEFAULT_ITEMS, ...DEFAULT_VEG].map((it) => ({
    ...it, ...(notes[it.id] ? { note: notes[it.id] } : {}), ...(need.includes(it.id) ? { need: true } : {}),
    ...(it.id === 'item-salt' ? { lowDays: 3 } : {}), by: 'Me', createdAt: Date.now(), updatedAt: Date.now(),
  }));
  return { app: 'kozy', version: 2, entries, items, stock, milk, meta };
}

export async function loadDemo() {
  await store.importAll(buildDemo());
}
