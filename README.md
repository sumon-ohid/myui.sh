<div align="center">

# myui.sh

**AI-powered UI generation — live inside your running app.**

Generate, preview, and apply polished React components with one prompt. Works with Claude Desktop and GitHub Copilot in VS Code.

[![npm](https://img.shields.io/npm/v/@myui-sh/runtime?label=%40myui-sh%2Fruntime&color=black)](https://www.npmjs.com/package/@myui-sh/runtime)
[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)

<!-- Replace with your actual demo video -->
<a href="YOUR_DEMO_VIDEO_URL">
  <img src="YOUR_DEMO_THUMBNAIL_URL" alt="myui.sh demo" width="100%" style="border-radius:12px" />
</a>

> Click the image above to watch the demo

</div>

---

## What is myui.sh?

myui.sh lets your AI assistant (Claude or GitHub Copilot) **generate multiple UI variants and show them live in your browser** — without reloading your app or touching your production code.

You just describe what you want. myui.sh:
1. Asks your AI to generate 1–3 component variants
2. Hot-reloads them into a floating dock inside your running app
3. Lets you click between variants to preview them instantly
4. Writes the one you pick directly to your source file

No copy-pasting code. No context switching. Just prompt → preview → apply.

---

## How It Works

<!-- Replace with your actual screenshot -->
![How myui.sh works](YOUR_HOW_IT_WORKS_SCREENSHOT_URL)

| Step | What happens |
|------|-------------|
| **1. Install** | Add `@myui-sh/runtime` and run the scaffold script — your `layout.tsx` is configured automatically |
| **2. Wrap a slot** | Wrap any component in `<MyuiSlot id="my-section">` to mark it as a target |
| **3. Prompt your AI** | Ask Claude or Copilot: *"generate a pricing table with 3 variants"* |
| **4. Preview live** | A floating dock appears in your app — click between variants in real time |
| **5. Apply** | Hit **Apply** on the variant you love — it's written to your source file instantly |

---

## Quick Start

### 1. Install the runtime

```bash
npm install -D @myui-sh/runtime
# or
pnpm add -D @myui-sh/runtime
```

> **What this does:** Installs the React overlay components and automatically copies the AI skill files to `~/.claude/` and `~/.copilot/` so your AI assistant knows how to use myui.

### 2. Scaffold your project

This one command wires up your `layout.tsx` and creates the `.myui/` config folder:

**Claude Desktop users:**
```bash
node ~/.claude/skills/myui/scripts/scaffold-runtime.mjs .
```

**GitHub Copilot (VS Code) users:**
```bash
node ~/.copilot/skills/myui/scripts/scaffold-runtime.mjs .
```

### 3. Wrap a component in a slot

```tsx
// app/page.tsx
import { MyuiSlot } from "@myui-sh/runtime";
import { HeroSection } from "@/components/HeroSection";

export default function HomePage() {
  return (
    <main>
      {/* myui can now target this slot */}
      <MyuiSlot id="hero">
        <HeroSection />
      </MyuiSlot>
    </main>
  );
}
```

> **Note:** In production builds, `<MyuiSlot>` is a no-op — it simply renders its children. Nothing is shipped to your users.

### 4. Prompt your AI

Open Claude Desktop or GitHub Copilot and type:

```
generate a modern pricing table in app/components/prices.tsx with 3 variants
```
```
refine the hero section in app/page.tsx
```
```
/myui create a dashboard layout with a sidebar
```

Your app's floating dock will appear with all the variants ready to preview.

---

## Screenshots

<!-- Replace the URLs below with your actual screenshots -->

**Floating variant dock:**
![myui variant dock](https://pub-0e5ba3c19f9e4dfc88bc4365c63c52eb.r2.dev/readme-assets/floating-panel.png)

**Applying a variant to source:**
![Applying a variant](https://pub-0e5ba3c19f9e4dfc88bc4365c63c52eb.r2.dev/readme-assets/floating-panel-apply.png)

**Generated variants:**
![AI generation in action](https://pub-0e5ba3c19f9e4dfc88bc4365c63c52eb.r2.dev/readme-assets/floating-dock-variants.png)

---

## Tailwind Support

The scaffold script integrates with your `tailwind.config.ts` automatically.

**Using Tailwind v4 (CSS-only config)?**
Tailwind v4 ignores files listed in `.gitignore` by default. myui intentionally keeps `myui-variants/` out of `.gitignore` so Tailwind scans the AI-generated variants and applies styles correctly during preview.

If you don't see Tailwind styles in your preview, check that your `.gitignore` doesn't explicitly exclude `app/myui-variants/` or `src/myui-variants/`.

---

## Troubleshooting

### `Error: Attempted to call registerSlots() from the server`

Your variant bootstrap is outdated. Update the runtime and re-run the scaffold:

```bash
npm update @myui-sh/runtime@latest
node ~/.claude/skills/myui/scripts/scaffold-runtime.mjs .
```

### Variants don't appear / dock doesn't show

- Make sure your Next.js dev server is running
- Confirm `<MyuiOverlay />` is mounted in your `layout.tsx`
- Check that the slot `id` in your component matches what the AI is targeting

### I don't want the skill files auto-copied

Set this env variable before installing:

```bash
MYUI_SKIP_SKILL_BOOTSTRAP=1 npm install -D @myui-sh/runtime
```

### Advanced: CLI smoke test

Use the standalone CLI to verify the daemon is running correctly:

```bash
pnpm dlx @myui-sh/cli dev smoke
```

---

## Packages

| Package | Description |
|---------|-------------|
| [`@myui-sh/runtime`](packages/runtime) | React overlay, slot components, and AI skill files |
| [`@myui-sh/cli`](packages/cli) | Standalone CLI for daemon management and diagnostics |
| [`@myui-sh/core`](packages/core) | Generation orchestration, schema, and validation |
| [`@myui-sh/preview`](packages/preview) | Vite daemon for live HMR previews |

---

## Contributing

PRs and issues are welcome. This is a monorepo using pnpm workspaces.

```bash
pnpm install
pnpm build
```

---

<div align="center">

Made with care · [npm](https://www.npmjs.com/package/@myui-sh/runtime)

</div>

---

<details>
<summary>Publishing a new package version (maintainers)</summary>

```bash
npm version patch --no-git-tag-version && npm publish --access public
```

</details>
