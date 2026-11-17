// Named places on an island, so a big island is easy to find your way round: wooden signs with
// the names (one can carry arrows pointing to the others), and the first time Spartacus walks
// into a place its name comes up as a title card. Islands add them in build() and call
// visitPlaces(p) from interact(); mid-island saves keep which ones he has seen.
import * as THREE from 'three';
import { distXZ } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { canvasTexture, material, mesh } from '../core/materials.js';
import { game, ownerIsland, currentIsland } from '../core/state.js';
import { onFontsReady } from '../core/fx.js';
import { showTitleCard } from '../core/ui.js';
import { addCylinder } from '../core/colliders.js';
import { terrainHeight } from '../world/terrain.js';

const WOOD = 0xc48a54;
const POST = 0x7a4a2a;
const INK = '#4a2e1a';

// {name, x, z, radius, island, seen}
const places = [];

export function addPlace(name, { x, z, radius }) {
  places.push({ name, x, z, radius, island: ownerIsland(), seen: false });
}

// the first time he's inside a place, its name comes up (not while a save is being put back)
export function visitPlaces(p) {
  if (game.restoring) return;
  for (const place of places) {
    if (place.seen || place.island !== game.island) continue;
    if (distXZ(p, place.x, place.z) > place.radius) continue;
    place.seen = true;
    showTitleCard(currentIsland().name, place.name);
    return;
  }
}

/* mid-island saves (game/progress.js): the island saves these in its saveState() */
export const seenPlaces = (island) =>
  places.filter((place) => place.island === island && place.seen).map((place) => place.name);
export function restorePlaces(island, names = []) {
  for (const place of places)
    if (place.island === island && names.includes(place.name)) place.seen = true;
}

// a wooden board with `text` painted on both sides (drawn once the font has loaded);
// returns the board, centred on its middle, its face looking along +z
function makeBoard(text, { width = 1.7, height = 0.5 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(width, height, 0.08), material(WOOD)));
  addLettering(g, text, { width: width - 0.12, height: height - 0.1, depth: 0.08 });
  return g;
}

// an arrow-shaped board pointing along +x, its text on both sides
function makeArrow(text, { length = 1.9, height = 0.4 } = {}) {
  const g = new THREE.Group();
  const back = -length / 2,
    shoulder = length / 2 - height * 0.6,
    half = height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(back, -half);
  shape.lineTo(shoulder, -half);
  shape.lineTo(length / 2, 0);
  shape.lineTo(shoulder, half);
  shape.lineTo(back, half);
  shape.closePath();
  const board = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: false });
  board.translate(0, 0, -0.035);
  g.add(mesh(board, material(WOOD)));
  const lettering = new THREE.Group();
  lettering.position.x = (back + shoulder) / 2;
  addLettering(lettering, text, {
    width: shoulder - back - 0.1,
    height: height - 0.08,
    depth: 0.07,
  });
  g.add(lettering);
  return g;
}

// the painted text: one plane each side, both readable
function addLettering(g, text, { width, height, depth }) {
  const paint = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
  for (const side of [1, -1]) {
    const plane = mesh(new THREE.PlaneGeometry(width, height), paint, {
      castShadow: false,
      receiveShadow: false,
    });
    plane.position.z = side * (depth / 2 + 0.005);
    if (side < 0) plane.rotation.y = Math.PI;
    g.add(plane);
  }
  onFontsReady(() => {
    paint.map = canvasTexture(512, Math.round((512 * height) / width), (ctx, w, h) =>
      drawLettering(ctx, { text, w, h }),
    );
    paint.opacity = 1;
    paint.needsUpdate = true;
  });
}
function drawLettering(ctx, { text, w, h }) {
  let size = h * 0.72;
  const font = () => `700 ${size}px Fredoka, ui-rounded, system-ui, sans-serif`;
  ctx.font = font();
  while (ctx.measureText(text).width > w * 0.94 && size > 10) {
    size -= 2;
    ctx.font = font();
  }
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + size * 0.05);
}

// A signpost on the ground at (x, z): a name board on top, facing `faceTo` {x, z}, and optional
// arrows below it, each pointing towards its place: [{text, to: {x, z}}].
export function addSignpost(x, z, { name, faceTo, arrows = [] }) {
  const y = terrainHeight(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  scene.add(g);
  const tall = 1.5 + arrows.length * 0.45;
  const post = mesh(new THREE.CylinderGeometry(0.08, 0.09, tall + 0.3, 6), material(POST));
  post.position.y = (tall + 0.3) / 2 - 0.15;
  g.add(post);
  const board = makeBoard(name);
  board.position.y = tall;
  board.rotation.y = Math.atan2(faceTo.x - x, faceTo.z - z);
  g.add(board);
  arrows.forEach(({ text, to }, i) => {
    const arrow = makeArrow(text);
    // its +x (the tip) turned towards the place
    arrow.rotation.y = Math.atan2(-(to.z - z), to.x - x);
    arrow.position.y = tall - 0.5 - i * 0.45;
    // the board sticks out from the post on the side it points to
    const along = new THREE.Vector3(0.75, 0, 0).applyEuler(arrow.rotation);
    arrow.position.x = along.x;
    arrow.position.z = along.z;
    g.add(arrow);
  });
  addCylinder(x, z, { r: 0.15, bottom: y - 1, top: y + tall + 0.3 });
}

// paint a name on a board the level already has (a mesh with a plain face along ±z)
export function letterBoard(pos, { text, width, height }) {
  const g = new THREE.Group();
  g.position.copy(pos);
  addLettering(g, text, { width, height, depth: 0.15 });
  scene.add(g);
}
