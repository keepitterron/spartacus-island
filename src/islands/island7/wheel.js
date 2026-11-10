// The Big Wheel: eight gondolas going round. Hop in one at the bottom, ride up, and jump out at
// the top onto the Sky Deck (where the coaster starts). It's stuck when Spartacus arrives: it
// takes a GIANT woof (Mega-Me) to get it turning, and then it never stops.
// The wheel turns in the x-y plane; gondolas hang from the rim and stay upright.
import * as THREE from 'three';
import { vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { toast, hintOnce } from '../../core/ui.js';
import { addBox, addCylinder } from '../../core/colliders.js';
import { terrainHeight } from '../../world/terrain.js';
import { player } from '../../player/player.js';
import { startRide, endRide, jumpPressed } from '../../systems/rides.js';
import { bulbMaterial } from './decor.js';

const GONDOLAS = 8;
const TURN_TIME = 26; // seconds for one turn once it's going
const SEAT_DROP = 2; // his feet are this far below the gondola's hook on the rim
const HOP_IN_REACH = 3; // how close a gondola has to be
const WOOF_REACH = 30; // how close a giant woof has to be to start the wheel
const GONDOLA_COLORS = [
  0xff5a5a, 0xff9a3d, 0xffd84d, 0x5fd66a, 0x5aa8ff, 0xb06cff, 0xff8fd0, 0x4cd6c8,
];

// at: world {x, z} of the wheel's foot; deck: the Sky Deck {x, z, hw, hd, height} (world x, z).
// Returns {deckTop, seatAt(angle), update(dt), action(p), interact(p), bark(p), start({quiet}), on()}
export function buildWheel(at, { radius, hubHeight, deck }) {
  const ground = terrainHeight(at.x, at.z),
    hub = vec3(at.x, ground + hubHeight, at.z);
  // angle: the wheel's turn (radians); speed: radians per second (eases up once it's started)
  const wheel = { hub, radius, angle: 0, speed: 0, on: false, gondolas: [] };
  wheel.rim = makeRim(wheel);
  makeFrame(wheel, ground);
  for (let i = 0; i < GONDOLAS; i++) wheel.gondolas.push(makeGondola(GONDOLA_COLORS[i]));
  const deckTop = ground + deck.height;
  makeSkyDeck(deck, { ground, top: deckTop });
  makeBoardingDeck(wheel, ground);
  placeGondolas(wheel);

  const hookAt = (angle) =>
    vec3(hub.x + Math.cos(angle) * radius, hub.y + Math.sin(angle) * radius, hub.z);
  // where a rider's feet are, in a gondola `angle` round from 3 o'clock
  const seatAt = (angle) => {
    const seat = hookAt(angle);
    seat.y -= SEAT_DROP;
    return seat;
  };
  const seatOf = (i) => seatAt(wheel.angle + (i / GONDOLAS) * Math.PI * 2);
  // the gondola close enough to hop into from where he's standing
  const gondolaNear = (p) => {
    for (let i = 0; i < GONDOLAS; i++) {
      const seat = seatOf(i);
      if (Math.hypot(p.x - seat.x, p.z - seat.z) < HOP_IN_REACH && Math.abs(p.y - seat.y) < 2)
        return i;
    }
    return -1;
  };

  function start({ quiet = false } = {}) {
    if (wheel.on) return;
    wheel.on = true;
    if (quiet) {
      wheel.speed = (Math.PI * 2) / TURN_TIME;
      return;
    }
    sfx.creak();
    burst(hub.clone(), {
      count: 40,
      color: GONDOLA_COLORS,
      speed: 8,
      up: 2,
      life: 1.4,
      size: 1.3,
      confetti: true,
    });
    toast('WOOOOF! The Big Wheel is turning again!', 3200);
  }

  return {
    deckTop,
    on: () => wheel.on,
    start,
    seatAt,
    update(dt) {
      const full = (Math.PI * 2) / TURN_TIME;
      wheel.speed = wheel.on ? Math.min(full, wheel.speed + (full / 3) * dt) : 0;
      wheel.angle += wheel.speed * dt;
      placeGondolas(wheel);
    },
    action(p) {
      if (!player.grounded || player.giant) return null;
      const i = gondolaNear(p);
      return i < 0
        ? null
        : { label: 'Hop in', run: () => rideGondola(wheel, { seatOf, i, deckTop }) };
    },
    interact(p) {
      const near = Math.hypot(p.x - hub.x, p.z - hub.z) < 16 && p.y < ground + 5;
      if (!near) return;
      if (!wheel.on)
        hintOnce('wheelStuck', 'The Big Wheel is stuck! It needs a GIANT woof to get going…', 3800);
      else hintOnce('wheelGo', 'Hop in a gondola and ride to the top!', 3000);
    },
    // a giant woof nearby starts it; returns true if this woof did
    bark(p) {
      if (wheel.on || !player.giant) return false;
      if (Math.hypot(p.x - hub.x, p.z - hub.z) > WOOF_REACH) return false;
      start();
      return true;
    },
  };
}

// the turning part: two rings, spokes and a ring of light bulbs
function makeRim(wheel) {
  const rim = new THREE.Group();
  rim.position.copy(wheel.hub);
  scene.add(rim);
  const { radius } = wheel,
    white = material(0xfffaf0),
    red = material(0xf2545b);
  for (const side of [-1, 1]) {
    const ring = mesh(new THREE.TorusGeometry(radius, 0.2, 6, 48), red, { castShadow: false });
    ring.position.z = side * 1.15;
    rim.add(ring);
    const inner = mesh(new THREE.TorusGeometry(radius * 0.55, 0.12, 6, 36), white, {
      castShadow: false,
    });
    inner.position.z = side * 1.15;
    rim.add(inner);
    for (let k = 0; k < GONDOLAS / 2; k++) {
      const spoke = mesh(new THREE.BoxGeometry(radius * 2, 0.16, 0.16), white, {
        castShadow: false,
      });
      spoke.rotation.z = (k / GONDOLAS) * Math.PI * 2;
      spoke.position.z = side * 1.15;
      rim.add(spoke);
    }
  }
  // the bar each gondola hangs from, and the bulbs
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6), bulbMaterial(), 32);
  const matrix = new THREE.Matrix4();
  for (let k = 0; k < 32; k++) {
    const angle = (k / 32) * Math.PI * 2;
    matrix.setPosition(Math.cos(angle) * radius, Math.sin(angle) * radius, k % 2 ? 1.4 : -1.4);
    bulbs.setMatrixAt(k, matrix);
  }
  rim.add(bulbs);
  for (let k = 0; k < GONDOLAS; k++) {
    const angle = (k / GONDOLAS) * Math.PI * 2,
      bar = mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.3, 6), white, { castShadow: false });
    bar.rotation.x = Math.PI / 2;
    bar.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    rim.add(bar);
  }
  const cap = mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.9, 16), material(0xffd84d));
  cap.rotation.x = Math.PI / 2;
  rim.add(cap);
  return rim;
}

// two A-frames holding the hub up
function makeFrame(wheel, ground) {
  const { hub } = wheel,
    blue = material(0x3d6fd9);
  for (const side of [-1, 1])
    for (const lean of [-1, 1]) {
      const foot = vec3(hub.x + lean * 6.5, ground, hub.z + side * 2),
        top = vec3(hub.x, hub.y, hub.z + side * 1.6),
        length = foot.distanceTo(top);
      const leg = mesh(new THREE.CylinderGeometry(0.28, 0.36, length, 8), blue);
      leg.position.copy(foot).lerp(top, 0.5);
      leg.quaternion.setFromUnitVectors(vec3(0, 1, 0), top.clone().sub(foot).normalize());
      scene.add(leg);
      addCylinder(foot.x, foot.z, { r: 0.5, bottom: ground - 1, top: ground + 3.2 });
    }
}

// a tub under a little roof (he stands on the tub, so his paws peek over its edge); the
// group's origin is the hook on the rim
function makeGondola(color) {
  const g = new THREE.Group(),
    paint = material(color),
    white = material(0xfffaf0);
  const tub = mesh(new THREE.CylinderGeometry(0.95, 0.8, 0.75, 14), paint);
  tub.position.y = -SEAT_DROP + 0.3;
  g.add(tub);
  const roof = mesh(new THREE.ConeGeometry(1.05, 0.5, 14), paint);
  roof.position.y = 0.15;
  g.add(roof);
  for (const side of [-1, 1]) {
    const pole = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 5), white, { castShadow: false });
    pole.position.set(side * 0.85, -0.85, 0);
    g.add(pole);
  }
  scene.add(g);
  return g;
}

function placeGondolas(wheel) {
  const { hub, radius, angle, gondolas } = wheel;
  wheel.rim.rotation.z = angle;
  gondolas.forEach((gondola, i) => {
    const at = angle + (i / gondolas.length) * Math.PI * 2;
    gondola.position.set(hub.x + Math.cos(at) * radius, hub.y + Math.sin(at) * radius, hub.z);
    gondola.rotation.z = Math.sin(game.time * 1.4 + i) * 0.05; // a gentle sway
  });
}

// the Sky Deck: a wooden platform on four tall striped poles, beside the top of the wheel
function makeSkyDeck(deck, { ground, top }) {
  const wood = material(0xd9a46a);
  const floor = mesh(new THREE.BoxGeometry(deck.hw * 2, 0.5, deck.hd * 2), wood, {
    receiveShadow: true,
  });
  floor.position.set(deck.x, top - 0.25, deck.z);
  scene.add(floor);
  // thin, so he can walk underneath it
  addBox(deck.x, deck.z, { hw: deck.hw, hd: deck.hd, bottom: top - 0.5, top });
  for (const sideX of [-1, 1])
    for (const sideZ of [-1, 1]) {
      const x = deck.x + sideX * (deck.hw - 0.5),
        z = deck.z + sideZ * (deck.hd - 0.5),
        pole = mesh(new THREE.CylinderGeometry(0.3, 0.36, top - ground, 8), material(0xf2545b));
      pole.position.set(x, (ground + top) / 2, z);
      scene.add(pole);
      addCylinder(x, z, { r: 0.4, bottom: ground - 1, top: top - 0.5 });
    }
  // a rail along the back and the west end (the wheel side and the coaster's end stay open)
  const rail = material(0xfffaf0);
  const back = mesh(new THREE.BoxGeometry(deck.hw * 2, 0.12, 0.12), rail, { castShadow: false });
  back.position.set(deck.x, top + 0.9, deck.z + deck.hd - 0.1);
  scene.add(back);
  const end = mesh(new THREE.BoxGeometry(0.12, 0.12, deck.hd * 2), rail, { castShadow: false });
  end.position.set(deck.x - deck.hw + 0.1, top + 0.9, deck.z);
  scene.add(end);
}

// steps up to where the bottom gondola passes, on the south side
function makeBoardingDeck(wheel, ground) {
  const { hub, radius } = wheel,
    top = hub.y - radius - SEAT_DROP - 0.1,
    wood = material(0xc48a54);
  const steps = [
    [3.2, top],
    [5.6, ground + (top - ground) * 0.66],
    [6.6, ground + (top - ground) * 0.33],
  ];
  // [how far south of the wheel it reaches, its top]: the deck, then two steps down
  let from = 1.05;
  for (const [reach, stepTop] of steps) {
    const depth = reach - from,
      z = hub.z + from + depth / 2,
      block = mesh(new THREE.BoxGeometry(5, stepTop - ground + 0.4, depth), wood, {
        receiveShadow: true,
      });
    block.position.set(hub.x, (ground - 0.4 + stepTop) / 2, z);
    scene.add(block);
    addBox(hub.x, z, { hw: 2.5, hd: depth / 2, bottom: ground - 1, top: stepTop });
    from = reach;
  }
}

// sitting in gondola i: he goes round with it until Jump hops him out
function rideGondola(wheel, { seatOf, i, deckTop }) {
  if (!wheel.on) toast('It doesn’t move… The wheel needs a GIANT woof!', 3000);
  sfx.grab();
  const ride = {
    update(dt) {
      const before = player.pos.clone();
      player.pos.copy(seatOf(i));
      player.yaw = 0; // looking south, over the fair
      const vel = player.pos.clone().sub(before).divideScalar(Math.max(dt, 1e-3));
      if (player.pos.y > deckTop + 0.6)
        hintOnce('wheelTop', 'Jump out now to land on the Sky Deck!', 3200);
      if (!jumpPressed()) return;
      // out of the tub towards the south (the Sky Deck is on that side), keeping the wheel's speed
      endRide(vec3(vel.x, 8.5, 8));
      sfx.jump();
    },
  };
  startRide(ride);
  hintOnce('wheelOut', 'Press Jump to hop out.', 2600);
}
