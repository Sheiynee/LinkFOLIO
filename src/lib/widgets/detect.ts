import type { WidgetKind } from "./types";
import { parseTwitchChannel } from "./twitch";
import { parseYouTubeUrl } from "./youtube";
import { parseGitHubUrl } from "./github";
import { parseDiscordInvite } from "./discord";
import { parseTipJarUrl } from "./tip-jar";

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

  const tip = parseTipJarUrl(raw);
  if (tip) {
    return {
      kind: "tip_jar",
      meta: { platform: tip.platform, handle: tip.handle },
      label: `Tip jar — ${tip.platform}`,
    };
  }

  const discord = parseDiscordInvite(raw);
  if (discord && /discord/i.test(raw)) {
    return {
      kind: "discord_invite",
      meta: { invite_code: discord },
      label: `Discord server invite`,
    };
  }

  const gh = parseGitHubUrl(raw);
  if (gh) {
    if (gh.kind === "github_repo" && gh.owner && gh.repo) {
      return {
        kind: "github_repo",
        meta: { owner: gh.owner, repo: gh.repo },
        label: `${gh.owner}/${gh.repo}`,
      };
    }
    if (gh.kind === "github_user" && gh.username) {
      return {
        kind: "github_user",
        meta: { username: gh.username },
        label: `@${gh.username} on GitHub`,
      };
    }
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
