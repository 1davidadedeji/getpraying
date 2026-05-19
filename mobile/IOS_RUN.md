# Running on iOS simulators and devices (Expo)

## `xcodebuild` / destination not found (e.g. error 70)

 Xcode can fail with **destination id … not found** or **“Any iOS Device” ineligible** when the **simulator runtime** selected for the build is not installed (messages may mention a specific iOS version, e.g. iOS 26.x).

**Fix:**

1. **Install the runtime:** Xcode → **Settings** → **Platforms** (or **Components** on older Xcode) → download the **iOS** simulator platform version you need.
2. **Or** target a simulator you already have:
   - List devices: `xcrun simctl list devices available`
   - Run Expo against it, for example:  
     `cd mobile && npx expo run:ios --device "iPhone 16"`  
     (Use a name that appears in the list on your machine.)
3. **Physical device:** connect the device, trust the computer, and run:  
   `npx expo run:ios --device`

This repo does not pin an exotic iOS **deployment target** in `app.json` for simulators; failures are usually **missing Simulator runtime** or an invalid **destination** passed to `xcodebuild`.

## Quick check

From the repo root:

```bash
cd mobile && pnpm exec expo run:ios
```

If the default destination fails, pass `--device "<Simulator Name>"` as above.

## Universal Links (open shared prayers in the app)

Shared prayers use **`https://getpraying.app/post/{id}`** (see `lib/publicWebOrigin.ts`). Production builds declare:

- **iOS:** `associatedDomains`: `applinks:getpraying.app` (in `app.json`).
- **Android:** `intentFilters` for `https://getpraying.app/post` (and `www`).

Apple and Google **must** be able to fetch verification files **on `getpraying.app`**:

- **`https://getpraying.app/.well-known/apple-app-site-association`** (no extension, correct `Content-Type`, includes your Team ID + bundle id `com.getpraying.app`).
- **`https://getpraying.app/.well-known/assetlinks.json`** for the Android signing cert fingerprints.

Until those are live, taps may open Safari/Chrome instead of the app; the **`getpraying://`** scheme still works from other entry points Expo registers.
