// The kelp garden (the blue islet): Chop-Chop and three beach balls.
//   A tall kelp hedge rings the garden: Chop a way in (the Chop-Chop bush grows just outside).
//   Inside, a giant clam sits in the pond, shut tight. Three stone plates round the pond each
//   need a beach ball resting on them: two balls are in the garden, and Wasabi brings up the
//   third from the bubbles out in the lagoon when you bark there. Kick, bark at or slam the
//   balls onto the plates (they gently pull a slow ball in) and the clam opens: the blue star.
import * as THREE from 'three';
import { distXZ, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { toast, hintOnce } from '../../core/ui.js';
import { addCylinder } from '../../core/colliders.js';
import { terrainHeight } from '../../world/terrain.js';
import { addChoppable } from '../../systems/hat.js';
import { addBall, ballsNear } from '../../systems/balls.js';
import { player } from '../../player/player.js';
import { wasabi, wasabiFetch } from '../../npcs/wasabi.js';
import { revealStar } from './stars.js';

const HEDGE_RADIUS = 11.5;
const HEDGE_CLUMPS = 32;
// the hedge's colliders are much taller than it looks: no Boing-Boing jumping over it
const HEDGE_COLLIDER = 7;
const PLATE_RADIUS = 8.5; // plates and balls sit on the ring between the hedge and the pond
const PLATE_ANGLES = [Math.PI / 2, (Math.PI * 7) / 6, (Math.PI * 11) / 6];
const BALL_ANGLES = [Math.PI / 6, (Math.PI * 5) / 6];
const OUT_TO_SEA = new THREE.Vector2(1, 0.6).normalize(); // the bubbles are off this side

// center: the islet's middle (world). addStar(name, pos) makes its hidden blue star.
export function buildKelpGarden(center, { addStar }) {
  const kelp = { center, clumps: [], plates: [], clamOpen: false, wasabiBall: false, open: 0 };
  const around = (angle, r) => ({
    x: center.x + Math.cos(angle) * r,
    z: center.z + Math.sin(angle) * r,
  });
  for (let i = 0; i < HEDGE_CLUMPS; i++)
    kelp.clumps.push(addClump(kelp, around((i / HEDGE_CLUMPS) * Math.PI * 2, HEDGE_RADIUS), i));
  for (const angle of PLATE_ANGLES) kelp.plates.push(addPlate(around(angle, PLATE_RADIUS)));
  for (const angle of BALL_ANGLES) {
    const { x, z } = around(angle, PLATE_RADIUS);
    addBall(x, z);
  }
  buildClam(kelp);
  kelp.star = addStar('blue', vec3(center.x, kelp.clam.top + 1.2, center.z));
  // where Wasabi finds the ball, and the beach (outside the hedge) where she leaves it
  kelp.bubbles = {
    x: center.x + OUT_TO_SEA.x * 20.5,
    z: center.z + OUT_TO_SEA.y * 20.5,
  };
  let r = 14;
  while (r > 12.6 && terrainHeight(center.x + OUT_TO_SEA.x * r, center.z + OUT_TO_SEA.y * r) < 0.2)
    r -= 0.2;
  kelp.drop = { x: center.x + OUT_TO_SEA.x * r, z: center.z + OUT_TO_SEA.y * r };
  return makeIslet(kelp);
}

// three tall wavy blades; the hat cuts it and its two neighbours, opening a gap in the hedge
function addClump(kelp, { x, z }, index) {
  const ground = terrainHeight(x, z),
    g = new THREE.Group();
  g.position.set(x, ground, z);
  for (let k = 0; k < 3; k++) {
    const blade = mesh(
      new THREE.BoxGeometry(0.35, 3.4 + k * 0.4, 0.12),
      material(k % 2 ? 0x2f8a4a : 0x3fa85a),
    );
    blade.position.set(Math.cos(k * 2.1) * 0.4, 1.7 + k * 0.2, Math.sin(k * 2.1) * 0.4);
    blade.rotation.y = k * 1.3;
    g.add(blade);
  }
  scene.add(g);
  const col = addCylinder(x, z, { r: 1.05, bottom: ground - 1, top: ground + HEDGE_COLLIDER });
  const clump = { g, col, x, z, cut: false };
  const cutGap = () => {
    for (const k of [-1, 0, 1]) {
      const neighbour = kelp.clumps[(index + k + HEDGE_CLUMPS) % HEDGE_CLUMPS];
      if (!neighbour.cut) cutClump(neighbour);
    }
  };
  clump.choppable = addChoppable({ x, y: ground + 1, z, onChop: cutGap });
  return clump;
}
function cutClump(clump, { quiet = false } = {}) {
  clump.cut = true;
  clump.choppable.cut = true; // already set when the hat cut it; not when a save is put back
  clump.col.top = -999;
  clump.g.scale.set(1, 0.12, 1); // a little stump stays
  if (quiet) return;
  burst(vec3(clump.x, clump.g.position.y + 1.5, clump.z), {
    count: 14,
    color: [0x3fa85a, 0x2f8a4a],
    speed: 3,
    up: 2,
    life: 0.8,
  });
}

// a round stone plate with a shell mark; glows when a ball is resting on it
function addPlate({ x, z }) {
  const top = terrainHeight(x, z) + 0.12;
  const stone = new THREE.MeshStandardMaterial({ color: 0xc9c2b4, emissive: 0xffd84d });
  stone.emissiveIntensity = 0;
  const m = mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.24, 16), stone, { receiveShadow: true });
  m.position.set(x, top - 0.12, z);
  scene.add(m);
  const mark = mesh(new THREE.CircleGeometry(0.4, 10), material(0xff9fb2), { castShadow: false });
  mark.rotation.x = -Math.PI / 2;
  mark.position.set(x, top + 0.01, z);
  scene.add(mark);
  return { x, z, top, stone, pressed: false };
}

// the clam on a little sand island in the middle of the pond; the lid hinges at the back
function buildClam(kelp) {
  const { x, z } = kelp.center,
    top = 0.25;
  const sand = mesh(new THREE.CylinderGeometry(2, 2.3, 2.4, 16), material(0xffe08a), {
    receiveShadow: true,
  });
  sand.position.set(x, top - 1.2, z);
  scene.add(sand);
  addCylinder(x, z, { r: 2, bottom: -3, top });
  const shellMaterial = material(0xb59cff);
  const half = (flip) => {
    const geo = new THREE.SphereGeometry(1.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const m = mesh(geo, shellMaterial);
    m.scale.set(1, 0.45, 1);
    if (flip) m.rotation.x = Math.PI;
    return m;
  };
  const base = half(true);
  base.position.set(x, top + 0.5, z);
  scene.add(base);
  const lid = new THREE.Group();
  lid.position.set(x, top + 0.5, z - 1.05); // the hinge, at the back
  const lidShell = half(false);
  lidShell.position.z = 1.05;
  lid.add(lidShell);
  scene.add(lid);
  kelp.clam = { lid, top: top + 0.5 };
}

/* ---------------- what happens ---------------- */

// a slow ball near a plate rolls the last bit onto it; returns true while one rests on it
function holdBallOn(plate, dt) {
  let resting = false;
  for (const ball of ballsNear(plate.x, plate.z, 2.2)) {
    const dx = plate.x - ball.pos.x,
      dz = plate.z - ball.pos.z,
      dist = Math.hypot(dx, dz),
      speed = Math.hypot(ball.vel.x, ball.vel.z);
    if (speed < 3.5 && dist > 0.1) {
      ball.vel.x += (dx / dist) * dt * 6;
      ball.vel.z += (dz / dist) * dt * 6;
    }
    if (dist < 0.85 && speed < 1.2 && Math.abs(ball.pos.y - plate.top - 0.45) < 0.4) resting = true;
  }
  return resting;
}

function updatePlates(kelp, dt) {
  for (const plate of kelp.plates) {
    const pressed = holdBallOn(plate, dt);
    if (pressed && !plate.pressed) sfx.ding();
    plate.pressed = pressed;
    plate.stone.emissiveIntensity = pressed ? 0.6 : 0;
  }
  if (!kelp.clamOpen && kelp.plates.every((plate) => plate.pressed)) openClam(kelp);
}

function openClam(kelp, { quiet = false } = {}) {
  kelp.clamOpen = true;
  if (quiet) {
    kelp.open = 1;
    kelp.clam.lid.rotation.x = -1.1;
  }
  revealStar(kelp.star, { quiet });
  if (quiet) return;
  sfx.creak();
  toast('All three balls are on the plates! The giant clam opens…', 3400);
}

// bubbles rise where the lost ball is, until Wasabi has fetched it
function updateBubbles(kelp, dt) {
  if (kelp.wasabiBall || Math.random() > dt * 6) return;
  const { x, z } = kelp.bubbles;
  burst(vec3(x + (Math.random() - 0.5), 0.05, z + (Math.random() - 0.5)), {
    count: 2,
    color: [0xffffff, 0xbff3ff],
    speed: 0.6,
    up: 2.5,
    life: 0.6,
    size: 0.8,
  });
}

function callWasabi(kelp) {
  kelp.wasabiBall = true;
  toast('Wasabi heard you! She dives down to the bubbles…', 2800);
  const carried = mesh(new THREE.SphereGeometry(0.45, 14, 10), material(0xf2545b));
  wasabiFetch({
    from: kelp.bubbles,
    to: kelp.drop,
    carried,
    onDrop: ({ x, z }) => {
      addBall(x, z);
      toast('Wasabi found a beach ball! Kick it into the garden.', 3200);
    },
  });
}

/* ---------------- the islet, as the island sees it ---------------- */

function makeIslet(kelp) {
  const { center, bubbles } = kelp;
  return {
    update(dt) {
      updatePlates(kelp, dt);
      updateBubbles(kelp, dt);
      if (kelp.clamOpen && kelp.open < 1) {
        kelp.open = Math.min(1, kelp.open + dt * 0.8);
        kelp.clam.lid.rotation.x = -1.1 * kelp.open;
      }
      // the hedge sways a little
      const sway = Math.sin(game.time * 1.3) * 0.05;
      for (const clump of kelp.clumps) if (!clump.cut) clump.g.rotation.z = sway;
    },
    interact(p) {
      const fromCenter = distXZ(p, center.x, center.z);
      if (fromCenter > HEDGE_RADIUS && fromCenter < HEDGE_RADIUS + 3 && player.power !== 'chop')
        hintOnce('kelpHedge', 'A thick kelp hedge! A Chop-Chop fruit could cut a way in.', 3400);
      if (kelp.plates.some((plate) => distXZ(p, plate.x, plate.z) < 1.6))
        hintOnce('kelpPlate', 'A stone plate! It needs a beach ball resting on it.', 3200);
      if (fromCenter < 3.5 && !kelp.clamOpen)
        hintOnce('kelpClam', 'A giant clam, shut tight. Maybe the three plates open it?', 3400);
      if (!kelp.wasabiBall && distXZ(p, bubbles.x, bubbles.z) < 5)
        hintOnce(
          'kelpBubbles',
          'Bubbles! Something is stuck down there. Bark to call Wasabi!',
          3400,
        );
    },
    bark(p) {
      if (kelp.wasabiBall || wasabi.state !== 'crew' || distXZ(p, bubbles.x, bubbles.z) > 5) return;
      callWasabi(kelp);
    },
    save: () => ({
      chopped: kelp.clumps.flatMap((clump, i) => (clump.cut ? [i] : [])),
      wasabiBall: kelp.wasabiBall,
      clamOpen: kelp.clamOpen,
    }),
    load(state) {
      for (const i of state.chopped ?? []) cutClump(kelp.clumps[i], { quiet: true });
      if (state.wasabiBall) {
        kelp.wasabiBall = true;
        if (!state.clamOpen) addBall(kelp.drop.x, kelp.drop.z);
      }
      if (state.clamOpen) openClam(kelp, { quiet: true });
    },
  };
}
