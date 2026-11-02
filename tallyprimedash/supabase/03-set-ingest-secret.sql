-- 03-set-ingest-secret.sql
-- Run this ONCE in Supabase > SQL Editor, after 02-tally-tables.sql.
--
-- 1) Make up a long random password (at least 24 letters/numbers, no spaces). Example of the shape only (make your own, do not use this one): aB3dE5gH7jK9mN2pQ4rS6tV8
-- 2) Replace PASTE-YOUR-OWN-LONG-SECRET-HERE below with it (keep the quote marks) and click Run.
-- 3) Put THE SAME secret into the agent's config.json as "ingestSecret".
--
-- Supabase stores only a one-way fingerprint (hash) of it. The agent uses the secret to prove it is the
-- agent; without it nobody can write Tally data, even though the public key is public.
-- To change it later, run this again with a new secret and update config.json.

insert into public.tally_settings (id, ingest_secret_hash, updated_at)
values (1, encode(sha256(convert_to('swanandompranavmantrivishaytally', 'utf8')), 'hex'), now())
on conflict (id) do update
  set ingest_secret_hash = excluded.ingest_secret_hash, updated_at = now();
