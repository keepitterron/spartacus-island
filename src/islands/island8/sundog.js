// The Sun Dog: a giant stone dog asleep in the Sun Chamber for a thousand years (the temple's
// "boss", who only needs waking up). Asleep he breathes slowly and snores Zzz. Sunlight on his
// nose makes him sneeze and mumble (stirred). Two dogs on the paw plates and a woof wake him:
// his eyes open gold, he lifts his head, wags, and the whole statue glows warm.
//
//   addSunDog(spot)   stirSunDog()   wakeSunDog({ quiet })   updateSunDog(dt)
//   sunDog.state: asleep | stirred | waking | awake;   sunDog.snout: {x, y, z} for the beam
import * as THREE from 'three';
import { clamp, lerp, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { mergeParts, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst, onFontsReady, textSprite } from '../../core/fx.js';
import { addBox, addCylinder } from '../../core/colliders.js';

const WAKE_TIME = 3; // s from the woof to wide awake

export const sunDog = {
  state: 'asleep',
  t: 0,
  g: null,
  body: null,
  head: null,
  tail: null,
  eyes: [],
  lids: [],
  stone: null,
  gold: null,
  zzz: null,
  sneeze: 0,
  snout: null,
  spot: null,
};

// a stone material that can glow (it warms up when he wakes)
const glowing = (color) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: 0xffb347,
    emissiveIntensity: 0,
    flatShading: true,
    roughness: 0.9,
  });

// a part of the statue: a mesh in parent at [x, y, z], optionally stretched
function addPart(parent, { geometry, mat, at: [x, y, z], scale }) {
  const m = mesh(geometry, mat);
  m.position.set(x, y, z);
  if (scale) m.scale.set(...scale);
  parent.add(m);
  return m;
}

// lying down like a sphinx, facing +z; about 11 m nose to tail, the head 6 m up
function makeSunDog() {
  const stone = glowing(0xd6c4a0),
    dark = glowing(0xbfa77e),
    gold = glowing(0xf2b84b);
  const g = new THREE.Group(),
    body = new THREE.Group();
  g.add(body);
  addPart(body, {
    geometry: new THREE.CapsuleGeometry(2.1, 3.6, 4, 12),
    mat: stone,
    at: [0, 2.1, 2],
    scale: [1.15, 1, 1],
  }).rotation.x = Math.PI / 2;
  addPart(body, {
    geometry: new THREE.SphereGeometry(2.3, 12, 10),
    mat: stone,
    at: [0, 2.2, -0.6],
    scale: [1.2, 0.95, 0.85],
  });
  for (const side of [-1, 1]) {
    // front legs reaching forward, back legs tucked
    addPart(body, {
      geometry: new THREE.CapsuleGeometry(0.6, 2.6, 4, 8),
      mat: dark,
      at: [side * 1.3, 0.6, 6.2],
    }).rotation.x = Math.PI / 2;
    addPart(body, {
      geometry: new THREE.SphereGeometry(0.75, 10, 8),
      mat: stone,
      at: [side * 1.3, 0.55, 7.7],
      scale: [1, 0.7, 1.2],
    });
    addPart(body, {
      geometry: new THREE.SphereGeometry(1.2, 10, 8),
      mat: dark,
      at: [side * 2.1, 1.1, -0.9],
      scale: [0.8, 1, 1.4],
    });
  }
  // a gold collar with a sun on his chest
  const collar = addPart(body, {
    geometry: new THREE.TorusGeometry(1.75, 0.22, 8, 20),
    mat: gold,
    at: [0, 4.1, 4.4],
  });
  collar.rotation.x = Math.PI / 2.4;
  addPart(body, {
    geometry: new THREE.CylinderGeometry(0.6, 0.6, 0.2, 16),
    mat: gold,
    at: [0, 3.4, 5.9],
  }).rotation.x = Math.PI / 2.6;
  // the tail curls round his side
  const tail = new THREE.Group();
  tail.position.set(2.4, 0.8, -1.4);
  body.add(tail);
  addPart(tail, {
    geometry: new THREE.TorusGeometry(1.1, 0.35, 6, 12, Math.PI * 1.2),
    mat: dark,
    at: [0.9, 0, 0],
  }).rotation.x = Math.PI / 2;
  // the head turns on its neck
  const head = new THREE.Group();
  head.position.set(0, 5.2, 5.4);
  body.add(head);
  addPart(head, {
    geometry: new THREE.SphereGeometry(1.7, 14, 12),
    mat: stone,
    at: [0, 0, 0],
    scale: [1.1, 1, 1],
  });
  addPart(head, {
    geometry: new THREE.SphereGeometry(0.95, 12, 10),
    mat: stone,
    at: [0, -0.5, 1.5],
    scale: [1, 0.8, 1.15],
  });
  addPart(head, { geometry: new THREE.SphereGeometry(0.33, 10, 8), mat: dark, at: [0, -0.2, 2.5] });
  const eyes = [],
    lids = [];
  for (const side of [-1, 1]) {
    const ear = addPart(head, {
      geometry: new THREE.ConeGeometry(0.5, 1.4, 5),
      mat: dark,
      at: [side * 1.05, 1.5, -0.2],
    });
    ear.rotation.z = side * -0.35;
    const eye = addPart(head, {
      geometry: new THREE.SphereGeometry(0.28, 10, 8),
      mat: gold,
      at: [side * 0.65, 0.35, 1.45],
    });
    eye.visible = false;
    eyes.push(eye);
    const lid = addPart(head, {
      geometry: new THREE.BoxGeometry(0.6, 0.09, 0.1),
      mat: dark,
      at: [side * 0.65, 0.33, 1.6],
    });
    lids.push(lid);
  }
  mergeParts(body); // the head and the tail move, so they stay apart
  return { g, body, head, tail, eyes, lids, stone: [stone, dark], gold };
}

export function addSunDog(spot) {
  Object.assign(sunDog, makeSunDog());
  sunDog.spot = spot;
  sunDog.g.position.set(spot.x, spot.y, spot.z);
  scene.add(sunDog.g);
  // his body and his raised head are solid; his front paws are low enough to climb on
  addBox(spot.x, spot.z + 1.4, { hw: 2.7, hd: 4.3, bottom: spot.y - 1, top: spot.y + 4.6 });
  addCylinder(spot.x, spot.z + 6, { r: 1.9, bottom: spot.y - 1, top: spot.y + 7 });
  sunDog.snout = vec3(spot.x + 0.4, spot.y, spot.z + 7.6);
  // what stops a sunbeam: his body (the beam behind him passes his back)
  sunDog.blocker = { x0: spot.x - 2.7, x1: spot.x + 2.7, z0: spot.z - 2.9, z1: spot.z + 5.7 };
  onFontsReady(() => {
    sunDog.zzz = textSprite('Zzz', '#ffffff');
    sunDog.zzz.visible = false;
    scene.add(sunDog.zzz);
  });
}

// sunlight on his nose: a big sneeze, but he's still sleepy
export function stirSunDog() {
  if (sunDog.state !== 'asleep') return;
  sunDog.state = 'stirred';
  sunDog.sneeze = 1;
  sfx.sneeze();
  burst(sunDog.head.getWorldPosition(vec3()).add(vec3(0, -0.5, 2.6)), {
    count: 30,
    color: [0xfff0c8, 0xe0c9a0, 0xffffff],
    speed: 6,
    up: 2,
    life: 1.2,
    size: 1.6,
  });
}

export function wakeSunDog({ quiet = false } = {}) {
  if (sunDog.state === 'waking' || sunDog.state === 'awake') return;
  sunDog.state = quiet ? 'awake' : 'waking';
  sunDog.t = quiet ? WAKE_TIME : 0;
  for (const eye of sunDog.eyes) eye.visible = true;
  for (const lid of sunDog.lids) lid.visible = false;
  if (quiet) return;
  sfx.bark(0.45);
  sfx.fanfare();
}

export function updateSunDog(dt) {
  if (!sunDog.g) return;
  const time = game.time;
  sunDog.t += dt;
  const awake = sunDog.state === 'waking' || sunDog.state === 'awake';
  const wake = awake ? clamp(sunDog.t / WAKE_TIME, 0, 1) : 0;
  if (sunDog.state === 'waking' && wake === 1) sunDog.state = 'awake';
  // breathing while asleep, a wag and a happy look round once awake
  const breath = Math.sin(time * 0.9);
  sunDog.body.scale.y = 1 + breath * 0.02 * (1 - wake);
  sunDog.head.rotation.x = lerp(0.35, -0.1, wake) + breath * 0.03 * (1 - wake);
  sunDog.head.rotation.y = awake ? Math.sin(time * 0.6) * 0.25 * wake : 0;
  sunDog.head.position.y = lerp(4.6, 5.6, wake);
  sunDog.tail.rotation.y = awake ? Math.sin(time * 7) * 0.5 * wake : 0;
  // the sneeze: his head jerks back, then settles
  if (sunDog.sneeze > 0) {
    sunDog.sneeze = Math.max(0, sunDog.sneeze - dt);
    sunDog.head.rotation.x -= Math.sin(sunDog.sneeze * Math.PI) * 0.4;
  }
  for (const m of sunDog.stone) m.emissiveIntensity = wake * (0.18 + Math.sin(time * 2) * 0.04);
  sunDog.gold.emissiveIntensity = 0.1 + wake * 0.6;
  if (sunDog.zzz) {
    sunDog.zzz.visible = !awake;
    const rise = (time * 0.5) % 1;
    sunDog.zzz.position
      .copy(sunDog.head.getWorldPosition(vec3()))
      .add(vec3(1.5, 2 + rise * 1.5, 1));
    sunDog.zzz.material.opacity = 1 - rise;
  }
}
