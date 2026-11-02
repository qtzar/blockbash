import type { SimEvent } from '../sim/events';
import { BOLT_LEN, BRICK_H, BRICK_W, FIELD_H, FIELD_W, PADDLE_H, PADDLE_Y, SHIELD_Y } from '../sim/tuning';
import type { RunState } from '../sim/types';
import { brickCentre } from '../sim/state';
import { Background } from './background';
import type { View } from './canvas';
import { Effects } from './effects';
import { drawHud, type HudInfo } from './hud';
import { FIELD_X, FIELD_Y } from './layout';
import { PALETTE, POWER_COLORS, withAlpha } from './palette';
import { brickSpriteKey, createSprites, drawSprite, roundRect, type GameSprites } from './sprites';
import { blink, glowText } from './text';

const TRAIL_LEN = 12;
const FLASH_TIME = 0.15;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);

export class Renderer {
  readonly effects = new Effects();
  readonly sprites: GameSprites = createSprites();
  private background = new Background();
  private trails = new Map<number, Array<{ x: number; y: number }>>();
  private flashes = new Map<number, number>();
  private time = 0;

  constructor(private view: View) {}

  reset(): void {
    this.effects.reset();
    this.trails.clear();
    this.flashes.clear();
  }

  frame(state: RunState, events: readonly SimEvent[], dt: number, info: HudInfo): void {
    this.time += dt;
    this.effects.consume(events);
    for (const e of events) {
      if (e.type === 'brickHit' || e.type === 'steelHit') this.flashes.set(e.row * 100 + e.col, FLASH_TIME);
    }
    for (const [k, t] of this.flashes) {
      if (t - dt <= 0) this.flashes.delete(k);
      else this.flashes.set(k, t - dt);
    }
    this.effects.update(dt);
    if (dt > 0 && state.timers.pierce > 0) {
      for (const b of state.balls) if (!b.stuck) this.effects.burst(b.x, b.y, PALETTE.pierce, 2, 50, -60);
    }
    this.updateTrails(state, dt);

    const ctx = this.view.beginFrame();
    const danger = info.showRun && state.lives <= 1 && state.phase !== 'over' ? 1 : 0;
    this.background.draw(ctx, this.time, danger);
    drawHud(ctx, state, info, this.sprites, this.time);

    const sh = this.effects.shake();
    ctx.save();
    ctx.translate(FIELD_X + sh.x, FIELD_Y + sh.y);
    ctx.beginPath();
    ctx.rect(-2, -2, FIELD_W + 4, FIELD_H + 30);
    ctx.clip();
    this.drawBricks(ctx, state);
    if (state.shield) this.drawShield(ctx);
    for (const c of state.capsules) {
      drawSprite(ctx, this.sprites.capsules[c.kind], c.x, c.y, 1, 1 + 0.06 * Math.sin(this.time * 8 + c.id));
    }
    this.drawBolts(ctx, state);
    if (state.phase !== 'over') this.drawPaddle(ctx, state);
    this.drawBalls(ctx, state);
    this.effects.drawWorld(ctx);
    if (info.showRun) this.drawBanners(ctx, state);
    ctx.restore();

    this.effects.drawScreen(ctx);
    this.view.endFrame();
  }

  private updateTrails(state: RunState, dt: number): void {
    const live = new Set<number>();
    for (const b of state.balls) {
      live.add(b.id);
      let t = this.trails.get(b.id);
      if (!t) {
        t = [];
        this.trails.set(b.id, t);
      }
      if (b.stuck) {
        t.length = 0;
        continue;
      }
      if (dt > 0) {
        t.push({ x: b.x, y: b.y });
        if (t.length > TRAIL_LEN) t.shift();
      }
    }
    for (const id of this.trails.keys()) if (!live.has(id)) this.trails.delete(id);
  }

  private drawBricks(ctx: CanvasRenderingContext2D, s: RunState): void {
    for (const b of s.grid) {
      if (!b) continue;
      const sprite = this.sprites.bricks.get(brickSpriteKey(b));
      if (!sprite) continue;
      const c = brickCentre(b);
      // Bricks drop into place at the start of a level, staggered by row and column.
      const t = easeOut(clamp01((s.levelTime - b.row * 0.035 - Math.abs(b.col - 6) * 0.02) / 0.45));
      let alpha = t;
      if (b.kind === 'power') alpha *= 0.75 + 0.25 * Math.sin(this.time * 5 + b.col);
      drawSprite(ctx, sprite, c.x, c.y - (1 - t) * 50, alpha);
      const flash = this.flashes.get(b.row * 100 + b.col);
      if (flash) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = flash / FLASH_TIME;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(c.x - BRICK_W / 2 + 3, c.y - BRICK_H / 2 + 3, BRICK_W - 6, BRICK_H - 6);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  private drawShield(ctx: CanvasRenderingContext2D): void {
    const pulse = 0.7 + 0.3 * Math.sin(this.time * 5);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = PALETTE.shield;
    ctx.beginPath();
    ctx.moveTo(0, SHIELD_Y);
    ctx.lineTo(FIELD_W, SHIELD_Y);
    ctx.globalAlpha = 0.2 * pulse;
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.globalAlpha = pulse;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  private drawBolts(ctx: CanvasRenderingContext2D, s: RunState): void {
    if (s.bolts.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = PALETTE.bolt;
    ctx.lineCap = 'round';
    for (const [w, a] of [[6, 0.3], [2, 1]] as const) {
      ctx.lineWidth = w;
      ctx.globalAlpha = a;
      ctx.beginPath();
      for (const b of s.bolts) {
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x, b.y + BOLT_LEN);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPaddle(ctx: CanvasRenderingContext2D, s: RunState): void {
    const p = s.paddle;
    const x0 = p.x - p.w / 2;
    const flicker = s.phase === 'lost' ? (blink(this.time, 10) ? 0.25 : 0.8) : 1;
    ctx.save();
    ctx.globalAlpha = flicker;
    ctx.lineJoin = 'round';

    if (s.timers.magnet > 0) {
      // Magnetic field: faint arcs above the paddle.
      ctx.strokeStyle = POWER_COLORS.magnet;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const k = (this.time * 1.5 + i / 3) % 1;
        ctx.globalAlpha = flicker * 0.5 * (1 - k);
        ctx.beginPath();
        ctx.ellipse(p.x, PADDLE_Y, p.w / 2 + 4, 6 + k * 26, 0, Math.PI, 0);
        ctx.stroke();
      }
      ctx.globalAlpha = flicker;
    }
    if (s.timers.blaster > 0) {
      ctx.fillStyle = POWER_COLORS.blaster;
      for (const dx of [-(p.w / 2 - 10), p.w / 2 - 10]) {
        ctx.fillRect(p.x + dx - 2.5, PADDLE_Y - 7, 5, 8);
      }
    }

    const body = () => {
      ctx.beginPath();
      roundRect(ctx, x0, PADDLE_Y, p.w, PADDLE_H, PADDLE_H / 2);
    };
    ctx.fillStyle = withAlpha(PALETTE.paddle, 0.2);
    body();
    ctx.fill();
    ctx.strokeStyle = PALETTE.paddle;
    ctx.globalAlpha = 0.22 * flicker;
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.globalAlpha = flicker;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Inner core line and end caps.
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0 + 12, PADDLE_Y + PADDLE_H / 2);
    ctx.lineTo(x0 + p.w - 12, PADDLE_Y + PADDLE_H / 2);
    ctx.stroke();
    const capColor = s.timers.magnet > 0 ? POWER_COLORS.magnet : PALETTE.gold;
    ctx.fillStyle = capColor;
    ctx.fillRect(x0 + 5, PADDLE_Y + 4, 3, PADDLE_H - 8);
    ctx.fillRect(x0 + p.w - 8, PADDLE_Y + 4, 3, PADDLE_H - 8);
    ctx.restore();
  }

  private drawBalls(ctx: CanvasRenderingContext2D, s: RunState): void {
    const pierce = s.timers.pierce > 0;
    const color = pierce ? PALETTE.pierce : PALETTE.ballGlow;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    for (const t of this.trails.values()) {
      for (let i = 1; i < t.length; i++) {
        const k = i / t.length;
        ctx.globalAlpha = 0.35 * k;
        ctx.lineWidth = 11 * k;
        ctx.beginPath();
        ctx.moveTo(t[i - 1]!.x, t[i - 1]!.y);
        ctx.lineTo(t[i]!.x, t[i]!.y);
        ctx.stroke();
      }
    }
    ctx.restore();
    const sprite = pierce ? this.sprites.pierceBall : this.sprites.ball;
    for (const b of s.balls) drawSprite(ctx, sprite, b.x, b.y);
  }

  private drawBanners(ctx: CanvasRenderingContext2D, s: RunState): void {
    const cx = FIELD_W / 2;
    const stuck = s.balls.some((b) => b.stuck);
    if (s.phase === 'play' && s.levelTime < 2.6) {
      const a = clamp01(Math.min(s.levelTime / 0.3, (2.6 - s.levelTime) / 0.5));
      glowText(ctx, `LEVEL ${s.level}`, cx, FIELD_H * 0.62, 54, PALETTE.paddle, a);
      glowText(ctx, s.levelName, cx, FIELD_H * 0.62 + 40, 22, PALETTE.hudValue, a);
    }
    if (s.phase === 'play' && stuck && s.levelTime > 0.8 && s.timers.magnet <= 0 && blink(s.time)) {
      glowText(ctx, 'CLICK / SPACE TO LAUNCH', cx, PADDLE_Y - 46, 15, PALETTE.hudValue);
    }
    if (s.phase === 'clear' && s.phaseTime > 0.4) {
      const a = clamp01((s.phaseTime - 0.4) / 0.3);
      glowText(ctx, 'LEVEL CLEAR', cx, FIELD_H / 2, 58, PALETTE.gold, a);
    }
    if (s.god) {
      // ?god playtest switch: make the bouncing floor visible so it is never mistaken for a bug.
      ctx.save();
      ctx.strokeStyle = PALETTE.warn;
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(this.time * 4);
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, FIELD_H - 1);
      ctx.lineTo(FIELD_W, FIELD_H - 1);
      ctx.stroke();
      ctx.restore();
      glowText(ctx, 'GOD MODE (?god): FLOOR BOUNCES', cx, FIELD_H - 10, 12, PALETTE.warn, 0.8);
    }
    if (s.phase === 'lost') {
      glowText(ctx, s.lives === 1 ? 'LAST LIFE' : `${s.lives} LIVES LEFT`, cx, FIELD_H * 0.6, 34, PALETTE.warn, clamp01(s.phaseTime / 0.3));
    }
  }
}
