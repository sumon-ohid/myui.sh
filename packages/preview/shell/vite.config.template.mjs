import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { createRequire } from "node:module";
import fs from "node:fs";

const projectRoot = process.env.MYUI_PROJECT_ROOT;
if (!projectRoot) {
  throw new Error("MYUI_PROJECT_ROOT env var must be set");
}

const previewRoot = process.env.MYUI_PREVIEW_DIR ?? __dirname;
const requireFromHere = createRequire(import.meta.url);

const reactPath = requireFromHere.resolve("react");
const reactDomPath = requireFromHere.resolve("react-dom");
const reactDomClientPath = requireFromHere.resolve("react-dom/client");
const jsxRuntimePath = requireFromHere.resolve("react/jsx-runtime");
const jsxDevRuntimePath = requireFromHere.resolve("react/jsx-dev-runtime");

// Auto-detect global CSS
const cssCandidates = [
  "src/app/globals.css",
  "app/globals.css",
  "src/index.css",
  "src/main.css",
  "src/globals.css",
  "styles/globals.css",
  "styles/index.css"
];
let globalCssPath = null;
for (const cand of cssCandidates) {
  const p = path.resolve(projectRoot, cand);
  if (fs.existsSync(p)) {
    globalCssPath = p;
    break;
  }
}

export default defineConfig({
  css: {
    postcss: projectRoot, // Ensure Vite uses the PostCSS config from your Next.js root
  },
  plugins: [
    react(),
    {
      name: "myui-global-css-injector",
      transformIndexHtml(html) {
        if (globalCssPath) {
          const relativePath = `/@fs${globalCssPath}`;
          return html.replace(
            /<\/head>/,
            `  <script type="module">import "${relativePath}";</script>\n  </head>`
          );
        }
        return html;
      },
    },
  ],
  root: previewRoot,
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(projectRoot, "src") },
      { find: /^react$/, replacement: reactPath },
      { find: /^react-dom$/, replacement: reactDomPath },
      { find: /^react-dom\/client$/, replacement: reactDomClientPath },
      { find: /^react\/jsx-runtime$/, replacement: jsxRuntimePath },
      { find: /^react\/jsx-dev-runtime$/, replacement: jsxDevRuntimePath },
    ],
  },
  server: {
    fs: {
      allow: [previewRoot, __dirname, projectRoot],
    },
    strictPort: false,
  },
  optimizeDeps: {
    entries: [path.resolve(previewRoot, "main.tsx")],
  },
});