import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeTheme, type Theme } from "@/lib/themes";
import { gradientCss } from "@/lib/backgrounds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIZE = { width: 1080, height: 1920 };

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

function getSiteHost(req: Request): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  return new URL(req.url).origin;
}

export async function GET(
  req: Request,
  { params }: { params: { username: string } }
) {
  try {
    const supabase = createAdminClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name, bio, avatar_url, theme, verified")
      .eq("username", params.username.toLowerCase())
      .maybeSingle();

    if (!profile) {
      return new ImageResponse(
        <div style={{ width: "100%", height: "100%", display: "flex", background: "#0f172a", color: "#fff", alignItems: "center", justifyContent: "center", fontSize: 64 }}>
          LinkFolio
        </div>,
        SIZE
      );
    }

    const theme = normalizeTheme(profile.theme);
    const name = profile.display_name ?? profile.username;
    const initial = (name[0] ?? "?").toUpperCase();
    const siteHost = getSiteHost(req);
    const bio = profile.bio ? (profile.bio.length > 120 ? profile.bio.slice(0, 119) + "…" : profile.bio) : null;

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
            padding: "120px 80px",
            background: ogBackground(theme),
            color: theme.text_color,
            fontFamily: "system-ui, sans-serif",
            gap: 0,
          }}
        >
          {/* Avatar */}
          <div style={{ display: "flex", marginBottom: 48 }}>
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={name}
                width={240}
                height={240}
                style={{ borderRadius: 9999, objectFit: "cover", border: `8px solid ${theme.accent_color}` }}
              />
            ) : (
              <div
                style={{
                  width: 240, height: 240, borderRadius: 9999,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: theme.accent_color, color: theme.button_text, fontSize: 120, fontWeight: 700,
                }}
              >
                {initial}
              </div>
            )}
          </div>

          {/* Name + verified */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
            <span style={{ fontSize: 80, fontWeight: 700, textAlign: "center" }}>{name}</span>
            {profile.verified && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 56, height: 56, borderRadius: 9999, background: theme.accent_color, flexShrink: 0,
              }}>
                <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </div>

          {/* Handle */}
          <div style={{ fontSize: 40, color: theme.muted_color, fontFamily: "ui-monospace, monospace", marginBottom: 40 }}>
            @{profile.username}
          </div>

          {/* Bio */}
          {bio && (
            <div style={{ fontSize: 32, color: theme.muted_color, textAlign: "center", maxWidth: 800, lineHeight: 1.5, marginBottom: 80 }}>
              {bio}
            </div>
          )}

          {/* Spacer */}
          <div style={{ flex: 1, display: "flex" }} />

          {/* Branding footer */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 32, fontWeight: 600 }}>
              <span style={{ color: theme.accent_color }}>◆</span>
              <span>LinkFolio</span>
            </div>
            <div style={{ fontSize: 28, color: theme.muted_color, fontFamily: "ui-monospace, monospace" }}>
              {siteHost.replace(/^https?:\/\//, "")}/{profile.username}
            </div>
          </div>
        </div>
      ),
      SIZE
    );
  } catch (err) {
    console.error("[og/story]", err);
    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0f172a", color: "#fff", alignItems: "center", justifyContent: "center", fontSize: 64 }}>
        LinkFolio
      </div>,
      SIZE
    );
  }
}
