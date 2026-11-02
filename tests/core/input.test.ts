import { describe, expect, it } from 'vitest';
import { buildActions, gamepadButtons, keyboardButtons, moveAxis, type Button } from '../../src/core/input';

const set = (...b: Button[]) => new Set<Button>(b);

describe('input', () => {
  it('maps keys to buttons', () => {
    expect([...keyboardButtons(new Set(['ArrowLeft', 'KeyD', 'Space']))].sort()).toEqual(['confirm', 'left', 'right']);
    expect([...keyboardButtons(new Set(['Escape']))].sort()).toEqual(['back', 'pause']);
  });

  it('maps gamepad buttons', () => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
    buttons[0] = { pressed: true };
    buttons[9] = { pressed: true };
    expect([...gamepadButtons({ axes: [], buttons })].sort()).toEqual(['confirm', 'pause']);
  });

  it('prefers digital movement, then the stick past its deadzone', () => {
    expect(moveAxis(set('left'), null)).toBe(-1);
    expect(moveAxis(set('left', 'right'), null)).toBe(0);
    expect(moveAxis(set(), { axes: [0.1], buttons: [] })).toBe(0);
    expect(moveAxis(set(), { axes: [1], buttons: [] })).toBe(1);
    expect(moveAxis(set(), { axes: [-0.575], buttons: [] })).toBeCloseTo(-0.5);
  });

  it('only reports presses on the frame they happen', () => {
    const first = buildActions(set('confirm', 'down'), set());
    expect(first.confirm).toBe(true);
    expect(first.menuY).toBe(1);
    const held = buildActions(set('confirm', 'down'), set('confirm', 'down'));
    expect(held.confirm).toBe(false);
    expect(held.menuY).toBe(0);
  });
});
