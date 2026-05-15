"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Plus, Trash2, Link2, Type, Heading as HeadingIcon, Minus, Sparkles,
  Smartphone, Monitor, Undo2, Redo2, Copy,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  StretchHorizontal, StretchVertical, Keyboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  createWidgetElementFromUrl,
  deleteElement,
  deleteElements,
  duplicateElements,
  updateElement,
  updateMobilePlacements,
} from "./actions";

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
  const [, startTransition] = useTransition();

  const canvasRef = useRef<HTMLDivElement>(null);
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
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    const px = e.clientX - canvasRect.left;
    const py = e.clientY - canvasRect.top;

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
      const r = canvasRef.current?.getBoundingClientRect();
      if (!r) return null;
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
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
  }, [history, patchLocal, queueSave]);

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
        return;
      }
      if (mod && ev.key.toLowerCase() === "v" && clipboardRef.current.length > 0) {
        ev.preventDefault();
        doDuplicate(clipboardRef.current.map((e) => e.id));
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
    <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
      <div className="space-y-3">
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-center justify-between">
            <span>{error}</span>
            <button className="ml-3 underline" onClick={() => setError(null)}>dismiss</button>
          </div>
        )}

        <HelperBar selectionCount={selectedIds.size} view={view} />
        <CanvasToolbar
          view={view}
          onViewChange={setView}
          onUndo={doUndo}
          onRedo={doRedo}
          canUndo={history.canUndo()}
          canRedo={history.canRedo()}
          selectionCount={selectedIds.size}
          onGroupOp={applyGroupOp}
          onDuplicate={() => doDuplicate(Array.from(selectedIds))}
        />

        <Card className="overflow-hidden">
          <div className="bg-muted px-4 py-2 text-xs font-mono text-muted-foreground border-b flex items-center justify-between">
            <span>Preview · /{profile.username}</span>
            <span className="text-[10px] uppercase tracking-wide">{view}</span>
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
                view={view}
                overlay={
                  <>
                    {selectionBox && (
                      <SelectionOverlay
                        box={selectionBox}
                        rotation={singleSelected?.rotation ?? 0}
                        showResize={selectedIds.size === 1}
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
        </Card>
      </div>

      <SidePanel
        selectedIds={selectedIds}
        selectedElement={singleSelected}
        view={view}
        onAdded={pushAdded}
        onError={setError}
        onDelete={doDeleteSelection}
        onDuplicate={() => doDuplicate(Array.from(selectedIds))}
        onResetMobile={resetMobileForSelection}
      />
    </div>
  );
}

function HelperBar({ selectionCount, view }: { selectionCount: number; view: View }) {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const mod = modKeyLabel();
  const tip =
    selectionCount === 0
      ? view === "mobile"
        ? "Mobile preview · drag the avatar/widgets to set mobile-specific positions, or use the Reset button to fall back to auto-reflow."
        : "Click an element to select. Drag empty space to marquee-select. Add new elements from the right panel."
      : selectionCount === 1
        ? "Drag to move · drag the handles to resize · the small dot above the box rotates · arrow keys nudge (shift = 10px)."
        : `${selectionCount} selected · use the align/distribute buttons or drag the group together.`;
  return (
    <Card className="px-3 py-2 flex items-center gap-3 text-xs text-muted-foreground">
      <span className="flex-1">{tip}</span>
      <button
        type="button"
        className="flex items-center gap-1 text-foreground hover:underline"
        onClick={() => setShowShortcuts((s) => !s)}
      >
        <Keyboard className="h-3.5 w-3.5" /> Shortcuts
      </button>
      {showShortcuts && (
        <div className="absolute right-6 mt-32 z-50 w-72 rounded-lg border bg-popover text-popover-foreground shadow-lg p-3 text-xs space-y-1.5">
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

function CanvasToolbar({
  view,
  onViewChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  selectionCount,
  onGroupOp,
  onDuplicate,
}: {
  view: View;
  onViewChange: (v: View) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  selectionCount: number;
  onGroupOp: (op: "align-l" | "align-c" | "align-r" | "align-t" | "align-m" | "align-b" | "dist-h" | "dist-v") => void;
  onDuplicate: () => void;
}) {
  const canDist = selectionCount >= 3;
  const canAlign = selectionCount >= 2;
  return (
    <Card className="p-2 flex flex-wrap items-center gap-2">
      <ToolGroup>
        <ToolBtn onClick={onUndo} disabled={!canUndo} title="Undo"><Undo2 className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={onRedo} disabled={!canRedo} title="Redo"><Redo2 className="h-4 w-4" /></ToolBtn>
      </ToolGroup>
      <ToolGroup label="Align">
        <ToolBtn onClick={() => onGroupOp("align-l")} disabled={!canAlign} title="Align left"><AlignStartHorizontal className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={() => onGroupOp("align-c")} disabled={!canAlign} title="Align horizontal center"><AlignCenterHorizontal className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={() => onGroupOp("align-r")} disabled={!canAlign} title="Align right"><AlignEndHorizontal className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={() => onGroupOp("align-t")} disabled={!canAlign} title="Align top"><AlignStartVertical className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={() => onGroupOp("align-m")} disabled={!canAlign} title="Align vertical middle"><AlignCenterVertical className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={() => onGroupOp("align-b")} disabled={!canAlign} title="Align bottom"><AlignEndVertical className="h-4 w-4" /></ToolBtn>
      </ToolGroup>
      <ToolGroup label="Distribute">
        <ToolBtn onClick={() => onGroupOp("dist-h")} disabled={!canDist} title="Distribute horizontally"><StretchHorizontal className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={() => onGroupOp("dist-v")} disabled={!canDist} title="Distribute vertically"><StretchVertical className="h-4 w-4" /></ToolBtn>
      </ToolGroup>
      <ToolGroup>
        <ToolBtn onClick={onDuplicate} disabled={selectionCount === 0} title="Duplicate"><Copy className="h-4 w-4" /></ToolBtn>
      </ToolGroup>
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant={view === "desktop" ? "default" : "outline"}
          size="sm"
          onClick={() => onViewChange("desktop")}
        >
          <Monitor className="h-4 w-4 mr-1" /> Desktop
        </Button>
        <Button
          type="button"
          variant={view === "mobile" ? "default" : "outline"}
          size="sm"
          onClick={() => onViewChange("mobile")}
        >
          <Smartphone className="h-4 w-4 mr-1" /> Mobile
        </Button>
      </div>
    </Card>
  );
}

function ToolGroup({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="flex items-center" title={label}>
      {label && <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1.5 hidden md:inline">{label}</span>}
      <div className="flex items-center rounded-md border border-border/60 bg-muted/30 p-0.5 gap-0.5">
        {children}
      </div>
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
  onAdded,
  onError,
  onDelete,
  onDuplicate,
  onResetMobile,
}: {
  selectedIds: Set<string>;
  selectedElement: Element | null;
  view: View;
  onAdded: (el: Element) => void;
  onError: (msg: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onResetMobile: () => void;
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
        <Input placeholder="Title" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} />
        <Input placeholder="https://…" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
        <Button type="button" size="sm" onClick={addLink} disabled={pending} className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Add link
        </Button>
      </div>

      <div className="space-y-2 pt-2 border-t">
        <p className="text-sm font-medium flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Widget from URL</p>
        <Input placeholder="twitch.tv/handle, youtube.com/…" value={widgetUrl} onChange={(e) => setWidgetUrl(e.target.value)} />
        <Button type="button" size="sm" onClick={addWidget} disabled={pending} className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Add widget
        </Button>
      </div>

      {selectedIds.size > 0 && (
        <div className="pt-2 border-t space-y-2">
          <p className="text-sm font-medium">
            {selectedIds.size === 1 ? "Selected" : `${selectedIds.size} selected`}
          </p>
          {selectedElement && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>type · <span className="font-mono">{selectedElement.type}</span></div>
              <div>x · {Math.round(view === "desktop" ? selectedElement.x : (selectedElement.mobile_x ?? 0))} · y · {Math.round(view === "desktop" ? selectedElement.y : (selectedElement.mobile_y ?? 0))}</div>
              <div>{Math.round(view === "desktop" ? selectedElement.w : (selectedElement.mobile_w ?? selectedElement.w))} × {Math.round(view === "desktop" ? selectedElement.h : (selectedElement.mobile_h ?? selectedElement.h))}</div>
              {selectedElement.rotation ? <div>rot · {Math.round(selectedElement.rotation)}°</div> : null}
            </div>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onDuplicate} className="w-full">
            <Copy className="h-4 w-4 mr-1" /> Duplicate
          </Button>
          {view === "mobile" && (
            <Button type="button" variant="outline" size="sm" onClick={onResetMobile} className="w-full">
              Reset to auto-reflow
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onDelete} className="w-full text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        </div>
      )}
    </Card>
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
