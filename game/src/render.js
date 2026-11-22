// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. Vision cones are the raycast polygons from vision.js,
// clipped by walls and crates, so cover reads at a glance: gold is the thief,
// red cones are danger, blue cones are cameras, the blue gem is the loot.
import { CAMERA, EXIT, FIELD, FONT, GUARD, PALETTE, VAULT, WALLS } from './config.js';
import { conePolygon } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_CAUGHT = 'caught';

/** The panel's width; its height grows with its lines: room for the title, the lines and the prompt. */
const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };
const HUD_HEIGHT = 54;

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const timerLabel = cachedLabel('');
  const scoreLabel = cachedLabel('Score ');
  const lootLabel = cachedLabel('Loot ');
  const alarmLabel = cachedLabel('');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** Convert a pointer position on the page into playfield coordinates. */
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * canvas.width;
    const py = ((clientY - rect.top) / rect.height) * canvas.height;
    const fx = (px - view.x) / view.scale;
    const fy = (py - view.y) / view.scale;
    if (fx < 0 || fy < 0 || fx > FIELD.width || fy > FIELD.height) return null;
    return { x: fx, y: fy };
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawFloor() {
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.floorTile;
    for (let x = 24; x < FIELD.width - 24; x += 80) {
      for (let y = 24; y < FIELD.height - 24; y += 80) {
        if (((x + y) / 80) % 2 === 0) context.fillRect(x, y, 80, 80);
      }
    }
    // The burgundy carpet runner down the gallery's middle.
    context.fillStyle = PALETTE.carpet;
    context.fillRect(430, 24, 360, 672);
    context.strokeStyle = PALETTE.carpetEdge;
    context.lineWidth = 4;
    context.strokeRect(430, 24, 360, 672);
  }

  function drawExit() {
    context.fillStyle = PALETTE.exitDark;
    context.fillRect(EXIT.x, EXIT.y, EXIT.width, EXIT.height);
    context.strokeStyle = PALETTE.exit;
    context.lineWidth = 3;
    context.strokeRect(EXIT.x + 2, EXIT.y + 2, EXIT.width - 4, EXIT.height - 4);
    text('EXIT', EXIT.x + EXIT.width / 2, EXIT.y + EXIT.height / 2 + 7, 22, PALETTE.exit, 'center');
  }

  function drawVault(state) {
    context.fillStyle = PALETTE.vault;
    context.fillRect(VAULT.x, VAULT.y, VAULT.width, VAULT.height);
    context.strokeStyle = PALETTE.vaultDoor;
    context.lineWidth = 4;
    context.strokeRect(VAULT.x + 3, VAULT.y + 3, VAULT.width - 6, VAULT.height - 6);
    // The vault door: a dial and bars; it swings open once cracked.
    const cx = VAULT.x + VAULT.width / 2;
    const cy = VAULT.y + VAULT.height / 2;
    context.fillStyle = state.vaultCracked ? '#1c2f45' : PALETTE.vaultDoor;
    context.beginPath();
    context.arc(cx, cy, 20, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.vault;
    context.beginPath();
    context.arc(cx, cy, 8, 0, Math.PI * 2);
    context.fill();
    text('VAULT', cx, VAULT.y + VAULT.height - 10, 15, PALETTE.vaultDoor, 'center');
    if (state.vaultCracked && !state.sapphire.taken) {
      const pulse = 0.6 + 0.4 * Math.sin(state.elapsed * 5);
      context.fillStyle = `rgba(79, 210, 255, ${0.25 + 0.35 * pulse})`;
      context.beginPath();
      context.arc(state.sapphire.x, state.sapphire.y, 26, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawLoot(state) {
    for (let i = 0; i < state.sideLoot.length; i += 1) {
      const loot = state.sideLoot[i];
      if (loot.taken) continue;
      // A pedestal with a small treasure on top.
      context.fillStyle = '#6a6378';
      context.fillRect(loot.x - 14, loot.y - 8, 28, 20);
      context.fillStyle = PALETTE.sideLoot;
      context.beginPath();
      context.arc(loot.x, loot.y - 14, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fff3c4';
      context.beginPath();
      context.arc(loot.x - 3, loot.y - 17, 3, 0, Math.PI * 2);
      context.fill();
      text(loot.name, loot.x, loot.y + 32, 14, PALETTE.muted, 'center');
    }
    if (state.sapphire.available && !state.sapphire.taken) {
      const gem = state.sapphire;
      context.fillStyle = PALETTE.sapphire;
      context.beginPath();
      context.moveTo(gem.x, gem.y - 14);
      context.lineTo(gem.x + 11, gem.y);
      context.lineTo(gem.x, gem.y + 14);
      context.lineTo(gem.x - 11, gem.y);
      context.closePath();
      context.fill();
      context.fillStyle = '#d8f6ff';
      context.beginPath();
      context.moveTo(gem.x, gem.y - 8);
      context.lineTo(gem.x + 5, gem.y);
      context.lineTo(gem.x, gem.y + 8);
      context.lineTo(gem.x - 5, gem.y);
      context.closePath();
      context.fill();
      text('STAR SAPPHIRE', gem.x, gem.y + 32, 15, PALETTE.sapphire, 'center');
    }
  }

  function drawCone(points, fill, edge) {
    context.fillStyle = fill;
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) context.lineTo(points[i].x, points[i].y);
    context.closePath();
    context.fill();
    context.strokeStyle = edge;
    context.lineWidth = 1.5;
    context.stroke();
  }

  function drawGuards(state) {
    for (let i = 0; i < state.guards.length; i += 1) {
      const guard = state.guards[i];
      const cone = conePolygon(guard.x, guard.y, guard.angle, GUARD.visionHalfAngle, GUARD.visionRange);
      drawCone(cone, PALETTE.coneGuard, PALETTE.coneEdgeGuard);
    }
    for (let i = 0; i < state.guards.length; i += 1) {
      const guard = state.guards[i];
      context.fillStyle = guard.mode === 'chase' ? '#ff6b5e' : PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.guardDark;
      context.lineWidth = 3;
      context.stroke();
      // Facing tick and name tag.
      context.strokeStyle = '#ffd9d9';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.angle) * (guard.radius + 9), guard.y + Math.sin(guard.angle) * (guard.radius + 9));
      context.stroke();
      text(guard.name, guard.x, guard.y - guard.radius - 8, 13, '#ffb3ab', 'center');
      if (guard.mode === 'chase') text('!', guard.x, guard.y - guard.radius - 24, 20, '#ff6b5e', 'center');
    }
  }

  function drawCameras(state) {
    for (let i = 0; i < state.cameras.length; i += 1) {
      const camera = state.cameras[i];
      const cone = conePolygon(camera.x, camera.y, camera.angle, CAMERA.halfAngle, CAMERA.range);
      drawCone(cone, PALETTE.coneCamera, PALETTE.coneEdgeCamera);
    }
    for (let i = 0; i < state.cameras.length; i += 1) {
      const camera = state.cameras[i];
      context.fillStyle = PALETTE.camera;
      context.beginPath();
      context.arc(camera.x, camera.y, 9, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#3d4a58';
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = '#e8f6ff';
      context.beginPath();
      context.arc(camera.x + Math.cos(camera.angle) * 5, camera.y + Math.sin(camera.angle) * 5, 3.5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawWalls() {
    for (let i = 0; i < WALLS.length; i += 1) {
      const wall = WALLS[i];
      const isCrate = wall.width <= 100 && wall.height <= 100;
      context.fillStyle = isCrate ? PALETTE.crate : PALETTE.wall;
      context.fillRect(wall.x, wall.y, wall.width, wall.height);
      context.fillStyle = isCrate ? PALETTE.crateTop : PALETTE.wallTop;
      context.fillRect(wall.x, wall.y, wall.width, 5);
    }
  }

  function drawSmoke(state) {
    for (let i = 0; i < state.smoke.length; i += 1) {
      const cloud = state.smoke[i];
      context.fillStyle = PALETTE.smoke;
      context.beginPath();
      context.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(cloud.x - 30, cloud.y + 14, cloud.radius * 0.6, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(cloud.x + 32, cloud.y - 12, cloud.radius * 0.55, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawThief(state) {
    const thief = state.thief;
    if (thief.dashing) {
      context.fillStyle = 'rgba(232, 178, 58, 0.25)';
      context.beginPath();
      context.arc(thief.x - Math.cos(thief.facing) * 22, thief.y - Math.sin(thief.facing) * 22, thief.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = thief.sneaking ? PALETTE.thiefDark : PALETTE.thief;
    context.beginPath();
    context.arc(thief.x, thief.y, thief.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#5c430f';
    context.lineWidth = 3;
    context.stroke();
    // Hood peak pointing where the thief faces.
    context.fillStyle = '#5c430f';
    context.beginPath();
    context.moveTo(thief.x + Math.cos(thief.facing) * (thief.radius + 7), thief.y + Math.sin(thief.facing) * (thief.radius + 7));
    context.lineTo(thief.x + Math.cos(thief.facing + 2.5) * 8, thief.y + Math.sin(thief.facing + 2.5) * 8);
    context.lineTo(thief.x + Math.cos(thief.facing - 2.5) * 8, thief.y + Math.sin(thief.facing - 2.5) * 8);
    context.closePath();
    context.fill();
    text('YOU', thief.x, thief.y - thief.radius - 8, 13, PALETTE.thief, 'center');
  }

  function alarmColour(alarm) {
    if (alarm >= 70) return PALETTE.alarmHigh;
    if (alarm >= 35) return PALETTE.alarmMid;
    return PALETTE.alarmLow;
  }

  function drawHud(state) {
    context.fillStyle = 'rgba(11, 13, 18, 0.85)';
    context.fillRect(0, 0, FIELD.width, HUD_HEIGHT);
    context.textBaseline = 'top';
    // Alarm meter: label, bar and percent — always on screen.
    text('ALARM', 24, 12, 20, PALETTE.text, 'left');
    const barX = 110;
    const barY = 12;
    const barWidth = 260;
    const barHeight = 26;
    context.fillStyle = '#241a1a';
    context.fillRect(barX, barY, barWidth, barHeight);
    context.fillStyle = alarmColour(state.alarm);
    context.fillRect(barX, barY, Math.max(0, (barWidth * state.alarm) / 100), barHeight);
    context.strokeStyle = '#5c4a4a';
    context.lineWidth = 2;
    context.strokeRect(barX, barY, barWidth, barHeight);
    text(alarmLabel(`${Math.round(state.alarm)}%`), barX + barWidth + 10, 12, 20, alarmColour(state.alarm), 'left');
    if (state.seenBy) {
      text(`SPOTTED BY ${state.seenBy.toUpperCase()}!`, barX + barWidth + 78, 12, 20, '#ff6b5e', 'left');
    }
    // Loot, score and time on the right.
    const lootTaken = state.sideLoot.filter((loot) => loot.taken).length + (state.hasSapphire ? 1 : 0);
    text(lootLabel(`${lootTaken}/4`), FIELD.width - 330, 12, 20, PALETTE.text, 'left');
    text(scoreLabel(state.score), FIELD.width - 220, 12, 20, PALETTE.text, 'left');
    const minutes = Math.floor(state.elapsed / 60);
    const seconds = Math.floor(state.elapsed % 60);
    text(timerLabel(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`), FIELD.width - 24, 12, 20, PALETTE.text, 'right');
    // Smoke pellets.
    text(`Smoke ${'●'.repeat(state.smokeLeft)}${'○'.repeat(2 - state.smokeLeft)}  [F]`, 24, HUD_HEIGHT + 6, 16, PALETTE.muted, 'left');
    // Objective line along the bottom.
    const objective = state.hasSapphire
      ? 'Sapphire in hand — get to the EXIT!'
      : state.vaultCracked
        ? 'Vault open — grab the STAR SAPPHIRE, then escape!'
        : 'Crack the VAULT (hold E) — avoid the cones, grab the loot, escape.';
    text(objective, FIELD.width / 2, FIELD.height - 26, 17, PALETTE.muted, 'center');
    // Vault crack progress, drawn over the vault itself.
    if (state.crackProgress > 0 && !state.vaultCracked) {
      const cx = VAULT.x + VAULT.width / 2;
      const cy = VAULT.y + VAULT.height + 68;
      context.fillStyle = '#241a1a';
      context.fillRect(cx - 70, cy - 10, 140, 16);
      context.fillStyle = PALETTE.vaultDoor;
      context.fillRect(cx - 70, cy - 10, 140 * state.crackProgress, 16);
      context.strokeStyle = PALETTE.text;
      context.lineWidth = 1.5;
      context.strokeRect(cx - 70, cy - 10, 140, 16);
      text('CRACKING… hold E', cx, cy + 12, 15, PALETTE.vaultDoor, 'center');
    }
    if (state.thief.dashCooldown > 0) {
      text('Dash recharging…', FIELD.width - 24, HUD_HEIGHT + 6, 16, PALETTE.muted, 'right');
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(11, 13, 18, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 3;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.sideLoot, 'center');
  }

  const TITLE_LINES = [
    'One night. One vault. The Star Sapphire.',
    'Cross the gallery, crack the vault, grab the sapphire,',
    'and slip out the EXIT before the alarm hits 100.',
    'Move: WASD / arrows — or click the floor. Shift: sneak.',
    'Hold E at the vault to crack it. Space: dash. F: smoke pellet.',
    'Red cones are guards, blue cones are cameras. Walls hide you.',
    '',
  ];
  const PAUSED_LINES = ['The guards keep their patrol while you think.'];
  const WIN_LINES = ['', '', ''];
  const CAUGHT_LINES = ['', ''];

  /** Paint one frame: the museum, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor();
    drawExit();
    drawVault(state);
    drawLoot(state);
    drawCameras(state);
    drawGuards(state);
    drawSmoke(state);
    drawWalls();
    drawThief(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[6] = `Best score ${best}`;
      drawPanel('THE VELVET VAULT', TITLE_LINES, 'Press Space or click to start the heist');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = `Score ${state.score} — escaped in ${Math.floor(state.elapsed)}s`;
      WIN_LINES[1] = `Best ${Math.max(best, state.score)}`;
      WIN_LINES[2] = state.sideLoot.filter((loot) => loot.taken).length === 3 ? 'Clean sweep: every side treasure too.' : 'Some side loot is still in the gallery…';
      drawPanel('CLEAN GETAWAY!', WIN_LINES, 'Press Space or click to heist again', PALETTE.exit);
    } else if (screen === SCREEN_CAUGHT) {
      CAUGHT_LINES[0] = state.caughtReason;
      CAUGHT_LINES[1] = `Score ${state.score}`;
      drawPanel('CAUGHT!', CAUGHT_LINES, 'Press Space or click to try again', PALETTE.alarmHigh);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
