# LinkFolio

A live page builder for creators — a single hub for everywhere you stream, post, and publish.

LinkFolio aggregates a creator's identity across Twitch, YouTube, TikTok, Spotify, and more into one expressive, themeable page. Live data is first-class: viewers see when streamers are live, what's currently playing, the latest upload — not a static list of links.

See [ROADMAP.md](ROADMAP.md) for product pillars, current phase, and the full backlog.

## Stack

- **Next.js 14** (App Router) on **Vercel**
- **NextAuth v5** (Google + GitHub) with the **Supabase adapter**
- **Supabase** (Postgres + Storage + RLS)
- **shadcn/ui** + **Tailwind CSS**
- `@dnd-kit` for drag-to-reorder

## Prerequisites

- Node.js 20+
- A Supabase project
- OAuth credentials from Google and GitHub

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create `.env.local` at the repo root:

```bash
# NextAuth
AUTH_SECRET=                 # generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# OAuth providers
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=         # Supabase project settings → API → JWT Secret
```

### 3. Run database migrations

In the Supabase SQL Editor, run the files in [supabase/](supabase/) in numeric order (`01_…` through `06_…`). Each is idempotent. See the migrations index in [ROADMAP.md](ROADMAP.md#️-database-migrations-index) for what each one does.

### 4. Storage buckets

The migrations create `avatars` and `backgrounds` buckets. Verify they exist in Supabase Studio → Storage.

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project layout

```
src/
  app/
    [username]/         public profile page
    dashboard/          editor (content, theme, settings)
    r/[id]/             click-tracking redirect
    auth/signin/        sign-in page
  components/ui/        shadcn primitives
  lib/
    supabase/admin.ts   service-role client (server-only)
    theme/              presets, fonts, palette helpers
  auth.ts               NextAuth v5 config
supabase/               SQL migrations (run in order)
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint
