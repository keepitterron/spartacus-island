// Mango the parrot: model, story moves and per-frame update. Rescued on island 2 (too hungry to fly),
// lives in the crow's nest, and on later islands fetches things for Spartacus.
import * as THREE from 'three';
import { clamp, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { material, mesh } from '../core/materials.js';
import { game } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { textSprite, onFontsReady } from '../core/fx.js';
import { supportHeight } from '../core/colliders.js';
import { ship } from '../world/ship.js';
import { player, forwardDir } from '../player/player.js';
import { dog } from '../player/dog.js';

// state: hungry | hop (onto the hat) | riding | fly (to the ship) | crew
//        | fetchGo | fetchDrop | fetchHome   (a fetch errand, see mangoFetch)
// `t` is time in the current flight, `from` where it started, `nest` {x,y,z} where he waits hungry,
// `island` which island that nest is on, `fetch` the current errand {to, mesh, onDrop}.
export const mango = {
  g: new THREE.Group(),
  state: 'hungry',
  t: 0,
  nest: null,
  island: 0,
  fetch: null,
};
const CROWS_NEST = vec3(0, 6.6, 0.4); // ship-local
let hungrySign = null; // "Hungry!" sprite over his head
{
  const green = material(0x3fbf5a),
    red = material(0xf2545b),
    yellow = material(0xffd84d),
    orange = material(0xffa53d),
    ink = material(0x2b2b38),
    eyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const body = mesh(new THREE.SphereGeometry(0.3, 10, 8), green);
  body.scale.set(1, 1.15, 1);
  body.position.y = 0.35;
  mango.g.add(body);
  const belly = mesh(new THREE.SphereGeometry(0.2, 8, 6), yellow);
  belly.scale.set(1, 1.2, 0.6);
  belly.position.set(0, 0.3, 0.17);
  mango.g.add(belly);
  const head = mesh(new THREE.SphereGeometry(0.23, 10, 8), green);
  head.position.set(0, 0.72, 0.05);
  mango.g.add(head);
  const beak = mesh(new THREE.ConeGeometry(0.08, 0.22, 6), orange);
  beak.rotation.x = Math.PI / 2 + 0.5;
  beak.position.set(0, 0.65, 0.27);
  mango.g.add(beak);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), eyeWhite);
    eye.position.set(side * 0.1, 0.77, 0.18);
    mango.g.add(eye);
    const pupil = mesh(new THREE.SphereGeometry(0.035, 6, 5), ink, { castShadow: false });
    pupil.position.set(side * 0.1, 0.77, 0.235);
    mango.g.add(pupil);
  }
  const tuft = mesh(new THREE.ConeGeometry(0.07, 0.22, 5), yellow);
  tuft.position.set(0, 0.98, 0);
  tuft.rotation.x = -0.4;
  mango.g.add(tuft);
  // wings hang from a shoulder pivot; userData.s is the side (-1 left, 1 right) for flapping
  mango.wings = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.27, 0.5, 0);
    const wing = mesh(new THREE.BoxGeometry(0.12, 0.44, 0.32), red);
    wing.position.y = -0.14;
    pivot.add(wing);
    mango.g.add(pivot);
    pivot.userData.s = side;
    return pivot;
  });
  const tail = mesh(new THREE.BoxGeometry(0.14, 0.05, 0.5), red);
  tail.position.set(0, 0.18, -0.36);
  tail.rotation.x = 0.55;
  mango.g.add(tail);
  scene.add(mango.g);
}
onFontsReady(() => {
  hungrySign = textSprite('Hungry!', '#ffd84d');
  hungrySign.scale.set(3.2, 0.8, 1);
  hungrySign.material.depthTest = true;
  hungrySign.visible = false;
  scene.add(hungrySign);
});

// sit hungry on a nest {x,y,z} on island `islandNumber`, looking towards `look` {x,z}
export function placeMango(nest, look, islandNumber) {
  mango.nest = nest;
  mango.island = islandNumber;
  mango.g.position.set(nest.x, nest.y + 0.2, nest.z);
  mango.g.rotation.y = Math.atan2(look.x - nest.x, look.z - nest.z);
}

// after being fed: hop onto Spartacus's hat
export function mangoHop() {
  mango.state = 'hop';
  mango.t = 0;
  mango.from = mango.g.position.clone();
}

// move him from wherever he's parented (hat, ship) into the scene, keeping his world position
function detach() {
  const worldPos = vec3();
  mango.g.getWorldPosition(worldPos);
  mango.g.parent.remove(mango.g);
  scene.add(mango.g);
  mango.g.position.copy(worldPos);
  mango.from = worldPos;
  mango.t = 0;
}

// riding the hat -> fly up to the crow's nest; onArrive when he lands
export function mangoToShip(onArrive) {
  detach();
  mango.g.scale.setScalar(1);
  mango.state = 'fly';
  mango.onArrive = onArrive;
  sfx.parrot();
}

// arriving on a later island directly (Continue): put him in the crow's nest
export function ensureMangoCrew() {
  if (mango.state === 'crew') return;
  mango.g.parent?.remove(mango.g);
  ship.add(mango.g);
  mango.g.position.copy(CROWS_NEST);
  mango.g.rotation.set(0, 0, 0);
  mango.g.scale.setScalar(1);
  mango.state = 'crew';
  if (hungrySign) hungrySign.visible = false;
}

// errand: fly to `to`, pick up `carried`, bring it to just in front of Spartacus, then onDrop(pos)
export function mangoFetch(to, carried, onDrop) {
  detach();
  mango.fetch = { to, mesh: carried, onDrop };
  mango.state = 'fetchGo';
  sfx.parrot();
}

function landOnShip() {
  const g = mango.g;
  scene.remove(g);
  ship.add(g);
  g.position.copy(CROWS_NEST);
  g.rotation.set(0, 0, 0);
  mango.state = 'crew';
}

// both wings flap together; `amount` is how wide (0.05 idle twitch .. 1.2 full flight)
function flap(amount) {
  for (const wing of mango.wings)
    wing.rotation.z = wing.userData.s * (0.2 + Math.abs(Math.sin(game.time * 18)) * amount);
}

// arc from `mango.from` to `to` over `duration` s, peaking `arc` m higher; returns progress 0..1
function flyTo(to, { duration, arc }) {
  const g = mango.g;
  const t = clamp(mango.t / duration, 0, 1);
  g.position.lerpVectors(mango.from, to, t);
  g.position.y += Math.sin(Math.PI * t) * arc;
  flap(1.2);
  g.rotation.y = Math.atan2(to.x - mango.from.x, to.z - mango.from.z);
  return t;
}

// the crow's nest in world space, slightly above where he sits so he drops in
const nestInWorld = () => ship.localToWorld(CROWS_NEST.clone().setY(6.65));

function updateHungry() {
  const nest = mango.nest,
    time = game.time;
  mango.g.position.y = nest.y + 0.2 + Math.abs(Math.sin(time * 2.2)) * 0.08;
  flap(0.1);
  if (!hungrySign) return;
  hungrySign.visible = game.island === mango.island;
  hungrySign.position.set(nest.x, nest.y + 2 + Math.sin(time * 2) * 0.1, nest.z);
}

// hop from the nest onto the hat (the target follows the moving head), then ride it
function updateHop() {
  const g = mango.g;
  if (hungrySign) hungrySign.visible = false;
  const t = clamp(mango.t / 0.8, 0, 1);
  const to = vec3();
  dog.head.localToWorld(to.set(0, 0.75, -0.05));
  g.position.lerpVectors(mango.from, to, t);
  g.position.y += Math.sin(Math.PI * t) * 1.2;
  flap(1.2);
  if (t < 1) return;
  scene.remove(g);
  dog.head.add(g);
  g.position.set(0, 0.66, -0.05);
  g.rotation.set(0, 0, 0);
  g.scale.setScalar(0.62); // the hat is small
  mango.state = 'riding';
}

// on the hat: bob with Spartacus's gait, flap hard while he's in the air
function updateRiding() {
  flap(player.grounded ? 0.05 : 0.9);
  mango.g.position.y = 0.66 + (player.grounded ? Math.abs(Math.sin(player.gaitPhase)) * 0.03 : 0);
}

function updateFetchGo() {
  const errand = mango.fetch,
    g = mango.g;
  const target = vec3(errand.to.x, errand.to.y + 0.25, errand.to.z);
  if (flyTo(target, { duration: 2.2, arc: 3 }) < 1) return;
  // grab it in his feet
  scene.remove(errand.mesh);
  g.add(errand.mesh);
  errand.mesh.position.set(0, -0.15, 0.3);
  mango.state = 'fetchDrop';
  mango.t = 0;
  mango.from = g.position.clone();
  sfx.parrot();
}

// carry it to 1.2 m in front of Spartacus (target follows him), drop it on the ground there
function updateFetchDrop() {
  const errand = mango.fetch,
    g = mango.g,
    t = clamp(mango.t / 1.6, 0, 1),
    forward = forwardDir(),
    to = vec3(player.pos.x + forward.x * 1.2, player.pos.y + 2.2, player.pos.z + forward.z * 1.2);
  g.position.lerpVectors(mango.from, to, t);
  g.position.y += Math.sin(Math.PI * t) * 1.5;
  flap(1.2);
  // atan2 gives 0 once he is right over the target; keep the old heading then
  g.rotation.y = Math.atan2(to.x - g.position.x, to.z - g.position.z) || g.rotation.y;
  if (t < 1) return;
  g.remove(errand.mesh);
  const groundY = Math.max(supportHeight(to.x, to.z, player.pos.y + 0.6), player.pos.y);
  errand.onDrop(vec3(to.x, groundY, to.z));
  mango.state = 'fetchHome';
  mango.t = 0;
  mango.from = g.position.clone();
}

export function updateMango(dt) {
  mango.t += dt;
  switch (mango.state) {
    case 'hungry':
      updateHungry();
      break;
    case 'hop':
      updateHop();
      break;
    case 'riding':
      updateRiding();
      break;
    case 'fly':
      if (flyTo(nestInWorld(), { duration: 1.6, arc: 3 }) < 1) break;
      landOnShip();
      sfx.parrot();
      mango.onArrive?.();
      break;
    case 'crew':
      flap(0.08);
      mango.g.rotation.y = Math.sin(game.time * 0.6) * 0.8;
      break;
    case 'fetchGo':
      updateFetchGo();
      break;
    case 'fetchDrop':
      updateFetchDrop();
      break;
    case 'fetchHome':
      if (flyTo(nestInWorld(), { duration: 2.4, arc: 3 }) >= 1) landOnShip();
      break;
  }
}
