import { useCallback, useRef } from "react";
import type { Element } from "@/lib/elements";

/**
 * Tiny in-memory undo/redo stack. Each entry is a snapshot of the
 * elements array; restoring an entry is just `setElements(entry)` and
 * diffing the changed fields to the server.
 *
 * Snapshots are pushed manually via `pushHistory()` — typically at the
 * END of a continuous gesture (drag-end, resize-end) or for atomic
 * actions (add, delete, align, paste). Don't push during pointermove.
 */
export function useCanvasHistory(setElements: (next: Element[]) => void) {
  const past = useRef<Element[][]>([]);
  const future = useRef<Element[][]>([]);

  const push = useCallback((snapshot: Element[]) => {
    past.current.push(snapshot);
    if (past.current.length > 50) past.current.shift();
    future.current = [];
  }, []);

  /**
   * @returns The previous snapshot (which the caller should sync to server),
   * or null if nothing to undo.
   */
  const undo = useCallback((current: Element[]): Element[] | null => {
    const prev = past.current.pop();
    if (!prev) return null;
    future.current.push(current);
    setElements(prev);
    return prev;
  }, [setElements]);

  const redo = useCallback((current: Element[]): Element[] | null => {
    const next = future.current.pop();
    if (!next) return null;
    past.current.push(current);
    setElements(next);
    return next;
  }, [setElements]);

  const reset = useCallback(() => {
    past.current = [];
    future.current = [];
  }, []);

  return {
    push,
    undo,
    redo,
    reset,
    canUndo: () => past.current.length > 0,
    canRedo: () => future.current.length > 0,
  };
}

/**
 * Compute the patches needed to bring a list of elements from `before`
 * to `after`. Returns one patch per id whose position-relevant fields
 * differ; ids absent from `before` aren't returned (let the caller deal
 * with creates/deletes separately).
 */
export function diffPlacements(before: Element[], after: Element[]): Array<{ id: string; patch: Partial<Element> }> {
  const beforeMap = new Map(before.map((e) => [e.id, e]));
  const out: Array<{ id: string; patch: Partial<Element> }> = [];
  for (const a of after) {
    const b = beforeMap.get(a.id);
    if (!b) continue;
    const patch: Partial<Element> = {};
    if (a.x !== b.x) patch.x = a.x;
    if (a.y !== b.y) patch.y = a.y;
    if (a.w !== b.w) patch.w = a.w;
    if (a.h !== b.h) patch.h = a.h;
    if (a.rotation !== b.rotation) patch.rotation = a.rotation;
    if (a.z !== b.z) patch.z = a.z;
    if (a.mobile_x !== b.mobile_x) patch.mobile_x = a.mobile_x;
    if (a.mobile_y !== b.mobile_y) patch.mobile_y = a.mobile_y;
    if (a.mobile_w !== b.mobile_w) patch.mobile_w = a.mobile_w;
    if (a.mobile_h !== b.mobile_h) patch.mobile_h = a.mobile_h;
    if (Object.keys(patch).length > 0) out.push({ id: a.id, patch });
  }
  return out;
}
