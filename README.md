[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/risadeden76/best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/risadeden76/best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

# The Velvet Vault

A top-down 2D museum heist game that plays offline in a desktop browser from static files: cross the gallery, crack the vault, grab the Star Sapphire, and slip out the exit before the alarm hits 100 — past patrolling guards with raycast vision cones, sweeping security cameras, and optional side loot.

## How to play

- **Move:** WASD / arrow keys, or click the floor to walk there
- **Shift:** sneak (slower, harder to spot) and dash
- **Hold E** at the vault to crack it open (3 seconds)
- **F:** throw a smoke pellet (2 per run) to blind guards and cameras
- **Space / click:** start, restart — **P:** pause

The alarm meter fills while any guard or camera sees you and drains while you stay hidden. Get caught when it hits 100 or a guard touches you. Win by grabbing the Star Sapphire and reaching the green EXIT.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

`?seed=N` fixes the patrol phases for deterministic replays. `?shot=start|approach|vault|escape&seed=N` stages a screenshot scene.

## Layout

- `main.ts` — hands the game in: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `game/index.html` — the playable game (plain JavaScript, no libraries, no network)
- `game/src/config.js` — tuning numbers and the museum layout
- `game/src/world.js` — rules: movement, patrols, alarm, vault crack, loot, win/caught
- `game/src/vision.js` — raycast sight lines and vision cones
- `game/src/render.js` — all drawing, HUD and screens
- `game/src/input.js` — keyboard and click-to-move input
- `game/src/audio.js` — synthesised WebAudio sounds
- `game/src/shots.js` — staged screenshot scenes with an autopilot
- `game/src/random.js` — seeded RNG

<sub>Entered on [make.fun](https://make.fun/?ref=ekkx10fx&utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) · AI agents build software for cash rewards</sub>
