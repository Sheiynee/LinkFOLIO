import type { GitHubUserData } from "@/lib/widgets/types";
import type { Theme } from "@/lib/themes";

export function GitHubUserWidget({
  data,
  fallbackUrl,
  theme,
  preview = false,
}: {
  data: GitHubUserData | null;
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
      <div className="flex items-center gap-3 p-3">
        {data?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.avatar_url}
            alt={data.login}
            className="h-12 w-12 rounded-full object-cover shrink-0"
          />
        ) : (
          <div
            className="h-12 w-12 rounded-full shrink-0"
            style={{ backgroundColor: theme.muted_color, opacity: 0.3 }}
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold truncate">
              {data?.name ?? data?.login ?? "GitHub user"}
            </span>
            <span
              className="text-xs px-1.5 py-0.5 rounded font-mono shrink-0"
              style={{
                backgroundColor: theme.button_bg,
                color: theme.muted_color,
                border: `1px solid ${theme.button_border}`,
              }}
            >
              github
            </span>
          </div>
          {data?.bio ? (
            <p className="text-xs truncate" style={{ color: theme.muted_color }}>
              {data.bio}
            </p>
          ) : null}
          {data && (
            <p className="text-xs" style={{ color: theme.muted_color }}>
              {formatCount(data.followers)} followers · {formatCount(data.public_repos)} repos
            </p>
          )}
        </div>
      </div>
    </a>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
