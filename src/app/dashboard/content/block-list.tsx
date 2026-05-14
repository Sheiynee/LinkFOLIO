"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Pencil,
  Trash2,
  Check,
  X,
  GripVertical,
  Link2,
  Type,
  Heading as HeadingIcon,
  Minus,
  Eye,
  EyeOff,
  Radio,
  Sparkles,
} from "lucide-react";
import { createBlock, createWidgetBlock, updateBlock, deleteBlock, reorderBlocks, toggleBlockVisibility } from "./actions";
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const TYPE_ICONS: Record<BlockType, React.ComponentType<{ className?: string }>> = {
  link: Link2,
  text: Type,
  heading: HeadingIcon,
  divider: Minus,
  widget: Sparkles,
};

export function BlockList({ initial }: { initial: Block[] }) {
  const [blocks, setBlocks] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState<BlockType | null>(null);
  const [addingWidget, setAddingWidget] = useState<"twitch_live" | null>(null);

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

  function handleAddWidget(kind: "twitch_live", formData: FormData) {
    setError(null);
    const input = (formData.get("input") as string | null)?.trim() ?? "";
    if (!input) {
      setError("Enter a channel name or URL");
      return;
    }
    startTransition(async () => {
      const result = await createWidgetBlock({ kind, input });
      if (result.error) {
        setError(result.error);
        return;
      }
      const newBlock: Block = {
        id: result.id ?? crypto.randomUUID(),
        type: "widget",
        widget_kind: kind,
        title: input,
        url: null,
        content: null,
        meta: { channel: input },
      };
      setBlocks((prev) => [...prev, newBlock]);
      setAddingWidget(null);
      setAdding(null);
    });
  }

  function handleUpdate(block: Block, formData: FormData) {
    setError(null);
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
          <WidgetForm
            kind={addingWidget}
            pending={pending}
            onCancel={() => setAddingWidget(null)}
            onSubmit={(fd) => handleAddWidget(addingWidget, fd)}
          />
        ) : adding === "widget" ? (
          <WidgetPicker
            onPick={(kind) => setAddingWidget(kind)}
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

function WidgetPicker({
  onPick,
  onCancel,
}: {
  onPick: (kind: "twitch_live") => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Pick a widget</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPick("twitch_live")}
          className="justify-start"
        >
          <Radio className="h-4 w-4 mr-2" />
          Twitch live status
        </Button>
        <div className="text-xs text-muted-foreground self-center px-2">
          More widgets coming soon — YouTube, Spotify, GitHub…
        </div>
      </div>
    </div>
  );
}

function WidgetForm({
  kind,
  pending,
  onSubmit,
  onCancel,
}: {
  kind: "twitch_live";
  pending: boolean;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
}) {
  const label = kind === "twitch_live" ? "Twitch live status" : kind;
  return (
    <form action={onSubmit} className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Add {label}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <div className="space-y-1">
        <Label htmlFor="input">Twitch channel</Label>
        <Input
          id="input"
          name="input"
          placeholder="e.g. shroud or https://twitch.tv/shroud"
          required
        />
        <p className="text-xs text-muted-foreground">
          Shows a live indicator + viewer count when the channel is streaming.
        </p>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding..." : "Add widget"}
      </Button>
    </form>
  );
}

function AddForm({
  type,
  pending,
  onSubmit,
  onCancel,
}: {
  type: BlockType;
  pending: boolean;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
}) {
  return (
    <form action={onSubmit} className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Add {BLOCK_LABELS[type]}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {type === "link" && (
        <>
          <div className="space-y-1">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" placeholder="My website" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="url">URL</Label>
            <Input id="url" name="url" placeholder="https://example.com" required />
          </div>
        </>
      )}
      {(type === "text" || type === "heading") && (
        <div className="space-y-1">
          <Label htmlFor="content">{type === "heading" ? "Heading text" : "Text"}</Label>
          {type === "heading" ? (
            <Input id="content" name="content" placeholder="Section title" required maxLength={100} />
          ) : (
            <Textarea id="content" name="content" placeholder="Write something..." required rows={3} maxLength={500} />
          )}
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Adding..." : `Add ${BLOCK_LABELS[type].toLowerCase()}`}
      </Button>
    </form>
  );
}

function SortableBlockItem({
  block,
  editing,
  onStartEdit,
  onCancelEdit,
  onSubmit,
  onDelete,
  onToggleVisibility,
  pending,
}: {
  block: Block;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSubmit: (fd: FormData) => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
  pending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: editing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = TYPE_ICONS[block.type];

  if (editing && block.type !== "divider") {
    return (
      <li ref={setNodeRef} style={style} className="rounded-lg border p-3">
        <form action={onSubmit} className="space-y-2">
          {block.type === "link" && (
            <>
              <Input name="title" defaultValue={block.title ?? ""} required placeholder="Title" />
              <Input name="url" defaultValue={block.url ?? ""} required placeholder="URL" />
            </>
          )}
          {block.type === "heading" && (
            <Input name="content" defaultValue={block.content ?? ""} required maxLength={100} />
          )}
          {block.type === "text" && (
            <Textarea name="content" defaultValue={block.content ?? ""} required rows={3} maxLength={500} />
          )}
          <div className="flex gap-2 justify-end">
            <Button type="button" size="sm" variant="ghost" onClick={onCancelEdit}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              <Check className="h-4 w-4 mr-1" /> Save
            </Button>
          </div>
        </form>
      </li>
    );
  }

  const isHidden = block.visible === false;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg border p-3 bg-background ${isHidden ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        {block.type === "link" && (
          <>
            <p className="font-medium truncate">{block.title}</p>
            <p className="text-sm text-muted-foreground truncate">{block.url}</p>
          </>
        )}
        {block.type === "heading" && (
          <p className="font-bold truncate">{block.content}</p>
        )}
        {block.type === "text" && (
          <p className="text-sm text-muted-foreground line-clamp-2">{block.content}</p>
        )}
        {block.type === "divider" && (
          <p className="text-sm text-muted-foreground italic">Divider</p>
        )}
        {block.type === "widget" && (
          <>
            <p className="font-medium truncate">
              {block.widget_kind === "twitch_live" ? "Twitch live" : "Widget"}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {(block.meta as { channel?: string } | null)?.channel ?? block.title ?? ""}
            </p>
          </>
        )}
      </div>
      <Button
        size="icon"
        variant="ghost"
        onClick={onToggleVisibility}
        aria-label={isHidden ? "Show" : "Hide"}
        title={isHidden ? "Hidden — click to show" : "Visible — click to hide"}
      >
        {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
      {block.type !== "divider" && block.type !== "widget" && (
        <Button size="icon" variant="ghost" onClick={onStartEdit} aria-label="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      <Button size="icon" variant="ghost" onClick={onDelete} disabled={pending} aria-label="Delete">
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}
