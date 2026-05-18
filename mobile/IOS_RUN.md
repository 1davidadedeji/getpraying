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
