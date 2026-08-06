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
  /** everything from the written tune goes through here, so a cue can duck it */
  private tuneBus: GainNode | null = null;
  /** the tune stops being scheduled at all until this time */
  private silentUntil = 0;
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
    this.tuneBus = this.engine.ac.createGain();
    this.tuneBus.connect(this.engine.musicBus);
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

  /**
   * A cue takes the glen over: the air ducks out, something else happens, and
   * the tune comes back when it is finished. Two of them.
   *
   * `wolf` — D and A flat, a tritone apart. The diabolus in musica, and about
   * as far from a Dorian air as it is possible to get in two notes. A heartbeat
   * that speeds up as he comes down the hill, a rising swell, and a cluster of
   * dissonance on the clash.
   *
   * `fox` — tense, not evil. It keeps the tonic and rubs a minor second against
   * it, over a quickening pulse. A bad night, not the end of the world.
   */
  cue(kind: "wolf" | "fox") {
    const e = this.engine;
    if (!e.ac || !this.tuneBus) return;
    const t = e.now + 0.02;
    const dur = kind === "wolf" ? 6.2 : 2.5;

    // duck the air out, and bring it back once the cue has finished
    const g = this.tuneBus.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + 0.22);
    g.setValueAtTime(0, t + dur - 0.5);
    g.linearRampToValueAtTime(1, t + dur + 0.6);
    this.silentUntil = t + dur;

    if (kind === "wolf") {
      e.drone(HZ(26), t, 5.9, 0.3); // D1
      e.drone(HZ(32), t + 0.45, 5.0, 0.17); // A flat: the tritone
      // a heart going faster as he closes
      let at = t + 0.1;
      let gap = 0.62;
      while (at < t + 5.0) {
        e.thump(at, 0.18, true);
        at += gap;
        gap *= 0.88;
      }
      e.tone1(t + 0.5, 55, 210, 3.2, "sawtooth", 0.09, e.musicBus); // the rise
      // the clash, at the moment the blade comes down
      e.noise(t + 3.0, 0.9, "highpass", 1700, 0.7, 0.3, e.musicBus);
      for (const [d, n] of [[3.0, 87], [3.06, 93], [3.14, 88]] as [number, number][]) {
        e.tone1(t + d, HZ(n), HZ(n - 24), 0.7, "square", 0.07, e.musicBus);
      }
      e.drone(HZ(38), t + 3.8, 2.3, 0.18); // and the hill goes quiet again
      return;
    }

    e.drone(HZ(38), t, 2.4, 0.2); // D2
    e.drone(HZ(39), t + 0.12, 2.0, 0.075); // the minor second, rubbing
    let at = t;
    for (let i = 0; i < 9; i++) {
      e.thump(at, 0.12);
      at += 0.27 - i * 0.014; // quickening
    }
    // four notes down, quick and clipped
    [74, 72, 71, 69].forEach((n, i) => e.pluck(HZ(n), t + 0.18 + i * 0.3, 0.42, 0.34));
  }

  private scheduleBar(t0: number, bar: number) {
    if (t0 < this.silentUntil) return; // a cue owns the glen just now
    const beat = this.beat;
    const barBeats = this.tune.beatsPerBar;
    const { night, rain } = this.mood;
    const root = this.roots[bar];
    const bus = this.tuneBus ?? undefined;

    // the drone runs two bars at a time and changes with the double tonic
    if (bar % 2 === 0 || this.roots[bar - 1] !== root) {
      const bars = this.roots[bar + 1] === root ? 2 : 1;
      this.engine.drone(HZ(night ? root - 12 : root), t0, beat * barBeats * bars + 0.4, night ? 0.17 : 0.13, bus);
    }

    // the pulse: two soft thumps a bar, and never after dark
    if (!night) {
      this.engine.thump(t0, 0.085, false, bus);
      this.engine.thump(t0 + beat * 2, 0.05, true, bus);
    }

    // the harp, arpeggiating the chord under the tune
    if (!rain) {
      const figure = HARP_FIGURES[root] ?? HARP_FIGURES[38];
      const step = night ? 1 : 0.5;
      for (let b = 0, i = 0; b < barBeats; b += step, i++) {
        // leave the downbeat to the melody on the last beat of the phrase
        if (night && i % 2 === 1) continue;
        const note = figure[i % figure.length];
        this.engine.pluck(HZ(note), t0 + b * beat, night ? 2.6 : 1.9, night ? 0.13 : 0.16, bus);
      }
    }

    // the melody
    for (const e of this.bars[bar]) {
      if (e.n === null) continue;
      const at = t0 + (e.at - bar * barBeats) * beat;
      const dur = e.d * beat;
      if (night) {
        // after dark the harp carries it, an octave down, no whistle
        this.engine.pluck(HZ(e.n - 12), at, Math.min(2.8, dur + 1.1), 0.3, bus);
        continue;
      }
      // a cut: the grace note above, flicked in ahead of the beat. The
      // ornament that makes a whistle sound played rather than sequenced.
      if (!rain && e.d >= 1 && (bar + e.at) % 3 === 0) {
        this.engine.whistle(HZ(e.n + 2), at - 0.045, 0.05, 0.09, bus);
      }
      this.engine.whistle(HZ(e.n), at, Math.max(0.18, dur - 0.06), rain ? 0.14 : 0.2, bus);
      // the harp doubles the melody an octave down on the long notes
      if (e.d >= 2) this.engine.pluck(HZ(e.n - 12), at, dur, 0.12, bus);
    }
  }
}
