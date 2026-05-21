/**
 * Wires `next/image` so user uploads from Supabase storage can be served
 * through the Next.js image optimizer (smaller payloads, AVIF/WebP, lazy
 * decode). We allow only the Supabase project host derived from
 * `NEXT_PUBLIC_SUPABASE_URL` so a creator can't smuggle a third-party
 * image URL through the optimizer.
 */
function supabaseRemotePatterns() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return [];
  try {
    const url = new URL(raw);
    return [
      {
        protocol: url.protocol.replace(":", ""),
        hostname: url.hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ];
  } catch {
    return [];
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: supabaseRemotePatterns(),
  },
};

export default nextConfig;
