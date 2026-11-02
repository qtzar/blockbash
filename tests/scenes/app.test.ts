import { describe, expect, it } from 'vitest';
import { NO_ACTIONS, type Actions } from '../../src/core/input';
import { App } from '../../src/scenes/app';
import { predictX, demoIntent } from '../../src/scenes/demo';
import { parseParams } from '../../src/scenes/params';
import { cycleChar } from '../../src/scenes/screens';
import { createRun } from '../../src/sim/state';
import { tick } from '../../src/sim/tick';
import { BALL_R, FIELD_W, OVER_DELAY, PADDLE_Y } from '../../src/sim/tuning';
import { STORAGE_KEY, type KeyValueStore } from '../../src/storage/scores';

const DT = 1 / 60;

function memoryStore(): KeyValueStore & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

function seq(seed = 1): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const act = (over: Partial<Actions> = {}): Actions => ({ ...NO_ACTIONS, ...over });

function makeApp(store = memoryStore(), search = '') {
  return new App({ random: seq(), store, params: parseParams(search) });
}

/** Steps the app, waiting out the title's input guard first. */
function startGame(app: App): void {
  for (let i = 0; i < 30; i++) app.step(act(), DT);
  app.step(act({ confirm: true }), DT);
}

/** Drains every life by forcing the balls below the floor. */
function loseAll(app: App): void {
  const run = app.run!;
  for (let guard = 0; guard < 20000 && app.scene === 'playing'; guard++) {
    for (const b of run.balls) {
      b.stuck = false;
      b.y = 2000;
      b.vy = 400;
    }
    app.step(act(), DT);
  }
}

describe('App', () => {
  it('runs a demo on the title and starts a game on confirm', () => {
    const app = makeApp();
    expect(app.scene).toBe('title');
    expect(app.displayState()).toBe(app.demo);
    startGame(app);
    expect(app.scene).toBe('playing');
    expect(app.run).not.toBeNull();
    expect(app.hudInfo().showRun).toBe(true);
  });

  it('pauses, resumes and quits', () => {
    const app = makeApp();
    startGame(app);
    app.step(act({ pause: true }), DT);
    expect(app.scene).toBe('paused');
    app.step(act({ pause: true }), DT);
    expect(app.scene).toBe('playing');
    app.step(act({ pause: true }), DT);
    app.step(act({ back: true, pause: true }), DT);
    expect(app.scene).toBe('title');
    expect(app.run).toBeNull();
  });

  it('asks for initials on a high score and saves them', () => {
    const store = memoryStore();
    const app = makeApp(store);
    startGame(app);
    app.run!.score = 999_999;
    loseAll(app);
    for (let t = 0; t < OVER_DELAY + 0.2 && app.scene === 'playing'; t += DT) app.step(act(), DT);
    expect(app.scene).toBe('initials');
    app.step(act({ menuY: -1 }), DT); // A → B
    app.step(act({ confirm: true }), DT);
    app.step(act({ confirm: true }), DT);
    app.step(act({ confirm: true }), DT);
    expect(app.scene).toBe('gameover');
    expect(app.rank).toBe(0);
    expect(JSON.parse(store.data[STORAGE_KEY]!).scores[0]).toMatchObject({ initials: 'BAA', score: 999_999 });
  });

  it('goes straight to game over for a low score', () => {
    const app = makeApp();
    startGame(app);
    loseAll(app);
    for (let t = 0; t < OVER_DELAY + 0.2 && app.scene === 'playing'; t += DT) app.step(act(), DT);
    expect(app.scene).toBe('gameover');
    for (let i = 0; i < 60; i++) app.step(act(), DT);
    app.step(act({ confirm: true }), DT);
    expect(app.scene).toBe('title');
  });

  it('toggles and remembers mute', () => {
    const store = memoryStore();
    const app = makeApp(store);
    app.step(act({ mute: true }), DT);
    expect(app.save.muted).toBe(true);
    expect(makeApp(store).save.muted).toBe(true);
  });

  it('starts at the ?level param', () => {
    const app = makeApp(memoryStore(), '?level=7');
    startGame(app);
    expect(app.run!.level).toBe(7);
  });
});

describe('params', () => {
  it('parses playtest switches and ignores junk', () => {
    expect(parseParams('?level=5&seed=42&god')).toEqual({ level: 5, seed: 42, god: true });
    expect(parseParams('?level=abc')).toEqual({ level: 1, seed: null, god: false });
    expect(parseParams('?level=0').level).toBe(1);
  });
});

describe('initials', () => {
  it('cycles through letters and space', () => {
    expect(cycleChar('A', 1)).toBe('B');
    expect(cycleChar('A', -1)).toBe(' ');
    expect(cycleChar(' ', 1)).toBe('A');
  });
});

describe('demo autopilot', () => {
  it('predicts wall bounces', () => {
    const y = PADDLE_Y - BALL_R - 100;
    const ball = { id: 1, x: FIELD_W - 50, y, vx: 200, vy: 200, stuck: false, stuckOffset: 0, stuckTime: 0, sincePaddle: 0 };
    // Travels 100 right: the centre meets the wall at FIELD_W - BALL_R after 43, then comes back 57.
    expect(predictX(ball)).toBeCloseTo(FIELD_W - BALL_R - 57, 5);
  });

  it('keeps a demo game going for two minutes without losing a life', () => {
    const { state } = createRun({ seed: 77, level: 1 });
    for (let i = 0; i < 60 * 120; i++) tick(state, demoIntent(state), DT);
    expect(state.score).toBeGreaterThan(1000);
    expect(state.lives).toBeGreaterThanOrEqual(2);
  });
});
