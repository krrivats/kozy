// One data API for the whole app. Views never talk to an adapter directly.
// The store keeps an in-memory copy (fast, synchronous reads) and sends every write to the adapter.
//
// Collections:
//   entries  spend entries   {id, date:'YYYY-MM-DD', amount, cat, mode, note, by, source?, ref?}
//   items    kitchen items   {id, en, hi, unit, cat, order}
//   stock    stock events    {id, itemId, type:'bought'|'finished', date, qty?, unit?, price?, entryId?, by}
//   milk     milk days       {id:'YYYY-MM-DD', litres, rate, skip, by}
//   meta     key/value docs  {id:key, value}
import { USE_FIREBASE, LOCAL_USER } from './config.js';

export const COLLECTIONS = ['entries', 'items', 'stock', 'milk', 'meta'];

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
  if (USE_FIREBASE) {
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
  });
  fill(data);
  emit('*');
}

export function getAdapter() { return adapter; }

export function currentUserLabel() {
  return adapter?.userLabel?.() || LOCAL_USER;
}

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

export async function put(col, doc) {
  const now = Date.now();
  const existing = doc.id ? cache[col].get(doc.id) : null;
  const full = {
    ...existing,
    ...doc,
    id: doc.id || newId(),
    by: doc.by || existing?.by || currentUserLabel(),
    createdAt: existing?.createdAt || doc.createdAt || now,
    updatedAt: now,
  };
  cache[col].set(full.id, full);
  emit(col);
  await adapter.write(col, full);
  return full;
}

export async function remove(col, id) {
  cache[col].delete(id);
  emit(col);
  await adapter.delete(col, id);
}

export function meta(key, fallback = null) {
  const d = cache.meta.get(key);
  return d ? d.value : fallback;
}

export async function setMeta(key, value) {
  return put('meta', { id: key, value });
}

export function exportAll() {
  const out = { app: 'kozy', version: 1, exportedAt: new Date().toISOString() };
  for (const c of COLLECTIONS) out[c] = list(c);
  return out;
}

export async function importAll(data) {
  if (!data || data.app !== 'kozy') throw new Error('Not a Kozy backup file');
  const clean = {};
  for (const c of COLLECTIONS) clean[c] = Array.isArray(data[c]) ? data[c] : [];
  fill(clean);
  emit('*');
  await adapter.replaceAll(clean);
}

export async function clearAll() {
  const empty = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
  fill(empty);
  emit('*');
  await adapter.replaceAll(empty);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
