import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { FileStore, steamAchievementName } = require("../out/store.js");

const fresh = () => new FileStore(mkdtempSync(join(tmpdir(), "hirsel-store-")));

test("round-trips the game's own keys as files", () => {
  const s = fresh();
  assert.equal(s.read("hirsel.save.v1"), null);
  s.write("hirsel.save.v1", '{"v":1}');
  assert.equal(s.read("hirsel.save.v1"), '{"v":1}');
  assert.deepEqual(readdirSync(s.dir), ["hirsel.save.v1.json"]);
  s.remove("hirsel.save.v1");
  assert.equal(s.read("hirsel.save.v1"), null);
  s.remove("hirsel.save.v1"); // removing what is not there is fine
});

test("leaves no temporary file behind after a write", () => {
  const s = fresh();
  s.write("hirsel.settings.v1", "{}");
  s.write("hirsel.settings.v1", '{"muted":true}');
  assert.deepEqual(readdirSync(s.dir), ["hirsel.settings.v1.json"]);
});

test("refuses a key that could become a path", () => {
  const s = fresh();
  for (const bad of ["../escape", "a/b", "a\\b", "", ".hidden", "x".repeat(80)]) {
    assert.throws(() => s.write(bad, "x"), /bad storage key/, bad);
  }
});

test("names achievements the way the partner site wants them", () => {
  assert.equal(steamAchievementName("first-pound"), "FIRST_POUND");
  assert.equal(steamAchievementName("pelt"), "PELT");
  assert.equal(steamAchievementName("hundred-days"), "HUNDRED_DAYS");
});
