import type { TipPlatform } from "@/lib/widgets/types";
import type { Theme } from "@/lib/themes";
import { TIP_PLATFORMS } from "@/lib/widgets/tip-jar";

export function TipJarWidget({
  platform,
  handle,
  theme,
  preview = false,
}: {
  platform: TipPlatform;
  handle: string;
  theme: Theme;
  preview?: boolean;
}) {
  const info = TIP_PLATFORMS[platform];
  const href = preview ? "#" : info.buildUrl(handle);

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
          className="h-12 w-12 rounded-2xl shrink-0 flex items-center justify-center text-2xl"
          style={{ backgroundColor: info.brand, color: "#0a0a0a" }}
        >
          {info.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold truncate">Support on {info.label}</span>
            <span
              className="text-xs px-1.5 py-0.5 rounded font-mono shrink-0"
              style={{
                backgroundColor: theme.button_bg,
                color: theme.muted_color,
                border: `1px solid ${theme.button_border}`,
              }}
            >
              tip jar
            </span>
          </div>
          <p className="text-xs truncate" style={{ color: theme.muted_color }}>
            @{handle}
          </p>
        </div>
      </div>
    </a>
  );
}
