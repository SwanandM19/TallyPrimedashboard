# Owner Business Dashboard

A Next.js + Supabase dashboard that receives accounting data via API and displays
an owner-facing business overview. This is Phase 1: the API endpoint, database,
and dashboard only. The Tally sync agent that will POST real data to this API
is a separate, later phase.

```
TallyPrime (Phase 2, not built yet)
  -> Tally Sync Agent (Phase 2, not built yet)
  -> HTTPS POST
  -> Next.js API on Vercel        <-- this repo
  -> Supabase PostgreSQL          <-- this repo
  -> Next.js Owner Dashboard      <-- this repo
```

## Tech stack

Next.js (App Router) + TypeScript + Tailwind CSS + Supabase (PostgreSQL).

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the values, see below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Set these in `.env.local` for local development, and in the Vercel project
settings for deployment.

| Variable | Where it's used | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Server | Your Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Server | Supabase anon/public key. Currently unused by any browser code, but reserved for future client-side reads. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Used by the API routes and the dashboard's server-side data fetching to read/write `tally_transactions` and `tally_sync_logs`, bypassing Row Level Security. **Never** expose this to the browser. |
| `TALLY_SYNC_API_KEY` | Server only | Shared secret the Tally sync agent must send as `Authorization: Bearer <key>` when calling `/api/tally/sync`. |

`.env.local` is already covered by `.gitignore` (via the `.env*` rule) and will
never be committed.

## Supabase setup

1. Create a Supabase project.
2. Open the SQL editor and run the migration in
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). It creates:
   - `tally_transactions` — the synced accounting records, with a unique
     index on `external_id` so re-sending the same record is a no-op update
     instead of a duplicate insert.
   - `tally_sync_logs` — one row per sync request, so the dashboard can show
     "Last Sync" and you can audit whether syncs are succeeding.
   - Row Level Security is enabled on both tables with no public policies —
     all reads and writes go through the server using the service role key.
3. Copy the Project URL and the `anon` / `service_role` keys from
   Project Settings → API into your environment variables.

## API endpoints

### `GET /api/health`

Checks connectivity to Supabase.

```bash
curl http://localhost:3000/api/health
```

```json
{ "status": "ok", "database": "connected" }
```

### `POST /api/tally/sync`

Accepts one or more transactions and upserts them into `tally_transactions`,
using `external_id` for idempotency (sending the same `external_id` twice
updates the existing row instead of creating a duplicate). Requires
`Authorization: Bearer <TALLY_SYNC_API_KEY>`; every call is recorded in
`tally_sync_logs`.

```bash
curl -X POST http://localhost:3000/api/tally/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TALLY_SYNC_API_KEY" \
  -d '{
    "transactions": [
      {
        "external_id": "TEST-001",
        "transaction_type": "sale",
        "amount": 50000,
        "invoice_no": "TEST-INV-001",
        "party_name": "Test Customer",
        "transaction_date": "2026-09-09",
        "description": "Test sale"
      }
    ]
  }'
```

Or use the bundled test script, which sends the same mock payload:

```bash
TALLY_SYNC_API_KEY=YOUR_TALLY_SYNC_API_KEY npm run test:sync

# against a deployed instance:
TALLY_SYNC_API_KEY=YOUR_TALLY_SYNC_API_KEY SYNC_URL=https://YOUR-DOMAIN.vercel.app/api/tally/sync npm run test:sync
```

Responses:

- `200` — `{ "success": true, "recordsReceived": 1, "recordsInserted": 1, "message": "..." }`
- `401` — missing/incorrect `Authorization` header
- `400` — malformed JSON, missing `transactions`, empty batch, or an invalid transaction (bad type/amount/date)
- `500` — Supabase/unexpected error (no internal details are leaked to the client)

## Dashboard

The dashboard at `/` is a server component that reads directly from Supabase
(no client-side API calls). It shows:

- Last sync time and records synced, from `tally_sync_logs`.
- KPI cards for today's sales/purchases/receipts/payments, computed from
  `tally_transactions` for the current date **in IST**, regardless of the
  server's or browser's local timezone.
- Outstanding Receivables / Payables as "Not available yet" — these require
  ledger balance data not yet synced.
- A table of the 20 most recent transactions.

## Verifying the full pipeline

1. `npm run dev`
2. `curl http://localhost:3000/api/health` → expect `{"status":"ok","database":"connected"}`
3. Send the test transaction (curl or `npm run test:sync`).
4. Reload `/` — Today's Sales should show ₹50,000, and Last Sync should be populated.
5. Re-send the exact same request — `recordsReceived` stays 1, and the dashboard
   total does not double (the row is updated in place via `external_id`, not duplicated).

## Deploying to Vercel

1. Push this repository to GitHub.
2. Import the repository into Vercel.
3. In Project Settings → Environment Variables, add all four variables from
   `.env.example` with your real Supabase project's values.
4. Deploy.
5. Test `https://YOUR-DOMAIN.vercel.app/api/health`.
6. Test `https://YOUR-DOMAIN.vercel.app/api/tally/sync` with the curl command
   above (swap in the deployed URL), then check the dashboard.

## What's not built yet (Phase 2)

The TallyPrime integration itself — the Windows sync agent, Tally XML/TDL,
scheduled/automatic synchronization, outstanding-balance calculations, and
any reporting (email/WhatsApp) — is intentionally out of scope for this phase.
This repo only proves: **external client → Vercel API → Supabase → dashboard**.
