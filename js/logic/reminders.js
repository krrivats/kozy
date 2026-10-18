// Reminders: used by the in-app "Needs you" row AND by the daily push script (tools/reminders/send.mjs).
// slot 'morning' = bills + stock, 'evening' = milk not ticked, 'all' = everything.
import * as store from '../store.js';
import { dueBills } from './budget.js';
import { shoppingList } from './stock.js';
import { today, dayLabel } from './format.js';

export function reminders(t = today(), slot = 'all') {
  const out = [];
  if (slot !== 'evening') {
    const due = dueBills(t);
    const check = due.filter((b) => b.group === 'checklist');
    if (check.length) {
      out.push({ id: 'checklist', kind: 'checklist', emoji: '✅', title: `Salary-day checklist: ${check.length} to do`, href: '#/home' });
    }
    for (const b of due.filter((x) => x.group !== 'checklist')) {
      const when = b.daysTo < 0 ? `overdue since ${dayLabel(b.due)}` : b.daysTo === 0 ? 'due today' : `due in ${b.daysTo} day${b.daysTo === 1 ? '' : 's'}`;
      out.push({ id: `bill-${b.id}`, kind: 'bill', emoji: b.emoji || '🧾', title: `${b.name} ${when}`, amount: b.amount, href: '#/home' });
    }
    const shop = shoppingList();
    const urgent = shop.filter((a) => a.status === 'finished' || a.status === 'need' || (a.daysLeft ?? 99) <= 2);
    if (urgent.length) {
      out.push({ id: 'stock', kind: 'stock', emoji: '🛒', title: `${urgent.length} to buy: ${urgent.slice(0, 4).map((a) => a.item.en).join(', ')}${urgent.length > 4 ? '…' : ''}`, href: '#/stock' });
    }
  }
  if (slot !== 'morning' && !store.get('milk', t)) {
    out.push({ id: 'milk', kind: 'milk', emoji: '🥛', title: 'Tick today’s milk', href: '#/milk' });
  }
  return out;
}

// One notification per run: a title + up to 4 lines.
export function pushMessage(list) {
  if (!list.length) return null;
  const bills = list.filter((r) => r.kind === 'bill').length;
  const parts = [];
  if (bills) parts.push(`${bills} bill${bills > 1 ? 's' : ''} due`);
  if (list.some((r) => r.kind === 'checklist')) parts.push('salary-day checklist');
  if (list.some((r) => r.kind === 'stock')) parts.push('items to buy');
  if (list.some((r) => r.kind === 'milk')) parts.push('milk not ticked');
  return {
    title: `Kozy: ${parts.join(', ')}`,
    body: list.slice(0, 4).map((r) => `${r.emoji} ${r.title}`).join('\n'),
    url: list[0].href,
  };
}
