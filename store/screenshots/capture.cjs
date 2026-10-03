/*
 * The store screenshots: eight 1920×1080 shots of the real game, set up from
 * save states rather than played to. Re-run after the art changes.
 *
 *   npm run build && npx vite preview --port 5399 --strictPort   # in one terminal
 *   npx -y -p playwright node store/screenshots/capture.cjs       # in another
 *   npx -y -p playwright node store/screenshots/capture.cjs fire  # just the ones matching "fire"
 *
 * The narration, the hover label, the achievement toasts and the key prompts
 * are hidden for the shots: the save states trip achievements on load, and a
 * store shot should be the picture.
 */
const { join } = require("node:path");
const OUT = __dirname;
const { chromium } = require("playwright");
const breeds = ["blackface", "blackface", "cheviot", "hebridean", "blackface", "shetland", "cheviot", "blackface", "blackface", "hebridean", "cheviot", "blackface"];
const flock = (n, lambs = 0) => [
  ...Array.from({ length: n }, (_, i) => ({ id: i + 1, fleece: 5 + (i % 4), breed: breeds[i % breeds.length], age: 60 + i })),
  ...Array.from({ length: lambs }, (_, i) => ({ id: 100 + i, fleece: 1, breed: breeds[i % 3], age: 2, lamb: true })),
];
const kit = { crook: true, collie: true, boots: true, shears: true, lamp: true, cart: true, roof: true, hearth: true, byre: true, oilskin: true, saltlick: true };
const ONLY = process.argv[2];
const SHOTS = [
  // name, state patch, what to do before the shot, wait
  ["01-spring-lambs", { day: 6, flock: flock(9, 4), owned: kit, hay: 30, forecast: ["sun", "sun", "rain"], at: 0 }, null, 3500],
  ["02-summer-hill", { day: 34, flock: flock(12), owned: kit, hay: 70, forecast: ["sun", "sun", "sun"], at: 1 }, null, 3500],
  ["03-autumn", { day: 58, flock: flock(11), owned: kit, hay: 110, forecast: ["rain", "sun", "sun"], at: 0 }, null, 3500],
  ["04-winter-snow", { day: 80, flock: flock(10), owned: kit, hay: 60, forecast: ["snow", "snow", "sun"], at: 0 }, null, 3500],
  ["05-night-lantern", { day: 40, flock: flock(10), owned: kit, hay: 50, forecast: ["sun", "sun", "sun"], at: 0 }, "sleep", 2300],
  ["06-callum", { day: 12, flock: flock(7), owned: { crook: true, collie: true }, hay: 0, forecast: ["sun", "rain", "sun"], at: 0, event: { id: "callum-intro", day: 12, data: {} } }, null, 3500],
  ["07-the-inn", { day: 30, flock: flock(9), owned: kit, hay: 40, forecast: ["sun", "sun", "sun"], at: 0, money: 60 }, "pub", 4500],
  ["08-by-the-fire", { day: 44, flock: flock(9), owned: { ...kit, sword: true }, hay: 40, forecast: ["sun", "sun", "sun"], at: 0 }, "house", 3500],
];
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [name, patch, act, wait] of SHOTS) {
    if (ONLY && !name.includes(ONLY)) continue;
    const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
    p.on("pageerror", (e) => errs.push(`${name}: ${e.message}`));
    await p.addInitScript(() => { if (!sessionStorage.getItem("i")) { sessionStorage.setItem("i","1"); localStorage.setItem("hirsel.settings.v1", JSON.stringify({ seenTitle: true, tutorialSeen: true, muted: true })); } });
    await p.goto("http://localhost:5399/"); await p.waitForTimeout(800);
    await p.click("#title-new"); await p.waitForTimeout(1500);
    await p.click("#btn-settings"); await p.waitForTimeout(300);
    await p.getByText("Save now").click(); await p.click("#settings-close");
    await p.evaluate((patch) => {
      const f = JSON.parse(localStorage.getItem("hirsel.save.v1"));
      const owned = { ...f.state.owned, ...(patch.owned || {}) };
      Object.assign(f.state, patch, { owned, taps: 3 });
      f.state.eventDays["callum-intro"] = 3;
      if (patch.event) f.state.eventDays[patch.event.id] = patch.event.day;
      f.state.log = [];
      localStorage.setItem("hirsel.save.v1", JSON.stringify(f));
    }, patch);
    await p.reload(); await p.waitForTimeout(700);
    await p.click("#title-continue"); await p.waitForTimeout(6000); // let the load toast go
    if (act === "sleep") await p.keyboard.press("z");
    if (act === "pub") await p.keyboard.press("i");
    if (act === "house") { await p.mouse.click(230, 760); await p.mouse.move(1900, 1000); }
    await p.waitForTimeout(wait);
    // store shots: the picture, not the narration or a hover label
    await p.addStyleTag({ content: "#sky-log, #hint, #toast, #prompts { display: none !important; }" });
    await p.waitForTimeout(100);
    await p.screenshot({ path: join(OUT, `${name}.png`) });
    await p.close();
  }
  console.log("errors:", errs); await b.close();
})();
