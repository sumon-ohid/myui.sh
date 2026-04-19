---
name: myui
description: Generate, polish, or refine UI components in the user's project with in-app variant preview via @myui-sh/runtime.
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

If @myui-sh/runtime is missing, run:
node ~/.claude/skills/myui/scripts/scaffold-runtime.mjs <project-root>

This wires runtime overlay and creates generated variant folders.

## Variant workflow

1. Wrap target region with MyuiSlot id.
2. Write Variant1..VariantN files under <variantsDir>/<slot-id>/ (variantsDir from .myui/config.json; default app/myui-variants or src/myui-variants).
3. Run validate/register:
   node ~/.claude/skills/myui/scripts/validate.mjs <project-root> <slot-id> --file <relative-path-to-wrapped-file>

   On ok=true the script auto-writes:
   - <variantsDir>/<slot-id>/manifest.ts (Variant re-exports)
   - <variantsDir>/_index.ts SLOT_LOADERS entry
   - .myui/slots.json entry (when --file is passed — REQUIRED for /api/myui/apply)

   Do NOT hand-edit manifest.ts, _index.ts, or slots.json. The script owns them.
4. If validation fails, fix only failing variants and rerun the same command. Registration only occurs when ok=true.

## Rules

- Do not write outside project root.
- No dangerous HTML usage.
- No forbidden imports.
- Prefer existing project UI primitives where available.
- Keep generated code production-ready and accessible.
