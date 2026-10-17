# ☀️ Good morning — Kozy Phase 1 report

**Short version:** Phase 1 is built and all **13 automated tests pass** ✅ (headless Chrome, iPhone size 390×844).
It runs on your laptop in **local mode**. Firebase code is written but **OFF** and **not tested yet**, because it needs your real config.

---

## 0. Setup check 🧰

| Tool | Status |
|---|---|
| Node.js | ✅ v24.19.0 |
| npm | ✅ 11.17.0 |
| git | ✅ 2.52.0 (repo created, branch `main`) |
| gh (GitHub CLI) | ❌ **not installed**. That's fine: the GitHub steps below use the website. |
| Playwright | ✅ 1.64.1 + Chromium (installed in this folder for tests) |
| context-mode plugin | ✅ active, v1.0.169. `ctx-doctor`: everything OK, one warning (install Bun for more speed, optional) |
| frontend-design skill | ❌ **not found** on this PC. I followed the design brief by hand (compact, mobile-first, light + dark). |
| prompt-booster skill | ✅ available (CLAUDE.md tells future sessions to use it) |

---

## 1. What is done ✅ / not done ❌ / known bugs 🐞

### ✅ Done (tested by the automated tests)
- 🏠 **Home**: "Left this month", days left, safe daily spend, top 3 categories, last 5 spends, a milk tile and a shopping-list tile.
- ➕ **Floating + button** on every screen: amount → category → UPI/Cash/Card → note → Add. Edit + delete by tapping any spend.
- 💰 **Budget**: 12 categories with your limits. Bars turn **amber at ≥80%** and **red above 100%**. Tap a category to filter. Month ‹ › switcher.
- 🔁 **Monthly bills** (Solar EMI, WiFi, Gas) appear on Home from the 1st: **Paid** (one tap), ✕ skip, or **Confirm all**.
- 🏦 **Savings tracker** (Festival + Emergency running totals) and 💳 **Credit card due** (starts at ₹10,000, shows what's left).
- 📊 **6-month bar chart** (plain SVG, no library) with a dashed budget line.
- 📄 **Export month to CSV** (opens fine in Excel, including Hindi).
- 🧺 **Kitchen stock**: all 17 items (English / हिंदी). Two big buttons: **Bought / खरीदा** and **Finished / ख़त्म**.
  Kozy works out how long a pack lasts, use per week, run-out date and cost per month. Chips: In stock / Running low (≤7 days) / Finished.
- 🛒 **Auto shopping list** (finished items + items running out within 7 days). **Share** (opens the share sheet → WhatsApp on iPhone) or **Copy**.
- 🥬 Every **Bought** with a price is added to **Groceries + veg** automatically.
- ➕ Add / edit / delete items (name EN + HI, unit, category). Tap an item's name to see its history.
- 🥛 **Milk log**: asks for L/day + ₹/L the first time (defaults 4 L, ₹60). **"Today's milk ✓"** in one tap, or a different amount, or skip.
  Month calendar, total litres + ₹, and **add the milkman's bill to Milk spend** (shows the difference from Kozy's total).
- ⚙️ **Settings**: limits, add/delete categories, monthly bills, card due, milk defaults, items, **Load demo data**, **Reset all** (with confirm), **Backup / Restore JSON**.
- 👤 Every entry shows **who added it** ("Me" in local mode).
- 📱 **PWA**: manifest, icons (house + ₹ coin logo), iPhone home-screen icon, and **works offline** (tested: page reloads with no internet).
- 🌗 Light + dark mode follow the system. ₹ shows in Indian format (₹40,000).
- 🔥 **FirestoreAdapter** fully written (Google + Email/Password sign-in, live sync between phones, offline cache). It stays OFF until `USE_FIREBASE = true`.
- 🔒 **firestore.rules**: only your 2 emails, which must also be verified.
- 📸 **Screenshots** of every screen, light + dark, are in [`screenshots/`](screenshots/).

### ❌ Not done / not tested
- 🔥 **Firebase mode has NOT been run** (no real config yet). The code is written carefully, but treat it as untested until you try it this morning.
- 📱 **Not tested on a real iPhone** yet, only in iPhone-sized headless Chrome. Check Share → WhatsApp and Add to Home Screen on the phone.
- 🚀 Not deployed (you said no deploy tonight).
- Phase 2 (medicines, home items, bill scan) is not started, as planned.

### 🐞 Known bugs / limits
- In **Settings**, each card has its own Save button. If you edit two cards and press only one Save, the other card's unsaved edits are lost.
- **Local mode data lives only in this browser.** Laptop data does **not** reach the phone by itself. Use Backup → Restore, or switch to Firebase.
- If you make a **new email + password account**, you must click the verify link in your email before the data opens. Kozy shows a clear message if you don't. **Google sign-in avoids this step.**
- In the full-page screenshots, the bottom tab bar appears in the middle of the image. That is how full-page screenshots draw fixed bars, not an app bug.

---

## 2. How to run on the laptop 💻

```bash
cd "C:\Users\Arti\Downloads\Claude\Kozy"
```
```bash
npm start
```
Then open 👉 **http://localhost:5173**

To run the tests again (about 35 seconds):
```bash
npm test
```

Tip 🧪: add `?today=2026-11-01` to the URL to pretend it's the 1st and see the monthly bills card:
http://localhost:5173/?today=2026-11-01

---

## 3. Your 5-minute test checklist ✅

1. ⚙️ Settings → **Load demo data** → Load demo. Home now shows about ₹13,700 left (it changes a little with the date), the safe daily spend and the last 5 spends.
2. ➕ Tap **+** → type `120` → tap **Groceries + veg** → **Add spend**. "Left this month" drops by ₹120.
3. 💰 **Budget** tab: find an **amber** bar and a **red** bar (Home misc is over its limit in the demo). Tap one to filter. Tap **CSV** and open the file.
4. 🧺 **Stock** tab: Besan / Poha show **Finished**, and a couple of items (tonight: Rice, Detergent) show **Running low**. Tap **Share** on the shopping list. Tap **Bought** on Besan → 1 kg, ₹95 → Save. Besan leaves the list and ₹95 appears in Groceries.
5. 🥛 **Milk** tab: tap **Today's milk ✓**. Tap a past day → change litres → Save. Check the litres and ₹ total. Type the milkman's bill → **Add to Milk spend**.
6. ✈️ Turn off Wi-Fi → reload the page → Kozy still opens.
7. ⚙️ **Reset all data** when you're done testing, so you start clean.

---

## 4. Morning Firebase steps 🔥 (simple clicks)

> First, **backup** any laptop test data you want to keep (Settings → Backup JSON).

1. Open **https://console.firebase.google.com** → click project **kozy**.
2. **Sign-in**: left menu **Build → Authentication → Get started** → tab **Sign-in method**:
   - Click **Google** → toggle **Enable** → pick your support email → **Save**.
   - Click **Add new provider → Email/Password** → toggle **Enable** → **Save**.
3. **Database**: **Build → Firestore Database → Create database** → location **asia-south2 (Delhi)** → **Start in production mode** → **Create**.
4. **Web app**: ⚙️ (top-left) **Project settings → General** → scroll to **Your apps** → click the **`</>`** (Web) icon → nickname `kozy-web` → leave Hosting **unticked** → **Register app**.
   Copy the values inside `firebaseConfig = { ... }`.
5. Paste those values into **`js/firebase-config.js`** (replace the `PASTE_...` lines; also check `projectId`).
6. Open **`firestore.rules`** → replace `ME_EMAIL` and `WIFE_EMAIL` with your two Gmail addresses (keep the quotes).
7. **Deploy the rules (no CLI needed)**: Firestore Database → tab **Rules** → delete everything → paste the whole `firestore.rules` file → **Publish**.
8. Open **`js/config.js`**:
   - `USE_FIREBASE = true`
   - In `MEMBERS`, replace `'ME_EMAIL'` and `'WIFE_EMAIL'` with the same two emails (this sets the "Me" / "Wife" labels).
9. `npm start` → http://localhost:5173 → **Continue with Google** → sign in.
   Want your laptop data in the cloud? Settings → **Restore** → pick the backup JSON.
10. Ask Claude: *"continue from CLAUDE.md — Firebase is on, test it"* if anything breaks.

---

## 5. Later: GitHub Pages deploy 🚀 (repo `krrivats/kozy`)

1. On **github.com** → **New repository** → name `kozy` → **Public** (free GitHub Pages needs public) → do **not** add a README → **Create**.
2. In this folder:
   ```bash
   git remote add origin https://github.com/krrivats/kozy.git
   ```
   ```bash
   git push -u origin main
   ```
3. Repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch **main**, folder **/ (root)** → **Save**. Wait 1–2 minutes.
4. Your app: 👉 **https://krrivats.github.io/kozy/**
5. Firebase → **Authentication → Settings → Authorized domains → Add domain** → `krrivats.github.io`.
6. On each iPhone: open the link in **Safari** → **Share** → **Add to Home Screen** → **Add**. 📱
7. When you change code later, bump `VERSION` in `sw.js` so old cached files are cleaned up.

> The Firebase `apiKey` being public in the repo is normal. Your data is protected by `firestore.rules`, not by hiding the key.

---

## 6. Decisions I made on my own 🤔
23 small choices, listed with reasons in 👉 [DECISIONS.md](DECISIONS.md).
The big ones: the total budget = the sum of the category limits, items never bought show "Not tracked", monthly bills stay on Home until you tap Paid or skip, and the Firebase rules require a verified email.

---

## 7. context-mode savings 💾
From `ctx-stats` at the end of the build:
- This session: **~1.4 MB of tool output kept out of context**, and only ~3.3 KB came in (**99.8% saved**, ~371K tokens).
- Across all your projects so far: 411 KB kept out.

---

## 📁 Where things are
- App: `index.html`, `css/app.css`, `js/` (store + adapters, logic, views)
- PWA: `manifest.webmanifest`, `sw.js`, `icons/`
- Firebase: `js/firebase-config.js`, `firestore.rules`, `firebase.json`
- Tests: `tests/` · Screenshots: `screenshots/`
- Rules for future Claude sessions: `CLAUDE.md` · Plan: `PLAN.md`
