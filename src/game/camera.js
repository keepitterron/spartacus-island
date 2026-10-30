import { vec3 } from '../core/util.js';
import { camera } from '../core/renderer.js';
import { game, followCam, currentIsland, isPlaying } from '../core/state.js';
import { keys, drag } from '../core/input.js';
import { player } from '../player/player.js';

// Third-person follow camera. Q/E or dragging turns it (cam.yaw); islands can add
//   camera:{minY(pos), maxY, assist(dt)}   e.g. stay under the water surface, or turn
//   down a corridor. assist only runs while the player isn't turning the camera.
const target = vec3();
export function snapCamera() {
  target.copy(player.pos);
  camera.position.set(player.pos.x, player.pos.y + followCam.h, player.pos.z + followCam.dist);
}
export function orbitCamera() {
  const a = game.T * 0.1;
  camera.position.set(Math.sin(a) * 50, 22, Math.cos(a) * 50);
  camera.lookAt(0, 2, 0);
}
export function updateCamera(dt) {
  const C = currentIsland().camera || {};
  if (keys.q) followCam.yaw += 1.8 * dt;
  if (keys.e) followCam.yaw -= 1.8 * dt;
  if (C.assist && isPlaying() && drag.id === null && !keys.q && !keys.e) C.assist(dt);
  target.lerp(
    vec3()
      .copy(player.pos)
      .add(vec3(0, 1.3, 0)),
    1 - Math.exp(-dt * (player.swing ? 5 : 8)),
  );
  const want = vec3(
    target.x + Math.sin(followCam.yaw) * followCam.dist,
    target.y + followCam.h,
    target.z + Math.cos(followCam.yaw) * followCam.dist,
  );
  camera.position.lerp(want, 1 - Math.exp(-dt * 6));
  const minY = C.minY ? C.minY(camera.position) : 1.2;
  if (camera.position.y < minY) camera.position.y = minY;
  if (C.maxY !== undefined && camera.position.y > C.maxY) camera.position.y = C.maxY;
  camera.lookAt(target);
}
