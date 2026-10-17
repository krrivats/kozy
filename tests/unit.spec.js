// Pure logic tests (run in Node, no browser): quick-add parser, bills, stock, sabzi prices, reminders.
import { test, expect } from '@playwright/test';
import * as store from '../js/store.js';
import { buildDemo } from '../js/logic/demo.js';
import { parse } from '../js/logic/quick.js';
import * as budget from '../js/logic/budget.js';
import * as stock from '../js/logic/stock.js';
import { reminders, pushMessage } from '../js/logic/reminders.js';
import { activity } from '../js/logic/activity.js';

const T = '2026-10-17';

test.beforeEach(() => store.hydrate(buildDemo(T)));

test('quick add parser', () => {
  let r = parse('atta 10kg 420');
  expect(r).toMatchObject({ kind: 'item', qty: 10, unit: 'kg', price: 420 });
  expect(r.item.id).toBe('item-atta');

  r = parse('onion 5kg 50/kg');
  expect(r).toMatchObject({ kind: 'item', qty: 5, unit: 'kg', price: 250, rate: 50 });
  expect(r.item.id).toBe('veg-onion');

  r = parse('pyaz 2 kg 80');
  expect(r.item.id).toBe('veg-onion');
  expect(r).toMatchObject({ qty: 2, price: 80, rate: 40 });

  r = parse('green chilli 250g 20');
  expect(r.item.id).toBe('veg-chilli');
  expect(r).toMatchObject({ qty: 250, unit: 'g', price: 20 });

  r = parse('sabzi 250');
  expect(r).toMatchObject({ kind: 'spend', amount: 250, cat: 'grocery', note: 'Sabzi' });

  r = parse('auto 80 cash');
  expect(r).toMatchObject({ kind: 'spend', amount: 80, cat: 'travel', mode: 'Cash' });

  r = parse('₹1,200 plumber');
  expect(r).toMatchObject({ kind: 'spend', amount: 1200, cat: 'misc' });

  r = parse('tamatar 1kg @40');
  expect(r.item.id).toBe('veg-tomato');
  expect(r).toMatchObject({ qty: 1, price: 40 });

  expect(parse('')).toBeNull();
});

test('bills: due window, pay advances by frequency', async () => {
  const lic = budget.bills().find((b) => b.id === 'b-lic');
  expect(budget.nextDue(lic)).toBe('2026-10-26');
  const due = budget.dueBills(T).map((b) => b.id);
  expect(due).toContain('b-lic'); // yearly, remind 15 days before
  expect(due).not.toContain('b-solar'); // paid this month → due 1 Nov, outside 3-day window
  expect(budget.advance('2026-01-31', { freq: 'monthly' })).toBe('2026-02-28');
  expect(budget.advance('2026-10-01', { freq: '2m' })).toBe('2026-12-01');
  expect(budget.advance('2026-10-01', { freq: 'quarterly' })).toBe('2027-01-01');
  expect(budget.advance('2026-10-01', { freq: 'yearly' })).toBe('2027-10-01');
  expect(budget.advance('2026-10-01', { freq: 'days', everyDays: 84 })).toBe('2026-12-24');
});

test('stock: countdown, low days, sabzi price history, shopping list', () => {
  const all = stock.allAnalyzed();
  expect(all.length).toBe(17);
  expect(all.some((a) => a.status === 'finished')).toBe(true);
  const besan = all.find((a) => a.item.id === 'item-besan');
  expect(besan.status).toBe('ok'); // wife bought it today, lasts ~21 days
  expect(besan.daysLeft).toBeGreaterThan(14);
  expect(besan.open.used).toBeLessThan(0.3);

  const onion = store.get('items', 'veg-onion');
  const ps = stock.priceStats(onion);
  expect(ps.points.length).toBeGreaterThan(3);
  expect(ps.min).toBeLessThanOrEqual(ps.max);
  expect(['up', 'down', 'same']).toContain(ps.trend);

  const shop = stock.shoppingList();
  expect(shop.some((a) => a.status === 'need' && a.item.id === 'veg-tomato')).toBe(true);
  expect(stock.shoppingText(shop)).toContain('🍅 Tomato / टमाटर');
});

test('summary, who spent, goals, activity, reminders', () => {
  const s = budget.monthSummary('2026-10');
  expect(s.spent).toBeGreaterThan(10000);
  expect(Object.keys(s.people).sort()).toEqual(['Me', 'Wife']);
  const g = budget.goals()[0];
  expect(g.saved).toBe(4500);
  expect(g.target).toBe(6000);
  const feed = activity(10);
  expect(feed.length).toBe(10);
  expect(feed[0].t).toBeGreaterThanOrEqual(feed[1].t);
  const rem = reminders(T, 'all');
  expect(rem.find((r) => r.id === 'bill-b-lic').title).toBe('LIC premium due in 9 days');
  expect(rem.some((r) => r.kind === 'stock')).toBe(true);
  expect(rem.some((r) => r.kind === 'milk')).toBe(true); // today not ticked in demo
  const msg = pushMessage(rem);
  expect(msg.title).toContain('bill');
  expect(reminders(T, 'evening').every((r) => r.kind === 'milk')).toBe(true);
});
