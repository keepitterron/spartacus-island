import * as THREE from 'three';
import { $, lerpAngle, vec3 } from '../../core/util.js';
import { scene, camera, ambience, setUnderwater } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { game, isPlaying } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { ship, shipBubble, shipState, onDeck } from '../../world/ship.js';
import { player } from '../../player/player.js';
import { useUpCarried } from '../../systems/items.js';
import { updatePowerHud } from '../../systems/powers.js';
import { hideWin } from '../../game/tasks.js';

// Ending of island 4: a big friendly whale swims under the ship and pushes it back up
// to the surface, the bubble pops, then "To be continued…".
const whale = new THREE.Group();
const tail = new THREE.Group();

export function buildWhale() {
  const blueMat = material(0x3d6fd6),
    bellyMat = material(0xbfd6ff),
    inkMat = material(0x1c2333);
  const body = mesh(new THREE.CapsuleGeometry(3, 9, 6, 14), blueMat);
  body.rotation.x = Math.PI / 2;
  whale.add(body);
  const belly = mesh(new THREE.CapsuleGeometry(2.4, 8, 6, 12), bellyMat);
  belly.rotation.x = Math.PI / 2;
  belly.position.set(0, -1.1, 0.4);
  whale.add(belly);
  tail.position.set(0, 0, -7.2);
  whale.add(tail);
  for (const side of [-1, 1]) {
    const fluke = mesh(new THREE.BoxGeometry(3.2, 0.35, 1.8), blueMat);
    fluke.position.set(side * 1.6, 0, -0.6);
    fluke.rotation.y = side * 0.35;
    tail.add(fluke);
    const fin = mesh(new THREE.BoxGeometry(2.4, 0.3, 1.2), blueMat);
    fin.position.set(side * 3.2, -1, 1.5);
    fin.rotation.z = side * -0.4;
    whale.add(fin);
    const eye = mesh(new THREE.SphereGeometry(0.32, 8, 6), inkMat, { castShadow: false });
    eye.position.set(side * 2.3, 0.3, 4.6);
    whale.add(eye);
  }
  const smile = mesh(new THREE.TorusGeometry(1, 0.1, 5, 14, Math.PI), inkMat, {
    castShadow: false,
  });
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.3, 5.85);
  whale.add(smile);
  whale.visible = false;
  scene.add(whale);
}

// cutscene progress: t = time since start, popT = time since the bubble popped
const ride = { t: 0, endShown: false, popped: false, popT: 0 };

export function startWhale() {
  if (!isPlaying()) return;
  hideWin();
  if (player.carrying) useUpCarried();
  player.climb = null;
  player.zip = null;
  player.swing = null;
  game.state = 'whale';
  ride.t = 0;
  whale.visible = true;
  whale.position.set(ship.position.x - 45, shipState.baseY - 4, ship.position.z + 12);
  sfx.whale();
  updatePowerHud();
}

// first 5s: swim in under the ship; then rise, pushing the ship up to the surface
function swimAndLift(dt) {
  const underShip = vec3(ship.position.x, shipState.baseY - 4.6, ship.position.z);
  if (ride.t < 5) {
    whale.position.lerp(underShip, 1 - Math.exp(-dt * 0.9));
    whale.rotation.y = lerpAngle(
      whale.rotation.y,
      Math.atan2(underShip.x - whale.position.x, underShip.z - whale.position.z),
      Math.min(1, dt * 2),
    );
    return;
  }
  if (shipState.baseY < -0.15) shipState.baseY = Math.min(-0.15, shipState.baseY + dt * 3.2);
  whale.position.lerp(
    vec3(ship.position.x, shipState.baseY - 4.6, ship.position.z),
    1 - Math.exp(-dt * 4),
  );
}

function popShipBubble() {
  ride.popped = true;
  ride.popT = 0;
  shipBubble.visible = false;
  sfx.pop();
  burst(ship.position.clone().add(vec3(0, 3, 0)), {
    count: 40,
    color: [0xdff9ff, 0xffffff],
    speed: 7,
    up: 4,
    life: 1.2,
    size: 1.3,
  });
  sfx.splashy();
}

// at the surface: the whale spouts, and after 2.5s the "To be continued…" screen shows
function spoutThenEnd(dt) {
  ride.popT += dt;
  if (Math.random() < dt * 14)
    burst(vec3(whale.position.x, 0.3, whale.position.z + 5), {
      count: 2,
      color: [0xffffff, 0xbff3ff],
      speed: 2,
      up: 9,
      life: 1,
      size: 1,
    });
  if (ride.popT > 2.5 && !ride.endShown) {
    ride.endShown = true;
    sfx.win();
    $('#end').classList.remove('hidden');
  }
}

game.cutscenes.whale = {
  update(dt) {
    const T = game.time;
    ride.t += dt;
    tail.rotation.x = Math.sin(T * 2.5) * 0.35;
    swimAndLift(dt);
    player.pos.copy(onDeck());
    player.yaw = ship.rotation.y;
    if (ambience.under && shipState.baseY > -3) setUnderwater(false);
    if (!ride.popped && shipState.baseY >= -0.15) popShipBubble();
    if (ride.popped) spoutThenEnd(dt);
    // slowly circle the ship
    const a = T * 0.2,
      camGoal = vec3(
        ship.position.x + Math.sin(a) * 18,
        ship.position.y + 5,
        ship.position.z + Math.cos(a) * 18,
      );
    camera.position.lerp(camGoal, 1 - Math.exp(-dt * 2.5));
    camera.lookAt(ship.position.x, ship.position.y, ship.position.z);
  },
};
