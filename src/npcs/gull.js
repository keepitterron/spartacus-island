// The sleepy seagull on island 1: model, wake-up and per-frame update. Barking wakes it; after that it circles the ship.
import * as THREE from 'three';
import { lerp, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { material, mesh } from '../core/materials.js';
import { game } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { burst, textSprite, onFontsReady } from '../core/fx.js';
import { ship } from '../world/ship.js';

// state: sleep | startle | fly. `t` is time in the current state, `ang` the angle around the ship,
// `post` the {x, z, top} it sleeps on.
export const gull = { g: new THREE.Group(), state: 'sleep', t: 0, ang: 0, post: null };
let snore = null; // the floating "Zzz" sprite
{
  const white = material(0xffffff),
    grey = material(0xb8c2cc),
    orange = material(0xffa53d),
    ink = material(0x2b2b38);
  const body = mesh(new THREE.SphereGeometry(0.3, 10, 8), white);
  body.scale.set(1, 0.85, 1.4);
  body.position.y = 0.32;
  gull.g.add(body);
  const head = mesh(new THREE.SphereGeometry(0.2, 10, 8), white);
  head.position.set(0, 0.6, 0.3);
  gull.g.add(head);
  const beak = mesh(new THREE.ConeGeometry(0.07, 0.26, 6), orange);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.56, 0.56);
  gull.g.add(beak);
  // wings hinge at the shoulder: a pivot group with the wing mesh offset outwards
  gull.wings = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.24, 0.4, 0);
    const wing = mesh(new THREE.BoxGeometry(0.55, 0.06, 0.42), grey);
    wing.position.x = side * 0.27;
    pivot.add(wing);
    gull.g.add(pivot);
    return pivot;
  });
  const tail = mesh(new THREE.BoxGeometry(0.25, 0.05, 0.25), grey);
  tail.position.set(0, 0.35, -0.45);
  gull.g.add(tail);
  // two sets of eyes: sleepy lines, swapped for open dots when it wakes
  gull.closed = [-1, 1].map((side) => {
    const eye = mesh(new THREE.BoxGeometry(0.09, 0.02, 0.02), ink, { castShadow: false });
    eye.position.set(side * 0.1, 0.64, 0.47);
    gull.g.add(eye);
    return eye;
  });
  gull.open = [-1, 1].map((side) => {
    const eye = mesh(new THREE.SphereGeometry(0.04, 6, 5), ink, { castShadow: false });
    eye.position.set(side * 0.1, 0.65, 0.46);
    eye.visible = false;
    gull.g.add(eye);
    return eye;
  });
  for (const side of [-1, 1]) {
    const leg = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 4), orange);
    leg.position.set(side * 0.08, 0.08, 0);
    gull.g.add(leg);
  }
  gull.g.rotation.y = Math.PI * 0.8;
  scene.add(gull.g);
}
onFontsReady(() => {
  snore = textSprite('Zzz', '#ffffff');
  snore.scale.set(2.4, 0.6, 1);
  scene.add(snore);
});

// perch on a post {x, z, top}
export function perchGull(post) {
  gull.post = post;
  gull.g.position.set(post.x, post.top, post.z);
}

function openEyes() {
  for (const eye of gull.closed) eye.visible = false;
  for (const eye of gull.open) eye.visible = true;
  if (snore) snore.visible = false;
}

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

// left wing flaps down while the right flaps up
function flapWings(speed, amount) {
  gull.wings.forEach((wing, i) => {
    wing.rotation.z = (i ? 1 : -1) * Math.sin(game.time * speed) * amount;
  });
}

function updateSleeping(post) {
  const time = game.time;
  gull.g.position.y = post.top + Math.sin(time * 1.5) * 0.02;
  if (!snore) return;
  snore.visible = true;
  // the Zzz drifts up and to the side, fading in and out, on a 2 s loop
  const cycle = (time * 0.5) % 1;
  snore.position.set(post.x + cycle * 0.4, post.top + 1.1 + cycle * 0.9, post.z);
  snore.material.opacity = Math.sin(cycle * Math.PI);
}

// flutter straight up 3 m in 0.7 s, then start circling from wherever it ended up
function updateStartled(post) {
  const pos = gull.g.position;
  const t = Math.min(1, gull.t / 0.7);
  pos.y = post.top + t * 3;
  flapWings(22, 0.9);
  if (t < 1) return;
  gull.state = 'fly';
  gull.ang = Math.atan2(pos.z - ship.position.z, pos.x - ship.position.x);
}

// circle the ship at radius 5, 8 m up, easing towards the target so it follows the moving ship
function updateCircling(dt) {
  const g = gull.g;
  gull.ang += dt * 0.7;
  const targetX = ship.position.x + Math.cos(gull.ang) * 5,
    targetZ = ship.position.z + Math.sin(gull.ang) * 5,
    targetY = 8 + Math.sin(game.time) * 0.5;
  g.position.x = lerp(g.position.x, targetX, Math.min(1, dt * 2));
  g.position.z = lerp(g.position.z, targetZ, Math.min(1, dt * 2));
  g.position.y = lerp(g.position.y, targetY, Math.min(1, dt * 1.5));
  g.rotation.y = Math.atan2(-Math.sin(gull.ang), Math.cos(gull.ang)) + Math.PI;
  flapWings(10, 0.7);
}

export function updateGull(dt) {
  gull.t += dt;
  if (gull.state === 'sleep') updateSleeping(gull.post);
  else if (gull.state === 'startle') updateStartled(gull.post);
  else updateCircling(dt);
}
