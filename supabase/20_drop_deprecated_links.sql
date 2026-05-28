-- Drop the deprecated links table created in 02_app_schema.sql.
-- It was superseded by the blocks table in 05_blocks.sql and has been
-- unused since then. Idempotent: safe to run even if already dropped.
drop table if exists public.links;
