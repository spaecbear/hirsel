/**
 * Node's global `localStorage` is unreliable in some environments — this one
 * included, where it's present but broken (a bare `{}` with no methods,
 * downstream of Node's experimental `--localstorage-file` flag pointing
 * nowhere valid). `saveEarned`/`saveSettings`/`saveGame` all swallow storage
 * errors on purpose (a failed save is never worth throwing over for a
 * player), which means a broken global fails *silently* — a test can call
 * `saveEarned(["pelt"])` and get no error, then `loadEarned()` back an empty
 * array, and the only sign anything's wrong is the assertion after it.
 *
 * The project has real, load-bearing localStorage use (settings, saves,
 * achievements, found cheats), so tests need a working implementation rather
 * than hoping the host's Node build has that flag configured. Installed
 * unconditionally, so the suite behaves the same on every machine and in CI.
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number) {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
}

globalThis.localStorage = new MemoryStorage();
