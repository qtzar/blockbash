import type { Actions } from '../core/input';
import type { HudInfo } from '../render/hud';
import type { SimEvent } from '../sim/events';
import { LEVELS } from '../sim/levels';
import { createRun } from '../sim/state';
import { tick } from '../sim/tick';
import { OVER_DELAY } from '../sim/tuning';
import type { RunState } from '../sim/types';
import { insertScore, loadSave, qualifies, writeSave, type KeyValueStore, type SaveData } from '../storage/scores';
import { demoIntent } from './demo';
import type { Params } from './params';
import { cycleChar } from './screens';

export type Scene = 'title' | 'playing' | 'paused' | 'gameover' | 'initials';

export interface AppDeps {
  random: () => number;
  store: KeyValueStore | null;
  params: Params;
}

/** Demo runs restart on a new level after this long, so the title shows variety. */
const DEMO_SECONDS = 50;

/** Scene state machine. Pure apart from the injected random source and store, so it is testable headless. */
export class App {
  scene: Scene = 'title';
  run: RunState | null = null;
  demo: RunState;
  save: SaveData;
  time = 0;
  /** Seconds since the current scene began. */
  sceneTime = 0;
  letters = ['A', 'A', 'A'];
  cursor = 0;
  rank = -1;

  constructor(private deps: AppDeps) {
    this.save = loadSave(deps.store);
    this.demo = this.newDemo();
  }

  private seed(): number {
    return this.deps.params.seed ?? Math.floor(this.deps.random() * 2 ** 31);
  }

  private newDemo(): RunState {
    const level = 1 + Math.floor(this.deps.random() * LEVELS.length);
    return createRun({ seed: Math.floor(this.deps.random() * 2 ** 31), level, god: true }).state;
  }

  private go(scene: Scene): void {
    this.scene = scene;
    this.sceneTime = 0;
  }

  get hiScore(): number {
    return this.save.scores[0]?.score ?? 0;
  }

  /** The run on screen: the player's run, or the demo behind the title. */
  displayState(): RunState {
    return this.run ?? this.demo;
  }

  hudInfo(): HudInfo {
    return { hiScore: this.hiScore, scores: this.save.scores, muted: this.save.muted, showRun: this.run !== null };
  }

  timeScale(effectsScale: number): number {
    return this.scene === 'paused' ? 1 : effectsScale;
  }

  pauseNow(): void {
    if (this.scene === 'playing') this.go('paused');
  }

  private setMuted(muted: boolean): void {
    this.save = { ...this.save, muted };
    writeSave(this.deps.store, this.save);
  }

  startRun(): SimEvent[] {
    const { state, events } = createRun({ seed: this.seed(), level: this.deps.params.level, god: this.deps.params.god });
    this.run = state;
    this.rank = -1;
    this.go('playing');
    return events;
  }

  private toTitle(): void {
    this.run = null;
    this.demo = this.newDemo();
    this.go('title');
  }

  step(a: Actions, dt: number): SimEvent[] {
    this.time += dt;
    this.sceneTime += dt;
    if (a.mute) this.setMuted(!this.save.muted);

    switch (this.scene) {
      case 'title': {
        if (a.confirm && this.sceneTime > 0.3) return this.startRun();
        const events = tick(this.demo, demoIntent(this.demo), dt);
        if (this.demo.time > DEMO_SECONDS && this.demo.phase !== 'clear') this.demo = this.newDemo();
        return events;
      }
      case 'playing': {
        const run = this.run!;
        if (a.pause) {
          this.go('paused');
          return [];
        }
        const events = tick(run, a.intent, dt);
        if (run.phase === 'over' && run.phaseTime >= OVER_DELAY) this.finishRun(run);
        return events;
      }
      case 'paused':
        if (a.back) this.toTitle();
        else if (a.pause || a.confirm) this.go('playing');
        return [];
      case 'initials':
        if (a.menuY !== 0) this.letters[this.cursor] = cycleChar(this.letters[this.cursor]!, -a.menuY);
        if (a.menuX !== 0) this.cursor = Math.min(2, Math.max(0, this.cursor + a.menuX));
        if (a.confirm) {
          if (this.cursor < 2) this.cursor++;
          else this.submitInitials();
        }
        return [];
      case 'gameover':
        if ((a.confirm || a.back) && this.sceneTime > 0.8) this.toTitle();
        return [];
    }
  }

  private finishRun(run: RunState): void {
    if (qualifies(this.save.scores, run.score)) {
      this.letters = ['A', 'A', 'A'];
      this.cursor = 0;
      this.go('initials');
    } else {
      this.go('gameover');
    }
  }

  private submitInitials(): void {
    const run = this.run!;
    const { scores, rank } = insertScore(this.save.scores, { initials: this.letters.join(''), score: run.score, level: run.level });
    this.rank = rank;
    this.save = { ...this.save, scores };
    writeSave(this.deps.store, this.save);
    this.go('gameover');
  }
}
