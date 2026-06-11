/**
 * Cross-tab canvas clipboard. Element ids are written to the system clipboard
 * with a marker prefix; paste re-duplicates those ids server-side. Falls back
 * silently when the Clipboard API is unavailable (permissions, insecure
 * context) — the editor keeps an in-memory copy as backup.
 */
const CLIPBOARD_MARKER = "linkfolio-canvas-clipboard:";

export async function writeClipboardIds(ids: string[]) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
  try {
    await navigator.clipboard.writeText(CLIPBOARD_MARKER + JSON.stringify({ ids }));
  } catch {
    // Permission denied / insecure context — silently fall back to in-memory.
  }
}

export async function readClipboardIds(): Promise<string[] | null> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.readText) return null;
  try {
    const text = await navigator.clipboard.readText();
    if (!text.startsWith(CLIPBOARD_MARKER)) return null;
    const parsed = JSON.parse(text.slice(CLIPBOARD_MARKER.length)) as { ids?: unknown };
    if (!Array.isArray(parsed.ids)) return null;
    const ids = parsed.ids.filter((v): v is string => typeof v === "string");
    return ids.length > 0 ? ids : null;
  } catch {
    return null;
  }
}
