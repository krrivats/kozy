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

// ---------- v1.2 ----------
import { parseBill } from '../js/logic/scan.js';

test('budget total, allocation, salary-day checklist', async () => {
  expect(budget.budgetTotal()).toBe(40000); // no budgetTotal set → sum of limits
  await store.setMeta('budgetTotal', 42000);
  expect(budget.allocation()).toEqual({ total: 42000, alloc: 40000, left: 2000 });
  expect(budget.summary('2026-10').limit).toBe(42000);
  // checklist: paid this month in demo → not due on 17 Oct, due on 1 Nov
  expect(budget.dueBills('2026-10-17').some((b) => b.group === 'checklist')).toBe(false);
  const nov = budget.dueBills('2026-11-01').filter((b) => b.group === 'checklist').map((b) => b.id).sort();
  expect(nov).toEqual(['c-card', 'c-emergency', 'c-festival']);
  expect(reminders('2026-11-01', 'morning').find((r) => r.kind === 'checklist').title).toBe('Salary-day checklist: 3 to do');
});

test('family spends from notes, insights, year view', () => {
  const fam = Object.fromEntries(budget.familySpends('2026-10').map((f) => [f.name, f.total]));
  expect(fam).toMatchObject({ Maa: 1000, Kids: 800, Papa: 450, Dadi: 350 });
  expect(budget.mentionsName('Papaya 2kg', 'Papa')).toBe(false);
  expect(budget.mentionsName('medicine papa', 'Papa')).toBe(true);
  const ins = budget.insights('2026-10');
  expect(ins.find((i) => i.id === 'pace').text).toMatch(/At this pace you will spend about ₹[\d,]+ this month/);
  expect(ins.find((i) => i.id === 'usual')).toBeTruthy();
  const y = budget.yearSummary(2026);
  expect(y.label).toBe('FY 2026–27');
  expect(y.months[0].mk).toBe('2026-04');
  expect(y.months[11].mk).toBe('2027-03');
  const sum = ['2026-08', '2026-09', '2026-10'].reduce((s, mk) => s + budget.summary(mk).spent, 0);
  expect(Math.round(y.total)).toBe(Math.round(sum));
  expect(y.catRows[0].total).toBeGreaterThan(0);
});

test('monthly use + plan, edit a purchase (price lives in the spend)', async () => {
  const atta = store.get('items', 'item-atta');
  const u = stock.monthlyUse(atta, T);
  expect(u.unit).toBe('kg');
  expect(u.perMonth).toBeGreaterThan(15);  // 10 kg bag lasts ~11 days → ~27 kg/month
  expect(u.perMonth).toBeLessThan(40);
  expect(u.suggestQty % 10).toBe(0);         // whole 10 kg bags
  expect(Math.round(u.rate)).toBe(42);
  const plan = stock.monthlyPlan(T);
  expect(plan.kitchen.length).toBeGreaterThan(10);
  expect(plan.veg.length).toBeGreaterThan(5);
  expect(plan.kitchenTotal).toBeGreaterThan(1000);

  const ev = stock.eventsFor('item-atta').filter((e) => e.type === 'bought').pop();
  const entryId = ev.entryId;
  await stock.updatePurchase(ev, { qty: 5, price: 230, note: 'Shakti bhog' });
  expect(store.get('stock', ev.id)).toMatchObject({ qty: 5, note: 'Shakti bhog', entryId });
  expect(store.get('entries', entryId).amount).toBe(230);
  await stock.updatePurchase(store.get('stock', ev.id), { price: 0 });
  expect(store.get('entries', entryId)).toBeNull();
  expect(store.get('stock', ev.id).entryId).toBeNull();
  await stock.updatePurchase(store.get('stock', ev.id), { price: 240 });
  expect(stock.priceOf(store.get('stock', ev.id))).toBe(240);
});

test('bill scan parser', () => {
  const text = `SHRI BALAJI KIRANA STORE
Rohtak  Ph: 9812345678
Date: 17/10/2026  Bill No: 1123
Item          Qty    Rate   Amount
Aashirvaad Atta 10kg  1  420  420.00
Fortune Mustard Oil 1L 2 165  330.00
Tata Salt 1kg   1   28   28.00
Surf Excel 1kg  1  135  135
Onion 2kg  1  80  80
Parle G biscuit 4 10 40
Sub Total               1033.00
CGST 0.00
Grand Total   1,033.00
Thank you visit again`;
  const r = parseBill(text);
  expect(r.total).toBe(1033);
  const byItem = Object.fromEntries(r.rows.filter((x) => x.item).map((x) => [x.item.id, x]));
  expect(byItem['item-atta']).toMatchObject({ qty: 10, unit: 'kg', price: 420 });
  expect(byItem['item-oil']).toMatchObject({ price: 330 });
  expect(byItem['item-salt']).toMatchObject({ price: 28 });
  expect(byItem['veg-onion']).toMatchObject({ qty: 2, price: 80 });
  expect(r.rows.find((x) => /parle/i.test(x.name))).toMatchObject({ item: null, price: 40 });
  expect(r.rows.length).toBe(6);
  expect(r.sum).toBe(1033);
});
