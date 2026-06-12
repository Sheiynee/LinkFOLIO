"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Pencil, Trash2, Check, X, GripVertical, Eye, EyeOff,
  Rows3, Square, LayoutGrid,
} from "lucide-react";
import type { Block } from "@/lib/blocks";
import type { WidgetSize } from "@/lib/widgets/types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TYPE_ICONS, widgetKindLabel, widgetSizeFromBlock, widgetSubtitle } from "./block-meta";

export function SortableBlockItem({
  block,
  editing,
  onStartEdit,
  onCancelEdit,
  onSubmit,
  onDelete,
  onToggleVisibility,
  onSizeChange,
  pending,
}: {
  block: Block;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSubmit: (fd: FormData) => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
  onSizeChange: (size: WidgetSize) => void;
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
    const widgetCurrent =
      block.type === "widget"
        ? widgetSubtitle(block)
        : "";
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
          {block.type === "widget" && (
            <>
              <Input
                name="input"
                defaultValue={widgetCurrent}
                required
                placeholder="URL or handle for this widget"
              />
              <p className="text-xs text-muted-foreground">
                Replacing the source for this {widgetKindLabel(block.widget_kind).toLowerCase()}.
              </p>
            </>
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
            <p className="font-medium truncate">{widgetKindLabel(block.widget_kind)}</p>
            <p className="text-sm text-muted-foreground truncate">
              {widgetSubtitle(block)}
            </p>
          </>
        )}
      </div>
      {block.type === "widget" && (
        <WidgetSizeToggle
          current={widgetSizeFromBlock(block)}
          onChange={onSizeChange}
          pending={pending}
        />
      )}
      <Button
        size="icon"
        variant="ghost"
        onClick={onToggleVisibility}
        aria-label={isHidden ? "Show" : "Hide"}
        title={isHidden ? "Hidden — click to show" : "Visible — click to hide"}
      >
        {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
      {block.type !== "divider" && (
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

function WidgetSizeToggle({
  current,
  onChange,
  pending,
}: {
  current: WidgetSize;
  onChange: (size: WidgetSize) => void;
  pending: boolean;
}) {
  const options: Array<{ size: WidgetSize; Icon: typeof Rows3; label: string }> = [
    { size: "compact", Icon: Rows3, label: "Compact" },
    { size: "default", Icon: Square, label: "Default" },
    { size: "featured", Icon: LayoutGrid, label: "Featured" },
  ];
  return (
    <div className="hidden sm:flex items-center rounded-md border p-0.5">
      {options.map(({ size, Icon, label }) => (
        <button
          key={size}
          type="button"
          aria-label={label}
          title={label}
          disabled={pending || current === size}
          onClick={() => onChange(size)}
          className={`h-7 w-7 rounded flex items-center justify-center transition ${
            current === size
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          } disabled:cursor-default`}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
