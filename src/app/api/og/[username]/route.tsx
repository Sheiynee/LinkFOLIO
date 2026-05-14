import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeTheme } from "@/lib/themes";

export const runtime = "edge";

const SIZE = { width: 1200, height: 630 };

function getSiteHost(req: Request): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL).host;
  }
  return new URL(req.url).host;
}

export async function GET(
  req: Request,
  { params }: { params: { username: string } }
) {
  const host = getSiteHost(req);
  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, bio, avatar_url, theme")
    .eq("username", params.username.toLowerCase())
    .maybeSingle();

  if (!profile) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0f172a",
            color: "#ffffff",
            fontSize: 60,
          }}
        >
          LinkFolio
        </div>
      ),
      SIZE
    );
  }

  const theme = normalizeTheme(profile.theme);
  const name = profile.display_name ?? profile.username;
  const avatarUrl = profile.avatar_url
    ? withCacheBuster(profile.avatar_url)
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
          background: `linear-gradient(to bottom right, ${theme.bg_from}, ${theme.bg_to})`,
          color: theme.text_color,
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={name}
            width={200}
            height={200}
            style={{
              borderRadius: 9999,
              objectFit: "cover",
              border: `8px solid ${theme.accent_color}`,
              marginBottom: 32,
            }}
          />
        ) : (
          <div
            style={{
              width: 200,
              height: 200,
              borderRadius: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: theme.accent_color,
              color: theme.button_text,
              fontSize: 96,
              fontWeight: 700,
              marginBottom: 32,
            }}
          >
            {(name[0] ?? "?").toUpperCase()}
          </div>
        )}

        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            marginBottom: 12,
            textAlign: "center",
            lineHeight: 1.1,
          }}
        >
          {name}
        </div>

        <div
          style={{
            fontSize: 32,
            color: theme.muted_color,
            marginBottom: 24,
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          }}
        >
          @{profile.username}
        </div>

        {profile.bio && (
          <div
            style={{
              fontSize: 28,
              color: theme.muted_color,
              maxWidth: 900,
              textAlign: "center",
              lineHeight: 1.4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {profile.bio}
          </div>
        )}

        <div
          style={{
            position: "absolute",
            bottom: 40,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 20,
            color: theme.muted_color,
          }}
        >
          <span>LinkFolio</span>
          <span style={{ color: theme.accent_color }}>•</span>
          <span>{host}/{profile.username}</span>
        </div>
      </div>
    ),
    SIZE
  );
}

// Avatar URLs from Supabase Storage can be aggressively cached by the
// next/og fetcher. Add a small cache-buster so a freshly-changed avatar
// shows up within a reasonable window without us managing a Cache-Control.
function withCacheBuster(url: string): string {
  const bucket = Math.floor(Date.now() / (1000 * 60 * 60)); // hourly
  return url.includes("?") ? `${url}&_=${bucket}` : `${url}?_=${bucket}`;
}
