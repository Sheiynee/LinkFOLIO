import { createAdminClient } from "./supabase/admin";

/**
 * Postgres-backed sliding-window rate limiter.
 *
 * Why not Upstash / Redis: this app already has a Postgres backend with the
 * service-role client wired up. Pulling in another SaaS for rate limiting
 * doubles the failure surface and adds an env var the maintainer has to
 * manage. Postgres handles 60 req/min/IP for our scale just fine.
 *
 * Implementation: each (scope, key) pair gets a bucket per `window_seconds`.
 * We increment via upsert+inc and then sum the last `window_seconds` worth
 * of buckets to decide whether the caller is over budget. Bucket rows are
 * fixed-size so the table doesn't blow up; a cleanup query in `prune()`
 * removes anything older than the longest possible window.
 *
 * `key` should be hashed identifying material — IP for anonymous endpoints,
 * user_id for authed ones. We don't store raw IPs longer than the window.
 */

export interface RateLimitConfig {
  /** Identifier for the policy ("redirect", "upload", "auth"). */
  scope: string;
  /** Max events allowed within `windowSeconds`. */
  limit: number;
  /** Sliding window length in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Events the caller has used in the current window. */
  used: number;
  limit: number;
  /** Seconds until the oldest bucket falls out of the window. */
  retryAfterSeconds: number;
}

/**
 * Increment the caller's bucket and return whether the call is allowed. The
 * increment happens unconditionally — if you want to refuse the request,
 * inspect `allowed` and short-circuit. (Counting denied attempts is a
 * deliberate choice; otherwise an attacker can probe forever for free.)
 */
export async function rateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const supabase = createAdminClient();
  const now = new Date();
  // Bucket boundary is aligned to `windowSeconds` so concurrent requests in
  // the same second all hit the same row.
  const bucketSize = Math.max(1, Math.floor(config.windowSeconds / 6));
  const windowStartMs = Math.floor(now.getTime() / (bucketSize * 1000)) * bucketSize * 1000;
  const cutoff = new Date(now.getTime() - config.windowSeconds * 1000);

  // Single atomic round trip (`rate_limit_hit` RPC, migration 23):
  // INSERT .. ON CONFLICT DO UPDATE count+1, then sum the window. The old
  // read→upsert→sum sequence was 3 round trips and undercounted bursts —
  // concurrent callers read the same count and both wrote count+1.
  const { data, error } = await supabase.rpc("rate_limit_hit", {
    p_scope: config.scope,
    p_key: key,
    p_window_start: new Date(windowStartMs).toISOString(),
    p_cutoff: cutoff.toISOString(),
  });

  if (error || !data) {
    // Fail open: rate limiting is best-effort protection, not an auth gate.
    return { allowed: true, used: 0, limit: config.limit, retryAfterSeconds: 0 };
  }

  const result = data as { used: number; oldest: string | null };
  const used = Number(result.used ?? 0);

  let retryAfterSeconds = 0;
  if (used >= config.limit && result.oldest) {
    const oldest = new Date(result.oldest);
    retryAfterSeconds = Math.max(
      0,
      Math.ceil((oldest.getTime() + config.windowSeconds * 1000 - now.getTime()) / 1000)
    );
  }

  return {
    allowed: used <= config.limit,
    used,
    limit: config.limit,
    retryAfterSeconds,
  };
}

/** Best-effort cleanup of old buckets. Call from a cron or after writes. */
export async function pruneRateLimitBuckets(maxWindowSeconds: number): Promise<void> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - maxWindowSeconds * 2 * 1000);
  await supabase
    .from("rate_limit_buckets")
    .delete()
    .lt("window_start", cutoff.toISOString());
}

// ── Preset policies ─────────────────────────────────────
export const RL_REDIRECT: RateLimitConfig = { scope: "redirect", limit: 60, windowSeconds: 60 };
export const RL_UPLOAD: RateLimitConfig = { scope: "upload", limit: 10, windowSeconds: 60 };
export const RL_AUTH: RateLimitConfig = { scope: "auth", limit: 20, windowSeconds: 60 };
