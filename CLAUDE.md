# Blockbash

An original neon brick-breaker for the browser (paddle, ball, bricks, power capsules). Not a recreation of any
specific commercial game: levels, power-ups and presentation are its own.

Visual and audio style: follow https://github.com/qtzar/dropzone/blob/main/docs/neon-style.md
and the source files it references in the qtzar/dropzone repo.

- `src/sim/` is headless and deterministic: no DOM, no `Math.random`. Render and audio react to the events it returns.
- Gameplay constants live in `src/sim/tuning.ts`.
- Levels are ASCII maps in `src/sim/levels.ts`; every map must pass `validateLevel` (`npm test` checks this,
  including 80 generated levels). Steel must never seal a breakable brick in.
- Commands: `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`.
- Playtest with `?level=9`, `?seed=42`, `?god` (floor bounces the ball back).
