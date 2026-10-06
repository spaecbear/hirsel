/*
 * The trailer, rendered frame by frame by the game's own art and scored with
 * its own music.
 *
 * Screen-recording a pixel game smears it, and the timing wanders. Instead
 * each frame is drawn exactly: the scene at the game's pixel size (320×180),
 * then a camera over it. The camera only ever scales by whole numbers, ×6 for
 * the whole frame up to ×20 for a close-up, so every game pixel stays a clean
 * square block; it pans by whole screen pixels, so a slow pan is smooth. Cuts
 * go from wide to close the way a film does, rather than zooming.
 *
 * The shots: the night and the name; the office and the leaving; the train;
 * the climb and the glen from the crest; the hill and its work in close-up,
 * the shepherd on his knees to a ewe, at his pipe, the dog at work; the inn,
 * the fire, the winter; the dark coming down, a sheep under the lantern, a
 * fox; and, last, two eyes on the skyline. Then the name, to wishlist it.
 *
 * It names nothing secret: the eyes are only eyes.
 */
import { Painter, clamp01, ease } from "../../src/render/painter";
import { drawOpening } from "../../src/render/opening";
import { layoutInterior, layoutWorld } from "../../src/render/layout";
import { drawWolfBeast } from "../../src/render/sprites";
import { driftFor } from "../../src/render/wander";
import { AudioEngine } from "../../src/audio/engine";
import { Score } from "../../src/audio/score";
import { Sfx, type SfxName } from "../../src/audio/sfx";
import type { AnimId, GameState } from "../../src/sim/types";
import { glen, run } from "./scene";
import { GORSE, WOOL, pixelText, textSize } from "./pixelfont";

export const W = 320;
export const H = 180;
export const FPS = 30;
const OUT_W = 1920;
const OUT_H = 1080;

/** where the camera looks: a point in game pixels, and how many screen pixels each one gets */
interface Cam {
  x: number;
  y: number;
  k: number;
}
interface Shot {
  /** seconds */
  dur: number;
  /** the scene at game size, and where the camera is, for `t` 0 to 1 across the shot */
  draw: (g: Painter, t: number, ms: number) => Cam;
  /** a hard cut into this shot, rather than a dip through black */
  cut?: boolean;
  /** the game's own sound effects, at seconds into the shot */
  sounds?: [number, SfxName][];
}

const WIDE: Cam = { x: W / 2, y: H / 2, k: 6 };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pan = (from: Cam, to: Cam, t: number): Cam => ({ x: lerp(from.x, to.x, ease(t)), y: lerp(from.y, to.y, ease(t)), k: from.k });

/* ---- the runs the shots are of ---- */
const SUMMER = run({ day: 30, at: 0 });
const SLOPE = run({ day: 32, at: 1, seed: 3 });
const SPRING = run({ day: 6, at: 0, lambs: 4, seed: 5 });
const WINTER = run({ day: 80, at: 0, weather: "snow", lambs: 0, seed: 7 });
const NIGHT = run({ day: 40, at: 0, seed: 9 });
const CORRIE = run({ day: 44, at: 2, seed: 13 });
const BUILDING = (() => {
  const st = run({ day: 26, at: 0, owned: { roof: false, hearth: false } });
  st.building = { id: "roof", done: 1 };
  return st;
})();

const L = (st: GameState, ms = 4200, shepherdAt: { x: number; y: number } | null = null) =>
  layoutWorld(W, H, st, { time: ms, shepherdAt });

/** a glen shot, with an animation running across it and a camera */
function hill(
  st: GameState,
  cam: (t: number, ms: number) => Cam,
  o: { anim?: AnimId; from?: number; to?: number; interior?: boolean; payload?: { croft?: string }; shepherdAt?: { x: number; y: number } } = {},
) {
  return (g: Painter, t: number, ms: number) => {
    const p = o.anim ? (o.from ?? 0) + ((o.to ?? 1) - (o.from ?? 0)) * t : 0;
    g.cx.drawImage(glen(W, H, st, ms, { anim: o.anim ?? null, p, interior: o.interior, payload: o.payload, shepherdAt: o.shepherdAt }), 0, 0);
    return cam(t, ms);
  };
}

function opening(from: number, to: number, cam: (t: number) => Cam = () => WIDE) {
  return (g: Painter, t: number, ms: number) => {
    drawOpening(g, W, H, from + (to - from) * t, ms);
    return cam(t);
  };
}

/** lettering, centred on wherever the camera is looking, so it sits still on the screen while the scene pans under it */
function title(g: Painter, cam: Cam, lines: { text: string; k: number; ink?: typeof GORSE; dy: number; gap?: number; from?: number }[], t: number) {
  for (const l of lines) {
    const { w, h } = textSize(l.text, l.k, l.gap);
    // each line can come in a beat after the one above it
    const alpha = clamp01((t - (l.from ?? 0)) / 0.15);
    if (alpha > 0) pixelText(g, l.text, Math.round(cam.x - w / 2), Math.round(cam.y + l.dy - h / 2), l.k, l.ink ?? GORSE, alpha, l.gap);
  }
}

/* ---- the lantern: the shepherd under it, and the moment a ewe has drifted closest ---- */
const lampAt = L(NIGHT).lampPost;
const underLamp = { x: lampAt.x - 18, y: lampAt.y - 24 };
const lampMoment = (() => {
  // the flock drifts towards him; find when one of them is nearest the post
  let best = { t: 0, d: Infinity };
  for (let t = 0; t < 400000; t += 400) {
    const lay = L(NIGHT, t, underLamp);
    NIGHT.flock.forEach((sh, i) => {
      const home = lay.flock[i];
      if (!home) return;
      const d0 = driftFor(sh.id + 1, t, { dx: lay.shepherd.x - home.x, dy: lay.shepherd.y + 10 - home.y });
      const d = Math.hypot(home.x + d0.dx + 10 - (lampAt.x + 8), home.y + d0.dy + 8 - (lampAt.y - 4));
      if (d < best.d) best = { t, d };
    });
  }
  return best.t;
})();

/* ---- the eyes on the skyline ---- */
function eyes(g: Painter, t: number, ms: number): Cam {
  const st = CORRIE;
  g.cx.drawImage(glen(W, H, st, ms, { anim: "sleep", p: 1 }), 0, 0);
  const lay = L(st, ms);
  const ex = Math.round(W * 0.6);
  const ey = Math.round(lay.horizonY + 4);
  // they come up out of the dark, hold, blink once, and are gone
  const come = clamp01((t - 0.2) / 0.3);
  const blink = t > 0.66 && t < 0.7 ? 0 : 1;
  const go = 1 - clamp01((t - 0.86) / 0.08);
  const a = come * blink * go;
  if (a > 0) {
    /*
     * Two separate glints, each with a little glow of its own, low against
     * the dark of the hill. Drawn as the beast's eye-glow they read as one
     * lit window: a box of light rather than two eyes.
     */
    for (const dx of [0, 5]) {
      g.a(ex + dx - 1, ey - 1, 4, 3, 255, 196, 70, 0.18 * a);
      g.a(ex + dx, ey, 2, 1, 255, 214, 96, a);
      g.a(ex + dx, ey + 1, 2, 1, 214, 150, 40, 0.8 * a);
    }
  }
  return { x: ex + 3, y: ey - 4, k: 20 };
}
void drawWolfBeast;

export const SHOTS: Shot[] = [
  // the night, and the name over it, the camera coming down out of the stars onto the croft's lit window
  {
    dur: 5.5,
    draw: (g, t, ms) => {
      const cam = hill(NIGHT, (tt) => pan({ x: W / 2, y: 540 / 8, k: 8 }, { x: W / 2, y: H - 540 / 8, k: 8 }, tt), { anim: "sleep", from: 1, to: 1 })(g, t, ms);
      if (t < 0.9) title(g, cam, [{ text: "HIRSEL", k: 3, dy: -14, from: 0.45 }], t);
      return cam;
    },
  },
  // the office: the envelope going into the tray, close; then him away out of the door
  { dur: 4, draw: opening(0.03, 0.15, () => ({ x: 166, y: 126, k: 10 })) },
  { dur: 3, draw: opening(0.15, 0.22), cut: true },
  { dur: 3, draw: opening(0.28, 0.4) },
  { dur: 3.5, draw: opening(0.5, 0.75) },
  // over the crest, close on his back; then the glen opening out below him
  { dur: 3, draw: opening(0.82, 0.9, () => ({ x: W / 2, y: H * 0.72, k: 10 })) },
  { dur: 3.2, draw: opening(0.9, 0.97), cut: true },
  // the hill: a slow look along it
  { dur: 4, draw: hill(SUMMER, (t) => pan({ x: 120, y: H / 2 + 10, k: 8 }, { x: 200, y: H / 2 + 10, k: 8 }, t)) },
  // close: on his knees to a ewe
  { dur: 3.2, draw: hill(SUMMER, () => ({ x: L(SUMMER).shepherd.x + 16, y: L(SUMMER).shepherd.y + 14, k: 12 }), { anim: "tend" }), cut: true, sounds: [[0.6, "bleat"], [2.1, "bleat"]] },
  // close: the pipe
  { dur: 3, draw: hill(SLOPE, () => ({ x: L(SLOPE).shepherd.x + 8, y: L(SLOPE).shepherd.y + 10, k: 15 }), { anim: "pipe" }), cut: true, sounds: [[0.3, "pipe"]] },
  // the clip coming off
  { dur: 2.2, draw: hill(SPRING, () => ({ x: L(SPRING).shepherd.x + 14, y: L(SPRING).shepherd.y + 8, k: 10 }), { anim: "shear" }), cut: true, sounds: [[0.1, "shears"], [1.1, "shears"]] },
  // the dog at her work, the camera running with her
  {
    dur: 2.6,
    draw: hill(SUMMER, (_t, ms) => {
      const d = L(SUMMER, ms).dogAt;
      return { x: d.x + 10, y: d.y + 4, k: 12 };
    }),
    cut: true,
    sounds: [[0.7, "bark"]],
  },
  // muck and hay, the camera walking with him
  {
    dur: 2.6,
    draw: hill(SUMMER, (t) => ({ x: Math.round(W * 0.08) + Math.round(W * 0.6) * ease(t) + 16, y: L(SUMMER).shepherd.y + 16, k: 8 }), { anim: "muck" }),
    cut: true,
  },
  {
    dur: 2.6,
    draw: hill(SLOPE, (t) => ({ x: Math.round(W * 0.08) + Math.round(W * 0.6) * ease(t) + 6, y: L(SLOPE).shepherd.y + 16, k: 8 }), { anim: "hay" }),
    cut: true,
    sounds: [[0.2, "shears"], [1.3, "shears"]],
  },
  { dur: 2.6, draw: hill(BUILDING, () => ({ x: L(BUILDING).croft.x + 30, y: L(BUILDING).croft.y + 20, k: 10 }), { anim: "build", payload: { croft: "roof" } }), cut: true, sounds: [[0.3, "build"], [1.4, "build"]] },
  // the inn, and the fire at home with the dog at it
  // from once he is in the door: the walk-in opens on the hill, which flashed up between the roof and the bar
  { dur: 3.2, draw: hill(SUMMER, () => ({ x: W / 2, y: H / 2 + 8, k: 8 }), { anim: "pub", from: 0.25, to: 1 }), cut: true, sounds: [[0, "pub"]] },
  {
    dur: 3,
    draw: hill(NIGHT, () => {
      const I = layoutInterior(W, H, NIGHT);
      return { x: I.dogSpot.x + 12, y: I.dogSpot.y - 6, k: 12 };
    }, { interior: true }),
  },
  // winter, wide
  { dur: 3, draw: hill(WINTER, (t) => pan({ x: 130, y: H / 2, k: 7 }, { x: 190, y: H / 2, k: 7 }, t)), sounds: [[0.2, "wind"]] },
  // the dark coming down, and a ewe under the lantern
  { dur: 2.6, draw: hill(NIGHT, () => WIDE, { anim: "sleep", from: 0, to: 1 }), sounds: [[0.2, "wind"]] },
  {
    dur: 3.6,
    draw: (g, t) => hill(NIGHT, () => ({ x: lampAt.x + 4, y: lampAt.y - 14, k: 15 }), { anim: "sleep", from: 1, to: 1, shepherdAt: underLamp })(g, t, lampMoment - 1800 + t * 3600),
    cut: true,
    sounds: [[1.4, "bleat"]],
  },
  // a fox in the night
  { dur: 2.8, draw: hill(NIGHT, () => WIDE, { anim: "fox" }), cut: true, sounds: [[0.3, "fox"], [1.2, "bark"]] },
  // and something else, up on the skyline
  { dur: 4.2, draw: eyes, sounds: [[1.0, "wolf"]] },
  // the name
  {
    dur: 6,
    draw: (g, t, ms) => {
      const cam = hill(NIGHT, () => ({ x: W / 2, y: H / 2, k: 6 }), { anim: "sleep", from: 1, to: 1 })(g, t, ms);
      g.a(0, 0, W, H, 6, 8, 14, 0.5);
      // the name, the line from the title screen under it, and then where to find it
      title(g, cam, [
        { text: "HIRSEL", k: 4, dy: -18, ink: GORSE },
        { text: "A HILL, A FLOCK, AND A LIFE TO BUILD ON IT", k: 1, ink: WOOL, dy: 10, gap: 1, from: 0.2 },
        { text: "WISHLIST ON STEAM", k: 1, ink: GORSE, dy: 32, from: 0.45 },
      ], t);
      return cam;
    },
  },
];

export const DURATION = SHOTS.reduce((a, s) => a + s.dur, 0);
export const FRAMES = Math.round(DURATION * FPS);

/** which shot frame `i` falls in, and how far through it */
function at(i: number) {
  let t = i / FPS;
  for (let k = 0; k < SHOTS.length; k++) {
    if (t < SHOTS[k].dur || k === SHOTS.length - 1) return { k, t: Math.min(1, t / SHOTS[k].dur), secs: t };
    t -= SHOTS[k].dur;
  }
  return { k: 0, t: 0, secs: 0 };
}

const DIP = 0.35; // seconds of black either side of a cut that is not hard

/** the frame at full size: the scene, the camera over it at a whole-number scale, and any dip to black */
export function frame(i: number): HTMLCanvasElement {
  const src = document.createElement("canvas");
  src.width = W;
  src.height = H;
  const g = new Painter(src.getContext("2d")!, W, H);
  g.px(0, 0, W, H, "#000");
  const { k: n, t, secs } = at(i);
  const shot = SHOTS[n];
  g.cx.save();
  const cam = shot.draw(g, t, (i / FPS) * 1000);
  g.cx.restore();

  const out = document.createElement("canvas");
  out.width = OUT_W;
  out.height = OUT_H;
  const cx = out.getContext("2d")!;
  cx.imageSmoothingEnabled = false;
  cx.fillStyle = "#000";
  cx.fillRect(0, 0, OUT_W, OUT_H);
  // keep the view inside the scene, and land on whole screen pixels
  const halfW = OUT_W / 2 / cam.k;
  const halfH = OUT_H / 2 / cam.k;
  const x = Math.min(W - halfW, Math.max(halfW, cam.x));
  const y = Math.min(H - halfH, Math.max(halfH, cam.y));
  cx.drawImage(src, Math.round(OUT_W / 2 - x * cam.k), Math.round(OUT_H / 2 - y * cam.k), W * cam.k, H * cam.k);

  const left = shot.dur - secs;
  const next = SHOTS[n + 1];
  let dark = 0;
  if (!shot.cut && secs < DIP) dark = Math.max(dark, 1 - ease(secs / DIP));
  if (next && !next.cut && left < DIP) dark = Math.max(dark, 1 - ease(left / DIP));
  if (n === 0 && secs < 0.8) dark = Math.max(dark, 1 - secs / 0.8);
  if (n === SHOTS.length - 1 && left < 0.8) dark = Math.max(dark, 1 - left / 0.8);
  if (dark > 0) {
    cx.fillStyle = `rgba(0,0,0,${dark.toFixed(3)})`;
    cx.fillRect(0, 0, OUT_W, OUT_H);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * the music: the game's own score, rendered offline to a WAV
 * ------------------------------------------------------------------ */

export async function music(seconds: number): Promise<string> {
  const rate = 44100;
  const off = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
  // the engine nudges its context into running; an offline one runs when it is rendered, and throws if asked
  (off as unknown as { resume: () => Promise<void> }).resume = () => Promise.resolve();
  // the engine builds its own context; hand it the offline one instead
  const real = window.AudioContext;
  (window as unknown as { AudioContext: unknown }).AudioContext = function () {
    return off;
  };
  const engine = new AudioEngine();
  engine.start();
  (window as unknown as { AudioContext: unknown }).AudioContext = real;
  // the effects up, as a trailer mixes them: in the game they sit well under the air
  const MUSIC = 0.6;
  engine.setLevels({ master: 0.85, music: MUSIC, sfx: 2.4, muted: false });
  const score = new Score(engine);
  score.start();
  score.stop(); // its clock is the real one; the bars are laid down by hand below
  const s = score as unknown as { scheduleBar: (t: number, bar: number) => void; bars: unknown[]; beat: number };
  const barLen = s.beat * 4;
  let bar = 0;
  for (let t = 0.4; t < seconds; t += barLen) {
    s.scheduleBar(t, bar);
    bar = (bar + 1) % s.bars.length;
  }
  /*
   * The game's own sound effects over it, each at its moment in its shot.
   * An effect starts at the engine's clock, which in an offline render is
   * nowhere yet, so the clock is pointed at the moment for each one.
   */
  const sfx = new Sfx(engine);
  const cues: number[] = [];
  let start = 0;
  for (const shot of SHOTS) {
    for (const [at, name] of shot.sounds ?? []) {
      const when = start + at;
      Object.defineProperty(engine, "now", { get: () => when, configurable: true });
      sfx.play(name);
      cues.push(when);
    }
    start += shot.dur;
  }
  delete (engine as unknown as { now?: number }).now;
  // the air dips under each effect and comes back after it, so the effect is heard rather than buried
  const duck = engine.musicBus.gain;
  duck.setValueAtTime(MUSIC, 0);
  // effects close together share one dip: [down from, back from]
  const dips: [number, number][] = [];
  for (const t0 of cues.sort((x, y) => x - y)) {
    const last = dips[dips.length - 1];
    if (last && t0 - 0.12 <= last[1] + 0.6) last[1] = t0 + 0.9;
    else dips.push([t0 - 0.12, t0 + 0.9]);
  }
  for (const [down, up] of dips) {
    duck.setValueAtTime(MUSIC, Math.max(0, down));
    duck.linearRampToValueAtTime(MUSIC * 0.6, down + 0.17);
    duck.setValueAtTime(MUSIC * 0.6, up);
    duck.linearRampToValueAtTime(MUSIC, up + 0.6);
  }

  // and fade it out with the picture
  engine.master.gain.setValueAtTime(0.85, seconds - 2.5);
  engine.master.gain.linearRampToValueAtTime(0, seconds - 0.2);
  const buf = await off.startRendering();
  return wav(buf);
}

/** 16-bit PCM WAV, base64 */
function wav(buf: AudioBuffer): string {
  const ch = buf.numberOfChannels;
  const n = buf.length;
  const bytes = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => bytes.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  bytes.setUint32(4, 36 + n * ch * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  bytes.setUint32(16, 16, true);
  bytes.setUint16(20, 1, true);
  bytes.setUint16(22, ch, true);
  bytes.setUint32(24, buf.sampleRate, true);
  bytes.setUint32(28, buf.sampleRate * ch * 2, true);
  bytes.setUint16(32, ch * 2, true);
  bytes.setUint16(34, 16, true);
  str(36, "data");
  bytes.setUint32(40, n * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i]));
      bytes.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  }
  let bin = "";
  const u8 = new Uint8Array(bytes.buffer);
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(bin);
}

/* ------------------------------------------------------------------ *
 * the page: a preview, and hooks for the capture script
 * ------------------------------------------------------------------ */

const view = document.getElementById("view") as HTMLCanvasElement | null;
if (view) {
  view.width = OUT_W / 2;
  view.height = OUT_H / 2;
  const vg = view.getContext("2d")!;
  const start = performance.now();
  const tick = () => {
    const i = Math.floor(((performance.now() - start) / 1000) * FPS) % FRAMES;
    vg.drawImage(frame(i), 0, 0, OUT_W / 2, OUT_H / 2);
    requestAnimationFrame(tick);
  };
  if (!new URLSearchParams(location.search).has("capture")) requestAnimationFrame(tick);
}
Object.assign(window, {
  trailer: {
    FRAMES,
    FPS,
    DURATION,
    /** the first frame of each shot, for checking one */
    starts: SHOTS.map((_, n) => Math.round(SHOTS.slice(0, n).reduce((a, x) => a + x.dur, 0) * FPS)),
    frame: (i: number) => frame(i).toDataURL("image/png"),
    music,
  },
});
