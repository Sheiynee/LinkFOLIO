-- Migration 21: tier-2 widget kinds (Last.fm, Steam, Letterboxd)

-- Widen blocks widget_kind constraint.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.blocks'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%widget_kind%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.blocks DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.blocks ADD CONSTRAINT blocks_widget_kind_check CHECK (
  widget_kind IS NULL OR widget_kind IN (
    'twitch_live','twitch_vod','youtube_channel','youtube_live','youtube_video',
    'github_repo','github_user','discord_invite','spotify_embed','tiktok_video',
    'tip_jar','og_card','stream_schedule','cross_promo',
    'lastfm_scrobbles','steam_profile','letterboxd_films'
  )
);

-- Widen elements widget_kind constraint.
ALTER TABLE public.elements DROP CONSTRAINT IF EXISTS elements_widget_kind_check;

ALTER TABLE public.elements ADD CONSTRAINT elements_widget_kind_check CHECK (
  widget_kind IS NULL OR widget_kind IN (
    'twitch_live','twitch_vod','youtube_channel','youtube_live','youtube_video',
    'github_repo','github_user','discord_invite','spotify_embed','tiktok_video',
    'tip_jar','og_card','stream_schedule','cross_promo',
    'lastfm_scrobbles','steam_profile','letterboxd_films'
  )
);
