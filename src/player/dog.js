// The Spartacus model (makeDog) and animateDog, which poses it from the player state every frame.
import * as THREE from 'three';
import { clamp, lerp } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { material, mesh } from '../core/materials.js';
import { game } from '../core/state.js';
import { player, SPEED } from './player.js';
import { POUND_HANG } from './pound.js';

// Spartacus: half pitbull, half labrador. Shiny black coat, thin white stripe down the
// muzzle, white chest patch and paw tips, floppy ears, straw hat with a red band.
// Friends who ride along are added to dog.head; carried items go in dog.mouth.
// dog.hat is the head-slot anchor (the thing Chop-Chop throws); the straw hat inside it is
// dog.strawHat, hidden when another hat is worn (see systems/outfits.js).
function makeDog() {
  const fur = material(0x2a2a33),
    white = material(0xffffff),
    earFur = material(0x1f1f27),
    noseBlack = material(0x0c0c10, { roughness: 0.35 }),
    pink = material(0xff8fa3),
    straw = material(0xf2d27a),
    ribbon = material(0xd9343f),
    iris = material(0x9a7a34, { roughness: 0.3 }),
    pupil = material(0x1a1208, { roughness: 0.3 });
  // root follows the player; body is what squashes, tilts and bobs
  const root = new THREE.Group(),
    body = new THREE.Group();
  root.add(body);
  const torso = mesh(new THREE.CapsuleGeometry(0.4, 0.75, 4, 10), fur);
  torso.rotation.x = Math.PI / 2;
  torso.position.y = 0.78;
  body.add(torso);
  const chest = mesh(new THREE.SphereGeometry(0.34, 10, 8), white);
  chest.scale.set(1.08, 1.1, 1.15);
  chest.position.set(0, 0.74, 0.42);
  body.add(chest);
  const head = new THREE.Group();
  head.position.set(0, 1.25, 0.62);
  body.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.44, 12, 10), fur);
  skull.scale.set(1.12, 0.95, 1);
  head.add(skull);
  // the white stripe: one bar up the forehead, one down the bridge of the nose
  const stripeForehead = mesh(new THREE.BoxGeometry(0.03, 0.28, 0.06), white, {
    castShadow: false,
  });
  stripeForehead.position.set(0, 0.2, 0.4);
  stripeForehead.rotation.x = -0.4;
  head.add(stripeForehead);
  const stripeNose = mesh(new THREE.BoxGeometry(0.027, 0.04, 0.26), white, { castShadow: false });
  stripeNose.position.set(0, 0.06, 0.47);
  stripeNose.rotation.x = 0.28;
  head.add(stripeNose);
  const muzzle = mesh(new THREE.SphereGeometry(0.24, 10, 8), fur);
  muzzle.scale.set(1.1, 0.8, 1.1);
  muzzle.position.set(0, -0.12, 0.36);
  head.add(muzzle);
  const nose = mesh(new THREE.SphereGeometry(0.085, 8, 6), noseBlack);
  nose.position.set(0, -0.04, 0.6);
  head.add(nose);
  const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
  // hazel eyes: golden-brown iris with a dark pupil so the colour reads at this size
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.08, 10, 8), iris, { castShadow: false });
    eye.position.set(side * 0.17, 0.07, 0.37);
    head.add(eye);
    const eyePupil = mesh(new THREE.SphereGeometry(0.042, 8, 6), pupil, { castShadow: false });
    eyePupil.position.set(side * 0.17, 0.068, 0.425);
    head.add(eyePupil);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 4), shine);
    glint.position.set(side * 0.17 + 0.025, 0.1, 0.455);
    head.add(glint);
    const cheek = mesh(new THREE.SphereGeometry(0.07, 6, 5), pink, { castShadow: false });
    cheek.scale.set(1, 0.5, 0.6);
    cheek.position.set(side * 0.27, -0.09, 0.3);
    head.add(cheek);
  }
  const tongue = mesh(new THREE.BoxGeometry(0.13, 0.03, 0.2), pink, { castShadow: false });
  tongue.position.set(0, -0.26, 0.46);
  tongue.visible = false;
  head.add(tongue);
  const mouth = new THREE.Group();
  mouth.position.set(0, -0.24, 0.62);
  head.add(mouth);
  // floppy labrador ears hanging from the sides of the head, a few soft blobs each so they look fluffy
  const ears = [-1, 1].map((side) => {
    const ear = new THREE.Group();
    ear.position.set(side * 0.4, 0.2, -0.04);
    // [x, y, z, radius, scaleX, scaleY] per blob, top to bottom
    for (const [x, y, z, radius, scaleX, scaleY] of [
      [0.05, -0.08, 0, 0.14, 0.55, 1],
      [0.07, -0.22, 0.02, 0.15, 0.6, 1],
      [0.08, -0.34, 0.05, 0.12, 0.65, 0.9],
    ]) {
      const blob = mesh(new THREE.IcosahedronGeometry(radius, 1), earFur);
      blob.scale.set(scaleX, scaleY, 1.05);
      blob.position.set(side * x, y, z);
      ear.add(blob);
    }
    ear.rotation.z = side * 0.12;
    head.add(ear);
    ear.userData.side = side;
    return ear;
  });
  const hat = new THREE.Group();
  hat.position.set(0, 0.36, -0.03);
  hat.rotation.x = -0.15;
  hat.rotation.z = 0.08;
  head.add(hat);
  const strawHat = new THREE.Group();
  hat.add(strawHat);
  const brim = mesh(new THREE.CylinderGeometry(0.68, 0.72, 0.05, 18), straw);
  strawHat.add(brim);
  const crown = mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.24, 14), straw);
  crown.position.y = 0.14;
  strawHat.add(crown);
  const hatTop = mesh(new THREE.SphereGeometry(0.3, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), straw);
  hatTop.scale.y = 0.45;
  hatTop.position.y = 0.26;
  strawHat.add(hatTop);
  const band = mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.09, 14), ribbon);
  band.position.y = 0.08;
  strawHat.add(band);
  // front pair first, then back pair; each is a hip pivot
  const legs = [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ].map(([sideX, sideZ]) => {
    const hip = new THREE.Group();
    hip.position.set(sideX * 0.22, 0.55, sideZ * 0.38);
    const leg = mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.42, 6), fur);
    leg.position.y = -0.2;
    hip.add(leg);
    const paw = mesh(new THREE.SphereGeometry(0.13, 8, 6), white);
    paw.scale.set(1, 0.7, 1.2);
    paw.position.set(0, -0.43, 0.03);
    hip.add(paw);
    body.add(hip);
    return hip;
  });
  const tail = new THREE.Group();
  tail.position.set(0, 0.95, -0.72);
  tail.rotation.x = -0.6;
  body.add(tail);
  const tailCone = mesh(new THREE.ConeGeometry(0.1, 0.55, 6), fur);
  tailCone.position.y = 0.25;
  tail.add(tailCone);
  const tailTip = mesh(new THREE.SphereGeometry(0.07, 6, 5), fur);
  tailTip.position.y = 0.5;
  tail.add(tailTip);
  return { root, body, head, ears, legs, tail, tongue, mouth, hat, strawHat };
}
export const dog = makeDog();
scene.add(dog.root);

// pose the model from the player every frame; speed = horizontal speed
export function animateDog(dt, speed) {
  const time = game.time;
  dog.root.position.copy(player.pos);
  // the celebration spin: turn through what's left of game.spinLeft
  if (game.spinLeft > 0) {
    const turn = Math.min(game.spinLeft, dt * 10);
    game.spinLeft -= turn;
    player.yaw += turn;
  }
  dog.root.rotation.y = player.yaw;
  const moving = clamp(speed / SPEED, 0, 1);
  player.gaitPhase += dt * (4 + speed * 1.9);
  const digging = player.digTimer > 0;
  poseLegs({ time, moving, digging });
  dog.body.rotation.x = lerp(dog.body.rotation.x, bodyPitch(digging), Math.min(1, dt * 10));
  // ground pound: a forward flip while hanging in the air
  if (player.pounding && player.poundHang > 0)
    dog.body.rotation.x = (1 - player.poundHang / POUND_HANG) * Math.PI * 2;
  updateSquash(dt);
  const bob = player.grounded ? Math.abs(Math.sin(player.gaitPhase)) * 0.08 * moving : 0;
  const stretchY = player.swing ? 1.12 : 1;
  dog.body.scale.set(
    1 / Math.sqrt(player.squash),
    player.squash * stretchY,
    1 / Math.sqrt(player.squash),
  );
  dog.body.position.y = bob;
  // wag faster when happy or busy
  dog.tail.rotation.z =
    Math.sin(time * (game.celebrateTime >= 0 || digging || player.swing ? 22 : 12)) *
    (0.5 + moving * 0.2);
  // ears flap up when falling and down when rising; pretend we're rising while carried along
  const vy = game.state === 'rescue' || player.swing ? 6 : player.vel.y;
  for (const ear of dog.ears) {
    ear.rotation.x = clamp(vy * 0.05, -0.9, 0.9) + Math.sin(player.gaitPhase * 2) * 0.15 * moving;
    ear.rotation.z = ear.userData.side * (0.12 + clamp(-vy * 0.04, -0.1, 0.7));
  }
  const barking = player.barkTimer > 0;
  dog.tongue.visible = barking && !player.carrying;
  dog.head.rotation.x = headPitch(barking, time);
  dog.head.rotation.z = Math.sin(time * 0.9) * 0.05;
}

// legs 0-1 are the front pair, 2-3 the back pair; rotation.x swings them
function poseLegs({ time, moving, digging }) {
  const legs = dog.legs;
  if (game.state === 'rescue' || player.wading) {
    // paddling in the bubble or in shallow water
    const paddle = Math.sin(player.gaitPhase) * 0.8;
    legs.forEach((leg, i) => {
      leg.rotation.x = i % 2 ? paddle : -paddle;
    });
  } else if (digging) {
    // front paws scratch fast, back legs braced
    const scratch = Math.sin(time * 28) * 1.1;
    legs[0].rotation.x = -0.6 + scratch;
    legs[1].rotation.x = -0.6 - scratch;
    legs[2].rotation.x = 0.2;
    legs[3].rotation.x = 0.2;
  } else if (player.climb) {
    const reach = Math.sin(player.gaitPhase) * 0.9;
    legs[0].rotation.x = -0.9 + reach;
    legs[1].rotation.x = -0.9 - reach;
    legs[2].rotation.x = 0.3 - reach;
    legs[3].rotation.x = 0.3 + reach;
  } else if (player.zip) {
    legs.forEach((leg, i) => {
      leg.rotation.x = 0.25 + Math.sin(time * 6 + i) * 0.25;
    });
  } else if (player.swing) {
    // front legs forward, back legs back, all wiggling
    const wiggle = Math.sin(time * 20) * 0.5;
    legs.forEach((leg, i) => {
      leg.rotation.x = (i < 2 ? -1 : 1) * (0.7 + wiggle * (i % 2 ? 1 : -1));
    });
  } else if (!player.grounded) {
    legs.forEach((leg, i) => {
      leg.rotation.x = i < 2 ? -0.6 : 0.6;
    });
  } else {
    // walking: diagonal pairs move together
    const stride = Math.sin(player.gaitPhase) * 0.75 * moving;
    legs[0].rotation.x = stride;
    legs[3].rotation.x = stride;
    legs[1].rotation.x = -stride;
    legs[2].rotation.x = -stride;
  }
}

// nose-down while digging, nose-up while climbing / zipping / swinging
function bodyPitch(digging) {
  if (digging) return 0.32;
  if (player.pounding) return 0.3;
  if (player.climb) return -1.3;
  if (player.zip) return -0.35;
  if (player.swing) return -0.25;
  return 0;
}

// squash & stretch spring: squashVel kicks it (jumps, landings), it settles back to 1
function updateSquash(dt) {
  player.squashVel += (1 - player.squash) * 140 * dt;
  player.squashVel *= Math.exp(-dt * 9);
  player.squash += player.squashVel * dt;
  player.squash = clamp(player.squash, 0.6, 1.4);
}

// a nod while barking (barkTimer runs 0.35 → 0), head down under a heavy load, else idle sway
function headPitch(barking, time) {
  if (barking) return -Math.sin(((0.35 - player.barkTimer) / 0.35) * Math.PI) * 0.35;
  if (player.carrying && player.carrying.heavy) return 0.12;
  return Math.sin(time * 1.3) * 0.04;
}
