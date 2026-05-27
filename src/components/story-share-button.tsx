"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Instagram, X } from "lucide-react";

export function StoryShareButton({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const storyUrl = `/api/og/${username}/story`;

  function handleInstagram() {
    // Try the deep link; if the app isn't installed the URL just fails silently.
    const link = `instagram://story-share?source_application=linkfolio`;
    window.location.href = link;
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Instagram className="h-4 w-4 mr-1.5" /> Story
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
      <div
        className="bg-background border rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">Share to Instagram Story</h2>
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
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
          <a
            href={storyUrl}
            download={`${username}-story.png`}
            className="flex-1"
          >
            <Button variant="outline" size="sm" className="w-full">
              <Download className="h-4 w-4 mr-1.5" /> Download PNG
            </Button>
          </a>
          <Button size="sm" className="flex-1" onClick={handleInstagram}>
            <Instagram className="h-4 w-4 mr-1.5" /> Open Instagram
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Download the image, then share it to your Instagram Story manually if the app doesn&apos;t open automatically.
        </p>
      </div>
    </div>
  );
}
