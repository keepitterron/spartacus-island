// Treasure chests with the Sun Gems in them, and the gems. Open a chest and its lid flips up with
// a fanfare, a gem floats out over it and drops into Spartacus's mouth. A chest can start hidden
// in the floor and rise when its puzzle is solved (the Mirror Hall's).
//
//   addChest(spot, { yaw, hidden, onOpen })   chest.rise()  chest.open({ quiet })
//   chestAction(p)   updateChests(dt)   makeSunGem(color)
import * as THREE from 'three';
import { clamp, distXZ, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { addBox } from '../../core/colliders.js';

const RISE_TIME = 1.6; // s for a hidden chest to come up out of the floor
const OPEN_REACH = 2.2;
const chests = [];

// a Sun Gem: a glowing gem in a little gold ring
export function makeSunGem(color) {
  const g = new THREE.Group();
  const gem = mesh(
    new THREE.OctahedronGeometry(0.28, 0),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.55,
      roughness: 0.25,
    }),
  );
  gem.scale.y = 1.3;
  g.add(gem);
  const ring = mesh(
    new THREE.TorusGeometry(0.3, 0.04, 6, 16),
    material(0xf2b84b, { metalness: 0.4 }),
  );
  g.add(ring);
  return g;
}

function makeChest() {
  const g = new THREE.Group();
  const wood = material(0xa8723f),
    gold = material(0xf2b84b, { metalness: 0.4 });
  const box = mesh(new THREE.BoxGeometry(1.3, 0.7, 0.85), wood);
  box.position.y = 0.35;
  g.add(box);
  for (const x of [-0.5, 0.5]) {
    const band = mesh(new THREE.BoxGeometry(0.12, 0.72, 0.87), gold);
    band.position.set(x, 0.35, 0);
    g.add(band);
  }
  // the lid hinges at the back
  const lid = new THREE.Group();
  lid.position.set(0, 0.7, -0.42);
  g.add(lid);
  const top = mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.3, 10, 1, false, 0, Math.PI), wood);
  top.rotation.z = Math.PI / 2;
  top.position.z = 0.42;
  lid.add(top);
  const latch = mesh(new THREE.BoxGeometry(0.22, 0.26, 0.1), gold);
  latch.position.set(0, 0.02, 0.86);
  lid.add(latch);
  return { g, lid };
}

// spot: where it stands; yaw: which way its front faces; hidden: under the floor until rise()
export function addChest(spot, { yaw = 0, hidden = false, onOpen }) {
  const { g, lid } = makeChest();
  g.position.set(spot.x, spot.y - (hidden ? 1.2 : 0), spot.z);
  g.rotation.y = yaw;
  g.visible = !hidden;
  scene.add(g);
  const collider = addBox(spot.x, spot.z, {
    hw: 0.65,
    hd: 0.65,
    bottom: spot.y - 1,
    top: hidden ? -999 : spot.y + 0.75,
  });
  const chest = {
    g,
    lid,
    spot,
    collider,
    hidden,
    rising: -1, // s into rising, -1 when still
    opened: false,
    opening: -1, // s into opening
    onOpen,
    rise({ quiet = false } = {}) {
      if (!chest.hidden) return;
      chest.hidden = false;
      g.visible = true;
      collider.top = spot.y + 0.75;
      if (quiet) g.position.y = spot.y;
      else {
        chest.rising = 0;
        sfx.rumble();
      }
    },
    open({ quiet = false } = {}) {
      if (chest.opened) return;
      chest.opened = true;
      if (quiet) {
        lid.rotation.x = -1.9;
        return;
      }
      chest.opening = 0;
      sfx.fanfare();
      onOpen?.(chest);
    },
  };
  chests.push(chest);
  return chest;
}

export function chestAction(p) {
  for (const chest of chests) {
    if (chest.opened || chest.hidden || chest.rising >= 0) continue;
    if (distXZ(p, chest.spot.x, chest.spot.z) < OPEN_REACH && Math.abs(p.y - chest.spot.y) < 1.2)
      return { label: 'Open', run: () => chest.open() };
  }
  return null;
}

export function updateChests(dt) {
  for (const chest of chests) {
    if (chest.rising >= 0) {
      chest.rising += dt;
      const t = clamp(chest.rising / RISE_TIME, 0, 1);
      chest.g.position.y = chest.spot.y - 1.2 * (1 - t * t * (3 - 2 * t));
      if (Math.random() < dt * 15)
        burst(vec3(chest.spot.x, chest.spot.y + 0.1, chest.spot.z), {
          count: 2,
          color: [0xe0c9a0, 0xfff3a8],
          speed: 2,
          up: 2,
          life: 0.6,
          size: 1,
        });
      if (t === 1) chest.rising = -1;
    }
    if (chest.opening >= 0) {
      chest.opening += dt;
      chest.lid.rotation.x = -1.9 * clamp(chest.opening / 0.5, 0, 1);
      if (chest.opening > 0.5) chest.opening = -1;
    }
    // a closed chest out in the open glints now and then, so it's easy to spot
    if (!chest.opened && !chest.hidden && Math.sin(game.time * 2 + chest.spot.x) > 0.995)
      burst(vec3(chest.spot.x, chest.spot.y + 0.9, chest.spot.z), {
        count: 4,
        color: [0xffd84d, 0xffffff],
        speed: 1,
        up: 2,
        life: 0.8,
        size: 1,
      });
  }
}
