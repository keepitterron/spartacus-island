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
export function buildWhale() {
  const Bl = material(0x3d6fd6),
    Bel = material(0xbfd6ff),
    I = material(0x1c2333);
  const body = mesh(new THREE.CapsuleGeometry(3, 9, 6, 14), Bl);
  body.rotation.x = Math.PI / 2;
  whale.add(body);
  const belly = mesh(new THREE.CapsuleGeometry(2.4, 8, 6, 12), Bel);
  belly.rotation.x = Math.PI / 2;
  belly.position.set(0, -1.1, 0.4);
  whale.add(belly);
  whale.userData.tail = new THREE.Group();
  whale.userData.tail.position.set(0, 0, -7.2);
  whale.add(whale.userData.tail);
  for (const sd of [-1, 1]) {
    const f = mesh(new THREE.BoxGeometry(3.2, 0.35, 1.8), Bl);
    f.position.set(sd * 1.6, 0, -0.6);
    f.rotation.y = sd * 0.35;
    whale.userData.tail.add(f);
    const fin = mesh(new THREE.BoxGeometry(2.4, 0.3, 1.2), Bl);
    fin.position.set(sd * 3.2, -1, 1.5);
    fin.rotation.z = sd * -0.4;
    whale.add(fin);
    const e = mesh(new THREE.SphereGeometry(0.32, 8, 6), I, { castShadow: false });
    e.position.set(sd * 2.3, 0.3, 4.6);
    whale.add(e);
  }
  const sm = mesh(new THREE.TorusGeometry(1, 0.1, 5, 14, Math.PI), I, { castShadow: false });
  sm.rotation.z = Math.PI;
  sm.position.set(0, -0.3, 5.85);
  whale.add(sm);
  whale.visible = false;
  scene.add(whale);
}

const wh = { t: 0, shown: false, popped: false, popT: 0 };
export function startWhale() {
  if (!isPlaying()) return;
  hideWin();
  if (player.carry) useUpCarried();
  player.climb = player.zip = player.swing = null;
  game.state = 'whale';
  wh.t = 0;
  whale.visible = true;
  whale.position.set(ship.position.x - 45, shipState.baseY - 4, ship.position.z + 12);
  sfx.whale();
  updatePowerHud();
}

game.cutscenes.whale = {
  update(dt) {
    const T = game.T;
    wh.t += dt;
    const tgt = vec3(ship.position.x, shipState.baseY - 4.6, ship.position.z);
    whale.userData.tail.rotation.x = Math.sin(T * 2.5) * 0.35;
    if (wh.t < 5) {
      whale.position.lerp(tgt, 1 - Math.exp(-dt * 0.9));
      whale.rotation.y = lerpAngle(
        whale.rotation.y,
        Math.atan2(tgt.x - whale.position.x, tgt.z - whale.position.z),
        Math.min(1, dt * 2),
      );
    } else {
      if (shipState.baseY < -0.15) shipState.baseY = Math.min(-0.15, shipState.baseY + dt * 3.2);
      whale.position.lerp(
        vec3(ship.position.x, shipState.baseY - 4.6, ship.position.z),
        1 - Math.exp(-dt * 4),
      );
    }
    player.pos.copy(onDeck());
    player.yaw = ship.rotation.y;
    if (ambience.under && shipState.baseY > -3) setUnderwater(false);
    if (!wh.popped && shipState.baseY >= -0.15) {
      wh.popped = true;
      wh.popT = 0;
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
    if (wh.popped) {
      wh.popT += dt;
      if (Math.random() < dt * 14)
        burst(vec3(whale.position.x, 0.3, whale.position.z + 5), {
          count: 2,
          color: [0xffffff, 0xbff3ff],
          speed: 2,
          up: 9,
          life: 1,
          size: 1,
        });
      if (wh.popT > 2.5 && !wh.shown) {
        wh.shown = true;
        sfx.win();
        $('#end').classList.remove('hidden');
      }
    }
    const a = T * 0.2,
      want = vec3(
        ship.position.x + Math.sin(a) * 18,
        ship.position.y + 5,
        ship.position.z + Math.cos(a) * 18,
      );
    camera.position.lerp(want, 1 - Math.exp(-dt * 2.5));
    camera.lookAt(ship.position.x, ship.position.y, ship.position.z);
  },
};
