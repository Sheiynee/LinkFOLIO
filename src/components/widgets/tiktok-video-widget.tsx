import type { Theme } from "@/lib/themes";
import type { WidgetSize } from "@/lib/widgets/types";
import { CompactRow } from "./compact-row";

export function TikTokVideoWidget({
  username,
  videoId,
  theme,
  size = "default",
  preview = false,
}: {
  username: string;
  videoId: string;
  theme: Theme;
  size?: WidgetSize;
  preview?: boolean;
}) {
  const href = preview ? "#" : `https://www.tiktok.com/@${username}/video/${videoId}`;

  if (size === "compact") {
    return (
      <CompactRow
        href={href}
        preview={preview}
        theme={theme}
        icon={
          <span
            className="inline-block h-6 w-6 rounded-md flex items-center justify-center font-bold text-sm text-white"
            style={{ background: "linear-gradient(135deg, #25F4EE 0%, #000 50%, #FE2C55 100%)" }}
          >
            ♪
          </span>
        }
        title={`@${username}`}
        tag="tiktok"
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
        <div
          className="h-12 w-12 rounded-2xl shrink-0 flex items-center justify-center font-bold text-lg"
          style={{
            background: "linear-gradient(135deg, #25F4EE 0%, #000 50%, #FE2C55 100%)",
            color: "#ffffff",
          }}
        >
          ♪
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold truncate">@{username}</span>
            <span
              className="text-xs px-1.5 py-0.5 rounded font-mono shrink-0"
              style={{
                backgroundColor: theme.button_bg,
                color: theme.muted_color,
                border: `1px solid ${theme.button_border}`,
              }}
            >
              tiktok
            </span>
          </div>
          <p className="text-xs truncate" style={{ color: theme.muted_color }}>
            Watch on TikTok
          </p>
        </div>
      </div>
    </a>
  );
}
