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
- **Connected accounts panel** — settings page shows which OAuth providers are linked; "Connect" button links a second provider to the same account via NextAuth

### Profile
- Username (live availability check, debounced)
- Display name, bio
- Avatar upload to Supabase Storage (`avatars` bucket, ≤2MB)
- **Verified creator badge** — `profiles.verified` flag (set by admin via SQL); blue checkmark displayed on public page, OG image, and Story card

### Public page (`/{username}`)
- Theme-aware rendering (stack and canvas modes)
- 404 for unknown usernames and soft-deleted profiles
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
- Page views written from `/{username}` SSR; click tracking via `/r/{block_id}` redirect endpoint
- Bot user-agent filter (Googlebot, Slackbot, etc.)
- **`/dashboard/analytics`** — full analytics dashboard (Phase 6 shipped):
  - AreaChart: page views over time
  - BarChart: top referrers (domain-level) + top countries
  - Table: per-block click breakdown
  - Time range tabs: 7d / 30d / 90d / All
  - CSV export via `/api/analytics/export?days=N`
  - Materialized views (`mv_page_views_daily` + `mv_block_clicks_daily`) refresh every 5 minutes via pg_cron
  - Dashboard home stat cards link through to `/dashboard/analytics`

### Dashboard
- Onboarding checklist
- Profile / Content / Theme summary cards
- Dark/light mode toggle (`next-themes`)
- Branded loader on every route transition

### Creator widgets (Phase 1 shipped in full)
- New block kind `widget` with `widget_kind` enum + `meta jsonb` config
- Server-side fetch with per-kind cache windows (30s–1h depending on liveness)
- Theme-aware rendering — every widget inherits the page's palette via inline styles
- Pre-fetch all widget data in parallel before rendering the public page
- Provider token cache table (`app_tokens`) for the Twitch app access token
- **Inline widget edit**, **optimistic UI**, **tab-focus revalidation**, **size variants** (compact/default/featured)
- **"Updated Xm ago" freshness indicator** on Twitch live, Twitch VOD, and YouTube live widgets
- **15 widget kinds live**:
  - **Twitch live status** — pulsing badge, viewers, game (EventSub-driven + 30s Helix fallback)
  - **Twitch latest VOD** — thumbnail + view count + time-ago (5m)
  - **YouTube channel** — subscriber + video count (1h)
  - **YouTube latest video** — thumbnail, title, view count, time-ago (5m)
  - **YouTube live status** — pulsing LIVE badge when broadcasting (1m)
  - **GitHub repo** — stars, forks, language, description (10m)
  - **GitHub user** — followers + public repo count (30m)
  - **Discord invite** — member + online count (5m)
  - **Spotify embed** — real iframe player for track/album/artist/playlist/episode/show
  - **TikTok video** — branded gradient card linking out
  - **Tip jar** — Ko-fi, Buy Me a Coffee, Patreon, Streamlabs (deep links with brand colors)
  - **Generic OG card** — `<meta property="og:*">` scrape for any URL, with SSRF protection
  - **Stream schedule** — weekly recurring schedule with timezone; "Add to calendar" button; `/api/ical/{username}` generates a subscribable ICS feed with `RRULE:FREQ=WEEKLY`
  - **Cross-promotion** — branded gradient CTA cards; detects platform from pasted URL (Twitch, YouTube, TikTok, Instagram, Twitter/X, Spotify artist)
- **18 widget kinds live** (3 tier-2 added 2026-05-28):
  - **Last.fm scrobbles** — most recent scrobble + "Now Playing" badge; album art, artist, track; 1-min refresh (`LASTFM_API_KEY`)
  - **Steam profile** — avatar, online status, currently/recently played game; accepts vanity URL or Steam64 ID; 5-min refresh (`STEAM_API_KEY`)
  - **Letterboxd films** — most recently logged film with poster, title, year, star rating; featured size shows 3-film poster grid; RSS scrape, 30-min refresh

### URL auto-detect on paste
- Detects all major platforms + cross-promo URLs + any valid http(s) URL as a generic OG card fallback
- Auto-detects Last.fm, Steam, and Letterboxd profile URLs

### Onboarding archetype flow (Phase 2 shipped)
- 4-step flow: Archetype picker → Platform URL paste → Brand color seed → Typography pairing
- Each step skippable; re-run protection (`profiles.onboarded_at`); skip-all fallback

### Typography subsystem (Phase 3 shipped)
- 5-role schema: display, heading, body, ui, mono
- Custom font upload (WOFF2, ≤1MB/file, 5MB total)
- Per-element typography override
- `@font-face` injected on demand for public page

### Backgrounds subsystem (Phase 3 + Phase 5 shipped)
- Gradient · Mesh · Pattern · Image · Animated (drift/noise/particles) · Video layers
- `prefers-reduced-motion` respected across all animated types
- Per-section backgrounds via canvas `region` elements

### OG images (Phase 3 + Phase 5 + Phase 6 shipped)
- `/api/og/[username]` — 1200×630 share card with avatar, name, bio, brand palette
- **Live-now badge** — red `● LIVE` pill renders when any linked Twitch channel is currently live (reads `creator_live_status`)
- **Verified checkmark** — shown inline with name when `profiles.verified = true`
- **Instagram Story card** — `/api/og/[username]/story` — 1080×1920 vertical layout; dashboard "Story" button downloads PNG or opens Instagram

### Canvas editor (Phase 4 shipped)
- Opt-in via `profiles.layout_mode = 'canvas'`; existing stack pages untouched
- Free-positioned elements: link · text · heading · divider · widget · shape · sticker · image · region
- Resize (8-way handles), rotation (shift = 15° snap), snap-to-grid (8px), alignment guides, multi-select
- Undo/redo (50-entry stack), copy/paste (cross-tab via system clipboard), duplicate
- Group operations: align left/center/right/top/middle/bottom, distribute horizontal/vertical
- Magic arrange: Grid / Asymmetric / Hero heuristics
- Mobile reflow + per-element mobile overrides; editor mobile responsiveness
- All 15 widget kinds supported in canvas mode
- **Bug-fix pass (2026-06-11, shipped):**
  - Mobile overrides now load — `ELEMENT_FIELDS` was missing the `mobile_x/y/w/h` columns, so saved mobile layouts silently reverted to auto-reflow on every editor load
  - Keyboard nudge saved stale (pre-nudge) coordinates to the server — stale-ref race fixed via pure `computeNudge` helper
  - Mobile snap guides fired at the 600px desktop positions on the 360px mobile canvas — `snap()` now takes a `canvasWidth` param
  - Rotated elements are resizable — `resizeRotatedBox` rotates pointer deltas into local space and keeps the opposite anchor fixed; the selection overlay now rotates about center to match elements
  - Align/distribute in mobile view writes mobile overrides instead of invisibly editing desktop coordinates (`computeGroupOp`)
  - `batchUpdateElements` + `updateMobilePlacements` issue writes concurrently (was 1 serial round-trip per element)
  - Drag/resize debounce saves skip cache revalidation (`skipRevalidate`); the pointerup flush always writes the final state with a full revalidate
  - New pure-helper module `src/lib/canvas-ops.ts`; 22 new tests (285 total)

---

## 🎨 Canvas refinement — current focus

Benchmarked against Carrd (click-to-edit immediacy), Odoo's website builder (grid mode, mobile editing toggle, saveable blocks), and Figma/Canva-class editors (layers, zoom, smart guides, numeric inputs). The gesture core is solid; the gaps are affordances and render performance.

### Step 1 — Refactor before features ✅ (2026-06-12)
- [x] Split `canvas-editor.tsx` (was ~1,750 lines → ~460): `use-canvas-gestures.ts` (pointer/drag/resize/rotate/marquee + debounced saves), `side-panel.tsx`, `inspectors.tsx`, `clipboard.ts`
- [x] Memoize the render path: `React.memo` on `ElementBox` — unchanged elements keep reference identity, so dragging one element no longer re-renders the other N−1 boxes. Verified safe on the server-rendered public page (canvas profile renders fine through the memo)
- [x] Cache `placementsForMobile` by array identity (WeakMap) — was O(N log N) per call, called many times per pointer-move frame
- [x] Remove dead `updateImageMask` action

### Step 2 — Quick affordances ✅ (2026-06-12)
- [x] Z-order controls: bring to front / forward / backward / send to back — Layer cluster in the sidebar + `]` / `[` / `Shift+]` / `Shift+[` shortcuts; pure `computeZOrder` renormalizes z to sequential indices (7 tests)
- [x] Editable numeric X/Y/W/H (+ rotation on desktop) inputs — `PositionInspector`, commits on blur/Enter; mobile view writes mobile overrides
- [x] Lock + visibility toggles in the Selection cluster — locked elements stay selectable (so they can be unlocked) but can't be dragged; hidden elements render dimmed in the editor and are already excluded from the public page (`onlyVisible`)

### Step 3 — Editor-defining features
- [ ] Inline text editing: double-click text/heading to edit in place (biggest friction point today — all content edits go through the sidebar textarea)
- [ ] Layers panel: element list with click-to-select, drag-to-reorder z, lock/visibility toggles

### Step 4 — Polish tier
- [ ] Zoom (Ctrl+wheel, cursor-centered) and pan (space-drag)
- [ ] Equal-spacing smart guides (Figma-style "evenly spaced" hints)
- [ ] Smarter mobile auto-reflow: preserve aspect ratio / scale proportionally instead of forcing every element full-width at desktop height
- [ ] "Reset all mobile overrides" action (currently per-selection only)

### Twitch EventSub (Phase 6 shipped)
- `/api/webhooks/twitch` — HMAC-SHA256 verified, replay-guarded webhook endpoint
- `creator_live_status` table written on `stream.online`/`stream.offline` events
- `twitch_eventsub_subscriptions` registry for idempotency
- Auto-subscribes when a `twitch_live` widget is created (stack or canvas)
- `getTwitchLiveStatus` reads cache first (2-min freshness window) before falling back to Helix API
- Graceful fallback: if cache is stale/missing, Helix polling continues and back-fills the cache

### Sharing & SEO (Phase 5 shipped)
- Web Share API + QR modal (`<ShareButton>`)
- `robots.txt` — public profiles crawlable, dashboard/auth/api blocked
- `sitemap.xml` — landing page + legal pages + all active profiles (up to 10k)
- Story share modal — download PNG + deep-link to Instagram app

### Security & hardening (Phase 5 shipped)
- Reserved usernames denylist (40 entries)
- Storage quotas (50 MB/user), magic-byte validation on all uploads
- Rate limiting (Postgres-backed sliding window): redirects 60/min/IP, uploads 10/min/user
- URL allow/block list: rejects private IPs, RFC1918, dangerous schemes
- Input sanitization: NFKC normalize, strip C0/C1 controls, zero-width, bidi-override
- Audit log (IP hashed with salt): auth, deletion, export, rate-limit hits, URL rejections

### Compliance (Phase 5 shipped)
- Soft delete with 30-day grace period; daily hard-delete cron
- GDPR data export (JSON dump of all user data)
- Terms of Service + Privacy Policy at `/legal/*`

### Performance (Phase 5 shipped)
- Static landing page (`force-static`); middleware handles logged-in redirect
- Edge runtime on `/r/{id}` — sub-100ms global redirects
- Preconnect + dns-prefetch to Supabase storage origin
- Bundle analyzer (`npm run analyze`)
- Materialized analytics views with 5-min pg_cron refresh

### Account management (Phase 6 — partial)
- **Connected accounts** — link Google + GitHub to the same account from settings ✅
- **Change email** — backend infrastructure (tokens table, verify route, Resend helper) built; UI deferred until Resend sending domain is set up
- **Email digest opt-in** — backend infrastructure built; cron job ready; UI deferred until Resend sending domain is set up

---

## 🟡 Phase 6 — Deferred items

### Email features (blocked on Resend sending domain)
- **Change email** — request flow, signed token verification, confirmation email. Infrastructure is in `src/lib/email.ts`, `src/app/api/account/verify-email/route.ts`, and `account-actions.ts`. Activate by adding `RESEND_API_KEY` + `EMAIL_FROM` env vars and wiring the UI back into `AccountPanel`.
- **Email digest** — weekly stats email every Monday at 9am UTC. Cron at `/api/cron/email-digest` is ready; add to `vercel.json` `crons` array and set env vars to enable.
- **Live-now follow notifications** — viewers subscribe to a creator's go-live alerts. Requires EventSub (shipped) + Resend domain + `live_alert_subscriptions` table (migration 19-planned).

### Account security
- **2FA / passkeys (WebAuthn)** — `@simplewebauthn/server` + `@simplewebauthn/browser`, credentials table, registration + authentication ceremonies.

### Tier 2/3 widgets (remaining — per-user OAuth required)

| Widget | Auth needed | Env vars | Status |
|---|---|---|---|
| Spotify now-playing | Per-user OAuth (`user-read-playback-state`) | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | Deferred — needs token refresh infra |
| Strava activities | Per-user OAuth | `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | Deferred — needs token refresh infra |
| Twitter/X | — | — | Deferred — API unstable |
| Kick | — | — | Deferred — API not mature |

---

## 🧪 Testing

No automated tests exist yet. This section tracks the plan for adding coverage, automation, and a CI gate.

### Philosophy
- Test behaviour, not implementation. A test that breaks when you rename a variable is a bad test.
- Prioritise by blast radius: critical paths (auth, public page, widget resolution, server actions) first.
- Integration tests over unit tests where possible — the app's real bugs hide at boundaries (Supabase query, server action, Next.js routing), not inside pure functions.

### Tools
| Layer | Tool | Reason |
|---|---|---|
| Unit / integration | **Vitest** | Fast, native ESM, works with Next.js and `server-only` imports |
| E2E | **Playwright** | Headless Chromium, first-class Next.js support, parallel runs |
| CI | **GitHub Actions** | Already hosting the repo; free for public / cheap for private |
| Coverage | Vitest `--coverage` (v8 provider) | No extra config needed |

### Test plan

#### Priority 1 — Pure functions (no I/O, highest ROI)
These are deterministic and have zero external dependencies. Write first.

- `src/lib/sanitize.ts` — `sanitizeShortText`, `sanitizeMultilineText`: NFKC, control char stripping, bidi override removal
- `src/lib/url-validate.ts` — `validateLinkUrl`: private IP ranges, scheme allowlist, localhost rejection
- `src/lib/widgets/resolve.ts` — `resolveWidget`: all 15 widget kinds, auto-detect, error paths
- `src/lib/widgets/detect.ts` — `detectWidgetFromUrl`: platform URL patterns
- `src/lib/widgets/cross-promo.ts` — `detectCrossPromoFromUrl`: Instagram/Twitter/TikTok/YouTube/Twitch/Spotify handles
- `src/lib/palette.ts` — HSL color derivation from seed color
- `src/lib/magic-arrange.ts` — grid / asymmetric / hero heuristics
- `src/lib/widgets/twitch-eventsub.ts` — `ensureChannelSubscriptions` (mock Supabase + Helix)

#### Priority 2 — Server actions (mock Supabase, test logic)
Use `vi.mock` to stub `createAdminClient`. Test the action logic, not the DB.

- `createBlock` — type validation, URL normalisation, sanitisation
- `createWidgetBlock` — resolve chain, Twitch EventSub hook fires on `twitch_live`
- `updateProfile` — reserved username check, avatar URL validation
- `requestEmailChange` — email format validation, token generation, duplicate detection
- `getAnalyticsData` — query construction, date cutoff logic, referrer domain extraction

#### Priority 3 — API routes (test with `fetch` + Next.js test utilities)
- `/api/webhooks/twitch` — valid HMAC passes, bad signature 403s, replay guard 410s, challenge responds with challenge text, `stream.online` upserts `creator_live_status`
- `/api/ical/[username]` — returns valid ICS content-type, RRULE is correct, handles missing schedule gracefully
- `/api/analytics/export` — requires auth, CSV has expected headers, `?days=all` returns all data

#### Priority 4 — E2E (Playwright, real browser)
Cover the critical happy paths that need a running app:

1. **Sign in + first page** — OAuth mock → lands on `/dashboard` with onboarding checklist
2. **Add a link block** — fill form → block appears in list → visible on public page
3. **Add a Twitch live widget** — paste URL → widget appears with channel name
4. **Theme picker** — select a preset → public page preview updates
5. **Canvas mode** — switch to canvas → add text element → drag it → save persists on reload
6. **Public page renders** — visit `/{username}` → all blocks visible, correct theme applied
7. **OG image** — `GET /api/og/{username}` → response is `image/png`, no 500

### Running tests

```bash
# Unit + integration
npm run test              # vitest run
npm run test:watch        # vitest watch
npm run test:coverage     # vitest run --coverage

# E2E
npm run test:e2e          # playwright test
npm run test:e2e:ui       # playwright test --ui
```

### CI setup (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run test
      - run: npm run build
```

E2E runs separately on a schedule or pre-deploy hook (requires a running Vercel preview URL).

### Setup checklist

```
[x] npm install -D vitest @vitest/coverage-v8 jsdom
[x] npm install -D @playwright/test
[x] Create vitest.config.ts
[x] Create playwright.config.ts
[x] Add test scripts to package.json
[x] Add .github/workflows/ci.yml
[x] Write Priority 1 tests (pure functions) — 161 tests, all passing
[x] Write Priority 2 tests (server actions with mocked Supabase) — 61 tests, all passing
[x] Write Priority 3 tests (API routes) — 41 tests, all passing
[x] Write Priority 4 E2E tests (critical happy paths) — 7 scenarios, auth via session injection
[x] Canvas bug-fix pass tests (canvas-ops, canvas-snap, db/elements, canvas actions) — 22 tests; suite now 285 passing
```

---

## 🔧 Refactoring

Known code quality issues worth addressing before the codebase grows further. None of these are bugs — they're accumulated design debt that will slow future development if left.

### High priority

**1. Deduplicate widget renderer dispatch** ✅
Extracted `src/components/widget-renderer.tsx` — single `<WidgetRenderer>` component shared by both renderers. Adding a widget kind now only requires updating one file.

**2. Eliminate prop-drilling `username` through canvas renderer** ✅ (partial)
`WidgetElement` is gone — replaced by `WidgetRenderer`. The `username` prop still threads through `ElementBox → ElementContent` because these are server components and cannot use React Context. Full elimination requires converting them to client components (deferred).

**3. Data-drive the content editor widget picker** ✅
`WidgetPicker` now maps over `WIDGET_PICKER_SPECS` + a `WIDGET_ICONS` record instead of 15 hardcoded buttons. New widget kinds automatically appear in the picker.

**4. Extract shared `ogBackground()` helper** ✅
Moved to `src/lib/og-helpers.ts`, imported by both OG route files.

### Medium priority

**5. Centralize `revalidatePublicPage`** ✅
Extracted to `src/lib/revalidate.ts`. Both action files import from there; canvas `revalidateUserPages` now calls it directly and `getUsernameForUser` is removed.

**6. Replace `as unknown as X` casts in `load.ts`** ✅
Added `readStreamScheduleMeta()` and `readCrossPromoMeta()` runtime validators. Both validate field presence and types before constructing the typed value — no more double-casts.

**7. Consolidate `createAdminClient()` call sites** ✅
Created `src/lib/db/profiles.ts`, `src/lib/db/blocks.ts`, and `src/lib/db/elements.ts` with typed query helpers (`getProfileByUsername`, `getProfileById`, `getBlocksByUserId`, `getElementsByUserId`). Updated 8 call sites: public page, dashboard, content/canvas/theme/settings pages, both OG routes. Also removed the 58-line `loadPreviewWidgetData` duplicate from `theme/page.tsx` (was missing `stream_schedule`/`cross_promo` support — silent bug fixed).

### Low priority

**8. Delete `CODEBASE_EXPLORATION_REPORT.md`** ✅
Removed from repo root.

**9. Branded sign-in page** ✅
`src/app/auth/signin/page.tsx` already uses a fully branded custom page (LinkFolio name, GitHub + Google buttons, card layout). No action needed.

**10. Historical migration references to dropped `links` table** ✅
Added `supabase/20_drop_deprecated_links.sql` — idempotent `DROP TABLE IF EXISTS public.links`.

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

**Not** building creator-side commerce (digital store, products). Tip jars are deep links, not a payment system.

---

## 🚫 Explicitly out of scope

- **Linktree-style email capture forms tied to mailing list integrations.** Adjacent product, distracts from visibility focus.
- **Full website builder (multi-page CMS, blog hosting).** That's Webflow / Framer. We are an identity hub.
- **Embeddable widget (iframe of someone else's LinkFolio).** Doesn't serve creator audience.
- **Public discovery directory.** Unique-output is the discovery mechanism. Re-evaluate only if growth stalls.
- **Twitter-shaped feed of all your activity.** Tempting; would balloon scope. Phase 7+ at earliest.

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
| 08 | `08_typography_and_background_layers.sql` | Hard cutover: rewrites every `profiles.theme` row into the current typography + background layer schema |
| 09 | `09_user_fonts.sql` | `public.user_fonts` table + `fonts` storage bucket, RLS, public read |
| 10 | `10_onboarding_flag.sql` | `profiles.onboarded_at` for onboarding re-run protection |
| 11 | `11_canvas_elements.sql` | `elements` table + `profiles.layout_mode` flag + RLS |
| 12 | `12_canvas_visual_elements.sql` | Widens `elements_type_check` with `'shape'`, `'sticker'`, `'image'` |
| 13 | `13_canvas_regions.sql` | Widens `elements_type_check` with `'region'` for per-section backgrounds |
| 14 | `14_hardening.sql` | `reserved_usernames`, `user_storage`, `rate_limit_buckets`, `profiles.deleted_at` + `deleted_grace_until` |
| 15 | `15_audit_log.sql` | Append-only `audit_log` (IP hashed with salt), service-role-only access |
| 16 | `16_analytics_matviews.sql` | `mv_page_views_daily` + `mv_block_clicks_daily` matviews + `refresh_analytics_matviews()` + pg_cron 5-min schedule |
| 17 | `17_account_management.sql` | `email_change_tokens`, `profiles.email_digest_opted_in`, cross-schema RPC helpers (`get_user_linked_providers`, `email_exists`, `update_user_email`, `get_user_email`) |
| 18 | `18_eventsub.sql` | `creator_live_status` + `twitch_eventsub_subscriptions` for Twitch EventSub webhook infrastructure |
| 19 | `19_new_widget_kinds.sql` | Widens `blocks_widget_kind_check` + `elements_widget_kind_check` with `'stream_schedule'`, `'cross_promo'`; adds `profiles.verified` |
| 20 | `20_drop_deprecated_links.sql` | Drops the deprecated `public.links` table (superseded by `blocks` in migration 05) |
| 21 | `21_new_widget_kinds_2.sql` | Widens both widget_kind constraints with `'lastfm_scrobbles'`, `'steam_profile'`, `'letterboxd_films'` |

### Planned migrations

| # | Purpose | Phase |
|---|---|---|
| 22 | `live_alert_subscriptions`: viewer email opt-in for go-live notifications | 6 (deferred) |
| 23 | `domains`: custom domain verification | 7 |

Run migrations in order in Supabase SQL Editor. Each is idempotent.

---

## 🔒 Audit backlog (2026-06-11 full-app scan)

Findings from a codebase + live-site audit, verified in code. Not yet fixed — ordered by impact.

### High
1. **SSRF bypass in OG scraper** — `og-scraper.ts` validates the hostname but fetches with `redirect: "follow"`; a creator URL can 302 to internal hosts/cloud metadata. Fix: `redirect: "manual"`, re-validate each hop, cap ~3.
2. **GDPR export reads entire `block_clicks` table** — `account-actions.ts` selects with no filter then filters in JS; Supabase's 1000-row cap makes exports incomplete. Fix: `.in("block_id", ownedBlockIds)`.
3. **Analytics silently capped at 1000 clicks** — `analytics/actions.ts` aggregates raw rows in memory; totals/referrers/countries undercount. Fix: aggregate in Postgres (extend matviews).
4. **Analytics writes can be dropped** — page-view/click inserts are fire-and-forget (`void ...insert()`); serverless may freeze before they complete. Fix: `await` or `waitUntil`.

### Medium
5. Rate limiter is racy (read-then-upsert undercounts bursts) and 3 round-trips on the hot `/r/{id}` path → single atomic `ON CONFLICT` RPC; `pruneRateLimitBuckets` is never called (table grows forever)
6. Twitch webhook: no `Twitch-Eventsub-Message-Id` dedupe; `stream.online` writes empty title/game until Helix backfill
7. Public page is `force-dynamic` yet every mutation pays a DB lookup to revalidate it — pick ISR/tag caching or drop the revalidate calls; wrap `getProfileByUsername` in `cache()` (runs 2× per request)
8. No `error.tsx` / `not-found.tsx` — outages show raw Next.js error screens on public creator pages
9. Storage quota only grows — replaced avatars/backgrounds orphan the old object and never subtract usage
10. CSV formula injection in analytics export; non-constant-time cron secret compare; plaintext email-change tokens with no rate limit

### Low
- Widget `<img>` tags lack `loading="lazy"` + dimensions (CLS); OG image routes lack `Cache-Control`; `block-list.tsx` is 838 lines; `theme/actions.ts` still has a private `getUsernameForUser` (refactor #5 regression); `siteBase` derivation duplicated 4×; `reorderBlocks` fires N non-transactional updates; dashboard header overflows under ~400px

---

## How priorities are decided

1. **Creator visibility first.** Every sprint should make a creator's page more *discoverable*, more *alive*, or more *visually distinct*.
2. **Live data integrity over feature breadth.** A widget that occasionally shows wrong status is worse than not having it.
3. **Onboarding speed is a feature.** First-run-to-shareable-page must stay under 90 seconds.
4. **Visual depth before feature count.** Better to have 6 widget types that look stunning on every theme than 20 that look like third-party islands.
5. **Security & rate limiting before scale.** Harden before real users can abuse the system.
6. **Test before growing.** Once a subsystem is stable, write tests before adding to it. Don't let test debt compound.
7. **Monetization last.** Only after a free product creators actually use.

---

*Last updated: 2026-06-11 — canvas bug-fix pass shipped (7 fixes, 22 new tests); canvas refinement plan + full-app audit backlog added*
