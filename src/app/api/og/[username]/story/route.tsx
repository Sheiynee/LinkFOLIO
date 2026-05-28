import { ImageResponse } from "next/og";
import { normalizeTheme } from "@/lib/themes";
import { ogBackground } from "@/lib/og-helpers";
import { getProfileByUsername } from "@/lib/db/profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIZE = { width: 1080, height: 1920 };

function getSiteHost(req: Request): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  return new URL(req.url).origin;
}

export async function GET(
  req: Request,
  { params }: { params: { username: string } }
) {
  try {
    const profile = await getProfileByUsername(params.username);

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
    // Build single strings upfront — Satori treats JSX mixed content ("@" + expr) as multiple children.
    const handle = "@" + profile.username;
    const siteUrl = getSiteHost(req).replace(/^https?:\/\//, "") + "/" + profile.username;
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

          {/* Name — single string in one span avoids multi-child div */}
          <div style={{ display: "flex", marginBottom: 20 }}>
            <span style={{ fontSize: 80, fontWeight: 700, textAlign: "center" }}>{name}</span>
          </div>

          {/* Handle — pre-built string, not "@" + expr */}
          <div style={{ display: "flex", marginBottom: 40 }}>
            <span style={{ fontSize: 40, color: theme.muted_color, fontFamily: "ui-monospace, monospace" }}>
              {handle}
            </span>
          </div>

          {/* Bio */}
          {bio && (
            <div style={{ display: "flex", marginBottom: 80 }}>
              <span style={{ fontSize: 32, color: theme.muted_color, textAlign: "center", maxWidth: 800, lineHeight: 1.5 }}>
                {bio}
              </span>
            </div>
          )}

          {/* Spacer */}
          <div style={{ flex: 1, display: "flex" }} />

          {/* Branding footer — "◆" replaced with a plain bullet to avoid Google Font 400 */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 32, fontWeight: 600 }}>
              <span style={{ color: theme.accent_color, fontSize: 20 }}>&#x25CF;</span>
              <span>LinkFolio</span>
            </div>
            {/* Pre-built string so there's only one child */}
            <div style={{ display: "flex" }}>
              <span style={{ fontSize: 28, color: theme.muted_color, fontFamily: "ui-monospace, monospace" }}>
                {siteUrl}
              </span>
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
