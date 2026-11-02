import type { SimEvent } from '../sim/events';
import { FIELD_H, FIELD_W, PADDLE_Y } from '../sim/tuning';
import { VIEW_H, VIEW_W } from './canvas';
import { brickColor, PALETTE, POWER_COLORS, POWER_NAMES } from './palette';

export const MAX_PARTICLES = 2000;
export const SHAKE_MAX = 16;
export const SLOWMO_SCALE = 0.3;
const GRAVITY = 120;

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  drag: number;
  gravity: number;
}

interface Ring { x: number; y: number; maxR: number; life: number; maxLife: number; color: string }
interface Popup { x: number; y: number; text: string; life: number; color: string; size: number }

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * Cosmetic particles, rings, popups, shake, flash, slow motion and hit-stop. Never touches the simulation.
 * Positions are field units; drawWorld is called with the field transform already applied.
 */
export class Effects {
  private particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, color: '#fff', drag: 0, gravity: 0,
  }));
  private next = 0;
  private rings: Ring[] = [];
  private popups: Popup[] = [];
  private trauma = 0;
  private time = 0;
  private slowmo = 0;
  private hitStop = 0;
  flash = 0;
  flashColor = '#ffffff';

  reset(): void {
    for (const p of this.particles) p.active = false;
    this.rings = [];
    this.popups = [];
    this.trauma = 0;
    this.flash = 0;
    this.slowmo = 0;
    this.hitStop = 0;
  }

  activeParticleCount(): number {
    let n = 0;
    for (const p of this.particles) if (p.active) n++;
    return n;
  }

  popupTexts(): string[] {
    return this.popups.map((p) => p.text);
  }

  /** Simulation time scale for the loop: frozen during hit-stop, slowed during slow motion. */
  timeScale(): number {
    if (this.hitStop > 0) return 0;
    return this.slowmo > 0 ? SLOWMO_SCALE : 1;
  }

  addTrauma(v: number): void {
    this.trauma = Math.min(1, this.trauma + v);
  }

  doFlash(color = '#ffffff', strength = 1): void {
    this.flash = Math.max(this.flash, strength);
    this.flashColor = color;
  }

  private spawn(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, drag: number, gravity: number): void {
    const p = this.particles[this.next]!;
    this.next = (this.next + 1) % MAX_PARTICLES;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.color = color;
    p.drag = drag;
    p.gravity = gravity;
  }

  burst(x: number, y: number, color: string, count: number, speed: number, gravity = GRAVITY): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * rand(0.3, 1);
      this.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.35, 0.8), rand(1.5, 3.5), color, 2.5, gravity);
    }
  }

  /** Brick debris: a box of sparks spread over the brick, kicked away from the hit. */
  private shatter(x: number, y: number, color: string): void {
    for (let i = 0; i < 16; i++) {
      const px = x + rand(-20, 20);
      const py = y + rand(-6, 6);
      this.spawn(px, py, (px - x) * rand(4, 9), rand(-160, 40), rand(0.45, 0.9), rand(2, 4), color, 1.5, 520);
    }
    this.burst(x, y, '#ffffff', 5, 200);
  }

  private ring(x: number, y: number, maxR: number, color: string, life: number): void {
    this.rings.push({ x, y, maxR, life, maxLife: life, color });
  }

  popup(x: number, y: number, text: string, color: string, size = 16): void {
    this.popups.push({ x, y, text, life: 1, color, size });
  }

  consume(events: readonly SimEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'brickBreak': {
          const color = brickColor(e);
          this.shatter(e.x, e.y, color);
          this.addTrauma(e.kind === 'bomb' ? 0 : 0.05);
          if (e.mult >= 2) this.popup(e.x, e.y - 6, `+${e.points}`, e.mult >= 4 ? PALETTE.gold : PALETTE.hudValue, 12 + e.mult);
          if (e.last) {
            this.ring(e.x, e.y, 260, color, 0.9);
            this.burst(e.x, e.y, color, 60, 420);
            this.doFlash('#ffffff', 0.55);
            this.slowmo = 1.1;
            this.addTrauma(0.45);
          }
          break;
        }
        case 'brickHit':
          this.burst(e.x, e.y, brickColor(e), 7, 160);
          break;
        case 'steelHit':
          this.burst(e.x, e.y, '#ffffff', 5, 200);
          break;
        case 'bomb':
          this.burst(e.x, e.y, PALETTE.bomb, 40, 380);
          this.burst(e.x, e.y, '#fff3c4', 12, 260);
          this.ring(e.x, e.y, 90, PALETTE.bomb, 0.45);
          this.doFlash(PALETTE.bomb, 0.22);
          this.addTrauma(0.32);
          this.hitStop = Math.max(this.hitStop, 0.04);
          break;
        case 'paddleHit':
          for (let i = 0; i < 8; i++) {
            const a = -Math.PI / 2 + rand(-1.1, 1.1);
            this.spawn(e.x, e.y, Math.cos(a) * rand(80, 200), Math.sin(a) * rand(80, 200), rand(0.2, 0.4), 2, PALETTE.paddle, 3, 0);
          }
          this.ring(e.x, e.y, 26, PALETTE.paddle, 0.25);
          break;
        case 'wallHit':
          this.burst(e.x, e.y, PALETTE.frame, 4, 140, 0);
          break;
        case 'launch':
          this.ring(e.x, e.y, 24, PALETTE.paddle, 0.3);
          break;
        case 'capsuleSpawn':
          this.ring(e.x, e.y, 30, POWER_COLORS[e.kind], 0.35);
          break;
        case 'powerUp':
          this.ring(e.x, PADDLE_Y, 80, POWER_COLORS[e.kind], 0.45);
          this.burst(e.x, PADDLE_Y, POWER_COLORS[e.kind], 18, 260);
          this.popup(e.x, PADDLE_Y - 34, POWER_NAMES[e.kind], POWER_COLORS[e.kind], 18);
          break;
        case 'shieldSave':
          this.ring(e.x, e.y, 70, PALETTE.shield, 0.4);
          this.burst(e.x, e.y, PALETTE.shield, 24, 280);
          this.addTrauma(0.15);
          break;
        case 'ballLost':
          this.burst(e.x, FIELD_H - 4, PALETTE.warn, 30, 320);
          this.addTrauma(0.2);
          break;
        case 'lifeLost':
          this.doFlash(PALETTE.warn, 0.55);
          this.addTrauma(0.5);
          this.slowmo = 0.8;
          break;
        case 'extraLife':
          this.popup(FIELD_W / 2, PADDLE_Y - 70, '1UP', PALETTE.gold, 26);
          this.ring(FIELD_W / 2, PADDLE_Y - 70, 120, PALETTE.gold, 0.6);
          break;
        case 'levelClear':
          this.popup(FIELD_W / 2, FIELD_H / 2 + 70, `BONUS +${e.bonus}`, PALETTE.gold, 22);
          break;
        case 'gameOver':
          this.doFlash(PALETTE.warn, 0.8);
          break;
        default:
          break;
      }
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.2);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.slowmo = Math.max(0, this.slowmo - dt);
    this.hitStop = Math.max(0, this.hitStop - dt);
    const simDt = dt * (this.slowmo > 0 ? SLOWMO_SCALE * 1.6 : 1);
    for (const q of this.particles) {
      if (!q.active) continue;
      q.life -= simDt;
      if (q.life <= 0 || q.y > FIELD_H + 60) {
        q.active = false;
        continue;
      }
      const damp = Math.max(0, 1 - q.drag * simDt);
      q.vx *= damp;
      q.vy = q.vy * damp + q.gravity * simDt;
      q.x += q.vx * simDt;
      q.y += q.vy * simDt;
    }
    for (const r of this.rings) r.life -= simDt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const pop of this.popups) {
      pop.life -= dt;
      pop.y -= 40 * dt;
    }
    this.popups = this.popups.filter((pop) => pop.life > 0);
  }

  shake(): { x: number; y: number } {
    const t = this.trauma * this.trauma;
    if (t === 0) return { x: 0, y: 0 };
    return {
      x: SHAKE_MAX * t * Math.sin(this.time * 91.3),
      y: SHAKE_MAX * t * Math.sin(this.time * 73.7 + 1.3),
    };
  }

  /** Field-space effects. The caller has translated to the field origin. */
  drawWorld(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const q of this.particles) {
      if (!q.active) continue;
      ctx.globalAlpha = q.life / q.maxLife;
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    for (const r of this.rings) {
      const k = 1 - r.life / r.maxLife;
      const rad = Math.max(1, r.maxR * (1 - (1 - k) * (1 - k)));
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = 0.25 * (r.life / r.maxLife);
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = r.life / r.maxLife;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'center';
    for (const pop of this.popups) {
      ctx.globalAlpha = Math.min(1, pop.life * 2);
      ctx.font = `bold ${pop.size}px monospace`;
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
    }
    ctx.restore();
  }

  /** Screen-space flash. */
  drawScreen(ctx: CanvasRenderingContext2D): void {
    if (this.flash <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.flash * 0.7;
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();
  }
}
