# Blockbash

A neon brick-breaker for the browser. Smash through 12 hand-built levels and then endless generated ones. Build combo
multipliers by keeping the ball off the paddle, catch power capsules, and chain bomb bricks into explosions.

## Play

```
npm install
npm run dev
```

| Action | Mouse / touch | Keyboard | Gamepad |
|---|---|---|---|
| Move paddle | Move / drag | Arrows / A D | D-pad / left stick |
| Launch ball, fire blaster | Click / tap (hold to fire) | Space / Enter | A / RT |
| Pause | | P / Esc | Start |
| Quit to title (while paused) | | Esc | B |
| Mute | | M | |

### Bricks

| Brick | |
|---|---|
| Colour | 1 hit |
| Tough | 2 hits |
| Armour | 3 hits |
| Steel | Unbreakable |
| Bomb | Destroys its 8 neighbours, chains into other bombs |
| Power | Always drops a capsule |

### Capsules

WIDE (bigger paddle), MULTI (each ball splits in three), SLOW, MAGNET (catch and aim), BLASTER (paddle fires bolts),
PIERCE (ball smashes straight through), SHIELD (one save at the floor), +LIFE.

Every 5 bricks broken without touching the paddle raises the multiplier, up to x8. Extra life every 20,000 points.

## Develop

- `npm test` runs the simulation, level, scene, input and storage tests (Vitest).
- `npm run typecheck` / `npm run build`.
- Playtest with `?level=9`, `?seed=42`, `?god`.

Pushing to `main` runs the tests and deploys to GitHub Pages (`.github/workflows/deploy.yml`).
