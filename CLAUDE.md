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
- `js/config.js` — `USE_FIREBASE` flag, `MEMBERS` (email → label + role: owner / member / viewer), `?emulator=1` test mode.
- `js/firebase-config.js` — Firebase web config + `VAPID_KEY` (placeholders until the user pastes real values).
- `js/store.js` — ONE data API with role guards (`ReadOnlyError`). Picks `LocalAdapter` or `FirestoreAdapter`.
- `js/adapters/local.js` (`?role=member|viewer` previews), `js/adapters/firestore.js` (auth, live sync, push token).
- `js/logic/*.js` — pure maths, no DOM: `budget` (cats, budget total, bills + salary-day checklist, goals, summary,
  insights, year view, family spends), `stock` (kitchen countdown, sabzi prices, edit purchase, monthly use + plan),
  `milk`, `quick` (smart quick-add parser), `scan` (bill photo → lines, Tesseract.js from CDN), `reminders`, `activity`, `demo`, `format`.
- `js/views/*.js` — one file per screen + `spend-sheet.js` (the + button), `edit-entry.js` (edit any entry),
  `scan-sheet.js` (📷 review). `js/app.js` — router + startup.
- `sw.js` (offline + push) · `manifest.webmanifest` · `icons/` — PWA.
- `firestore.rules` — roles enforced server-side (ME_EMAIL / WIFE_EMAIL / VIEWER_EMAIL placeholders).
- `tools/server.mjs` — local server (`npm start` → http://localhost:5173).
- `tools/reminders/send.mjs` + `.github/workflows/reminders.yml` — free daily push reminders via GitHub Actions.
- `tests/` — Playwright (`npm test`, 32 tests incl. unit, push and a real bill scan). Screenshots → `screenshots/`.
- `tests-rules/` — Firebase emulator tests (needs Java 11+): `npm test` (rules), `npm run test:app` (real app in Firebase mode).

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
- [ ] Later: medicines with expiry, home items (plumbing/electrical/utensils)
- [ ] Maybe: weekly grocery view; better bill reading (paid AI vision) if free OCR isn't good enough
- [x] v1.3 — redesign (glass, dock with centre +, ⚙️ in headers, ring gauge, quick actions), every row tappable to edit (DECISIONS #62–67)
