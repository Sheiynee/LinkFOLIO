"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProfileRender, type ProfileRenderData } from "@/components/profile-render";
import type { WidgetData } from "@/lib/widgets/types";
import { FONTS } from "@/lib/fonts";
import {
  type Theme,
  type ButtonShape,
  type ButtonStyle,
  PRESET_LIST,
  PRESETS,
} from "@/lib/themes";
import { saveTheme, uploadBackground, clearBackground } from "./actions";
import { Check, Upload, X } from "lucide-react";

interface Props {
  initialTheme: Theme;
  profile: ProfileRenderData;
  widgetData?: Record<string, WidgetData>;
}

export function ThemeEditor({ initialTheme, profile, widgetData }: Props) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [pending, startTransition] = useTransition();
  const [uploadPending, startUpload] = useTransition();
  const [message, setMessage] = useState<{ ok?: boolean; text: string } | null>(null);

  function applyPreset(presetId: string) {
    const p = PRESETS[presetId];
    if (!p) return;
    setTheme({ ...p, bg_image_url: theme.bg_image_url ?? null });
    setMessage(null);
  }

  function update<K extends keyof Theme>(key: K, value: Theme[K]) {
    setTheme((t) => ({ ...t, [key]: value, preset: "custom" }));
    setMessage(null);
  }

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveTheme(theme);
      if (result.error) setMessage({ text: result.error });
      else setMessage({ ok: true, text: "Saved" });
    });
  }

  function handleBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setMessage(null);
    startUpload(async () => {
      const result = await uploadBackground(fd);
      if (result.error) setMessage({ text: result.error });
      else if (result.url) {
        setTheme((t) => ({ ...t, bg_image_url: result.url, preset: "custom" }));
      }
    });
    e.target.value = "";
  }

  function handleClearBg() {
    setTheme((t) => ({ ...t, bg_image_url: null }));
    startTransition(async () => {
      await clearBackground();
    });
  }

  return (
    <div className="grid lg:grid-cols-[1fr_minmax(320px,420px)] gap-6">
      <div className="space-y-6">
        <Card className="p-4">
          <Tabs defaultValue="presets">
            <TabsList className="w-full justify-start flex-wrap h-auto">
              <TabsTrigger value="presets">Presets</TabsTrigger>
              <TabsTrigger value="colors">Colors</TabsTrigger>
              <TabsTrigger value="typography">Font</TabsTrigger>
              <TabsTrigger value="buttons">Buttons</TabsTrigger>
              <TabsTrigger value="background">Background</TabsTrigger>
            </TabsList>

            <TabsContent value="presets" className="mt-4">
              <div className="grid sm:grid-cols-2 gap-3">
                {PRESET_LIST.map((p) => {
                  const active = theme.preset === p.preset;
                  return (
                    <button
                      key={p.preset}
                      type="button"
                      onClick={() => applyPreset(p.preset)}
                      className={`relative text-left rounded-xl border p-4 transition hover:border-foreground ${
                        active ? "border-foreground ring-2 ring-foreground/20" : "border-border"
                      }`}
                    >
                      <div
                        className="h-12 w-full rounded-md mb-3"
                        style={{
                          background: `linear-gradient(to bottom right, ${p.bg_from}, ${p.bg_to})`,
                        }}
                      />
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{p.label}</p>
                          <p className="text-xs text-muted-foreground">{p.description}</p>
                        </div>
                        {active && <Check className="h-4 w-4" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="colors" className="mt-4 space-y-4">
              <ColorRow label="Background — top-left" value={theme.bg_from} onChange={(v) => update("bg_from", v)} />
              <ColorRow label="Background — bottom-right" value={theme.bg_to} onChange={(v) => update("bg_to", v)} />
              <ColorRow label="Text" value={theme.text_color} onChange={(v) => update("text_color", v)} />
              <ColorRow label="Muted text" value={theme.muted_color} onChange={(v) => update("muted_color", v)} />
              <ColorRow label="Accent" value={theme.accent_color} onChange={(v) => update("accent_color", v)} />
            </TabsContent>

            <TabsContent value="typography" className="mt-4">
              <div className="grid sm:grid-cols-2 gap-2">
                {FONTS.map((f) => {
                  const active = theme.font === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => update("font", f.id)}
                      className={`text-left rounded-lg border p-3 transition hover:border-foreground ${
                        active ? "border-foreground ring-2 ring-foreground/20" : "border-border"
                      }`}
                      style={{ fontFamily: f.cssVar }}
                    >
                      <p className="text-base">{f.label}</p>
                      <p className="text-sm text-muted-foreground">The quick brown fox</p>
                    </button>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="buttons" className="mt-4 space-y-4">
              <div>
                <Label className="text-sm">Shape</Label>
                <div className="flex gap-2 mt-2">
                  {(["rounded", "pill", "square"] as ButtonShape[]).map((s) => (
                    <Button
                      key={s}
                      type="button"
                      variant={theme.button_shape === s ? "default" : "outline"}
                      size="sm"
                      onClick={() => update("button_shape", s)}
                      className="capitalize"
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm">Style</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(["glass", "solid", "outline", "shadow"] as ButtonStyle[]).map((s) => (
                    <Button
                      key={s}
                      type="button"
                      variant={theme.button_style === s ? "default" : "outline"}
                      size="sm"
                      onClick={() => update("button_style", s)}
                      className="capitalize"
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
              <ColorRow label="Button background" value={theme.button_bg} onChange={(v) => update("button_bg", v)} allowAny />
              <ColorRow label="Button text" value={theme.button_text} onChange={(v) => update("button_text", v)} />
              <ColorRow label="Button border" value={theme.button_border} onChange={(v) => update("button_border", v)} allowAny />
            </TabsContent>

            <TabsContent value="background" className="mt-4 space-y-4">
              <div>
                <Label className="text-sm">Image or GIF (optional)</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  Layered behind the gradient. Up to 5MB.
                </p>
                {theme.bg_image_url ? (
                  <div className="space-y-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={theme.bg_image_url}
                      alt="Background"
                      className="w-full max-h-48 object-cover rounded-lg border"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={handleClearBg}>
                      <X className="h-4 w-4 mr-1" /> Remove
                    </Button>
                  </div>
                ) : (
                  <Label
                    htmlFor="bg-upload"
                    className="cursor-pointer flex items-center justify-center gap-2 h-24 border-2 border-dashed rounded-lg text-sm text-muted-foreground hover:border-foreground hover:text-foreground"
                  >
                    <Upload className="h-4 w-4" />
                    {uploadPending ? "Uploading..." : "Upload image or GIF"}
                    <input
                      id="bg-upload"
                      type="file"
                      accept="image/*,image/gif"
                      className="hidden"
                      onChange={handleBgUpload}
                      disabled={uploadPending}
                    />
                  </Label>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={pending}>
            {pending ? "Saving..." : "Save theme"}
          </Button>
          {message && (
            <span className={message.ok ? "text-sm text-green-600" : "text-sm text-destructive"}>
              {message.text}
            </span>
          )}
        </div>
      </div>

      <div className="lg:sticky lg:top-4 self-start">
        <Card className="overflow-hidden">
          <div className="bg-muted px-4 py-2 text-xs font-mono text-muted-foreground border-b">
            Preview · /{profile.username}
          </div>
          <div className="h-[640px] overflow-y-auto">
            <ProfileRender profile={profile} theme={theme} preview widgetData={widgetData} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
  allowAny,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  allowAny?: boolean;
}) {
  const isHex = /^#[0-9a-f]{6}$/i.test(value);
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={isHex ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 rounded border border-border bg-transparent cursor-pointer"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={allowAny ? "#000000 or rgba(...)" : "#000000"}
          className="flex-1 font-mono text-sm"
        />
      </div>
    </div>
  );
}
