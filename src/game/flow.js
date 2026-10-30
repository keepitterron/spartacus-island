import { $ } from '../core/util.js';
import { canvas, setUnderwater } from '../core/renderer.js';
import { game, followCam, currentIsland } from '../core/state.js';
import { sfx, audioContext } from '../core/audio.js';
import { toast, showTitleCard } from '../core/ui.js';
import { writeSave } from '../core/save.js';
import { placeShipAt } from '../world/ship.js';
import { player, SPAWN, clearSafeSpots } from '../player/player.js';
import { updatePowerHud } from '../systems/powers.js';
import { gull, gullJoinsShip } from '../npcs/gull.js';
import { renderTasks } from './tasks.js';
import { snapCamera } from './camera.js';

// Starting the game and arriving on islands.

// schedule an island's intro messages: [[delayMs, text, durationMs], …]
const intro = (list) => list.forEach(([at, msg, ms]) => setTimeout(() => toast(msg, ms), at));

export function startGame(n) {
  if (game.state !== 'start') return;
  audioContext();
  $('#start').classList.add('hidden');
  canvas.focus();
  if (n >= 2) {
    enterIsland(n, false);
    return;
  }
  game.state = 'play';
  writeSave({ island: 1 });
  intro(game.islands[1].intro || []);
}

// arrived = came by ship (false when jumping in from Continue)
export function enterIsland(n, arrived) {
  game.island = n;
  const I = currentIsland(),
    prev = game.islands[n - 1];
  // by default the ship is wherever the previous island's sailing path ends
  if (prev && prev.sailPath) placeShipAt(1, prev.sailPath);
  game.flagUp = true;
  setUnderwater(!!I.underwater);
  gull.g.visible = !I.underwater;
  SPAWN.copy(I.spawn);
  player.pos.copy(I.spawn);
  player.vel.set(0, 0, 0);
  player.yaw = Math.PI;
  clearSafeSpots();
  followCam.yaw = 0;
  snapCamera();
  I.enter?.(arrived);
  gullJoinsShip();
  game.state = 'play';
  $('#skip').classList.add('hidden');
  renderTasks();
  updatePowerHud();
  writeSave({ island: n });
  showTitleCard(`Island ${n}`, I.name);
  sfx.fruit();
  intro(I.intro || []);
}

export function restartFromBeginning() {
  writeSave({ island: 1 });
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch (e) {}
  location.reload();
}
