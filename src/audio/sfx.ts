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
  | "pipes"
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
          e.noise(t, 0.05, "bandpass", 4200, 7, 0.3);
          e.noise(t + 0.12, 0.05, "bandpass", 3600, 7, 0.24);
          break;
        case "coins":
          [0, 0.07, 0.15, 0.25].forEach((d, i) => e.tone1(t + d, 1500 + i * 180, 900, 0.22, "triangle", 0.13));
          break;
        case "fox":
          e.tone1(t, 900, 420, 0.16, "sawtooth", 0.2);
          e.tone1(t + 0.2, 980, 460, 0.13, "sawtooth", 0.16);
          break;
        case "bark":
          e.tone1(t, 420, 180, 0.13, "square", 0.14);
          e.noise(t, 0.09, "bandpass", 900, 2, 0.16);
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
        case "pipes":
          e.drone(HZ(50), t, 2.0, 0.1, e.sfxBus);
          [62, 69, 74, 76, 74, 69].forEach((n, i) => e.tone1(t + 0.15 + i * 0.28, HZ(n), HZ(n), 0.3, "sawtooth", 0.1));
          break;
        case "pipe":
          e.noise(t, 0.9, "lowpass", 520, 0.7, 0.06);
          break;
        case "pub":
          e.noise(t, 2.2, "bandpass", 700, 0.8, 0.1);
          e.tone1(t + 0.9, 760, 700, 0.14, "sine", 0.1);
          e.tone1(t + 1.05, 640, 600, 0.18, "sine", 0.09);
          break;
        case "cart":
          for (let i = 0; i < 9; i++) e.noise(t + i * 0.16, 0.1, "bandpass", 300 + (i % 2) * 120, 3, 0.1);
          break;
        case "wind":
          e.noise(t, 2.2, "lowpass", 320, 0.6, 0.1);
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
  forAnim(anim: AnimId, hasDog: boolean) {
    const map: Partial<Record<AnimId, SfxName>> = {
      gather: "bleat",
      shear: "shears",
      market: "cart",
      tend: "bleat",
      muck: "wind",
      pipe: "pipe",
      music: "pipes",
      pub: "pub",
      move: "bleat",
      sleep: "wind",
      fox: "fox",
      wolf: "sword",
      wolflost: "wolf",
      buysheep: "buy",
    };
    const first = map[anim];
    if (first) this.play(first);
    if (anim === "market") window.setTimeout(() => this.play("coins"), 900);
    if (anim === "wolf") window.setTimeout(() => this.play("wolf"), 400);
    if (anim === "wolflost") window.setTimeout(() => this.play("bark"), 1500);
    if (anim === "fox" && hasDog) window.setTimeout(() => this.play("bark"), 900);
  }
}
