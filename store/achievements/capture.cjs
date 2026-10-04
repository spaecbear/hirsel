/*
 * The Steam achievement icons: 64×64, an earned and a locked one each, named
 * by the API name the partner site uses. Re-run after the art changes.
 *
 *   npm run dev                                                # in one terminal
 *   npx -y -p playwright node store/achievements/capture.cjs   # in another
 *
 * They land in store/achievements/icons/: NAME.png and NAME_locked.png.
 * Open http://localhost:5313/store/achievements/icons.html to look at them all.
 */
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { chromium } = require("playwright");

const DIR = join(__dirname, "icons");
const URL = process.env.ICONS_URL || "http://localhost:5313/store/achievements/icons.html";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.icons || document.querySelector("vite-error-overlay"), null, { timeout: 20000 });
  if (errors.length) throw new Error(errors.join("\n"));
  const icons = await page.evaluate(() => window.icons);
  mkdirSync(DIR, { recursive: true });
  for (const i of icons) {
    writeFileSync(join(DIR, `${i.api}.png`), Buffer.from(i.earned.split(",")[1], "base64"));
    writeFileSync(join(DIR, `${i.api}_locked.png`), Buffer.from(i.locked.split(",")[1], "base64"));
  }
  await page.screenshot({ path: join(__dirname, "sheet.png"), fullPage: true });
  console.log(`${icons.length * 2} icons in ${DIR}`);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
