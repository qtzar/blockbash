import type { PowerKind } from '../sim/tuning';
import type { Brick, Tint } from '../sim/types';

/** One colour per role (neon style guide). */
export const PALETTE = {
  paddle: '#22e6ff',
  ball: '#e8f6ff',
  ballGlow: '#9ff6ff',
  pierce: '#ff7a1a',
  pierceHot: '#fff3c4',
  bolt: '#9ff6ff',
  shield: '#4dff88',
  frame: '#3d7bff',
  frameDanger: '#ff3b5c',
  hudLabel: '#9ad8ff',
  hudValue: '#e8f6ff',
  gold: '#ffe066',
  warn: '#ff4d6d',
  good: '#4dff88',
  skyTop: '#02010a',
  skyBottom: '#0a0630',
  // Brick kinds
  tough: '#8fb8ff',
  armor: '#f0f0ff',
  steel: '#5f6f96',
  bomb: '#ff7a1a',
  power: '#ffe066',
} as const;

export const TINT_COLORS: Readonly<Record<Tint, string>> = {
  r: '#ff3b5c',
  o: '#ff9a1f',
  y: '#ffd23d',
  g: '#4dff88',
  c: '#19e3c3',
  b: '#3d8bff',
  v: '#c56bff',
  p: '#ff4fd8',
};

export const POWER_COLORS: Readonly<Record<PowerKind, string>> = {
  wide: '#22e6ff',
  multi: '#ff4fd8',
  slow: '#8fb8ff',
  magnet: '#c56bff',
  blaster: '#ff3b5c',
  pierce: '#ff7a1a',
  shield: '#4dff88',
  life: '#ffe066',
};

export const POWER_NAMES: Readonly<Record<PowerKind, string>> = {
  wide: 'WIDE',
  multi: 'MULTI',
  slow: 'SLOW',
  magnet: 'MAGNET',
  blaster: 'BLASTER',
  pierce: 'PIERCE',
  shield: 'SHIELD',
  life: '+LIFE',
};

export function brickColor(b: Pick<Brick, 'kind' | 'tint'>): string {
  if (b.kind === 'normal') return TINT_COLORS[b.tint ?? 'c'];
  return PALETTE[b.kind];
}

/** '#rrggbb' + alpha → 'rgba(r,g,b,a)'. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
