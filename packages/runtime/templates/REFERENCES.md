# Design References

The myui skill reads this file during pre-flight. Fill it once — every future generation uses it as a taste anchor.

Keep entries concrete. "Nice and modern" → useless. "Tailark Dusk — dark zinc base, rounded-xl cards, border-white/10, spring-bounce animations" → usable.

> ⚠️ **Images in this file are not read by the AI** — only text is parsed. Put screenshots in `.myui/inspo/screenshots/` for your own visual reference. For AI-readable notes about those screenshots, describe them in text below or in `.myui/inspo/*.md` files.

---

## How to reference components — code beats images

**Best → install the actual blocks.** If you install Tailark (or any shadcn-based library) into your project, preflight automatically picks up those `.tsx` files and feeds full source code to the model. No manual copy-pasting needed. Example:

```bash
pnpm dlx shadcn add @tailark/hero-section-1
pnpm dlx shadcn add @tailark/features-1
pnpm dlx shadcn add @tailark/pricing-1
```

**Good → paste short representative snippets here** (see `## Component example` below). Teaches naming, prop shape, and composition style for when the real files aren't installed.

**Useless → raw images or bare URLs.** This file is plain text. The model never sees image pixels from markdown embeds.

Screenshots for your own visual reference → `.myui/inspo/screenshots/`

---

## Aesthetic anchors

- **Tailark (Dusk kit)** — high-end SaaS marketing blocks; light zinc/slate background (`zinc-50` / `slate-100`), near-black heavy headings (`text-5xl font-bold tracking-tight text-zinc-950`), cards with subtle border + white background, generous section whitespace (`py-24 lg:py-32`), bold black primary button, ghost secondary button
- **Tailark (Quartz kit)** — same block structure, cleaner neutral palette; more editorial whitespace, stone/zinc neutrals throughout
- **Linear** — reference for density: tight rows, monospaced labels, restrained accent color

## Visual reference (screenshots)

> These are for YOUR eyes only — not read by the AI.
> See `.myui/inspo/screenshots/` for the actual image files.

**Hero Section (Dusk / One)**
Massive centered heading on light zinc background. Pill-shaped announcement badge above ("Introducing Support for AI Models →"). Subtext in zinc-500. Two buttons: solid black "Sign Up" + ghost "Login". No decorative gradients — pure type hierarchy.

**Features Section (Dusk / One)**
Centered `text-5xl` heading + muted subtext. 3-column card grid on zinc-50 background. Each card: dotted-grid background illustration in icon area, rounded-xl border, bottom-aligned title + description. No accent color — full monochromatic.

**Pricing Section (Dusk / One)**
Centered heading `text-5xl font-bold`. 3 flat cards: "Free / $0", "Pro / $19", "Startup / $29". "Popular" badge: pill with orange-to-pink gradient. Cards: `rounded-xl border border-zinc-200 bg-white`. Clean feature list with check icons. Primary CTA: solid black button full-width inside the popular card.

**Call To Action (Dusk / One)**
Minimal centred block. Large "Start Building" heading. Short subtext. Two buttons side by side: solid black "Get Started" + ghost "Book Demo". Maximum whitespace — nothing else on screen.

**Stats Section (Dusk / One)**
3-column stat layout, each column separated by a vertical divider line. Huge `text-5xl font-bold` stat numbers (`+1200`, `22 Million`, `+500`). Small label below each in zinc-500. Centered heading + subtext above. Extremely minimal — zero decoration.

## Component example

```tsx
// Tailark Dusk — Features card pattern
// Key traits: dotted grid bg illustration, monochrome, rounded-xl border, bottom-aligned text
export function FeatureCard({
  title,
  description,
  icon: Icon,
}: {
  title: string
  description: string
  icon: React.ElementType
}) {
  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <div className="flex items-center justify-center h-40 bg-zinc-50 border-b border-zinc-200">
        {/* dotted-grid background + centered icon */}
        <div className="relative size-12 flex items-center justify-center">
          <Icon className="size-6 text-zinc-800" strokeWidth={1.5} />
        </div>
      </div>
      <div className="p-6">
        <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
        <p className="mt-2 text-sm text-zinc-500 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
```

```tsx
// Tailark Dusk — Pricing card pattern
// Key traits: flat white card, rounded-xl, popular = gradient badge, black CTA
export function PricingCard({
  tier,
  price,
  period = "mo",
  perLabel,
  features,
  popular,
}: {
  tier: string
  price: string
  period?: string
  perLabel?: string
  features: string[]
  popular?: boolean
}) {
  return (
    <div className={cn(
      "relative flex flex-col rounded-xl border bg-white p-8",
      popular ? "border-zinc-900 shadow-sm" : "border-zinc-200"
    )}>
      {popular && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-orange-400 to-pink-500 px-3 py-1 text-xs font-semibold text-white">
          Popular
        </span>
      )}
      <p className="text-sm font-medium text-zinc-500">{tier}</p>
      <div className="mt-2 flex items-end gap-1">
        <span className="text-4xl font-bold tracking-tight text-zinc-900">{price}</span>
        <span className="mb-1 text-sm text-zinc-400">/ {period}</span>
      </div>
      {perLabel && <p className="mt-1 text-xs text-zinc-400">{perLabel}</p>}
      <ul className="mt-6 space-y-3 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-zinc-600">
            <Check className="size-4 text-zinc-900 shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      <Button
        className="mt-8 w-full"
        variant={popular ? "default" : "outline"}
      >
        Get started
      </Button>
    </div>
  )
}
```

```tsx
// Tailark Dusk — Stats row pattern
// Key traits: 3 large numbers, vertical dividers, no decoration, centered text
export function StatsRow({ stats }: { stats: { value: string; label: string }[] }) {
  return (
    <div className="grid grid-cols-3 divide-x divide-zinc-200">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col items-center gap-2 py-8 px-6">
          <span className="text-5xl font-bold tracking-tight text-zinc-900">{s.value}</span>
          <span className="text-sm text-zinc-500">{s.label}</span>
        </div>
      ))}
    </div>
  )
}
```

## Do

- Tailark block structure: large section padding (`py-24 lg:py-32`), centered `text-5xl font-bold tracking-tight` heading, muted subtext, then grid or layout below
- Cards: `rounded-xl border border-zinc-200 bg-white` in light mode — no shadows by default, shadow-sm only on featured/highlighted card
- Primary button: solid black (`bg-zinc-900 text-white hover:bg-zinc-800`)
- Secondary button: ghost/outline (`border-zinc-200 text-zinc-700 hover:bg-zinc-50`)
- Icons: lucide-react, `strokeWidth={1.5}`, `size-5` or `size-6` — never filled
- Typography scale: `text-5xl font-bold tracking-tight` for section headings, `text-zinc-500` for subtext, `text-base font-semibold text-zinc-900` for card titles
- Dividers: `divide-zinc-200` or `border-zinc-200` — always `zinc`, never `gray`
- Real content — no lorem ipsum, no placeholder emoji

## Don't

- Dark mode base (Tailark Dusk is actually light — the "Dusk" branding is the style kit, not a dark theme)
- Gradient soup — only 1 gradient allowed (popular badge or specific accent badge)
- Shadows on every card — flat is the default, shadow-sm only for emphasis
- Arbitrary Tailwind values (`w-[437px]`) — use scale tokens
- Nested cards > 2 deep
- Center-aligned body text in content sections
- More than 3 font weights per view
- Emoji as icons

## Voice & copy

- Sentence-case everywhere — no ALL CAPS headings
- Direct, no exclamation points
- CTA labels: verb-first ("Get started", "View docs", "Book a demo")
- Stats and numbers: use `+` prefix for growth metrics (`+1200 Stars`)

## Component preferences

- Icons: `lucide-react`, `strokeWidth={1.5}`
- Buttons: shadcn `Button` — `default` for primary CTA, `outline` for secondary
- Forms: label above input, helper text `text-sm text-zinc-500`, errors inline in `text-sm text-red-500`
- Dividers: `divide-zinc-200` or `border-zinc-200`
- Animations: framer-motion spring (`type: 'spring', bounce: 0.3, duration: 1.5`) with `opacity` + `y` fade-up for section entrances; 120–200ms `ease-out` for micro-interactions
