// Chris, who keeps the lost and found at the camp (Zoë: "Chris is just there and points Spartacus
// to the plank"). A fox, sitting by the pile: turns to watch Spartacus, and while the plank is
// still in the pile, points a paw at it.
import * as THREE from 'three';
import { distXZ, lerp, lerpAngle } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mergeParts, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { say } from '../../game/talk.js';
import { addCylinder } from '../../core/colliders.js';

const NOTICE_REACH = 10; // m: Chris turns to look at Spartacus
const TALK_REACH = 6; // m: and talks to him
const BARK_LINES = ['Hello, Spartacus!', 'Lost something? I might have it!'];

// paw: the pointing arm's pivot; plank: {x, z} where the plank lies; hop: seconds of hop left
const chris = { g: null, paw: null, plank: null, hop: 0, barks: 0, barkCooldown: 0 };

// a sitting fox: orange, cream chest, tall ears with dark tips, a bushy white-tipped tail
function makeFox() {
  const g = new THREE.Group();
  const fur = material(0xf07a2a),
    cream = material(0xfff1de),
    dark = material(0x3a2a24),
    ink = material(0x2b2b38);
  const body = mesh(new THREE.SphereGeometry(0.34, 10, 8), fur);
  body.scale.set(0.95, 1.25, 0.9);
  body.position.y = 0.42;
  g.add(body);
  const chest = mesh(new THREE.SphereGeometry(0.22, 10, 8), cream, { castShadow: false });
  chest.scale.set(1, 1.3, 0.6);
  chest.position.set(0, 0.5, 0.2);
  g.add(chest);
  const head = mesh(new THREE.SphereGeometry(0.26, 10, 8), fur);
  head.position.set(0, 0.98, 0.04);
  g.add(head);
  const snout = mesh(new THREE.ConeGeometry(0.13, 0.32, 8), cream);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0.92, 0.32);
  g.add(snout);
  const nose = mesh(new THREE.SphereGeometry(0.04, 6, 5), ink, { castShadow: false });
  nose.position.set(0, 0.92, 0.49);
  g.add(nose);
  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.1, 0.3, 4), fur);
    ear.position.set(side * 0.15, 1.27, 0);
    ear.rotation.z = side * -0.2;
    g.add(ear);
    const tip = mesh(new THREE.ConeGeometry(0.045, 0.1, 4), dark);
    tip.position.set(side * 0.18, 1.4, 0);
    tip.rotation.z = side * -0.2;
    g.add(tip);
    const eye = mesh(new THREE.SphereGeometry(0.04, 6, 5), ink, { castShadow: false });
    eye.position.set(side * 0.1, 1.04, 0.22);
    g.add(eye);
    const leg = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 6), dark);
    leg.position.set(side * 0.18, 0.12, 0.2);
    g.add(leg);
  }
  // the left front paw on a shoulder pivot, so it can point
  const paw = new THREE.Group();
  paw.position.set(0.2, 0.62, 0.2);
  const arm = mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.36, 6), fur);
  arm.position.y = -0.18;
  paw.add(arm);
  const hand = mesh(new THREE.SphereGeometry(0.065, 6, 5), dark);
  hand.position.y = -0.37;
  paw.add(hand);
  g.add(paw);
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    const puff = mesh(
      new THREE.SphereGeometry(0.15 + 0.05 * Math.sin(t * Math.PI), 8, 6),
      i === 3 ? cream : fur,
    );
    puff.position.set(0.1 + t * 0.3, 0.14 + t * 0.12, -0.32 - t * 0.35);
    g.add(puff);
  }
  mergeParts(g); // the paw on its pivot stays separate
  return { g, paw };
}

// at: {x, z, y} where Chris sits; plank: {x, z} where the plank lies in the pile
export function addChris(at, { plank }) {
  const fox = makeFox();
  chris.g = fox.g;
  chris.paw = fox.paw;
  chris.plank = plank;
  chris.home = at;
  chris.g.position.set(at.x, at.y, at.z);
  chris.g.scale.setScalar(1.3); // a grown-up fox, bigger than the squirrels
  scene.add(chris.g);
  addCylinder(at.x, at.z, { r: 0.5, bottom: at.y - 1, top: at.y + 1.7 });
}

// the plank item (systems/items.js) still lying where it started
const plankInPile = (plank) =>
  plank?.state === 'ground' && distXZ(plank.mesh.position, chris.plank.x, chris.plank.z) < 1;

// per frame: what Chris says when Spartacus comes by (once each)
// plank: the plank item (systems/items.js); bridgeFixed: true once it's in the bridge
export function interactChris(p, { plank, bridgeFixed }) {
  const dist = distXZ(p, chris.home.x, chris.home.z);
  if (dist > TALK_REACH) return;
  const talking = { at: chris.home, reach: TALK_REACH + 2 };
  if (bridgeFixed)
    say('Chris', 'The plank fixed the bridge? One less thing in my lost and found!', {
      ...talking,
      once: 'chrisThanks',
    });
  else if (plank?.state === 'carried')
    say('Chris', 'That’s the one! The broken bridge is by the pond.', {
      ...talking,
      once: 'chrisCarry',
    });
  else if (plankInPile(plank))
    say('Chris', 'Looking for a plank? It’s in the lost and found!', { ...talking, once: 'chris' });
}

// a woof: Chris hops and says hello
export function barkAtChris(p) {
  if (distXZ(p, chris.home.x, chris.home.z) > NOTICE_REACH || chris.barkCooldown > 0) return;
  chris.hop = 0.5;
  chris.barkCooldown = 4;
  sfx.squeak();
  say('Chris', BARK_LINES[chris.barks % BARK_LINES.length], {
    at: chris.home,
    reach: NOTICE_REACH + 2,
    auto: true,
  });
  chris.barks += 1;
}

// turns to watch Spartacus; while the plank is in the pile and he's near, points at it
export function updateChris(dt, { p, plank }) {
  chris.barkCooldown = Math.max(0, chris.barkCooldown - dt);
  const { g, home } = chris;
  const dist = distXZ(p, home.x, home.z);
  const pointing = dist < TALK_REACH && plankInPile(plank);
  const lookAt = pointing ? chris.plank : p;
  if (dist < NOTICE_REACH || pointing) {
    const turn = Math.atan2(lookAt.x - home.x, lookAt.z - home.z);
    g.rotation.y = lerpAngle(g.rotation.y, turn, Math.min(1, dt * 4));
  }
  // the paw swings up to point forward, and back down
  const target = pointing ? -Math.PI / 2 + Math.sin(game.time * 4) * 0.08 : 0;
  chris.paw.rotation.x = lerp(chris.paw.rotation.x, target, Math.min(1, dt * 6));
  chris.hop = Math.max(0, chris.hop - dt);
  g.position.y = home.y + Math.sin((chris.hop / 0.5) * Math.PI) * 0.35 * Math.sign(chris.hop);
}
