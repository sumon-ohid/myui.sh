# myui.sh

`myui.sh` is an interactive frontend development tool for generating, polishing, and injecting UI components via local AI (Claude or GitHub Copilot) directly into your running React / Next.js application.

## Installation

When developing in your Next.js application, install the runtime package. This will automatically bootstrap the necessary AI skill files in `~/.claude/` and `~/.copilot/`.

```bash
npm install -D @myui-sh/runtime
# or
pnpm add -D @myui-sh/runtime
```

*(You can set `MYUI_SKIP_SKILL_BOOTSTRAP=1` if you don't want the post-install script to copy the skills into your agent profiles).*

## Automatic Project Scaffolding

After adding the runtime, run the generated script to automatically configure your Next.js project. This will inject the `<MyuiRegistryProvider>`, `<MyuiOverlay>`, and `<MyuiSlotBootstrap />` into your `layout.tsx`, and create a `.myui/` configuration directory.

**For Claude Desktop Users:**
```bash
node ~/.claude/skills/myui/scripts/scaffold-runtime.mjs .
```

**For GitHub Copilot (VS Code) Users:**
```bash
node ~/.copilot/skills/myui/scripts/scaffold-runtime.mjs .
```

## Styling / Tailwind Support

The scaffold script automatically integrates with your `tailwind.config.ts`.
**If you are using Tailwind v4 (CSS-only config):** Tailwind naturally ignores files listed in `.gitignore`. Our scaffold explicitly leaves `myui-variants` *out* of your `.gitignore` to ensure Tailwind v4 scans the AI-generated variants instantly and provides correct CSS while previewing.

If you don't see Tailwind styling in your interactive preview, ensure your `.gitignore` does not explicitly ignore your `app/myui-variants/` or `src/myui-variants/` folder!

## Usage inside the Agent

Once scaffolded, ask your AI (Claude Desktop or GitHub Copilot):

- `generate a modern pricing table in app/components/prices.tsx with 3 variants`
- `refine the hero section in app/page.tsx`
- `/myui create a dashboard layout with a sidebar`

The AI will generate variants and drop them into a temporary `./myui-variants/` stage. A floating dock will appear in your running frontend application allowing you to freely switch between the generated variants, instantly preview them, and **apply** your favorite one directly to your source code!

## CLI Daemon & Troubleshooting

We bundle a standalone `@myui-sh/cli` for advanced inspection, managing previews, and smoke testing the daemon.

```bash
pnpm dlx @myui-sh/cli dev smoke
```

### Common Errors

> *Error: Attempted to call registerSlots() from the server*

You are using an outdated variant bootstrap. Update to the latest `runtime` version and re-run the scaffold script:

```bash
npm update @myui-sh/runtime@latest
node ~/.claude/skills/myui/scripts/scaffold-runtime.mjs .
```


# Publish new package version

```bash
npm version patch --no-git-tag-version && npm publish --access public
```
