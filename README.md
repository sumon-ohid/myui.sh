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
