// 📷 Scan a bill: photo → free text recognition on this device → you tick what's right → saved as
// kitchen/sabzi purchases (matched items) or Groceries spends (everything else).
import * as stock from '../logic/stock.js';
import { readImage, parseBill } from '../logic/scan.js';
import { addEntry, GROCERY_CAT } from '../logic/budget.js';
import { today, esc, money } from '../logic/format.js';
import { openSheet, closeSheet, toast } from '../ui.js';

export function openScanSheet() {
  const el = openSheet(`
    <div class="stack" data-test="scan">
      <h2 class="sheet-title">📷 Scan a bill</h2>
      <label class="btn primary file-btn">Take or choose a photo
        <input type="file" accept="image/*" capture="environment" data-file hidden></label>
      <p class="muted small" data-hint>Best with a printed bill: flat, well lit, whole bill in the photo. The photo stays on this device.</p>
      <div data-progress hidden><div class="bar"><span style="width:0%"></span></div><p class="muted small" data-status>Reading the bill…</p></div>
      <div data-result></div>
    </div>`);
  const input = el.querySelector('[data-file]');
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const prog = el.querySelector('[data-progress]');
    const barSpan = prog.querySelector('.bar span');
    const status = el.querySelector('[data-status]');
    prog.hidden = false;
    el.querySelector('[data-result]').innerHTML = '';
    try {
      status.textContent = 'Loading the scanner (first time takes a few seconds)…';
      const text = await readImage(file, (p) => {
        barSpan.style.width = `${Math.round(p * 100)}%`;
        status.textContent = `Reading the bill… ${Math.round(p * 100)}%`;
      });
      prog.hidden = true;
      review(el, parseBill(text), text);
    } catch (e) {
      prog.hidden = true;
      el.querySelector('[data-result]').innerHTML = `<p class="form-error">${esc(e.message || 'Could not read the photo')}</p>`;
    }
  });
}

function review(el, bill, text) {
  const box = el.querySelector('[data-result]');
  if (!bill.rows.length) {
    box.innerHTML = `<p class="form-error">No items found. Try a clearer, straight photo — or add it with the + button.</p>
      <details class="raw"><summary class="muted small">What the scanner read</summary><pre>${esc(text)}</pre></details>`;
    return;
  }
  box.innerHTML = `
    <form class="stack-s" data-review>
      <p class="small">Found <b>${bill.rows.length}</b> lines${bill.total ? ` · bill total <b>${money(bill.total)}</b>` : ''}. Untick anything wrong, fix qty or ₹, then Save.</p>
      <div class="list scan-list">
        ${bill.rows.map((r, i) => `<div class="scan-row">
          <input type="checkbox" name="pick" value="${i}" checked aria-label="Keep line ${i + 1}">
          <span class="grow scan-name">${r.item
            ? `${r.item.emoji ? `${r.item.emoji} ` : ''}<b>${esc(r.item.en)}</b> <span class="muted small">→ ${r.item.kind === 'veg' ? 'Sabzi' : 'Stock'}</span>`
            : `<input class="input sm-name" name="name-${i}" value="${esc(r.name)}" aria-label="Name"><span class="muted small">→ Groceries</span>`}</span>
          ${r.item ? `<input class="input sm-qty" name="qty-${i}" type="number" step="any" min="0" inputmode="decimal" value="${r.qty ?? ''}" placeholder="qty" aria-label="Qty">` : ''}
          <input class="input sm-price" name="price-${i}" type="number" step="any" min="0" inputmode="decimal" value="${r.price}" aria-label="Price">
        </div>`).join('')}
      </div>
      <p class="small" data-sel></p>
      <button class="btn primary" type="submit" data-save-scan>Save</button>
      <details class="raw"><summary class="muted small">What the scanner read</summary><pre>${esc(text)}</pre></details>
    </form>`;
  const f = box.querySelector('form');
  const sel = box.querySelector('[data-sel]');
  const recount = () => {
    const picked = [...f.querySelectorAll('[name="pick"]:checked')].map((c) => Number(c.value));
    const sum = picked.reduce((s, i) => s + (Number(f[`price-${i}`].value) || 0), 0);
    sel.textContent = `Selected ${picked.length} · ${money(sum)}${bill.total && Math.round(sum) !== Math.round(bill.total) ? ` (bill says ${money(bill.total)})` : ''}`;
  };
  f.addEventListener('input', recount);
  f.addEventListener('change', recount);
  recount();
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const picked = [...f.querySelectorAll('[name="pick"]:checked')].map((c) => Number(c.value));
    let total = 0;
    for (const i of picked) {
      const r = bill.rows[i];
      const price = Number(f[`price-${i}`].value) || 0;
      total += price;
      if (r.item) {
        const last = stock.eventsFor(r.item.id).filter((e) => e.type === 'bought').pop();
        const qty = Number(f[`qty-${i}`]?.value) || r.qty || last?.qty || 1;
        await stock.bought(r.item, { qty, unit: r.unit || last?.unit || r.item.unit, price, date: today(), note: 'bill scan' });
      } else if (price > 0) {
        await addEntry({ date: today(), amount: price, cat: GROCERY_CAT, mode: 'UPI', note: f[`name-${i}`].value.trim() || r.name, source: 'scan' });
      }
    }
    closeSheet(true);
    toast(`${picked.length} line${picked.length === 1 ? '' : 's'} saved · ${money(total)} ✓`);
  });

}
