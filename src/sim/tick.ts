import { chance, nextFloat, range } from '../core/rng';
import type { SimEvent } from './events';
import { brickAt, brickCentre, brickRect, loadLevel, multiplier, newBall, resetForServe, targetSpeed } from './state';
import {
  BALL_MIN_VY, BALL_NUDGE_AFTER, BALL_R, BALL_SPEED_EASE, BALL_SUBSTEP, BOLT_COOLDOWN, BOLT_SPEED, BRICK_H, BRICK_W,
  CAPSULE_CHANCE, CAPSULE_H, CAPSULE_SPEED, CAPSULE_W, CLEAR_BONUS_BASE, CLEAR_BONUS_PER_LEVEL, CLEAR_DELAY,
  COLS, DAMAGE_POINTS, EXTRA_LIFE_EVERY, FIELD_H, FIELD_W, GRID_X, GRID_Y, LOST_DELAY, MAGNET_AUTO_LAUNCH, MAX_BALLS,
  MAX_CAPSULES, MAX_LIVES, PADDLE_GROW_RATE, PADDLE_H, PADDLE_MAX_ANGLE, PADDLE_POINTER_SPEED, PADDLE_SPEED,
  PADDLE_W, PADDLE_WIDE_W, PADDLE_Y, POWER_DURATION, POWER_KINDS, POWER_WEIGHTS, SERVE_ANGLE, SERVE_AUTO_LAUNCH,
  SHIELD_Y, TIMED_POWERS, type PowerKind,
} from './tuning';
import type { Ball, Brick, BrickKind, Intent, RunState } from './types';

export const BRICK_POINTS: Readonly<Record<BrickKind, number>> = {
  normal: 50, tough: 100, armor: 150, steel: 0, bomb: 80, power: 120,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Advances the run by dt seconds. Deterministic: same state + intents → same result. */
export function tick(s: RunState, intent: Intent, dt: number): SimEvent[] {
  const events: SimEvent[] = [];
  s.time += dt;
  s.phaseTime += dt;
  if (s.phase === 'over') return events;

  movePaddle(s, intent, dt);

  if (s.phase === 'lost') {
    if (s.phaseTime >= LOST_DELAY) {
      s.phase = 'play';
      s.phaseTime = 0;
      resetForServe(s);
    }
    return events;
  }
  if (s.phase === 'clear') {
    driftBalls(s, dt);
    if (s.phaseTime >= CLEAR_DELAY) loadLevel(s, s.level + 1, events);
    return events;
  }

  s.levelTime += dt;
  updateTimers(s, dt, events);
  s.speed = approach(s.speed, targetSpeed(s), BALL_SPEED_EASE * dt);
  updateStuck(s, intent, dt, events);
  fireBolts(s, intent, dt, events);
  if (moveBalls(s, dt, events)) return events; // level cleared
  if (moveBolts(s, dt, events)) return events;
  moveCapsules(s, dt, events);
  checkExtraLife(s, events);
  checkLost(s, events);
  return events;
}

function approach(v: number, target: number, step: number): number {
  return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
}

function movePaddle(s: RunState, intent: Intent, dt: number): void {
  const p = s.paddle;
  p.w = approach(p.w, p.targetW, PADDLE_GROW_RATE * dt);
  const before = p.x;
  if (intent.targetX !== null) {
    const max = PADDLE_POINTER_SPEED * dt;
    p.x += clamp(intent.targetX - p.x, -max, max);
  } else {
    p.x += clamp(intent.move, -1, 1) * PADDLE_SPEED * dt;
  }
  p.x = clamp(p.x, p.w / 2, FIELD_W - p.w / 2);
  p.vx = dt > 0 ? (p.x - before) / dt : 0;
  const half = p.w / 2;
  for (const b of s.balls) {
    if (!b.stuck) continue;
    b.stuckOffset = clamp(b.stuckOffset, -half + BALL_R, half - BALL_R);
    b.x = p.x + b.stuckOffset;
    b.y = PADDLE_Y - BALL_R;
  }
}

function updateTimers(s: RunState, dt: number, events: SimEvent[]): void {
  for (const k of TIMED_POWERS) {
    if (s.timers[k] <= 0) continue;
    s.timers[k] = Math.max(0, s.timers[k] - dt);
    if (s.timers[k] > 0) continue;
    events.push({ type: 'powerEnd', kind: k });
    if (k === 'wide') s.paddle.targetW = PADDLE_W;
  }
  s.boltCooldown = Math.max(0, s.boltCooldown - dt);
}

/** Sets a ball's direction to angle `a` from straight up (positive = right) at the current speed. */
function aim(s: RunState, b: Ball, a: number): void {
  b.vx = Math.sin(a) * s.speed;
  b.vy = -Math.cos(a) * s.speed;
}

function updateStuck(s: RunState, intent: Intent, dt: number, events: SimEvent[]): void {
  const stuck = s.balls.filter((b) => b.stuck);
  if (stuck.length === 0) return;
  const limit = s.timers.magnet > 0 ? MAGNET_AUTO_LAUNCH : SERVE_AUTO_LAUNCH;
  let launch = intent.firePressed;
  for (const b of stuck) {
    b.stuckTime += dt;
    if (b.stuckTime >= limit) launch = true;
  }
  if (!launch) return;
  const half = s.paddle.w / 2;
  for (const b of stuck) {
    b.stuck = false;
    b.sincePaddle = 0;
    let a: number;
    if (Math.abs(b.stuckOffset) > 2) {
      a = clamp(b.stuckOffset / half, -1, 1) * PADDLE_MAX_ANGLE * 0.85;
    } else {
      const dir = Math.abs(s.paddle.vx) > 30 ? Math.sign(s.paddle.vx) : nextFloat(s.rng) < 0.5 ? -1 : 1;
      a = dir * SERVE_ANGLE;
    }
    aim(s, b, a);
    events.push({ type: 'launch', x: b.x, y: b.y });
  }
}

function fireBolts(s: RunState, intent: Intent, _dt: number, events: SimEvent[]): void {
  if (s.timers.blaster <= 0 || !intent.fire || s.boltCooldown > 0) return;
  const p = s.paddle;
  const dx = p.w / 2 - 10;
  for (const x of [p.x - dx, p.x + dx]) s.bolts.push({ id: s.nextId++, x, y: PADDLE_Y - 2 });
  s.boltCooldown = BOLT_COOLDOWN;
  events.push({ type: 'bolt', x: p.x, y: PADDLE_Y });
}

/** Rescales velocity to `speed`, keeping at least BALL_MIN_VY of it vertical. */
export function normalizeVelocity(b: Ball, speed: number): void {
  const m = Math.hypot(b.vx, b.vy) || 1;
  let vx = b.vx / m;
  let vy = b.vy / m;
  if (Math.abs(vy) < BALL_MIN_VY) {
    vy = (vy < 0 ? -1 : 1) * BALL_MIN_VY;
    vx = (vx < 0 ? -1 : 1) * Math.sqrt(1 - vy * vy);
  }
  b.vx = vx * speed;
  b.vy = vy * speed;
}

/** Rotates a long-unreturned ball a little so it cannot loop forever between steel and walls. */
function maybeNudge(s: RunState, b: Ball): void {
  if (b.sincePaddle < BALL_NUDGE_AFTER) return;
  const a = range(s.rng, -0.3, 0.3);
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const vx = b.vx * c - b.vy * sn;
  b.vy = b.vx * sn + b.vy * c;
  b.vx = vx;
  b.sincePaddle = BALL_NUDGE_AFTER * 0.5;
}

/** Returns true if the level was cleared. */
function moveBalls(s: RunState, dt: number, events: SimEvent[]): boolean {
  for (const b of [...s.balls]) {
    if (b.stuck) continue;
    b.sincePaddle += dt;
    normalizeVelocity(b, s.speed);
    const steps = Math.max(1, Math.ceil((s.speed * dt) / BALL_SUBSTEP));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      if (!stepBall(s, b, h, events)) break;
      if (s.phase === 'clear') return true;
      if (b.stuck) break;
    }
  }
  return false;
}

/** Moves one ball one substep. Returns false if the ball was lost. */
function stepBall(s: RunState, b: Ball, h: number, events: SimEvent[]): boolean {
  const prevY = b.y;

  b.x += b.vx * h;
  if (b.x < BALL_R) {
    b.x = BALL_R;
    b.vx = Math.abs(b.vx);
    events.push({ type: 'wallHit', x: 0, y: b.y });
  } else if (b.x > FIELD_W - BALL_R) {
    b.x = FIELD_W - BALL_R;
    b.vx = -Math.abs(b.vx);
    events.push({ type: 'wallHit', x: FIELD_W, y: b.y });
  } else {
    collideBricks(s, b, 'x', events);
    if (s.phase === 'clear') return true;
  }

  b.y += b.vy * h;
  if (b.y < BALL_R) {
    b.y = BALL_R;
    b.vy = Math.abs(b.vy);
    events.push({ type: 'wallHit', x: b.x, y: 0 });
    maybeNudge(s, b);
  } else {
    collideBricks(s, b, 'y', events);
    if (s.phase === 'clear') return true;
  }

  collidePaddle(s, b, prevY, events);

  if (s.shield && b.vy > 0 && b.y + BALL_R >= SHIELD_Y && prevY + BALL_R <= SHIELD_Y + 1) {
    b.y = SHIELD_Y - BALL_R;
    b.vy = -Math.abs(b.vy);
    s.shield = false;
    events.push({ type: 'shieldSave', x: b.x, y: SHIELD_Y });
  }
  if (s.god && b.vy > 0 && b.y + BALL_R >= FIELD_H) {
    b.y = FIELD_H - BALL_R;
    b.vy = -Math.abs(b.vy);
  }
  if (b.y - BALL_R > FIELD_H) {
    s.balls = s.balls.filter((o) => o !== b);
    events.push({ type: 'ballLost', x: b.x, y: FIELD_H });
    return false;
  }
  return true;
}

function collidePaddle(s: RunState, b: Ball, prevY: number, events: SimEvent[]): void {
  if (b.vy <= 0) return;
  const p = s.paddle;
  const half = p.w / 2;
  if (b.y + BALL_R < PADDLE_Y || prevY + BALL_R > PADDLE_Y + 4) return;
  if (b.x + BALL_R < p.x - half || b.x - BALL_R > p.x + half) return;
  const off = clamp((b.x - p.x) / (half + BALL_R * 0.5), -1, 1);
  b.y = PADDLE_Y - BALL_R;
  aim(s, b, off * PADDLE_MAX_ANGLE);
  b.sincePaddle = 0;
  s.combo = 0;
  events.push({ type: 'paddleHit', x: b.x, y: PADDLE_Y, offset: off });
  if (s.timers.magnet > 0) {
    b.stuck = true;
    b.stuckOffset = clamp(b.x - p.x, -half + BALL_R, half - BALL_R);
    b.stuckTime = 0;
  }
}

/** Resolves the ball against bricks after a move along one axis. */
function collideBricks(s: RunState, b: Ball, axis: 'x' | 'y', events: SimEvent[]): void {
  const left = b.x - BALL_R;
  const right = b.x + BALL_R;
  const top = b.y - BALL_R;
  const bottom = b.y + BALL_R;
  const c0 = Math.floor((left - GRID_X) / BRICK_W);
  const c1 = Math.floor((right - GRID_X) / BRICK_W);
  const r0 = Math.floor((top - GRID_Y) / BRICK_H);
  const r1 = Math.floor((bottom - GRID_Y) / BRICK_H);
  if (r1 < 0 || c1 < 0 || c0 >= COLS) return;
  const pierce = s.timers.pierce > 0;
  let hit: Brick | null = null;
  let best = 0;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const brick = brickAt(s, c, r);
      if (!brick) continue;
      const rect = brickRect(brick);
      const ox = Math.min(right, rect.x + rect.w) - Math.max(left, rect.x);
      const oy = Math.min(bottom, rect.y + rect.h) - Math.max(top, rect.y);
      if (ox <= 0 || oy <= 0) continue;
      if (pierce && brick.kind !== 'steel') {
        destroyBricks(s, [brick], events);
        if (s.phase === 'clear') return;
        continue;
      }
      if (ox * oy > best) {
        best = ox * oy;
        hit = brick;
      }
    }
  }
  if (!hit) return;
  const rect = brickRect(hit);
  const toLeft = b.x < rect.x + rect.w / 2;
  const nx = toLeft ? rect.x - BALL_R : rect.x + rect.w + BALL_R;
  // A sideways push into the side margin (narrower than the ball) is resolved vertically instead.
  if (axis === 'x' && nx >= BALL_R && nx <= FIELD_W - BALL_R) {
    b.x = nx;
    b.vx = toLeft ? -Math.abs(b.vx) : Math.abs(b.vx);
  } else if (b.y < rect.y + rect.h / 2) {
    b.y = rect.y - BALL_R;
    b.vy = -Math.abs(b.vy);
  } else {
    b.y = rect.y + rect.h + BALL_R;
    b.vy = Math.abs(b.vy);
  }
  if (hit.kind === 'steel') maybeNudge(s, b);
  hitBrick(s, hit, events);
}

/** One point of damage from a ball or bolt. */
export function hitBrick(s: RunState, brick: Brick, events: SimEvent[]): void {
  const c = brickCentre(brick);
  if (brick.kind === 'steel') {
    events.push({ type: 'steelHit', x: c.x, y: c.y, col: brick.col, row: brick.row });
    return;
  }
  brick.hp -= 1;
  if (brick.hp > 0) {
    s.score += DAMAGE_POINTS;
    events.push({ type: 'brickHit', x: c.x, y: c.y, kind: brick.kind, tint: brick.tint, hp: brick.hp, col: brick.col, row: brick.row });
    return;
  }
  destroyBricks(s, [brick], events);
}

/** Destroys bricks outright, chaining through bombs. Steel is never destroyed. */
export function destroyBricks(s: RunState, start: Brick[], events: SimEvent[]): void {
  const queue = [...start];
  while (queue.length > 0) {
    const br = queue.shift()!;
    const idx = br.row * COLS + br.col;
    if (s.grid[idx] !== br || br.kind === 'steel') continue;
    s.grid[idx] = null;
    br.hp = 0;
    s.remaining--;
    s.brokenThisLevel++;
    s.combo++;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    const mult = multiplier(s.combo);
    const points = BRICK_POINTS[br.kind] * mult;
    s.score += points;
    const c = brickCentre(br);
    events.push({
      type: 'brickBreak', x: c.x, y: c.y, kind: br.kind, tint: br.tint, points, combo: s.combo, mult,
      col: br.col, row: br.row, last: s.remaining === 0,
    });
    if (br.kind === 'power' || (s.capsules.length < MAX_CAPSULES && chance(s.rng, CAPSULE_CHANCE))) {
      const kind = rollPower(s);
      s.capsules.push({ id: s.nextId++, x: c.x, y: c.y, kind });
      events.push({ type: 'capsuleSpawn', x: c.x, y: c.y, kind });
    }
    if (br.kind === 'bomb') {
      events.push({ type: 'bomb', x: c.x, y: c.y });
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const n = brickAt(s, br.col + dc, br.row + dr);
          if (n && n.kind !== 'steel') queue.push(n);
        }
      }
    }
  }
  if (s.remaining <= 0 && s.phase === 'play') clearLevel(s, events);
}

function clearLevel(s: RunState, events: SimEvent[]): void {
  const bonus = CLEAR_BONUS_BASE + CLEAR_BONUS_PER_LEVEL * s.level;
  s.score += bonus;
  s.phase = 'clear';
  s.phaseTime = 0;
  s.capsules = [];
  s.bolts = [];
  for (const b of s.balls) b.stuck = false;
  events.push({ type: 'levelClear', level: s.level, bonus });
  checkExtraLife(s, events);
}

/** After a clear, balls fly on cosmetically: walls only, then off the bottom. */
function driftBalls(s: RunState, dt: number): void {
  for (const b of s.balls) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < BALL_R) b.vx = Math.abs(b.vx);
    if (b.x > FIELD_W - BALL_R) b.vx = -Math.abs(b.vx);
    if (b.y < BALL_R) b.vy = Math.abs(b.vy);
    b.x = clamp(b.x, BALL_R, FIELD_W - BALL_R);
    b.y = Math.max(BALL_R, b.y);
  }
  s.balls = s.balls.filter((b) => b.y < FIELD_H + 40);
}

export function rollPower(s: RunState): PowerKind {
  let total = 0;
  for (const k of POWER_KINDS) total += POWER_WEIGHTS[k];
  let r = nextFloat(s.rng) * total;
  for (const k of POWER_KINDS) {
    r -= POWER_WEIGHTS[k];
    if (r < 0) return k;
  }
  return 'wide';
}

/** Returns true if the level was cleared. */
function moveBolts(s: RunState, dt: number, events: SimEvent[]): boolean {
  const keep = [];
  for (const bolt of s.bolts) {
    let alive = true;
    const steps = 2;
    for (let i = 0; i < steps && alive; i++) {
      bolt.y -= (BOLT_SPEED * dt) / steps;
      const brick = brickAt(s, Math.floor((bolt.x - GRID_X) / BRICK_W), Math.floor((bolt.y - GRID_Y) / BRICK_H));
      if (brick) {
        hitBrick(s, brick, events);
        alive = false;
      } else if (bolt.y < 0) {
        alive = false;
      }
    }
    if (alive) keep.push(bolt);
    if (s.phase === 'clear') return true;
  }
  s.bolts = keep;
  return false;
}

function moveCapsules(s: RunState, dt: number, events: SimEvent[]): void {
  const p = s.paddle;
  const keep = [];
  for (const c of s.capsules) {
    c.y += CAPSULE_SPEED * dt;
    const caught =
      Math.abs(c.x - p.x) < (p.w + CAPSULE_W) / 2 &&
      c.y + CAPSULE_H / 2 >= PADDLE_Y &&
      c.y - CAPSULE_H / 2 <= PADDLE_Y + PADDLE_H;
    if (caught) applyPower(s, c.kind, c.x, c.y, events);
    else if (c.y - CAPSULE_H / 2 <= FIELD_H) keep.push(c);
  }
  s.capsules = keep;
}

export function applyPower(s: RunState, kind: PowerKind, x: number, y: number, events: SimEvent[]): void {
  events.push({ type: 'powerUp', x, y, kind });
  switch (kind) {
    case 'wide':
      s.timers.wide = POWER_DURATION.wide;
      s.paddle.targetW = PADDLE_WIDE_W;
      break;
    case 'slow':
    case 'magnet':
    case 'blaster':
    case 'pierce':
      s.timers[kind] = POWER_DURATION[kind];
      break;
    case 'shield':
      s.shield = true;
      break;
    case 'life':
      s.lives = Math.min(MAX_LIVES, s.lives + 1);
      events.push({ type: 'extraLife', lives: s.lives });
      break;
    case 'multi':
      splitBalls(s, events);
      break;
  }
}

function splitBalls(s: RunState, events: SimEvent[]): void {
  for (const b of s.balls) {
    if (!b.stuck) continue;
    b.stuck = false;
    aim(s, b, clamp(b.stuckOffset / (s.paddle.w / 2), -1, 1) * PADDLE_MAX_ANGLE * 0.85);
    events.push({ type: 'launch', x: b.x, y: b.y });
  }
  for (const b of [...s.balls]) {
    for (const turn of [-0.42, 0.42]) {
      if (s.balls.length >= MAX_BALLS) return;
      const c = Math.cos(turn);
      const sn = Math.sin(turn);
      const nb = newBall(s, b.x, b.y, b.vx * c - b.vy * sn, b.vx * sn + b.vy * c, false);
      nb.sincePaddle = b.sincePaddle;
      s.balls.push(nb);
    }
  }
}

function checkExtraLife(s: RunState, events: SimEvent[]): void {
  while (s.score >= s.nextLifeAt) {
    s.nextLifeAt += EXTRA_LIFE_EVERY;
    if (s.lives < MAX_LIVES) {
      s.lives++;
      events.push({ type: 'extraLife', lives: s.lives });
    }
  }
}

function checkLost(s: RunState, events: SimEvent[]): void {
  if (s.balls.length > 0 || s.phase !== 'play') return;
  s.lives -= 1;
  s.combo = 0;
  s.capsules = [];
  s.bolts = [];
  s.shield = false;
  for (const k of TIMED_POWERS) s.timers[k] = 0;
  s.paddle.targetW = PADDLE_W;
  s.phaseTime = 0;
  events.push({ type: 'lifeLost', lives: s.lives });
  if (s.lives <= 0) {
    s.lives = 0;
    s.phase = 'over';
    events.push({ type: 'gameOver', score: s.score });
  } else {
    s.phase = 'lost';
  }
}
