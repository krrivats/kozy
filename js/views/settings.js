// SETTINGS — folding sections. Setup (limits, bills, goals, milk, reset) is admin-only;
// editors and viewers see it read-only. 👥 Household (Firebase mode only) is in team.js.
import * as store from '../store.js';
import * as budget from '../logic/budget.js';
import * as milk from '../logic/milk.js';
import { loadDemo } from '../logic/demo.js';
import { ensureItems, items } from '../logic/stock.js';
import { ensureBills } from '../logic/budget.js';
import { money, moneyShort, esc, today, dayLabel } from '../logic/format.js';
import { icon, toast, confirmSheet, download, bar, savedTheme, applyTheme, openSheet, closeSheet } from '../ui.js';
import { header } from './common.js';
import { openItemForm } from './stock.js';
import { typesEditor, readTypes, wireTypesEditor } from './milk.js';
import { APP_VERSION } from '../config.js';
import { teamBody, loadTeam, bindTeam } from './team.js';

const EMOJIS = ['🧾', '🎓', '💊', '🚗', '🎁', '👕', '🍽️', '📚', '🐄', '🛠️'];
const openSections = new Set(); // all folded at first: short screen, open what you need

function section(key, title, body, extra = '') {
  return `<details class="card fold" data-sec="${key}" ${openSections.has(key) ? 'open' : ''}>
    <summary><span>${title}</span><span class="muted small">${extra}</span></summary>
    <div class="fold-body">${body}</div>
  </details>`;
}

function allocLine(total, alloc) {
  const left = total - alloc;
  const lvl = left < 0 ? 'over' : left === 0 ? 'ok' : 'warn';
  return `<div class="alloc" data-alloc>
    <div class="row between small"><span>Given to categories <b>${money(alloc)}</b></span>
      <span class="${lvl === 'over' ? 'over-text' : lvl === 'ok' ? 'ok-text' : ''}">${left === 0 ? 'All assigned ✓' : left > 0 ? `${money(left)} left to assign` : `${money(-left)} over budget`}</span></div>
    ${bar(alloc, total, lvl === 'over' ? 'over' : 'ok')}
  </div>`;
}

function limitsBody(owner) {
  const cs = budget.cats();
  const a = budget.allocation();
  const usual = Object.fromEntries(cs.map((c) => [c.id, budget.usual(c.id)]));
  const hasUsual = Object.values(usual).some((v) => v > 0);
  return `<form data-form="cats" class="stack-s">
    <label class="field budget-total"><span>Monthly budget ₹ (what you plan to spend at home)</span>
      <input class="input num" name="budgetTotal" type="number" inputmode="numeric" min="0" step="500" value="${a.total}" data-test="budget-total"
        data-auto="${store.meta('budgetTotal', 0) ? '0' : '1'}" ${owner ? '' : 'disabled'}></label>
    <p class="muted tiny">Until you type a budget here it simply follows the total of your category limits.</p>
    ${allocLine(a.total, a.alloc)}
    ${cs.map((c, i) => `<div class="limit-row" data-i="${i}">
      <input class="input emo-in" name="emoji" value="${esc(c.emoji)}" aria-label="Emoji" maxlength="4" ${owner ? '' : 'disabled'}>
      <input class="input grow" name="name" value="${esc(c.name)}" aria-label="Category name" ${owner ? '' : 'disabled'}>
      <span class="usual" title="Your usual monthly spend (last 3 months)">${usual[c.id] ? `usual ${moneyShort(usual[c.id])}` : ''}</span>
      <input class="input num lim" name="limit" type="number" inputmode="numeric" min="0" step="100" value="${c.limit}" aria-label="${esc(c.name)} limit" data-usual="${Math.ceil(usual[c.id] / 100) * 100}" ${owner ? '' : 'disabled'}>
      ${owner ? `<button type="button" class="icon-btn" data-act="cat-del" data-i="${i}" aria-label="Delete ${esc(c.name)}">${icon('trash')}</button>` : ''}
    </div>`).join('')}
    <p class="muted tiny">Limits, bills and salary-day items carry over to every new month by themselves. Limit 0 = no monthly limit.</p>
    ${owner && hasUsual ? '<button type="button" class="btn ghost" data-act="use-usual" data-test="use-usual">💡 Set limits to my usual spend</button>' : ''}
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
          <span class="grow"><b>${esc(b.name)}</b>${b.group === 'checklist' ? ' <span class="tag">salary day</span>' : ''}
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
    ${owner ? `<div class="row gap">
      <button type="button" class="btn ghost grow" data-act="bill-add">${icon('plus')} Bill</button>
      <button type="button" class="btn ghost grow" data-act="check-add">${icon('plus')} Salary-day item</button>
    </div>` : ''}
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
  const roleName = { owner: 'Admin (full access)', member: 'Editor (adds and edits everything)', viewer: 'Viewer (view only)' }[store.role()] || '';
  return `
  ${header('Settings', `Budget ${money(budget.totalLimit())} / month`)}

  ${section('limits', '💰 Budget & limits', limitsBody(owner), `<span data-total>${money(budget.budgetTotal())}</span>`)}
  ${section('bills', '🔁 Bills & salary day', billsBody(owner), `${budget.bills().filter((b) => b.active).length} active`)}
  ${section('goals', '🎯 Goals', goalsBody(owner), `${budget.goals().length}`)}
  ${section('money', '🥛 Milk', `
    <form data-form="milk" class="stack-s">
      ${typesEditor(ms.types, !owner)}
      <p class="muted tiny">Each kind of milk keeps its own rate. A new rate applies from today; old days keep theirs.</p>
      ${owner ? '<button class="btn primary" type="submit">Save milk</button>' : ''}
    </form>`, milk.defaultLabel(ms.types))}
  ${section('family', '👪 Family names', `
    <form data-form="family" class="stack-s">
      <input class="input" name="family" value="${esc(budget.familyNames().join(', '))}" aria-label="Family names" ${owner ? '' : 'disabled'}>
      <p class="muted tiny">Write any of these names in a spend's note (e.g. “medicine papa 450”) and Budget → Summary shows how much went to each person.</p>
      ${owner ? '<button class="btn primary" type="submit">Save names</button>' : ''}
    </form>`, `${budget.familyNames().length}`)}
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
  ${section('look', '🎨 Appearance', `
    <div class="seg" role="radiogroup" aria-label="Appearance" data-test="theme">
      ${[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button type="button" class="${savedTheme() === k ? 'on' : ''}" data-act="theme" data-theme-v="${k}">${l}</button>`).join('')}
    </div>
    <p class="muted tiny">Auto follows your phone (light by day, dark at night). Saved on this phone only.</p>`, { auto: 'Auto', light: 'Light', dark: 'Dark' }[savedTheme()])}
  ${fire ? section('household', '👥 Household', teamBody(), esc(adapter.householdName || '')) : ''}
  ${section('account', '👤 Account', `
    <p class="small"><b>${esc(store.currentUserLabel())}</b> · ${roleName}</p>
    ${fire && adapter.isSignedIn?.() ? `<p class="small muted" data-test="acct-email">${esc(adapter.userEmail())}</p>
      <div class="row gap">
        ${adapter.hasPassword?.() === false
          ? '<button class="btn ghost grow" data-act="setpw" data-test="setpw">Set a password</button>'
          : '<button class="btn ghost grow" data-act="pwreset" data-test="pwreset">Change password</button>'}
        <button class="btn ghost grow" data-act="signout">Sign out</button>
      </div>
      <button class="btn link" data-act="delete-account" data-test="delete-account">Delete my account</button>` : `
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
  if (store.getAdapter()?.name === 'firestore') { bindTeam(root, rerender); loadTeam(rerender); }
  wireTypesEditor(root);
  // remember which sections are open across re-renders
  root.addEventListener('toggle', (ev) => {
    const d = ev.target.closest?.('[data-sec]');
    if (d && ev.target === d) { if (d.open) openSections.add(d.dataset.sec); else openSections.delete(d.dataset.sec); }
  }, true);

  // Remember open/closed at the tap itself (the "toggle" event comes a moment later; a re-render in between would close the section).
  root.addEventListener('click', (ev) => {
    const sum = ev.target.closest('summary');
    const d = sum?.closest('details[data-sec]');
    if (d) { if (!d.open) openSections.add(d.dataset.sec); else openSections.delete(d.dataset.sec); }
  });

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
    } else if (act === 'theme') {
      applyTheme(t.dataset.themeV);
      toast(`Appearance: ${t.textContent} ✓`);
      rerender();
    } else if (act === 'use-usual') {
      // Fill each limit with the usual spend (rounded up to ₹100); you review and tap Save.
      root.querySelectorAll('[name="limit"]').forEach((inp) => { if (Number(inp.dataset.usual) > 0) inp.value = inp.dataset.usual; });
      root.querySelector('[name="limit"]')?.dispatchEvent(new Event('input', { bubbles: true }));
      toast('Filled from your usual spend — check and tap Save limits');
    } else if (act === 'check-add') {
      const id = `c-${Date.now().toString(36)}`;
      await store.setMeta('bills', [...budget.bills(), { id, group: 'checklist', name: 'New salary-day item', emoji: '✅', cat: 'buffer', amount: 0, freq: 'monthly', remind: 0, active: false, firstDue: today() }]);
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
    } else if (act === 'setpw') {
      const a = store.getAdapter();
      const el = openSheet(`<h2 class="sheet-title">Set a password</h2>
        <p class="muted small">So <b>${esc(a.userEmail())}</b> can also sign in with email + password, for example in the Home Screen app. Google still works in Safari.</p>
        <form class="stack-s" data-pwform>
          <input class="input" name="pw" type="password" autocomplete="new-password" placeholder="New password (6+ letters)" aria-label="New password" required data-test="setpw-in">
          <p class="form-error" hidden></p>
          <button class="btn primary" type="submit" data-test="setpw-go">Save password</button>
        </form>`);
      el.querySelector('[data-pwform]').onsubmit = async (e2) => {
        e2.preventDefault();
        const err = el.querySelector('.form-error');
        try { await a.setPassword(e2.target.pw.value); closeSheet(true); toast('Password set ✓ Now use your email + password in the Home Screen app'); rerender(); } catch (x) { err.textContent = x.message; err.hidden = false; }
      };
    } else if (act === 'pwreset') {
      try {
        await store.getAdapter().sendReset(store.currentUserEmail());
        toast(`Reset link sent to ${store.currentUserEmail()} ✓`);
      } catch (e) { toast(e.message, 'err'); }
    } else if (act === 'delete-account') {
      const a = store.getAdapter();
      if (!a.signedInRecently()) { toast('For safety: sign out, sign in again, then tap Delete my account.', 'err'); return; }
      if (a.memberRole() === 'admin') {
        const others = (await a.listMembers()).filter((m) => m.email !== a.userEmail());
        if (others.length) { toast('Remove the other people first, or make one of them Admin and then leave.', 'err'); return; }
      }
      const alone = a.memberRole() === 'admin';
      if (await confirmSheet({ title: 'Delete my account?', body: alone ? `You are the only person here, so <b>${esc(a.householdName)}</b> and all its data are deleted too. This cannot be undone.` : 'You leave the household and your login is deleted. The household keeps its data. This cannot be undone.', ok: 'Delete everything', danger: true })) {
        try { await a.deleteAccount(); location.reload(); } catch (e) { toast(e.message, 'err'); }
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
    if (ev.target.name === 'limit' || ev.target.name === 'budgetTotal') {
      const sum = [...root.querySelectorAll('[name="limit"]')].reduce((s, i) => s + (Number(i.value) || 0), 0);
      const bt = root.querySelector('[name="budgetTotal"]');
      if (bt && ev.target === bt) bt.dataset.auto = '0'; // you typed your own budget
      if (bt && bt.dataset.auto === '1') bt.value = sum; // still automatic: follow the limits
      const total = Number(bt?.value) || sum;
      const el = root.querySelector('[data-alloc]');
      if (el) el.outerHTML = allocLine(total, sum);
      const t = root.querySelector('[data-total]');
      if (t) t.textContent = money(total);
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
      const bt = f.elements.budgetTotal;
      await store.setMeta('budgetTotal', bt.dataset.auto === '1' ? 0 : Number(bt.value) || 0);
      const a = budget.allocation();
      toast(`Budget ${money(a.total)} saved${a.left ? ` · ${a.left > 0 ? `${money(a.left)} not assigned` : `${money(-a.left)} over`}` : ' ✓'}`);
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
    } else if (kind === 'family') {
      const names = f.elements.family.value.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
      await store.setMeta('family', [...new Set(names)]);
      toast(`${names.length} family names saved ✓`);
    } else if (kind === 'cc') {
      await store.setMeta('ccStart', Number(f.start.value) || 0);
      toast('Card due saved ✓');
    } else if (kind === 'milk') {
      await milk.saveSettings({ types: readTypes(f) });
      toast('Milk settings saved ✓');
    }
    rerender();
  });
}
