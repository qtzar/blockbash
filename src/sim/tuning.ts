/** Gameplay constants. All distances are field units; the field is FIELD_W × FIELD_H with (0, 0) top-left. */

export const FIELD_W = 640;
export const FIELD_H = 640;

// Brick grid
export const COLS = 13;
export const MAX_ROWS = 16;
export const BRICK_W = 48;
export const BRICK_H = 20;
export const GRID_X = (FIELD_W - COLS * BRICK_W) / 2;
export const GRID_Y = 56;

// Paddle
export const PADDLE_Y = 596;
export const PADDLE_H = 14;
export const PADDLE_W = 96;
export const PADDLE_WIDE_W = 156;
/** Width change rate while growing or shrinking (u/s). */
export const PADDLE_GROW_RATE = 320;
/** Keyboard / stick top speed (u/s). */
export const PADDLE_SPEED = 820;
/** Pointer-follow top speed (u/s): fast enough to feel direct, slow enough to stop teleports through balls. */
export const PADDLE_POINTER_SPEED = 3200;
/** Largest bounce angle from vertical, at the very edge of the paddle (radians). */
export const PADDLE_MAX_ANGLE = (62 * Math.PI) / 180;

// Ball
export const BALL_R = 7;
export const BALL_SPEED_BASE = 380;
export const BALL_SPEED_PER_LEVEL = 14;
export const BALL_SPEED_LEVEL_CAP = 16;
/** Extra speed per brick broken in the current level, up to BALL_SPEED_RAMP_MAX. */
export const BALL_SPEED_PER_BRICK = 1.6;
export const BALL_SPEED_RAMP_MAX = 170;
export const BALL_SPEED_MAX = 860;
/** How fast the actual ball speed eases toward the target (u/s²). */
export const BALL_SPEED_EASE = 500;
/** Minimum share of the speed that must be vertical, so the ball never ping-pongs flat. */
export const BALL_MIN_VY = 0.3;
/** Largest single movement inside a sim step; ball moves are split into substeps of this size. */
export const BALL_SUBSTEP = 3;
export const MAX_BALLS = 9;
/** A ball that has not touched the paddle for this long gets a small random nudge on the next bounce. */
export const BALL_NUDGE_AFTER = 14;
export const SERVE_ANGLE = (14 * Math.PI) / 180;
/** Stuck balls launch on their own after this long (s). */
export const SERVE_AUTO_LAUNCH = 5;
export const MAGNET_AUTO_LAUNCH = 2.5;

// Phases
export const LOST_DELAY = 1.3;
export const CLEAR_DELAY = 2.4;
export const OVER_DELAY = 2.2;

// Lives and scoring
export const START_LIVES = 3;
export const MAX_LIVES = 9;
export const EXTRA_LIFE_EVERY = 20_000;
export const COMBO_STEP = 5;
export const MAX_MULT = 8;
export const DAMAGE_POINTS = 10;
export const CLEAR_BONUS_BASE = 1000;
export const CLEAR_BONUS_PER_LEVEL = 250;

// Power capsules
export const CAPSULE_W = 40;
export const CAPSULE_H = 18;
export const CAPSULE_SPEED = 165;
export const CAPSULE_CHANCE = 0.13;
export const MAX_CAPSULES = 3;
export const SHIELD_Y = FIELD_H - 14;

export type PowerKind = 'wide' | 'multi' | 'slow' | 'magnet' | 'blaster' | 'pierce' | 'shield' | 'life';
export type TimedPower = 'wide' | 'slow' | 'magnet' | 'blaster' | 'pierce';

export const POWER_KINDS: readonly PowerKind[] = ['wide', 'multi', 'slow', 'magnet', 'blaster', 'pierce', 'shield', 'life'];
export const TIMED_POWERS: readonly TimedPower[] = ['wide', 'slow', 'magnet', 'blaster', 'pierce'];

export const POWER_WEIGHTS: Readonly<Record<PowerKind, number>> = {
  wide: 3, multi: 3, slow: 2, magnet: 2, blaster: 2, pierce: 1.4, shield: 2, life: 0.5,
};

export const POWER_DURATION: Readonly<Record<TimedPower, number>> = {
  wide: 20, slow: 12, magnet: 15, blaster: 12, pierce: 7,
};

export const SLOW_FACTOR = 0.68;

// Blaster
export const BOLT_SPEED = 950;
export const BOLT_COOLDOWN = 0.2;
export const BOLT_LEN = 14;
