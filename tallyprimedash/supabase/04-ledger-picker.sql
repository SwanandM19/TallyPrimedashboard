-- 04-ledger-picker.sql
-- Run this ONCE in Supabase > SQL Editor, AFTER 02-tally-tables.sql. Safe to run again.
-- It only ADDS things (one table, three functions) and replaces two read-only dashboard functions.
-- It never touches the data the agent sent, and never touches Tally.
--
-- What it adds
--   cashflow_row_ledgers      "this Tally ledger counts in this row of this sheet" (picked by a person on the dashboard)
--   tally_sheet_company()     which Tally company belongs to which sheet
--   tally_ledger_options()    the list of ledgers shown in the row dropdown (with the amount in the chosen dates)
--   cashflow_set_row_ledgers() saves the ledgers a person ticked for one row (signed-in users only)
--   tally_actuals / tally_unmatched are replaced so that a picked ledger always wins over an automatic rule.

-- ---------------------------------------------------------------------------------------------
-- which Tally company belongs to which sheet
-- ---------------------------------------------------------------------------------------------
create or replace function public.tally_sheet_company(p_sheet text) returns text
language sql immutable set search_path = public as $$
  select case p_sheet
    when 'oppl' then '%Omega Premises%'
    when 'pppl' then '%Pentagon Premises%'
    when 'mcpl' then '%Mantri Constructions%'
    when 'apex' then '%Apex Premises%'
  end
$$;
revoke all on function public.tally_sheet_company(text) from public, anon;
grant execute on function public.tally_sheet_company(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- the ledgers people have ticked for a row
-- ---------------------------------------------------------------------------------------------
create table if not exists public.cashflow_row_ledgers (
  id bigint generated always as identity primary key,
  sheet text not null check (sheet in ('oppl','pppl','mcpl','apex')),
  row_id text not null,                                  -- the row inside the sheet, for example 'b1' or 'e3'
  flow text not null check (flow in ('receipt','payment')),
  ledger text not null,                                  -- the exact Tally ledger name
  updated_by uuid,
  updated_at timestamptz not null default now()
);
-- a ledger counts in ONE row only (per sheet and side), so nothing is ever counted twice
create unique index if not exists cashflow_row_ledgers_one_row
  on public.cashflow_row_ledgers (sheet, flow, lower(ledger));
create index if not exists cashflow_row_ledgers_row on public.cashflow_row_ledgers (sheet, row_id);

alter table public.cashflow_row_ledgers enable row level security;
revoke all on public.cashflow_row_ledgers from anon, authenticated;
grant select on public.cashflow_row_ledgers to authenticated;
grant all on public.cashflow_row_ledgers to service_role;
drop policy if exists "Signed-in users read picked ledgers" on public.cashflow_row_ledgers;
create policy "Signed-in users read picked ledgers" on public.cashflow_row_ledgers
  for select to authenticated using (true);
-- no insert/update/delete policy on purpose: changes go through cashflow_set_row_ledgers() below.

-- ---------------------------------------------------------------------------------------------
-- "Actual Taken" per row. A ledger a person picked beats every automatic rule.
-- (same result columns as before, so the dashboard keeps working)
-- ---------------------------------------------------------------------------------------------
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
    union all
    select s.company, s.vg, s.ledger, k.row_id, k.flow, true, -1,
           case when k.flow = 'receipt' then s.credit else s.debit end
    from src s
    join public.cashflow_row_ledgers k
      on k.sheet = p_sheet and k.flow = s.vg and lower(k.ledger) = lower(s.ledger)
    where s.company ilike public.tally_sheet_company(p_sheet)
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
  with src as (
    select s.company, lower(s.voucher_group) as vg, s.ledger, sum(s.debit) as debit, sum(s.credit) as credit
    from public.tally_ledger_daily s
    where s.company ilike public.tally_sheet_company(p_sheet)
      and s.day between p_from and p_to
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
  and not exists (
    select 1 from public.cashflow_row_ledgers k
    where k.sheet = p_sheet and k.flow = f.flow and lower(k.ledger) = lower(f.ledger)
  )
  group by f.flow, f.ledger
  order by 3 desc
  limit 40;
$$;
revoke all on function public.tally_unmatched(text, date, date) from public, anon;
grant execute on function public.tally_unmatched(text, date, date) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- the list behind the row dropdown: every ledger of the sheet's company that has ever had a Receipt
-- (credit side) or a Payment (debit side), with its amount in the chosen dates (Rs. Lakhs), and where it
-- counts right now:  counted_in = row id,  via = 'pick' (a person ticked it) or 'rule' (automatic rule).
-- ---------------------------------------------------------------------------------------------
create or replace function public.tally_ledger_options(p_sheet text, p_from date, p_to date)
returns table(flow text, ledger text, amount_lakhs numeric, counted_in text, via text)
language sql stable set search_path = public as $$
  with src as (
    select s.company, lower(s.voucher_group) as vg, s.ledger,
           sum(s.debit) as debit_all, sum(s.credit) as credit_all,
           sum(case when s.day between p_from and p_to then s.debit else 0 end) as debit_p,
           sum(case when s.day between p_from and p_to then s.credit else 0 end) as credit_p
    from public.tally_ledger_daily s
    where s.company ilike public.tally_sheet_company(p_sheet)
      and lower(s.voucher_group) in ('receipt', 'payment')
    group by s.company, lower(s.voucher_group), s.ledger
  ),
  flows as (
    select 'receipt'::text as flow, company, ledger, credit_p as amt from src where vg = 'receipt' and credit_all <> 0
    union all
    select 'payment'::text, company, ledger, debit_p from src where vg = 'payment' and debit_all <> 0
  ),
  one as (
    select f.flow, f.ledger, sum(f.amt) as amt,
           (select k.row_id from public.cashflow_row_ledgers k
             where k.sheet = p_sheet and k.flow = f.flow and lower(k.ledger) = lower(f.ledger)) as pick_row,
           (select m.row_id from public.cashflow_row_map m
             where m.sheet = p_sheet and m.active and m.flow = f.flow
               and f.company ilike m.company_pattern and f.ledger ~* m.ledger_regex
             order by m.priority, m.row_id limit 1) as rule_row
    from flows f
    group by f.flow, f.ledger, f.company
  )
  select o.flow, o.ledger, round(o.amt / 100000.0, 2),
         coalesce(o.pick_row, o.rule_row),
         case when o.pick_row is not null then 'pick' when o.rule_row is not null then 'rule' end
  from one o
  order by abs(o.amt) desc, o.ledger
  limit 3000;
$$;
revoke all on function public.tally_ledger_options(text, date, date) from public, anon;
grant execute on function public.tally_ledger_options(text, date, date) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- save: "these ledgers (and only these) are picked for this row"
-- Only signed-in users. Only ledger names that really exist in the Tally data of that sheet's company are kept.
-- A ledger ticked here is taken away from any other row it was picked for before (it counts once).
-- ---------------------------------------------------------------------------------------------
create or replace function public.cashflow_set_row_ledgers(p_sheet text, p_row_id text, p_flow text, p_ledgers text[])
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null then raise exception 'sign in first' using errcode = '28000'; end if;
  if p_sheet is null or p_sheet not in ('oppl','pppl','mcpl','apex') then raise exception 'bad sheet'; end if;
  if p_flow is null or p_flow not in ('receipt','payment') then raise exception 'bad flow'; end if;
  if p_row_id is null or p_row_id !~ '^[a-z][a-z0-9_]{0,39}$' then raise exception 'bad row'; end if;
  p_ledgers := coalesce(p_ledgers, '{}'::text[]);
  if coalesce(array_length(p_ledgers, 1), 0) > 300 then raise exception 'too many ledgers'; end if;

  -- this row starts empty on this side ...
  delete from public.cashflow_row_ledgers where sheet = p_sheet and row_id = p_row_id and flow = p_flow;
  -- ... and a ledger can only count in one row, so take the ticked ones away from any other row
  delete from public.cashflow_row_ledgers
   where sheet = p_sheet and flow = p_flow
     and lower(ledger) in (select lower(x) from unnest(p_ledgers) x);

  insert into public.cashflow_row_ledgers (sheet, row_id, flow, ledger, updated_by)
  select p_sheet, p_row_id, p_flow, t.ledger, uid
  from (
    select distinct on (lower(d.ledger)) d.ledger
    from public.tally_ledger_daily d
    join unnest(p_ledgers) want on lower(want) = lower(d.ledger)
    where d.company ilike public.tally_sheet_company(p_sheet)
    order by lower(d.ledger), d.ledger
  ) t;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'saved', n);
end $$;
revoke all on function public.cashflow_set_row_ledgers(text, text, text, text[]) from public, anon;
grant execute on function public.cashflow_set_row_ledgers(text, text, text, text[]) to authenticated;
