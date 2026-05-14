"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Check, ArrowRight, ArrowLeft, SkipForward } from "lucide-react";
import { ARCHETYPES, type Archetype, type ArchetypeId } from "@/lib/archetypes";
import { TYPE_PAIRINGS } from "@/lib/type-pairings";
import { fontVarFor } from "@/lib/fonts";
import {
  applyArchetypePreset,
  applyOnboardingUrls,
  applyPaletteFromSeed,
  applyTypePairing,
} from "./actions";

type Step = 1 | 2 | 3 | 4;

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [archetype, setArchetype] = useState<ArchetypeId | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [seedColor, setSeedColor] = useState<string>("#7c3aed");
  const [pairingId, setPairingId] = useState<string>("modernist");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selectedArchetype: Archetype | null = archetype
    ? ARCHETYPES.find((a) => a.id === archetype) ?? null
    : null;

  function next() {
    setError(null);
    if (step < 4) setStep((s) => (s + 1) as Step);
  }

  function back() {
    setError(null);
    if (step > 1) setStep((s) => (s - 1) as Step);
  }

  function finish() {
    router.push("/dashboard");
  }

  function handleArchetypeNext() {
    if (!archetype) {
      setError("Pick one to continue");
      return;
    }
    startTransition(async () => {
      await applyArchetypePreset(archetype);
      next();
    });
  }

  function handleUrlsNext(skip = false) {
    const hasAny = Object.values(urls).some((v) => v.trim().length > 0);
    if (!skip && !hasAny) {
      next();
      return;
    }
    if (!archetype) {
      next();
      return;
    }
    startTransition(async () => {
      if (hasAny) {
        const result = await applyOnboardingUrls({ archetype, urls });
        if ("error" in result && result.error) {
          setError(result.error);
          return;
        }
      }
      next();
    });
  }

  function handlePaletteNext(skip = false) {
    if (skip) {
      next();
      return;
    }
    startTransition(async () => {
      const result = await applyPaletteFromSeed(seedColor);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      next();
    });
  }

  function handlePairingNext(skip = false) {
    if (skip) {
      finish();
      return;
    }
    startTransition(async () => {
      const result = await applyTypePairing(pairingId);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      finish();
    });
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Progress step={step} />

      {error && (
        <div className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="mt-6 p-6 space-y-6">
        {step === 1 && (
          <Step1Archetype value={archetype} onChange={setArchetype} />
        )}
        {step === 2 && selectedArchetype && (
          <Step2Urls archetype={selectedArchetype} urls={urls} onChange={setUrls} />
        )}
        {step === 3 && (
          <Step3Palette value={seedColor} onChange={setSeedColor} />
        )}
        {step === 4 && (
          <Step4Pairing value={pairingId} onChange={setPairingId} />
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={back}
            disabled={step === 1 || pending}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>

          <div className="flex gap-2">
            {step !== 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (step === 2) handleUrlsNext(true);
                  else if (step === 3) handlePaletteNext(true);
                  else if (step === 4) handlePairingNext(true);
                }}
                disabled={pending}
              >
                <SkipForward className="h-4 w-4 mr-1" /> Skip
              </Button>
            )}

            {step === 1 && (
              <Button type="button" onClick={handleArchetypeNext} disabled={pending || !archetype}>
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 2 && (
              <Button type="button" onClick={() => handleUrlsNext(false)} disabled={pending}>
                {pending ? "Creating…" : "Add widgets"} <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 3 && (
              <Button type="button" onClick={() => handlePaletteNext(false)} disabled={pending}>
                {pending ? "Applying…" : "Apply color"} <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 4 && (
              <Button type="button" onClick={() => handlePairingNext(false)} disabled={pending}>
                {pending ? "Saving…" : "Finish"} <Check className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function Progress({ step }: { step: Step }) {
  const labels = ["Archetype", "Platforms", "Color", "Typography"];
  return (
    <div className="flex items-center gap-2">
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const active = step === n;
        const done = step > n;
        return (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div
              className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-medium border ${
                done
                  ? "bg-foreground text-background border-foreground"
                  : active
                    ? "border-foreground text-foreground"
                    : "border-border text-muted-foreground"
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : n}
            </div>
            <span
              className={`text-sm ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}
            >
              {label}
            </span>
            {i < labels.length - 1 && <div className="flex-1 h-px bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

function Step1Archetype({
  value,
  onChange,
}: {
  value: ArchetypeId | null;
  onChange: (a: ArchetypeId) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">What kind of creator are you?</h1>
        <p className="text-muted-foreground text-sm">
          We&apos;ll suggest platforms and a starting style. You can change anything later.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ARCHETYPES.map((a) => {
          const selected = value === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onChange(a.id)}
              className={`text-left rounded-xl border p-4 transition hover:border-foreground ${
                selected ? "border-foreground ring-2 ring-foreground/20" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{a.emoji}</span>
                <span className="font-semibold">{a.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{a.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Step2Urls({
  archetype,
  urls,
  onChange,
}: {
  archetype: Archetype;
  urls: Record<string, string>;
  onChange: (urls: Record<string, string>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Paste your platform links</h1>
        <p className="text-muted-foreground text-sm">
          Each one becomes a live widget on your page. Leave blank to skip a platform.
        </p>
      </div>
      <div className="space-y-3">
        {archetype.platforms.map((p) => (
          <div key={p.id} className="space-y-1">
            <Label htmlFor={p.id}>{p.label}</Label>
            <Input
              id={p.id}
              placeholder={p.placeholder}
              value={urls[p.id] ?? ""}
              onChange={(e) => onChange({ ...urls, [p.id]: e.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Step3Palette({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const swatches = ["#7c3aed", "#ec4899", "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6"];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Pick a brand color</h1>
        <p className="text-muted-foreground text-sm">
          We&apos;ll derive your background gradient, accents, and muted tones from this seed.
        </p>
      </div>

      <div className="grid grid-cols-8 gap-2">
        {swatches.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            aria-label={s}
            className={`h-10 rounded-lg border-2 transition ${
              value.toLowerCase() === s ? "border-foreground" : "border-transparent"
            }`}
            style={{ backgroundColor: s }}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 rounded border cursor-pointer"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="w-32 font-mono" />
        <PalettePreview seed={value} />
      </div>
    </div>
  );
}

function PalettePreview({ seed }: { seed: string }) {
  // Render a tiny live preview of the gradient + accent dot.
  return (
    <div
      className="flex-1 h-10 rounded-lg border flex items-center justify-end px-3"
      style={{
        background: `linear-gradient(135deg, ${darken(seed, 0.5)}, ${darken(seed, 0.7)})`,
        color: "#fff",
      }}
    >
      <div
        className="h-3 w-3 rounded-full"
        style={{ backgroundColor: seed, boxShadow: `0 0 0 3px ${seed}40` }}
      />
    </div>
  );
}

function darken(hex: string, amount: number): string {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  const r = Math.round(((v >> 16) & 255) * (1 - amount));
  const g = Math.round(((v >> 8) & 255) * (1 - amount));
  const b = Math.round((v & 255) * (1 - amount));
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function Step4Pairing({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Pick a typography style</h1>
        <p className="text-muted-foreground text-sm">
          Sets the font for your page. You can change this anytime from the theme editor.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TYPE_PAIRINGS.map((p) => {
          const selected = value === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id)}
              className={`text-left rounded-xl border p-4 transition hover:border-foreground ${
                selected ? "border-foreground ring-2 ring-foreground/20" : "border-border"
              }`}
            >
              <div
                className="text-lg font-semibold mb-1"
                style={{ fontFamily: fontVarFor(p.font) }}
              >
                {p.label}
              </div>
              <p className="text-xs text-muted-foreground">{p.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
