// Zoë's bonus on the west beach: three crabs huddle round an amethyst. A woof (or walking right up)
// sends them scuttling off along the sand with it; further on they drop it and dig themselves into
// the sand, and Spartacus can take it to the ship as a treasure (systems/treasures.js).
import { distXZ, lerp, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { toast, hintOnce } from '../../core/ui.js';
import { terrainHeight } from '../../world/terrain.js';
import { makeAmethyst } from '../../models/items.js';
import { keepTreasure, hasTreasure } from '../../systems/treasures.js';
import { makeCrab } from '../island4/crabs.js';

const NOTICE_REACH = 9; // m: the hint about the crabs
const BARK_REACH = 8; // m: a woof this close sends them off
const TOUCH_REACH = 2.2; // m: so does walking right up
const CARRY_SPEED = 2.6; // m a second while they scuttle off with it
const TAKE_REACH = 1.4; // m: Spartacus picks it up

// state: huddle | carry | dig (dropped it, burrowing) | gone
// gem: the amethyst model (null once it's on the ship, or if it already was); lying: it's on the sand
const group = {
  state: 'huddle',
  t: 0,
  crabs: [],
  gem: null,
  lying: false,
  from: null,
  to: null,
  pos: vec3(),
};

// from, to: {x, z} spots: where they huddle, and where they drop it
export function addAmethystCrabs(from, { to }) {
  group.from = from;
  group.to = to;
  group.pos.set(from.x, terrainHeight(from.x, from.z), from.z);
  for (let i = 0; i < 3; i++) {
    const crab = makeCrab(0xff6b5a, { shellColor: 0xf3e6c8 });
    crab.g.scale.setScalar(1.3);
    scene.add(crab.g);
    group.crabs.push({ g: crab.g, angle: (i / 3) * Math.PI * 2, phase: i * 2.1 });
  }
  if (!hasTreasure('amethyst')) {
    group.gem = makeAmethyst();
    scene.add(group.gem);
  }
  placeCrabs(0);
}

function startCarry() {
  group.state = 'carry';
  group.t = 0;
  sfx.squeak();
  toast(
    group.gem
      ? 'The crabs grab something shiny and scuttle off with it!'
      : 'The crabs scuttle off!',
    3000,
  );
}

// walking up, or a woof, startles them
export function interactAmethyst(p) {
  if (group.state === 'huddle') {
    const dist = distXZ(p, group.pos.x, group.pos.z);
    if (dist < NOTICE_REACH && group.gem)
      hintOnce('crabs', 'Three crabs are hiding something shiny… woof!', 3200);
    if (dist < TOUCH_REACH) startCarry();
  }
  if (group.lying && distXZ(p, group.gem.position.x, group.gem.position.z) < TAKE_REACH)
    takeAmethyst();
}
export function barkAtCrabs(p) {
  if (group.state === 'huddle' && distXZ(p, group.pos.x, group.pos.z) < BARK_REACH) startCarry();
}

function takeAmethyst() {
  group.lying = false;
  scene.remove(group.gem);
  burst(group.gem.position.clone().add(vec3(0, 0.4, 0)), {
    count: 24,
    color: [0xa66bff, 0xd9b8ff, 0xffffff],
    speed: 4,
    up: 3,
    life: 1,
    size: 1,
  });
  group.gem = null;
  sfx.chime();
  keepTreasure('amethyst');
  toast('An amethyst! A treasure for the ship. 💜', 3400);
}

// the crabs round the group's centre, the gem between (or above) them
function placeCrabs(lift) {
  const { pos } = group;
  for (const crab of group.crabs) {
    crab.g.position.set(
      pos.x + Math.cos(crab.angle) * 0.6,
      pos.y,
      pos.z + Math.sin(crab.angle) * 0.6,
    );
  }
  if (group.gem && !group.lying) group.gem.position.set(pos.x, pos.y + lift, pos.z);
}

export function updateAmethystCrabs(dt) {
  group.t += dt;
  const time = game.time;
  if (group.state === 'huddle') {
    placeCrabs(0);
    // facing in, jiggling, as if guarding it
    for (const crab of group.crabs) {
      crab.g.rotation.y = Math.atan2(
        group.pos.x - crab.g.position.x,
        group.pos.z - crab.g.position.z,
      );
      crab.g.position.y += Math.abs(Math.sin(time * 6 + crab.phase)) * 0.05;
    }
    if (group.gem) group.gem.rotation.y += dt * 0.6;
    return;
  }
  if (group.state === 'carry') updateCarry(dt);
  else if (group.state === 'dig') updateDig();
  if (group.lying) {
    group.gem.rotation.y += dt * 1.5;
    group.gem.position.y = group.restY + 0.1 + Math.sin(time * 2.5) * 0.06;
  }
}

// sideways along the sand to the drop spot, holding the gem up between them
function updateCarry(dt) {
  const { pos, to } = group;
  const dx = to.x - pos.x,
    dz = to.z - pos.z,
    dist = Math.hypot(dx, dz);
  const heading = Math.atan2(dx, dz);
  const step = Math.min(dist, CARRY_SPEED * dt);
  pos.x += (dx / (dist || 1)) * step;
  pos.z += (dz / (dist || 1)) * step;
  pos.y = terrainHeight(pos.x, pos.z);
  placeCrabs(0.45);
  for (const crab of group.crabs) {
    crab.g.rotation.y = heading + Math.PI / 2; // crabs walk sideways
    crab.g.position.y += Math.abs(Math.sin(game.time * 14 + crab.phase)) * 0.08;
  }
  if (dist > 0.05) return;
  group.state = 'dig';
  group.t = 0;
  if (!group.gem) return;
  group.lying = true;
  group.restY = pos.y;
  group.gem.position.set(pos.x, pos.y + 0.1, pos.z);
  hintOnce('amethyst', 'They left the shiny stone behind! Go and get it.', 3000);
}

// a little run towards the sea, sinking into the sand, then gone
function updateDig() {
  const t = Math.min(1, group.t / 1.4);
  const outX = group.pos.x,
    outZ = group.pos.z,
    len = Math.hypot(outX, outZ) || 1; // away from the island centre is towards the sea
  for (const crab of group.crabs) {
    const x = outX + Math.cos(crab.angle) * lerp(0.6, 1.4, t) + (outX / len) * t * 2.5,
      z = outZ + Math.sin(crab.angle) * lerp(0.6, 1.4, t) + (outZ / len) * t * 2.5;
    crab.g.position.set(x, terrainHeight(x, z) - t * t * 0.6, z);
  }
  if (t < 1) return;
  for (const crab of group.crabs) scene.remove(crab.g);
  group.state = 'gone';
}

/* mid-island saves (game/progress.js) */
// huddle (not startled yet) | gone (they ran off); the amethyst itself is saved as a treasure, so
// if they've run off and it isn't on the ship yet, it's lying where they dropped it
export const amethystCrabsState = () => (group.state === 'huddle' ? 'huddle' : 'gone');
export function restoreAmethystCrabs(state) {
  if (state !== 'gone') return;
  for (const crab of group.crabs) scene.remove(crab.g);
  group.state = 'gone';
  const { to } = group;
  group.pos.set(to.x, terrainHeight(to.x, to.z), to.z);
  if (!group.gem) return;
  group.lying = true;
  group.restY = group.pos.y;
  group.gem.position.set(group.pos.x, group.pos.y + 0.1, group.pos.z);
}
