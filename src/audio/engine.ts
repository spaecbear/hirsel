/**
 * Web Audio, all synthesized at runtime. No files.
 *
 * Structure note (§12): the score is a *layer*, not the system. `setRecordedBed`
 * takes a decoded buffer and plays it on the same music bus with the same
 * reverb and tape roll-off, so a real recorded theme can be dropped in
 * alongside the generative parts without touching anything else.
 */
export class AudioEngine {
  ac: AudioContext | null = null;
  master!: GainNode;
  musicBus!: GainNode;
  sfxBus!: GainNode;
  private tone!: BiquadFilterNode;
  private verbGain!: GainNode;
  private bed: AudioBufferSourceNode | null = null;
  started = false;
  levels = { master: 0.85, music: 0.3, sfx: 0.55, muted: false };

  start(): boolean {
    if (this.ac) {
      if (this.ac.state === "suspended") void this.ac.resume();
      return true;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    const ac = (this.ac = new Ctor());

    // a small hall, built from decaying noise
    const len = Math.floor(ac.sampleRate * 2.1);
    const ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    const verb = ac.createConvolver();
    verb.buffer = ir;
    this.verbGain = ac.createGain();
    this.verbGain.gain.value = 0.34;

    this.master = ac.createGain();
    this.tone = ac.createBiquadFilter();
    this.tone.type = "lowpass";
    this.tone.frequency.value = 3200;
    this.tone.Q.value = 0.4;

    this.musicBus = ac.createGain();
    this.sfxBus = ac.createGain();
    this.musicBus.connect(this.tone);
    this.sfxBus.connect(this.tone);
    this.tone.connect(this.master);
    this.tone.connect(verb);
    verb.connect(this.verbGain);
    this.verbGain.connect(this.master);
    this.master.connect(ac.destination);

    this.applyLevels();
    this.started = true;
    return true;
  }

  setLevels(l: Partial<typeof this.levels>) {
    Object.assign(this.levels, l);
    this.applyLevels();
  }

  private applyLevels() {
    if (!this.ac) return;
    const { master, music, sfx, muted } = this.levels;
    this.master.gain.value = muted ? 0 : master;
    this.musicBus.gain.value = music;
    this.sfxBus.gain.value = sfx;
  }

  get now() {
    return this.ac?.currentTime ?? 0;
  }

  /** plucked string: three detuned voices under a fast decay */
  pluck(freq: number, t: number, dur = 1.5, gain = 0.5, bus?: AudioNode) {
    const ac = this.ac;
    if (!ac) return;
    const out = ac.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(gain, t + 0.008);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.min(6000, freq * 7), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(220, freq * 1.6), t + dur * 0.7);
    ([[0, "triangle", 1], [7, "sine", 0.55], [-6, "triangle", 0.3]] as [number, OscillatorType, number][]).forEach(
      ([det, type, lvl]) => {
        const o = ac.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        o.detune.value = det;
        const g = ac.createGain();
        g.gain.value = lvl;
        o.connect(g);
        g.connect(lp);
        o.start(t);
        o.stop(t + dur + 0.05);
      },
    );
    lp.connect(out);
    out.connect(bus ?? this.musicBus);
  }

  drone(freq: number, t: number, dur: number, gain = 0.16, bus?: AudioNode) {
    const ac = this.ac;
    if (!ac) return;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.9);
    g.gain.setValueAtTime(gain, t + dur - 1.2);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    [1, 1.5, 2].forEach((m, i) => {
      const o = ac.createOscillator();
      o.type = i === 1 ? "sine" : "sawtooth";
      o.frequency.value = freq * m;
      o.detune.value = (i - 1) * 5;
      const og = ac.createGain();
      og.gain.value = [0.5, 0.28, 0.16][i];
      o.connect(og);
      og.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.1);
    });
    // slow tape wobble
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.23;
    const la = ac.createGain();
    la.gain.value = 4;
    lfo.connect(la);
    la.connect(lp.detune);
    lfo.start(t);
    lfo.stop(t + dur + 0.1);
    lp.connect(g);
    g.connect(bus ?? this.musicBus);
  }

  noise(t: number, dur: number, type: BiquadFilterType, f: number, q: number, gain: number, bus?: AudioNode) {
    const ac = this.ac;
    if (!ac) return null;
    const n = Math.max(1, Math.floor(ac.sampleRate * dur));
    const b = ac.createBuffer(1, n, ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = ac.createBufferSource();
    s.buffer = b;
    const bp = ac.createBiquadFilter();
    bp.type = type;
    bp.frequency.value = f;
    bp.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp);
    bp.connect(g);
    g.connect(bus ?? this.sfxBus);
    s.start(t);
    s.stop(t + dur + 0.02);
    return g;
  }

  /**
   * Filtered noise that swells and falls away rather than starting loud and
   * decaying — breath, wind, a draw on a pipe. `noise` can't do this: its
   * envelope only ever decays.
   */
  noiseSwell(t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, q: number, gain: number) {
    const ac = this.ac;
    if (!ac) return;
    const n = Math.max(1, Math.floor(ac.sampleRate * dur));
    const b = ac.createBuffer(1, n, ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = ac.createBufferSource();
    s.buffer = b;
    const bp = ac.createBiquadFilter();
    bp.type = type;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    bp.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp);
    bp.connect(g);
    g.connect(this.sfxBus);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  tone1(t: number, f0: number, f1: number, dur: number, type: OscillatorType, gain: number, bus?: AudioNode) {
    const ac = this.ac;
    if (!ac) return null;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.05, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  /**
   * A whistle: the melody voice. Breath at the onset, a slow vibrato that only
   * arrives once the note has settled — a whistle played by a person, not a
   * sine wave. Two oscillators a hair apart so it isn't glassy.
   */
  whistle(freq: number, t: number, dur: number, gain = 0.2, bus?: AudioNode) {
    const ac = this.ac;
    if (!ac) return;
    const out = ac.createGain();
    const attack = Math.min(0.09, dur * 0.25);
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(gain, t + attack);
    out.gain.setValueAtTime(gain, t + Math.max(attack, dur - 0.14));
    out.gain.linearRampToValueAtTime(0, t + dur);

    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = Math.min(5200, freq * 5);

    const vib = ac.createOscillator();
    vib.frequency.value = 4.8;
    const vibAmt = ac.createGain();
    // vibrato fades in, the way a player leans on a held note
    vibAmt.gain.setValueAtTime(0, t);
    vibAmt.gain.linearRampToValueAtTime(6, t + Math.min(dur * 0.6, 0.5));
    vib.connect(vibAmt);
    vib.start(t);
    vib.stop(t + dur + 0.05);

    ([["sine", 1, 0], ["triangle", 0.22, 6]] as [OscillatorType, number, number][]).forEach(([type, lvl, det]) => {
      const o = ac.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = det;
      vibAmt.connect(o.detune);
      const g = ac.createGain();
      g.gain.value = lvl;
      o.connect(g);
      g.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    });

    // the breath, only at the onset
    this.noise(t, Math.min(0.12, dur), "bandpass", freq * 2.2, 0.9, gain * 0.35, out);

    lp.connect(out);
    out.connect(bus ?? this.musicBus);
  }

  /** bodhrán: a low skin thud, pitch dropping away. No high tick anywhere near it. */
  thump(t: number, gain = 0.1, low = false, bus?: AudioNode) {
    const ac = this.ac;
    if (!ac) return;
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(low ? 92 : 116, t);
    o.frequency.exponentialRampToValueAtTime(low ? 44 : 56, t + 0.14);
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g);
    g.connect(bus ?? this.musicBus);
    o.start(t);
    o.stop(t + 0.3);
    // the skin of the drum, well below anything that could read as a ping
    this.noise(t, 0.07, "lowpass", 260, 0.8, gain * 0.5, bus ?? this.musicBus);
  }

  /**
   * A persistent, looping filtered-noise bed — for ambience that has to run
   * continuously (rain on the ground) rather than fire once and decay. The
   * source itself never stops; the caller fades the returned gain node in
   * and out. Generic enough that any future weather layer (wind, the burn in
   * spate) can reuse it rather than growing its own noise-loop plumbing.
   */
  noiseBed(type: BiquadFilterType, freq: number, q: number, bus?: AudioNode): GainNode | null {
    const ac = this.ac;
    if (!ac) return null;
    const len = Math.floor(ac.sampleRate * 2);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filt = ac.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    filt.Q.value = q;
    const gain = ac.createGain();
    gain.gain.value = 0;
    src.connect(filt);
    filt.connect(gain);
    gain.connect(bus ?? this.sfxBus);
    src.start();
    return gain;
  }

  /** drop a recorded theme in alongside the synth score */
  setRecordedBed(buffer: AudioBuffer | null, gain = 0.5) {
    if (!this.ac) return;
    this.bed?.stop();
    this.bed = null;
    if (!buffer) return;
    const src = this.ac.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const g = this.ac.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(this.musicBus);
    src.start();
    this.bed = src;
  }
}
