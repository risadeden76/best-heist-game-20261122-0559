// The Velvet Vault — every tuning number, colour and level brick in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size. The museum has three zones:
// the entry hall (west), the grand gallery (middle) and the vault room (east).
// Walls leave more than one doorway between zones, so there are several routes.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const THIEF = {
  radius: 13,
  walkSpeed: 178,
  sneakSpeed: 96,
  dashSpeed: 520,
  dashTime: 0.16,
  dashCooldown: 2.2,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 62,
  chaseSpeed: 112,
  visionRange: 235,
  visionHalfAngle: (38 * Math.PI) / 180,
  touchDistance: 27,
  loseSightAfter: 2.0,
};

export const CAMERA = {
  range: 285,
  halfAngle: (30 * Math.PI) / 180,
  sweepSpeed: 0.55,
};

/** Alarm 0..100. Fills while any eye is on the thief, drains while hidden. */
export const ALARM = {
  guardFill: 34,
  cameraFill: 26,
  sneakMultiplier: 0.45,
  dashMultiplier: 1.5,
  drain: 16,
  max: 100,
};

export const VAULT = {
  x: 1130,
  y: 60,
  width: 100,
  height: 80,
  /** Stand within this distance of the vault's front to crack it. */
  crackDistance: 92,
  /** Seconds of holding E to crack the vault open. */
  crackSeconds: 3.0,
};

export const EXIT = { x: 24, y: 620, width: 116, height: 76 };

export const SMOKE = { count: 2, radius: 95, seconds: 4.0 };

export const LOOT = {
  sapphirePoints: 500,
  sidePoints: 100,
  /** Win bonus shrinks with the clock: a fast clean getaway pays best. */
  winBonusBase: 300,
  winBonusPerSecond: 1,
};

/** Walls and crates: every rectangle blocks movement and blocks sight. */
export const WALLS = [
  // Outer shell.
  { x: 0, y: 0, width: 1280, height: 24 },
  { x: 0, y: 696, width: 1280, height: 24 },
  { x: 0, y: 0, width: 24, height: 720 },
  { x: 1256, y: 0, width: 24, height: 720 },
  // Wall A: splits entry hall from gallery; doorway at its foot (y 304..420).
  { x: 380, y: 24, width: 24, height: 280 },
  // Wall B: splits gallery from vault room; doorway at its head (y 24..416).
  { x: 820, y: 416, width: 24, height: 280 },
  // Wall C: gallery's south wall; doorway under wall A leads around it.
  { x: 404, y: 420, width: 416, height: 24 },
  // Crates and display plinths: hard cover you can hide behind.
  { x: 520, y: 120, width: 90, height: 60 },
  { x: 640, y: 280, width: 70, height: 70 },
  { x: 520, y: 540, width: 100, height: 60 },
  { x: 180, y: 420, width: 70, height: 70 },
  { x: 980, y: 300, width: 80, height: 80 },
  { x: 1060, y: 520, width: 90, height: 60 },
  { x: 240, y: 140, width: 60, height: 60 },
  { x: 700, y: 120, width: 60, height: 60 },
];

export const GUARDS = [
  {
    name: 'Marco',
    waypoints: [
      { x: 470, y: 130 },
      { x: 760, y: 130 },
      { x: 760, y: 320 },
      { x: 470, y: 320 },
    ],
  },
  {
    name: 'Inez',
    waypoints: [
      { x: 1000, y: 180 },
      { x: 1180, y: 180 },
      { x: 1180, y: 340 },
      { x: 1000, y: 340 },
    ],
  },
  {
    name: 'Tomas',
    waypoints: [
      { x: 80, y: 80 },
      { x: 260, y: 80 },
      { x: 260, y: 150 },
      { x: 80, y: 150 },
    ],
  },
];

export const CAMERAS = [
  // Wall-mounted over the gallery's north wall, sweeping the floor below.
  { x: 640, y: 30, baseAngle: Math.PI / 2, sweep: (55 * Math.PI) / 180, phase: 0 },
  // Wall-mounted on the vault room's east wall, sweeping left across the vault.
  { x: 1244, y: 380, baseAngle: Math.PI, sweep: (45 * Math.PI) / 180, phase: 1.4 },
  // Wall-mounted on the vault room's south wall, sweeping up across the lower vault room.
  { x: 1100, y: 690, baseAngle: -Math.PI / 2, sweep: (45 * Math.PI) / 180, phase: 2.6 },
];

/** Optional side loot: pedestals with a small treasure each. */
export const SIDE_LOOT = [
  { id: 'idol', name: 'Gold Idol', x: 600, y: 600 },
  { id: 'vase', name: 'Jade Vase', x: 250, y: 520 },
  { id: 'pearl', name: 'Pearl Necklace', x: 1010, y: 470 },
];

export const START = { x: 82, y: 652 };

export const PALETTE = {
  backdrop: '#0b0d12',
  floor: '#23202b',
  floorTile: '#2a2733',
  carpet: '#3d2436',
  carpetEdge: '#6b3a5e',
  wall: '#4a4456',
  wallTop: '#6a6378',
  crate: '#5d4a2f',
  crateTop: '#7a6238',
  thief: '#e8b23a',
  thiefDark: '#8a6420',
  guard: '#d84a4a',
  guardDark: '#7e2222',
  camera: '#9fb4c7',
  coneGuard: 'rgba(216, 74, 74, 0.20)',
  coneCamera: 'rgba(120, 200, 255, 0.16)',
  coneEdgeGuard: 'rgba(216, 74, 74, 0.55)',
  coneEdgeCamera: 'rgba(120, 200, 255, 0.5)',
  vault: '#3f5a78',
  vaultDoor: '#c8a24a',
  sapphire: '#4fd2ff',
  sideLoot: '#f2c94c',
  exit: '#3fae5a',
  exitDark: '#1e5c31',
  smoke: 'rgba(200, 200, 210, 0.35)',
  panel: '#17141d',
  panelEdge: '#3a3244',
  text: '#f2ead8',
  muted: '#a89ec0',
  alarmLow: '#3fae5a',
  alarmMid: '#e8b23a',
  alarmHigh: '#d84a4a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'velvet-vault.best';
