"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Wand2 } from "lucide-react";
import { WIDGET_PICKER_SPECS } from "@/lib/widgets/picker-specs";
import type { BlockType } from "@/lib/blocks";
import { BLOCK_LABELS } from "@/lib/blocks";
import {
  WIDGET_HINTS,
  WIDGET_ICONS,
  WIDGET_LABELS,
  WIDGET_PLACEHOLDERS,
  type WidgetPickerKind,
} from "./block-meta";

export function WidgetPicker({
  onPick,
  onCancel,
}: {
  onPick: (kind: WidgetPickerKind) => void;
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
          onClick={() => onPick("auto")}
          className="justify-start sm:col-span-2"
        >
          <Wand2 className="h-4 w-4 mr-2" />
          Paste a URL — auto-detect
        </Button>
        {WIDGET_PICKER_SPECS.map((spec) => {
          const Icon = WIDGET_ICONS[spec.kind];
          return (
            <Button
              key={spec.kind}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPick(spec.kind)}
              className="justify-start"
            >
              <Icon className="h-4 w-4 mr-2" />
              {spec.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export function WidgetForm({
  kind,
  pending,
  onSubmit,
  onCancel,
}: {
  kind: WidgetPickerKind;
  pending: boolean;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
}) {
  return (
    <form action={onSubmit} className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Add {WIDGET_LABELS[kind]}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <div className="space-y-1">
        <Label htmlFor="input">URL or handle</Label>
        <Input id="input" name="input" placeholder={WIDGET_PLACEHOLDERS[kind]} required />
        <p className="text-xs text-muted-foreground">{WIDGET_HINTS[kind]}</p>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding..." : "Add widget"}
      </Button>
    </form>
  );
}

export function AddForm({
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
