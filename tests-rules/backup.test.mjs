// The nightly backup script, against the Firestore emulator: seeds two households, runs backup.mjs, checks the files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(new URL('../tools/reminders/package.json', import.meta.url));
const admin = require('firebase-admin');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
admin.initializeApp({ projectId: 'demo-kozy' });
const db = admin.firestore();

test('backup writes one file per household with its people, and counts usage', async () => {
  await db.doc('households/h1').set({ name: 'Sharma home', createdBy: 'a@t.com' });
  await db.doc('households/h1/entries/e1').set({ amount: 100, note: 'milk' });
  await db.doc('households/h1/meta/budgetTotal').set({ value: 30000 });
  await db.doc('memberships/a@t.com').set({ hid: 'h1', role: 'admin', name: 'Asha' });
  await db.doc('households/h2').set({ name: 'Gupta home', createdBy: 'g@t.com' });
  await db.doc('memberships/g@t.com').set({ hid: 'h2', role: 'admin', name: 'Gita' });

  const out = mkdtempSync(join(tmpdir(), 'kozy-backup-'));
  const r = spawnSync('node', ['../tools/reminders/backup.mjs'], { env: { ...process.env, OUT_DIR: out }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const day = readdirSync(out)[0];
  const files = readdirSync(join(out, day)).sort();
  assert.deepEqual(files, ['_summary.json', 'h1.json', 'h2.json']);
  const h1 = JSON.parse(readFileSync(join(out, day, 'h1.json'), 'utf8'));
  assert.equal(h1.household.name, 'Sharma home');
  assert.equal(h1.entries[0].note, 'milk');
  assert.equal(h1.members[0].email, 'a@t.com');
  const sum = JSON.parse(readFileSync(join(out, day, '_summary.json'), 'utf8'));
  assert.equal(sum.households, 2);
  assert.equal(sum.totalDocs, 2); // 1 entry + 1 meta
  assert.match(r.stdout, /2 household/);
});

test('backup warns (exit code 2) when the estimated reads are close to the free limit', async () => {
  const batch = db.batch();
  for (let i = 0; i < 450; i++) batch.set(db.doc(`households/h3/entries/e${i}`), { amount: i });
  batch.set(db.doc('households/h3'), { name: 'Big home' });
  await batch.commit();
  const mem = db.batch();
  for (let i = 0; i < 12; i++) mem.set(db.doc(`memberships/p${i}@t.com`), { hid: 'h3', role: 'viewer', name: `P${i}` });
  await mem.commit();
  const out = mkdtempSync(join(tmpdir(), 'kozy-backup-'));
  // 450 docs x 12 people x 2 opens = 10 800 reads: fine against the real 50 000 limit ...
  const ok = spawnSync('node', ['../tools/reminders/backup.mjs'], { env: { ...process.env, OUT_DIR: out }, encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stdout);
  assert.match(ok.stdout, /Estimated daily reads/);
  assert.doesNotMatch(ok.stdout, /WARNING/);
  // ... but above 70 % of a pretend limit of 12 000: warns and exits with 2 (GitHub then emails the failed run)
  const warn = spawnSync('node', ['../tools/reminders/backup.mjs'], { env: { ...process.env, OUT_DIR: out, READS_LIMIT: '12000' }, encoding: 'utf8' });
  assert.equal(warn.status, 2, warn.stdout);
  assert.match(warn.stdout, /WARNING/);
});
