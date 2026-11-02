import type { Rng } from '../core/rng';
import type { PowerKind, TimedPower } from './tuning';

export type BrickKind = 'normal' | 'tough' | 'armor' | 'steel' | 'bomb' | 'power';

/** Colour key for normal bricks; other kinds use their kind as the key. */
export type Tint = 'r' | 'o' | 'y' | 'g' | 'c' | 'b' | 'v' | 'p';

export interface Brick {
  col: number;
  row: number;
  kind: BrickKind;
  tint: Tint | null;
  hp: number;
  maxHp: number;
}

export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Held on the paddle (serve or magnet). */
  stuck: boolean;
  /** Offset from the paddle centre while stuck. */
  stuckOffset: number;
  stuckTime: number;
  /** Seconds since this ball last touched the paddle. */
  sincePaddle: number;
}

export interface Capsule {
  id: number;
  x: number;
  y: number;
  kind: PowerKind;
}

export interface Bolt {
  id: number;
  x: number;
  y: number;
}

export interface Paddle {
  x: number;
  w: number;
  targetW: number;
  /** Last movement speed (u/s), used for serve angle and cosmetics. */
  vx: number;
}

export type Phase = 'play' | 'lost' | 'clear' | 'over';

export interface RunState {
  rng: Rng;
  seed: number;
  level: number;
  levelName: string;
  /** Row-major grid, MAX_ROWS × COLS; null = empty. */
  grid: (Brick | null)[];
  /** Breakable bricks left. */
  remaining: number;
  brokenThisLevel: number;
  balls: Ball[];
  capsules: Capsule[];
  bolts: Bolt[];
  paddle: Paddle;
  lives: number;
  score: number;
  nextLifeAt: number;
  combo: number;
  bestCombo: number;
  timers: Record<TimedPower, number>;
  shield: boolean;
  /** Current ball speed; eases toward the target. */
  speed: number;
  boltCooldown: number;
  phase: Phase;
  phaseTime: number;
  levelTime: number;
  time: number;
  nextId: number;
  /** Debug: the floor bounces balls back. */
  god: boolean;
}

export interface Intent {
  /** -1..1 from keys or stick. */
  move: number;
  /** Pointer target in field x, or null when the keyboard/pad is in control. */
  targetX: number | null;
  /** Held: fires the blaster. */
  fire: boolean;
  /** Edge: launches stuck balls. */
  firePressed: boolean;
}

export const NO_INTENT: Intent = { move: 0, targetX: null, fire: false, firePressed: false };
