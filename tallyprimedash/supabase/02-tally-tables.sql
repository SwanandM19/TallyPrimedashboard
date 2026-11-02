-- 02-tally-tables.sql
-- Run this ONCE in Supabase > SQL Editor (after 01-cashflow-tables.sql if you needed that one).
-- It is safe to run again: it only creates things that are missing. The row rules are filled in only while
-- the rules table is still empty, so your later edits are never overwritten.
--
-- What it creates
--   tally_ledger_daily   one row per company / day / voucher group / ledger  (what the agent sends)
--   tally_days           which days have been received (a day with no vouchers still counts)
--   tally_agent_status   when the agent last reported
--   tally_settings       holds the HASH of the agent's ingest secret (never readable by the website)
--   cashflow_row_map     rules: which Tally ledgers fill which row of which sheet ("Actual Taken")
--   functions            tally_ingest_day / tally_heartbeat  (called by the agent)
--                        tally_actuals / tally_status / tally_unmatched  (called by the dashboard)

-- ---------------------------------------------------------------------------------------------
-- tables
-- ---------------------------------------------------------------------------------------------
create table if not exists public.tally_settings (
  id int primary key default 1 check (id = 1),
  ingest_secret_hash text,
  updated_at timestamptz not null default now()
);
alter table public.tally_settings enable row level security;
revoke all on public.tally_settings from anon, authenticated;
-- no policy on purpose: the website and the agent can never read or write this table directly.

create table if not exists public.tally_ledger_daily (
  company text not null,
  day date not null,
  voucher_group text not null,          -- 'Receipt' / 'Payment' / 'Journal' / ... (parent of the voucher type)
  ledger text not null,
  debit numeric(18,2) not null default 0,
  credit numeric(18,2) not null default 0,
  entries int not null default 0,
  ingested_at timestamptz not null default now(),
  primary key (company, day, voucher_group, ledger)
);
create index if not exists tally_ledger_daily_day_idx on public.tally_ledger_daily (day);

create table if not exists public.tally_days (
  company text not null,
  day date not null,
  vouchers int not null default 0,
  agent text,
  ingested_at timestamptz not null default now(),
  primary key (company, day)
);

create table if not exists public.tally_agent_status (
  agent text primary key,
  version text,
  last_seen timestamptz not null default now(),
  companies_open jsonb not null default '[]'::jsonb,
  companies_missing jsonb not null default '[]'::jsonb
);

create table if not exists public.cashflow_row_map (
  id bigint generated always as identity primary key,
  sheet text not null check (sheet in ('oppl','pppl','mcpl','apex')),
  row_id text not null,                  -- the row id inside the sheet, for example 'b1' or 'e3'
  flow text not null check (flow in ('receipt','payment')),
  company_pattern text not null,         -- matched with ILIKE against the Tally company name
  ledger_regex text not null,            -- matched (case-insensitive) against the ledger name
  priority int not null default 100,     -- a ledger counts in the FIRST matching row only (lowest number first)
  confirmed boolean not null default false,  -- false = a guess, the dashboard shows "T?"
  active boolean not null default true,
  note text,
  unique (sheet, row_id, flow, company_pattern, ledger_regex)
);

-- ---------------------------------------------------------------------------------------------
-- access (row level security)
-- ---------------------------------------------------------------------------------------------
alter table public.tally_ledger_daily enable row level security;
alter table public.tally_days enable row level security;
alter table public.tally_agent_status enable row level security;
alter table public.cashflow_row_map enable row level security;

-- Supabase may hand out broad rights on new tables by default, so start from nothing and grant only what is needed.
revoke all on public.tally_ledger_daily, public.tally_days, public.tally_agent_status, public.cashflow_row_map from anon, authenticated;
grant select on public.tally_ledger_daily, public.tally_days, public.tally_agent_status, public.cashflow_row_map to authenticated;
grant insert, update, delete on public.cashflow_row_map to authenticated;
grant all on public.tally_ledger_daily, public.tally_days, public.tally_agent_status, public.cashflow_row_map to service_role;
grant all on public.tally_settings to service_role;

drop policy if exists "Signed-in users read tally ledgers" on public.tally_ledger_daily;
create policy "Signed-in users read tally ledgers" on public.tally_ledger_daily for select to authenticated using (true);
drop policy if exists "Signed-in users read tally days" on public.tally_days;
create policy "Signed-in users read tally days" on public.tally_days for select to authenticated using (true);
drop policy if exists "Signed-in users read agent status" on public.tally_agent_status;
create policy "Signed-in users read agent status" on public.tally_agent_status for select to authenticated using (true);
drop policy if exists "Signed-in users read row map" on public.cashflow_row_map;
create policy "Signed-in users read row map" on public.cashflow_row_map for select to authenticated using (true);
drop policy if exists "Admin edits row map" on public.cashflow_row_map;
create policy "Admin edits row map" on public.cashflow_row_map for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------------------------
-- agent side: the agent calls these two functions with the public (anon / publishable) key.
-- Both refuse to do anything unless the ingest secret is right.
-- ---------------------------------------------------------------------------------------------
create or replace function public.tally_check_secret(p_secret text) returns void
language plpgsql security definer set search_path = public as $$
declare h text;
begin
  select ingest_secret_hash into h from public.tally_settings where id = 1;
  if h is null or p_secret is null or length(p_secret) < 16
     or encode(sha256(convert_to(p_secret, 'utf8')), 'hex') <> h then
    perform pg_sleep(1);   -- slows down guessing
    raise exception 'invalid ingest secret' using errcode = '28000';
  end if;
end $$;
revoke all on function public.tally_check_secret(text) from public, anon, authenticated;

-- One company + one day. p_rows = [{"g":"Receipt","l":"Ledger name","d":0,"c":1234.5,"n":2}, ...]
-- d = total debit, c = total credit, n = number of ledger lines. The whole day is REPLACED each time
-- (so a voucher deleted or changed in Tally disappears here as well). Safe to send twice.
create or replace function public.tally_ingest_day(
  p_secret text, p_company text, p_day date, p_vouchers int, p_agent text, p_rows jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform public.tally_check_secret(p_secret);
  if p_company is null or length(p_company) < 1 or length(p_company) > 200 then raise exception 'bad company'; end if;
  if p_day is null or p_day < date '2015-01-01' or p_day > current_date + 1 then raise exception 'bad day'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'rows must be an array'; end if;
  if jsonb_array_length(p_rows) > 5000 then raise exception 'too many rows'; end if;

  delete from public.tally_ledger_daily where company = p_company and day = p_day;
  insert into public.tally_ledger_daily (company, day, voucher_group, ledger, debit, credit, entries)
  select p_company, p_day,
         coalesce(nullif(left(r->>'g', 100), ''), '?'),
         left(r->>'l', 300),
         sum(coalesce((r->>'d')::numeric, 0)),
         sum(coalesce((r->>'c')::numeric, 0)),
         sum(coalesce((r->>'n')::int, 0))
  from jsonb_array_elements(p_rows) r
  where coalesce(r->>'l', '') <> ''
  group by 1, 2, 3, 4;
  get diagnostics n = row_count;

  insert into public.tally_days (company, day, vouchers, agent, ingested_at)
  values (p_company, p_day, coalesce(p_vouchers, 0), left(p_agent, 100), now())
  on conflict (company, day) do update
    set vouchers = excluded.vouchers, agent = excluded.agent, ingested_at = now();
  return jsonb_build_object('ok', true, 'rows', n);
end $$;
revoke all on function public.tally_ingest_day(text, text, date, int, text, jsonb) from public;
grant execute on function public.tally_ingest_day(text, text, date, int, text, jsonb) to anon, authenticated;

create or replace function public.tally_heartbeat(
  p_secret text, p_agent text, p_version text, p_open jsonb, p_missing jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.tally_check_secret(p_secret);
  insert into public.tally_agent_status (agent, version, last_seen, companies_open, companies_missing)
  values (left(coalesce(p_agent, 'agent'), 100), left(p_version, 50), now(),
          coalesce(p_open, '[]'::jsonb), coalesce(p_missing, '[]'::jsonb))
  on conflict (agent) do update
    set version = excluded.version, last_seen = now(),
        companies_open = excluded.companies_open, companies_missing = excluded.companies_missing;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.tally_heartbeat(text, text, text, jsonb, jsonb) from public;
grant execute on function public.tally_heartbeat(text, text, text, jsonb, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- dashboard side (signed-in users only, row level security applies)
-- ---------------------------------------------------------------------------------------------
-- "Actual Taken" per row, in LAKHS, for one sheet and a date range (receipts = credit side of Receipt
-- vouchers, payments = debit side of Payment vouchers; cancelled and optional vouchers are never sent).
create or replace function public.tally_actuals(p_sheet text, p_from date, p_to date)
returns table(row_id text, flow text, amount_lakhs numeric, confirmed boolean, ledgers int)
language sql stable set search_path = public as $$
  with maps as (
    select * from public.cashflow_row_map where sheet = p_sheet and active
  ),
  src as (
    select company, lower(voucher_group) as vg, ledger, sum(debit) as debit, sum(credit) as credit
    from public.tally_ledger_daily
    where day between p_from and p_to
    group by company, lower(voucher_group), ledger
  ),
  cand as (
    select s.company, s.vg, s.ledger, m.row_id, m.flow, m.confirmed, m.priority,
           case when m.flow = 'receipt' then s.credit else s.debit end as amt
    from src s
    join maps m
      on s.company ilike m.company_pattern
     and ((m.flow = 'receipt' and s.vg = 'receipt') or (m.flow = 'payment' and s.vg = 'payment'))
     and s.ledger ~* m.ledger_regex
  ),
  firstmatch as (
    select distinct on (company, vg, ledger) *
    from cand
    where amt <> 0
    order by company, vg, ledger, priority, row_id
  )
  select f.row_id, f.flow, round(sum(f.amt) / 100000.0, 2), bool_and(f.confirmed), count(*)::int
  from firstmatch f
  group by f.row_id, f.flow;
$$;
revoke all on function public.tally_actuals(text, date, date) from public, anon;
grant execute on function public.tally_actuals(text, date, date) to authenticated;

-- Ledgers in the period that no row of the sheet picks up (so nothing is silently missing).
create or replace function public.tally_unmatched(p_sheet text, p_from date, p_to date)
returns table(flow text, ledger text, amount_lakhs numeric)
language sql stable set search_path = public as $$
  with pats as (
    select distinct company_pattern from public.cashflow_row_map where sheet = p_sheet and active
  ),
  src as (
    select s.company, lower(s.voucher_group) as vg, s.ledger, sum(s.debit) as debit, sum(s.credit) as credit
    from public.tally_ledger_daily s
    join pats p on s.company ilike p.company_pattern
    where s.day between p_from and p_to
    group by s.company, lower(s.voucher_group), s.ledger
  ),
  flows as (
    select 'receipt'::text as flow, company, ledger, credit as amt from src where vg = 'receipt' and credit <> 0
    union all
    select 'payment'::text, company, ledger, debit from src where vg = 'payment' and debit <> 0
  )
  select f.flow, f.ledger, round(sum(f.amt) / 100000.0, 2) as amount_lakhs
  from flows f
  where not exists (
    select 1 from public.cashflow_row_map m
    where m.sheet = p_sheet and m.active and m.flow = f.flow
      and f.company ilike m.company_pattern and f.ledger ~* m.ledger_regex
  )
  group by f.flow, f.ledger
  order by 3 desc
  limit 40;
$$;
revoke all on function public.tally_unmatched(text, date, date) from public, anon;
grant execute on function public.tally_unmatched(text, date, date) to authenticated;

-- Which days each company has, and when the agent last reported.
create or replace function public.tally_status()
returns table(company text, first_day date, last_day date, days int, vouchers bigint, last_ingest timestamptz)
language sql stable set search_path = public as $$
  select company, min(day), max(day), count(*)::int, sum(vouchers)::bigint, max(ingested_at)
  from public.tally_days group by company order by company;
$$;
revoke all on function public.tally_status() from public, anon;
grant execute on function public.tally_status() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- row rules (the same rules that were used for the earlier preview, built from your own Tally ledgers).
-- confirmed = true  : the ledger name clearly belongs to that row (for example BDO, Medsynaptic, Director)
-- confirmed = false : a reasonable guess (shown with "T?" so somebody checks it once)
-- Change a rule any time, for example:
--   update public.cashflow_row_map set ledger_regex = 'new|words', confirmed = true where sheet='mcpl' and row_id='d1';
-- A ledger counts in only ONE row (the lowest priority number that matches), so nothing is counted twice.
-- OPPL (Omega) has no rules yet: Omega had no vouchers after 1-Apr-2026 in the Tally that was checked.
-- ---------------------------------------------------------------------------------------------
do $seed$ begin
if not exists (select 1 from public.cashflow_row_map) then
insert into public.cashflow_row_map (sheet, row_id, flow, company_pattern, ledger_regex, priority, confirmed, note) values
  -- PPPL = Pentagon Premises (assumed; please confirm)
  ('pppl','b1','receipt','%Pentagon Premises%','BDO',10,true,'seed'),
  ('pppl','c1','payment','%Pentagon Premises%','aditya birla|abfl',20,false,'seed'),
  ('pppl','e2','payment','%Pentagon Premises%','travelling|credit card',30,true,'seed'),
  ('pppl','e3','payment','%Pentagon Premises%','director',31,true,'seed'),
  ('pppl','e4','payment','%Pentagon Premises%','repairs',32,true,'seed'),
  ('pppl','e5','payment','%Pentagon Premises%','insurance',33,true,'seed'),
  ('pppl','e6','payment','%Pentagon Premises%','renovation',34,true,'seed'),
  ('pppl','e7','payment','%Pentagon Premises%','suhas',35,true,'seed'),
  ('pppl','e8','payment','%Pentagon Premises%','incidental',36,true,'seed'),
  ('pppl','e9','payment','%Pentagon Premises%','web|hosting',37,true,'seed'),
  ('pppl','d1','payment','%Pentagon Premises%','^salary$|office expenses|conveyance|staff welfare|telephone|internet|printing|bank commission|gas connection',50,false,'seed'),
  ('pppl','e1','payment','%Pentagon Premises%','legal|professional|stamp duty|bank guarantee|sales promotions|incentive',60,false,'seed'),
  -- MCPL = Mantri Constructions
  ('mcpl','b1','receipt','%Mantri Constructions%','medsynaptic',10,true,'seed'),
  ('mcpl','b2','receipt','%Mantri Constructions%','cellcure',11,true,'seed'),
  ('mcpl','b3','receipt','%Mantri Constructions%','pasay',12,true,'seed'),
  ('mcpl','b4','receipt','%Mantri Constructions%','genepath',13,true,'seed'),
  ('mcpl','b5','receipt','%Mantri Constructions%','smifs',14,true,'seed'),
  ('mcpl','c1','payment','%Mantri Constructions%','^interest paid$',20,false,'seed'),
  ('mcpl','e2','payment','%Mantri Constructions%','travelling|credit card',30,true,'seed'),
  ('mcpl','e3','payment','%Mantri Constructions%','director',31,true,'seed'),
  ('mcpl','e4','payment','%Mantri Constructions%','repairs|advertisement',32,true,'seed'),
  ('mcpl','e5','payment','%Mantri Constructions%','insurance',33,true,'seed'),
  ('mcpl','e6','payment','%Mantri Constructions%','omega',34,true,'seed'),
  ('mcpl','e7','payment','%Mantri Constructions%','incidental',35,true,'seed'),
  ('mcpl','d1','payment','%Mantri Constructions%','^salary$|office expenses|conveyance|staff welfare|printing|bank charges',50,false,'seed'),
  ('mcpl','e1','payment','%Mantri Constructions%','professional|legal',60,true,'seed'),
  -- APEX = Apex Premises
  ('apex','a1','receipt','%Apex Premises%','omega',10,true,'seed'),
  ('apex','a2','receipt','%Apex Premises%','pentagon',11,true,'seed'),
  ('apex','c2','payment','%Apex Premises%','director',30,true,'seed'),
  ('apex','c3','payment','%Apex Premises%','insurance',31,true,'seed'),
  ('apex','c4','payment','%Apex Premises%','renovation',32,true,'seed'),
  ('apex','c1','payment','%Apex Premises%','legal|professional',40,true,'seed'),
  ('apex','c5','payment','%Apex Premises%','bank charges|labour charges|misc|incidental',50,false,'seed');
end if;
end $seed$;
