import { describe, expect, it } from 'vitest';
import {
  defaultSave, insertScore, loadSave, MAX_SCORES, parseSave, qualifies, STORAGE_KEY, writeSave, type KeyValueStore,
} from '../../src/storage/scores';

function memoryStore(): KeyValueStore & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe('scores', () => {
  it('defaults to ten placeholder scores, unmuted', () => {
    const d = defaultSave();
    expect(d.scores).toHaveLength(MAX_SCORES);
    expect(d.scores[0]!.score).toBeGreaterThan(d.scores[9]!.score);
    expect(d.muted).toBe(false);
  });

  it('falls back to defaults on corrupt or foreign data', () => {
    expect(parseSave('not json')).toEqual(defaultSave());
    expect(parseSave(JSON.stringify({ version: 2 }))).toEqual(defaultSave());
  });

  it('drops invalid entries and sorts the rest', () => {
    const raw = JSON.stringify({
      version: 1,
      muted: true,
      scores: [
        { initials: 'AAA', score: 5, level: 1 },
        { initials: 'bad', score: 50, level: 1 },
        { initials: 'BBB', score: 500, level: 2 },
        { initials: 'CCC', score: -1, level: 1 },
      ],
    });
    const d = parseSave(raw);
    expect(d.scores.map((e) => e.initials)).toEqual(['BBB', 'AAA']);
    expect(d.muted).toBe(true);
  });

  it('inserts qualifying scores in rank order and caps the table', () => {
    const table = defaultSave().scores;
    expect(qualifies(table, 0)).toBe(false);
    expect(qualifies(table, table[9]!.score)).toBe(false);
    const { scores, rank } = insertScore(table, { initials: 'TOP', score: 1_000_000, level: 9 });
    expect(rank).toBe(0);
    expect(scores).toHaveLength(MAX_SCORES);
    expect(insertScore(table, { initials: 'LOW', score: 1, level: 1 }).rank).toBe(-1);
  });

  it('round-trips through a store', () => {
    const store = memoryStore();
    const d = { ...defaultSave(), muted: true };
    expect(writeSave(store, d)).toBe(true);
    expect(store.data[STORAGE_KEY]).toBeDefined();
    expect(loadSave(store)).toEqual(d);
    expect(writeSave(null, d)).toBe(false);
  });
});
