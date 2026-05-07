-- ============================================================
-- STEP 5 — Content blocks
-- Replaces "links" with a unified "blocks" table that supports
-- mixed content types (link, text, heading, divider).
-- ============================================================

create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references next_auth.users(id) on delete cascade not null,
  type text not null check (type in ('link', 'text', 'heading', 'divider')),
  position integer default 0 not null,
  title text,
  url text,
  icon text,
  content text,
  meta jsonb,
  created_at timestamptz default now()
);

create index if not exists blocks_user_position_idx
  on public.blocks (user_id, position);

-- Migrate existing links into blocks (idempotent — only copies missing rows)
insert into public.blocks (id, user_id, type, position, title, url, icon, created_at)
select id, user_id, 'link', position, title, url, icon, created_at
from public.links
on conflict (id) do nothing;

-- ── RLS ────────────────────────────────────────────────────
alter table public.blocks enable row level security;

create policy "Blocks are publicly readable"
  on public.blocks for select using (true);

create policy "Users can manage own blocks"
  on public.blocks for all
  using (next_auth.uid() = user_id);

-- ── Grants for service_role (server-side admin client) ────
grant all privileges on public.blocks to service_role;

-- ── Update auto-create trigger to use blocks table ────────
create or replace function public.handle_new_account()
returns trigger
language plpgsql
security definer set search_path = public, next_auth
as $$
declare
  github_username text;
  user_email text;
begin
  if (select count(*) from public.blocks where user_id = new."userId") > 0 then
    return new;
  end if;

  if new.provider = 'google' then
    select email into user_email from next_auth.users where id = new."userId";
    if user_email is not null then
      insert into public.blocks (user_id, type, position, title, url, icon)
      values (new."userId", 'link', 0, 'Email', 'mailto:' || user_email, 'mail');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_account_linked on next_auth.accounts;
create trigger on_account_linked
  after insert on next_auth.accounts
  for each row execute procedure public.handle_new_account();

-- Note: the old public.links table is kept for now as a backup.
-- Once you've verified everything works, you can drop it with:
--   drop table public.links;
