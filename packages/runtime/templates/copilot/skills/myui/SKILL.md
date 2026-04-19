---
name: myui
description: Generate, polish, or refine UI components in the user's project with in-app variant preview via @myui-sh/runtime.
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
node ~/.claude/skills/myui/scripts/preflight.mjs <project-root> --near <relative-target-file>
```

Returns JSON with: `framework`, `componentLibs`, `iconLibs`, `tokens[]`, `references[]`, `components[]`, `config`, `slots`, `notes[]`.

Read the full JSON. Then also:

1. **Check CLAUDE.md** for `REQUIRED` project conventions (not covered by preflight).
2. **Follow every `notes[]` entry** — each is a gap the model must address before coding (e.g. "no tokens found — ask user for aesthetic direction").
3. If preflight returns empty `tokens[]` AND empty `references[]` AND the brief is vague — ask ONE focused question (aesthetic anchor + density). Do not guess house style.

Skipping preflight = generic output. Do not skip.

---

## 2. Taste declaration (output before code)

Commit to a direction. Print this block in your response before any variant code:

```
Aesthetic: <e.g. Vercel-minimal | Linear-dense | Stripe-editorial | Arc-playful | brutalist | editorial>
Density:   <comfortable | compact | spacious>
Motion:    <none | subtle | expressive>
Hierarchy: <typography-led | color-led | space-led | asymmetry-led>
Primitives: <shadcn | radix | custom:name>
```

**Source priority**:
1. Preflight `config.design` (`.myui/config.json` → `design` block) — use these values as defaults.
2. User prompt overrides (if user explicitly says "make it dense", honor it).
3. Inferred from tokens / sample components when config fields empty.
4. Ask the user only if still ambiguous.

No taste block → no code.

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

- **States**: empty, loading, error, success — where data-driven
- **A11y**: semantic HTML, ARIA where needed, keyboard nav, visible focus rings, `aria-label` on icon-only buttons, color contrast ≥ WCAG AA
- **Responsive**: mobile-first, verified at sm/md/lg; no horizontal overflow
- **Tokens honored**: no hard-coded hex/px outside the project's scale; use existing spacing/radii/type scale
- **Real content**: realistic copy, no "Lorem ipsum", no placeholder emojis unless intentional
- **Motion**: respects `prefers-reduced-motion`; durations 120–240ms for micro, 300–500ms for layout
- **No dead ends**: every interactive element has a defined outcome

---

## 5. Anti-patterns — forbidden

- Gradient soup (>1 decorative gradient per view)
- Random emoji as icons (use lucide/phosphor/project set)
- Stacking multiple shadows for "depth"
- Arbitrary Tailwind values (`w-[437px]`) when a scale token fits
- Nested cards > 2 deep
- Center-aligned body text paragraphs
- > 3 font weights in one view
- > 5 distinct colors in one view (excluding neutrals)
- Fake data that implies features that don't exist
- Copy like "Click here", "Submit", "Lorem ipsum"
- Recolored duplicates passed off as separate variants

---

## 6. Self-critique pass (before running validate)

For EACH variant, silently answer:

1. What ONE thing does this variant optimize for?
2. What did I cut to achieve that?
3. Would a senior designer ship this as-is?
4. Does it differ from siblings on a real axis (§3), not just vibes?

If any answer is weak or repeats a sibling — rewrite before §7. Do not run validate on work that fails self-critique.

---

## 7. Variant workflow — STRICTLY FOLLOW (mechanical steps, do not skip or reorder)

These steps are owned by scripts. Do NOT hand-edit files the scripts manage.

### One-time setup
If `@myui-sh/runtime` is missing, run:
```
node ~/.claude/skills/myui/scripts/scaffold-runtime.mjs <project-root>
```
Wires runtime overlay and creates generated variant folders.

### Per-request flow
1. **Wrap target region** with `<MyuiSlot id="...">`.
2. **Write Variant1..VariantN files** under `<variantsDir>/<slot-id>/` (variantsDir from `.myui/config.json`; default `app/myui-variants` or `src/myui-variants`).
3. **Run validate/register**:
   ```
   node ~/.claude/skills/myui/scripts/validate.mjs <project-root> <slot-id> --file <relative-path-to-wrapped-file>
   ```
   On `ok=true` the script auto-writes:
   - `<variantsDir>/<slot-id>/manifest.ts` (Variant re-exports)
   - `<variantsDir>/_index.ts` SLOT_LOADERS entry
   - `.myui/slots.json` entry (when `--file` passed — REQUIRED for `/api/myui/apply`)

   Do NOT hand-edit `manifest.ts`, `_index.ts`, or `slots.json`. The script owns them.
4. If validation fails, fix **only failing variants** and rerun the same command. Registration only occurs when `ok=true`.

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
