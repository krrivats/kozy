// BUDGET — three views: Categories (grid, goals, savings, card, chart) · Spends (who / category filter) · Summary.
import * as budget from '../logic/budget.js';
import * as store from '../store.js';
import * as milk from '../logic/milk.js';
import { vegMovers } from '../logic/stock.js';
import { money, moneyShort, monthKey, shiftMonth, esc, monthName, monthShortName, pct, number, dayLabel } from '../logic/format.js';
import { icon, bar, download, toast } from '../ui.js';
import { entriesGrouped, monthSwitch, header, entryRow } from './common.js';
import { openSpendSheet } from './spend-sheet.js';
import { openVegSheet } from './stock.js';
import { openSheet, closeSheet, confirmSheet } from '../ui.js';

const state = { mk: monthKey(), cat: null, who: null, view: 'cats', fy: budget.fyOf(), fam: null };

function insightsCard(list, max = 9) {
  if (!list.length) return '';
  return `<section class="card tight insights" data-test="insights">
    ${list.slice(0, max).map((i) => `<p class="ins ${i.level}">💡 ${esc(i.text)}</p>`).join('')}
  </section>`;
}

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
  const ins = budget.insights(state.mk).filter((i) => i.id !== 'usual');
  const sav = budget.savings();
  const gs = budget.goals();
  return `
  ${insightsCard(ins, 2)}
  <section class="cat-grid2" data-test="cats">
    ${budget.cats().map((c) => {
      const spent = s.by[c.id] || 0;
      const lvl = budget.level(spent, c.limit);
      return `<button class="ctile" data-act="filter" data-cat="${c.id}" data-level="${lvl}">
        <span class="ctile-top"><span class="ctile-emo">${c.emoji}</span><span class="ctile-name">${esc(c.name)}</span></span>
        <span class="num ${lvl}"><b>${money(spent)}</b><span class="muted"> / ${c.limit ? moneyShort(c.limit) : 'no limit'}</span></span>
        ${bar(spent, c.limit, lvl)}
      </button>`;
    }).join('')}
  </section>

  ${gs.length ? `<section class="card tight" data-test="goals">
    <div class="card-head"><h2>🎯 Goals</h2></div>
    ${gs.map((g) => `<button class="cat-mini edit-row" data-act="goal" data-id="${g.id}">
      <span class="row between"><span>${g.emoji || '🎯'} ${esc(g.name)}${g.by ? `<span class="muted small"> · by ${dayLabel(g.by)}</span>` : ''}</span>
        <span class="num"><b>${money(g.saved)}</b><span class="muted"> / ${money(g.target)}</span></span></span>
      ${bar(g.saved, g.target, 'ok')}
    </button>`).join('')}
  </section>` : ''}

  <section class="card mini" data-test="savings">
      <h2>🏦 Savings</h2>
      ${sav.map((x) => `<button class="row between small go-row" data-act="filter" data-cat="${x.id}"><span>${x.emoji} ${esc(x.name.replace(' fund', ''))}</span><b class="num">${money(x.total)}</b></button>`).join('')}
  </section>

  <section class="card tight">
    <div class="card-head"><h2>Last 6 months</h2><span class="muted small legend"><i class="dash"></i> budget</span></div>
    ${chart(budget.history(6, state.mk), s.limit)}
  </section>`;
}

function spendsView() {
  const all = budget.entriesFor(state.mk);
  const people = [...new Set(all.map((e) => e.by || 'Me'))];
  const shown = all.filter((e) => (!state.cat || e.cat === state.cat) && (!state.who || (e.by || 'Me') === state.who)
    && (!state.fam || budget.mentionsName(e.note, state.fam)));
  const total = shown.reduce((s, e) => s + Number(e.amount), 0);
  return `
  <div class="filters">
    <div class="seg small">
      <button class="${!state.who ? 'on' : ''}" data-act="who" data-who="">All</button>
      ${people.map((p) => `<button class="${state.who === p ? 'on' : ''}" data-act="who" data-who="${esc(p)}">${esc(p)}</button>`).join('')}
    </div>
    ${state.cat ? `<button class="chip-btn" data-act="filter" data-cat="${state.cat}">${budget.cat(state.cat).emoji} ${esc(budget.cat(state.cat).name)} ${icon('x')}</button>` : ''}
    ${state.fam ? `<button class="chip-btn" data-act="fam" data-fam="">👪 ${esc(state.fam)} ${icon('x')}</button>` : ''}
  </div>
  <p class="muted small total-line">${shown.length} spends · <b>${money(total)}</b></p>
  <div data-test="entries">${entriesGrouped(shown)}</div>`;
}

function summaryView() {
  const m = budget.monthSummary(state.mk);
  const ml = milk.month(state.mk);
  const movers = vegMovers(5);
  const peopleTotal = Object.values(m.people).reduce((s, v) => s + v, 0) || 1;
  const famTotal = m.family.reduce((s, f) => s + f.total, 0) || 1;
  return `
  ${insightsCard(budget.insights(state.mk))}
  <section class="card tight" data-test="summary">
    <div class="sum3">
      <div><span class="k">Spent</span><span class="v">${money(m.spent)}</span></div>
      <div><span class="k">vs ${monthShortName(m.prevMk)}</span><span class="v ${m.change > 0 ? 'over' : 'okv'}">${m.change > 0 ? '+' : ''}${money(m.change)}</span></div>
      <div><span class="k">Saved</span><span class="v">${money(m.saved)}</span></div>
    </div>
  </section>

  <section class="card tight" data-test="who-spent">
    <div class="card-head"><h2>👥 Who spent</h2></div>
    ${Object.entries(m.people).sort((a, b) => b[1] - a[1]).map(([who, amt]) => `<button class="cat-mini go-row" data-act="who" data-who="${esc(who)}">
      <span class="row between"><span>${esc(who)}</span><span class="num"><b>${money(amt)}</b><span class="muted"> · ${Math.round((amt / peopleTotal) * 100)}%</span></span></span>
      ${bar(amt, peopleTotal, 'ok')}</button>`).join('') || '<p class="empty">No spends.</p>'}
  </section>

  ${m.family.length ? `<section class="card tight" data-test="family">
    <div class="card-head"><h2>👪 Family</h2><span class="muted small">names in notes</span></div>
    ${m.family.map((f) => `<button class="mv-row fam-row" data-act="fam" data-fam="${esc(f.name)}">
      <span>${esc(f.name)} <span class="muted small">· ${f.count}</span></span><span class="num"><b>${money(f.total)}</b></span>
    </button>`).join('')}
  </section>` : ''}

  <section class="card tight">
    <div class="card-head"><h2>📊 vs last month</h2></div>
    <div class="list">${m.rows.slice(0, 6).map((r) => `<button class="mv-row go-row" data-act="filter" data-cat="${r.id}">
      <span>${r.emoji} ${esc(r.name)}</span>
      <span class="num">${money(r.spent)} <span class="${r.diff > 0 ? 'over-text' : 'ok-text'} small">${r.diff > 0 ? '▲' : r.diff < 0 ? '▼' : ''} ${r.diff ? money(Math.abs(r.diff)) : '='}</span></span>
    </button>`).join('') || '<p class="empty">Nothing to compare.</p>'}</div>
  </section>

  ${movers.length ? `<section class="card tight" data-test="veg-movers">
    <div class="card-head"><h2>🥬 Sabzi prices</h2><span class="muted small">vs last buy</span></div>
    <div class="list">${movers.map(({ item, stats }) => `<button class="mv-row edit-row" data-act="veg-open" data-id="${item.id}">
      <span>${item.emoji} ${esc(item.en)} <span class="hi">${esc(item.hi)}</span></span>
      <span class="num">${money(stats.last.rate)}/${esc(item.unit)} <span class="${stats.change > 0 ? 'over-text' : 'ok-text'} small">${stats.change > 0 ? '▲' : '▼'} ${pct(stats.change)}</span></span>
    </button>`).join('')}</div>
  </section>` : ''}

  <section class="card tight">
    <div class="card-head"><h2>🔝 Biggest spends</h2></div>
    <div class="list">${m.biggest.map(entryRow).join('') || '<p class="empty">No spends.</p>'}</div>
  </section>

  <a class="card tight go-row milk-link" href="#/milk">
    <span class="row between"><span>🥛 Milk ${monthName(state.mk)}</span><span class="num"><b>${number(ml.litres)} L</b> · ${money(ml.amount)}</span></span>
  </a>`;
}

function yearView() {
  const y = budget.yearSummary(state.fy);
  const hist = y.months;
  return `
  <div class="month-switch">
    <button class="icon-btn" data-act="fy-prev" aria-label="Previous year">${icon('left')}</button>
    <span class="month-label" data-test="fy">${y.label} <span class="muted small">Apr–Mar</span></span>
    <button class="icon-btn" data-act="fy-next" aria-label="Next year">${icon('right')}</button>
  </div>
  <section class="card tight" data-test="year">
    <div class="sum3">
      <div><span class="k">Spent</span><span class="v">${money(y.total)}</span></div>
      <div><span class="k">Avg / month</span><span class="v">${money(y.avg)}</span></div>
      <div><span class="k">Budget / month</span><span class="v">${money(y.budget)}</span></div>
    </div>
    ${chart(hist.map((h) => ({ ...h, label: h.label.slice(0, 1) })), y.budget)}
    ${y.highest?.spent ? `<p class="muted tiny">Highest: ${monthName(y.highest.mk)} · ${money(y.highest.spent)} · ${y.counted} month${y.counted > 1 ? 's' : ''} with spends</p>` : ''}
  </section>
  <section class="card tight">
    <div class="card-head"><h2>By category</h2><span class="muted small">total · per month</span></div>
    <div class="list">${y.catRows.map((c) => `<button class="mv-row go-row" data-act="filter" data-cat="${c.id}">
      <span>${c.emoji} ${esc(c.name)}</span>
      <span class="num"><b>${money(c.total)}</b> <span class="muted small">· ${money(c.avg)}</span></span>
    </button>`).join('') || '<p class="empty">No spends in this year yet.</p>'}</div>
  </section>`;
}

export function render() {
  const s = budget.summary(state.mk);
  const views = [['cats', 'Overview'], ['spends', 'Spends'], ['summary', 'Summary'], ['year', 'Year']];
  return `
  ${header('Budget', `${money(s.spent)} of ${money(s.limit)} · ${money(s.left)} left`,
    `<button class="icon-btn" data-act="csv" aria-label="Export month to CSV" title="Export CSV">${icon('download')}</button>`)}
  <div class="seg views" role="tablist">
    ${views.map(([k, l]) => `<button class="${state.view === k ? 'on' : ''}" data-act="view" data-view="${k}" role="tab" aria-selected="${state.view === k}">${l}</button>`).join('')}
  </div>
  ${state.view === 'year' ? yearView() : `${monthSwitch(state.mk)}
  ${state.view === 'cats' ? catsView(s) : state.view === 'spends' ? spendsView() : summaryView()}`}`;
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
    else if (act === 'fy-prev') { state.fy -= 1; rerender(); }
    else if (act === 'fy-next') { state.fy += 1; rerender(); }
    else if (act === 'fam') { state.fam = t.dataset.fam || null; state.view = 'spends'; rerender(); }
    else if (act === 'goal') goalSheet(t.dataset.id);
    else if (act === 'veg-open') { const it = store.get('items', t.dataset.id); if (it) openVegSheet(it); }
    else if (act === 'filter') {
      state.cat = state.cat === t.dataset.cat ? null : t.dataset.cat;
      state.view = 'spends';
      rerender();
    } else if (act === 'who') {
      state.who = t.dataset.who || null;
      if (t.closest('[data-test="who-spent"]')) state.view = 'spends';
      rerender();
    }
    else if (act === 'csv') {
      download(`kozy-${state.mk}.csv`, '﻿' + budget.monthCsv(state.mk), 'text/csv;charset=utf-8');
      toast(`Exported ${monthName(state.mk)} ✓`);
    }
  });
}

// Edit a goal (owner); others see it read-only.
function goalSheet(id) {
  const g = budget.goals().find((x) => x.id === id);
  if (!g) return;
  const owner = store.isOwner();
  const dis = owner ? '' : 'disabled';
  const el = openSheet(`
    <form class="stack" data-test="goal-edit" novalidate>
      <h2 class="sheet-title">${g.emoji || '🎯'} ${esc(g.name)}</h2>
      <p class="small">${money(g.saved)} of ${money(g.target)}${g.daysLeft != null ? ` · ${g.daysLeft} days left` : ''}</p>
      <div class="row gap">
        <input class="input emo-in" name="emoji" value="${esc(g.emoji || '🎯')}" maxlength="4" aria-label="Emoji" ${dis}>
        <input class="input grow" name="gname" value="${esc(g.name)}" aria-label="Goal name" ${dis}>
      </div>
      <div class="row gap">
        <label class="field grow"><span>Target ₹</span><input class="input" name="target" type="number" inputmode="numeric" min="0" value="${g.target}" ${dis}></label>
        <label class="field grow"><span>By</span><input class="input" name="by" type="date" value="${g.by || ''}" ${dis}></label>
      </div>
      <label class="field"><span>Counts money added to</span><select class="input" name="cat" ${dis}>${budget.cats().map((c) => `<option value="${c.id}" ${c.id === g.cat ? 'selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join('')}</select></label>
      ${owner ? `<div class="row gap"><button type="button" class="btn ghost danger-text" data-del>${icon('trash')}</button>
        <button class="btn primary grow" type="submit" data-save>Save goal</button></div>` : '<p class="muted small">Only the owner can change goals.</p>'}
    </form>`);
  const f = el.querySelector('form');
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const list = store.meta('goals', []).map((x) => (x.id !== id ? x : {
      ...x, emoji: f.elements.emoji.value.trim() || '🎯', name: f.elements.gname.value.trim() || x.name,
      target: Number(f.elements.target.value) || 0, by: f.elements.by.value || null, cat: f.elements.cat.value,
    }));
    await store.setMeta('goals', list);
    closeSheet(true);
    toast('Goal saved ✓');
  });
  f.querySelector('[data-del]')?.addEventListener('click', async () => {
    closeSheet(true);
    if (await confirmSheet({ title: `Delete goal “${esc(g.name)}”?`, body: 'The money already added stays in its category.', ok: 'Delete', danger: true })) {
      const before = store.meta('goals', []);
      await store.setMeta('goals', before.filter((x) => x.id !== id));
      toast('Goal deleted', { undo: () => store.setMeta('goals', before) });
    }
  });
}

export function reset() {
  Object.assign(state, { mk: monthKey(), cat: null, who: null, view: 'cats' });
}
