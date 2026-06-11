"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Element } from "@/lib/elements";
import {
  BUTTON_ICONS,
  BUTTON_VARIANTS,
  IMAGE_MASKS,
  readButtonMeta,
  readImageMeta,
  readRegionMeta,
  readShapeMeta,
  readStickerMeta,
  type ButtonIcon,
  type ImageMask,
} from "@/lib/visual-elements";
import { ButtonIconGlyph } from "@/components/button-icon";

export interface InspectorFieldProps {
  element: Element;
  onPatchFields: (id: string, patch: { title?: string | null; content?: string | null }) => void;
}

export interface InspectorMetaProps {
  element: Element;
  onPatchMeta: (id: string, patch: Record<string, unknown>) => void;
}

/** One numeric field with local draft state; commits on blur or Enter. */
function NumField({
  label,
  value,
  onCommit,
  min,
  max,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState(String(Math.round(value)));
  useEffect(() => { setDraft(String(Math.round(value))); }, [value]);

  function commit() {
    let v = Number(draft);
    if (!Number.isFinite(v)) {
      setDraft(String(Math.round(value)));
      return;
    }
    if (typeof min === "number") v = Math.max(min, v);
    if (typeof max === "number") v = Math.min(max, v);
    v = Math.round(v);
    setDraft(String(v));
    if (v !== Math.round(value)) onCommit(v);
  }

  return (
    <label className="flex items-center gap-1 text-xs">
      <span className="w-4 text-muted-foreground font-mono">{label}</span>
      <Input
        value={draft}
        inputMode="numeric"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="h-7 px-1.5 text-xs"
      />
    </label>
  );
}

export interface PositionInspectorProps {
  element: Element;
  placement: { x: number; y: number; w: number; h: number };
  view: "desktop" | "mobile";
  onPatchPlacement: (id: string, patch: { x?: number; y?: number; w?: number; h?: number; rotation?: number }) => void;
}

/** Editable numeric X/Y/W/H (+ rotation on desktop) for the selected element. */
export function PositionInspector({ element, placement, view, onPatchPlacement }: PositionInspectorProps) {
  return (
    <div className="space-y-1.5 rounded-md border p-2.5">
      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Position</span>
      <div className="grid grid-cols-2 gap-1.5">
        <NumField label="X" value={placement.x} onCommit={(v) => onPatchPlacement(element.id, { x: v })} />
        <NumField label="Y" value={placement.y} onCommit={(v) => onPatchPlacement(element.id, { y: v })} />
        <NumField label="W" value={placement.w} min={1} onCommit={(v) => onPatchPlacement(element.id, { w: v })} />
        <NumField label="H" value={placement.h} min={1} onCommit={(v) => onPatchPlacement(element.id, { h: v })} />
        {view === "desktop" && (
          <NumField
            label="∠"
            value={element.rotation}
            min={-180}
            max={180}
            onCommit={(v) => onPatchPlacement(element.id, { rotation: v })}
          />
        )}
      </div>
    </div>
  );
}

export function ContentInspector({ element, onPatchFields }: InspectorFieldProps) {
  // Local mirror so typing feels instant; commit on blur to avoid flooding
  // the server with one update per keystroke.
  const [draft, setDraft] = useState(element.content ?? "");
  useEffect(() => { setDraft(element.content ?? ""); }, [element.id, element.content]);

  function commit() {
    const next = draft.trim() === "" ? null : draft;
    if (next !== (element.content ?? null)) onPatchFields(element.id, { content: next });
  }

  return (
    <div className="space-y-1.5 rounded-md border p-2.5">
      <span className="block text-xs text-muted-foreground">
        {element.type === "heading" ? "Heading text" : "Text content"}
      </span>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        rows={element.type === "heading" ? 2 : 4}
        placeholder={element.type === "heading" ? "Heading" : "Some text here"}
        className="text-sm"
      />
      <p className="text-[10px] text-muted-foreground">Saves on blur · ⌘Z still works.</p>
    </div>
  );
}

export function LinkInspector({ element, onPatchFields }: InspectorFieldProps) {
  const [draft, setDraft] = useState(element.title ?? "");
  useEffect(() => { setDraft(element.title ?? ""); }, [element.id, element.title]);

  function commit() {
    const next = draft.trim() === "" ? null : draft;
    if (next !== (element.title ?? null)) onPatchFields(element.id, { title: next });
  }

  return (
    <div className="space-y-1.5 rounded-md border p-2.5">
      <span className="block text-xs text-muted-foreground">Label</span>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        placeholder="Visit my site"
      />
      {element.url && (
        <p className="text-[10px] text-muted-foreground truncate" title={element.url}>
          → {element.url}
        </p>
      )}
    </div>
  );
}

export function ButtonInspector({ element, onPatchMeta }: InspectorMetaProps) {
  const meta = readButtonMeta(element.meta);
  return (
    <div className="space-y-2 rounded-md border p-2.5">
      <div>
        <span className="block text-xs text-muted-foreground mb-1">Variant</span>
        <div className="grid grid-cols-4 gap-1">
          {BUTTON_VARIANTS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onPatchMeta(element.id, { variant: v })}
              className={cn(
                "rounded-md border px-2 py-1 text-[10px] capitalize",
                meta.variant === v ? "bg-primary text-primary-foreground" : "bg-muted/30 hover:bg-muted"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="block text-xs text-muted-foreground mb-1">Icon</span>
        <div className="grid grid-cols-6 gap-1">
          <button
            type="button"
            onClick={() => onPatchMeta(element.id, { icon: null })}
            className={cn(
              "h-7 rounded-md border text-[10px]",
              meta.icon === null ? "bg-primary text-primary-foreground" : "bg-muted/30 hover:bg-muted"
            )}
          >
            none
          </button>
          {BUTTON_ICONS.map((icon: ButtonIcon) => (
            <button
              key={icon}
              type="button"
              onClick={() => onPatchMeta(element.id, { icon })}
              title={icon}
              className={cn(
                "h-7 rounded-md border flex items-center justify-center",
                meta.icon === icon ? "bg-primary text-primary-foreground" : "bg-muted/30 hover:bg-muted"
              )}
            >
              <ButtonIconGlyph icon={icon} className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ShapeInspector({ element, onPatchMeta }: InspectorMetaProps) {
  const meta = readShapeMeta(element.meta);
  return (
    <div className="space-y-1.5 rounded-md border p-2.5">
      <label className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Fill</span>
        <input
          type="color"
          value={meta.fill}
          onChange={(e) => onPatchMeta(element.id, { fill: e.target.value })}
          className="h-6 w-10 cursor-pointer rounded border bg-transparent"
        />
      </label>
      {meta.kind === "rect" && (
        <label className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Corner radius</span>
          <input
            type="range"
            min={0}
            max={50}
            value={meta.radius}
            onChange={(e) => onPatchMeta(element.id, { radius: Number(e.target.value) })}
            className="flex-1 max-w-[120px]"
          />
        </label>
      )}
    </div>
  );
}

export function StickerInspector({ element, onPatchMeta }: InspectorMetaProps) {
  const meta = readStickerMeta(element.meta);
  return (
    <div className="space-y-1.5 rounded-md border p-2.5">
      <label className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Color</span>
        <input
          type="color"
          value={meta.color}
          onChange={(e) => onPatchMeta(element.id, { color: e.target.value })}
          className="h-6 w-10 cursor-pointer rounded border bg-transparent"
        />
      </label>
    </div>
  );
}

export function RegionInspector({ element, onPatchMeta }: InspectorMetaProps) {
  const meta = readRegionMeta(element.meta);
  const firstGradient = meta.layers.find((l) => l.type === "gradient");
  // The full layer editor lives on /dashboard/theme — here we expose only the
  // two knobs creators reach for most: gradient endpoints + corner radius.
  return (
    <div className="space-y-2 rounded-md border p-2.5">
      <label className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">Corner radius</span>
        <input
          type="range"
          min={0}
          max={120}
          value={meta.radius}
          onChange={(e) => onPatchMeta(element.id, { radius: Number(e.target.value) })}
          className="flex-1 max-w-[120px]"
        />
      </label>
      {firstGradient && firstGradient.type === "gradient" && firstGradient.stops.length >= 2 && (
        <div className="space-y-1">
          <span className="block text-xs text-muted-foreground">Gradient</span>
          <div className="flex items-center gap-2">
            {firstGradient.stops.slice(0, 2).map((stop, idx) => (
              <input
                key={idx}
                type="color"
                value={stop.color}
                onChange={(e) => {
                  const nextStops = firstGradient.stops.map((s, i) =>
                    i === idx ? { ...s, color: e.target.value } : s
                  );
                  const nextLayers = meta.layers.map((l) =>
                    l.id === firstGradient.id && l.type === "gradient" ? { ...l, stops: nextStops } : l
                  );
                  onPatchMeta(element.id, { layers: nextLayers });
                }}
                className="h-6 w-10 cursor-pointer rounded border bg-transparent"
              />
            ))}
            <span className="text-[10px] text-muted-foreground">
              Edit full layers in /dashboard/theme.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function ImageInspector({ element, onPatchMeta }: InspectorMetaProps) {
  const meta = readImageMeta(element.meta);
  if (!meta) return null;
  return (
    <div className="space-y-2 rounded-md border p-2.5">
      <label className="block text-xs">
        <span className="text-muted-foreground">Mask</span>
        <select
          value={meta.mask}
          onChange={(e) => onPatchMeta(element.id, { mask: e.target.value as ImageMask })}
          className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-xs"
        >
          {IMAGE_MASKS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">Fit</span>
        <select
          value={meta.fit}
          onChange={(e) => onPatchMeta(element.id, { fit: e.target.value })}
          className="rounded-md border bg-background px-2 py-1 text-xs"
        >
          <option value="cover">cover</option>
          <option value="contain">contain</option>
        </select>
      </label>
    </div>
  );
}
