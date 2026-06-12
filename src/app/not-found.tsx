import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center p-6 text-white">
      <div className="text-center space-y-4 max-w-sm">
        <p className="text-6xl font-bold tracking-tight">404</p>
        <h1 className="text-xl font-semibold">This page doesn&apos;t exist</h1>
        <p className="text-sm text-slate-400">
          The link may be wrong, or the creator may have changed their username.
        </p>
        <Link
          href="/"
          className="inline-flex h-9 items-center rounded-md bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-100"
        >
          Go to LinkFolio
        </Link>
      </div>
    </main>
  );
}
