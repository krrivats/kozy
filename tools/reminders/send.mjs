// Kozy reminder job — runs free on GitHub Actions at 8 AM (bills + items to buy) and 9 PM IST (milk not ticked).
// It finds every household that has phones with reminders on (households/{hid}/devices), reads that household
// from Firestore, works out reminders with the SAME code the app uses, and sends one push to each of its phones.
//
//   node tools/reminders/send.mjs --demo --morning   (no Firebase: prints what it would send, using demo data)
//   node tools/reminders/send.mjs --dry-run          (real data, prints only)
//   FIREBASE_SERVICE_ACCOUNT='{...json...}' node tools/reminders/send.mjs --morning
import * as store from '../../js/store.js';
import { reminders, pushMessage } from '../../js/logic/reminders.js';

const args = process.argv.slice(2);
const slot = args.includes('--evening') ? 'evening' : args.includes('--morning') ? 'morning' : (process.env.SLOT || 'morning');
const dry = args.includes('--dry-run');
const demo = args.includes('--demo');

// Works out and (unless dry) sends the reminder of ONE household.
async function runHousehold(label, data, devices, admin, base) {
  store.hydrate(data);
  const list = reminders(undefined, slot);
  const msg = pushMessage(list);
  console.log(`Kozy reminders (${slot}) · ${label}: ${list.length} item(s)`);
  for (const r of list) console.log(`  ${r.emoji} ${r.title}`);
  if (!msg) { console.log('  Nothing to send.'); return; }
  console.log(`  Push → "${msg.title}"`);
  if (demo || dry) return;
  if (!devices.length) { console.log('  No phones have turned reminders on yet.'); return; }
  const res = await admin.messaging().sendEachForMulticast({
    tokens: devices.map((d) => d.token),
    data: { title: msg.title, body: msg.body, url: msg.url, tag: `kozy-${slot}` },
    webpush: { headers: { Urgency: 'high', TTL: '43200' } },
  });
  console.log(`  Sent: ${res.successCount} ok, ${res.failureCount} failed`);
  // Forget phones whose token is no longer valid (app removed, permission turned off).
  for (let i = 0; i < res.responses.length; i++) {
    const r = res.responses[i];
    if (!r.success) {
      console.log(`    ${devices[i].label}: ${r.error?.code}`);
      if (['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(r.error?.code)) {
        await base.collection('devices').doc(devices[i].id).delete();
      }
    }
  }
}

if (demo) {
  const { buildDemo } = await import('../../js/logic/demo.js');
  await runHousehold('demo', buildDemo(), [], null, null);
  process.exit(0);
}
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.log('Kozy reminders: FIREBASE_SERVICE_ACCOUNT is not set yet — nothing to do. (See MORNING_REPORT.md)');
  process.exit(0);
}
const admin = (await import('firebase-admin')).default;
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = admin.firestore();

// Every phone in every household, grouped by household id (the parent of the devices collection).
const byHousehold = new Map();
for (const d of (await db.collectionGroup('devices').get()).docs) {
  const hid = d.ref.parent.parent?.id;
  if (!hid || !d.data().token) continue;
  if (!byHousehold.has(hid)) byHousehold.set(hid, []);
  byHousehold.get(hid).push({ ...d.data(), id: d.id });
}
if (!byHousehold.size) console.log('No phones have turned reminders on yet.');
for (const [hid, devices] of byHousehold) {
  try {
    const base = db.collection('households').doc(hid);
    const data = {};
    for (const c of store.COLLECTIONS) data[c] = (await base.collection(c).get()).docs.map((d) => ({ ...d.data(), id: d.id }));
    const name = (await base.get()).data()?.name || hid;
    await runHousehold(name, data, devices, admin, base);
  } catch (e) {
    console.log(`Household ${hid} failed: ${e.message}`); // one household's problem never stops the others
  }
}
