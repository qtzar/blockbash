import { AudioEngine, DEFAULT_AUDIO_SETTINGS } from './audio/engine';
import { EventAudio } from './audio/eventAudio';
import { Music } from './audio/music';
import { Sfx } from './audio/sfx';
import { InputManager, type Actions } from './core/input';
import { startLoop } from './core/loop';
import { createView } from './render/canvas';
import { FIELD_X } from './render/layout';
import { Renderer } from './render/renderer';
import { App, type Scene } from './scenes/app';
import { parseParams } from './scenes/params';
import { drawGameOver, drawInitials, drawPaused, drawTitle } from './scenes/screens';
import type { SimEvent } from './sim/events';
import { browserStore } from './storage/scores';

const SIM_DT = 1 / 120;
const canvas = document.getElementById('game') as HTMLCanvasElement;
let stop: (() => void) | null = null;

function showError(message: string): void {
  if (stop) stop();
  stop = null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(30,0,0,0.92)';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px monospace';
  ctx.fillText('Blockbash hit an error and stopped:', 24, 40);
  ctx.fillStyle = '#ff8a8a';
  ctx.fillText(message.slice(0, 200), 24, 70);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Reload the page to try again.', 24, 100);
}

window.addEventListener('error', (e) => showError(e.message || String(e.error)));
window.addEventListener('unhandledrejection', (e) => showError(String(e.reason)));

const anyPress = (a: Actions): boolean =>
  a.confirm || a.pause || a.back || a.mute || a.menuX !== 0 || a.menuY !== 0;

try {
  const view = createView(canvas);
  const renderer = new Renderer(view);
  const input = new InputManager(window, canvas, (cx, cy) => view.toGame(cx, cy).x - FIELD_X);
  const engine = new AudioEngine();
  const eventAudio = new EventAudio(new Sfx(engine), new Music(engine));
  const app = new App({ random: Math.random, store: browserStore(), params: parseParams(window.location.search) });

  let muted = app.save.muted;
  engine.applySettings({ ...DEFAULT_AUDIO_SETTINGS, muted });
  const unlock = () => engine.unlock();
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);

  let scene: Scene = app.scene;
  let audioPaused = false;
  /** Keeps audio in line with the scene: suspended while paused or hidden, music off on the title. */
  const syncAudio = () => {
    if (app.scene !== scene) {
      if (app.scene === 'title') eventAudio.stop();
      scene = app.scene;
      canvas.style.cursor = scene === 'playing' ? 'none' : 'default';
    }
    const pause = app.scene === 'paused' || document.hidden;
    if (pause !== audioPaused) {
      audioPaused = pause;
      engine.setPaused(pause);
    }
    if (app.save.muted !== muted) {
      muted = app.save.muted;
      engine.applySettings({ ...DEFAULT_AUDIO_SETTINGS, muted });
    }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) app.pauseNow();
    syncAudio();
  });

  let fxEvents: SimEvent[] = [];
  let audioEvents: SimEvent[] = [];
  let resetRenderer = false;

  const drawOverlay = (ctx: CanvasRenderingContext2D) => {
    const run = app.run;
    if (app.scene === 'title') drawTitle(ctx, app.time, renderer.sprites);
    else if (app.scene === 'paused') drawPaused(ctx);
    else if (app.scene === 'gameover' && run) drawGameOver(ctx, run, app.rank, app.time);
    else if (app.scene === 'initials' && run) drawInitials(ctx, app.letters, app.cursor, run.score, app.time);
  };

  stop = startLoop(
    {
      step: (dt) => {
        const a = input.poll();
        if (anyPress(a)) engine.unlock(); // gamepad presses (keyboard/pointer unlock via listeners)
        const before = app.displayState();
        const sceneBefore = app.scene;
        const events = app.step(a, dt);
        if (app.displayState() !== before) {
          // A different run is on screen: drop stale events and visuals.
          fxEvents = [];
          audioEvents = [];
          resetRenderer = true;
        }
        fxEvents.push(...events);
        if (sceneBefore !== 'title' || app.scene !== 'title') audioEvents.push(...events);
        syncAudio();
      },
      render: (_alpha, frameDt) => {
        if (resetRenderer) {
          renderer.reset();
          resetRenderer = false;
        }
        const state = app.displayState();
        renderer.frame(state, fxEvents, app.scene === 'paused' ? 0 : frameDt, app.hudInfo());
        if (app.scene !== 'title') {
          eventAudio.handle(audioEvents);
          eventAudio.update(state);
        }
        fxEvents = [];
        audioEvents = [];
        drawOverlay(view.ctx);
      },
      timeScale: () => app.timeScale(renderer.effects.timeScale()),
    },
    SIM_DT,
  );
} catch (err) {
  showError(err instanceof Error ? err.message : String(err));
}
