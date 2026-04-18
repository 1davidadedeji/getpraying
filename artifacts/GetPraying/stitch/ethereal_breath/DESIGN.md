# Design System Specification: Editorial Serenity

## 1. Overview & Creative North Star
**The Creative North Star: "The Digital Sanctuary"**

This design system rejects the frantic, high-contrast patterns of modern social media. Instead, it adopts a "Digital Sanctuary" aesthetic—an editorial-inspired framework that prioritizes breath, contemplation, and emotional safety. 

To move beyond a "template" look, we employ **Intentional Asymmetry**. Prayer text and headers should not always be centered; use the generous spacing scale to allow content to sit off-center, creating a sense of organic movement. We replace rigid structural lines with **Tonal Layering**, treating the UI as a series of soft, overlapping vellum sheets rather than a flat digital grid.

---

## 2. Colors & Surface Philosophy
The palette is rooted in atmospheric light. We avoid "Pure Black" (#000000) entirely to prevent visual fatigue, opting instead for deep charcoals and muted blues for text.

### The "No-Line" Rule
**Strict Mandate:** Designers are prohibited from using 1px solid borders for sectioning or containment. 
*   **The Alternative:** Boundaries must be defined solely through background color shifts. For example, a `surface-container-low` card sitting on a `surface` background provides all the separation a user needs. If a container feels "lost," increase the spacing around it rather than adding a line.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of materials. 
*   **Level 0 (The Foundation):** `surface` (#faf9f8).
*   **Level 1 (The Content Area):** `surface-container-low` (#f4f3f2).
*   **Level 2 (The Interactive Card):** `surface-container-lowest` (#ffffff) for maximum "lift" and purity.
*   **Level 3 (The Accented Moment):** `primary-container` (#e5f1ff) for focused prayer sessions.

### Signature Textures: The "Aura" Gradient
To prevent the UI from feeling "flat" or "sterile," use subtle radial gradients.
*   **The Soul Gradient:** Transition from `primary` (#21638d) to `primary-container` (#e5f1ff) at a 45-degree angle for primary CTAs. This mimics the soft glow of a morning sky.

---

## 3. Typography
We use a high-contrast typographic scale to create an editorial feel, pairing the timeless authority of a serif with the modern clarity of a geometric sans-serif.

*   **The Scriptural Voice (Noto Serif):** Used for `display` and `headline` roles. This font carries the emotional weight of the prayer. Use `display-lg` (3.5rem) for opening "Daily Bread" moments to make the text feel like a physical art piece.
*   **The Functional Voice (Plus Jakarta Sans):** Used for `title`, `body`, and `label` roles. This typeface is clean, soft, and highly legible, ensuring that UI navigation never distracts from the spiritual content.

**Editorial Tip:** Use `body-lg` with increased line-height (1.6 or 1.8) for long-form prayers to enhance readability and "breathing room."

---

## 4. Elevation & Depth
We define depth through light and shadow, never through lines.

### The Layering Principle
Stacking `surface-container` tiers creates natural depth. 
*   **Example:** Place a `surface-container-highest` navigation bar over a `surface` background. The subtle shift in tone creates a clear hierarchy without visual noise.

### Ambient Shadows
When an element must "float" (like a FAB or a prayer card), use **Ambient Shadows**:
*   **Blur:** 40px to 60px.
*   **Opacity:** 4% - 8%.
*   **Color:** Use a tinted shadow (`#21638d` at 5% opacity) rather than grey to maintain the "Peaceful" vibe.

### Glassmorphism & Depth
For overlays and modals, use **Backdrop Blur** (12px - 20px) combined with a semi-transparent `surface-container-lowest`. This allows the colors of the underlying prayer or image to bleed through, softening the edges of the UI and making the experience feel integrated and ethereal.

---

## 5. Components

### Cards & Lists
*   **Rule:** Forbid the use of divider lines. 
*   **Styling:** Use `surface-container-low` for card backgrounds. 
*   **Rounding:** Always use `lg` (2rem/32px) or `xl` (3rem/48px) corner radii. This creates a "pebble" feel that is gentle to the touch.
*   **Spacing:** Use `spacing-6` (2rem) between cards to allow the background to flow between elements.

### Buttons (The "Soft-Touch" CTA)
*   **Primary:** Background: `primary` (#21638d); Text: `on-primary` (#ffffff). Shape: `full` (pill).
*   **Secondary:** Background: `tertiary-fixed` (#ffe088); Text: `on-tertiary-fixed` (#241a00). Use for "Gold Accent" moments like 'Amen' or 'Support'.
*   **Tertiary:** Ghost style. No background. Use `primary` text.

### Input Fields
*   **Styling:** Use `surface-container-high` for the field fill. No border.
*   **Focus State:** Instead of a heavy border, use a subtle 2px "Ghost Border" using `outline` at 20% opacity and a soft glow of `primary-fixed`.

### Sanctuary Specific Components
*   **The "Breath" Indicator:** A slow-pulsing circular component using `primary-container` with a `backdrop-blur`.
*   **Prayer Progress:** A thin, non-intrusive line at the top of a card using a gradient from `primary-fixed` to `tertiary-fixed`.

---

## 6. Do's and Don'ts

### Do:
*   **Do** use intentional whitespace. If a screen feels crowded, remove a component rather than shrinking it.
*   **Do** use `notoSerif` for any text meant for reflection.
*   **Do** use `surface-container` tiers to create hierarchy.
*   **Do** ensure all interactive elements have a minimum touch target of 48px, following the `spacing-8` scale.

### Don't:
*   **Don't** use 1px borders or lines.
*   **Don't** use pure black (#000) or aggressive red. For errors, use the muted `error` (#ba1a1a) with a `surface-container` background.
*   **Don't** use hard corners. Nothing in the "Sanctuary" should feel sharp.
*   **Don't** use "Drop Shadows." Use "Ambient Glows."