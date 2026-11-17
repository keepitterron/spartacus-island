// Static scenery batching, for phones: things that never move once built (palm trunks, rocks,
// bushes, flowers, docks, Blender scenery) are merged into one mesh per material per patch of the
// map, so an island draws in a few dozen calls instead of over a thousand. Patches keep it
// cullable: what's behind the camera, or outside the sun's shadow box, is still skipped.
//
// Build code calls addStatic(mesh) for a mesh already placed in the scene (directly or inside a
// group); main.js calls batchStatics() once, after every island is built. Don't register anything
// that moves, hides, gets picked up or is looked up later: it stops being its own object.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { scene } from '../core/renderer.js';
import { mesh } from '../core/materials.js';

const PATCH = 40; // m: the side of a patch of the map that's merged together
const pending = [];

export function addStatic(object) {
  pending.push(object);
}

// Merges everything registered so far. Meshes with a texture (and anything hidden) are left alone.
export function batchStatics() {
  scene.updateMatrixWorld(true);
  const batches = new Map(); // key -> {material, castShadow, receiveShadow, geometries}
  for (const object of pending.splice(0)) {
    if (!object.isMesh || !object.visible || object.material.map || Array.isArray(object.material))
      continue;
    const key = batchKey(object);
    const batch = batches.get(key) ?? {
      material: object.material,
      castShadow: object.castShadow,
      receiveShadow: object.receiveShadow,
      geometries: [],
    };
    batch.geometries.push(placedGeometry(object));
    batches.set(key, batch);
    object.removeFromParent();
  }
  for (const batch of batches.values()) {
    const merged = mergeGeometries(batch.geometries);
    for (const geometry of batch.geometries) geometry.dispose();
    merged.computeBoundingSphere();
    scene.add(mesh(merged, batch.material, batch));
  }
}

function batchKey(object) {
  const at = object.getWorldPosition(new THREE.Vector3());
  const patch = `${Math.floor(at.x / PATCH)},${Math.floor(at.z / PATCH)}`;
  return `${object.material.uuid} ${object.castShadow} ${object.receiveShadow} ${patch}`;
}

// a copy of the mesh's geometry moved to where it stands in the world, with only what a plain
// flat-shaded material needs (so geometries of every kind can be merged)
function placedGeometry(object) {
  const source = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', source.getAttribute('position').clone());
  if (source.getAttribute('normal'))
    geometry.setAttribute('normal', source.getAttribute('normal').clone());
  else geometry.computeVertexNormals();
  if (source !== object.geometry) source.dispose();
  geometry.applyMatrix4(object.matrixWorld);
  return geometry;
}
