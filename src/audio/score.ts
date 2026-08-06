/**
 * The soundtrack.
 *
 * This plays a written tune (see `tunes.ts`) rather than a random walk, one bar
 * at a time, with the arrangement chosen from what is happening in the game.
 * Nothing here repeats at a fixed high frequency — an earlier version pinged a
 * quiet 1.9kHz noise burst on beat three of every bar forever, which sounded
 * exactly like a watermark. There is no ticking layer any more; the pulse is a
 * low bodhrán thud and it sits under the drone.
 *
 * Arrangement by mood:
 *   day    whistle carries the tune, harp underneath, drone, soft pulse
 *   night  no whistle and no pulse — the harp takes the melody, drone an
 *          octave down, ornaments off. The same tune, after dark
 *   rain   harp figures drop out, the whistle softens and shortens
 */
import type { AudioEngine } from "./engine";
import { HARP_FIGURES, HIRSEL_AIR, sequence, type Event, type Tune } from "./tunes";

const HZ = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const LOOKAHEAD = 1.4;

export interface ScoreMood {
  night: boolean;
  rain: boolean;
}

export class Score {
  private timer: number | null = null;
  private tune: Tune = HIRSEL_AIR;
  private bars: Event[][] = [];
  private roots: number[] = [];
  private bar = 0;
  private nextBarTime = 0;
  private pass = 0;
  mood: ScoreMood = { night: false, rain: false };

  constructor(private engine: AudioEngine) {
    this.load(HIRSEL_AIR);
  }

  load(tune: Tune) {
    this.tune = tune;
    const { events, roots } = sequence(tune);
    this.roots = roots;
    this.bars = roots.map(() => []);
    for (const e of events) this.bars[e.bar].push(e);
    this.bar = 0;
    this.pass = 0;
  }

  get beat() {
    return 60 / this.tune.bpm;
  }

  start() {
    if (this.timer !== null || !this.engine.ac) return;
    this.nextBarTime = this.engine.now + 0.25;
    this.timer = window.setInterval(() => {
      const ac = this.engine.ac;
      if (!ac || ac.state === "suspended") return;
      while (this.nextBarTime < this.engine.now + LOOKAHEAD) {
        this.scheduleBar(this.nextBarTime, this.bar);
        this.nextBarTime += this.beat * this.tune.beatsPerBar;
        this.bar++;
        if (this.bar >= this.bars.length) {
          this.bar = 0;
          this.pass++;
        }
      }
    }, 160);
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private scheduleBar(t0: number, bar: number) {
    const beat = this.beat;
    const barBeats = this.tune.beatsPerBar;
    const { night, rain } = this.mood;
    const root = this.roots[bar];

    // the drone runs two bars at a time and changes with the double tonic
    if (bar % 2 === 0 || this.roots[bar - 1] !== root) {
      const bars = this.roots[bar + 1] === root ? 2 : 1;
      this.engine.drone(HZ(night ? root - 12 : root), t0, beat * barBeats * bars + 0.4, night ? 0.17 : 0.13);
    }

    // the pulse: two soft thumps a bar, and never after dark
    if (!night) {
      this.engine.thump(t0, 0.085);
      this.engine.thump(t0 + beat * 2, 0.05, true);
    }

    // the harp, arpeggiating the chord under the tune
    if (!rain) {
      const figure = HARP_FIGURES[root] ?? HARP_FIGURES[38];
      const step = night ? 1 : 0.5;
      for (let b = 0, i = 0; b < barBeats; b += step, i++) {
        // leave the downbeat to the melody on the last beat of the phrase
        if (night && i % 2 === 1) continue;
        const note = figure[i % figure.length];
        this.engine.pluck(HZ(note), t0 + b * beat, night ? 2.6 : 1.9, night ? 0.13 : 0.16);
      }
    }

    // the melody
    for (const e of this.bars[bar]) {
      if (e.n === null) continue;
      const at = t0 + (e.at - bar * barBeats) * beat;
      const dur = e.d * beat;
      if (night) {
        // after dark the harp carries it, an octave down, no whistle
        this.engine.pluck(HZ(e.n - 12), at, Math.min(2.8, dur + 1.1), 0.3);
        continue;
      }
      // a cut: the grace note above, flicked in ahead of the beat. The
      // ornament that makes a whistle sound played rather than sequenced.
      if (!rain && e.d >= 1 && (bar + e.at) % 3 === 0) {
        this.engine.whistle(HZ(e.n + 2), at - 0.045, 0.05, 0.09);
      }
      this.engine.whistle(HZ(e.n), at, Math.max(0.18, dur - 0.06), rain ? 0.14 : 0.2);
      // the harp doubles the melody an octave down on the long notes
      if (e.d >= 2) this.engine.pluck(HZ(e.n - 12), at, dur, 0.12);
    }
  }
}
