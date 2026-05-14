import type { WidgetKind } from "./types";
import { parseTwitchChannel } from "./twitch";
import { parseYouTubeUrl } from "./youtube";

export interface DetectedWidget {
  kind: WidgetKind;
  meta: Record<string, unknown>;
  label: string;
}

export function detectWidgetFromUrl(input: string): DetectedWidget | null {
  const raw = input.trim();
  if (!raw) return null;

  const twitchChannel = parseTwitchChannel(raw);
  if (twitchChannel) {
    return {
      kind: "twitch_live",
      meta: { channel: twitchChannel },
      label: `Twitch live status — ${twitchChannel}`,
    };
  }

  const yt = parseYouTubeUrl(raw);
  if (yt) {
    if (yt.kind === "youtube_video") {
      return {
        kind: "youtube_video",
        meta: { video_id: yt.video_id },
        label: "YouTube video",
      };
    }
    return {
      kind: "youtube_channel",
      meta: yt.channel_id ? { channel_id: yt.channel_id } : { handle: yt.handle },
      label: yt.handle
        ? `YouTube channel — @${yt.handle}`
        : "YouTube channel",
    };
  }

  return null;
}
