"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const REFRESH_AFTER_MS = 30 * 1000;

export function RevalidateOnFocus() {
  const router = useRouter();
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (document.visibilityState === "visible") {
        const hiddenAt = hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (hiddenAt && Date.now() - hiddenAt > REFRESH_AFTER_MS) {
          router.refresh();
        }
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [router]);

  return null;
}
