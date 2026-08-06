import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    /*
     * Its own port, deliberately.
     *
     * localhost:5173 is one origin shared by every Vite project on the machine,
     * so a service worker or cached document left behind by another project is
     * served to this one and looks like "my changes aren't showing up".
     * strictPort makes a clash fail loudly instead of silently moving to 5174 —
     * a moved port means you end up looking at somebody else's app.
     */
    port: 5313,
    strictPort: true,
  },
  build: {
    target: "es2020",
    outDir: "dist",
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
} as Parameters<typeof defineConfig>[0] & { test: unknown });
