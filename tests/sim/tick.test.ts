import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../../src/sim/events';
import { brickAt, brickCentre, createRun, multiplier } from '../../src/sim/state';
import { applyPower, tick } from '../../src/sim/tick';
import {
  BALL_R, CLEAR_DELAY, COMBO_STEP, FIELD_H, FIELD_W, LOST_DELAY, PADDLE_W, PADDLE_WIDE_W, PADDLE_Y,
  SERVE_AUTO_LAUNCH, START_LIVES,
} from '../../src/sim/tuning';
import type { RunState } from '../../src/sim/types';
import { DT, fly, intent, runWith } from './helpers';

function run(s: RunState, seconds: number, i = intent()): SimEvent[] {
  const out: SimEvent[] = [];
  for (let t = 0; t < seconds; t += DT) out.push(...tick(s, i, DT));
  return out;
}

const types = (events: SimEvent[]) => events.map((e) => e.type);

describe('serve', () => {
  it('starts with one ball stuck on the paddle', () => {
    const { state, events } = createRun({ seed: 3 });
    expect(types(events)).toEqual(['levelStart']);
    expect(state.balls).toHaveLength(1);
    expect(state.balls[0]!.stuck).toBe(true);
    expect(state.balls[0]!.y).toBe(PADDLE_Y - BALL_R);
  });

  it('launches upward on fire', () => {
    const { state } = createRun({ seed: 3 });
    const ev = tick(state, intent({ firePressed: true }), DT);
    expect(types(ev)).toContain('launch');
    expect(state.balls[0]!.stuck).toBe(false);
    expect(state.balls[0]!.vy).toBeLessThan(0);
  });

  it('launches on its own after a while', () => {
    const { state } = createRun({ seed: 3 });
    run(state, SERVE_AUTO_LAUNCH - 0.1);
    expect(state.balls[0]!.stuck).toBe(true);
    run(state, 0.2);
    expect(state.balls[0]!.stuck).toBe(false);
  });

  it('stuck ball follows the paddle', () => {
    const { state } = createRun({ seed: 3 });
    run(state, 0.3, intent({ move: 1 }));
    expect(state.balls[0]!.x).toBeCloseTo(state.paddle.x);
    expect(state.paddle.x).toBeGreaterThan(FIELD_W / 2);
  });
});

describe('ball physics', () => {
  it('bounces off the side walls and the ceiling', () => {
    const s = runWith(['.............']);
    fly(s, 20, 300, -400, -300);
    run(s, 0.2);
    expect(s.balls[0]!.vx).toBeGreaterThan(0);
    fly(s, 300, 20, 100, -400);
    run(s, 0.2);
    expect(s.balls[0]!.vy).toBeGreaterThan(0);
  });

  it('breaks a brick and bounces back', () => {
    const s = runWith(['.............', '......r......']);
    const c = brickCentre({ col: 6, row: 1 });
    fly(s, c.x, c.y + 80, 0.001, -400);
    const ev = run(s, 0.3);
    expect(brickAt(s, 6, 1)).toBeNull();
    expect(types(ev)).toContain('brickBreak');
    expect(s.balls[0]!.vy).toBeGreaterThan(0);
  });

  it('tough bricks need two hits, steel never breaks', () => {
    const s = runWith(['......2......', '......#......', '.............', '.....g.......']);
    const tough = brickAt(s, 6, 0)!;
    const ev: SimEvent[] = [];
    // Drop onto the tough brick from above: from below, the steel shields it.
    fly(s, brickCentre(tough).x, 30, 0.001, 400);
    ev.push(...run(s, 0.1));
    expect(tough.hp).toBe(1);
    expect(types(ev)).toContain('brickHit');
    fly(s, brickCentre({ col: 6, row: 1 }).x, 200, 0.001, -400);
    ev.push(...run(s, 0.5));
    expect(types(ev)).toContain('steelHit');
    expect(brickAt(s, 6, 1)?.kind).toBe('steel');
  });

  it('bounces off the paddle, angled by where it lands', () => {
    const s = runWith(['......g......']);
    fly(s, s.paddle.x + PADDLE_W * 0.4, PADDLE_Y - 40, 0.001, 400);
    const ev = run(s, 0.15);
    expect(types(ev)).toContain('paddleHit');
    expect(s.balls[0]!.vy).toBeLessThan(0);
    expect(s.balls[0]!.vx).toBeGreaterThan(100);
  });

  it('keeps the ball inside the field over a long rally', () => {
    const { state } = createRun({ seed: 99, god: true });
    for (let i = 0; i < 60 * 120; i++) {
      tick(state, intent({ firePressed: true, fire: true }), DT);
      for (const b of state.balls) {
        expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
        expect(b.x).toBeGreaterThanOrEqual(BALL_R - 0.01);
        expect(b.x).toBeLessThanOrEqual(FIELD_W - BALL_R + 0.01);
        expect(b.y).toBeGreaterThanOrEqual(BALL_R - 0.01);
      }
    }
    expect(state.score).toBeGreaterThan(0);
  });
});

describe('bricks and scoring', () => {
  it('bombs chain through neighbours but not steel', () => {
    const s = runWith(['ggg#g........', 'g**gg........', 'ggggg........']);
    const ev: SimEvent[] = [];
    const bomb = brickAt(s, 1, 1)!;
    fly(s, brickCentre(bomb).x, 220, 0.001, -500);
    // Clear a path up to the bomb by removing the brick below it.
    s.grid[2 * 13 + 1] = null;
    s.remaining--;
    ev.push(...run(s, 0.6));
    expect(ev.filter((e) => e.type === 'bomb')).toHaveLength(2);
    expect(brickAt(s, 3, 0)?.kind).toBe('steel');
    expect(brickAt(s, 0, 0)).toBeNull();
    expect(brickAt(s, 3, 2)).toBeNull();
    expect(brickAt(s, 4, 1)?.kind).toBe('normal');
  });

  it('builds a multiplier while the ball stays off the paddle', () => {
    expect(multiplier(0)).toBe(1);
    expect(multiplier(COMBO_STEP)).toBe(2);
    expect(multiplier(1000)).toBe(8);
  });

  it('clears the level and moves on', () => {
    const s = runWith(['.............', '......r......']);
    const c = brickCentre({ col: 6, row: 1 });
    fly(s, c.x, c.y + 80, 0.001, -400);
    const ev = run(s, 0.3);
    const clear = ev.find((e) => e.type === 'levelClear');
    expect(clear).toBeDefined();
    expect(ev.find((e) => e.type === 'brickBreak' && e.last)).toBeDefined();
    expect(s.phase).toBe('clear');
    const next = run(s, CLEAR_DELAY + 0.1);
    expect(next.find((e) => e.type === 'levelStart')).toMatchObject({ level: 2 });
    expect(s.balls[0]!.stuck).toBe(true);
  });
});

describe('lives', () => {
  it('loses a life when the last ball falls, then serves again', () => {
    const s = runWith(['......r......']);
    fly(s, 30, FIELD_H - 20, 0.001, 400);
    s.paddle.x = FIELD_W - 100;
    const ev = run(s, 0.3, intent({ targetX: FIELD_W - 100 }));
    expect(types(ev)).toContain('ballLost');
    expect(types(ev)).toContain('lifeLost');
    expect(s.lives).toBe(START_LIVES - 1);
    expect(s.phase).toBe('lost');
    run(s, LOST_DELAY);
    expect(s.phase).toBe('play');
    expect(s.balls[0]!.stuck).toBe(true);
  });

  it('ends the game on the last life', () => {
    const s = runWith(['......r......']);
    s.lives = 1;
    fly(s, 30, FIELD_H - 20, 0.001, 400);
    s.paddle.x = FIELD_W - 100;
    const ev = run(s, 0.3, intent({ targetX: FIELD_W - 100 }));
    expect(types(ev)).toContain('gameOver');
    expect(s.phase).toBe('over');
  });
});

describe('power-ups', () => {
  it('wide grows the paddle', () => {
    const s = runWith(['......r......']);
    applyPower(s, 'wide', 0, 0, []);
    run(s, 1);
    expect(s.paddle.w).toBe(PADDLE_WIDE_W);
  });

  it('multi splits every ball into three', () => {
    const s = runWith(['......r......']);
    fly(s, 300, 300, 100, -400);
    applyPower(s, 'multi', 0, 0, []);
    expect(s.balls).toHaveLength(3);
  });

  it('shield saves one ball', () => {
    const s = runWith(['......r......']);
    applyPower(s, 'shield', 0, 0, []);
    fly(s, 30, FIELD_H - 40, 0.001, 400);
    s.paddle.x = FIELD_W - 100;
    const ev = run(s, 0.2, intent({ targetX: FIELD_W - 100 }));
    expect(types(ev)).toContain('shieldSave');
    expect(s.shield).toBe(false);
    expect(s.balls).toHaveLength(1);
  });

  it('magnet catches the ball on the paddle', () => {
    const s = runWith(['......r......']);
    applyPower(s, 'magnet', 0, 0, []);
    fly(s, s.paddle.x, PADDLE_Y - 40, 0.001, 400);
    run(s, 0.15);
    expect(s.balls[0]!.stuck).toBe(true);
  });

  it('blaster bolts break bricks', () => {
    const s = runWith(['ggggggggggggg']);
    applyPower(s, 'blaster', 0, 0, []);
    const ev = run(s, 1, intent({ fire: true }));
    expect(types(ev)).toContain('bolt');
    expect(ev.filter((e) => e.type === 'brickBreak').length).toBeGreaterThanOrEqual(2);
  });

  it('catching a capsule applies it', () => {
    const s = runWith(['......r......']);
    s.capsules.push({ id: 999, x: s.paddle.x, y: PADDLE_Y - 30, kind: 'shield' });
    const ev = run(s, 0.4);
    expect(ev.find((e) => e.type === 'powerUp')).toMatchObject({ kind: 'shield' });
    expect(s.capsules).toHaveLength(0);
  });
});

describe('determinism', () => {
  it('replays identically from the same seed and inputs', () => {
    const play = () => {
      const { state } = createRun({ seed: 1234 });
      for (let i = 0; i < 60 * 40; i++) {
        const b = state.balls[0];
        tick(state, intent({ targetX: b ? b.x : 320, firePressed: i % 120 === 0, fire: true }), DT);
      }
      return { score: state.score, balls: state.balls.map((b) => [b.x, b.y]), lives: state.lives, level: state.level };
    };
    expect(play()).toEqual(play());
  });
});
