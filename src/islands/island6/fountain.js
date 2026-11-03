// Lina's fountain in the middle of the palace cloud. It's dry until the Sky Jewel is back on
// top of its spout; then it sparkles again: water in the basin, a jet over the jewel, and
// rainbow droplets. buildFountain returns {top (where the jewel sits), light({quiet}), update(dt)}.
import * as THREE from 'three';
import { vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { addCylinder } from '../../core/colliders.js';
import { BANDS } from '../island5/finale.js';

const SPOUT_HEIGHT = 2;
const DROPS_EVERY = 0.12; // seconds between little bursts of droplets once it's lit

export function buildFountain(cloud) {
  const { x, z, top: y } = cloud,
    stone = material(0xe8e4f4);
  const basin = mesh(new THREE.CylinderGeometry(2, 2.2, 0.8, 16), stone, { castShadow: false });
  basin.position.set(x, y + 0.4, z);
  scene.add(basin);
  const spout = mesh(new THREE.CylinderGeometry(0.25, 0.4, SPOUT_HEIGHT, 8), stone);
  spout.position.set(x, y + SPOUT_HEIGHT / 2, z);
  scene.add(spout);
  addCylinder(x, z, { r: 2.2, bottom: y, top: y + 0.8 });
  // the water, hidden until it's lit: a sparkly pool and a jet rising over the jewel
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1.85, 20),
    new THREE.MeshStandardMaterial({
      color: 0x7fd8ff,
      emissive: 0x5ac8ff,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.8,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, y + 0.83, z); // just above the basin's top
  water.visible = false;
  scene.add(water);
  const jet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.22, 2.4, 8, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xbff3ff,
      emissive: 0x9fe6ff,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    }),
  );
  jet.position.set(x, y + SPOUT_HEIGHT + 1.6, z);
  jet.visible = false;
  scene.add(jet);
  const state = { lit: false, dropsIn: 0 };
  const jewelTop = vec3(x, y + SPOUT_HEIGHT, z);

  return {
    top: jewelTop,
    // quiet: a save being put back
    light({ quiet = false } = {}) {
      state.lit = true;
      water.visible = true;
      jet.visible = true;
      if (quiet) return;
      sfx.win();
      burst(jewelTop.clone().add(vec3(0, 1, 0)), {
        count: 60,
        color: [...BANDS, 0xffffff, 0xff7ad9],
        speed: 6,
        up: 6,
        life: 1.6,
        size: 1.2,
        confetti: true,
      });
    },
    update(dt) {
      if (!state.lit) return;
      jet.scale.y = 1 + Math.sin(game.time * 6) * 0.12;
      state.dropsIn -= dt;
      if (state.dropsIn > 0) return;
      state.dropsIn = DROPS_EVERY;
      burst(jewelTop.clone().add(vec3(0, 2.6, 0)), {
        count: 3,
        color: [0xbff3ff, 0xffffff, ...BANDS],
        speed: 2.5,
        up: 2,
        life: 1,
        size: 0.8,
      });
    },
  };
}
