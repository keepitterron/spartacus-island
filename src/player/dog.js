import * as THREE from 'three';
import { clamp, lerp } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { mat, mesh } from '../core/materials.js';
import { G } from '../core/state.js';
import { P, SPEED } from './player.js';

// Spartacus: half pitbull, half labrador. Shiny black coat, thin white stripe down the
// muzzle, white chest patch and paw tips, floppy ears, straw hat with a red band.
// Friends who ride along are added to dog.head; carried items go in dog.mouth.
function makeDog() {
  const fur = mat(0x2a2a33),
    cream = mat(0xffffff),
    brown = mat(0x1f1f27),
    ink = mat(0x0c0c10, { roughness: 0.35 }),
    pink = mat(0xff8fa3),
    straw = mat(0xf2d27a),
    ribbon = mat(0xd9343f),
    iris = mat(0x9a7a34, { roughness: 0.3 }),
    pupil = mat(0x1a1208, { roughness: 0.3 });
  const root = new THREE.Group(),
    body = new THREE.Group();
  root.add(body);
  const torso = mesh(new THREE.CapsuleGeometry(0.4, 0.75, 4, 10), fur);
  torso.rotation.x = Math.PI / 2;
  torso.position.y = 0.78;
  body.add(torso);
  const belly = mesh(new THREE.SphereGeometry(0.34, 10, 8), cream);
  belly.scale.set(1.08, 1.1, 1.15);
  belly.position.set(0, 0.74, 0.42);
  body.add(belly);
  const head = new THREE.Group();
  head.position.set(0, 1.25, 0.62);
  body.add(head);
  {
    const sk = mesh(new THREE.SphereGeometry(0.44, 12, 10), fur);
    sk.scale.set(1.12, 0.95, 1);
    head.add(sk);
  }
  const bz1 = mesh(new THREE.BoxGeometry(0.03, 0.28, 0.06), cream, false);
  bz1.position.set(0, 0.2, 0.4);
  bz1.rotation.x = -0.4;
  head.add(bz1);
  const bz2 = mesh(new THREE.BoxGeometry(0.027, 0.04, 0.26), cream, false);
  bz2.position.set(0, 0.06, 0.47);
  bz2.rotation.x = 0.28;
  head.add(bz2);
  const mz = mesh(new THREE.SphereGeometry(0.24, 10, 8), fur);
  mz.scale.set(1.1, 0.8, 1.1);
  mz.position.set(0, -0.12, 0.36);
  head.add(mz);
  const nose = mesh(new THREE.SphereGeometry(0.085, 8, 6), ink);
  nose.position.set(0, -0.04, 0.6);
  head.add(nose);
  const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
  // hazel eyes: golden-brown iris with a dark pupil so the colour reads at this size
  for (const s of [-1, 1]) {
    const e = mesh(new THREE.SphereGeometry(0.08, 10, 8), iris, false);
    e.position.set(s * 0.17, 0.07, 0.37);
    head.add(e);
    const pu = mesh(new THREE.SphereGeometry(0.042, 8, 6), pupil, false);
    pu.position.set(s * 0.17, 0.068, 0.425);
    head.add(pu);
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 4), shine);
    sh.position.set(s * 0.17 + 0.025, 0.1, 0.455);
    head.add(sh);
    const ch = mesh(new THREE.SphereGeometry(0.07, 6, 5), pink, false);
    ch.scale.set(1, 0.5, 0.6);
    ch.position.set(s * 0.27, -0.09, 0.3);
    head.add(ch);
  }
  const tongue = mesh(new THREE.BoxGeometry(0.13, 0.03, 0.2), pink, false);
  tongue.position.set(0, -0.26, 0.46);
  tongue.visible = false;
  head.add(tongue);
  const mouth = new THREE.Group();
  mouth.position.set(0, -0.24, 0.62);
  head.add(mouth);
  // floppy labrador ears hanging from the sides of the head, a few soft blobs each so they look fluffy
  const ears = [-1, 1].map((s) => {
    const p = new THREE.Group();
    p.position.set(s * 0.4, 0.2, -0.04);
    for (const [x, y, z, r, sx, sy] of [
      [0.05, -0.08, 0, 0.14, 0.55, 1],
      [0.07, -0.22, 0.02, 0.15, 0.6, 1],
      [0.08, -0.34, 0.05, 0.12, 0.65, 0.9],
    ]) {
      const b = mesh(new THREE.IcosahedronGeometry(r, 1), brown);
      b.scale.set(sx, sy, 1.05);
      b.position.set(s * x, y, z);
      p.add(b);
    }
    p.rotation.z = s * 0.12;
    head.add(p);
    p.userData.s = s;
    return p;
  });
  const hat = new THREE.Group();
  hat.position.set(0, 0.36, -0.03);
  hat.rotation.x = -0.15;
  hat.rotation.z = 0.08;
  head.add(hat);
  hat.add(mesh(new THREE.CylinderGeometry(0.68, 0.72, 0.05, 18), straw));
  const crown = mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.24, 14), straw);
  crown.position.y = 0.14;
  hat.add(crown);
  const hatTop = mesh(new THREE.SphereGeometry(0.3, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), straw);
  hatTop.scale.y = 0.45;
  hatTop.position.y = 0.26;
  hat.add(hatTop);
  const band = mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.09, 14), ribbon);
  band.position.y = 0.08;
  hat.add(band);
  const legs = [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ].map(([sx, sz]) => {
    const p = new THREE.Group();
    p.position.set(sx * 0.22, 0.55, sz * 0.38);
    const l = mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.42, 6), fur);
    l.position.y = -0.2;
    p.add(l);
    const pw = mesh(new THREE.SphereGeometry(0.13, 8, 6), cream);
    pw.scale.set(1, 0.7, 1.2);
    pw.position.set(0, -0.43, 0.03);
    p.add(pw);
    body.add(p);
    return p;
  });
  const tail = new THREE.Group();
  tail.position.set(0, 0.95, -0.72);
  tail.rotation.x = -0.6;
  body.add(tail);
  const tc = mesh(new THREE.ConeGeometry(0.1, 0.55, 6), fur);
  tc.position.y = 0.25;
  tail.add(tc);
  const tt = mesh(new THREE.SphereGeometry(0.07, 6, 5), fur);
  tt.position.y = 0.5;
  tail.add(tt);
  return { root, body, head, ears, legs, tail, tongue, mouth, hat };
}
export const dog = makeDog();
scene.add(dog.root);

// pose the model from P every frame; sp = horizontal speed
export function animDog(dt, sp) {
  const d = dog,
    T = G.T;
  d.root.position.copy(P.pos);
  if (G.spin > 0) {
    const s = Math.min(G.spin, dt * 10);
    G.spin -= s;
    P.yaw += s;
  }
  d.root.rotation.y = P.yaw;
  const moving = clamp(sp / SPEED, 0, 1);
  P.phase += dt * (4 + sp * 1.9);
  const sw = Math.sin(P.phase) * 0.75 * moving,
    digging = P.digT > 0;
  if (G.state === 'rescue') {
    const pd = Math.sin(P.phase) * 0.8;
    d.legs.forEach((l, i) => (l.rotation.x = i % 2 ? pd : -pd));
  } else if (digging) {
    const q = Math.sin(T * 28) * 1.1;
    d.legs[0].rotation.x = -0.6 + q;
    d.legs[1].rotation.x = -0.6 - q;
    d.legs[2].rotation.x = 0.2;
    d.legs[3].rotation.x = 0.2;
  } else if (P.climb) {
    const q = Math.sin(P.phase) * 0.9;
    d.legs[0].rotation.x = -0.9 + q;
    d.legs[1].rotation.x = -0.9 - q;
    d.legs[2].rotation.x = 0.3 - q;
    d.legs[3].rotation.x = 0.3 + q;
  } else if (P.zip) {
    d.legs.forEach((l, i) => (l.rotation.x = 0.25 + Math.sin(T * 6 + i) * 0.25));
  } else if (P.swing) {
    const q = Math.sin(T * 20) * 0.5;
    d.legs.forEach((l, i) => (l.rotation.x = (i < 2 ? -1 : 1) * (0.7 + q * (i % 2 ? 1 : -1))));
  } else if (!P.grounded) {
    d.legs.forEach((l, i) => (l.rotation.x = i < 2 ? -0.6 : 0.6));
  } else {
    d.legs[0].rotation.x = sw;
    d.legs[3].rotation.x = sw;
    d.legs[1].rotation.x = -sw;
    d.legs[2].rotation.x = -sw;
  }
  d.body.rotation.x = lerp(
    d.body.rotation.x,
    digging ? 0.32 : P.climb ? -1.3 : P.zip ? -0.35 : P.swing ? -0.25 : 0,
    Math.min(1, dt * 10),
  );
  // squash & stretch spring
  P.sqv += (1 - P.sq) * 140 * dt;
  P.sqv *= Math.exp(-dt * 9);
  P.sq += P.sqv * dt;
  P.sq = clamp(P.sq, 0.6, 1.4);
  const bob = P.grounded ? Math.abs(Math.sin(P.phase)) * 0.08 * moving : 0;
  const stretchY = P.swing ? 1.12 : 1;
  d.body.scale.set(1 / Math.sqrt(P.sq), P.sq * stretchY, 1 / Math.sqrt(P.sq));
  d.body.position.y = bob;
  d.tail.rotation.z =
    Math.sin(T * (G.celebT >= 0 || digging || P.swing ? 22 : 12)) * (0.5 + moving * 0.2);
  const vy = G.state === 'rescue' || P.swing ? 6 : P.vel.y;
  d.ears.forEach((e) => {
    e.rotation.x = clamp(vy * 0.05, -0.9, 0.9) + Math.sin(P.phase * 2) * 0.15 * moving;
    e.rotation.z = e.userData.s * (0.12 + clamp(-vy * 0.04, -0.1, 0.7));
  });
  const bk = P.barkT > 0;
  d.tongue.visible = bk && !P.carry;
  d.head.rotation.x = bk
    ? -Math.sin(((0.35 - P.barkT) / 0.35) * Math.PI) * 0.35
    : P.carry && P.carry.heavy
      ? 0.12
      : Math.sin(T * 1.3) * 0.04;
  d.head.rotation.z = Math.sin(T * 0.9) * 0.05;
}
