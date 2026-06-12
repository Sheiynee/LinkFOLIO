"use client";

import { useEffect, useRef, useState } from "react";
import type { Element } from "@/lib/elements";

export interface InlineTextEditorProps {
  element: Element;
  /** The placement the user sees in the current view (desktop or mobile). */
  placement: { x: number; y: number; w: number; h: number };
  /** Visual rotation — 0 in mobile view, the element's rotation on desktop. */
  rotation: number;
  onCommit: (content: string | null) => void;
  onCancel: () => void;
}

/**
 * Editor-side overlay for double-click in-place editing of text / heading
 * elements. Rendered above the canvas like the selection overlay — the shared
 * server/client ProfileCanvasRender stays hook-free. Commits on blur or
 * Ctrl/Cmd+Enter; Escape cancels.
 */
export function InlineTextEditor({ element, placement, rotation, onCommit, onCancel }: InlineTextEditorProps) {
  const [draft, setDraft] = useState(element.content ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);
  // Set when Escape/Ctrl+Enter already resolved the edit, so the blur that
  // follows closing doesn't commit a second time.
  const doneRef = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  function commit() {
    if (doneRef.current) return;
    doneRef.current = true;
    const next = draft.trim() === "" ? null : draft;
    if (next !== (element.content ?? null)) onCommit(next);
    else onCancel();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      doneRef.current = true;
      onCancel();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    }
  }

  return (
    <div
      data-inline-editor
      className="absolute"
      style={{
        left: placement.x,
        top: placement.y,
        width: placement.w,
        height: placement.h,
        // Match the element's center-origin rotation so the editor sits
        // exactly on top of what the user double-clicked.
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: "50% 50%",
        zIndex: 10000,
      }}
    >
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        spellCheck={false}
        className={
          "w-full h-full resize-none rounded-sm border-2 border-blue-500 bg-background text-foreground text-center outline-none p-1 " +
          (element.type === "heading" ? "text-xl font-bold" : "text-sm leading-relaxed")
        }
      />
    </div>
  );
}
