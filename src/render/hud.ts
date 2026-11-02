import { multiplier } from '../sim/state';
import { COMBO_STEP, MAX_MULT, POWER_DURATION, POWER_KINDS, TIMED_POWERS } from '../sim/tuning';
import type { RunState } from '../sim/types';
import type { ScoreEntry } from '../storage/scores';
import { VIEW_H } from './canvas';
import { LEFT_PANEL_X, RIGHT_PANEL_X } from './layout';
import { PALETTE, POWER_COLORS, POWER_NAMES, withAlpha } from './palette';
import { drawSprite, type GameSprites } from './sprites';

export interface HudInfo {
  hiScore: number;
  scores: readonly ScoreEntry[];
  muted: boolean;
  /** Show score/lives (false on the title, where the demo plays). */
  showRun: boolean;
}

const PANEL_W = 264;

export const CONTROLS = [
  'MOUSE / TOUCH   MOVE',
  'ARROWS / A D    MOVE',
  'CLICK / SPACE   LAUNCH + FIRE',
  'P / ESC         PAUSE',
  'M               MUTE',
];

function label(ctx: CanvasRenderingContext2D, s: string, x: number, y: number): void {
  ctx.font = '11px monospace';
  ctx.fillStyle = PALETTE.hudLabel;
  ctx.fillText(s, x, y);
}

function value(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string = PALETTE.hudValue): void {
  ctx.font = `bold ${size}px monospace`;
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function divider(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = withAlpha(PALETTE.hudLabel, 0.25);
  ctx.fillRect(x, y, PANEL_W, 1);
}

function meter(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, color: string): void {
  ctx.fillStyle = withAlpha(color, 0.18);
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), 4);
}

/** A tiny paddle icon for the lives row. */
function lifeIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = withAlpha(PALETTE.paddle, 0.25);
  ctx.fillRect(x, y, 26, 7);
  ctx.strokeStyle = PALETTE.paddle;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, 26, 7);
}

export function drawHud(ctx: CanvasRenderingContext2D, s: RunState, info: HudInfo, sprites: GameSprites, time: number): void {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if (info.showRun) drawLeft(ctx, s, info, sprites, time);
  drawRight(ctx, info, sprites);
  ctx.restore();
}

function drawLeft(ctx: CanvasRenderingContext2D, s: RunState, info: HudInfo, sprites: GameSprites, time: number): void {
  const x = LEFT_PANEL_X;
  let y = 76;
  label(ctx, 'SCORE', x, y);
  value(ctx, String(s.score).padStart(8, '0'), x, y + 28, 28);
  y += 56;
  label(ctx, 'HIGH', x, y);
  value(ctx, String(Math.max(info.hiScore, s.score)).padStart(8, '0'), x, y + 20, 18, PALETTE.gold);
  y += 44;
  divider(ctx, x, y);
  y += 26;

  label(ctx, 'LEVEL', x, y);
  value(ctx, String(s.level).padStart(2, '0'), x, y + 28, 28, PALETTE.paddle);
  ctx.font = '13px monospace';
  ctx.fillStyle = PALETTE.hudValue;
  ctx.fillText(s.levelName, x + 52, y + 26);
  y += 56;

  label(ctx, 'LIVES', x, y);
  for (let i = 0; i < Math.min(s.lives, 9); i++) lifeIcon(ctx, x + (i % 5) * 34, y + 12 + Math.floor(i / 5) * 14);
  y += s.lives > 5 ? 52 : 38;
  divider(ctx, x, y);
  y += 26;

  const mult = multiplier(s.combo);
  label(ctx, 'COMBO', x, y);
  const hot = mult >= 4;
  const pulse = hot ? 0.75 + 0.25 * Math.sin(time * 10) : 1;
  ctx.globalAlpha = pulse;
  value(ctx, `x${mult}`, x, y + 32, 34, mult > 1 ? PALETTE.gold : PALETTE.hudLabel);
  ctx.globalAlpha = 1;
  ctx.font = '13px monospace';
  ctx.fillStyle = PALETTE.hudValue;
  ctx.fillText(`${s.combo} HITS`, x + 78, y + 28);
  meter(ctx, x, y + 42, PANEL_W, mult >= MAX_MULT ? 1 : (s.combo % COMBO_STEP) / COMBO_STEP, PALETTE.gold);
  y += 70;
  divider(ctx, x, y);
  y += 26;

  label(ctx, 'POWER', x, y);
  y += 10;
  let any = false;
  for (const k of TIMED_POWERS) {
    const t = s.timers[k];
    if (t <= 0) continue;
    any = true;
    const color = POWER_COLORS[k];
    drawSprite(ctx, sprites.icons[k], x + 12, y + 12, 1, 0.8);
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = color;
    ctx.fillText(POWER_NAMES[k], x + 32, y + 12);
    const warn = t < 2 && Math.floor(time * 6) % 2 === 0;
    meter(ctx, x + 32, y + 18, PANEL_W - 32, t / POWER_DURATION[k], warn ? PALETTE.warn : color);
    y += 30;
  }
  if (s.shield) {
    any = true;
    drawSprite(ctx, sprites.icons.shield, x + 12, y + 12, 1, 0.8);
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = PALETTE.shield;
    ctx.fillText('SHIELD READY', x + 32, y + 16);
    y += 30;
  }
  if (!any) {
    ctx.font = '12px monospace';
    ctx.fillStyle = withAlpha(PALETTE.hudLabel, 0.5);
    ctx.fillText('NONE', x, y + 16);
  }
}

function drawRight(ctx: CanvasRenderingContext2D, info: HudInfo, sprites: GameSprites): void {
  const x = RIGHT_PANEL_X;
  let y = 76;
  label(ctx, 'TOP SCORES', x, y);
  y += 8;
  info.scores.slice(0, 5).forEach((e, i) => {
    ctx.font = '14px monospace';
    ctx.fillStyle = i === 0 ? PALETTE.gold : PALETTE.hudValue;
    ctx.fillText(`${i + 1}. ${e.initials.padEnd(3, ' ')} ${String(e.score).padStart(8, '0')}  L${String(e.level).padStart(2, '0')}`, x, y + 18 + i * 20);
  });
  y += 120;
  divider(ctx, x, y);
  y += 26;

  label(ctx, 'CAPSULES', x, y);
  y += 8;
  POWER_KINDS.forEach((k, i) => {
    const cx = x + (i % 2) * 132;
    const cy = y + 16 + Math.floor(i / 2) * 26;
    drawSprite(ctx, sprites.icons[k], cx + 12, cy, 1, 0.8);
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = POWER_COLORS[k];
    ctx.fillText(POWER_NAMES[k], cx + 30, cy + 4);
  });
  y += 4 * 26 + 24;
  divider(ctx, x, y);
  y += 26;

  label(ctx, 'CONTROLS', x, y);
  CONTROLS.forEach((line, i) => {
    ctx.font = '11px monospace';
    ctx.fillStyle = PALETTE.hudValue;
    ctx.fillText(line, x, y + 20 + i * 17);
  });
  y += 20 + CONTROLS.length * 17 + 6;
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = info.muted ? PALETTE.warn : PALETTE.good;
  ctx.fillText(info.muted ? 'SOUND OFF' : 'SOUND ON', x, Math.min(y + 8, VIEW_H - 20));
}
