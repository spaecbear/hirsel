/*
 * Render the trailer: every frame from trailer.ts, the music rendered offline,
 * and ffmpeg to put them together as a 1920×1080 H.264 MP4, scaled ×6 with
 * nearest-neighbour so every game pixel is a clean 6×6 block.
 *
 *   npm run dev                                                   # in one terminal
 *   npx -y -p playwright node store/media/capture-trailer.cjs     # in another
 *
 * Needs an ffmpeg with libx264 on the PATH, or its path in FFMPEG.
 * Writes store/media/trailer.mp4. Preview it live at
 * http://localhost:5313/store/media/trailer.html
 */
const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright");

const URL = process.env.TRAILER_URL || "http://localhost:5313/store/media/trailer.html?capture";
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const OUT = join(__dirname, "trailer.mp4");

(async () => {
  const dir = mkdtempSync(join(tmpdir(), "hirsel-trailer-"));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.trailer, null, { timeout: 30000 });
  const { FRAMES, FPS, DURATION } = await page.evaluate(() => ({ FRAMES: window.trailer.FRAMES, FPS: window.trailer.FPS, DURATION: window.trailer.DURATION }));
  console.log(`${FRAMES} frames, ${DURATION.toFixed(1)}s at ${FPS}fps`);
  const BATCH = 30;
  for (let i = 0; i < FRAMES; i += BATCH) {
    const pngs = await page.evaluate(([a, b]) => Array.from({ length: b - a }, (_, k) => window.trailer.frame(a + k)), [i, Math.min(FRAMES, i + BATCH)]);
    pngs.forEach((d, k) => writeFileSync(join(dir, `f${String(i + k).padStart(5, "0")}.png`), Buffer.from(d.split(",")[1], "base64")));
    if (i % 300 === 0) process.stdout.write(`  frame ${i}\n`);
  }
  const wav = await page.evaluate((s) => window.trailer.music(s), DURATION);
  writeFileSync(join(dir, "music.wav"), Buffer.from(wav, "base64"));
  await browser.close();
  if (errors.length) throw new Error(errors.join("\n"));

  execFileSync(FFMPEG, [
    "-y", "-loglevel", "error",
    "-framerate", String(FPS), "-i", join(dir, "f%05d.png"),
    "-i", join(dir, "music.wav"),
    "-vf", "scale=1920:1080:flags=neighbor",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart", "-shortest",
    OUT,
  ], { stdio: "inherit" });
  rmSync(dir, { recursive: true, force: true });
  console.log(`wrote ${OUT}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
