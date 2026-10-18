// Edit ANY entry: a kitchen purchase, a sabzi purchase, a "Finished" record, a spend or a milk day.
// openEntry(kind, id) is used by the Recent/activity list, the "Today" strip and item histories.
import * as store from '../store.js';
import * as stock from '../logic/stock.js';
import { esc, money } from '../logic/format.js';
import { openSheet, closeSheet, toast, confirmSheet, icon } from '../ui.js';
import { openSpendSheet } from './spend-sheet.js';
import { openMilkDay } from './milk.js';

export function openEntry(kind, id) {
  if (kind === 'spend') { const e = store.get('entries', id); if (e) openSpendSheet(e); return; }
  if (kind === 'milk') { openMilkDay(id); return; }
  const ev = store.get('stock', id);
  if (ev) editPurchaseSheet(ev);
}

export function editPurchaseSheet(ev, { onDone } = {}) {
  const item = store.get('items', ev.itemId) || { en: 'Item', hi: '', unit: ev.unit || 'kg' };
  const bought = ev.type === 'bought';
  const entry = ev.entryId ? store.get('entries', ev.entryId) : null;
  const canPrice = !entry || store.canEdit(entry);
  const can = store.canWrite();
  const price = stock.priceOf(ev);
  const el = openSheet(`
    <form class="stack" novalidate data-test="edit-purchase">
      <div class="sheet-head">
        <h2 class="sheet-title">${item.emoji ? `${item.emoji} ` : ''}${esc(item.en)} <span class="hi">${esc(item.hi)}</span></h2>
        <span class="muted small">${bought ? 'Bought' : 'Finished'} · ${esc(ev.by || 'Me')}</span>
      </div>
      ${bought ? `<div class="row gap">
        <label class="field grow"><span>Qty</span><input name="qty" class="input" type="number" inputmode="decimal" step="any" min="0" value="${ev.qty ?? ''}" ${can ? '' : 'disabled'}></label>
        <label class="field"><span>Unit</span><select name="unit" class="input" ${can ? '' : 'disabled'}>${stock.UNITS.map((u) => `<option ${u === (ev.unit || item.unit) ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
        <label class="field grow"><span>Price ₹ (total)</span><input name="price" class="input" type="number" inputmode="decimal" step="any" min="0" value="${price || ''}" placeholder="0" ${can && canPrice ? '' : 'disabled'}></label>
      </div>
      ${item.kind !== 'veg' ? `<label class="field"><span>Lasts about (days, empty = Auto)</span>
        <input name="lastsDays" class="input" type="number" inputmode="numeric" min="1" value="${ev.lastsDays || ''}" placeholder="Auto" ${can ? '' : 'disabled'}></label>` : ''}
      <input name="note" class="input" placeholder="Remark" value="${esc(ev.note || '')}" aria-label="Remark" ${can ? '' : 'disabled'}>` : ''}
      <label class="field"><span>Date</span><input name="date" class="input" type="date" value="${esc(ev.date)}" ${can ? '' : 'disabled'}></label>
      ${!canPrice ? '<p class="muted small">The price was added by someone else; only they or the owner can change it.</p>' : ''}
      <p class="form-error" hidden></p>
      ${can ? `<div class="row gap">
        <button type="button" class="btn ghost danger-text" data-del aria-label="Delete">${icon('trash')}</button>
        <button type="submit" class="btn primary grow" data-save>Save changes</button>
      </div>` : ''}
    </form>`);
  const f = el.querySelector('form');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const changes = { date: f.date.value || ev.date };
    if (bought) {
      const qty = Number(f.qty.value);
      if (!(qty > 0)) { const er = f.querySelector('.form-error'); er.textContent = 'Enter quantity'; er.hidden = false; return; }
      Object.assign(changes, { qty, unit: f.unit.value, note: f.note.value.trim() });
      if (f.lastsDays) changes.lastsDays = Number(f.lastsDays.value) || null;
      if (canPrice) changes.price = Number(f.price.value) || 0;
    }
    await stock.updatePurchase(ev, changes);
    closeSheet(true);
    toast(`${item.en} updated ✓`);
    onDone?.();
  });
  f.querySelector('[data-del]')?.addEventListener('click', async () => {
    closeSheet(true);
    if (await confirmSheet({ title: 'Delete this record?', body: entry && canPrice ? `The linked spend ${money(price)} is deleted too.` : '', ok: 'Delete', danger: true })) {
      const removed = await stock.removeEvent(ev);
      toast('Deleted', { undo: () => stock.restoreEvent(removed) });
      onDone?.();
    }
  });

}
