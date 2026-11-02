import { FIELD_H, FIELD_W } from '../sim/tuning';
import { VIEW_H, VIEW_W } from './canvas';
import { FIELD_X, FIELD_Y } from './layout';
import { PALETTE, withAlpha } from './palette';

interface Star { x: number; y: number; a: number }

const LAYERS = [
  { count: 140, size: 1, speed: 6 },
  { count: 80, size: 1.5, speed: 12 },
  { count: 45, size: 2, speed: 20 },
];

/** Sky, nebula, drifting starfield, a synthwave floor grid and the framed playfield. */
export class Background {
  private stars: Star[][] = LAYERS.map((l) =>
    Array.from({ length: l.count }, () => ({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H, a: 0.3 + Math.random() * 0.7 })),
  );

  draw(ctx: CanvasRenderingContext2D, time: number, danger: number): void {
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    sky.addColorStop(0, mix(PALETTE.skyTop, '#1a0005', danger));
    sky.addColorStop(1, mix(PALETTE.skyBottom, '#3a0010', danger));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const neb = ctx.createRadialGradient(VIEW_W * 0.3, VIEW_H * 0.35, 0, VIEW_W * 0.3, VIEW_H * 0.35, VIEW_W * 0.6);
    neb.addColorStop(0, danger > 0.5 ? 'rgba(255,40,80,0.12)' : 'rgba(120,60,255,0.10)');
    neb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    LAYERS.forEach((l, i) => {
      ctx.fillStyle = '#ffffff';
      for (const s of this.stars[i]!) {
        const y = (s.y + time * l.speed) % VIEW_H;
        ctx.globalAlpha = s.a * (0.75 + 0.25 * Math.sin(time * 2 + s.x));
        ctx.fillRect(s.x, y, l.size, l.size);
      }
    });
    ctx.globalAlpha = 1;

    this.drawFloor(ctx, time, danger);
    this.drawField(ctx, time, danger);
  }

  /** Perspective grid along the bottom of the screen, scrolling toward the viewer. */
  private drawFloor(ctx: CanvasRenderingContext2D, time: number, danger: number): void {
    const horizon = VIEW_H * 0.62;
    const color = danger > 0.5 ? PALETTE.frameDanger : '#ff4fd8';
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = withAlpha(color, 0.18);
    ctx.beginPath();
    const vx = VIEW_W / 2;
    for (let i = -16; i <= 16; i++) {
      ctx.moveTo(vx + i * 12, horizon);
      ctx.lineTo(vx + i * 160, VIEW_H);
    }
    const phase = (time * 0.35) % 1;
    for (let k = 0; k < 10; k++) {
      const t = (k + phase) / 10;
      const y = horizon + (VIEW_H - horizon) * t * t;
      ctx.moveTo(0, y);
      ctx.lineTo(VIEW_W, y);
    }
    ctx.stroke();
    const fade = ctx.createLinearGradient(0, horizon - 2, 0, horizon + 60);
    fade.addColorStop(0, 'rgba(10,6,48,1)');
    fade.addColorStop(1, 'rgba(10,6,48,0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, horizon - 2, VIEW_W, 62);
    ctx.restore();
  }

  private drawField(ctx: CanvasRenderingContext2D, time: number, danger: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(2,3,16,0.88)';
    ctx.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
    // Faint inner grid so the field reads as a surface.
    ctx.strokeStyle = 'rgba(61,123,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 40; x < FIELD_W; x += 40) {
      ctx.moveTo(FIELD_X + x, FIELD_Y);
      ctx.lineTo(FIELD_X + x, FIELD_Y + FIELD_H);
    }
    for (let y = 40; y < FIELD_H; y += 40) {
      ctx.moveTo(FIELD_X, FIELD_Y + y);
      ctx.lineTo(FIELD_X + FIELD_W, FIELD_Y + y);
    }
    ctx.stroke();

    // Frame: open at the bottom, wide-faint + thin-bright double stroke.
    const pulse = danger > 0.5 ? 0.6 + 0.4 * Math.sin(time * 6) : 1;
    const color = danger > 0.5 ? PALETTE.frameDanger : PALETTE.frame;
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(FIELD_X - 3, FIELD_Y + FIELD_H);
      ctx.lineTo(FIELD_X - 3, FIELD_Y - 3);
      ctx.lineTo(FIELD_X + FIELD_W + 3, FIELD_Y - 3);
      ctx.lineTo(FIELD_X + FIELD_W + 3, FIELD_Y + FIELD_H);
    };
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.2 * pulse;
    ctx.lineWidth = 9;
    path();
    ctx.stroke();
    ctx.globalAlpha = pulse;
    ctx.lineWidth = 2;
    path();
    ctx.stroke();
    // Corner posts
    ctx.fillStyle = color;
    for (const [x, y] of [[FIELD_X - 3, FIELD_Y - 3], [FIELD_X + FIELD_W + 3, FIELD_Y - 3]] as const) {
      ctx.fillRect(x - 4, y - 4, 8, 8);
    }
    ctx.restore();
  }
}

/** Linear mix of two '#rrggbb' colours. */
function mix(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
