// Crystal on the sky island: the palace's see-through crystal, crystal walls (some of them
// cracked: rolling into one with Smash-Smash bursts it) and the little crystal cubby the fork
// sits in, whose doorway only a Mini-Me dog fits through. Walls are axis-aligned boxes.
import * as THREE from 'three';
import { vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh, canvasTexture } from '../../core/materials.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { toast } from '../../core/ui.js';
import { addBox, inFootprint } from '../../core/colliders.js';
import { player, RADIUS } from '../../player/player.js';
import { addFader } from './fade.js';

// the same options give the same cached material (core/materials.js), so this is shared;
// clear: much more see-through (the fork's cubby, so you can see in and find the door)
export const crystalMaterial = ({ clear = false } = {}) =>
  material(0xcfe3ff, {
    emissive: 0x8fb8ff,
    emissiveIntensity: clear ? 0.15 : 0.25,
    roughness: 0.2,
    transparent: true,
    opacity: clear ? 0.3 : 0.88,
    depthWrite: !clear,
  });

// pale crystal with white zigzag cracks, so a breakable wall is easy to tell apart
let crackedMaterial = null;
function makeCrackedMaterial() {
  const texture = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d9cfff';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    // three cracks spreading out from the middle
    for (const angle of [0.4, 2.4, 4.3]) {
      ctx.beginPath();
      ctx.moveTo(w / 2, h / 2);
      for (let step = 1; step <= 5; step++) {
        const dist = step * 26,
          wobble = step % 2 ? 0.35 : -0.35;
        ctx.lineTo(
          w / 2 + Math.cos(angle + wobble) * dist,
          h / 2 + Math.sin(angle + wobble) * dist,
        );
      }
      ctx.stroke();
    }
  });
  return new THREE.MeshStandardMaterial({
    map: texture,
    emissive: 0x9a88ff,
    emissiveIntensity: 0.2,
    roughness: 0.3,
    transparent: true,
    opacity: 0.92,
  });
}

// every cracked wall: {id, col, m, broken}
const crackedWalls = [];

// a crystal wall box centred on (x, z) from height y up; cracked ones need an id (saves).
// Its collider reaches a little below y (so nothing slips under), unless it hangs in the air:
// hanging: true for lintels and roofs, whose bottom has to be exactly at y
// clear: see crystalMaterial; fades: goes see-through while it's in the camera's way (fade.js)
export function addCrystalWall(
  x,
  z,
  { hw, hd, y, height, cracked = false, id, hanging = false, clear = false, fades = false },
) {
  crackedMaterial ??= makeCrackedMaterial();
  let mat = cracked ? crackedMaterial : crystalMaterial({ clear });
  if (fades) mat = mat.clone(); // its own, so it fades alone
  const m = mesh(new THREE.BoxGeometry(hw * 2, height, hd * 2), mat);
  m.position.set(x, y + height / 2, z);
  scene.add(m);
  const col = addBox(x, z, { hw, hd, bottom: hanging ? y : y - 0.5, top: y + height });
  if (fades) addFader([col], [mat]);
  if (cracked) crackedWalls.push({ id, col, m, broken: false });
  return col;
}

// every frame: rolling (Smash-Smash) into a cracked wall bursts it; returns the wall broken
const SMASH_REACH = RADIUS + 0.3; // collisions keep him just outside the wall, so reach past it
export function smashWalls(pos) {
  if (!player.rolling) return null;
  for (const wall of crackedWalls) {
    const { col } = wall;
    const touching =
      !wall.broken &&
      inFootprint(col, pos, SMASH_REACH) &&
      pos.y < col.top &&
      pos.y + 1 > col.bottom;
    if (!touching) continue;
    breakWall(wall);
    return wall;
  }
  return null;
}

// quiet: a save being put back
function breakWall(wall, { quiet = false } = {}) {
  wall.broken = true;
  wall.col.top = -999;
  wall.m.visible = false;
  if (quiet) return;
  sfx.thunk();
  player.squashVel = -5;
  burst(wall.m.position.clone(), {
    count: 40,
    color: [0xd9cfff, 0xcfe3ff, 0xffffff, 0xffd84d],
    speed: 7,
    up: 4,
    life: 1.2,
    size: 1.4,
  });
  toast('SMASH! 💥', 1800);
}

// a cracked wall Spartacus is right next to (for hints), or null
export function crackedWallNear(pos, reach) {
  return crackedWalls.find((wall) => !wall.broken && inFootprint(wall.col, pos, reach)) ?? null;
}

export const brokenWallIds = () => crackedWalls.filter((w) => w.broken).map((w) => w.id);
export function restoreBrokenWalls(ids = []) {
  for (const wall of crackedWalls) if (ids.includes(wall.id)) breakWall(wall, { quiet: true });
}

// A little crystal hut at height y with its doorway facing +x: three walls, a roof, and a
// lintel over the door lower than a full-size Spartacus (like the cloud walls' holes). It's
// 3 deep, so something at the back is out of reach from outside the door.
const CUBBY = { hw: 1.5, hd: 1.2, height: 1.8, door: 0.75, doorHeight: 0.8, wall: 0.15 };
export function addCubby(x, z, { y }) {
  const { hw, hd, height, door, doorHeight, wall } = CUBBY,
    clear = true;
  addCrystalWall(x - hw, z, { hw: wall, hd, y, height, clear }); // back
  for (const side of [-1, 1]) {
    addCrystalWall(x, z + side * hd, { hw, hd: wall, y, height, clear }); // sides
    // the front, either side of the doorway
    const pillarWidth = (hd - door) / 2;
    addCrystalWall(x + hw, z + side * (door + pillarWidth), {
      hw: wall,
      hd: pillarWidth,
      y,
      height,
      clear,
    });
  }
  addCrystalWall(x + hw, z, {
    hw: wall,
    hd: door,
    y: y + doorHeight,
    height: height - doorHeight,
    hanging: true,
    clear,
  });
  addCrystalWall(x, z, {
    hw: hw + wall,
    hd: hd + wall,
    y: y + height,
    height: 0.15,
    hanging: true,
    clear,
  }); // roof
  // door: the middle of the doorway, facing out along +x (yaw π/2 for its arch)
  return {
    back: vec3(x - hw + 0.6, y, z),
    door: vec3(x + hw, y, z),
    doorYaw: Math.PI / 2,
    doorRadius: door,
  };
}
