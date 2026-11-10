// Fairground rides: things that carry Spartacus along (a cannon shot, a gondola, a coaster
// cart). While player.ride is set, the main loop calls ride.update(dt) instead of walking him.
//   ride: {update(dt), pose?() -> {pitch, stretch}, quaternion?: THREE.Quaternion}
// pose() poses his body (a somersault); quaternion turns the whole dog (upside down in a loop).
import { lerpAngle } from '../core/util.js';
import { game, followCam } from '../core/state.js';
import { keys, drag } from '../core/input.js';
import { toast } from '../core/ui.js';
import { player } from '../player/player.js';
import { dog } from '../player/dog.js';

export function startRide(ride) {
  player.ride = ride;
  player.vel.set(0, 0, 0);
  player.grounded = false;
  player.sprinting = false;
  player.rolling = false;
  player.pounding = false;
  player.jumpBuffer = 0;
}

// off the ride and back to normal movement, keeping `vel` (a hop out, a landing)
export function endRide(vel) {
  player.ride = null;
  dog.root.visible = true;
  if (vel) player.vel.copy(vel);
  player.coyoteTimer = 0;
  player.jumpBuffer = 0;
}

// was Jump pressed since the last call? Rides read it as "hop out"
export function jumpPressed() {
  if (player.jumpBuffer <= 0) return false;
  player.jumpBuffer = 0;
  return true;
}

// a Mega-Me dog doesn't fit on any ride: say so (at most every 6 s) and return true
export function tooBigToRide() {
  if (!player.giant) return false;
  if (game.hintCooldown <= 0) {
    game.hintCooldown = 6;
    toast('Too big for the ride! Mega-Me wears off soon.', 2600);
  }
  return true;
}

// ease the camera round behind the way he's travelling (heading: a yaw), unless the player is
// turning it themself
export function cameraBehind(heading, dt) {
  if (drag.id !== null || keys.q || keys.e) return;
  followCam.yaw = lerpAngle(followCam.yaw, heading + Math.PI, Math.min(1, dt * 1.8));
}
