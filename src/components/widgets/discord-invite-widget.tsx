import type { DiscordInviteData, WidgetSize } from "@/lib/widgets/types";
import type { Theme } from "@/lib/themes";
import { CompactRow } from "./compact-row";

export function DiscordInviteWidget({
  inviteCode,
  data,
  theme,
  size = "default",
  preview = false,
}: {
  inviteCode: string;
  data: DiscordInviteData | null;
  theme: Theme;
  size?: WidgetSize;
  preview?: boolean;
}) {
  const href = preview ? "#" : `https://discord.gg/${data?.invite_code ?? inviteCode}`;
  const guild = data?.guild;

  if (size === "compact") {
    return (
      <CompactRow
        href={href}
        preview={preview}
        theme={theme}
        icon={
          guild?.icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={guild.icon_url} alt={guild.name} className="h-6 w-6 rounded-md object-cover" />
          ) : (
            <span className="inline-block h-6 w-6 rounded-md" style={{ background: "#5865F2" }} />
          )
        }
        title={guild?.name ?? "Discord server"}
        trailing={data?.approximate_member_count != null ? `${formatCount(data.approximate_member_count)} members` : null}
        tag="discord"
      />
    );
  }

  return (
    <a
      href={href}
      target={preview ? undefined : "_blank"}
      rel={preview ? undefined : "noopener noreferrer"}
      onClick={preview ? (e) => e.preventDefault() : undefined}
      className="block w-full rounded-2xl border overflow-hidden transition hover:opacity-95"
      style={{
        backgroundColor: theme.button_bg,
        color: theme.button_text,
        borderColor: theme.button_border,
      }}
    >
      <div className="flex items-center gap-3 p-3">
        {guild?.icon_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={guild.icon_url}
            alt={guild.name}
            className="h-12 w-12 rounded-2xl object-cover shrink-0"
          />
        ) : (
          <div
            className="h-12 w-12 rounded-2xl shrink-0 flex items-center justify-center font-bold"
            style={{ backgroundColor: "#5865F2", color: "#ffffff" }}
          >
            D
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold truncate">
              {guild?.name ?? "Discord server"}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded font-mono shrink-0"
              style={{
                backgroundColor: theme.button_bg,
                color: theme.muted_color,
                border: `1px solid ${theme.button_border}`,
              }}
            >
              discord
            </span>
          </div>
          {data ? (
            <div className="flex items-center gap-3 text-xs" style={{ color: theme.muted_color }}>
              {data.approximate_presence_count != null && (
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {formatCount(data.approximate_presence_count)} online
                </span>
              )}
              {data.approximate_member_count != null && (
                <span>· {formatCount(data.approximate_member_count)} members</span>
              )}
            </div>
          ) : (
            <p className="text-xs" style={{ color: theme.muted_color }}>
              Click to join
            </p>
          )}
        </div>
      </div>
    </a>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
