---
name: myui
description: Generate, polish, or refine UI components in the user's project with in-app variant preview via @myui/runtime.
---

# myui skill

Use this skill when a user asks to generate, redesign, or polish a UI section and wants to compare variants in their running app.

## Required context

Gather before writing variants:
1. target file and exact region
2. user prompt text (verbatim)
3. variant count (default 3)
4. project root

## One-time setup

If @myui/runtime is missing, run:
node ~/.copilot/skills/myui/scripts/scaffold-runtime.mjs <project-root>

This wires runtime overlay and creates generated variant folders.

## Variant workflow

1. Wrap target region with MyuiSlot id.
2. Write Variant1..VariantN files under <variantsDir>/<slot-id>/ (variantsDir from .myui/config.json; default app/myui-variants or src/myui-variants).
3. Write <variantsDir>/<slot-id>/manifest.ts re-exporting Variant1..VariantN as default.
4. Update <variantsDir>/_index.ts SLOT_LOADERS with: "<slot-id>": () => import("./<slot-id>/manifest").
5. Validate variants AND register slot (single command):
   node ~/.copilot/skills/myui/scripts/validate.mjs <project-root> <slot-id> --file <relative-path-to-wrapped-file>
   The --file flag writes the slot entry to .myui/slots.json. Required for /api/myui/apply to work. Always pass it.
6. If validation fails, repair only failing variants and rerun the same command. Registration only occurs when ok=true.

## Rules

- Do not write outside project root.
- No dangerous HTML usage.
- No forbidden imports.
- Prefer existing project UI primitives where available.
- Keep generated code production-ready and accessible.
