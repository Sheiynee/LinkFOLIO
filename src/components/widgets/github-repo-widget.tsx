import type { GitHubRepoData } from "@/lib/widgets/types";
import type { Theme } from "@/lib/themes";

export function GitHubRepoWidget({
  data,
  fallbackUrl,
  theme,
  preview = false,
}: {
  data: GitHubRepoData | null;
  fallbackUrl: string;
  theme: Theme;
  preview?: boolean;
}) {
  const href = preview ? "#" : data?.html_url ?? fallbackUrl;

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
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          {data?.owner.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.owner.avatar_url}
              alt={data.owner.login}
              className="h-6 w-6 rounded-full shrink-0"
            />
          ) : null}
          <span className="font-semibold truncate">
            {data?.full_name ?? "GitHub repo"}
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded font-mono shrink-0 ml-auto"
            style={{
              backgroundColor: theme.button_bg,
              color: theme.muted_color,
              border: `1px solid ${theme.button_border}`,
            }}
          >
            github
          </span>
        </div>
        {data?.description && (
          <p className="text-sm line-clamp-2" style={{ color: theme.muted_color }}>
            {data.description}
          </p>
        )}
        {data && (
          <div className="flex items-center gap-3 text-xs" style={{ color: theme.muted_color }}>
            <span>★ {formatCount(data.stargazers_count)}</span>
            <span>⑂ {formatCount(data.forks_count)}</span>
            {data.language && <span>● {data.language}</span>}
          </div>
        )}
      </div>
    </a>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
