---
name: myui
description: Generate, polish, or refine UI components in the user's project with in-app variant preview via myui-sh.
---

# myui skill

Use this skill when a user asks to generate, redesign, or polish a UI section and wants to compare variants in their running app via `<MyuiOverlay />` + `<MyuiSlot />`.

Goal: ship **outstanding** UI every time — not generic, not safe. Each variant must be a considered design decision, not a recolor of the same idea.

---

## 0. Required context (gather first, no exceptions)

1. target file and exact region
2. user prompt text (verbatim)
3. variant count (default 3)
4. project root
5. user references (URLs, screenshots, "like X app") — ask if absent and the brief is vague

---

## 1. Pre-flight — MANDATORY before writing any variant

Run the preflight script first. One command gathers tokens, sample components, config, and references:

```
node ~/.copilot/skills/myui/scripts/preflight.mjs <project-root> --near <relative-target-file> --prompt-hint "<user prompt summary>"
```

Returns JSON with: `framework`, `componentLibs`, `iconLibs`, `tokens[]`, `references[]`, `screenshots[]`, `components[]`, `config`, `slots`, `notes[]`, `cacheHit`, `cachePath`.

Speed defaults:
- Keep cache enabled (default). Preflight now reuses `.myui/cache/preflight.json` when project inputs are unchanged.
- Use `--no-cache` only if you just changed design tokens/references and need a forced refresh.

Read the full JSON. Then:

1. **Check CLAUDE.md** for `REQUIRED` project conventions (not covered by preflight).
2. **Follow every `notes[]` entry** — each is a gap the model must address before coding.
3. **View reference screenshots** — if `screenshots[]` is non-empty, view **every** entry returned (preflight already filtered to ≤3 matching your prompt). Open each `absolutePath` with your file-reading tool and visually study it before writing any code. They define layout density, whitespace rhythm, and visual language. Do not skip.
4. If preflight returns empty `tokens[]` AND empty `references[]` AND the brief is vague — ask ONE focused question (aesthetic anchor + density). Do not guess house style.

Skipping preflight = generic output. Do not skip.

---

## 2. Taste declaration (output before code)

Commit to a direction. Print this block in your response before any variant code:

```
Aesthetic:  <e.g. Vercel-minimal | Linear-dense | Stripe-editorial | Arc-playful | brutalist | editorial>
Density:    <comfortable | compact | spacious>
Motion:     <none | subtle | expressive>
Hierarchy:  <typography-led | color-led | space-led | asymmetry-led>
Primitives: <shadcn | radix | custom:name>
Icons:      <lucide-react | @phosphor-icons/react | hugeicons-react | project default>
MotionLib:  <framer-motion | motion-primitives | none> (check preflight componentLibs)
Spacing:    <section: py-24 lg:py-32 | card-gap: gap-6 | inner: p-6>
Radius:     <rounded-xl | rounded-2xl | rounded-lg — ONE value, used everywhere>
Color mode: <light+dark | light-only | dark-only>
```

**Source priority**:
1. Preflight `config.design` (`.myui/config.json` → `design` block) — use these values as defaults.
2. User prompt overrides (if user explicitly says "make it dense", honor it).
3. Inferred from tokens / sample components when config fields empty.
4. Ask the user only if still ambiguous.

No taste block → no code.

---

## 2b. Rule tiers (speed + quality)

Apply rules in tiers to avoid overloading simple requests while preserving premium output on demand.

- **Tier A (always required):** sections 4, 4a, 4b, 5, 6, 7, 9. These are correctness + apply-safety rules.
- **Tier B (default quality):** use restrained polish from 4c for typography, spacing, and opacity depth.
- **Tier C (premium mode):** apply the full 4c animation choreography and interaction microinteractions when:
   - user asks for polished / premium / clean / elegant output, or
   - prompt implies showcase UI (hero, testimonial, landing, marketing, portfolio), or
   - `config.design.motion` is `subtle` or `expressive`.

If the prompt is simple (button, input, small card), keep Tier A + B and skip heavy motion patterns.

---

## 3. Variant differentiation rule

Variants exist to enable a **real choice**, not pick-a-shade. Each variant MUST differ on a different primary axis:

- V1: **layout structure** (stacking, grid, split, sidebar, inline)
- V2: **information hierarchy** (what's primary, what's secondary, what's hidden)
- V3: **interaction model** (static vs progressive disclosure vs inline edit vs modal)

Forbid: same layout + different colors. Forbid: same component tree with font swap.

Name variants semantically in manifest comments — e.g. `// Stacked-dense`, `// Split-progressive`, `// Inline-editorial` — so the overlay preview tells the user what they're judging at a glance.

---

## 4. Quality bar — every variant must include

- **Dark + light mode** (STRICT): every variant MUST work in both `dark` and `light` mode. Use Tailwind `dark:` variants for backgrounds, text, borders, and shadows. Never hard-code `bg-white` or `text-black` without a corresponding `dark:bg-zinc-950` / `dark:text-white`. Test mentally: if the user toggles theme, does every element remain readable and visually correct?
- **States**: empty, loading, error, success — where data-driven
- **A11y**: semantic HTML, ARIA where needed, keyboard nav, visible focus rings, `aria-label` on icon-only buttons, color contrast ≥ WCAG AA in BOTH light and dark mode
- **Responsive**: mobile-first; declare intentional breakpoints — stack on mobile (`< md`), 2-col at `md`, full layout at `lg`. No arbitrary `md:` without a reason
- **Tokens honored**: no hard-coded hex/px outside the project’s scale; use existing spacing/radii/type scale
- **Consistent radius**: use ONE border-radius value from the taste block across all cards, buttons, inputs, and containers. Never mix `rounded-md` and `rounded-xl` in the same variant
- **Consistent spacing**: use the declared section spacing from the taste block. All top-level sections use the same vertical padding
- **Real content**: realistic copy, no "Lorem ipsum", no placeholder emojis unless intentional
- **Motion**: respects `prefers-reduced-motion`; durations 120–240ms for micro, 300–500ms for layout
- **No dead ends**: every interactive element has a defined outcome

### 4a. Apply-safety requirements (STRICT — validator enforces)

The apply-route transplants your component's JSX return into the user's file. To avoid silent data loss, every variant MUST:

- **Start with `"use client"`** on line 1 if it: uses any React hook, has any event handler (`onClick` etc.), or imports a client-only library (`lucide-react`, `@phosphor-icons/react`, `hugeicons-react`).
- **Use `export default function Variant<N>(props?) { ... }`** — no arrow-function default exports, no `const X = ...; export default X`.
- **Keep all logic INSIDE the component body** — no top-level constants, types, interfaces, helper functions, or arrays outside the default-export function. Apply drops them.
- **Single top-level `return`** — put loading/error branches INSIDE the returned JSX using conditional rendering (`{loading ? <Skel/> : <Main/>}`), not as early returns. Multiple top-level returns = apply mis-selects the branch.
- **No top-level ternary returns** — `return cond ? <A/> : <B/>` may truncate. Wrap in parens or use `if (cond) return <A/>; return <B/>;` only when the variant has ONE real return path.

### 4b. Icon import rules

- Only import icons from the libraries listed in preflight `iconLibs[]` (lucide-react, @phosphor-icons/react, hugeicons-react, etc.).
- For lucide-react: the validator checks names against `node_modules/lucide-react/dist/esm/icons/` at validate time and will fail unknown names.
- Prefer text labels over icons when the icon name is uncertain.

### 4c. Polish & refinement rules (Tier B + Tier C)

These rules separate "correct" output from **clean, premium-feeling** UI. Apply to every variant.

**Typography tuning:**
- Large display text (≥ `text-3xl`): use `font-light` or `font-extralight` + `tracking-tight`. Heavy weights at large sizes look clunky.
- Small-caps labels / category tags: use `text-xs tracking-[0.15em] uppercase text-muted-foreground`.
- Body text: `font-normal` only. Never `font-light` below `text-lg`.
- Max 2 font weights per variant (e.g. `font-light` + `font-medium`). A third (`font-semibold`) only for primary CTAs.

**Opacity-based depth (instead of extra colors):**
- Borders: prefer `border-border/50` or `border-border/30` over full-opacity `border-border`. Softer borders feel modern.
- Secondary text: `text-muted-foreground` is fine; for tertiary text use `text-muted-foreground/60`.
- Decorative dividers: use `h-px bg-border/40` or `w-8 h-px bg-muted-foreground/50` as subtle rhythm markers between content groups.
- Shadows: if used, one layer only — `shadow-sm` or `shadow-md shadow-black/5`. Never stack shadows.

**Whitespace as design tool:**
- When in doubt, increase padding — cramped layouts never feel polished.
- Group related items tightly (`gap-2`, `gap-3`), separate sections generously (`gap-12`, `py-24`).
- Use asymmetric grid layouts (`grid-cols-[1fr_auto]`, `grid-cols-[2fr_1fr]`) over equal columns — asymmetry creates visual interest.

**Animation choreography (Tier C; when Motion taste ≠ `none`):**
- Allowed library: `framer-motion` (add to dependencies if used). Tailwind `transition-*` for simple hover/focus states.
- Entrance: `opacity: 0 → 1` + subtle `y: 10–40px → 0`. Use custom easing: `ease: [0.22, 1, 0.36, 1]` for smooth deceleration.
- Stagger siblings: add `delay: index * 0.05` (50ms) per item. Never exceed 300ms total stagger.
- Content swaps: use `<AnimatePresence mode="wait">` with `initial` / `animate` / `exit` for clean enter/leave transitions.
- Image transitions: `filter: "blur(12px)" → "blur(0px)"` + `scale: 1.03 → 1` for a premium reveal.
- Shared layout: use `layoutId` for elements that visually persist across states (active indicators, selection rings).
- Always wrap motion in `@media (prefers-reduced-motion: no-preference)` or use framer-motion's `useReducedMotion()`.
- Durations: hover/focus 150–200ms, entrance 300–500ms, exit 200–300ms. Never exceed 600ms.

**Hover & interaction microinteractions:**
- Buttons/cards: `transition-all duration-200` with opacity or subtle scale (`hover:scale-[1.02]`). Avoid color flash — prefer `hover:bg-muted/50`.
- Reveal-on-hover: use opacity (`opacity-0 group-hover:opacity-100 transition-opacity duration-200`) for secondary actions or labels.
- Active/selected states: combine `scale-100` vs `scale-75` with opacity for dot indicators, tabs, toggles.
- Focus rings: `focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background`. Always visible on keyboard nav.

**Subtle separators & visual rhythm:**
- Prefer `divide-y divide-border/40` over individual borders on list items.
- Use thin lines as design elements: a `w-8 h-px bg-muted-foreground/40` before a label creates editorial feel.
- Pair `<span className="bg-border block h-4 w-px" />` as vertical separators in toolbars/inline groups.

**Surface hierarchy — 3 levels maximum:**
Premium UIs use exactly three surface levels. More = visual noise. Fewer = flat.
```
Level 1  bg-background          — page canvas
Level 2  bg-card / bg-muted     — cards, sidebars, panels
Level 3  bg-background (raised) — popovers, dropdowns, tooltips
```
- Never introduce a fourth surface color (e.g. a nested `bg-muted/50` inside an already-muted card).
- On dark surfaces: use `border/10` or `border/20` as the only depth cue — no extra background tones.
- Dashboard rule: header = Level 1, main panel = Level 1, sidebar = Level 2, cards inside sidebar = Level 3 max.

**One unexpected detail per view:**
Every premium section has one detail that makes the user pause — not the whole design, just one element.
Examples by section type:
- Hero: animated announcement pill with double-arrow chevron micro-interaction
- Features: dotted-grid or graph-paper SVG background inside the icon area
- Pricing: toggle that swaps monthly/annual with a spring-animated pill indicator
- Stats: numbers that count up on scroll-enter (use `framer-motion` `useInView` + `useSpring`)
- Testimonials: avatar stack where each image shifts on hover with `group-hover:[nth]:translate-x-*`
- Dashboard: a single sparkline or mini ring chart inline in a stat card
Rule: **one per section, no more**. The rest of the UI is invisible infrastructure supporting it.

---
### 4d. Visual richness — backgrounds, motion primitives & assets

This section separates **visually compelling** output from technically correct but flat UI. Apply to hero, marketing, landing, and showcase sections. Use judgment on utility components (tables, forms, settings).

**Background gradient system (hero/marketing sections):**
Never ship a plain `bg-background` hero. Use a layered approach:
- **Decorative layer** (`aria-hidden`, `absolute inset-0`, `-z-20`): 2–3 `div` blobs with `radial-gradient()` using `hsla` at 4–8% opacity. Add `isolate contain-strict` to GPU-isolate from content. Hide on mobile with `hidden lg:block`:
  ```tsx
  <div aria-hidden className="absolute inset-0 isolate hidden opacity-65 contain-strict lg:block">
    <div className="absolute left-0 top-0 w-140 h-320 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,85%,.08)_0,hsla(0,0%,55%,.02)_50%,hsla(0,0%,45%,0)_80%)]" />
    <div className="absolute left-0 top-0 h-320 w-60 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.06)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)] [translate:5%_-50%]" />
  </div>
  ```
- **Vignette layer** (`absolute inset-0 -z-10`): radial gradient that fades hero image into page background:
  ```tsx
  <div aria-hidden className="absolute inset-0 -z-10 [background:radial-gradient(125%_125%_at_50%_100%,transparent_0%,var(--color-background)_75%)]" />
  ```

**Mask gradients for media fade:**
Use Tailwind v4 mask utilities to fade hero images into the section:
```tsx
<div className="mask-b-from-55% mask-b-to-90% relative overflow-hidden px-2">
  <Image src="..." alt="..." width={2700} height={1440} />
</div>
```
Check preflight `framework` — Tailwind v4 supports this natively. For v3, use `[mask-image:linear-gradient(...)]`.

**Motion primitives (if `motion-primitives` in preflight `componentLibs`):**
Prefer motion-primitives over hand-rolling when available:
- Headings: `<TextEffect preset="fade-in-blur" speedSegment={0.3} as="h1">Your Heading</TextEffect>`
- Staggered entrance groups: wrap with `<AnimatedGroup variants={transitionVariants}>` using spring bounce:
  ```tsx
  const transitionVariants = {
    item: {
      hidden: { opacity: 0, filter: 'blur(12px)', y: 12 },
      visible: { opacity: 1, filter: 'blur(0px)', y: 0,
        transition: { type: 'spring', bounce: 0.3, duration: 1.5 } },
    },
  }
  ```
If absent, use `framer-motion` directly with the same `initial`/`animate` pattern.

**`next/image` hero frames:**
For screenshots/product visuals:
- Always `next/image` (not `<img>`) when Next.js is the framework
- Dark + light image variants: `className="hidden dark:block"` / `className="dark:hidden"`
- Wrap in a styled frame for polish:
  ```tsx
  <div className="inset-shadow-2xs ring-background dark:inset-shadow-white/20 bg-background mx-auto max-w-6xl overflow-hidden rounded-2xl border p-4 shadow-lg shadow-zinc-950/15 ring-1">
    <Image className="aspect-15/8 rounded-2xl hidden dark:block" src="/app-dark.png" ... />
    <Image className="aspect-15/8 rounded-2xl border border-border/25 dark:hidden" src="/app-light.png" ... />
  </div>
  ```

**Announcement pill badge:**
Use for "Introducing X" banners above hero headings:
```tsx
<Link href="#" className="hover:bg-background dark:hover:border-t-border bg-muted group mx-auto flex w-fit items-center gap-4 rounded-full border p-1 pl-4 shadow-md shadow-zinc-950/5 transition-colors duration-300 dark:border-t-white/5">
  <span className="text-foreground text-sm">Introducing X</span>
  <span className="dark:border-background block h-4 w-0.5 border-l bg-white dark:bg-zinc-700" />
  <div className="bg-background group-hover:bg-muted size-6 overflow-hidden rounded-full duration-500">
    <div className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
      <ArrowRight className="m-auto size-3" />
      <ArrowRight className="m-auto size-3" />
    </div>
  </div>
</Link>
```

**Logo / trust grid with blur-reveal:**
```tsx
<div className="group relative">
  <div className="absolute inset-0 z-10 flex scale-95 items-center justify-center opacity-0 duration-500 group-hover:scale-100 group-hover:opacity-100">
    <Link href="/">Meet Our Customers <ChevronRight className="inline size-3" /></Link>
  </div>
  <div className="**:fill-foreground group-hover:blur-xs group-hover:opacity-50 transition-all duration-500 mx-auto grid max-w-2xl grid-cols-4 gap-x-12 gap-y-8">
    {/* SVG logo components — fill inherits from **:fill-foreground */}
  </div>
</div>
```
Logo SVGs: check if `components/ui/svgs/` exists in the project. If not, use well-known inline SVGs or `<span className="font-semibold text-sm tracking-tight">BrandName</span>` as placeholder.

**Section type cheat sheet:**
| Section | Background | Motion | Assets |
|---------|-----------|--------|--------|
| Hero | Gradient blobs + vignette + image with mask | TextEffect h1 + AnimatedGroup CTA | next/image frame, announcement pill |
| Features | Subtle `bg-muted/30` alternating or none | Stagger cards on scroll | Icon per feature (lucide) |
| Pricing | None or light surface | Fade-in on load | Checkmark icons, toggle animation |
| Testimonials | None or very subtle | Fade on scroll | Avatar images, quote mark SVG |
| Logo grid | None | Blur-reveal on hover | SVG brand logos |
| CTA/Footer | Gradient blob or dark panel | Entrance fade | Minimal |

---
## 5. Anti-patterns — forbidden

- Hard-coded light-only colors (`bg-white`, `text-black`, `border-gray-200`) without `dark:` counterpart
- Mixed border-radius in one variant (e.g. `rounded-md` on buttons + `rounded-xl` on cards)
- Inconsistent section spacing (e.g. `py-16` on hero + `py-24` on features)
- Gradient soup (>1 decorative gradient per view)
- Random emoji as icons (use lucide/phosphor/hugeicons/project set)
- Stacking multiple shadows for “depth”- Plain `bg-background` hero with no gradient layer, texture, or image — always add visual depth
- Using `<img>` instead of `next/image` in Next.js projects
- Flat logo grids with no interaction or visual treatment- Arbitrary Tailwind values (`w-[437px]`) when a scale token fits
- Nested cards > 2 deep
- Center-aligned body text paragraphs
- > 3 font weights in one view
- > 5 distinct colors in one view (excluding neutrals)
- Fake data that implies features that don’t exist
- Copy like “Click here”, “Submit”, “Lorem ipsum”
- Recolored duplicates passed off as separate variants
- Using `md:` or `lg:` breakpoint without a clear layout shift reason

---

## 6. Self-critique pass (before running validate)

For EACH variant, silently verify:

1. **Dark mode**: toggle mentally — does every `bg-*`, `text-*`, `border-*` have a `dark:` pair? Any element invisible or unreadable?
2. **Radius consistency**: grep your code — is there exactly ONE `rounded-*` value (excluding `rounded-full` for avatars/pills)?
3. **Spacing consistency**: do all top-level sections use the same `py-*` from the taste block?
4. **Axis uniqueness**: does this variant differ from siblings on layout, hierarchy, or interaction (not just color/font)?
5. **Icon source**: are all icon imports from the declared icon library in the taste block?
6. **No orphan elements**: every button, link, and input has a visible outcome or state change
7. **Breakpoint intent**: every `md:` / `lg:` maps to a real layout shift (stack → grid, hidden → visible)
8. **Typography polish**: display text uses `font-light` + `tracking-tight`? Small labels use `uppercase tracking-[0.15em]`? Max 2 weights?
9. **Opacity layering**: borders use `/50` or `/30`? No full-opacity decorative borders?
10. **Animation quality** (if motion ≠ none): custom easing on entrances? Stagger ≤ 300ms total? `AnimatePresence` on swaps? `prefers-reduced-motion` respected?
11. **Whitespace balance**: sections breathe (`gap-12`+)? Related items cluster (`gap-2`–`gap-4`)? No cramped areas?
12. **Visual richness** (hero/marketing sections): does the section have a background gradient layer or texture? Is `next/image` used for product visuals? Is there an `aria-hidden` decorative blob layer? If motion-primitives is available, are `TextEffect`/`AnimatedGroup` used for heading/CTA entrances?
13. **Surface hierarchy**: are there exactly 3 surface levels max (`bg-background` → `bg-card/bg-muted` → elevated)? No fourth nested background tone?
14. **One unexpected detail**: is there exactly one element in this section that's slightly surprising — a micro-interaction, an animated number, a reveal, a textured background? Not zero (flat), not two (busy).

If ANY check fails — fix before §7. Do not run validate on work that fails self-critique.

---

## 7. Variant workflow — FAST PATH (strict)

These steps are owned by scripts. Do NOT hand-edit files the scripts manage.

### One-time setup
If `myui-sh` is missing, run:
```
node ~/.copilot/skills/myui/scripts/scaffold-runtime.mjs <project-root>
```
Wires runtime overlay and creates generated variant folders.

### Per-request flow
1. **Wrap target region** with `<MyuiSlot id="...">`.
2. **Run in parallel (same turn):**
   - Preflight (cached):
     ```
     node ~/.copilot/skills/myui/scripts/preflight.mjs <project-root> --near <relative-target-file> --prompt-hint "<summary>"
     ```
   - Create `Variant1.tsx` shell immediately using Tier A + Tier B defaults (do not wait for all variants).
3. **After preflight returns:**
   - finalize taste block from returned `config.design` + tokens/references
   - generate remaining variants (or upgrade Variant1 to Tier C if premium mode)
4. **Write Variant1..VariantN files** under `<variantsDir>/<slot-id>/` (variantsDir from `.myui/config.json`; default `app/myui-variants` or `src/myui-variants`).
5. **Run validate/register with one-pass fix hints**:
   ```
   node ~/.copilot/skills/myui/scripts/validate.mjs <project-root> <slot-id> --file <relative-path-to-wrapped-file> --fix-hints
   ```
   On `ok=true` the script auto-writes:
   - `<variantsDir>/<slot-id>/manifest.ts` (Variant re-exports)
   - `<variantsDir>/_index.ts` SLOT_LOADERS entry
   - `.myui/slots.json` entry (when `--file` passed — REQUIRED for `/api/myui/apply`)

   Do NOT hand-edit `manifest.ts`, `_index.ts`, or `slots.json`. The script owns them.
6. If validation fails, apply **all returned `fixHints` in one edit pass**, then rerun the same command once. Avoid iterative micro-fixes.

Preview mode default:
- Use the in-app overlay path (`<MyuiOverlay />` + `<MyuiSlot />`) as the default preview flow.
- Do not start the standalone preview daemon unless the project cannot run its normal dev server or you're in a headless environment.

---

## 8. Overlay-aware tips (`<MyuiOverlay />`)

Variants render side-by-side in the in-browser overlay. Optimize for at-a-glance judgment:

- Make visual difference obvious within the first 500ms of viewing
- Keep variant names semantic (not `Variant1` in display labels)
- Ensure each variant works at the overlay's preview size, not only full-width
- Avoid overlay-breaking global styles (`body{...}`, `*{...}`, document-level animations)

---

## 9. Rules

- Do not write outside project root.
- No `dangerouslySetInnerHTML` with unsanitized input.
- No forbidden imports (network, fs, secrets) in client variants.
- Prefer existing project UI primitives.
- Keep generated code production-ready, accessible, tokenized.
- If user overrides any guidance explicitly — follow user, note the override.
