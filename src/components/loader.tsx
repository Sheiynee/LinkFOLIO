export function Loader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-6 bg-background">
      <div className="relative h-20 w-20">
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-500 via-fuchsia-500 to-pink-500 opacity-40 blur-xl animate-pulse" />
        <svg
          viewBox="0 0 80 80"
          className="absolute inset-0 h-20 w-20 animate-lf-orbit"
        >
          <defs>
            <linearGradient id="lf-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="50%" stopColor="#d946ef" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <circle
            cx="40"
            cy="40"
            r="32"
            fill="none"
            stroke="url(#lf-grad)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="60 140"
          />
        </svg>
        <svg
          viewBox="0 0 80 80"
          className="absolute inset-0 h-20 w-20 animate-lf-orbit"
          style={{ animationDirection: "reverse", animationDuration: "2s" }}
        >
          <circle
            cx="40"
            cy="40"
            r="22"
            fill="none"
            stroke="url(#lf-grad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="40 100"
            opacity="0.6"
          />
        </svg>
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="text-lg font-bold tracking-tight animate-lf-shimmer">
          LinkFolio
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="flex gap-0.5">
            <span
              className="h-1 w-1 rounded-full bg-foreground animate-lf-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="h-1 w-1 rounded-full bg-foreground animate-lf-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="h-1 w-1 rounded-full bg-foreground animate-lf-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </span>
        </div>
      </div>
    </div>
  );
}
