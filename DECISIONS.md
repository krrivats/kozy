# Decisions I made on my own 🤔

These are things your brief didn't spell out. In each case I picked the simplest sensible option.

| # | Decision | Why |
|---|---|---|
| 1 | **Total budget = the sum of the category limits** (₹40,000 with your numbers). There is no separate "salary" field. | Your 12 limits already add up to exactly ₹40,000. One number to keep right, not two. |
| 2 | **Local storage = localStorage** (one JSON blob), not IndexedDB. | A year of data is only a few hundred KB. localStorage is simpler and has no async edge cases. |
| 3 | **My own tiny server** (`tools/server.mjs`, run with `npm start`) instead of `npx serve`. | No downloads, works offline, and the content types are right for the manifest + service worker. `npx serve` also works if you prefer it. |
| 4 | **Service worker is "network first, cache as fallback".** | You always get the newest code when online, and the app still opens offline. |
| 5 | **Recurring bills (Solar EMI, WiFi, Gas) show on Home from the 1st until you tap Paid or ✕ skip**, not only on the 1st. | If you don't open the app on the 1st, the reminder is still there on the 3rd. |
| 6 | **Items you have never tapped "Bought" on get a grey "Not tracked" chip** and stay off the shopping list. | On day one, Kozy knows nothing about your kitchen. Calling everything "Finished" would make a 17-item shopping list. |
| 7 | **Prediction maths**: a "pack" = one Bought followed by the next Finished. Daily use = qty ÷ days, averaged over packs. Run-out = date bought + (qty now ÷ daily use). Running low = 7 days or fewer left. Buying again before Finished counts as a top-up. | It is the simplest model that only needs your two buttons. |
| 8 | **Monthly cost per item** = average (price ÷ days the pack lasted) × 30. With no finished pack yet, it is what you spent on that item in the last 30 days. | It needs no extra input from you. |
| 9 | **A Bought with no price adds no spend.** A Bought with a price adds a spend in Groceries + veg, mode UPI. Deleting the stock record also deletes that spend. | It avoids ₹0 entries, and the budget and stock never disagree. |
| 10 | **The milk rate is saved on each day.** Changing ₹/litre later does not change old days. | Old months stay matching the bills you already paid. |
| 11 | **Milk bill** = one spend per month in Milk (mode Cash). Pressing "Add" again updates that same spend instead of adding a second one. | No double-counting. |
| 12 | **Savings tracker and credit card tracker count ALL months**, not just this month. | "Running total" and "remaining due" only make sense over all time. |
| 13 | **Credit card remaining = starting due (₹10,000, editable) − everything in the Credit card payoff category.** | Every payoff spend lowers what's left. Nothing extra to enter. |
| 14 | **Demo data covers 3 months** ending today, and **replaces** your current data (after a confirm). | It gives the history chart and the predictions something to show. Mixing demo data with real data would be confusing. |
| 15 | **Testing helper: `?today=YYYY-MM-DD`** in the URL makes the app pretend it is that date (for example `http://localhost:5173/?today=2026-11-01` shows the recurring bills). | The tests use it. It is handy for you too. Normal use never needs it. |
| 16 | **Firestore layout**: `households/kozy-home` is the ONE shared household document. Spends, items, stock, milk and settings live in sub-collections under it. | The household is still one document, and each spend saves on its own, so the two phones never overwrite each other's changes. |
| 17 | **Firestore rules require a verified email**, not just the email address. | Without this, anyone could make an email/password account using *your* address and read the data. Google sign-in emails are already verified. The app sends the verification mail when an email account is created. |
| 18 | **Google sign-in uses a redirect when Kozy runs as a home-screen app**, and a popup in a normal browser. | Popups often break inside an iPhone home-screen app. |
| 19 | **Firebase SDK version 10.12.2** from gstatic CDN. | A stable modular build. |
| 20 | **Who added**: local mode always shows "Me". In Firebase mode, the `MEMBERS` map in `config.js` turns each email into "Me" or "Wife". The demo data mixes Me and Wife so you can see how it looks. | You asked for it. It is set in one place. |
| 21 | **Settings tab icon is the ⚙️ emoji**; the other tabs use line icons. | You asked for ⚙️ specifically. |
| 22 | **System font** (SF Pro on iPhone), not a web font. | It is fast and works offline. It also shows Hindi well on iPhone. |
| 23 | **Light/dark follows the phone's setting** (no toggle). | Your brief said "follow system". |

---

## v1.1 (night of 17–18 Oct) — choices made while building what we agreed

The agreed list is in [PHASE2_PLAN.md](PHASE2_PLAN.md). These are the extra calls I made.
Some replace v1 decisions above (marked ♻️).

| # | Decision | Why |
|---|---|---|
| 24 | ♻️ **Monthly "recurring" became "Bills"** that can repeat monthly / every 2 months / quarterly / every 6 months / yearly / every N days. Each bill has a next-due date and a reminder window (e.g. LIC: 15 days before). Your old 3 monthly bills move over by themselves. | You asked for yearly / quarterly bills too. One system is simpler than two. |
| 25 | The new example bills (Electricity 2-monthly, Mobile recharge every 84 days, LIC, Vehicle insurance, School fees, Property tax) start **Paused**. You switch one on in Settings → Bills by giving it an amount and a due date. | Real amounts and dates are yours to fill in. Paused examples never nag. |
| 26 | New category **"Other bills" 🧾 with limit 0 = no monthly limit.** It shows grey, never red. | Yearly bills would make any monthly limit look "over". |
| 27 | **Roles**: Owner = you (everything), Member = wife (adds spends/stock/sabzi/milk, marks bills paid, can change/delete **only her own** spends), Viewer = view only. Only the owner changes limits, bills, goals, milk rate, card due, restore and reset. | "Option B" from our chat, plus the view-only users you mentioned. |
| 28 | Roles are enforced **three times**: buttons hidden on screen, the data layer refuses (`ReadOnlyError`), and `firestore.rules` refuses on Google's side. | Hiding buttons alone is not security. |
| 29 | ♻️ A purchase's **price lives only in its spend entry** (not on the stock record). Old data is moved automatically on start. | One source of truth: deleting a spend can't leave a wrong price on stock. |
| 30 | **Sabzi lives inside the Stock tab** (Kitchen / Sabzi switch). The bottom bar stays at 5 tabs. 31 vegetables and fruits are pre-loaded with emojis and Hinglish search words (pyaz, aloo, tamatar…). | Six tabs would be cramped on an iPhone. You said "a separate tab inside of it". |
| 31 | Sabzi has **no "Finished" button and no countdown**, only price history and a "+ List" toggle for the shopping list. | Vegetables are bought every few days; a run-out countdown would be noise. Price per kg was the ask. |
| 32 | Sabzi price entry defaults to **₹ per kg** with a "Total" switch. The trend arrow compares with the **previous purchase**; anything under 2% counts as "same". | That's how prices are said at the mandi ("pyaz ₹40 kilo"). |
| 33 | **First purchase of a kitchen item** pre-selects "Lasts about 15 days". After one Finished, "Auto" (learned from history) is selected. Your typed estimate always beats history. | A countdown should appear from day 1, and you stay in control. |
| 34 | **Low-stock warning** defaults to 7 days per item, changeable per item (2–14 days). Demo: salt warns at 3 days. | You asked for per-item warning days. |
| 35 | **Kitchen list is grouped**: Running low → Finished → In stock → Not tracked. "In stock" and "Not tracked" **fold away only when something needs attention**; on a fresh install everything is open. | Less scrolling, but a new user isn't faced with a closed box. |
| 36 | **Shopping mode** buys the ticked items with their last quantity (editable) and an optional total price each. | "Tick many, one Done" with the fewest taps. |
| 37 | **"+ Add 'xyz'"** shows whenever you type in the search box, even when there are matches. After saving the new item, Kozy opens its Bought form straight away. | You said "search, note it down, and if it's not there, add it". |
| 38 | **Smart quick add** understands: `item qty+unit price` (`atta 10kg 420`), `₹/unit` (`onion 5kg 50/kg`, `@40`), plain spends with a keyword (`sabzi 250`, `auto 80 cash`, `plumber 1200`). Item words win over category words; "sabzi"/"veg" mean a Groceries spend, not an item. | Covers the common ways people type, with no AI service needed (free, works offline). |
| 39 | **Undo** (5 seconds) on: delete spend, delete purchase, Finished, today's milk tick. | The actions that are easy to tap by mistake. |
| 40 | **English everywhere except item names** (Atta आटा). The Hindi on the Bought/Finished buttons was removed. | You asked: only items bilingual. |
| 41 | **Home has no scrolling**: money card, "Needs you" chips (bills due · items to buy · tick milk · goals), top 3 spends, last 4 activities. Full activity is under "See all". | "Compact, easy to see". |
| 42 | **Budget has 3 views** (Categories · Spends · Summary) instead of one long page. The Summary is the monthly summary: vs last month, who spent, sabzi price movers, biggest spends, milk. | Less scrolling; the summary is built in, not sent. |
| 43 | **Goals** count money added to a chosen category **from the goal's start date** (e.g. Diwali goal = Festival fund spends since you created it). | No separate "add to goal" step to forget. |
| 44 | **Settings sections start folded.** | Shortest screen; you open the one you need. |
| 45 | **Reminders**: in-app "Needs you" chips always; phone push via Firebase Cloud Messaging, **sent by a free GitHub Actions job** at 08:00 IST (bills + items to buy) and 21:00 IST (milk not ticked). | Firebase's own scheduler (Cloud Functions) needs the paid Blaze plan; you wanted everything free. |
| 46 | The reminder job uses **the same reminder code as the app** (`js/logic/reminders.js`), and does nothing until its secret is added. | No mismatch between what the app shows and what the phone gets; safe to push to GitHub before setup. |
| 47 | Viewers may also turn on phone reminders. | Harmless; they can already see everything. |
| 48 | **Sync dot** (Firebase mode only): green = saved, amber pulsing = saving or offline. | Shows at a glance whether your wife's phone has your entry yet. |
| 49 | **`?emulator=1`** runs the app against local Firebase emulators (testing only). It can't touch real data. | That's how Firebase mode was tested tonight, before your real config exists. |
| 50 | Weekly grocery view and year summary were **not built** (no answer either way). | Easy to add later if you want them. |

---

## v1.2 (18 Oct) — minimum entries, maximum results

| # | Decision | Why |
|---|---|---|
| 51 | **Edit anything by tapping it**: Recent / Activity rows, the "Today:" pills, every line in a kitchen item's or sabzi's history. One editor covers qty, unit, total price, lasts-about, remark and date, plus Delete with Undo. | You asked to fix any entry made by mistake. Tapping the thing itself is the fewest steps. |
| 52 | Changing a purchase's price **updates its linked Groceries spend**. Clearing the price removes that spend; adding a price creates one. | The budget and the stock can never disagree. |
| 53 | **Salary-day checklist = monthly "bills" in their own group** (Festival ₹1,500, Emergency ₹1,500, Card ₹3,000). Own Home chip, ✓ Done / ✕ Skip, editable in Settings → Bills & salary day. Added automatically for existing data; already paid this month → starts next month. | It reuses the tested bill engine instead of a second system. |
| 54 | **Monthly budget** can differ from the category total. Settings shows "Given to categories ₹X · ₹Y left to assign / over" live while you edit. Until you type your own budget it **follows the category total**. | A budget manager that can't drift by mistake. |
| 55 | **Year view = Indian financial year (April–March)**, with ‹ › to change year. | Matches tax and salary thinking in India. |
| 56 | **Insights** compare each category with **your usual by this day of the month** (average of the last 3 months with data). Bills, EMI and milk count as fixed, so a big bill on the 1st doesn't look like overspending. Only gaps of at least ₹300 and 15% are shown. | Avoids noisy "you spent more!" lines early in the month. |
| 57 | **Monthly use** = qty bought in the last 90 days ÷ the days those purchases cover (first purchase to today, plus one typical gap) × 30. **Suggested buy** = whole packs of the size you usually buy, with 15% slack before adding another pack. | Uses only purchases you already log. No extra entries. |
| 58 | **Plan → "+"** puts a kitchen item on the shopping list by hand; "All to list" adds next month's whole kitchen buy. | Turns the plan into the shopping list in one tap. |
| 59 | **Family spends** are found by **whole-word names in the note**, case-insensitive ("papa" counts, "papaya" doesn't). Names are editable in Settings → Family names. Tap a name in Summary to see those spends. | You said you'd just write the name in the note. |
| 60 | **Bill scan uses Tesseract.js** (free, open source), loaded from the jsDelivr CDN only when you tap 📷. The photo is read **on the device** and never uploaded. Lines matching an item become purchases; other lines become Groceries spends. You always review before saving. | Free and private. An AI vision service would read better but costs money and sends photos away. |
| 61 | The scanner reads **printed English bills** well. Handwritten or Hindi bills and crumpled photos may come out poorly, so you can untick or fix any line. | An honest limit of free OCR. |

---

## v1.3 (18 Oct) — redesign + edit from everywhere

| # | Decision | Why |
|---|---|---|
| 62 | **New look: glass cards over a soft glow**, jade→teal accent with a saffron coin colour, dark and light both designed. Bigger numbers, uppercase micro-labels, gradient buttons. | You asked for compact, futuristic, modern and interactive. |
| 63 | **Floating dock** (Home · Budget · **+** · Stock · Milk). The + is in the middle, and ⚙️ Settings moved to every screen's header. | The + is the most used button, so it sits in the thumb's natural spot. Settings is used rarely. |
| 64 | **Home**: a ring gauge (% of budget used) next to the money left, plus a **quick-action row** (Add · Scan bill · Tick milk · Shop). Items to buy show only on the Shop button (no duplicate chip). | The fewest taps for the four daily jobs. |
| 65 | **Tap hints**: ✎ means the row opens an editor, › means it opens a list. Every list row is now tappable: goals (edit), who-spent, vs-last-month, year categories and savings (open those spends), sabzi movers (price history), plan rows (the item). | "Everywhere I tap, I should be able to edit." |
| 66 | Animations only when you **change screen** (cards rise in, bars and the ring fill), never on every data change, and none when the phone asks for reduced motion. | Feels alive without being distracting or slow. |
| 67 | A kitchen item past its run-out date says **"Due since 15 Oct"** instead of "Runs out today". | It's clearer that you should tap ✓ Finished if it's over. |

---

## v1.5 (18 Oct) — before going live next month

| # | Decision | Why |
|---|---|---|
| 68 | Header shows only **your name + a real gear ⚙️** (the old icon looked like a day/night sun). Light / Dark / Auto lives in **Settings → Appearance**, saved per phone. | Your words: "only two options, my account and the settings icon". |
| 69 | **Card due removed** (Settings and the Budget card). "Credit card payoff" stays as a normal category with its limit and the salary-day item. | Not needed; a setting nobody edits is clutter. |
| 70 | **Milk = a running account with the milkman**: every delivered day adds litres × rate to what you owe; **Pay** records money given (full or part) as a Milk spend; anything unpaid shows as **"Earlier unpaid"** next month, plus a Home chip. Older monthly milk bills count as payments. | You pay him at month end, sometimes not the full amount. |
| 71 | **Nothing to set up each month**: limits, bills, salary-day items and milk rate are not per-month, so they simply continue. On the 1st–5th a **New month** card says how last month ended. | "Whatever I set now should be taken for next month automatically." |
| 72 | **Smart limits**: each limit shows your **usual spend** (last 3 months); "Set limits to my usual spend" fills them (rounded up to ₹100) and you review → Save. | Uses your own history; never changes limits without you. |

---

## v1.6 (18 Oct) — two kinds of milk

| # | Decision | Why |
|---|---|---|
| 73 | **Milk types**, each with its own litres/day and ₹/L (default 🐃 Buffalo 2 L + 🐄 Cow 1.5 L; add or remove types in Settings → Milk). A day stores litres and rate per type. | You buy buffalo and cow milk at different prices. |
| 74 | **One tap logs every type** at its usual amount; the message offers **Change**, which opens the day editor (one − / + per type). Tapping a calendar day opens the same editor. | "One tap and done, but I can open it, change and save." |
| 75 | A new rate applies from that day on; **old days keep their rate**. Older one-milk days still count (shown as "Milk"). | The milkman's account must never change for days already past. |
