"use client";

import { useRef, useTransition } from "react";
import { GripVertical, Plus, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  type BgLayer,
  type GradientLayer,
  type ImageLayer,
  type MeshLayer,
  type PatternLayer,
  type GradientStop,
  type BackgroundBlendMode,
  type BackgroundSize,
  type ThemeBackground,
  newGradientLayer,
  newImageLayer,
  newMeshLayer,
  newPatternLayer,
} from "@/lib/themes";
import { PATTERN_LIST, layerLabel, layerStyle } from "@/lib/backgrounds";
import { uploadBackgroundImage } from "./actions";

interface Props {
  background: ThemeBackground;
  onChange: (next: ThemeBackground) => void;
}

export function BackgroundEditor({ background, onChange }: Props) {
  const layers = background.layers;

  function updateLayers(next: BgLayer[]) {
    onChange({ ...background, layers: next });
  }

  function addLayer(kind: "gradient" | "mesh" | "pattern") {
    const layer: BgLayer =
      kind === "gradient" ? newGradientLayer() : kind === "mesh" ? newMeshLayer() : newPatternLayer();
    updateLayers([...layers, layer]);
  }

  function addImageLayer(url: string) {
    updateLayers([...layers, newImageLayer(url)]);
  }

  function patchLayer(id: string, patch: Partial<BgLayer>) {
    updateLayers(layers.map((l) => (l.id === id ? ({ ...l, ...patch } as BgLayer) : l)));
  }

  function removeLayer(id: string) {
    updateLayers(layers.filter((l) => l.id !== id));
  }

  function move(id: string, dir: -1 | 1) {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= layers.length) return;
    const copy = [...layers];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    updateLayers(copy);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => addLayer("gradient")}>
          <Plus className="h-4 w-4 mr-1" /> Gradient
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => addLayer("mesh")}>
          <Plus className="h-4 w-4 mr-1" /> Mesh
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => addLayer("pattern")}>
          <Plus className="h-4 w-4 mr-1" /> Pattern
        </Button>
        <ImageUploadButton onUploaded={addImageLayer} />
      </div>

      {layers.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6 border rounded">
          No background layers. Add one above.
        </p>
      )}

      <div className="space-y-3">
        {layers.map((layer, i) => (
          <div key={layer.id} className="rounded-lg border bg-card">
            <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 text-sm font-medium">{layerLabel(layer)}</div>
              <div
                className="h-6 w-10 rounded border"
                style={layerStyle(layer)}
                title="Preview"
              />
              <button
                type="button"
                onClick={() => patchLayer(layer.id, { visible: layer.visible === false })}
                aria-label={layer.visible === false ? "Show layer" : "Hide layer"}
                className="text-muted-foreground hover:text-foreground"
              >
                {layer.visible === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => move(layer.id, -1)}
                disabled={i === 0}
                aria-label="Move up"
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => move(layer.id, 1)}
                disabled={i === layers.length - 1}
                aria-label="Move down"
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => removeLayer(layer.id)}
                aria-label="Delete layer"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3">
              {layer.type === "gradient" && (
                <GradientLayerForm
                  layer={layer}
                  onChange={(patch) => patchLayer(layer.id, patch as Partial<GradientLayer>)}
                />
              )}
              {layer.type === "mesh" && (
                <MeshLayerForm
                  layer={layer}
                  onChange={(patch) => patchLayer(layer.id, patch as Partial<MeshLayer>)}
                />
              )}
              {layer.type === "pattern" && (
                <PatternLayerForm
                  layer={layer}
                  onChange={(patch) => patchLayer(layer.id, patch as Partial<PatternLayer>)}
                />
              )}
              {layer.type === "image" && (
                <ImageLayerForm
                  layer={layer}
                  onChange={(patch) => patchLayer(layer.id, patch as Partial<ImageLayer>)}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GradientLayerForm({
  layer,
  onChange,
}: {
  layer: GradientLayer;
  onChange: (patch: Partial<GradientLayer>) => void;
}) {
  function setStop(idx: number, patch: Partial<GradientStop>) {
    const next = layer.stops.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange({ stops: next });
  }

  function addStop() {
    if (layer.stops.length >= 5) return;
    const last = layer.stops[layer.stops.length - 1];
    onChange({
      stops: [...layer.stops, { color: last.color, position: Math.min(100, last.position + 10) }],
    });
  }

  function removeStop(idx: number) {
    if (layer.stops.length <= 2) return;
    onChange({ stops: layer.stops.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label className="text-sm w-16">Angle</Label>
        <Input
          type="number"
          min={0}
          max={360}
          value={layer.angle}
          onChange={(e) => onChange({ angle: Number(e.target.value) })}
          className="w-24"
        />
        <span className="text-xs text-muted-foreground">degrees</span>
      </div>
      <div className="space-y-2">
        {layer.stops.map((stop, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(stop.color) ? stop.color : "#000000"}
              onChange={(e) => setStop(i, { color: e.target.value })}
              className="h-9 w-12 rounded border cursor-pointer"
            />
            <Input
              value={stop.color}
              onChange={(e) => setStop(i, { color: e.target.value })}
              className="flex-1 font-mono text-sm"
            />
            <Input
              type="number"
              min={0}
              max={100}
              value={stop.position}
              onChange={(e) => setStop(i, { position: Number(e.target.value) })}
              className="w-20"
            />
            <button
              type="button"
              onClick={() => removeStop(i)}
              disabled={layer.stops.length <= 2}
              aria-label="Remove stop"
              className="text-muted-foreground hover:text-destructive disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addStop}
          disabled={layer.stops.length >= 5}
        >
          <Plus className="h-4 w-4 mr-1" /> Add stop
        </Button>
      </div>
    </div>
  );
}

function MeshLayerForm({
  layer,
  onChange,
}: {
  layer: MeshLayer;
  onChange: (patch: Partial<MeshLayer>) => void;
}) {
  function setBlob(idx: number, patch: Partial<MeshLayer["blobs"][number]>) {
    onChange({ blobs: layer.blobs.map((b, i) => (i === idx ? { ...b, ...patch } : b)) });
  }
  function addBlob() {
    if (layer.blobs.length >= 4) return;
    onChange({
      blobs: [...layer.blobs, { x: 50, y: 50, color: "#7c3aed", size: 60, blur: 60 }],
    });
  }
  function removeBlob(idx: number) {
    if (layer.blobs.length <= 1) return;
    onChange({ blobs: layer.blobs.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-3">
      {layer.blobs.map((b, i) => (
        <div key={i} className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 items-center">
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(b.color) ? b.color : "#000000"}
            onChange={(e) => setBlob(i, { color: e.target.value })}
            className="h-9 w-12 rounded border cursor-pointer"
          />
          <Input
            value={b.color}
            onChange={(e) => setBlob(i, { color: e.target.value })}
            className="font-mono text-sm"
          />
          <NumField label="x" value={b.x} onChange={(v) => setBlob(i, { x: v })} />
          <NumField label="y" value={b.y} onChange={(v) => setBlob(i, { y: v })} />
          <NumField label="size" value={b.size} onChange={(v) => setBlob(i, { size: v })} />
          <button
            type="button"
            onClick={() => removeBlob(i)}
            disabled={layer.blobs.length <= 1}
            aria-label="Remove blob"
            className="text-muted-foreground hover:text-destructive disabled:opacity-30"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addBlob}
          disabled={layer.blobs.length >= 4}
        >
          <Plus className="h-4 w-4 mr-1" /> Add blob
        </Button>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Blur</Label>
          <Input
            type="number"
            min={0}
            max={200}
            value={layer.blobs[0]?.blur ?? 0}
            onChange={(e) => {
              const blur = Number(e.target.value);
              onChange({ blobs: layer.blobs.map((b) => ({ ...b, blur })) });
            }}
            className="w-20"
          />
        </div>
      </div>
    </div>
  );
}

function PatternLayerForm({
  layer,
  onChange,
}: {
  layer: PatternLayer;
  onChange: (patch: Partial<PatternLayer>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm">Pattern</Label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2">
          {PATTERN_LIST.map((p) => {
            const active = layer.kind === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onChange({ kind: p.id })}
                className={`rounded-lg border p-2 text-xs transition hover:border-foreground ${
                  active ? "border-foreground ring-2 ring-foreground/20" : "border-border"
                }`}
              >
                <div
                  className="h-10 rounded mb-1"
                  style={{
                    background: "#0f172a",
                    backgroundImage: layerStyle({ ...layer, kind: p.id, opacity: 1 }).backgroundImage,
                    backgroundRepeat: "repeat",
                  }}
                />
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-sm w-16">Color</Label>
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(layer.color) ? layer.color : "#000000"}
          onChange={(e) => onChange({ color: e.target.value })}
          className="h-9 w-12 rounded border cursor-pointer"
        />
        <Input
          value={layer.color}
          onChange={(e) => onChange({ color: e.target.value })}
          className="font-mono text-sm flex-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm">Scale</Label>
          <Input
            type="number"
            min={4}
            max={200}
            value={layer.scale}
            onChange={(e) => onChange({ scale: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label className="text-sm">Opacity</Label>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={layer.opacity}
            onChange={(e) => onChange({ opacity: Number(e.target.value) })}
          />
        </div>
      </div>
    </div>
  );
}

function ImageUploadButton({ onUploaded }: { onUploaded: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const res = await uploadBackgroundImage(fd);
      if (res.error) {
        alert(res.error);
        return;
      }
      if (res.url) onUploaded(res.url);
    });
    e.target.value = "";
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4 mr-1" />
        {pending ? "Uploading…" : "Image"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,image/gif"
        className="hidden"
        onChange={handle}
      />
    </>
  );
}

function ImageLayerForm({
  layer,
  onChange,
}: {
  layer: ImageLayer;
  onChange: (patch: Partial<ImageLayer>) => void;
}) {
  const blends: BackgroundBlendMode[] = ["normal", "multiply", "screen", "overlay", "soft-light", "luminosity"];
  return (
    <div className="space-y-3">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={layer.url}
          alt="Background"
          className="w-full max-h-40 object-cover rounded border"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm">Opacity</Label>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={layer.opacity}
            onChange={(e) => onChange({ opacity: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label className="text-sm">Blur (px)</Label>
          <Input
            type="number"
            min={0}
            max={60}
            value={layer.blur}
            onChange={(e) => onChange({ blur: Number(e.target.value) })}
          />
        </div>
      </div>
      <div>
        <Label className="text-sm">Fit</Label>
        <div className="flex gap-2 mt-1">
          {(["cover", "contain"] as BackgroundSize[]).map((s) => (
            <Button
              key={s}
              type="button"
              variant={layer.size === s ? "default" : "outline"}
              size="sm"
              onClick={() => onChange({ size: s })}
              className="capitalize"
            >
              {s}
            </Button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-sm">Blend mode</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {blends.map((b) => (
            <Button
              key={b}
              type="button"
              variant={layer.blend === b ? "default" : "outline"}
              size="sm"
              onClick={() => onChange({ blend: b })}
              className="capitalize"
            >
              {b}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16"
      />
    </div>
  );
}
