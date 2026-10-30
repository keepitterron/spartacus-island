// Small math and DOM helpers, and the seeded random generator all scenery shares.
import * as THREE from 'three';

export const $ = (selector) => document.querySelector(selector);
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// interpolate between two angles the short way round
export function lerpAngle(a, b, t) {
  const TURN = Math.PI * 2;
  const diff = ((((b - a + Math.PI) % TURN) + TURN) % TURN) - Math.PI;
  return a + diff * t;
}
// mulberry32: a tiny, fast PRNG that returns 0..1 and repeats for the same seed
export function seededRandom(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// one seeded generator for all scenery: islands must be built in the same order every time
// (see main.js) or trees, flowers and coral move around
export const rand = seededRandom(42);
export const vec3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const distXZ = (a, x, z) => Math.hypot(a.x - x, a.z - z);
// distance from p to the segment a-b, ignoring height
export function distToSegmentXZ(p, a, b) {
  const vx = b.x - a.x;
  const vz = b.z - a.z;
  const t = clamp(((p.x - a.x) * vx + (p.z - a.z) * vz) / (vx * vx + vz * vz), 0, 1);
  return Math.hypot(p.x - (a.x + vx * t), p.z - (a.z + vz * t));
}
