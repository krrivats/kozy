// Kitchen stock + sabzi maths.
// Kitchen items: Bought (qty, lasts-about, price, remark) and Finished (one tap) → countdown to run-out.
// Sabzi items (kind 'veg'): just Bought with ₹/kg → price history (up / down vs last time).
// A purchase's price lives in its linked spend entry (Groceries + veg).
import * as store from '../store.js';
import { today, addDays, diffDays } from './format.js';
import { addEntry, GROCERY_CAT } from './budget.js';

export const LOW_DAYS = 7;

// [id, en, hi, unit, cat, aliases]
export const DEFAULT_ITEMS = [
  ['atta', 'Atta', 'आटा', 'kg', 'Kitchen', 'flour wheat gehu'],
  ['rice', 'Rice', 'चावल', 'kg', 'Kitchen', 'chawal basmati'],
  ['dal', 'Dal', 'दाल', 'kg', 'Kitchen', 'daal lentil'],
  ['oil', 'Oil', 'तेल', 'L', 'Kitchen', 'tel sarso mustard refined'],
  ['ghee', 'Ghee', 'घी', 'kg', 'Kitchen', 'desi'],
  ['sugar', 'Sugar', 'चीनी', 'kg', 'Kitchen', 'cheeni chini shakkar'],
  ['tea', 'Tea', 'चाय', 'g', 'Kitchen', 'chai patti'],
  ['salt', 'Salt', 'नमक', 'kg', 'Kitchen', 'namak'],
  ['spices', 'Spices', 'मसाले', 'pack', 'Kitchen', 'masala masale haldi mirch'],
  ['besan', 'Besan', 'बेसन', 'kg', 'Kitchen', 'gram flour'],
  ['maida', 'Maida', 'मैदा', 'kg', 'Kitchen', 'flour'],
  ['suji', 'Suji', 'सूजी', 'kg', 'Kitchen', 'sooji rava semolina'],
  ['poha', 'Poha', 'पोहा', 'kg', 'Kitchen', 'chiwda'],
  ['soap', 'Soap', 'साबुन', 'pcs', 'Cleaning', 'sabun'],
  ['detergent', 'Detergent', 'डिटर्जेंट', 'kg', 'Cleaning', 'surf washing powder'],
  ['toothpaste', 'Toothpaste', 'टूथपेस्ट', 'pcs', 'Personal', 'paste colgate'],
  ['shampoo', 'Shampoo', 'शैम्पू', 'bottle', 'Personal', ''],
].map(([id, en, hi, unit, cat, alias], i) => ({ id: `item-${id}`, kind: 'kitchen', en, hi, unit, cat, alias, order: i }));

// [id, en, hi, emoji, unit, cat, aliases]
export const DEFAULT_VEG = [
  ['onion', 'Onion', 'प्याज', '🧅', 'kg', 'Sabzi', 'pyaz pyaj kanda'],
  ['potato', 'Potato', 'आलू', '🥔', 'kg', 'Sabzi', 'aloo alu'],
  ['tomato', 'Tomato', 'टमाटर', '🍅', 'kg', 'Sabzi', 'tamatar'],
  ['chilli', 'Green chilli', 'हरी मिर्च', '🌶️', 'kg', 'Sabzi', 'mirch hari'],
  ['ginger', 'Ginger', 'अदरक', '🫚', 'kg', 'Sabzi', 'adrak'],
  ['garlic', 'Garlic', 'लहसुन', '🧄', 'kg', 'Sabzi', 'lahsun lehsun'],
  ['coriander', 'Coriander', 'धनिया', '🌿', 'bunch', 'Sabzi', 'dhaniya dhania'],
  ['lemon', 'Lemon', 'नींबू', '🍋', 'pcs', 'Sabzi', 'nimbu nimboo'],
  ['spinach', 'Spinach', 'पालक', '🥬', 'kg', 'Sabzi', 'palak saag'],
  ['cabbage', 'Cabbage', 'पत्ता गोभी', '🥬', 'kg', 'Sabzi', 'patta gobhi band gobi'],
  ['cauliflower', 'Cauliflower', 'फूल गोभी', '🥦', 'kg', 'Sabzi', 'gobhi gobi phool'],
  ['brinjal', 'Brinjal', 'बैंगन', '🍆', 'kg', 'Sabzi', 'baingan bengan'],
  ['okra', 'Okra', 'भिंडी', '🌱', 'kg', 'Sabzi', 'bhindi ladyfinger'],
  ['peas', 'Peas', 'मटर', '🫛', 'kg', 'Sabzi', 'matar'],
  ['carrot', 'Carrot', 'गाजर', '🥕', 'kg', 'Sabzi', 'gajar'],
  ['radish', 'Radish', 'मूली', '🥕', 'kg', 'Sabzi', 'mooli muli'],
  ['cucumber', 'Cucumber', 'खीरा', '🥒', 'kg', 'Sabzi', 'kheera khira'],
  ['lauki', 'Bottle gourd', 'लौकी', '🥒', 'kg', 'Sabzi', 'lauki ghiya'],
  ['karela', 'Bitter gourd', 'करेला', '🥒', 'kg', 'Sabzi', 'karela'],
  ['capsicum', 'Capsicum', 'शिमला मिर्च', '🫑', 'kg', 'Sabzi', 'shimla mirch'],
  ['pumpkin', 'Pumpkin', 'कद्दू', '🎃', 'kg', 'Sabzi', 'kaddu sitaphal'],
  ['mushroom', 'Mushroom', 'मशरूम', '🍄', 'pack', 'Sabzi', ''],
  ['corn', 'Corn', 'भुट्टा', '🌽', 'pcs', 'Sabzi', 'bhutta makka'],
  ['banana', 'Banana', 'केला', '🍌', 'dozen', 'Fruits', 'kela'],
  ['apple', 'Apple', 'सेब', '🍎', 'kg', 'Fruits', 'seb'],
  ['mango', 'Mango', 'आम', '🥭', 'kg', 'Fruits', 'aam'],
  ['grapes', 'Grapes', 'अंगूर', '🍇', 'kg', 'Fruits', 'angoor angur'],
  ['orange', 'Orange', 'संतरा', '🍊', 'kg', 'Fruits', 'santra kinnow'],
  ['papaya', 'Papaya', 'पपीता', '🍈', 'kg', 'Fruits', 'papita'],
  ['watermelon', 'Watermelon', 'तरबूज', '🍉', 'kg', 'Fruits', 'tarbooj tarbuj'],
  ['guava', 'Guava', 'अमरूद', '🍐', 'kg', 'Fruits', 'amrood amrud'],
].map(([id, en, hi, emoji, unit, cat, alias], i) => ({ id: `veg-${id}`, kind: 'veg', en, hi, emoji, unit, cat, alias, order: i }));

export const UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'pack', 'bottle', 'bunch', 'dozen'];
export const ITEM_CATS = ['Kitchen', 'Cleaning', 'Personal', 'Other'];
export const VEG_CATS = ['Sabzi', 'Fruits'];

// Quick size chips per unit (the qty box next to them takes anything else).
export const SIZES = {
  kg: [0.5, 1, 2, 5, 10], g: [100, 250, 500, 1000], L: [1, 2, 5], ml: [200, 500, 1000],
  pcs: [1, 2, 4, 6], pack: [1, 2, 3], bottle: [1, 2], bunch: [1, 2], dozen: [0.5, 1, 2],
};

const kindOf = (it) => it.kind || 'kitchen';

// Seed default items once. Members may seed too (if they open first) but can't set the owner-only flags.
export async function ensureItems() {
  if (!store.canWrite()) return;
  const owner = store.isOwner();
  const have = store.list('items');
  if (!(owner && store.meta('itemsSeeded')) && !have.some((i) => kindOf(i) === 'kitchen')) {
    for (const it of DEFAULT_ITEMS) await store.put('items', it);
  }
  if (!(owner && store.meta('vegSeeded')) && !have.some((i) => kindOf(i) === 'veg')) {
    for (const it of DEFAULT_VEG) await store.put('items', it);
  }
  if (owner && !store.meta('itemsSeeded')) await store.setMeta('itemsSeeded', true);
  if (owner && !store.meta('vegSeeded')) await store.setMeta('vegSeeded', true);
  // v1 kept a price on stock records; it now lives only in the linked spend.
  if (owner) {
    for (const ev of store.list('stock')) {
      if ('price' in ev) { const { price, ...rest } = ev; await store.replace('stock', rest); }
    }
  }
}

export function items(kind = 'kitchen') {
  return store.list('items').filter((i) => kindOf(i) === kind)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.en.localeCompare(b.en));
}

// Search by English, Hindi or Hinglish name ("pyaz", "chawal").
export function matches(it, q) {
  q = q.trim().toLowerCase();
  if (!q) return true;
  return it.en.toLowerCase().includes(q) || (it.hi || '').includes(q)
    || (it.alias || '').toLowerCase().split(/\s+/).some((a) => a && a.startsWith(q));
}

export function search(q, kind) {
  return store.list('items').filter((i) => (!kind || kindOf(i) === kind) && matches(i, q));
}

export function eventsFor(itemId) {
  return store.list('stock').filter((e) => e.itemId === itemId)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt - b.createdAt));
}

// Price of a purchase = its linked spend.
export function priceOf(ev) {
  if (!ev?.entryId) return 0;
  return Number(store.get('entries', ev.entryId)?.amount || 0);
}

// All priced purchases of an item, oldest first, with ₹ per unit.
export function pricePoints(item) {
  return eventsFor(item.id).filter((e) => e.type === 'bought')
    .map((e) => ({ ev: e, date: e.date, qty: Number(e.qty || 0), unit: e.unit || item.unit, price: priceOf(e) }))
    .filter((p) => p.price > 0 && p.qty > 0)
    .map((p) => ({ ...p, rate: p.price / p.qty }));
}

export function priceStats(item) {
  const pts = pricePoints(item);
  if (!pts.length) return null;
  const last = pts[pts.length - 1];
  const prev = pts.length > 1 ? pts[pts.length - 2] : null;
  const rates = pts.map((p) => p.rate);
  const change = prev ? (last.rate - prev.rate) / prev.rate : null;
  return {
    points: pts, last, prev, change,
    min: Math.min(...rates), max: Math.max(...rates), avg: rates.reduce((s, r) => s + r, 0) / rates.length,
    trend: change == null ? 'same' : change > 0.02 ? 'up' : change < -0.02 ? 'down' : 'same',
  };
}

// Kitchen item: packs → countdown, status, use per week, monthly cost.
export function analyze(item, t = today()) {
  const evs = eventsFor(item.id);
  const packs = [];
  let open = null;
  for (const e of evs) {
    if (e.type === 'bought') {
      if (open) { // bought again before finishing = top-up
        open = { ...open, qty: open.qty + Number(e.qty || 0), price: open.price + priceOf(e), lastsDays: e.lastsDays || open.lastsDays, ev: e };
      } else {
        open = { date: e.date, qty: Number(e.qty || 0), price: priceOf(e), unit: e.unit || item.unit, lastsDays: e.lastsDays || null, ev: e };
      }
    } else if (e.type === 'finished' && open) {
      packs.push({ ...open, end: e.date, days: Math.max(1, diffDays(open.date, e.date)) });
      open = null;
    }
  }

  const usable = packs.filter((p) => p.qty > 0);
  const dailyUse = usable.length ? usable.reduce((s, p) => s + p.qty / p.days, 0) / usable.length : null;
  const avgDays = packs.length ? packs.reduce((s, p) => s + p.days, 0) / packs.length : null;
  const lowDays = Number(item.lowDays) || LOW_DAYS;

  let runout = null;
  let daysLeft = null;
  if (open) {
    // Your estimate ("lasts about N days") wins; otherwise learn from finished packs.
    let lastFor = null;
    if (open.lastsDays) lastFor = Number(open.lastsDays);
    else if (dailyUse && open.qty) lastFor = open.qty / dailyUse;
    else if (avgDays) lastFor = avgDays;
    if (lastFor != null) {
      runout = addDays(open.date, lastFor);
      daysLeft = Math.max(0, diffDays(t, runout));
      open.total = Math.max(1, diffDays(open.date, runout));
      open.used = Math.min(1, Math.max(0, diffDays(open.date, t) / open.total));
    }
  }

  let status = 'none'; // never tracked
  if (evs.length) {
    if (!open) status = 'finished';
    else if (daysLeft != null && daysLeft <= lowDays) status = 'low';
    else status = 'ok';
  }

  const priced = packs.filter((p) => p.price > 0);
  let monthlyCost = null;
  if (priced.length) {
    monthlyCost = (priced.reduce((s, p) => s + p.price / p.days, 0) / priced.length) * 30;
  } else {
    const from = addDays(t, -30);
    const spent = evs.filter((e) => e.type === 'bought' && e.date >= from).reduce((s, e) => s + priceOf(e), 0);
    if (spent) monthlyCost = spent;
  }

  const lastBought = [...evs].reverse().find((e) => e.type === 'bought') || null;
  return {
    item, events: evs, packs, open, status, runout, daysLeft, lowDays,
    learnedDays: dailyUse && lastBought?.qty ? Number(lastBought.qty) / dailyUse : avgDays,
    avgDays, perWeek: dailyUse != null ? dailyUse * 7 : null, monthlyCost, lastBought,
  };
}

export function allAnalyzed() {
  const t = today();
  return items('kitchen').map((it) => analyze(it, t));
}

// Kitchen items finished or running low + sabzi marked "need".
export function shoppingList() {
  const kitchen = allAnalyzed().filter((a) => a.status === 'finished' || a.status === 'low' || a.item.need)
    .map((a) => (a.status === 'finished' || a.status === 'low' ? a : { ...a, status: 'need' }))
    .sort((a, b) => (a.status === 'finished' ? -1 : 0) - (b.status === 'finished' ? -1 : 0) || (a.daysLeft ?? 99) - (b.daysLeft ?? 99));
  const veg = items('veg').filter((v) => v.need)
    .map((v) => ({ item: v, status: 'need', lastBought: [...eventsFor(v.id)].reverse().find((e) => e.type === 'bought') || null }));
  return [...kitchen, ...veg];
}

export function shoppingText(list = shoppingList()) {
  const lines = list.map((a) => {
    const last = a.lastBought ? ` (last: ${a.lastBought.qty} ${a.lastBought.unit || a.item.unit})` : '';
    const why = a.status === 'need' ? 'sabzi' : a.status === 'finished' ? 'finished' : a.daysLeft === 0 ? 'runs out today' : `~${a.daysLeft} days left`;
    return `• ${a.item.emoji ? `${a.item.emoji} ` : ''}${a.item.en} / ${a.item.hi}${last} — ${why}`;
  });
  return `🛒 Kozy shopping list\n${lines.join('\n')}`;
}

// A Bought with a price also adds a spend in Groceries + veg.
export async function bought(item, { qty, unit, price, date, lastsDays, note }) {
  const d = date || today();
  const u = unit || item.unit;
  const doc = { itemId: item.id, type: 'bought', date: d, qty: Number(qty) || 0, unit: u };
  if (Number(lastsDays) > 0) doc.lastsDays = Number(lastsDays);
  if (note) doc.note = note;
  if (Number(price) > 0) {
    const rate = Number(qty) > 0 ? ` @ ₹${Math.round(Number(price) / Number(qty))}/${u}` : '';
    const entry = await addEntry({
      date: d, amount: price, cat: GROCERY_CAT, mode: 'UPI', source: 'stock',
      note: `${item.emoji ? `${item.emoji} ` : ''}${item.en} / ${item.hi} ${qty} ${u}${kindOf(item) === 'veg' ? rate : ''}${note ? ` · ${note}` : ''}`,
    });
    doc.entryId = entry.id;
  }
  const ev = await store.put('stock', doc);
  if (item.need) await store.put('items', { ...item, need: false });
  return ev;
}

export async function finished(item, date) {
  return store.put('stock', { itemId: item.id, type: 'finished', date: date || today() });
}

export async function setLasts(ev, days) {
  return store.put('stock', { ...ev, lastsDays: Number(days) || null });
}

export async function toggleNeed(item) {
  return store.put('items', { ...item, need: !item.need });
}

// Everything bought today (both people), newest first.
export function boughtOn(date = today()) {
  return store.list('stock').filter((e) => e.type === 'bought' && e.date === date)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((e) => ({ ev: e, item: store.get('items', e.itemId) }))
    .filter((x) => x.item);
}

// Returns what was removed, so it can be undone.
export async function removeEvent(ev) {
  const entry = ev.entryId ? store.get('entries', ev.entryId) : null;
  if (entry && store.canEdit(entry)) await store.remove('entries', entry.id);
  await store.remove('stock', ev.id);
  return { ev, entry: entry && !store.get('entries', entry.id) ? entry : null };
}

export async function restoreEvent({ ev, entry }) {
  if (entry) await store.replace('entries', entry);
  await store.replace('stock', ev);
}

export async function removeItem(item) {
  for (const ev of eventsFor(item.id)) await store.remove('stock', ev.id);
  await store.remove('items', item.id);
}

export async function addItem({ en, hi, unit, cat, kind = 'kitchen', emoji, note, lowDays }) {
  const order = Math.max(0, ...items(kind).map((x) => x.order ?? 0)) + 1;
  return store.put('items', {
    kind, en, hi: hi || en, unit, cat, order,
    ...(emoji ? { emoji } : {}), ...(note ? { note } : {}), ...(lowDays ? { lowDays: Number(lowDays) } : {}),
  });
}

// ---------- Edit a purchase / finished record ----------
// changes: {qty, unit, price, date, lastsDays, note}. The price lives in the linked spend: update, add or remove it.
export async function updatePurchase(ev, changes) {
  const item = store.get('items', ev.itemId) || { en: 'Item', hi: '', unit: ev.unit };
  const next = { ...ev, ...changes };
  delete next.price;
  if (ev.type === 'bought' && 'price' in changes) {
    const price = Number(changes.price) || 0;
    const entry = ev.entryId ? store.get('entries', ev.entryId) : null;
    const u = next.unit || item.unit;
    const rate = Number(next.qty) > 0 && price ? ` @ ₹${Math.round(price / Number(next.qty))}/${u}` : '';
    const note = `${item.emoji ? `${item.emoji} ` : ''}${item.en} / ${item.hi} ${next.qty} ${u}${item.kind === 'veg' ? rate : ''}${next.note ? ` · ${next.note}` : ''}`;
    if (entry && price > 0) {
      await store.put('entries', { ...entry, amount: price, date: next.date, note });
    } else if (entry && price <= 0) {
      await store.remove('entries', entry.id);
      next.entryId = null;
    } else if (!entry && price > 0) {
      const e = await addEntry({ date: next.date, amount: price, cat: GROCERY_CAT, mode: 'UPI', note, source: 'stock' });
      next.entryId = e.id;
    }
  }
  if (Number(next.lastsDays) > 0) next.lastsDays = Number(next.lastsDays); else delete next.lastsDays;
  if (!next.note) delete next.note;
  return store.replace('stock', next);
}

// ---------- Monthly use + next month's plan ----------
// From purchases in the last 90 days: how much of this item the family uses per month, and what it costs.
export function monthlyUse(item, t = today()) {
  const from = addDays(t, -90);
  const buys = eventsFor(item.id).filter((e) => e.type === 'bought' && e.date >= from && Number(e.qty) > 0);
  if (!buys.length) return null;
  const qty = buys.reduce((s, e) => s + Number(e.qty), 0);
  const priced = buys.filter((e) => priceOf(e) > 0);
  const rate = priced.length ? priced.reduce((s, e) => s + priceOf(e), 0) / priced.reduce((s, e) => s + Number(e.qty), 0) : 0;
  // The period these purchases cover: from the first one to today, plus one typical gap (the last pack is still in use).
  const gaps = buys.slice(1).map((e, i) => diffDays(buys[i].date, e.date)).filter((g) => g > 0);
  const gap = gaps.length ? gaps.reduce((s, g) => s + g, 0) / gaps.length : 30;
  const span = Math.min(90, Math.max(30, diffDays(buys[0].date, t) + gap));
  const perMonth = (qty / span) * 30;
  const last = buys[buys.length - 1];
  const pack = Number(last.qty) || 1;
  const packs = Math.max(1, Math.ceil(perMonth / pack - 0.15)); // allow 15% slack before adding a pack
  return {
    item, unit: last.unit || item.unit, perMonth, perWeek: perMonth / 4.33, rate, costPerMonth: perMonth * rate,
    buys: buys.length, pack, packs, suggestQty: packs * pack, suggestCost: packs * pack * rate,
  };
}

export function monthlyPlan(t = today()) {
  const rows = store.list('items').map((it) => monthlyUse(it, t)).filter(Boolean);
  const kitchen = rows.filter((r) => kindOf(r.item) === 'kitchen').sort((a, b) => b.suggestCost - a.suggestCost);
  const veg = rows.filter((r) => kindOf(r.item) === 'veg').sort((a, b) => b.costPerMonth - a.costPerMonth);
  return {
    kitchen, veg,
    kitchenTotal: kitchen.reduce((s, r) => s + r.suggestCost, 0),
    vegTotal: veg.reduce((s, r) => s + r.costPerMonth, 0),
  };
}

// ---------- This week's grocery run ----------
// One list for the next 7 days: kitchen items that run out (or are out / marked), plus the sabzi you usually buy in a week.
const roundQty = (n, unit) => (['g', 'ml'].includes(unit) ? Math.max(50, Math.round(n / 50) * 50)
  : ['kg', 'L'].includes(unit) ? Math.max(0.5, Math.round(n * 2) / 2) : Math.max(1, Math.round(n)));

export function weeklyPlan(t = today()) {
  const end = addDays(t, 6);
  const lastRate = (it) => { const p = pricePoints(it); return p.length ? p[p.length - 1].rate : 0; };

  const kitchen = items('kitchen').map((it) => analyze(it, t))
    .filter((a) => a.status === 'finished' || a.item.need || (a.open && a.runout && a.runout <= end))
    .map((a) => {
      const qty = Number(a.lastBought?.qty) || 1;
      const unit = a.lastBought?.unit || a.item.unit;
      const due = a.status === 'finished' || !a.runout || a.runout < t ? t : a.runout;
      const rate = lastRate(a.item);
      return { item: a.item, due, qty, unit, cost: qty * rate, why: a.status === 'finished' ? 'out' : a.runout && a.runout < t ? 'overdue' : a.runout && a.runout <= end ? 'runs out' : 'marked', runout: a.runout };
    })
    .sort((x, y) => x.due.localeCompare(y.due) || x.item.en.localeCompare(y.item.en));

  const veg = items('veg').map((v) => {
    const u = monthlyUse(v, t);
    if (!u && !v.need) return null;
    const unit = u?.unit || v.unit;
    const qty = u ? roundQty(u.perWeek, unit) : 1;
    return { item: v, qty, unit, cost: u?.rate ? qty * u.rate : 0, usual: !!u };
  }).filter(Boolean).sort((x, y) => (y.item.need ? 1 : 0) - (x.item.need ? 1 : 0) || y.cost - x.cost);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(t, i);
    return { date, items: kitchen.filter((k) => k.due === date) };
  });
  return {
    from: t, to: end, kitchen, veg, days,
    kitchenTotal: kitchen.reduce((s, r) => s + r.cost, 0),
    vegTotal: veg.reduce((s, r) => s + r.cost, 0),
  };
}

export function weeklyText(w = weeklyPlan()) {
  const q = (r) => `${r.qty} ${r.unit}`;
  const lines = [
    ...w.kitchen.map((r) => `• ${r.item.en} / ${r.item.hi} — ${q(r)}`),
    ...w.veg.map((r) => `• ${r.item.emoji ? `${r.item.emoji} ` : ''}${r.item.en} / ${r.item.hi} — ${q(r)}`),
  ];
  return `🗓️ Kozy weekly groceries\n${lines.join('\n')}`;
}

export async function setNeed(item, need) {
  return store.put('items', { ...item, need: !!need });
}

// Sabzi price movers for the monthly summary: biggest change vs previous purchase.
export function vegMovers(limit = 5) {
  return items('veg').map((v) => ({ item: v, stats: priceStats(v) }))
    .filter((x) => x.stats && x.stats.change != null)
    .sort((a, b) => Math.abs(b.stats.change) - Math.abs(a.stats.change))
    .slice(0, limit);
}
