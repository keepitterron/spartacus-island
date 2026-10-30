import * as THREE from 'three';
import { material, mesh } from '../core/materials.js';

// Small reusable models: carryable items and collectibles. Each returns a fresh Group.

export function makePlank(len) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(len + 0.3, 0.16, 0.75), material(0xd09a5e)));
  for (const x of [-2, 0, 2]) {
    const l = mesh(new THREE.BoxGeometry(0.06, 0.17, 0.76), material(0x9c6436), {
      castShadow: false,
    });
    l.position.x = x;
    g.add(l);
  }
  return g;
}
export function makeKey() {
  const g = new THREE.Group(),
    m = material(0xffc83d, { metalness: 0.4, roughness: 0.35 });
  const r = mesh(new THREE.TorusGeometry(0.14, 0.05, 6, 12), m);
  r.position.x = -0.3;
  g.add(r);
  g.add(mesh(new THREE.BoxGeometry(0.45, 0.07, 0.07), m));
  for (const x of [0.12, 0.2]) {
    const t = mesh(new THREE.BoxGeometry(0.05, 0.14, 0.06), m);
    t.position.set(x, -0.08, 0);
    g.add(t);
  }
  return g;
}
export function makeBoot() {
  const g = new THREE.Group(),
    m = material(0x6b4a2a);
  const l = mesh(new THREE.BoxGeometry(0.28, 0.5, 0.3), m);
  l.position.y = 0.12;
  g.add(l);
  const f = mesh(new THREE.BoxGeometry(0.28, 0.2, 0.5), m);
  f.position.set(0, -0.05, 0.15);
  g.add(f);
  return g;
}
export function makeTin() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.24, 12), material(0xf2545b)));
  const l = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 12), material(0xffd84d));
  l.position.y = 0.13;
  g.add(l);
  for (let k = 0; k < 3; k++) {
    const c = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 8), material(0xe0a95a), {
      castShadow: false,
    });
    c.position.set(Math.cos(k * 2.1) * 0.1, 0.18, Math.sin(k * 2.1) * 0.1);
    g.add(c);
  }
  return g;
}
export function makeBone() {
  const g = new THREE.Group(),
    m = material(0xfff6e8);
  const s = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.62, 6), m);
  s.rotation.z = Math.PI / 2;
  g.add(s);
  for (const a of [-0.33, 0.33])
    for (const b of [-0.09, 0.09]) {
      const k = mesh(new THREE.SphereGeometry(0.13, 8, 6), m);
      k.position.set(a, b, 0);
      g.add(k);
    }
  return g;
}
export function makeAcorn() {
  const g = new THREE.Group();
  const b = mesh(
    new THREE.SphereGeometry(0.2, 8, 6),
    material(0xffc83d, { metalness: 0.35, roughness: 0.4 }),
  );
  b.scale.y = 1.25;
  g.add(b);
  const c = mesh(
    new THREE.SphereGeometry(0.23, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
    material(0x9c6436),
  );
  c.position.y = 0.1;
  g.add(c);
  const st = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 4), material(0x6e4a30));
  st.position.y = 0.3;
  g.add(st);
  return g;
}
export function makeFlower() {
  const g = new THREE.Group();
  const st = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4), material(0x3fae4f));
  st.position.y = 0.25;
  g.add(st);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * 6.283,
      pt = mesh(new THREE.SphereGeometry(0.12, 6, 5), material(0xffd84d));
    pt.scale.set(1, 0.4, 1.3);
    pt.position.set(Math.cos(a) * 0.15, 0.52, Math.sin(a) * 0.15);
    pt.rotation.y = -a;
    g.add(pt);
  }
  const c = mesh(new THREE.SphereGeometry(0.09, 6, 5), material(0xff9a3d));
  c.position.y = 0.54;
  g.add(c);
  return g;
}
export function makePillow() {
  const g = new THREE.Group(),
    pm = material(0xffb3d1);
  g.add(mesh(new THREE.BoxGeometry(1.0, 0.35, 0.7), pm));
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const c = mesh(new THREE.SphereGeometry(0.18, 6, 5), pm);
      c.position.set(sx * 0.5, 0, sz * 0.35);
      g.add(c);
    }
  const st = mesh(new THREE.OctahedronGeometry(0.12, 0), material(0xffd84d), { castShadow: false });
  st.position.set(0, 0.19, 0);
  g.add(st);
  return g;
}
export const leafGeo = new THREE.SphereGeometry(0.18, 5, 4);
leafGeo.scale(1, 0.35, 1.6);
// glowing magic seed on a little mound (Grow-Grow)
export function makeSeed() {
  const g = new THREE.Group();
  const s = mesh(
    new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshStandardMaterial({
      color: 0x9be38a,
      emissive: 0x5fd35a,
      emissiveIntensity: 0.6,
      roughness: 0.4,
    }),
  );
  s.position.y = 0.3;
  g.add(s);
  for (const k of [-1, 1]) {
    const l = mesh(leafGeo, material(0x4cc05a), { castShadow: false });
    l.position.set(k * 0.2, 0.5, 0);
    l.rotation.z = k * 0.6;
    g.add(l);
  }
  const mound = mesh(new THREE.SphereGeometry(0.45, 8, 5), material(0x7a5a3a), {
    castShadow: false,
    receiveShadow: true,
  });
  mound.scale.y = 0.3;
  g.add(mound);
  return g;
}
