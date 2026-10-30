import * as THREE from 'three';
import { lerp, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { material, mesh } from '../core/materials.js';
import { game } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { burst, textSprite, onFontsReady } from '../core/fx.js';
import { ship } from '../world/ship.js';

// The sleepy seagull on island 1. Barking wakes it; after that it circles the ship.
// state: sleep | startle | fly
export const gull = { g: new THREE.Group(), state: 'sleep', t: 0, ang: 0, post: null };
let zzz = null;
{
  const W = material(0xffffff),
    Gr = material(0xb8c2cc),
    O = material(0xffa53d),
    I = material(0x2b2b38);
  const b = mesh(new THREE.SphereGeometry(0.3, 10, 8), W);
  b.scale.set(1, 0.85, 1.4);
  b.position.y = 0.32;
  gull.g.add(b);
  const h = mesh(new THREE.SphereGeometry(0.2, 10, 8), W);
  h.position.set(0, 0.6, 0.3);
  gull.g.add(h);
  const bk = mesh(new THREE.ConeGeometry(0.07, 0.26, 6), O);
  bk.rotation.x = Math.PI / 2;
  bk.position.set(0, 0.56, 0.56);
  gull.g.add(bk);
  gull.wings = [-1, 1].map((k) => {
    const p = new THREE.Group();
    p.position.set(k * 0.24, 0.4, 0);
    const w = mesh(new THREE.BoxGeometry(0.55, 0.06, 0.42), Gr);
    w.position.x = k * 0.27;
    p.add(w);
    gull.g.add(p);
    return p;
  });
  const tl = mesh(new THREE.BoxGeometry(0.25, 0.05, 0.25), Gr);
  tl.position.set(0, 0.35, -0.45);
  gull.g.add(tl);
  gull.closed = [-1, 1].map((k) => {
    const e = mesh(new THREE.BoxGeometry(0.09, 0.02, 0.02), I, { castShadow: false });
    e.position.set(k * 0.1, 0.64, 0.47);
    gull.g.add(e);
    return e;
  });
  gull.open = [-1, 1].map((k) => {
    const e = mesh(new THREE.SphereGeometry(0.04, 6, 5), I, { castShadow: false });
    e.position.set(k * 0.1, 0.65, 0.46);
    e.visible = false;
    gull.g.add(e);
    return e;
  });
  for (const k of [-1, 1]) {
    const l = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 4), O);
    l.position.set(k * 0.08, 0.08, 0);
    gull.g.add(l);
  }
  gull.g.rotation.y = Math.PI * 0.8;
  scene.add(gull.g);
}
onFontsReady(() => {
  zzz = textSprite('Zzz', '#ffffff');
  zzz.scale.set(2.4, 0.6, 1);
  scene.add(zzz);
});
// perch on a post {x,z,top}
export function perchGull(post) {
  gull.post = post;
  gull.g.position.set(post.x, post.top, post.z);
}
const openEyes = () => {
  gull.closed.forEach((e) => (e.visible = false));
  gull.open.forEach((e) => (e.visible = true));
  if (zzz) zzz.visible = false;
};
export function wakeGull() {
  gull.state = 'startle';
  gull.t = 0;
  sfx.gull();
  openEyes();
  burst(gull.g.position.clone().add(vec3(0, 0.5, 0)), {
    count: 14,
    color: 0xffffff,
    speed: 4,
    up: 3,
    life: 0.8,
    size: 0.8,
  });
}
// if it's still asleep when we leave, it just appears circling the ship
export function gullJoinsShip() {
  if (gull.state !== 'sleep') return;
  gull.state = 'fly';
  openEyes();
  gull.g.position.set(ship.position.x, 8, ship.position.z);
}

export function updateGull(dt) {
  const g = gull.g,
    T = game.time,
    post = gull.post;
  gull.t += dt;
  if (gull.state === 'sleep') {
    g.position.y = post.top + Math.sin(T * 1.5) * 0.02;
    if (zzz) {
      zzz.visible = true;
      const c = (T * 0.5) % 1;
      zzz.position.set(post.x + c * 0.4, post.top + 1.1 + c * 0.9, post.z);
      zzz.material.opacity = Math.sin(c * Math.PI);
    }
  } else if (gull.state === 'startle') {
    const k = Math.min(1, gull.t / 0.7);
    g.position.y = post.top + k * 3;
    gull.wings.forEach((w, i) => (w.rotation.z = (i ? 1 : -1) * Math.sin(T * 22) * 0.9));
    if (k >= 1) {
      gull.state = 'fly';
      gull.ang = Math.atan2(g.position.z - ship.position.z, g.position.x - ship.position.x);
    }
  } else {
    gull.ang += dt * 0.7;
    const cx = ship.position.x,
      cz = ship.position.z;
    const nx = cx + Math.cos(gull.ang) * 5,
      nz = cz + Math.sin(gull.ang) * 5,
      ny = 8 + Math.sin(T) * 0.5;
    g.position.x = lerp(g.position.x, nx, Math.min(1, dt * 2));
    g.position.z = lerp(g.position.z, nz, Math.min(1, dt * 2));
    g.position.y = lerp(g.position.y, ny, Math.min(1, dt * 1.5));
    g.rotation.y = Math.atan2(-Math.sin(gull.ang), Math.cos(gull.ang)) + Math.PI;
    gull.wings.forEach((w, i) => (w.rotation.z = (i ? 1 : -1) * Math.sin(T * 10) * 0.7));
  }
}
