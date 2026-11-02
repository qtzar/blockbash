/** Glowing title text: two wide faint strokes under a solid fill (style guide "Glowing title text"). */
export function glowText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha = 1,
): void {
  ctx.save();
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.2 * alpha;
  ctx.lineWidth = size / 5;
  ctx.strokeText(text, x, y);
  ctx.globalAlpha = 0.4 * alpha;
  ctx.lineWidth = size / 10;
  ctx.strokeText(text, x, y);
  ctx.globalAlpha = alpha;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export const blink = (time: number, rate = 2): boolean => Math.floor(time * rate) % 2 === 0;
