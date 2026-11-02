import type { BrickKind, Tint } from './types';
import type { PowerKind, TimedPower } from './tuning';

/** Everything the render and audio layers react to. Positions are field units. */
export type SimEvent =
  | { type: 'levelStart'; level: number; name: string }
  | { type: 'launch'; x: number; y: number }
  | { type: 'paddleHit'; x: number; y: number; offset: number }
  | { type: 'wallHit'; x: number; y: number }
  | { type: 'brickHit'; x: number; y: number; kind: BrickKind; tint: Tint | null; hp: number; col: number; row: number }
  | { type: 'steelHit'; x: number; y: number; col: number; row: number }
  | {
      type: 'brickBreak';
      x: number;
      y: number;
      kind: BrickKind;
      tint: Tint | null;
      points: number;
      combo: number;
      mult: number;
      col: number;
      row: number;
      last: boolean;
    }
  | { type: 'bomb'; x: number; y: number }
  | { type: 'capsuleSpawn'; x: number; y: number; kind: PowerKind }
  | { type: 'powerUp'; x: number; y: number; kind: PowerKind }
  | { type: 'powerEnd'; kind: TimedPower }
  | { type: 'bolt'; x: number; y: number }
  | { type: 'shieldSave'; x: number; y: number }
  | { type: 'ballLost'; x: number; y: number }
  | { type: 'lifeLost'; lives: number }
  | { type: 'extraLife'; lives: number }
  | { type: 'levelClear'; level: number; bonus: number }
  | { type: 'gameOver'; score: number };
