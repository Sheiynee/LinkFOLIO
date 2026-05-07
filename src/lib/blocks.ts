export type BlockType = "link" | "text" | "heading" | "divider";

export interface Block {
  id: string;
  type: BlockType;
  title: string | null;
  url: string | null;
  content: string | null;
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  link: "Link",
  text: "Text",
  heading: "Heading",
  divider: "Divider",
};

export const BLOCK_DESCRIPTIONS: Record<BlockType, string> = {
  link: "A clickable button to any URL",
  text: "A paragraph of text",
  heading: "A section title",
  divider: "A horizontal line to separate sections",
};

export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
