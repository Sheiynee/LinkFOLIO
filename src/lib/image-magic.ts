/**
 * Magic-byte detection for the image formats we accept on uploads.
 *
 * Why: trusting the `Content-Type` header (or the file extension) lets a
 * renamed `evil.exe` masquerade as `evil.png`. Checking the file's actual
 * leading bytes is cheap and catches that.
 *
 * Returns the canonical extension (lowercase, no dot) or `null` when the
 * buffer doesn't match any allowed format.
 */
export type ImageExt = "png" | "jpg" | "gif" | "webp";

interface MagicSignature {
  ext: ImageExt;
  /** Bytes that must match at the given offset (default 0). */
  bytes: number[];
  offset?: number;
}

const IMAGE_SIGNATURES: MagicSignature[] = [
  { ext: "png", bytes: [0x89, 0x50, 0x4e, 0x47] },             // \x89 P N G
  { ext: "jpg", bytes: [0xff, 0xd8, 0xff] },                   // JPEG SOI + first marker
  { ext: "gif", bytes: [0x47, 0x49, 0x46, 0x38] },             // GIF8
  { ext: "webp", bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // RIFF....WEBP
];

export function detectImageExt(buf: Uint8Array): ImageExt | null {
  for (const sig of IMAGE_SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (buf.length < offset + sig.bytes.length) continue;
    if (sig.bytes.every((b, i) => buf[offset + i] === b)) return sig.ext;
  }
  return null;
}

/**
 * Read a `File`'s bytes and return both the validated extension and the
 * underlying buffer (so callers can pass it straight to Supabase storage
 * without a second `.arrayBuffer()` round trip).
 */
export async function validateImageFile(file: File): Promise<
  | { ok: true; ext: ImageExt; buffer: Uint8Array }
  | { ok: false; reason: string }
> {
  if (!file || file.size === 0) return { ok: false, reason: "No file selected" };
  const buffer = new Uint8Array(await file.arrayBuffer());
  const ext = detectImageExt(buffer);
  if (!ext) return { ok: false, reason: "Unsupported image format (use PNG, JPG, GIF, or WebP)" };
  return { ok: true, ext, buffer };
}
