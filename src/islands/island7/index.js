import * as THREE from 'three';
import { distXZ, lerp, seededRandom, smoothstep, vec3 } from '../../core/util.js';
import { scene, LOW_POWER } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { sfx } from '../../core/audio.js';
import { toast, hintOnce, actionKeyName } from '../../core/ui.js';
import { addBox, addCylinder } from '../../core/colliders.js';
import { terrainHeight, buildGround } from '../../world/terrain.js';
import { CENTER_7 } from '../../world/layout.js';
import { palm, scatter, dock } from '../../world/props.js';
import { addSea } from '../../world/ocean.js';
import { ship, shipState, shipBubble } from '../../world/ship.js';
import { daylight, isNight } from '../../world/daylight.js';
import { makeTicket } from '../../models/items.js';
import { addPickup, pickupText } from '../../systems/collect.js';
import { addFruit } from '../../systems/powers.js';
import { tooBigToRide } from '../../systems/rides.js';
import { player } from '../../player/player.js';
import { ensureMangoCrew } from '../../npcs/mango.js';
import { wasabiToBucket } from '../../npcs/wasabi.js';
import { unicornAboard, colourStripe } from '../../npcs/unicorn.js';
import { ensureEduardoCrew } from '../island4/eduardo.js';
import { BANDS } from '../island5/finale.js';
import { completeTask } from '../../game/tasks.js';
import { showEnd } from '../../game/flow.js';
import {
  toWorld,
  GROUND,
  SHORE,
  DOCK,
  SPAWN,
  SHIP_SPOT,
  ARCH,
  PIP,
  STAND,
  BIG_TOP,
  ROCKETS,
  JELLIES,
  CAKE,
  ISLET,
  CANNON_OUT,
  CANNON_BACK,
  HAY,
  MOUNDS,
  WHEEL,
  SKY_DECK,
  TRACK_IN,
  LOOP,
  TRACK_OUT,
  GARDEN,
  MEGA_BUSH,
  POPCORN_STALL,
} from './layout.js';
import {
  addArch,
  addBigTop,
  addStall,
  addLamp,
  addBunting,
  addBalloons,
  addHay,
  addBullseye,
  addTinyHouse,
  finishDecor,
  updateDecor,
} from './decor.js';
import {
  addJelly,
  addCake,
  bounceOnJellies,
  slamJelly,
  updateJellies,
  onJelly,
} from './jellies.js';
import { addCannon } from './cannon.js';
import { buildWheel } from './wheel.js';
import { buildCoaster } from './coaster.js';
import { addFuzzles, finishFuzzles, updateFuzzles, exciteFuzzles, addPip } from './fuzzles.js';
import {
  buildStand,
  addRocket,
  grabRockets,
  updateRockets,
  rocketsHome,
  allRockets,
  sendRocketHome,
  hideRocket,
} from './rockets.js';
import { startShow, updateFireworks, encore } from './fireworks.js';
import { leoToPerch, sendLeo, updateScout } from './scout.js';
import { buildSlide } from './arrive.js';

// Island 7, Jamboree Island: a funfair run by the Fuzzles, tiny fluffy folk in party hats.
// Tonight is their fireworks show, but the cannon went off by mistake and blew the five show
// rockets all over the fair. Every rocket waits at the end of a ride, and every ride is a toy:
// jellies that bounce (jellies.js), cannons that fire Spartacus across the island (cannon.js),
// the Big Wheel (wheel.js), a rollercoaster with a loop (coaster.js), and the Mega-Me fruit
// that makes him GIANT (player/mega.js). Touch a rocket and it flies home to the stand
// (rockets.js); with all five there, at night, he lights the show (fireworks.js). Leo the
// magpie finds golden tickets for a woof (scout.js). The map is in layout.js; the design, and
// what's a placeholder until Zoë has her say, is in docs/island7.md.

const SEA_FLOOR = -4.6; // deeper than the open-sea depth, so the current carries swimmers home
const TICKETS = 12;
const ENCORE_EVERY = 7; // seconds between the fireworks that go up by themselves after the show

/* ---------------- terrain ---------------- */

// Bullseye Rock: a low grassy bump with a beach, out past the shore
function isletHeight(x, z) {
  const dist = Math.hypot(x - ISLET.x, z - ISLET.z),
    h = lerp(ISLET.height, 0.35, smoothstep(ISLET.radius - 5, ISLET.radius - 1.5, dist));
  return lerp(h, SEA_FLOOR, smoothstep(ISLET.radius, ISLET.radius + 2.5, dist));
}

// a big, nearly flat fairground with a wobbly shore, a beach ring, and the islet
function height(x, z) {
  const local = { x: x - CENTER_7.x, z: z - CENTER_7.z },
    r = Math.hypot(local.x, local.z),
    angle = Math.atan2(local.z, local.x),
    shore = SHORE + 3 * Math.sin(angle * 3 + 1) + 2 * Math.sin(angle * 5);
  let h = GROUND + 0.18 * Math.sin(local.x * 0.21) * Math.cos(local.z * 0.19);
  for (const mound of MOUNDS) {
    const dist = Math.hypot(local.x - mound.x, local.z - mound.z);
    h += mound.height * Math.exp(-(dist * dist) / (2 * mound.radius * mound.radius));
  }
  h = lerp(h, 0.35, smoothstep(shore - 6, shore - 2.5, r));
  h = lerp(h, SEA_FLOOR, smoothstep(shore, shore + 3, r));
  return Math.max(h, isletHeight(local.x, local.z));
}

/* ---------------- building ---------------- */

// filled in by build(): the rides and spots the triggers use
const spots = {};

// island-local (x, z) -> a world Vector3 standing on the ground there
const onGround = (x, z) => {
  const at = toWorld(x, z);
  return vec3(at.x, terrainHeight(at.x, at.z), at.z);
};

function build() {
  buildGround(CENTER_7.x, CENTER_7.z, {
    size: 224,
    segments: LOW_POWER ? 112 : 180,
    palette: { g: 0x7ed56f, g2: 0xa9e67e },
  });
  addSea(CENTER_7.x, CENTER_7.z, { width: 520, depth: 520 });
  dock(CENTER_7.x + DOCK.x, { zFrom: CENTER_7.z + DOCK.zFrom, zTo: CENTER_7.z + DOCK.zTo });
  island.spawn = onGround(...SPAWN);
  buildSlide();
  buildPlaza();
  buildJellyJumps();
  buildCannons();
  buildWheelAndCoaster();
  buildGarden();
  buildFair();
  finishDecor();
  finishFuzzles();
  buildGreenery(); // last: palms and flowers use the shared rand() (see architecture.md)
}

// the way in: arch, Pip on his drum, the rocket stand, and the hay the cannon back lands on
function buildPlaza() {
  const arch = toWorld(ARCH.x, ARCH.z);
  spots.perch = addArch(arch.x, arch.z);
  const pip = toWorld(PIP.x, PIP.z);
  spots.pip = addPip(pip.x, pip.z);
  const stand = toWorld(STAND.x, STAND.z);
  spots.stand = buildStand(stand.x, stand.z, { radius: STAND.radius, onHome: rocketHome });
  const hay = toWorld(HAY.x, HAY.z);
  spots.hayTop = addHay(hay.x, hay.z);
  const bigTop = toWorld(BIG_TOP.x, BIG_TOP.z);
  addBigTop(bigTop.x, bigTop.z, { radius: BIG_TOP.radius });
}

// rockets are added in the order of ROCKETS, which is also their tube on the stand
function placeRocket(name, pos) {
  const { color, task } = ROCKETS[name],
    index = Object.keys(ROCKETS).indexOf(name);
  addRocket(name, { color, task, pos, index });
}

function buildJellyJumps() {
  for (const [x, z, top, radius] of JELLIES) {
    const at = toWorld(x, z);
    addJelly(at.x, at.z, { height: top, radius });
  }
  const cake = toWorld(CAKE.x, CAKE.z);
  spots.cake = addCake(cake.x, cake.z, { tiers: CAKE.tiers });
  placeRocket('purple', spots.cake.top);
}

// the Kaboom Cannon fires out to Bullseye Rock; the one out there fires back onto the hay
function buildCannons() {
  const out = toWorld(CANNON_OUT.x, CANNON_OUT.z),
    target = toWorld(...CANNON_OUT.to),
    back = toWorld(CANNON_BACK.x, CANNON_BACK.z),
    hay = toWorld(...CANNON_BACK.to);
  const bullseye = addBullseye(target.x, target.z);
  spots.cannons = [
    addCannon(out.x, out.z, {
      to: vec3(target.x, bullseye, target.z),
      apex: CANNON_OUT.apex,
      onLand: () => hintOnce('bullseye', 'Bullseye! What a flight!', 2600),
    }),
    addCannon(back.x, back.z, { to: vec3(hay.x, spots.hayTop, hay.z), apex: CANNON_BACK.apex }),
  ];
  placeRocket('red', onGround(ISLET.x - 4, ISLET.z - 4));
}

// a track point from layout.js ([x, y, z], island-local) as a world Vector3
const trackPoint = ([x, y, z]) => {
  const world = toWorld(x, z);
  return vec3(world.x, y, world.z);
};

function buildWheelAndCoaster() {
  const at = toWorld(WHEEL.x, WHEEL.z),
    deck = { ...SKY_DECK, ...toWorld(SKY_DECK.x, SKY_DECK.z) };
  spots.wheel = buildWheel(at, { radius: WHEEL.radius, hubHeight: WHEEL.hubHeight, deck });
  placeRocket('yellow', vec3(deck.x - 5, spots.wheel.deckTop, deck.z + 1.6));
  const center = toWorld(LOOP.x, LOOP.z);
  spots.coaster = buildCoaster({
    inPoints: TRACK_IN.map(trackPoint),
    outPoints: TRACK_OUT.map(trackPoint),
    loop: {
      center: vec3(center.x, LOOP.bottom + LOOP.radius, center.z),
      radius: LOOP.radius,
      shift: LOOP.shift,
    },
  });
  // just under the top of the loop, where the upside-down cart passes
  placeRocket('blue', spots.coaster.loopTop.clone().add(vec3(0, -2.4, 0)));
  buildEndStation(trackPoint(TRACK_OUT.at(-1)));
}

// where the coaster stops: a little platform under the end of the track, with a buffer
function buildEndStation(end) {
  const ground = terrainHeight(end.x, end.z),
    top = end.y - 0.25;
  const platform = mesh(new THREE.BoxGeometry(5, top - ground + 0.4, 2.6), material(0xc48a54), {
    receiveShadow: true,
  });
  platform.position.set(end.x + 1.5, (ground - 0.4 + top) / 2, end.z);
  scene.add(platform);
  addBox(end.x + 1.5, end.z, { hw: 2.5, hd: 1.3, bottom: ground - 1, top });
  const buffer = mesh(new THREE.BoxGeometry(0.3, 0.9, 1.6), material(0xf2545b));
  buffer.position.set(end.x - 1.2, top + 0.45, end.z);
  scene.add(buffer);
}

// the Secret Garden: a ring of hedge with no way in, a rocket on a pedestal in the middle,
// and a jelly inside to bounce back out over the hedge
function buildGarden() {
  const garden = toWorld(GARDEN.x, GARDEN.z),
    hedgeRand = seededRandom(717), // its own sequence: the shared rand() stays untouched
    count = Math.round((Math.PI * 2 * GARDEN.radius) / 1.9),
    lumps = [],
    flowers = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2,
      x = garden.x + Math.cos(angle) * GARDEN.radius,
      z = garden.z + Math.sin(angle) * GARDEN.radius,
      ground = terrainHeight(x, z);
    addCylinder(x, z, { r: 1.25, bottom: ground - 1, top: ground + GARDEN.height });
    for (const [y, size] of [
      [0.9, 1.5],
      [2.05, 1.35],
    ])
      lumps.push(
        new THREE.Matrix4()
          .makeRotationY(hedgeRand() * 6.28)
          .scale(vec3(size, size * 0.8, size))
          .setPosition(x, ground + y, z),
      );
    flowers.push(
      new THREE.Matrix4().setPosition(
        x + (hedgeRand() - 0.5) * 1.6,
        ground + GARDEN.height + 0.05,
        z + (hedgeRand() - 0.5) * 1.6,
      ),
    );
  }
  addInstanced(new THREE.IcosahedronGeometry(1, 1), material(0x3f9f4a), lumps);
  addInstanced(new THREE.IcosahedronGeometry(0.22, 0), material(0xff9fb2), flowers);
  const middle = onGround(GARDEN.x, GARDEN.z);
  const pedestal = mesh(new THREE.CylinderGeometry(0.8, 1, 0.8, 12), material(0xfffaf0));
  pedestal.position.copy(middle).setY(middle.y + 0.4);
  scene.add(pedestal);
  addCylinder(middle.x, middle.z, { r: 0.9, bottom: middle.y - 1, top: middle.y + 0.8 });
  placeRocket('green', middle.clone().setY(middle.y + 0.8));
  const jelly = toWorld(GARDEN.x + 3.4, GARDEN.z + 2.6);
  addJelly(jelly.x, jelly.z, { height: 0.45, radius: 1.7 });
}

function addInstanced(geometry, mat, matrices) {
  const instanced = new THREE.InstancedMesh(geometry, mat, matrices.length);
  matrices.forEach((matrix, i) => instanced.setMatrixAt(i, matrix));
  instanced.computeBoundingSphere();
  instanced.receiveShadow = true;
  scene.add(instanced);
}

// stalls, lamps with bunting between them, balloons, the Fuzzles' village and the Fuzzles
function buildFair() {
  const stall = toWorld(POPCORN_STALL.x, POPCORN_STALL.z);
  spots.stallRoof = addStall(stall.x, stall.z, { color: 0xf2545b, goods: 0xfff6e2 });
  const stalls = [
    [17, 42, 0x5aa8ff, 0xff8fd0],
    [-17, 45, 0xffd84d, 0x9be36c],
    [13, 2, 0xb06cff, 0xffa53d],
    [-14, 12, 0x5fd66a, 0xffd84d],
  ];
  for (const [x, z, color, goods] of stalls) {
    const at = toWorld(x, z);
    addStall(at.x, at.z, { color, goods });
  }
  // two rows of lamps up the path from the arch, strung with bunting
  for (const side of [-1, 1]) {
    let previous = null;
    for (const [x, z] of [
      [7, 41],
      [9, 31],
      [9.5, 21],
      [8, 5],
    ]) {
      const at = toWorld(side * x, z),
        top = addLamp(at.x, at.z);
      if (previous) addBunting(previous, top);
      previous = top;
    }
  }
  for (const [x, z] of [
    [-22, -16],
    [-40, -18],
    [24, 30],
    [36, 32],
    [-16, 28],
    [28, -2],
    [20, 26],
  ]) {
    const at = toWorld(x, z);
    addLamp(at.x, at.z);
  }
  for (const [x, z] of [
    [6.5, 46.5],
    [-6.5, 46.5],
    [-17, 20],
    [25, 34],
    [-25, -19],
    [19, 18],
    [31, 3],
    [-9, 4],
  ]) {
    const at = toWorld(x, z);
    addBalloons(at.x, at.z);
  }
  const houses = [
    [-26, 40, 0xff8fd0, 0.4],
    [-30, 36, 0x7fd8ee, 1.2],
    [-23, 45, 0xffd84d, -0.3],
    [-31, 43, 0xb59cff, 0.9],
  ];
  for (const [x, z, color, yaw] of houses) {
    const at = toWorld(x, z);
    addTinyHouse(at.x, at.z, { color, yaw });
  }
  // [x, z, how many, how spread out]: a crowd on the plaza, a queue at every ride
  const crowds = [
    [0, 30, 8, 5],
    [-9.5, 8, 4, 2.2],
    [-16, 27, 4, 2.5],
    [25, 34, 4, 2.5],
    [-27, -16, 4, 2.5],
    [-27, 40.5, 5, 2],
    [GARDEN.x, GARDEN.z, 3, 2.4],
    [19, 27, 3, 2],
    [25, 1, 3, 2],
  ];
  for (const [x, z, count, spread] of crowds) {
    const at = toWorld(x, z);
    addFuzzles(at.x, at.z, { count, spread });
  }
}

// things flowers and bushes keep off: [x, z, radius], island-local
const KEEP_CLEAR = [
  [STAND.x, STAND.z, STAND.radius + 2],
  [PIP.x, PIP.z, 3],
  [HAY.x, HAY.z, 4],
  [CAKE.x, CAKE.z, 7],
  [CANNON_OUT.x, CANNON_OUT.z, 5],
  [WHEEL.x, WHEEL.z + 4, 11],
  [GARDEN.x, GARDEN.z, GARDEN.radius + 2],
  [BIG_TOP.x, BIG_TOP.z, BIG_TOP.radius + 1.5],
  ...JELLIES.map(([x, z, , radius]) => [x, z, radius + 1.5]),
];
const clearOfRides = (x, z) => {
  const local = { x: x - CENTER_7.x, z: z - CENTER_7.z };
  if (Math.abs(local.x) < 3 && local.z > 20) return false; // the path up from the dock
  return KEEP_CLEAR.every(([cx, cz, radius]) => distXZ(local, cx, cz) > radius);
};

function buildGreenery() {
  const palmSpots = [
    [-14, 52],
    [15, 51],
    [-44, 30],
    [46, 30],
    [-52, -12],
    [54, -22],
    [-24, -50],
    [22, -52],
    [-50, 18],
    [50, 18],
    [ISLET.x + 5, ISLET.z + 4],
  ];
  for (const [x, z] of palmSpots) {
    const at = toWorld(x, z);
    palm(at.x, at.z);
  }
  scatter(CENTER_7.x, CENTER_7.z, { radius: 50, allowed: clearOfRides, bushes: 16, flowers: 110 });
}

// the Mega-Me bush and the golden tickets (no rand() here)
function buildLate() {
  const bush = onGround(...MEGA_BUSH);
  addFruit(bush.x, bush.z, { type: 'mega', y: bush.y, bush: true });
  const [out, back] = spots.cannons,
    garden = onGround(GARDEN.x - 3.5, GARDEN.z - 2),
    [jellyX, jellyZ, jellyTop] = JELLIES[1],
    aboveJelly = onGround(jellyX, jellyZ),
    stall = toWorld(POPCORN_STALL.x, POPCORN_STALL.z),
    riding = (u) => spots.coaster.pointAt(u).add(vec3(0, 0.45, 0)); // a rider's height
  // one by the arch to start with, then one for every toy and every corner
  const tickets = [
    onGround(-7, 39),
    aboveJelly.setY(aboveJelly.y + jellyTop + 2.6), // a bounce high
    spots.cake.middle,
    out.arc(0.3),
    out.arc(0.62),
    back.arc(0.5),
    onGround(ISLET.x + 5, ISLET.z - 4),
    spots.wheel.seatAt(Math.PI), // at 9 o'clock on the Big Wheel
    riding(0.2),
    riding(0.8),
    garden,
    vec3(stall.x, spots.stallRoof, stall.z), // only a giant dog steps up here
  ];
  for (const pos of tickets) addPickup(pos.x, pos.z, { y: pos.y, island: island.id });
}

/* ---------------- arriving ---------------- */

// the ship is back on the sea beside the dock; the whole crew is aboard, Lina with her wings
// folded (they only work in the sky), and Leo flies to the arch to keep a look-out for tickets
function enter() {
  const at = toWorld(...SHIP_SPOT);
  ship.position.set(at.x, 0, at.z);
  ship.rotation.y = Math.PI;
  ship.updateMatrixWorld(true);
  shipState.baseY = -0.15;
  shipState.depth = 0;
  shipBubble.visible = false;
  ensureMangoCrew();
  wasabiToBucket();
  ensureEduardoCrew();
  BANDS.forEach((color, i) => colourStripe(i, color, { quiet: true }));
  unicornAboard();
  leoToPerch(spots.perch);
}

/* ---------------- the story ---------------- */

const nearPip = (p, reach) =>
  distXZ(p, spots.pip.pos.x, spots.pip.pos.z) < reach && Math.abs(p.y - spots.pip.pos.y) < 3;
const nearStand = (p, reach) =>
  distXZ(p, spots.stand.x, spots.stand.z) < reach && Math.abs(p.y - spots.stand.y) < 2.5;

// walking up to Pip: he tells what happened
function meetPip() {
  completeTask('fairPip');
  sfx.fruit();
  spots.pip.hop();
  const lines = [
    [0, 'Pip: “Welcome to the Jamboree! Tonight is our BIG fireworks show!”', 3800],
    [4200, 'Pip: “But our cannon went KABOOM… and blew the five rockets all over the fair!”', 4200],
    [8800, 'Pip: “Follow the coloured lights. Every ride is free for you!”', 3600],
  ];
  for (const [delay, text, ms] of lines) setTimeout(() => toast(text, ms), delay);
}

// a woof at Pip: how it's going, and a tip about the next thing
function askPip() {
  spots.pip.hop();
  if (island.done.fairShow)
    toast('Pip: “The best Jamboree EVER! Woof by the stand at night for more!”', 3600);
  else if (rocketsHome() === 5)
    toast('Pip: “All five rockets are ready! The show starts when it’s dark.”', 3600);
  else if (!spots.wheel.on())
    toast(`Pip: “${rocketsHome()} of 5 rockets! Psst: Mega-Me mushrooms make you HUGE.”`, 3800);
  else toast(`Pip: “${rocketsHome()} of 5 rockets are on the stand!”`, 3000);
}

// a rocket landed in its tube on the stand
function rocketHome(rocket, { quiet }) {
  if (quiet) return;
  completeTask(rocket.task);
  const home = rocketsHome();
  toast(`The ${rocket.name} rocket is back on the stand! ${home} of 5`, 3200);
  if (home < 5) return;
  setTimeout(() => {
    spots.pip.hop();
    toast('Pip: “All five rockets! The show starts when it’s dark… 🌙”', 4000);
  }, 3600);
}

// at the stand, at night, with every rocket home: light the fuse
function showAction(p) {
  const ready = rocketsHome() === 5 && !island.done.fairShow && nearStand(p, STAND.radius + 0.5);
  if (!ready || !isNight() || player.giant) return null;
  return { label: 'Light', run: () => startShow(spots.stand, { onDone: showOver }) };
}

function showOver() {
  completeTask('fairShow');
  toast('Pip: “The best Jamboree EVER! Thank you, Spartacus!”', 3600);
  if (island.collect.count < TICKETS)
    setTimeout(
      () => toast('There are still golden tickets to find… Woof, and Leo will help! 🎟️', 3600),
      9000,
    );
}

/* ---------------- every frame ---------------- */

const encores = { timeLeft: ENCORE_EVERY };

function update(dt) {
  updateJellies(dt);
  updateFuzzles(dt);
  updateRockets(dt);
  updateFireworks(dt);
  updateScout(dt);
  updateDecor(daylight.night);
  spots.pip.update(dt);
  spots.wheel.update(dt);
  spots.coaster.update(dt);
  // once the show has been, the fair has a firework or two every night
  if (!island.done.fairShow || !isNight()) return;
  encores.timeLeft -= dt;
  if (encores.timeLeft > 0) return;
  encores.timeLeft = ENCORE_EVERY;
  encore(spots.stand);
}

// one-time hints for everything new
function hints(p) {
  const [out, back] = spots.cannons;
  if (out.near(p) || back.near(p)) {
    if (!tooBigToRide()) hintOnce('cannon', `A cannon! Press ${actionKeyName()} to hop in.`, 3200);
  }
  if (onJelly(JELLIES.length - 1, p) && !island.done.fairJelly)
    hintOnce('jellySlam', 'The cake is very high… Jump, then Slam down on this jelly!', 4000);
  const garden = toWorld(GARDEN.x, GARDEN.z),
    fromHedge = distXZ(p, garden.x, garden.z) - GARDEN.radius;
  if (fromHedge > 0 && fromHedge < 4 && !player.giant && !island.done.fairGarden)
    hintOnce(
      'garden',
      'A secret garden! The hedge is too tall to jump… A GIANT dog could step over.',
      4200,
    );
  if (rocketsHome() === 5 && !island.done.fairShow && nearStand(p, STAND.radius + 3)) {
    if (isNight())
      hintOnce('fuse', `Push the fuse box with ${actionKeyName()} to start the show!`, 3400);
    else hintOnce('fairNight', 'The show starts when it’s dark. Try the 🌙 button!', 3400);
  }
}

function interact(p) {
  grabRockets(p);
  bounceOnJellies();
  spots.wheel.interact(p);
  spots.coaster.interact(p);
  if (!island.done.fairPip && nearPip(p, 6)) meetPip();
  hints(p);
}

// a woof: Fuzzles jump (a giant woof blows them away, giggling), the stuck wheel may start,
// Pip answers, the stand fires an encore, and otherwise Leo goes looking for a ticket
function bark(p) {
  if (player.giant) {
    const blown = exciteFuzzles(p, { reach: 18, up: 9, away: 10 });
    if (blown) hintOnce('fuzzWoof', 'Fuzzles: “WHEEEE! Do it again!”', 2800);
  } else exciteFuzzles(p, { reach: 9, up: 4.5 });
  if (spots.wheel.bark(p)) return;
  if (nearPip(p, 8)) {
    askPip();
    return;
  }
  if (island.done.fairShow && isNight() && nearStand(p, 16)) {
    encore(spots.stand);
    return;
  }
  sendLeo(p);
}

// a giant footstep nearby: up they go (they think it's the best ride at the fair)
function stomp(p) {
  const hopped = exciteFuzzles(p, { reach: 7, up: 6, away: 3 });
  if (hopped) hintOnce('fuzzStomp', 'Fuzzles: “He’s HUGE! Again, again!”', 2800);
}

// a ground pound: a Slam on a jelly is a MEGA bounce; anywhere else the Fuzzles nearby hop
function pound(p) {
  if (!slamJelly(p)) exciteFuzzles(p, { reach: 8, up: 7, away: 2 });
}

/* ---------------- leaving, saving ---------------- */

const onDockEnd = (p) =>
  p.z > CENTER_7.z + DOCK.zTo - 5 && Math.abs(p.x - CENTER_7.x - DOCK.x) < 1.6 && p.y > 0.5;
const sailOn = () =>
  showEnd(
    'The Fuzzles had the best Jamboree ever, and the fireworks wrote a name across the sky! Where does the ship sail next? Make up the story!',
  );

// tasks, tickets and the power are saved for you; the wheel isn't, and the rockets are put
// back from their tasks
function loadState(state) {
  if (state.wheel) spots.wheel.start({ quiet: true });
  for (const rocket of allRockets()) {
    if (island.done[rocket.task]) sendRocketHome(rocket, { quiet: true });
    if (island.done.fairShow) hideRocket(rocket); // they went up in the show
  }
}

const island = {
  id: 7,
  center: CENTER_7,
  name: 'Jamboree Island',
  zMax: -1800,
  height,
  savesProgress: true,
  // keeps Spartacus over the ground mesh; the sea current brings him back long before this
  physics: { bound: { x: CENTER_7.x, z: CENTER_7.z, r: 106 } },
  // a deep purple night, so the fair's lights and the fireworks glow against it
  sky: {
    day: new THREE.Color(0xa8e6f7),
    night: new THREE.Color(0x17123f),
    ground: new THREE.Color(0x8fcf7a),
  },
  tasks: {
    title: 'Jamboree Island',
    list: [
      { id: 'fairPip', ic: '🎩', t: () => 'Meet Pip the ringmaster' },
      { id: 'fairJelly', ic: '💜', t: () => 'Purple rocket: bounce up the Jelly Jumps' },
      { id: 'fairCannon', ic: '❤️', t: () => 'Red rocket: fly from the Kaboom Cannon' },
      { id: 'fairMega', ic: '🦖', t: () => 'Eat a Mega-Me fruit', power: 'mega' },
      { id: 'fairGarden', ic: '💚', t: () => 'Green rocket: get into the Secret Garden' },
      { id: 'fairWheel', ic: '💛', t: () => 'Yellow rocket: ride the Big Wheel to the top' },
      { id: 'fairLoop', ic: '💙', t: () => 'Blue rocket: loop the Loop-de-Woof' },
      { id: 'fairTickets', ic: '🎟️', t: () => pickupText(7, 'golden tickets') },
      { id: 'fairShow', ic: '🎆', t: () => 'Start the fireworks when it’s dark' },
    ],
  },
  collect: {
    total: TICKETS,
    count: 0,
    taskId: 'fairTickets',
    name: 'Golden ticket',
    all: 'All the golden tickets! Good boy, Spartacus!',
    model: makeTicket,
  },
  balls: [
    [-5, 26],
    [6, 24],
    [12, 46],
  ],
  critters: {
    birds: [
      [-10, 51],
      [24, 46],
      [-42, 26],
    ],
    butterflies: [
      [GARDEN.x, GARDEN.z],
      [-20, 32],
      [12, 10],
    ],
  },
  // a bouncy fairground tune: oom-pah bass under a merry-go-round melody (core/music.js)
  music: {
    tempo: 132,
    root: 60,
    wave: 'triangle',
    melody: [0, 2, 4, 2, 5, 4, 2, null, 1, 3, 5, 3, 7, 5, 4, null],
    bass: [-5, null, 0, null, -5, null, 0, null, -4, null, 1, null, -5, null, 0, null],
  },
  intro: [
    [3400, 'A funfair! The Fuzzles are getting ready for a big party.', 3400],
    [7400, 'Someone in a top hat is waving, just past the arch…', 3400],
    [11400, 'Leo the magpie loves shiny things. Woof, and he looks for golden tickets!', 4200],
  ],
  win: {
    title: 'What a Jamboree!',
    text: 'Every rocket flew, every ticket is found, and the Fuzzles are still cheering. The fireworks even knew your name!',
    tip: 'Keep exploring: every ride is still open, and there are fireworks every night.',
    go: 'What happens next? ✨',
  },
  exit: { label: 'Sail', at: onDockEnd, run: sailOn },
  build,
  buildLate,
  enter,
  update,
  interact,
  actions(p) {
    if (player.giant) return null; // too big for buttons and rides: stomping is the fun
    for (const cannon of spots.cannons) {
      const action = cannon.action(p);
      if (action) return action;
    }
    return showAction(p) || spots.wheel.action(p) || spots.coaster.action(p);
  },
  bark,
  stomp,
  pound,
  saveState: () => ({ wheel: spots.wheel.on() }),
  loadState,
};
export default island;
