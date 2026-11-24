// Sunbeams and mirrors (the Mirror Hall and the Sun Chamber). A beam of sunlight comes in through
// a gap in the wall and runs straight along the floor until it meets something: a mirror turns it
// a quarter turn, a target lights up, anything else (a wall, a stone shutter) stops it. Mirrors
// stand on pedestals and face one of two ways; Turn swaps them. Beams only run along x or z and
// mirrors stand on those lines, so the maths stays plain: no angles, just swapped directions.
//
//   const room = addBeamRoom({ source: {x, y, z}, dir: {x, z}, bounds: {x0, x1, z0, z1} })
//   room.addMirror(spot, { face: 'a' | 'b' })   room.addTarget(spot, { radius, onLit })
//   room.addBlocker(() => rect or null)          mirrorAction(p)   updateBeams(dt)
import * as THREE from 'three';
import { distXZ, lerpAngle, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mergeParts, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { addBox } from '../../core/colliders.js';

const BEAM_HEIGHT = 1.3; // m above the floor: the middle of a mirror
const MIRROR_HIT = 0.4; // m either side of a beam line that still hits a mirror
const MAX_BOUNCES = 12;
const TURN_REACH = 2.2;

// a mirror's face swaps a direction: 'a' is / seen from above (x east, z south), 'b' is \
const REFLECT = {
  a: ({ x, z }) => ({ x: -z, z: -x }),
  b: ({ x, z }) => ({ x: z, z: x }),
};
const FACE_YAW = { a: Math.PI / 4, b: -Math.PI / 4 };

const rooms = [];
const beamMaterials = {
  core: new THREE.MeshBasicMaterial({ color: 0xfff3a8 }),
  glow: new THREE.MeshBasicMaterial({
    color: 0xffc83d,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
};
const unitBox = new THREE.BoxGeometry(1, 1, 1);

export function addBeamRoom({ source, dir, bounds }) {
  const room = {
    source: vec3(source.x, source.y + BEAM_HEIGHT, source.z),
    dir,
    bounds,
    mirrors: [],
    targets: [],
    blockers: [],
    segments: [], // [{core, glow}] meshes, reused
    lastKey: '',
    addMirror: (spot, options) => addMirror(room, spot, options),
    addTarget(spot, { radius = 1, onLit }) {
      const target = { x: spot.x, z: spot.z, radius, onLit, lit: false, everLit: false };
      room.targets.push(target);
      return target;
    },
    // a function returning {x0, x1, z0, z1} while it's in the way, or null
    addBlocker(rect) {
      room.blockers.push(rect);
    },
  };
  rooms.push(room);
  return room;
}

function addMirror(room, spot, { face = 'a' }) {
  const g = new THREE.Group();
  g.position.set(spot.x, spot.y, spot.z);
  scene.add(g);
  const pedestal = mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.75, 8), material(0xc9ae82));
  pedestal.position.y = 0.37;
  g.add(pedestal);
  const turner = new THREE.Group();
  turner.position.y = BEAM_HEIGHT;
  g.add(turner);
  const frame = mesh(new THREE.BoxGeometry(1.5, 1.2, 0.16), material(0xf2b84b, { metalness: 0.4 }));
  turner.add(frame);
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0xdff6ff,
    emissive: 0xbfe9ff,
    emissiveIntensity: 0.2,
    metalness: 0.6,
    roughness: 0.1,
  });
  for (const side of [-1, 1]) {
    const glass = mesh(new THREE.BoxGeometry(1.3, 1, 0.04), glassMaterial, { castShadow: false });
    glass.position.z = side * 0.09;
    turner.add(glass);
  }
  turner.rotation.y = FACE_YAW[face];
  mergeParts(turner);
  addBox(spot.x, spot.z, { hw: 0.55, hd: 0.55, bottom: spot.y - 0.5, top: spot.y + 2 });
  const mirror = { x: spot.x, y: spot.y, z: spot.z, face, turner, glassMaterial, hit: 0, room };
  room.mirrors.push(mirror);
  return mirror;
}

/* tracing */

// how far along dir (from `from`) the beam meets this axis-aligned rectangle, or Infinity
function hitRect(from, dir, { x0, x1, z0, z1 }) {
  if (dir.x !== 0) {
    if (from.z < z0 || from.z > z1) return Infinity;
    const edge = dir.x > 0 ? x0 : x1,
      along = (edge - from.x) * dir.x;
    return along > 0.01 ? along : Infinity;
  }
  if (from.x < x0 || from.x > x1) return Infinity;
  const edge = dir.z > 0 ? z0 : z1,
    along = (edge - from.z) * dir.z;
  return along > 0.01 ? along : Infinity;
}

// how far to the room's walls
function toBounds(from, dir, { x0, x1, z0, z1 }) {
  if (dir.x > 0) return x1 - from.x;
  if (dir.x < 0) return from.x - x0;
  if (dir.z > 0) return z1 - from.z;
  return from.z - z0;
}

// along: how far ahead a point is; off: how far beside the beam line
function aheadOf(from, dir, point) {
  const dx = point.x - from.x,
    dz = point.z - from.z;
  return { along: dx * dir.x + dz * dir.z, off: Math.abs(dx * dir.z - dz * dir.x) };
}

// the beam's path as a list of points; marks what it hits
function trace(room) {
  const points = [room.source.clone()];
  let from = room.source.clone(),
    dir = room.dir,
    leaving = null;
  for (const target of room.targets) target.lit = false;
  for (let bounce = 0; bounce < MAX_BOUNCES; bounce++) {
    let nearest = toBounds(from, dir, room.bounds),
      hit = null;
    for (const mirror of room.mirrors) {
      if (mirror === leaving) continue;
      const { along, off } = aheadOf(from, dir, mirror);
      if (along > 0.01 && off < MIRROR_HIT && along < nearest) {
        nearest = along;
        hit = { mirror };
      }
    }
    for (const target of room.targets) {
      const { along, off } = aheadOf(from, dir, target);
      if (along > 0 && off < target.radius && along - target.radius * 0.5 < nearest) {
        nearest = Math.max(0.01, along - target.radius * 0.5);
        hit = { target };
      }
    }
    for (const blocker of room.blockers) {
      const rect = blocker();
      const along = rect ? hitRect(from, dir, rect) : Infinity;
      if (along < nearest) {
        nearest = along;
        hit = null;
      }
    }
    const end = from.clone().add(vec3(dir.x * nearest, 0, dir.z * nearest));
    if (hit?.mirror) end.set(hit.mirror.x, from.y, hit.mirror.z);
    points.push(end);
    if (hit?.target) hit.target.lit = true;
    if (!hit?.mirror) break;
    hit.mirror.hit = 1;
    leaving = hit.mirror;
    dir = REFLECT[hit.mirror.face](dir);
    from = end;
  }
  return points;
}

// lay the beam meshes along the path (made the first time they're needed, reused after)
function drawBeam(room, points) {
  for (let i = 0; i < Math.max(room.segments.length, points.length - 1); i++) {
    if (i >= points.length - 1) {
      room.segments[i].core.visible = room.segments[i].glow.visible = false;
      continue;
    }
    room.segments[i] ??= {
      core: addBeamMesh(beamMaterials.core),
      glow: addBeamMesh(beamMaterials.glow),
    };
    const a = points[i],
      b = points[i + 1],
      length = a.distanceTo(b),
      yaw = Math.atan2(b.x - a.x, b.z - a.z);
    for (const [part, width] of [
      ['core', 0.14],
      ['glow', 0.5],
    ]) {
      const m = room.segments[i][part];
      m.visible = true;
      m.position.lerpVectors(a, b, 0.5);
      m.rotation.y = yaw;
      m.scale.set(width, width, length + width);
    }
  }
}
function addBeamMesh(beamMaterial) {
  const m = new THREE.Mesh(unitBox, beamMaterial);
  m.userData.alwaysDrawn = true; // world/detail.js: a long thin beam is still worth drawing
  scene.add(m);
  return m;
}

/* turning */

export function mirrorAction(p) {
  for (const room of rooms)
    for (const mirror of room.mirrors)
      if (distXZ(p, mirror.x, mirror.z) < TURN_REACH && Math.abs(p.y - mirror.y) < 1.5)
        return { label: 'Turn', run: () => turnMirror(mirror) };
  return null;
}

function turnMirror(mirror) {
  mirror.face = mirror.face === 'a' ? 'b' : 'a';
  sfx.creak();
  burst(vec3(mirror.x, mirror.y + BEAM_HEIGHT, mirror.z), {
    count: 8,
    color: [0xdff6ff, 0xffffff],
    speed: 2,
    up: 1,
    life: 0.5,
    size: 0.8,
  });
}

/* every frame */

export function updateBeams(dt) {
  for (const room of rooms) {
    const points = trace(room);
    const key = points.map((point) => `${point.x.toFixed(1)},${point.z.toFixed(1)}`).join(' ');
    if (key !== room.lastKey) {
      room.lastKey = key;
      drawBeam(room, points);
    }
    for (const target of room.targets) {
      if (!target.lit || target.everLit) continue;
      target.everLit = true;
      target.onLit?.();
    }
    for (const mirror of room.mirrors) {
      mirror.turner.rotation.y = lerpAngle(
        mirror.turner.rotation.y,
        FACE_YAW[mirror.face],
        Math.min(1, dt * 10),
      );
      mirror.glassMaterial.emissiveIntensity =
        0.2 + mirror.hit * (0.5 + Math.sin(game.time * 8) * 0.1);
      mirror.hit = 0; // set again by the next trace while the beam still hits it
    }
  }
}

/* mid-island saves: which way every mirror faces */
export const mirrorFaces = () => rooms.flatMap((room) => room.mirrors.map((mirror) => mirror.face));
export function restoreMirrors(faces = []) {
  let i = 0;
  for (const room of rooms)
    for (const mirror of room.mirrors) {
      if (faces[i] === 'a' || faces[i] === 'b') mirror.face = faces[i];
      mirror.turner.rotation.y = FACE_YAW[mirror.face];
      i += 1;
    }
}
