"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Plus, Trash2, Link2, Type, Heading as HeadingIcon, Minus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ProfileCanvasRender,
} from "@/components/profile-canvas-render";
import type { ProfileRenderData } from "@/components/profile-render";
import type { Element } from "@/lib/elements";
import { CANVAS_WIDTH, DEFAULT_ELEMENT_HEIGHTS } from "@/lib/elements";
import type { Theme } from "@/lib/themes";
import type { WidgetData } from "@/lib/widgets/types";
import type { UserFontRecord } from "@/lib/typography";
import { createElement, createWidgetElementFromUrl, deleteElement, updateElement } from "./actions";

interface Props {
  initialElements: Element[];
  profile: ProfileRenderData;
  theme: Theme;
  widgetData: Record<string, WidgetData>;
  userFonts: UserFontRecord[];
}

interface DragState {
  id: string;
  /** Pointer position relative to the element's top-left when drag started. */
  offsetX: number;
  offsetY: number;
  pointerId: number;
  moved: boolean;
}

const SAVE_DEBOUNCE_MS = 300;

export function CanvasEditor({ initialElements, profile, theme, widgetData, userFonts }: Props) {
  const [elements, setElements] = useState<Element[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Debounced per-element save so a drag triggers one server call, not 60.
  const queueSave = useCallback((id: string, patch: { x: number; y: number }) => {
    const timers = saveTimers.current;
    const prev = timers.get(id);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => {
      startTransition(async () => {
        const res = await updateElement(id, patch);
        if (res.error) setError(res.error);
      });
      timers.delete(id);
    }, SAVE_DEBOUNCE_MS);
    timers.set(id, t);
  }, []);

  // Delete key removes the selected element.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (!selectedId) return;
      e.preventDefault();
      handleDelete(selectedId);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function handleDelete(id: string) {
    setElements((es) => es.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
    startTransition(async () => {
      const res = await deleteElement(id);
      if (res.error) setError(res.error);
    });
  }

  // Latest elements list, accessed from window-level pointer handlers without
  // re-attaching listeners on every state change.
  const elementsRef = useRef<Element[]>(elements);
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const wrapper = target.closest("[data-element-id]") as HTMLElement | null;
    if (!wrapper) {
      setSelectedId(null);
      return;
    }
    const id = wrapper.getAttribute("data-element-id");
    if (!id) return;
    const el = elementsRef.current.find((x) => x.id === id);
    if (!el || el.locked) return;

    e.preventDefault();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    setSelectedId(id);
    dragRef.current = {
      id,
      offsetX: e.clientX - (canvasRect.left + el.x),
      offsetY: e.clientY - (canvasRect.top + el.y),
      pointerId: e.pointerId,
      moved: false,
    };
  }

  // Window-level pointer handlers active during a drag. Capture pointer
  // events even when the cursor leaves the canvas surface so fast drags
  // don't strand the element mid-flight.
  useEffect(() => {
    function handleMove(ev: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== ev.pointerId) return;
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;
      const list = elementsRef.current;
      const current = list.find((x) => x.id === drag.id);
      if (!current) return;
      const x = Math.round(ev.clientX - canvasRect.left - drag.offsetX);
      const y = Math.round(ev.clientY - canvasRect.top - drag.offsetY);
      const clampedX = Math.max(-40, Math.min(CANVAS_WIDTH - 20, x));
      const clampedY = Math.max(-40, y);
      if (clampedX === current.x && clampedY === current.y) return;
      drag.moved = true;
      setElements((es) => es.map((el) => (el.id === drag.id ? { ...el, x: clampedX, y: clampedY } : el)));
      queueSave(drag.id, { x: clampedX, y: clampedY });
    }
    function handleUp(ev: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== ev.pointerId) return;
      dragRef.current = null;
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [queueSave]);

  function addLocalElement(el: Element) {
    setElements((es) => [...es, el]);
    setSelectedId(el.id);
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
      <div className="space-y-3">
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
            <button className="ml-3 underline" onClick={() => setError(null)}>dismiss</button>
          </div>
        )}
        <Card className="overflow-hidden">
          <div className="bg-muted px-4 py-2 text-xs font-mono text-muted-foreground border-b">
            Preview · /{profile.username}
          </div>
          <div
            className="overflow-auto"
            style={{ touchAction: "none" }}
            onPointerDown={onPointerDown}
          >
            <div
              ref={canvasRef}
              className="relative flex justify-center min-h-[640px]"
            >
              <ProfileCanvasRender
                profile={profile}
                elements={elements}
                theme={theme}
                widgetData={widgetData}
                userFonts={userFonts}
                preview
                overlay={
                  selectedId && (
                    <SelectionOverlay element={elements.find((e) => e.id === selectedId)} />
                  )
                }
                onSurfaceClick={() => setSelectedId(null)}
              />
            </div>
          </div>
        </Card>
        <p className="text-xs text-muted-foreground">
          Tip: click an element to select it, drag to move, Delete key to
          remove. Resize, rotation, multi-select, and undo land in Part 2.
        </p>
      </div>

      <AddElementPanel
        selectedId={selectedId}
        onDelete={(id) => handleDelete(id)}
        onAdded={addLocalElement}
        onError={setError}
      />
    </div>
  );
}

function SelectionOverlay({ element }: { element: Element | undefined }) {
  if (!element) return null;
  return (
    <div
      aria-hidden
      className="absolute pointer-events-none border-2 border-blue-500 rounded-sm"
      style={{
        left: element.x - 2,
        top: element.y - 2,
        width: element.w + 4,
        height: element.h + 4,
        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
        transformOrigin: "0 0",
        zIndex: 9999,
      }}
    />
  );
}

function AddElementPanel({
  selectedId,
  onDelete,
  onAdded,
  onError,
}: {
  selectedId: string | null;
  onDelete: (id: string) => void;
  onAdded: (el: Element) => void;
  onError: (msg: string) => void;
}) {
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
      const res = await createElement({
        type,
        content: defaults.content,
        h: defaults.h,
      });
      if (res.error) onError(res.error);
      else if (res.element) onAdded(res.element as Element);
    });
  }

  function addLink() {
    if (!linkTitle.trim() || !linkUrl.trim()) {
      onError("Title and URL are required");
      return;
    }
    const url = /^https?:/i.test(linkUrl.trim()) ? linkUrl.trim() : `https://${linkUrl.trim()}`;
    startTransition(async () => {
      const res = await createElement({
        type: "link",
        title: linkTitle.trim(),
        url,
        h: DEFAULT_ELEMENT_HEIGHTS.link,
      });
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

  return (
    <Card className="p-4 space-y-4 self-start lg:sticky lg:top-4">
      <div>
        <p className="text-sm font-medium mb-2">Add element</p>
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

      <div className="space-y-2 pt-2 border-t">
        <p className="text-sm font-medium flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Link button</p>
        <Input
          placeholder="Title"
          value={linkTitle}
          onChange={(e) => setLinkTitle(e.target.value)}
        />
        <Input
          placeholder="https://…"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
        />
        <Button type="button" size="sm" onClick={addLink} disabled={pending} className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Add link
        </Button>
      </div>

      <div className="space-y-2 pt-2 border-t">
        <p className="text-sm font-medium flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Widget from URL</p>
        <Input
          placeholder="twitch.tv/handle, youtube.com/…"
          value={widgetUrl}
          onChange={(e) => setWidgetUrl(e.target.value)}
        />
        <Button type="button" size="sm" onClick={addWidget} disabled={pending} className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Add widget
        </Button>
      </div>

      {selectedId && (
        <div className="pt-2 border-t">
          <p className="text-sm font-medium mb-2">Selected</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDelete(selectedId)}
            className="w-full text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Delete element
          </Button>
        </div>
      )}
    </Card>
  );
}
