import * as THREE from 'three';
import { scene, LOW_POWER, ambience } from '../core/renderer.js';
import { material, mesh } from '../core/materials.js';
import { game } from '../core/state.js';

// One sea floor and one animated water surface under all the land islands.
// (The underwater island is out at z=-720, beyond the edge of this plane.)
const floor = mesh(new THREE.PlaneGeometry(700, 700), material(0x1d7f9c), { castShadow: false });
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, -4.2, -130);
scene.add(floor);
const wGeo = new THREE.PlaneGeometry(660, 660, LOW_POWER ? 50 : 90, LOW_POWER ? 50 : 90);
wGeo.rotateX(-Math.PI / 2);
wGeo.translate(0, 0, -130);
scene.add(
  mesh(
    wGeo,
    new THREE.MeshStandardMaterial({
      color: 0x34b3d4,
      transparent: true,
      opacity: 0.78,
      flatShading: true,
      roughness: 0.35,
    }),
    { castShadow: false, receiveShadow: true },
  ),
);

export function updateOcean() {
  if (ambience.under) return; // can't be seen from the sea floor, skip the per-vertex work
  const T = game.time,
    wp = wGeo.attributes.position;
  for (let i = 0; i < wp.count; i++) {
    const x = wp.getX(i),
      z = wp.getZ(i);
    wp.setY(i, 0.12 * Math.sin(x * 0.3 + T * 1.4) + 0.1 * Math.cos(z * 0.35 + T * 1.1));
  }
  wp.needsUpdate = true;
  wGeo.computeVertexNormals();
}
