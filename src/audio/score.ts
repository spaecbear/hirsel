/** Generative score: D dorian, 68bpm, sparse. Reacts to night and weather. */
import type { AudioEngine } from "./engine";

const HZ = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const PENT = [62, 64, 66, 69, 71, 74, 76, 78, 81]; // D E F# A B D E F# A
const LOWS = [38, 45, 50]; // D2 A2 D3
const BPM = 68;

export interface ScoreMood {
  night: boolean;
  rain: boolean;
}

export class Score {
  private timer: number | null = null;
  private bar = 0;
  private next = 0;
  mood: ScoreMood = { night: false, rain: false };

  constructor(private engine: AudioEngine) {}

  start() {
    if (this.timer !== null || !this.engine.ac) return;
    const beat = 60 / BPM;
    this.next = this.engine.now + 0.15;
    this.timer = window.setInterval(() => {
      const ac = this.engine.ac;
      if (!ac || ac.state === "suspended") return;
      while (this.next < this.engine.now + 0.6) {
        const t = this.next;
        const { night, rain } = this.mood;

        // drone changes every 4 bars
        if (this.bar % 4 === 0) {
          const idx = (this.bar / 4) % 3 === 2 ? 1 : 0;
          this.engine.drone(HZ(LOWS[idx]), t, beat * 16, night ? 0.2 : 0.14);
        }
        // soft bodhrán-like pulse on 1 and 3
        this.engine.noise(t, 0.11, "lowpass", night ? 150 : 220, 1, night ? 0.05 : 0.09, this.engine.musicBus);
        this.engine.noise(t + beat * 2, 0.07, "bandpass", 1900, 2, 0.025, this.engine.musicBus);

        // melody: sparse random walk, thinner at night, thinner still in rain
        const density = night ? 0.35 : rain ? 0.42 : 0.6;
        for (let s = 0; s < 8; s++) {
          if (Math.random() > density / 2.4) continue;
          const i = Math.max(
            0,
            Math.min(PENT.length - 1, Math.round(3 + Math.sin(this.bar * 0.7 + s * 0.9) * 2.2 + (Math.random() * 2 - 1) * 1.4)),
          );
          this.engine.pluck(HZ(PENT[i]), t + s * (beat / 2), 1.5 + Math.random(), night ? 0.22 : 0.32);
          if (Math.random() < 0.16) this.engine.pluck(HZ(PENT[i] + 7), t + s * (beat / 2) + 0.03, 1.2, 0.13);
        }
        this.next += beat * 4;
        this.bar++;
      }
    }, 140);
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }
}
