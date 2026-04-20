# @myui-sh/runtime

In-app variant overlay and slot-based UI generation runtime for `myui`.

This package provides the React components necessary to power `myui` in your running Next.js application. It allows you to wrap existing components in "slots", which `myui` can then target to generate, iterate, and preview UI component variants *directly* inside your app without leaving your browser or altering your production code.

## Examples

**Watch Demo:**
<video src="https://path-to-your-video.mp4" controls muted playsinline style="max-width: 100%; border-radius: 8px;"></video>

**Preview Dock:**
![myui Dock Preview](https://path-to-your-image.png)

## Installation

```bash
npm install @myui-sh/runtime
# or
pnpm add @myui-sh/runtime
```

## Setup

First, add the styles to your global layout or main entry point. Then, mount the `MyuiOverlay` component. The overlay is automatically stripped out in production builds (`NODE_ENV === "production"`).

```tsx
// app/layout.tsx
import "@myui-sh/runtime/styles.css";
import { MyuiOverlay } from "@myui-sh/runtime";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <MyuiOverlay />
      </body>
    </html>
  );
}
```

## Usage

### 1. Define Slots

Wrap the parts of your application you want to experiment on with `<MyuiSlot>`. Give each slot a unique `id`.

```tsx
import { MyuiSlot } from "@myui-sh/runtime";
import { CheckoutForm } from "@/components/CheckoutForm";

export default function CheckoutPage() {
  return (
    <main>
      <h1>Checkout</h1>
      
      {/* Target this slot to safely experiment with new checkout designs */}
      <MyuiSlot id="checkout-form">
        <CheckoutForm />
      </MyuiSlot>
    </main>
  );
}
```
*Note: In production builds, `MyuiSlot` dissolves completely and simply returns its `children`.*

### 2. Generate Variants (AI Skill & Slot Preview)

This package automatically bundles an AI Skill and handles slot previews to seamlessly integrate with AI assistants like GitHub Copilot or Claude. 

To use it, just open your AI assistant and prompt it. For example:
> `/myui polish my hero section`

The AI will automatically hook into the runtime and manage the variants by running the included `preflight`, `scaffold`, and `validate` scripts behind the scenes. This evaluates your current code, sets up the workspace, generates the new variant, and checks for typescript/build errors prior to inserting it into the slot.

### 3. In-App Preview & Iteration

When running your app locally (development mode), the `MyuiOverlay` will automatically detect active slots on the page. It renders a floating dock at the bottom of the screen.

You can use the overlay or keyboard shortcuts to toggle between the original component and the generated variants.

**Keyboard Shortcuts (when a slot is active):**
- `1`-`9`: Jump to a specific variant (`0` for the original component)
- `[` / `]`: Cycle previous/next variant (or Left/Right Arrows)
- `T`: Toggle overlay theme (light/dark)
- `H`: Hide/collapse the overlay dock

## Advanced Configuration

If you need programmatic control over the active variants across your application, you can wrap your component tree with `MyuiRegistryProvider`:

```tsx
import { MyuiRegistryProvider } from "@myui-sh/runtime";

export default function App({ children }) {
  return (
    <MyuiRegistryProvider>
      {children}
    </MyuiRegistryProvider>
  );
}
```
*Note: `MyuiOverlay` natively wraps itself in a registry provider if one does not exist up the tree.*

## Peer Dependencies

- `react` >= 18
- `react-dom` >= 18
