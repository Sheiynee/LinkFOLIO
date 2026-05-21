-- ============================================================
-- STEP 15 — Audit log
--
-- Append-only log of security-relevant events. Reads are admin-only;
-- writes go through the service-role client from `lib/audit-log.ts`.
--
-- We intentionally store *hashed* IPs (sha256 + the deploy salt) rather
-- than raw addresses so a log dump doesn't leak visitor identities, but
-- still lets us spot repeat offenders.
-- ============================================================

create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  user_id     uuid references next_auth.users(id) on delete set null,
  event       text not null,
  ip_hash     text,
  user_agent  text,
  detail      jsonb
);

create index if not exists audit_log_occurred_at_idx
  on public.audit_log (occurred_at desc);

create index if not exists audit_log_event_idx
  on public.audit_log (event);

create index if not exists audit_log_user_id_idx
  on public.audit_log (user_id)
  where user_id is not null;

alter table public.audit_log enable row level security;

-- No public policies — only the service role writes/reads.
grant all privileges on public.audit_log to service_role;
