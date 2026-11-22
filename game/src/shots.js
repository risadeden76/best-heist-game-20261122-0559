// The screenshot scenes behind ?shot=start|approach|vault|escape. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot that follows the heist route — entry hall, gallery,
// vault room — cracks the vault, grabs the sapphire and runs for the exit, so
// each frame is what a real game looks like and the same seed always gives the
// same frame. The autopilot sneaks near guards and waits out a hot alarm.
import { CAMERA, FIELD, GUARD, STEP, VAULT } from './config.js';
import { EVENT_CAUGHT, EVENT_WON } from './world.js';
import { canSee } from './vision.js';
import { SCREEN_CAUGHT, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const MAX_SECONDS = 150;
const SAMPLE = STEP;

/** Waypoints of the heist route, in order, out and back. */
const ROUTE_OUT = [
  { x: 280, y: 560 },
  { x: 390, y: 395 },
  { x: 600, y: 360 },
  { x: 780, y: 380 },
  { x: 870, y: 240 },
  { x: 1060, y: 200 },
  { x: 1180, y: 178 },
];
const ROUTE_BACK = [
  { x: 1060, y: 200 },
  { x: 870, y: 240 },
  { x: 780, y: 380 },
  { x: 600, y: 360 },
  { x: 390, y: 395 },
  { x: 280, y: 560 },
  { x: 82, y: 652 },
];

function nearestGuardDistance(state) {
  let best = Infinity;
  for (let i = 0; i < state.guards.length; i += 1) {
    const guard = state.guards[i];
    best = Math.min(best, Math.hypot(state.thief.x - guard.x, state.thief.y - guard.y));
  }
  return best;
}

/**
 * The nearest eye (guard or camera) that can see the point (x, y) right now,
 * or null when no eye sees it. Smoke is not staged in screenshots, so it is empty.
 */
function seeingEye(state, x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (let i = 0; i < state.guards.length; i += 1) {
    const guard = state.guards[i];
    if (canSee(guard.x, guard.y, guard.angle, GUARD.visionHalfAngle, GUARD.visionRange, x, y, [])) {
      const d = Math.hypot(x - guard.x, y - guard.y);
      if (d < bestDistance) {
        bestDistance = d;
        best = guard;
      }
    }
  }
  for (let i = 0; i < state.cameras.length; i += 1) {
    const camera = state.cameras[i];
    if (canSee(camera.x, camera.y, camera.angle, CAMERA.halfAngle, CAMERA.range, x, y, [])) {
      const d = Math.hypot(x - camera.x, y - camera.y);
      if (d < bestDistance) {
        bestDistance = d;
        best = camera;
      }
    }
  }
  return best;
}

/** The guard currently chasing the thief, if any, and how far away it is. */
function chaser(state) {
  let best = null;
  let bestDistance = Infinity;
  for (let i = 0; i < state.guards.length; i += 1) {
    const guard = state.guards[i];
    if (guard.mode !== 'chase') continue;
    const d = Math.hypot(state.thief.x - guard.x, state.thief.y - guard.y);
    if (d < bestDistance) {
      bestDistance = d;
      best = guard;
    }
  }
  return best === null ? null : { guard: best, distance: bestDistance };
}

/** The START point, as a retreat target when the route has run out behind. */
const FALLBACK = { x: 82, y: 652 };

/**
 * The autopilot's input for one step. `route` is the waypoint list it is
 * following; `routeIndex` advances as each waypoint is reached; `pilot` holds
 * the retreat state between steps. Returns the input and the next route index.
 * It reads the cones before it moves: spotted, it retreats along the route it
 * came by (back through cover, never blindly into a wall) and never stops while
 * a guard is still chasing — a guard that walks into a waiting thief is how
 * heists end. The way ahead watched, it waits for the patrol to pass.
 */
function autopilot(state, route, routeIndex, pilot) {
  const thief = state.thief;
  const input = { mx: 0, my: 0, sneak: false, crack: false, dash: false, smoke: false, click: null };
  const eye = seeingEye(state, thief.x, thief.y);
  const chase = chaser(state);

  // Spotted, or a guard is hunting: retreat along the route toward cover.
  // The retreat target steps backwards along the route (then to the start
  // corner) and only ends when no guard is chasing and no eye sees the thief.
  if ((eye || chase) && !pilot.retreating) {
    pilot.retreating = true;
    pilot.retreatBack = 1;
  }
  if (pilot.retreating) {
    if (chase && chase.distance < 170 && state.smokeLeft > 0) input.smoke = true;
    if (chase && chase.distance < 120) input.dash = true;
    const backIndex = routeIndex - pilot.retreatBack;
    const target = backIndex < 0 ? FALLBACK : route[backIndex];
    const dx = target.x - thief.x;
    const dy = target.y - thief.y;
    const d = Math.hypot(dx, dy);
    if (d < 26) {
      if (!chase && !eye) {
        pilot.retreating = false;
      } else if (backIndex <= 0) {
        // At the start corner and still hunted: hold still in the exit zone's
        // cover and let the smoke and the drain do their work.
        input.sneak = true;
        if (state.alarm < 30 && !eye) pilot.retreating = false;
        return { input, routeIndex };
      } else {
        pilot.retreatBack += 1;
      }
    } else {
      input.mx = dx / d;
      input.my = dy / d;
    }
    return { input, routeIndex };
  }

  // At the vault's front with the vault still shut: hold E and crack it.
  if (!state.vaultCracked && route === ROUTE_OUT && routeIndex >= ROUTE_OUT.length) {
    input.crack = true;
    return { input, routeIndex };
  }
  // The sapphire is out: step onto it.
  if (state.vaultCracked && !state.hasSapphire) {
    const dx = state.sapphire.x - thief.x;
    const dy = state.sapphire.y - thief.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) return { input, routeIndex };
    input.mx = dx / d;
    input.my = dy / d;
    input.sneak = nearestGuardDistance(state) < 220;
    return { input, routeIndex };
  }

  const target = route[Math.min(routeIndex, route.length - 1)];
  const dx = target.x - thief.x;
  const dy = target.y - thief.y;
  const d = Math.hypot(dx, dy);
  if (d < 26) return { input, routeIndex: routeIndex + 1 };

  // The way ahead is watched: wait in cover for the patrol to pass — unless
  // this is a bold run, which walks straight through and takes the alarm hit.
  const probeX = thief.x + (dx / d) * 50;
  const probeY = thief.y + (dy / d) * 50;
  if (!pilot.bold && seeingEye(state, probeX, probeY)) {
    input.sneak = true;
    return { input, routeIndex };
  }

  // A hot alarm means wait in cover: standing still drains it.
  if (!pilot.bold && state.alarm > 68) {
    input.sneak = true;
    return { input, routeIndex };
  }
  input.mx = dx / d;
  input.my = dy / d;
  input.sneak = !pilot.bold && (nearestGuardDistance(state) < 150 || state.alarm > 45);
  return { input, routeIndex };
}

function runRoute(world, route, stopWhen, maxSeconds, bold = false) {
  let routeIndex = 0;
  const pilot = { retreating: false, retreatBack: 1, bold };
  const limit = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < limit; i += 1) {
    const { input, routeIndex: next } = autopilot(world.state, route, routeIndex, pilot);
    routeIndex = next;
    const events = world.step(STEP, input, false);
    if (events & EVENT_CAUGHT) return 'caught';
    if (events & EVENT_WON) return 'won';
    if (stopWhen(world.state, routeIndex)) return 'stopped';
  }
  return 'timeout';
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. Any unknown name is the title scene.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'approach' && name !== 'vault' && name !== 'escape') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { mx: 0, my: 0, sneak: false, crack: false, dash: false, smoke: false, click: null }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'approach') {
    // A bold crossing: the thief walks straight through the gallery's cones,
    // so the frame shows a live alarm meter, not a flat zero.
    runRoute(world, ROUTE_OUT, (state) => state.thief.x > 700, 45, true);
    return { screen: world.state.outcome === 'caught' ? SCREEN_CAUGHT : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'vault') {
    runRoute(world, ROUTE_OUT, (state) => state.crackProgress > 0.85 || state.vaultCracked, 180);
    return { screen: world.state.outcome === 'caught' ? SCREEN_CAUGHT : SCREEN_PLAY, best: world.state.score };
  }
  // Escape: crack, grab the sapphire, then run the route back toward the exit.
  const out = runRoute(world, ROUTE_OUT, (state) => state.hasSapphire, 180);
  if (out !== 'stopped' && world.state.outcome === 'playing') {
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  runRoute(world, ROUTE_BACK, (state) => state.thief.x < 520, 60);
  if (world.state.outcome === 'won') return { screen: SCREEN_WIN, best: world.state.score };
  if (world.state.outcome === 'caught') return { screen: SCREEN_CAUGHT, best: world.state.score };
  return { screen: SCREEN_PLAY, best: world.state.score };
}
