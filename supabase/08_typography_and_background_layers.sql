-- ============================================================
-- STEP 8 — Typography roles + layered backgrounds (hard cutover)
--
-- Restructures profiles.theme jsonb:
--   theme.font           ->  theme.typography.{display,heading,body,ui,mono}
--   theme.bg_from/bg_to  ->  theme.background.layers[0] (gradient)
--   theme.bg_image_url   ->  theme.background.layers[0] (image layer, deferred)
--                            ⚠ image layers ship in Phase 5; existing image
--                              backgrounds are dropped on migrate. The
--                              underlying file in the `backgrounds` bucket
--                              stays so the user can re-add it via the
--                              upcoming image-layer UI.
--
-- After migration, normalizeTheme() in src/lib/themes.ts also defends
-- against any rows that escaped this update (best-effort).
-- ============================================================

-- Default font key per row's existing theme.font (fallback 'inter').
-- Builds a TypographyRole jsonb: {"family":"inter","source":"google"}
create or replace function public._typography_role(family text)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'family', coalesce(nullif(family, ''), 'inter'),
    'source', 'google'
  );
$$;

-- Builds a single-layer gradient background from bg_from / bg_to.
create or replace function public._gradient_background(bg_from text, bg_to text)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'layers', jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type', 'gradient',
        'angle', 135,
        'stops', jsonb_build_array(
          jsonb_build_object('color', coalesce(nullif(bg_from, ''), '#1e1b4b'), 'position', 0),
          jsonb_build_object('color', coalesce(nullif(bg_to,   ''), '#0f172a'), 'position', 100)
        )
      )
    )
  );
$$;

-- Rewrite every profile's theme into the new shape.
-- Idempotent: rows already migrated (theme has typography & background.layers)
-- are left alone.
update public.profiles p
set theme = jsonb_strip_nulls(
  jsonb_build_object(
    'preset',        coalesce(p.theme->>'preset', 'glass'),
    'text_color',    p.theme->>'text_color',
    'muted_color',   p.theme->>'muted_color',
    'accent_color',  p.theme->>'accent_color',
    'button_bg',     p.theme->>'button_bg',
    'button_text',   p.theme->>'button_text',
    'button_border', p.theme->>'button_border',
    'button_shape',  p.theme->>'button_shape',
    'button_style',  p.theme->>'button_style',
    'background',
      case
        when p.theme ? 'background' then p.theme->'background'
        else public._gradient_background(p.theme->>'bg_from', p.theme->>'bg_to')
      end,
    'typography',
      case
        when p.theme ? 'typography' then p.theme->'typography'
        else jsonb_build_object(
          'display', public._typography_role(p.theme->>'font'),
          'heading', public._typography_role(p.theme->>'font'),
          'body',    public._typography_role(p.theme->>'font'),
          'ui',      public._typography_role(p.theme->>'font'),
          'mono',    public._typography_role('jetbrains')
        )
      end
  )
);

drop function public._typography_role(text);
drop function public._gradient_background(text, text);

-- Update default for new rows.
alter table public.profiles
  alter column theme set default jsonb_build_object(
    'preset', 'glass',
    'text_color', '#ffffff',
    'muted_color', '#cbd5e1',
    'accent_color', '#a855f7',
    'button_bg', 'rgba(255,255,255,0.08)',
    'button_text', '#ffffff',
    'button_border', 'rgba(255,255,255,0.18)',
    'button_shape', 'rounded',
    'button_style', 'glass',
    'background', jsonb_build_object('layers', jsonb_build_array(
      jsonb_build_object(
        'id', '00000000-0000-0000-0000-000000000000',
        'type', 'gradient',
        'angle', 135,
        'stops', jsonb_build_array(
          jsonb_build_object('color', '#1e1b4b', 'position', 0),
          jsonb_build_object('color', '#0f172a', 'position', 100)
        )
      )
    )),
    'typography', jsonb_build_object(
      'display', jsonb_build_object('family', 'inter', 'source', 'google'),
      'heading', jsonb_build_object('family', 'inter', 'source', 'google'),
      'body',    jsonb_build_object('family', 'inter', 'source', 'google'),
      'ui',      jsonb_build_object('family', 'inter', 'source', 'google'),
      'mono',    jsonb_build_object('family', 'jetbrains', 'source', 'google')
    )
  );
