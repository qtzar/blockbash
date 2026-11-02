export const STORAGE_KEY = 'blockbash.v1';
export const MAX_SCORES = 10;

export interface ScoreEntry {
  initials: string;
  score: number;
  /** Level reached. */
  level: number;
}

export interface SaveData {
  version: 1;
  scores: ScoreEntry[];
  muted: boolean;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const DEFAULT_NAMES = ['NEO', 'ION', 'ZAP', 'VEX', 'ORB', 'HEX', 'LUX', 'RAD', 'BIT', 'ARC'];

export function defaultSave(): SaveData {
  return {
    version: 1,
    scores: DEFAULT_NAMES.map((initials, i) => ({ initials, score: 20_000 - i * 2000, level: Math.max(1, 6 - Math.floor(i / 2)) })),
    muted: false,
  };
}

function isEntry(v: unknown): v is ScoreEntry {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.initials === 'string' && /^[A-Z ]{1,3}$/.test(o.initials) &&
    typeof o.score === 'number' && Number.isInteger(o.score) && o.score >= 0 &&
    typeof o.level === 'number' && Number.isInteger(o.level) && o.level >= 1
  );
}

export function sortScores(scores: readonly ScoreEntry[]): ScoreEntry[] {
  return [...scores].sort((a, b) => b.score - a.score);
}

export function parseSave(raw: string | null): SaveData {
  const d = defaultSave();
  if (!raw) return d;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return d;
  }
  if (!data || typeof data !== 'object') return d;
  const o = data as Record<string, unknown>;
  if (o.version !== 1) return d;
  if (Array.isArray(o.scores)) {
    const valid = sortScores(o.scores.filter(isEntry)).slice(0, MAX_SCORES);
    if (valid.length > 0) d.scores = valid;
  }
  d.muted = o.muted === true;
  return d;
}

export function qualifies(scores: readonly ScoreEntry[], score: number): boolean {
  if (score <= 0) return false;
  if (scores.length < MAX_SCORES) return true;
  return score > scores[scores.length - 1]!.score;
}

export function insertScore(scores: readonly ScoreEntry[], entry: ScoreEntry): { scores: ScoreEntry[]; rank: number } {
  if (!qualifies(scores, entry.score)) return { scores: [...scores], rank: -1 };
  const next = [...scores];
  let i = next.findIndex((e) => entry.score > e.score);
  if (i === -1) i = next.length;
  next.splice(i, 0, entry);
  return { scores: next.slice(0, MAX_SCORES), rank: i };
}

export function loadSave(store: KeyValueStore | null): SaveData {
  try {
    return parseSave(store ? store.getItem(STORAGE_KEY) : null);
  } catch {
    return defaultSave();
  }
}

export function writeSave(store: KeyValueStore | null, data: SaveData): boolean {
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function browserStore(): KeyValueStore | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}
