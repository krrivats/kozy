// Activity feed: who did what, newest first (spends, purchases, finished items, milk days).
import * as store from '../store.js';
import { cat } from './budget.js';
import { priceOf } from './stock.js';
import { money, number, dayLabel } from './format.js';

export function activity(limit = 50) {
  const out = [];
  for (const e of store.list('entries')) {
    if (e.source === 'stock') continue; // shown on the purchase itself
    const c = cat(e.cat);
    out.push({ t: e.createdAt || 0, who: e.by || 'Me', emoji: c.emoji, kind: 'spend', ref: e.id,
      text: `added ${money(e.amount)} · ${e.note || c.name}`, sub: c.name });
  }
  for (const s of store.list('stock')) {
    const it = store.get('items', s.itemId);
    if (!it) continue;
    const p = s.type === 'bought' ? priceOf(s) : 0;
    out.push({
      t: s.createdAt || 0, who: s.by || 'Me', emoji: it.emoji || (s.type === 'bought' ? '🛍️' : '✅'), kind: s.type, ref: s.id,
      text: s.type === 'bought' ? `bought ${it.en} ${number(s.qty)} ${s.unit || it.unit}${p ? ` · ${money(p)}` : ''}` : `finished ${it.en}`,
      sub: it.kind === 'veg' ? 'Sabzi' : 'Stock',
    });
  }
  for (const m of store.list('milk')) {
    out.push({ t: m.updatedAt || m.createdAt || 0, who: m.by || 'Me', emoji: '🥛', kind: 'milk', ref: m.id,
      text: m.skip ? `skipped milk · ${dayLabel(m.id)}` : `logged milk ${number(m.litres)} L · ${dayLabel(m.id)}`, sub: 'Milk' });
  }
  return out.sort((a, b) => b.t - a.t).slice(0, limit);
}
