"use client";

import { useEffect, useState } from "react";

const RELATIVE_INTERVAL_MS = 30 * 1000;

export function UpdatedAgo({
  fetchedAt,
  color,
}: {
  fetchedAt: string;
  color: string;
}) {
  const [label, setLabel] = useState(() => formatRelative(fetchedAt));

  useEffect(() => {
    const tick = () => setLabel(formatRelative(fetchedAt));
    tick();
    const id = setInterval(tick, RELATIVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchedAt]);

  return (
    <span className="text-[10px] tabular-nums" style={{ color }}>
      {label}
    </span>
  );
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diffMs = Date.now() - t;
  if (diffMs < 30 * 1000) return "just now";
  if (diffMs < 60 * 1000) return "<1m ago";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
