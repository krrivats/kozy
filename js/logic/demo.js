// "Load demo data": about 3 months of realistic sample data ending today,
// so every screen has something to show. Replaces all current data.
import * as store from '../store.js';
import { today, addDays, monthKey, shiftMonth, daysInMonth, pad, parse } from './format.js';
import { DEFAULT_CATS, DEFAULT_RECURRING, DEFAULT_CC_START } from './budget.js';
import { DEFAULT_ITEMS } from './stock.js';
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
  const recurringDone = {};
  const milkBilled = {};

  for (const mk of months) {
    const last = mk === mkNow ? Number(t.slice(8, 10)) : daysInMonth(mk);
    const d = (day) => `${mk}-${pad(day)}`;
    const has = (day) => day <= last;

    // Recurring bills
    if (has(1)) entry(d(1), 'solar', 5000, 'Solar EMI', 'UPI', { source: 'recurring', ref: 'r-solar' });
    if (has(2)) entry(d(2), 'wifi', 1500, 'WiFi + mobile + OTT', 'UPI', { source: 'recurring', ref: 'r-wifi' });
    if (has(9)) entry(d(9), 'gas', 1100, 'Gas cylinder', 'Cash', { source: 'recurring', ref: 'r-gas' });
    recurringDone[mk] = ['r-solar', 'r-wifi', ...(has(9) ? ['r-gas'] : [])];

    for (let day = 1; day <= last; day++) {
      const date = d(day);
      const dow = parse(date).getDay();
      // Office travel on weekdays
      if (dow >= 1 && dow <= 5) entry(date, 'travel', pick([180, 200, 220, 240]), pick(['Bus + auto', 'Auto', 'Bus to office']), pick(['UPI', 'Cash']));
      // Vegetables every ~2 days
      if (day % 2 === 0) entry(date, 'grocery', pick([120, 160, 180, 220, 260]), pick(['Sabzi', 'Sabzi + fruits', 'Tamatar, pyaz', 'Fruits']), pick(['UPI', 'Cash']));
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
      const ev = { id: id('s'), itemId: item.id, type: 'bought', date: b, qty, unit: item.unit, price, by: who(), createdAt: at(b), updatedAt: at(b) };
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

  const meta = [
    { id: 'cats', value: DEFAULT_CATS },
    { id: 'recurring', value: DEFAULT_RECURRING },
    { id: 'recurringDone', value: recurringDone },
    { id: 'milkBilled', value: milkBilled },
    { id: 'milkSettings', value: { ...DEFAULT_MILK, asked: true } },
    { id: 'ccStart', value: DEFAULT_CC_START },
    { id: 'itemsSeeded', value: true },
    { id: 'demo', value: true },
  ].map((m) => ({ ...m, by: 'Me', createdAt: Date.now(), updatedAt: Date.now() }));

  const items = DEFAULT_ITEMS.map((it) => ({ ...it, by: 'Me', createdAt: Date.now(), updatedAt: Date.now() }));
  return { app: 'kozy', version: 1, entries, items, stock, milk, meta };
}

export async function loadDemo() {
  await store.importAll(buildDemo());
}
