// SETTINGS — folding sections. Setup (limits, bills, goals, card, milk, reset) is owner-only;
// members and viewers see it read-only.
import * as store from '../store.js';
import * as budget from '../logic/budget.js';
import * as milk from '../logic/milk.js';
import { loadDemo } from '../logic/demo.js';
import { ensureItems, items } from '../logic/stock.js';
import { ensureBills } from '../logic/budget.js';
import { money, esc, today, dayLabel } from '../logic/format.js';
import { icon, toast, confirmSheet, download } from '../ui.js';
import { header } from './common.js';
import { openItemForm } from './stock.js';
import { APP_VERSION, USE_FIREBASE } from '../config.js';

const EMOJIS = ['🧾', '🎓', '💊', '🚗', '🎁', '👕', '🍽️', '📚', '🐄', '🛠️'];
const openSections = new Set(); // all folded at first: short screen, open what you need

function section(key, title, body, extra = '') {
  return `<details class="card fold" data-sec="${key}" ${openSections.has(key) ? 'open' : ''}>
    <summary><span>${title}</span><span class="muted small">${extra}</span></summary>
    <div class="fold-body">${body}</div>
  </details>`;
}

function limitsBody(owner) {
  const cs = budget.cats();
  return `<form data-form="cats" class="stack-s">
    ${cs.map((c, i) => `<div class="limit-row" data-i="${i}">
      <input class="input emo-in" name="emoji" value="${esc(c.emoji)}" aria-label="Emoji" maxlength="4" ${owner ? '' : 'disabled'}>
      <input class="input grow" name="name" value="${esc(c.name)}" aria-label="Category name" ${owner ? '' : 'disabled'}>
      <input class="input num lim" name="limit" type="number" inputmode="numeric" min="0" step="100" value="${c.limit}" aria-label="${esc(c.name)} limit" ${owner ? '' : 'disabled'}>
      ${owner ? `<button type="button" class="icon-btn" data-act="cat-del" data-i="${i}" aria-label="Delete ${esc(c.name)}">${icon('trash')}</button>` : ''}
    </div>`).join('')}
    <p class="muted tiny">Limit 0 = no monthly limit (good for yearly bills).</p>
    ${owner ? `<div class="row gap">
      <button type="button" class="btn ghost grow" data-act="cat-add">${icon('plus')} Category</button>
      <button type="submit" class="btn primary grow">Save limits</button>
    </div>` : ''}
  </form>`;
}

function billsBody(owner) {
  const cs = budget.cats();
  return `<div class="stack-s" data-test="bills">
    ${budget.bills().map((b) => {
      const due = budget.nextDue(b);
      return `<details class="bill-item ${b.active ? '' : 'paused'}" data-bill="${b.id}">
        <summary>
          <span class="emo-badge">${b.emoji || '🧾'}</span>
          <span class="grow"><b>${esc(b.name)}</b>
            <span class="muted small block">${b.active ? `${b.amount ? money(b.amount) : '₹ —'} · ${esc(budget.FREQS[b.freq]?.label || '')}${b.freq === 'days' ? ` (${b.everyDays})` : ''} · next ${dayLabel(due)}` : 'Paused · tap to set up'}</span></span>
        </summary>
        <form class="stack-s bill-form" data-form="bill" data-id="${b.id}">
          <div class="row gap-s">
            <input class="input emo-in" name="emoji" value="${esc(b.emoji || '🧾')}" maxlength="4" aria-label="Emoji" ${owner ? '' : 'disabled'}>
            <input class="input grow" name="name" value="${esc(b.name)}" aria-label="Bill name" ${owner ? '' : 'disabled'}>
            <input class="input num lim" name="amount" type="number" inputmode="numeric" min="0" value="${b.amount || ''}" placeholder="₹" aria-label="Amount" ${owner ? '' : 'disabled'}>
          </div>
          <div class="row gap-s">
            <select class="input grow" name="freq" aria-label="Repeats" ${owner ? '' : 'disabled'}>${Object.entries(budget.FREQS).map(([k, f]) => `<option value="${k}" ${k === b.freq ? 'selected' : ''}>${f.label}</option>`).join('')}</select>
            <input class="input num lim" name="everyDays" type="number" min="1" value="${b.everyDays || ''}" placeholder="days" aria-label="Every N days" ${owner ? '' : 'disabled'}>
          </div>
          <div class="row gap-s">
            <label class="field grow"><span>Next due</span><input class="input" name="due" type="date" value="${due}" ${owner ? '' : 'disabled'}></label>
            <label class="field"><span>Remind</span><select class="input" name="remind" ${owner ? '' : 'disabled'}>${[1, 3, 5, 7, 15, 30].map((d) => `<option value="${d}" ${Number(b.remind ?? 3) === d ? 'selected' : ''}>${d}d before</option>`).join('')}</select></label>
          </div>
          <select class="input" name="cat" aria-label="Category" ${owner ? '' : 'disabled'}>${cs.map((c) => `<option value="${c.id}" ${c.id === b.cat ? 'selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join('')}</select>
          ${owner ? `<label class="switch"><input type="checkbox" name="active" ${b.active ? 'checked' : ''}> Active</label>
          <div class="row gap">
            <button type="button" class="btn ghost danger-text" data-act="bill-del" data-id="${b.id}" aria-label="Delete bill">${icon('trash')}</button>
            <button type="submit" class="btn primary grow">Save bill</button>
          </div>` : ''}
        </form>
      </details>`;
    }).join('')}
    ${owner ? `<button type="button" class="btn ghost" data-act="bill-add">${icon('plus')} Add bill</button>` : ''}
  </div>`;
}

function goalsBody(owner) {
  const cs = budget.cats();
  const gs = budget.goals();
  return `<div class="stack-s" data-test="goals-settings">
    ${gs.map((g) => `<div class="goal-row">
      <span>${g.emoji || '🎯'} <b>${esc(g.name)}</b> <span class="muted small">${money(g.saved)} / ${money(g.target)}${g.by ? ` · by ${dayLabel(g.by)}` : ''} · ${esc(budget.cat(g.cat).name)}</span></span>
      ${owner ? `<button class="icon-btn" data-act="goal-del" data-id="${g.id}" aria-label="Delete goal">${icon('trash')}</button>` : ''}
    </div>`).join('') || '<p class="muted small">No goals yet.</p>'}
    ${owner ? `<form class="stack-s" data-form="goal">
      <div class="row gap-s">
        <input class="input emo-in" name="emoji" value="🎯" maxlength="4" aria-label="Emoji">
        <input class="input grow" name="name" placeholder="Goal (e.g. Diwali)" aria-label="Goal name" required>
        <input class="input num lim" name="target" type="number" inputmode="numeric" min="0" placeholder="₹" aria-label="Target" required>
      </div>
      <div class="row gap-s">
        <select class="input grow" name="cat" aria-label="Counts money in">${cs.map((c) => `<option value="${c.id}" ${c.id === 'festival' ? 'selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join('')}</select>
        <input class="input date" name="by" type="date" aria-label="By date">
      </div>
      <p class="muted tiny">Progress = money added to that category from today on.</p>
      <button class="btn primary" type="submit">${icon('plus')} Add goal</button>
    </form>` : ''}
  </div>`;
}

export function render() {
  const owner = store.isOwner();
  const ms = milk.settings();
  const adapter = store.getAdapter();
  const fire = adapter?.name === 'firestore';
  const roleName = { owner: 'Owner (full access)', member: 'Member (adds spends, stock, milk)', viewer: 'View only' }[store.role()] || '';
  return `
  ${header('Settings', `Budget ${money(budget.totalLimit())} / month`)}

  ${section('limits', '💰 Monthly limits', limitsBody(owner), `<span data-total>${money(budget.totalLimit())}</span>`)}
  ${section('bills', '🔁 Bills & repeats', billsBody(owner), `${budget.bills().filter((b) => b.active).length} active`)}
  ${section('goals', '🎯 Goals', goalsBody(owner), `${budget.goals().length}`)}
  ${section('money', '💳 Card due · 🥛 Milk', `
    <form data-form="cc" class="row gap align-end">
      <label class="field grow"><span>Card starting due ₹</span><input class="input" name="start" type="number" inputmode="numeric" min="0" value="${store.meta('ccStart', budget.DEFAULT_CC_START)}" ${owner ? '' : 'disabled'}></label>
      ${owner ? '<button class="btn primary" type="submit">Save</button>' : ''}
    </form>
    <form data-form="milk" class="row gap align-end">
      <label class="field grow"><span>Milk L/day</span><input class="input" name="litres" type="number" step="0.5" min="0" inputmode="decimal" value="${ms.litres}" ${owner ? '' : 'disabled'}></label>
      <label class="field grow"><span>₹/litre</span><input class="input" name="rate" type="number" min="0" inputmode="decimal" value="${ms.rate}" ${owner ? '' : 'disabled'}></label>
      ${owner ? '<button class="btn primary" type="submit">Save</button>' : ''}
    </form>`)}
  ${section('items', '🧺 Items', `
    <div class="row gap">
      ${store.canWrite() ? `<button class="btn ghost grow" data-act="item-add">${icon('plus')} Kitchen item</button>
      <button class="btn ghost grow" data-act="veg-add">${icon('plus')} Sabzi</button>` : ''}
    </div>
    <p class="muted tiny">Or type any name in the Stock search box → “Add”. Tap an item on Stock to edit, set its warning days or add a remark.</p>`,
    `${items('kitchen').length} + ${items('veg').length}`)}
  ${section('remind', '🔔 Reminders', `
    <p class="small">Kozy reminds about bills due, items running out and milk not ticked.</p>
    ${fire ? `<button class="btn primary" data-act="push" data-test="push">${icon('bell')} Turn on phone reminders</button>
      <p class="muted tiny">iPhone: first add Kozy to the Home Screen (Share → Add to Home Screen), open it from there, then tap this. Needs iOS 16.4+.</p>`
      : '<p class="muted tiny">Phone reminders work after switching to Firebase (see MORNING_REPORT.md). Until then the “Needs you” row on Home shows them.</p>'}`)}
  ${section('data', '🗂️ Data', `
    <div class="stack-s">
      ${owner ? '<button class="btn ghost" data-act="demo">✨ Load demo data</button>' : ''}
      <div class="row gap">
        <button class="btn ghost grow" data-act="export">${icon('download')} Backup (JSON)</button>
        ${owner ? `<label class="btn ghost grow file-btn">${icon('upload')} Restore<input type="file" accept="application/json,.json" data-act="import" hidden></label>` : ''}
      </div>
      ${owner ? `<button class="btn danger-outline" data-act="reset">${icon('trash')} Reset all data</button>` : ''}
    </div>`)}
  ${section('account', '👤 Account', `
    <p class="small"><b>${esc(store.currentUserLabel())}</b> · ${roleName}</p>
    ${fire && adapter.isSignedIn?.() ? `<p class="small muted">${esc(adapter.userEmail())}</p>
      <button class="btn ghost" data-act="signout">Sign out</button>` : `
      <p class="small">Local mode: data is saved only in this browser.</p>
      <div class="row gap">
        <a class="btn ghost grow" href="?role=member#/home" data-test="preview-member">👀 Wife's view</a>
        <a class="btn ghost grow" href="?role=viewer#/home" data-test="preview-viewer">👀 View-only</a>
      </div>`}
    <p class="muted tiny">Kozy v${APP_VERSION} · ${fire ? 'Firebase' : 'Local'} storage</p>`, esc(store.currentUserLabel()))}`;
}

function readRows(form, fields) {
  return [...form.querySelectorAll('.limit-row')].map((row) => Object.fromEntries(fields.map((f) => [f, row.querySelector(`[name="${f}"]`).value])));
}

export function bind(root, rerender) {
  // remember which sections are open across re-renders
  root.addEventListener('toggle', (ev) => {
    const d = ev.target.closest?.('[data-sec]');
    if (d && ev.target === d) { if (d.open) openSections.add(d.dataset.sec); else openSections.delete(d.dataset.sec); }
  }, true);

  root.addEventListener('click', async (ev) => {
    const t = ev.target.closest('[data-act]');
    if (!t || t.tagName === 'INPUT') return;
    const act = t.dataset.act;
    if (act === 'cat-add') {
      const cs = [...budget.cats(), { id: `c${Date.now().toString(36)}`, name: 'New category', emoji: EMOJIS[budget.cats().length % EMOJIS.length], limit: 0 }];
      await store.setMeta('cats', cs);
    } else if (act === 'cat-del') {
      const cs = budget.cats();
      const c = cs[Number(t.dataset.i)];
      const used = store.list('entries').some((e) => e.cat === c.id);
      if (await confirmSheet({ title: `Delete ${esc(c.name)}?`, body: used ? 'Old spends in this category stay, but you can’t pick it any more.' : '', ok: 'Delete', danger: true })) {
        await store.setMeta('cats', cs.filter((x) => x.id !== c.id));
        toast('Category deleted');
      }
    } else if (act === 'bill-add') {
      const id = `b-${Date.now().toString(36)}`;
      await store.setMeta('bills', [...budget.bills(), { id, name: 'New bill', emoji: '🧾', cat: 'bills', amount: 0, freq: 'monthly', remind: 3, active: false, firstDue: today() }]);
      openSections.add('bills');
    } else if (act === 'bill-del') {
      const b = budget.bills().find((x) => x.id === t.dataset.id);
      if (await confirmSheet({ title: `Delete ${esc(b.name)}?`, body: 'Past payments stay in the budget.', ok: 'Delete', danger: true })) {
        await store.setMeta('bills', budget.bills().filter((x) => x.id !== b.id));
        toast('Bill deleted');
      }
    } else if (act === 'goal-del') {
      await store.setMeta('goals', store.meta('goals', []).filter((g) => g.id !== t.dataset.id));
      toast('Goal deleted');
    } else if (act === 'item-add') openItemForm(null, { kind: 'kitchen' });
    else if (act === 'veg-add') openItemForm(null, { kind: 'veg' });
    else if (act === 'push') {
      try {
        await store.getAdapter().enablePush();
        toast('Reminders on for this phone ✓');
      } catch (e) { toast(e.message, 'err'); }
    } else if (act === 'demo') {
      if (await confirmSheet({ title: 'Load demo data?', body: 'This <b>replaces all your data</b> with a 3-month sample. Make a backup first if needed.', ok: 'Load demo' })) {
        await loadDemo();
        toast('Demo data loaded ✓');
        location.hash = '#/home';
      }
    } else if (act === 'export') {
      download(`kozy-backup-${today()}.json`, JSON.stringify(store.exportAll(), null, 1), 'application/json');
      toast('Backup saved ✓');
    } else if (act === 'reset') {
      if (await confirmSheet({ title: 'Reset ALL data?', body: 'Every spend, stock record, milk day and setting is deleted. <b>This cannot be undone.</b>', ok: 'Yes, delete everything', danger: true })) {
        await store.clearAll();
        await ensureItems();
        await ensureBills();
        toast('All data reset');
        location.hash = '#/home';
      }
    } else if (act === 'signout') {
      await store.getAdapter().signOut();
      location.reload();
    }
  });

  root.addEventListener('change', async (ev) => {
    if (ev.target.dataset.act !== 'import') return;
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (await confirmSheet({ title: 'Restore this backup?', body: `This replaces all current data with <b>${esc(file.name)}</b>.`, ok: 'Restore' })) {
        await store.importAll(data);
        await ensureItems();
        await ensureBills();
        toast('Backup restored ✓');
      }
    } catch (e) {
      toast(`Could not restore: ${e.message}`, 'err');
    }
    ev.target.value = '';
  });

  root.addEventListener('input', (ev) => {
    if (ev.target.name === 'limit') {
      const sum = [...root.querySelectorAll('[name="limit"]')].reduce((s, i) => s + (Number(i.value) || 0), 0);
      const el = root.querySelector('[data-total]');
      if (el) el.textContent = money(sum);
    }
  });

  root.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const kind = f.dataset.form;
    if (kind === 'cats') {
      const rows = readRows(f, ['emoji', 'name', 'limit']);
      const cs = budget.cats().map((c, i) => ({ ...c, emoji: rows[i].emoji.trim() || '•', name: rows[i].name.trim() || c.name, limit: Number(rows[i].limit) || 0 }));
      await store.setMeta('cats', cs);
      toast(`Limits saved · ${money(budget.totalLimit())}/month ✓`);
    } else if (kind === 'bill') {
      const id = f.dataset.id;
      const due = f.elements.due.value || today();
      const list = budget.bills().map((b) => (b.id !== id ? b : {
        ...b, emoji: f.elements.emoji.value.trim() || '🧾', name: f.elements.name.value.trim() || b.name, amount: Number(f.elements.amount.value) || 0,
        freq: f.elements.freq.value, everyDays: Number(f.elements.everyDays.value) || undefined, remind: Number(f.elements.remind.value), cat: f.elements.cat.value,
        active: f.elements.active.checked, firstDue: due,
      }));
      await store.setMeta('bills', list);
      const st = { ...store.meta('billState', {}) };
      st[id] = { ...(st[id] || {}), due };
      await store.setMeta('billState', st);
      toast('Bill saved ✓');
    } else if (kind === 'goal') {
      const g = { id: `g-${Date.now().toString(36)}`, name: f.elements.name.value.trim(), emoji: f.elements.emoji.value.trim() || '🎯', target: Number(f.elements.target.value) || 0, cat: f.elements.cat.value, by: f.elements.by.value || null, start: today() };
      if (!g.name || !g.target) { toast('Enter goal name and amount', 'err'); return; }
      await store.setMeta('goals', [...store.meta('goals', []), g]);
      toast(`Goal “${g.name}” added ✓`);
    } else if (kind === 'cc') {
      await store.setMeta('ccStart', Number(f.start.value) || 0);
      toast('Card due saved ✓');
    } else if (kind === 'milk') {
      await milk.saveSettings({ litres: Number(f.litres.value) || 0, rate: Number(f.rate.value) || 0 });
      toast('Milk settings saved ✓');
    }
    rerender();
  });
}
