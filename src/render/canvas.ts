/** Fixed internal resolution in game units. */
export const VIEW_W = 1280;
export const VIEW_H = 720;

export function computeLetterbox(cssW: number, cssH: number): { scale: number; offsetX: number; offsetY: number } {
  const scale = Math.min(cssW / VIEW_W, cssH / VIEW_H);
  return {
    scale,
    offsetX: (cssW - VIEW_W * scale) / 2,
    offsetY: (cssH - VIEW_H * scale) / 2,
  };
}

export interface View {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Clears the canvas and returns a context transformed to 1280×720 game units, clipped to the game area. */
  beginFrame(): CanvasRenderingContext2D;
  endFrame(): void;
  /** Converts a client (CSS pixel) position to game units. */
  toGame(clientX: number, clientY: number): { x: number; y: number };
}

export function createView(canvas: HTMLCanvasElement): View {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported in this browser');
  let dpr = 1;
  let box = computeLetterbox(VIEW_W, VIEW_H);

  const resize = () => {
    dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    box = computeLetterbox(w, h);
  };
  resize();
  window.addEventListener('resize', resize);

  return {
    canvas,
    ctx,
    beginFrame() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const k = box.scale * dpr;
      ctx.setTransform(k, 0, 0, k, box.offsetX * dpr, box.offsetY * dpr);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, VIEW_W, VIEW_H);
      ctx.clip();
      return ctx;
    },
    endFrame() {
      ctx.restore();
    },
    toGame(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      return { x: (clientX - r.left - box.offsetX) / box.scale, y: (clientY - r.top - box.offsetY) / box.scale };
    },
  };
}
