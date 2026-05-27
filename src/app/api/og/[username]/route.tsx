import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeTheme, type Theme } from "@/lib/themes";
import { gradientCss } from "@/lib/backgrounds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIZE = { width: 1200, height: 630 };

function getSiteHost(req: Request): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL).host;
  }
  return new URL(req.url).host;
}

function fallbackCard(message = "LinkFolio") {
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
          fontSize: 64,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {message}
      </div>
    ),
    SIZE
  );
}

export async function GET(
  req: Request,
  { params }: { params: { username: string } }
) {
  try {
    const host = getSiteHost(req);
    const supabase = createAdminClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, bio, avatar_url, theme, verified")
      .eq("username", params.username.toLowerCase())
      .maybeSingle();

    if (error) console.error("[og] profile lookup error:", error.message);
    if (!profile) return fallbackCard("LinkFolio");

    const theme = normalizeTheme(profile.theme);
    const name = profile.display_name ?? profile.username;
    const initial = (name[0] ?? "?").toUpperCase();
    const bio = profile.bio ? truncate(profile.bio, 110) : null;

    // Check if any Twitch live widget for this profile is currently live.
    const { data: twitchBlocks } = await supabase
      .from("blocks")
      .select("meta")
      .eq("user_id", profile.id ?? "")
      .eq("widget_kind", "twitch_live");

    let isLive = false;
    if (twitchBlocks && twitchBlocks.length > 0) {
      const channels = twitchBlocks
        .map((b) => (b.meta as { channel?: string } | null)?.channel)
        .filter(Boolean) as string[];
      if (channels.length > 0) {
        const { data: liveRows } = await supabase
          .from("creator_live_status")
          .select("is_live")
          .in("channel", channels)
          .eq("is_live", true)
          .limit(1);
        isLive = (liveRows?.length ?? 0) > 0;
      }
    }

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            padding: 80,
            background: ogBackground(theme),
            color: theme.text_color,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {/* Top row: avatar + name/handle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 40,
            }}
          >
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={name}
                width={180}
                height={180}
                style={{
                  borderRadius: 9999,
                  objectFit: "cover",
                  border: `6px solid ${theme.accent_color}`,
                }}
              />
            ) : (
              <div
                style={{
                  width: 180,
                  height: 180,
                  borderRadius: 9999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: theme.accent_color,
                  color: theme.button_text,
                  fontSize: 88,
                  fontWeight: 700,
                }}
              >
                {initial}
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  fontSize: 64,
                  fontWeight: 700,
                  lineHeight: 1.1,
                  marginBottom: 12,
                }}
              >
                {name}
                {profile.verified && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 44,
                      height: 44,
                      borderRadius: 9999,
                      background: theme.accent_color,
                      flexShrink: 0,
                    }}
                  >
                    <svg viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
                {isLive && (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 22,
                      fontWeight: 700,
                      color: "#ef4444",
                      background: "#ef44441a",
                      borderRadius: 6,
                      padding: "4px 12px",
                      letterSpacing: "0.05em",
                    }}
                  >
                    ● LIVE
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 30,
                  color: theme.muted_color,
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {`@${profile.username}`}
              </div>
            </div>
          </div>

          {/* Bio */}
          {bio && (
            <div
              style={{
                fontSize: 28,
                color: theme.muted_color,
                lineHeight: 1.45,
                marginTop: 48,
                maxWidth: 1000,
              }}
            >
              {bio}
            </div>
          )}

          {/* Spacer pushes footer to the bottom */}
          <div style={{ display: "flex", flex: 1 }} />

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: `2px solid ${theme.accent_color}40`,
              paddingTop: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: 24,
                fontWeight: 600,
              }}
            >
              <span style={{ color: theme.accent_color }}>◆</span>
              <span style={{ color: theme.text_color }}>LinkFolio</span>
            </div>
            <div
              style={{
                fontSize: 22,
                color: theme.muted_color,
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {`${host}/${profile.username}`}
            </div>
          </div>
        </div>
      ),
      SIZE
    );
  } catch (err) {
    console.error("[og] render failed:", err);
    return fallbackCard("LinkFolio");
  }
}

/**
 * next/og's satori renderer supports only linear-gradient + solid colors as
 * background, so OG cards collapse the layered background to its first
 * gradient layer (or first color we can find).
 */
function ogBackground(theme: Theme): string {
  for (const layer of theme.background.layers) {
    if (layer.visible === false) continue;
    if (layer.type === "gradient") return gradientCss(layer);
    if (layer.type === "image") return `url(${layer.url})`;
    if (layer.type === "mesh" && layer.blobs[0]) return layer.blobs[0].color;
    if (layer.type === "pattern") return layer.color;
  }
  return "#0f172a";
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}
