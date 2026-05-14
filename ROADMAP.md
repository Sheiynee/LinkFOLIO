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

### Creator widgets (Phase 1 shipped)
- New block kind `widget` with `widget_kind` enum + `meta jsonb` config
- Server-side fetch with per-kind cache windows (30s for live status, 5–30m for static metadata)
- Theme-aware rendering — every widget inherits the page's palette via inline styles, brand identity preserved through icon + small `tag` chip
- Pre-fetch all widget data in parallel before rendering the public page
- Provider token cache table (`app_tokens`) for Twitch app access token
- 10 widget kinds live:
  - **Twitch live status** — pulsing badge, viewers, game (30s revalidate)
  - **YouTube channel** — subscriber + video count (1h)
  - **YouTube latest video** — thumbnail, title, view count, time-ago (5m)
  - **GitHub repo** — stars, forks, language, description (10m)
  - **GitHub user** — followers + public repo count (30m)
  - **Discord invite** — member + online count (5m)
  - **Spotify embed** — real iframe player for track/album/artist/playlist/episode/show
  - **TikTok video** — branded gradient card linking out
  - **Tip jar** — Ko-fi, Buy Me a Coffee, Patreon, Streamlabs (deep links with brand colors)

### URL auto-detect on paste
- One paste-any-URL widget option resolves to the right widget kind + metadata
- Detects: `twitch.tv/{user}`, `youtube.com/@handle`, `youtube.com/channel/UC…`, `youtube.com/watch?v=…`, `youtu.be/…`, `youtube.com/shorts/…`, `github.com/owner`, `github.com/owner/repo`, `discord.gg/x`, `open.spotify.com/{type}/{id}`, `spotify:` URIs, `tiktok.com/@user/video/…`, and `ko-fi/buymeacoffee/patreon/streamlabs.com/x`

### Auto-generated OG images
- `/api/og/[username]` runs on Node runtime via `next/og`; pulls avatar, display name, handle, bio, and brand palette into a themed 1200×630 share card
- Wired into `og:image` + Twitter `summary_large_image` so links unfurl in Discord / Slack / LinkedIn / Facebook
- `metadataBase` derived from `NEXT_PUBLIC_SITE_URL` or `VERCEL_PROJECT_PRODUCTION_URL` for absolute URLs

### Infrastructure
- All SQL migrations in `supabase/*.sql` (01–07)
- Server actions for every mutation
- `revalidatePath` wired so dashboard + public page stay in sync
- `.gitattributes` normalizes line endings to LF

---

## 🚧 Phase 1 — Widget polish (remaining)

The widget catalogue + auto-detect shipped. What's left in Phase 1 is making widgets feel alive at scale and filling in the few Tier-1 gaps.

### Remaining Tier-1 widgets
- **Twitch latest VOD** — Helix `/videos?user_id={id}&type=archive&first=1`
- **YouTube live status** — distinct from latest-video; "live now" badge if `liveBroadcastContent === "live"`
- **Generic OG card** — `<meta property="og:*">` scrape for any unrecognized URL (the "anything else" fallback in auto-detect)

### Live-data freshness — phase 2
What's done: per-kind `next: { revalidate }` cache windows. What's left:
- **Client revalidation on tab focus**: lightweight client wrapper that calls a server action when the tab becomes visible after >30s
- **Visible "updated 2 min ago" indicator** on live widgets so static-looking states don't feel broken
- **Twitch EventSub**: subscribe to `stream.online` / `stream.offline` events for known streamers. Webhook updates a `creator_live_status` table; pages read from it. Removes polling cost at scale.
- **Smart polling**: only revalidate for creators whose pages were viewed in the last 5 minutes
- **Graceful degradation**: API down → show last known state with subtle "last seen" note. Never render a broken widget.

### Tier 2 — still deferred to Phase 6 (needs OAuth or evolving APIs)
- Spotify "now playing" (per-user OAuth + token refresh)
- Steam profile (recently played, achievements)
- Last.fm scrobbles
- Strava recent activities
- Letterboxd recent reviews
- Twitter/X embeds (when API stabilizes)
- Kick live status (API still maturing)
- Instagram latest post (API limitations)

### Widget size variants
- Multiple size variants per widget (1×1 small, 2×1 wide, 2×2 large) with consistent visual weight at each size. Currently every widget is one width.

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

### QOL carry-over from Phase 1
- Edit widget metadata in place (currently delete-and-re-add)
- Widget previews in the theme editor pane (preview shows widget shells but not real fetched data)
- Optimistic UI returns resolved widget metadata so the dashboard list shows the right label immediately, not the raw input

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
- **Live-now badge on OG images** — when a streamer is live at share time, the OG card reflects it. Requires Twitch EventSub from Phase 1's freshness work.
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
- Old `links` table — already dropped manually; references remain in historical migrations `02_app_schema.sql` and `05_blocks.sql`. Add a defensive `drop table if exists public.links` in a future migration rather than editing applied ones.

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
| 07 | `07_widgets.sql` | `blocks.widget_kind` + `meta`; `app_tokens` for Twitch token cache |

### Planned migrations

| # | Purpose | Phase |
|---|---|---|
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
