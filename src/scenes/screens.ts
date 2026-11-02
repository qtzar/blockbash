import { VIEW_H, VIEW_W } from '../render/canvas';
import { FIELD_CX, FIELD_X, FIELD_Y, LEFT_PANEL_X } from '../render/layout';
import { PALETTE, TINT_COLORS } from '../render/palette';
import { brickSpriteKey, drawSprite, type GameSprites } from '../render/sprites';
import { blink, glowText } from '../render/text';
import { FIELD_H, FIELD_W } from '../sim/tuning';
import type { RunState } from '../sim/types';

export const INITIAL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';

/** Cycles a letter in the initials entry through A–Z and space. */
export function cycleChar(ch: string, delta: number): string {
  const i = INITIAL_CHARS.indexOf(ch);
  const n = INITIAL_CHARS.length;
  return INITIAL_CHARS[((((i < 0 ? 0 : i) + delta) % n) + n) % n]!;
}

function dimField(ctx: CanvasRenderingContext2D, alpha: number): void {
  ctx.save();
  ctx.fillStyle = `rgba(0,0,10,${alpha})`;
  ctx.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
  ctx.restore();
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'center'): void {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(s, x, y);
  ctx.restore();
}

const BRICK_LEGEND: ReadonlyArray<{ key: Parameters<typeof brickSpriteKey>[0]; name: string; note: string }> = [
  { key: { kind: 'normal', tint: 'r', hp: 1 }, name: 'COLOUR', note: '1 HIT' },
  { key: { kind: 'tough', tint: null, hp: 2 }, name: 'TOUGH', note: '2 HITS' },
  { key: { kind: 'armor', tint: null, hp: 3 }, name: 'ARMOUR', note: '3 HITS' },
  { key: { kind: 'steel', tint: null, hp: 1 }, name: 'STEEL', note: 'UNBREAKABLE' },
  { key: { kind: 'bomb', tint: null, hp: 1 }, name: 'BOMB', note: 'BLASTS NEIGHBOURS' },
  { key: { kind: 'power', tint: null, hp: 1 }, name: 'POWER', note: 'ALWAYS DROPS' },
];

export function drawTitle(ctx: CanvasRenderingContext2D, time: number, sprites: GameSprites): void {
  dimField(ctx, 0.55);
  // Title letters cycle through the brick colours.
  const word = 'BLOCKBASH';
  const tints = Object.values(TINT_COLORS);
  const size = 80;
  const step = size * 0.62;
  const x0 = FIELD_CX - ((word.length - 1) * step) / 2;
  [...word].forEach((ch, i) => {
    const bob = Math.sin(time * 2.2 + i * 0.5) * 5;
    glowText(ctx, ch, x0 + i * step, 250 + bob, size, tints[(i + Math.floor(time * 1.5)) % tints.length]!);
  });
  text(ctx, 'A  NEON  BRICK  BREAKER', FIELD_CX, 296, '15px monospace', PALETTE.hudLabel);
  if (blink(time)) glowText(ctx, 'CLICK OR PRESS SPACE TO PLAY', FIELD_CX, 420, 22, PALETTE.hudValue);
  text(ctx, 'BUILD COMBOS BY KEEPING THE BALL OFF THE PADDLE', FIELD_CX, 470, '12px monospace', PALETTE.gold);

  // Left panel: brick guide.
  let y = 76;
  text(ctx, 'BRICKS', LEFT_PANEL_X, y, '11px monospace', PALETTE.hudLabel, 'left');
  y += 30;
  for (const b of BRICK_LEGEND) {
    const sprite = sprites.bricks.get(brickSpriteKey(b.key));
    if (sprite) drawSprite(ctx, sprite, LEFT_PANEL_X + 24, y - 4);
    text(ctx, b.name, LEFT_PANEL_X + 62, y - 4, 'bold 13px monospace', PALETTE.hudValue, 'left');
    text(ctx, b.note, LEFT_PANEL_X + 62, y + 10, '11px monospace', PALETTE.hudLabel, 'left');
    y += 42;
  }
  y += 12;
  text(ctx, 'EXTRA LIFE EVERY 20000', LEFT_PANEL_X, y, '12px monospace', PALETTE.gold, 'left');
  text(ctx, 'ENDLESS LEVELS AFTER 12', LEFT_PANEL_X, y + 20, '12px monospace', PALETTE.hudLabel, 'left');
}

export function drawPaused(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,10,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.restore();
  glowText(ctx, 'PAUSED', FIELD_CX, 340, 64, PALETTE.paddle);
  glowText(ctx, 'P / CLICK / START TO RESUME', FIELD_CX, 395, 18, PALETTE.hudValue);
  glowText(ctx, 'ESC TO QUIT', FIELD_CX, 425, 18, PALETTE.hudLabel);
}

export function drawGameOver(ctx: CanvasRenderingContext2D, run: RunState, rank: number, time: number): void {
  dimField(ctx, 0.6);
  glowText(ctx, 'GAME OVER', FIELD_CX, 250, 76, PALETTE.warn);
  glowText(ctx, `SCORE  ${String(run.score).padStart(8, '0')}`, FIELD_CX, 330, 26, PALETTE.gold);
  glowText(ctx, `LEVEL ${run.level}  ${run.levelName}`, FIELD_CX, 370, 20, PALETTE.hudValue);
  glowText(ctx, `BEST COMBO  ${run.bestCombo}`, FIELD_CX, 402, 20, PALETTE.hudValue);
  if (rank === 0 && blink(time)) glowText(ctx, 'NEW HIGH SCORE!', FIELD_CX, 460, 36, PALETTE.gold);
  else if (rank > 0) glowText(ctx, `RANKED #${rank + 1}`, FIELD_CX, 460, 28, PALETTE.good);
  if (blink(time, 1.5)) text(ctx, 'CLICK OR PRESS SPACE', FIELD_CX, 520, '14px monospace', PALETTE.hudLabel);
}

export function drawInitials(ctx: CanvasRenderingContext2D, letters: readonly string[], cursor: number, score: number, time: number): void {
  dimField(ctx, 0.7);
  glowText(ctx, 'HIGH SCORE', FIELD_CX, 220, 56, PALETTE.gold);
  glowText(ctx, String(score).padStart(8, '0'), FIELD_CX, 276, 30, PALETTE.hudValue);
  text(ctx, 'ENTER YOUR INITIALS', FIELD_CX, 330, '14px monospace', PALETTE.hudLabel);
  letters.forEach((ch, i) => {
    const x = FIELD_CX + (i - 1) * 80;
    glowText(ctx, ch === ' ' ? '_' : ch, x, 410, 64, i === cursor ? PALETTE.paddle : PALETTE.hudLabel);
    if (i === cursor && blink(time, 3)) {
      ctx.fillStyle = PALETTE.paddle;
      ctx.fillRect(x - 24, 428, 48, 4);
    }
  });
  text(ctx, 'UP/DOWN LETTER   LEFT/RIGHT MOVE   SPACE NEXT', FIELD_CX, 490, '13px monospace', PALETTE.hudLabel);
}
