import { createRng, hashString, intRange, nextFloat, type Rng } from '../core/rng';
import { COLS, MAX_ROWS } from './tuning';
import type { Brick, BrickKind, Tint } from './types';

/**
 * Levels are ASCII maps, one string per row, exactly COLS characters wide:
 *   .        empty
 *   roygcbvp normal brick (red, orange, yellow, green, teal, blue, violet, pink), 1 hit
 *   2        tough brick, 2 hits
 *   3        armoured brick, 3 hits
 *   #        steel, unbreakable
 *   *        bomb: destroys its 8 neighbours
 *   ?        power brick: always drops a capsule
 */
export interface LevelDef {
  name: string;
  map: readonly string[];
}

export const LEVELS: readonly LevelDef[] = [
  {
    name: 'SUNRISE',
    map: [
      '.............',
      '.....yyy.....',
      '...yyoooyy...',
      '..yoorrrooy..',
      '.yorr?r?rroy.',
      '.yorrrrrrroy.',
      'ccccccccccccc',
      '.............',
      'bbbbbbbbbbbbb',
    ],
  },
  {
    name: 'CIRCUIT',
    map: [
      '.............',
      'ggggg...ggggg',
      'g...g...g...g',
      'g.?.g***g.?.g',
      'g...g...g...g',
      'ggggg...ggggg',
      '.............',
      'c2c2c2c2c2c2c',
    ],
  },
  {
    name: 'HEARTBEAT',
    map: [
      '.............',
      '..pp.....pp..',
      '.pppp...pppp.',
      'ppp?pp.pp?ppp',
      'ppppppppppppp',
      '.ppppppppppp.',
      '..ppppppppp..',
      '...ppp*ppp...',
      '....ppppp....',
      '.....ppp.....',
      '......p......',
    ],
  },
  {
    name: 'FORTRESS',
    map: [
      '.............',
      '#...........#',
      '#.rrrrrrrrr.#',
      '#.r2222222r.#',
      '#.r2*?3?*2r.#',
      '#.r2222222r.#',
      '#.rrrrrrrrr.#',
      '#...........#',
      '###.......###',
    ],
  },
  {
    name: 'STAIRWAY',
    map: [
      '.............',
      'r............',
      'ro...........',
      'roy..........',
      'royg.........',
      'roygc........',
      'roygcb.......',
      'roygcbv......',
      'roygcbvp.....',
      'roygcbvp?....',
      'roygcbvp22...',
      'roygcbvp333..',
      'roygcbvp*****',
    ],
  },
  {
    name: 'CHECKMATE',
    map: [
      '.............',
      'c.c.c.c.c.c.c',
      '.b.b.b.b.b.b.',
      'v.v.v.?.v.v.v',
      '.p.p.p.p.p.p.',
      '2.2.2.2.2.2.2',
      '.3.3.*.*.3.3.',
    ],
  },
  {
    name: 'BOMB BAY',
    map: [
      '.............',
      'ooooooooooooo',
      'o*o*o*o*o*o*o',
      'ooooooooooooo',
      '.............',
      'yyyyyyyyyyyyy',
      'y*y*y?y?y*y*y',
      'yyyyyyyyyyyyy',
      '.............',
      '#####...#####',
    ],
  },
  {
    name: 'PILLARS',
    map: [
      '.............',
      '#..b..#..b..#',
      '#.bbb.#.bbb.#',
      '#bb?bb#bb?bb#',
      '#.bbb.#.bbb.#',
      '#..b..#..b..#',
      '#.....#.....#',
      '#.....#.....#',
      '.............',
      'gg3gg3g3gg3gg',
    ],
  },
  {
    name: 'BULLSEYE',
    map: [
      '.............',
      '..rrrrrrrrr..',
      '.rr2222222rr.',
      '.r22ccccc22r.',
      '.r2cc333cc2r.',
      '.r2c33*33c2r.',
      '.r2cc333cc2r.',
      '.r22ccccc22r.',
      '.rr2222222rr.',
      '..rrrrrrrrr..',
    ],
  },
  {
    name: 'TIDES',
    map: [
      '.............',
      'b...b...b...b',
      '.b.b.b.b.b.b.',
      '..b...b...b..',
      '.............',
      'v...v...v...v',
      '.v.v.v?v.v.v.',
      '..v...v...v..',
      '.............',
      'p...p...p...p',
      '.p.p.p.p.p.p.',
      '..p...p...p..',
    ],
  },
  {
    name: 'VAULT',
    map: [
      '.............',
      '.###########.',
      '.#333333333#.',
      '.#3*?*?*?*3#.',
      '.#333333333#.',
      '.####...####.',
      '.............',
      '2222222222222',
    ],
  },
  {
    name: 'THE CORE',
    map: [
      '.............',
      '3333333333333',
      '3###########3',
      '3#ppppppppp#3',
      '3#p*******p#3',
      '3#p*??*??*p#3',
      '3#ppppppppp#3',
      '3####...####3',
      '3333333333333',
    ],
  },
];

const TINTS: readonly Tint[] = ['r', 'o', 'y', 'g', 'c', 'b', 'v', 'p'];
const VALID = new Set(['.', '2', '3', '#', '*', '?', ...TINTS]);

export function brickFromChar(ch: string, col: number, row: number): Brick | null {
  const make = (kind: BrickKind, hp: number, tint: Tint | null = null): Brick => ({ col, row, kind, tint, hp, maxHp: hp });
  if ((TINTS as readonly string[]).includes(ch)) return make('normal', 1, ch as Tint);
  switch (ch) {
    case '2': return make('tough', 2);
    case '3': return make('armor', 3);
    case '#': return make('steel', 1);
    case '*': return make('bomb', 1);
    case '?': return make('power', 1);
    default: return null;
  }
}

/** Builds the MAX_ROWS × COLS grid for a map. Assumes the map is valid. */
export function parseLevel(map: readonly string[]): (Brick | null)[] {
  const grid: (Brick | null)[] = new Array(MAX_ROWS * COLS).fill(null);
  map.forEach((line, row) => {
    for (let col = 0; col < COLS; col++) grid[row * COLS + col] = brickFromChar(line[col] ?? '.', col, row);
  });
  return grid;
}

/**
 * Problems with a map, or [] if it is playable. Besides shape checks, every breakable brick must be reachable:
 * a flood fill from the open space below the grid, through anything that is not steel, must touch it.
 * The side margins are narrower than the ball, so the space above the grid only connects through the grid.
 */
export function validateLevel(map: readonly string[]): string[] {
  const errors: string[] = [];
  if (map.length === 0) errors.push('map is empty');
  if (map.length > MAX_ROWS - 1) errors.push(`map has ${map.length} rows; at most ${MAX_ROWS - 1}`);
  map.forEach((line, i) => {
    if (line.length !== COLS) errors.push(`row ${i} is ${line.length} wide, expected ${COLS}`);
    for (const ch of line) if (!VALID.has(ch)) errors.push(`row ${i} has unknown character '${ch}'`);
  });
  if (errors.length > 0) return errors;

  const rows = map.length + 1; // one open row below the map
  const at = (r: number, c: number) => (r < map.length ? map[r]![c]! : '.');
  const seen = new Set<number>();
  const queue: Array<[number, number]> = [];
  for (let c = 0; c < COLS; c++) {
    seen.add((rows - 1) * COLS + c);
    queue.push([rows - 1, c]);
  }
  while (queue.length > 0) {
    const [r, c] = queue.pop()!;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= COLS) continue;
      const k = nr * COLS + nc;
      if (seen.has(k) || at(nr, nc) === '#') continue;
      seen.add(k);
      queue.push([nr, nc]);
    }
  }
  let breakable = 0;
  map.forEach((line, r) => {
    for (let c = 0; c < COLS; c++) {
      const ch = line[c]!;
      if (ch === '.' || ch === '#') continue;
      breakable++;
      if (!seen.has(r * COLS + c)) errors.push(`brick at row ${r}, col ${c} is sealed in by steel`);
    }
  });
  if (breakable === 0) errors.push('map has no breakable bricks');
  return errors;
}

const NAME_WORDS = ['NOVA', 'PULSE', 'VECTOR', 'PRISM', 'HELIX', 'QUASAR', 'ION', 'ZENITH', 'FLUX', 'EMBER', 'CIPHER', 'AURORA'];

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[intRange(rng, 0, items.length)]!;
}

function generateOnce(rng: Rng, depth: number): string[] {
  const rows = Math.min(MAX_ROWS - 3, 6 + Math.floor(depth / 2) + intRange(rng, 0, 3));
  const half = Math.ceil(COLS / 2);
  const pTough = Math.min(0.35, 0.1 + 0.02 * depth);
  const pArmor = Math.min(0.2, 0.03 + 0.012 * depth);
  const pSteel = Math.min(0.1, 0.03 + 0.005 * depth);
  const style = intRange(rng, 0, 3); // 0 bands, 1 columns, 2 scatter
  const pEmpty = style === 2 ? 0.35 : 0.15;
  const gapRow = intRange(rng, 1, rows); // a breathing row that is always empty in band styles
  const map: string[] = ['.'.repeat(COLS)];
  for (let r = 1; r < rows; r++) {
    const left: string[] = [];
    const bandTint = pick(rng, TINTS);
    for (let c = 0; c < half; c++) {
      const colTint = TINTS[c % TINTS.length]!;
      let ch: string;
      const roll = nextFloat(rng);
      if (style !== 2 && r === gapRow) ch = '.';
      else if (roll < pEmpty) ch = '.';
      else if (roll < pEmpty + pSteel) ch = '#';
      else if (roll < pEmpty + pSteel + pArmor) ch = '3';
      else if (roll < pEmpty + pSteel + pArmor + pTough) ch = '2';
      else if (roll < pEmpty + pSteel + pArmor + pTough + 0.03) ch = '*';
      else if (roll < pEmpty + pSteel + pArmor + pTough + 0.05) ch = '?';
      else ch = style === 1 ? colTint : bandTint;
      left.push(ch);
    }
    const right = left.slice(0, COLS - half).reverse();
    map.push(left.join('') + right.join(''));
  }
  return map;
}

/** Endless levels after the hand-made ones: mirror-symmetric, seeded by the level number. */
export function generateLevel(level: number): LevelDef {
  const rng = createRng(hashString(`blockbash-level-${level}`));
  const depth = Math.max(0, level - LEVELS.length);
  const name = `${pick(rng, NAME_WORDS)} ${level}`;
  for (let attempt = 0; attempt < 30; attempt++) {
    const map = generateOnce(rng, depth);
    if (validateLevel(map).length === 0) return { name, map };
  }
  return { name, map: generateOnce(rng, depth).map((line) => line.replace(/#/g, '2')) };
}

/** Level n (1-based): hand-made for the first LEVELS.length, generated after that. */
export function levelDef(level: number): LevelDef {
  return level >= 1 && level <= LEVELS.length ? LEVELS[level - 1]! : generateLevel(level);
}
