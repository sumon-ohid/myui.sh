# myui.sh

## Phase 3 Smoke Test

Run a quick browser preview with exactly 2 local variants:

```bash
pnpm --filter @myui/cli dev smoke
```

If you do not want auto-open behavior:

```bash
pnpm --filter @myui/cli dev smoke --no-open
```

Stop the preview daemon when done:

```bash
pnpm --filter @myui/cli dev daemon stop
```

## Test Generate Flow Without Claude

When your Claude quota is exhausted, you can still test the full generate command flow (preview + selection + write) using local mock variants:

```bash
pnpm --filter @myui/cli dev generate "pricing card" --variants 2 --mock
```

# How to use myui.sh

## add this to package.json
    "@myui/runtime": "file:/Users/sumon/MAIN_PROJECTS/myui.sh/packages/runtime"

When @myui/runtime is installed, it now auto-bootstraps Claude files in ~/.claude:
- skills/myui/SKILL.md
- skills/myui/scripts/scaffold-runtime.mjs
- skills/myui/scripts/validate.mjs
- commands/myui.md

To skip auto-bootstrap during install:
MYUI_SKIP_CLAUDE_BOOTSTRAP=1 pnpm add @myui/runtime

## then run this
node ~/.claude/skills/myui/scripts/scaffold-runtime.mjs /path/to/your/project

## usage 
/myui polish the hero section in app/Home/hero-section.tsx
