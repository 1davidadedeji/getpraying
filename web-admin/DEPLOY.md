# Deploying web-admin (Vercel)

This repo has **one** admin CMS UI: the Next.js app in `web-admin/`. The mobile in-app admin under `mobile/_archived/admin/` is not deployed.

## Vercel project settings

| Setting | Value |
|---------|--------|
| **Root Directory** | `web-admin` |
| **Framework Preset** | Next.js |
| **Node.js** | 22.x (match repo) |
| **Production branch** | `main` |

`vercel.json` in this folder sets monorepo-friendly install/build commands. Vercel runs builds with `web-admin` as the working directory, but **pnpm install must run from the repo root** so workspace packages resolve.

## Environment variables

Set in Vercel → Project → Settings → Environment Variables:

| Variable | Example | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.getpraying.com` | Yes |

Optional: `NEXT_ASSET_PREFIX` only if you serve static assets from a CDN (see `.env.local.example`).

## Local verify before deploy

```bash
cd web-admin
corepack pnpm run build
```

## Troubleshooting failed builds

1. **Check the Git commit SHA** on the deployment — lectures TypeScript fix is in `d58d449` and later (`LectureFormDraft`, not `Partial<Lecture>`).
2. **Redeploy** latest `main` if an older commit (e.g. `d79b25f`) was built.
3. Confirm **Root Directory** is `web-admin`, not the repo root (repo root `pnpm run build` typechecks the whole monorepo, not just Next.js).
