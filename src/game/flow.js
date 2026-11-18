// Starting the game, arriving on islands and starting over.
import { $ } from '../core/util.js';
import { canvas, setUnderwater } from '../core/renderer.js';
import { game, followCam, currentIsland } from '../core/state.js';
import { sfx, audioContext } from '../core/audio.js';
import { startMusic } from '../core/music.js';
import { toast, toastTime, showTitleCard } from '../core/ui.js';
import { writeSave } from '../core/save.js';
import { placeShipAt } from '../world/ship.js';
import { player } from '../player/player.js';
import { updatePowerHud } from '../systems/powers.js';
import { gull, gullJoinsShip } from '../npcs/gull.js';
import { renderTasks } from './tasks.js';
import { say, stopTalk } from './talk.js';
import { snapCamera } from './camera.js';
import { clearProgress, restoreProgress } from './progress.js';

// schedule an island's intro messages: [[delayMs, text, durationMs], …]; a character speaking is
// [delayMs, {speaker, line}] (game/talk.js; the messages after it wait until they're done). A
// message never starts before the previous one has had its full reading time, so none gets cut short.
const INTRO_GAP = 400; // ms between two intro messages
const showIntro = (messages) => {
  let previousEnd = 0;
  for (const [delay, message, duration] of messages) {
    const start = Math.max(delay, previousEnd + INTRO_GAP);
    if (typeof message === 'string') {
      setTimeout(() => toast(message, duration), start);
      previousEnd = start + toastTime(message, duration);
    } else {
      // tied to where Spartacus stands when it starts, so walking off ends it like any talk
      setTimeout(() => say(message.speaker, message.line, { at: player.pos.clone() }), start);
      previousEnd = start;
    }
  }
};

// island 1 starts right where the title screen is; later islands (Continue) go via enterIsland.
// resume: put back a mid-island save on island 1 (later islands always do, on Continue)
export function startGame(n, { resume = false } = {}) {
  if (game.state !== 'start') return;
  audioContext();
  startMusic();
  $('#start').classList.add('hidden');
  canvas.focus();
  if (n >= 2) {
    enterIsland(n, false);
    return;
  }
  game.state = 'play';
  if (resume) {
    restoreProgress(game.islands[1]);
    renderTasks();
    updatePowerHud();
    return;
  }
  writeSave({ island: 1, progress: null });
  showIntro(game.islands[1].intro || []);
}

// arrived = came by ship (false when jumping in from Continue)
export function enterIsland(n, arrived) {
  game.island = n;
  stopTalk();
  const island = currentIsland(),
    prev = game.islands[n - 1];
  // by default the ship is wherever the previous island's sailing path ends
  if (prev && prev.sailPath) placeShipAt(1, prev.sailPath);
  game.flagUp = true;
  setUnderwater(!!island.underwater);
  gull.g.visible = !island.underwater;
  player.pos.copy(island.spawn);
  player.vel.set(0, 0, 0);
  player.yaw = Math.PI;
  followCam.yaw = 0;
  snapCamera();
  if (arrived) clearProgress();
  island.enter?.(arrived);
  if (!arrived) restoreProgress(island);
  gullJoinsShip();
  game.state = 'play';
  $('#skip').classList.add('hidden');
  renderTasks();
  updatePowerHud();
  writeSave({ island: n });
  showTitleCard(`Island ${n}`, island.name);
  sfx.fruit();
  showIntro(island.intro || []);
}

// the "To be continued…" panel at the end of the islands so far; text replaces its paragraph
export function showEnd(text) {
  sfx.win();
  if (text) $('#end p').textContent = text;
  $('#end').classList.remove('hidden');
}

// the island after the current one, if it's ready to visit (a `preview` one only in dev/?debug)
export function nextIsland() {
  const next = game.islands[game.island + 1];
  return next && (!next.preview || game.debug) ? next : null;
}

export function restartFromBeginning() {
  writeSave({ island: 1, progress: null, treasures: [] });
  // drop any #hash so the reload really starts fresh
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch {}
  location.reload();
}
