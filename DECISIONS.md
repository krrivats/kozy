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
