/*
 * Copy the web build into the desktop app.
 *
 * The desktop shell never builds the game itself: it takes exactly what
 * `npm run build` at the root produced, so the Steam build and the web build
 * are the same game by construction.
 */
import { cpSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// --demo stages the demo build (../dist-demo) instead, and says so for main.ts
const demo = process.argv.includes("--demo");
const from = join(here, "..", "..", demo ? "dist-demo" : "dist");
const to = join(here, "..", "web");

if (!existsSync(join(from, "index.html"))) {
  console.error(`No web build at ${from} — run \`npm run ${demo ? "build:demo" : "build"}\` in the repo root first.`);
  process.exit(1);
}
rmSync(to, { recursive: true, force: true });
// the service worker and manifest are for the web; a cache only gets in the way on disk
cpSync(from, to, {
  recursive: true,
  filter: (src) => !/[\\/](sw\.js|manifest\.webmanifest)$/.test(src),
});
// which game this is, for the shell: the demo is a different Steam app
writeFileSync(join(to, "build.json"), JSON.stringify({ demo }));
console.log(`staged ${from} -> ${to}${demo ? " (demo)" : ""}`);
