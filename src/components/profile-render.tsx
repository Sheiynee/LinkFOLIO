import { ExternalLink } from "lucide-react";
import { fontVarFor } from "@/lib/fonts";
import {
  type Theme,
  buttonRadiusClass,
  buttonExtraStyle,
} from "@/lib/themes";

export interface ProfileRenderData {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  links: { id: string; title: string; url: string }[];
}

export function ProfileRender({
  profile,
  theme,
}: {
  profile: ProfileRenderData;
  theme: Theme;
}) {
  const name = profile.display_name ?? profile.username;
  const fontVar = fontVarFor(theme.font);
  const radiusClass = buttonRadiusClass(theme.button_shape);
  const extraButtonStyle = buttonExtraStyle(theme.button_style);

  const containerStyle: React.CSSProperties = {
    background: theme.bg_image_url
      ? `linear-gradient(to bottom right, ${theme.bg_from}cc, ${theme.bg_to}cc), url(${theme.bg_image_url})`
      : `linear-gradient(to bottom right, ${theme.bg_from}, ${theme.bg_to})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    color: theme.text_color,
    fontFamily: fontVar,
  };

  const buttonStyle: React.CSSProperties = {
    backgroundColor: theme.button_bg,
    color: theme.button_text,
    borderColor: theme.button_border,
    ...extraButtonStyle,
  };

  return (
    <div
      className="min-h-full w-full flex flex-col items-center py-16 px-4"
      style={containerStyle}
    >
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

      <h1 className="text-2xl font-bold mb-1">{name}</h1>
      <p
        className="mb-4 text-sm font-mono"
        style={{ color: theme.muted_color }}
      >
        @{profile.username}
      </p>

      {profile.bio && (
        <p
          className="text-center max-w-sm mb-8"
          style={{ color: theme.muted_color }}
        >
          {profile.bio}
        </p>
      )}

      <div className="w-full max-w-sm space-y-3">
        {profile.links.length === 0 ? (
          <p
            className="text-center text-sm"
            style={{ color: theme.muted_color }}
          >
            No links added yet.
          </p>
        ) : (
          profile.links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-between w-full border px-5 py-3 transition hover:opacity-90 ${radiusClass}`}
              style={buttonStyle}
            >
              <span className="font-medium">{link.title}</span>
              <ExternalLink className="h-4 w-4 opacity-60" />
            </a>
          ))
        )}
      </div>

      <p className="mt-12 text-xs" style={{ color: theme.muted_color }}>
        Powered by <span style={{ color: theme.accent_color }}>LinkFolio</span>
      </p>
    </div>
  );
}
