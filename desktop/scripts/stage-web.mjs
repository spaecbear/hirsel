/*
 * Copy the web build into the desktop app.
 *
 * The desktop shell never builds the game itself: it takes exactly what
 * `npm run build` at the root produced, so the Steam build and the web build
 * are the same game by construction.
 */
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const from = join(here, "..", "..", "dist");
const to = join(here, "..", "web");

if (!existsSync(join(from, "index.html"))) {
  console.error("No web build at ../dist — run `npm run build` in the repo root first.");
  process.exit(1);
}
rmSync(to, { recursive: true, force: true });
// the service worker and manifest are for the web; a cache only gets in the way on disk
cpSync(from, to, {
  recursive: true,
  filter: (src) => !/[\\/](sw\.js|manifest\.webmanifest)$/.test(src),
});
console.log(`staged ${from} -> ${to}`);
