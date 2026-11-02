# Mantri Constructions – Cashflow dashboard (Next.js + TypeScript)

The same screens as the Lovable app (employee page `/`, admin review page `/admin`, six tabs OPPL / Prerana / PPPL / MCPL / APEX / RA, Print to PDF, Submit Cashflow, notifications, review and approval) – rebuilt on **plain Next.js (App Router) + TypeScript + Tailwind + Supabase**. Nothing from the Lovable framework (TanStack Start, Vite, Cloudflare, Lovable Cloud) is used any more.

New: the **“Actual Taken”** column of the OPPL, PPPL, MCPL and APEX sheets is filled automatically from Tally. The flow is

```
Tally (read-only)  →  Agent on the server PC  →  Supabase  →  this dashboard
```

---

## 1. One-time set-up in Supabase

1. Open your project in Supabase → **SQL Editor** → New query. Paste and **Run**, one file at a time:
   1. `supabase/01-cashflow-tables.sql` – **only if the project is new** (it has no `cashflow_reports` table yet). If you re-use the Supabase project the Lovable app used, skip this file.
   2. `supabase/02-tally-tables.sql` – always.
   3. `supabase/03-set-ingest-secret.sql` – first replace `PASTE-YOUR-OWN-LONG-SECRET-HERE` with a long random password of your own (24+ letters/numbers, no spaces). **Write it down: the agent needs the same secret.**
   4. `supabase/04-ledger-picker.sql` – turns on the “Select ledgers…” dropdown under every row (see section 5). Run it after file 02. Safe to run again.
2. **Authentication → Users → Add user**: create the employee login(s) and the admin login (tick *Auto Confirm User*). The admin’s e-mail must be the same as `ADMIN_EMAIL` below.
3. **Authentication → Sign In / Providers → Email**: turn **off** “Allow new users to sign up”. Anybody who can sign in can read the Tally totals, so only people you create should be able to.
4. **Project Settings → API**: you will need *Project URL*, the *anon / publishable* key and the *service_role / secret* key.

## 2. Put the keys in the dashboard

1. Copy `.env.example` to a new file named `.env.local` (same folder).
2. Fill it in:

| Name | Where it comes from | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the **anon / publishable** key | no (public by design) |
| `SUPABASE_SERVICE_ROLE_KEY` | the **service_role / secret** key | **YES** – only on the server / Vercel, never in the agent, never in chat |
| `ADMIN_EMAIL` | the admin’s e-mail (default `admin123@gmail.com`) | no |
| `RESEND_API_KEY`, `RESEND_FROM`, `REPORT_RECIPIENT` | optional – e-mail when a sheet is submitted. Leave `RESEND_API_KEY` empty to switch e-mail off | yes |
| `NEXT_PUBLIC_SITE_URL` | the address of the website (used in the e-mail link) | no |

3. Run it:

```
npm install
npm run dev          (open http://localhost:3000)
```

To publish: `npm run build`, or import the folder into Vercel and add **the same names/values** under *Project → Settings → Environment Variables* (do **not** upload `.env.local`).

Open `/api/health` on your site to check that the server can see the settings (it shows only yes/no, never the values).

## 3. Get the Tally numbers in

The agent is the second zip (`MantriTallyAgent`). On the server PC: fill in `config.json`, run `1-CHECK-TALLY-FIRST.bat`, `2-EXTRACT-FROM-TALLY.bat`, `3-SEND-TO-SUPABASE.bat`. Then open the dashboard and press **Refresh** in the “Actual Taken from Tally” bar.

## 4. How “Actual Taken” is filled

* Each sheet has a date range (default = the range in its heading, for example JUL TO SEP-2026). Change it with the date boxes or the quick buttons.
* **Receipts** = credit side of *Receipt* vouchers; **Payments** = debit side of *Payment* vouchers (cash basis). Cancelled and optional vouchers are ignored. Amounts are shown in Rs. Lakhs.
* The rules that decide which ledger goes to which row are in the table `cashflow_row_map` (Supabase → Table Editor). Seeded rules marked `confirmed = false` show a **T?** badge – check them once, then set `confirmed = true`. A ledger is counted in only one row (lowest `priority` that matches), so nothing is counted twice.
* **T** = filled from Tally. If you type a figure yourself it is never overwritten; a small “Tally 12.34” button lets you switch back.
* The line “In Tally but not counted in any row” lists ledgers that no row picks up.
* Opening balances (section A) stay manual. Prerana and RA are project sheets with no Tally rules yet. OPPL has no rules yet (Omega Premises had no vouchers after 1-Apr-2026 in the Tally that was checked).

## 5. What changed compared with the Lovable app

* Framework: TanStack Start / Vite / Cloudflare → Next.js App Router, TypeScript, Tailwind 4.
* Server functions → route handlers in `app/api/cashflow/*` (same rules: employee/admin checks, backups trigger, feedback, approvals). They read the signed-in user’s token, so row-level security still applies.
* Auth/session: plain `@supabase/supabase-js` in the browser. The designated admin e-mail is given its admin role on first use (uses the service-role key on the server only).
* E-mail: Lovable’s gateway → Resend directly (optional).
* Hard-coded admin e-mail, recipient and admin link → environment variables.
* UI, colours, print layout and table behaviour are copied unchanged.
* Added: Tally bar, T / T? badges, `supabase/` SQL, `/api/health`.

## 6. Honest notes

* The code was type-checked in a sandbox without internet access to npm, so it has not been compiled with the real packages. If `npm run build` prints an error, send me the text and I will fix it.
* The SQL files were run and tested on a real PostgreSQL 16 (ingest, wrong secret refused, day replacement, actuals matching). Supabase-specific parts (Auth, `auth.uid()`) were simulated.

## 5. Choosing the ledgers of a row (the dropdown under every row name)

Under the name of every row of the OPPL, PPPL, MCPL and APEX sheets there is a small dropdown. It starts as **“Select ledgers…”**.

1. Press it. A list opens with **every ledger of that company that the agent sent** (receipts for income rows, payments for expense rows), largest first, with its amount in the dates chosen above the sheet. Use the search box to find a ledger.
2. Tick the ledgers that belong in the row and press **Save**.
3. The row’s **Actual Taken** now shows the total of the ticked ledgers, read from Supabase (T badge). The dropdown label shows the first ledger and “+N more”.

Things to know:
* The row names on the sheet are **not** used for matching and can stay exactly as they are. Only the ticked ledgers (and the older automatic rules) decide the figure.
* A ledger counts in **one row only**. If you tick a ledger that already counts in another row, it moves here (the list tells you where it was).
* Ledgers that count through an automatic rule show as ticked and greyed. To move one, tick it in the row where it should be.
* A ticked ledger always wins over an automatic rule. Un-tick it and press Save to hand it back to the rules.
* Everybody who can sign in can change these choices, and they apply to everyone (they are saved in Supabase, table `cashflow_row_ledgers`). Each change records who made it.
* The list shows the ledgers of the whole year that was sent, not only the chosen dates, so a ledger with no entry in the dates shows “-”.
* If the dropdowns do not appear, `04-ledger-picker.sql` has not been run yet; the Tally bar says so.
* “In Tally but not counted in any row” (bold, in the Tally bar) lists ledgers that no row has picked up yet.

