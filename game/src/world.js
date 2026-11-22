// The Velvet Vault's rules and state, with no drawing and no browser in it:
// the thief, three patrolling guards, three sweeping cameras, the alarm meter,
// the vault crack, the loot and the getaway. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react (sounds, screens)
// without the world knowing about them. Nothing here allocates after createWorld.
import {
  ALARM,
  CAMERA,
  CAMERAS,
  EXIT,
  FIELD,
  GUARD,
  GUARDS,
  LOOT,
  SIDE_LOOT,
  SMOKE,
  START,
  THIEF,
  VAULT,
  WALLS,
} from './config.js';
import { angleDifference, canSee } from './vision.js';

export const EVENT_CAUGHT = 1;
export const EVENT_WON = 2;
export const EVENT_LOOT = 4;
export const EVENT_CRACKED = 8;
export const EVENT_SMOKE = 16;
export const EVENT_SPOTTED = 32;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Push a circle out of a rectangle it overlaps; returns true when it did. */
function resolveCircleRect(entity, rect) {
  const nearestX = clamp(entity.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(entity.y, rect.y, rect.y + rect.height);
  const dx = entity.x - nearestX;
  const dy = entity.y - nearestY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= entity.radius * entity.radius) return false;
  if (distSq === 0) {
    entity.y = rect.y - entity.radius;
    return true;
  }
  const dist = Math.sqrt(distSq);
  entity.x = nearestX + (dx / dist) * entity.radius;
  entity.y = nearestY + (dy / dist) * entity.radius;
  return true;
}

function moveCircle(entity, dx, dy) {
  entity.x += dx;
  for (let i = 0; i < WALLS.length; i += 1) resolveCircleRect(entity, WALLS[i]);
  entity.x = clamp(entity.x, entity.radius, FIELD.width - entity.radius);
  entity.y += dy;
  for (let i = 0; i < WALLS.length; i += 1) resolveCircleRect(entity, WALLS[i]);
  entity.y = clamp(entity.y, entity.radius, FIELD.height - entity.radius);
}

export function createWorld(random) {
  const thief = {
    x: START.x,
    y: START.y,
    radius: THIEF.radius,
    facing: 0,
    sneaking: false,
    moving: false,
    dashTime: 0,
    dashCooldown: 0,
    dashing: false,
  };
  const guards = GUARDS.map((def) => ({
    name: def.name,
    waypoints: def.waypoints,
    waypoint: 0,
    x: def.waypoints[0].x,
    y: def.waypoints[0].y,
    radius: GUARD.radius,
    angle: 0,
    mode: 'patrol',
    pause: 0,
    lastSeen: null,
    loseTimer: 0,
  }));
  const cameras = CAMERAS.map((def) => ({ ...def, angle: def.baseAngle }));
  const sideLoot = SIDE_LOOT.map((def) => ({ ...def, taken: false }));
  const smoke = [];
  const state = {
    thief,
    guards,
    cameras,
    smoke,
    sideLoot,
    alarm: 0,
    seenBy: '',
    vaultCracked: false,
    crackProgress: 0,
    sapphire: { x: VAULT.x + VAULT.width / 2, y: VAULT.y + VAULT.height + 26, available: false, taken: false },
    hasSapphire: false,
    smokeLeft: SMOKE.count,
    score: 0,
    elapsed: 0,
    outcome: 'playing',
    caughtReason: '',
    steps: 0,
  };

  function reset() {
    thief.x = START.x;
    thief.y = START.y;
    thief.facing = 0;
    thief.dashTime = 0;
    thief.dashCooldown = 0;
    thief.dashing = false;
    for (let i = 0; i < guards.length; i += 1) {
      const guard = guards[i];
      const start = GUARDS[i].waypoints[0];
      guard.x = start.x + (random() - 0.5) * 24;
      guard.y = start.y + (random() - 0.5) * 24;
      guard.waypoint = 1;
      guard.angle = 0;
      guard.mode = 'patrol';
      guard.pause = 0;
      guard.lastSeen = null;
      guard.loseTimer = 0;
    }
    for (let i = 0; i < cameras.length; i += 1) cameras[i].angle = cameras[i].baseAngle;
    for (let i = 0; i < sideLoot.length; i += 1) sideLoot[i].taken = false;
    smoke.length = 0;
    state.alarm = 0;
    state.seenBy = '';
    state.vaultCracked = false;
    state.crackProgress = 0;
    state.sapphire.available = false;
    state.sapphire.taken = false;
    state.hasSapphire = false;
    state.smokeLeft = SMOKE.count;
    state.score = 0;
    state.elapsed = 0;
    state.outcome = 'playing';
    state.caughtReason = '';
    state.steps = 0;
  }

  function vaultFrontDistance() {
    const fx = VAULT.x + VAULT.width / 2;
    const fy = VAULT.y + VAULT.height;
    return Math.hypot(thief.x - fx, thief.y - fy);
  }

  function stepGuard(guard, dt, harmless) {
    const target = guard.mode === 'chase' && guard.lastSeen ? guard.lastSeen : guard.waypoints[guard.waypoint];
    const dx = target.x - guard.x;
    const dy = target.y - guard.y;
    const distance = Math.hypot(dx, dy);
    if (guard.pause > 0) {
      guard.pause -= dt;
      guard.angle += dt * 1.4;
      return;
    }
    if (distance < 9) {
      if (guard.mode === 'chase') {
        guard.mode = 'patrol';
        guard.lastSeen = null;
      } else {
        guard.waypoint = (guard.waypoint + 1) % guard.waypoints.length;
        guard.pause = 0.5;
      }
      return;
    }
    const speed = guard.mode === 'chase' ? GUARD.chaseSpeed : GUARD.patrolSpeed;
    const nx = (dx / distance) * speed * dt;
    const ny = (dy / distance) * speed * dt;
    const beforeX = guard.x;
    const beforeY = guard.y;
    moveCircle(guard, nx, ny);
    const movedX = guard.x - beforeX;
    const movedY = guard.y - beforeY;
    if (movedX !== 0 || movedY !== 0) guard.angle = Math.atan2(movedY, movedX);
    if (!harmless && guard.mode === 'chase' && guard.lastSeen) {
      const seenDx = thief.x - guard.x;
      const seenDy = thief.y - guard.y;
      if (Math.hypot(seenDx, seenDy) < 12) {
        guard.mode = 'patrol';
        guard.lastSeen = null;
      }
    }
  }

  /**
   * One fixed step. `input` carries the move direction (mx, my, already
   * normalised), sneak, crack (E held), dash and smoke (edge-triggered) and an
   * optional click-to-move target. With `harmless` set (the title screen's
   * backdrop) the patrols run but nothing is ever spotted and nothing is won.
   */
  function step(dt, input, harmless) {
    let events = 0;
    state.steps += 1;
    if (state.outcome !== 'playing') return events;
    state.elapsed += dt;

    // --- Thief movement: keys, or click-to-move when no key is held. ---
    let mx = input.mx;
    let my = input.my;
    if (mx === 0 && my === 0 && input.click) {
      const dx = input.click.x - thief.x;
      const dy = input.click.y - thief.y;
      const d = Math.hypot(dx, dy);
      if (d > 10) {
        mx = dx / d;
        my = dy / d;
      }
    }
    thief.sneaking = input.sneak;
    thief.moving = mx !== 0 || my !== 0;
    if (thief.moving) thief.facing = Math.atan2(my, mx);
    if (input.dash && thief.dashCooldown <= 0) {
      thief.dashTime = THIEF.dashTime;
      thief.dashCooldown = THIEF.dashCooldown;
    }
    thief.dashCooldown = Math.max(0, thief.dashCooldown - dt);
    thief.dashing = thief.dashTime > 0;
    if (thief.dashTime > 0) thief.dashTime -= dt;
    const speed = thief.dashing ? THIEF.dashSpeed : thief.sneaking ? THIEF.sneakSpeed : THIEF.walkSpeed;
    moveCircle(thief, mx * speed * dt, my * speed * dt);

    // --- Smoke pellet: a cloud that blinds every eye it sits between. ---
    if (input.smoke && state.smokeLeft > 0) {
      smoke.push({ x: thief.x, y: thief.y, radius: SMOKE.radius, ttl: SMOKE.seconds });
      state.smokeLeft -= 1;
      events |= EVENT_SMOKE;
    }
    for (let i = smoke.length - 1; i >= 0; i -= 1) {
      smoke[i].ttl -= dt;
      if (smoke[i].ttl <= 0) smoke.splice(i, 1);
    }

    // --- Cameras sweep. ---
    for (let i = 0; i < cameras.length; i += 1) {
      const camera = cameras[i];
      camera.angle = camera.baseAngle + Math.sin(state.elapsed * CAMERA.sweepSpeed + camera.phase) * camera.sweep;
    }

    // --- Guards patrol, chase what they see, give up when it is gone. ---
    for (let i = 0; i < guards.length; i += 1) stepGuard(guards[i], dt, harmless);

    if (harmless) return events;

    // --- Eyes on the thief: the alarm fills while seen, drains while hidden. ---
    let seen = false;
    let seenBy = '';
    let fill = 0;
    for (let i = 0; i < guards.length; i += 1) {
      const guard = guards[i];
      const seenNow = canSee(guard.x, guard.y, guard.angle, GUARD.visionHalfAngle, GUARD.visionRange, thief.x, thief.y, smoke);
      if (seenNow) {
        seen = true;
        seenBy = guard.name;
        fill = Math.max(fill, ALARM.guardFill);
        guard.mode = 'chase';
        guard.lastSeen = { x: thief.x, y: thief.y };
        guard.loseTimer = 0;
      } else if (guard.mode === 'chase') {
        guard.loseTimer += dt;
        if (guard.loseTimer > GUARD.loseSightAfter) {
          guard.mode = 'patrol';
          guard.lastSeen = null;
          guard.loseTimer = 0;
        }
      }
    }
    for (let i = 0; i < cameras.length; i += 1) {
      const camera = cameras[i];
      if (canSee(camera.x, camera.y, camera.angle, CAMERA.halfAngle, CAMERA.range, thief.x, thief.y, smoke)) {
        seen = true;
        seenBy = 'camera';
        fill = Math.max(fill, ALARM.cameraFill);
      }
    }
    if (seen) {
      let rate = fill;
      if (thief.sneaking) rate *= ALARM.sneakMultiplier;
      if (thief.dashing) rate *= ALARM.dashMultiplier;
      state.alarm = Math.min(ALARM.max, state.alarm + rate * dt);
      state.seenBy = seenBy;
      events |= EVENT_SPOTTED;
    } else {
      state.alarm = Math.max(0, state.alarm - ALARM.drain * dt);
      state.seenBy = '';
    }

    // --- Vault crack: hold E at the vault's front; let go and it slips back. ---
    if (!state.vaultCracked) {
      if (input.crack && vaultFrontDistance() <= VAULT.crackDistance) {
        state.crackProgress += dt / VAULT.crackSeconds;
        if (state.crackProgress >= 1) {
          state.crackProgress = 1;
          state.vaultCracked = true;
          state.sapphire.available = true;
          events |= EVENT_CRACKED;
        }
      } else {
        state.crackProgress = Math.max(0, state.crackProgress - dt * 0.4);
      }
    }

    // --- Loot: walk over a pedestal, walk over the sapphire once the vault is open. ---
    for (let i = 0; i < sideLoot.length; i += 1) {
      const loot = sideLoot[i];
      if (!loot.taken && Math.hypot(thief.x - loot.x, thief.y - loot.y) < 30) {
        loot.taken = true;
        state.score += LOOT.sidePoints;
        events |= EVENT_LOOT;
      }
    }
    if (state.sapphire.available && !state.sapphire.taken && Math.hypot(thief.x - state.sapphire.x, thief.y - state.sapphire.y) < 30) {
      state.sapphire.taken = true;
      state.hasSapphire = true;
      state.score += LOOT.sapphirePoints;
      events |= EVENT_LOOT;
    }

    // --- Caught: the alarm fills, or a guard lays a hand on the thief. ---
    if (state.alarm >= ALARM.max) {
      state.outcome = 'caught';
      state.caughtReason = 'The alarm hit 100 — the museum locked down.';
      return events | EVENT_CAUGHT;
    }
    for (let i = 0; i < guards.length; i += 1) {
      const guard = guards[i];
      if (Math.hypot(thief.x - guard.x, thief.y - guard.y) < GUARD.touchDistance) {
        state.outcome = 'caught';
        state.caughtReason = `${guard.name} caught you in the gallery.`;
        return events | EVENT_CAUGHT;
      }
    }

    // --- Win: sapphire in hand, back through the exit door. ---
    if (
      state.hasSapphire &&
      thief.x >= EXIT.x &&
      thief.x <= EXIT.x + EXIT.width &&
      thief.y >= EXIT.y &&
      thief.y <= EXIT.y + EXIT.height
    ) {
      state.outcome = 'won';
      state.score += Math.max(0, Math.round(LOOT.winBonusBase - state.elapsed * LOOT.winBonusPerSecond));
      return events | EVENT_WON;
    }
    return events;
  }

  reset();
  return { state, reset, step, vaultFrontDistance };
}
