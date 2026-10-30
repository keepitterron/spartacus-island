import { terrainHeight } from '../world/terrain.js';

// Everything you can stand on or bump into. Flat list, checked every frame:
//   {type:'cyl', x,z, r, bottom, top}   or   {type:'box', x,z, hw,hd, bottom, top}
// A cylinder with `.tree` set is climbable once tree.grown is true.
// To switch a collider off, set top=-999.
export const colliders = [];
export const addCylinder = (x, z, { r, bottom, top }) => {
  const c = { type: 'cyl', x, z, r, bottom, top };
  colliders.push(c);
  return c;
};
export const addBox = (x, z, { hw, hd, bottom, top }) => {
  const c = { type: 'box', x, z, hw, hd, bottom, top };
  colliders.push(c);
  return c;
};

// is point p ({x, z}) inside collider c's footprint, grown by pad?
export function inFootprint(c, p, pad = 0) {
  return c.type === 'cyl'
    ? Math.hypot(p.x - c.x, p.z - c.z) < c.r + pad
    : Math.abs(p.x - c.x) < c.hw + pad && Math.abs(p.z - c.z) < c.hd + pad;
}
// highest surface under (x,z) that is not above maxY
export function supportHeight(x, z, maxY) {
  let height = terrainHeight(x, z);
  for (const c of colliders)
    if (c.top <= maxY && inFootprint(c, { x, z })) height = Math.max(height, c.top);
  return height;
}
// push a round body out of collider c, cancelling the velocity that points into it
export function pushOut(c, { pos, vel, radius }) {
  if (c.type === 'cyl') pushOutOfCylinder(c, { pos, vel, radius });
  else pushOutOfBox(c, { pos, vel, radius });
}
function pushOutOfCylinder(c, { pos, vel, radius }) {
  const dx = pos.x - c.x;
  const dz = pos.z - c.z;
  const dist = Math.hypot(dx, dz) || 1e-4;
  const minDist = c.r + radius;
  if (dist >= minDist) return;
  const nx = dx / dist;
  const nz = dz / dist;
  pos.x = c.x + nx * minDist;
  pos.z = c.z + nz * minDist;
  const inward = vel.x * nx + vel.z * nz;
  if (inward < 0) {
    vel.x -= inward * nx;
    vel.z -= inward * nz;
  }
}
// leave the box along whichever axis needs the smaller push
function pushOutOfBox(c, { pos, vel, radius }) {
  const extentX = c.hw + radius;
  const extentZ = c.hd + radius;
  const dx = pos.x - c.x;
  const dz = pos.z - c.z;
  if (Math.abs(dx) >= extentX || Math.abs(dz) >= extentZ) return;
  if (extentX - Math.abs(dx) < extentZ - Math.abs(dz)) {
    const side = Math.sign(dx) || 1;
    pos.x = c.x + side * extentX;
    if (vel.x * side < 0) vel.x = 0;
  } else {
    const side = Math.sign(dz) || 1;
    pos.z = c.z + side * extentZ;
    if (vel.z * side < 0) vel.z = 0;
  }
}
