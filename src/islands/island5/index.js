import * as THREE from 'three';
import { distXZ, distToSegmentXZ, lerp, smoothstep, vec3 } from '../../core/util.js';
import { scene, LOW_POWER } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { toast, hintOnce } from '../../core/ui.js';
import { addCylinder } from '../../core/colliders.js';
import { terrainHeight, buildGround } from '../../world/terrain.js';
import { CENTER_5 } from '../../world/layout.js';
import { palm, rock, scatter, dock } from '../../world/props.js';
import { addSea } from '../../world/ocean.js';
import { shipState, shipBubble } from '../../world/ship.js';
import { makeShell } from '../../models/items.js';
import { addPickup, pickupText } from '../../systems/collect.js';
import { addFruit } from '../../systems/powers.js';
import { addDig } from '../../systems/digs.js';
import { vineAction } from '../../systems/vines.js';
import { chopAction } from '../../systems/hat.js';
import { ensureMangoCrew } from '../../npcs/mango.js';
import { wasabiToBucket } from '../../npcs/wasabi.js';
import { eduardoRideHat } from '../island4/eduardo.js';
import {
  unicorn,
  addUnicorn,
  colourStripe,
  updateUnicorn,
  setHornGlow,
  unicornFollow,
  unicornBoard,
  unicornAboard,
} from '../../npcs/unicorn.js';
import { isNight, daylight } from '../../world/daylight.js';
import { addStar, grabStars, sendStarHome, starForTask, starsHome, updateStars } from './stars.js';
import { buildSeaStack } from './seastack.js';
import { buildCrabCove } from './cove.js';
import { buildKelpGarden } from './kelp.js';
import { buildTidePools } from './tide.js';
import { buildWhaleSpout } from './spout.js';
import { buildRainbow, showRainbow, updateRainbow, startRainbowRide } from './finale.js';
import { completeTask } from '../../game/tasks.js';
import { hintTooHigh } from '../../game/interact.js';

// Island 5, Rainbow Reef: a hub island and four islets in a shallow lagoon. The unicorn by the
// stone arch slid down her rainbow and it broke into four colour stars, one on each islet;
// each star brought home gives a stripe of her mane its colour back. With all four home, at
// night her horn lights the arch, the rainbow comes back and she sails on with the crew.
// Each islet is its own module (cove, seastack, tide, kelp); see docs/island5.md for the design.
// An islet module returns {update(dt), interact(p), action(p), bark(p), pound(p), save(), load(s)},
// any of them optional.

const toWorld = (x, z) => ({ x: CENTER_5.x + x, z: CENTER_5.z + z }); // island-local -> world

// The ring of islands, island-local. height is the top of each one's gentle hill.
// The ship arrives along +z, so the islets sit on the diagonals and leave that lane clear.
const ISLETS = {
  hub: { x: 0, z: 0, radius: 17, height: 2.2 },
  stack: { x: 34, z: -40, radius: 11, height: 1.6 }, // orange: the tall sea stack
  tide: { x: -40, z: -32, radius: 13, height: 0.7 }, // yellow: flat, with rock pools
  cove: { x: -42, z: 30, radius: 12, height: 2.8 }, // red: a cliffy islet with a bay
  kelp: { x: 40, z: 32, radius: 15, height: 1.3 }, // blue: a garden ring around a pond
};
// the four stars, in rainbow order: the arch socket and mane stripe each one fills
const STARS = {
  red: { color: 0xff5a5a, islet: 'cove', index: 0, task: 'reefRed' },
  orange: { color: 0xff9a3d, islet: 'stack', index: 1, task: 'reefOrange' },
  yellow: { color: 0xffd84d, islet: 'tide', index: 2, task: 'reefYellow' },
  blue: { color: 0x5aa8ff, islet: 'kelp', index: 3, task: 'reefBlue' },
};
const REEF_RADIUS = 78; // inside: a shallow lagoon to paddle across; outside: the open sea
const LAGOON_DEPTH = -1.8; // deeper than wading depth, so Spartacus paddles
const SANDBAR_DEPTH = -0.35; // shallow enough to wade along
// dips carved into the land: rock pools, the kelp garden's pond, Crab Cove's bay
const HOLLOWS = [
  { x: -44, z: -30, radius: 2.2, depth: -0.7 },
  { x: -37, z: -36, radius: 2.4, depth: -0.7 },
  { x: -38, z: -26, radius: 2, depth: -0.7 },
  { x: 40, z: 32, radius: 5, depth: -1.6 },
  { x: -50, z: 34, radius: 5.5, depth: LAGOON_DEPTH },
];

// one islet: a hill sloping to a beach ring, then down into the water; wobbly so it isn't a circle
function isletHeight(islet, x, z) {
  const dx = x - islet.x,
    dz = z - islet.z,
    r = Math.hypot(dx, dz),
    angle = Math.atan2(dz, dx);
  const shore = islet.radius + Math.sin(angle * 3 + islet.x) * 1.2 + Math.sin(angle * 5 + islet.z);
  let h = islet.height * (1 - 0.6 * smoothstep(0, shore - 3, r));
  h += 0.25 * Math.sin(x * 0.5) * Math.cos(z * 0.45);
  h = lerp(h, 0.35, smoothstep(shore - 4, shore - 1.5, r));
  return lerp(h, -4, smoothstep(shore, shore + 2.5, r));
}

// lagoon floor, deepening past the reef; a sandbar from the hub to the kelp garden; the islets
// on top; then the hollows dug back out
function height(x, z) {
  const local = { x: x - CENTER_5.x, z: z - CENTER_5.z },
    r = Math.hypot(local.x, local.z);
  let h = lerp(LAGOON_DEPTH, -4.5, smoothstep(REEF_RADIUS, REEF_RADIUS + 12, r));
  h += 0.3 * Math.sin(local.x * 0.13) * Math.cos(local.z * 0.11);
  const sandbar = distToSegmentXZ(local, ISLETS.hub, ISLETS.kelp);
  if (sandbar < 3) h = Math.max(h, lerp(SANDBAR_DEPTH, h, smoothstep(1.6, 3, sandbar)));
  for (const islet of Object.values(ISLETS)) h = Math.max(h, isletHeight(islet, local.x, local.z));
  for (const hollow of HOLLOWS) {
    const d = Math.hypot(local.x - hollow.x, local.z - hollow.z);
    if (d < hollow.radius + 1.5)
      h = Math.min(h, lerp(hollow.depth, h, smoothstep(hollow.radius, hollow.radius + 1.5, d)));
  }
  return h;
}

// Filled in by build(): beacons {islet, task, beam, fade}, the spots puzzles hang off,
// and the islet modules
const beacons = [];
const spots = {};
const islets = {};
const BEACON_HEIGHT = 70;

function build() {
  buildGround(CENTER_5.x, CENTER_5.z, {
    size: 230,
    segments: LOW_POWER ? 110 : 190,
    palette: { g: 0x7fd36a, g2: 0xa6e27a },
  });
  // water all the way from the end of the big patch (z=-460) past the reef
  addSea(CENTER_5.x, -880, { width: 660, depth: 840 });
  const dockEnd = CENTER_5.z + 24;
  dock(CENTER_5.x, { zFrom: CENTER_5.z + 12, zTo: dockEnd });
  island.spawn = vec3(CENTER_5.x, 0, CENTER_5.z + 9);
  island.spawn.y = terrainHeight(island.spawn.x, island.spawn.z);
  buildArch();
  const lookout = toWorld(10, -12);
  lookout.top = rock(lookout.x, lookout.z, { radius: 3, height: 2.4 });
  const stack = toWorld(ISLETS.stack.x, ISLETS.stack.z);
  Object.assign(spots, buildSeaStack(stack, { lookout }));
  makeStar('orange', spots.star, { hidden: false });
  buildUnicorn();
  buildBeacons();
  buildPalms();
  addShells();
  // the other islets (added last: build order matters, see architecture.md)
  const at = (name) => toWorld(ISLETS[name].x, ISLETS[name].z);
  const addHiddenStar = (name, pos) => makeStar(name, pos, { hidden: true });
  islets.cove = buildCrabCove(at('cove'), { addStar: addHiddenStar });
  islets.kelp = buildKelpGarden(at('kelp'), { addStar: addHiddenStar });
  islets.tide = buildTidePools(at('tide'), { from: CENTER_5, addStar: addHiddenStar });
  islets.whale = buildWhaleSpout(toWorld(23.5, -31), { toward: at('stack') }); // ~5 from the first ledge
  buildRainbow(spots.arch);
}

// a star that flies home to its socket in the arch (hidden ones wait for their islet's puzzle)
function makeStar(name, pos, { hidden }) {
  const { color, index, task } = STARS[name];
  const socket = spots.sockets[index].position.clone().add(vec3(0, 0, 0.12));
  return addStar(name, { color, pos, task, socket, onHome: starHome, hidden });
}

// sad by the arch, facing the path up from the dock
function buildUnicorn() {
  const at = toWorld(5.5, -3);
  const ground = terrainHeight(at.x, at.z);
  addUnicorn(at.x, at.z, { y: ground, yaw: Math.atan2(-5.5, 12) });
  spots.unicorn = at;
  spots.unicornCol = addCylinder(at.x, at.z, { r: 1.1, bottom: ground - 1, top: ground + 2.6 });
}

// the grey stone arch on the hub, with four empty sockets for the stars (the finale)
function buildArch() {
  const at = toWorld(0, -6),
    ground = terrainHeight(at.x, at.z),
    stone = material(0x9aa3ad);
  for (const side of [-1, 1]) {
    const pillar = mesh(new THREE.CylinderGeometry(0.7, 0.85, 5, 8), stone);
    pillar.position.set(at.x + side * 3, ground + 2.5, at.z);
    scene.add(pillar);
    addCylinder(at.x + side * 3, at.z, { r: 0.85, bottom: ground - 1, top: ground + 5 });
  }
  const lintel = mesh(new THREE.BoxGeometry(8, 1, 1.4), stone);
  lintel.position.set(at.x, ground + 5.4, at.z);
  scene.add(lintel);
  spots.sockets = [-2.4, -0.8, 0.8, 2.4].map((dx) => {
    const socket = mesh(new THREE.CircleGeometry(0.35, 12), material(0x5d6670), {
      castShadow: false,
    });
    socket.position.set(at.x + dx, ground + 5.4, at.z + 0.71);
    scene.add(socket);
    return socket;
  });
  spots.arch = { x: at.x, z: at.z, y: ground };
}

// a tall see-through beam of colour over each islet, so you can always see where to go;
// it fades out once that islet's star is home
function buildBeacons() {
  for (const { color, islet: name, task } of Object.values(STARS)) {
    const { x, z } = toWorld(ISLETS[name].x, ISLETS[name].z),
      base = name === 'stack' ? spots.cap.y : terrainHeight(x, z);
    const beamMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    const beam = mesh(
      new THREE.CylinderGeometry(0.6, 0.6, BEACON_HEIGHT, 10, 1, true),
      beamMaterial,
      {
        castShadow: false,
      },
    );
    beam.position.set(x, base + BEACON_HEIGHT / 2, z);
    scene.add(beam);
    beacons.push({ islet: ISLETS[name], task, beam, fade: 1 });
  }
}

// keeps bushes and flowers off the arch and the path up from the dock
const awayFromPaths = (x, z) =>
  distXZ({ x, z }, spots.arch.x, spots.arch.z) > 5 && Math.abs(x - CENTER_5.x) > 3;

function buildPalms() {
  const palmSpots = [
    [-8, 8],
    [10, 6],
    [-12, -4],
    [12, -9],
    [-36, 24],
    [-46, 24],
    [-36, -38],
    [-46, -24],
    [40, 22.4], // in the kelp garden, between two plates
    [30, -36],
    [38, -45],
  ];
  for (const [x, z] of palmSpots) {
    const w = toWorld(x, z);
    palm(w.x, w.z);
  }
  scatter(CENTER_5.x, CENTER_5.z, { radius: 13, allowed: awayFromPaths, bushes: 10, flowers: 50 });
}

// 8 shells all over the reef. Two more come later: one buried on the tide pools' beach (buildLate)
// and one Mango fetches from the crane on Crab Rock (cove.js).
function addShells() {
  const shellSpots = [
    [8, -2],
    [20, 16], // halfway along the sandbar
    [-44, 26], // on top of Crab Cove
    [-37, -36], // in a rock pool
    [40, 24.8], // inside the kelp garden
  ];
  for (const [x, z] of shellSpots) {
    const w = toWorld(x, z);
    addPickup(w.x, w.z, { island: 5 });
  }
  addPickup(spots.middle.x, spots.middle.z, { y: spots.middle.y, island: 5 }); // needs the hooks
}

function buildLate() {
  const bushes = { boing: [-7, 2], stretch: [7, 2], grow: [-4, -11] };
  for (const [type, [x, z]] of Object.entries(bushes)) {
    const w = toWorld(x, z);
    addFruit(w.x, w.z, { type, y: terrainHeight(w.x, w.z), bush: true });
  }
  // up the sea stack: swap Boing-Boing for Stretchy on the first ledge, then for Grow-Grow on top
  for (const [type, spot] of [
    ['stretch', spots.stretchBush],
    ['grow', spots.growBush],
  ])
    addFruit(spot.x, spot.z, { type, y: spot.y, bush: true });
  // outside the kelp garden's hedge, where the sandbar from the hub comes ashore
  const kelp = ISLETS.kelp,
    toHub = Math.atan2(-kelp.z, -kelp.x),
    chop = toWorld(kelp.x + Math.cos(toHub) * 13.2, kelp.z + Math.sin(toHub) * 13.2);
  addFruit(chop.x, chop.z, { type: 'chop', y: terrainHeight(chop.x, chop.z), bush: true });
  const dig = toWorld(-47, -37);
  addDig(dig.x, dig.z, {
    // fine to run again when a save is put back (see systems/digs.js)
    reward: (d) => {
      addPickup(d.x, d.z, { y: d.y, island: 5, pop: 0.6 });
      toast('A buried shell!', 1800);
    },
  });
}

/* ---------------- arriving, update, triggers ---------------- */

// the crew comes along: Mango and Wasabi on deck, Eduardo on Spartacus's hat (his pincers cut
// ropes here). The ship is back on top of the water after island 4.
function enter() {
  shipState.baseY = -0.15;
  shipState.depth = 0;
  shipBubble.visible = false;
  ensureMangoCrew();
  wasabiToBucket();
  eduardoRideHat();
}

// a star reached its socket in the arch: that stripe of the unicorn's mane gets its colour back
function starHome(star, { quiet }) {
  colourStripe(STARS[star.name].index, star.color, { quiet });
  if (quiet) return;
  toast(`The ${star.name} star is home! The unicorn’s mane is ${star.name} again.`, 3600);
  completeTask(star.task);
  if (starsHome() === 4)
    setTimeout(
      () => toast('All four stars are home! The unicorn’s horn glows in the dark… 🌙', 4200),
      3800,
    );
}

function update(dt) {
  updateStars(dt);
  updateUnicorn(dt);
  updateRainbow(dt);
  for (const islet of Object.values(islets)) islet.update?.(dt);
  if (starsHome() === 4 && !island.done.reefRainbow) setHornGlow(daylight.night);
  const time = game.time;
  for (const beacon of beacons) {
    const target = island.done[beacon.task] ? 0 : 1;
    beacon.fade = lerp(beacon.fade, target, Math.min(1, dt * 2));
    beacon.beam.visible = beacon.fade > 0.02;
    beacon.beam.material.opacity =
      beacon.fade * (0.24 + 0.08 * Math.sin(time * 2 + beacon.islet.x));
  }
}

// walking up to her: she tells you what happened
function meetUnicorn() {
  completeTask('reefUnicorn');
  sfx.fruit();
  const lines = [
    [0, 'Unicorn: “Oh! I slid down my rainbow… and it broke into four stars!”', 3800],
    [4000, 'Unicorn: “My colours went with them. Can you find the stars?”', 3600],
    [7800, 'Follow the coloured lights ✨', 3000],
  ];
  for (const [delay, text, ms] of lines) setTimeout(() => toast(text, ms), delay);
}

// at night, with every star home: her horn lights the arch and the rainbow comes back
function fixRainbow() {
  completeTask('reefRainbow');
  showRainbow();
  unicorn.state = 'happy';
  setHornGlow(1);
  toast('The unicorn’s horn lights up the arch… The rainbow is back! 🌈', 3800);
  setTimeout(() => toast('Unicorn: “Thank you! Can I come with you on your ship?”', 3600), 4000);
  setTimeout(followSpartacus, 4000);
}
function followSpartacus() {
  spots.unicornCol.top = -999;
  unicornFollow();
}

// walking onto the dock with her following: she hops aboard
const onDockEnd = (p) => p.z > CENTER_5.z + 19 && Math.abs(p.x - CENTER_5.x) < 1.6 && p.y > 0.5;

function interactFinale(p) {
  const nearUnicorn = distXZ(p, unicorn.g.position.x, unicorn.g.position.z) < 7;
  if (starsHome() === 4 && !island.done.reefRainbow && nearUnicorn) {
    if (isNight()) fixRainbow();
    else hintOnce('reefNight', 'Her horn only glows in the dark. Try the 🌙 button!', 3400);
  }
  if (island.done.reefRainbow && unicorn.state === 'follow' && onDockEnd(p)) {
    unicornBoard(() => completeTask('reefAboard'));
    toast('The unicorn hops aboard the ship!', 3000);
  }
}

function interact(p) {
  grabStars(p);
  for (const islet of Object.values(islets)) islet.interact?.(p);
  interactFinale(p);
  const { ledge, middle, plateau } = spots;
  if (!island.done.reefUnicorn && distXZ(p, spots.unicorn.x, spots.unicorn.z) < 4.5) meetUnicorn();
  const nearLedge = distXZ(p, ledge.x, ledge.z) < 4.5;
  hintTooHigh(
    nearLedge && p.y < ledge.y - 1,
    'Too high! A Boing-Boing bush grows on the big island.',
  );
  if (nearLedge && Math.abs(p.y - ledge.y) < 1)
    hintOnce('stackHooks', 'Golden hooks! Eat the Stretchy fruit up here to swing.', 3400);
  if (distXZ(p, middle.x, middle.z) < 2 && Math.abs(p.y - middle.y) < 1)
    hintOnce('stackHigher', 'Face the next hook and swing again!', 2800);
  if (distXZ(p, plateau.x, plateau.z) < 4 && Math.abs(p.y - plateau.y) < 1)
    hintOnce('stackSeed', 'A magic seed! The Grow-Grow fruit up here can wake it.', 3400);
}

// barking at her tells you how many stars are home; the islets react too (Mango, Wasabi)
function bark(p) {
  for (const islet of Object.values(islets)) islet.bark?.(p);
  const nearUnicorn = distXZ(p, unicorn.g.position.x, unicorn.g.position.z) < 7;
  if (!island.done.reefUnicorn || island.done.reefRainbow || !nearUnicorn) return;
  toast(`Unicorn: “${starsHome()} of 4 stars are home!”`, 2400);
}

// the islets' own state (bridge down, crate broken, hedge chopped…); tasks are saved anyway
const saveState = () =>
  Object.fromEntries(
    Object.entries(islets)
      .filter(([, islet]) => islet.save)
      .map(([name, islet]) => [name, islet.save()]),
  );

// putting a save back: the islets first (they reveal their stars), then stars already home go
// to their sockets, then the finale
function loadState(state) {
  for (const [name, islet] of Object.entries(islets)) islet.load?.(state[name] ?? {});
  for (const { task } of Object.values(STARS)) {
    const star = starForTask(task);
    if (island.done[task]) sendStarHome(star, { quiet: true });
  }
  if (island.done.reefRainbow) {
    showRainbow({ quiet: true });
    unicorn.state = 'happy';
    setHornGlow(1);
    if (!island.done.reefAboard) followSpartacus();
  }
  if (island.done.reefAboard) unicornAboard();
}

const island = {
  id: 5,
  center: CENTER_5,
  name: 'Rainbow Reef',
  zMax: -950,
  height,
  savesProgress: true,
  preview: true, // island 4 only sails on here in dev/?debug until Claudio says it's ready
  // keeps Spartacus over the ground mesh; the sea current brings him back long before this
  physics: { bound: { x: CENTER_5.x, z: CENTER_5.z, r: 105 } },
  tasks: {
    title: 'Rainbow Reef',
    list: [
      { id: 'reefUnicorn', ic: '🦄', t: () => 'Meet the unicorn by the stone arch' },
      { id: 'reefRed', ic: '❤️', t: () => 'Bring back the red star (Crab Cove)' },
      { id: 'reefOrange', ic: '🧡', t: () => 'Bring back the orange star (the sea stack)' },
      { id: 'reefYellow', ic: '💛', t: () => 'Bring back the yellow star (the tide pools)' },
      { id: 'reefBlue', ic: '💙', t: () => 'Bring back the blue star (the kelp garden)' },
      { id: 'reefShells', ic: '🐚', t: () => pickupText(5, 'shells') },
      { id: 'reefRainbow', ic: '🌈', t: () => 'Fix the rainbow' },
      { id: 'reefAboard', ic: '⛵', t: () => 'Bring the unicorn to the ship' },
    ],
  },
  collect: {
    total: 8,
    count: 0,
    taskId: 'reefShells',
    name: 'Shell',
    all: 'All the shells! Good boy, Spartacus!',
    model: makeShell,
  },
  balls: [[4, 7]],
  critters: {
    birds: [
      [-6, 12],
      [-40, 22],
      [44, -38],
    ],
    // butterflies by day, fireflies at night (along the tide pools' stepping stones too)
    butterflies: [
      [2, -1],
      [40, 26],
      [-53, -42],
    ],
    fish: [
      [20, -20, 0.8],
      [-20, 12, 0.8],
      [0, 50, 0.8],
    ],
  },
  // a lazy island tune (core/music.js)
  music: {
    tempo: 96,
    root: 62,
    wave: 'triangle',
    melody: [0, 2, 4, null, 5, 4, 2, null, 3, 4, 5, null, 4, 2, 1, null],
    bass: [-5, null, null, -3, -4, null, null, -2, -5, null, null, -3, -1, null, -3, null],
  },
  intro: [
    [3400, 'A ring of little islands! Swim from one to the next.', 3400],
    [7400, 'Eduardo rides on Spartacus’s hat. His pincers can cut ropes!', 3600],
    [11600, 'Someone is waiting by the stone arch…', 3000],
  ],
  win: {
    title: 'The rainbow is back!',
    text: 'All four stars are home and the unicorn joined the crew. Her rainbow can take the ship up into the sky…',
    tip: 'You can also ride the rainbow later from the end of the dock.',
    go: 'Ride the rainbow! 🌈',
  },
  exit: { label: 'Ride', at: onDockEnd, run: startRainbowRide },
  build,
  buildLate,
  enter,
  update,
  interact,
  // the islets' own buttons (Pinch), the seeds (Grow, Zip) and the hat (Chop)
  actions(p) {
    for (const islet of Object.values(islets)) {
      const action = islet.action?.(p);
      if (action) return action;
    }
    return vineAction(p) || chopAction(p);
  },
  bark,
  pound: (p) => islets.cove.pound(p),
  saveState,
  loadState,
};
export default island;
