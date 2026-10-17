// Kozy reminder job — runs free on GitHub Actions at 8 AM (bills + items to buy) and 9 PM IST (milk not ticked).
// It reads the household from Firestore, works out reminders with the SAME code the app uses,
// and sends one push to every phone that turned reminders on.
//
//   node tools/reminders/send.mjs --demo --morning   (no Firebase: prints what it would send, using demo data)
//   node tools/reminders/send.mjs --dry-run          (real data, prints only)
//   FIREBASE_SERVICE_ACCOUNT='{...json...}' node tools/reminders/send.mjs --morning
import * as store from '../../js/store.js';
import { reminders, pushMessage } from '../../js/logic/reminders.js';
import { HOUSEHOLD_ID } from '../../js/config.js';

const args = process.argv.slice(2);
const slot = args.includes('--evening') ? 'evening' : args.includes('--morning') ? 'morning' : (process.env.SLOT || 'morning');
const dry = args.includes('--dry-run');
const demo = args.includes('--demo');

let data;
let devices = [];
let admin;
let base;

if (demo) {
  const { buildDemo } = await import('../../js/logic/demo.js');
  data = buildDemo();
} else {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log('Kozy reminders: FIREBASE_SERVICE_ACCOUNT is not set yet — nothing to do. (See MORNING_REPORT.md)');
    process.exit(0);
  }
  admin = (await import('firebase-admin')).default;
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  base = admin.firestore().collection('households').doc(HOUSEHOLD_ID);
  data = {};
  for (const c of store.COLLECTIONS) {
    data[c] = (await base.collection(c).get()).docs.map((d) => ({ ...d.data(), id: d.id }));
  }
  devices = (await base.collection('devices').get()).docs.map((d) => ({ ...d.data(), id: d.id }));
}

store.hydrate(data);
const list = reminders(undefined, slot);
const msg = pushMessage(list);
console.log(`Kozy reminders (${slot}): ${list.length} item(s)`);
for (const r of list) console.log(`  ${r.emoji} ${r.title}`);
if (!msg) { console.log('Nothing to send.'); process.exit(0); }
console.log(`Push → "${msg.title}"`);
if (demo || dry) process.exit(0);
if (!devices.length) { console.log('No phones have turned reminders on yet.'); process.exit(0); }

const res = await admin.messaging().sendEachForMulticast({
  tokens: devices.map((d) => d.token),
  data: { title: msg.title, body: msg.body, url: msg.url, tag: `kozy-${slot}` },
  webpush: { headers: { Urgency: 'high', TTL: '43200' } },
});
console.log(`Sent: ${res.successCount} ok, ${res.failureCount} failed`);
// Forget phones whose token is no longer valid (app removed, permission turned off).
for (let i = 0; i < res.responses.length; i++) {
  const r = res.responses[i];
  if (!r.success) {
    console.log(`  ${devices[i].label}: ${r.error?.code}`);
    if (['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(r.error?.code)) {
      await base.collection('devices').doc(devices[i].id).delete();
    }
  }
}
