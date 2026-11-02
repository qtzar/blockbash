import { BALL_R, BRICK_H, BRICK_W, CAPSULE_H, CAPSULE_W, POWER_KINDS, type PowerKind } from '../sim/tuning';
import type { Brick } from '../sim/types';
import { brickColor, PALETTE, POWER_COLORS, TINT_COLORS, withAlpha } from './palette';

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Half size in game units, including the glow padding. */
  hw: number;
  hh: number;
}

/** Sprites are rendered at 2× so they stay sharp when the game is scaled up. */
const SPRITE_SCALE = 2;
const GLOW_PAD = 14;

type Draw = (ctx: CanvasRenderingContext2D) => void;

/**
 * Pre-renders vector line art with the four-pass neon glow. `draw` builds a path centred on (0, 0) (it must call
 * beginPath but not stroke). `fill`, if given, fills that path once first. This is the only place shadowBlur is used.
 */
export function makeSprite(color: string, w: number, h: number, draw: Draw, fill?: string): Sprite {
  const cw = Math.ceil(w + GLOW_PAD * 2);
  const ch = Math.ceil(h + GLOW_PAD * 2);
  const canvas = document.createElement('canvas');
  canvas.width = cw * SPRITE_SCALE;
  canvas.height = ch * SPRITE_SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SPRITE_SCALE, SPRITE_SCALE);
  ctx.translate(cw / 2, ch / 2);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (fill) {
    ctx.fillStyle = fill;
    draw(ctx);
    ctx.fill();
  }
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  for (const [blur, width] of [[16, 3], [6, 2], [0, 1.5]] as const) {
    ctx.shadowBlur = blur * SPRITE_SCALE;
    ctx.lineWidth = width;
    draw(ctx);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 0.75;
  draw(ctx);
  ctx.stroke();
  return { canvas, hw: cw / 2, hh: ch / 2 };
}

export function drawSprite(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, alpha = 1, scale = 1): void {
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(s.canvas, x - s.hw * scale, y - s.hh * scale, s.hw * 2 * scale, s.hh * 2 * scale);
  if (alpha !== 1) ctx.globalAlpha = 1;
}

export function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  c.moveTo(x + rr, y);
  c.lineTo(x + w - rr, y);
  c.arcTo(x + w, y, x + w, y + rr, rr);
  c.lineTo(x + w, y + h - rr);
  c.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  c.lineTo(x + rr, y + h);
  c.arcTo(x, y + h, x, y + h - rr, rr);
  c.lineTo(x, y + rr);
  c.arcTo(x, y, x + rr, y, rr);
  c.closePath();
}

function line(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
}

function circle(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.moveTo(x + r, y);
  c.arc(x, y, r, 0, Math.PI * 2);
}

const BW = BRICK_W - 7;
const BH = BRICK_H - 7;

function brickBody(c: CanvasRenderingContext2D): void {
  roundRect(c, -BW / 2, -BH / 2, BW, BH, 3);
}

function crack(c: CanvasRenderingContext2D, heavy: boolean): void {
  c.moveTo(-6, -BH / 2);
  c.lineTo(-2, -1);
  c.lineTo(-7, 2);
  c.lineTo(-3, BH / 2);
  if (heavy) {
    c.moveTo(9, -BH / 2);
    c.lineTo(6, 0);
    c.lineTo(11, BH / 2);
  }
}

function brickDraw(kind: Brick['kind'], hp: number): Draw {
  return (c) => {
    c.beginPath();
    brickBody(c);
    switch (kind) {
      case 'normal':
        line(c, -BW / 2 + 5, -BH / 2 + 3.5, -BW / 2 + 13, -BH / 2 + 3.5);
        break;
      case 'tough':
        if (hp >= 2) roundRect(c, -BW / 2 + 4, -BH / 2 + 3.5, BW - 8, BH - 7, 2);
        else crack(c, false);
        break;
      case 'armor':
        if (hp >= 2) roundRect(c, -BW / 2 + 4, -BH / 2 + 3.5, BW - 8, BH - 7, 2);
        if (hp >= 3) line(c, -BW / 2 + 9, 0, BW / 2 - 9, 0);
        if (hp < 3) crack(c, hp < 2);
        break;
      case 'steel':
        for (const [x, y] of [[-BW / 2 + 4, -BH / 2 + 3.5], [BW / 2 - 4, -BH / 2 + 3.5], [-BW / 2 + 4, BH / 2 - 3.5], [BW / 2 - 4, BH / 2 - 3.5]] as const) {
          circle(c, x, y, 1);
        }
        line(c, -8, BH / 2 - 2, -2, -BH / 2 + 2);
        line(c, 2, BH / 2 - 2, 8, -BH / 2 + 2);
        break;
      case 'bomb':
        circle(c, 0, 1, 3.5);
        line(c, 2.5, -2, 5, -4.5);
        line(c, 7, -5, 9, -5);
        line(c, 6, -7, 7, -8.5);
        break;
      case 'power':
        c.moveTo(0, -4.5);
        c.lineTo(5, 0);
        c.lineTo(0, 4.5);
        c.lineTo(-5, 0);
        c.closePath();
        break;
    }
  };
}

export function brickSpriteKey(b: Pick<Brick, 'kind' | 'tint' | 'hp'>): string {
  if (b.kind === 'normal') return `normal-${b.tint}`;
  if (b.kind === 'tough' || b.kind === 'armor') return `${b.kind}-${Math.max(1, b.hp)}`;
  return b.kind;
}

function capsuleIcon(kind: PowerKind, c: CanvasRenderingContext2D): void {
  switch (kind) {
    case 'wide':
      line(c, -10, 0, 10, 0);
      line(c, -10, 0, -6, -3.5);
      line(c, -10, 0, -6, 3.5);
      line(c, 10, 0, 6, -3.5);
      line(c, 10, 0, 6, 3.5);
      break;
    case 'multi':
      circle(c, -7, 1.5, 2.5);
      circle(c, 0, -2, 2.5);
      circle(c, 7, 1.5, 2.5);
      break;
    case 'slow':
      circle(c, 0, 0, 5);
      line(c, 0, 0, 0, -3.5);
      line(c, 0, 0, 2.5, 1);
      break;
    case 'magnet':
      c.moveTo(-5, -4);
      c.lineTo(-5, 0);
      c.arc(0, 0, 5, Math.PI, 0, true);
      c.lineTo(5, -4);
      line(c, -7, -4, -3, -4);
      line(c, 3, -4, 7, -4);
      break;
    case 'blaster':
      line(c, -5, 5, -5, -3);
      line(c, 5, 5, 5, -3);
      line(c, -5, -3, -3, -5.5);
      line(c, -5, -3, -7, -5.5);
      line(c, 5, -3, 3, -5.5);
      line(c, 5, -3, 7, -5.5);
      break;
    case 'pierce':
      line(c, -10, 0, 8, 0);
      line(c, 8, 0, 4, -3.5);
      line(c, 8, 0, 4, 3.5);
      line(c, -2, -5, -2, 5);
      break;
    case 'shield':
      line(c, -10, 4, 10, 4);
      c.moveTo(-7, 4);
      c.arc(0, 4, 7, Math.PI, 0);
      break;
    case 'life':
      c.moveTo(0, 5);
      c.bezierCurveTo(-9, -1, -5, -8, 0, -3);
      c.bezierCurveTo(5, -8, 9, -1, 0, 5);
      break;
  }
}

function capsuleDraw(kind: PowerKind): Draw {
  return (c) => {
    c.beginPath();
    roundRect(c, -CAPSULE_W / 2, -CAPSULE_H / 2, CAPSULE_W, CAPSULE_H, CAPSULE_H / 2);
    capsuleIcon(kind, c);
  };
}

const ball: Draw = (c) => {
  c.beginPath();
  circle(c, 0, 0, BALL_R - 1);
};

export interface GameSprites {
  bricks: Map<string, Sprite>;
  capsules: Record<PowerKind, Sprite>;
  /** Small capsule icons without the pill, for the HUD legend. */
  icons: Record<PowerKind, Sprite>;
  ball: Sprite;
  pierceBall: Sprite;
}

export function createSprites(): GameSprites {
  const bricks = new Map<string, Sprite>();
  const add = (b: Pick<Brick, 'kind' | 'tint' | 'hp'>, fillAlpha = 0.2) => {
    const color = brickColor(b);
    bricks.set(brickSpriteKey(b), makeSprite(color, BRICK_W, BRICK_H, brickDraw(b.kind, b.hp), withAlpha(color, fillAlpha)));
  };
  for (const tint of Object.keys(TINT_COLORS) as Array<keyof typeof TINT_COLORS>) add({ kind: 'normal', tint, hp: 1 });
  for (const hp of [1, 2]) add({ kind: 'tough', tint: null, hp }, 0.16);
  for (const hp of [1, 2, 3]) add({ kind: 'armor', tint: null, hp }, 0.14);
  add({ kind: 'steel', tint: null, hp: 1 }, 0.35);
  add({ kind: 'bomb', tint: null, hp: 1 }, 0.25);
  add({ kind: 'power', tint: null, hp: 1 }, 0.25);

  const capsules = {} as Record<PowerKind, Sprite>;
  const icons = {} as Record<PowerKind, Sprite>;
  for (const k of POWER_KINDS) {
    const color = POWER_COLORS[k];
    capsules[k] = makeSprite(color, CAPSULE_W, CAPSULE_H, capsuleDraw(k), withAlpha(color, 0.18));
    icons[k] = makeSprite(color, 24, 16, (c) => {
      c.beginPath();
      capsuleIcon(k, c);
    });
  }
  return {
    bricks,
    capsules,
    icons,
    ball: makeSprite(PALETTE.ballGlow, BALL_R * 2, BALL_R * 2, ball, PALETTE.ball),
    pierceBall: makeSprite(PALETTE.pierce, BALL_R * 2, BALL_R * 2, ball, PALETTE.pierceHot),
  };
}
