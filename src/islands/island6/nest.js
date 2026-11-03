// The Magpie's Nest: steps up from the palace's east side to a wide cloud where Leo watches over
// the Sky Jewel from his nest. Sneak from pink bush to pink bush (Mini-Me makes you harder to
// spot, a woof distracts him), reach the nest with the fork and swap it for the jewel.
// buildNest returns {update(dt), interact(p), action(p), bark(p), load()} like island 5's islets.
import * as THREE from 'three';
import { distXZ, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { toast, hintOnce } from '../../core/ui.js';
import { addCylinder } from '../../core/colliders.js';
import { makeFork, makeJewel } from '../../models/items.js';
import { player } from '../../player/player.js';
import { addItem, carryItem, useUpCarried } from '../../systems/items.js';
import { completeTask } from '../../game/tasks.js';
import { leo, placeLeo, updateLeo, distractLeo, leoHome, leoHappy } from '../../npcs/leo.js';
import { addCloud, addCloudBush } from './clouds.js';
import { crystalMaterial } from './crystal.js';

// island-local, as [x, z, radius, top]: three hops up from the palace's east side, then Leo's cloud
const STEPS = [
  [17, -58, 3.5, 9],
  [26, -67, 3, 11],
  [32, -77, 3.5, 12],
];
const LEO_CLOUD = [40, -96, 14, 13];
const NEST = [46, -107]; // at the far side, looking back towards the way in
const ENTRY = [36, -84];
const PERCHES = [
  [31, -100],
  [52, -92],
];
// pink bushes to hide behind, from the way in to right by the nest
const BUSHES = [
  [37, -89],
  [43, -92],
  [38, -97],
  [45, -99],
  [41, -103],
  [49, -103],
];
const NEST_HEIGHT = 0.6; // the crystal stump the nest sits on
const PERCH_HEIGHT = 3;

export function buildNest(toWorld, { island }) {
  const at = ([x, z]) => toWorld(x, z);
  for (const [x, z, r, top] of STEPS) addCloud(at([x, z]).x, at([x, z]).z, { r, top });
  const [cx, cz, r, top] = LEO_CLOUD,
    center = toWorld(cx, cz),
    ground = { ...addCloud(center.x, center.z, { r, top }) };
  const bushes = BUSHES.map((spot) => addCloudBush(at(spot).x, at(spot).z, { top }));
  const nest = addNestStump(at(NEST), { top });
  const perches = PERCHES.map((spot) => addPerch(at(spot), { top }));
  const entry = at(ENTRY);
  placeLeo(
    {
      nest: nest.clone().setY(top + NEST_HEIGHT + 0.05),
      perches,
      bushes,
      ground,
      facing: Math.atan2(entry.x - nest.x, entry.z - nest.z),
    },
    { jewel: makeJewel() },
  );
  // the jewel lying in the nest (hidden while Leo flies off with it, and once it's swapped)
  const nestJewel = makeJewel();
  nestJewel.position.copy(nest).setY(top + NEST_HEIGHT + 0.1);
  scene.add(nestJewel);
  const state = { spottedCount: 0 };

  // the swap: the fork goes in the nest, the jewel in Spartacus's mouth, and Leo is a friend
  function swap({ quiet = false } = {}) {
    if (!quiet) useUpCarried();
    const fork = makeFork();
    fork.position.copy(nest).setY(top + NEST_HEIGHT + 0.12);
    fork.rotation.y = 0.6;
    scene.add(fork);
    leoHappy({ quiet });
    const jewel = addItem('jewel', {
      model: makeJewel(),
      pos: nest.clone().setY(top + NEST_HEIGHT + 0.15),
      name: 'Sky Jewel',
      lift: 0.05,
    });
    if (quiet) return; // a save: the items system puts the jewel where it was
    carryItem(jewel);
    completeTask('skyJewel');
    const lines = [
      [0, 'Leo: “Ooh! A shiny fork! For me? Swap!”', 3200],
      [3600, 'Leo: “Chack-chack! Friends now?” Leo is your friend!', 3600],
      [7600, 'Take the Sky Jewel back to Lina’s fountain!', 3200],
    ];
    for (const [delay, text, ms] of lines) setTimeout(() => toast(text, ms), delay);
  }

  function onSpotted() {
    state.spottedCount += 1;
    const hints = [
      ['leoSpotted', 'Leo saw you! He flutters off with the jewel… He’ll be back.', 3600],
      ['leoWoof', 'Tip: WOOF to make Leo look around, then sneak!', 3400],
      ['leoTiny', 'Tip: a teeny Mini-Me dog is much harder to spot.', 3400],
    ];
    const [id, text, ms] = hints[Math.min(state.spottedCount, hints.length) - 1];
    hintOnce(id, text, ms);
  }

  const nearNest = (p) => distXZ(p, nest.x, nest.z) < 2.6 && Math.abs(p.y - top) < 1;
  return {
    update(dt) {
      updateLeo(dt, { onSpotted });
      nestJewel.visible = !island.done.skyJewel && !leo.jewel.visible;
    },
    interact(p) {
      const onLeoCloud = distXZ(p, ground.x, ground.z) < ground.r && Math.abs(p.y - top) < 1;
      if (onLeoCloud && !island.done.skyJewel)
        hintOnce('leo', 'Shh! Leo guards the Sky Jewel. Hide behind the pink bushes!', 3600);
      if (nearNest(p) && player.carrying?.id !== 'fork' && !island.done.skyJewel)
        hintOnce('leoShiny', 'Leo: “Shiny? Shiny?” He only swaps for something shiny.', 3600);
    },
    action(p) {
      if (island.done.skyJewel || player.carrying?.id !== 'fork' || !nearNest(p) || !leoHome())
        return null;
      return { label: 'Swap', run: swap };
    },
    bark(p) {
      if (leo.g.getWorldPosition(vec3()).distanceTo(p) > 20) return false;
      if (island.done.skyJewel) toast('Leo: “Chack-chack! Best friends!”', 2400);
      else if (distractLeo()) toast('Leo looks all around for the woof… Sneak now!', 2800);
      return true;
    },
    load() {
      if (island.done.skyJewel) swap({ quiet: true });
    },
  };
}

// a short crystal stump with a twiggy nest on top; returns the nest's middle (y = cloud top)
function addNestStump(pos, { top }) {
  const stump = mesh(new THREE.CylinderGeometry(0.6, 0.75, NEST_HEIGHT, 8), crystalMaterial());
  stump.position.set(pos.x, top + NEST_HEIGHT / 2, pos.z);
  scene.add(stump);
  const nest = mesh(new THREE.TorusGeometry(0.55, 0.2, 6, 12), material(0x9c6436));
  nest.rotation.x = Math.PI / 2;
  nest.position.set(pos.x, top + NEST_HEIGHT + 0.1, pos.z);
  scene.add(nest);
  addCylinder(pos.x, pos.z, { r: 0.75, bottom: top, top: top + NEST_HEIGHT });
  return vec3(pos.x, top, pos.z);
}

// a thin crystal post Leo flutters to with the jewel; returns where he stands on it
function addPerch(pos, { top }) {
  const post = mesh(new THREE.CylinderGeometry(0.25, 0.35, PERCH_HEIGHT, 6), crystalMaterial());
  post.position.set(pos.x, top + PERCH_HEIGHT / 2, pos.z);
  scene.add(post);
  addCylinder(pos.x, pos.z, { r: 0.35, bottom: top, top: top + PERCH_HEIGHT });
  return vec3(pos.x, top + PERCH_HEIGHT + 0.05, pos.z);
}
