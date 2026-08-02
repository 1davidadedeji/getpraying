# Subscription & Premium Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freemium model — free app access, one account-linked boost, soft prompts, per-item premium locks on library and community content.

**Architecture:** Server-authoritative boost quota and prompt schedule; RevenueCat for purchase/restore; shared `SubscriptionPromptSheet` with three variants; premium flags on DB entities with server-side media URL stripping.

**Tech Stack:** Expo/React Native, Express API, Drizzle/Postgres, RevenueCat, web-admin Next.js

## Global Constraints

- Native iOS/Android only — no web-only UX
- Subscribe = **$6.99/month immediately** — no store intro trial
- Boost is opt-in only (`applyBoost: true`) — never auto-boost
- Post-auth navigation: single decider (`navigateAfterAuth.ts`) + executor (`postAuthNavigator.ts`)
- Only `EXPIRATION` webhook revokes subscription tier
- Legacy `trial` tier ≡ subscribed for access until expiration
- One free boost per account for **all** users (including migrated trial users)
- Premium scope: library **and** community posts

---

## Phase 1 — Remove hard paywall ✅ (this PR)

### Task 1: Navigation decider

**Files:**
- Modify: `mobile/lib/navigateAfterAuth.ts`
- Modify: `mobile/lib/navigateAfterAuth.test.ts`

- [x] Remove paywall branch from `getPostAuthRoute` — no RC wait for routing
- [x] Deprecate `HARD_PAYWALL_ROUTE` / `isHardPaywallRoute`
- [x] Add tests: verified free user → onboarding or tabs

### Task 2: Entitlement gate → deferred nav only

**Files:**
- Modify: `mobile/lib/entitlementGate.ts`
- Modify: `mobile/components/EntitlementGate.tsx`

- [x] `userNeedsEntitlementGate` always `false`
- [x] Remove `<Redirect href="/(paywall)" />` and gate loading splash
- [x] Keep deferred deep-link / push navigation effect

### Task 3: Welcome screen

**Files:**
- Modify: `mobile/app/index.tsx`

- [x] Remove gated-at-paywall UI and `isHardPaywallRoute` checks
- [x] Signed-in users redirect to onboarding/tabs via splash

### Task 4: Paywall soft-only

**Files:**
- Modify: `mobile/app/(paywall)/index.tsx`

- [x] Remove `isMandatoryGate` — always dismissible
- [x] Dismiss fallback → `/(tabs)` for signed-in users

### Task 5: Cursor rules

**Files:**
- Modify: `.cursor/rules/post-auth-navigation.mdc`
- Modify: `.cursor/rules/subscription-and-boost.mdc`

- [x] Document freemium model; remove hard paywall invariants

---

## Phase 2 — Free Prayer Boost

### Task 6: DB migration

**Files:**
- Create: `lib/db/drizzle/00XX_free_boost_and_prompt.sql`
- Modify: `lib/db/src/schema/users.ts`

- [ ] Rename `trial_boost_used_at` → `free_boost_used_at`
- [ ] Add `subscription_prompt_last_shown_at`

### Task 7: Server boost eligibility

**Files:**
- Modify: `artifacts/api-server/src/lib/boostEligibility.ts`
- Modify: `artifacts/api-server/src/lib/autoBoost.ts`
- Rename: `trialBoostQuota.ts` → `freeBoostQuota.ts`
- Modify: `artifacts/api-server/src/routes/auth.ts`
- Test: `boostEligibility.test.ts`

- [ ] Free tier: one boost; premium/trial/admin: unlimited
- [ ] `/auth/me`: `freeBoostUsed` replaces `trialBoostUsed`

### Task 8: Client boost

**Files:**
- Modify: `mobile/lib/serverSubscription.ts`
- Modify: `mobile/context/revenuecat.tsx`
- Modify: `mobile/app/post/new.tsx`
- Modify: `mobile/lib/boostTrial.ts` → rename `freeBoost.ts`

- [ ] `canUseBoost` without RC for free quota
- [ ] Stub prompt modal (Alert → sheet in Phase 3)

---

## Phase 3 — Subscription prompts

### Task 9: Prompt schedule (server)

**Files:**
- Create: `artifacts/api-server/src/lib/subscriptionPromptSchedule.ts`
- Create: `artifacts/api-server/src/lib/subscriptionPromptSchedule.test.ts`
- Modify: `artifacts/api-server/src/routes/auth.ts` (dismiss endpoint)

### Task 10: Prompt UI (mobile)

**Files:**
- Create: `mobile/components/SubscriptionPromptSheet.tsx`
- Create: `mobile/hooks/useSubscriptionPrompts.ts`
- Create: `mobile/lib/subscriptionAccess.ts`
- Modify: `mobile/app/_layout.tsx`

- [ ] Three variants with exact spec copy
- [ ] Coordinator: one modal per session
- [ ] Paywall: remove trial copy; $6.99/month CTA

---

## Phase 4 — Premium content flags

### Task 11: Schema + admin

**Files:**
- Migration: `is_premium` on `official_prayers`, `lecture_tracks`, `posts`
- Modify: `web-admin/.../official-prayers/` forms
- Modify: `artifacts/api-server/src/routes/admin.ts`, `library.ts`, `posts.ts`

### Task 12: Content preview + URL strip

**Files:**
- Create: `artifacts/api-server/src/lib/premiumContentAccess.ts`
- Create: `artifacts/api-server/src/lib/contentPreview.ts`

- [ ] Paragraph-boundary teaser for text
- [ ] Omit `audioUrl` / media URLs when locked

### Task 13: Mobile premium UI

**Files:**
- Create: `mobile/components/PremiumBadge.tsx`
- Modify: `OfficialGuideCard`, `library.tsx`, `official/[id].tsx`, `PostCard.tsx`
- Modify: `CapsuleAudioPlayer`, `LectureTrackList`

---

## Phase 5 — Restore + store config + tests

### Task 14: Restore purchases UI

**Files:**
- Modify: Settings screen, `(paywall)/index.tsx`

### Task 15: Store removal

- [ ] App Store Connect / Play Console — remove intro offer
- [ ] `mobile/Configuration.storekit`
- [ ] RevenueCat dashboard

### Task 16: Rules + integration tests

**Files:**
- Create: `.cursor/rules/subscription-prompts.mdc`
- Create: `.cursor/rules/premium-content.mdc`

---

## Self-review checklist

| Spec section | Phase |
|--------------|-------|
| 6.1 No hard paywall | 1 |
| 6.2 Free boost | 2–3 |
| 6.3 Recurring prompt | 3 |
| 6.4 Premium flags | 4 |
| 6.5 Premium play prompt | 3–4 |
| 6.6 Restore/access | 5 |
