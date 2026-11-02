// The tide pools (the yellow islet): night is the key.
//   Moon Rock stands out in the lagoon, too tall to climb out of the water onto and taller
//   than a Boing-Boing jump from the beach. At night (🌙) the tide goes out and a row of stepping
//   stones rises out of the sea, each one a normal jump higher, up to its top. The yellow star
//   is buried in the sand mound up there: dig it up, or SLAM it. By day the stones sink again.
import * as THREE from 'three';
import { distXZ, lerp, smoothstep, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { burst } from '../../core/fx.js';
import { toast, hintOnce, actionKeyName } from '../../core/ui.js';
import { addCylinder } from '../../core/colliders.js';
import { terrainHeight } from '../../world/terrain.js';
import { rockTop } from '../../world/props.js';
import { daylight } from '../../world/daylight.js';
import { addDig } from '../../systems/digs.js';
import { revealStar } from './stars.js';

const STONE_TOPS = [1.6, 3, 4.4, 5.8]; // each a normal jump (up to ~2.3) above the last
const MOON_TOP = 7.2; // more than a Boing-Boing jump (~6.4) above the beach
const STONE_GAP = 1.8;
const STONE_RADIUS = 0.75;
const SUNK = -1.3; // a stone's top by day: under the surface, so it's just paddling there

// center: the islet's middle; from: the hub's middle (the rock is on the far side). World coords.
export function buildTidePools(center, { from, addStar }) {
  const dir = vec3(center.x - from.x, 0, center.z - from.z).normalize();
  const along = (d) => ({ x: center.x + dir.x * d, z: center.z + dir.z * d });
  // walk out from the middle until the beach ends, so the first stone is just off the shore
  let shore = 6;
  while (terrainHeight(along(shore).x, along(shore).z) > -0.3) shore += 0.25;
  const stones = STONE_TOPS.map((top, i) => addStone(along(shore + 0.8 + i * STONE_GAP), top));
  const moonDist = shore + 0.8 + STONE_TOPS.length * STONE_GAP + 2.2;
  const moon = along(moonDist);
  moon.y = rockTop(moon.x, moon.z, { radius: 2.6, top: MOON_TOP, color: 0xa7aec9 });
  const tide = { stones, moon, shore: along(shore), low: 0 };
  tide.star = addStar('yellow', vec3(moon.x, moon.y + 1.1, moon.z));
  addDig(moon.x, moon.z, {
    y: moon.y,
    marked: true,
    // fine to run again when a save is put back (it just reveals the star quietly)
    reward: () => {
      revealStar(tide.star, { quiet: game.restoring });
      toast('The yellow star was buried up here!', 2800);
    },
  });
  return makeIslet(tide);
}

// a round stone pillar standing on the lagoon floor; its collider top follows the tide
function addStone({ x, z }, top) {
  const floor = terrainHeight(x, z),
    height = top - floor;
  const m = mesh(
    new THREE.CylinderGeometry(STONE_RADIUS, STONE_RADIUS * 1.15, height, 10),
    material(0xa7aec9),
    {
      receiveShadow: true,
    },
  );
  scene.add(m);
  const col = addCylinder(x, z, { r: STONE_RADIUS, bottom: floor - 1, top });
  const stone = { x, z, top, height, mesh: m, col };
  placeStone(stone, SUNK);
  return stone;
}
function placeStone(stone, top) {
  stone.mesh.position.set(stone.x, top - stone.height / 2, stone.z);
  stone.col.top = top;
}

function makeIslet(tide) {
  const { stones, moon, shore } = tide;
  return {
    update(dt) {
      // the tide follows the night fade: out at night, in by day
      const low = smoothstep(0.2, 0.9, daylight.night);
      const moving = Math.abs(low - tide.low) > 0.002;
      tide.low = low;
      for (const stone of stones) {
        placeStone(stone, lerp(SUNK, stone.top, low));
        if (moving && Math.random() < dt * 8)
          burst(vec3(stone.x, 0.1, stone.z), {
            count: 3,
            color: [0xffffff, 0xbff3ff],
            speed: 1.5,
            up: 2,
            life: 0.5,
          });
      }
    },
    interact(p) {
      const nearRock = distXZ(p, moon.x, moon.z) < 10;
      if (nearRock && daylight.night < 0.5)
        hintOnce(
          'tideHigh',
          'The sea is too high here… Maybe the tide goes out at night? 🌙',
          3800,
        );
      if (tide.low > 0.95 && distXZ(p, shore.x, shore.z) < 7)
        hintOnce('tideLow', 'The tide went out! Stepping stones!', 3000);
      if (distXZ(p, moon.x, moon.z) < 2.6 && Math.abs(p.y - moon.y) < 1)
        hintOnce('moonDig', `A sand mound! Dig it with ${actionKeyName()}, or SLAM it.`, 3200);
    },
  };
}
