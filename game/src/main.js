// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play, paused,
// win and caught. Sounds are synthesised; the alarm siren runs while the meter
// is hot and stops when it cools.
//
// ?seed=N fixes the patrol phases and the side-loot jitter. ?shot=start|approach|
// vault|escape (with &seed=N) stages that scene instead of running the loop,
// paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_CAUGHT,
  EVENT_CRACKED,
  EVENT_LOOT,
  EVENT_SMOKE,
  EVENT_SPOTTED,
  EVENT_WON,
  createWorld,
} from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_DASH,
  ACTION_PAUSE,
  ACTION_SMOKE,
  createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_CAUGHT,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (clientX, clientY) => renderer.toField(clientX, clientY));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let stepTimer = 0;
  let beepTimer = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each catch.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Crack the vault, grab the sapphire, escape.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_CAUGHT;
    audio.alarm(false);
    if (won) {
      audio.win();
      if (world.state.score > best) {
        best = world.state.score;
        saveBest(best);
      }
      announce(`Clean getaway. Score ${world.state.score}. Best ${best}.`);
    } else {
      audio.caught();
      announce(`${world.state.caughtReason} Score ${world.state.score}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_WIN || screen === SCREEN_CAUGHT)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.alarm(false);
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { mx: 0, my: 0, sneak: false, crack: false, dash: false, smoke: false, click: null }, true);
      return;
    }
    const direction = input.direction();
    const click = direction.x !== 0 || direction.y !== 0 ? null : input.clickTarget();
    const events = world.step(
      STEP,
      {
        mx: direction.x,
        my: direction.y,
        sneak: input.isSneaking(),
        crack: input.isCracking(),
        dash: Boolean(actions & ACTION_DASH),
        smoke: Boolean(actions & ACTION_SMOKE),
        click,
      },
      false,
    );
    if (click && (direction.x !== 0 || direction.y !== 0)) input.clearClick();
    if (world.state.thief.moving) {
      stepTimer -= STEP;
      if (stepTimer <= 0) {
        audio.footstep(world.state.thief.sneaking);
        stepTimer = world.state.thief.sneaking ? 0.5 : 0.32;
      }
    }
    if (events & EVENT_SPOTTED) {
      beepTimer -= STEP;
      if (world.state.seenBy === 'camera' && beepTimer <= 0) {
        audio.cameraBeep();
        beepTimer = 1.2;
      }
    }
    if (events & EVENT_CRACKED) audio.vaultOpen();
    if (events & EVENT_LOOT) audio.loot();
    if (events & EVENT_SMOKE) audio.smoke();
    if (actions & ACTION_DASH) audio.dash();
    audio.alarm(world.state.alarm >= 55);
    if (events & EVENT_WON) endGame(true);
    else if (events & EVENT_CAUGHT) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the alarm fill unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.alarm(false);
      announce('Paused.');
    }
  });

  // A handle for play-testing: the live world and screen, nothing a player needs.
  window.__heist = {
    get state() {
      return world.state;
    },
    get screen() {
      return screen;
    },
    world,
    start: startGame,
  };

  announce('The Velvet Vault. Press Space or click to start the heist.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
