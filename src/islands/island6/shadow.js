// A soft round shadow on the cloud under Spartacus while he floats, so it's easy to see where
// he'll land: real shadows are off on phones, and white on white is hard to judge anyway.
import * as THREE from 'three';
import { clamp } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { supportHeight } from '../../core/colliders.js';
import { player } from '../../player/player.js';
import { CLOUD_SEA_Y } from './clouds.js';

const RADIUS = 0.9; // close above a cloud; it shrinks to half this from high up
const shadow = { m: null };

export function buildLandingShadow() {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(1, 20),
    new THREE.MeshBasicMaterial({
      color: 0x34306a,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.visible = false;
  scene.add(m);
  shadow.m = m;
}

// only while he's in the air over a cloud (not over the cloud sea)
export function updateLandingShadow() {
  const m = shadow.m,
    pos = player.pos,
    ground = supportHeight(pos.x, pos.z, pos.y + 0.1),
    height = pos.y - ground;
  m.visible = !player.grounded && ground > CLOUD_SEA_Y && height > 0.3;
  if (!m.visible) return;
  m.position.set(pos.x, ground + 0.03, pos.z);
  const near = clamp(1 - height / 16, 0.5, 1);
  m.scale.setScalar(RADIUS * near);
  m.material.opacity = 0.4 * near;
}
