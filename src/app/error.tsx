"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary — without it, an exception on a public creator
 * page surfaces Next.js's raw error screen to visitors.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center p-6 text-white">
      <div className="text-center space-y-4 max-w-sm">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-slate-400">
          A temporary glitch on our side. Trying again usually fixes it.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset} className="bg-white text-slate-900 hover:bg-slate-100">
            Try again
          </Button>
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-md border border-white/20 px-4 text-sm font-medium hover:bg-white/10"
          >
            Home
          </Link>
        </div>
        {error.digest && (
          <p className="text-[10px] font-mono text-slate-500">ref: {error.digest}</p>
        )}
      </div>
    </main>
  );
}
