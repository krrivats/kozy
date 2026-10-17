// Formatting + date helpers. All dates are local 'YYYY-MM-DD' strings (no time zones to worry about).

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export function money(n) {
  return inr.format(Math.round(Number(n) || 0));
}

export function number(n) {
  return num.format(Number(n) || 0);
}

// Testing / demo helper: open the app with ?today=2026-10-01 to pretend it is that day.
const override = (() => {
  try {
    const q = new URLSearchParams(location.search).get('today');
    return q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : null;
  } catch { return null; }
})();

export function pad(n) { return String(n).padStart(2, '0'); }

export function iso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today() {
  return override || iso(new Date());
}

export function parse(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s, n) {
  const d = parse(s);
  d.setDate(d.getDate() + Math.round(n));
  return iso(d);
}

export function diffDays(a, b) {
  // whole days from a to b
  return Math.round((parse(b) - parse(a)) / 86400000);
}

export function monthKey(s = today()) { return s.slice(0, 7); }

export function monthStart(mk) { return `${mk}-01`; }

export function daysInMonth(mk) {
  const [y, m] = mk.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function monthEnd(mk) { return `${mk}-${pad(daysInMonth(mk))}`; }

export function shiftMonth(mk, n) {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

const monthFmt = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });
const monthShort = new Intl.DateTimeFormat('en-IN', { month: 'short' });
const dayFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const weekdayFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export function monthName(mk) { return monthFmt.format(parse(monthStart(mk))); }
export function monthShortName(mk) { return monthShort.format(parse(monthStart(mk))); }
export function dayLabel(s) { return dayFmt.format(parse(s)); }

export function relDay(s) {
  const t = today();
  if (s === t) return 'Today';
  if (s === addDays(t, -1)) return 'Yesterday';
  return weekdayFmt.format(parse(s));
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
