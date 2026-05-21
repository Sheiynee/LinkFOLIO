"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Plus, Trash2, Link2, Type, Heading as HeadingIcon, Minus, Sparkles,
  Smartphone, Monitor, Undo2, Redo2, Copy,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  StretchHorizontal, StretchVertical, Keyboard,
  Square, Circle, Triangle, Shapes, ImageIcon, Loader2,
  Layers, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ProfileCanvasRender } from "@/components/profile-canvas-render";
import type { ProfileRenderData } from "@/components/profile-render";
import type { Element } from "@/lib/elements";
import {
  CANVAS_WIDTH,
  DEFAULT_ELEMENT_HEIGHTS,
  MIN_ELEMENT_H,
  MIN_ELEMENT_W,
} from "@/lib/elements";
import type { Theme } from "@/lib/themes";
import type { WidgetData } from "@/lib/widgets/types";
import type { UserFontRecord } from "@/lib/typography";
import { snap, snapToGrid, type SnapGuide } from "@/lib/canvas-snap";
import { MOBILE_CANVAS_WIDTH, placementsForMobile } from "@/lib/canvas-mobile";
import {
  bboxOf,
  MarqueeBox,
  SelectionOverlay,
  SnapGuides,
  type HandleId,
  type SelectionBox,
} from "./canvas-overlay";
import { useCanvasHistory, diffPlacements } from "./canvas-history";
import {
  batchUpdateElements,
  createElement,
  createRegionElement,
  createShapeElement,
  createStickerElement,
  createWidgetElementFromUrl,
  deleteElement,
  deleteElements,
  duplicateElements,
  improveCopyForElement,
  updateElement,
  updateMobilePlacements,
  uploadAndCreateImageElement,
} from "./actions";
import { COPY_INTENTS, type CopyIntent } from "@/lib/ai-copy";
import {
  BUTTON_ICONS,
  BUTTON_VARIANTS,
  IMAGE_MASKS,
  STICKER_ICONS,
  readButtonMeta,
  readImageMeta,
  readRegionMeta,
  readShapeMeta,
  readStickerMeta,
  type ButtonIcon,
  type ImageMask,
  type ShapeKind,
} from "@/lib/visual-elements";
import { ButtonIconGlyph } from "@/components/button-icon";
import { arrange, type ArrangeKind } from "@/lib/magic-arrange";
import { StickerGlyph } from "@/components/sticker-glyph";

type View = "desktop" | "mobile";

interface DragGesture { type: "drag"; ids: string[]; startPointer: { x: number; y: number }; startBoxes: Record<string, { x: number; y: number; w: number; h: number }>; moved: boolean }
interface ResizeGesture { type: "resize"; handle: Exclude<HandleId, "rot">; id: string; startPointer: { x: number; y: number }; startBox: { x: number; y: number; w: number; h: number }; moved: boolean }
interface RotateGesture { type: "rotate"; id: string; centerX: number; centerY: number; startAngle: number; startRotation: number; moved: boolean }
interface MarqueeGesture { type: "marquee"; startPointer: { x: number; y: number }; pointer: { x: number; y: number }; additive: boolean; baseSelection: Set<string> }
type Gesture = DragGesture | ResizeGesture | RotateGesture | MarqueeGesture;

interface Props {
  initialElements: Element[];
  profile: ProfileRenderData;
  theme: Theme;
  widgetData: Record<string, WidgetData>;
  userFonts: UserFontRecord[];
}

export function CanvasEditor({ initialElements, profile, theme, widgetData, userFonts }: Props) {
  const [elements, setElements] = useState<Element[]>(initialElements);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<View>("desktop");
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const [marquee, setMarquee] = useState<SelectionBox | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [naturalH, setNaturalH] = useState(900);
  const [, startTransition] = useTransition();

  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollOuterRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const elementsRef = useRef(elements);
  const selectedIdsRef = useRef(selectedIds);
  const viewRef = useRef<View>(view);
  const beforeGestureRef = useRef<Element[]>(initialElements);
  const clipboardRef = useRef<Element[]>([]);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => { elementsRef.current = elements; }, [elements]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { viewRef.current = view; }, [view]);

  // Natural width of the rendered canvas (data-canvas-root + horizontal padding
  // from ProfileCanvasRender's outer container).
  const naturalW = (view === "mobile" ? MOBILE_CANVAS_WIDTH : CANVAS_WIDTH) + 32;

  // Viewport-aware scaling: shrink the canvas to fit narrow screens instead of
  // forcing a horizontal scroll.
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const outer = scrollOuterRef.current;
    const inner = canvasRef.current;
    if (!outer || !inner) return;
    function update() {
      const availW = outer!.clientWidth - 8;
      const s = Math.min(1, availW / naturalW);
      setScale(s > 0 ? s : 1);
      setNaturalH(inner!.scrollHeight);
    }
    update();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [naturalW]);

  /**
   * Coordinate origin + scale for pointer math. The outer canvasRef wraps the
   * full left column (so we can attach a single pointerdown listener), but
   * element x/y are relative to the inner 600px (or 360px in mobile view)
   * centered canvas. Anchor on that via the data-canvas-root attribute. When
   * the canvas is visually downscaled on narrow viewports, getBoundingClientRect
   * returns the *visual* rect — convert pointer deltas back to canvas-px by
   * dividing by `scale`.
   */
  const canvasMetrics = useCallback((): { rect: DOMRect; scale: number } | null => {
    const root = canvasRef.current?.querySelector("[data-canvas-root]") as HTMLElement | null;
    if (!root) return null;
    const rect = root.getBoundingClientRect();
    const expected = viewRef.current === "mobile" ? MOBILE_CANVAS_WIDTH : CANVAS_WIDTH;
    const scale = rect.width > 0 ? rect.width / expected : 1;
    return { rect, scale };
  }, []);

  const history = useCanvasHistory(setElements);

  /** What placement the user sees & interacts with for an element. */
  const visiblePlacement = useCallback((el: Element) => {
    if (viewRef.current === "desktop") {
      return { x: el.x, y: el.y, w: el.w, h: el.h };
    }
    const map = placementsForMobile(elementsRef.current);
    return map[el.id] ?? { x: 0, y: 0, w: el.w, h: el.h };
  }, []);

  /** Update local state. Treats desktop vs mobile differently. */
  const patchLocal = useCallback((id: string, patch: { x?: number; y?: number; w?: number; h?: number; rotation?: number }) => {
    setElements((es) =>
      es.map((e) => {
        if (e.id !== id) return e;
        if (viewRef.current === "mobile") {
          return {
            ...e,
            mobile_x: patch.x ?? e.mobile_x,
            mobile_y: patch.y ?? e.mobile_y,
            mobile_w: patch.w ?? e.mobile_w,
            mobile_h: patch.h ?? e.mobile_h,
          };
        }
        return {
          ...e,
          x: patch.x ?? e.x,
          y: patch.y ?? e.y,
          w: patch.w ?? e.w,
          h: patch.h ?? e.h,
          rotation: patch.rotation ?? e.rotation,
        };
      })
    );
  }, []);

  /** Debounced server save for continuous gestures. */
  const queueSave = useCallback((id: string, patch: { x?: number; y?: number; w?: number; h?: number; rotation?: number }) => {
    const timers = saveTimers.current;
    const prev = timers.get(id);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => {
      startTransition(async () => {
        const res = viewRef.current === "mobile"
          ? await updateMobilePlacements([{ id, mobile_x: patch.x, mobile_y: patch.y, mobile_w: patch.w, mobile_h: patch.h }])
          : await updateElement(id, patch);
        if (res.error) setError(res.error);
      });
      timers.delete(id);
    }, 250);
    timers.set(id, t);
  }, []);

  // ─── Gesture: pointerdown router ───────────────────────────
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    const m = canvasMetrics();
    if (!m) return;
    const px = (e.clientX - m.rect.left) / m.scale;
    const py = (e.clientY - m.rect.top) / m.scale;

    // Resize / rotate handle?
    const handleEl = target.closest("[data-handle]") as HTMLElement | null;
    if (handleEl) {
      const handle = handleEl.getAttribute("data-handle") as HandleId | null;
      if (!handle) return;
      const ids = Array.from(selectedIdsRef.current);
      if (ids.length !== 1) return;
      const el = elementsRef.current.find((x) => x.id === ids[0]);
      if (!el) return;
      const box = visiblePlacement(el);
      beforeGestureRef.current = elementsRef.current;
      if (handle === "rot") {
        gestureRef.current = {
          type: "rotate",
          id: el.id,
          centerX: box.x + box.w / 2,
          centerY: box.y + box.h / 2,
          startAngle: Math.atan2(py - (box.y + box.h / 2), px - (box.x + box.w / 2)),
          startRotation: el.rotation,
          moved: false,
        };
      } else {
        gestureRef.current = {
          type: "resize",
          handle,
          id: el.id,
          startPointer: { x: px, y: py },
          startBox: box,
          moved: false,
        };
      }
      e.preventDefault();
      return;
    }

    // Element body?
    const wrapper = target.closest("[data-element-id]") as HTMLElement | null;
    if (wrapper) {
      const id = wrapper.getAttribute("data-element-id");
      if (!id) return;
      const el = elementsRef.current.find((x) => x.id === id);
      if (!el || el.locked) return;
      e.preventDefault();

      // Shift-click: toggle in selection. Plain click on unselected: replace.
      let nextSel: Set<string>;
      if (e.shiftKey) {
        nextSel = new Set(selectedIdsRef.current);
        if (nextSel.has(id)) nextSel.delete(id);
        else nextSel.add(id);
      } else if (selectedIdsRef.current.has(id)) {
        nextSel = selectedIdsRef.current;
      } else {
        nextSel = new Set([id]);
      }
      setSelectedIds(nextSel);

      const startBoxes: Record<string, { x: number; y: number; w: number; h: number }> = {};
      Array.from(nextSel).forEach((sid) => {
        const se = elementsRef.current.find((x) => x.id === sid);
        if (se) startBoxes[sid] = visiblePlacement(se);
      });
      beforeGestureRef.current = elementsRef.current;
      gestureRef.current = {
        type: "drag",
        ids: Array.from(nextSel),
        startPointer: { x: px, y: py },
        startBoxes,
        moved: false,
      };
      return;
    }

    // Empty surface → marquee select.
    e.preventDefault();
    gestureRef.current = {
      type: "marquee",
      startPointer: { x: px, y: py },
      pointer: { x: px, y: py },
      additive: e.shiftKey,
      baseSelection: e.shiftKey ? new Set(selectedIdsRef.current) : new Set(),
    };
    if (!e.shiftKey) setSelectedIds(new Set());
    setMarquee({ x: px, y: py, w: 0, h: 0 });
  }

  // ─── Window-level pointermove/up while a gesture is active ──
  useEffect(() => {
    function localPoint(ev: PointerEvent) {
      const m = canvasMetrics();
      if (!m) return null;
      return { x: (ev.clientX - m.rect.left) / m.scale, y: (ev.clientY - m.rect.top) / m.scale };
    }

    function move(ev: PointerEvent) {
      const g = gestureRef.current;
      if (!g) return;
      const pt = localPoint(ev);
      if (!pt) return;

      if (g.type === "drag") {
        const dx = pt.x - g.startPointer.x;
        const dy = pt.y - g.startPointer.y;
        g.moved = g.moved || Math.abs(dx) > 1 || Math.abs(dy) > 1;
        const list = elementsRef.current;
        const moving = g.ids;

        // Snap the first selected element to grid/guides; apply same delta to siblings.
        const primaryId = moving[0];
        const startPrimary = g.startBoxes[primaryId];
        const proposed = {
          x: startPrimary.x + dx,
          y: startPrimary.y + dy,
          w: startPrimary.w,
          h: startPrimary.h,
        };
        const others = viewRef.current === "desktop"
          ? list.filter((e) => !moving.includes(e.id))
          : Array.from(Object.entries(placementsForMobile(list)))
              .filter(([id]) => !moving.includes(id))
              .map(([id, p]) => ({ ...list.find((e) => e.id === id)!, ...p }));
        const snapped = snap(proposed, others as Element[], "move");
        const snapDX = snapped.box.x - startPrimary.x;
        const snapDY = snapped.box.y - startPrimary.y;
        setGuides(snapped.guides);

        setElements((es) =>
          es.map((e) => {
            if (!moving.includes(e.id)) return e;
            const start = g.startBoxes[e.id];
            const nx = start.x + snapDX;
            const ny = start.y + snapDY;
            if (viewRef.current === "mobile") {
              return { ...e, mobile_x: nx, mobile_y: ny };
            }
            return { ...e, x: nx, y: ny };
          })
        );
        for (const id of moving) {
          const start = g.startBoxes[id];
          queueSave(id, { x: start.x + snapDX, y: start.y + snapDY });
        }
      } else if (g.type === "resize") {
        const list = elementsRef.current;
        const dx = pt.x - g.startPointer.x;
        const dy = pt.y - g.startPointer.y;
        g.moved = g.moved || Math.abs(dx) > 1 || Math.abs(dy) > 1;
        let { x, y, w, h } = g.startBox;
        const handle = g.handle;
        if (handle === "l" || handle === "tl" || handle === "bl") { x += dx; w -= dx; }
        if (handle === "r" || handle === "tr" || handle === "br") { w += dx; }
        if (handle === "t" || handle === "tl" || handle === "tr") { y += dy; h -= dy; }
        if (handle === "b" || handle === "bl" || handle === "br") { h += dy; }
        // Clamp before snap.
        if (w < MIN_ELEMENT_W) { if (handle.includes("l")) x -= MIN_ELEMENT_W - w; w = MIN_ELEMENT_W; }
        if (h < MIN_ELEMENT_H) { if (handle.includes("t")) y -= MIN_ELEMENT_H - h; h = MIN_ELEMENT_H; }
        const others = list.filter((e) => e.id !== g.id);
        const mode: Parameters<typeof snap>[2] = `resize-${handle}` as Parameters<typeof snap>[2];
        const snapped = snap({ x, y, w, h }, others, mode);
        setGuides(snapped.guides);
        patchLocal(g.id, snapped.box);
        queueSave(g.id, snapped.box);
      } else if (g.type === "rotate") {
        const angle = Math.atan2(pt.y - g.centerY, pt.x - g.centerX);
        const deltaDeg = ((angle - g.startAngle) * 180) / Math.PI;
        let rotation = g.startRotation + deltaDeg;
        // Snap to 15° increments while shift is held.
        if (ev.shiftKey) rotation = Math.round(rotation / 15) * 15;
        rotation = ((rotation + 540) % 360) - 180;
        g.moved = g.moved || Math.abs(deltaDeg) > 0.5;
        patchLocal(g.id, { rotation });
        queueSave(g.id, { rotation });
      } else if (g.type === "marquee") {
        const x = Math.min(g.startPointer.x, pt.x);
        const y = Math.min(g.startPointer.y, pt.y);
        const w = Math.abs(pt.x - g.startPointer.x);
        const h = Math.abs(pt.y - g.startPointer.y);
        setMarquee({ x, y, w, h });
        // Intersect against visible placements.
        const list = elementsRef.current;
        const ids: Set<string> = new Set(g.baseSelection);
        for (const el of list) {
          const p = viewRef.current === "desktop"
            ? { x: el.x, y: el.y, w: el.w, h: el.h }
            : placementsForMobile(list)[el.id];
          if (!p) continue;
          const hit = !(p.x + p.w < x || p.x > x + w || p.y + p.h < y || p.y > y + h);
          if (hit) ids.add(el.id);
          else if (!g.additive) ids.delete(el.id);
        }
        setSelectedIds(ids);
      }
    }

    function up(ev: PointerEvent) {
      const g = gestureRef.current;
      if (!g) return;
      setGuides([]);
      setMarquee(null);
      if (g.type !== "marquee" && g.moved) {
        // Commit a history snapshot for this gesture.
        history.push(beforeGestureRef.current);
      }
      gestureRef.current = null;
      // Treat a click-without-drag inside the marquee gesture as a deselect.
      if (g.type === "marquee" && !ev) setSelectedIds(new Set());
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [history, patchLocal, queueSave, canvasMetrics]);

  // ─── Keyboard ─────────────────────────────────────────────
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      const t = ev.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const ids = Array.from(selectedIdsRef.current);
      const mod = ev.metaKey || ev.ctrlKey;

      // Undo / redo
      if (mod && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        if (ev.shiftKey) doRedo(); else doUndo();
        return;
      }
      if (mod && ev.key.toLowerCase() === "y") {
        ev.preventDefault();
        doRedo();
        return;
      }

      // Copy / paste / duplicate
      if (mod && ev.key.toLowerCase() === "c" && ids.length > 0) {
        ev.preventDefault();
        const list = elementsRef.current.filter((e) => ids.includes(e.id));
        clipboardRef.current = list;
        writeClipboardIds(list.map((e) => e.id));
        return;
      }
      if (mod && ev.key.toLowerCase() === "v") {
        ev.preventDefault();
        readClipboardIds().then((sysIds) => {
          if (sysIds && sysIds.length > 0) {
            doDuplicate(sysIds);
          } else if (clipboardRef.current.length > 0) {
            doDuplicate(clipboardRef.current.map((e) => e.id));
          }
        });
        return;
      }
      if (mod && ev.key.toLowerCase() === "d" && ids.length > 0) {
        ev.preventDefault();
        doDuplicate(ids);
        return;
      }
      if (mod && ev.key.toLowerCase() === "a") {
        ev.preventDefault();
        setSelectedIds(new Set(elementsRef.current.map((e) => e.id)));
        return;
      }

      // Delete
      if ((ev.key === "Delete" || ev.key === "Backspace") && ids.length > 0) {
        ev.preventDefault();
        doDeleteSelection();
        return;
      }

      // Arrow nudge
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(ev.key) && ids.length > 0) {
        ev.preventDefault();
        const step = ev.shiftKey ? 10 : 1;
        const dx = ev.key === "ArrowLeft" ? -step : ev.key === "ArrowRight" ? step : 0;
        const dy = ev.key === "ArrowUp" ? -step : ev.key === "ArrowDown" ? step : 0;
        nudgeSelection(ids, dx, dy);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function nudgeSelection(ids: string[], dx: number, dy: number) {
    history.push(elementsRef.current);
    setElements((es) =>
      es.map((e) => {
        if (!ids.includes(e.id)) return e;
        if (viewRef.current === "mobile") {
          const m = placementsForMobile(elementsRef.current)[e.id];
          return { ...e, mobile_x: (e.mobile_x ?? m.x) + dx, mobile_y: (e.mobile_y ?? m.y) + dy };
        }
        return { ...e, x: e.x + dx, y: e.y + dy };
      })
    );
    startTransition(async () => {
      const patches = ids.map((id) => {
        const e = elementsRef.current.find((x) => x.id === id)!;
        return { id, patch: { x: e.x, y: e.y } };
      });
      if (viewRef.current === "mobile") {
        await updateMobilePlacements(
          ids.map((id) => {
            const e = elementsRef.current.find((x) => x.id === id)!;
            return { id, mobile_x: e.mobile_x, mobile_y: e.mobile_y };
          })
        );
      } else {
        await batchUpdateElements(patches);
      }
    });
  }

  // ─── Undo / redo ─────────────────────────────────────────
  function doUndo() {
    const before = elementsRef.current;
    const restored = history.undo(before);
    if (!restored) return;
    syncDiffToServer(before, restored);
  }
  function doRedo() {
    const before = elementsRef.current;
    const restored = history.redo(before);
    if (!restored) return;
    syncDiffToServer(before, restored);
  }
  function syncDiffToServer(before: Element[], after: Element[]) {
    const diff = diffPlacements(before, after);
    if (diff.length === 0) return;
    startTransition(async () => {
      const res = await batchUpdateElements(diff.map((d) => ({ id: d.id, patch: d.patch })));
      if (res.error) setError(res.error);
    });
  }

  // ─── Add / delete / duplicate ─────────────────────────────
  function pushAdded(el: Element) {
    history.push(elementsRef.current);
    setElements((es) => [...es, el]);
    setSelectedIds(new Set([el.id]));
  }

  function doDeleteSelection() {
    const ids = Array.from(selectedIdsRef.current);
    if (ids.length === 0) return;
    history.push(elementsRef.current);
    setElements((es) => es.filter((e) => !ids.includes(e.id)));
    setSelectedIds(new Set());
    startTransition(async () => {
      const res = ids.length === 1
        ? await deleteElement(ids[0])
        : await deleteElements(ids);
      if (res.error) setError(res.error);
    });
  }

  function doDuplicate(ids: string[]) {
    if (ids.length === 0) return;
    history.push(elementsRef.current);
    startTransition(async () => {
      const res = await duplicateElements(ids);
      if ("error" in res) {
        setError(res.error ?? "Duplicate failed");
        return;
      }
      const created = (res.elements ?? []) as Element[];
      setElements((es) => [...es, ...created]);
      setSelectedIds(new Set(created.map((e) => e.id)));
    });
  }

  // ─── Group operations ─────────────────────────────────────
  function applyGroupOp(op: "align-l" | "align-c" | "align-r" | "align-t" | "align-m" | "align-b" | "dist-h" | "dist-v") {
    const ids = Array.from(selectedIdsRef.current);
    if (ids.length < 2) return;
    if ((op === "dist-h" || op === "dist-v") && ids.length < 3) return;
    history.push(elementsRef.current);

    const list = elementsRef.current.filter((e) => ids.includes(e.id));
    const box = bboxOf(list)!;
    const patches: Array<{ id: string; patch: { x?: number; y?: number } }> = [];

    if (op === "align-l") {
      for (const e of list) patches.push({ id: e.id, patch: { x: box.x } });
    } else if (op === "align-c") {
      const cx = box.x + box.w / 2;
      for (const e of list) patches.push({ id: e.id, patch: { x: Math.round(cx - e.w / 2) } });
    } else if (op === "align-r") {
      const right = box.x + box.w;
      for (const e of list) patches.push({ id: e.id, patch: { x: right - e.w } });
    } else if (op === "align-t") {
      for (const e of list) patches.push({ id: e.id, patch: { y: box.y } });
    } else if (op === "align-m") {
      const my = box.y + box.h / 2;
      for (const e of list) patches.push({ id: e.id, patch: { y: Math.round(my - e.h / 2) } });
    } else if (op === "align-b") {
      const bottom = box.y + box.h;
      for (const e of list) patches.push({ id: e.id, patch: { y: bottom - e.h } });
    } else if (op === "dist-h") {
      const sorted = [...list].sort((a, b) => a.x - b.x);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalGap = (last.x + last.w) - first.x - sorted.reduce((s, e) => s + e.w, 0);
      const gap = totalGap / (sorted.length - 1);
      let cursor = first.x;
      for (const e of sorted) {
        patches.push({ id: e.id, patch: { x: Math.round(cursor) } });
        cursor += e.w + gap;
      }
    } else if (op === "dist-v") {
      const sorted = [...list].sort((a, b) => a.y - b.y);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalGap = (last.y + last.h) - first.y - sorted.reduce((s, e) => s + e.h, 0);
      const gap = totalGap / (sorted.length - 1);
      let cursor = first.y;
      for (const e of sorted) {
        patches.push({ id: e.id, patch: { y: Math.round(cursor) } });
        cursor += e.h + gap;
      }
    }

    setElements((es) =>
      es.map((e) => {
        const p = patches.find((q) => q.id === e.id);
        return p ? { ...e, ...p.patch } : e;
      })
    );
    startTransition(async () => {
      await batchUpdateElements(patches);
    });
  }

  /** Patch an element's meta jsonb both locally and on the server. */
  function patchMeta(id: string, patch: Record<string, unknown>) {
    history.push(elementsRef.current);
    setElements((es) =>
      es.map((e) => {
        if (e.id !== id) return e;
        const next = { ...(e.meta ?? {}), ...patch };
        return { ...e, meta: next };
      })
    );
    startTransition(async () => {
      const el = elementsRef.current.find((e) => e.id === id);
      if (!el) return;
      const res = await updateElement(id, { meta: { ...(el.meta ?? {}), ...patch } });
      if (res.error) setError(res.error);
    });
  }

  // ─── AI copy assist ───────────────────────────────────────
  const [aiPending, setAiPending] = useState(false);
  async function improveCopy(id: string, intent: CopyIntent) {
    setAiPending(true);
    history.push(elementsRef.current);
    try {
      const res = await improveCopyForElement(id, intent);
      if (res.error) {
        setError(res.error);
        return;
      }
      const next = res.text;
      if (!next) return;
      setElements((es) =>
        es.map((e) => {
          if (e.id !== id) return e;
          if (e.type === "heading") {
            return e.title != null ? { ...e, title: next } : { ...e, content: next };
          }
          return { ...e, content: next };
        })
      );
    } finally {
      setAiPending(false);
    }
  }

  // ─── Magic arrange ────────────────────────────────────────
  function applyMagicArrange(kind: ArrangeKind) {
    const patches = arrange(kind, elementsRef.current);
    if (patches.length === 0) return;
    history.push(elementsRef.current);
    setElements((es) =>
      es.map((e) => {
        const p = patches.find((q) => q.id === e.id);
        return p ? { ...e, x: p.x, y: p.y, w: p.w, h: p.h } : e;
      })
    );
    startTransition(async () => {
      const res = await batchUpdateElements(patches.map((p) => ({ id: p.id, patch: { x: p.x, y: p.y, w: p.w, h: p.h } })));
      if (res.error) setError(res.error);
    });
  }

  // ─── Mobile placement helpers ─────────────────────────────
  function resetMobileForSelection() {
    const ids = Array.from(selectedIdsRef.current);
    if (ids.length === 0) return;
    history.push(elementsRef.current);
    setElements((es) =>
      es.map((e) => (ids.includes(e.id) ? { ...e, mobile_x: null, mobile_y: null, mobile_w: null, mobile_h: null } : e))
    );
    startTransition(async () => {
      await updateMobilePlacements(ids.map((id) => ({ id, mobile_x: null, mobile_y: null, mobile_w: null, mobile_h: null })));
    });
  }

  // ─── Selection metadata for the overlay ──────────────────
  const selectionBox = useMemo<SelectionBox | null>(() => {
    const list = elements.filter((e) => selectedIds.has(e.id));
    if (list.length === 0) return null;
    if (view === "desktop") return bboxOf(list);
    const mp = placementsForMobile(elements);
    const placedList = list.map((e) => ({ ...e, ...mp[e.id] }));
    return bboxOf(placedList);
  }, [selectedIds, elements, view]);

  const singleSelected = selectedIds.size === 1
    ? elements.find((e) => selectedIds.has(e.id)) ?? null
    : null;

  const canvasH = useMemo(() => {
    const positions = elements.map((e) => (view === "desktop" ? e.y + e.h : (placementsForMobile(elements)[e.id]?.y ?? 0) + (placementsForMobile(elements)[e.id]?.h ?? 0)));
    return Math.max(900, ...positions, 0) + 80;
  }, [elements, view]);

  // ─── Render ──────────────────────────────────────────────
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 relative">
      <div className="space-y-3 min-w-0">
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-center justify-between">
            <span>{error}</span>
            <button className="ml-3 underline" onClick={() => setError(null)}>dismiss</button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <HelperBar selectionCount={selectedIds.size} view={view} />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="lg:hidden shrink-0"
            onClick={() => setDrawerOpen(true)}
          >
            Tools
          </Button>
        </div>

        <Card className="overflow-hidden">
          <div className="bg-muted px-4 py-2 text-xs font-mono text-muted-foreground border-b flex items-center justify-between">
            <span>Preview · /{profile.username}</span>
            <span className="text-[10px] uppercase tracking-wide">
              {view}{scale < 0.999 ? ` · ${Math.round(scale * 100)}%` : ""}
            </span>
          </div>
          <div
            ref={scrollOuterRef}
            className="overflow-auto"
            style={{ touchAction: "none" }}
            onPointerDown={onPointerDown}
          >
            <div
              style={{
                width: naturalW * scale,
                height: Math.max(640, naturalH * scale),
                margin: "0 auto",
                position: "relative",
              }}
            >
              <div
                ref={canvasRef}
                className="flex justify-center"
                style={{
                  width: naturalW,
                  minHeight: 640,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  position: "absolute",
                  top: 0,
                  left: 0,
                }}
              >
                <ProfileCanvasRender
                  profile={profile}
                  elements={elements}
                  theme={theme}
                  widgetData={widgetData}
                  userFonts={userFonts}
                  preview
                  view={view}
                  overlay={
                    <>
                      {selectionBox && (
                        <SelectionOverlay
                          box={selectionBox}
                          rotation={singleSelected?.rotation ?? 0}
                          showResize={selectedIds.size === 1 && !(singleSelected?.rotation ?? 0)}
                          showRotate={selectedIds.size === 1 && view === "desktop"}
                        />
                      )}
                      <SnapGuides guides={guides} height={canvasH} />
                      <MarqueeBox box={marquee} />
                    </>
                  }
                  onSurfaceClick={() => setSelectedIds(new Set())}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Drawer scrim (mobile only) */}
      {drawerOpen && (
        <div
          aria-hidden
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Sidebar — slide-in drawer on <lg, static column on lg+ */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-[min(340px,92vw)] transition-transform duration-200 ease-out shadow-2xl",
          "lg:static lg:w-auto lg:translate-x-0 lg:shadow-none lg:transition-none",
          drawerOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-full overflow-y-auto bg-background lg:bg-transparent lg:overflow-visible">
          <div className="flex items-center justify-between px-4 pt-4 pb-2 lg:hidden">
            <span className="text-sm font-semibold">Tools</span>
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setDrawerOpen(false)}
            >
              Close
            </button>
          </div>
          <SidePanel
            selectedIds={selectedIds}
            selectedElement={singleSelected}
            view={view}
            onViewChange={setView}
            onUndo={doUndo}
            onRedo={doRedo}
            canUndo={history.canUndo()}
            canRedo={history.canRedo()}
            onGroupOp={applyGroupOp}
            onDuplicate={() => doDuplicate(Array.from(selectedIds))}
            onDelete={doDeleteSelection}
            onResetMobile={resetMobileForSelection}
            onAdded={pushAdded}
            onError={setError}
            onPatchMeta={patchMeta}
            onMagicArrange={applyMagicArrange}
            onImproveCopy={improveCopy}
            aiPending={aiPending}
          />
        </div>
      </div>
    </div>
  );
}

function HelperBar({ selectionCount, view }: { selectionCount: number; view: View }) {
  const tip =
    selectionCount === 0
      ? view === "mobile"
        ? "Mobile preview · drag a widget to set mobile-specific positions, or hit Reset in the sidebar to fall back to auto-reflow."
        : "Click an element to select · drag empty space to marquee-select · add new elements from the sidebar →"
      : selectionCount === 1
        ? "Drag to move · drag the handles to resize · the small dot above the box rotates · arrow keys nudge (shift = 10px)."
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

function SidePanel({
  selectedIds,
  selectedElement,
  view,
  onViewChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onGroupOp,
  onDuplicate,
  onDelete,
  onResetMobile,
  onAdded,
  onError,
  onPatchMeta,
  onMagicArrange,
  onImproveCopy,
  aiPending,
}: {
  selectedIds: Set<string>;
  selectedElement: Element | null;
  view: View;
  onViewChange: (v: View) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onGroupOp: (op: "align-l" | "align-c" | "align-r" | "align-t" | "align-m" | "align-b" | "dist-h" | "dist-v") => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onResetMobile: () => void;
  onAdded: (el: Element) => void;
  onError: (msg: string) => void;
  onPatchMeta: (id: string, patch: Record<string, unknown>) => void;
  onMagicArrange: (kind: ArrangeKind) => void;
  onImproveCopy: (id: string, intent: CopyIntent) => void;
  aiPending: boolean;
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
    const url = /^https?:/i.test(linkUrl.trim()) ? linkUrl.trim() : `https://${linkUrl.trim()}`;
    startTransition(async () => {
      const res = await createElement({ type: "link", title: linkTitle.trim(), url, h: DEFAULT_ELEMENT_HEIGHTS.link });
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
          <ClusterRow label="Selection">
            <ToolBtn onClick={onDuplicate} disabled={!hasSel} title="Duplicate"><Copy className="h-4 w-4" /></ToolBtn>
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
        </div>
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
          <Plus className="h-4 w-4 mr-1" /> Add widget
        </Button>
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
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>type · <span className="font-mono">{selectedElement.type}</span></div>
                <div>
                  x · {Math.round(view === "desktop" ? selectedElement.x : (selectedElement.mobile_x ?? 0))}
                  {"  "}·{"  "}
                  y · {Math.round(view === "desktop" ? selectedElement.y : (selectedElement.mobile_y ?? 0))}
                </div>
                <div>
                  {Math.round(view === "desktop" ? selectedElement.w : (selectedElement.mobile_w ?? selectedElement.w))}
                  {" × "}
                  {Math.round(view === "desktop" ? selectedElement.h : (selectedElement.mobile_h ?? selectedElement.h))}
                </div>
                {selectedElement.rotation ? <div>rot · {Math.round(selectedElement.rotation)}°</div> : null}
              </div>
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
            {selectedElement && (selectedElement.type === "text" || selectedElement.type === "heading") && (
              <AiCopyInspector
                element={selectedElement}
                pending={aiPending}
                onImprove={onImproveCopy}
              />
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
            <Shortcut keys={["Delete"]} label="Remove selection" />
            <Shortcut keys={["Shift", "+", "click"]} label="Toggle in selection" />
            <Shortcut keys={["Shift", "+", "drag rotate"]} label="Snap to 15°" />
          </div>
        )}
      </div>
    </Card>
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

const CLIPBOARD_MARKER = "linkfolio-canvas-clipboard:";

async function writeClipboardIds(ids: string[]) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
  try {
    await navigator.clipboard.writeText(CLIPBOARD_MARKER + JSON.stringify({ ids }));
  } catch {
    // Permission denied / insecure context — silently fall back to in-memory.
  }
}

async function readClipboardIds(): Promise<string[] | null> {
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

function ButtonInspector({
  element,
  onPatchMeta,
}: {
  element: Element;
  onPatchMeta: (id: string, patch: Record<string, unknown>) => void;
}) {
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

function ShapeInspector({
  element,
  onPatchMeta,
}: {
  element: Element;
  onPatchMeta: (id: string, patch: Record<string, unknown>) => void;
}) {
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

function StickerInspector({
  element,
  onPatchMeta,
}: {
  element: Element;
  onPatchMeta: (id: string, patch: Record<string, unknown>) => void;
}) {
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

function AiCopyInspector({
  element,
  pending,
  onImprove,
}: {
  element: Element;
  pending: boolean;
  onImprove: (id: string, intent: CopyIntent) => void;
}) {
  return (
    <div className="space-y-1.5 rounded-md border p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" />
        <span>AI copy assist</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {COPY_INTENTS.map((intent) => (
          <Button
            key={intent}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onImprove(element.id, intent)}
            disabled={pending}
            className="h-7 text-[10px] capitalize"
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : intent}
          </Button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Needs <code className="font-mono">ANTHROPIC_API_KEY</code> on the server.
      </p>
    </div>
  );
}

function RegionInspector({
  element,
  onPatchMeta,
}: {
  element: Element;
  onPatchMeta: (id: string, patch: Record<string, unknown>) => void;
}) {
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

function ImageInspector({
  element,
  onPatchMeta,
}: {
  element: Element;
  onPatchMeta: (id: string, patch: Record<string, unknown>) => void;
}) {
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

function modKeyLabel(): string {
  if (typeof navigator !== "undefined" && /Mac/i.test(navigator.platform)) return "⌘";
  return "Ctrl";
}

// Silence unused-warnings for unused helpers kept for future use.
void snapToGrid;
void CANVAS_WIDTH;
void MOBILE_CANVAS_WIDTH;
