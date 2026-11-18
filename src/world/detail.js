// Distance culling for small things, for phones. The camera draws everything up to the end of the
// fog, but a flower or a crate 130 m away is a few pixels deep in fog and still costs a draw call;
// from Hook Rock Bay most of what's drawn is island 1's and island 3's props. Small meshes past
// most of the fog are moved to a layer the camera doesn't draw (not hidden: game code that
// shows and hides things keeps working). Big things (merged scenery, rocks, the ground) are never
// touched, so islands still show on the horizon.
//
// collectDetails() once after the world is built; updateDetails(dt) every frame.
import * as THREE from 'three';
import { scene, camera } from '../core/renderer.js';

const SMALL = 1.5; // m radius: small things go first...
const MEDIUM = 5; // ...medium ones a bit further; anything bigger is always drawn
// how far into the fog (0 at fog.near, 1 at fog.far) each size stops being drawn
const SMALL_FOG = 0.6;
const MEDIUM_FOG = 0.8;
const CHECK_EVERY = 0.25; // s
const FAR_LAYER = 3; // a layer the camera never renders

const details = []; // {object, fogDepth, middle: the bounding sphere's centre, in its own space}
const at = new THREE.Vector3();
const check = { timer: 0 };

export function collectDetails() {
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (!object.isMesh || object.isInstancedMesh || !object.frustumCulled) return;
    if (object.material.fog === false || object.userData.alwaysDrawn) return;
    if (!object.geometry.boundingSphere) object.geometry.computeBoundingSphere();
    const radius = object.geometry.boundingSphere.radius * object.matrixWorld.getMaxScaleOnAxis();
    // the middle of what it draws, not its origin: merged scenery has its origin at the world's
    // centre, wherever its triangles are
    const middle = object.geometry.boundingSphere.center;
    if (radius < SMALL) details.push({ object, middle, fogDepth: SMALL_FOG });
    else if (radius < MEDIUM) details.push({ object, middle, fogDepth: MEDIUM_FOG });
  });
}

export function updateDetails(dt) {
  check.timer -= dt;
  if (check.timer > 0) return;
  check.timer = CHECK_EVERY;
  const { near, far } = scene.fog;
  const { x, z } = camera.position;
  for (const { object, middle, fogDepth } of details) {
    const reach = near + (far - near) * fogDepth;
    at.copy(middle).applyMatrix4(object.matrixWorld);
    const distant = Math.hypot(at.x - x, at.z - z) > reach;
    if (distant) object.layers.set(FAR_LAYER);
    else object.layers.set(0);
  }
}
