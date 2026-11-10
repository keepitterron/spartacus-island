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
// a pink scallop shell standing up (island 5's collectible): a fan of ribs on a little hinge
export function makeShell() {
  const g = new THREE.Group();
  // each rib is a cone flipped tip-down, pivoting at the hinge
  const ribGeo = new THREE.ConeGeometry(0.09, 0.5, 5);
  ribGeo.rotateZ(Math.PI);
  ribGeo.translate(0, 0.25, 0);
  const ribs = 7;
  for (let i = 0; i < ribs; i++) {
    const rib = mesh(ribGeo, material(i % 2 ? 0xff9fb2 : 0xffc3cf));
    rib.rotation.z = ((i - (ribs - 1) / 2) / ribs) * 2.2;
    g.add(rib);
  }
  const hinge = mesh(new THREE.SphereGeometry(0.08, 6, 5), material(0xf27a92));
  g.add(hinge);
  g.position.y = -0.2;
  const holder = new THREE.Group();
  holder.add(g);
  return holder;
}
// a chunky five-pointed star that glows in its own colour (island 5's rainbow pieces)
export function makeStar(color) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 + Math.PI / 2,
      r = i % 2 ? 0.24 : 0.55;
    if (i === 0) shape.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
    else shape.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 1,
  });
  geo.center();
  const g = new THREE.Group();
  g.add(
    mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.55,
        roughness: 0.35,
      }),
    ),
  );
  return g;
}

// a shiny silver fork, lying flat: a handle and four tines (Leo the magpie loves shiny things)
export function makeFork() {
  const g = new THREE.Group(),
    silver = material(0xdfe6f0, { metalness: 0.7, roughness: 0.25 });
  const handle = mesh(new THREE.BoxGeometry(0.08, 0.04, 0.5), silver);
  handle.position.z = -0.2;
  g.add(handle);
  const neck = mesh(new THREE.BoxGeometry(0.22, 0.04, 0.08), silver);
  neck.position.z = 0.08;
  g.add(neck);
  for (const x of [-0.09, -0.03, 0.03, 0.09]) {
    const tine = mesh(new THREE.BoxGeometry(0.03, 0.04, 0.22), silver);
    tine.position.set(x, 0, 0.22);
    g.add(tine);
  }
  return g;
}

// Lina's Sky Jewel: a glowing pink gem (an octahedron, stretched tall)
export function makeJewel() {
  const g = new THREE.Group();
  const gem = mesh(
    new THREE.OctahedronGeometry(0.28, 0),
    material(0xff7ad9, { emissive: 0xff5ac8, emissiveIntensity: 0.6, roughness: 0.2 }),
  );
  gem.scale.set(1, 1.35, 1);
  gem.position.y = 0.3;
  g.add(gem);
  return g;
}

// a soft white feather with a lilac tip, standing on its quill (the sky island's collectible)
export function makeFeather() {
  const g = new THREE.Group();
  const vane = mesh(
    new THREE.SphereGeometry(0.2, 10, 6),
    material(0xffffff, { emissive: 0xf3ecff, emissiveIntensity: 0.3 }),
  );
  vane.scale.set(0.7, 2.2, 0.15);
  vane.position.y = 0.45;
  g.add(vane);
  const tip = mesh(new THREE.SphereGeometry(0.12, 8, 6), material(0xc8a8ff));
  tip.scale.set(0.8, 1.6, 0.2);
  tip.position.y = 0.78;
  g.add(tip);
  const quill = mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.9, 5), material(0xe8ddc4));
  quill.position.y = 0.4;
  g.add(quill);
  g.rotation.z = 0.25;
  g.position.y = -0.35;
  const holder = new THREE.Group(); // spins round the upright, whatever the feather's lean
  holder.add(g);
  return holder;
}

// a golden fairground ticket standing on its edge (island 7's pickups)
export function makeTicket() {
  const g = new THREE.Group(),
    gold = material(0xffc93c, { metalness: 0.35, roughness: 0.4 });
  g.add(mesh(new THREE.BoxGeometry(0.74, 0.44, 0.06), gold));
  // a red star punched in the middle, on both faces
  for (const side of [-1, 1]) {
    const star = mesh(new THREE.CircleGeometry(0.13, 5), material(0xe8332f), {
      castShadow: false,
    });
    star.position.z = side * 0.035;
    star.rotation.y = side < 0 ? Math.PI : 0;
    g.add(star);
  }
  // the torn-off stub at one end
  const stub = mesh(new THREE.BoxGeometry(0.03, 0.44, 0.07), material(0xd99a1c));
  stub.position.x = 0.24;
  g.add(stub);
  return g;
}

// a firework rocket on its stick: a striped body in `color`, a pointed nose and three fins
export function makeRocket(color) {
  const g = new THREE.Group(),
    paint = material(color, { emissive: color, emissiveIntensity: 0.25 });
  const body = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.8, 10), paint);
  body.position.y = 0.9;
  g.add(body);
  const band = mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.16, 10), material(0xffffff));
  band.position.y = 0.9;
  g.add(band);
  const nose = mesh(new THREE.ConeGeometry(0.24, 0.42, 10), material(0xffd84d));
  nose.position.y = 1.51;
  g.add(nose);
  const stick = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 5), material(0xc48a54));
  stick.position.y = 0.25;
  g.add(stick);
  for (let i = 0; i < 3; i++) {
    const fin = mesh(new THREE.BoxGeometry(0.03, 0.26, 0.22), material(0xffffff));
    const angle = (i / 3) * Math.PI * 2;
    fin.position.set(Math.sin(angle) * 0.24, 0.6, Math.cos(angle) * 0.24);
    fin.rotation.y = angle;
    g.add(fin);
  }
  return g;
}
