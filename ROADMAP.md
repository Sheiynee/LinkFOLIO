# LinkFolio — Status & Roadmap

A personal-page builder ("link in bio" + content blocks + custom themes).
Stack: **Next.js 14 · NextAuth v5 · Supabase · shadcn/ui · Tailwind**.
Hosted on **Vercel**.

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

### Theming
- 6 inspired presets: Apple Glass · Neobrutal · Vercel Mono · Sunset Press · Notion Paper · Linear Neon
- Full custom mode (gradient, text, muted, accent colors; button shape × style matrix)
- 8 Google Fonts
- Background image/GIF upload (`backgrounds` bucket, ≤5MB)
- Live preview pane next to the editor
- Stored as `jsonb` in `profiles.theme`

### Analytics *(landing-page promise ✅)*
- Page views written from `/{username}` SSR
- Click tracking via `/r/{block_id}` redirect endpoint
- Bot user-agent filter (Googlebot, Slackbot, etc.)
- Dashboard stat cards (total views, total clicks)

### Dashboard
- Onboarding checklist (add content → pick theme → first view)
- Profile / Content / Theme summary cards
- Dark/light mode toggle (`next-themes`)
- Branded loader on every route transition

### Infrastructure
- All SQL migrations in `supabase/*.sql` (00–06)
- Server actions for every mutation
- `revalidatePath` wired so dashboard + public page stay in sync

---

## 🚧 Current sprint — Live widgets

> *"GitHub stats, Spotify, and more — all live."* — landing page

The only landing-page promise still missing.

### Approach
New block type `widget` with sub-kinds. `meta jsonb` column holds widget config. Server-side data fetch with 60s cache so public pages stay snappy.

### Widgets in this round

| Kind | Data source | Auth |
|---|---|---|
| GitHub repo card | `api.github.com/repos/{owner}/{repo}` | none (public API) |
| GitHub profile | `api.github.com/users/{user}` | none |
| Spotify track/album | Spotify embed iframe | none |
| YouTube video | YouTube embed iframe | none |
| Generic link card | OG metadata scrape | none |

### Auto-detect
Paste a URL → we figure out which kind:
- `github.com/x/y` → GitHub repo
- `github.com/x` → GitHub profile
- `open.spotify.com/...` → Spotify
- `youtube.com/...` or `youtu.be/...` → YouTube
- anything else → generic OG card

### Deferred to a later round
- Spotify "now playing" (needs per-user OAuth + token refresh)
- Twitch live status
- Steam profile
- Discord invite card
- Twitter/X embed (until their API stabilizes)

---

## 📋 Backlog

### Content & blocks
- **Image block** — uploaded image in page flow (separate from background)
- **Per-link icons** — auto-detect from URL + lucide picker fallback
- **Block templates** — pre-made groups (e.g. "social profiles" preset bundle)
- **Schedule blocks** — show/hide on a date range

### Theming
- More presets (12+; categories: minimal, playful, professional, creator)
- Per-block style overrides (one button different from the rest)
- Theme share/copy (export/import JSON)
- Custom font upload
- Custom CSS escape hatch (sandboxed)

### Security
- **Rate limiting** on uploads, auth callbacks, `/r/{id}` clicks (Upstash Redis or Vercel KV)
- **CSRF tokens** on server actions (NextAuth covers auth; add explicit checks on profile/block mutations)
- **File type validation** — verify magic bytes for uploads, not just MIME header
- **URL allow/block list** — prevent users from posting malicious redirect targets
- **Reserved usernames** — block `admin`, `api`, `auth`, `dashboard`, `r`, etc.
- **Storage quotas** — cap total storage per user (currently unbounded)
- **Input sanitization** — strip control chars, normalize unicode in usernames/bios
- **Audit log** — security-relevant events (sign-in, profile changes, deletions)

### UI / UX
- **Mobile theme editor** — preview as a drawer instead of stacking under the form
- **Better empty states** — friendlier copy when user has 0 blocks
- **Toast notifications** — replace inline `setMessage` with a global toast system
- **Form validation** — client-side errors before hitting the server
- **Confirm dialogs** — replace native `confirm()` with styled modals
- **Keyboard shortcuts** — `cmd+k` command palette for navigation
- **Skeleton loaders** — for data-heavy components instead of just the route loader
- **Animations** — smoother list reorder, card hover states
- **Accessibility audit** — screen reader testing, focus management, ARIA labels

### Performance
- `next/image` for avatars and backgrounds (currently raw `<img>`)
- Edge runtime for `/r/{id}` redirect (currently node)
- Aggregate analytics into materialized views (don't count rows on every dashboard load)
- Preconnect to Supabase domain
- Static generation for landing page (currently SSR)
- Bundle analysis + tree-shake unused lucide icons

### Analytics — depth
- Detail page with charts (`/dashboard/analytics`)
- Time-range filter (today / week / month / all)
- Top referrers
- Top countries (already collecting via Vercel headers)
- Per-block click breakdown
- CSV export

### Account
- Change email
- Link additional OAuth providers (e.g. add GitHub to a Google-created account)
- Account deletion + 30-day grace period
- Data export (JSON dump of profile + blocks + theme)
- Two-factor auth (passkeys via WebAuthn)
- Email notifications opt-in (weekly stats)

### Sharing & SEO
- Custom OG images per profile via `@vercel/og`
- Twitter card meta tags
- QR code modal for the public URL
- Native Web Share API button
- "Powered by LinkFolio" toggle (free vs Pro)
- Robots.txt + sitemap (opt-in by user)

### Discovery & growth
- Public directory (opt-in)
- Tags / categories
- Search
- Embeddable widget (iframe of someone else's LinkFolio)

### Trust & compliance
- Terms of Service page
- Privacy Policy page
- Cookie consent banner (only if EU expansion needed)
- Abuse reporting + admin moderation queue
- Verified badge (manual review or paid)
- Strike/ban system

### Monetization (only if commercial)
- Stripe subscriptions
- Pro tier features: custom domains, advanced analytics, no branding, premium themes, larger storage cap
- Annual discount
- Affiliate program

### Future / stretch
- Custom domains (`yourname.com` → LinkFolio multi-tenant routing)
- Drag-and-drop canvas builder (pivot from stacked layout if users ask)
- Multi-page profiles (`/yourname/blog`, `/yourname/projects`)
- Native iOS/Android apps via Expo
- i18n (Spanish, French, etc.)
- Webhooks (notify external services when blocks change)
- Public API (for third-party integrations)

---

## 🧹 Tech debt

- `src/app/auth/signin/page.tsx` — re-evaluate after building a custom signin page (currently bare-bones)
- `src/lib/supabase/server.ts` — referenced but unused; admin client covers everything. Remove or repurpose for RLS-aware reads.
- `src/lib/supabase/client.ts` — same; not used yet.
- `src/components/ui/tabs.tsx` — needed a `!flex-col` override; root cause is base-ui variant not matching Tailwind config. Fix properly.
- README is still the create-next-app default — needs LinkFolio setup instructions.
- Old `links` table — already dropped manually; remove references in old SQL files for clarity.
- Mixed line endings in repo (CRLF warnings on every commit) — add `.gitattributes`.

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

Run them in order in Supabase SQL Editor. Each is idempotent.

---

## How priorities are decided

When deciding what to build next:

1. **Landing page promises first** — anything we say on `/` must work. (Live widgets is the last gap.)
2. **Security & rate limiting before scale** — once we have real users, add Redis-backed rate limits before someone abuses the redirect endpoint.
3. **UX polish before more features** — better to have 5 features that feel great than 10 that feel half-done.
4. **Monetization last** — only after a free product people actually use.

---

*Last updated: this commit*
