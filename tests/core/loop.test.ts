import { describe, it, expect } from 'vitest';
import { advanceAccumulator, MAX_FRAME_DT } from '../../src/core/loop';

const SIM = 1 / 120;

describe('advanceAccumulator', () => {
  it('runs two sim steps for a 60 Hz frame', () => {
    const r = advanceAccumulator(0, 1 / 60, SIM);
    expect(r.steps).toBe(2);
    expect(Math.abs(r.acc)).toBeLessThan(1e-6);
  });

  it('carries the remainder between frames', () => {
    const r1 = advanceAccumulator(0, 1 / 144, SIM);
    expect(r1.steps).toBe(0);
    const r2 = advanceAccumulator(r1.acc, 1 / 144, SIM);
    expect(r2.steps).toBe(1);
  });

  it('clamps huge frame times', () => {
    const r = advanceAccumulator(0, 5, SIM);
    expect(r.steps).toBe(Math.round(MAX_FRAME_DT / SIM));
  });

  it('applies a time scale', () => {
    expect(advanceAccumulator(0, 1 / 60, SIM, 0.5).steps).toBe(1);
  });

  it('ignores negative frame times', () => {
    expect(advanceAccumulator(0, -1, SIM).steps).toBe(0);
  });
});
