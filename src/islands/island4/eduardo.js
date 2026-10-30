import { clamp, distXZ, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst, textSprite, onFontsReady } from '../../core/fx.js';
import { toast } from '../../core/ui.js';
import { terrainHeight } from '../../world/terrain.js';
import { ship } from '../../world/ship.js';
import { player } from '../../player/player.js';
import { dog } from '../../player/dog.js';
import { completeTask } from '../../game/tasks.js';
import { makeCrab } from './crabs.js';
import { octo } from './octopus.js';
import { LANE_DIR, lanePoint, EDUARDO_LAST_HIDE } from './geo.js';

// Eduardo, the purple hermit crab with black spots. He thinks Spartacus is a shark and
// runs: into one seaweed clump, then the next, then behind the octopus. Once the octopus
// has moved to bed, Eduardo recognises Spartacus, rides his hat and joins the crew.
// {g, inner, state, t, stage, target, from}; stage = how many times he has run off,
// target = the clump (or spot) he runs to, from = start of a hop.
// state: idle0 | eek | run | inClump | behind | recognize | hop | riding | toShip | crew
export const eduardo = {};
let hideClumps = [],
  sharkLabel = null;

// hideIn: the clumps he dives into, in order
export function buildEduardo(hideIn) {
  hideClumps = hideIn;
  const { g, inner } = makeCrab(0x8a5cf6, { shellColor: 0xb59cff, spots: true });
  const start = lanePoint(3.5, 0);
  g.position.set(start.x, terrainHeight(start.x, start.z), start.z);
  g.rotation.y = Math.atan2(-LANE_DIR.x, -LANE_DIR.z);
  g.scale.setScalar(1.6);
  scene.add(g);
  Object.assign(eduardo, { g, inner, state: 'idle0', t: 0, stage: 0, target: null });
  onFontsReady(() => {
    sharkLabel = textSprite('A SHARK!!', '#ffffff');
    sharkLabel.scale.set(3.6, 0.9, 1);
    sharkLabel.visible = false;
    scene.add(sharkLabel);
  });
}

export function eek() {
  eduardo.state = 'eek';
  eduardo.t = 0;
  sfx.parrot();
  toast('Eduardo: “EEK! A SHARK!!”', 2200);
}

// hop off Spartacus's hat (back into world space) and onto the ship
export function eduardoToShip() {
  const e = eduardo;
  e.state = 'toShip';
  e.t = 0;
  const worldPos = vec3();
  e.g.getWorldPosition(worldPos);
  dog.head.remove(e.g);
  scene.add(e.g);
  e.g.position.copy(worldPos);
  e.g.scale.setScalar(1.3);
  e.from = worldPos;
}

// wave every other leg
function wiggleLegs(e, speed) {
  e.inner.children.forEach((ch, i) => {
    if (i > 3 && i % 2) ch.rotation.x = Math.sin(game.time * speed + i) * 0.3;
  });
}

// shake and shout, then run to the next hiding place
function updateEek(e) {
  const eg = e.g;
  eg.rotation.z = Math.sin(game.time * 40) * 0.15;
  eg.position.y = terrainHeight(eg.position.x, eg.position.z) + Math.abs(Math.sin(e.t * 14)) * 0.3;
  if (sharkLabel) {
    sharkLabel.visible = true;
    sharkLabel.position.set(eg.position.x, eg.position.y + 2.6, eg.position.z);
  }
  if (e.t <= 0.9) return;
  eg.rotation.z = 0;
  if (sharkLabel) sharkLabel.visible = false;
  e.stage++;
  e.state = 'run';
  e.t = 0;
  e.target = hideClumps[e.stage - 1] ?? EDUARDO_LAST_HIDE;
}

function updateRun(e, dt) {
  const eg = e.g,
    dx = e.target.x - eg.position.x,
    dz = e.target.z - eg.position.z,
    d = Math.hypot(dx, dz);
  if (d > 0.15) {
    const step = Math.min(d, dt * 7);
    eg.position.x += (dx / d) * step;
    eg.position.z += (dz / d) * step;
    eg.position.y =
      terrainHeight(eg.position.x, eg.position.z) + Math.abs(Math.sin(game.time * 18)) * 0.12;
    eg.rotation.y = Math.atan2(dx, dz);
    if (Math.random() < dt * 12)
      burst(eg.position.clone(), {
        count: 1,
        color: 0xf0d9a0,
        speed: 1,
        up: 1,
        life: 0.4,
        size: 0.6,
      });
  } else if (e.stage <= hideClumps.length) {
    // arrived at a clump: dive in (chopping it brings him out, see onChopClump in index.js)
    eg.visible = false;
    e.target.hidesEduardo = true;
    e.state = 'inClump';
    toast('Eduardo dived into the seaweed! Chop it to find him.', 3000);
  } else {
    e.state = 'behind';
    eg.rotation.y = Math.atan2(-LANE_DIR.x, -LANE_DIR.z);
    toast(
      octo.moved
        ? 'Eduardo is hiding by the octopus’s bed!'
        : 'Eduardo hid behind the grumpy octopus!',
      3200,
    );
  }
}

// his clump shakes and bubbles
function updateInClump(e, dt) {
  const clump = e.target;
  clump.g.rotation.z += Math.sin(game.time * 22) * 0.06;
  if (Math.random() < dt * 4)
    burst(vec3(clump.x, clump.y + 1, clump.z), {
      count: 1,
      color: 0xdff9ff,
      speed: 0.6,
      up: 2,
      life: 1.5,
      size: 0.8,
      gravity: -0.2,
    });
}

// trembling behind the octopus until it has moved to bed and Spartacus comes close
function updateBehind(e) {
  const eg = e.g;
  eg.rotation.z = Math.sin(game.time * 30) * 0.06;
  if (!octo.moved || distXZ(player.pos, eg.position.x, eg.position.z) >= 2.8) return;
  e.state = 'recognize';
  e.t = 0;
  eg.rotation.z = 0;
  sfx.parrot();
  eg.rotation.y = Math.atan2(player.pos.x - eg.position.x, player.pos.z - eg.position.z);
  toast('Eduardo: “Oh! It’s just Spartacus! Not a shark at all!”', 3400);
}

function updateRecognize(e) {
  const eg = e.g;
  eg.position.y = terrainHeight(eg.position.x, eg.position.z) + Math.abs(Math.sin(e.t * 8)) * 0.4;
  if (e.t <= 1.4) return;
  e.state = 'hop';
  e.t = 0;
  e.from = eg.position.clone();
}

// arc onto Spartacus's hat over 0.8s, then ride as a child of his head
function updateHop(e) {
  const eg = e.g,
    k = clamp(e.t / 0.8, 0, 1),
    to = dog.head.localToWorld(vec3(0, 0.72, -0.05));
  eg.position.lerpVectors(e.from, to, k);
  eg.position.y += Math.sin(Math.PI * k) * 1.2;
  if (k < 1) return;
  scene.remove(eg);
  dog.head.add(eg);
  eg.position.set(0, 0.68, -0.05);
  eg.rotation.set(0, 0, 0);
  eg.scale.setScalar(0.95);
  e.state = 'riding';
  toast('Eduardo climbs onto Spartacus’s hat!', 2600);
  completeTask('eduardo');
}

// arc onto the ship's deck over 1s and stay there as crew
function updateToShip(e) {
  const eg = e.g,
    k = clamp(e.t / 1, 0, 1),
    to = ship.localToWorld(vec3(-0.6, 1.2, 1));
  eg.position.lerpVectors(e.from, to, k);
  eg.position.y += Math.sin(Math.PI * k) * 2;
  if (k < 1) return;
  scene.remove(eg);
  ship.add(eg);
  eg.position.set(-0.6, 1.18, 1);
  eg.rotation.set(0, 0, 0);
  eg.scale.setScalar(1.3);
  e.state = 'crew';
  sfx.bone();
  completeTask('ship4');
}

export function updateEduardo(dt) {
  const e = eduardo;
  e.t += dt;
  switch (e.state) {
    case 'idle0':
      wiggleLegs(e, 4);
      break;
    case 'eek':
      updateEek(e);
      break;
    case 'run':
      updateRun(e, dt);
      break;
    case 'inClump':
      updateInClump(e, dt);
      break;
    case 'behind':
      updateBehind(e);
      break;
    case 'recognize':
      updateRecognize(e);
      break;
    case 'hop':
      updateHop(e);
      break;
    case 'riding':
      wiggleLegs(e, 6);
      break;
    case 'toShip':
      updateToShip(e);
      break;
  }
}
