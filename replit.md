# GetPraying Workspace

## Overview

pnpm workspace monorepo using TypeScript. A spiritual social community app — like Twitter but for prayer.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/getpraying)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Custom session-based auth (bcryptjs + session tokens in DB)
- **Validation**: Zod (zod/v4), drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (API), Vite (frontend)

## Features

- Twitter-style prayer feed with moderation (posts need admin approval)
- Prayer reactions ("pray for" = flame icon, replaces likes)
- Prayer Library: official curated prayers, paths/journeys, saved scrolls
- Prayer categories: auto-detected from content (Anxiety, Gratitude, Healing, Guidance, etc.)
- User profiles with stats (prayers shared, prayed for, saved scrolls)
- Admin moderation panel (approve/decline posts, ban users)
- Notifications (prayer alerts, category updates, reminders)
- Onboarding flow with category preference selection
- Anonymous posting option

## Structure

```text
artifacts/
├── api-server/         # Express API server
│   ├── src/routes/     # auth, users, posts, library, notifications, admin
│   └── src/lib/        # auth.ts, postHelpers.ts, logger.ts
└── getpraying/         # React + Vite frontend
    └── src/
        ├── pages/      # splash, login, register, onboarding, home, post, library, notifications, profile, admin
        ├── components/ # layout (bottom nav), post-card, etc.
        └── hooks/      # use-auth.tsx (auth context)
lib/
├── api-spec/           # OpenAPI spec + Orval codegen config
├── api-client-react/   # Generated React Query hooks
├── api-zod/            # Generated Zod schemas
└── db/                 # Drizzle ORM schema
    └── src/schema/
        ├── users.ts
        ├── posts.ts
        └── prayers.ts  # official_prayers, prayer_paths, post_prayers, saved_posts, notifications, sessions
```

## Demo Credentials

- Admin: admin@getpraying.com / admin123
- User: sarah@example.com / prayer123
- User: marcus@example.com / prayer123

## Admin Access

Login with admin@getpraying.com then navigate to /admin for the moderation panel.

## Root Scripts

- `pnpm run build` — typecheck + build all packages
- `pnpm run typecheck` — full typecheck

## Packages

### `artifacts/api-server`
Express 5 API at /api. Session auth via Bearer token + HTTP-only cookie.

### `artifacts/getpraying`
React + Vite SPA. Mobile-first layout (max-width ~430px). Bottom nav bar.
Palette: deep navy (#1a1f36) + soft cream/linen backgrounds.

### `lib/db`
Schema: users, posts, post_prayers, saved_posts, official_prayers, prayer_paths, notifications, sessions.
Push: `pnpm --filter @workspace/db run push`

### `lib/api-spec`
OpenAPI 3.1 spec with full CRUD + moderation + library endpoints.
Codegen: `pnpm --filter @workspace/api-spec run codegen`
