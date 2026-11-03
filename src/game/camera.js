// Third-person follow camera. Q/E or dragging turns it (followCam.yaw); islands can add
//   camera:{minY(pos), maxY, assist(dt)}   e.g. stay under the water surface, or turn
//   down a corridor. assist only runs while the player isn't turning the camera.
import { vec3 } from '../core/util.js';
import { camera } from '../core/renderer.js';
import { game, followCam, currentIsland, isPlaying } from '../core/state.js';
import { keys, drag } from '../core/input.js';
import { player } from '../player/player.js';

// the smoothed point the camera looks at (a little above Spartacus)
const lookTarget = vec3();
export function snapCamera() {
  lookTarget.copy(player.pos);
  camera.position.set(
    player.pos.x,
    player.pos.y + followCam.height,
    player.pos.z + followCam.distance,
  );
}
// the title screen: slowly circle island 1
export function orbitCamera() {
  const angle = game.time * 0.1;
  camera.position.set(Math.sin(angle) * 50, 22, Math.cos(angle) * 50);
  camera.lookAt(0, 2, 0);
}
export function updateCamera(dt) {
  const islandCam = currentIsland().camera || {};
  if (keys.q) followCam.yaw += 1.8 * dt;
  if (keys.e) followCam.yaw -= 1.8 * dt;
  const turning = drag.id !== null || keys.q || keys.e;
  if (islandCam.assist && isPlaying() && !turning) islandCam.assist(dt);
  // closer in while he's tiny (Mini-Me), so he doesn't get lost on screen
  const zoom = 0.55 + 0.45 * player.size;
  // looser follow while swinging so the arc reads
  lookTarget.lerp(
    vec3()
      .copy(player.pos)
      .add(vec3(0, 1.3 * player.size, 0)),
    1 - Math.exp(-dt * (player.swing ? 5 : 8)),
  );
  const wanted = vec3(
    lookTarget.x + Math.sin(followCam.yaw) * followCam.distance * zoom,
    lookTarget.y + followCam.height * zoom,
    lookTarget.z + Math.cos(followCam.yaw) * followCam.distance * zoom,
  );
  camera.position.lerp(wanted, 1 - Math.exp(-dt * 6));
  const minY = islandCam.minY ? islandCam.minY(camera.position) : 1.2;
  if (camera.position.y < minY) camera.position.y = minY;
  if (islandCam.maxY !== undefined && camera.position.y > islandCam.maxY)
    camera.position.y = islandCam.maxY;
  camera.lookAt(lookTarget);
}
