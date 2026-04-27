# GetPraying — Local setup & APK testing

This repo is a **pnpm monorepo**: API (`artifacts/api-server`), mobile app (`mobile/`), shared DB (`lib/db`), and generated API clients.

**Product scope:** the shipped client is the **native mobile app** (iOS/Android). The API server is the backend. Do not treat web as a supported surface; `react-dom` may appear only to satisfy Expo Router peer dependencies.

**Push notifications:** after pulling, apply migration `0013_users_expo_push_token.sql` (see the database section below). Rebuild the app with EAS so `expo-notifications` native code is included. Android store builds need FCM configured in EAS/Google Cloud as per Expo docs.

## What you already configured

If these are set, you are past the first hurdle:

| Location | Typical variables |
|----------|-------------------|
| **Repo root** `.env` | `DATABASE_URL`, `OPENAI_API_KEY`, and optionally `EXPO_PUBLIC_API_BASE_URL` (root copy is mainly for docs; the **API** loads root `.env` when you run the server from the repo.) |
| **`mobile/.env`** | `EXPO_PUBLIC_API_BASE_URL` (must match a URL the **phone** can reach when testing a real build) |

## Next line of action (ordered)

### 1. Install dependencies

From the repo root:

```bash
corepack enable
corepack pnpm install
```

### 2. Apply the database schema

The API expects PostgreSQL with all tables and columns from the Drizzle migrations under `lib/db/drizzle/`.

**Option A — Drizzle push** (good for dev; syncs schema from code):

```bash
cd lib/db
# Ensure DATABASE_URL is set (e.g. export from root .env or use dotenv)
corepack pnpm run push
```

**Option B — Run SQL migrations manually** on your hosted Postgres (good for production): execute the `.sql` files in `lib/db/drizzle/` in numeric order (`0000_…`, `0001_…`, …).

### 3. Build and run the API

```bash
cd artifacts/api-server
corepack pnpm run build
corepack pnpm run start
```

Or use `pnpm run dev` if you use that script locally. Confirm the server is reachable at the same origin you put in `EXPO_PUBLIC_API_BASE_URL`.

**SendGrid (optional):** Add `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL` to root `.env` if you want real verification emails. If omitted, OTPs are usually logged to the **API server console** for testing.

### 4. Run the mobile app (Expo)

```bash
cd mobile
corepack pnpm run dev
```

- **Simulator / same machine:** `http://localhost:3001` or `http://127.0.0.1:3001` can work with the correct port.
- **Physical device or APK:** Use your machine’s **LAN IP** or a **public HTTPS** API URL, e.g. `http://192.168.1.x:3001` or `https://api.example.com`. `localhost` on the device points at the phone, not your PC.

### 5. RevenueCat (Android IAP / paywall)

For a **real** subscription test on Android, set in **`mobile/.env`** (and rebuild the app so `EXPO_PUBLIC_*` is embedded):

- `EXPO_PUBLIC_RC_GOOGLE_KEY` — RevenueCat **public** SDK key for Google Play.

`EXPO_PUBLIC_RC_APPLE_KEY` is for iOS only.

If these are empty, the app should still run; paywall / entitlement behavior will not match production until keys and Play + RevenueCat products are configured.

### 6. Build an APK for testing

`mobile/eas.json` is committed (preview profile builds an **APK**). Typical path:

1. Install [EAS CLI](https://docs.expo.dev/build/introduction/) and log in.
2. From the repo root, run **`corepack pnpm run eas:android`** (runs EAS with `mobile/` as the project directory), **or** `cd mobile` and run `eas build -p android --profile preview`.
3. Override env via **EAS secrets** if you do not want the defaults in `mobile/eas.json` (e.g. `EXPO_PUBLIC_API_BASE_URL`, RevenueCat keys).

Use an **internal testing** track and **license testers** in Play Console for purchase testing.

### 7. Verify end-to-end

- Register → email verification (or read OTP from API logs if SendGrid is off).
- Feed, new post, comments on a post, save / pray actions.
- Paywall: only after you set RevenueCat + trial logic as designed.

## Reference: environment variables

See **`.env.example`** (repo root) and **`mobile/.env.example`** for the full list with short comments.

## Useful commands

| Command | Purpose |
|---------|---------|
| `corepack pnpm run typecheck` (root) | Typecheck libs + artifacts |
| `corepack pnpm --filter @workspace/api-server run build` | Build API |
| `corepack pnpm --filter @workspace/api-server run seed:lib-pg` | Reseed official prayers (needs MP3s in `artifacts/api-server/data/seed-audio`) |
| `corepack pnpm --filter @workspace/mobile run dev` | Start Expo |

## Troubleshooting

- **Windows: empty `artifacts/mobile` folder won’t delete:** Something still has a handle on it (IDE tab, Metro, or `eas build`). Close those, then remove the folder manually. The app lives under **`mobile/`** at the repo root; the old path should not exist after a clean pull.
- **Mobile cannot reach API:** Check firewall, same Wi‑Fi, and that `EXPO_PUBLIC_API_BASE_URL` uses the host the device can resolve (not `localhost` on a physical phone).
- **DB errors on API start:** `DATABASE_URL` must be set where the Node process runs; run migrations / `drizzle-kit push`.
- **AI category fails:** Confirm `OPENAI_API_KEY` on the **API** server process.
