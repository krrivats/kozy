# ☀️ Good morning — Kozy v1.1 report

**Short version:** everything we agreed last night is built and committed. ✅
- **23 app tests pass** (iPhone size 390×844), **twice in a row**.
- **4 security-rule tests pass** in the real Firestore emulator (about 45 allow/deny checks).
- **2 tests run the real app in Firebase mode** on local emulators: you + wife on two "phones", sign-in, live sync, roles.
- The **reminder job** was tested with demo data.

**Not tested yet:** your real Firebase project, a real iPhone, and a real push notification arriving on a phone. Those need your config and your phone (steps below).

---

## 🆕 v1.2 (18 Oct) — "minimum entries, maximum results"
| | What | Where |
|---|---|---|
| ✏️ | **Edit any entry**: tap a Recent row, a "Today:" pill, or any line in an item's / sabzi's history. Fix qty, unit, ₹, lasts-about, remark or date, or delete it (with Undo). Changing a price also fixes its Groceries spend. | Home · Stock · Sabzi |
| ✅ | **Salary-day checklist** on the 1st: Festival ₹1,500 · Emergency ₹1,500 · Card ₹3,000. ✓ Done / ✕ Skip. | Home chip · Settings → Bills & salary day |
| 💰 | **Budget manager**: your own monthly budget + "given to categories / left to assign", live while you type | Settings → Budget & limits |
| 📅 | **Year view** (April–March) with 12-month chart and per-category total + monthly average | Budget → Year |
| 💡 | **Insights**: pace for the month, categories above/below your usual by this day, your usual monthly spend | Budget → Overview / Summary |
| 🧺 | **Monthly plan**: how much of each item you use per month and a suggested buy for next month (whole packs) with ₹. "All to list" adds it to shopping. | Stock → 📅 Plan |
| 👪 | **Family spends**: write a name in the note ("medicine papa 450") and Summary shows ₹ per person. Tap a name to see those spends. | Budget → Summary · Settings → Family names |
| 📸 | **Bill photo scan**: 📷 in the + sheet → photo → Kozy reads it on the device (free) → you tick and fix lines → saved as purchases and Groceries spends | + button |

**Tests:** 32 app tests pass, twice in a row. One of them reads a real bill image with the scanner.
**Limit:** the free scanner reads **printed English bills** well. Handwritten or Hindi bills may need fixing in the review list.

---

## 1. What is done ✅ / not done ❌ / known bugs 🐞

### ✅ New tonight (v1.1)
| | Feature | Where |
|---|---|---|
| 👪 | **Roles**: You = full. Wife = adds spends, stock, sabzi, milk; can change/delete only *her own* spends. Viewer = sees, can't change. Only you change limits, bills, goals, milk rate, reset. Enforced on screen, in the app's data layer, AND in `firestore.rules`. | everywhere |
| ⚡ | **Smart quick add** on the **+** button: `sabzi 250`, `auto 80 cash`, `atta 10kg 420`, `pyaz 5kg 40/kg`. Shows a preview, one tap to save. | + |
| 🔍 | **One search box** for items (English, Hindi or Hinglish: `chawal`, `pyaz`, `आलू`). Not there? **"+ Add"**: it's saved for next time and the Bought form opens. | Stock |
| ⚖️ | **Quick sizes** 0.5 · 1 · 2 · 5 · 10 kg (they follow the unit: L, g, pcs, dozen…) + a custom box | Bought forms |
| ⏳ | **Countdown** per kitchen item ("6 days left · 22 Oct") with a used-up bar, **"Lasts about"** 7/15/30/45 days or custom, **warning days per item** | Stock |
| 🥬 | **Sabzi tab**: 31 veg + fruits with emojis. Log qty + **₹/kg** (or total). Price history with **▲ / ▼ vs last time**, low/high, **+ List** to add to shopping | Stock → Sabzi |
| 📈 | **Price history per item** (₹/kg, last, low, high, change %) | item sheets |
| 📝 | **Remarks** on items and on each purchase | item sheets |
| 🛒 | **Shopping mode**: tick several items in the shop → one **Done**. Tap any shopping-list pill to buy it. | Stock |
| 🛍️ | **"Today:" strip**: what was bought today and by whom | Stock |
| 🔁 | **Bills with any repeat**: monthly, every 2 months, quarterly, 6-monthly, yearly, **every N days** (84-day recharge). Due date + reminder N days before + **Paid / Skip**. Examples ready but paused: Electricity, Mobile recharge, LIC, Vehicle insurance, School fees, Property tax. | Settings → Bills · Home chip |
| 🎯 | **Goals** with progress bars (demo: Diwali ₹4,500 / ₹6,000) | Settings → Goals · Budget |
| 👥 | **Who spent what**: Me vs Wife totals + a filter on the spends list | Budget → Summary / Spends |
| 📰 | **Activity feed**: "Wife bought Onion 2 kg · ₹80 · 12 min ago" | Home → Recent → See all |
| 📊 | **Monthly summary in the app**: vs last month per category, who spent, sabzi price movers, biggest spends, milk | Budget → Summary |
| 🔔 | **Reminders**: "Needs you" chips on Home (bills due · items to buy · tick milk · goals) + **phone push** at 8 AM and 9 PM through a free GitHub Actions job | Home · Settings → Reminders |
| ↩️ | **Undo** for 5 s after delete / Finished / milk tick | toasts |
| 📏 | **Compact UI**: Home fits one screen, stock rows half the old height, budget categories in a 2-column grid, folded settings, no sideways scrolling (tested) | everywhere |
| 🔤 | English everywhere; **Hindi only on item names** | everywhere |
| 🟢 | **Sync dot** in Firebase mode (green saved, amber saving/offline) | headers |

### ✅ Still there from v1.0
Budget with ₹40,000 limits, amber/red bars, savings + credit card tracker, 6-month chart, CSV export, milk log with calendar + milkman bill, demo data, reset, JSON backup/restore, PWA offline, light/dark.

### 🧪 What the tests prove
| Test set | Result | Command |
|---|---|---|
| App: add/edit/undo, smart add, colours, bills, kitchen countdown, search + add, sabzi prices, shopping mode, milk, CSV, demo/summary/backup/reset, goals, **roles**, offline, **push → notification**, no sideways scroll, logic unit tests | ✅ 23/23 (×2 runs) | `npm test` |
| Security rules (owner / wife / viewer / stranger / unverified look-alike) | ✅ 4/4 | `cd tests-rules && npm test` |
| **Real app in Firebase mode** on emulators: two phones, live sync, rules block wife's setup writes and viewer's writes, stranger refused | ✅ 2/2 | `cd tests-rules && npm run test:app` |
| Reminder job with demo data (morning + evening), and with no secret (does nothing) | ✅ printed the right messages | `node tools/reminders/send.mjs --demo --morning` |

### ❌ Not done / not verified
- 🔥 Your **real Firebase project**: not run yet (needs your config). The emulator tests cover the same code paths.
- 📱 **Real iPhone**: Add to Home Screen, Google sign-in inside the home-screen app, Share → WhatsApp.
- 🔔 **A real push arriving on a phone** through Firebase → Apple. The phone-side handler is tested; the delivery chain needs your keys.
- 🤖 The **GitHub Actions reminder job on GitHub itself**: the repo isn't pushed yet.
- Not built (no answer from you): weekly grocery view, year summary.

### 🐞 Known limits
- **Settings**: each section has its own Save. Editing two sections and saving only one loses the other's edits.
- **Local mode** keeps data only in this browser. Use Backup → Restore to move it, or switch to Firebase.
- A wife-created **email/password** account must click the verify link before data opens (Kozy shows a clear message). **Google sign-in avoids this.**
- **iPhone push** works only when Kozy is opened from the **Home Screen icon** (iOS 16.4+). Apple's rule, not Kozy's.
- If the repo has **no commits for 60 days**, GitHub pauses scheduled jobs. Re-enable it in one click in the Actions tab.

---

## 2. How to run on the laptop 💻

```bash
cd "C:\Users\Arti\Downloads\Claude\Kozy"
```
```bash
npm start
```
Open 👉 **http://localhost:5173**

Handy URLs:
- Pretend it's the 1st (bills due): http://localhost:5173/?today=2026-11-01
- **See your wife's view**: http://localhost:5173/?role=member
- **See a view-only user**: http://localhost:5173/?role=viewer

(These are also buttons in Settings → Account.)

Run the tests again:
```bash
npm test
```

---

## 3. Your 5-minute test checklist ✅

1. ⚙️ Settings → **🗂️ Data** → **Load demo data**. Home: money left, chips (🔁 bills · 🛒 to buy · 🥛 tick milk · 🪔 Diwali), Recent.
2. ➕ Tap **+** and type **`pyaz 2kg 40/kg`** → preview → **Save purchase**. Then **`auto 80 cash`** → **Add spend**.
3. 🧺 **Stock**: see the Running low / Finished groups and the countdowns. Search **`chawal`**. Search **`gud`** → **+ Add "Gud"** → Bought → 1 kg.
4. 🥬 **Stock → Sabzi**: tap 🧅 Onion → price history with ▲▼ → **+ List**. Back on Kitchen, tap **Shop ✓** → tick 2 items → **Done**.
5. 🔁 Home → tap **bills due** → **Paid** on one. Settings → **Bills** → open **Electricity** → amount, due date, ✅ Active → Save.
6. 💰 **Budget** → **Summary** (who spent, vs last month, sabzi prices) → **Spends** → filter **Wife**.
7. 👀 Settings → Account → **Wife's view**: she can add, but limits are greyed out and your spends are read-only. **Exit**.
8. ↩️ Delete a spend → tap **Undo**.

---

## 4. Morning Firebase steps 🔥 (simple clicks)

> First: Settings → 🗂️ Data → **Backup (JSON)** if you want to keep the laptop's test data.

1. Open **https://console.firebase.google.com** → project **kozy**.
2. **Sign-in**: **Build → Authentication → Get started → Sign-in method**
   - **Google** → Enable → support email → Save
   - **Add new provider → Email/Password** → Enable → Save
3. **Database**: **Build → Firestore Database → Create database** → location **asia-south2 (Delhi)** → **production mode** → Create.
4. **Web app**: ⚙️ **Project settings → General → Your apps → `</>`** → nickname `kozy-web` → Register.
   Copy the `firebaseConfig` values into **`js/firebase-config.js`** (also check `projectId`; it may be like `kozy-1a2b3`).
5. **Reminder key**: ⚙️ Project settings → **Cloud Messaging** tab → *Web configuration* → **Web Push certificates → Generate key pair** → copy it into `VAPID_KEY` in `js/firebase-config.js`.
6. **Rules**: in **`firestore.rules`** replace `ME_EMAIL`, `WIFE_EMAIL` (and `VIEWER_EMAIL` if you have a viewer) with real Gmail addresses, keeping the quotes.
   Then Firestore Database → **Rules** tab → delete everything → paste the whole file → **Publish**.
7. **`js/config.js`**: set `USE_FIREBASE = true`, and put the same emails in `MEMBERS` (`'you@gmail.com': { label: 'Me', role: 'owner' }` …).
8. `npm start` → **Continue with Google**. Optional: Settings → 🗂️ Data → **Restore** your backup.
9. Stuck? Tell Claude: *"continue from CLAUDE.md — Firebase is on, test it"*.

---

## 5. GitHub Pages + phone reminders 🚀 (repo `krrivats/kozy`)

**Put it online (free):**
1. github.com → **New repository** → `kozy` → **Public** → don't add a README → Create.
2. In this folder:
   ```bash
   git remote add origin https://github.com/krrivats/kozy.git
   ```
   ```bash
   git push -u origin main
   ```
3. Repo → **Settings → Pages** → *Deploy from a branch* → **main / (root)** → Save. After 1–2 minutes: 👉 **https://krrivats.github.io/kozy/**
4. Firebase → **Authentication → Settings → Authorized domains → Add** `krrivats.github.io`.
5. Each iPhone: open the link in **Safari → Share → Add to Home Screen**. Sign in from the **home-screen icon**.

**Turn on phone reminders (free):**
1. Firebase ⚙️ Project settings → **Service accounts → Generate new private key**. A `.json` file downloads. 🔒 Keep it secret; never commit it.
2. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret** → Name `FIREBASE_SERVICE_ACCOUNT`, Value = the **whole** JSON text → Add.
3. On each phone (from the home-screen icon): Kozy → ⚙️ **Settings → 🔔 Reminders → Turn on phone reminders** → Allow.
4. Test now: repo → **Actions → Kozy reminders → Run workflow**. A notification should arrive.
   After that it runs by itself at **8:00 AM** (bills + items to buy) and **9:00 PM** (milk not ticked).

> The Firebase `apiKey` being public is normal; `firestore.rules` protects the data. The **service-account JSON is different**: it lives only in GitHub Secrets.

---

## 6. Decisions I made on my own 🤔
👉 [DECISIONS.md](DECISIONS.md) (#24–#50 are from tonight). The agreed list is 👉 [PHASE2_PLAN.md](PHASE2_PLAN.md).
The big ones:
- Free push through GitHub Actions, because Firebase's own scheduler needs a paid plan.
- Sabzi lives inside the Stock tab.
- Example bills start paused.
- First purchase guesses 15 days, then Kozy learns.
- Roles are enforced three times (screen, app, Firebase rules).

## 7. context-mode savings 💾
`ctx-stats` near the end of tonight's build: **3.1 MB of tool output kept out of context**, only 17.8 KB came in. That's **99.4% saved**, about 800K tokens.

## 📸 Screenshots
[`screenshots/`](screenshots/) has 32 images: every screen in light and dark, plus quick add, sabzi, shopping mode, bills, the wife's view and the viewer's view.
