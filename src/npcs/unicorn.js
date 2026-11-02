// The unicorn, met on island 5. She slid down her rainbow from the sky island and it broke
// into four colour stars, so her mane and tail went grey. Every star brought back to the arch
// colours one stripe again. (She joins the crew at the end of island 5, later.)
import * as THREE from 'three';
import { lerp } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { material, mesh } from '../core/materials.js';
import { game } from '../core/state.js';
import { burst } from '../core/fx.js';

const GREY = 0xb8bcc8;
// state: sad (head down, waiting) | happy (all colours back)
// stripes: one material per mane/tail stripe, shared by the mane tuft and the tail strand,
// so colouring a stripe colours both. hop: seconds left of a happy little hop.
export const unicorn = {
  g: null,
  head: null,
  tail: null,
  stripes: [],
  state: 'sad',
  hop: 0,
  baseY: 0,
};

// builds her standing at (x, z) on the ground at height y, facing yaw
export function addUnicorn(x, z, { y, yaw = 0 }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  scene.add(g);
  unicorn.g = g;
  unicorn.baseY = y;
  const white = material(0xfdfbff),
    hoof = material(0xb59cff),
    ink = material(0x1c2333),
    pink = material(0xffb3c4);
  unicorn.stripes = [0, 1, 2, 3].map(() => new THREE.MeshStandardMaterial({ color: GREY }));
  const body = mesh(new THREE.CapsuleGeometry(0.55, 1.3, 6, 12), white);
  body.rotation.x = Math.PI / 2;
  body.position.y = 1.3;
  g.add(body);
  for (const side of [-1, 1])
    for (const end of [-1, 1]) {
      const leg = mesh(new THREE.CylinderGeometry(0.13, 0.11, 1, 7), white);
      leg.position.set(side * 0.3, 0.5, end * 0.58);
      g.add(leg);
      const foot = mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.14, 7), hoof);
      foot.position.set(side * 0.3, 0.07, end * 0.58);
      g.add(foot);
    }
  const neck = mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.9, 8), white);
  neck.position.set(0, 1.8, 0.78);
  neck.rotation.x = 0.55;
  g.add(neck);
  addHead(g, { white, ink, pink });
  addMane(g);
  addTail(g);
}

// the head pivots at the top of the neck, so drooping it looks sad
function addHead(g, { white, ink, pink }) {
  const head = new THREE.Group();
  head.position.set(0, 2.2, 1.0);
  g.add(head);
  unicorn.head = head;
  const skull = mesh(new THREE.SphereGeometry(0.32, 10, 8), white);
  skull.scale.set(0.85, 0.9, 1.25);
  skull.position.z = 0.15;
  head.add(skull);
  const snout = mesh(new THREE.SphereGeometry(0.22, 9, 7), pink);
  snout.scale.set(1, 0.8, 0.9);
  snout.position.set(0, -0.1, 0.48);
  head.add(snout);
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.05, 6, 5), ink, { castShadow: false });
    eye.position.set(side * 0.22, 0.08, 0.32);
    head.add(eye);
    const ear = mesh(new THREE.ConeGeometry(0.08, 0.24, 5), white);
    ear.position.set(side * 0.17, 0.32, 0.02);
    ear.rotation.z = -side * 0.3;
    head.add(ear);
  }
  const horn = mesh(
    new THREE.ConeGeometry(0.07, 0.55, 8),
    new THREE.MeshStandardMaterial({
      color: 0xffe9a8,
      emissive: 0xffd84d,
      emissiveIntensity: 0.3,
      roughness: 0.3,
    }),
  );
  horn.position.set(0, 0.42, 0.28);
  horn.rotation.x = 0.5;
  head.add(horn);
}

// four tufts along the back of the neck, one per stripe
function addMane(g) {
  unicorn.stripes.forEach((stripe, i) => {
    const tuft = mesh(new THREE.SphereGeometry(0.17, 7, 5), stripe);
    tuft.scale.set(0.7, 1, 1.3);
    tuft.position.set(0, 2.3 - i * 0.2, 0.78 - i * 0.17);
    g.add(tuft);
  });
}

// four strands fanning from the tail root, one per stripe
function addTail(g) {
  const tail = new THREE.Group();
  tail.position.set(0, 1.45, -1.05);
  g.add(tail);
  unicorn.tail = tail;
  const strandGeo = new THREE.ConeGeometry(0.1, 0.9, 6);
  strandGeo.rotateX(Math.PI); // tip down, hanging from the root
  strandGeo.translate(0, -0.45, 0);
  unicorn.stripes.forEach((stripe, i) => {
    const strand = mesh(strandGeo, stripe);
    strand.rotation.set(-0.5, 0, (i - 1.5) * 0.22);
    tail.add(strand);
  });
}

// give stripe `index` its colour back (quiet: no sparkle or hop, e.g. putting a save back)
export function colourStripe(index, color, { quiet = false } = {}) {
  unicorn.stripes[index].color.set(color);
  if (quiet) return;
  unicorn.hop = 0.6;
  burst(unicorn.g.position.clone().setY(unicorn.g.position.y + 2.2), {
    count: 24,
    color: [color, 0xffffff],
    speed: 3,
    up: 3,
    life: 0.9,
    size: 1,
  });
}

// a swishing tail, the head drooped while sad, and a hop when a colour comes back
export function updateUnicorn(dt) {
  if (!unicorn.g) return;
  const time = game.time,
    sad = unicorn.state === 'sad';
  unicorn.head.rotation.x = lerp(unicorn.head.rotation.x, sad ? 0.45 : -0.1, Math.min(1, dt * 3));
  unicorn.tail.rotation.y = Math.sin(time * (sad ? 0.8 : 3)) * (sad ? 0.15 : 0.4);
  unicorn.hop = Math.max(0, unicorn.hop - dt);
  const hopHeight = Math.sin((unicorn.hop / 0.6) * Math.PI) * 0.5;
  unicorn.g.position.y = unicorn.baseY + hopHeight;
}
