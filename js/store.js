// One data API for the whole app. Views never talk to an adapter directly.
// The store keeps an in-memory copy (fast, synchronous reads) and sends every write to the adapter.
//
// Collections:
//   entries  spend entries   {id, date:'YYYY-MM-DD', amount, cat, mode, note, by, byEmail?, source?, ref?}
//   items    items           {id, kind:'kitchen'|'veg', en, hi, emoji?, unit, cat, order, note?, lowDays?, need?}
//   stock    stock events    {id, itemId, type:'bought'|'finished', date, qty?, unit?, lastsDays?, note?, entryId?, by}
//            (the price of a purchase lives in its linked spend entry)
//   milk     milk days       {id:'YYYY-MM-DD', litres, rate, skip, by}
//   meta     key/value docs  {id:key, value}
import { USE_FIREBASE, EMULATOR, FORCE_LOCAL, GUEST, LOCAL_USER } from './config.js';

export const COLLECTIONS = ['entries', 'items', 'stock', 'milk', 'meta'];

// Setup keys only the owner may change. Members may write the other meta keys (bill paid state, milk bill).
export const OWNER_META = ['cats', 'bills', 'goals', 'ccStart', 'milkSettings', 'itemsSeeded', 'vegSeeded', 'recurring', 'demo', 'budgetTotal', 'family', 'checklistSeeded'];

let adapter = null;
const cache = Object.fromEntries(COLLECTIONS.map((c) => [c, new Map()]));
const listeners = new Set();

function emit(col) {
  for (const fn of listeners) {
    try { fn(col); } catch (e) { console.error(e); }
  }
}

function fill(data) {
  for (const c of COLLECTIONS) {
    cache[c].clear();
    for (const d of data[c] || []) cache[c].set(d.id, d);
  }
}

export async function initStore() {
  if (!GUEST && (EMULATOR || (USE_FIREBASE && !FORCE_LOCAL))) { // a guest never touches Firebase
    const { FirestoreAdapter } = await import('./adapters/firestore.js');
    adapter = new FirestoreAdapter();
  } else {
    const { LocalAdapter } = await import('./adapters/local.js');
    adapter = new LocalAdapter();
  }
  await adapter.init();
  return adapter;
}

// Called after sign-in (Firebase) or straight away (local).
export async function loadData() {
  const data = await adapter.load((col, docs) => {
    // Live updates from the other phone.
    cache[col].clear();
    for (const d of docs) cache[col].set(d.id, d);
    emit(col);
  }, COLLECTIONS);
  fill(data);
  emit('*');
}

// Fill the cache without an adapter (used by the reminder script and the Node unit tests).
// Writes then only change memory.
export function hydrate(data) {
  if (!adapter) {
    adapter = { name: 'memory', role: () => 'owner', userLabel: () => LOCAL_USER.label, write: async () => {}, delete: async () => {}, replaceAll: async () => {} };
  }
  fill(data);
}

export function getAdapter() { return adapter; }

// ---------- who is using the app ----------
export function currentUserLabel() {
  return adapter?.userLabel?.() || LOCAL_USER.label;
}

export function currentUserEmail() {
  return adapter?.userEmail?.() || '';
}

// 'owner' | 'member' | 'viewer' | null (unknown email). No adapter (Node script) = owner.
export function role() {
  return adapter ? adapter.role() : 'owner';
}

export function isOwner() { return role() === 'owner'; }
export function canWrite() { return role() === 'owner' || role() === 'member'; }

// Members may change/delete only spends they added. The owner may change anything.
export function canEdit(doc) {
  if (isOwner()) return true;
  if (!canWrite() || !doc) return false;
  const me = currentUserEmail();
  return me ? doc.byEmail === me : doc.by === currentUserLabel();
}

export class ReadOnlyError extends Error {
  constructor(msg = 'View only — you can’t change this') { super(msg); this.name = 'ReadOnlyError'; }
}

function guard(col, doc, existing) {
  if (!canWrite()) throw new ReadOnlyError();
  if (isOwner()) return;
  if (col === 'meta' && OWNER_META.includes(doc.id)) throw new ReadOnlyError('Only the owner can change setup');
  if (col === 'entries' && existing && !canEdit(existing)) throw new ReadOnlyError('Only the person who added it (or the owner) can change this');
}

// Writes in flight → the sync dot shows "saving" until they finish.
let pendingWrites = 0;
export function pending() { return pendingWrites; }
async function track(p) {
  pendingWrites++;
  emit('sync');
  try { return await p; } finally { pendingWrites--; emit('sync'); }
}

// ---------- reads ----------
export function newId(prefix = '') {
  const rand = Math.random().toString(36).slice(2, 8);
  return prefix + Date.now().toString(36) + rand;
}

export function list(col) {
  return [...cache[col].values()];
}

export function get(col, id) {
  return cache[col].get(id) || null;
}

export function meta(key, fallback = null) {
  const d = cache.meta.get(key);
  return d ? d.value : fallback;
}

// ---------- writes ----------
export async function put(col, doc) {
  const now = Date.now();
  const existing = doc.id ? cache[col].get(doc.id) : null;
  guard(col, doc, existing);
  const email = existing?.byEmail || currentUserEmail();
  const full = {
    ...existing,
    ...doc,
    id: doc.id || newId(),
    by: doc.by || existing?.by || currentUserLabel(),
    ...(email ? { byEmail: email } : {}),
    createdAt: existing?.createdAt || doc.createdAt || now,
    updatedAt: now,
  };
  cache[col].set(full.id, full);
  emit(col);
  await track(adapter.write(col, full));
  return full;
}

// Like put, but replaces the whole doc (use it to drop a field, or to undo a delete).
export async function replace(col, doc) {
  guard(col, doc, cache[col].get(doc.id));
  const full = { ...doc, updatedAt: Date.now() };
  cache[col].set(full.id, full);
  emit(col);
  await track(adapter.write(col, full));
  return full;
}

export async function remove(col, id) {
  const existing = cache[col].get(id) || null;
  guard(col, { id }, existing);
  cache[col].delete(id);
  emit(col);
  await track(adapter.delete(col, id));
  return existing;
}

export async function setMeta(key, value) {
  return put('meta', { id: key, value });
}

export function exportAll() {
  const out = { app: 'kozy', version: 2, exportedAt: new Date().toISOString() };
  for (const c of COLLECTIONS) out[c] = list(c);
  return out;
}

export async function importAll(data) {
  if (!isOwner()) throw new ReadOnlyError('Only the owner can restore a backup');
  if (!data || data.app !== 'kozy') throw new Error('Not a Kozy backup file');
  const clean = {};
  for (const c of COLLECTIONS) clean[c] = Array.isArray(data[c]) ? data[c] : [];
  fill(clean);
  emit('*');
  await track(adapter.replaceAll(clean));
}

export async function clearAll() {
  if (!isOwner()) throw new ReadOnlyError('Only the owner can reset');
  const empty = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
  fill(empty);
  emit('*');
  await track(adapter.replaceAll(empty));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
