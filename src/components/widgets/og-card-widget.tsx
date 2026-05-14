import type { OgCardData } from "@/lib/widgets/types";
import type { Theme } from "@/lib/themes";

export function OgCardWidget({
  data,
  fallbackUrl,
  theme,
  preview = false,
}: {
  data: OgCardData | null;
  fallbackUrl: string;
  theme: Theme;
  preview?: boolean;
}) {
  const href = preview ? "#" : data?.url ?? fallbackUrl;
  let host = "";
  try {
    host = new URL(data?.url ?? fallbackUrl).hostname.replace(/^www\./, "");
  } catch {
    host = data?.site_name ?? "";
  }

  return (
    <a
      href={href}
      target={preview ? undefined : "_blank"}
      rel={preview ? undefined : "noopener noreferrer"}
      onClick={preview ? (e) => e.preventDefault() : undefined}
      className="block w-full rounded-2xl border overflow-hidden transition hover:opacity-95"
      style={{
        backgroundColor: theme.button_bg,
        color: theme.button_text,
        borderColor: theme.button_border,
      }}
    >
      {data?.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.image_url}
          alt={data.title ?? host}
          className="w-full aspect-[1200/630] object-cover"
        />
      )}
      <div className="p-3 space-y-1">
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-1.5 py-0.5 rounded font-mono shrink-0"
            style={{
              backgroundColor: theme.button_bg,
              color: theme.muted_color,
              border: `1px solid ${theme.button_border}`,
            }}
          >
            {data?.site_name ?? host ?? "link"}
          </span>
        </div>
        <p className="text-sm font-medium line-clamp-2" style={{ color: theme.text_color }}>
          {data?.title ?? host ?? "External link"}
        </p>
        {data?.description && (
          <p className="text-xs line-clamp-2" style={{ color: theme.muted_color }}>
            {data.description}
          </p>
        )}
      </div>
    </a>
  );
}
