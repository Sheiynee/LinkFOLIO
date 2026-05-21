import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal · LinkFolio",
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold text-lg">LinkFolio</Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/legal/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/legal/privacy" className="hover:text-foreground">Privacy</Link>
          </nav>
        </div>
      </header>
      <article className="max-w-3xl mx-auto px-6 py-10 prose prose-neutral dark:prose-invert">
        {children}
      </article>
    </main>
  );
}
