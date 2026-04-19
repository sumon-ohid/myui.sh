# Design References

The myui skill reads this file during pre-flight. Fill it once — every future generation uses it as a taste anchor.

Keep entries concrete. "Nice and modern" → useless. "Linear's command palette, dense rows, mono timestamps" → usable.

---

## Aesthetic anchors

<!-- Name products/sites whose look you want to echo. Be specific about WHAT you like. -->

- Example: **Linear** — dense information, mono-ish labels, restrained color, fast transitions
- Example: **Vercel dashboard** — generous whitespace, editorial type hierarchy, subtle borders
- Example: **Stripe docs** — editorial feel, code-forward, precise spacing

## Inspiration links

<!-- Paste URLs to screenshots, Dribbble, Mobbin, specific app pages. -->

-

## Do

<!-- Patterns you want repeated across the project. -->

- Use the project's token scale — never arbitrary values
- Real content in mocks — no lorem ipsum
- Keyboard-first interactions; visible focus rings
- Motion: 120–240ms micro, 300–500ms layout

## Don't

<!-- Patterns to avoid. -->

- Gradient soup, stacked shadows, emoji as icons
- Centered body paragraphs
- More than 3 font weights or 5 colors per view
- Nested cards > 2 deep

## Voice & copy

<!-- Tone of product text — affects button labels, empty states, errors. -->

- Example: direct, lowercase, no exclamation points
- Example: friendly, uses contractions, avoids jargon

## Component preferences

<!-- Specific primitives or patterns to reuse. -->

- Icons: <!-- lucide-react | phosphor | custom -->
- Buttons: <!-- e.g. prefer shadcn Button, use ghost variant for tertiary -->
- Forms: <!-- e.g. label above input, helper text muted, errors inline -->
