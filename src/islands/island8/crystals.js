// The Echo Hall's crystal switches. A woof near any crystal swaps which colour is up: red blocks
// rise and blue ones sink, or the other way round. Gates (`wall: true`) are tall glowing barriers
// when up and a coloured tile in the floor when down; steps are low blocks to jump onto. A gate
// waits to rise while Spartacus stands in it, so it never traps or lifts him; a step rising under
// him carries him up.
//
//   addCrystal(spot)   addColourBlock(spot, { color: 'red' | 'blue', hw, hd, tall, wall })
//   woofCrystals(p)    true if a crystal heard it;   upColour()  'red' | 'blue'
import * as THREE from 'three';
import { clamp, distXZ, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { addBox, inFootprint } from '../../core/colliders.js';
import { player, RADIUS } from '../../player/player.js';

const HEAR_REACH = 6.5; // m: a woof this close to a crystal swaps the colours
const RISE_SPEED = 4; // m/s
const WALL_COLLIDER = 12; // a raised gate's collider: above any jump
const COLORS = { red: 0xff5a6e, blue: 0x5aa8ff };

const echo = { up: 'red', crystals: [], blocks: [] };

const glow = (color) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.85,
    roughness: 0.3,
  });

// a crystal ball on a stone pedestal; it shows the colour that's up
export function addCrystal(spot) {
  const pedestal = mesh(new THREE.CylinderGeometry(0.5, 0.65, 1, 8), material(0xc9ae82));
  pedestal.position.set(spot.x, spot.y + 0.5, spot.z);
  scene.add(pedestal);
  addBox(spot.x, spot.z, { hw: 0.5, hd: 0.5, bottom: spot.y - 0.5, top: spot.y + 1 });
  const orbMaterial = glow(COLORS[echo.up]);
  const orb = mesh(new THREE.OctahedronGeometry(0.55, 1), orbMaterial);
  orb.position.set(spot.x, spot.y + 1.7, spot.z);
  scene.add(orb);
  echo.crystals.push({ x: spot.x, y: spot.y, z: spot.z, orb, orbMaterial, flash: 0 });
}

// spot: the middle of its footprint on the floor; hw, hd: half its size; tall: how high it
// rises; wall: a barrier (a tall collider when up) rather than a step
export function addColourBlock(spot, { color, hw, hd, tall, wall = false }) {
  const m = mesh(new THREE.BoxGeometry(hw * 2, 1, hd * 2), glow(COLORS[color]), {
    receiveShadow: true,
  });
  m.position.set(spot.x, spot.y, spot.z);
  scene.add(m);
  const collider = addBox(spot.x, spot.z, { hw, hd, bottom: spot.y - 1, top: spot.y });
  const block = { color, m, collider, floor: spot.y, tall, wall, height: 0 };
  block.height = color === echo.up ? tall : 0;
  setHeight(block);
  echo.blocks.push(block);
  return block;
}

// the mesh shows `height` (a thin tile when down); the collider follows
function setHeight(block) {
  const shown = Math.max(0.06, block.height);
  block.m.scale.y = shown;
  block.m.position.y = block.floor + shown / 2 - 0.02;
  // a gate is all or nothing (too tall to jump while it's up); a step is as high as it looks
  if (!block.wall) block.collider.top = block.floor + block.height;
  else block.collider.top = block.height > 0.4 ? block.floor + WALL_COLLIDER : -999;
}

export const upColour = () => echo.up;

export function woofCrystals(p) {
  const heard = echo.crystals.some(
    (crystal) => distXZ(p, crystal.x, crystal.z) < HEAR_REACH && Math.abs(p.y - crystal.y) < 4,
  );
  if (!heard) return false;
  setUpColour(echo.up === 'red' ? 'blue' : 'red');
  sfx.crystal();
  for (const crystal of echo.crystals) {
    crystal.flash = 1;
    burst(crystal.orb.position.clone(), {
      count: 12,
      color: [COLORS[echo.up], 0xffffff],
      speed: 3,
      up: 2,
      life: 0.7,
      size: 1,
    });
  }
  return true;
}

function setUpColour(color) {
  echo.up = color;
  for (const crystal of echo.crystals) {
    crystal.orbMaterial.color.set(COLORS[color]);
    crystal.orbMaterial.emissive.set(COLORS[color]);
  }
}

// is Spartacus standing in this gate's way?
const inTheWay = (block) =>
  inFootprint(block.collider, player.pos, RADIUS) && Math.abs(player.pos.y - block.floor) < 2;

export function updateCrystals(dt) {
  const time = game.time;
  for (const crystal of echo.crystals) {
    crystal.orb.rotation.y += dt * 1.2;
    crystal.orb.position.y = crystal.y + 1.7 + Math.sin(time * 2 + crystal.x) * 0.1;
    crystal.flash = Math.max(0, crystal.flash - dt * 2);
    crystal.orbMaterial.emissiveIntensity = 0.45 + crystal.flash;
    crystal.orb.scale.setScalar(1 + crystal.flash * 0.3);
  }
  for (const block of echo.blocks) {
    const target = block.color === echo.up ? block.tall : 0;
    if (target === block.height) continue;
    if (target > 0 && block.wall && inTheWay(block)) continue; // waits for him to step out
    const step = RISE_SPEED * dt;
    block.height = clamp(target, block.height - step, block.height + step);
    setHeight(block);
  }
}

// mid-island saves: which colour is up
export function restoreCrystals(color) {
  if (!COLORS[color]) return;
  setUpColour(color);
  for (const block of echo.blocks) {
    block.height = block.color === color ? block.tall : 0;
    setHeight(block);
  }
}
// a spot just above whatever the crystals have raised there (for hints)
export const crystalSpots = () =>
  echo.crystals.map((crystal) => vec3(crystal.x, crystal.y, crystal.z));
