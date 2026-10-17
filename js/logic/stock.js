// Kitchen stock maths. Only two user actions exist: Bought (qty, unit, price) and Finished (one tap).
// A "pack" = a Bought followed by the next Finished. From packs we learn how fast each item is used.
import * as store from '../store.js';
import { today, addDays, diffDays } from './format.js';
import { addEntry, GROCERY_CAT } from './budget.js';

export const LOW_DAYS = 7;

export const DEFAULT_ITEMS = [
  ['atta', 'Atta', 'आटा', 'kg', 'Kitchen'],
  ['rice', 'Rice', 'चावल', 'kg', 'Kitchen'],
  ['dal', 'Dal', 'दाल', 'kg', 'Kitchen'],
  ['oil', 'Oil', 'तेल', 'L', 'Kitchen'],
  ['ghee', 'Ghee', 'घी', 'kg', 'Kitchen'],
  ['sugar', 'Sugar', 'चीनी', 'kg', 'Kitchen'],
  ['tea', 'Tea', 'चाय', 'g', 'Kitchen'],
  ['salt', 'Salt', 'नमक', 'kg', 'Kitchen'],
  ['spices', 'Spices', 'मसाले', 'pack', 'Kitchen'],
  ['besan', 'Besan', 'बेसन', 'kg', 'Kitchen'],
  ['maida', 'Maida', 'मैदा', 'kg', 'Kitchen'],
  ['suji', 'Suji', 'सूजी', 'kg', 'Kitchen'],
  ['poha', 'Poha', 'पोहा', 'kg', 'Kitchen'],
  ['soap', 'Soap', 'साबुन', 'pcs', 'Cleaning'],
  ['detergent', 'Detergent', 'डिटर्जेंट', 'kg', 'Cleaning'],
  ['toothpaste', 'Toothpaste', 'टूथपेस्ट', 'pcs', 'Personal'],
  ['shampoo', 'Shampoo', 'शैम्पू', 'bottle', 'Personal'],
].map(([id, en, hi, unit, cat], i) => ({ id: `item-${id}`, en, hi, unit, cat, order: i }));

export const UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'pack', 'bottle'];
export const ITEM_CATS = ['Kitchen', 'Cleaning', 'Personal', 'Other'];

export async function ensureItems() {
  if (store.meta('itemsSeeded')) return;
  for (const it of DEFAULT_ITEMS) await store.put('items', it);
  await store.setMeta('itemsSeeded', true);
}

export function items() {
  return store.list('items').sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.en.localeCompare(b.en));
}

export function eventsFor(itemId) {
  return store.list('stock').filter((e) => e.itemId === itemId)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt - b.createdAt));
}

// Turn the event list into packs + a current open pack.
export function analyze(item, t = today()) {
  const evs = eventsFor(item.id);
  const packs = [];
  let open = null;
  for (const e of evs) {
    if (e.type === 'bought') {
      if (open) { // bought again before finishing = top-up
        open = { ...open, qty: open.qty + Number(e.qty || 0), price: open.price + Number(e.price || 0) };
      } else {
        open = { date: e.date, qty: Number(e.qty || 0), price: Number(e.price || 0), unit: e.unit || item.unit };
      }
    } else if (e.type === 'finished' && open) {
      packs.push({ ...open, end: e.date, days: Math.max(1, diffDays(open.date, e.date)) });
      open = null;
    }
  }

  const usable = packs.filter((p) => p.qty > 0);
  const dailyUse = usable.length ? usable.reduce((s, p) => s + p.qty / p.days, 0) / usable.length : null;
  const avgDays = packs.length ? packs.reduce((s, p) => s + p.days, 0) / packs.length : null;

  let runout = null;
  let daysLeft = null;
  if (open) {
    let lastFor = null;
    if (dailyUse && open.qty) lastFor = open.qty / dailyUse;
    else if (avgDays) lastFor = avgDays;
    if (lastFor != null) {
      runout = addDays(open.date, lastFor);
      daysLeft = Math.max(0, diffDays(t, runout));
    }
  }

  let status = 'none'; // never tracked
  if (evs.length) {
    if (!open) status = 'finished';
    else if (daysLeft != null && daysLeft <= LOW_DAYS) status = 'low';
    else status = 'ok';
  }

  const priced = packs.filter((p) => p.price > 0);
  let monthlyCost = null;
  if (priced.length) {
    monthlyCost = (priced.reduce((s, p) => s + p.price / p.days, 0) / priced.length) * 30;
  } else {
    const from = addDays(t, -30);
    const recent = evs.filter((e) => e.type === 'bought' && e.date >= from);
    if (recent.length) monthlyCost = recent.reduce((s, e) => s + Number(e.price || 0), 0);
  }

  const lastBought = [...evs].reverse().find((e) => e.type === 'bought') || null;
  return {
    item, events: evs, packs, open, status, runout, daysLeft,
    avgDays, perWeek: dailyUse != null ? dailyUse * 7 : null, monthlyCost, lastBought,
  };
}

export function allAnalyzed() {
  const t = today();
  return items().map((it) => analyze(it, t));
}

export function shoppingList() {
  return allAnalyzed().filter((a) => a.status === 'finished' || a.status === 'low')
    .sort((a, b) => (a.status === 'finished' ? -1 : 0) - (b.status === 'finished' ? -1 : 0) || (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
}

export function shoppingText(list = shoppingList()) {
  const lines = list.map((a) => {
    const last = a.lastBought ? ` (last: ${a.lastBought.qty} ${a.lastBought.unit || a.item.unit})` : '';
    const why = a.status === 'finished' ? 'finished' : a.daysLeft === 0 ? 'runs out today' : `~${a.daysLeft} days left`;
    return `• ${a.item.en} / ${a.item.hi}${last} — ${why}`;
  });
  return `🛒 Kozy shopping list\n${lines.join('\n')}`;
}

// Every Bought also adds a spend in Groceries + veg (if a price was given).
export async function bought(item, { qty, unit, price, date }) {
  const d = date || today();
  let entryId;
  if (Number(price) > 0) {
    const entry = await addEntry({
      date: d, amount: price, cat: GROCERY_CAT, mode: 'UPI',
      note: `${item.en} / ${item.hi} ${qty} ${unit}`, source: 'stock',
    });
    entryId = entry.id;
  }
  return store.put('stock', {
    itemId: item.id, type: 'bought', date: d, qty: Number(qty) || 0, unit: unit || item.unit,
    price: Number(price) || 0, ...(entryId ? { entryId } : {}),
  });
}

export async function finished(item, date) {
  return store.put('stock', { itemId: item.id, type: 'finished', date: date || today() });
}

export async function removeEvent(ev) {
  if (ev.entryId) await store.remove('entries', ev.entryId);
  await store.remove('stock', ev.id);
}

export async function removeItem(item) {
  for (const ev of eventsFor(item.id)) await store.remove('stock', ev.id);
  await store.remove('items', item.id);
}
