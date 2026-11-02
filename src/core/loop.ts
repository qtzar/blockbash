export const MAX_FRAME_DT = 0.25;
const EPS = 1e-9;

export function advanceAccumulator(
  acc: number,
  frameDt: number,
  simDt: number,
  timeScale = 1,
): { steps: number; acc: number } {
  const clamped = Math.min(Math.max(frameDt, 0), MAX_FRAME_DT);
  let a = acc + clamped * timeScale;
  let steps = 0;
  while (a >= simDt - EPS) {
    a -= simDt;
    steps++;
  }
  return { steps, acc: a };
}

export interface LoopCallbacks {
  step(dt: number): void;
  /** alpha: 0..1 fraction of the next sim step elapsed, for interpolation. */
  render(alpha: number, frameDt: number): void;
  timeScale?(): number;
}

export function startLoop(cb: LoopCallbacks, simDt: number): () => void {
  let acc = 0;
  let last = performance.now();
  let raf = 0;
  let running = true;
  const frame = (now: number) => {
    if (!running) return;
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME_DT);
    last = now;
    const r = advanceAccumulator(acc, frameDt, simDt, cb.timeScale ? cb.timeScale() : 1);
    acc = r.acc;
    for (let i = 0; i < r.steps; i++) cb.step(simDt);
    cb.render(Math.max(0, acc) / simDt, frameDt);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    running = false;
    cancelAnimationFrame(raf);
  };
}
