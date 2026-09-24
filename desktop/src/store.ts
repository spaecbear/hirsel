/**
 * The desktop build's storage: one small JSON file per key.
 *
 * The game asks for the same keys it uses in `localStorage` on the web
 * (`hirsel.save.v1`, `hirsel.settings.v1`, `hirsel.achievements.v1`), and each
 * becomes `<key>.json` in the saves folder. That folder is what Steam Auto-Cloud
 * is pointed at, so the files are the whole of the cloud sync.
 *
 * Writes are atomic — written to a temporary file, then renamed over the real
 * one — so a crash or a power cut mid-write leaves the last good save, never
 * half of one.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** keys are game-chosen, but never trust a string to become a path unchecked */
const SAFE_KEY = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

export class FileStore {
  constructor(readonly dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  private file(key: string): string {
    if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error(`bad storage key: ${key}`);
    return join(this.dir, `${key}.json`);
  }

  read(key: string): string | null {
    const f = this.file(key);
    if (!existsSync(f)) return null;
    return readFileSync(f, "utf8");
  }

  write(key: string, value: string): void {
    const f = this.file(key);
    const tmp = `${f}.tmp`;
    writeFileSync(tmp, value, "utf8");
    renameSync(tmp, f);
  }

  remove(key: string): void {
    rmSync(this.file(key), { force: true });
  }
}

/**
 * Steam's API name for one of the game's achievement ids.
 *
 * The game uses ids like `first-pound`; Steam API names are conventionally
 * upper case with underscores, so the partner site entry is `FIRST_POUND`.
 * `npm run achievements` prints the full list to enter.
 */
export function steamAchievementName(id: string): string {
  return id.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}
