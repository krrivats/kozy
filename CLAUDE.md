# Kozy — rules for every Claude session

Kozy is a family home budget + kitchen stock + milk log PWA.
Plain HTML + CSS + vanilla JS (ES modules). No build step. Must run on GitHub Pages as-is.

## Permanent rules
- 🧰 ALWAYS use context-mode tools (`ctx_batch_execute`, `ctx_execute`, `ctx_search`) for large outputs:
  installs, test runs, logs, git log, searches, browser snapshots. Saves tokens.
- 🎨 Use the frontend-design skill for ALL UI work (if it is installed; it was missing on 2026-10-17).
- 🗣️ If the user's request is vague, use the prompt-booster skill, show a short improved version, then proceed.
- 🧒 Explain steps in very simple English: WHAT + WHY in 1–2 lines, with emojis.
  The user voice-types: infer meaning, ignore typos.
- 🧪 Never say something works unless you actually tested it.
- 🛑 Don't rewrite working code without a clear reason.
- ✅ Keep the Progress checklist below updated after each phase, so a new session can resume with
  "continue from CLAUDE.md".

## How the code is laid out
- `index.html` — app shell (tab bar, FAB, sheet container).
- `css/app.css` — all styles. Colour tokens on `:root`, dark mode via `prefers-color-scheme`.
- `js/config.js` — `USE_FIREBASE` flag (false = local storage on this device).
- `js/firebase-config.js` — Firebase web config (placeholders until the user pastes real values).
- `js/store.js` — ONE data API. Picks `LocalAdapter` or `FirestoreAdapter`.
- `js/adapters/local.js`, `js/adapters/firestore.js` — the two adapters (same interface).
- `js/logic/*.js` — pure maths (budget, stock predictions, milk, formatting). No DOM.
- `js/views/*.js` — one file per screen. `js/app.js` — router + startup.
- `sw.js` + `manifest.webmanifest` + `icons/` — PWA.
- `firestore.rules` — only 2 emails allowed (ME_EMAIL, WIFE_EMAIL placeholders).
- `tests/` — Playwright tests (`npm test`). Screenshots go to `screenshots/`.
- `tools/server.mjs` — zero-dependency local server (`npm start` → http://localhost:5173).

## Progress
- [x] Phase 0 — setup, git, CLAUDE.md, PLAN.md
- [x] Phase 1 — budget, stock, milk, settings, PWA, tests, local mode (13/13 Playwright tests pass, 2026-10-17)
  - FirestoreAdapter + login written but NOT run yet (no real config). Not tested on a real iPhone yet.
  - See MORNING_REPORT.md (status + steps) and DECISIONS.md (choices made alone).
- [ ] Phase 1b — user pastes Firebase config, switch `USE_FIREBASE = true`, test with 2 phones
- [ ] Phase 1c — GitHub Pages deploy (repo krrivats/kozy)
- [ ] Phase 2 — medicines with expiry, home items (plumbing/electrical/utensils), bill photo scan with AI
