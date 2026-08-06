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
  pluck(freq: number, t: number, dur = 1.5, gain = 0.5) {
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
    out.connect(this.musicBus);
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
