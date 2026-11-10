// Lina the unicorn, met on island 5. She slid down her rainbow from the sky island and it broke
// into four colour stars, so her mane and tail went grey. Every star brought back to the arch
// colours one stripe again, and she joins the crew. Back home on the sky island (island 6) her
// wings unfold (they only work up there) and she flies after Spartacus.
import * as THREE from 'three';
import { clamp, lerp, lerpAngle, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { material, mesh } from '../core/materials.js';
import { game } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { supportHeight } from '../core/colliders.js';
import { ship } from '../world/ship.js';
import { player } from '../player/player.js';

const GREY = 0xb8bcc8;
// state: sad (head down, waiting) | happy (all colours back) | follow (trotting after Spartacus)
//        | boarding (hopping onto the ship) | crew (on deck) | fly (flapping along after him)
// stripes: one material per mane/tail stripe, shared by the mane tuft and the tail strand,
// so colouring a stripe colours both. hop: seconds left of a happy little hop.
// wings: the two wing pivots (hidden until she flies); flyPos: where she's flying, before the bob
export const unicorn = {
  g: null,
  head: null,
  tail: null,
  horn: null,
  stripes: [],
  wings: [],
  flyPos: null,
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
  addWings(g);
}

// two feathery wings on her shoulders, each a pivot so it can flap; folded away until the sky
function addWings(g) {
  // a soft glow of their own, so seen from below they stay white
  const feather = material(0xf3ecff, { emissive: 0xe8dcff, emissiveIntensity: 0.35 });
  unicorn.wings = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.45, 1.75, 0.35);
    pivot.visible = false;
    g.add(pivot);
    // three overlapping feathers, longest at the front
    [1.15, 0.95, 0.75].forEach((length, i) => {
      const m = mesh(new THREE.SphereGeometry(0.5, 8, 6), feather);
      m.scale.set(length, 0.08, 0.32);
      m.position.set(side * length * 0.85, 0, -i * 0.3);
      m.rotation.y = side * i * 0.18;
      pivot.add(m);
    });
    return pivot;
  });
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
  unicorn.horn = horn;
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

// her horn's glow, 0..1 (it shines at night once every star is home)
export function setHornGlow(k) {
  unicorn.horn.material.emissiveIntensity = 0.3 + k * 2.2;
}

export const unicornFollow = () => {
  unicorn.state = 'follow';
};

// hop onto the ship's deck, then onAboard()
const DECK_SPOT = vec3(0, 1.2, -1.9); // ship-local, at the back of the deck
export function unicornBoard(onAboard) {
  unicorn.state = 'boarding';
  unicorn.t = 0;
  unicorn.from = unicorn.g.position.clone();
  unicorn.onAboard = onAboard;
  sfx.fruit();
}
// on deck at once (also when a save is put back)
export function unicornAboard() {
  unicorn.g.parent?.remove(unicorn.g);
  ship.add(unicorn.g);
  unicorn.g.position.copy(DECK_SPOT);
  unicorn.g.rotation.set(0, 0, 0);
  unicorn.g.scale.setScalar(0.55);
  for (const wing of unicorn.wings) wing.visible = false; // they only work up in the sky
  unicorn.state = 'crew';
}

// trot to a spot 3 behind Spartacus, on whatever is there (over water her hooves sparkle on the
// surface); if he's far away (a zipline, a whale spout) she catches up at once
function updateFollow(dt) {
  const g = unicorn.g,
    behindX = player.pos.x - Math.sin(player.yaw) * 3,
    behindZ = player.pos.z - Math.cos(player.yaw) * 3,
    dx = behindX - g.position.x,
    dz = behindZ - g.position.z,
    dist = Math.hypot(dx, dz);
  if (dist > 25) g.position.set(behindX, player.pos.y, behindZ);
  else if (dist > 0.6) {
    const step = Math.min(dist, dt * clamp(dist * 2, 2, 9));
    g.position.x += (dx / dist) * step;
    g.position.z += (dz / dist) * step;
    g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 6));
  }
  const ground = supportHeight(g.position.x, g.position.z, g.position.y + 1);
  unicorn.baseY = Math.max(ground, -0.3);
  if (ground < -0.3 && Math.random() < dt * 12)
    burst(g.position.clone().setY(0), { count: 1, color: [0xffd84d, 0xffffff], speed: 1, up: 1 });
}

// off the ship (if she's on it), wings out, and flying after Spartacus
export function unicornFly() {
  if (unicorn.g.parent !== scene) {
    unicorn.g.parent?.remove(unicorn.g);
    scene.add(unicorn.g);
  }
  unicorn.g.scale.setScalar(1);
  unicorn.g.rotation.set(0, player.yaw, 0);
  unicorn.flyPos = flySpot();
  unicorn.g.position.copy(unicorn.flyPos);
  unicorn.baseY = unicorn.flyPos.y;
  for (const wing of unicorn.wings) wing.visible = true;
  unicorn.state = 'fly';
}

// up and to one side behind Spartacus, so she never hides him from the camera
const FLY_BEHIND = 2.5,
  FLY_SIDE = 3,
  FLY_UP = 1.8;
function flySpot() {
  const sin = Math.sin(player.yaw),
    cos = Math.cos(player.yaw);
  return vec3(
    player.pos.x - sin * FLY_BEHIND - cos * FLY_SIDE,
    player.pos.y + FLY_UP,
    player.pos.z - cos * FLY_BEHIND + sin * FLY_SIDE,
  );
}

// glide after her spot, bobbing, wings flapping; if he's suddenly far away (back on a
// checkpoint cloud) she's there at once
function updateFly(dt) {
  const g = unicorn.g,
    spot = flySpot(),
    flyPos = unicorn.flyPos;
  if (flyPos.distanceTo(spot) > 25) flyPos.copy(spot);
  else flyPos.lerp(spot, 1 - Math.exp(-dt * 3));
  g.position.x = flyPos.x;
  g.position.z = flyPos.z;
  g.rotation.y = lerpAngle(g.rotation.y, player.yaw, Math.min(1, dt * 4));
  const time = game.time;
  unicorn.baseY = flyPos.y + Math.sin(time * 2.2) * 0.25;
  unicorn.wings.forEach((wing, i) => {
    const side = i ? 1 : -1;
    wing.rotation.z = side * (0.25 + Math.sin(time * 7) * 0.55);
  });
}

function updateBoarding(dt) {
  unicorn.t += dt;
  const t = clamp(unicorn.t / 1.2, 0, 1);
  ship.updateMatrixWorld(true);
  const to = ship.localToWorld(DECK_SPOT.clone());
  unicorn.g.position.lerpVectors(unicorn.from, to, t);
  unicorn.g.position.y += Math.sin(Math.PI * t) * 3;
  if (t < 1) return;
  unicornAboard();
  unicorn.onAboard?.();
}

// a swishing tail, the head drooped while sad, and a hop when a colour comes back
export function updateUnicorn(dt) {
  if (!unicorn.g) return;
  if (unicorn.state === 'follow') updateFollow(dt);
  if (unicorn.state === 'fly') updateFly(dt);
  if (unicorn.state === 'boarding') {
    updateBoarding(dt);
    return;
  }
  const time = game.time,
    sad = unicorn.state === 'sad';
  unicorn.head.rotation.x = lerp(unicorn.head.rotation.x, sad ? 0.45 : -0.1, Math.min(1, dt * 3));
  unicorn.tail.rotation.y = Math.sin(time * (sad ? 0.8 : 3)) * (sad ? 0.15 : 0.4);
  unicorn.hop = Math.max(0, unicorn.hop - dt);
  const hopHeight = Math.sin((unicorn.hop / 0.6) * Math.PI) * 0.5;
  if (unicorn.state !== 'crew') unicorn.g.position.y = unicorn.baseY + hopHeight;
}
