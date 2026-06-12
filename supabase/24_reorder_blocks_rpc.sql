-- ============================================================
-- STEP 24 — Atomic block reorder
--
-- `reorderBlocks` previously issued one UPDATE per block. Non-transactional:
-- a failure halfway left the list half-reordered, and N round trips made
-- drag-reorder slower the more blocks a creator has. This RPC applies the
-- whole ordering in a single statement (positions = array index), scoped to
-- the owning user.
-- ============================================================

create or replace function public.reorder_blocks(
  p_user_id uuid,
  p_ids uuid[]
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.blocks b
  set position = u.pos - 1
  from unnest(p_ids) with ordinality as u(id, pos)
  where b.id = u.id
    and b.user_id = p_user_id;
$$;

grant execute on function public.reorder_blocks(uuid, uuid[]) to service_role;
