import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const projectRoot = process.env.MYUI_PROJECT_ROOT;
if (!projectRoot) {
  throw new Error("MYUI_PROJECT_ROOT env var must be set");
}

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "src"),
    },
  },
  server: {
    fs: {
      allow: [__dirname, projectRoot],
    },
    strictPort: false,
  },
  optimizeDeps: {
    entries: [path.resolve(__dirname, "main.tsx")],
  },
});