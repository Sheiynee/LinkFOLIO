import { waitUntil } from "@vercel/functions";

/**
 * Run a side-effect write (analytics insert, cache backfill) without
 * blocking the response, while keeping the serverless/edge function alive
 * until it settles. Plain `void promise` writes can be dropped when the
 * runtime freezes the function right after the response is sent.
 *
 * Outside a Vercel request context (local dev, tests) `waitUntil` throws —
 * fall back to fire-and-forget, which is safe there because the process
 * stays alive.
 */
export function deferWrite(task: Promise<unknown>): void {
  const guarded = task.catch(() => {});
  try {
    waitUntil(guarded);
  } catch {
    void guarded;
  }
}
