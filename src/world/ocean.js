// One sea floor and one animated water surface under all the land islands.
// (The underwater island is out at z=-720, beyond the edge of this plane.)
import * as THREE from 'three';
import { scene, LOW_POWER, ambience } from '../core/renderer.js';
import { material, mesh } from '../core/materials.js';
import { game } from '../core/state.js';

const floor = mesh(new THREE.PlaneGeometry(700, 700), material(0x1d7f9c), { castShadow: false });
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, -4.2, -130);
scene.add(floor);
const waterSegments = LOW_POWER ? 50 : 90;
const waterGeo = new THREE.PlaneGeometry(660, 660, waterSegments, waterSegments);
waterGeo.rotateX(-Math.PI / 2);
waterGeo.translate(0, 0, -130);
scene.add(
  mesh(
    waterGeo,
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
  // two crossing sine waves, recomputed on every vertex each frame
  const time = game.time;
  const positions = waterGeo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    positions.setY(
      i,
      0.12 * Math.sin(x * 0.3 + time * 1.4) + 0.1 * Math.cos(z * 0.35 + time * 1.1),
    );
  }
  positions.needsUpdate = true;
  waterGeo.computeVertexNormals();
}
