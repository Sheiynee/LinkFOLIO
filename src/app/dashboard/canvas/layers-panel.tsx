"use client";

import { useState } from "react";
import {
  Type, Heading as HeadingIcon, Minus, Link2, Sparkles,
  Square, Star, ImageIcon, Layers,
  Lock, Unlock, Eye, EyeOff, GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Element, ElementType } from "@/lib/elements";

const TYPE_ICONS: Record<ElementType, React.ComponentType<{ className?: string }>> = {
  text: Type,
  heading: HeadingIcon,
  divider: Minus,
  link: Link2,
  widget: Sparkles,
  shape: Square,
  sticker: Star,
  image: ImageIcon,
  region: Layers,
};

function labelFor(el: Element): string {
  if (el.title) return el.title;
  if (el.content) return el.content.replace(/\s+/g, " ").trim().slice(0, 40) || el.type;
  if (el.type === "widget" && el.widget_kind) return el.widget_kind.replace(/_/g, " ");
  return el.type;
}

export interface LayersPanelProps {
  elements: Element[];
  selectedIds: Set<string>;
  onSelect: (id: string, additive: boolean) => void;
  /** Move an element to `toIndex` in the paint order (0 = back, N-1 = front). */
  onMove: (id: string, toIndex: number) => void;
  onToggleLock: (id: string) => void;
  onToggleVisible: (id: string) => void;
}

/**
 * Layers list — top-most element first (Figma convention). Click selects
 * (shift toggles), rows drag to reorder z, and each row has lock/visibility
 * toggles that act on that element regardless of selection.
 */
export function LayersPanel({
  elements,
  selectedIds,
  onSelect,
  onMove,
  onToggleLock,
  onToggleVisible,
}: LayersPanelProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Display order: front-most first; display index i ↔ paint index N-1-i.
  const rows = [...elements].sort((a, b) => b.z - a.z);

  function finishDrop(displayIndex: number) {
    if (dragId) onMove(dragId, rows.length - 1 - displayIndex);
    setDragId(null);
    setDropIndex(null);
  }

  if (rows.length === 0) {
    return <p className="text-[10px] text-muted-foreground">No elements yet.</p>;
  }

  return (
    <ul className="max-h-56 overflow-y-auto rounded-md border border-border/60 divide-y divide-border/40">
      {rows.map((el, i) => {
        const Icon = TYPE_ICONS[el.type] ?? Square;
        const selected = selectedIds.has(el.id);
        return (
          <li
            key={el.id}
            draggable
            onDragStart={(e) => {
              setDragId(el.id);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", el.id);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dropIndex !== i) setDropIndex(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              finishDrop(i);
            }}
            onDragEnd={() => {
              setDragId(null);
              setDropIndex(null);
            }}
            onClick={(e) => onSelect(el.id, e.shiftKey)}
            className={cn(
              "flex items-center gap-1.5 px-1.5 py-1 text-xs cursor-pointer select-none",
              selected ? "bg-primary/10" : "hover:bg-muted/50",
              dragId === el.id && "opacity-40",
              dropIndex === i && dragId !== el.id && "ring-1 ring-inset ring-blue-500"
            )}
          >
            <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 cursor-grab" />
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span
              className={cn(
                "flex-1 truncate",
                el.visible === false && "text-muted-foreground line-through decoration-border"
              )}
              title={labelFor(el)}
            >
              {labelFor(el)}
            </span>
            <button
              type="button"
              title={el.locked ? "Unlock" : "Lock position"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock(el.id);
              }}
              className={cn(
                "p-0.5 rounded hover:bg-muted",
                el.locked ? "text-amber-600" : "text-muted-foreground/50"
              )}
            >
              {el.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              title={el.visible === false ? "Show on public page" : "Hide from public page"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisible(el.id);
              }}
              className={cn(
                "p-0.5 rounded hover:bg-muted",
                el.visible === false ? "text-amber-600" : "text-muted-foreground/50"
              )}
            >
              {el.visible === false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
