// Lina's updraft: golden sparkles rising round Spartacus while he floats, so the wind that holds
// him up can be seen. One Points object of about 100 points, only drawn while he's in the air.
import * as THREE from 'three';
import { clamp, seededRandom } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { player } from '../../player/player.js';

const COUNT = 100,
  RADIUS = 1.6, // how far round him the sparkles rise
  HEIGHT = 5, // from this far below his feet to this far above
  RISE = 3.5; // units per second
const sparkleRand = seededRandom(616);
// each sparkle's spot around him: {angle, dist, height (0..1 up the column)}
const sparkles = [];
const updraft = { points: null, fade: 0 };

export function buildUpdraft() {
  for (let i = 0; i < COUNT; i++)
    sparkles.push({
      angle: sparkleRand() * Math.PI * 2,
      dist: 0.3 + sparkleRand() * RADIUS,
      height: sparkleRand(),
    });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
  updraft.points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xffe9a8,
      size: 0.22,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  updraft.points.frustumCulled = false; // its points move with him every frame
  updraft.points.visible = false;
  scene.add(updraft.points);
}

// fades in while he's off the ground, out once he lands
export function updateUpdraft(dt) {
  const step = dt * 3;
  updraft.fade = clamp(updraft.fade + (player.grounded ? -step : step), 0, 1);
  const points = updraft.points;
  points.visible = updraft.fade > 0.01;
  if (!points.visible) return;
  points.material.opacity = updraft.fade * 0.9;
  const positions = points.geometry.attributes.position,
    { x, y, z } = player.pos;
  sparkles.forEach((sparkle, i) => {
    sparkle.height = (sparkle.height + (dt * RISE) / (HEIGHT * 2)) % 1;
    positions.setXYZ(
      i,
      x + Math.cos(sparkle.angle) * sparkle.dist,
      y - HEIGHT + sparkle.height * HEIGHT * 2,
      z + Math.sin(sparkle.angle) * sparkle.dist,
    );
  });
  positions.needsUpdate = true;
}
