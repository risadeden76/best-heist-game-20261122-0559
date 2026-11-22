// Sight lines: raycasts against the museum's walls, vision cones clipped by cover,
// and the one question every guard and camera asks — can this eye see the thief?
// Pure geometry, no drawing and no browser in it.
import { WALLS } from './config.js';

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function pointBlocked(x, y) {
  for (let i = 0; i < WALLS.length; i += 1) {
    if (pointInRect(x, y, WALLS[i])) return true;
  }
  return false;
}

/**
 * How far a ray from (x, y) in direction `angle` travels before it hits a wall
 * or runs out to `maxDistance`. Marches in small steps: cheap, and exact enough
 * for a cone's edge on a 1280x720 floor.
 */
export function rayDistance(x, y, angle, maxDistance) {
  const step = 7;
  const dx = Math.cos(angle) * step;
  const dy = Math.sin(angle) * step;
  let travelled = 0;
  while (travelled < maxDistance) {
    travelled += step;
    if (pointBlocked(x + dx * (travelled / step), y + dy * (travelled / step))) return travelled;
  }
  return maxDistance;
}

/** True when no wall stands between the two points. */
export function hasLineOfSight(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return true;
  const steps = Math.ceil(distance / 6);
  for (let i = 1; i < steps; i += 1) {
    if (pointBlocked(ax + (dx * i) / steps, ay + (dy * i) / steps)) return false;
  }
  return true;
}

/** Smallest absolute difference between two angles, in radians. */
export function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/**
 * The visible polygon of a cone: the eye, then one ray per slice out to the wall
 * or the cone's range, then back. The renderer fills this shape.
 */
export function conePolygon(x, y, angle, halfAngle, range) {
  const slices = 26;
  const points = [{ x, y }];
  for (let i = 0; i <= slices; i += 1) {
    const a = angle - halfAngle + (2 * halfAngle * i) / slices;
    const d = rayDistance(x, y, a, range);
    points.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d });
  }
  return points;
}

/**
 * Can an eye at (ex, ey) facing `angle` with this cone see a target at (tx, ty)?
 * Range, angle and a clear line of sight must all hold. Smoke (a list of clouds
 * with x, y and radius) blocks sight when the line crosses a cloud.
 */
export function canSee(ex, ey, angle, halfAngle, range, tx, ty, smoke) {
  const dx = tx - ex;
  const dy = ty - ey;
  const distance = Math.hypot(dx, dy);
  if (distance > range) return false;
  if (angleDifference(Math.atan2(dy, dx), angle) > halfAngle) return false;
  if (!hasLineOfSight(ex, ey, tx, ty)) return false;
  for (let i = 0; i < smoke.length; i += 1) {
    if (segmentHitsCircle(ex, ey, tx, ty, smoke[i])) return false;
  }
  return true;
}

/** True when the segment from (ax, ay) to (bx, by) passes through the circle. */
export function segmentHitsCircle(ax, ay, bx, by, circle) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  let t = 0;
  if (lengthSq > 0) {
    t = ((circle.x - ax) * dx + (circle.y - ay) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
  }
  const cx = ax + dx * t;
  const cy = ay + dy * t;
  const distSq = (circle.x - cx) * (circle.x - cx) + (circle.y - cy) * (circle.y - cy);
  return distSq < circle.radius * circle.radius;
}
