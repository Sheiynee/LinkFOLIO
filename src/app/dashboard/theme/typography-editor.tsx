"use client";

import { useRef, useTransition } from "react";
import { Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  buildFontOptions,
  type FontOption,
  type UserFontRecord,
} from "@/lib/typography";
import {
  TYPOGRAPHY_ROLES,
  type ThemeTypography,
  type TypographyRole,
  type TypographyRoleId,
} from "@/lib/themes";
import { uploadUserFont, deleteUserFont } from "./actions";

interface Props {
  typography: ThemeTypography;
  onChange: (next: ThemeTypography) => void;
  userFonts: UserFontRecord[];
  onUserFontsChange: (next: UserFontRecord[]) => void;
}

export function TypographyEditor({ typography, onChange, userFonts, onUserFontsChange }: Props) {
  const options = buildFontOptions(userFonts);

  function setRole(role: TypographyRoleId, partial: Partial<TypographyRole>) {
    onChange({
      ...typography,
      [role]: { ...typography[role], ...partial },
    });
  }

  return (
    <div className="space-y-6">
      <UserFontUploader
        userFonts={userFonts}
        onChange={onUserFontsChange}
        onDeleted={(id) => {
          // If any role references the deleted font, fall back to Inter.
          const next = { ...typography };
          let dirty = false;
          for (const r of TYPOGRAPHY_ROLES) {
            if (next[r].source === "user_font" && next[r].family === id) {
              next[r] = { family: "inter", source: "google" };
              dirty = true;
            }
          }
          if (dirty) onChange(next);
        }}
      />

      <div className="space-y-4">
        {TYPOGRAPHY_ROLES.map((r) => (
          <RolePicker
            key={r}
            roleId={r}
            value={typography[r]}
            options={options}
            onChange={(partial) => setRole(r, partial)}
          />
        ))}
      </div>
    </div>
  );
}

function RolePicker({
  roleId,
  value,
  options,
  onChange,
}: {
  roleId: TypographyRoleId;
  value: TypographyRole;
  options: FontOption[];
  onChange: (partial: Partial<TypographyRole>) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label className="text-sm font-medium">{ROLE_LABELS[roleId]}</Label>
        <span className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[roleId]}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {options.map((opt) => {
          const active =
            value.family === opt.id &&
            (opt.source === "user_font" ? value.source === "user_font" : value.source !== "user_font");
          const familyCss =
            opt.source === "google"
              ? opt.cssVar
              : opt.familyName
                ? `"${opt.familyName}"`
                : undefined;
          return (
            <button
              key={`${opt.source}:${opt.id}`}
              type="button"
              onClick={() =>
                onChange({
                  family: opt.id,
                  source: opt.source === "user_font" ? "user_font" : "google",
                })
              }
              className={`text-left rounded-lg border px-3 py-2 transition hover:border-foreground ${
                active ? "border-foreground ring-2 ring-foreground/20" : "border-border"
              }`}
              style={familyCss ? { fontFamily: familyCss } : undefined}
              title={opt.label}
            >
              <p className="text-sm truncate">{opt.label}</p>
              <p className="text-xs text-muted-foreground truncate">Aa Bb Cc 123</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UserFontUploader({
  userFonts,
  onChange,
  onDeleted,
}: {
  userFonts: UserFontRecord[];
  onChange: (next: UserFontRecord[]) => void;
  onDeleted: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("family_name", file.name.replace(/\.woff2?$/i, ""));
    startTransition(async () => {
      const res = await uploadUserFont(fd);
      if (res.error) {
        alert(res.error);
        return;
      }
      if (res.font) {
        onChange([...userFonts, res.font as UserFontRecord]);
      }
    });
    e.target.value = "";
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this font? Any role using it will revert to Inter.")) return;
    startTransition(async () => {
      const res = await deleteUserFont(id);
      if (res.error) {
        alert(res.error);
        return;
      }
      onChange(userFonts.filter((f) => f.id !== id));
      onDeleted(id);
    });
  }

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Your fonts</p>
          <p className="text-xs text-muted-foreground">WOFF2 only, ≤1MB. 5MB total.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
        >
          <Upload className="h-4 w-4 mr-1" />
          {pending ? "Uploading…" : "Upload"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".woff2,font/woff2"
          className="hidden"
          onChange={handleUpload}
        />
      </div>
      {userFonts.length > 0 && (
        <div className="space-y-1.5">
          {userFonts.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between rounded border bg-background px-3 py-2"
            >
              <span className="text-sm truncate">{f.family_name}</span>
              <button
                type="button"
                onClick={() => handleDelete(f.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${f.family_name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
