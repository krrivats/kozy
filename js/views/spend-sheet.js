// Quick add / edit a spend. Opened by the floating "+" from any screen, or by tapping an entry.
// The ⚡ box on top understands "sabzi 250", "atta 10kg 420", "onion 5kg 50/kg", "auto 80 cash".
import * as store from '../store.js';
import { cats, cat, MODES, addEntry } from '../logic/budget.js';
import * as stock from '../logic/stock.js';
import { parse } from '../logic/quick.js';
import { today, esc, money, number } from '../logic/format.js';
import { openSheet, closeSheet, toast, confirmSheet, icon } from '../ui.js';

const LAST_MODE = 'kozy.lastMode';
function lastMode() { try { return localStorage.getItem(LAST_MODE) || 'UPI'; } catch { return 'UPI'; } }
function saveMode(m) { try { localStorage.setItem(LAST_MODE, m); } catch { /* private mode */ } }

export function openSpendSheet(entry = null, preset = {}) {
  const e = entry || { date: today(), mode: lastMode(), cat: preset.cat || '', amount: preset.amount || '', note: preset.note || '' };
  const isEdit = !!entry;
  const editable = !isEdit || store.canEdit(entry);
  const el = openSheet(`
    <form class="spend-form" novalidate>
      <div class="sheet-head">
        <h2 class="sheet-title">${isEdit ? (editable ? 'Edit spend' : 'Spend') : 'Add'}</h2>
        ${isEdit ? `<span class="muted small">by ${esc(e.by || 'Me')}</span>` : ''}
      </div>
      ${!isEdit ? `<label class="smart">
        ${icon('bolt')}
        <input name="smart" class="smart-in" placeholder="sabzi 250 · atta 10kg 420 · auto 80 cash" autocomplete="off" autocapitalize="off" aria-label="Smart quick add">
        <button type="button" class="scan-btn" data-scan aria-label="Scan a bill photo">📷</button>
      </label>
      <p class="smart-preview" data-preview hidden></p>` : ''}
      <label class="amount-field">
        <span>₹</span>
        <input name="amount" type="number" inputmode="decimal" min="0" step="any" placeholder="0"
          value="${esc(e.amount)}" ${isEdit ? 'autofocus' : ''} aria-label="Amount" required ${editable ? '' : 'readonly'}>
      </label>
      <div class="cat-grid" role="radiogroup" aria-label="Category">
        ${cats().map((c) => `
          <button type="button" class="cat-chip ${c.id === e.cat ? 'on' : ''}" data-cat="${c.id}" role="radio" aria-checked="${c.id === e.cat}" ${editable ? '' : 'disabled'}>
            <span class="emo">${c.emoji}</span><span class="nm">${esc(c.name)}</span>
          </button>`).join('')}
      </div>
      <div class="seg" role="radiogroup" aria-label="Mode">
        ${MODES.map((m) => `<button type="button" class="${m === e.mode ? 'on' : ''}" data-mode="${m}" ${editable ? '' : 'disabled'}>${m}</button>`).join('')}
      </div>
      <div class="row gap">
        <input name="note" class="input grow" placeholder="Note (optional)" value="${esc(e.note)}" aria-label="Note" ${editable ? '' : 'readonly'}>
        <input name="date" class="input date" type="date" value="${esc(e.date)}" aria-label="Date" ${editable ? '' : 'readonly'}>
      </div>
      <p class="form-error" hidden></p>
      ${editable ? `<div class="row gap">
        ${isEdit ? `<button type="button" class="btn ghost danger-text" data-del aria-label="Delete">${icon('trash')}</button>` : ''}
        <button type="submit" class="btn primary grow" data-save>${isEdit ? 'Save changes' : 'Add spend'}</button>
      </div>` : '<p class="muted small">Only the person who added this (or the owner) can change it.</p>'}
    </form>`);

  const form = el.querySelector('form');
  let selCat = e.cat;
  let selMode = e.mode || 'UPI';
  let smart = null; // parsed purchase (kind 'item'), saved instead of the form
  const err = form.querySelector('.form-error');
  const preview = form.querySelector('[data-preview]');
  const saveBtn = form.querySelector('[data-save]');

  const pickCat = (id) => {
    selCat = id;
    form.querySelectorAll('[data-cat]').forEach((x) => {
      x.classList.toggle('on', x.dataset.cat === id);
      x.setAttribute('aria-checked', x.dataset.cat === id);
    });
  };
  const pickMode = (m) => {
    selMode = m;
    form.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x.dataset.mode === m));
  };
  form.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => pickCat(b.dataset.cat)));
  form.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => pickMode(b.dataset.mode)));

  form.querySelector('[data-scan]')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const { openScanSheet } = await import('./scan-sheet.js');
    openScanSheet();
  });

  form.smart?.addEventListener('input', () => {
    const r = parse(form.smart.value);
    smart = null;
    if (!r) { preview.hidden = true; saveBtn.textContent = 'Add spend'; return; }
    if (r.kind === 'item') {
      const it = r.item;
      const ok = r.qty > 0;
      smart = ok ? r : null;
      preview.innerHTML = `${it.emoji || '🧺'} <b>${esc(it.en)}</b> <span class="hi">${esc(it.hi)}</span>
        ${ok ? `· ${number(r.qty)} ${esc(r.unit)}` : '· <i>add qty, e.g. 2kg</i>'}
        ${r.price ? `· <b>${money(r.price)}</b>${r.rate && it.kind === 'veg' ? ` (${money(r.rate)}/${esc(r.unit)})` : ''}` : ''}
        <span class="muted"> → ${it.kind === 'veg' ? 'Sabzi' : 'Stock'}${r.price ? ' + Groceries' : ''}</span>`;
      preview.hidden = false;
      saveBtn.textContent = ok ? 'Save purchase' : 'Add spend';
      if (r.price) form.amount.value = r.price;
      pickCat('grocery');
    } else {
      preview.innerHTML = `${r.cat ? cat(r.cat).emoji : '•'} ${r.amount ? `<b>${money(r.amount)}</b>` : '<i>add amount</i>'} · ${r.cat ? esc(cat(r.cat).name) : '<i>pick a category</i>'}${r.note ? ` · ${esc(r.note)}` : ''}`;
      preview.hidden = false;
      saveBtn.textContent = 'Add spend';
      if (r.amount) form.amount.value = r.amount;
      if (r.cat) pickCat(r.cat);
      if (r.mode) pickMode(r.mode);
      form.note.value = r.note || '';
    }
  });
  if (!isEdit) setTimeout(() => form.smart?.focus(), 60);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!editable) return;
    if (smart) {
      const price = Number(form.amount.value) || smart.price || 0;
      await stock.bought(smart.item, { qty: smart.qty, unit: smart.unit, price, date: form.date.value || today(), note: smart.note });
      closeSheet(true);
      toast(`${smart.item.en} ${number(smart.qty)} ${smart.unit}${price ? ` · ${money(price)}` : ''} saved ✓`);
      return;
    }
    const amount = Number(form.amount.value);
    if (!(amount > 0)) { err.textContent = 'Enter an amount'; err.hidden = false; form.amount.focus(); return; }
    if (!selCat) { err.textContent = 'Pick a category'; err.hidden = false; return; }
    const saved = await addEntry({
      ...(isEdit ? { id: e.id, source: e.source, ref: e.ref, by: e.by } : {}),
      amount, cat: selCat, mode: selMode, note: form.note.value.trim(), date: form.date.value || today(),
    });
    saveMode(selMode);
    closeSheet(true);
    toast(`${isEdit ? 'Saved' : 'Added'} ${money(saved.amount)} · ${cat(selCat).name} ✓`);
  });

  form.querySelector('[data-del]')?.addEventListener('click', async () => {
    closeSheet(true);
    if (await confirmSheet({ title: 'Delete this spend?', body: `${money(e.amount)} · ${esc(cat(e.cat).name)}`, ok: 'Delete', danger: true })) {
      // If it came from a stock purchase, unlink it so the stock history stays right.
      const linked = store.list('stock').filter((s) => s.entryId === e.id);
      for (const s of linked) await store.put('stock', { ...s, entryId: null });
      const removed = await store.remove('entries', e.id);
      toast('Deleted', {
        undo: async () => {
          await store.replace('entries', removed);
          for (const s of linked) await store.replace('stock', s);
        },
      });
    }
  });
}
