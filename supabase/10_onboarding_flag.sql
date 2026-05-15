-- ============================================================
-- STEP 10 — Onboarding completion flag
--
-- Tracks when a user finished the /onboarding flow so we can:
--   * gate the dashboard "Quick start" card
--   * prevent the flow from re-appending widgets when re-run
--   * surface a "you've already done this" guard inside /onboarding
-- ============================================================

alter table public.profiles
  add column if not exists onboarded_at timestamptz;

-- Backfill: profiles with at least one block were effectively onboarded
-- via the old flow. Treat them as done so they don't see /onboarding
-- nags after deploying this change.
update public.profiles p
set onboarded_at = now()
where p.onboarded_at is null
  and exists (select 1 from public.blocks b where b.user_id = p.id);
