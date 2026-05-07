"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Plus, Check, X, GripVertical } from "lucide-react";
import { createLink, updateLink, deleteLink, reorderLinks } from "./actions";
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

interface LinkRow {
  id: string;
  title: string;
  url: string;
}

export function LinkList({ initial }: { initial: LinkRow[] }) {
  const [links, setLinks] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createLink(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      const title = String(formData.get("title"));
      const url = String(formData.get("url"));
      setLinks((prev) => [...prev, { id: crypto.randomUUID(), title, url }]);
      (document.getElementById("add-link-form") as HTMLFormElement)?.reset();
    });
  }

  function handleUpdate(id: string, formData: FormData) {
    setError(null);
    formData.append("id", id);
    startTransition(async () => {
      const result = await updateLink(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      const title = String(formData.get("title"));
      const url = String(formData.get("url"));
      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, title, url } : l)));
      setEditingId(null);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this link?")) return;
    setError(null);
    const formData = new FormData();
    formData.append("id", id);
    startTransition(async () => {
      const result = await deleteLink(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setLinks((prev) => prev.filter((l) => l.id !== id));
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = links.findIndex((l) => l.id === active.id);
    const newIndex = links.findIndex((l) => l.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(links, oldIndex, newIndex);
    setLinks(reordered);
    setError(null);
    startTransition(async () => {
      const result = await reorderLinks(reordered.map((l) => l.id));
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={links.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {links.map((link) => (
              <SortableLinkItem
                key={link.id}
                link={link}
                editing={editingId === link.id}
                onStartEdit={() => setEditingId(link.id)}
                onCancelEdit={() => setEditingId(null)}
                onSubmit={(fd) => handleUpdate(link.id, fd)}
                onDelete={() => handleDelete(link.id)}
                pending={pending}
              />
            ))}
            {links.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">
                No links yet. Add your first one below.
              </p>
            )}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="rounded-lg border p-4 bg-muted/30">
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add a link
        </h3>
        <form id="add-link-form" action={handleAdd} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" placeholder="My website" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="url">URL</Label>
            <Input id="url" name="url" placeholder="https://example.com" required />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Adding..." : "Add link"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function SortableLinkItem({
  link,
  editing,
  onStartEdit,
  onCancelEdit,
  onSubmit,
  onDelete,
  pending,
}: {
  link: LinkRow;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSubmit: (fd: FormData) => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
    disabled: editing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (editing) {
    return (
      <li ref={setNodeRef} style={style} className="rounded-lg border p-3">
        <form action={onSubmit} className="flex flex-col sm:flex-row gap-2">
          <Input name="title" defaultValue={link.title} required className="sm:w-1/3" />
          <Input name="url" defaultValue={link.url} required className="flex-1" />
          <div className="flex gap-1">
            <Button type="submit" size="icon" disabled={pending} aria-label="Save">
              <Check className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={onCancelEdit} aria-label="Cancel">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border p-3 bg-background"
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
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{link.title}</p>
        <p className="text-sm text-muted-foreground truncate">{link.url}</p>
      </div>
      <Button size="icon" variant="ghost" onClick={onStartEdit} aria-label="Edit">
        <Pencil className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" onClick={onDelete} disabled={pending} aria-label="Delete">
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}
