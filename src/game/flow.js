// Starting the game, arriving on islands and starting over.
import { $ } from '../core/util.js';
import { canvas, setUnderwater } from '../core/renderer.js';
import { game, followCam, currentIsland } from '../core/state.js';
import { sfx, audioContext } from '../core/audio.js';
import { startMusic } from '../core/music.js';
import { toast, showTitleCard } from '../core/ui.js';
import { writeSave } from '../core/save.js';
import { placeShipAt } from '../world/ship.js';
import { player, SPAWN, clearSafeSpots } from '../player/player.js';
import { updatePowerHud } from '../systems/powers.js';
import { gull, gullJoinsShip } from '../npcs/gull.js';
import { renderTasks } from './tasks.js';
import { snapCamera } from './camera.js';

// schedule an island's intro messages: [[delayMs, text, durationMs], …]
const showIntro = (messages) => {
  for (const [delay, text, duration] of messages) setTimeout(() => toast(text, duration), delay);
};

// island 1 starts right where the title screen is; later islands (Continue) go via enterIsland
export function startGame(n) {
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
  writeSave({ island: 1 });
  showIntro(game.islands[1].intro || []);
}

// arrived = came by ship (false when jumping in from Continue)
export function enterIsland(n, arrived) {
  game.island = n;
  const island = currentIsland(),
    prev = game.islands[n - 1];
  // by default the ship is wherever the previous island's sailing path ends
  if (prev && prev.sailPath) placeShipAt(1, prev.sailPath);
  game.flagUp = true;
  setUnderwater(!!island.underwater);
  gull.g.visible = !island.underwater;
  SPAWN.copy(island.spawn);
  player.pos.copy(island.spawn);
  player.vel.set(0, 0, 0);
  player.yaw = Math.PI;
  clearSafeSpots();
  followCam.yaw = 0;
  snapCamera();
  island.enter?.(arrived);
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

export function restartFromBeginning() {
  writeSave({ island: 1 });
  // drop any #hash so the reload really starts fresh
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch {}
  location.reload();
}
