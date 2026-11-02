/** Seeded RNG state. Plain data so it can live inside RunState. */
export interface Rng {
  state: number;
}

export function createRng(seed: number): Rng {
  return { state: seed >>> 0 };
}

/** mulberry32: returns a float in [0, 1) and advances the state. */
export function nextFloat(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function range(rng: Rng, min: number, max: number): number {
  return min + (max - min) * nextFloat(rng);
}

export function intRange(rng: Rng, min: number, maxExclusive: number): number {
  return Math.floor(range(rng, min, maxExclusive));
}

export function chance(rng: Rng, p: number): boolean {
  return nextFloat(rng) < p;
}

/** 32-bit FNV-1a hash of a string, returned as an unsigned integer. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
