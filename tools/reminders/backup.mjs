// Kozy nightly backup + usage check — runs free on GitHub Actions (see .github/workflows/backup.yml).
// Writes one JSON file per household (all its data + people) to OUT_DIR/YYYY-MM-DD/, and a short usage report.
// Exits with code 2 when Firebase's FREE daily limit looks close, so GitHub emails you the failed run.
//
//   FIREBASE_SERVICE_ACCOUNT='{...json...}' node tools/reminders/backup.mjs
//   (tests: FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 node tools/reminders/backup.mjs)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const COLS = ['entries', 'items', 'stock', 'milk', 'meta', 'devices'];
const OUT = process.env.OUT_DIR || 'backup-out';
const READS_LIMIT = Number(process.env.READS_LIMIT) || 50000; // Firebase free plan: reads per day, for ALL households together
const WARN_AT = 0.7;       // warn at 70 %

const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;
if (!emulator && !process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.log('Kozy backup: FIREBASE_SERVICE_ACCOUNT is not set yet — nothing to do.');
  process.exit(0);
}
const admin = (await import('firebase-admin')).default;
admin.initializeApp(emulator ? { projectId: 'demo-kozy' } : { credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();

const day = new Date().toISOString().slice(0, 10);
const dir = join(OUT, day);
mkdirSync(dir, { recursive: true });

const plain = (d) => ({ ...d.data(), id: d.id });
const people = new Map(); // hid -> [membership]
for (const d of (await db.collection('memberships').get()).docs) {
  const m = d.data();
  if (!people.has(m.hid)) people.set(m.hid, []);
  people.get(m.hid).push({ ...m, email: d.id });
}

const report = [];
let totalDocs = 0;
let estReads = 0;
for (const h of (await db.collection('households').get()).docs) {
  const data = { household: { ...h.data(), id: h.id }, members: people.get(h.id) || [], backedUpAt: new Date().toISOString() };
  let docs = 0;
  for (const c of COLS) {
    data[c] = (await h.ref.collection(c).get()).docs.map(plain);
    if (c !== 'devices') docs += data[c].length;
  }
  writeFileSync(join(dir, `${h.id}.json`), JSON.stringify(data));
  const n = Math.max(1, data.members.length);
  // every app open reads the household's docs once (the phone cache saves some, so this is a safe over-estimate): ~2 opens per person per day
  const reads = docs * n * 2;
  totalDocs += docs;
  estReads += reads;
  report.push({ hid: h.id, name: data.household.name, people: data.members.length, docs, estReads: reads });
}
writeFileSync(join(dir, '_summary.json'), JSON.stringify({ day, households: report.length, totalDocs, estReads, report }, null, 1));

console.log(`Kozy backup ${day}: ${report.length} household(s), ${totalDocs} docs, saved in ${dir}`);
for (const r of report) console.log(`  ${r.name || r.hid}: ${r.people} people, ${r.docs} docs, ~${r.estReads} reads/day`);
const pct = Math.round((estReads / READS_LIMIT) * 100);
console.log(`Estimated daily reads: ~${estReads} of ${READS_LIMIT} free (${pct} %)`);
if (estReads >= READS_LIMIT * WARN_AT) {
  console.log(`WARNING: usage is above ${WARN_AT * 100} % of Firebase's free daily limit. Time to look at the Blaze plan (still has a free quota) or trim old data.`);
  process.exitCode = 2;
}
