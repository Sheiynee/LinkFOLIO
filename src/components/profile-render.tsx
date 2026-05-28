import { ExternalLink } from "lucide-react";
import {
  type Theme,
  buttonRadiusClass,
  buttonExtraStyle,
} from "@/lib/themes";
import type { Block } from "@/lib/blocks";
import type { WidgetData } from "@/lib/widgets/types";
import {
  styleForRole,
  readBlockTypographyOverride,
  resolveElementTypography,
  userFontFaceCss,
  type UserFontRecord,
} from "@/lib/typography";
import { BackgroundLayers } from "./background-layers";
import { WidgetRenderer } from "./widget-renderer";

export interface ProfileRenderData {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  blocks: Block[];
  verified?: boolean;
}

export function ProfileRender({
  profile,
  theme,
  preview = false,
  widgetData = {},
  userFonts = [],
}: {
  profile: ProfileRenderData;
  theme: Theme;
  preview?: boolean;
  widgetData?: Record<string, WidgetData | undefined>;
  userFonts?: UserFontRecord[];
}) {
  const name = profile.display_name ?? profile.username;
  const radiusClass = buttonRadiusClass(theme.button_shape);
  const extraButtonStyle = buttonExtraStyle(theme.button_style);

  const bodyStyle = styleForRole(theme.typography.body, userFonts);
  const displayStyle = styleForRole(theme.typography.display, userFonts);
  const monoStyle = styleForRole(theme.typography.mono, userFonts);

  const buttonStyle: React.CSSProperties = {
    backgroundColor: theme.button_bg,
    color: theme.button_text,
    borderColor: theme.button_border,
    ...styleForRole(theme.typography.ui, userFonts),
    ...extraButtonStyle,
  };

  const fontFaceCss = userFontFaceCss(userFonts);

  return (
    <div
      className="relative min-h-screen w-full flex flex-col items-center py-16 px-4 isolate"
      style={{ color: theme.text_color, ...bodyStyle }}
    >
      {fontFaceCss && <style dangerouslySetInnerHTML={{ __html: fontFaceCss }} />}
      <BackgroundLayers layers={theme.background.layers} />

      <div
        className="h-24 w-24 mb-4 rounded-full overflow-hidden ring-4"
        style={{ borderColor: theme.accent_color, boxShadow: `0 0 0 4px ${theme.accent_color}40` }}
      >
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full flex items-center justify-center text-3xl font-bold"
            style={{ backgroundColor: theme.accent_color, color: theme.button_text }}
          >
            {name[0]?.toUpperCase()}
          </div>
        )}
      </div>

      <h1 className="text-2xl font-bold mb-1 flex items-center gap-2" style={displayStyle}>
        {name}
        {profile.verified && (
          <span
            title="Verified creator"
            className="inline-flex items-center justify-center rounded-full w-5 h-5 shrink-0"
            style={{ backgroundColor: theme.accent_color }}
          >
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}
      </h1>
      <p className="mb-4 text-sm" style={{ ...monoStyle, color: theme.muted_color }}>
        @{profile.username}
      </p>

      {profile.bio && (
        <p className="text-center max-w-sm mb-8" style={{ color: theme.muted_color }}>
          {profile.bio}
        </p>
      )}

      <div className="w-full max-w-sm space-y-3">
        {profile.blocks.length === 0 ? (
          <p className="text-center text-sm" style={{ color: theme.muted_color }}>
            Nothing here yet.
          </p>
        ) : (
          profile.blocks.map((block) => {
            const override = readBlockTypographyOverride(block.meta);
            switch (block.type) {
              case "link":
                if (!block.url || !block.title) return null;
                return (
                  <a
                    key={block.id}
                    href={preview ? "#" : `/r/${block.id}`}
                    target={preview ? undefined : "_blank"}
                    rel={preview ? undefined : "noopener noreferrer"}
                    onClick={preview ? (e) => e.preventDefault() : undefined}
                    className={`flex items-center justify-between w-full border px-5 py-3 transition hover:opacity-90 ${radiusClass}`}
                    style={{
                      ...buttonStyle,
                      ...resolveElementTypography(theme.typography, "ui", override, userFonts),
                    }}
                  >
                    <span className="font-medium">{block.title}</span>
                    <ExternalLink className="h-4 w-4 opacity-60" />
                  </a>
                );
              case "heading":
                return (
                  <h2
                    key={block.id}
                    className="text-xl font-bold pt-4 pb-1 text-center"
                    style={{
                      color: theme.text_color,
                      ...resolveElementTypography(theme.typography, "heading", override, userFonts),
                    }}
                  >
                    {block.content}
                  </h2>
                );
              case "text":
                return (
                  <p
                    key={block.id}
                    className="whitespace-pre-wrap text-center text-sm leading-relaxed py-2"
                    style={{
                      color: theme.muted_color,
                      ...resolveElementTypography(theme.typography, "body", override, userFonts),
                    }}
                  >
                    {block.content}
                  </p>
                );
              case "divider":
                return (
                  <hr
                    key={block.id}
                    className="my-2 border-0 h-px w-full"
                    style={{ backgroundColor: theme.muted_color, opacity: 0.3 }}
                  />
                );
              case "widget":
                return (
                  <WidgetRenderer
                    key={block.id}
                    id={block.id}
                    kind={block.widget_kind}
                    meta={block.meta as Record<string, unknown> | null}
                    title={block.title}
                    theme={theme}
                    preview={preview}
                    widgetData={widgetData}
                    username={profile.username}
                  />
                );
              default:
                return null;
            }
          })
        )}
      </div>

      <p className="mt-12 text-xs" style={{ color: theme.muted_color }}>
        Powered by{" "}
        <a
          href={preview ? "#" : "/"}
          onClick={preview ? (e) => e.preventDefault() : undefined}
          className="hover:underline font-medium"
          style={{ color: theme.accent_color }}
        >
          LinkFolio
        </a>
      </p>
    </div>
  );
}
