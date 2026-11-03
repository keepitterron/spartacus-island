// The sky island's clouds: platforms to float between, the sea of clouds below, and the
// checkpoints. There's no ground: each cloud is a cylinder collider with a flat top, drawn as
// instanced cushions and puffs (a few draw calls for every cloud on the island, see island6.md).
// The clouds you can land on are sunlit white; the cloud sea below is a shady lilac blue, so
// it's easy to see where to land.
// Falling into the cloud sea is a quick poof back onto the last cloud Spartacus stood on.
import * as THREE from 'three';
import { seededRandom, vec3 } from '../../core/util.js';
import { scene, LOW_POWER } from '../../core/renderer.js';
import { material } from '../../core/materials.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { hintOnce } from '../../core/ui.js';
import { addBox, addCylinder, inFootprint, supportHeight } from '../../core/colliders.js';
import { player } from '../../player/player.js';

// the top of the cloud sea; anything that sinks into it pops back up
export const CLOUD_SEA_Y = -6;
const SINK_TIME = 0.6; // seconds in the cloud sea before popping back up
// its own random sequence, so the clouds never move the scenery that uses the shared rand()
const cloudRand = seededRandom(606);

// every platform (its collider: {type:'cyl', x, z, r, bottom, top}); instances: transforms
// waiting for the instanced meshes
const clouds = [];
const instances = { cushions: [], puffs: [], seaPuffs: [], bushPuffs: [] };
// the last cloud stood on and the spot on it ({x, z}) a fall puts him back on, and seconds
// left sinking (-1 while not sinking)
const checkpoint = { cloud: null, spot: null, sinking: -1 };

// a cloud to stand on: a flat cushion with top at `top`, a puffy rim and a few puffs underneath
export function addCloud(x, z, { r, top }) {
  const cloud = addCylinder(x, z, { r, bottom: top - 1.4, top });
  clouds.push(cloud);
  instances.cushions.push(transform({ x, y: top - 0.6, z }, { scale: vec3(r, 1.2, r) }));
  const rimPuffs = Math.round(r * 2.2);
  for (let i = 0; i < rimPuffs; i++) {
    const angle = (i / rimPuffs) * Math.PI * 2 + cloudRand(),
      size = 0.6 + cloudRand() * 0.5;
    addPuff(x + Math.cos(angle) * r * 0.9, z + Math.sin(angle) * r * 0.9, {
      y: top - 0.5,
      size,
    });
  }
  // a lumpy belly hanging underneath (its puffs stay below the cushion's flat top)
  for (let i = 0; i < Math.ceil(r / 2); i++) {
    const size = r * 0.45;
    addPuff(x + (cloudRand() - 0.5) * r, z + (cloudRand() - 0.5) * r, {
      y: top - 0.9 - size * 0.75,
      size,
    });
  }
  return cloud;
}

// a puff on a platform, or (with list: instances.seaPuffs) on the cloud sea
function addPuff(x, z, { y, size, list = instances.puffs }) {
  list.push(
    transform({ x, y, z }, { scale: vec3(size, size * 0.75, size), yaw: cloudRand() * 6.28 }),
  );
}

// Tickle Tunnels: a tall wall of cloud standing on a cloud, centred on (x, z) and `length`
// long along `axis` ('x' or 'z'), with a little hole at its foot (gapAt: offset from the
// middle). The lintel over the hole is lower than a full-size Spartacus is tall (BODY_HEIGHT
// in player.js), so only a Mini-Me dog fits under it; the wall is too tall to float over.
const WALL_HEIGHT = 8,
  HOLE_WIDTH = 1.3,
  HOLE_HEIGHT = 0.8;
export function addCloudWall(x, z, { top, axis, length, gapAt = 0 }) {
  const alongX = axis === 'x',
    at = (d) => (alongX ? { x: x + d, z } : { x, z: z + d });
  const addSegment = (from, to, bottom) => {
    const mid = at((from + to) / 2),
      half = (to - from) / 2;
    addBox(mid.x, mid.z, {
      hw: alongX ? half : 0.5,
      hd: alongX ? 0.5 : half,
      bottom,
      top: top + WALL_HEIGHT,
    });
  };
  const holeFrom = gapAt - HOLE_WIDTH / 2,
    holeTo = gapAt + HOLE_WIDTH / 2;
  addSegment(-length / 2, holeFrom, top - 1);
  addSegment(holeTo, length / 2, top - 1);
  addSegment(holeFrom, holeTo, top + HOLE_HEIGHT); // the lintel
  for (let d = -length / 2 + 0.5; d <= length / 2 - 0.5; d += 1)
    for (let h = 0.45; h < WALL_HEIGHT; h += 1) {
      const size = 0.6 + cloudRand() * 0.2;
      // leave the hole open: skip puffs that would poke into it
      if (Math.abs(d - gapAt) - size < HOLE_WIDTH / 2 && h - size * 0.75 < HOLE_HEIGHT) continue;
      const pos = at(d);
      addPuff(pos.x, pos.z, { y: top + h, size });
    }
}
// a puffy pink cloud bush on a cloud at height top, tall enough to hide Spartacus from Leo;
// returns {x, z, r, top} for the magpie's sight check
const BUSH = { r: 1.3, height: 2.2 };
export function addCloudBush(x, z, { top }) {
  addCylinder(x, z, { r: BUSH.r, bottom: top, top: top + BUSH.height });
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2,
      size = 0.75 + cloudRand() * 0.25,
      out = i < 4 ? 0.65 : 0; // four round the edge, one on top
    addPuff(x + Math.cos(angle) * out, z + Math.sin(angle) * out, {
      y: top + (i < 4 ? 0.8 : 1.5),
      size,
      list: instances.bushPuffs,
    });
  }
  return { x, z, r: BUSH.r, top: top + BUSH.height };
}

const transform = (pos, { scale, yaw = 0 }) =>
  new THREE.Matrix4().compose(
    vec3(pos.x, pos.y, pos.z),
    new THREE.Quaternion().setFromAxisAngle(vec3(0, 1, 0), yaw),
    scale,
  );

const SEA_COLOR = 0xa3b4e6;
// the sea of clouds around (cx, cz): a flat floor with big puffs heaped on it
export function buildCloudSea(cx, cz) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), material(SEA_COLOR));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, CLOUD_SEA_Y - 0.6, cz);
  scene.add(floor);
  for (let i = 0; i < 90; i++) {
    const angle = cloudRand() * Math.PI * 2,
      dist = 6 + Math.sqrt(cloudRand()) * 150,
      size = 3 + cloudRand() * 6;
    addPuff(cx + Math.cos(angle) * dist, cz + Math.sin(angle) * dist, {
      y: CLOUD_SEA_Y - size * 0.35,
      size,
      list: instances.seaPuffs,
    });
  }
}

// once every cloud is added: one instanced mesh each for the cushions, the platforms' puffs,
// the cloud sea's puffs and the pink hiding bushes
export function finishClouds() {
  // a warm glow of their own, as if the sun is on them
  const sunlit = material(0xffffff, { emissive: 0xfff1dc, emissiveIntensity: 0.3 });
  const puff = new THREE.IcosahedronGeometry(1, 1);
  addInstanced(new THREE.CylinderGeometry(1, 0.8, 1, 14), {
    mat: sunlit,
    matrices: instances.cushions,
  });
  addInstanced(puff, { mat: sunlit, matrices: instances.puffs });
  addInstanced(puff, { mat: material(SEA_COLOR), matrices: instances.seaPuffs });
  addInstanced(puff, {
    mat: material(0xffc2e2, { emissive: 0xffd6ec, emissiveIntensity: 0.2 }),
    matrices: instances.bushPuffs,
  });
}

function addInstanced(geometry, { mat, matrices }) {
  const m = new THREE.InstancedMesh(geometry, mat, matrices.length);
  matrices.forEach((matrix, i) => m.setMatrixAt(i, matrix));
  m.instanceMatrix.needsUpdate = true;
  m.computeBoundingSphere();
  m.castShadow = false; // only Spartacus, Lina and Leo cast shadows up here
  m.receiveShadow = !LOW_POWER;
  scene.add(m);
}

// the cloud Spartacus is standing on, if any
const cloudUnder = (pos) =>
  clouds.find((cloud) => inFootprint(cloud, pos) && Math.abs(pos.y - cloud.top) < 0.1);

// where a fall puts him back (the middle of this cloud, until he stands somewhere on it)
export function setCheckpoint(cloud) {
  checkpoint.cloud = cloud;
  checkpoint.spot = { x: cloud.x, z: cloud.z };
  checkpoint.sinking = -1;
}

// remember where he stood, moved in from the edge (straight towards the middle, so a wall
// across the cloud never ends up between him and the spot)
const EDGE_MARGIN = 1.2;
function rememberSpot(cloud, pos) {
  const dx = pos.x - cloud.x,
    dz = pos.z - cloud.z,
    dist = Math.hypot(dx, dz),
    maxDist = Math.max(0, cloud.r - EDGE_MARGIN),
    k = dist > maxDist ? maxDist / dist : 1;
  checkpoint.cloud = cloud;
  checkpoint.spot = { x: cloud.x + dx * k, z: cloud.z + dz * k };
}

// every frame: remember the spot he's on; falling with no cloud below, or into the cloud
// sea, sinks him in with a poof and pops him back onto that cloud a moment later
export function updateCheckpoint(dt) {
  const pos = player.pos;
  if (player.grounded) {
    const cloud = cloudUnder(pos);
    if (cloud) rememberSpot(cloud, pos);
  }
  if (checkpoint.sinking >= 0) {
    sink(dt);
    return;
  }
  const nothingBelow = supportHeight(pos.x, pos.z, pos.y) < CLOUD_SEA_Y;
  if (pos.y < CLOUD_SEA_Y || (nothingBelow && pos.y < checkpoint.cloud.top - 8)) startSinking();
}

function startSinking() {
  checkpoint.sinking = SINK_TIME;
  sfx.pop();
  burst(player.pos.clone(), {
    count: 18,
    color: [0xffffff, 0xf4f8ff, 0xdfe9ff],
    speed: 4,
    up: 3,
    life: 0.8,
    size: 1.4,
  });
}

// slowly down into the clouds, then pop up on the checkpoint
function sink(dt) {
  player.vel.set(0, -2, 0);
  checkpoint.sinking -= dt;
  if (checkpoint.sinking > 0) return;
  checkpoint.sinking = -1;
  const { x, z } = checkpoint.spot;
  player.pos.set(x, checkpoint.cloud.top + 0.05, z);
  player.vel.set(0, 0, 0);
  player.squashVel = 5;
  sfx.boing();
  burst(player.pos.clone().add(vec3(0, 0.3, 0)), {
    count: 14,
    color: [0xffffff, 0xf3ecff, 0xffd84d],
    speed: 3,
    up: 3,
    life: 0.7,
    size: 1,
  });
  hintOnce('cloudSea', 'Poof! Back on the last cloud.', 2600);
}
