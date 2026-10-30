// Drifting clouds: built once from the shared random sequence, then they slide along +x.
import * as THREE from 'three';
import { rand } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { material, mesh } from '../core/materials.js';

const clouds = [];
// called after the islands are built (it uses the shared random sequence)
export function buildSky() {
  for (let i = 0; i < 26; i++) {
    const g = new THREE.Group();
    const puffCount = 3 + Math.floor(rand() * 3);
    for (let k = 0; k < puffCount; k++) {
      const puff = mesh(new THREE.IcosahedronGeometry(1.4 + rand() * 1.2, 0), material(0xffffff), {
        castShadow: false,
      });
      puff.position.set(k * 1.6 - puffCount * 0.8, rand() * 0.6, rand() * 1.2);
      g.add(puff);
    }
    g.position.set(-110 + rand() * 220, 18 + rand() * 10, -390 + rand() * 450);
    g.userData.speed = 0.4 + rand() * 0.6;
    scene.add(g);
    clouds.push(g);
  }
}
export function updateSky(dt) {
  for (const cloud of clouds) {
    cloud.position.x += cloud.userData.speed * dt;
    if (cloud.position.x > 115) cloud.position.x = -115; // wrap around to the far side
  }
}
