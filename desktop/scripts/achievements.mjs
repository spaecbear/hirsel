/*
 * Print the achievements to enter on the Steamworks partner site.
 *
 * Read straight from the game's own list, so the two cannot drift: the API
 * name, the display name, the description, and whether Steam should hide it
 * until earned. Hidden ones take their `hint` as the description — Steam only
 * shows it once the achievement is unlocked, exactly as the game does.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "..", "src", "sim", "achievements.ts"), "utf8");

const list = src.slice(src.indexOf("export const ACHIEVEMENTS"), src.indexOf("\n];"));
const entries = [];
for (const m of list.matchAll(/\{\s*(?:\/\/[^\n]*\n\s*)*id:\s*"([^"]+)"[\s\S]*?won:/g)) {
  const body = m[0];
  const get = (k) => body.match(new RegExp(`${k}:\\s*"([^"]*)"`))?.[1] ?? "";
  entries.push({
    api: m[1].toUpperCase().replace(/[^A-Z0-9]+/g, "_"),
    name: get("name"),
    description: get("hint"),
    hidden: /secret:\s*true/.test(body),
  });
}

if (process.argv.includes("--md")) {
  console.log("| API name | name | description | hidden |\n| --- | --- | --- | --- |");
  for (const e of entries) console.log(`| \`${e.api}\` | ${e.name} | ${e.description} | ${e.hidden ? "yes" : ""} |`);
} else {
  console.log(JSON.stringify(entries, null, 2));
}
console.error(`${entries.length} achievements`);
