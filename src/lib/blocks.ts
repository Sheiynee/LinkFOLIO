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

export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
