// Quick add / edit a spend. Opened by the floating "+" from any screen, or by tapping an entry.
import * as store from '../store.js';
import { cats, cat, MODES, addEntry } from '../logic/budget.js';
import { today, esc, money } from '../logic/format.js';
import { openSheet, closeSheet, toast, confirmSheet, icon } from '../ui.js';

export function openSpendSheet(entry = null, preset = {}) {
  const e = entry || { date: today(), mode: store.meta('lastMode', 'UPI'), cat: preset.cat || '', amount: '', note: '' };
  const isEdit = !!entry;
  const el = openSheet(`
    <form class="spend-form" novalidate>
      <div class="sheet-head">
        <h2 class="sheet-title">${isEdit ? 'Edit spend' : 'Add spend'}</h2>
        ${isEdit ? `<span class="muted small">by ${esc(e.by || 'Me')}</span>` : ''}
      </div>
      <label class="amount-field">
        <span>₹</span>
        <input name="amount" type="number" inputmode="decimal" min="0" step="any" placeholder="0"
          value="${esc(e.amount)}" autofocus aria-label="Amount" required>
      </label>
      <div class="cat-grid" role="radiogroup" aria-label="Category">
        ${cats().map((c) => `
          <button type="button" class="cat-chip ${c.id === e.cat ? 'on' : ''}" data-cat="${c.id}" role="radio" aria-checked="${c.id === e.cat}">
            <span class="emo">${c.emoji}</span><span class="nm">${esc(c.name)}</span>
          </button>`).join('')}
      </div>
      <div class="seg" role="radiogroup" aria-label="Mode">
        ${MODES.map((m) => `<button type="button" class="${m === e.mode ? 'on' : ''}" data-mode="${m}">${m}</button>`).join('')}
      </div>
      <div class="row gap">
        <input name="note" class="input grow" placeholder="Note (optional)" value="${esc(e.note)}" aria-label="Note">
        <input name="date" class="input date" type="date" value="${esc(e.date)}" aria-label="Date">
      </div>
      <p class="form-error" hidden></p>
      <div class="row gap">
        ${isEdit ? `<button type="button" class="btn ghost danger-text" data-del aria-label="Delete">${icon('trash')}</button>` : ''}
        <button type="submit" class="btn primary grow" data-save>${isEdit ? 'Save changes' : 'Add spend'}</button>
      </div>
    </form>`);

  const form = el.querySelector('form');
  let selCat = e.cat;
  let selMode = e.mode || 'UPI';
  const err = form.querySelector('.form-error');

  form.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
    selCat = b.dataset.cat;
    form.querySelectorAll('[data-cat]').forEach((x) => {
      x.classList.toggle('on', x === b);
      x.setAttribute('aria-checked', x === b);
    });
  }));
  form.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    selMode = b.dataset.mode;
    form.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x === b));
  }));

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const amount = Number(form.amount.value);
    if (!(amount > 0)) { err.textContent = 'Enter an amount'; err.hidden = false; form.amount.focus(); return; }
    if (!selCat) { err.textContent = 'Pick a category'; err.hidden = false; return; }
    const saved = await addEntry({
      ...(isEdit ? { id: e.id, source: e.source, ref: e.ref, by: e.by } : {}),
      amount, cat: selCat, mode: selMode, note: form.note.value.trim(), date: form.date.value || today(),
    });
    await store.setMeta('lastMode', selMode);
    closeSheet(true);
    toast(`${isEdit ? 'Saved' : 'Added'} ${money(saved.amount)} · ${cat(selCat).name} ✓`);
  });

  form.querySelector('[data-del]')?.addEventListener('click', async () => {
    closeSheet(true);
    if (await confirmSheet({ title: 'Delete this spend?', body: `${money(e.amount)} · ${esc(cat(e.cat).name)}`, ok: 'Delete', danger: true })) {
      // If this spend came from a stock "Bought", unlink it so the stock history stays correct.
      for (const s of store.list('stock').filter((s) => s.entryId === e.id)) {
        await store.put('stock', { ...s, entryId: null });
      }
      await store.remove('entries', e.id);
      toast('Deleted');
    }
  });
}
