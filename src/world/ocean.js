// Patches of sea: a flat sea floor plus an animated water surface. One big patch sits under
// islands 1-3; islands further out add their own with addSea() in build().
// (The underwater island is out at z=-720 and has its own surface, seen from below.)
import * as THREE from 'three';
import { scene, camera, LOW_POWER, ambience } from '../core/renderer.js';
import { material, mesh } from '../core/materials.js';
import { game } from '../core/state.js';

// {geo, cx, cz, halfW, halfD}: only patches near the camera animate
const patches = [];
const WAVE_CELL = 660 / 90; // the size of one wave square in the original patch
// further than this from a patch's edge its waves stand still (they are deep in the fog by then),
// so island 3 doesn't also animate the sea out to island 5
const ANIMATE_WITHIN = 120;

// a sea patch width (x) by depth (z) around (cx, cz)
export function addSea(cx, cz, { width, depth }) {
  const floor = mesh(new THREE.PlaneGeometry(width + 40, depth + 40), material(0x1d7f9c), {
    castShadow: false,
  });
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, -4.2, cz);
  scene.add(floor);
  const cell = WAVE_CELL * (LOW_POWER ? 1.8 : 1);
  const geo = new THREE.PlaneGeometry(
    width,
    depth,
    Math.round(width / cell),
    Math.round(depth / cell),
  );
  geo.rotateX(-Math.PI / 2);
  geo.translate(cx, 0, cz);
  scene.add(
    mesh(
      geo,
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
  patches.push({ geo, cx, cz, halfW: width / 2, halfD: depth / 2 });
}
addSea(0, -130, { width: 660, depth: 660 });

const nearCamera = (patch) =>
  Math.abs(camera.position.x - patch.cx) < patch.halfW + ANIMATE_WITHIN &&
  Math.abs(camera.position.z - patch.cz) < patch.halfD + ANIMATE_WITHIN;

export function updateOcean() {
  if (ambience.under) return; // can't be seen from the sea floor, skip the per-vertex work
  for (const patch of patches) if (nearCamera(patch)) animateWaves(patch.geo);
}

// two crossing sine waves, recomputed on every vertex each frame
function animateWaves(geo) {
  const time = game.time;
  const positions = geo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    positions.setY(
      i,
      0.12 * Math.sin(x * 0.3 + time * 1.4) + 0.1 * Math.cos(z * 0.35 + time * 1.1),
    );
  }
  positions.needsUpdate = true;
  geo.computeVertexNormals();
}
