import { NO_INTENT, type Intent } from '../sim/types';

export type Button = 'left' | 'right' | 'up' | 'down' | 'pause' | 'confirm' | 'back' | 'mute';
export type Tri = -1 | 0 | 1;

export interface Actions {
  intent: Intent;
  // edge-triggered
  pause: boolean;
  confirm: boolean;
  back: boolean;
  mute: boolean;
  menuX: Tri;
  menuY: Tri;
}

export const NO_ACTIONS: Actions = {
  intent: NO_INTENT, pause: false, confirm: false, back: false, mute: false, menuX: 0, menuY: 0,
};

/** Keyed by KeyboardEvent.code. */
export const KEY_BINDINGS: Readonly<Record<string, readonly Button[]>> = {
  ArrowLeft: ['left'], KeyA: ['left'],
  ArrowRight: ['right'], KeyD: ['right'],
  ArrowUp: ['up'], KeyW: ['up'],
  ArrowDown: ['down'], KeyS: ['down'],
  Space: ['confirm'], Enter: ['confirm'],
  KeyP: ['pause'],
  Escape: ['pause', 'back'],
  KeyM: ['mute'],
};

/** Standard gamepad mapping: [button index, buttons]. */
export const PAD_BUTTONS: ReadonlyArray<readonly [number, readonly Button[]]> = [
  [0, ['confirm']], // A
  [1, ['back']], // B
  [7, ['confirm']], // RT fires too
  [9, ['pause']], // Start
  [12, ['up']], [13, ['down']], [14, ['left']], [15, ['right']],
];

export const STICK_DEADZONE = 0.15;
const MENU_STICK = 0.5;

export interface PadSnapshot {
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value?: number }[];
}

export function keyboardButtons(down: ReadonlySet<string>): Set<Button> {
  const out = new Set<Button>();
  for (const code of down) {
    const bound = KEY_BINDINGS[code];
    if (bound) for (const b of bound) out.add(b);
  }
  return out;
}

export function gamepadButtons(pad: PadSnapshot): Set<Button> {
  const out = new Set<Button>();
  for (const [index, bound] of PAD_BUTTONS) {
    if (pad.buttons[index]?.pressed) for (const b of bound) out.add(b);
  }
  return out;
}

/** Held buttons plus the stick pushed past 0.5, for edge-triggered menu navigation. */
export function menuButtons(held: ReadonlySet<Button>, pad: PadSnapshot | null): Set<Button> {
  const out = new Set(held);
  if (pad) {
    const x = pad.axes[0] ?? 0;
    const y = pad.axes[1] ?? 0;
    if (x <= -MENU_STICK) out.add('left');
    else if (x >= MENU_STICK) out.add('right');
    if (y <= -MENU_STICK) out.add('up');
    else if (y >= MENU_STICK) out.add('down');
  }
  return out;
}

/** Digital left/right first, then the analog stick with a deadzone. */
export function moveAxis(buttons: ReadonlySet<Button>, pad: PadSnapshot | null): number {
  const digital = (buttons.has('right') ? 1 : 0) - (buttons.has('left') ? 1 : 0);
  if (digital !== 0 || !pad) return digital;
  const x = pad.axes[0] ?? 0;
  const mag = Math.abs(x);
  if (mag <= STICK_DEADZONE) return 0;
  return Math.sign(x) * Math.min(1, (mag - STICK_DEADZONE) / (1 - STICK_DEADZONE));
}

export function buildActions(held: ReadonlySet<Button>, prev: ReadonlySet<Button>, intent: Intent = NO_INTENT): Actions {
  const pressed = (b: Button): boolean => held.has(b) && !prev.has(b);
  const edgeAxis = (neg: Button, pos: Button): Tri => ((pressed(pos) ? 1 : 0) - (pressed(neg) ? 1 : 0)) as Tri;
  return {
    intent,
    pause: pressed('pause'),
    confirm: pressed('confirm'),
    back: pressed('back'),
    mute: pressed('mute'),
    menuX: edgeAxis('left', 'right'),
    menuY: edgeAxis('up', 'down'),
  };
}

/** Maps a pointer event's client position to field x (or null if it cannot be mapped). */
export type PointerMapper = (clientX: number, clientY: number) => number | null;

/**
 * Keyboard, gamepad, mouse and touch. The pointer steers the paddle directly once it moves; pressing a move key
 * or the stick hands control back until the pointer moves again. Pointer press = confirm (launch / fire / menus).
 */
export class InputManager {
  private down = new Set<string>();
  private prev = new Set<Button>();
  private pointerX: number | null = null;
  private pointerActive = false;
  private pointerHeld = false;
  private pointerPressed = false;

  constructor(target: Window, element: HTMLElement, mapPointer: PointerMapper) {
    target.addEventListener('keydown', (e) => {
      if (e.metaKey || e.altKey || e.ctrlKey) return;
      const bound = KEY_BINDINGS[e.code];
      if (bound) e.preventDefault();
      if (bound && (bound.includes('left') || bound.includes('right'))) this.pointerActive = false;
      this.down.add(e.code);
    });
    target.addEventListener('keyup', (e) => {
      // macOS swallows keyups for other keys while Meta is held.
      if (e.code === 'MetaLeft' || e.code === 'MetaRight') this.down.clear();
      this.down.delete(e.code);
    });
    target.addEventListener('blur', () => {
      this.down.clear();
      this.pointerHeld = false;
    });
    const track = (e: PointerEvent) => {
      const x = mapPointer(e.clientX, e.clientY);
      if (x === null) return;
      this.pointerX = x;
      this.pointerActive = true;
    };
    element.addEventListener('pointermove', track);
    element.addEventListener('pointerdown', (e) => {
      track(e);
      this.pointerHeld = true;
      this.pointerPressed = true;
      if (e.pointerType !== 'mouse') element.setPointerCapture?.(e.pointerId);
    });
    const release = () => {
      this.pointerHeld = false;
    };
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  poll(): Actions {
    const held = keyboardButtons(this.down);
    let pad: PadSnapshot | null = null;
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      for (const p of navigator.getGamepads()) {
        if (p) {
          pad = p;
          break;
        }
      }
    }
    if (pad) for (const b of gamepadButtons(pad)) held.add(b);
    const move = moveAxis(held, pad);
    if (move !== 0) this.pointerActive = false;

    const menuHeld = menuButtons(held, pad);
    const intent: Intent = {
      move,
      targetX: this.pointerActive ? this.pointerX : null,
      fire: held.has('confirm') || this.pointerHeld,
      firePressed: false,
    };
    const actions = buildActions(menuHeld, this.prev, intent);
    if (this.pointerPressed) actions.confirm = true;
    this.pointerPressed = false;
    intent.firePressed = actions.confirm;
    this.prev = menuHeld;
    return actions;
  }
}
