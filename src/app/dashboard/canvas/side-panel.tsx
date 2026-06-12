"use client";

import { useRef, useState, useTransition } from "react";
import {
  Plus, Trash2, Link2, Type, Heading as HeadingIcon, Minus, Sparkles,
  Smartphone, Monitor, Undo2, Redo2, Copy,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  StretchHorizontal, StretchVertical, Keyboard,
  Square, Circle, Triangle, Shapes, ImageIcon, Loader2,
  Layers, Wand2,
  BringToFront, SendToBack, ChevronUp, ChevronDown,
  Lock, Unlock, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Element } from "@/lib/elements";
import { DEFAULT_ELEMENT_HEIGHTS } from "@/lib/elements";
import type { GroupOp, CanvasView, ZOrderDir } from "@/lib/canvas-ops";
import type { ArrangeKind } from "@/lib/magic-arrange";
import { WIDGET_PICKER_SPECS } from "@/lib/widgets/picker-specs";
import type { WidgetKind } from "@/lib/widgets/types";
import { STICKER_ICONS, type ShapeKind } from "@/lib/visual-elements";
import { StickerGlyph } from "@/components/sticker-glyph";
import {
  createElement,
  createRegionElement,
  createShapeElement,
  createStickerElement,
  createWidgetElementByKind,
  createWidgetElementFromUrl,
  uploadAndCreateImageElement,
} from "./actions";
import { LayersPanel } from "./layers-panel";
import {
  ButtonInspector,
  ContentInspector,
  ImageInspector,
  LinkInspector,
  PositionInspector,
  RegionInspector,
  ShapeInspector,
  StickerInspector,
} from "./inspectors";

export function HelperBar({ selectionCount, view }: { selectionCount: number; view: CanvasView }) {
  const tip =
    selectionCount === 0
      ? view === "mobile"
        ? "Mobile preview · drag a widget to set mobile-specific positions, or hit Reset in the sidebar to fall back to auto-reflow."
        : "Click an element to select · drag empty space to marquee-select · Ctrl+wheel zooms · hold space to pan · add elements from the sidebar →"
      : selectionCount === 1
        ? "Drag to move · handles resize · the dot above rotates · arrows nudge (shift = 10px) · double-click text to edit in place."
        : `${selectionCount} selected · use the align/distribute buttons in the sidebar or drag the group together.`;
  return (
    <Card className="px-3 py-2 text-xs text-muted-foreground">
      {tip}
    </Card>
  );
}

function Shortcut({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        {keys.map((k, i) => k === "+" ? (
          <span key={i} className="text-muted-foreground">+</span>
        ) : (
          <kbd key={i} className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">{k}</kbd>
        ))}
      </span>
    </div>
  );
}

function ToolBtn({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-7 w-7"
    >
      {children}
    </Button>
  );
}

function SectionHeader({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-2">
      {icon}
      <span>{children}</span>
    </div>
  );
}

function ClusterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground w-16 shrink-0">{label}</span>
      <div className="flex flex-wrap items-center rounded-md border border-border/60 bg-muted/30 p-0.5 gap-0.5">
        {children}
      </div>
    </div>
  );
}

function ShapePickBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="aspect-square rounded-md border bg-muted/40 hover:bg-muted disabled:opacity-50 flex items-center justify-center"
    >
      {children}
    </button>
  );
}

function BlobIcon() {
  return (
    <svg viewBox="0 0 100 100" className="h-5 w-5" fill="currentColor">
      <path d="M 50 10 C 70 12, 88 28, 88 50 C 88 72, 70 90, 50 90 C 30 88, 14 72, 14 50 C 14 28, 30 12, 50 10 Z" />
    </svg>
  );
}

function modKeyLabel(): string {
  if (typeof navigator !== "undefined" && /Mac/i.test(navigator.platform)) return "⌘";
  return "Ctrl";
}

export interface SidePanelProps {
  elements: Element[];
  selectedIds: Set<string>;
  selectedElement: Element | null;
  view: CanvasView;
  onViewChange: (v: CanvasView) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onGroupOp: (op: GroupOp) => void;
  onZOrder: (dir: ZOrderDir) => void;
  onZMove: (id: string, toIndex: number) => void;
  onSelectLayer: (id: string, additive: boolean) => void;
  onToggleLock: () => void;
  onToggleVisible: () => void;
  onToggleLockOne: (id: string) => void;
  onToggleVisibleOne: (id: string) => void;
  onPatchPlacement: (id: string, patch: { x?: number; y?: number; w?: number; h?: number; rotation?: number }) => void;
  selectedPlacement: { x: number; y: number; w: number; h: number } | null;
  onDuplicate: () => void;
  onDelete: () => void;
  onResetMobile: () => void;
  onResetMobileAll: () => void;
  onAdded: (el: Element) => void;
  onError: (msg: string) => void;
  onPatchMeta: (id: string, patch: Record<string, unknown>) => void;
  onPatchFields: (id: string, patch: { title?: string | null; content?: string | null }) => void;
  onMagicArrange: (kind: ArrangeKind) => void;
}

export function SidePanel({
  elements,
  selectedIds,
  selectedElement,
  view,
  onViewChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onGroupOp,
  onZOrder,
  onZMove,
  onSelectLayer,
  onToggleLock,
  onToggleVisible,
  onToggleLockOne,
  onToggleVisibleOne,
  onPatchPlacement,
  selectedPlacement,
  onDuplicate,
  onDelete,
  onResetMobile,
  onResetMobileAll,
  onAdded,
  onError,
  onPatchMeta,
  onPatchFields,
  onMagicArrange,
}: SidePanelProps) {
  const [pending, startTransition] = useTransition();
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [widgetUrl, setWidgetUrl] = useState("");

  function add(type: "text" | "heading" | "divider") {
    startTransition(async () => {
      const defaults = {
        text: { content: "Some text here", h: DEFAULT_ELEMENT_HEIGHTS.text },
        heading: { content: "Heading", h: DEFAULT_ELEMENT_HEIGHTS.heading },
        divider: { content: null, h: DEFAULT_ELEMENT_HEIGHTS.divider },
      }[type];
      const res = await createElement({ type, content: defaults.content, h: defaults.h });
      if (res.error) onError(res.error);
      else if (res.element) onAdded(res.element as Element);
    });
  }

  function addLink() {
    if (!linkTitle.trim() || !linkUrl.trim()) {
      onError("Title and URL are required");
      return;
    }
    startTransition(async () => {
      const res = await createElement({ type: "link", title: linkTitle.trim(), url: linkUrl.trim(), h: DEFAULT_ELEMENT_HEIGHTS.link });
      if (res.error) onError(res.error);
      else if (res.element) {
        onAdded(res.element as Element);
        setLinkTitle("");
        setLinkUrl("");
      }
    });
  }

  function addWidget() {
    const url = widgetUrl.trim();
    if (!url) {
      onError("Paste a URL");
      return;
    }
    startTransition(async () => {
      const res = await createWidgetElementFromUrl(url);
      if (res.error) onError(res.error);
      else if (res.element) {
        onAdded(res.element as Element);
        setWidgetUrl("");
      }
    });
  }

  const [widgetKind, setWidgetKind] = useState<WidgetKind>("twitch_live");
  const [widgetKindInput, setWidgetKindInput] = useState("");
  const widgetSpec = WIDGET_PICKER_SPECS.find((s) => s.kind === widgetKind) ?? WIDGET_PICKER_SPECS[0];

  function addWidgetByKind() {
    const input = widgetKindInput.trim();
    if (!input) {
      onError("Fill in the widget input");
      return;
    }
    startTransition(async () => {
      const res = await createWidgetElementByKind(widgetKind, input);
      if (res.error) onError(res.error);
      else if (res.element) {
        onAdded(res.element as Element);
        setWidgetKindInput("");
      }
    });
  }

  function addRegion() {
    startTransition(async () => {
      const res = await createRegionElement();
      if (res.error) onError(res.error);
      else if (res.element) onAdded(res.element as Element);
    });
  }

  function addShape(kind: ShapeKind) {
    startTransition(async () => {
      const res = await createShapeElement(kind);
      if (res.error) onError(res.error);
      else if (res.element) onAdded(res.element as Element);
    });
  }

  function addSticker(icon: (typeof STICKER_ICONS)[number]) {
    startTransition(async () => {
      const res = await createStickerElement(icon);
      if (res.error) onError(res.error);
      else if (res.element) onAdded(res.element as Element);
    });
  }

  function handleImageFile(file: File | null) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const res = await uploadAndCreateImageElement(fd);
      if (res.error) onError(res.error);
      else if (res.element) onAdded(res.element as Element);
    });
  }

  const imageInputRef = useRef<HTMLInputElement>(null);

  const canDist = selectedIds.size >= 3;
  const canAlign = selectedIds.size >= 2;
  const hasSel = selectedIds.size > 0;
  const [showShortcuts, setShowShortcuts] = useState(false);
  const mod = modKeyLabel();

  return (
    <Card className="p-4 space-y-5 self-start lg:sticky lg:top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
      {/* ── Controls ── */}
      <div>
        <SectionHeader>Controls</SectionHeader>
        <div className="space-y-2.5">
          <ClusterRow label="History">
            <ToolBtn onClick={onUndo} disabled={!canUndo} title="Undo"><Undo2 className="h-4 w-4" /></ToolBtn>
            <ToolBtn onClick={onRedo} disabled={!canRedo} title="Redo"><Redo2 className="h-4 w-4" /></ToolBtn>
          </ClusterRow>
          <ClusterRow label="Align">
            <ToolBtn onClick={() => onGroupOp("align-l")} disabled={!canAlign} title="Align left"><AlignStartHorizontal className="h-4 w-4" /></ToolBtn>
            <ToolBtn onClick={() => onGroupOp("align-c")} disabled={!canAlign} title="Align horizontal center"><AlignCenterHorizontal className="h-4 w-4" /></ToolBtn>
            <ToolBtn onClick={() => onGroupOp("align-r")} disabled={!canAlign} title="Align right"><AlignEndHorizontal className="h-4 w-4" /></ToolBtn>
            <ToolBtn onClick={() => onGroupOp("align-t")} disabled={!canAlign} title="Align top"><AlignStartVertical className="h-4 w-4" /></ToolBtn>
            <ToolBtn onClick={() => onGroupOp("align-m")} disabled={!canAlign} title="Align vertical middle"><AlignCenterVertical className="h-4 w-4" /></ToolBtn>
            <ToolBtn onClick={() => onGroupOp("align-b")} disabled={!canAlign} title="Align bottom"><AlignEndVertical className="h-4 w-4" /></ToolBtn>
          </ClusterRow>
          <ClusterRow label="Distribute">
            <ToolBtn onClick={() => onGroupOp("dist-h")} disabled={!canDist} title="Distribute horizontally"><StretchHorizontal className="h-4 w-4" /></ToolBtn>
            <ToolBtn onClick={() => onGroupOp("dist-v")} disabled={!canDist} title="Distribute vertically"><StretchVertical className="h-4 w-4" /></ToolBtn>
          </ClusterRow>
          <ClusterRow label="Layer">
            <ToolBtn onClick={() => onZOrder("front")} disabled={!hasSel} title="Bring to front (Shift+])"><BringToFront className="h-4 w-4" /></ToolBtn>
            <ToolBtn onClick={() => onZOrder("forward")} disabled={!hasSel} title="Bring forward (])"><ChevronUp className="h-4 w-4" /></ToolBtn>
            <ToolBtn onClick={() => onZOrder("backward")} disabled={!hasSel} title="Send backward ([)"><ChevronDown className="h-4 w-4" /></ToolBtn>
            <ToolBtn onClick={() => onZOrder("back")} disabled={!hasSel} title="Send to back (Shift+[)"><SendToBack className="h-4 w-4" /></ToolBtn>
          </ClusterRow>
          <ClusterRow label="Selection">
            <ToolBtn onClick={onDuplicate} disabled={!hasSel} title="Duplicate"><Copy className="h-4 w-4" /></ToolBtn>
            <ToolBtn
              onClick={onToggleLock}
              disabled={!hasSel}
              title={selectedElement?.locked ? "Unlock (locked elements can't be dragged)" : "Lock position"}
            >
              {selectedElement?.locked ? <Lock className="h-4 w-4 text-amber-600" /> : <Unlock className="h-4 w-4" />}
            </ToolBtn>
            <ToolBtn
              onClick={onToggleVisible}
              disabled={!hasSel}
              title={selectedElement?.visible === false ? "Show on public page" : "Hide from public page"}
            >
              {selectedElement?.visible === false ? <EyeOff className="h-4 w-4 text-amber-600" /> : <Eye className="h-4 w-4" />}
            </ToolBtn>
            {view === "mobile" && (
              <ToolBtn onClick={onResetMobile} disabled={!hasSel} title="Reset to auto-reflow"><Smartphone className="h-4 w-4" /></ToolBtn>
            )}
            <ToolBtn onClick={onDelete} disabled={!hasSel} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></ToolBtn>
          </ClusterRow>
          <ClusterRow label="Arrange">
            <ToolBtn onClick={() => onMagicArrange("grid")} title="Arrange as 2-column grid"><Wand2 className="h-4 w-4" /></ToolBtn>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onMagicArrange("asymmetric")}
              title="Asymmetric layout"
              className="h-7 px-2 text-[10px]"
            >
              ASYM
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onMagicArrange("hero")}
              title="Hero-led layout"
              className="h-7 px-2 text-[10px]"
            >
              HERO
            </Button>
          </ClusterRow>
          <ClusterRow label="View">
            <Button
              type="button"
              variant={view === "desktop" ? "default" : "outline"}
              size="sm"
              onClick={() => onViewChange("desktop")}
              className="h-7 px-2"
            >
              <Monitor className="h-4 w-4 mr-1" /> Desktop
            </Button>
            <Button
              type="button"
              variant={view === "mobile" ? "default" : "outline"}
              size="sm"
              onClick={() => onViewChange("mobile")}
              className="h-7 px-2"
            >
              <Smartphone className="h-4 w-4 mr-1" /> Mobile
            </Button>
          </ClusterRow>
          {view === "mobile" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onResetMobileAll}
              className="w-full h-7 text-xs"
              title="Clear every element's mobile override and fall back to auto-reflow"
            >
              <Smartphone className="h-3.5 w-3.5 mr-1" /> Reset all mobile overrides
            </Button>
          )}
        </div>
      </div>

      <div className="border-t" />

      {/* ── Layers ── */}
      <div>
        <SectionHeader icon={<Layers className="h-3.5 w-3.5" />}>Layers</SectionHeader>
        <LayersPanel
          elements={elements}
          selectedIds={selectedIds}
          onSelect={onSelectLayer}
          onMove={onZMove}
          onToggleLock={onToggleLockOne}
          onToggleVisible={onToggleVisibleOne}
        />
      </div>

      <div className="border-t" />

      {/* ── Add element ── */}
      <div>
        <SectionHeader>Add element</SectionHeader>
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => add("text")} disabled={pending}>
            <Type className="h-4 w-4 mr-1" /> Text
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => add("heading")} disabled={pending}>
            <HeadingIcon className="h-4 w-4 mr-1" /> Heading
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => add("divider")} disabled={pending}>
            <Minus className="h-4 w-4 mr-1" /> Divider
          </Button>
        </div>
      </div>

      <div className="border-t" />

      {/* ── Button ── */}
      <div className="space-y-2">
        <SectionHeader icon={<Link2 className="h-3.5 w-3.5" />}>Button</SectionHeader>
        <Input placeholder="Label" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} />
        <Input
          placeholder="https://…"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addLink(); }}
        />
        <Button type="button" size="sm" onClick={addLink} disabled={pending} className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Add button
        </Button>
      </div>

      <div className="border-t" />

      {/* ── Widget ── */}
      <div className="space-y-2">
        <SectionHeader icon={<Sparkles className="h-3.5 w-3.5" />}>Widget from URL</SectionHeader>
        <Input
          placeholder="twitch.tv/handle, youtube.com/…"
          value={widgetUrl}
          onChange={(e) => setWidgetUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addWidget(); }}
        />
        <Button type="button" size="sm" onClick={addWidget} disabled={pending} className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Auto-detect + add
        </Button>

        <div className="pt-2 border-t border-dashed border-border/40 space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Or pick a kind</p>
          <select
            value={widgetKind}
            onChange={(e) => setWidgetKind(e.target.value as WidgetKind)}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
          >
            {WIDGET_PICKER_SPECS.map((spec) => (
              <option key={spec.kind} value={spec.kind}>{spec.label}</option>
            ))}
          </select>
          <Input
            placeholder={widgetSpec.placeholder}
            value={widgetKindInput}
            onChange={(e) => setWidgetKindInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addWidgetByKind(); }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addWidgetByKind}
            disabled={pending}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-1" /> Add {widgetSpec.label.toLowerCase()}
          </Button>
        </div>
      </div>

      <div className="border-t" />

      {/* ── Region ── */}
      <div className="space-y-2">
        <SectionHeader icon={<Layers className="h-3.5 w-3.5" />}>Background region</SectionHeader>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addRegion}
          disabled={pending}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-1" /> Add region
        </Button>
        <p className="text-[10px] text-muted-foreground">
          A box with its own background — useful for grouping a cluster of elements.
        </p>
      </div>

      <div className="border-t" />

      {/* ── Shapes ── */}
      <div className="space-y-2">
        <SectionHeader icon={<Shapes className="h-3.5 w-3.5" />}>Shape</SectionHeader>
        <div className="grid grid-cols-4 gap-2">
          <ShapePickBtn label="Rect" onClick={() => addShape("rect")} disabled={pending}>
            <Square className="h-5 w-5" />
          </ShapePickBtn>
          <ShapePickBtn label="Circle" onClick={() => addShape("circle")} disabled={pending}>
            <Circle className="h-5 w-5" />
          </ShapePickBtn>
          <ShapePickBtn label="Blob" onClick={() => addShape("blob")} disabled={pending}>
            <BlobIcon />
          </ShapePickBtn>
          <ShapePickBtn label="Triangle" onClick={() => addShape("triangle")} disabled={pending}>
            <Triangle className="h-5 w-5" />
          </ShapePickBtn>
        </div>
      </div>

      <div className="border-t" />

      {/* ── Stickers ── */}
      <div className="space-y-2">
        <SectionHeader icon={<Sparkles className="h-3.5 w-3.5" />}>Sticker</SectionHeader>
        <div className="grid grid-cols-6 gap-1.5">
          {STICKER_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => addSticker(icon)}
              disabled={pending}
              title={icon}
              className="h-9 w-9 rounded-md border bg-muted/40 hover:bg-muted disabled:opacity-50 flex items-center justify-center p-1.5"
            >
              <StickerGlyph icon={icon} color="currentColor" />
            </button>
          ))}
        </div>
      </div>

      <div className="border-t" />

      {/* ── Image ── */}
      <div className="space-y-2">
        <SectionHeader icon={<ImageIcon className="h-3.5 w-3.5" />}>Image</SectionHeader>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            handleImageFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => imageInputRef.current?.click()}
          disabled={pending}
          className="w-full"
        >
          {pending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
          Upload image
        </Button>
        <p className="text-[10px] text-muted-foreground">
          PNG, JPG, GIF, WebP · up to 5MB. Mask the shape from the selected-element controls below.
        </p>
      </div>

      {hasSel && (
        <>
          <div className="border-t" />
          <div className="space-y-2">
            <SectionHeader>
              {selectedIds.size === 1 ? "Selected" : `${selectedIds.size} selected`}
            </SectionHeader>
            {selectedElement && (
              <div className="text-xs text-muted-foreground">
                type · <span className="font-mono">{selectedElement.type}</span>
                {selectedElement.locked ? <span className="ml-2 text-amber-600">locked</span> : null}
                {selectedElement.visible === false ? <span className="ml-2 text-amber-600">hidden</span> : null}
              </div>
            )}
            {selectedElement && selectedPlacement && (
              <PositionInspector
                element={selectedElement}
                placement={selectedPlacement}
                view={view}
                onPatchPlacement={onPatchPlacement}
              />
            )}

            {selectedElement && (selectedElement.type === "text" || selectedElement.type === "heading") && (
              <ContentInspector element={selectedElement} onPatchFields={onPatchFields} />
            )}
            {selectedElement?.type === "link" && (
              <LinkInspector element={selectedElement} onPatchFields={onPatchFields} />
            )}
            {selectedElement?.type === "link" && (
              <ButtonInspector element={selectedElement} onPatchMeta={onPatchMeta} />
            )}
            {selectedElement?.type === "shape" && (
              <ShapeInspector element={selectedElement} onPatchMeta={onPatchMeta} />
            )}
            {selectedElement?.type === "sticker" && (
              <StickerInspector element={selectedElement} onPatchMeta={onPatchMeta} />
            )}
            {selectedElement?.type === "image" && (
              <ImageInspector element={selectedElement} onPatchMeta={onPatchMeta} />
            )}
            {selectedElement?.type === "region" && (
              <RegionInspector element={selectedElement} onPatchMeta={onPatchMeta} />
            )}
          </div>
        </>
      )}

      <div className="border-t" />

      {/* ── Shortcuts (collapsible) ── */}
      <div>
        <button
          type="button"
          className="w-full flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
          onClick={() => setShowShortcuts((s) => !s)}
        >
          <span className="flex items-center gap-1.5">
            <Keyboard className="h-3.5 w-3.5" /> Shortcuts
          </span>
          <span>{showShortcuts ? "−" : "+"}</span>
        </button>
        {showShortcuts && (
          <div className="mt-2 space-y-1.5 text-xs">
            <Shortcut keys={["←", "→", "↑", "↓"]} label="Nudge 1px" />
            <Shortcut keys={["Shift", "+", "↑↓←→"]} label="Nudge 10px" />
            <Shortcut keys={[mod, "+", "Z"]} label="Undo" />
            <Shortcut keys={[mod, "+", "Shift", "+", "Z"]} label="Redo" />
            <Shortcut keys={[mod, "+", "C"]} label="Copy" />
            <Shortcut keys={[mod, "+", "V"]} label="Paste" />
            <Shortcut keys={[mod, "+", "D"]} label="Duplicate" />
            <Shortcut keys={[mod, "+", "A"]} label="Select all" />
            <Shortcut keys={["]"]} label="Bring forward" />
            <Shortcut keys={["["]} label="Send backward" />
            <Shortcut keys={["Shift", "+", "] ["]} label="To front / back" />
            <Shortcut keys={["Delete"]} label="Remove selection" />
            <Shortcut keys={["Shift", "+", "click"]} label="Toggle in selection" />
            <Shortcut keys={["2×", "click"]} label="Edit text in place" />
            <Shortcut keys={[mod, "+", "wheel"]} label="Zoom (cursor-centered)" />
            <Shortcut keys={["Space", "+", "drag"]} label="Pan the canvas" />
            <Shortcut keys={["Shift", "+", "drag rotate"]} label="Snap to 15°" />
          </div>
        )}
      </div>
    </Card>
  );
}
