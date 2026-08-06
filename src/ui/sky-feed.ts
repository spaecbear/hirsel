/**
 * Turns the game log into weather.
 *
 * The old build read the log in a panel. Here each new line rises over the
 * hill and fades, so the narration is part of the place rather than a list
 * you have to go and check. This watches the log for lines it hasn't shown
 * yet and ages the ones on screen.
 *
 * Only the newest few are ever aloft: the sky is atmosphere, not a transcript.
 * The full log is still in the Glen tab of the retro build and in the day's
 * history, so nothing is lost by letting these go.
 */
import type { LogLine } from "../sim/types";
import type { SkyMessage } from "../render/art/types";

const LIFETIME = 7000;
const MAX_ALOFT = 4;

interface Aloft {
  text: string;
  cls: LogLine["cls"];
  born: number;
}

export class SkyFeed {
  private aloft: Aloft[] = [];
  private lastSeen: LogLine | null = null;

  /** call whenever the log may have changed */
  sync(log: LogLine[], now: number) {
    if (!log.length) return;
    // find everything newer than the last line we put up
    const fresh: LogLine[] = [];
    for (const line of log) {
      if (this.lastSeen && line.t === this.lastSeen.t && line.day === this.lastSeen.day) break;
      fresh.push(line);
      if (fresh.length > MAX_ALOFT) break;
    }
    if (!fresh.length) return;
    this.lastSeen = log[0];
    // oldest first, so they stack in the order they happened
    for (const line of fresh.reverse()) {
      this.aloft.push({ text: line.t, cls: line.cls, born: now });
    }
    if (this.aloft.length > MAX_ALOFT) this.aloft.splice(0, this.aloft.length - MAX_ALOFT);
  }

  /** push a line up that never went through the log (achievements) */
  add(text: string, cls: LogLine["cls"], now: number) {
    this.aloft.push({ text, cls, born: now });
    if (this.aloft.length > MAX_ALOFT) this.aloft.shift();
  }

  list(now: number): SkyMessage[] {
    this.aloft = this.aloft.filter((m) => now - m.born < LIFETIME);
    return this.aloft.map((m) => ({ text: m.text, cls: m.cls, age: (now - m.born) / LIFETIME }));
  }

  clear() {
    this.aloft.length = 0;
    this.lastSeen = null;
  }
}
