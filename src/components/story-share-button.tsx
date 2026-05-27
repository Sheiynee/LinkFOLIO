"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Download, Instagram, Loader2, X } from "lucide-react";

export function StoryShareButton({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [downloading, startDownload] = useTransition();
  const storyUrl = `/api/og/${username}/story`;

  function handleDownload() {
    startDownload(async () => {
      try {
        const res = await fetch(storyUrl);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${username}-story.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        window.open(storyUrl, "_blank");
      }
    });
  }

  function handleInstagram() {
    // Deep link to Instagram app — works on mobile; falls back silently on desktop.
    window.location.href = "instagram://";
    // Give the app a moment to open, then do nothing (no fallback needed — user has the image to share manually).
    setTimeout(() => {}, 1500);
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Instagram className="h-4 w-4 mr-1.5" /> Story
      </Button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-background border rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">Share to Instagram Story</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preview */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={storyUrl}
          alt="Story preview"
          className="w-full rounded-xl border object-contain"
          style={{ maxHeight: 320 }}
        />

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1.5" />
            )}
            Download PNG
          </Button>
          <Button size="sm" className="flex-1" onClick={handleInstagram}>
            <Instagram className="h-4 w-4 mr-1.5" /> Open Instagram
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Download the image then share it to your Story manually if the app doesn&apos;t open automatically.
        </p>
      </div>
    </div>
  );
}
