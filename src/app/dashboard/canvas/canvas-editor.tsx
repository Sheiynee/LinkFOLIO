"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { ProfileCanvasRender } from "@/components/profile-canvas-render";
import type { ProfileRenderData } from "@/components/profile-render";
import type { Element } from "@/lib/elements";
import { CANVAS_WIDTH } from "@/lib/elements";
import type { Theme } from "@/lib/themes";
import type { WidgetData } from "@/lib/widgets/types";
import type { UserFontRecord } from "@/lib/typography";
import { MOBILE_CANVAS_WIDTH, placementsForMobile } from "@/lib/canvas-mobile";
import { computeGroupOp, computeNudge, computeZOrder, type CanvasView, type GroupOp, type ZOrderDir } from "@/lib/canvas-ops";
import { bboxOf, MarqueeBox, SelectionOverlay, SnapGuides, type SelectionBox } from "./canvas-overlay";
import { useCanvasHistory, diffPlacements } from "./canvas-history";
import { useCanvasGestures } from "./use-canvas-gestures";
import { readClipboardIds, writeClipboardIds } from "./clipboard";
import { HelperBar, SidePanel } from "./side-panel";
import {
  batchUpdateElements,
  deleteElement,
  deleteElements,
  duplicateElements,
  updateElement,
  updateMobilePlacements,
} from "./actions";
import { arrange, type ArrangeKind } from "@/lib/magic-arrange";

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
  const [view, setView] = useState<CanvasView>("desktop");
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [naturalH, setNaturalH] = useState(900);
  const [, startTransition] = useTransition();

  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollOuterRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef(elements);
  const selectedIdsRef = useRef(selectedIds);
  const viewRef = useRef<CanvasView>(view);
  const clipboardRef = useRef<Element[]>([]);

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

  const history = useCanvasHistory(setElements);

  const { onPointerDown, guides, marquee } = useCanvasGestures({
    canvasRef,
    elementsRef,
    selectedIdsRef,
    viewRef,
    setElements,
    setSelectedIds,
    pushHistory: history.push,
    setError,
  });

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

      // Z-order: ] forward / [ backward, with Shift = front / back
      if ((ev.key === "]" || ev.key === "}") && ids.length > 0) {
        ev.preventDefault();
        applyZOrder(ev.shiftKey ? "front" : "forward");
        return;
      }
      if ((ev.key === "[" || ev.key === "{") && ids.length > 0) {
        ev.preventDefault();
        applyZOrder(ev.shiftKey ? "back" : "backward");
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
    // Compute the next state and the server patches from the same source
    // array — reading refs after setElements races the ref-sync effect and
    // saves stale coordinates.
    const r = computeNudge(elementsRef.current, ids, dx, dy, viewRef.current);
    setElements(r.next);
    startTransition(async () => {
      const res = viewRef.current === "mobile"
        ? await updateMobilePlacements(r.mobilePatches)
        : await batchUpdateElements(r.desktopPatches);
      if (res.error) setError(res.error);
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
  function applyGroupOp(op: GroupOp) {
    const ids = Array.from(selectedIdsRef.current);
    if (ids.length < 2) return;
    if ((op === "dist-h" || op === "dist-v") && ids.length < 3) return;

    // Operates on the placements the user is looking at: desktop coords in
    // desktop view, mobile overrides (or auto-reflow positions) in mobile view.
    const r = computeGroupOp(elementsRef.current, ids, op, viewRef.current);
    if (r.desktopPatches.length === 0 && r.mobilePatches.length === 0) return;
    history.push(elementsRef.current);
    setElements(r.next);
    startTransition(async () => {
      const res = viewRef.current === "mobile"
        ? await updateMobilePlacements(r.mobilePatches)
        : await batchUpdateElements(r.desktopPatches);
      if (res.error) setError(res.error);
    });
  }

  // ─── Z-order ──────────────────────────────────────────────
  function applyZOrder(dir: ZOrderDir) {
    const ids = Array.from(selectedIdsRef.current);
    if (ids.length === 0) return;
    const r = computeZOrder(elementsRef.current, ids, dir);
    if (r.patches.length === 0) return;
    history.push(elementsRef.current);
    setElements(r.next);
    startTransition(async () => {
      const res = await batchUpdateElements(r.patches);
      if (res.error) setError(res.error);
    });
  }

  // ─── Lock / visibility ────────────────────────────────────
  function toggleLockSelection() {
    const ids = Array.from(selectedIdsRef.current);
    if (ids.length === 0) return;
    const list = elementsRef.current.filter((e) => ids.includes(e.id));
    // If anything is unlocked, lock everything; otherwise unlock.
    const locked = list.some((e) => !e.locked);
    history.push(elementsRef.current);
    setElements((es) => es.map((e) => (ids.includes(e.id) ? { ...e, locked } : e)));
    startTransition(async () => {
      const res = await batchUpdateElements(ids.map((id) => ({ id, patch: { locked } })));
      if (res.error) setError(res.error);
    });
  }

  function toggleVisibleSelection() {
    const ids = Array.from(selectedIdsRef.current);
    if (ids.length === 0) return;
    const list = elementsRef.current.filter((e) => ids.includes(e.id));
    // If anything is visible, hide everything; otherwise show.
    const visible = !list.some((e) => e.visible !== false);
    history.push(elementsRef.current);
    setElements((es) => es.map((e) => (ids.includes(e.id) ? { ...e, visible } : e)));
    startTransition(async () => {
      const res = await batchUpdateElements(ids.map((id) => ({ id, patch: { visible } })));
      if (res.error) setError(res.error);
    });
  }

  /**
   * Type an exact position/size/rotation for one element. In mobile view the
   * values land in the mobile override columns; desktop edits the canonical
   * placement. Used by the numeric inputs in the side panel.
   */
  function patchPlacement(id: string, patch: { x?: number; y?: number; w?: number; h?: number; rotation?: number }) {
    const el = elementsRef.current.find((e) => e.id === id);
    if (!el) return;
    history.push(elementsRef.current);
    if (viewRef.current === "mobile") {
      const current = placementsForMobile(elementsRef.current)[id];
      const next = {
        mobile_x: patch.x ?? current?.x ?? null,
        mobile_y: patch.y ?? current?.y ?? null,
        mobile_w: patch.w ?? el.mobile_w ?? null,
        mobile_h: patch.h ?? el.mobile_h ?? null,
      };
      setElements((es) => es.map((e) => (e.id === id ? { ...e, ...next } : e)));
      startTransition(async () => {
        const res = await updateMobilePlacements([{ id, ...next }]);
        if (res.error) setError(res.error);
      });
    } else {
      setElements((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
      startTransition(async () => {
        const res = await updateElement(id, patch);
        if (res.error) setError(res.error);
      });
    }
  }

  /**
   * Update the text columns (`title`, `content`) on a selected element.
   * Used by the inline editor for text / heading / link elements.
   * Goes through `updateElement` which also sanitizes the strings server-side.
   */
  function patchFields(id: string, patch: { title?: string | null; content?: string | null }) {
    history.push(elementsRef.current);
    setElements((es) =>
      es.map((e) => (e.id === id ? { ...e, ...patch } : e))
    );
    startTransition(async () => {
      const res = await updateElement(id, patch);
      if (res.error) setError(res.error);
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

  // Effective placement of the single selection in the current view — drives
  // the numeric inputs in the side panel.
  const selectedPlacement = useMemo(() => {
    if (!singleSelected) return null;
    if (view === "desktop") {
      const { x, y, w, h } = singleSelected;
      return { x, y, w, h };
    }
    return placementsForMobile(elements)[singleSelected.id] ?? null;
  }, [singleSelected, elements, view]);

  const canvasH = useMemo(() => {
    const mp = view === "mobile" ? placementsForMobile(elements) : null;
    const positions = elements.map((e) =>
      mp ? (mp[e.id]?.y ?? 0) + (mp[e.id]?.h ?? 0) : e.y + e.h
    );
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
                          rotation={view === "mobile" ? 0 : singleSelected?.rotation ?? 0}
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
            onZOrder={applyZOrder}
            onToggleLock={toggleLockSelection}
            onToggleVisible={toggleVisibleSelection}
            onPatchPlacement={patchPlacement}
            selectedPlacement={selectedPlacement}
            onDuplicate={() => doDuplicate(Array.from(selectedIds))}
            onDelete={doDeleteSelection}
            onResetMobile={resetMobileForSelection}
            onAdded={pushAdded}
            onError={setError}
            onPatchMeta={patchMeta}
            onPatchFields={patchFields}
            onMagicArrange={applyMagicArrange}
          />
        </div>
      </div>
    </div>
  );
}
