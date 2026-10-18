// Bill photo scan: free text recognition in the browser (Tesseract.js, loaded from the CDN only when used),
// then turn the bill's lines into purchases you check before saving. Nothing is uploaded anywhere.
import * as stock from './stock.js';

const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`) && window.Tesseract) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load the scanner. Check the internet and try again.'));
    document.head.appendChild(s);
  });
}

// image: File/Blob/URL. onProgress(0..1). Returns the recognised text.
export async function readImage(image, onProgress) {
  if (!window.Tesseract) await loadScript(TESSERACT);
  const { data } = await window.Tesseract.recognize(image, 'eng', {
    logger: (m) => { if (m.status === 'recognizing text') onProgress?.(m.progress); },
  });
  return data.text || '';
}

const SKIP = /\b(sub ?total|total|net|gst|cgst|sgst|igst|tax|discount|round|cash|change|paid|balance|bill|invoice|inv|date|time|phone|ph|mob|mobile|tel|gstin|thank|thanks|visit|qty|rate|amount|amt|item|items|particulars|sr|s\.no|no\.|cashier|counter|upi|card|tender|saving|savings|mrp)\b/i;
const TOTAL = /\b(grand total|net total|net amount|net amt|total amount|total|amount payable|payable)\b/i;
const UNIT = { kg: 'kg', kgs: 'kg', g: 'g', gm: 'g', gms: 'g', gr: 'g', l: 'L', lt: 'L', ltr: 'L', ml: 'ml', pc: 'pcs', pcs: 'pcs', nos: 'pcs', pkt: 'pack', pack: 'pack', dz: 'dozen', dozen: 'dozen', btl: 'bottle' };

function num(s) {
  return Number(String(s).replace(/,/g, ''));
}

function matchItem(words) {
  const ws = words.map((w) => w.toLowerCase()).filter((w) => w.length >= 3);
  for (let i = 0; i < ws.length - 1; i++) {
    const hit = stock.search(`${ws[i]} ${ws[i + 1]}`).find((it) => it.en.toLowerCase() === `${ws[i]} ${ws[i + 1]}`);
    if (hit) return hit;
  }
  for (const w of ws) {
    const hits = stock.search(w);
    const exact = hits.find((it) => it.en.toLowerCase() === w || (it.alias || '').toLowerCase().split(/\s+/).includes(w));
    if (exact) return exact;
    if (hits.length === 1 && w.length >= 4) return hits[0];
  }
  return null;
}

// Text → { rows: [{raw, name, qty, unit, price, item}], total }
export function parseBill(text) {
  const rows = [];
  let total = null;
  for (const raw0 of String(text || '').split(/\r?\n/)) {
    const raw = raw0.replace(/[₹|]/g, ' ').replace(/\bRs\.?/gi, ' ').replace(/\/-/g, ' ').replace(/\s+/g, ' ').trim();
    if (raw.length < 3 || !/\d/.test(raw) || !/[a-z]/i.test(raw)) continue;
    const nums = raw.match(/\d+(?:[.,]\d+)*(?:\.\d+)?/g) || [];
    const last = nums.length ? num(nums[nums.length - 1]) : null;
    if (TOTAL.test(raw) && !/sub ?total/i.test(raw)) { if (last) total = last; continue; }
    if (SKIP.test(raw)) continue;
    let qty = null;
    let unit = null;
    const qm = raw.match(/(\d+(?:\.\d+)?)\s?(kgs?|gms?|gr|g|ltr|lt|l|ml|pcs?|nos|pkt|pack|dz|dozen|btl)\b/i);
    if (qm) { qty = Number(qm[1]); unit = UNIT[qm[2].toLowerCase()]; }
    const price = last;
    if (!price || price <= 0) continue;
    const words = raw.replace(/\d+(?:[.,]\d+)*/g, ' ').replace(/\b(kgs?|gms?|gr|g|ltr|lt|l|ml|pcs?|nos|pkt|pack|dz|dozen|btl|x|@)\b/gi, ' ')
      .replace(/[^a-zऀ-ॿ ]/gi, ' ').split(/\s+/).filter((w) => w.length >= 2);
    if (!words.length) continue;
    const item = matchItem(words);
    rows.push({ raw, name: words.join(' '), qty, unit: unit || item?.unit || null, price, item });
  }
  return { rows, total, sum: rows.reduce((s, r) => s + r.price, 0) };
}
