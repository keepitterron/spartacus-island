// Island 8, Big Test Island: the first island made in Blender (levels/island8.blend, see
// docs/levels.md). About ten times the area of Hook Rock Bay, to try the level pipeline on a big
// map: the hill, fort, lagoon, bones, fruit and palms are all placed in Blender. The name, story
// and tasks are placeholders until Zoë makes it hers, so it's a `preview` (dev / ?debug only).
import * as THREE from 'three';
import { distXZ, vec3 } from '../../core/util.js';
import { toast, hintOnce, actionKeyName } from '../../core/ui.js';
import { supportHeight } from '../../core/colliders.js';
import { terrainHeight } from '../../world/terrain.js';
import { CENTER_8 } from '../../world/layout.js';
import { makeLevel } from '../../world/level.js';
import { addSea } from '../../world/ocean.js';
import { scatter } from '../../world/props.js';
import { placeShipAt } from '../../world/ship.js';
import { makeBone } from '../../models/items.js';
import { player } from '../../player/player.js';
import { pickupText } from '../../systems/collect.js';
import { addHook, swingOption } from '../../systems/hooks.js';
import { completeTask } from '../../game/tasks.js';
import { showEnd } from '../../game/flow.js';
import { hintTooHigh } from '../../game/interact.js';
import levelUrl from './level.glb?url';

const level = makeLevel(levelUrl, { center: CENTER_8 });
// where you stand on a `spot:name` marker (its x/z, on whatever is under it)
const standOn = (name) => {
  const spot = level.spots[name];
  return { x: spot.x, y: spot.ground, z: spot.z };
};
const spots = {};

function build() {
  addSea(CENTER_8.x, CENTER_8.z, { width: 280, depth: 280 });
  level.build(island);
  spots.summit = standOn('summit');
  spots.mesa = level.all('dig').find((dig) => dig.arg === 'marked');
  spots.dock = level.all('dock')[0];
  buildSwingRoute();
  buildShipPath();
  // bushes and flowers on open grass (not on rocks, walls or the dock)
  scatter(CENTER_8.x, CENTER_8.z, {
    radius: 58,
    allowed: (x, z) => supportHeight(x, z, Infinity) - terrainHeight(x, z) < 0.05,
    bushes: 12,
    flowers: 90,
  });
}

// hook start -> three lagoon pillars -> hook end; the middle pillar is the tallest
function buildSwingRoute() {
  const route = ['hook start', 'pillar 1', 'pillar 2', 'pillar 3', 'hook end'].map(standOn);
  for (let i = 0; i < route.length - 1; i++) addHook(route[i], route[i + 1]);
  spots.tallPillar = route[2];
  spots.hookStart = route[0];
}

// the ship waits at the `spot:ship` marker, having sailed in from the south-east
function buildShipPath() {
  const ship = level.spots.ship;
  spots.shipPath = new THREE.CatmullRomCurve3([
    vec3(ship.x + 30, 0, ship.z + 40),
    vec3(ship.x + 10, 0, ship.z + 14),
    vec3(ship.x, 0, ship.z),
  ]);
}

const onDockEnd = (p) => {
  const { x, z, props } = spots.dock;
  return p.z > z + (props.length ?? 11) - 5 && Math.abs(p.x - x) < 1.6 && p.y > 0.5;
};

function interact(p) {
  const { mesa, summit, tallPillar, hookStart } = spots;
  hintTooHigh(distXZ(p, mesa.x, mesa.z) < 6.5, 'Too high! A Boing-Boing fruit grows by the beach.');
  if (!player.canStretch && distXZ(p, hookStart.x, hookStart.z) < 4)
    hintOnce('hook8', 'Golden hooks! A Stretchy fruit grows nearby.', 3400);
  if (player.canStretch && swingOption())
    hintOnce('swing', `Press ${actionKeyName()} to swing!`, 2400);
  if (!island.done.testSummit && distXZ(p, summit.x, summit.z) < 4 && p.y > summit.y - 1) {
    toast('What a view! You can see the whole island from here.', 3200);
    completeTask('testSummit');
  }
  const onTallPillar =
    distXZ(p, tallPillar.x, tallPillar.z) < 2 && Math.abs(p.y - tallPillar.y) < 0.6;
  if (!island.done.testSwing && onTallPillar && player.grounded) completeTask('testSwing');
}

const island = {
  id: 8,
  center: CENTER_8,
  name: 'Big Test Island',
  zMax: -2300,
  preview: true,
  level,
  height: level.height,
  physics: { bound: { x: CENTER_8.x, z: CENTER_8.z, r: 88 } },
  tasks: {
    title: 'Big Test Island',
    list: [
      { id: 'testBoing', ic: '🍑', t: () => 'Eat a Boing-Boing fruit', power: 'boing' },
      { id: 'testBones', ic: '🦴', t: () => pickupText(8, 'bones') },
      { id: 'testSummit', ic: '🚩', t: () => 'Climb to the flag on the big hill' },
      { id: 'testSwing', ic: '🪨', t: () => 'Swing to the tallest rock in the lagoon' },
    ],
  },
  // total is counted from the level's pickup and dig markers
  collect: {
    total: 0,
    count: 0,
    taskId: 'testBones',
    name: 'Bone',
    all: 'All the bones! Good boy, Spartacus!',
    model: makeBone,
  },
  music: {
    tempo: 108,
    root: 62,
    wave: 'triangle',
    melody: [0, 2, 4, null, 5, 4, 2, null, 3, null, 2, 1, 0, null, null, null],
    bass: [-5, null, -3, null, -1, null, -3, null, -4, null, -2, null, -5, null, null, null],
  },
  intro: [
    [3400, 'A BIG island! Made in Blender.', 3000],
    [7000, 'Ten bones are hidden all over it. Can you find them?', 3400],
  ],
  win: {
    title: 'Big island explored!',
    text: 'Every bone found and every rock climbed. This island is a test: Zoë will make it hers.',
    tip: 'You can also sail on from the end of the dock.',
    go: 'Set sail! ⛵',
  },
  exit: {
    label: 'Sail',
    at: onDockEnd,
    run: () =>
      showEnd('That was the test island! Where does the ship sail next? Make up the story!'),
  },
  build,
  buildLate: () => level.buildLate(island),
  enter() {
    placeShipAt(1, spots.shipPath);
  },
  interact,
};
export default island;
