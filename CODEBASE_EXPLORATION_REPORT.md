# Next.js 14 LinkFolio Codebase Exploration Report

## Date
2026-05-27

## Task Summary
Explored the Next.js 14 project to understand existing widget architecture, block creation patterns, public profile rendering, OG image structure, and database schema for planning cross-promotion blocks, stream schedules, Instagram Stories, and verified badge features.

---

## 1. EXISTING WIDGET KINDS & DATA SHAPES

### Located File
`src/lib/widgets/types.ts`

### Current Widget Types
```
WidgetKind = 
  | "twitch_live"     → TwitchLiveData (user, stream metadata, fetched_at)
  | "twitch_vod"      → TwitchVodData (user, video, fetched_at)
  | "youtube_video"   → YouTubeVideoData (video metadata)
  | "youtube_channel" → YouTubeChannelData (channel with subscriber_count, video_count, view_count)
  | "youtube_live"    → YouTubeLiveData (channel + live broadcast metadata)
  | "spotify_embed"   → null (no live data, just embed URL)
  | "tiktok_video"    → null (no live data)
  | "github_repo"     → GitHubRepoData (stars, forks, language, owner)
  | "github_user"     → GitHubUserData (bio, followers, public_repos)
  | "discord_invite"  → DiscordInviteData (guild info, member count, presence count)
  | "tip_jar"         → null (metadata only: platform + handle)
  | "og_card"         → OgCardData (title, description, image_url, site_name, url)
```

### WidgetSize Options
- `"compact"` - minimal single-line layout
- `"default"` - standard multi-line card
- `"featured"` - full-width with thumbnail

### Pattern for New Widgets

**Meta JSONB Shape** (stored in blocks.meta):
```json
{
  "size": "compact" | "default" | "featured",
  // widget-specific fields (examples):
  "channel": "string",
  "video_id": "string",
  "handle": "@string",
  "invite_code": "string",
  "platform": "kofi|bmac|patreon|streamlabs",
  "url": "string"
}
```

**Data Shape** (fetched server-side, cached):
```typescript
interface WidgetData {
  kind: WidgetKind;
  data: T | null;  // null if fetch failed or unsupported
}
```

---

## 2. BLOCK CREATION PATTERNS

### Located Files
- `src/app/dashboard/content/page.tsx` - fetches blocks from DB
- `src/app/dashboard/content/block-list.tsx` - client component with form logic
- `src/lib/blocks.ts` - Block type definitions

### Block Types
```typescript
type BlockType = "link" | "text" | "heading" | "divider" | "widget"

interface Block {
  id: string;
  type: BlockType;
  title: string | null;
  url: string | null;
  content: string | null;
  visible?: boolean;
  widget_kind?: WidgetKind | null;  // only for type="widget"
  meta?: Record<string, unknown> | null;  // stores size + widget-specific metadata
}
```

### Creation Flow (Client-Side)

1. **Non-Widget Blocks** (link, text, heading):
   - User clicks "Add [type]" button
   - Form modal appears with appropriate fields
   - `createBlock(input)` action sends to server
   - Server inserts into `public.blocks` table
   - New block added to local state

2. **Widget Blocks**:
   - User clicks "Add widget"
   - WidgetPicker appears (choose type or "auto")
   - User enters URL/handle in WidgetForm
   - `createWidgetBlock({ kind, input })` resolves via `resolveWidget()`
   - Server returns resolved `{ kind, meta, title }`
   - New widget block added to state

### Key Actions
- `createBlock(input)` → inserts non-widget block
- `createWidgetBlock({ kind, input })` → resolves widget + inserts
- `updateBlock(input)` → updates link/text/heading fields
- `updateWidgetBlock({ id, input })` → re-resolves widget source
- `updateWidgetSize({ id, size })` → updates meta.size
- `deleteBlock(id)` → soft-delete or hard-delete
- `reorderBlocks(ids)` → reorder via position column
- `toggleBlockVisibility(id, visible)` → update visible flag

### Form UI Patterns

**Block List Component** (`block-list.tsx`):
- Drag-to-reorder using `@dnd-kit`
- Edit mode inline (shows form instead of preview)
- Size toggle for widgets (compact/default/featured)
- Visibility toggle (eye icon)
- Delete button with confirm
- Add section at bottom with grid of buttons

**WidgetPicker**:
- Grid of widget type buttons
- "Paste a URL — auto-detect" option first
- 13 widget types + og_card option

**WidgetForm**:
- Single input field (URL or handle)
- Placeholder and hint text from `WIDGET_LABELS` and `WIDGET_HINTS`
- Submit button (disabled while pending)

---

## 3. PUBLIC PAGE HEADER RENDERING

### Located Files
- `src/components/profile-render.tsx` - main profile render component
- `src/app/[username]/page.tsx` - public profile route

### Header Structure

```tsx
<div className="relative min-h-screen w-full flex flex-col items-center py-16 px-4">
  <BackgroundLayers layers={theme.background.layers} />
  
  {/* Avatar circle with theme accent border */}
  <div className="h-24 w-24 mb-4 rounded-full overflow-hidden ring-4"
       style={{ borderColor: theme.accent_color }}>
    {avatar || fallback initial}
  </div>
  
  {/* Name */}
  <h1 className="text-2xl font-bold mb-1">{display_name || username}</h1>
  
  {/* @handle */}
  <p className="mb-4 text-sm" style={{ color: theme.muted_color }}>
    @{username}
  </p>
  
  {/* Bio (optional) */}
  {bio && <p className="text-center max-w-sm mb-8">{bio}</p>}
  
  {/* Blocks list */}
  <div className="w-full max-w-sm space-y-3">
    {/* blocks mapped here */}
  </div>
</div>
```

### Key Observations for Verified Badge
- **h1 with name** is the primary target for badge placement
- Name comes from `display_name || username`
- Currently no verified indicator exists
- Badge would logically appear **next to or below the name**
- Theme uses `accent_color` for highlights

### Data Flow
1. Public route `/[username]` loads profile from DB
2. Selects: `id, username, display_name, bio, avatar_url, theme, layout_mode, deleted_at`
3. Loads blocks (if stack mode) or elements (if canvas mode)
4. Passes to `<ProfileRender>` component
5. Component maps blocks to widget renderers

---

## 4. OG IMAGE STRUCTURE (Satori Layout)

### Located File
`src/app/api/og/[username]/route.tsx`

### Image Dimensions
- **Size**: 1200 x 630px (standard OpenGraph)
- **Runtime**: Node.js (not edge)

### Layout Structure

```
┌─────────────────────────────────────┐
│ Padding: 80px                       │
├─────────────────────────────────────┤
│                                     │
│  [Avatar 180×180] Gap(40) [Name]   │ ← Top row
│                       [Handle]      │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  [Bio text, 2-3 lines max]         │ ← Optional bio
│                                     │
├─────────────────────────────────────┤
│ SPACER (flex: 1) — pushes footer   │
├─────────────────────────────────────┤
│ ◆ LinkFolio | domain/username      │ ← Footer
├─────────────────────────────────────┘
```

### Key Elements

**Avatar**: 180×180px, circular, border in theme.accent_color; fallback initial letter

**Name/Handle**: 
- Display name: fontSize 64, fontWeight 700
- Handle: fontSize 30, monospace, muted_color

**Bio**: Truncated to 110 chars, fontSize 28, muted_color

**Background**: Collapses layered theme to first visible layer; supports linear-gradient, image URL, solid color

### For Instagram Story Variant (1080×1920)
- **Will need new route**: `/api/story/[username]` or `/api/og/[username]?format=story`
- **Layout**: vertical stack (avatar, name/handle, bio, content preview)
- **Satori limitations**: same as OG (no complex animations, CSS subset)

---

## 5. DATABASE SCHEMA & PROFILES TABLE

### Located Files
- `supabase/02_app_schema.sql` - main schema
- `supabase/05_blocks.sql` - blocks table
- `supabase/07_widgets.sql` - widget extensions

### Profiles Table

```sql
create table public.profiles (
  id uuid primary key references next_auth.users(id),
  username text unique not null,
  display_name text,
  bio text,
  avatar_url text,
  theme text default 'purple',
  created_at timestamptz,
  updated_at timestamptz
);
```

**Current Columns**:
- `id` - user ID (FK to auth.users)
- `username` - unique, lowercase
- `display_name` - optional full name
- `bio` - optional bio text
- `avatar_url` - storage URL
- `theme` - JSON string of theme config
- `created_at`, `updated_at` - timestamps

**Notable Absence**: No `verified` column exists

### Blocks Table

```sql
create table public.blocks (
  id uuid primary key,
  user_id uuid references auth.users(id),
  type text check (in 'link', 'text', 'heading', 'divider', 'widget'),
  position integer,
  title text,
  url text,
  icon text,
  content text,
  meta jsonb,
  visible boolean,  -- inferred from read logic
  widget_kind text check (...all widget kinds...),
  created_at timestamptz
);
```

**For Widgets**:
- `type = 'widget'` → `widget_kind` must be non-null
- `meta` stores size + widget-specific fields

### Constraints for New Widgets
- Add to `blocks_widget_kind_check` constraint
- Schema file location: `supabase/07_widgets.sql`

---

## 6. WIDGET RESOLUTION & RESOLVER PATTERN

### Located File
`src/lib/widgets/resolve.ts`

### Resolver Function Signature

```typescript
export function resolveWidget(
  kind: WidgetKind | "auto",
  input: string
): ResolveResult;

type ResolveResult = 
  | { kind: WidgetKind; meta: Record<string, unknown>; title: string | null }
  | { error: string };
```

### Resolution Pattern (Example: Twitch)

```typescript
if (kind === "twitch_live") {
  const channel = parseTwitchChannel(trimmed) ?? trimmed.toLowerCase();
  if (!/^[a-zA-Z0-9_]{3,25}$/.test(channel)) {
    return { error: "Enter a Twitch channel name or twitch.tv URL" };
  }
  return { kind, meta: { channel }, title: channel };
}
```

**Steps**:
1. Parse input (URL extract, handle cleanup)
2. Validate against format rules
3. Return error if invalid
4. Return resolved `{ kind, meta, title }`

### Auto-Detection
`detectWidgetFromUrl()` in `src/lib/widgets/detect.ts`:
- Tests input against known URL patterns
- Returns `{ kind, meta, label }` or null

---

## 7. WIDGET RENDERING PATTERN

### Located Files
- `src/components/widgets/` - 14 widget renderers
- `src/components/profile-render.tsx` - widget router

### Widget Component Interface (Example: TwitchLiveWidget)

```typescript
function TwitchLiveWidget({
  channel: string;
  data: TwitchLiveData | null;
  theme: Theme;
  size?: "compact" | "default" | "featured";
  preview?: boolean;
}: {/* ... */})
```

**Parameters**:
- `channel` / widget-specific ID extracted from meta
- `data` - live-fetched widget data (or null if unavailable)
- `theme` - theme object for styling
- `size` - layout size from meta.size
- `preview` - disable links in preview mode

**Sizes**:
- `compact` - single-line, ellipsis text, minimal spacing
- `default` - multi-line card with metadata
- `featured` - large card with thumbnail (if available)

**Fallback Handling**:
- If `data` is null, shows "Channel not found" or offline state
- Links always point to external platform

### Router Logic

The profile-render component has a massive switch statement that routes each widget kind to its renderer, extracting meta and calling the renderer with theme + data.

---

## SUMMARY: NEW WIDGET TEMPLATES

Based on exploration, here's the template for adding new widget types:

### 1. **types.ts** - Add to `WidgetKind` union and define data interface
### 2. **07_widgets.sql** - Extend constraint with new kind
### 3. **resolve.ts** - Add resolution logic for parsing input
### 4. **components/widgets/** - Add renderer component
### 5. **profile-render.tsx** - Add router case
### 6. **block-list.tsx** - Add to WidgetPicker UI
### 7. **picker-specs.ts** (optional) - Add label/placeholder for canvas picker

---

## DATABASE CHANGES NEEDED

### For Verified Badge

**Add column to profiles table**:
```sql
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false;
```

**Frontend changes**:
- Update profile queries to include `verified`
- Show badge UI in profile header (next to name)
- Badge styling: icon or checkmark indicator

### For Cross-Promotion / Stream Schedule

**Option 1: Store as widget blocks**
- Simplest: create new widget types with meta containing target/config
- No new table needed

**Option 2: New dedicated table**
```sql
CREATE TABLE IF NOT EXISTS public.creator_partnerships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  partner_username text NOT NULL,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

---

## KEY FINDINGS

1. **Modular widget system**: Each widget is independent, resolver pattern is clean
2. **Size flexibility**: Supports compact/default/featured for responsive layouts
3. **Live data cached**: Server-side fetch at request time, Next.js fetch cache
4. **Block creation**: Two flows (simple blocks vs. widget blocks with resolution)
5. **Meta is flexible JSONB**: Can store any widget-specific data
6. **No verified badge yet**: Will need new column + frontend badge UI
7. **OG image is 1200×630**: Satori doesn't support complex layouts; Instagram Story would be separate route
8. **Public page is very clean**: Minimal header, blocks list, powered-by footer

---

## FILES TO MODIFY FOR NEW FEATURES

| Feature | Key Files |
|---------|-----------|
| Stream Schedule Widget | types.ts, resolve.ts, components/widgets/stream-schedule.tsx, profile-render.tsx, block-list.tsx, 07_widgets.sql |
| Cross-Promo Widget | Same pattern |
| Verified Badge | 02_app_schema.sql (add column), profile-render.tsx (badge UI) |
| Instagram Story OG | Create new route: /api/story/[username]/route.tsx |

---

**Exploration completed** — codebase is well-structured with clear patterns for adding new widget types and profile features.
