import { brickFromChar } from '../../src/sim/levels';
import { createRun } from '../../src/sim/state';
import { COLS, MAX_ROWS } from '../../src/sim/tuning';
import { NO_INTENT, type Intent, type RunState } from '../../src/sim/types';

export const DT = 1 / 60;

/** A run on level 1 whose board is replaced by `map` (ASCII rows, like a level). */
export function runWith(map: string[], seed = 1): RunState {
  const { state } = createRun({ seed });
  state.grid = new Array(MAX_ROWS * COLS).fill(null);
  map.forEach((line, row) => {
    for (let col = 0; col < COLS; col++) state.grid[row * COLS + col] = brickFromChar(line[col] ?? '.', col, row);
  });
  state.remaining = state.grid.filter((b) => b !== null && b.kind !== 'steel').length;
  return state;
}

export function intent(over: Partial<Intent> = {}): Intent {
  return { ...NO_INTENT, ...over };
}

/** Puts the first ball in free flight at (x, y) with velocity (vx, vy). */
export function fly(s: RunState, x: number, y: number, vx: number, vy: number): void {
  const b = s.balls[0]!;
  b.stuck = false;
  b.x = x;
  b.y = y;
  b.vx = vx;
  b.vy = vy;
  s.speed = Math.hypot(vx, vy);
}
