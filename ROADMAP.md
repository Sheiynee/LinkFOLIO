# LinkFolio — Status & Roadmap

**A live page builder for creators — a single hub for everywhere you stream, post, and publish.**

LinkFolio aggregates a creator's identity across Twitch, YouTube, TikTok, Spotify, and more into one expressive, themeable page. Live data is first-class: viewers see when streamers are live, what's currently playing, the latest upload — not a static list of links.

Stack: **Next.js 14 · NextAuth v5 · Supabase · shadcn/ui · Tailwind**. Hosted on **Vercel**.

---

## Product pillars

Every feature should serve at least one:

1. **Live, not static.** The page reflects current state across platforms in near real-time.
2. **Cross-platform aggregation.** One canonical hub for a creator's scattered identities.
3. **Genuinely different visually.** Typography, backgrounds, and canvas freedom let pages look like the creator's brand, not a template.

Target users, in order: Twitch streamers → YouTubers / video creators → musicians → TikTok-native creators → indie devs / visual artists.

---

## ✅ Built

### Auth & accounts
- Google + GitHub OAuth via NextAuth v5 with Supabase adapter
- JWT session strategy (edge-safe middleware)
- Auto-profile creation on first sign-in (SQL trigger)
- Auto-link on first sign-in (Google → `mailto:`, GitHub → profile URL)
- 30-day session cookie

### Profile
- Username (live availability check, debounced)
- Display name, bio
- Avatar upload to Supabase Storage (`avatars` bucket, ≤2MB)

### Public page (`/{username}`)
- Theme-aware rendering
- 404 for unknown usernames
- Bot-filtered analytics
- Always fresh (force-dynamic)

### Content blocks
- 4 types: **link · text · heading · divider**
- Drag-to-reorder (`@dnd-kit`)
- Per-block visibility toggle
- Inline editing
- Type-aware add forms

### Theming (v1 — global theme)
- 6 inspired presets: Apple Glass · Neobrutal · Vercel Mono · Sunset Press · Notion Paper · Linear Neon
- Full custom mode (gradient, text, muted, accent colors; button shape × style matrix)
- 8 Google Fonts
- Background image/GIF upload (`backgrounds` bucket, ≤5MB)
- Live preview pane next to the editor
- Stored as `jsonb` in `profiles.theme`

### Analytics
- Page views written from `/{username}` SSR
- Click tracking via `/r/{block_id}` redirect endpoint
- Bot user-agent filter (Googlebot, Slackbot, etc.)
- Dashboard stat cards (total views, total clicks)

### Dashboard
- Onboarding checklist
- Profile / Content / Theme summary cards
- Dark/light mode toggle (`next-themes`)
- Branded loader on every route transition

### Infrastructure
- All SQL migrations in `supabase/*.sql` (00–06)
- Server actions for every mutation
- `revalidatePath` wired so dashboard + public page stay in sync

---

## 🚧 Phase 1 — Creator widget foundation (current)

> *The headline feature. Without rich live widgets, we are a Linktree clone with better theming.*

New block kind `widget` with sub-kinds. `meta jsonb` holds widget config. Server-side data fetch with smart caching so public pages stay snappy and accurate.

### Widget catalogue

#### Tier 1 — public APIs / embeds, ship in this phase
| Kind | Source | Auth | Liveness |
|---|---|---|---|
| **Twitch live status** | Helix API | App-level (client_id + secret) | Live now / offline + game + viewer count |
| **Twitch latest VOD** | Helix API | App-level | Static |
| **YouTube latest video** | YouTube Data API v3 | API key | Static (5 min cache) |
| **YouTube channel stats** | YouTube Data API v3 | API key | Subscribers + view count |
| **YouTube live status** | YouTube Data API v3 | API key | Live now badge |
| **Spotify track / album** | Spotify embed iframe | none | Static |
| **Spotify artist top tracks** | Embed | none | Static |
| **TikTok latest video** | oEmbed / embed iframe | none | Static |
| **GitHub repo card** | `api.github.com/repos/{o}/{r}` | optional token | Static |
| **GitHub profile** | `api.github.com/users/{u}` | optional token | Static |
| **Discord server invite** | Widget API | none | Member count + online |
| **Tip jar — Ko-fi** | Branded deep link | none | Static |
| **Tip jar — Buy Me a Coffee** | Branded deep link | none | Static |
| **Tip jar — Patreon** | Branded deep link | none | Static |
| **Streamlabs tip button** | Deep link | none | Static |
| **Generic OG card** | OG metadata scrape | none | Static |

#### Tier 2 — deferred to Phase 6 (needs OAuth or evolving APIs)
- Spotify "now playing" (per-user OAuth + token refresh)
- Steam profile (recently played, achievements)
- Last.fm scrobbles
- Strava recent activities
- Letterboxd recent reviews
- Twitter/X embeds (when API stabilizes)
- Kick live status (API still maturing)
- Instagram latest post (API limitations)

### Live-data freshness system

A real subsystem, not a per-widget afterthought.

- **Server cache**: `fetch` with `next: { revalidate: <seconds> }`. 30s for live status, 5 min for static metadata, 1 hour for profile data.
- **Client revalidation on tab focus**: lightweight client wrapper that calls a server action when the tab becomes visible after >30s.
- **Visible state**: pulsing "LIVE" badge, recent timestamp footer, "updated 2 min ago" indicator. Static-looking widgets feel broken.
- **Twitch EventSub**: subscribe to `stream.online` / `stream.offline` events for known streamers. Webhook updates a `creator_live_status` table; pages read from it. Removes polling cost at scale.
- **Smart polling**: only poll for creators whose pages were viewed in the last 5 minutes.
- **Graceful degradation**: API down → show last known state with subtle "last seen" note. Never render a broken widget.

### Themeable widget rendering

Every widget must inherit the page's palette and typography. A Twitch widget rendered with Twitch purple on a creator's pastel-themed page kills the brand. Specifically:

- Widgets receive theme tokens via CSS variables, not hardcoded colors.
- Brand identity preserved through icon + small accent dot, not full background color.
- Multiple size variants per widget (1×1 small, 2×1 wide, 2×2 large) with consistent visual weight at each size.

### Auto-detect on URL paste
Paste a URL → app figures out which widget kind:
- `twitch.tv/{user}` → Twitch live status
- `youtube.com/@{handle}` or `/channel/{id}` → YouTube channel
- `youtube.com/watch?v=...` → YouTube video
- `tiktok.com/@{user}/video/{id}` → TikTok video
- `tiktok.com/@{user}` → TikTok profile
- `open.spotify.com/...` → Spotify embed
- `github.com/{u}/{r}` → GitHub repo; `github.com/{u}` → GitHub profile
- `discord.gg/{code}` → Discord server invite
- `ko-fi.com/{user}` / `buymeacoffee.com/{user}` / `patreon.com/{user}` → tip jar
- anything else → generic OG card

---

## 🟡 Phase 2 — Onboarding that delivers the "easy" promise

The product fails if a non-tech-literate creator can't build a populated, branded page in under 90 seconds.

### First-run flow
1. Pick creator archetype (Streamer · YouTuber · Musician · Podcaster · Visual Artist · Game Dev · Other)
2. Paste your platform URLs (one input per major platform — Twitch, YouTube, TikTok, Spotify, Discord, Patreon)
3. App auto-creates widgets pre-populated from those URLs
4. Pick a brand color → palette generated
5. Pick a type pairing → typography set
6. Land on dashboard with a populated page already shareable

### Creator-archetype starting points
6–8 starting points, each a fully laid-out canvas with the right widgets pre-placed and placeholder content matching the archetype's vibe.

| Archetype | Default widgets | Default vibe |
|---|---|---|
| Streamer | Twitch live, latest VOD, Discord, schedule, tip jar | Energetic, dark, neon accents |
| YouTuber | Latest video, channel stats, subscribe CTA, latest short | Clean, video-thumbnail-led |
| Musician | Spotify embed, latest release, tour dates, YouTube music video | Editorial, image-led |
| Podcaster | Latest episode embed, Apple/Spotify/Overcast links, RSS, Patreon | Type-led, minimal |
| Visual Artist | Image grid, Instagram link, prints store link, commission CTA | Gallery, generous whitespace |
| Game Dev | Latest devlog, GitHub repo, itch.io / Steam link, Discord | Tech, monospace accents |

### Palette-from-seed
Pick one brand color → app generates: text, muted, accent, hover, background gradient stops. User can override individual values; most won't.

### Type pairings library
12 curated pairings (Display + Heading + Body + UI + Mono). One click sets all five roles. Custom override available but hidden by default.

Examples: Editorial · Brutalist · Soft · Tech · Magazine · Handwritten · Modernist · Y2K · Serif Classic · Display Wide · Mono Forward · Playful.

---

## 🟠 Phase 3 — Make it look genuinely different

Visual depth is the moat against Linktree and the parity feature against Bento. Pages on LinkFolio should be unmistakably *not templates*.

### Typography subsystem (replaces flat font picker)

Schema change:
```
theme.typography = {
  display: { family, weight, size, lineHeight, letterSpacing, source },
  heading: { ... },
  body:    { ... },
  ui:      { ... },
  mono:    { ... }
}
```
`source` is one of: `'google' | 'curated' | 'user_font'`.

#### Custom font upload
- New `fonts` storage bucket (woff2 only, ≤1MB).
- `user_fonts(user_id, family_name, weight, style, url, created_at)` table.
- Magic-byte validation (`wOF2` signature).
- Inject `@font-face` declarations in public page `<head>`.
- Per-user storage cap.

#### Per-role assignment
Each role can reference a Google Font, a curated font, or a `user_fonts.id`.

#### Per-element override
On any canvas element, `meta.typography?: Partial<TypographyRole>` overrides the role default. The escape hatch — "this one heading uses a different font."

### Backgrounds subsystem (replaces single-image background)

Schema change:
```
theme.background = {
  layers: [
    { type: 'gradient', stops: [{color, position}], angle },
    { type: 'mesh', blobs: [{x, y, color, size, blur}] },
    { type: 'image', url, blur, opacity, blend, position },
    { type: 'pattern', kind: 'dots', color, scale, opacity },
    { type: 'noise', intensity },
    { type: 'video', url, poster }   // Phase 5
  ]
}
```
Layers stack in z-order. Each is independently editable, toggleable, reorderable.

#### Ship in Phase 3
- Multi-stop gradients (3–5 stops, custom angle)
- Mesh gradients (2–3 absolutely-positioned blurred radial gradients)
- Pattern library: dot grid, lines, grid paper, topographic, isometric, hexagons (~10 SVG patterns)
- Image layer with blur, opacity, blend mode, color tint, position
- Layered composition (image + gradient overlay + pattern simultaneously)

#### Defer to Phase 5
- Animated backgrounds (subtle drift, particle field, animated noise) with `prefers-reduced-motion` respect
- Video backgrounds (mp4/webm loop, ≤10MB, muted autoplay, poster fallback)
- Per-section backgrounds (requires canvas)

---

## 🟣 Phase 4 — Canvas editor

The stacked-column layout is the ceiling. Pages built with column layouts feel templated no matter how they're themed. To deliver the "genuinely different" pillar, the editor must give up the column.

### Element model
Replace ordered blocks with positioned elements:
```
elements(
  id, profile_id, type, x, y, w, h,
  rotation, z, locked, hidden,
  meta jsonb,
  mobile_x, mobile_y, mobile_w, mobile_h  // optional manual overrides
)
```

### Phase 4a — Canvas MVP (3–4 weeks)
- Drag, drop, resize handles, rotation handle
- Snap-to-grid (invisible, configurable density)
- Smart alignment guides when dragging near other elements
- Selection model: click, shift-click multi-select, marquee select
- Group operations: align, distribute, equalize spacing
- Keyboard nudge (arrow = 1px, shift+arrow = 10px)
- Undo/redo stack (mandatory — users will rage-quit without it)
- Copy/paste within page

### Phase 4b — Mobile reflow (1–2 weeks)
- Auto-reflow algorithm: sort by y → stack vertically with proportional widths
- Manual override mode: edit mobile separately when auto isn't right
- Live preview toggle desktop ↔ mobile

### Phase 4c — Element library expansion (2 weeks)
Beyond text/image/widget, add:
- Shapes (rect, circle, blob)
- Visual dividers (lines, ornamental)
- Sticker / decoration set
- Image with crop/mask (circle, blob, polygon)
- Button (replaces link block — same data, canvas-positioned)
- Per-section background (regions of the canvas with their own background layers)

### Phase 4d — Smart assist (2 weeks)
- "Magic arrange" — heuristic that aligns selected elements and equalizes spacing
- "Suggest layout" — given N elements, propose 3 arrangements (grid, asymmetric, hero-led)
- AI copy assist for bio / headings (Claude API)
- AI layout assist (optional, evaluate after MVP)

---

## 🔒 Phase 5 — Hardening + launch

All operational and compliance work that must land before public launch, regardless of feature scope.

### Security
- **Rate limiting** (Upstash Redis): `/r/{id}` 60/min/IP, uploads 10/min/user, auth callbacks 20/min/IP
- **CSRF tokens** on every server action
- **File magic-byte validation** — verify signatures, not MIME
- **URL allow/block list** — deny `localhost`, RFC1918, `file:`, `javascript:`, `data:`, known malware patterns
- **Reserved usernames** — `admin api auth dashboard r about login signup …`
- **Storage quotas** per user (50MB default; trigger-maintained)
- **Input sanitization** — strip control chars, NFKC normalize
- **Audit log** — security-relevant events with IP/UA

### Performance
- `next/image` for avatars, backgrounds, image elements
- Edge runtime for `/r/{id}`
- Materialized views for analytics (`mv_block_clicks_daily`, `mv_page_views_daily`, refreshed every 5 min via `pg_cron`)
- Preconnect to Supabase domain
- Static landing page (`force-static`)
- Bundle analysis + lucide tree-shake

### Sharing & SEO
- **Auto-generated OG images per profile** via `@vercel/og` — pulls avatar, handle, bio, brand palette, typography. Critical because creators share their LinkFolio link constantly. Live-now badge if streamer is live at share time.
- Twitter card meta tags
- QR code modal for the public URL
- Native Web Share API button
- Robots.txt + sitemap (opt-in)

### Animated backgrounds + video backgrounds
Deferred from Phase 3, ships here.

### Compliance
- Terms of Service
- Privacy Policy
- Account deletion + 30-day grace period
- Data export (JSON dump)

---

## 📈 Phase 6 — Growth & retention (post-launch)

### Tier 2/3 widgets
- Spotify "now playing" (per-user OAuth + token refresh)
- Steam profile, Last.fm, Strava, Letterboxd
- Kick live status (when API matures)
- Twitter/X embed (when API stabilizes)

### Creator analytics depth
- `/dashboard/analytics` with charts (recharts)
- Time-range filter (today / week / month / all)
- Top referrers (which platform drives most traffic)
- Top countries
- Per-widget click breakdown
- **Peak traffic correlated with stream schedule** — creator-specific insight Linktree doesn't offer
- **Cross-platform reach aggregation** — combined followers/subs across all linked platforms, shown to the creator
- CSV export

### Live-now follow notifications
- Email opt-in: viewers can subscribe to a creator's "live alerts"
- When EventSub fires `stream.online`, batch-send notifications
- Web push later (PWA)

### Stream schedule widget
- Manual schedule entry → ICS feed export → calendar subscription
- Eventually pull from Twitch's schedule API
- Timezone-aware

### Cross-promotion blocks
- "Also on TikTok," "Subscribe on YouTube," "Follow on Spotify" as themed CTAs (not generic links — branded, animated, contextual)

### Account
- Change email (signed token verification)
- Link additional OAuth providers
- 2FA / passkeys (WebAuthn)
- Email digest opt-in (weekly stats)

### Verified creator badge
- Manual review or paid
- Visible checkmark on public page

---

## 🌐 Phase 7 — Scale & expansion (later)

### Custom domains
- Add domain → store in `domains(host, user_id, verified)`
- TXT record verification
- Vercel API integration for cert provisioning
- Middleware host-based routing

### Style-from-page
- Copy another user's visual language (typography + palette + background composition) to your own
- Requires explicit consent toggle from the source user
- Becomes a discovery flywheel: popular pages spread their aesthetic

### Asset library
- User uploads images once, reuses across canvas

### Component groups
- Save a layout chunk (e.g., "my socials cluster") and reuse across pages or accounts

### Multi-page profiles
- `/yourname/blog`, `/yourname/projects`
- Only if creators ask — most identity hubs are one strong page

### Native apps (Expo)
- iOS/Android editor + push notifications for live alerts

### Public API + webhooks
- Third-party integrations
- HMAC-signed webhook delivery via Upstash QStash

### i18n
- Spanish, French, Japanese, Portuguese (creator-heavy locales)

---

## 💰 Monetization (only when product earns it)

Pro tier candidates:
- Custom domains
- Advanced analytics (cross-platform reach, peak-time insights, retention cohorts)
- Larger storage cap
- Premium themes / pairings / patterns
- Custom font upload limit raised
- "Powered by LinkFolio" branding removable
- Priority widget refresh (10s instead of 60s)

Stack: Stripe Checkout + Customer Portal, webhooks → `subscriptions` table, `entitlements.ts` gates.

**Not** building creator-side commerce (digital store, products). Tip jars are deep links, not a payment system. Beacons can have that lane.

---

## 🚫 Explicitly out of scope

These come up often. Saying no is part of the strategy.

- **Linktree-style email capture forms tied to mailing list integrations.** Adjacent product, distracts from visibility focus.
- **Full website builder (multi-page CMS, blog hosting).** That's Webflow / Framer. We are an identity hub.
- **Embeddable widget (iframe of someone else's LinkFolio).** Doesn't serve creator audience.
- **Public discovery directory.** Unique-output is the discovery mechanism. Re-evaluate only if growth stalls.
- **Twitter-shaped feed of all your activity.** Tempting; would balloon scope. Phase 7+ at earliest.

---

## 🧹 Tech debt

- `src/app/auth/signin/page.tsx` — replace with branded signin once design system stabilizes
- `src/lib/supabase/server.ts` and `client.ts` — referenced but unused. Remove or repurpose for RLS-aware reads.
- `src/components/ui/tabs.tsx` — `!flex-col` override is a band-aid; fix the base-ui variant + Tailwind config mismatch
- README is still create-next-app default — needs LinkFolio setup instructions
- Old `links` table — already dropped manually; clean up references in old SQL files
- Mixed line endings (CRLF warnings) — add `.gitattributes`

---

## 🗂️ Database migrations index

| # | File | Purpose |
|---|---|---|
| 01 | `01_nextauth_schema.sql` | NextAuth `next_auth.*` tables, helper `next_auth.uid()` |
| 02 | `02_app_schema.sql` | `profiles`, `links` (deprecated), `page_views`, RLS, avatars bucket, profile-on-signup trigger |
| 03 | `03_grants.sql` | `service_role` privileges on `public` schema |
| 04 | `04_theme_and_blocks.sql` | `profiles.theme` → `jsonb`, `backgrounds` bucket |
| 05 | `05_blocks.sql` | New `blocks` table replacing `links`, RLS, account-link trigger |
| 06 | `06_analytics_and_visibility.sql` | `blocks.visible`, `block_clicks`, `page_views` policy + grants |

### Planned migrations

| # | Purpose | Phase |
|---|---|---|
| 07 | `widgets`: extend `blocks.kind`, document `meta` shapes per widget | 1 |
| 08 | `creator_live_status`: cached live state per creator with EventSub timestamps | 1 |
| 09 | `theme_typography`: restructure `profiles.theme` into role-based typography | 3 |
| 10 | `user_fonts`: per-user font uploads, `fonts` bucket | 3 |
| 11 | `theme_background_layers`: layered background schema | 3 |
| 12 | `elements`: new positioned-element table replacing `blocks` ordering for canvas | 4 |
| 13 | `audit_log`, `user_storage`, rate-limit support tables | 5 |
| 14 | `live_alert_subscriptions`: viewer email opt-in for go-live notifications | 6 |
| 15 | `domains`: custom domain verification | 7 |

Run migrations in order in Supabase SQL Editor. Each is idempotent.

---

## How priorities are decided

When deciding what to build next:

1. **Creator visibility first.** Every sprint should make a creator's page more *discoverable*, more *alive*, or more *visually distinct*. If a feature doesn't serve one of those three pillars, it's not next.
2. **Live data integrity over feature breadth.** A widget that occasionally shows wrong status is worse than not having it. Build fewer widgets; make them feel real.
3. **Onboarding speed is a feature.** First-run-to-shareable-page must stay under 90 seconds. Anything that slows this gets cut or moved.
4. **Visual depth before feature count.** Better to have 6 widget types that look stunning on every theme than 20 that look like third-party islands.
5. **Security & rate limiting before scale.** Once we have real users, harden before someone abuses the redirect endpoint or upload pipeline.
6. **Monetization last.** Only after a free product creators actually use.

---

*Last updated: this commit*
