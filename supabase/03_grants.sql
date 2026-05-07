-- ============================================================
-- STEP 3 — Run this after 02_app_schema.sql
-- Grants service_role full access to the public schema so the
-- server-side admin client (used by NextAuth + dashboard pages)
-- can bypass RLS for trusted server operations.
-- ============================================================

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- Ensure future tables/sequences also get these grants
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
