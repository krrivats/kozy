// BUDGET — three views: Categories (grid, goals, savings, card, chart) · Spends (who / category filter) · Summary.
import * as budget from '../logic/budget.js';
import * as store from '../store.js';
import * as milk from '../logic/milk.js';
import { vegMovers } from '../logic/stock.js';
import { money, moneyShort, monthKey, shiftMonth, esc, monthName, monthShortName, pct, number, dayLabel } from '../logic/format.js';
import { icon, bar, download, toast } from '../ui.js';
import { entriesGrouped, monthSwitch, header, entryRow } from './common.js';
import { openSpendSheet } from './spend-sheet.js';

const state = { mk: monthKey(), cat: null, who: null, view: 'cats' };

function chart(hist, limit) {
  const W = 320, H = 110, padB = 18, padT = 14;
  const max = Math.max(limit, ...hist.map((h) => h.spent), 1);
  const bw = W / hist.length;
  const y = (v) => H - padB - ((H - padB - padT) * v) / max;
  const bars = hist.map((h, i) => {
    const x = i * bw + bw * 0.2;
    const w = bw * 0.6;
    const top = y(h.spent);
    const lvl = budget.level(h.spent, limit);
    const cur = h.mk === state.mk;
    return `<g class="cb ${lvl} ${cur ? 'cur' : ''}">
      <rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0, H - padB - top).toFixed(1)}" rx="4"/>
      <text class="cv" x="${(x + w / 2).toFixed(1)}" y="${(top - 3).toFixed(1)}" text-anchor="middle">${h.spent ? Math.round(h.spent / 1000) + 'k' : ''}</text>
      <text class="cl" x="${(x + w / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle">${h.label}</text>
    </g>`;
  }).join('');
  const ly = y(limit).toFixed(1);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Spending in the last ${hist.length} months">
    <line class="limit-line" x1="0" x2="${W}" y1="${ly}" y2="${ly}"/>
    ${bars}
  </svg>`;
}

function catsView(s) {
  const sav = budget.savings();
  const cc = budget.creditCard();
  const gs = budget.goals();
  return `
  <section class="cat-grid2" data-test="cats">
    ${budget.cats().map((c) => {
      const spent = s.by[c.id] || 0;
      const lvl = budget.level(spent, c.limit);
      return `<button class="ctile" data-act="filter" data-cat="${c.id}" data-level="${lvl}">
        <span class="ctile-top"><span class="ctile-emo">${c.emoji}</span><span class="ctile-name">${esc(c.name)}</span>
          <span class="num ${lvl}"><b>${money(spent)}</b><span class="muted">/${c.limit ? moneyShort(c.limit) : '—'}</span></span></span>
        ${bar(spent, c.limit, lvl)}
      </button>`;
    }).join('')}
  </section>

  ${gs.length ? `<section class="card tight" data-test="goals">
    <div class="card-head"><h2>🎯 Goals</h2></div>
    ${gs.map((g) => `<div class="cat-mini">
      <div class="row between"><span>${g.emoji || '🎯'} ${esc(g.name)}${g.by ? `<span class="muted small"> · by ${dayLabel(g.by)}</span>` : ''}</span>
        <span class="num"><b>${money(g.saved)}</b><span class="muted"> / ${money(g.target)}</span></span></div>
      ${bar(g.saved, g.target, g.pct >= 1 ? 'ok' : 'ok')}
    </div>`).join('')}
  </section>` : ''}

  <div class="quick2">
    <section class="card mini" data-test="savings">
      <h2>🏦 Savings</h2>
      ${sav.map((x) => `<div class="row between small"><span>${x.emoji} ${esc(x.name.replace(' fund', ''))}</span><b class="num">${money(x.total)}</b></div>`).join('')}
    </section>
    <section class="card mini" data-test="cc">
      <h2>💳 Card due</h2>
      <p class="big2 num" data-test="cc-remaining">${money(cc.remaining)}</p>
      <p class="muted tiny">Paid ${money(cc.paid)} of ${money(cc.start)}</p>
    </section>
  </div>

  <section class="card tight">
    <div class="card-head"><h2>Last 6 months</h2><span class="muted small legend"><i class="dash"></i> budget</span></div>
    ${chart(budget.history(6, state.mk), s.limit)}
  </section>`;
}

function spendsView() {
  const all = budget.entriesFor(state.mk);
  const people = [...new Set(all.map((e) => e.by || 'Me'))];
  const shown = all.filter((e) => (!state.cat || e.cat === state.cat) && (!state.who || (e.by || 'Me') === state.who));
  const total = shown.reduce((s, e) => s + Number(e.amount), 0);
  return `
  <div class="filters">
    <div class="seg small">
      <button class="${!state.who ? 'on' : ''}" data-act="who" data-who="">All</button>
      ${people.map((p) => `<button class="${state.who === p ? 'on' : ''}" data-act="who" data-who="${esc(p)}">${esc(p)}</button>`).join('')}
    </div>
    ${state.cat ? `<button class="chip-btn" data-act="filter" data-cat="${state.cat}">${budget.cat(state.cat).emoji} ${esc(budget.cat(state.cat).name)} ${icon('x')}</button>` : ''}
  </div>
  <p class="muted small total-line">${shown.length} spends · <b>${money(total)}</b></p>
  <div data-test="entries">${entriesGrouped(shown)}</div>`;
}

function summaryView() {
  const m = budget.monthSummary(state.mk);
  const ml = milk.month(state.mk);
  const movers = vegMovers(5);
  const peopleTotal = Object.values(m.people).reduce((s, v) => s + v, 0) || 1;
  return `
  <section class="card tight" data-test="summary">
    <div class="sum3">
      <div><span class="k">Spent</span><span class="v">${money(m.spent)}</span></div>
      <div><span class="k">vs ${monthShortName(m.prevMk)}</span><span class="v ${m.change > 0 ? 'over' : 'okv'}">${m.change > 0 ? '+' : ''}${money(m.change)}</span></div>
      <div><span class="k">Saved</span><span class="v">${money(m.saved)}</span></div>
    </div>
  </section>

  <section class="card tight" data-test="who-spent">
    <div class="card-head"><h2>👥 Who spent</h2></div>
    ${Object.entries(m.people).sort((a, b) => b[1] - a[1]).map(([who, amt]) => `<div class="cat-mini">
      <div class="row between"><span>${esc(who)}</span><span class="num"><b>${money(amt)}</b><span class="muted"> · ${Math.round((amt / peopleTotal) * 100)}%</span></span></div>
      ${bar(amt, peopleTotal, 'ok')}</div>`).join('') || '<p class="empty">No spends.</p>'}
  </section>

  <section class="card tight">
    <div class="card-head"><h2>📊 vs last month</h2></div>
    <div class="list">${m.rows.slice(0, 6).map((r) => `<div class="mv-row">
      <span>${r.emoji} ${esc(r.name)}</span>
      <span class="num">${money(r.spent)} <span class="${r.diff > 0 ? 'over-text' : 'ok-text'} small">${r.diff > 0 ? '▲' : r.diff < 0 ? '▼' : ''} ${r.diff ? money(Math.abs(r.diff)) : '='}</span></span>
    </div>`).join('') || '<p class="empty">Nothing to compare.</p>'}</div>
  </section>

  ${movers.length ? `<section class="card tight" data-test="veg-movers">
    <div class="card-head"><h2>🥬 Sabzi prices</h2><span class="muted small">vs last buy</span></div>
    <div class="list">${movers.map(({ item, stats }) => `<div class="mv-row">
      <span>${item.emoji} ${esc(item.en)} <span class="hi">${esc(item.hi)}</span></span>
      <span class="num">${money(stats.last.rate)}/${esc(item.unit)} <span class="${stats.change > 0 ? 'over-text' : 'ok-text'} small">${stats.change > 0 ? '▲' : '▼'} ${pct(stats.change)}</span></span>
    </div>`).join('')}</div>
  </section>` : ''}

  <section class="card tight">
    <div class="card-head"><h2>🔝 Biggest spends</h2></div>
    <div class="list">${m.biggest.map(entryRow).join('') || '<p class="empty">No spends.</p>'}</div>
  </section>

  <section class="card tight">
    <div class="row between"><span>🥛 Milk ${monthName(state.mk)}</span><span class="num"><b>${number(ml.litres)} L</b> · ${money(ml.amount)}</span></div>
  </section>`;
}

export function render() {
  const s = budget.summary(state.mk);
  const views = [['cats', 'Categories'], ['spends', 'Spends'], ['summary', 'Summary']];
  return `
  ${header('Budget', `${money(s.spent)} of ${money(s.limit)} · ${money(s.left)} left`,
    `<button class="btn small ghost" data-act="csv" aria-label="Export month to CSV">${icon('download')} CSV</button>`)}
  ${monthSwitch(state.mk)}
  <div class="seg views" role="tablist">
    ${views.map(([k, l]) => `<button class="${state.view === k ? 'on' : ''}" data-act="view" data-view="${k}" role="tab" aria-selected="${state.view === k}">${l}</button>`).join('')}
  </div>
  ${state.view === 'cats' ? catsView(s) : state.view === 'spends' ? spendsView() : summaryView()}`;
}

export function bind(root, rerender) {
  root.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-act],[data-entry]');
    if (!t) return;
    if (t.dataset.entry) {
      const e = store.get('entries', t.dataset.entry);
      if (e) openSpendSheet(e);
      return;
    }
    const act = t.dataset.act;
    if (act === 'month-prev') { state.mk = shiftMonth(state.mk, -1); rerender(); }
    else if (act === 'month-next') { state.mk = shiftMonth(state.mk, 1); rerender(); }
    else if (act === 'view') { state.view = t.dataset.view; rerender(); }
    else if (act === 'filter') {
      state.cat = state.cat === t.dataset.cat ? null : t.dataset.cat;
      state.view = 'spends';
      rerender();
    } else if (act === 'who') { state.who = t.dataset.who || null; rerender(); }
    else if (act === 'csv') {
      download(`kozy-${state.mk}.csv`, '﻿' + budget.monthCsv(state.mk), 'text/csv;charset=utf-8');
      toast(`Exported ${monthName(state.mk)} ✓`);
    }
  });
}

export function reset() {
  Object.assign(state, { mk: monthKey(), cat: null, who: null, view: 'cats' });
}
