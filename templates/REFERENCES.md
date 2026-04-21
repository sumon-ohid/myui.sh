# Design References

The myui skill reads this file during pre-flight. Fill it once — every future generation uses it as a universal taste anchor.

Keep entries code-backed and concrete. Vague adjectives give the model nothing. Token values, spacing numbers, and component snippets are what matter.

> ⚠️ **Images in this file are not read by the AI** — only text is parsed. Describe visuals in words if needed.

---

## Quality bar

The goal is **premium, enterprise-grade UI** that is:
- Visually outstanding — not generic AI output
- Fully mobile-responsive from 320px to 1440px+
- Polished at the micro level: hover states, focus rings, transitions, empty states, loading states
- Dark/light parity on every component without exception
- Context-aware: marketing sections get editorial spacing; app UI gets information density

Reference tier: **Linear, Vercel, Stripe, Resend, Raycast, GitHub**. Every generated component should feel at home alongside these products.

---

## Context — switch design language by section type

**The model MUST detect context and apply the correct language. Never bleed marketing spacing into app UI, or app density into marketing sections.**

### Marketing / landing pages
- Section spacing: `py-20 lg:py-32`, internal grid gaps `gap-8`–`gap-12`
- Headings: `text-4xl lg:text-6xl font-semibold tracking-tight` — display weight, tight tracking
- Subtext: `text-base lg:text-lg text-muted-foreground max-w-2xl mx-auto`
- Cards: `rounded-xl border bg-card` — no shadow by default; `shadow-sm` on featured only
- CTAs: solid primary + ghost secondary, side by side, centered
- Visual depth: gradient blob backgrounds, announcement pills, mask-faded hero images
- Mobile: headings cap at `text-3xl`, sections at `py-12`

### Dashboard / app UI
- Panel spacing: `px-4 py-3` or `px-6 py-4`; row height `h-9`–`h-10`
- Headings: page title max `text-xl font-semibold`; section labels `text-sm font-medium text-muted-foreground uppercase tracking-wide`
- Values/numbers: `font-mono text-sm tabular-nums` — always `tabular-nums` for anything that updates
- Density: high — users scan, not read; pack information, use dividers not whitespace as separators
- Layout: sidebar (240–260px) + main, or top nav + content — never centered single-column
- Trend deltas: `text-xs font-medium text-emerald-600 dark:text-emerald-400` (up) / `text-red-500 dark:text-red-400` (down)
- Mobile: sidebar collapses to bottom nav or sheet; stat cards stack to 2-col then 1-col

### Settings / configuration pages
- Group fields with `divide-y divide-border` — one `<section>` per concern
- Section layout: `grid gap-6 sm:grid-cols-[1fr_2fr] py-8 border-t first:border-t-0`
- Section header: `text-sm font-medium` title + `text-xs text-muted-foreground` description
- Input height: `h-9` (shadcn default) — consistent across all form fields
- Inline save: show a checkmark `Badge` for 2s on success — no full page reload
- Destructive zone: always last, `pt-8 border-t border-destructive/20`, text in `text-destructive`

### Data tables
- Header cells: `text-xs font-medium uppercase tracking-wide text-muted-foreground` — never bold
- Row: `group h-12 border-b border-border last:border-0 hover:bg-muted/40 transition-colors`
- Primary column: `text-sm font-medium text-foreground`; all others: `text-sm text-muted-foreground`
- Status pill: `rounded-full px-2 py-0.5 text-xs font-medium` — semantic colors below
- Row actions: `opacity-0 group-hover:opacity-100 transition-opacity` — only visible on hover
- Empty state: icon + `text-sm font-medium` heading + `text-xs text-muted-foreground` + one action CTA, `py-16 text-center`

---

## Mobile responsiveness — mandatory

- **Grids**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` — never skip mobile breakpoint
- **Navigation**: sidebar collapses to sheet or bottom nav — never horizontal overflow
- **Tables**: `overflow-x-auto` wrapper + sticky first column, or collapse to stacked cards via `@container`
- **Touch targets**: `min-h-10 min-w-10` for all tappable elements on mobile — never `h-7` buttons
- **Modals**: use `Sheet` (bottom slide-up) instead of centered `Dialog` on mobile for forms and pickers
- **Spacing**: `py-12 lg:py-24` — halve section padding at mobile, never flat `py-24` everywhere
- **Typography**: `text-3xl lg:text-5xl` — cap display text at `text-3xl` on mobile

---

## Semantic color tokens for status

Always use these — never invent new status hues:
- Success / active: `bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400`
- Error / destructive: `bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400`
- Warning / pending: `bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400`
- Info: `bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400`
- Neutral / inactive: `bg-muted text-muted-foreground`

---

## Visual assets — what separates outstanding from fine

- **Icons**: `@phosphor-icons/react`, `weight="light"` always. `size-4` in dense rows, `size-5` in cards, `size-6` in marketing sections. Never `weight="fill"` in UI chrome.
- **Product screenshots**: `next/image`, wrapped in `rounded-2xl border bg-muted/30 shadow-xl shadow-black/10 overflow-hidden`; always ship dark + light pairs (`hidden dark:block` / `dark:hidden`)
- **Avatars**: `next/image` with `rounded-full`, initials fallback in `bg-muted text-muted-foreground` — never a broken `<img>`
- **Brand/logo marks**: SVG inline with `fill-current`; in logo grids use `opacity-50 hover:opacity-100 transition-opacity duration-300`
- **Empty states**: phosphor icon at `size-10 text-muted-foreground/40`, short heading, one sentence, one action — never placeholder emoji
- **Illustrations**: CSS dotted-grid or subtle geometric SVG backgrounds over bitmap — keeps bundle small and scales perfectly

---

## Component examples

```tsx
// App UI — KPI stat card
// Key traits: compact, tabular-nums, semantic trend delta color
export function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  trend,
}: {
  label: string
  value: string
  delta: string
  deltaLabel: string
  trend: 'up' | 'down' | 'flat'
}) {
  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <div className="flex items-center gap-1.5">
        <span className={cn(
          "text-xs font-medium",
          trend === 'up' && "text-emerald-600 dark:text-emerald-400",
          trend === 'down' && "text-red-500 dark:text-red-400",
          trend === 'flat' && "text-muted-foreground",
        )}>
          {delta}
        </span>
        <span className="text-xs text-muted-foreground">{deltaLabel}</span>
      </div>
    </div>
  )
}
```

```tsx
// App UI — Sidebar nav item with spring-animated active indicator
// Key traits: layoutId spring, icon+label, optional badge, h-9 rows
import { motion } from 'framer-motion'

export function NavItem({
  icon: Icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: React.ElementType
  label: string
  active?: boolean
  badge?: string | number
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-2.5 rounded-md px-3 h-9 text-sm font-medium transition-colors cursor-pointer",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-md bg-muted"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
        />
      )}
      <Icon className="relative size-4 shrink-0" strokeWidth={1.5} />
      <span className="relative flex-1 text-left">{label}</span>
      {badge != null && (
        <span className="relative rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary tabular-nums">
          {badge}
        </span>
      )}
    </button>
  )
}
```

```tsx
// App UI — Settings form group (2-column label+fields layout)
// Key traits: divide-y sections, responsive 2-col grid, description text
export function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-[1fr_2fr] py-8 border-t first:border-t-0 border-border">
      <div>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}
```

```tsx
// App UI — Table row with hover-reveal actions
// Key traits: group hover, h-12, status pill, opacity-0 action buttons
export function DataTableRow({
  name,
  email,
  status,
  role,
}: {
  name: string
  email: string
  status: 'active' | 'inactive' | 'pending'
  role: string
}) {
  const statusStyle = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    inactive: 'bg-muted text-muted-foreground',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  }[status]

  return (
    <tr className="group h-12 border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
      <td className="px-4">
        <div className="flex items-center gap-3">
          <div className="size-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
            {name[0]}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground leading-none">{name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 text-sm text-muted-foreground">{role}</td>
      <td className="px-4">
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusStyle)}>
          {status}
        </span>
      </td>
      <td className="px-4">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Pencil className="size-3.5" strokeWidth={1.5} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
            <Trash2 className="size-3.5" strokeWidth={1.5} />
          </Button>
        </div>
      </td>
    </tr>
  )
}
```

```tsx
// Marketing — Pricing card (light surface, semantic popular state)
// Key traits: flat card, popular border emphasis, full-width CTA
export function PricingCard({
  tier,
  price,
  period = "mo",
  features,
  popular,
}: {
  tier: string
  price: string
  period?: string
  features: string[]
  popular?: boolean
}) {
  return (
    <div className={cn(
      "relative flex flex-col rounded-xl border bg-card p-8",
      popular ? "border-primary shadow-sm" : "border-border"
    )}>
      {popular && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          Most popular
        </span>
      )}
      <p className="text-sm font-medium text-muted-foreground">{tier}</p>
      <div className="mt-2 flex items-end gap-1">
        <span className="text-4xl font-bold tracking-tight text-foreground">{price}</span>
        <span className="mb-1 text-sm text-muted-foreground">/ {period}</span>
      </div>
      <ul className="mt-6 space-y-3 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
            {f}
          </li>
        ))}
      </ul>
      <Button className="mt-8 w-full" variant={popular ? "default" : "outline"}>
        Get started
      </Button>
    </div>
  )
}
```

---

## Do

- Match design language to context: marketing = spacious display type; dashboard = dense `text-sm` rows
- `tabular-nums` on all numeric values that update dynamically
- Touch targets minimum `h-10` on mobile, `h-9` acceptable on desktop-only UI
- Dark mode parity on every component — test mentally before shipping
- `font-mono text-xs` for IDs, timestamps, code values, log lines, version strings
- Hover: `hover:bg-muted/40` on table rows, `hover:bg-muted/50` on nav items — subtle shift only
- Focus: `focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background` — always keyboard-navigable
- One `layoutId` spring-animated indicator per nav context (tabs, sidebar, segmented control)
- `next/image` for all bitmap assets, never raw `<img>`
- `cursor-pointer` on all interactive elements; `cursor-not-allowed opacity-50` on disabled
- Real content — no lorem ipsum, no "Card Title", no placeholder emoji

## Don't

- `py-24` section spacing inside dashboard panels — that's marketing only
- `text-4xl`+ headings inside app chrome — page titles max `text-xl font-semibold`
- Hardcoded `text-black`, `text-white`, `bg-white`, `border-gray-*` — always semantic tokens
- More than 2 font weights in a dense view (`font-medium` + muted is enough)
- Mixed border-radius in one component (pick one size; `rounded-full` only for pills/avatars)
- Gradient soup — zero decorative gradients in app UI; max one in marketing sections
- Shadows on every card — flat default, `shadow-sm` only for floating/elevated elements
- Emoji as icons — use @phosphor-icons/react (or project icon library)
- Arbitrary Tailwind values (`w-[437px]`) — use scale tokens
- Nested cards more than 2 levels deep
- Center-aligned body text paragraphs in content sections
- More than 5 distinct hues in one view (neutrals + one semantic accent is the limit)
- Recolored variants passed off as distinct design decisions

---

## Voice & copy

- Sentence-case everywhere — no ALL CAPS headings
- Direct, no exclamation points
- CTA labels: verb-first ("Get started", "Save changes", "Delete account", "View all")
- Error messages: say what happened + what to do ("Email already in use — try signing in instead")
- Empty states: "No [items] yet" + single action ("Add your first [item]")
- Numbers: `K`/`M` for large values (`12.4K`, `2.1M`); `+` prefix for growth metrics

---

## Animations

- **Marketing entrances**: `opacity: 0→1` + `y: 20→0`, spring `bounce: 0.3 duration: 1.5`, stagger siblings 50ms apart
- **App UI transitions**: `150–200ms ease-out` only — no spring bounce in dense UI (feels wrong)
- **Active indicators** (tabs, sidebar, segmented controls): `layoutId` spring `bounce: 0.2 duration: 0.35`
- **Count-up numbers on scroll**: `useInView` + `useSpring` from framer-motion
- **Always**: respect `prefers-reduced-motion` — use `useReducedMotion()` or `@media (prefers-reduced-motion: reduce)`
- **Never**: animate layout shifts in tables or lists — disorienting for dense data
