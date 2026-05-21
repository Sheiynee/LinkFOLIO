/**
 * URL validator for user-supplied link targets.
 *
 * Blocks anything that:
 *   - uses a scheme other than http/https/mailto/tel
 *   - resolves to a literal localhost / RFC1918 / loopback / link-local host
 *   - looks like a `javascript:` or `data:` URI even after URL parsing
 *
 * This runs on the server before we persist a link, so a creator can't post
 * a redirect that turns into an XSS or SSRF vector. DNS-time SSRF protection
 * (resolving the hostname and rejecting private IPs) lives in the OG scraper
 * — that's a stricter pass for outbound fetches.
 */

const ALLOWED_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

// Hostnames + suffixes that should never be a public link target.
const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "::",
  "broadcasthost",
]);

/**
 * RFC1918 private + link-local + carrier-grade NAT ranges, expressed as
 * regexes against the dotted-quad form. We block these to keep redirects
 * from pointing at internal infrastructure when LinkFolio is deployed
 * behind a private network.
 */
const PRIVATE_IPV4 = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./, // link-local
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64.0.0/10
  /^127\./, // entire loopback /8
];

export type UrlValidationResult =
  | { ok: true; url: string }
  | { ok: false; reason: string };

/**
 * Validate + normalize a user-supplied URL. Returns the parsed string on
 * success (so callers don't need to re-parse it), with the scheme
 * lowercased.
 */
export function validateLinkUrl(raw: string): UrlValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "URL is required" };

  // Block obvious dangerous prefixes before URL parsing — some browsers
  // happily parse "javascript:alert(1)" into a URL object.
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("vbscript:") || lower.startsWith("data:") || lower.startsWith("file:")) {
    return { ok: false, reason: "That URL scheme isn't allowed" };
  }

  // Add a protocol if the user pasted a bare domain.
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { ok: false, reason: "Not a valid URL" };
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return { ok: false, reason: `Scheme ${parsed.protocol} isn't allowed` };
  }

  // mailto + tel skip the host checks.
  if (parsed.protocol === "mailto:" || parsed.protocol === "tel:") {
    return { ok: true, url: parsed.toString() };
  }

  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) {
    return { ok: false, reason: "That hostname isn't allowed" };
  }
  if (PRIVATE_IPV4.some((re) => re.test(host))) {
    return { ok: false, reason: "Private IP ranges aren't allowed" };
  }
  // IPv6 literal blocks are coarse; reject anything in square brackets that
  // matches loopback / unique-local. Site-deployed creators are unlikely to
  // need IPv6 literal targets.
  if (host.startsWith("[") && (host.includes("::1") || host.includes("fc") || host.includes("fd") || host.includes("fe80"))) {
    return { ok: false, reason: "Private IPv6 addresses aren't allowed" };
  }

  return { ok: true, url: parsed.toString() };
}
