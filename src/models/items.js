// Small reusable models: carryable items and collectibles. Each returns a fresh Group.
import * as THREE from 'three';
import { material, mesh } from '../core/materials.js';

// a plank of length len (+0.3 overhang) with three darker seams
export function makePlank(len) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(len + 0.3, 0.16, 0.75), material(0xd09a5e)));
  for (const x of [-2, 0, 2]) {
    const seam = mesh(new THREE.BoxGeometry(0.06, 0.17, 0.76), material(0x9c6436), {
      castShadow: false,
    });
    seam.position.x = x;
    g.add(seam);
  }
  return g;
}
export function makeKey() {
  const g = new THREE.Group(),
    gold = material(0xffc83d, { metalness: 0.4, roughness: 0.35 });
  const bow = mesh(new THREE.TorusGeometry(0.14, 0.05, 6, 12), gold);
  bow.position.x = -0.3;
  g.add(bow);
  const shaft = mesh(new THREE.BoxGeometry(0.45, 0.07, 0.07), gold);
  g.add(shaft);
  for (const x of [0.12, 0.2]) {
    const tooth = mesh(new THREE.BoxGeometry(0.05, 0.14, 0.06), gold);
    tooth.position.set(x, -0.08, 0);
    g.add(tooth);
  }
  return g;
}
export function makeBoot() {
  const g = new THREE.Group(),
    leather = material(0x6b4a2a);
  const shaft = mesh(new THREE.BoxGeometry(0.28, 0.5, 0.3), leather);
  shaft.position.y = 0.12;
  g.add(shaft);
  const foot = mesh(new THREE.BoxGeometry(0.28, 0.2, 0.5), leather);
  foot.position.set(0, -0.05, 0.15);
  g.add(foot);
  return g;
}
// a red tin with a yellow lid and three biscuits on top
export function makeTin() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.24, 12), material(0xf2545b)));
  const lid = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 12), material(0xffd84d));
  lid.position.y = 0.13;
  g.add(lid);
  for (let k = 0; k < 3; k++) {
    const biscuit = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 8), material(0xe0a95a), {
      castShadow: false,
    });
    biscuit.position.set(Math.cos(k * 2.1) * 0.1, 0.18, Math.sin(k * 2.1) * 0.1);
    g.add(biscuit);
  }
  return g;
}
export function makeBone() {
  const g = new THREE.Group(),
    boneWhite = material(0xfff6e8);
  const shaft = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.62, 6), boneWhite);
  shaft.rotation.z = Math.PI / 2;
  g.add(shaft);
  // two knobs at each end
  for (const x of [-0.33, 0.33])
    for (const y of [-0.09, 0.09]) {
      const knob = mesh(new THREE.SphereGeometry(0.13, 8, 6), boneWhite);
      knob.position.set(x, y, 0);
      g.add(knob);
    }
  return g;
}
export function makeAcorn() {
  const g = new THREE.Group();
  const nut = mesh(
    new THREE.SphereGeometry(0.2, 8, 6),
    material(0xffc83d, { metalness: 0.35, roughness: 0.4 }),
  );
  nut.scale.y = 1.25;
  g.add(nut);
  const cap = mesh(
    new THREE.SphereGeometry(0.23, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
    material(0x9c6436),
  );
  cap.position.y = 0.1;
  g.add(cap);
  const stalk = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 4), material(0x6e4a30));
  stalk.position.y = 0.3;
  g.add(stalk);
  return g;
}
export function makeFlower() {
  const g = new THREE.Group();
  const stem = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4), material(0x3fae4f));
  stem.position.y = 0.25;
  g.add(stem);
  for (let k = 0; k < 6; k++) {
    const angle = (k / 6) * 6.283,
      petal = mesh(new THREE.SphereGeometry(0.12, 6, 5), material(0xffd84d));
    petal.scale.set(1, 0.4, 1.3);
    petal.position.set(Math.cos(angle) * 0.15, 0.52, Math.sin(angle) * 0.15);
    petal.rotation.y = -angle;
    g.add(petal);
  }
  const centre = mesh(new THREE.SphereGeometry(0.09, 6, 5), material(0xff9a3d));
  centre.position.y = 0.54;
  g.add(centre);
  return g;
}
export function makePillow() {
  const g = new THREE.Group(),
    pink = material(0xffb3d1);
  g.add(mesh(new THREE.BoxGeometry(1.0, 0.35, 0.7), pink));
  // rounded corners
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const corner = mesh(new THREE.SphereGeometry(0.18, 6, 5), pink);
      corner.position.set(sx * 0.5, 0, sz * 0.35);
      g.add(corner);
    }
  const star = mesh(new THREE.OctahedronGeometry(0.12, 0), material(0xffd84d), {
    castShadow: false,
  });
  star.position.set(0, 0.19, 0);
  g.add(star);
  return g;
}
// a flattened, stretched sphere shared by every leaf (vines, seeds)
export const leafGeo = new THREE.SphereGeometry(0.18, 5, 4);
leafGeo.scale(1, 0.35, 1.6);
// glowing magic seed on a little mound (Grow-Grow); children[0] is the seed (vines.js pulses it)
export function makeSeed() {
  const g = new THREE.Group();
  const seed = mesh(
    new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshStandardMaterial({
      color: 0x9be38a,
      emissive: 0x5fd35a,
      emissiveIntensity: 0.6,
      roughness: 0.4,
    }),
  );
  seed.position.y = 0.3;
  g.add(seed);
  for (const side of [-1, 1]) {
    const leaf = mesh(leafGeo, material(0x4cc05a), { castShadow: false });
    leaf.position.set(side * 0.2, 0.5, 0);
    leaf.rotation.z = side * 0.6;
    g.add(leaf);
  }
  const mound = mesh(new THREE.SphereGeometry(0.45, 8, 5), material(0x7a5a3a), {
    castShadow: false,
    receiveShadow: true,
  });
  mound.scale.y = 0.3;
  g.add(mound);
  return g;
}

// a wrapped present (a secret accessory inside): box, ribbon cross and a bow on top
export function makeGift(color) {
  const g = new THREE.Group(),
    ribbon = material(0xffd84d);
  g.add(mesh(new THREE.BoxGeometry(0.55, 0.45, 0.55), material(color)));
  for (const turn of [0, Math.PI / 2]) {
    const band = mesh(new THREE.BoxGeometry(0.12, 0.47, 0.57), ribbon, { castShadow: false });
    band.rotation.y = turn;
    g.add(band);
  }
  for (const side of [-1, 1]) {
    const loop = mesh(new THREE.TorusGeometry(0.1, 0.035, 5, 10), ribbon, { castShadow: false });
    loop.position.set(side * 0.09, 0.3, 0);
    loop.rotation.set(0, 0, side * 0.5);
    g.add(loop);
  }
  return g;
}
