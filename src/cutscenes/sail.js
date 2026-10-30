// Sailing cutscene: the ship follows a Catmull-Rom path (~13 s, skippable) to the next island.
import { $, vec3 } from '../core/util.js';
import { camera } from '../core/renderer.js';
import { game, isPlaying } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { toast } from '../core/ui.js';
import { ship, placeShipAt, onDeck } from '../world/ship.js';
import { player } from '../player/player.js';
import { useUpCarried } from '../systems/items.js';
import { updatePowerHud } from '../systems/powers.js';
import { hideWin } from '../game/tasks.js';
import { gull, wakeGull } from '../npcs/gull.js';

const SAIL_TIME = 13;
// t: 0..1 along the path
const voyage = { t: 0, path: null, onArrive: null };
export function startSail(path, onArrive) {
  if (!isPlaying()) return;
  hideWin();
  if (player.carrying) useUpCarried();
  Object.assign(voyage, { t: 0, path, onArrive });
  game.state = 'sail';
  player.swing = null;
  $('#skip').classList.remove('hidden');
  updatePowerHud();
  sfx.horn();
  if (gull.state === 'sleep') wakeGull();
  toast('Anchors up! Off to the next island…', 3000);
}
export const skipSail = () => {
  voyage.t = 1;
};
$('#skip').addEventListener('click', skipSail);

game.cutscenes.sail = {
  update(dt) {
    voyage.t = Math.min(1, voyage.t + dt / SAIL_TIME);
    placeShipAt(voyage.t, voyage.path);
    player.pos.copy(onDeck());
    player.yaw = ship.rotation.y;
    player.vel.set(0, 0, 0);
    player.grounded = true;
    // watch from behind and to the side of the ship
    const viewYaw = ship.rotation.y + 2.3,
      wanted = vec3(
        ship.position.x + Math.sin(viewYaw) * 16,
        9,
        ship.position.z + Math.cos(viewYaw) * 16,
      );
    camera.position.lerp(wanted, 1 - Math.exp(-dt * 2.5));
    camera.lookAt(ship.position.x, 2, ship.position.z);
    if (voyage.t >= 1) {
      $('#skip').classList.add('hidden');
      voyage.onArrive();
    }
  },
  skip: skipSail,
};
