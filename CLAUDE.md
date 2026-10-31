# Kozy — rules for every Claude session

Kozy is a family home budget + kitchen stock + sabzi prices + milk log PWA (Rohtak, 7 people; owner + wife + view-only users).
Plain HTML + CSS + vanilla JS (ES modules). No build step. Must run on GitHub Pages as-is.

## Permanent rules
- 🧰 ALWAYS use context-mode tools (`ctx_batch_execute`, `ctx_execute`, `ctx_search`) for large outputs:
  installs, test runs, logs, git log, searches, browser snapshots. Saves tokens.
- 🎨 Use the frontend-design skill for ALL UI work (if it is installed; it was missing on 2026-10-17).
  UI must stay COMPACT, mobile-first (360–430px), little scrolling, no sideways scroll, tap targets ≥44px.
- 🗣️ If the user's request is vague, use the prompt-booster skill, show a short improved version, then proceed.
- 🧒 Explain steps in very simple English: WHAT + WHY in 1–2 lines, with emojis.
  The user voice-types: infer meaning, ignore typos.
- 🧪 Never say something works unless you actually tested it.
- 🛑 Don't rewrite working code without a clear reason.
- 🔤 Labels in English; Hindi ONLY on item names (Atta आटा).
- ✅ Keep the Progress checklist below updated after each phase, so a new session can resume with
  "continue from CLAUDE.md".

## How the code is laid out
- `index.html` — app shell (tab bar, FAB, sheet + toast containers).
- `css/app.css` — all styles. Colour tokens on `:root`, dark mode via `prefers-color-scheme`.
- `js/config.js` — `USE_FIREBASE` flag, `LEGACY` (krrish/preeti auto-claim `kozy-home`), role names, `loginEmail()`, `?emulator=1` test mode. Roles in Firestore: admin / editor / viewer (app-internal: owner / member / viewer).
- `js/firebase-config.js` — Firebase web config + `VAPID_KEY` (placeholders until the user pastes real values).
- `js/store.js` — ONE data API with role guards (`ReadOnlyError`). Picks `LocalAdapter` or `FirestoreAdapter`.
- `js/adapters/local.js` (`?role=member|viewer` previews), `js/adapters/firestore.js` (sign up/in/Google/reset, `resolve()` → signed-out | unverified | no-household | ready, membership → dynamic `hid`, people functions, live sync, push token).
- `js/views/auth.js` (`runGate`: login / create account / check inbox / create household), `js/views/team.js` (Settings → 👥 Household).
- `js/logic/*.js` — pure maths, no DOM: `budget` (cats, budget total, bills + salary-day checklist, goals, summary,
  insights, year view, family spends), `stock` (kitchen countdown, sabzi prices, edit purchase, monthly use + plan),
  `milk`, `quick` (smart quick-add parser), `reminders`, `activity`, `demo`, `format`.
- `js/views/*.js` — one file per screen + `spend-sheet.js` (the + button), `edit-entry.js` (edit any entry),
  `js/app.js` — router + startup.
- `sw.js` (offline + push) · `manifest.webmanifest` · `icons/` — PWA.
- `firestore.rules` — roles enforced server-side (ME_EMAIL / WIFE_EMAIL / VIEWER_EMAIL placeholders).
- `tools/server.mjs` — local server (`npm start` → http://localhost:5173).
- `tools/reminders/send.mjs` + `.github/workflows/reminders.yml` — free daily push reminders (every household) via GitHub Actions.
- `tools/reminders/backup.mjs` + `.github/workflows/backup.yml` — nightly JSON backup to a PRIVATE repo + free-limit warning. `.github/workflows/ci.yml` — all tests on every push.
- `tests/` — Playwright (`npm test`, 35 tests incl. unit and push). Screenshots → `screenshots/`.
- `tests-rules/` — Firebase emulator tests (needs Java 11+): `npm test` (14 rules tests), `npm run test:app` (real app: sign up → household → roles → removal → legacy account), `npm run test:backup` (nightly backup script), `npm run demo` (emulators + app at http://localhost:5173/?emulator=1 to try by hand; inbox screen has an "[Emulator] auto-verify" button).

## Progress
- [x] LIVE 2026-10-18: https://krrivats.github.io/kozy/ (repo krrivats/kozy, GitHub Pages from main /root),
      Firebase project kozy-7ef39, rules published, sign-up off. Login with just "krrish" (owner) / "preeti" (member); guest mode.
- [ ] Phone reminders: VAPID_KEY in js/firebase-config.js + FIREBASE_SERVICE_ACCOUNT GitHub secret (not done yet)
- [x] Phase 0 — setup, git, CLAUDE.md, PLAN.md
- [x] Phase 1 (v1.0) — budget, stock, milk, settings, PWA, tests, local mode
- [x] v1.1 — roles, smart quick add, search + add, sizes, countdown, sabzi prices, shopping mode, bills any repeat,
      goals, who-spent, activity, summary, undo, reminders, compact UI (see PHASE2_PLAN.md, DECISIONS.md #24–50)
- [x] v1.2 — edit any entry, salary-day checklist, budget manager, year view (Apr–Mar), insights, monthly plan,
      family spends from notes, bill photo scan (DECISIONS.md #51–61)
- [x] MULTI-USER built on branch `multi-user` (NOT published): anyone signs up, owns a household as Admin, adds Editors/Viewers
      (MULTI_USER_PLAN.md, DECISIONS #76+). All tests pass. TO PUBLISH: paste firestore.rules in Firebase console, turn ON sign-up
      (Authentication → Settings → User actions), set email template sender "Kozy", then merge `multi-user` into `main` and push.
- [x] v2.0.1 LIVE (multi-user, krrish still works). v2.1.0 on branch `join-codes` (NOT published): invite codes + link, delete household/account,
      backup + usage-warning script, CI, ◀ month ▶ on Home, bill scan removed. TO PUBLISH v2.1: re-paste firestore.rules (new `invites` part), merge `join-codes` → main, push.
      Backup needs secrets FIREBASE_SERVICE_ACCOUNT + BACKUP_REPO_TOKEN and a private repo krrivats/kozy-backups (not done yet).
- [ ] Later: medicines with expiry, home items (plumbing/electrical/utensils)
- [ ] Maybe: weekly grocery view; better bill reading (paid AI vision) if free OCR isn't good enough
- [x] v1.3 — redesign (glass, dock with centre +, ⚙️ in headers, ring gauge, quick actions), every row tappable to edit (DECISIONS #62–67)
