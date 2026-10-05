/*
 * The Steam store and library art, and the app icon, from media.ts.
 *
 *   npm run dev                                          # in one terminal
 *   npx -y -p playwright node store/media/capture.cjs    # in another
 *
 * Writes the PNGs to store/media/, an icon.ico (16, 32, 48, 256) for Windows,
 * and puts the new icon in public/ (icon-192.png, icon-512.png), which the web
 * build and the desktop build both use. Look at them all at
 * http://localhost:5313/store/media/media.html
 */
const { writeFileSync, copyFileSync } = require("node:fs");
const { join } = require("node:path");
const { chromium } = require("playwright");

const URL = process.env.MEDIA_URL || "http://localhost:5313/store/media/media.html";

/** an .ico holding PNG images, which every Windows since Vista reads */
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, e);
    head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt8(0, e + 2);
    head.writeUInt8(0, e + 3);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.data)]);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.media, null, { timeout: 30000 });
  if (errors.length) throw new Error(errors.join("\n"));
  const media = await page.evaluate(() => window.media);
  await browser.close();
  const files = {};
  for (const m of media) {
    const data = Buffer.from(m.png.split(",")[1], "base64");
    files[m.name] = data;
    writeFileSync(join(__dirname, `${m.name}.png`), data);
  }
  writeFileSync(
    join(__dirname, "icon.ico"),
    ico([16, 32, 48, 256].map((size) => ({ size, data: files[`icon_${size}`] }))),
  );
  const pub = join(__dirname, "..", "..", "public");
  copyFileSync(join(__dirname, "icon_512.png"), join(pub, "icon-512.png"));
  copyFileSync(join(__dirname, "icon_192.png"), join(pub, "icon-192.png"));
  console.log(`${media.length} images, icon.ico, and the icons in public/`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
