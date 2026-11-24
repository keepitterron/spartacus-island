// Stone blocks Spartacus pushes along a grid, one square at a time (the Garden Court). Walk into
// a block and keep pushing for a moment: it slides one square that way, if the square is free
// (inside the field, no planter, no other block). A block pushed into a corner can't come back
// out, so leaving the room slides every block home again (`resetBlocks`).
//
//   addBlock(start, { field })   start: {x, y, z} on a square; field: {cell, x0, x1, z0, z1,
//                                blocked: [[x, z], …]} (square centres the blocks may use)
//   updateBlocks(dt)  blockOn(spot)  resetBlocks()
import * as THREE from 'three';
import { clamp, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { canvasTexture, mesh } from '../../core/materials.js';
import { followCam } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { moveAxis } from '../../core/input.js';
import { addBox } from '../../core/colliders.js';
import { player, RADIUS } from '../../player/player.js';

const SIZE = 1.9; // m: a block nearly fills its 2 m square
const TALL = 1.4; // low enough to jump onto
const PUSH_TIME = 0.3; // s of pushing before it moves
const SLIDE_TIME = 0.4; // s to slide one square

// {m, collider, home, cell: {x, z}, from, to, t (slide progress, -1 when still), field, push}
const blocks = [];

const stoneLook = () =>
  canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#b8a58a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#8f7d64';
    ctx.lineWidth = 5;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = '#f2b84b';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 9, 0, 7);
    ctx.fill();
  });

export function addBlock(start, { field }) {
  const m = mesh(
    new THREE.BoxGeometry(SIZE, TALL, SIZE),
    new THREE.MeshStandardMaterial({ map: stoneLook(), roughness: 0.95 }),
    { receiveShadow: true },
  );
  m.position.set(start.x, start.y + TALL / 2, start.z);
  scene.add(m);
  const collider = addBox(start.x, start.z, {
    hw: SIZE / 2,
    hd: SIZE / 2,
    bottom: start.y - 0.5,
    top: start.y + TALL,
  });
  const block = {
    m,
    collider,
    y: start.y,
    home: { x: start.x, z: start.z },
    cell: { x: start.x, z: start.z },
    from: null,
    to: null,
    t: -1,
    field,
    push: 0,
  };
  blocks.push(block);
  return block;
}

// is a block sitting on this spot (a plate)?
export const blockOn = (spot) =>
  blocks.some(
    (block) => block.t < 0 && Math.hypot(block.cell.x - spot.x, block.cell.z - spot.z) < 0.5,
  );

export const blocksHome = () =>
  blocks.every((block) => block.cell.x === block.home.x && block.cell.z === block.home.z);

// every block back on its starting square, with a puff
export function resetBlocks() {
  for (const block of blocks) {
    block.t = -1;
    moveTo(block, block.home);
    burst(block.m.position.clone(), {
      count: 14,
      color: [0xffffff, 0xe0c9a0],
      speed: 3,
      up: 2,
      life: 0.7,
      size: 1.2,
    });
  }
  sfx.pop();
}

function moveTo(block, { x, z }) {
  block.cell = { x, z };
  block.m.position.set(x, block.y + TALL / 2, z);
  block.collider.x = x;
  block.collider.z = z;
}

// the way the stick points, on the ground (like the player's own movement)
function stickDirection() {
  const { f, r } = moveAxis();
  const x = -Math.sin(followCam.yaw) * f + Math.cos(followCam.yaw) * r,
    z = -Math.cos(followCam.yaw) * f - Math.sin(followCam.yaw) * r;
  const amount = Math.hypot(x, z);
  return amount < 0.5 ? null : { x: x / amount, z: z / amount };
}

// which way Spartacus is pushing this block ({x, z} one axis), or null
function pushDirection(block, stick) {
  const p = player.pos,
    dx = block.cell.x - p.x,
    dz = block.cell.z - p.z,
    touching = SIZE / 2 + RADIUS + 0.25;
  if (!player.grounded || Math.abs(p.y - block.y) > 0.4) return null;
  if (Math.abs(dx) > Math.abs(dz)) {
    if (Math.abs(dx) > touching || Math.abs(dz) > SIZE * 0.4) return null;
    const x = Math.sign(dx);
    return stick.x * x > 0.75 ? { x, z: 0 } : null;
  }
  if (Math.abs(dz) > touching || Math.abs(dx) > SIZE * 0.4) return null;
  const z = Math.sign(dz);
  return stick.z * z > 0.75 ? { x: 0, z } : null;
}

function isFree(block, { x, z }) {
  const { field } = block;
  const inside =
    x >= field.x0 - 0.01 && x <= field.x1 + 0.01 && z >= field.z0 - 0.01 && z <= field.z1 + 0.01;
  if (!inside) return false;
  if (field.blocked.some(([bx, bz]) => Math.hypot(bx - x, bz - z) < 0.5)) return false;
  return !blocks.some(
    (other) => other !== block && Math.hypot(other.cell.x - x, other.cell.z - z) < 0.5,
  );
}

export function updateBlocks(dt) {
  const stick = stickDirection();
  for (const block of blocks) {
    if (block.t >= 0) {
      slide(block, dt);
      continue;
    }
    const way = stick && pushDirection(block, stick);
    block.push = way ? block.push + dt : 0;
    if (block.push < PUSH_TIME) continue;
    block.push = 0;
    const to = {
      x: block.cell.x + way.x * block.field.cell,
      z: block.cell.z + way.z * block.field.cell,
    };
    if (!isFree(block, to)) {
      sfx.bonk();
      continue;
    }
    block.from = { ...block.cell };
    block.to = to;
    block.cell = to; // the square is taken from the start, so nothing else moves into it
    block.t = 0;
    sfx.scrape();
  }
}

function slide(block, dt) {
  block.t += dt;
  const t = clamp(block.t / SLIDE_TIME, 0, 1),
    eased = t * t * (3 - 2 * t);
  const x = block.from.x + (block.to.x - block.from.x) * eased,
    z = block.from.z + (block.to.z - block.from.z) * eased;
  block.m.position.set(x, block.y + TALL / 2, z);
  block.collider.x = x;
  block.collider.z = z;
  if (Math.random() < dt * 20)
    burst(vec3(x, block.y + 0.1, z), {
      count: 2,
      color: 0xe0c9a0,
      speed: 1.5,
      up: 1,
      life: 0.5,
      size: 0.9,
    });
  if (t === 1) block.t = -1;
}

// mid-island saves: where each block is
export const blockCells = () => blocks.map((block) => [block.cell.x, block.cell.z]);
export function restoreBlocks(cells = []) {
  cells.forEach(([x, z], i) => blocks[i] && moveTo(blocks[i], { x, z }));
}
