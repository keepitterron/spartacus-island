import { $ } from '../core/util.js';
import { canvas, setAmbience } from '../core/renderer.js';
import { G, cam, cur } from '../core/state.js';
import { sfx, ac } from '../core/audio.js';
import { toast, showCard } from '../core/ui.js';
import { writeSave } from '../core/save.js';
import { placeShipAt } from '../world/ship.js';
import { P, SPAWN, clearSafe } from '../player/player.js';
import { updPower } from '../systems/powers.js';
import { gull, gullJoinsShip } from '../npcs/gull.js';
import { renderTasks } from './tasks.js';
import { snapCamera } from './camera.js';

// Starting the game and arriving on islands.

// schedule an island's intro messages: [[delayMs, text, durationMs], …]
const intro = (list) => list.forEach(([at, msg, ms]) => setTimeout(() => toast(msg, ms), at));

export function startGame(n) {
  if (G.state !== 'start') return;
  ac();
  $('#start').classList.add('hidden');
  canvas.focus();
  if (n >= 2) {
    enterIsland(n, false);
    return;
  }
  G.state = 'play';
  writeSave({ island: 1 });
  intro(G.islands[1].intro || []);
}

// arrived = came by ship (false when jumping in from Continue)
export function enterIsland(n, arrived) {
  G.island = n;
  const I = cur(),
    prev = G.islands[n - 1];
  // by default the ship is wherever the previous island's sailing path ends
  if (prev && prev.sailPath) placeShipAt(1, prev.sailPath);
  G.flagUp = true;
  setAmbience(!!I.underwater);
  gull.g.visible = !I.underwater;
  SPAWN.copy(I.spawn);
  P.pos.copy(I.spawn);
  P.vel.set(0, 0, 0);
  P.yaw = Math.PI;
  clearSafe();
  cam.yaw = 0;
  snapCamera();
  I.enter?.(arrived);
  gullJoinsShip();
  G.state = 'play';
  $('#skip').classList.add('hidden');
  renderTasks();
  updPower();
  writeSave({ island: n });
  showCard(`Island ${n}`, I.name);
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
