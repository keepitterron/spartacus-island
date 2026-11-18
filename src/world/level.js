// Islands made in Blender. A level is a .glb file exported from levels/islandN.blend (see
// docs/levels.md): its `ground` mesh becomes the island's terrain, other meshes are scenery
// (optionally with colliders), and empties are markers that turn into game things (palms,
// bones, fruit bushes, dig spots, named spots for the island's own code).
//
//   const level = makeLevel(levelUrl, { center: CENTER_1 });
//   island = { level, height: level.height, build() { level.build(island, { markers }) }, … }
//
// main.js loads every island's level before anything is built, so heights are ready in time.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { vec3 } from '../core/util.js';
import { scene, LOW_POWER } from '../core/renderer.js';
import { material } from '../core/materials.js';
import { toast } from '../core/ui.js';
import { addBox, addCylinder, supportHeight } from '../core/colliders.js';
import { buildGround } from './terrain.js';
import { addStatic } from './statics.js';
import { palm, rock, dock } from './props.js';
import { addPickup } from '../systems/collect.js';
import { addFruit } from '../systems/powers.js';
import { addDig } from '../systems/digs.js';

// grid spacing of the baked terrain heights: half a metre is finer than the ground mesh is drawn
const HEIGHT_CELL = 0.5;
// outside the ground mesh is open sea (deeper than player.js OPEN_SEA, so the current brings him back)
const SEA_FLOOR = -4.2;

export function makeLevel(url, { center, seaFloor = SEA_FLOOR }) {
  const level = {
    url,
    center,
    root: null, // the loaded glTF scene, placed at the island's centre
    heights: null, // the ground baked into a height grid (bakeHeights)
    spots: {}, // `spot:name` markers by name, for the island's own code
    markers: [], // every marker, in file order
    async load() {
      const gltf = await new GLTFLoader().loadAsync(url);
      level.root = gltf.scene;
      level.root.updateMatrixWorld(true);
      level.heights = bakeHeights(groundMeshes(level.root), { cell: HEIGHT_CELL });
    },
    // island-local ground height: the island's height(x, z) for its terrain band
    height: (x, z) => sampleHeights(level.heights, { x: x - center.x, z: z - center.z, seaFloor }),
    build: (island, options) => buildLevel(level, { island, ...options }),
    buildLate: (island) => runMarkers(level, { island, phase: 'late' }),
    // every marker of one kind, e.g. level.all('pickup')
    all: (kind) => level.markers.filter((marker) => marker.kind === kind),
  };
  return level;
}

/* ---------- names and markers ---------- */

// Blender adds .001, .002… to copies, so `palm.014` is just another `palm`.
// `fruit:boing` is kind `fruit` with arg `boing`.
function parseName(object) {
  const name = (object.userData.name ?? object.name).replace(/\.\d+$/, '');
  const [kind, arg = ''] = name.split(':');
  return { kind: kind.trim().toLowerCase(), arg: arg.trim() };
}
const isGround = (object) => object.isMesh && parseName(object).kind === 'ground';
const groundMeshes = (root) => {
  const meshes = [];
  root.traverse((object) => {
    if (isGround(object)) meshes.push(object);
  });
  return meshes;
};
// empties have no geometry; anything with children (a model) isn't a marker
const isMarker = (object) =>
  !object.isMesh && object.type === 'Object3D' && !object.children.length;

// A marker as the handlers see it, in world coordinates (the root is already at the centre):
// {kind, arg, x, y, z, ground, scale:{x, y, z}, yaw, props, handler}
// ground: the surface right under the marker (terrain or the top of a collider), so a bone
// placed a bit above a rock still sits on the rock. props: the object's Blender custom properties.
function readMarker(object) {
  const pos = object.getWorldPosition(vec3());
  const scale = object.getWorldScale(vec3());
  return {
    ...parseName(object),
    x: pos.x,
    y: pos.y,
    z: pos.z,
    ground: pos.y,
    scale: { x: scale.x, y: scale.y, z: scale.z },
    yaw: new THREE.Euler().setFromQuaternion(object.getWorldQuaternion(new THREE.Quaternion())).y,
    props: object.userData,
  };
}
// half a metre of slack, so a marker placed just under a surface still lands on it
const groundUnder = (marker) => supportHeight(marker.x, marker.z, marker.y + 0.5);

/* ---------- building ---------- */

// Colliders first, then markers in three phases, each in file order: `shape` markers that add
// something to stand on (rocks, palms, the dock), then the rest, which can sit on top of those.
// `late` ones wait for buildLate (they must not use rand()).
function buildLevel(level, { island, markers = {} }) {
  const { root, center } = level;
  root.position.set(center.x, 0, center.z);
  root.updateMatrixWorld(true);
  const empties = [];
  root.traverse((object) => {
    if (isGround(object)) prepareGround(object, level);
    else if (object.isMesh) prepareScenery(object);
    else if (isMarker(object)) empties.push(object);
  });
  root.traverse((object) => {
    if (object.userData.collider) addColliderFor(object);
  });
  scene.add(root);
  for (const object of empties) {
    const marker = readMarker(object);
    marker.handler = asHandler(markers[marker.kind] ?? BUILT_IN[marker.kind]);
    level.markers.push(marker);
    if (marker.kind === 'spot') level.spots[marker.arg] = marker;
  }
  runMarkers(level, { island, phase: 'shape' });
  runMarkers(level, { island, phase: 'normal' });
  countPickups(level, island);
  warnUnknown(level);
}

// a handler is a function (phase normal) or {phase, run}
const asHandler = (handler) =>
  typeof handler === 'function' ? { phase: 'normal', run: handler } : handler;

function runMarkers(level, { island, phase }) {
  for (const marker of level.markers) {
    if (marker.handler?.phase !== phase) continue;
    marker.ground = groundUnder(marker);
    marker.handler.run(marker, island);
  }
  // everything built so far is now underneath: spots for the island's code see it too
  for (const marker of level.markers) marker.ground = groundUnder(marker);
}

// The ground is drawn the game's way (painted grass/sand by height, like every other island)
// unless its custom property `look` is "model": then the mesh is shown as modelled.
function prepareGround(object, level) {
  if (object.userData.look === 'model') {
    object.receiveShadow = true;
    return;
  }
  object.visible = false;
  if (level.groundDrawn) return;
  level.groundDrawn = true;
  const { minX, minZ, cols, rows, cell } = level.heights;
  const width = (cols - 1) * cell,
    depth = (rows - 1) * cell,
    size = Math.max(width, depth);
  buildGround(level.center.x + minX + width / 2, level.center.z + minZ + depth / 2, {
    size,
    segments: Math.round(size / (LOW_POWER ? 1.8 : 1.2)),
  });
}

// Scenery keeps its shape; a plain coloured material becomes the game's cached flat-shaded one,
// so Blender models look like the rest of the game. Textured models (asset packs) keep theirs.
// Scenery never moves, so it's merged with the rest of the static scenery (world/statics.js).
function prepareScenery(object) {
  object.castShadow = true;
  object.receiveShadow = true;
  if (object.userData.invisible) object.visible = false;
  const original = object.material;
  if (original?.isMeshStandardMaterial && !original.map)
    object.material = material(original.color.getHex(), {
      ...(original.transparent && { transparent: true, opacity: original.opacity }),
    });
  addStatic(object);
}

// custom property collider = "box" or "cyl": an axis-aligned box, or an upright cylinder,
// around the object's bounds (rotate boxes in 90° steps: colliders don't turn).
// A `radius` property makes the cylinder that wide round the object's origin instead: a tree's
// trunk, not its whole canopy.
function addColliderFor(object) {
  const bounds = new THREE.Box3().setFromObject(object);
  const x = (bounds.min.x + bounds.max.x) / 2,
    z = (bounds.min.z + bounds.max.z) / 2,
    hw = (bounds.max.x - bounds.min.x) / 2,
    hd = (bounds.max.z - bounds.min.z) / 2,
    height = { bottom: bounds.min.y, top: bounds.max.y };
  const { collider, radius } = object.userData;
  if (collider === 'cyl' && radius) {
    const origin = object.getWorldPosition(vec3());
    addCylinder(origin.x, origin.z, { r: radius, ...height });
  } else if (collider === 'cyl') addCylinder(x, z, { r: Math.max(hw, hd), ...height });
  else addBox(x, z, { hw, hd, ...height });
}

// pickups and plain dig spots both hold one of the island's collectibles
function countPickups(level, island) {
  if (!island.collect) return;
  const digsWithBones = level
    .all('dig')
    .filter((marker) => marker.handler?.run === BUILT_IN.dig.run);
  island.collect.total = level.all('pickup').length + digsWithBones.length;
}

function warnUnknown(level) {
  const unknown = new Set(
    level.markers.filter((m) => !m.handler && m.kind !== 'spot').map((m) => m.kind),
  );
  if (unknown.size) console.warn(`[level] ${level.url}: no handler for markers`, [...unknown]);
}

/* ---------- built-in markers ---------- */

// What each marker kind does. An island can add its own kinds, or replace these, with
// level.build(island, { markers: { kind(marker, island) {…} } }). A plain function runs in the
// normal phase; {phase: 'shape' | 'late', run} picks another (see buildLevel).
const BUILT_IN = {
  // where Spartacus arrives
  spawn(marker, island) {
    island.spawn = vec3(marker.x, marker.ground, marker.z);
  },
  // a wooden dock running towards +z (the game's south), `length` custom property (default 11)
  dock: {
    phase: 'shape',
    run(marker) {
      dock(marker.x, { zFrom: marker.z, zTo: marker.z + (marker.props.length ?? 11) });
    },
  },
  palm: { phase: 'shape', run: (marker) => palm(marker.x, marker.z) },
  // scale the empty: its X scale is the radius, its Z scale (up, in Blender) the height
  rock: {
    phase: 'shape',
    run(marker) {
      rock(marker.x, marker.z, {
        radius: marker.scale.x,
        height: marker.scale.y,
        ...(marker.props.color && { color: new THREE.Color(marker.props.color).getHex() }),
      });
    },
  },
  // one of the island's collectibles (bones…); the island needs `collect`
  pickup(marker, island) {
    addPickup(marker.x, marker.z, { y: marker.ground, island: island.id });
  },
  // fruit:boing, fruit:stretch, fruit:grow… a regrowing bush with a name sign
  fruit: {
    phase: 'late',
    run(marker) {
      addFruit(marker.x, marker.z, { type: marker.arg, y: marker.ground, bush: true });
    },
  },
  // a sand mound with a collectible inside; dig:marked adds a red X
  dig: {
    phase: 'late',
    run(marker, island) {
      addDig(marker.x, marker.z, {
        y: marker.ground,
        marked: marker.arg === 'marked',
        holdsPickup: true,
        reward: (spot) => {
          addPickup(spot.x, spot.z, { y: spot.y, island: island.id, pop: 0.6 });
          toast(`A buried ${island.collect.name.toLowerCase()}!`, 1800);
        },
      });
    },
  },
  // beach balls and ambient critters are island data (systems/balls.js, systems/critters.js)
  ball(marker, island) {
    (island.balls ??= []).push(localXZ(marker, island));
  },
  birds: (marker, island) => addCritterSpot('birds', { marker, island }),
  butterflies: (marker, island) => addCritterSpot('butterflies', { marker, island }),
  fish(marker, island) {
    addCritterSpot('fish', { marker, island, extra: [marker.y] });
  },
};

const localXZ = (marker, island) => [marker.x - island.center.x, marker.z - island.center.z];
function addCritterSpot(kind, { marker, island, extra = [] }) {
  island.critters ??= {};
  (island.critters[kind] ??= []).push([...localXZ(marker, island), ...extra]);
}

/* ---------- terrain heights ---------- */

// The ground mesh's top surface sampled on a regular grid (island-local x/z), so height(x, z)
// is a cheap lookup every frame. Each triangle is rasterised onto the grid points under it.
// {minX, minZ, cell, cols, rows, heights: Float32Array} with -Infinity where there's no ground.
function bakeHeights(meshes, { cell }) {
  if (!meshes.length) throw new Error('level has no mesh named "ground"');
  const bounds = new THREE.Box3();
  for (const m of meshes) bounds.expandByObject(m);
  const minX = Math.floor(bounds.min.x),
    minZ = Math.floor(bounds.min.z),
    cols = Math.ceil((bounds.max.x - minX) / cell) + 1,
    rows = Math.ceil((bounds.max.z - minZ) / cell) + 1;
  const grid = { minX, minZ, cell, cols, rows, heights: new Float32Array(cols * rows) };
  grid.heights.fill(-Infinity);
  for (const m of meshes) rasteriseMesh(m, grid);
  return grid;
}

function rasteriseMesh(m, grid) {
  const positions = m.geometry.attributes.position,
    index = m.geometry.index,
    count = index ? index.count : positions.count;
  const corners = [vec3(), vec3(), vec3()];
  for (let i = 0; i < count; i += 3) {
    for (let k = 0; k < 3; k++) {
      const vertex = index ? index.getX(i + k) : i + k;
      corners[k].fromBufferAttribute(positions, vertex).applyMatrix4(m.matrixWorld);
    }
    rasteriseTriangle(corners, grid);
  }
}

// every grid point inside the triangle (seen from above) gets the triangle's height there
function rasteriseTriangle([a, b, c], grid) {
  const { minX, minZ, cell, cols, rows, heights } = grid;
  // twice the triangle's signed area in x/z; ~0 for a wall seen edge-on
  const area = (b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z);
  if (Math.abs(area) < 1e-9) return;
  const fromCol = Math.max(0, Math.ceil((Math.min(a.x, b.x, c.x) - minX) / cell)),
    toCol = Math.min(cols - 1, Math.floor((Math.max(a.x, b.x, c.x) - minX) / cell)),
    fromRow = Math.max(0, Math.ceil((Math.min(a.z, b.z, c.z) - minZ) / cell)),
    toRow = Math.min(rows - 1, Math.floor((Math.max(a.z, b.z, c.z) - minZ) / cell));
  const EDGE = -1e-6; // points exactly on a shared edge belong to both triangles
  for (let row = fromRow; row <= toRow; row++)
    for (let col = fromCol; col <= toCol; col++) {
      const x = minX + col * cell,
        z = minZ + row * cell;
      // barycentric weights of a, b and c at (x, z)
      const wb = ((x - a.x) * (c.z - a.z) - (c.x - a.x) * (z - a.z)) / area,
        wc = ((b.x - a.x) * (z - a.z) - (x - a.x) * (b.z - a.z)) / area,
        wa = 1 - wb - wc;
      if (wa < EDGE || wb < EDGE || wc < EDGE) continue;
      const k = row * cols + col;
      heights[k] = Math.max(heights[k], wa * a.y + wb * b.y + wc * c.y);
    }
}

// bilinear between the four grid points around (x, z); missing ground counts as sea floor
function sampleHeights(grid, { x, z, seaFloor }) {
  if (!grid) return seaFloor;
  const { minX, minZ, cell, cols, rows, heights } = grid;
  const gx = (x - minX) / cell,
    gz = (z - minZ) / cell;
  if (gx < 0 || gz < 0 || gx >= cols - 1 || gz >= rows - 1) return seaFloor;
  const col = Math.floor(gx),
    row = Math.floor(gz),
    tx = gx - col,
    tz = gz - row;
  const at = (c, r) => {
    const h = heights[r * cols + c];
    return h === -Infinity ? seaFloor : h;
  };
  const top = at(col, row) + (at(col + 1, row) - at(col, row)) * tx,
    bottom = at(col, row + 1) + (at(col + 1, row + 1) - at(col, row + 1)) * tx;
  return top + (bottom - top) * tz;
}
