# Kozy multi-user plan ("any email, own household")

Agreed choices (30 Oct 2026):
- Sign-in: **email + password AND Google**; anyone can sign up.
- Roles: **Admin** (setup + people), **Editor** (add / edit / delete ANY entry, no setup), **Viewer** (read only).
- **One email = one household.**
- A household can have **several Admins**.

## How it works for a person
1. Open Kozy → **Create account** (email + password, or Google).
2. Password users get a **verify link** by email (free, sent by Firebase) → tap it → back in Kozy.
3. First time: **"Create my household"** (name, monthly budget, optional sample data) → you are its **Admin**.
   Already invited? You go straight into that household.
4. Admin: **Settings → 👥 Household** → **Add person** (email + name + role) → share the invite on WhatsApp.
   The person signs up or signs in with THAT email and lands inside the household.
5. Admin can change a role, remove a person, promote another Admin. The last Admin can't be removed.

## Data model (Firestore)
- `households/{hid}` → name, createdBy; sub-collections stay: entries, items, stock, milk, meta, devices.
- `memberships/{email}` → `{ hid, role: admin | editor | viewer, name, addedBy, joinedAt }`. One doc per email = one household.
- Rules read the caller's membership: `role = memberships/{myEmail}.role` if its `hid` matches the path.
- **Email must be verified** (Google is automatic). The old "password accounts are trusted" shortcut is removed, because with open sign-up anyone could claim an invited address.
- Exception kept for the 2 existing accounts (krrish, preeti): they already exist, so nobody else can register them. They keep working with no data move; the app writes their membership docs on first sign-in.
- Rules enforce: households are isolated from each other; only Admins touch setup keys + memberships; an Admin can only add people to THEIR household; nobody can overwrite another household's membership; creating a household and its first Admin membership happen together.

## Screens (redesign)
- **Login**: tabs *Sign in* / *Create account*, Forgot password, Continue with Google, Try as guest.
- **Check your inbox** (verify link, resend, "I've verified").
- **Create your household** (3 fields) and **Waiting for an invite** (shows the email to give the admin).
- **Settings → 👥 Household**: rename, member list (name · email · role chip · Joined / Invited), Add person, change role, remove, leave, share invite.
- **Settings → Account**: your email + role, change password (reset link), sign out.
- Header chip shows your name; role shown as a small tag.

## Code changes
- `config.js`: drop fixed `MEMBERS`; household comes from the membership.
- `firestore.js` adapter: sign-up, verify, reset, membership lookup, dynamic `hid`, team functions.
- `store.js`: roles admin/editor/viewer (editor can edit any entry; setup keys admin-only).
- New: `views/auth.js`, `views/onboarding.js`, `views/team.js`; Settings gets Household + Account.
- `firestore.rules`: rewritten (multi-household).
- `tools/reminders/send.mjs`: loops over every household that has devices.
- Local mode, guest mode and all current screens stay as they are.

## Phases (built on a branch `multi-user`; live app untouched until you say publish)
1. **Rules + data model + emulator tests** (isolation, roles, hijack attempts). ← security first
2. **Auth screens + onboarding** (sign-up, verify, reset, create household).
3. **Household screen** (add / role / remove / invite share) and role changes in the app.
4. **Existing family** (krrish admin, preeti editor) auto-claimed; reminders job for many households.
5. **Tests + screenshots + docs → local demo for you → you say publish → push + publish rules.**

## Tests
- Rules emulator: household A cannot read or write B; admin/editor/viewer matrix; editor can't add people; admin of A can't add to B; unverified email blocked; create-household batch.
- Two or three browsers on the emulator: sign up → verify → create household → add an editor → editor sees data and edits any entry → viewer is read-only → removed person is locked out → two households stay separate.
- All existing 36 app tests still pass.

## What YOU click in Firebase (when we publish)
1. Authentication → Settings → User actions → **turn ON** "Enable create (sign-up)" (we turned it off earlier).
2. Authentication → Templates → set sender name "Kozy" on the verify-email and reset-password mails.
3. Firestore → Rules → paste the new rules → Publish (I give you the text).
4. Check Email/Password and Google are both enabled (Sign-in method).

## Risks (honest)
- **Free plan quota**: Firebase Spark allows ~50k reads and 20k writes per day for ALL households together. Fine for a few dozen families; if it ever fills up, the app pauses until the next day. It never bills you unless you switch on the paid plan.
- **Spam households**: anyone with a verified email can make one. Fine for now; limits can be added later.
- **Unmerged branch** `claude/weekly-grocery-polish` (v1.7) touches Stock and Settings. Merge or drop it before step 3 to avoid clashes.
- **Verification emails** come from a Firebase address and can land in spam. The screen says "check Spam" and has Resend.

## Status (30 Oct 2026, night)
- Phases 1–5 DONE and committed on `multi-user`; not merged, not pushed, not published.
- Tests green: `npx playwright test` (36), `tests-rules` `npm test` (14), `npm run test:app` (6, real app on emulators).
- Try it: `cd tests-rules && npm run demo`, open http://localhost:5173/?emulator=1
- Left for you (needs your Firebase login): the 4 console steps above, then merge + push.
