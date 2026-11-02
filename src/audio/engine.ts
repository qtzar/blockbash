export interface AudioSettings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { musicVolume: 0.5, sfxVolume: 0.8, muted: false };

const MUSIC_HEADROOM = 0.6;

export class AudioEngine {
  ctx: AudioContext | null = null;
  sfxBus: GainNode | null = null;
  musicBus: GainNode | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private paused = false;
  private settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };

  /** Must be called from a user gesture (keydown/click/gamepad press). Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      try {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        this.master = ctx.createGain();
        this.sfxBus = ctx.createGain();
        this.musicBus = ctx.createGain();
        this.sfxBus.connect(this.master);
        this.musicBus.connect(this.master);
        this.master.connect(ctx.destination);
        this.ctx = ctx;
        this.applySettings(this.settings);
      } catch {
        this.ctx = null;
        return;
      }
    }
    if (!this.paused && this.ctx.state !== 'running') void this.ctx.resume().catch(() => undefined);
  }

  /** Suspends or resumes the audio clock; remembered so unlock() does not resume while paused. */
  setPaused(paused: boolean): void {
    this.paused = paused;
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      void (paused ? ctx.suspend() : ctx.resume()).catch(() => undefined);
    } catch {
      /* ignore */
    }
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  noiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (!this.noise) {
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }

  applySettings(s: AudioSettings): void {
    this.settings = { ...s };
    if (!this.ctx || !this.master || !this.sfxBus || !this.musicBus) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : 1, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(s.sfxVolume, t, 0.02);
    this.musicBus.gain.setTargetAtTime(s.musicVolume * MUSIC_HEADROOM, t, 0.02);
  }
}
