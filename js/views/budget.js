// BUDGET — categories with progress bars, savings, credit card, history chart, all entries, CSV.
import * as budget from '../logic/budget.js';
import * as store from '../store.js';
import { money, monthKey, shiftMonth, esc, monthName } from '../logic/format.js';
import { icon, bar, download, toast } from '../ui.js';
import { entriesGrouped, monthSwitch, header } from './common.js';
import { openSpendSheet } from './spend-sheet.js';

const state = { mk: monthKey(), cat: null };

function chart(hist, limit) {
  const W = 320, H = 120, padB = 18, padT = 14;
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

export function render() {
  const s = budget.summary(state.mk);
  const all = budget.entriesFor(state.mk);
  const shown = state.cat ? all.filter((e) => e.cat === state.cat) : all;
  const sav = budget.savings();
  const cc = budget.creditCard();
  const hist = budget.history(6, state.mk);

  return `
  ${header('Budget', `${money(s.spent)} of ${money(s.limit)} spent`,
    `<button class="btn small ghost" data-act="csv" aria-label="Export month to CSV">${icon('download')} CSV</button>`)}
  ${monthSwitch(state.mk)}

  <section class="card">
    <div class="sum3">
      <div><span class="k">Spent</span><span class="v">${money(s.spent)}</span></div>
      <div><span class="k">Budget</span><span class="v">${money(s.limit)}</span></div>
      <div><span class="k">Left</span><span class="v ${s.left < 0 ? 'over' : ''}">${money(s.left)}</span></div>
    </div>
  </section>

  <section class="card" data-test="cats">
    <div class="card-head"><h2>Categories</h2><span class="muted small">Tap to filter</span></div>
    ${budget.cats().map((c) => {
      const spent = s.by[c.id] || 0;
      const lvl = budget.level(spent, c.limit);
      return `<button class="cat-row ${state.cat === c.id ? 'sel' : ''}" data-act="filter" data-cat="${c.id}" data-level="${lvl}">
        <div class="row between"><span class="cat-name">${c.emoji} ${esc(c.name)}</span>
          <span class="num ${lvl}">${money(spent)} <span class="muted">/ ${money(c.limit)}</span></span></div>
        ${bar(spent, c.limit, lvl)}
      </button>`;
    }).join('')}
  </section>

  <div class="quick2">
    <section class="card mini" data-test="savings">
      <h2>🏦 Savings</h2>
      ${sav.map((x) => `<div class="row between small"><span>${x.emoji} ${esc(x.name.replace(' fund', ''))}</span><b class="num">${money(x.total)}</b></div>`).join('')}
      <p class="muted tiny">Running total, all months</p>
    </section>
    <section class="card mini" data-test="cc">
      <h2>💳 Card due</h2>
      <p class="big2 num" data-test="cc-remaining">${money(cc.remaining)}</p>
      ${bar(cc.paid, cc.start, cc.remaining === 0 ? 'ok' : 'ok')}
      <p class="muted tiny">Paid ${money(cc.paid)} of ${money(cc.start)}</p>
    </section>
  </div>

  <section class="card">
    <div class="card-head"><h2>Last 6 months</h2><span class="muted small legend"><i class="dash"></i> budget</span></div>
    ${chart(hist, s.limit)}
  </section>

  <section>
    <div class="section-head"><h2>${state.cat ? `${budget.cat(state.cat).emoji} ${esc(budget.cat(state.cat).name)}` : 'All spends'}</h2>
      ${state.cat ? `<button class="btn small ghost" data-act="filter" data-cat="${state.cat}">Show all</button>` : `<span class="muted small">${all.length} entries</span>`}</div>
    <div data-test="entries">${entriesGrouped(shown)}</div>
  </section>`;
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
    else if (act === 'filter') { state.cat = state.cat === t.dataset.cat ? null : t.dataset.cat; rerender(); }
    else if (act === 'csv') {
      download(`kozy-${state.mk}.csv`, '﻿' + budget.monthCsv(state.mk), 'text/csv;charset=utf-8');
      toast(`Exported ${monthName(state.mk)} ✓`);
    }
  });
}

export function reset() {
  state.mk = monthKey();
  state.cat = null;
}
