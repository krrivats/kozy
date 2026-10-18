// Bits of markup used by more than one screen.
import * as store from '../store.js';
import { cat } from '../logic/budget.js';
import { money, esc, relDay, monthName, ago } from '../logic/format.js';
import { icon } from '../ui.js';

export function entryRow(e) {
  const c = cat(e.cat);
  const tag = e.source === 'stock' ? '<span class="tag">stock</span>'
    : e.source === 'bill' || e.source === 'recurring' ? '<span class="tag">bill</span>'
    : e.source === 'milk' ? '<span class="tag">milk</span>' : '';
  return `<button class="entry" data-entry="${e.id}">
    <span class="emo-badge">${c.emoji}</span>
    <span class="entry-main">
      <span class="entry-title">${esc(e.note || c.name)} ${tag}</span>
      <span class="entry-sub">${esc(c.name)} · ${esc(e.mode)} · ${esc(e.by || 'Me')}</span>
    </span>
    <span class="entry-amt">${money(e.amount)}</span>
  </button>`;
}

export function entriesGrouped(list) {
  if (!list.length) return '<p class="empty">No spends here.</p>';
  const groups = new Map();
  for (const e of list) {
    if (!groups.has(e.date)) groups.set(e.date, []);
    groups.get(e.date).push(e);
  }
  return [...groups.entries()].map(([date, es]) => `
    <div class="day-group">
      <div class="day-head"><span>${relDay(date)}</span><span>${money(es.reduce((s, e) => s + Number(e.amount), 0))}</span></div>
      <div class="list">${es.map(entryRow).join('')}</div>
    </div>`).join('');
}

// Tap a row to edit what it shows (spend, purchase, finished record or milk day).
export function activityRow(a) {
  const kind = a.kind === 'spend' ? 'spend' : a.kind === 'milk' ? 'milk' : 'stock';
  return `<button class="act-row" data-kind="${a.kind}" data-open="${kind}" data-ref="${esc(a.ref)}">
    <span class="act-emo">${a.emoji}</span>
    <span class="grow act-text"><b>${esc(a.who)}</b> ${esc(a.text)}</span>
    <span class="act-time">${ago(a.t)}</span>
  </button>`;
}

export function monthSwitch(mk, act = 'month') {
  return `<div class="month-switch">
    <button class="icon-btn" data-act="${act}-prev" aria-label="Previous month">${icon('left')}</button>
    <span class="month-label">${monthName(mk)}</span>
    <button class="icon-btn" data-act="${act}-next" aria-label="Next month">${icon('right')}</button>
  </div>`;
}

// Sync dot: only in Firebase mode. Green = saved to cloud, amber = saving / offline.
export function syncDot() {
  if (store.getAdapter()?.name !== 'firestore') return '';
  const busy = store.pending() > 0 || !navigator.onLine;
  return `<span class="sync ${busy ? 'busy' : ''}" title="${busy ? 'Saving…' : 'Synced'}" aria-label="${busy ? 'Saving' : 'Synced'}" data-sync></span>`;
}

export function header(title, sub = '', right = '') {
  return `<header class="top">
    <div><h1>${title} ${syncDot()}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>
    <div class="top-right">${right}</div>
  </header>`;
}

export function roleBadge() {
  const r = store.role();
  return r === 'viewer' ? '<span class="who-chip view">View only</span>' : `<span class="who-chip">${esc(store.currentUserLabel())}</span>`;
}
