-- Owner Business Dashboard: initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "pgcrypto";

create table if not exists tally_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_type text not null check (transaction_type in ('sale', 'purchase', 'receipt', 'payment')),
  amount numeric not null check (amount > 0),
  invoice_no text,
  party_name text,
  transaction_date date not null,
  description text,
  source text not null default 'tally',
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotency: the same external_id must never create two rows.
-- A plain unique constraint treats each NULL as distinct, so rows without
-- an external_id never collide with each other; this also lets Supabase's
-- upsert(..., { onConflict: "external_id" }) resolve the arbiter directly
-- (a partial unique index would require a matching WHERE clause on the
-- ON CONFLICT target, which PostgREST does not emit).
create unique index if not exists tally_transactions_external_id_key
  on tally_transactions (external_id);

create index if not exists tally_transactions_transaction_date_idx
  on tally_transactions (transaction_date);

create index if not exists tally_transactions_transaction_type_idx
  on tally_transactions (transaction_type);

create index if not exists tally_transactions_invoice_no_idx
  on tally_transactions (invoice_no);

create table if not exists tally_sync_logs (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  status text not null check (status in ('success', 'partial', 'error')),
  records_received integer not null default 0,
  records_inserted integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists tally_sync_logs_received_at_idx
  on tally_sync_logs (received_at desc);

-- Keep updated_at current on every row change.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tally_transactions_set_updated_at on tally_transactions;
create trigger tally_transactions_set_updated_at
  before update on tally_transactions
  for each row
  execute function set_updated_at();

-- Row Level Security: only server-side code (service role) writes;
-- the dashboard reads via the service/server client, not directly from the browser.
alter table tally_transactions enable row level security;
alter table tally_sync_logs enable row level security;
