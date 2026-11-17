// Juf Anne, the squirrel teacher in the cave (Zoë's surprise, not on the to-do list). Coming near,
// Spartacus hears big growls and thinks there's a bear; close up (or with a woof) out she pops:
// she growls to keep her napping class safe. Her thank-you for being quiet is one of the bones.
// Once they're awake her class sits down for a lesson (Zoë), and when the to-do list is done she
// and the little ones wave Spartacus goodbye from the dock (Zoë).
import * as THREE from 'three';
import { distXZ, lerp, lerpAngle, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { canvasTexture, material, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst, onFontsReady } from '../../core/fx.js';
import { toast, toastTime, hintOnce } from '../../core/ui.js';
import { addPickup } from '../../systems/collect.js';

// Zoë's name for her ("juf" is Dutch for a primary-school teacher): change it here
export const TEACHER = 'Juf Anne';
const GROWL_REACH = 14; // m from the cave mouth where the growls start
const REVEAL_REACH = 4.5; // m: close enough that she comes out
const BARK_REACH = 10; // m: a woof this close brings her out too
const GROWL_EVERY = 4.5; // s between growls
const LESSON_REACH = 7; // m from the mouth: she says something about the lesson
const LESSON_EVERY = 14; // s at least between two lesson lines
const GOODBYE_AWAY = 25; // m: she only leaves for the dock once Spartacus is this far from both
const GOODBYE_REACH = 8; // m from the dock spot: "Goodbye, Spartacus!"

// a Montessori classroom: the pink tower, counting, paws (Zoë goes to a Montessori school)
const LESSON = [
  () => `${TEACHER}: “Today we build the pink tower. Biggest at the bottom!”`,
  (bones) => (bones > 0 ? `${TEACHER}: “Spartacus found ${bones} bones. Let’s count them!”` : null),
  () => `${TEACHER}: “A dog has four paws. How many does a squirrel have?”`,
  () => `${TEACHER}: “Look, class, Spartacus came to visit. Wave hello!”`,
];

// state: hidden (inside, growling when he's near) | popping (hopping out) | talking | teaching |
// goodbye (on the dock, once the list is done)
// mouth / inside / teach: {x, z, y} spots; growlTimer counts down to the next growl;
// dock: where she waves from, set by sayGoodbye() (she moves there while nobody's looking)
const anne = {
  g: null,
  paw: null,
  state: 'hidden',
  t: 0,
  growlTimer: 0,
  lessonTimer: 0,
  lessonLine: 0,
  mouth: null,
  inside: null,
  teach: null,
  facing: 0,
  from: vec3(),
  dock: null,
  bone: false, // her thank-you bone is out (it's a pickup from then on)
  babies: [],
};

// a squirrel: round body, cream tummy, big curled tail; `glasses` for the teacher.
// Returns {g, paw}: paw is the right arm's shoulder pivot, for waving and putting a paw up.
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
  const leftPaw = mesh(new THREE.SphereGeometry(0.07, 6, 5), fur);
  leftPaw.position.set(-0.12, 0.42, 0.28);
  g.add(leftPaw);
  // the right paw hangs from a shoulder pivot: rotation.x = -2.6 puts it up in the air
  const paw = new THREE.Group();
  paw.position.set(0.14, 0.56, 0.22);
  const arm = mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.16, 6), fur);
  arm.position.set(0, -0.06, 0.03);
  paw.add(arm);
  const hand = mesh(new THREE.SphereGeometry(0.07, 6, 5), fur);
  hand.position.set(0, -0.14, 0.06);
  paw.add(hand);
  g.add(paw);
  // the tail: a bushy curl of balls going up behind her and over the top
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const puff = mesh(new THREE.SphereGeometry(0.17 + 0.05 * Math.sin(t * Math.PI), 8, 6), fur);
    puff.position.set(0, 0.2 + t * 0.9, -0.3 - Math.sin(t * Math.PI * 0.9) * 0.35);
    g.add(puff);
  }
  g.scale.setScalar(size);
  return { g, paw };
}

// the Montessori pink tower: ten pink cubes, biggest at the bottom
function makePinkTower() {
  const g = new THREE.Group();
  let y = 0;
  for (let i = 10; i >= 1; i--) {
    const side = 0.04 * i;
    const cube = mesh(new THREE.BoxGeometry(side, side, side), material(0xf7a1c4));
    cube.position.y = y + side / 2;
    cube.rotation.y = i * 0.05; // stacked by little paws, not quite straight
    g.add(cube);
    y += side;
  }
  return g;
}

// a chalkboard on an easel: the lesson's sums and a bone (drawn once the font has loaded)
function makeChalkboard() {
  const g = new THREE.Group();
  const wood = material(0x8a5a32);
  for (const side of [-1, 1]) {
    const leg = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.7, 5), wood);
    leg.position.set(side * 0.6, 0.85, 0);
    leg.rotation.z = side * -0.08;
    g.add(leg);
  }
  const boardMaterial = new THREE.MeshStandardMaterial({ color: 0x2f5d47 });
  const board = mesh(new THREE.BoxGeometry(1.3, 0.85, 0.06), boardMaterial);
  board.position.set(0, 1.15, 0.03);
  g.add(board);
  onFontsReady(() => {
    boardMaterial.map = canvasTexture(256, 168, drawLesson);
    boardMaterial.color.set(0xffffff);
    boardMaterial.needsUpdate = true;
  });
  return g;
}
function drawLesson(ctx, w, h) {
  ctx.fillStyle = '#2f5d47';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f4f1e6';
  ctx.font = '600 40px Fredoka, ui-rounded, system-ui, sans-serif';
  ctx.fillText('1 + 2 = 3', 24, 58);
  // a chalk bone
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#f4f1e6';
  ctx.beginPath();
  ctx.moveTo(70, 118);
  ctx.lineTo(170, 118);
  ctx.stroke();
  for (const x of [62, 178])
    for (const y of [108, 128]) {
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  ctx.fillText('♥', 200, 58);
}

// She starts inside, at the back; her four little ones nap on the cave floor.
// mouth, inside: {x, z, y} (the cave faces from inside towards mouth)
export function addJufAnne(mouth, { inside }) {
  anne.mouth = mouth;
  anne.inside = inside;
  anne.facing = Math.atan2(mouth.x - inside.x, mouth.z - inside.z);
  const forwardX = Math.sin(anne.facing),
    forwardZ = Math.cos(anne.facing),
    sideX = Math.cos(anne.facing),
    sideZ = -Math.sin(anne.facing);
  // where she stands to teach: near the back, the chalkboard behind her, the pink tower beside
  anne.teach = vec3(inside.x - forwardX * 1.4, inside.y, inside.z - forwardZ * 1.4);
  const teacher = makeSquirrel({ size: 1.4, glasses: true });
  anne.g = teacher.g;
  anne.paw = teacher.paw;
  anne.g.position.set(inside.x, inside.y, inside.z);
  anne.g.rotation.y = anne.facing;
  scene.add(anne.g);
  const board = makeChalkboard();
  board.position.set(anne.teach.x - forwardX * 0.9, inside.y, anne.teach.z - forwardZ * 0.9);
  board.rotation.y = anne.facing;
  scene.add(board);
  const tower = makePinkTower();
  tower.position.set(anne.teach.x + sideX * 1.3, inside.y, anne.teach.z + sideZ * 1.3);
  scene.add(tower);
  for (let i = 0; i < 4; i++) {
    const baby = makeSquirrel({ size: 0.55 });
    const across = (i - 1.5) * 0.9;
    const nap = vec3(inside.x + sideX * across, inside.y, inside.z + sideZ * across);
    // home: where they wave from at the dock, set by moveToDock()
    // the lesson: sitting in a half circle in front of her, facing her
    const angle = ((i - 1.5) / 1.5) * 0.9;
    const seat = vec3(
      anne.teach.x + (forwardX * Math.cos(angle) + sideX * Math.sin(angle)) * 1.9,
      inside.y,
      anne.teach.z + (forwardZ * Math.cos(angle) + sideZ * Math.sin(angle)) * 1.9,
    );
    baby.g.position.copy(nap);
    baby.g.rotation.set(0, anne.facing + Math.PI / 2, Math.PI / 2.4); // curled up asleep
    scene.add(baby.g);
    anne.babies.push({ g: baby.g, paw: baby.paw, nap, seat, phase: i * 1.3 });
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

// just outside the mouth, where her thank-you bone pops up
const frontOfCave = () =>
  vec3(
    anne.mouth.x + Math.sin(anne.facing) * 1.6,
    anne.mouth.y,
    anne.mouth.z + Math.cos(anne.facing) * 1.6,
  );

// the little ones wake up anyway; she gives Spartacus a bone for being kind, then starts the lesson
function wakeTheClass() {
  anne.state = 'teaching';
  anne.lessonTimer = LESSON_EVERY;
  sfx.squeak();
  const front = frontOfCave();
  burst(front.clone().add(vec3(0, 0.9, 0)), {
    count: 18,
    color: [0xffd84d, 0xff9fb2, 0xffffff],
    speed: 3,
    up: 3,
    life: 0.8,
    size: 0.9,
  });
  giveBone({ pop: 0.6 });
  toast(`${TEACHER}: “Oh! They’re awake. Here’s a bone, Spartacus. Time for our lesson!”`, 3800);
}
function giveBone({ pop = 0 } = {}) {
  if (anne.bone) return;
  anne.bone = true;
  const front = frontOfCave();
  addPickup(front.x, front.z, { y: anne.mouth.y, island: 1, pop });
}

// the to-do list is done: she and the class go to the dock to wave (once he's far from both)
// dock: {x, z, y} where she stands; the little ones line up behind her along +z
export function sayGoodbye(dock) {
  anne.dock = dock;
}
function moveToDock() {
  anne.state = 'goodbye';
  const { dock } = anne;
  anne.g.position.set(dock.x, dock.y, dock.z);
  anne.babies.forEach((baby, i) => {
    baby.home = vec3(dock.x, dock.y, dock.z - 0.8 - i * 0.7);
    baby.g.position.copy(baby.home);
    baby.g.rotation.set(0, 0, 0);
  });
}

// per frame (island interact): growls while he's near, out she comes when he's close; later the
// lesson and the goodbye. bones: how many Spartacus has found (she counts them with the class)
export function interactJufAnne(p, { bones }) {
  if (anne.state === 'teaching') {
    if (distToMouth(p) < LESSON_REACH && anne.lessonTimer <= 0) sayLessonLine(bones);
    return;
  }
  if (anne.state === 'goodbye') {
    if (distXZ(p, anne.dock.x, anne.dock.z) < GOODBYE_REACH)
      hintOnce('anneGoodbye', `${TEACHER}: “Goodbye, Spartacus! Come back and visit!”`, 3400);
    return;
  }
  if (anne.state !== 'hidden') return;
  const dist = distToMouth(p);
  if (dist < REVEAL_REACH) {
    reveal();
    return;
  }
  if (dist > GROWL_REACH) return;
  hintOnce('growl', 'Grrrrr! Something BIG is growling in the cave… a bear?!', 3400);
}
function sayLessonLine(bones) {
  anne.lessonTimer = LESSON_EVERY;
  let line = null;
  while (!line) {
    line = LESSON[anne.lessonLine % LESSON.length](bones);
    anne.lessonLine += 1;
  }
  toast(line, 3400);
  for (const baby of anne.babies) baby.handUp = 2.5 + baby.phase * 0.3;
}

// a woof near the cave: she comes out to shush him; afterwards the class giggles
export function barkAtCave(p) {
  const dist = distToMouth(p);
  if (anne.state === 'hidden' && dist < BARK_REACH) reveal();
  else if (anne.state === 'teaching' && dist < BARK_REACH) {
    sfx.squeak();
    for (const baby of anne.babies) baby.hop = 0.5;
    toast(`${TEACHER}: “Shh! …oh, go on then. One more woof!”`, 2600);
  }
}

/* mid-island saves (game/progress.js) */
export const jufAnneState = () => ({ met: anne.state !== 'hidden' && anne.state !== 'popping' });
// met: the class is awake and in their lesson (the bone she gave is restored with the pickups)
export function restoreJufAnne({ met } = {}) {
  if (!met) return;
  anne.state = 'teaching';
  anne.lessonTimer = 0;
  anne.g.position.copy(anne.teach);
  for (const baby of anne.babies) baby.g.position.copy(baby.seat);
  giveBone();
}

// growl timing, her hop out of the cave, the lesson, the goodbye
export function updateJufAnne(dt, p) {
  anne.t += dt;
  anne.lessonTimer -= dt;
  const time = game.time;
  if (anne.state === 'hidden') {
    anne.growlTimer -= dt;
    if (anne.growlTimer <= 0 && distToMouth(p) < GROWL_REACH) {
      anne.growlTimer = GROWL_EVERY;
      sfx.growl();
    }
  }
  if (anne.state === 'popping') updatePopping();
  if (anne.state === 'talking') lookAt(p, { dt, y: anne.mouth.y });
  if (anne.state === 'teaching') updateTeaching(dt, p);
  if (anne.state === 'goodbye') {
    lookAt(p, { dt, y: anne.dock.y });
    waveAt(anne.paw, { time, phase: 0 });
  }
  for (const baby of anne.babies) updateBaby(baby, { dt, time, p });
}

function updatePopping() {
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

// turn towards Spartacus with a little bob
function lookAt(p, { dt, y }) {
  const toPlayer = Math.atan2(p.x - anne.g.position.x, p.z - anne.g.position.z);
  anne.g.rotation.y = lerpAngle(anne.g.rotation.y, toPlayer, Math.min(1, dt * 4));
  anne.g.position.y = y + Math.abs(Math.sin(game.time * 2)) * 0.04;
}

function updateTeaching(dt, p) {
  // she walks back to the chalkboard and faces her class, pointing now and then
  const pos = anne.g.position;
  pos.x = lerp(pos.x, anne.teach.x, Math.min(1, dt * 1.5));
  pos.z = lerp(pos.z, anne.teach.z, Math.min(1, dt * 1.5));
  pos.y = anne.teach.y + Math.abs(Math.sin(game.time * 2)) * 0.03;
  anne.g.rotation.y = lerpAngle(anne.g.rotation.y, anne.facing, Math.min(1, dt * 3));
  const pointing = Math.sin(game.time * 0.8) > 0.4;
  anne.paw.rotation.x = lerp(anne.paw.rotation.x, pointing ? -1.4 : 0, Math.min(1, dt * 5));
  if (!anne.dock) return;
  const farFromBoth =
    distToMouth(p) > GOODBYE_AWAY && distXZ(p, anne.dock.x, anne.dock.z) > GOODBYE_AWAY;
  if (farFromBoth) moveToDock();
}

// a paw up in the air, waving side to side
function waveAt(paw, { time, phase }) {
  paw.rotation.x = -2.6;
  paw.rotation.z = Math.sin(time * 9 + phase) * 0.45;
}

function updateBaby(baby, { dt, time, p }) {
  if (anne.state === 'hidden' || anne.state === 'popping' || anne.state === 'talking') {
    // asleep: breathing
    baby.g.scale.y = 0.55 * (1 + Math.sin(time * 2 + baby.phase) * 0.04);
    return;
  }
  baby.g.scale.y = 0.55;
  baby.g.rotation.z = lerp(baby.g.rotation.z, 0, Math.min(1, dt * 4));
  baby.hop = Math.max(0, (baby.hop ?? 0) - dt);
  baby.handUp = Math.max(0, (baby.handUp ?? 0) - dt);
  if (anne.state === 'goodbye') {
    baby.g.rotation.y = lerpAngle(
      baby.g.rotation.y,
      Math.atan2(p.x - baby.g.position.x, p.z - baby.g.position.z),
      Math.min(1, dt * 4),
    );
    waveAt(baby.paw, { time, phase: baby.phase });
    baby.g.position.y = baby.home.y + Math.abs(Math.sin(time * 5 + baby.phase)) * 0.08;
    return;
  }
  // sitting for the lesson, facing her; a paw up when she asks something, bouncing after a woof
  baby.g.position.x = lerp(baby.g.position.x, baby.seat.x, Math.min(1, dt * 2.5));
  baby.g.position.z = lerp(baby.g.position.z, baby.seat.z, Math.min(1, dt * 2.5));
  const toTeacher = Math.atan2(anne.teach.x - baby.seat.x, anne.teach.z - baby.seat.z);
  baby.g.rotation.y = lerpAngle(baby.g.rotation.y, toTeacher, Math.min(1, dt * 4));
  if (baby.handUp > 0) waveAt(baby.paw, { time, phase: baby.phase });
  else {
    baby.paw.rotation.x = lerp(baby.paw.rotation.x, 0, Math.min(1, dt * 6));
    baby.paw.rotation.z = 0;
  }
  const bounce = Math.abs(Math.sin(time * 5 + baby.phase)) * baby.hop;
  const fidget = Math.abs(Math.sin(time * 1.3 + baby.phase)) * 0.02;
  baby.g.position.y = baby.seat.y + bounce + fidget;
}
