-- Migration 19: new widget kinds + verified creator badge

-- Widen widget_kind check constraint on blocks to include stream_schedule and cross_promo.
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
    'tip_jar','og_card','stream_schedule','cross_promo'
  )
);

-- Verified creator badge column on profiles.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;
