// Jelly Jumps: wobbly jellies that bounce Spartacus up, each one playing a note. Holding Jump
// bounces higher, and a Slam (ground pound) onto one is a MEGA bounce. Jellies stand on
// candy-striped stands of different heights, so a row of them is a staircase. The cake at the
// end is the top step.
import * as THREE from 'three';
import { vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh, canvasTexture } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { hintOnce } from '../../core/ui.js';
import { isJumpHeld } from '../../core/input.js';
import { addCylinder, inFootprint } from '../../core/colliders.js';
import { terrainHeight } from '../../world/terrain.js';
import { player } from '../../player/player.js';

// upward speed of each kind of bounce (gravity is 30, so they rise about 3.75, 6 and 12)
const BOUNCE = { plain: 15, held: 19, slam: 27 };
const DOME_HEIGHT = 1.1; // the wobbly part; anything taller stands on a striped stand
const COLORS = [0xff5fa2, 0x7ddc4a, 0xffa53d, 0x6c8cff, 0xffe04d, 0xb06cff];
// one note each, going up the scale (C major pentatonic from C5)
const NOTES = [523, 587, 659, 784, 880, 1047];

// {x, z, top, r, col, dome, color, hz, squash, squashVel, slammed, squished}
const jellies = [];

// a jelly whose flat top is `height` above the ground at (x, z)
export function addJelly(x, z, { height, radius = 1.8 }) {
  const ground = terrainHeight(x, z),
    top = ground + height,
    index = jellies.length,
    color = COLORS[index % COLORS.length],
    domeHeight = Math.min(height, DOME_HEIGHT);
  if (height > DOME_HEIGHT) addStand(x, z, { ground, top: top - domeHeight, radius });
  // a jelly-mould shape: a cone with its point cut off, so the top is flat to land on
  const geometry = new THREE.CylinderGeometry(radius * 0.8, radius, domeHeight, 20);
  geometry.translate(0, domeHeight / 2, 0); // it squashes down towards its base
  const dome = mesh(
    geometry,
    material(color, {
      transparent: true,
      opacity: 0.84,
      roughness: 0.15,
      emissive: color,
      emissiveIntensity: 0.25,
      flatShading: false,
    }),
    { castShadow: false },
  );
  dome.position.set(x, top - domeHeight, z);
  scene.add(dome);
  const col = addCylinder(x, z, { r: radius * 0.88, bottom: ground - 1, top });
  const jelly = { x, z, top, r: radius, col, dome, color, hz: NOTES[index % NOTES.length] };
  Object.assign(jelly, { squash: 1, squashVel: 0, slammed: false, squished: false });
  jellies.push(jelly);
  return jelly;
}

const stripes = () =>
  canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff7aa8';
    for (let i = -1; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 16, h);
      ctx.lineTo(i * 16 + 8, h);
      ctx.lineTo(i * 16 + 8 + 32, 0);
      ctx.lineTo(i * 16 + 32, 0);
      ctx.fill();
    }
  });
const look = {};

// the candy-striped column and plate a tall jelly stands on
function addStand(x, z, { ground, top, radius }) {
  look.stand ??= new THREE.MeshStandardMaterial({ map: stripes(), roughness: 0.7 });
  const height = top - ground;
  const column = mesh(
    new THREE.CylinderGeometry(radius * 0.45, radius * 0.55, height, 12),
    look.stand,
  );
  column.position.set(x, ground + height / 2, z);
  scene.add(column);
  const plate = mesh(
    new THREE.CylinderGeometry(radius * 1.08, radius * 0.9, 0.16, 20),
    material(0xfffaf0),
  );
  plate.position.set(x, top - 0.08, z);
  scene.add(plate);
}

// the jelly Spartacus is on (reach: how far above or below its top still counts)
const jellyUnder = (pos, reach) =>
  jellies.find((jelly) => inFootprint(jelly.col, pos, 0.15) && Math.abs(pos.y - jelly.top) < reach);

// every frame: landing on a jelly bounces him straight back up
export function bounceOnJellies() {
  const jelly = player.grounded && !player.ride ? jellyUnder(player.pos, 0.1) : null;
  for (const other of jellies) if (other !== jelly) other.squished = false;
  if (!jelly) return;
  if (player.giant) {
    squish(jelly);
    return;
  }
  let speed = BOUNCE.plain;
  if (isJumpHeld() || player.jumpBuffer > 0) speed = BOUNCE.held;
  if (jelly.slammed) speed = BOUNCE.slam;
  launch(jelly, speed);
}

// a ground pound landed at pos: on a jelly, the next bounce is the big one. (The pound's landing
// stops him this frame; bounceOnJellies sends him up on the next.)
export function slamJelly(pos) {
  const jelly = jellyUnder(pos, 0.6);
  if (!jelly || player.giant) return false;
  jelly.slammed = true;
  return true;
}

function launch(jelly, speed) {
  const mega = speed === BOUNCE.slam;
  jelly.slammed = false;
  player.vel.y = speed;
  player.grounded = false;
  player.pos.y += 0.02;
  // this bounce is the jump: don't let a buffered Jump press replace it with a smaller hop
  player.coyoteTimer = 0;
  player.jumpBuffer = 0;
  player.poundRecover = 0;
  player.squashVel = 5;
  jelly.squashVel = mega ? -9 : -5;
  sfx.note(jelly.hz);
  if (mega) sfx.boing();
  burst(vec3(jelly.x, jelly.top + 0.2, jelly.z), {
    count: mega ? 26 : 10,
    color: [jelly.color, 0xffffff],
    speed: mega ? 6 : 3,
    up: 3,
    life: 0.7,
    size: mega ? 1.3 : 0.9,
  });
  if (mega) hintOnce('jellyMega', 'MEGA BOING! A Slam on a jelly sends you sky high!', 3000);
  else hintOnce('jelly', 'Boing! Hold Jump to bounce higher.', 3000);
}

// a giant dog is too heavy to bounce: the jelly just goes flat with a wobble
function squish(jelly) {
  if (jelly.squished) return;
  jelly.squished = true;
  jelly.squashVel = -12;
  sfx.note(jelly.hz / 2);
  hintOnce('jellySquish', 'Squelch! A giant dog is too heavy to bounce.', 2800);
}

// each jelly wobbles on a spring: a bounce kicks it, it settles; plus a slow idle jiggle
export function updateJellies(dt) {
  for (const jelly of jellies) {
    jelly.squashVel += (1 - jelly.squash) * 160 * dt;
    jelly.squashVel *= Math.exp(-dt * 5);
    jelly.squash = Math.max(0.3, jelly.squash + jelly.squashVel * dt);
    const idle = 1 + Math.sin(game.time * 2.4 + jelly.x) * 0.03,
      tall = jelly.squash * idle,
      wide = 1 / Math.sqrt(tall);
    jelly.dome.scale.set(wide, tall, wide);
  }
}

// is Spartacus standing right beside jelly number `index`, lower than its top? (for hints)
export function belowJelly(index, pos) {
  const jelly = jellies[index];
  return Math.hypot(pos.x - jelly.x, pos.z - jelly.z) < jelly.r + 3 && pos.y < jelly.top - 1;
}
export const onJelly = (index, pos) => jellyUnder(pos, 0.3) === jellies[index];

/* ---------------- the cake ---------------- */

// A three-tier cake to climb: tiers as [radius, top (above the ground)], widest first.
// Returns the middle of its top tier and of its middle tier (for the rocket and a ticket).
export function addCake(x, z, { tiers }) {
  const ground = terrainHeight(x, z),
    sponge = [0xf7c9de, 0xfff1d6, 0xd9a0f0],
    icing = [0xffffff, 0xff8fb8, 0xffffff];
  let bottom = ground;
  tiers.forEach(([radius, height], i) => {
    const top = ground + height,
      tall = top - bottom;
    const tier = mesh(new THREE.CylinderGeometry(radius, radius, tall, 28), material(sponge[i]), {
      receiveShadow: true,
    });
    tier.position.set(x, bottom + tall / 2, z);
    scene.add(tier);
    // a ring of icing round the top edge, with blobs dripping down the side
    const ring = mesh(new THREE.TorusGeometry(radius, 0.22, 8, 28), material(icing[i]), {
      castShadow: false,
    });
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, top - 0.05, z);
    scene.add(ring);
    const blobs = Math.round(radius * 3);
    for (let k = 0; k < blobs; k++) {
      const angle = (k / blobs) * Math.PI * 2,
        drip = mesh(new THREE.SphereGeometry(0.26, 8, 6), material(icing[i]), {
          castShadow: false,
        });
      drip.scale.y = 1.4 + (k % 3) * 0.7;
      drip.position.set(x + Math.cos(angle) * radius, top - 0.35, z + Math.sin(angle) * radius);
      scene.add(drip);
    }
    addCylinder(x, z, { r: radius, bottom: ground - 1, top });
    bottom = top;
  });
  addCherries(x, z, { radius: tiers[0][0] - 0.7, y: ground + tiers[0][1] });
  const [, middle] = tiers[1],
    [topRadius, topHeight] = tiers[2];
  addCandle(x - topRadius + 0.6, z, { y: ground + topHeight });
  return {
    top: vec3(x + 0.4, ground + topHeight, z),
    // on the middle tier's rim, on the side the jellies come from
    middle: vec3(x + tiers[1][0] - 0.9, ground + middle, z + 0.4),
  };
}

function addCherries(x, z, { radius, y }) {
  for (let k = 0; k < 8; k++) {
    const angle = (k / 8) * Math.PI * 2 + 0.3,
      cherry = mesh(new THREE.SphereGeometry(0.3, 10, 8), material(0xe8332f, { roughness: 0.3 }));
    cherry.position.set(x + Math.cos(angle) * radius, y + 0.28, z + Math.sin(angle) * radius);
    scene.add(cherry);
  }
}

// one big candle; its flame glows (brighter at night, with the fair's other lights)
function addCandle(x, z, { y }) {
  const candle = mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 1.3, 8),
    look.stand ?? material(0xff7aa8),
  );
  candle.position.set(x, y + 0.65, z);
  scene.add(candle);
  const flame = mesh(
    new THREE.SphereGeometry(0.18, 8, 6),
    material(0xffd84d, { emissive: 0xffa53d, emissiveIntensity: 1.6 }),
    { castShadow: false },
  );
  flame.scale.y = 1.6;
  flame.position.set(x, y + 1.55, z);
  scene.add(flame);
}
