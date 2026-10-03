/** One effect per animation, all synthesized. */
import type { AudioEngine } from "./engine";
import type { AnimId } from "../sim/types";

const HZ = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export type SfxName =
  | "bleat"
  | "shears"
  | "cart"
  | "coins"
  | "fox"
  | "bark"
  | "build"
  | "pipes"
  | "fiddle"
  | "waltz"
  | "reel"
  | "stars"
  | "bark"
  | "build"
  | "pipe"
  | "pub"
  | "sword"
  | "wolf"
  | "buy"
  | "wind";

export class Sfx {
  constructor(private e: AudioEngine) {}

  play(name: SfxName) {
    const e = this.e;
    if (!e.ac) return;
    const t = e.now;
    try {
      switch (name) {
        case "bleat": {
          const o = e.tone1(t, 330, 250, 0.42, "sawtooth", 0.16);
          if (o && e.ac) {
            const lfo = e.ac.createOscillator();
            lfo.frequency.value = 22;
            const g = e.ac.createGain();
            g.gain.value = 26;
            lfo.connect(g);
            g.connect(o.frequency);
            lfo.start(t);
            lfo.stop(t + 0.42);
          }
          break;
        }
        case "shears":
          // two cuts. A narrow filter (high Q) passes almost no energy; these
          // were inaudible at Q 7 however high the gain went.
          for (const [at, f] of [[0, 4200], [0.13, 3500]] as [number, number][]) {
            e.noise(t + at, 0.06, "bandpass", f, 2.4, 0.5);
            e.noise(t + at + 0.01, 0.04, "lowpass", 900, 0.8, 0.15); // the blade's body
          }
          break;
        case "coins":
          [0, 0.07, 0.15, 0.25].forEach((d, i) => e.tone1(t + d, 1500 + i * 180, 900, 0.22, "triangle", 0.13));
          break;
        case "fox":
          e.tone1(t, 900, 420, 0.16, "sawtooth", 0.2);
          e.tone1(t + 0.2, 980, 460, 0.13, "sawtooth", 0.16);
          break;
        case "bark":
          e.tone1(t, 420, 180, 0.13, "square", 0.2);
          e.noise(t, 0.09, "bandpass", 900, 0.9, 0.34);
          break;
        case "wolf": {
          const o = e.tone1(t, 180, 300, 2.6, "sawtooth", 0.22);
          if (o && e.ac) {
            o.frequency.setValueAtTime(180, t);
            o.frequency.linearRampToValueAtTime(330, t + 0.6);
            o.frequency.setValueAtTime(330, t + 1.7);
            o.frequency.linearRampToValueAtTime(200, t + 2.6);
            const lfo = e.ac.createOscillator();
            lfo.frequency.value = 5.2;
            const g = e.ac.createGain();
            g.gain.value = 7;
            lfo.connect(g);
            g.connect(o.frequency);
            lfo.start(t);
            lfo.stop(t + 2.6);
          }
          break;
        }
        case "sword":
          e.noise(t, 0.5, "highpass", 2600, 1, 0.34);
          e.tone1(t, 2400, 900, 0.5, "triangle", 0.16);
          break;
        case "fiddle": {
          // a reel: bowed double-stops, sawn out rather than droned
          const reel = [69, 72, 74, 76, 74, 72, 69, 67];
          reel.forEach((n, i) => {
            const at = t + i * 0.16;
            const o = e.tone1(at, HZ(n), HZ(n), 0.2, "sawtooth", 0.1);
            if (o && e.ac) {
              const vib = e.ac.createOscillator();
              vib.frequency.value = 5.5;
              const amt = e.ac.createGain();
              amt.gain.value = 4;
              vib.connect(amt);
              amt.connect(o.frequency);
              vib.start(at);
              vib.stop(at + 0.2);
            }
            if (i % 2 === 0) e.tone1(at, HZ(n - 5), HZ(n - 5), 0.18, "sawtooth", 0.05); // the drone string
            e.noise(at, 0.03, "bandpass", 2600, 3, 0.03); // the bite of the bow
          });
          break;
        }
        case "waltz": {
          /*
           * A wee waltz in D for a turn round the kitchen floor: a bowed
           * tune in three-four over an oom-pah-pah, eight seconds long, the
           * length of the dance. Written for this rather than borrowed, so the
           * air and the jig stay the run's own.
           */
          const beat = 0.38;
          const tune: [number, number][] = [
            [74, 2], [73, 1], [71, 1], [69, 1], [66, 1], [69, 2], [74, 1], [76, 3],
            [78, 1], [76, 1], [74, 1], [71, 1], [73, 1], [76, 1], [74, 3],
          ];
          let at = t + 0.05;
          for (const [n, beats] of tune) {
            const dur = beats * beat * 0.92;
            const o = e.tone1(at, HZ(n), HZ(n), dur, "sawtooth", 0.075);
            if (o && e.ac) {
              const vib = e.ac.createOscillator();
              vib.frequency.value = 5;
              const amt = e.ac.createGain();
              amt.gain.value = 3;
              vib.connect(amt);
              amt.connect(o.frequency);
              vib.start(at);
              vib.stop(at + dur);
            }
            e.noise(at, 0.025, "bandpass", 2400, 3, 0.02); // the bow taking the string
            at += beats * beat;
          }
          // the oom-pah-pah: a low root on one, the chord on two and three
          // seven bars, under the seven of the tune: D, G, D, A, D, A, and home to D
          const bars: [number, number[]][] = [
            [50, [62, 66]], [43, [62, 67]], [50, [62, 66]], [45, [61, 67]],
            [50, [62, 66]], [45, [61, 67]], [50, [62, 66]],
          ];
          bars.forEach(([root, chord], b) => {
            const bt = t + 0.05 + b * beat * 3;
            e.tone1(bt, HZ(root), HZ(root), beat * 0.8, "triangle", 0.09);
            for (const k of [1, 2]) for (const c of chord) e.tone1(bt + k * beat, HZ(c), HZ(c), beat * 0.45, "triangle", 0.035);
          });
          break;
        }
        case "reel": {
          /*
           * The band in the hall: a reel in D, four times through, the fiddle
           * on top and the accordion's bass and chords stamping out the beat
           * under it. As long as the scene in the hall.
           */
          const step = 0.14;
          const phrase = [74, 69, 66, 69, 74, 76, 78, 76, 74, 71, 67, 71, 74, 73, 71, 69];
          for (let rep = 0; rep < 4; rep++) {
            phrase.forEach((n, i) => {
              const at = t + 0.05 + (rep * phrase.length + i) * step;
              e.tone1(at, HZ(n), HZ(n), step * 0.9, "sawtooth", 0.06);
              if (i % 4 === 0) e.noise(at, 0.02, "bandpass", 2400, 3, 0.02);
            });
            // bass on the beat, a chord off it: the accordion's left hand
            for (let b = 0; b < 8; b++) {
              const at = t + 0.05 + (rep * 16 + b * 2) * step;
              const root = b < 4 ? 50 : b < 6 ? 43 : 45;
              e.tone1(at, HZ(root), HZ(root), step * 0.8, "square", 0.04);
              e.tone1(at + step, HZ(root + 16), HZ(root + 16), step * 0.6, "square", 0.02);
            }
          }
          break;
        }
        case "stars": {
          // a harp, slow, under a clear night: D, A, D, F#, rising and let ring
          const notes = [50, 57, 62, 66, 69, 74, 69, 66, 62, 57, 62, 66, 69, 78, 74];
          notes.forEach((n, i) => e.tone1(t + 0.3 + i * 0.55, HZ(n), HZ(n), 1.6, "triangle", 0.06));
          break;
        }
        case "pipes":
          e.drone(HZ(50), t, 2.0, 0.1, e.sfxBus);
          [62, 69, 74, 76, 74, 69].forEach((n, i) => e.tone1(t + 0.15 + i * 0.28, HZ(n), HZ(n), 0.3, "sawtooth", 0.1));
          break;
        case "pipe":
          // the stem tapped on the dyke, a long draw, the ember catching,
          // then the smoke let out. Two seconds, under the animation.
          e.tone1(t, 240, 120, 0.08, "triangle", 0.09);
          e.noiseSwell(t + 0.1, 0.62, "bandpass", 560, 900, 0.7, 0.34);
          e.noise(t + 0.34, 0.03, "highpass", 2600, 1.2, 0.1);
          e.noise(t + 0.52, 0.025, "highpass", 3100, 1.2, 0.085);
          e.noiseSwell(t + 0.95, 1.0, "lowpass", 700, 300, 0.6, 0.26);
          break;
        case "pub":
          e.noiseSwell(t, 2.2, "bandpass", 700, 520, 0.7, 0.22); // the room
          e.tone1(t + 0.9, 760, 700, 0.14, "sine", 0.13);
          e.tone1(t + 1.05, 640, 600, 0.18, "sine", 0.12);
          break;
        case "cart":
          // cartwheels on a rough track, with the axle complaining
          for (let i = 0; i < 10; i++) {
            e.noise(t + i * 0.16, 0.11, "bandpass", 300 + (i % 2) * 130, 1.1, 0.5);
            if (i % 3 === 0) e.tone1(t + i * 0.16, 190, 150, 0.14, "triangle", 0.05);
          }
          break;
        case "build": {
          // a hammer on stone, three times, with the ring of it
          for (let i = 0; i < 3; i++) {
            const at = t + i * 0.22;
            e.noise(at, 0.07, "bandpass", 900 + i * 120, 3, 0.16);
            e.tone1(at, 320 - i * 20, 120, 0.16, "square", 0.05);
          }
          break;
        }
        case "wind":
          // night wind over the hill: it should arrive, not start loud
          e.noiseSwell(t, 2.3, "lowpass", 420, 220, 0.7, 0.42);
          e.noiseSwell(t + 0.6, 1.6, "bandpass", 620, 380, 0.9, 0.1);
          break;
        case "buy":
          e.tone1(t, 880, 880, 0.1, "triangle", 0.12);
          e.tone1(t + 0.1, 1320, 1320, 0.16, "triangle", 0.11);
          break;
      }
    } catch {
      /* an effect is never worth throwing over */
    }
  }

  /** effects that belong to an animation, including the delayed ones */
  forAnim(anim: AnimId, hasDog: boolean, fiddle = false) {
    const map: Partial<Record<AnimId, SfxName>> = {
      gather: "bleat",
      shear: "shears",
      market: "cart",
      tend: "bleat",
      muck: "wind",
      // the scythe's swish is near enough the shears' snip, a size up
      hay: "shears",
      build: "build",
      pipe: "pipe",
      // the fiddle has had its own reel in here all along; nothing ever
      // reached it, so both instruments played the same drone
      music: fiddle ? "fiddle" : "pipes",
      bark: "bark",
      pub: "pub",
      move: "bleat",
      sleep: "wind",
      fox: "fox",
      wolf: "sword",
      wolflost: "wolf",
      buysheep: "buy",
      dance: "waltz",
      ceilidh: "reel",
      supper: "pub",
      stars: "stars",
    };
    const first = map[anim];
    if (first) this.play(first);
    if (anim === "market") window.setTimeout(() => this.play("coins"), 900);
    if (anim === "wolf") window.setTimeout(() => this.play("wolf"), 400);
    if (anim === "wolflost") window.setTimeout(() => this.play("bark"), 1500);
    if (anim === "fox" && hasDog) window.setTimeout(() => this.play("bark"), 900);
  }
}
