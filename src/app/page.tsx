import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Link2, Palette, BarChart3, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <span className="font-bold text-xl tracking-tight">LinkFolio</span>
        <div className="flex gap-3">
          <Button variant="ghost" render={<Link href="/auth/signin" />}>
            Sign in
          </Button>
          <Button className="bg-purple-600 hover:bg-purple-700" render={<Link href="/auth/signin" />}>
            Get started free
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-6 pt-20 pb-16 max-w-4xl mx-auto">
        <Badge className="mb-6 bg-purple-900/60 text-purple-200 border-purple-700">
          Phase 1 — now live
        </Badge>
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          One link for{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
            everything
          </span>
        </h1>
        <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
          Create your personal page in minutes. Share your links, socials, and
          widgets — all at{" "}
          <span className="font-mono text-purple-300">yourapp.com/username</span>
        </p>
        <Button
          size="lg"
          className="bg-purple-600 hover:bg-purple-700 text-lg px-8 py-6"
          render={<Link href="/auth/signin" />}
        >
          Claim your page <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </section>

      {/* Features */}
      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 px-6 py-16 max-w-6xl mx-auto">
        {[
          {
            icon: Link2,
            title: "All your links",
            desc: "Add socials, projects, and any URL in seconds.",
          },
          {
            icon: Palette,
            title: "Custom themes",
            desc: "Pick colors and styles that match your vibe.",
          },
          {
            icon: Zap,
            title: "Live widgets",
            desc: "GitHub stats, Spotify, and more — all live.",
          },
          {
            icon: BarChart3,
            title: "Analytics",
            desc: "See how many people visit your page.",
          },
        ].map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition"
          >
            <Icon className="h-8 w-8 text-purple-400 mb-4" />
            <h3 className="font-semibold text-lg mb-2">{title}</h3>
            <p className="text-slate-400 text-sm">{desc}</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="text-center text-slate-500 text-sm py-8">
        Built with Next.js · Supabase · NextAuth · shadcn/ui
      </footer>
    </main>
  );
}
