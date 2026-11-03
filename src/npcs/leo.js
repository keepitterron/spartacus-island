// Leo the magpie, met on the sky island. He saw Lina's Sky Jewel glinting and carried it off to
// his nest. He's not a villain, just a bird who loves shiny things: he looks around from the
// nest, shows "?" when he's curious and "!" when he spots Spartacus, then flutters off to a
// perch with the jewel for a few seconds (a spotted dog loses a little time, nothing else).
// Puffy bushes hide you, a Mini-Me dog is harder to see, and a woof distracts him. Bring him
// something shiny and he swaps it for the jewel and becomes a friend.
import * as THREE from 'three';
import { clamp, distToSegmentXZ, lerpAngle, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { material, mesh } from '../core/materials.js';
import { game, isPlaying } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { textSprite, onFontsReady } from '../core/fx.js';
import { player } from '../player/player.js';

// how far he can see, and how wide (half-angle); a Mini-Me dog has to be much closer
const SIGHT = { range: 12, tinyRange: 6, halfAngle: 0.75 };
const LOOK_HOLD = 2.4; // seconds he looks one way before turning to the next
const CURIOUS_TIME = 0.7; // seconds of "?" before he's sure ("!")
const SPOTTED_TIME = 0.6; // seconds of "!" before he flutters off
const FLY_TIME = 1.2; // seconds for a flight between perches
const AWAY_TIME = 4; // seconds on the far perch before he flies home
const DISTRACTED_TIME = 4; // seconds a woof keeps him looking around

// state: watch (looking round from the nest) | curious ("?") | spotted ("!") | flying
//        | away (on a far perch, with the jewel) | distracted (after a woof) | happy (swapped)
// t: seconds in this state; looks: yaws he looks along in turn; flight: {from, to, next}
// spots: {nest, perches, bushes, ground} set by placeLeo
export const leo = {
  g: null,
  wings: [],
  jewel: null, // the jewel he carries in his beak (the one in the nest is the island's)
  marks: {}, // the "?" and "!" sprites
  cone: null, // a soft wedge on the cloud showing where he's looking
  state: 'watch',
  t: 0,
  yaw: 0,
  look: 0,
  looks: [],
  flight: null,
  perch: 0,
  spots: null,
};

function makeLeo() {
  const g = new THREE.Group(),
    black = material(0x1c1c26),
    white = material(0xffffff),
    shine = material(0x2f7fb0, { metalness: 0.3, roughness: 0.4 });
  const body = mesh(new THREE.SphereGeometry(0.35, 10, 8), black);
  body.scale.set(0.9, 0.9, 1.4);
  body.position.y = 0.45;
  g.add(body);
  const belly = mesh(new THREE.SphereGeometry(0.28, 10, 8), white);
  belly.scale.set(0.9, 0.85, 1.1);
  belly.position.set(0, 0.36, 0.1);
  g.add(belly);
  const head = mesh(new THREE.SphereGeometry(0.22, 10, 8), black);
  head.position.set(0, 0.78, 0.38);
  g.add(head);
  const beak = mesh(new THREE.ConeGeometry(0.06, 0.24, 6), material(0x3a3a44));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.76, 0.64);
  g.add(beak);
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.035, 6, 5), white, { castShadow: false });
    eye.position.set(side * 0.13, 0.84, 0.52);
    g.add(eye);
  }
  // wings: black with a white patch, pivoting at the shoulder so they can flap
  leo.wings = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.28, 0.55, 0.05);
    const wing = mesh(new THREE.SphereGeometry(0.3, 8, 6), black);
    wing.scale.set(0.25, 0.45, 1.1);
    wing.position.set(side * 0.06, 0, -0.1);
    pivot.add(wing);
    const patch = mesh(new THREE.SphereGeometry(0.14, 6, 5), white, { castShadow: false });
    patch.scale.set(0.3, 0.7, 1);
    patch.position.set(side * 0.12, 0, 0);
    pivot.add(patch);
    g.add(pivot);
    return pivot;
  });
  // a long shiny blue-green tail
  const tail = mesh(new THREE.BoxGeometry(0.16, 0.05, 0.9), shine);
  tail.position.set(0, 0.5, -0.8);
  tail.rotation.x = -0.25;
  g.add(tail);
  return g;
}

// Leo at his nest. spots: {nest: Vector3 (where he stands), perches: [Vector3] (far perches),
// bushes: [{x, z, r, top}] (hiding places), ground: {x, z, r, top} (the cloud he watches),
// facing: yaw towards the way in}. jewel: a model for the jewel he flies off with.
export function placeLeo(spots, { jewel }) {
  leo.g = makeLeo();
  leo.g.scale.setScalar(1.3);
  leo.g.position.copy(spots.nest);
  scene.add(leo.g);
  leo.spots = spots;
  leo.yaw = spots.facing;
  leo.looks = [0, -0.8, -0.3, 0.5, 0.9, 0.2].map((offset) => spots.facing + offset);
  leo.jewel = jewel;
  jewel.position.set(0, 0.62, 0.72); // in his beak
  jewel.visible = false;
  leo.g.add(jewel);
  addSightCone();
  onFontsReady(() => {
    for (const [mark, color] of [
      ['?', '#ffd84d'],
      ['!', '#ff6b6b'],
    ]) {
      const sprite = textSprite(mark, color);
      sprite.scale.set(2.4, 0.6, 1);
      sprite.visible = false;
      scene.add(sprite);
      leo.marks[mark] = sprite;
    }
  });
}

// a pale wedge on the ground in front of him: where he can see (a full-size dog)
function addSightCone() {
  const geometry = new THREE.CircleGeometry(
    SIGHT.range,
    18,
    -Math.PI / 2 - SIGHT.halfAngle,
    SIGHT.halfAngle * 2,
  );
  geometry.rotateX(-Math.PI / 2); // the wedge's middle now points along +z
  leo.cone = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: 0xffe066,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
  );
  leo.cone.position.copy(leo.spots.nest).setY(leo.spots.ground.top + 0.05);
  scene.add(leo.cone);
}

const setState = (state) => {
  leo.state = state;
  leo.t = 0;
};

// how far apart two headings are, 0..π
const angleBetween = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

// can he see Spartacus right now? Only on his cloud (never mid-flight), in front of him,
// close enough, and not behind a bush
function canSee() {
  const pos = player.pos,
    { nest, ground, bushes } = leo.spots;
  if (!player.grounded || Math.abs(pos.y - ground.top) > 1) return false;
  const dx = pos.x - nest.x,
    dz = pos.z - nest.z,
    dist = Math.hypot(dx, dz),
    range = player.tiny ? SIGHT.tinyRange : SIGHT.range;
  if (dist > range) return false;
  if (angleBetween(Math.atan2(dx, dz), leo.yaw) > SIGHT.halfAngle) return false;
  return !bushes.some(
    (bush) => pos.y < bush.top - 0.3 && distToSegmentXZ(bush, nest, pos) < bush.r,
  );
}

// a woof: he looks round for where it came from, not at you
export function distractLeo() {
  if (!['watch', 'curious'].includes(leo.state)) return false;
  setState('distracted');
  return true;
}

// fly from where he is to `to`, then go into state `next`
function flyTo(to, next) {
  leo.flight = { from: leo.g.position.clone(), to: to.clone(), next };
  setState('flying');
  sfx.flutter();
}

// every frame; onSpotted() runs the moment he sees Spartacus (for hints)
export function updateLeo(dt, { onSpotted }) {
  if (!leo.g) return;
  leo.t += dt;
  const time = game.time;
  const handlers = {
    watch: () => {
      lookAround(dt);
      if (isPlaying() && canSee()) setState('curious');
    },
    curious: () => {
      if (!canSee()) setState('watch');
      else if (leo.t > CURIOUS_TIME) {
        setState('spotted');
        sfx.parrot();
        onSpotted();
      }
    },
    spotted: () => {
      if (leo.t < SPOTTED_TIME) return;
      leo.jewel.visible = true;
      leo.perch = (leo.perch + 1) % leo.spots.perches.length;
      flyTo(leo.spots.perches[leo.perch], 'away');
    },
    flying: () => updateFlight(),
    away: () => {
      if (leo.t > AWAY_TIME) flyTo(leo.spots.nest, 'watch');
    },
    distracted: () => {
      // peering this way and that, but never at the dog
      leo.yaw = leo.spots.facing + Math.PI + Math.sin(leo.t * 2.5) * 0.9;
      if (leo.t > DISTRACTED_TIME) setState('watch');
    },
    happy: () => {
      leo.yaw += dt * 0.6;
    },
  };
  handlers[leo.state]();
  pose(dt, time);
}

// hold each look for a while, then turn to the next
function lookAround(dt) {
  if (leo.t > LOOK_HOLD) {
    leo.look = (leo.look + 1) % leo.looks.length;
    leo.t = 0;
  }
  leo.yaw = lerpAngle(leo.yaw, leo.looks[leo.look], Math.min(1, dt * 4));
}

function updateFlight() {
  const { from, to, next } = leo.flight,
    t = clamp(leo.t / FLY_TIME, 0, 1);
  leo.g.position.lerpVectors(from, to, t);
  leo.g.position.y += Math.sin(Math.PI * t) * 2.5;
  leo.yaw = Math.atan2(to.x - from.x, to.z - from.z);
  if (t < 1) return;
  if (next === 'watch') leo.jewel.visible = false; // back in the nest
  setState(next);
}

// facing, flapping, the sight wedge and the "?" / "!" over his head
function pose(dt, time) {
  const g = leo.g,
    flying = leo.state === 'flying',
    flap = flying ? Math.sin(time * 22) * 0.9 : Math.sin(time * 3) * 0.05;
  g.rotation.y = leo.yaw;
  leo.wings.forEach((wing, i) => {
    wing.rotation.z = (i ? -1 : 1) * (0.1 + flap);
  });
  const watching = ['watch', 'curious', 'spotted'].includes(leo.state);
  leo.cone.visible = watching;
  leo.cone.rotation.y = leo.yaw;
  leo.cone.scale.setScalar(player.tiny ? SIGHT.tinyRange / SIGHT.range : 1);
  const above = g.position.clone().add(vec3(0, 2, 0));
  for (const [mark, sprite] of Object.entries(leo.marks)) {
    const show =
      (mark === '?' && ['curious', 'distracted'].includes(leo.state)) ||
      (mark === '!' && leo.state === 'spotted');
    sprite.visible = show;
    if (show) sprite.position.copy(above);
  }
}

// is Leo home on his nest and not cross (the swap can happen)?
export const leoHome = () => ['watch', 'curious', 'distracted'].includes(leo.state);

// the swap: he hops, loves the fork, and stays happy (quiet: a save being put back)
export function leoHappy({ quiet = false } = {}) {
  leo.g.position.copy(leo.spots.nest);
  leo.jewel.visible = false;
  setState('happy');
  if (!quiet) sfx.parrot();
}
