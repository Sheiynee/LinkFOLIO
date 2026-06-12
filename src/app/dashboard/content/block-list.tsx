"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createBlock, createWidgetBlock, updateWidgetBlock, updateWidgetSize, updateBlock, deleteBlock, reorderBlocks, toggleBlockVisibility } from "./actions";
import type { WidgetSize } from "@/lib/widgets/types";
import type { Block, BlockType } from "@/lib/blocks";
import { BLOCK_LABELS } from "@/lib/blocks";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { TYPE_ICONS, type WidgetPickerKind } from "./block-meta";
import { AddForm, WidgetForm, WidgetPicker } from "./add-block-forms";
import { SortableBlockItem } from "./block-row";

export function BlockList({ initial }: { initial: Block[] }) {
  const [blocks, setBlocks] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState<BlockType | null>(null);
  const [addingWidget, setAddingWidget] = useState<WidgetPickerKind | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleAdd(type: BlockType, formData: FormData) {
    setError(null);
    const input = {
      type,
      title: formData.get("title") as string | undefined,
      url: formData.get("url") as string | undefined,
      content: formData.get("content") as string | undefined,
    };
    startTransition(async () => {
      const result = await createBlock(input);
      if (result.error) {
        setError(result.error);
        return;
      }
      const newBlock: Block = {
        id: result.id ?? crypto.randomUUID(),
        type,
        title: input.title?.trim() || null,
        url: input.url?.trim() || null,
        content: input.content?.trim() || null,
      };
      setBlocks((prev) => [...prev, newBlock]);
      setAdding(null);
    });
  }

  function handleAddWidgetDirect(kind: WidgetPickerKind) {
    setError(null);
    startTransition(async () => {
      const result = await createWidgetBlock({ kind, input: "" });
      if ("error" in result && result.error) { setError(result.error); return; }
      const ok = "id" in result ? result : null;
      const newBlock: Block = {
        id: ok?.id ?? crypto.randomUUID(),
        type: "widget",
        widget_kind: (ok?.kind ?? kind) as Block["widget_kind"],
        title: ok?.title ?? kind,
        url: null, content: null,
        meta: (ok?.meta ?? null) as Block["meta"],
      };
      setBlocks((prev) => [...prev, newBlock]);
      setAddingWidget(null);
      setAdding(null);
    });
  }

  function handleAddWidget(kind: WidgetPickerKind, formData: FormData) {
    setError(null);
    const input = (formData.get("input") as string | null)?.trim() ?? "";
    if (!input) {
      setError("Enter a URL or handle");
      return;
    }
    startTransition(async () => {
      const result = await createWidgetBlock({ kind, input });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      // Server resolves the final kind/meta/title (e.g. "auto" → "twitch_live").
      const ok = "id" in result ? result : null;
      const newBlock: Block = {
        id: ok?.id ?? crypto.randomUUID(),
        type: "widget",
        widget_kind: (ok?.kind ?? (kind === "auto" ? null : kind)) as Block["widget_kind"],
        title: ok?.title ?? input,
        url: null,
        content: null,
        meta: (ok?.meta ?? null) as Block["meta"],
      };
      setBlocks((prev) => [...prev, newBlock]);
      setAddingWidget(null);
      setAdding(null);
    });
  }

  function handleUpdate(block: Block, formData: FormData) {
    setError(null);

    if (block.type === "widget") {
      const widgetInput = (formData.get("input") as string | null)?.trim() ?? "";
      if (!widgetInput) {
        setError("Enter a URL or handle");
        return;
      }
      startTransition(async () => {
        const result = await updateWidgetBlock({ id: block.id, input: widgetInput });
        if ("error" in result && result.error) {
          setError(result.error);
          return;
        }
        const ok = "ok" in result ? result : null;
        setBlocks((prev) =>
          prev.map((b) =>
            b.id === block.id
              ? {
                  ...b,
                  meta: (ok?.meta ?? b.meta) as Block["meta"],
                  title: ok?.title ?? b.title,
                }
              : b
          )
        );
        setEditingId(null);
      });
      return;
    }

    const input = {
      id: block.id,
      title: formData.get("title") as string | undefined,
      url: formData.get("url") as string | undefined,
      content: formData.get("content") as string | undefined,
    };
    startTransition(async () => {
      const result = await updateBlock(input);
      if (result.error) {
        setError(result.error);
        return;
      }
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === block.id
            ? {
                ...b,
                title: input.title?.trim() ?? b.title,
                url: input.url?.trim() ?? b.url,
                content: input.content?.trim() ?? b.content,
              }
            : b
        )
      );
      setEditingId(null);
    });
  }

  function handleSize(id: string, size: WidgetSize) {
    setError(null);
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, meta: { ...((b.meta ?? {}) as Record<string, unknown>), size } as Block["meta"] }
          : b
      )
    );
    startTransition(async () => {
      const result = await updateWidgetSize({ id, size });
      if ("error" in result && result.error) setError(result.error);
    });
  }

  function handleToggleVisibility(id: string, currentVisible: boolean) {
    const next = !currentVisible;
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, visible: next } : b)));
    setError(null);
    startTransition(async () => {
      const result = await toggleBlockVisibility(id, next);
      if (result.error) {
        setError(result.error);
        setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, visible: currentVisible } : b)));
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this block?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteBlock(id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setBlocks((prev) => prev.filter((b) => b.id !== id));
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(blocks, oldIndex, newIndex);
    setBlocks(reordered);
    setError(null);
    startTransition(async () => {
      const result = await reorderBlocks(reordered.map((b) => b.id));
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {blocks.map((block) => (
              <SortableBlockItem
                key={block.id}
                block={block}
                editing={editingId === block.id}
                onStartEdit={() => setEditingId(block.id)}
                onCancelEdit={() => setEditingId(null)}
                onSubmit={(fd) => handleUpdate(block, fd)}
                onDelete={() => handleDelete(block.id)}
                onToggleVisibility={() => handleToggleVisibility(block.id, block.visible !== false)}
                onSizeChange={(size) => handleSize(block.id, size)}
                pending={pending}
              />
            ))}
            {blocks.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">
                No blocks yet. Add your first one below.
              </p>
            )}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
        {addingWidget ? (
          addingWidget === "stream_schedule" ? null : (
            <WidgetForm
              kind={addingWidget}
              pending={pending}
              onCancel={() => setAddingWidget(null)}
              onSubmit={(fd) => handleAddWidget(addingWidget, fd)}
            />
          )
        ) : adding === "widget" ? (
          <WidgetPicker
            onPick={(kind) => {
              if (kind === "stream_schedule") {
                handleAddWidgetDirect(kind);
              } else {
                setAddingWidget(kind);
              }
            }}
            onCancel={() => setAdding(null)}
          />
        ) : !adding ? (
          <>
            <h3 className="font-medium text-sm">Add a block</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(["link", "text", "heading", "divider", "widget"] as BlockType[]).map((t) => {
                const Icon = TYPE_ICONS[t];
                return (
                  <Button
                    key={t}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (t === "divider") {
                        const fd = new FormData();
                        handleAdd(t, fd);
                      } else {
                        setAdding(t);
                      }
                    }}
                    className="justify-start"
                  >
                    <Icon className="h-4 w-4 mr-1" /> {BLOCK_LABELS[t]}
                  </Button>
                );
              })}
            </div>
          </>
        ) : (
          <AddForm
            type={adding}
            pending={pending}
            onCancel={() => setAdding(null)}
            onSubmit={(fd) => handleAdd(adding, fd)}
          />
        )}
      </div>
    </div>
  );
}
