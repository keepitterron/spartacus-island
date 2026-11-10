// The five show rockets and the stand they launch from. The cannon misfired and blew them all
// over the fair; each one waits at the end of a ride. Touch a rocket and it fizzes off home to
// its tube on the stand by itself (it's a rocket, after all), so there's nothing to carry or
// drop. A tall beam of its colour shows where each one is until it's home.
import * as THREE from 'three';
import { clamp, lerp, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { addCylinder } from '../../core/colliders.js';
import { terrainHeight } from '../../world/terrain.js';
import { makeRocket } from '../../models/items.js';
import { player } from '../../player/player.js';

const TOUCH = 2.2; // how close Spartacus has to get
const FLY_SPEED = 20; // units per second on the way home
const ARC = 12; // how high above the straight line it flies
const BEAM_HEIGHT = 70;
const STAGE_HEIGHT = 0.4;

// {name, color, task, model, pos (where it waits), slot (its tube on the stand), beam,
//  state: waiting | flying | home | gone (launched in the show), t, from, duration}
const rockets = [];
// slots: the top of each tube, west to east; plunger: the fuse box's handle
const stand = { slots: [], plunger: null, pos: null, onHome: null };

// The stand: a round wooden stage with a rack of five tubes and a fuse box at the front.
// onHome(rocket, {quiet}) runs when a rocket lands in its tube. Returns the stage's middle.
export function buildStand(x, z, { radius, onHome }) {
  const ground = terrainHeight(x, z),
    top = ground + STAGE_HEIGHT;
  const stage = mesh(
    new THREE.CylinderGeometry(radius, radius, STAGE_HEIGHT + 0.4, 28),
    material(0xd9a46a),
    {
      receiveShadow: true,
    },
  );
  stage.position.set(x, top - (STAGE_HEIGHT + 0.4) / 2, z);
  scene.add(stage);
  const skirt = mesh(new THREE.TorusGeometry(radius, 0.14, 6, 32), material(0xe8463f), {
    castShadow: false,
  });
  skirt.rotation.x = Math.PI / 2;
  skirt.position.set(x, top - 0.05, z);
  scene.add(skirt);
  addCylinder(x, z, { r: radius, bottom: ground - 1, top });
  const rack = mesh(new THREE.BoxGeometry(10, 0.5, 1), material(0x7a4a2a));
  rack.position.set(x, top + 0.25, z - 2.4);
  scene.add(rack);
  for (let i = 0; i < 5; i++) {
    const tubeX = x + (i - 2) * 2.1,
      tube = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10), material(0x3d4a6b));
    tube.position.set(tubeX, top + 0.45, z - 2.4);
    scene.add(tube);
    stand.slots.push(vec3(tubeX, top + 0.5, z - 2.4));
  }
  addCylinder(x, z - 2.4, { r: 0.6, bottom: ground - 1, top: top + 0.9 }); // the rack's middle
  // the fuse box: a red box with a T-handle that Spartacus pushes down with his paws
  const box = mesh(new THREE.BoxGeometry(1, 0.7, 0.8), material(0xe8463f));
  box.position.set(x, top + 0.35, z + 2.6);
  scene.add(box);
  const plunger = new THREE.Group();
  const rod = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 6), material(0x9aa6b8));
  rod.position.y = 0.4;
  plunger.add(rod);
  const handle = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 6), material(0x1c2333));
  handle.rotation.z = Math.PI / 2;
  handle.position.y = 0.8;
  plunger.add(handle);
  plunger.position.set(x, top + 0.6, z + 2.6);
  scene.add(plunger);
  Object.assign(stand, { plunger, plungerY: top + 0.6, pos: vec3(x, top, z), onHome });
  return stand.pos;
}

// the fuse box's handle goes down (pushed: true) or back up
export function pushPlunger(pushed) {
  stand.plunger.position.y = stand.plungerY - (pushed ? 0.45 : 0);
}

// a rocket waiting at pos (its stick on the ground there); index: which tube is its own
export function addRocket(name, { color, task, pos, index }) {
  const model = makeRocket(color);
  model.scale.setScalar(1.25);
  model.position.copy(pos);
  scene.add(model);
  const beam = mesh(
    new THREE.CylinderGeometry(0.6, 0.6, BEAM_HEIGHT, 10, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false }),
    { castShadow: false },
  );
  beam.position.set(pos.x, pos.y + BEAM_HEIGHT / 2, pos.z);
  scene.add(beam);
  const rocket = { name, color, task, model, pos: pos.clone(), slot: stand.slots[index], beam };
  Object.assign(rocket, { state: 'waiting', t: 0, from: null, duration: 1, fade: 1 });
  rockets.push(rocket);
  return rocket;
}

export const rocketsHome = () => rockets.filter((rocket) => rocket.state === 'home').length;
export const allRockets = () => rockets;
export const rocketForTask = (task) => rockets.find((rocket) => rocket.task === task);

// touching a waiting rocket sends it home (a giant dog reaches further)
export function grabRockets(p) {
  const reach = TOUCH * Math.max(1, player.size * 0.7);
  for (const rocket of rockets) {
    if (rocket.state !== 'waiting') continue;
    const middle = rocket.pos.y + 1;
    if (Math.hypot(p.x - rocket.pos.x, p.z - rocket.pos.z) > reach) continue;
    if (p.y > middle + reach || p.y + player.size * 1.2 < middle - reach) continue;
    flyHome(rocket);
  }
}

function flyHome(rocket) {
  rocket.state = 'flying';
  rocket.t = 0;
  rocket.from = rocket.model.position.clone();
  rocket.duration = clamp(rocket.from.distanceTo(rocket.slot) / FLY_SPEED, 1.6, 4.5);
  sfx.whistle();
  sfx.fruit();
}

// straight into its tube (quiet: a save being put back, so no fuss)
export function sendRocketHome(rocket, { quiet = false } = {}) {
  rocket.state = 'home';
  rocket.model.position.copy(rocket.slot);
  rocket.model.rotation.set(0, 0, 0);
  rocket.fade = quiet ? 0 : rocket.fade;
  if (!quiet) {
    sfx.thunk();
    burst(rocket.slot.clone().add(vec3(0, 1.5, 0)), {
      count: 26,
      color: [rocket.color, 0xffffff, 0xffd84d],
      speed: 5,
      up: 3,
      life: 1,
      size: 1.1,
    });
  }
  stand.onHome(rocket, { quiet });
}

// launched in the show: gone from the stand
export function hideRocket(rocket) {
  rocket.state = 'gone';
  rocket.model.visible = false;
}

export function updateRockets(dt) {
  for (const rocket of rockets) {
    if (rocket.state === 'waiting') wait(rocket);
    if (rocket.state === 'flying') fly(rocket, dt);
    // the beam fades away once the rocket has left its spot
    const wanted = rocket.state === 'waiting' ? 1 : 0;
    rocket.fade = lerp(rocket.fade, wanted, Math.min(1, dt * 2));
    rocket.beam.visible = rocket.fade > 0.02;
    rocket.beam.material.opacity =
      rocket.fade * (0.24 + 0.08 * Math.sin(game.time * 2 + rocket.pos.x));
  }
}

// bobbing and turning on the spot, with a sparkle now and then
function wait(rocket) {
  const { model, pos } = rocket;
  model.position.y = pos.y + 0.3 + Math.sin(game.time * 2.2 + pos.x) * 0.15;
  model.rotation.y = game.time * 1.4;
  if (Math.random() < 0.06)
    burst(model.position.clone().add(vec3(0, 1.6, 0)), {
      count: 1,
      color: [rocket.color, 0xffffff],
      speed: 0.8,
      up: 1,
      life: 0.6,
      size: 0.7,
    });
}

// a high arc home, nose first, trailing sparks
function fly(rocket, dt) {
  rocket.t += dt;
  const t = clamp(rocket.t / rocket.duration, 0, 1),
    eased = t * t * (3 - 2 * t),
    { model, from, slot } = rocket,
    before = model.position.clone();
  model.position.lerpVectors(from, slot, eased);
  model.position.y += Math.sin(Math.PI * t) * ARC;
  const heading = model.position.clone().sub(before);
  if (heading.lengthSq() > 1e-6)
    model.quaternion.setFromUnitVectors(vec3(0, 1, 0), heading.normalize());
  burst(model.position.clone(), {
    count: 1,
    color: [rocket.color, 0xffd84d, 0xffffff],
    speed: 0.6,
    up: 0.3,
    life: 0.7,
    size: 0.9,
    gravity: 0.15,
  });
  if (t >= 1) sendRocketHome(rocket);
}
