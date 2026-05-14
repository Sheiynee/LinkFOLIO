import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeTheme } from "@/lib/themes";

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
      .select("username, display_name, bio, avatar_url, theme")
      .eq("username", params.username.toLowerCase())
      .maybeSingle();

    if (error) console.error("[og] profile lookup error:", error.message);
    if (!profile) return fallbackCard("LinkFolio");

    const theme = normalizeTheme(profile.theme);
    const name = profile.display_name ?? profile.username;
    const initial = (name[0] ?? "?").toUpperCase();

    const avatarUrl = await loadAvatarAsDataUri(profile.avatar_url);

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
            fontFamily: "system-ui, sans-serif",
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
              {initial}
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
              fontFamily: "ui-monospace, monospace",
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
              }}
            >
              {truncate(profile.bio, 140)}
            </div>
          )}

          <div
            style={{
              position: "absolute",
              bottom: 40,
              display: "flex",
              alignItems: "center",
              gap: 12,
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
  } catch (err) {
    console.error("[og] render failed:", err);
    return fallbackCard("LinkFolio");
  }
}

async function loadAvatarAsDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch (err) {
    console.error("[og] avatar fetch failed:", err);
    return null;
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}
