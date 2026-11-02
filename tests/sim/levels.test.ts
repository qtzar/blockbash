import { describe, expect, it } from 'vitest';
import { generateLevel, LEVELS, levelDef, parseLevel, validateLevel } from '../../src/sim/levels';
import { COLS } from '../../src/sim/tuning';

describe('levels', () => {
  it.each(LEVELS.map((l, i) => [i + 1, l.name, l] as const))('level %i %s is valid', (_n, _name, l) => {
    expect(validateLevel(l.map)).toEqual([]);
  });

  it('generates valid, deterministic levels forever', () => {
    for (let n = LEVELS.length + 1; n <= LEVELS.length + 80; n++) {
      const a = generateLevel(n);
      expect(validateLevel(a.map), `level ${n}`).toEqual([]);
      expect(generateLevel(n)).toEqual(a);
    }
  });

  it('uses hand-made levels first', () => {
    expect(levelDef(1).name).toBe(LEVELS[0]!.name);
    expect(levelDef(LEVELS.length + 1).name).not.toBe('');
  });

  it('rejects bad widths and unknown characters', () => {
    expect(validateLevel(['rrr'])).not.toEqual([]);
    expect(validateLevel(['r'.repeat(COLS - 1) + 'X'])).not.toEqual([]);
  });

  it('rejects bricks sealed in by steel', () => {
    const errors = validateLevel([
      '.............',
      '.###.........',
      '.#r#.........',
      '.###.........',
      'g............',
    ]);
    expect(errors.some((e) => e.includes('sealed'))).toBe(true);
  });

  it('rejects maps with nothing to break', () => {
    expect(validateLevel(['#############', '.............'])).toContain('map has no breakable bricks');
  });

  it('parses brick kinds and hit points', () => {
    const grid = parseLevel(['r23#*?.......']);
    expect(grid.slice(0, 7).map((b) => b && `${b.kind}:${b.hp}`)).toEqual([
      'normal:1', 'tough:2', 'armor:3', 'steel:1', 'bomb:1', 'power:1', null,
    ]);
  });
});
