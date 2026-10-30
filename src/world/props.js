// Reusable scenery. Each one sits on the terrain and adds its own collider.
// Several use the shared seeded rand(), so call them in a fixed order inside build().
import * as THREE from 'three';
import { rand } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { material, mesh } from '../core/materials.js';
import { addCylinder, addBox } from '../core/colliders.js';
import { terrainHeight } from './terrain.js';

// every palm's {x, z, ground, crown, coconuts, shake}, so barking can shake them (systems/reactions.js)
export const palms = [];

// a leaning palm: six trunk segments, seven fronds and three coconuts
export function palm(x, z) {
  const ground = terrainHeight(x, z);
  const g = new THREE.Group();
  g.position.set(x, ground, z);
  g.rotation.y = rand() * 6.28;
  const lean = 0.15 + rand() * 0.2;
  let offsetX = 0; // each segment shifts a bit further sideways, so the trunk curves
  for (let i = 0; i < 6; i++) {
    const segment = mesh(
      new THREE.CylinderGeometry(0.2 - i * 0.012, 0.24 - i * 0.012, 0.82, 6),
      material(i % 2 ? 0xb98250 : 0xa8723f),
    );
    offsetX += lean * i * 0.04;
    segment.position.set(offsetX, 0.41 + i * 0.78, 0);
    segment.rotation.z = -lean * 0.25;
    g.add(segment);
  }
  const crown = new THREE.Group();
  crown.position.set(offsetX, 4.7, 0);
  g.add(crown);
  const frondGeo = new THREE.ConeGeometry(0.5, 2.6, 4);
  frondGeo.scale(1, 1, 0.25);
  for (let k = 0; k < 7; k++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (k * Math.PI * 2) / 7;
    const frond = mesh(frondGeo, material(k % 2 ? 0x3fae4f : 0x4cc05a));
    frond.rotation.z = -Math.PI / 2 - 0.45;
    frond.position.set(1.15, -0.35, 0);
    pivot.add(frond);
    crown.add(pivot);
  }
  const coconuts = [];
  for (let k = 0; k < 3; k++) {
    const coconut = mesh(new THREE.IcosahedronGeometry(0.17, 0), material(0x7a4a2a));
    coconut.position.set(Math.cos(k * 2.1) * 0.25, -0.2, Math.sin(k * 2.1) * 0.25);
    crown.add(coconut);
    coconuts.push(coconut);
  }
  scene.add(g);
  palms.push({ x, z, ground, crown, coconuts, shake: 0 });
  addCylinder(x, z, { r: 0.35, bottom: ground - 1, top: ground + 4.8 });
}
// a mossy rock; returns its top height (something to stand on)
export function rock(x, z, { radius, height, color = 0xa3acb8 }) {
  const ground = terrainHeight(x, z);
  const m = mesh(
    new THREE.CylinderGeometry(radius * 0.88, radius * 1.12, height, 7),
    material(color),
    { receiveShadow: true },
  );
  m.position.set(x, ground + height / 2, z);
  m.rotation.y = rand() * 3;
  scene.add(m);
  const moss = mesh(
    new THREE.CylinderGeometry(radius * 0.9, radius * 0.9, 0.14, 7),
    material(0x7cc86a),
    { castShadow: false, receiveShadow: true },
  );
  moss.position.set(x, ground + height + 0.03, z);
  moss.rotation.y = m.rotation.y;
  scene.add(moss);
  addCylinder(x, z, { r: radius * 0.95, bottom: ground - 1, top: ground + height + 0.1 });
  return ground + height + 0.1;
}
// a rock whose top is at an absolute height
export const rockTop = (x, z, { radius, top, color }) =>
  rock(x, z, { radius, height: top - terrainHeight(x, z) - 0.1, color });
// a wooden crate with two darker bands; returns its top height
export function crate(x, z, { size = 1.1 } = {}) {
  const ground = terrainHeight(x, z);
  const m = mesh(new THREE.BoxGeometry(size, size, size), material(0xd4955a), {
    receiveShadow: true,
  });
  m.position.set(x, ground + size / 2, z);
  scene.add(m);
  for (const k of [-1, 1]) {
    const band = mesh(new THREE.BoxGeometry(size * 1.03, 0.14, size * 1.03), material(0x9c6436));
    band.position.set(x, ground + size / 2 + k * size * 0.36, z);
    scene.add(band);
  }
  addBox(x, z, { hw: size / 2, hd: size / 2, bottom: ground - 1, top: ground + size });
  return ground + size;
}
const FLOWER_COLORS = [0xff9fb2, 0xffd84d, 0xffffff, 0xb59cff];
// bushes and flowers around (cx,cz); allowed(x,z) keeps them off paths and puzzles.
// Blocked spots and ones below grass level are skipped, with a cap on attempts.
export function scatter(cx, cz, { radius, allowed, bushes, flowers }) {
  for (let tries = 0, placed = 0; tries < bushes * 4 && placed < bushes; tries++) {
    const angle = rand() * 6.28;
    const dist = 3 + rand() * radius;
    const x = cx + Math.cos(angle) * dist;
    const z = cz + Math.sin(angle) * dist;
    if (!allowed(x, z) || terrainHeight(x, z) < 0.6) continue;
    placed++;
    const bush = mesh(new THREE.IcosahedronGeometry(0.5 + rand() * 0.4, 0), material(0x54b84f));
    bush.position.set(x, terrainHeight(x, z) + 0.3, z);
    bush.scale.y = 0.75;
    scene.add(bush);
  }
  for (let tries = 0, placed = 0; tries < flowers * 3 && placed < flowers; tries++) {
    const angle = rand() * 6.28;
    const dist = 2 + rand() * radius;
    const x = cx + Math.cos(angle) * dist;
    const z = cz + Math.sin(angle) * dist;
    if (!allowed(x, z) || terrainHeight(x, z) < 0.6) continue;
    placed++;
    const flower = mesh(
      new THREE.IcosahedronGeometry(0.11, 0),
      material(FLOWER_COLORS[placed % 4]),
      { castShadow: false },
    );
    flower.position.set(x, terrainHeight(x, z) + 0.12, z);
    scene.add(flower);
  }
}
// a wooden dock running along +z from zFrom to zTo at x=cx, deck height .78
export function dock(cx, { zFrom, zTo }) {
  const top = 0.78;
  for (let z = zFrom, i = 0; z < zTo; z += 0.9, i++) {
    const plank = mesh(
      new THREE.BoxGeometry(2.4, 0.14, 0.82),
      material(i % 2 ? 0xc48a54 : 0xb57b46),
      { receiveShadow: true },
    );
    plank.position.set(cx, top - 0.07, z + 0.45);
    scene.add(plank);
  }
  for (let z = zFrom + 1; z <= zTo; z += 2.5)
    for (const x of [-1.15, 1.15]) {
      const post = mesh(new THREE.CylinderGeometry(0.13, 0.13, 3.2, 6), material(0x7a4a2a));
      post.position.set(cx + x, -0.75, z);
      scene.add(post);
    }
  addBox(cx, (zFrom + zTo) / 2, { hw: 1.2, hd: (zTo - zFrom) / 2, bottom: -3, top });
}
