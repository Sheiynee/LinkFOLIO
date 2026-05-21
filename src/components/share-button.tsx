"use client";

import { useState } from "react";
import { Share2, X, Copy, Check, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { qrSvg } from "@/lib/qr";

/**
 * Share entry-point — uses the native Web Share API when available
 * (mobile, modern desktop), otherwise opens a small modal with a copy
 * button and a QR code generated client-side (no third-party service).
 */
export function ShareButton({ url, label }: { url: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handle() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ url, title: "LinkFolio", text: label ?? "Check out my page" });
        return;
      } catch {
        // User canceled or share failed — fall through to the modal.
      }
    }
    setOpen(true);
  }

  async function copy() {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={handle}>
        <Share2 className="h-4 w-4 mr-1.5" />
        Share
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card border rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <QrCode className="h-4 w-4" /> Share your page
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              className="mx-auto"
              style={{ width: 220, height: 220 }}
              dangerouslySetInnerHTML={{ __html: qrSvg(url, 220) }}
            />

            <div className="flex items-center gap-2">
              <input
                readOnly
                value={url}
                className="flex-1 rounded-md border bg-muted/40 px-3 py-2 text-xs font-mono truncate"
              />
              <Button variant="outline" size="sm" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground text-center">
              Tap-and-hold the QR on mobile to save the image.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
