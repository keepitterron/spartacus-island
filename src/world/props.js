// Reusable scenery. Each one sits on the terrain and adds its own collider.
// Several use the shared seeded rand(), so call them in a fixed order inside build().
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rand } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { material, mesh } from '../core/materials.js';
import { addCylinder, addBox } from '../core/colliders.js';
import { terrainHeight } from './terrain.js';
import { addStatic } from './statics.js';

// every palm's {x, z, ground, crown, coconuts, shake}, so barking can shake them (systems/reactions.js)
export const palms = [];

// Palm crowns and coconuts are drawn for every palm at once (instancing: a few draw calls in all,
// not five per palm). Each palm keeps an invisible crown group with three coconut placeholders in
// the scene, which the sway, shake and coconut-drop code moves as usual; updatePalms() copies where
// they are into the instanced meshes every frame.
const palmLook = { fronds: [], coconuts: null };

// Seven fronds round the crown, alternating two greens: one geometry per green, shared by every palm
function palmCrownGeometries() {
  const frond = new THREE.ConeGeometry(0.5, 2.6, 4);
  frond.scale(1, 1, 0.25);
  const placed = { 0x4cc05a: [], 0x3fae4f: [] };
  for (let k = 0; k < 7; k++) {
    // lying out and drooping, turned k sevenths of the way round
    const transform = new THREE.Matrix4()
      .makeRotationY((k * Math.PI * 2) / 7)
      .multiply(new THREE.Matrix4().makeTranslation(1.15, -0.35, 0))
      .multiply(new THREE.Matrix4().makeRotationZ(-Math.PI / 2 - 0.45));
    placed[k % 2 ? 0x3fae4f : 0x4cc05a].push(frond.clone().applyMatrix4(transform));
  }
  return Object.entries(placed).map(([color, geometries]) => [
    Number(color),
    mergeGeometries(geometries),
  ]);
}

// a leaning palm: six trunk segments (merged with the static scenery), a crown and three coconuts
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
    addStatic(segment); // the trunk never moves (only the crown shakes)
  }
  const crown = new THREE.Group();
  crown.position.set(offsetX, 4.7, 0);
  g.add(crown);
  const coconuts = [];
  for (let k = 0; k < 3; k++) {
    const coconut = new THREE.Object3D();
    coconut.position.set(Math.cos(k * 2.1) * 0.25, -0.2, Math.sin(k * 2.1) * 0.25);
    crown.add(coconut);
    coconuts.push(coconut);
  }
  scene.add(g);
  palms.push({ x, z, ground, crown, coconuts, shake: 0 });
  addCylinder(x, z, { r: 0.35, bottom: ground - 1, top: ground + 4.8 });
}

// after every palm is built (main.js): the instanced meshes that draw them all
export function buildPalms() {
  for (const [color, geometry] of palmCrownGeometries()) {
    const fronds = new THREE.InstancedMesh(geometry, material(color), palms.length);
    palmLook.fronds.push(fronds);
  }
  palmLook.coconuts = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.17, 0),
    material(0x7a4a2a),
    palms.length * 3,
  );
  for (const look of [...palmLook.fronds, palmLook.coconuts]) {
    look.castShadow = look !== palmLook.coconuts; // coconuts are too small to need a shadow
    look.receiveShadow = false;
    look.frustumCulled = false; // spread over every island: there's no one box round them
    scene.add(look);
  }
  updatePalms();
}

// per frame: copy each crown's and coconut's place in the world into the instanced meshes
// (their world matrices are from the last render, a frame behind, which nobody can see)
export function updatePalms() {
  palms.forEach((tree, i) => {
    for (const fronds of palmLook.fronds) fronds.setMatrixAt(i, tree.crown.matrixWorld);
    tree.coconuts.forEach((coconut, k) =>
      palmLook.coconuts.setMatrixAt(i * 3 + k, coconut.matrixWorld),
    );
  });
  for (const look of [...palmLook.fronds, palmLook.coconuts])
    look.instanceMatrix.needsUpdate = true;
}
// a mossy rock; returns its top height (something to stand on)
export function rock(x, z, { radius, height, color = 0xa3acb8 }) {
  const ground = terrainHeight(x, z);
  const body = new THREE.CylinderGeometry(radius * 0.88, radius * 1.12, height, 7, 3);
  dentSides(body, { seed: x * 7.3 + z * 3.1 });
  const m = mesh(body, material(color), { receiveShadow: true });
  m.position.set(x, ground + height / 2, z);
  m.rotation.y = rand() * 3;
  scene.add(m);
  addStatic(m);
  const moss = mesh(
    new THREE.CylinderGeometry(radius * 0.9, radius * 0.9, 0.14, 7),
    material(0x7cc86a),
    { castShadow: false, receiveShadow: true },
  );
  moss.position.set(x, ground + height + 0.03, z);
  moss.rotation.y = m.rotation.y;
  scene.add(moss);
  addStatic(moss);
  addCylinder(x, z, { r: radius * 0.95, bottom: ground - 1, top: ground + height + 0.1 });
  return ground + height + 0.1;
}
// Push the middle rows of a cylinder's side in and out a little, so a rock looks like a rock and
// not a can. The top and bottom rings stay put (they meet the caps and the moss). A fixed pattern
// from `seed`, not rand(): changing rocks must never move anyone's scenery.
function dentSides(geometry, { seed }) {
  const { radialSegments, heightSegments } = geometry.parameters;
  const position = geometry.getAttribute('position');
  for (let row = 1; row < heightSegments; row++)
    for (let column = 0; column <= radialSegments; column++) {
      const i = row * (radialSegments + 1) + column;
      // the seam's first and last vertex are the same point: dent them the same
      const hash = Math.sin((column % radialSegments) * 12.99 + row * 78.23 + seed) * 43758.5;
      const scale = 0.9 + 0.14 * (hash - Math.floor(hash));
      position.setXYZ(i, position.getX(i) * scale, position.getY(i), position.getZ(i) * scale);
    }
  geometry.computeVertexNormals();
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
    addStatic(bush);
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
    addStatic(flower);
  }
}
export const DOCK_TOP = 0.78; // how high a dock's deck is
// a wooden dock running along +z from zFrom to zTo at x=cx, its deck at DOCK_TOP
export function dock(cx, { zFrom, zTo }) {
  const top = DOCK_TOP;
  for (let z = zFrom, i = 0; z < zTo; z += 0.9, i++) {
    const plank = mesh(
      new THREE.BoxGeometry(2.4, 0.14, 0.82),
      material(i % 2 ? 0xc48a54 : 0xb57b46),
      { receiveShadow: true },
    );
    plank.position.set(cx, top - 0.07, z + 0.45);
    scene.add(plank);
    addStatic(plank);
  }
  for (let z = zFrom + 1; z <= zTo; z += 2.5)
    for (const x of [-1.15, 1.15]) {
      const post = mesh(new THREE.CylinderGeometry(0.13, 0.13, 3.2, 6), material(0x7a4a2a));
      post.position.set(cx + x, -0.75, z);
      scene.add(post);
      addStatic(post);
    }
  addBox(cx, (zFrom + zTo) / 2, { hw: 1.2, hd: (zTo - zFrom) / 2, bottom: -3, top });
}
