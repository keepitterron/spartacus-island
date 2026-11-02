// The sea stack (the orange islet): every fruit in one climb.
//   ground -> Boing-Boing onto the first ledge (a Stretchy bush there)
//   -> golden hooks up to the middle ledge and the plateau (a Grow-Grow bush there)
//   -> a Grow-Grow vine up the column to the cap: the orange star, and a zipline home to the hub.
// Each tier is 7 higher than the last: more than a Boing-Boing jump reaches (about 5.9, plus a
// 0.5 step up), so the hooks and the vine can't be skipped.
import * as THREE from 'three';
import { vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { addCylinder } from '../../core/colliders.js';
import { terrainHeight } from '../../world/terrain.js';
import { rockTop } from '../../world/props.js';
import { addHook } from '../../systems/hooks.js';
import { climbVine, zipVine } from '../../systems/vines.js';

const TIER = 7; // height between the hook tiers, and from the plateau to the cap
const FIRST_LEDGE = 4.8; // above the ground: a Boing-Boing jump, not a normal one
const STACK_COLOR = 0xb8a48c;

// center: the islet's middle (world); lookout: {x, z, top} on the hub where the zipline lands.
// Returns the spots the island needs: {ledge, middle, plateau, cap, stretchBush, growBush, star}
export function buildSeaStack(center, { lookout }) {
  const at = (dx, dz) => ({ x: center.x + dx, z: center.z + dz });
  const ledge = at(-6.5, 5.5),
    middle = at(5.5, 6.5);
  ledge.y = rockTop(ledge.x, ledge.z, {
    radius: 2.2,
    top: terrainHeight(ledge.x, ledge.z) + FIRST_LEDGE,
    color: STACK_COLOR,
  });
  middle.y = rockTop(middle.x, middle.z, { radius: 1.7, top: ledge.y + TIER, color: STACK_COLOR });
  const plateau = { ...center };
  plateau.y = rockTop(center.x, center.z, {
    radius: 3.8,
    top: middle.y + TIER,
    color: STACK_COLOR,
  });
  const column = addColumn(center, { bottom: plateau.y, top: plateau.y + TIER + 0.4 });

  // spots on the plateau's rim, measured round from the side facing the middle ledge
  const towardMiddle = Math.atan2(middle.z - center.z, middle.x - center.x);
  const onRim = (turn, r = 2.5) => ({
    x: center.x + Math.cos(towardMiddle + turn) * r,
    z: center.z + Math.sin(towardMiddle + turn) * r,
    y: plateau.y,
  });
  // the hooks: first ledge (its side facing the middle one) -> middle ledge -> plateau rim
  const ledgeLanding = { x: ledge.x + 0.8, z: ledge.z + 0.1, y: ledge.y };
  addHook(ledgeLanding, middle);
  addHook(middle, onRim(0, 2.6));
  const seed = onRim(-2.2);
  climbVine(column, seed.x, seed.z);
  zipVine(column, lookout);
  return {
    ledge,
    middle,
    plateau,
    cap: { x: center.x, z: center.z, y: column.top },
    stretchBush: { x: ledge.x - 0.9, z: ledge.z - 0.4, y: ledge.y },
    growBush: onRim(2.2),
    star: vec3(center.x, column.top + 1, center.z),
  };
}

// the top column: a rock trunk with a wide flat cap, climbable once its vine grows
// (like island 3's big trees, but standing on the plateau, hence `raised`)
function addColumn(center, { bottom, top }) {
  const { x, z } = center;
  const tree = { x, z, gh: bottom, top, grown: false, raised: true };
  const trunk = mesh(
    new THREE.CylinderGeometry(1.1, 1.35, top - bottom, 9),
    material(STACK_COLOR),
    {
      receiveShadow: true,
    },
  );
  trunk.position.set(x, (bottom + top) / 2, z);
  scene.add(trunk);
  const cap = mesh(new THREE.CylinderGeometry(3.1, 2.6, 0.7, 12), material(STACK_COLOR), {
    receiveShadow: true,
  });
  cap.position.set(x, top - 0.35, z);
  scene.add(cap);
  const moss = mesh(new THREE.CylinderGeometry(3, 3, 0.12, 12), material(0x7cc86a), {
    castShadow: false,
    receiveShadow: true,
  });
  moss.position.set(x, top + 0.02, z);
  scene.add(moss);
  tree.col = addCylinder(x, z, { r: 1.2, bottom: bottom - 0.5, top: top - 0.6 });
  tree.col.tree = tree; // walking into the trunk once the vine has grown climbs it
  addCylinder(x, z, { r: 3.1, bottom: top - 0.7, top });
  return tree;
}
