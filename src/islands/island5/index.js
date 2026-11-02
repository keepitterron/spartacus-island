import * as THREE from 'three';
import { $, distXZ, distToSegmentXZ, lerp, smoothstep, vec3 } from '../../core/util.js';
import { scene, LOW_POWER } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { toast } from '../../core/ui.js';
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
import { ensureMangoCrew } from '../../npcs/mango.js';
import { wasabiToBucket } from '../../npcs/wasabi.js';
import { ensureEduardoCrew } from '../island4/eduardo.js';
import { completeTask, hideWin } from '../../game/tasks.js';
import { hintTooHigh } from '../../game/interact.js';

// Island 5, Rainbow Reef: a hub island and four islets in a shallow lagoon, connected by
// paddling, a sandbar and (later) ropes, hooks and vines. See docs/island5.md for the design.
//
// BLOCKOUT: shapes, scale and water only. The puzzles, the unicorn and the stars come next;
// for now each islet's task is just to reach it. Reachable from island 4 only in dev/?debug
// (`preview`), so the live game still ends with the whale.

const toWorld = (x, z) => ({ x: CENTER_5.x + x, z: CENTER_5.z + z }); // island-local -> world

// The ring of islands, island-local. height is the top of each one's gentle hill.
// The ship arrives along +z, so the islets sit on the diagonals and leave that lane clear.
const ISLETS = {
  hub: { x: 0, z: 0, radius: 17, height: 2.2 },
  stack: { x: 34, z: -40, radius: 11, height: 1.6 }, // orange: the tall sea stack
  tide: { x: -40, z: -32, radius: 13, height: 0.7 }, // yellow: flat, with rock pools
  cove: { x: -42, z: 30, radius: 12, height: 2.8 }, // red: a cliffy islet with a bay
  kelp: { x: 40, z: 32, radius: 12, height: 1.3 }, // blue: a ring around a pond
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

// Filled in by build(): beacons {islet, task, beam, glow}, and the spots puzzles will hang off
const beacons = [];
const spots = {};
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
  buildSeaStack();
  buildBeacons();
  buildPalms();
  addShells();
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

// the orange islet's tall rock, plus a low ledge (a normal jump) and a high one (Boing-Boing)
function buildSeaStack() {
  const { x, z } = toWorld(ISLETS.stack.x, ISLETS.stack.z);
  spots.stackTop = rock(x, z, { radius: 2.8, height: 14, color: 0xb8a48c });
  spots.lowLedge = { x: x - 4.2, z: z + 1.5 };
  spots.lowLedge.y = rock(spots.lowLedge.x, spots.lowLedge.z, { radius: 1.3, height: 1.3 });
  spots.highLedge = { x: x - 2.5, z: z + 4.6 };
  spots.highLedge.y = rock(spots.highLedge.x, spots.highLedge.z, { radius: 1.4, height: 4.4 });
}

// a tall see-through beam of colour over each islet, so you can always see where to go;
// it fades out once that islet's task is done
function buildBeacons() {
  const colors = { stack: 0xff9a3d, tide: 0xffd84d, cove: 0xff5a5a, kelp: 0x5aa8ff };
  const tasks = { stack: 'reefStack', tide: 'reefTide', cove: 'reefCove', kelp: 'reefKelp' };
  for (const [name, color] of Object.entries(colors)) {
    const { x, z } = toWorld(ISLETS[name].x, ISLETS[name].z),
      base = name === 'stack' ? spots.stackTop : terrainHeight(x, z);
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
    beacons.push({ islet: ISLETS[name], task: tasks[name], beam, fade: 1 });
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
    [44, 26],
    [36, 40],
    [30, -36],
    [38, -45],
  ];
  for (const [x, z] of palmSpots) {
    const w = toWorld(x, z);
    palm(w.x, w.z);
  }
  scatter(CENTER_5.x, CENTER_5.z, { radius: 13, allowed: awayFromPaths, bushes: 10, flowers: 50 });
}

// 8 shells all over the reef: easy ones on the hub, the rest out on the islets and the sandbar
function addShells() {
  const shellSpots = [
    [8, -2],
    [-10, 6],
    [20, 16], // halfway along the sandbar
    [-44, 26], // on top of Crab Cove
    [-37, -36], // in a rock pool
    [47, 28], // on the kelp garden's ring
  ];
  for (const [x, z] of shellSpots) {
    const w = toWorld(x, z);
    addPickup(w.x, w.z, { island: 5 });
  }
  addPickup(spots.highLedge.x, spots.highLedge.z, { y: spots.highLedge.y, island: 5 });
}

function buildLate() {
  const bushes = { boing: [-7, 2], stretch: [7, 2], grow: [-4, -11], chop: [31.5, 35] };
  for (const [type, [x, z]] of Object.entries(bushes)) {
    const w = toWorld(x, z);
    addFruit(w.x, w.z, { type, y: terrainHeight(w.x, w.z), bush: true });
  }
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

// the crew comes along on deck, and the ship is back on top of the water after island 4
function enter() {
  shipState.baseY = -0.15;
  shipState.depth = 0;
  shipBubble.visible = false;
  ensureMangoCrew();
  wasabiToBucket();
  ensureEduardoCrew();
}

function update(dt) {
  const time = game.time;
  for (const beacon of beacons) {
    const target = island.done[beacon.task] ? 0 : 1;
    beacon.fade = lerp(beacon.fade, target, Math.min(1, dt * 2));
    beacon.beam.visible = beacon.fade > 0.02;
    beacon.beam.material.opacity =
      beacon.fade * (0.24 + 0.08 * Math.sin(time * 2 + beacon.islet.x));
  }
}

const VISIT_MESSAGES = {
  reefStack: 'The tall sea stack! What’s up on top?',
  reefTide: 'The tide pools! Little pools full of water.',
  reefCove: 'Crab Cove! A cliff and a cosy bay.',
  reefKelp: 'The kelp garden! A pond in the middle.',
};
// standing on an islet's dry land ticks its "visit" task
function checkVisits(p) {
  for (const beacon of beacons) {
    if (island.done[beacon.task] || p.y < 0.2) continue;
    const { x, z } = toWorld(beacon.islet.x, beacon.islet.z);
    if (distXZ(p, x, z) > beacon.islet.radius - 2) continue;
    toast(VISIT_MESSAGES[beacon.task], 3000);
    completeTask(beacon.task);
  }
}

function interact(p) {
  checkVisits(p);
  const { highLedge } = spots;
  hintTooHigh(
    distXZ(p, highLedge.x, highLedge.z) < 3.5,
    'Too high! A Boing-Boing bush grows on the big island.',
  );
}

const island = {
  id: 5,
  center: CENTER_5,
  name: 'Rainbow Reef',
  zMax: -950,
  height,
  savesProgress: true,
  preview: true, // still being built: island 4 only sails on here in dev/?debug
  // keeps Spartacus over the ground mesh; the sea current brings him back long before this
  physics: { bound: { x: CENTER_5.x, z: CENTER_5.z, r: 105 } },
  tasks: {
    title: 'Rainbow Reef',
    list: [
      { id: 'reefStack', ic: '🧡', t: () => 'Visit the tall sea stack' },
      { id: 'reefCove', ic: '❤️', t: () => 'Visit Crab Cove' },
      { id: 'reefTide', ic: '💛', t: () => 'Visit the tide pools' },
      { id: 'reefKelp', ic: '💙', t: () => 'Visit the kelp garden' },
      { id: 'reefShells', ic: '🐚', t: () => pickupText(5, 'shells') },
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
    butterflies: [
      [2, -1],
      [44, 36],
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
    [7400, 'Follow the coloured lights ✨', 3000],
  ],
  win: {
    title: 'Reef explored!',
    text: 'Spartacus visited every little island. More adventures are coming soon!',
    tip: 'You can also rest later at the end of the dock.',
    go: 'The end, for now 🌈',
  },
  exit: {
    label: 'Rest',
    at: (p) => p.z > CENTER_5.z + 19 && Math.abs(p.x - CENTER_5.x) < 1.6 && p.y > 0.5,
    run: () => {
      hideWin();
      $('#end').classList.remove('hidden');
    },
  },
  build,
  buildLate,
  enter,
  update,
  interact,
};
export default island;
