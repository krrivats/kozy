// Smart quick add: turn "atta 10kg 420", "onion 5kg 50/kg", "sabzi 250", "auto 80 cash" into a ready entry.
import * as stock from './stock.js';

const UNIT_WORDS = {
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', g: 'g', gm: 'g', gms: 'g', gram: 'g', grams: 'g',
  l: 'L', lt: 'L', ltr: 'L', litre: 'L', liter: 'L', litres: 'L', ml: 'ml',
  pc: 'pcs', pcs: 'pcs', piece: 'pcs', pieces: 'pcs', dozen: 'dozen', dz: 'dozen',
  bunch: 'bunch', pack: 'pack', packet: 'pack', pkt: 'pack', bottle: 'bottle',
};

const MODE_WORDS = { cash: 'Cash', upi: 'UPI', gpay: 'UPI', phonepe: 'UPI', paytm: 'UPI', card: 'Card' };

// keyword → spend category (only used when no item matches)
const CAT_WORDS = {
  grocery: ['sabzi', 'sabji', 'subzi', 'veg', 'vegetable', 'vegetables', 'fruit', 'fruits', 'kirana', 'ration', 'grocery', 'groceries'],
  milk: ['milk', 'doodh', 'dudh', 'dairy'],
  travel: ['auto', 'bus', 'metro', 'train', 'travel', 'petrol', 'diesel', 'rickshaw', 'cab', 'ola', 'uber', 'rapido', 'fare'],
  gas: ['gas', 'cylinder', 'lpg'],
  wifi: ['wifi', 'recharge', 'mobile', 'internet', 'netflix', 'hotstar', 'ott', 'jio', 'airtel', 'broadband', 'dth'],
  solar: ['solar', 'emi'],
  cc: ['cc', 'creditcard', 'credit'],
  festival: ['festival', 'diwali', 'holi', 'rakhi', 'gift', 'gifts'],
  emergency: ['emergency'],
  family: ['family', 'maa', 'papa', 'pocket', 'kids', 'school'],
  buffer: ['medicine', 'dawai', 'doctor', 'chemist', 'hospital'],
  misc: ['plumber', 'electrician', 'repair', 'bulb', 'misc', 'hardware', 'cleaning'],
  bills: ['bill', 'electricity', 'bijli', 'insurance', 'lic', 'tax'],
};

function catFor(word) {
  for (const [c, words] of Object.entries(CAT_WORDS)) if (words.includes(word)) return c;
  return null;
}

const NUM = /^\d+(?:\.\d+)?$/;

export function parse(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const toks = raw.toLowerCase().replace(/₹|rs\.?(?=\s|\d|$)/g, ' ').replace(/,/g, '').split(/\s+/).filter(Boolean);
  let qty = null, unit = null, rate = null, mode = null;
  const nums = [];
  const words = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    let m;
    if ((m = t.match(/^(\d+(?:\.\d+)?)\/([a-z]+)$/)) && (UNIT_WORDS[m[2]] || m[2] === 'kg')) { rate = Number(m[1]); unit = unit || UNIT_WORDS[m[2]]; continue; }
    if ((m = t.match(/^@(\d+(?:\.\d+)?)$/))) { rate = Number(m[1]); continue; }
    if (t === '@' && NUM.test(toks[i + 1] || '')) { rate = Number(toks[++i]); continue; }
    if ((m = t.match(/^(\d+(?:\.\d+)?)([a-z]+)$/)) && UNIT_WORDS[m[2]]) { qty = Number(m[1]); unit = UNIT_WORDS[m[2]]; continue; }
    if (NUM.test(t) && UNIT_WORDS[toks[i + 1]]) { qty = Number(t); unit = UNIT_WORDS[toks[++i]]; continue; }
    if ((t === 'per' || t === '/') && UNIT_WORDS[toks[i + 1]] && nums.length) { rate = nums.pop(); unit = unit || UNIT_WORDS[toks[++i]]; continue; }
    if (NUM.test(t)) { nums.push(Number(t)); continue; }
    if (MODE_WORDS[t]) { mode = MODE_WORDS[t]; continue; }
    words.push(t);
  }

  // Which item? Try two-word names first ("green chilli"), then single words of 3+ letters.
  let item = null;
  const tryMatch = (q) => {
    const hits = stock.search(q).filter((it) => q.length >= 3 || it.en.toLowerCase() === q);
    const exact = hits.find((it) => it.en.toLowerCase() === q || it.hi === q || (it.alias || '').toLowerCase().split(/\s+/).includes(q));
    return exact || (hits.length === 1 ? hits[0] : null);
  };
  for (let i = 0; i < words.length - 1 && !item; i++) item = tryMatch(`${words[i]} ${words[i + 1]}`);
  for (const w of words) { if (item) break; if (!catFor(w)) item = tryMatch(w); }

  const noteWords = words.filter((w) => !item || !stock.matches(item, w));
  const note = noteWords.join(' ');

  if (item) {
    if (qty == null && nums.length >= 2) qty = nums.shift();
    let price = nums.length ? nums[nums.length - 1] : null;
    if (price == null && rate != null && qty != null) price = rate * qty;
    return { kind: 'item', item, qty, unit: unit || item.unit, price, rate: rate ?? (price && qty ? price / qty : null), mode, note };
  }

  const amount = nums.length ? nums[nums.length - 1] : (rate != null && qty != null ? rate * qty : null);
  const c = words.map(catFor).find(Boolean) || null;
  const label = words.length ? words.join(' ') : '';
  return { kind: 'spend', amount, cat: c, mode, note: label ? label.charAt(0).toUpperCase() + label.slice(1) : '' };
}
