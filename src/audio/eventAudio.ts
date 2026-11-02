import type { SimEvent } from '../sim/events';
import { multiplier } from '../sim/state';
import type { RunState } from '../sim/types';
import type { Intensity } from './music';
import type { SfxPlayer } from './sfx';

export interface MusicPlayer {
  readonly playing: boolean;
  start(): void;
  stop(): void;
  setIntensity(level: Intensity): void;
}

/** Minimum seconds between repeats of rapid-fire sounds. */
const THROTTLE: Record<string, number> = { brick: 0.035, damage: 0.04, steel: 0.05, wall: 0.08, bolt: 0.1, paddle: 0.04 };

/** Maps simulation events to sound effects and drives the music's intensity. */
export class EventAudio {
  private last = new Map<string, number>();

  constructor(
    private sfx: SfxPlayer,
    private music: MusicPlayer,
    private now: () => number = () => performance.now() / 1000,
  ) {}

  private gate(key: string): boolean {
    const t = this.now();
    const prev = this.last.get(key);
    if (prev !== undefined && t - prev < (THROTTLE[key] ?? 0)) return false;
    this.last.set(key, t);
    return true;
  }

  handle(events: readonly SimEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'levelStart':
          if (!this.music.playing) this.music.start();
          this.sfx.levelStart();
          break;
        case 'launch':
          this.sfx.launch();
          break;
        case 'paddleHit':
          if (this.gate('paddle')) this.sfx.paddle(e.offset);
          break;
        case 'wallHit':
          if (this.gate('wall')) this.sfx.wall();
          break;
        case 'brickHit':
          if (this.gate('damage')) this.sfx.damage();
          break;
        case 'steelHit':
          if (this.gate('steel')) this.sfx.steel();
          break;
        case 'brickBreak':
          if (this.gate('brick')) this.sfx.brick(e.combo);
          break;
        case 'bomb':
          this.sfx.bomb();
          break;
        case 'capsuleSpawn':
          this.sfx.capsule();
          break;
        case 'powerUp':
          this.sfx.power();
          break;
        case 'powerEnd':
          this.sfx.powerEnd();
          break;
        case 'bolt':
          if (this.gate('bolt')) this.sfx.bolt();
          break;
        case 'shieldSave':
          this.sfx.shield();
          break;
        case 'ballLost':
          this.sfx.ballLost();
          break;
        case 'lifeLost':
          this.sfx.lifeLost();
          break;
        case 'extraLife':
          this.sfx.extraLife();
          break;
        case 'levelClear':
          this.sfx.levelClear();
          break;
        case 'gameOver':
          this.sfx.gameOver();
          this.music.stop();
          break;
      }
    }
  }

  /** Music intensity: 0 while serving, 1 in play, 2 with multiball or a hot combo. */
  update(s: RunState): void {
    if (!this.music.playing) return;
    let level: Intensity = 0;
    if (s.phase === 'play' && s.balls.some((b) => !b.stuck)) {
      level = s.balls.length >= 2 || multiplier(s.combo) >= 3 ? 2 : 1;
    }
    this.music.setIntensity(level);
  }

  stop(): void {
    this.music.stop();
  }
}
