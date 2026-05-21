import { createHash } from "crypto";
import { createAdminClient } from "./supabase/admin";

/**
 * Append-only audit log for security-relevant events. Failures here are
 * swallowed — the caller's action shouldn't fail because the log table
 * is briefly unavailable. The log is best-effort.
 *
 * IPs are hashed with sha256 + the `AUDIT_LOG_SALT` env var (or a static
 * fallback in dev) so a database dump doesn't reveal raw visitor IPs.
 */

export type AuditEvent =
  | "auth.signin"
  | "auth.signin_failed"
  | "auth.signout"
  | "account.soft_delete"
  | "account.cancel_delete"
  | "account.hard_delete"
  | "account.export"
  | "upload.rejected"
  | "url.rejected"
  | "rate_limit.hit"
  | "username.reserved_attempt";

export interface AuditContext {
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  detail?: Record<string, unknown>;
}

function hashIp(ip: string): string {
  const salt = process.env.AUDIT_LOG_SALT ?? "linkfolio-dev-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export async function logAuditEvent(event: AuditEvent, ctx: AuditContext = {}): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("audit_log").insert({
      event,
      user_id: ctx.userId ?? null,
      ip_hash: ctx.ip ? hashIp(ctx.ip) : null,
      user_agent: ctx.userAgent ?? null,
      detail: ctx.detail ?? null,
    });
  } catch {
    // Logging failures must never break the caller's action.
  }
}

/** Pull the caller's IP out of common reverse-proxy headers (Vercel, Cloudflare). */
export function ipFromHeaders(headers: Headers): string | null {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    null
  );
}
