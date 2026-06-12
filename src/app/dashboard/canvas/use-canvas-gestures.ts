"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import type { Element } from "@/lib/elements";
import { CANVAS_WIDTH, MIN_ELEMENT_H, MIN_ELEMENT_W } from "@/lib/elements";
import { snap, type SnapGuide } from "@/lib/canvas-snap";
import { MOBILE_CANVAS_WIDTH, placementsForMobile } from "@/lib/canvas-mobile";
import { resizeRotatedBox, type CanvasView } from "@/lib/canvas-ops";
import type { HandleId, SelectionBox } from "./canvas-overlay";
import { updateElement, updateMobilePlacements } from "./actions";

interface DragGesture { type: "drag"; ids: string[]; startPointer: { x: number; y: number }; startBoxes: Record<string, { x: number; y: number; w: number; h: number }>; moved: boolean }
interface ResizeGesture { type: "resize"; handle: Exclude<HandleId, "rot">; id: string; startPointer: { x: number; y: number }; startBox: { x: number; y: number; w: number; h: number }; rotation: number; moved: boolean }
interface RotateGesture { type: "rotate"; id: string; centerX: number; centerY: number; startAngle: number; startRotation: number; moved: boolean }
interface MarqueeGesture { type: "marquee"; startPointer: { x: number; y: number }; pointer: { x: number; y: number }; additive: boolean; baseSelection: Set<string> }
type Gesture = DragGesture | ResizeGesture | RotateGesture | MarqueeGesture;

export interface CanvasGestureDeps {
  /** Wrapper around the canvas column; pointer math anchors on [data-canvas-root] inside it. */
  canvasRef: RefObject<HTMLDivElement | null>;
  elementsRef: MutableRefObject<Element[]>;
  selectedIdsRef: MutableRefObject<Set<string>>;
  viewRef: MutableRefObject<CanvasView>;
  setElements: Dispatch<SetStateAction<Element[]>>;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  /** Push a history snapshot (the state BEFORE the gesture). */
  pushHistory: (elements: Element[]) => void;
  setError: (msg: string) => void;
  /** Two pointerdowns on the same element within 400ms (e.g. inline text edit). */
  onDoubleClickElement?: (id: string) => void;
}

/**
 * Pointer interaction layer for the canvas editor: drag / resize / rotate /
 * marquee gestures, snap guides, debounced mid-gesture saves (which skip
 * cache revalidation), and the pointerup flush that persists the final state
 * with a full revalidate.
 */
export function useCanvasGestures({
  canvasRef,
  elementsRef,
  selectedIdsRef,
  viewRef,
  setElements,
  setSelectedIds,
  pushHistory,
  setError,
  onDoubleClickElement,
}: CanvasGestureDeps) {
  const [guides, setGuides] = useState<SnapGuide[]>([]);
  const [marquee, setMarquee] = useState<SelectionBox | null>(null);
  const [, startTransition] = useTransition();

  const gestureRef = useRef<Gesture | null>(null);
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);
  const beforeGestureRef = useRef<Element[]>([]);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  /**
   * Coordinate origin + scale for pointer math. Element x/y are relative to
   * the inner centered canvas, anchored via the data-canvas-root attribute.
   * When the canvas is visually downscaled on narrow viewports,
   * getBoundingClientRect returns the *visual* rect — convert pointer deltas
   * back to canvas-px by dividing by `scale`.
   */
  const canvasMetrics = useCallback((): { rect: DOMRect; scale: number } | null => {
    const root = canvasRef.current?.querySelector("[data-canvas-root]") as HTMLElement | null;
    if (!root) return null;
    const rect = root.getBoundingClientRect();
    const expected = viewRef.current === "mobile" ? MOBILE_CANVAS_WIDTH : CANVAS_WIDTH;
    const scale = rect.width > 0 ? rect.width / expected : 1;
    return { rect, scale };
  }, [canvasRef, viewRef]);

  /** What placement the user sees & interacts with for an element. */
  const visiblePlacement = useCallback((el: Element) => {
    if (viewRef.current === "desktop") {
      return { x: el.x, y: el.y, w: el.w, h: el.h };
    }
    const map = placementsForMobile(elementsRef.current);
    return map[el.id] ?? { x: 0, y: 0, w: el.w, h: el.h };
  }, [elementsRef, viewRef]);

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
  }, [setElements, viewRef]);

  /**
   * Debounced server save for continuous gestures. These mid-gesture saves
   * skip cache revalidation — the pointerup flush performs the final save
   * with a full revalidate.
   */
  const queueSave = useCallback((id: string, patch: { x?: number; y?: number; w?: number; h?: number; rotation?: number }) => {
    const timers = saveTimers.current;
    const prev = timers.get(id);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => {
      startTransition(async () => {
        const res = viewRef.current === "mobile"
          ? await updateMobilePlacements([{ id, mobile_x: patch.x, mobile_y: patch.y, mobile_w: patch.w, mobile_h: patch.h }], { skipRevalidate: true })
          : await updateElement(id, patch, { skipRevalidate: true });
        if (res.error) setError(res.error);
      });
      timers.delete(id);
    }, 250);
    timers.set(id, t);
  }, [setError, viewRef]);

  // ─── Gesture: pointerdown router ───────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // The inline text editor lives above the canvas — let it keep native
    // focus/selection behavior instead of starting a gesture.
    if (target.closest("[data-inline-editor]")) return;
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
          // Mobile placements always render unrotated.
          rotation: viewRef.current === "mobile" ? 0 : el.rotation,
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
      if (!el) return;
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

      // Double pointerdown on the same element → inline edit instead of drag.
      const now = performance.now();
      const lastTap = lastTapRef.current;
      lastTapRef.current = { id, time: now };
      if (!e.shiftKey && lastTap && lastTap.id === id && now - lastTap.time < 400) {
        lastTapRef.current = null;
        onDoubleClickElement?.(id);
        return;
      }

      // Locked elements can be selected (so they can be unlocked / inspected)
      // but never start a drag gesture.
      if (el.locked) return;

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
  }, [canvasMetrics, elementsRef, onDoubleClickElement, selectedIdsRef, setSelectedIds, viewRef, visiblePlacement]);

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
        const snapWidth = viewRef.current === "mobile" ? MOBILE_CANVAS_WIDTH : CANVAS_WIDTH;
        const snapped = snap(proposed, others as Element[], "move", snapWidth);
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
        const handle = g.handle;
        const box = resizeRotatedBox(g.startBox, g.rotation, handle, dx, dy, MIN_ELEMENT_W, MIN_ELEMENT_H);
        if (g.rotation === 0) {
          // Axis-aligned: snap against the other elements as the user sees them.
          const others = viewRef.current === "desktop"
            ? list.filter((e) => e.id !== g.id)
            : Array.from(Object.entries(placementsForMobile(list)))
                .filter(([id]) => id !== g.id)
                .map(([id, p]) => ({ ...list.find((e) => e.id === id)!, ...p }));
          const snapWidth = viewRef.current === "mobile" ? MOBILE_CANVAS_WIDTH : CANVAS_WIDTH;
          const mode: Parameters<typeof snap>[2] = `resize-${handle}` as Parameters<typeof snap>[2];
          const snapped = snap(box, others as Element[], mode, snapWidth);
          setGuides(snapped.guides);
          patchLocal(g.id, snapped.box);
          queueSave(g.id, snapped.box);
        } else {
          // Rotated boxes don't snap to axis-aligned guides.
          setGuides([]);
          patchLocal(g.id, box);
          queueSave(g.id, box);
        }
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

    function up() {
      const g = gestureRef.current;
      if (!g) return;
      setGuides([]);
      setMarquee(null);
      if (g.type !== "marquee" && g.moved) {
        // Commit a history snapshot for this gesture.
        pushHistory(beforeGestureRef.current);

        // Cancel pending debounced saves and write the final position
        // immediately (with revalidation — the debounced saves skip it) so a
        // quick browser refresh after lifting the pointer doesn't lose the
        // final position and the public page picks up the gesture's result.
        const timers = saveTimers.current;
        const ids = g.type === "drag" ? g.ids : [g.id];
        for (const id of ids) {
          const pending = timers.get(id);
          if (pending) {
            clearTimeout(pending);
            timers.delete(id);
          }
          const el = elementsRef.current.find((e) => e.id === id);
          if (!el) continue;
          startTransition(async () => {
            const isMobile = viewRef.current === "mobile";
            const res = isMobile
              ? await updateMobilePlacements([{ id, mobile_x: el.mobile_x ?? null, mobile_y: el.mobile_y ?? null, mobile_w: el.mobile_w ?? null, mobile_h: el.mobile_h ?? null }])
              : await updateElement(id, { x: el.x, y: el.y, w: el.w, h: el.h, rotation: el.rotation });
            if (res.error) setError(res.error);
          });
        }
      }
      gestureRef.current = null;
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [canvasMetrics, elementsRef, patchLocal, pushHistory, queueSave, setElements, setError, setSelectedIds, viewRef]);

  return { onPointerDown, guides, marquee };
}
