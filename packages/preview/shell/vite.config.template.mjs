import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { createRequire } from "node:module";

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

export default defineConfig({
  plugins: [react()],
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