export const dynamic = "force-static";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Radio,
  Layers,
  Sparkles,
  Twitch,
  Youtube,
  Github,
  Music,
  Gamepad2,
  Palette,
  LayoutGrid,
  MousePointerClick,
  Shapes,
  Image as ImageIcon,
  Type,
  Wand2,
  ShieldCheck,
} from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[800px]"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(124,58,237,0.35) 0%, rgba(15,23,42,0) 60%)",
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <span className="font-bold text-xl tracking-tight">LinkFolio</span>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/legal/terms"
            className="hidden sm:inline text-sm text-slate-400 hover:text-white"
          >
            Terms
          </Link>
          <Link
            href="/legal/privacy"
            className="hidden sm:inline text-sm text-slate-400 hover:text-white"
          >
            Privacy
          </Link>
          <Button variant="ghost" className="text-slate-200 hover:text-white" render={<Link href="/auth/signin" />}>
            Sign in
          </Button>
          <Button className="bg-purple-600 hover:bg-purple-500" render={<Link href="/auth/signin" />}>
            Get started
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-6 pt-16 pb-24 max-w-5xl mx-auto text-center">
        <p className="inline-flex items-center gap-2 mb-7 text-xs uppercase tracking-[0.2em] text-purple-300/90">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
          A live page for creators
        </p>
        <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight">
          One page for{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-purple-400 to-sky-400">
            everywhere you stream,
          </span>
          <br className="hidden sm:block" />
          post, and publish.
        </h1>
        <p className="mt-7 text-lg md:text-xl text-slate-300 max-w-2xl mx-auto">
          LinkFolio aggregates your Twitch, YouTube, TikTok, Spotify, and GitHub
          into one expressive page. Live data — not a static list of links.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            size="lg"
            className="bg-purple-600 hover:bg-purple-500 text-base px-7 py-6"
            render={<Link href="/auth/signin" />}
          >
            Claim your page <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <span className="text-sm text-slate-400">
            Free. Sign in with Google or GitHub.
          </span>
        </div>

        {/* Platform glyphs */}
        <div className="mt-14 flex items-center justify-center gap-7 text-slate-500">
          {[Twitch, Youtube, Music, Github, Gamepad2].map((Icon, i) => (
            <Icon key={i} className="h-5 w-5" strokeWidth={1.5} />
          ))}
        </div>
      </section>

      {/* Three pillars */}
      <section className="px-6 pb-24 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              icon: Radio,
              title: "Live, not static",
              desc: "Pulsing 'live now' badges when you're streaming. Latest VOD, freshest upload, currently playing — refreshed server-side on every visit.",
            },
            {
              icon: Layers,
              title: "Cross-platform hub",
              desc: "Twitch, YouTube, TikTok, Spotify, GitHub, Discord, Ko-fi — twelve live widget kinds. One identity, instead of a scattered link tree.",
            },
            {
              icon: Sparkles,
              title: "Genuinely different",
              desc: "Free-form canvas, animated backgrounds, custom fonts, shape + sticker library, per-section regions. Your page won't look like every other page.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-7"
            >
              <div className="h-10 w-10 rounded-lg bg-purple-500/15 text-purple-300 flex items-center justify-center mb-5">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="relative px-6 py-24 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Built for creators who&apos;ve outgrown the link tree
          </h2>
          <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
            Everything you need to ship a page that feels like you, in under 90 seconds.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: LayoutGrid,
              title: "Stack OR canvas",
              desc: "Start with a clean column layout. Switch to free-positioned canvas when you outgrow it — same data, totally different feel.",
            },
            {
              icon: MousePointerClick,
              title: "Drag, resize, rotate",
              desc: "Snap-to-grid, alignment guides, multi-select, marquee, undo/redo, copy/paste across tabs. A real editor, not a list of inputs.",
            },
            {
              icon: Wand2,
              title: "Magic arrange",
              desc: "One click — grid, asymmetric, or hero-led. Resets your page into a composition you'd actually publish.",
            },
            {
              icon: Palette,
              title: "Backgrounds with depth",
              desc: "Gradient, mesh, pattern, image, animated drift/noise/particles, looped video. Layer them, blend them, scope them to a region.",
            },
            {
              icon: Type,
              title: "Typography pairings",
              desc: "Twelve curated pairings + 8 Google fonts + your own WOFF2 upload. Five role slots so display, heading, body, UI, and mono each get their own treatment.",
            },
            {
              icon: Shapes,
              title: "Shapes + stickers",
              desc: "Rect, circle, blob, triangle plus 24 curated sticker glyphs. Drop one anywhere on the canvas and tune the color inline.",
            },
            {
              icon: ImageIcon,
              title: "Image masks",
              desc: "Upload PNG, JPG, GIF, or WebP. Mask to circle, rounded, blob, hexagon, or triangle. Magic-byte validated — no spoofed extensions get through.",
            },
            {
              icon: ShieldCheck,
              title: "Built for launch day",
              desc: "Rate-limited redirects, sanitized inputs, reserved usernames, 30-day account deletion grace, GDPR export, audit log. Public-ready out of the box.",
            },
            {
              icon: Sparkles,
              title: "Live widgets",
              desc: "Twitch live + VOD, YouTube channel/video/live, GitHub repo/user, Discord, Spotify, TikTok, Ko-fi / Buy Me a Coffee, generic link cards. Fetched server-side, refreshed on focus.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-6 hover:border-purple-500/30 hover:bg-white/[0.04] transition"
            >
              <Icon className="h-5 w-5 text-purple-300 mb-3" strokeWidth={1.75} />
              <h3 className="font-semibold mb-1.5">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section className="px-6 py-24 max-w-6xl mx-auto border-t border-white/5">
        <div className="text-center mb-14">
          <p className="text-xs uppercase tracking-[0.2em] text-purple-300/90 mb-3">
            Made for
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Streamers. YouTubers. Musicians. Indie devs.
          </h2>
        </div>
        <div className="grid md:grid-cols-4 gap-4 text-center">
          {[
            { label: "Twitch streamers", line: "Live badge + viewer count" },
            { label: "Video creators", line: "Latest upload + subscriber count" },
            { label: "Musicians", line: "Spotify embeds + tip jar" },
            { label: "Indie devs", line: "GitHub stars + project link cards" },
          ].map((row) => (
            <div key={row.label} className="rounded-xl border border-white/10 bg-white/[0.02] py-7 px-4">
              <div className="font-semibold">{row.label}</div>
              <div className="text-xs text-slate-400 mt-1.5">{row.line}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-28 max-w-4xl mx-auto text-center">
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
          Your page should look like{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-sky-400">
            you
          </span>
          .
        </h2>
        <p className="text-lg text-slate-300 mb-9 max-w-xl mx-auto">
          Not a template. Not a list. A live page that reflects what you&apos;re
          actually doing right now.
        </p>
        <Button
          size="lg"
          className="bg-purple-600 hover:bg-purple-500 text-base px-8 py-6"
          render={<Link href="/auth/signin" />}
        >
          Get started — it&apos;s free <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-10 text-sm text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>© {new Date().getFullYear()} LinkFolio</span>
          <div className="flex items-center gap-6">
            <Link href="/legal/terms" className="hover:text-white">Terms</Link>
            <Link href="/legal/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/auth/signin" className="hover:text-white">Sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
