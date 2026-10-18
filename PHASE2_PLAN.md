# Kozy v1.1 — agreed changes (17–18 Oct 2026)

Agreed in chat with the user before they went to sleep. ✅ = asked for, ⚙️ = my choice where nothing was said.

## 👪 Who can do what (Option B + viewers)
| Role | See | Add / change | Setup (limits, bills, goals, milk rate, reset) |
|---|---|---|---|
| **Owner** (me) | everything | everything | ✅ only the owner |
| **Member** (wife) | everything | spends, stock, sabzi, milk, mark bills paid; edit/delete only her own spends | ❌ |
| **Viewer** (anyone added later) | everything | nothing (view only) | ❌ |

Enforced in `firestore.rules`, not only hidden on screen.

## ✨ Features
1. ✅ **Smart quick add**: type `sabzi 250`, `atta 10kg 420`, `onion 5kg 50/kg`, `auto 80 cash` → Kozy fills the form.
2. ✅ **One search box for items**. If an item is not found → "+ Add 'jaggery'". It stays in the list after that.
3. ✅ **Quick sizes**: 1 · 5 · 10 kg chips (matched to the unit) + a custom box.
4. ✅ **Shopping mode** ⚙️: tick several items in the shop → one **Done** marks them all bought.
5. ✅ **Sabzi tab** (inside Stock): vegetables + fruits with emojis 🧅🥔🍅. Log qty + ₹/kg. Price history with ↑ / ↓ vs last time. Search and add new ones.
6. ✅ **Countdown** per kitchen item + **"Lasts about"** input + **low-stock warning days per item**.
7. ✅ **Price history per item** (₹/kg over time; last, lowest, highest, change).
8. ✅ **Remarks**: a note on each item and on each purchase.
9. ✅ **Who spent what**: Me vs Wife totals + filter.
10. ✅ **Activity feed**: who added what, newest first.
11. ✅ **Goals** with progress bars.
12. ✅ **Bills with any repeat**: monthly / every 2 months / quarterly / yearly / every N days. Due date, reminder N days before, one-tap Paid. Seeded as paused examples: Electricity (2-monthly), Mobile recharge (84 days), LIC, Vehicle insurance, School fees, Property tax.
13. ✅ **Reminders**: an in-app "Needs you" row, plus phone push (Firebase Messaging, sent by a free GitHub Actions job at 8 AM + 9 PM IST).
14. ✅ **Monthly summary** inside the app (vs last month, by category, by person, sabzi price changes).
15. ✅ **Undo** for 5 s after delete / Finished ⚙️.
16. ✅ **English labels only**; Hindi only on item names (Atta / आटा).
17. ✅ **Compact UI**: Home fits one screen, stock grouped + folded, budget categories in a 2-column grid, settings folded.
18. ⚙️ **Sync dot** (Firebase mode): ✓ synced / ⏳ saving.

## ❌ Not doing
Shop name, gas cylinder tracker, khata/udhaar, Face ID/fingerprint, voice add, pin favourites, WhatsApp summary, separate Hindi screen, weekly grocery view ⚙️, year summary ⚙️.

---

# v1.2 — agreed 18 Oct ("minimum entries, maximum results")
✅ Edit any entry (stock, sabzi, milk, spends, from Recent) · ✅ Salary-day checklist · ✅ Budget manager (budget vs allocated)
· ✅ Year view + month view · ✅ Smart insights (usual spend, pace) · ✅ Monthly use per item + next month's buy suggestion
· ✅ Family spend from names in notes · ✅ Bill photo scan · compact + mobile first.
❌ Not doing: cash in hand, UPI paste, leftover to savings, EMI tracker, maintenance reminders, document expiry.
