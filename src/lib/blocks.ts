import type { WidgetKind } from "./widgets/types";

export type BlockType = "link" | "text" | "heading" | "divider" | "widget";

export interface Block {
  id: string;
  type: BlockType;
  title: string | null;
  url: string | null;
  content: string | null;
  visible?: boolean;
  widget_kind?: WidgetKind | null;
  meta?: Record<string, unknown> | null;
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  link: "Link",
  text: "Text",
  heading: "Heading",
  divider: "Divider",
  widget: "Widget",
};

export const BLOCK_DESCRIPTIONS: Record<BlockType, string> = {
  link: "A clickable button to any URL",
  text: "A paragraph of text",
  heading: "A section title",
  divider: "A horizontal line to separate sections",
  widget: "A live block from another platform",
};

import { validateLinkUrl } from "./url-validate";

/**
 * Validate a user-supplied URL and return its normalized form, or `null`
 * when the URL fails any of the safety checks in `validateLinkUrl`
 * (disallowed scheme, localhost / private IP, etc.). Callers should treat
 * `null` as "reject this input."
 */
export function normalizeUrl(raw: string): string | null {
  const result = validateLinkUrl(raw);
  return result.ok ? result.url : null;
}
