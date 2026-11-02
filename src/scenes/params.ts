export interface Params {
  /** Start level for a new game. */
  level: number;
  /** Fixed seed, or null for a random one each game. */
  seed: number | null;
  /** The floor bounces balls back. */
  god: boolean;
}

/** Playtest switches: ?level=7, ?seed=42, ?god. */
export function parseParams(search: string): Params {
  const q = new URLSearchParams(search);
  const int = (key: string): number | null => {
    const v = q.get(key);
    if (v === null || !/^\d+$/.test(v)) return null;
    return Number(v);
  };
  const level = int('level');
  return {
    level: level !== null && level >= 1 && level <= 999 ? level : 1,
    seed: int('seed'),
    god: q.has('god'),
  };
}
