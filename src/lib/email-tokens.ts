import { createHash } from "crypto";

/**
 * Email-change tokens are stored hashed — a database leak must not yield
 * usable verification links. The raw token only ever exists inside the link
 * emailed to the user; both the insert and the verify lookup go through
 * this hash.
 */
export function hashEmailToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
