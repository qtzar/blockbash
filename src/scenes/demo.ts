import { BALL_R, FIELD_W, PADDLE_Y } from '../sim/tuning';
import type { Ball, Intent, RunState } from '../sim/types';

/** Where a descending ball will cross the paddle line, folding wall bounces back into the field. */
export function predictX(b: Ball): number {
  const dy = PADDLE_Y - BALL_R - b.y;
  const t = b.vy > 0 ? Math.max(0, dy / b.vy) : 0;
  const lo = BALL_R;
  const span = FIELD_W - 2 * BALL_R;
  const period = 2 * span;
  const m = ((((b.x + b.vx * t - lo) % period) + period) % period);
  return lo + (m <= span ? m : period - m);
}

/**
 * Title-screen autopilot: tracks the most urgent ball and aims with a slowly wandering offset so the demo varies
 * its angles. Good but not perfect.
 */
export function demoIntent(s: RunState): Intent {
  const p = s.paddle;
  let target = FIELD_W / 2;
  const falling = s.balls.filter((b) => !b.stuck && b.vy > 0);
  if (falling.length > 0) {
    const urgent = falling.reduce((a, b) => (b.y > a.y ? b : a));
    const wander = Math.sin(s.time * 0.9) * 0.6 + Math.sin(s.time * 2.3) * 0.25;
    target = predictX(urgent) - wander * p.w * 0.45;
  } else if (s.capsules.length > 0) {
    target = s.capsules.reduce((a, c) => (c.y > a.y ? c : a)).x;
  } else if (s.balls.length > 0) {
    target = s.balls[0]!.x;
  }
  const stuck = s.balls.some((b) => b.stuck);
  return {
    move: 0,
    targetX: target,
    fire: true,
    firePressed: stuck && s.phase === 'play' && s.levelTime > 1.5 && Math.floor(s.time * 60) % 50 === 0,
  };
}
