import * as THREE from 'three';
import { distXZ, lerp, smoothstep, vec3 } from '../../core/util.js';
import { scene, LOW_POWER } from '../../core/renderer.js';
import { material, mesh, canvasTexture, drawPaw } from '../../core/materials.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { toast, hintOnce, actionKeyName } from '../../core/ui.js';
import { addCylinder } from '../../core/colliders.js';
import { terrainHeight, buildGround } from '../../world/terrain.js';
import { CENTER_2, CENTER_3 } from '../../world/layout.js';
import { palm, rock, rockTop, scatter, dock } from '../../world/props.js';
import { makeTin, makeBone } from '../../models/items.js';
import { player } from '../../player/player.js';
import { addItem, carryItem, useUpCarried } from '../../systems/items.js';
import { addPickup, pickupText } from '../../systems/collect.js';
import { addFruit } from '../../systems/powers.js';
import { addDig } from '../../systems/digs.js';
import { addHook, swingOption } from '../../systems/hooks.js';
import { mango, placeMango, mangoHop, mangoToShip } from '../../npcs/mango.js';
import { startSail } from '../../cutscenes/sail.js';
import { completeTask } from '../../game/tasks.js';
import { enterIsland } from '../../game/flow.js';
import { hintTooHigh } from '../../game/interact.js';

// Island 2, Hook Rock Bay: Stretchy fruit + golden hooks. Mango the parrot is stuck (too hungry
// to fly) on the tallest pillar in the lagoon; his snack is buried on a mesa only Boing-Boing reaches.

const LAGOON = { x: CENTER_2.x + 4, z: CENTER_2.z - 5 };
const MESA = { x: CENTER_2.x - 12, z: CENTER_2.z + 7 }; // only reachable with a Boing-Boing jump
const toWorld = (x, z) => ({ x: CENTER_2.x + x, z: CENTER_2.z + z }); // island-local -> world

// distance from the island centre to the shoreline at `angle`, wobbly so it isn't a circle
function shoreRadius(angle) {
  return 22 + Math.sin(angle * 4) * 1.5 + Math.sin(angle * 2 + 0.5) * 1.2;
}
// terrain: gentle bumps, a deep lagoon, a flat beach ring, then dropping into the sea
function height(x, z) {
  const localX = x - CENTER_2.x,
    localZ = z - CENTER_2.z,
    r = Math.hypot(localX, localZ),
    shore = shoreRadius(Math.atan2(localZ, localX));
  let h = 1.1 + 0.3 * Math.sin(x * 0.4) * Math.cos(z * 0.33) + 0.15 * Math.sin(x * 0.9 - z * 0.5);
  const lagoonDist = Math.hypot(x - LAGOON.x, z - LAGOON.z);
  if (lagoonDist < 11) h = -2;
  else if (lagoonDist < 13) h = lerp(-2, h, smoothstep(11, 13, lagoonDist));
  h = lerp(h, 0.35, smoothstep(shore - 5, shore - 2, r));
  return lerp(h, -4, smoothstep(shore, shore + 2.5, r));
}

// Positions filled in by build(); each spot is {x, z, y} with y the standing height on top.
// The swing route across the lagoon: westPad -> firstPillar -> secondPillar -> mangoPillar -> eastPad,
// with a branch firstPillar -> sidePillar for a bone.
const spots = {};
const sailPath = new THREE.CatmullRomCurve3([
  vec3(5.6, 0, CENTER_2.z + 26.5),
  vec3(20, 0, CENTER_2.z + 37),
  vec3(42, 0, CENTER_2.z),
  vec3(40, 0, -240),
  vec3(24, 0, -288),
  vec3(5.6, 0, CENTER_3.z + 32),
]);

// a wooden launch platform with a painted paw on top; returns its standing spot
function addSwingPad(x, z) {
  const groundY = terrainHeight(x, z);
  const base = mesh(new THREE.CylinderGeometry(1.3, 1.4, 0.3, 12), material(0xc48a54), {
    receiveShadow: true,
  });
  base.position.set(x, groundY + 0.15, z);
  scene.add(base);
  const pawTexture = canvasTexture(128, 128, (c, w, h) => {
    c.fillStyle = '#c48a54';
    c.fillRect(0, 0, w, h);
    drawPaw(c, { x: 64, y: 62, size: 30, color: '#ffd84d' });
  });
  const top = new THREE.Mesh(
    new THREE.CircleGeometry(1.25, 16),
    new THREE.MeshStandardMaterial({ map: pawTexture, roughness: 0.9 }),
  );
  top.rotation.x = -Math.PI / 2;
  top.position.set(x, groundY + 0.31, z);
  top.receiveShadow = true;
  scene.add(top);
  addCylinder(x, z, { r: 1.3, bottom: groundY - 1, top: groundY + 0.3 });
  return { x, z, y: groundY + 0.3 };
}

// a rock pillar standing in the lagoon, offset from its centre
function addPillar(dx, dz, { radius, top }) {
  const x = LAGOON.x + dx,
    z = LAGOON.z + dz;
  const y = rockTop(x, z, { radius, top, color: 0x9aa6b8 });
  return { x, z, y };
}

function build() {
  buildGround(CENTER_2.x, CENTER_2.z, { size: 64, segments: LOW_POWER ? 90 : 140 });
  const palmSpots = [
    [-16, 4],
    [-4, 15],
    [10, 12],
    [14, 7],
    [-10, -14],
    [-18, -3],
    [12, 15],
    [-14, 12],
    [6, -17],
    [-8, 6],
  ];
  for (const [x, z] of palmSpots) {
    const pos = toWorld(x, z);
    palm(pos.x, pos.z);
  }
  // no bushes/flowers in the lagoon, on the mesa, or on the path to the dock
  scatter(CENTER_2.x, CENTER_2.z, {
    radius: 16,
    allowed: (x, z) =>
      Math.hypot(x - LAGOON.x, z - LAGOON.z) > 14 &&
      Math.hypot(x - MESA.x, z - MESA.z) > 5 &&
      !(Math.abs(x - CENTER_2.x) < 3 && z > CENTER_2.z + 12),
    bushes: 16,
    flowers: 90,
  });
  dock(CENTER_2.x, { zFrom: CENTER_2.z + 16.5, zTo: CENTER_2.z + 27.5 });
  island.spawn = vec3(CENTER_2.x, 0, CENTER_2.z + 13);
  island.spawn.y = terrainHeight(island.spawn.x, island.spawn.z);
  spots.dockZ = CENTER_2.z + 20; // past this on the dock, Mango leaves the hat for the ship
  spots.westPad = addSwingPad(LAGOON.x - 13, LAGOON.z);
  spots.firstPillar = addPillar(-6, 0, { radius: 1.4, top: 3.2 });
  spots.secondPillar = addPillar(-1, -7, { radius: 1.3, top: 5.2 });
  spots.mangoPillar = addPillar(6, -3, { radius: 1.8, top: 11 });
  spots.eastPad = addSwingPad(LAGOON.x + 13, LAGOON.z + 2);
  spots.sidePillar = addPillar(4, 6, { radius: 1.05, top: 6.6 });
  spots.mesa = {
    x: MESA.x,
    z: MESA.z,
    y: rock(MESA.x, MESA.z, { radius: 3.4, height: 4.4, color: 0xc9a27a }),
  };
  const { mangoPillar } = spots;
  const nest = mesh(new THREE.TorusGeometry(0.6, 0.22, 6, 12), material(0x9c6436));
  nest.rotation.x = Math.PI / 2;
  nest.position.set(mangoPillar.x, mangoPillar.y + 0.15, mangoPillar.z);
  scene.add(nest);
  placeMango(mangoPillar, spots.secondPillar, 2);
  addHook(spots.westPad, spots.firstPillar);
  addHook(spots.firstPillar, spots.secondPillar);
  addHook(spots.secondPillar, mangoPillar);
  addHook(mangoPillar, spots.eastPad);
  addHook(spots.firstPillar, spots.sidePillar);
  addPickup(spots.secondPillar.x, spots.secondPillar.z, { y: spots.secondPillar.y, island: 2 });
  addPickup(spots.sidePillar.x, spots.sidePillar.z, { y: spots.sidePillar.y, island: 2 });
  addPickup(spots.mesa.x + 1.6, spots.mesa.z + 0.6, { y: spots.mesa.y, island: 2 });
}

// Mango's cracker tin: dug up on the mesa and carried straight away
function digUpSnack(dig) {
  const tin = addItem('snack', {
    model: makeTin(),
    pos: vec3(dig.x, dig.y + 0.2, dig.z),
    name: 'cracker tin',
    lift: 0.15,
  });
  carryItem(tin);
  toast('Mango’s cracker tin! Take it to the tall rock.', 3400);
  completeTask('snack');
}

function buildLate() {
  const boingBush = toWorld(-6, 11);
  addFruit(boingBush.x, boingBush.z, {
    type: 'boing',
    y: terrainHeight(boingBush.x, boingBush.z),
    bush: true,
  });
  const stretchBush = toWorld(-12, -1);
  addFruit(stretchBush.x, stretchBush.z, {
    type: 'stretch',
    y: terrainHeight(stretchBush.x, stretchBush.z),
    bush: true,
  });
  addDig(spots.mesa.x - 0.5, spots.mesa.z - 0.5, {
    reward: digUpSnack,
    marked: true,
    y: spots.mesa.y,
  });
  const boneDig = toWorld(-15, -9);
  addDig(boneDig.x, boneDig.z, {
    reward: (dig) => {
      addPickup(dig.x, dig.z, { y: dig.y, island: 2, pop: 0.6 });
      toast('A buried bone!', 1800);
    },
  });
}

function feedMango() {
  useUpCarried();
  sfx.parrot();
  burst(mango.g.position.clone().add(vec3(0, 1, 0)), {
    count: 24,
    color: [0xff9fb2, 0xffd84d, 0x3fbf5a],
    speed: 4,
    up: 3,
    life: 1,
    size: 1,
  });
  mangoHop();
  toast('Crunch! Mango hops onto Spartacus’s hat!', 3000);
  completeTask('feed');
}

const island = {
  id: 2,
  center: CENTER_2,
  name: 'Hook Rock Bay',
  zMax: -85,
  height,
  tasks: {
    title: 'Hook Rock Bay',
    list: [
      { id: 'stretch', ic: '➰', t: () => 'Eat a Stretchy fruit', power: 'stretch' },
      { id: 'bones2', ic: '🦴', t: () => pickupText(2, 'bones') },
      { id: 'snack', ic: '🍪', t: () => 'Dig up Mango’s snack' },
      { id: 'feed', ic: '🦜', t: () => 'Feed Mango the parrot' },
      { id: 'crew', ic: '⛵', t: () => 'Bring Mango to the ship' },
    ],
  },
  collect: {
    total: 4,
    count: 0,
    taskId: 'bones2',
    name: 'Bone',
    all: 'All the bones! Good boy, Spartacus!',
    model: makeBone,
  },
  intro: [[3400, 'Mango the parrot is stuck on the tallest rock!', 3400]],
  win: {
    title: 'New crew mate!',
    text: 'Mango the parrot joined Spartacus’s crew! Next stop: a mysterious forest island.',
    tip: 'You can also sail later from the end of the dock.',
    go: 'Set sail! ⛵',
  },
  sailPath,
  exit: {
    label: 'Sail',
    at: (p) => p.z > CENTER_2.z + 22 && Math.abs(p.x - CENTER_2.x) < 1.6 && p.y > 0.5,
    run: () => startSail(sailPath, () => enterIsland(3, true)),
  },
  build,
  buildLate,
  interact(p) {
    const { mesa, westPad, eastPad, mangoPillar } = spots;
    hintTooHigh(distXZ(p, mesa.x, mesa.z) < 5.5, 'Too high! A Boing-Boing fruit grows nearby.');
    const nearPad = distXZ(p, westPad.x, westPad.z) < 3 || distXZ(p, eastPad.x, eastPad.z) < 3;
    if (!player.canStretch && nearPad)
      hintOnce('hook', 'Golden hooks! Spartacus needs a Stretchy fruit to swing.', 3400);
    if (player.canStretch && swingOption())
      hintOnce('swing', `Press ${actionKeyName()} to swing!`, 2400);
    if (
      mango.state === 'hungry' &&
      distXZ(p, mangoPillar.x, mangoPillar.z) < 3 &&
      player.carrying?.id !== 'snack'
    )
      hintOnce('mango', 'Mango is too hungry to fly. Find his snack!', 3200);
    // walking onto the dock with Mango on the hat: he flies up to the crow's nest
    if (
      mango.state === 'riding' &&
      p.z > spots.dockZ &&
      Math.abs(p.x - CENTER_2.x) < 1.6 &&
      p.y > 0.5
    ) {
      mangoToShip(() => completeTask('crew'));
      toast('Mango flies up to the crow’s nest!', 3000);
    }
  },
  actions(p) {
    const { mangoPillar } = spots;
    if (
      player.carrying?.id === 'snack' &&
      mango.state === 'hungry' &&
      distXZ(p, mangoPillar.x, mangoPillar.z) < 2.6 &&
      Math.abs(p.y - mangoPillar.y) < 1.5
    )
      return { label: 'Give', run: feedMango };
    return null;
  },
  bark(p) {
    if (mango.state !== 'hungry' || distXZ(p, spots.mangoPillar.x, spots.mangoPillar.z) >= 8)
      return;
    sfx.parrot();
    toast('Mango: “Snack? Snack?”', 2000);
  },
};
export default island;
