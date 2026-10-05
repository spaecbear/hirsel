/*
 * The trailer, rendered frame by frame by the game's own art and scored with
 * its own music.
 *
 * Screen-recording a pixel game smears it, and the timing wanders. Instead
 * each frame is drawn exactly, at the game's pixel size (320×180, scaled ×6
 * to 1920×1080 by capture-trailer.cjs with nearest-neighbour), from a
 * timeline of shots: the opening, the hill through the year, the work, the
 * inn, the fire, the night, and a card to wishlist it. The music is the
 * game's air, rendered offline from the same score the game plays.
 *
 * It gives nothing secret away: no wolf, no sword, nothing after the wedding.
 */
import { Painter, clamp01, ease } from "../../src/render/painter";
import { drawOpening } from "../../src/render/opening";
import { AudioEngine } from "../../src/audio/engine";
import { Score } from "../../src/audio/score";
import type { AnimId, GameState } from "../../src/sim/types";
import { glen, run } from "./scene";
import { GORSE, WOOL, pixelText, textSize } from "./pixelfont";

export const W = 320;
export const H = 180;
export const FPS = 30;

interface Shot {
  /** seconds */
  dur: number;
  draw: (g: Painter, t: number, ms: number) => void;
  /** no dip to black going into this shot */
  cut?: boolean;
}

/** a glen shot: a state, and optionally an animation running across the shot */
function hill(st: GameState, o: { anim?: AnimId; from?: number; to?: number; interior?: boolean; payload?: { croft?: string } } = {}) {
  return (g: Painter, t: number, ms: number) => {
    const p = o.anim ? (o.from ?? 0) + ((o.to ?? 1) - (o.from ?? 0)) * t : 0;
    g.cx.drawImage(glen(W, H, st, ms, { anim: o.anim ?? null, p, interior: o.interior, payload: o.payload }), 0, 0);
  };
}

function opening(from: number, to: number) {
  return (g: Painter, t: number, ms: number) => drawOpening(g, W, H, from + (to - from) * t, ms);
}

/** a card: the night glen, darkened, and lettering fading in */
function card(lines: { text: string; k: number; ink?: typeof GORSE; at: number }[], st: GameState) {
  return (g: Painter, t: number, ms: number) => {
    g.cx.drawImage(glen(W, H, st, ms, { anim: "sleep", p: 1 }), 0, 0);
    g.a(0, 0, W, H, 6, 8, 14, 0.45);
    const fade = clamp01(t / 0.25);
    for (const l of lines) {
      const { w, h } = textSize(l.text, l.k);
      pixelText(g, l.text, Math.round((W - w) / 2), Math.round(H * l.at - h / 2), l.k, l.ink ?? GORSE, fade);
    }
  };
}

const SUMMER = run({ day: 30, at: 0 });
const SUMMER_SLOPE = run({ day: 32, at: 1, seed: 3 });
const SPRING = run({ day: 6, at: 0, lambs: 4, seed: 5 });
const WINTER = run({ day: 80, at: 0, weather: "snow", lambs: 0, seed: 7 });
const NIGHT = run({ day: 40, at: 0, seed: 9 });
const BUILDING = (() => {
  const st = run({ day: 26, at: 0, owned: { roof: false, hearth: false } });
  st.building = { id: "roof", done: 1 };
  return st;
})();

export const SHOTS: Shot[] = [
  { dur: 3.5, draw: card([{ text: "HIRSEL", k: 4, at: 0.45 }], NIGHT), cut: true },
  { dur: 5, draw: opening(0.04, 0.22) },
  { dur: 3, draw: opening(0.27, 0.4) },
  { dur: 4.5, draw: opening(0.46, 0.78) },
  { dur: 4, draw: opening(0.82, 0.97) },
  { dur: 3.5, draw: hill(SUMMER) },
  { dur: 3, draw: hill(SPRING), cut: true },
  { dur: 2.2, draw: hill(SUMMER_SLOPE, { anim: "shear" }), cut: true },
  { dur: 2.6, draw: hill(SUMMER, { anim: "muck" }), cut: true },
  { dur: 2.6, draw: hill(SUMMER_SLOPE, { anim: "hay" }), cut: true },
  { dur: 3.2, draw: hill(SUMMER, { anim: "market" }), cut: true },
  { dur: 2.6, draw: hill(BUILDING, { anim: "build", payload: { croft: "roof" } }), cut: true },
  { dur: 3.4, draw: hill(SUMMER, { anim: "pub" }) },
  { dur: 3, draw: hill(NIGHT, { interior: true }) },
  { dur: 3, draw: hill(WINTER) },
  { dur: 3, draw: hill(NIGHT, { anim: "sleep", from: 0, to: 1 }) },
  { dur: 2.8, draw: hill(NIGHT, { anim: "fox" }), cut: true },
  {
    dur: 4.5,
    draw: card(
      [
        { text: "HIRSEL", k: 4, at: 0.38 },
        { text: "WISHLIST ON STEAM", k: 1, ink: WOOL, at: 0.62 },
      ],
      NIGHT,
    ),
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

export function frame(i: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = new Painter(c.getContext("2d")!, W, H);
  g.px(0, 0, W, H, "#000");
  const { k, t, secs } = at(i);
  const shot = SHOTS[k];
  const ms = (i / FPS) * 1000;
  g.cx.save();
  shot.draw(g, t, ms);
  g.cx.restore();
  // dip to black in and out, unless the cut is a hard one
  const left = shot.dur - secs;
  const next = SHOTS[k + 1];
  let dark = 0;
  if (!shot.cut && secs < DIP) dark = Math.max(dark, 1 - ease(secs / DIP));
  if (next && !next.cut && left < DIP) dark = Math.max(dark, 1 - ease(left / DIP));
  if (k === 0 && secs < 0.6) dark = Math.max(dark, 1 - secs / 0.6);
  if (k === SHOTS.length - 1 && left < 0.8) dark = Math.max(dark, 1 - left / 0.8);
  if (dark > 0) g.a(0, 0, W, H, 0, 0, 0, dark);
  return c;
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
  engine.setLevels({ master: 0.85, music: 0.6, sfx: 0.55, muted: false });
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
  const vg = view.getContext("2d")!;
  const start = performance.now();
  const tick = () => {
    const i = Math.floor(((performance.now() - start) / 1000) * FPS) % FRAMES;
    vg.drawImage(frame(i), 0, 0);
    requestAnimationFrame(tick);
  };
  if (!new URLSearchParams(location.search).has("capture")) requestAnimationFrame(tick);
}
Object.assign(window, {
  trailer: { FRAMES, FPS, DURATION, frame: (i: number) => frame(i).toDataURL("image/png"), music },
});
