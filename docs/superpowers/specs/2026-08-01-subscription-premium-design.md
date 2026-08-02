# Subscription, Registration & Premium Content — Design Spec

**Date:** 2026-08-01  
**Status:** Approved  
**Scope:** Native iOS/Android (`mobile/`), API (`artifacts/api-server/`), admin (`web-admin/`), shared DB (`lib/db/`)

## Summary

Shift Get Praying from a **hard paywall** (subscribe before use) to a **freemium** model:

- Register → verify → onboarding → **immediate free app access**
- **One lifetime free Prayer Boost** per account (server-tracked)
- **Soft subscription prompts** (boost exhausted, recurring 7-day, premium content play)
- **Per-item premium flags** on library *and* community content — visible, playback locked
- **No store intro trial** — Subscribe charges $6.99/month immediately
- Legacy webhook `trial` tier treated as subscribed for access until EXPIRATION

---

## 6.1 — Remove seven-day trial from onboarding

### Requirement
Remove mandatory subscription/trial from registration. Users create an account, complete registration, and enter the app on the free tier without auto-enrolling in a store trial.

### Design
- **Remove** hard paywall from `getPostAuthRoute` — post-auth path: verify → onboarding → tabs
- **Remove** `EntitlementGate` redirect to paywall — free users access all non-premium surfaces
- Paywall is **soft-only** (`/(paywall)?soft=1` or modal) — opened from prompts, never forced
- **Store config:** Remove intro pricing from App Store Connect, Google Play, RevenueCat, `Configuration.storekit`
- Deprecate `isHardPaywallRoute`, gated welcome UI on `index.tsx`

### Non-goals (Phase 1)
Paywall copy cleanup (trial language) ships in Phase 3 with prompt sheet.

---

## 6.2 — One free Prayer Boost

### Requirement
Each registered user gets **one** free Boost, account-linked, persistent across logout/reinstall/device change. After use, show spec prompt; Not Now sends no boost. Subscribers get unlimited boosts.

### Design

**DB:** Rename `trial_boost_used_at` → `free_boost_used_at` (migration + data copy).

**Eligibility (`boostEligibility.ts`):**

| Tier | Boost |
|------|-------|
| `free` | Once if `free_boost_used_at IS NULL` and no pending `boost_requested` |
| `premium` or legacy `trial` | Unlimited |
| `admin` | Unlimited |

**All users** (including legacy trial subscribers) use the **one-free-boost** model for consistency — existing users who already used `trial_boost_used_at` keep that timestamp migrated to `free_boost_used_at`.

**Client:** `canUseBoost` = subscribed unlimited OR free with quota. Free boost does **not** require RevenueCat entitlement.

**Prompt copy (exact):**
> **You've Used Your Free Prayer Boost**  
> Subscribe to Get Praying for unlimited Prayer Boosts…  
> `<Subscribe Now — $6.99/month>` / `<Not Now>`

---

## 6.3 — Recurring seven-day subscription prompt

### Requirement
Non-subscribers see a dismissible prompt first at day 7 after account creation, then every 7 days on app open/login. `<X>` = days since join (`users.created_at`).

### Design

**DB:** `subscription_prompt_last_shown_at timestamptz`

**Schedule (`subscriptionPromptSchedule.ts`):**
```
due = !subscribed
  AND daysSince(createdAt) >= 7
  AND (lastShown IS NULL OR daysSince(lastShown) >= 7)
```

**API:** `/auth/me` returns `{ daysSinceJoined, recurringPromptDue }`; `POST /subscription/prompt-dismissed` sets `last_shown`.

**Mobile:** Single `useSubscriptionPrompts` coordinator — once per session at root; dismiss persists server-side.

---

## 6.4 — Premium content (library + community)

### Requirement
Admins mark content Free or Premium. Applies to prayers, audio, video, messages, celebrity/faith-leader/library content. Visible to free users; playback/full access locked.

### Scope (user decision)
Premium flags apply to **all content types**, not library-only:

| Entity | Table | Flag |
|--------|-------|------|
| Official prayers / lectures | `official_prayers` | `is_premium` |
| Lecture tracks | `lecture_tracks` | `is_premium` (or inherit parent) |
| Prayer paths | `prayer_paths` | `is_premium` (optional path-level) |
| Community posts | `posts` | `is_premium` |

**Admin:** Toggle in web-admin CMS — no app release required.

**API:** Return `isPremium` in list/detail; **strip media URLs** for non-subscribers on premium items (prevent API bypass).

**Mobile UI:** Lock icon + "Premium" badge on cards, detail, near play button.

### Text preview (user decision)
Free users may read **partial** text — teaser visible, remainder blurred/truncated at a smart cutoff (not arbitrary character count):

- Prefer break after ~2–3 paragraphs or ~40% of content, whichever comes first
- Never cut mid-word; prefer paragraph boundary
- Server may return `contentPreview` + `contentLocked: true` for premium items when unsubscribed
- Full text unlocks on subscribe

---

## 6.5 — Premium content subscription prompt

On play tap for premium content without subscription → show prompt (no playback). Not Now → stay on detail. Successful purchase → unlock and play (or enable play button).

**Copy (exact):**
> **This Content Is Premium Prayer Content**  
> Subscribe to access exclusive prayers and messages…  
> `<Subscribe Now — $6.99/month>` / `<Not Now>`

---

## 6.6 — Subscription access & restoration

### `isSubscribed` (single helper)
```ts
isSubscribed = staff OR rc.hasPremiumEntitlement OR server tier in (premium, trial)
```
Legacy `trial` webhook tier ≡ subscribed for access until EXPIRATION event.

### After purchase
Immediate: unlimited boosts, premium content, suppress recurring prompts.

### Restoration
- `Purchases.logIn(userId)` on auth
- **Restore Purchases** in Settings + paywall footer
- Webhook remains source of truth for DB tier; RC for client entitlement

### Revocation
Only `EXPIRATION` → `free`. Ignore `CANCELLATION` / `BILLING_ISSUE` for tier (grace period).

---

## Prompt coordinator (anti-glitch)

Priority per session (user-initiated beats system):

1. Premium play prompt
2. Free boost exhausted prompt
3. Recurring 7-day prompt

Never stack modals. Dismissal persists before next show.

---

## Migration notes

- `trialStartsAt` → unused; use `createdAt` for "X days praying"
- `trial_boost_used_at` → `free_boost_used_at`
- Legacy trial subscribers: migrated timestamp; one-free-boost if not yet used
- Remove all "7 days free" product copy after store intro removal

---

## Testing invariants

- Free user: register → tabs, no paywall
- Free boost: once per account, survives reinstall (server)
- Recurring prompt: day 6 no, day 7 yes, dismiss → 7-day cooldown
- Premium: visible + badge, play blocked, URL stripped server-side
- Subscribe → immediate unlock
- Restore purchases works from Settings
