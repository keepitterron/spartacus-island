import * as THREE from 'three';
import { distXZ, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { sfx } from '../../core/audio.js';
import { toast, hintOnce } from '../../core/ui.js';
import { addCylinder } from '../../core/colliders.js';
import { CENTER_6 } from '../../world/layout.js';
import { ship, shipState, shipBubble } from '../../world/ship.js';
import { player } from '../../player/player.js';
import { ensureMangoCrew } from '../../npcs/mango.js';
import { wasabiToBucket } from '../../npcs/wasabi.js';
import { unicorn, unicornFly, colourStripe } from '../../npcs/unicorn.js';
import { ensureEduardoCrew } from '../island4/eduardo.js';
import { BANDS } from '../island5/finale.js';
import { completeTask } from '../../game/tasks.js';
import {
  CLOUD_SEA_Y,
  addCloud,
  buildCloudSea,
  finishClouds,
  setCheckpoint,
  updateCheckpoint,
} from './clouds.js';
import { buildUpdraft, updateUpdraft } from './updraft.js';

// Island 6, the sky island: little clouds floating round Lina's crystal palace, high above a sea
// of clouds. Back home, Lina's wings unfold and she flaps an updraft under Spartacus, so he
// floats from cloud to cloud. Her Sky Jewel is gone: Leo the magpie took it to his nest at the
// top. Still being built (a preview): so far the Windy Steps up to the palace. See docs/island6.md.

const toWorld = (x, z) => ({ x: CENTER_6.x + x, z: CENTER_6.z + z }); // island-local -> world

// island-local clouds as [x, z, radius, top]
const SPAWN_CLOUD = [0, 15, 7, 0]; // the ship moors alongside it
// Windy Steps: short hops climbing towards the palace, to learn floating
const WINDY_STEPS = [
  [-3, 2, 3.5, 1],
  [3, -8, 3, 2.2],
  [-2, -18, 3, 3.5],
  [5, -27, 2.6, 4.5],
  [-1, -37, 3, 6],
];
const PALACE_CLOUD = [0, -56, 10, 7];
const SHIP_SPOT = [9, 16]; // island-local, alongside the spawn cloud

// filled in by build(): the clouds and spots the triggers use
const spots = {};

const addCloudAt = ([x, z, r, top]) => {
  const pos = toWorld(x, z);
  return addCloud(pos.x, pos.z, { r, top });
};

function build() {
  buildCloudSea(CENTER_6.x, CENTER_6.z);
  spots.spawnCloud = addCloudAt(SPAWN_CLOUD);
  for (const step of WINDY_STEPS) addCloudAt(step);
  spots.palace = addCloudAt(PALACE_CLOUD);
  buildPalace(spots.palace);
  finishClouds();
  buildUpdraft();
  const spawn = toWorld(0, 12);
  island.spawn = vec3(spawn.x, SPAWN_CLOUD[3], spawn.z);
}

// Lina's crystal palace: a half ring of crystal towers behind a dry fountain (the jewel made it
// sparkle). She tells the story when Spartacus lands on this cloud.
function buildPalace(cloud) {
  const crystal = material(0xcfe3ff, {
    emissive: 0x8fb8ff,
    emissiveIntensity: 0.25,
    roughness: 0.2,
    transparent: true,
    opacity: 0.88,
  });
  const towerHeights = [5, 7.5, 9, 7.5, 5];
  towerHeights.forEach((height, i) => {
    const angle = Math.PI + 0.45 + i * 0.55, // a half ring on the far side from the steps
      x = cloud.x + Math.cos(angle) * 6.5,
      z = cloud.z + Math.sin(angle) * 6.5;
    addTower(x, z, { height, y: cloud.top, mat: crystal });
  });
  const stone = material(0xe8e4f4);
  const basin = mesh(new THREE.CylinderGeometry(2, 2.2, 0.8, 16), stone, { castShadow: false });
  basin.position.set(cloud.x, cloud.top + 0.4, cloud.z);
  scene.add(basin);
  const spout = mesh(new THREE.CylinderGeometry(0.25, 0.4, 2, 8), stone);
  spout.position.set(cloud.x, cloud.top + 1, cloud.z);
  scene.add(spout);
  addCylinder(cloud.x, cloud.z, { r: 2.2, bottom: cloud.top, top: cloud.top + 0.8 });
  spots.fountain = { x: cloud.x, z: cloud.z, y: cloud.top }; // where the jewel goes, later
}

// a six-sided crystal with a pointed cap, standing at height y
function addTower(x, z, { height, y, mat }) {
  const body = mesh(new THREE.CylinderGeometry(1.1, 1.1, height, 6), mat);
  body.position.set(x, y + height / 2, z);
  scene.add(body);
  const cap = mesh(new THREE.ConeGeometry(1.1, 1.6, 6), mat);
  cap.position.set(x, y + height + 0.8, z);
  scene.add(cap);
  addCylinder(x, z, { r: 1.1, bottom: y, top: y + height + 1.6 });
}

// the ship moors alongside the first cloud, bow towards the palace, floating on the rainbow's
// magic; the crew stays on deck (Eduardo too: nothing to pinch up here yet)
function enter() {
  const at = toWorld(...SHIP_SPOT);
  ship.position.set(at.x, 0, at.z);
  ship.rotation.y = Math.PI;
  ship.updateMatrixWorld(true);
  shipState.baseY = SPAWN_CLOUD[3] - 0.9;
  shipState.depth = 0;
  shipBubble.visible = false;
  ensureMangoCrew();
  wasabiToBucket();
  ensureEduardoCrew();
  // her colours came back on island 5 (also when Continue skips straight here)
  BANDS.forEach((color, i) => colourStripe(i, color, { quiet: true }));
  unicornFly();
  setCheckpoint(spots.spawnCloud);
}

// arriving at the palace: Lina tells what happened
function meetAtPalace() {
  completeTask('skyFly');
  sfx.fruit();
  const lines = [
    [0, 'Lina: “Home! Look, my wings work up here!”', 3400],
    [3800, 'Lina: “But my Sky Jewel is gone. It made the fountain sparkle.”', 3800],
    [8000, 'Lina: “Leo the magpie took it to his nest, right at the top.”', 3600],
  ];
  for (const [delay, text, ms] of lines) setTimeout(() => toast(text, ms), delay);
}

function interact(p, dt) {
  updateCheckpoint(dt);
  const { palace, spawnCloud } = spots;
  if (!player.grounded && p.y > spawnCloud.top + 1.5)
    hintOnce('flap', 'Tap Jump in the air to flap! Hold Jump to float down slowly.', 3800);
  // landing anywhere on the palace's cloud: she can see him from the fountain
  const onPalace = distXZ(p, palace.x, palace.z) < palace.r && Math.abs(p.y - palace.top) < 1;
  if (!island.done.skyFly && onPalace) meetAtPalace();
}

const island = {
  id: 6,
  center: CENTER_6,
  name: 'Sky Island',
  zMax: -1350,
  // no ground up here, only clouds: the "terrain" is far below the cloud sea
  height: () => CLOUD_SEA_Y - 30,
  preview: true,
  savesProgress: true,
  // Lina flaps the whole time, so Spartacus always floats: low gravity, a slow fall, flapping
  physics: { gravity: 16, maxFall: 7, water: false, flap: true },
  camera: { minY: () => CLOUD_SEA_Y + 1 },
  tasks: {
    title: 'Sky Island',
    list: [
      { id: 'skyFly', ic: '🦄', t: () => 'Fly with Lina to her palace' },
      { id: 'skyMini', ic: '🤏', t: () => 'Eat a Mini-Me fruit', power: 'mini' },
      { id: 'skySmash', ic: '💥', t: () => 'Eat a Smash-Smash fruit', power: 'smash' },
      { id: 'skyFork', ic: '🍴', t: () => 'Find something shiny for Leo' },
      { id: 'skyJewel', ic: '💎', t: () => 'Swap it for the Sky Jewel' },
      { id: 'skyFountain', ic: '⛲', t: () => 'Bring the jewel to the fountain' },
    ],
  },
  // a floaty, dreamy tune (core/music.js)
  music: {
    tempo: 84,
    root: 67,
    wave: 'sine',
    melody: [0, null, 4, 7, 9, null, 7, null, 4, null, 2, 4, 0, null, null, null],
    bass: [
      -12,
      null,
      null,
      null,
      -8,
      null,
      null,
      null,
      -10,
      null,
      null,
      null,
      -5,
      null,
      null,
      null,
    ],
  },
  intro: [
    [3400, 'Lina is home in the sky! Her wings unfold ✨', 3400],
    [7400, 'Her wind makes Spartacus float. Jump from cloud to cloud!', 3600],
  ],
  build,
  enter,
  update: updateUpdraft,
  interact,
  bark(p) {
    if (unicorn.g.position.distanceTo(p) > 8) return;
    sfx.flutter();
    toast('Lina: “Whee! Up we go!”', 2200);
  },
};
export default island;
