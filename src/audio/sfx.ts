import type { AudioEngine } from './engine';

export interface SfxPlayer {
  paddle(offset: number): void;
  brick(combo: number): void;
  damage(): void;
  steel(): void;
  wall(): void;
  bomb(): void;
  capsule(): void;
  power(): void;
  powerEnd(): void;
  bolt(): void;
  launch(): void;
  shield(): void;
  ballLost(): void;
  lifeLost(): void;
  extraLife(): void;
  levelClear(): void;
  levelStart(): void;
  gameOver(): void;
}

/** Major pentatonic steps, so rising combo notes always sound musical. */
const PENTA = [0, 2, 4, 7, 9];

/** Brick note for a combo count: climbs the pentatonic scale, two octaves at most. */
export function comboFreq(combo: number): number {
  const i = Math.max(0, combo - 1);
  const semis = Math.min(24, PENTA[i % PENTA.length]! + 12 * Math.floor(i / PENTA.length));
  return 523.25 * Math.pow(2, semis / 12);
}

export class Sfx implements SfxPlayer {
  constructor(private engine: AudioEngine) {}

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
    const { ctx, sfxBus } = this.engine;
    if (!ctx || !sfxBus || !this.engine.ready) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, f0: number, f1: number, type: BiquadFilterType = 'lowpass', delay = 0): void {
    const { ctx, sfxBus } = this.engine;
    const buf = this.engine.noiseBuffer();
    if (!ctx || !sfxBus || !buf || !this.engine.ready) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(sfxBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private notes(freqs: readonly number[], type: OscillatorType, step: number, vol: number): void {
    freqs.forEach((f, i) => this.tone(type, f, f, step * 1.6, vol, i * step));
  }

  paddle(offset: number): void {
    const f = 300 + offset * 30;
    this.tone('square', f, f * 0.8, 0.07, 0.09);
    this.tone('sine', 160, 70, 0.08, 0.2);
  }

  brick(combo: number): void {
    const f = comboFreq(combo);
    this.tone('triangle', f, f, 0.14, 0.14);
    this.tone('square', f * 2, f * 2, 0.05, 0.025);
  }

  damage(): void {
    this.tone('square', 950, 700, 0.06, 0.06);
    this.noise(0.05, 0.08, 4000, 2000, 'highpass');
  }

  steel(): void {
    this.tone('triangle', 2400, 2250, 0.14, 0.06);
    this.tone('sine', 3600, 3500, 0.1, 0.035);
  }

  wall(): void {
    this.tone('sine', 220, 140, 0.04, 0.06);
  }

  bomb(): void {
    this.noise(0.5, 0.5, 2200, 100);
    this.tone('sine', 120, 40, 0.4, 0.35);
  }

  capsule(): void {
    this.tone('sine', 880, 1320, 0.1, 0.05);
  }

  power(): void {
    this.notes([523, 659, 784, 1047], 'triangle', 0.05, 0.13);
  }

  powerEnd(): void {
    this.tone('triangle', 660, 330, 0.18, 0.06);
  }

  bolt(): void {
    this.tone('square', 1400, 300, 0.08, 0.04);
  }

  launch(): void {
    this.tone('square', 440, 880, 0.08, 0.07);
  }

  shield(): void {
    this.tone('sine', 300, 900, 0.25, 0.16);
    this.noise(0.2, 0.1, 3000, 800, 'bandpass');
  }

  ballLost(): void {
    this.tone('sawtooth', 600, 80, 0.5, 0.1);
  }

  lifeLost(): void {
    this.noise(0.9, 0.45, 2200, 80);
    this.tone('sine', 120, 35, 0.7, 0.3);
  }

  extraLife(): void {
    this.notes([784, 988, 1175, 1568], 'square', 0.07, 0.07);
  }

  levelStart(): void {
    this.notes([392, 523, 659], 'triangle', 0.08, 0.1);
  }

  levelClear(): void {
    this.notes([523, 659, 784, 1047, 784, 1047, 1319], 'triangle', 0.09, 0.13);
    this.notes([262, 330, 392, 523], 'square', 0.16, 0.04);
  }

  gameOver(): void {
    this.notes([392, 330, 262, 196], 'sawtooth', 0.2, 0.08);
  }
}
