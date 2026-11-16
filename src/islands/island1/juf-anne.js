// Juf Anne, the squirrel teacher in the cave (Zoë's surprise, not on the to-do list). Coming near,
// Spartacus hears big growls and thinks there's a bear; close up (or with a woof) out she pops:
// she growls to keep her napping class safe. Her thank-you for being quiet is one of the bones.
import * as THREE from 'three';
import { distXZ, lerp, lerpAngle, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { toast, toastTime, hintOnce } from '../../core/ui.js';
import { addPickup } from '../../systems/collect.js';

// Zoë's name for her ("juf" is Dutch for a primary-school teacher): change it here
export const TEACHER = 'Juf Anne';
const GROWL_REACH = 14; // m from the cave mouth where the growls start
const REVEAL_REACH = 4.5; // m: close enough that she comes out
const BARK_REACH = 10; // m: a woof this close brings her out too
const GROWL_EVERY = 4.5; // s between growls

// state: hidden (inside, growling when he's near) | popping (hopping out) | talking | friendly
// mouth / inside: {x, z, y} spots; growlTimer counts down to the next growl
const anne = {
  g: null,
  state: 'hidden',
  t: 0,
  growlTimer: 0,
  mouth: null,
  inside: null,
  from: vec3(),
  babies: [],
};

// a squirrel: round body, cream tummy, big curled tail; `glasses` for the teacher
function makeSquirrel({ size = 1, glasses = false } = {}) {
  const g = new THREE.Group();
  const fur = material(0xc9733a),
    cream = material(0xffe2b8),
    ink = material(0x2b2b38);
  const body = mesh(new THREE.SphereGeometry(0.32, 10, 8), fur);
  body.scale.set(1, 1.15, 0.95);
  body.position.y = 0.36;
  g.add(body);
  const tummy = mesh(new THREE.SphereGeometry(0.22, 10, 8), cream, { castShadow: false });
  tummy.scale.set(1, 1.2, 0.6);
  tummy.position.set(0, 0.34, 0.18);
  g.add(tummy);
  const head = mesh(new THREE.SphereGeometry(0.25, 10, 8), fur);
  head.position.set(0, 0.82, 0.06);
  g.add(head);
  const muzzle = mesh(new THREE.SphereGeometry(0.12, 8, 6), cream);
  muzzle.position.set(0, 0.76, 0.26);
  g.add(muzzle);
  const nose = mesh(new THREE.SphereGeometry(0.035, 6, 5), ink, { castShadow: false });
  nose.position.set(0, 0.8, 0.37);
  g.add(nose);
  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.08, 0.2, 6), fur);
    ear.position.set(side * 0.14, 1.06, 0.02);
    ear.rotation.z = side * -0.25;
    g.add(ear);
    const eye = mesh(new THREE.SphereGeometry(0.045, 6, 5), ink, { castShadow: false });
    eye.position.set(side * 0.1, 0.88, 0.25);
    g.add(eye);
    const paw = mesh(new THREE.SphereGeometry(0.07, 6, 5), fur);
    paw.position.set(side * 0.12, 0.42, 0.28);
    g.add(paw);
    if (glasses) {
      const lens = mesh(new THREE.TorusGeometry(0.075, 0.015, 5, 12), ink, { castShadow: false });
      lens.position.set(side * 0.1, 0.88, 0.29);
      g.add(lens);
    }
  }
  if (glasses) {
    const bridge = mesh(new THREE.BoxGeometry(0.06, 0.015, 0.015), ink, { castShadow: false });
    bridge.position.set(0, 0.89, 0.3);
    g.add(bridge);
  }
  // the tail: a bushy curl of balls going up behind her and over the top
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const puff = mesh(new THREE.SphereGeometry(0.17 + 0.05 * Math.sin(t * Math.PI), 8, 6), fur);
    puff.position.set(0, 0.2 + t * 0.9, -0.3 - Math.sin(t * Math.PI * 0.9) * 0.35);
    g.add(puff);
  }
  g.scale.setScalar(size);
  return g;
}

// She starts inside, at the back; her four little ones nap on the cave floor.
// mouth, inside: {x, z, y} (the cave faces from inside towards mouth)
export function addJufAnne(mouth, { inside }) {
  anne.mouth = mouth;
  anne.inside = inside;
  anne.facing = Math.atan2(mouth.x - inside.x, mouth.z - inside.z);
  anne.g = makeSquirrel({ size: 1.4, glasses: true });
  anne.g.position.set(inside.x, inside.y, inside.z);
  anne.g.rotation.y = anne.facing;
  scene.add(anne.g);
  const sideX = Math.cos(anne.facing),
    sideZ = -Math.sin(anne.facing);
  for (let i = 0; i < 4; i++) {
    const g = makeSquirrel({ size: 0.55 });
    const across = (i - 1.5) * 0.9;
    const nap = vec3(inside.x + sideX * across, inside.y, inside.z + sideZ * across);
    // once awake they line up just inside the mouth to peek out, two each side of her
    const peekAcross = (i < 2 ? -1 : 1) * (1.1 + (i % 2) * 0.7);
    const toward = 0.75; // most of the way from the middle of the cave to the mouth
    const peek = vec3(
      lerp(inside.x, mouth.x, toward) + sideX * peekAcross,
      inside.y,
      lerp(inside.z, mouth.z, toward) + sideZ * peekAcross,
    );
    g.position.copy(nap);
    g.rotation.set(0, anne.facing + Math.PI / 2, Math.PI / 2.4); // curled up asleep, on their side
    scene.add(g);
    anne.babies.push({ g, nap, peek, phase: i * 1.3 });
  }
}

const distToMouth = (p) => distXZ(p, anne.mouth.x, anne.mouth.z);

// toasts one after another, each given its full reading time; `then` runs after the last
function say(lines, then) {
  let at = 0;
  for (const [text, ms] of lines) {
    setTimeout(() => toast(text, ms), at);
    at += toastTime(text, ms) + 300;
  }
  setTimeout(then, at);
}

function reveal() {
  anne.state = 'popping';
  anne.t = 0;
  anne.from.copy(anne.g.position);
  sfx.squeak();
}

function startTalking() {
  anne.state = 'talking';
  say(
    [
      [`It’s not a bear! It’s ${TEACHER}, the squirrel teacher.`, 3200],
      [`${TEACHER}: “Shh! My class is having a nap.”`, 3000],
      [`${TEACHER}: “I growl so nobody wakes them up.”`, 3200],
    ],
    wakeTheClass,
  );
}

// the little ones wake up anyway and come to peek; she gives Spartacus a bone for being kind
function wakeTheClass() {
  anne.state = 'friendly';
  sfx.squeak();
  const { mouth } = anne;
  const front = vec3(
    mouth.x + Math.sin(anne.facing) * 1.6,
    mouth.y + 0.3,
    mouth.z + Math.cos(anne.facing) * 1.6,
  );
  burst(front.clone().add(vec3(0, 0.6, 0)), {
    count: 18,
    color: [0xffd84d, 0xff9fb2, 0xffffff],
    speed: 3,
    up: 3,
    life: 0.8,
    size: 0.9,
  });
  addPickup(front.x, front.z, { y: mouth.y, island: 1, pop: 0.6 });
  toast(`${TEACHER}: “Oh! They’re awake. Say hello! Here’s a bone, Spartacus.”`, 3800);
}

// per frame (island interact): growls while he's near, out she comes when he's close
export function interactJufAnne(p) {
  if (anne.state !== 'hidden') return;
  const dist = distToMouth(p);
  if (dist < REVEAL_REACH) {
    reveal();
    return;
  }
  if (dist > GROWL_REACH) return;
  hintOnce('growl', 'Grrrrr! Something BIG is growling in the cave… a bear?!', 3400);
}

// a woof near the cave: she comes out to shush him; afterwards the class giggles
export function barkAtCave(p) {
  const dist = distToMouth(p);
  if (anne.state === 'hidden' && dist < BARK_REACH) reveal();
  else if (anne.state === 'friendly' && dist < BARK_REACH) {
    sfx.squeak();
    for (const baby of anne.babies) baby.hop = 0.5;
    toast(`${TEACHER}: “Shh! …oh, go on then. One more woof!”`, 2600);
  }
}

// growl timing, her hop out of the cave, and the class waking and peeking out
export function updateJufAnne(dt, p) {
  anne.t += dt;
  const time = game.time;
  if (anne.state === 'hidden') {
    anne.growlTimer -= dt;
    if (anne.growlTimer <= 0 && distToMouth(p) < GROWL_REACH) {
      anne.growlTimer = GROWL_EVERY;
      sfx.growl();
    }
  }
  if (anne.state === 'popping') {
    const t = Math.min(1, anne.t / 0.9);
    const out = vec3(
      anne.mouth.x + Math.sin(anne.facing) * 0.4,
      anne.mouth.y,
      anne.mouth.z + Math.cos(anne.facing) * 0.4,
    );
    anne.g.position.lerpVectors(anne.from, out, t);
    anne.g.position.y += Math.sin(t * Math.PI) * 0.8; // a hop
    if (t === 1) startTalking();
  }
  if (anne.state === 'talking' || anne.state === 'friendly') {
    // she looks at Spartacus, with a little bob
    const toPlayer = Math.atan2(p.x - anne.g.position.x, p.z - anne.g.position.z);
    anne.g.rotation.y = lerpAngle(anne.g.rotation.y, toPlayer, Math.min(1, dt * 4));
    anne.g.position.y = anne.mouth.y + Math.abs(Math.sin(time * 2)) * 0.04;
  }
  for (const baby of anne.babies) updateBaby(baby, { dt, time });
}

function updateBaby(baby, { dt, time }) {
  if (anne.state !== 'friendly') {
    // asleep: breathing
    baby.g.scale.y = 0.55 * (1 + Math.sin(time * 2 + baby.phase) * 0.04);
    return;
  }
  baby.g.position.lerp(baby.peek, Math.min(1, dt * 2.5));
  baby.g.rotation.z = lerp(baby.g.rotation.z, 0, Math.min(1, dt * 4));
  baby.g.rotation.y = lerpAngle(baby.g.rotation.y, anne.facing, Math.min(1, dt * 4));
  baby.g.scale.y = 0.55;
  baby.hop = Math.max(0, (baby.hop ?? 0) - dt);
  // excited little bounces, out of step with each other (bigger after a woof)
  const bounce = Math.abs(Math.sin(time * 5 + baby.phase)) * (0.06 + baby.hop * 0.5);
  baby.g.position.y = baby.peek.y + bounce;
}
