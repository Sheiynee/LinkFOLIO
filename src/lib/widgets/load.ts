import type { WidgetData, WidgetKind } from "./types";
import { getTwitchLiveStatus, getTwitchLatestVod } from "./twitch";
import { getYouTubeChannel, getYouTubeLatestVideo, getYouTubeLiveStatus } from "./youtube";
import { getGitHubRepo, getGitHubUser } from "./github";
import { getDiscordInvite } from "./discord";
import { fetchOgCard } from "./og-scraper";

export interface WidgetCarrier {
  id: string;
  widget_kind?: WidgetKind | null;
  meta?: Record<string, unknown> | null;
}

/**
 * Pre-fetch widget data for a list of widget-carrying rows (blocks or
 * elements). Returns a map keyed by row id so the renderer can look up
 * each widget's payload without re-fetching.
 *
 * Fetches happen in parallel; failures inside a single fetch leave that
 * row's entry absent rather than failing the whole load.
 */
export async function loadWidgetData(rows: WidgetCarrier[]): Promise<Record<string, WidgetData>> {
  const widgetRows = rows.filter((r) => r.widget_kind);
  if (widgetRows.length === 0) return {};

  const entries = await Promise.all(
    widgetRows.map(async (row): Promise<[string, WidgetData] | null> => {
      const meta = (row.meta ?? {}) as Record<string, unknown>;
      const kind = row.widget_kind;

      if (kind === "twitch_live") {
        const channel = meta.channel as string | undefined;
        if (!channel) return null;
        return [row.id, { kind: "twitch_live", data: await getTwitchLiveStatus(channel) }];
      }
      if (kind === "twitch_vod") {
        const channel = meta.channel as string | undefined;
        if (!channel) return null;
        return [row.id, { kind: "twitch_vod", data: await getTwitchLatestVod(channel) }];
      }
      if (kind === "youtube_live") {
        return [row.id, { kind: "youtube_live", data: await getYouTubeLiveStatus(meta as { channel_id?: string; handle?: string }) }];
      }
      if (kind === "youtube_channel") {
        return [row.id, { kind: "youtube_channel", data: await getYouTubeChannel(meta as { channel_id?: string; handle?: string }) }];
      }
      if (kind === "youtube_video") {
        return [row.id, { kind: "youtube_video", data: await getYouTubeLatestVideo(meta as { video_id?: string; channel_id?: string; handle?: string }) }];
      }
      if (kind === "og_card") {
        const url = meta.url as string | undefined;
        if (!url) return null;
        return [row.id, { kind: "og_card", data: await fetchOgCard(url) }];
      }
      if (kind === "github_repo") {
        const owner = meta.owner as string | undefined;
        const repo = meta.repo as string | undefined;
        if (!owner || !repo) return null;
        return [row.id, { kind: "github_repo", data: await getGitHubRepo(owner, repo) }];
      }
      if (kind === "github_user") {
        const username = meta.username as string | undefined;
        if (!username) return null;
        return [row.id, { kind: "github_user", data: await getGitHubUser(username) }];
      }
      if (kind === "discord_invite") {
        const invite_code = meta.invite_code as string | undefined;
        if (!invite_code) return null;
        return [row.id, { kind: "discord_invite", data: await getDiscordInvite(invite_code) }];
      }
      if (kind === "tip_jar") return [row.id, { kind: "tip_jar", data: null }];
      if (kind === "spotify_embed") return [row.id, { kind: "spotify_embed", data: null }];
      if (kind === "tiktok_video") return [row.id, { kind: "tiktok_video", data: null }];
      return null;
    })
  );

  return Object.fromEntries(entries.filter((e): e is [string, WidgetData] => e !== null));
}
