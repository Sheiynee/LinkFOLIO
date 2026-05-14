import type { ReactNode } from "react";
import type { Theme } from "@/lib/themes";

export function CompactRow({
  href,
  preview,
  theme,
  icon,
  title,
  trailing,
  tag,
}: {
  href: string;
  preview?: boolean;
  theme: Theme;
  icon?: ReactNode;
  title: ReactNode;
  trailing?: ReactNode;
  tag?: string;
}) {
  return (
    <a
      href={href}
      target={preview ? undefined : "_blank"}
      rel={preview ? undefined : "noopener noreferrer"}
      onClick={preview ? (e) => e.preventDefault() : undefined}
      className="flex items-center gap-2 w-full rounded-xl border px-3 py-2 transition hover:opacity-95"
      style={{
        backgroundColor: theme.button_bg,
        color: theme.button_text,
        borderColor: theme.button_border,
      }}
    >
      {icon && <div className="shrink-0">{icon}</div>}
      <span className="font-medium truncate flex-1">{title}</span>
      {trailing && (
        <span className="text-xs shrink-0" style={{ color: theme.muted_color }}>
          {trailing}
        </span>
      )}
      {tag && (
        <span className="text-[10px] uppercase tracking-wide shrink-0" style={{ color: theme.muted_color }}>
          {tag}
        </span>
      )}
    </a>
  );
}
