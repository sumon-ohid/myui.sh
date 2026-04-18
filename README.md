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
