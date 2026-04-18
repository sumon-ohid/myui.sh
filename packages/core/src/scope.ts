export type ComponentScope = "atom" | "molecule" | "section" | "page";

export interface ScopeHint {
  readonly scope: ComponentScope;
  readonly lineBudget: number;
  readonly guidance: string;
  readonly patternRef?: string;
}

const ATOM_WORDS = [
  "button",
  "badge",
  "tag",
  "chip",
  "avatar",
  "spinner",
  "toggle",
  "switch",
  "checkbox",
  "radio",
  "input",
  "textarea",
  "select",
  "slider",
  "tooltip",
  "icon",
];

const MOLECULE_WORDS = [
  "card",
  "alert",
  "toast",
  "breadcrumb",
  "pagination",
  "tabs",
  "accordion",
  "dropdown",
  "menu",
  "modal",
  "dialog",
  "popover",
  "search",
  "searchbar",
  "form",
];

const SECTION_WORDS = [
  "hero",
  "pricing",
  "feature",
  "features",
  "testimonial",
  "testimonials",
  "faq",
  "footer",
  "header",
  "navbar",
  "sidebar",
  "navigation",
  "cta",
  "banner",
  "gallery",
  "grid",
  "stats",
  "team",
  "newsletter",
  "contact",
  "table",
  "data-table",
];

const PAGE_WORDS = [
  "page",
  "dashboard",
  "checkout",
  "onboarding",
  "admin",
];

const PATTERN_REFS: Record<string, string> = {
  pricing:
    "3-tier comparison grid; featured middle tier visually emphasized; feature checklist per tier; single primary CTA per tier; compare by price, features, limits.",
  hero:
    "headline + subheadline + primary/secondary CTA pair; optional visual (image/illustration/code block) on the right or below; social proof strip below.",
  features:
    "grid of 3-6 feature cards; icon + title + 1-2 line description per card; balance icon weight, consistent card height.",
  testimonials:
    "quote + attribution (name, role, avatar, company); 2-3 column grid or carousel; stagger heights for rhythm.",
  faq:
    "accordion list; question as button, answer collapsible; keyboard-navigable; one or multiple open at a time.",
  dashboard:
    "left sidebar nav + top bar; grid of stat cards + chart + recent-activity table; empty states per widget.",
  navbar:
    "logo left; nav links center or left; CTA + profile right; mobile hamburger; sticky with backdrop blur.",
  footer:
    "multi-column link grid; newsletter signup; legal row; social icons.",
  table:
    "semantic <table>; sortable headers; row hover; pagination or load-more; empty and loading states.",
  form:
    "label + input pairs; inline error under each field; disabled submit while invalid; aria-describedby for errors.",
};

function tokenize(prompt: string): string[] {
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function matchPatternRef(tokens: string[]): string | undefined {
  for (const tok of tokens) {
    const ref = PATTERN_REFS[tok];
    if (ref) return `${tok}: ${ref}`;
  }
  return undefined;
}

export function classifyScope(prompt: string): ScopeHint {
  const tokens = tokenize(prompt);
  const set = new Set(tokens);
  const patternRef = matchPatternRef(tokens);

  const has = (words: readonly string[]): boolean =>
    words.some((w) => set.has(w));

  const sectionHit = has(SECTION_WORDS);
  const moleculeHit = has(MOLECULE_WORDS);
  const pageHit = has(PAGE_WORDS);

  if (moleculeHit && !sectionHit && !pageHit) {
    return {
      scope: "molecule",
      lineBudget: 180,
      guidance:
        "Composite component. Clear internal structure, multiple props, handle common states (default, hover, focus, disabled, error, loading where relevant).",
      ...(patternRef ? { patternRef } : {}),
    };
  }

  if (sectionHit) {
    return {
      scope: "section",
      lineBudget: 280,
      guidance:
        "Full page section. Rich composition: heading hierarchy, supporting copy, visuals, and clear CTA. Use a wrapper <section> with aria-labelledby when it has a heading.",
      ...(patternRef ? { patternRef } : {}),
    };
  }

  if (pageHit) {
    return {
      scope: "page",
      lineBudget: 400,
      guidance:
        "Full page layout. Include header, multiple sections, and footer as appropriate. Use semantic landmarks (<main>, <nav>, <aside>, <footer>). Compose from subcomponents.",
      ...(patternRef ? { patternRef } : {}),
    };
  }

  if (has(ATOM_WORDS) || tokens.length <= 3) {
    return {
      scope: "atom",
      lineBudget: 90,
      guidance:
        "Small primitive. Minimal API, props for the handful of variants/sizes that matter, no decorative clutter.",
    };
  }

  return {
    scope: "molecule",
    lineBudget: 180,
    guidance:
      "Composite component. Balance richness with clarity. Prefer composition over monolithic structures.",
    ...(patternRef ? { patternRef } : {}),
  };
}
