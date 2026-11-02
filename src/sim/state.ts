import { createRng } from '../core/rng';
import type { SimEvent } from './events';
import { levelDef, parseLevel } from './levels';
import {
  BALL_R, BALL_SPEED_BASE, BALL_SPEED_LEVEL_CAP, BALL_SPEED_MAX, BALL_SPEED_PER_BRICK, BALL_SPEED_PER_LEVEL,
  BALL_SPEED_RAMP_MAX, BRICK_H, BRICK_W, COLS, COMBO_STEP, EXTRA_LIFE_EVERY, FIELD_W, GRID_X, GRID_Y, MAX_MULT, MAX_ROWS,
  PADDLE_W, PADDLE_Y, SLOW_FACTOR, START_LIVES, TIMED_POWERS, type TimedPower,
} from './tuning';
import type { Ball, Brick, RunState } from './types';

export interface RunOptions {
  seed: number;
  level?: number;
  god?: boolean;
}

function noTimers(): Record<TimedPower, number> {
  return Object.fromEntries(TIMED_POWERS.map((k) => [k, 0])) as Record<TimedPower, number>;
}

export function createRun(opts: RunOptions): { state: RunState; events: SimEvent[] } {
  const state: RunState = {
    rng: createRng(opts.seed),
    seed: opts.seed,
    level: 0,
    levelName: '',
    grid: [],
    remaining: 0,
    brokenThisLevel: 0,
    balls: [],
    capsules: [],
    bolts: [],
    paddle: { x: FIELD_W / 2, w: PADDLE_W, targetW: PADDLE_W, vx: 0 },
    lives: START_LIVES,
    score: 0,
    nextLifeAt: EXTRA_LIFE_EVERY,
    combo: 0,
    bestCombo: 0,
    timers: noTimers(),
    shield: false,
    speed: BALL_SPEED_BASE,
    boltCooldown: 0,
    phase: 'play',
    phaseTime: 0,
    levelTime: 0,
    time: 0,
    nextId: 1,
    god: opts.god ?? false,
  };
  const events: SimEvent[] = [];
  loadLevel(state, Math.max(1, Math.floor(opts.level ?? 1)), events);
  return { state, events };
}

/** Replaces the board with level n and serves a fresh ball. Score, lives and the shield carry over. */
export function loadLevel(s: RunState, level: number, events: SimEvent[]): void {
  const def = levelDef(level);
  s.level = level;
  s.levelName = def.name;
  s.grid = parseLevel(def.map);
  s.remaining = s.grid.filter((b) => b !== null && b.kind !== 'steel').length;
  s.brokenThisLevel = 0;
  s.levelTime = 0;
  s.phase = 'play';
  s.phaseTime = 0;
  resetForServe(s);
  s.speed = targetSpeed(s);
  events.push({ type: 'levelStart', level, name: def.name });
}

/** Clears balls, capsules, bolts and timed powers, and puts a new ball on the paddle. */
export function resetForServe(s: RunState): void {
  s.balls = [];
  s.capsules = [];
  s.bolts = [];
  s.timers = noTimers();
  s.paddle.targetW = PADDLE_W;
  s.combo = 0;
  s.balls.push(newBall(s, s.paddle.x, PADDLE_Y - BALL_R, 0, 0, true));
}

export function newBall(s: RunState, x: number, y: number, vx: number, vy: number, stuck: boolean): Ball {
  return {
    id: s.nextId++,
    x,
    y,
    vx,
    vy,
    stuck,
    stuckOffset: stuck ? x - s.paddle.x : 0,
    stuckTime: 0,
    sincePaddle: 0,
  };
}

export function baseSpeed(level: number): number {
  return BALL_SPEED_BASE + BALL_SPEED_PER_LEVEL * Math.min(level - 1, BALL_SPEED_LEVEL_CAP);
}

export function targetSpeed(s: RunState): number {
  const ramp = Math.min(BALL_SPEED_RAMP_MAX, s.brokenThisLevel * BALL_SPEED_PER_BRICK);
  const v = Math.min(BALL_SPEED_MAX, baseSpeed(s.level) + ramp);
  return s.timers.slow > 0 ? v * SLOW_FACTOR : v;
}

export function multiplier(combo: number): number {
  return Math.min(MAX_MULT, 1 + Math.floor(combo / COMBO_STEP));
}

export function brickAt(s: RunState, col: number, row: number): Brick | null {
  if (col < 0 || row < 0 || col >= COLS || row >= MAX_ROWS) return null;
  return s.grid[row * COLS + col] ?? null;
}

export function brickRect(b: { col: number; row: number }): { x: number; y: number; w: number; h: number } {
  return { x: GRID_X + b.col * BRICK_W, y: GRID_Y + b.row * BRICK_H, w: BRICK_W, h: BRICK_H };
}

export function brickCentre(b: { col: number; row: number }): { x: number; y: number } {
  return { x: GRID_X + (b.col + 0.5) * BRICK_W, y: GRID_Y + (b.row + 0.5) * BRICK_H };
}
