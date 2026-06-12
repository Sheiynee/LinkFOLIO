import { createHash, timingSafeEqual } from "crypto";

/**
 * Constant-time check of a cron request's Authorization header against
 * CRON_SECRET. Accepts both "Bearer <secret>" (Vercel Cron style) and the
 * bare secret. Hashing both sides first means the comparison length is
 * fixed, so neither content nor secret length leaks through timing.
 *
 * Returns false when CRON_SECRET is unset — callers should 500 on that
 * separately so misconfiguration is visible.
 */
export function verifyCronSecret(authorizationHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice(7)
    : authorizationHeader ?? "";
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}
