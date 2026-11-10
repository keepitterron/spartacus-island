// The funfair's scenery: the welcome arch, the Big Top, stalls, lamps, bunting, balloons, hay
// and the Fuzzles' little houses. Lamps and bunting are collected while building and drawn as
// two instanced meshes (finishDecor); every bulb shares one material that glows brighter at night.
import * as THREE from 'three';
import { vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh, canvasTexture } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { onFontsReady } from '../../core/fx.js';
import { addBox, addCylinder } from '../../core/colliders.js';
import { terrainHeight } from '../../world/terrain.js';

const PARTY_COLORS = [0xff5a5a, 0xffd84d, 0x5fd66a, 0x5aa8ff, 0xb06cff, 0xff8fd0];
// made the first time they're needed (never at module load, see docs/architecture.md)
const look = {};
// waiting for finishDecor: bulbs as positions, flags as {matrix, color}
const pending = { bulbs: [], flags: [] };
const balloons = []; // {g, y, phase}

// every light bulb at the fair (lamps, the arch, the wheel's rim)
export const bulbMaterial = () => {
  look.bulb ??= new THREE.MeshStandardMaterial({
    color: 0xfff3b0,
    emissive: 0xffc93c,
    emissiveIntensity: 0.4,
  });
  return look.bulb;
};

// red and white stripes going up (tents, poles, awnings); `count` stripes across
const stripeTexture = (count, color = '#f2545b') =>
  canvasTexture(count * 16, 16, (ctx, w, h) => {
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color;
    for (let i = 0; i < count; i += 2) ctx.fillRect(i * 16, 0, 16, h);
  });
const striped = () => {
  look.striped ??= new THREE.MeshStandardMaterial({ map: stripeTexture(12), roughness: 0.8 });
  return look.striped;
};

// the welcome arch: two striped poles, a sign across the top and a row of bulbs.
// Returns the top of the sign (Leo perches there).
export function addArch(x, z) {
  const ground = terrainHeight(x, z),
    half = 4.2,
    height = 8.6; // tall, so the sign is above the camera's view of a dog who just walked under it
  for (const side of [-1, 1]) {
    const pole = mesh(new THREE.CylinderGeometry(0.4, 0.5, height, 10), striped());
    pole.position.set(x + side * half, ground + height / 2, z);
    scene.add(pole);
    const ball = mesh(new THREE.SphereGeometry(0.6, 12, 10), material(0xffd84d));
    ball.position.set(x + side * half, ground + height + 0.4, z);
    scene.add(ball);
    addCylinder(x + side * half, z, { r: 0.55, bottom: ground - 1, top: ground + height });
  }
  for (let i = 0; i <= 10; i++)
    pending.bulbs.push(
      vec3(x - half + 0.6 + i * ((half * 2 - 1.2) / 10), ground + height - 1.3, z),
    );
  // the sign's letters need the game font
  onFontsReady(() => {
    const sign = mesh(new THREE.BoxGeometry(half * 2 + 0.6, 1.5, 0.3), [
      material(0xb5403f),
      material(0xb5403f),
      material(0xb5403f),
      material(0xb5403f),
      new THREE.MeshStandardMaterial({ map: signTexture('JAMBOREE!'), roughness: 0.7 }),
      new THREE.MeshStandardMaterial({ map: signTexture('SEE YOU SOON!'), roughness: 0.7 }),
    ]);
    sign.position.set(x, ground + height - 0.2, z);
    scene.add(sign);
  });
  return vec3(x, ground + height + 0.55, z);
}

const signTexture = (text) =>
  canvasTexture(512, 96, (ctx, w, h) => {
    ctx.fillStyle = '#e8463f';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffd84d';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.font = '700 56px Fredoka, ui-rounded, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fffaf0';
    ctx.fillText(text, w / 2, h / 2 + 4);
  });

// the Big Top: a round striped tent with a pointed roof and a flag, the show's backdrop
export function addBigTop(x, z, { radius }) {
  const ground = terrainHeight(x, z),
    wall = 4.5,
    roof = 6;
  look.tent ??= new THREE.MeshStandardMaterial({ map: stripeTexture(24), roughness: 0.85 });
  const drum = mesh(new THREE.CylinderGeometry(radius, radius, wall, 24), look.tent, {
    receiveShadow: true,
  });
  drum.position.set(x, ground + wall / 2, z);
  scene.add(drum);
  const cone = mesh(new THREE.ConeGeometry(radius + 0.7, roof, 24), look.tent);
  cone.position.set(x, ground + wall + roof / 2, z);
  scene.add(cone);
  const pole = mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 5), material(0xfffaf0));
  pole.position.set(x, ground + wall + roof + 1, z);
  scene.add(pole);
  const flag = mesh(new THREE.ConeGeometry(0.5, 1.3, 3), material(0xffd84d), { castShadow: false });
  flag.rotation.z = -Math.PI / 2;
  flag.position.set(x + 0.7, ground + wall + roof + 1.8, z);
  scene.add(flag);
  const door = mesh(new THREE.CircleGeometry(1.5, 16, 0, Math.PI), material(0x3a2a4a), {
    castShadow: false,
  });
  door.position.set(x, ground, z + radius + 0.02);
  door.scale.y = 1.6;
  scene.add(door);
  addCylinder(x, z, { r: radius, bottom: ground - 1, top: ground + wall + roof });
}

// a stall: a counter under a striped awning on four posts. Its flat roof is `ROOF` high: too
// high to jump onto, but a Mega-Me dog steps up. Returns the roof's height.
const ROOF = 2.9;
export function addStall(x, z, { color = 0x5aa8ff, goods = 0xffd84d } = {}) {
  const ground = terrainHeight(x, z),
    top = ground + ROOF;
  const counter = mesh(new THREE.BoxGeometry(3, 1.1, 1.8), material(0xd4955a), {
    receiveShadow: true,
  });
  counter.position.set(x, ground + 0.55, z);
  scene.add(counter);
  for (const sideX of [-1, 1])
    for (const sideZ of [-1, 1]) {
      const post = mesh(new THREE.CylinderGeometry(0.08, 0.08, ROOF, 5), material(0xfffaf0), {
        castShadow: false,
      });
      post.position.set(x + sideX * 1.5, ground + ROOF / 2, z + sideZ * 0.95);
      scene.add(post);
    }
  const awning = mesh(new THREE.BoxGeometry(3.6, 0.22, 2.5), material(color));
  awning.position.set(x, top - 0.11, z);
  scene.add(awning);
  const trim = mesh(new THREE.BoxGeometry(3.7, 0.3, 0.1), material(0xfffaf0), {
    castShadow: false,
  });
  trim.position.set(x, top - 0.3, z + 1.25);
  scene.add(trim);
  // things for sale on the counter
  for (let i = -1; i <= 1; i++) {
    const thing = mesh(new THREE.SphereGeometry(0.28, 8, 6), material(goods));
    thing.position.set(x + i * 0.85, ground + 1.35, z + 0.2);
    scene.add(thing);
  }
  addBox(x, z, { hw: 1.8, hd: 1.25, bottom: ground - 1, top });
  return top;
}

// a lamp post with a glowing bulb on top
export function addLamp(x, z) {
  const ground = terrainHeight(x, z);
  const pole = mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.4, 6), material(0x3d4a6b));
  pole.position.set(x, ground + 1.7, z);
  scene.add(pole);
  pending.bulbs.push(vec3(x, ground + 3.55, z));
  addCylinder(x, z, { r: 0.2, bottom: ground - 1, top: ground + 3.4 });
  return vec3(x, ground + 3.4, z);
}

// a string of little flags from a to b (Vector3s), sagging in the middle
export function addBunting(a, b) {
  const count = Math.max(4, Math.round(a.distanceTo(b) / 0.9)),
    turn = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2,
    matrix = new THREE.Matrix4();
  for (let i = 1; i < count; i++) {
    const t = i / count,
      pos = a.clone().lerp(b, t);
    pos.y -= Math.sin(Math.PI * t) * 0.9 + 0.3;
    matrix.makeRotationY(turn).setPosition(pos);
    pending.flags.push({ matrix: matrix.clone(), color: PARTY_COLORS[i % PARTY_COLORS.length] });
  }
}

// a bunch of three balloons tied to the ground at (x, z)
export function addBalloons(x, z) {
  const ground = terrainHeight(x, z),
    g = new THREE.Group();
  look.balloon ??= new THREE.SphereGeometry(0.5, 12, 10);
  for (let i = 0; i < 3; i++) {
    const balloon = mesh(
      look.balloon,
      material(PARTY_COLORS[(balloons.length + i * 2) % PARTY_COLORS.length], { roughness: 0.3 }),
      { castShadow: false },
    );
    balloon.scale.y = 1.2;
    balloon.position.set((i - 1) * 0.55, 3 + (i % 2) * 0.5, (i % 2) * 0.3);
    g.add(balloon);
    const string = mesh(new THREE.CylinderGeometry(0.015, 0.015, 3, 3), material(0xfffaf0), {
      castShadow: false,
    });
    string.position.set((i - 1) * 0.27, 1.5, (i % 2) * 0.15);
    string.rotation.z = -(i - 1) * 0.18;
    g.add(string);
  }
  g.position.set(x, ground, z);
  scene.add(g);
  balloons.push({ g, y: ground, phase: balloons.length * 1.7 });
}

// a big soft haystack to land on; returns its top height
export function addHay(x, z) {
  const ground = terrainHeight(x, z),
    height = 1.1;
  const stack = mesh(new THREE.CylinderGeometry(2.6, 2.9, height, 14), material(0xf2c94c), {
    receiveShadow: true,
  });
  stack.position.set(x, ground + height / 2, z);
  scene.add(stack);
  const band = mesh(new THREE.TorusGeometry(2.78, 0.07, 5, 20), material(0xc48a54), {
    castShadow: false,
  });
  band.rotation.x = Math.PI / 2;
  band.position.set(x, ground + height * 0.5, z);
  scene.add(band);
  addCylinder(x, z, { r: 2.7, bottom: ground - 1, top: ground + height });
  return ground + height;
}

// red and white rings painted on the ground: where a cannon shot comes down
export function addBullseye(x, z) {
  const texture = canvasTexture(128, 128, (ctx, w) => {
    ['#f2545b', '#fffaf0', '#f2545b', '#fffaf0', '#f2545b'].forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(w / 2, w / 2, (w / 2) * (1 - i * 0.2), 0, 7);
      ctx.fill();
    });
  });
  const target = mesh(
    new THREE.CylinderGeometry(3, 3.1, 0.3, 24),
    [material(0xf2545b), new THREE.MeshStandardMaterial({ map: texture }), material(0xf2545b)],
    { castShadow: false, receiveShadow: true },
  );
  const ground = terrainHeight(x, z);
  target.position.set(x, ground + 0.1, z);
  scene.add(target);
  addCylinder(x, z, { r: 3, bottom: ground - 1, top: ground + 0.25 });
  return ground + 0.25;
}

// a Fuzzle's house: a tiny cottage with a pointed roof and a round door
export function addTinyHouse(x, z, { color, yaw = 0 }) {
  const ground = terrainHeight(x, z),
    g = new THREE.Group();
  const walls = mesh(new THREE.BoxGeometry(1.5, 1.1, 1.5), material(0xfff1d6));
  walls.position.y = 0.55;
  g.add(walls);
  const roof = mesh(new THREE.ConeGeometry(1.25, 1, 4), material(color));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 1.6;
  g.add(roof);
  const door = mesh(new THREE.CircleGeometry(0.3, 10), material(0x7a4a2a), { castShadow: false });
  door.position.set(0, 0.34, 0.76);
  g.add(door);
  g.position.set(x, ground, z);
  g.rotation.y = yaw;
  scene.add(g);
  addBox(x, z, { hw: 0.8, hd: 0.8, bottom: ground - 1, top: ground + 1.1 });
}

// once everything is placed: one instanced mesh for every bulb, one for every bunting flag
export function finishDecor() {
  const bulbs = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.22, 8, 6),
    bulbMaterial(),
    pending.bulbs.length,
  );
  const matrix = new THREE.Matrix4();
  pending.bulbs.forEach((pos, i) => bulbs.setMatrixAt(i, matrix.setPosition(pos)));
  bulbs.computeBoundingSphere();
  scene.add(bulbs);
  // a flag is a little triangle hanging point-down from the string
  const flagShape = new THREE.BufferGeometry();
  flagShape.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-0.3, 0, 0, 0.3, 0, 0, 0, -0.6, 0], 3),
  );
  flagShape.computeVertexNormals();
  const flags = new THREE.InstancedMesh(
    flagShape,
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    pending.flags.length,
  );
  const color = new THREE.Color();
  pending.flags.forEach((flag, i) => {
    flags.setMatrixAt(i, flag.matrix);
    flags.setColorAt(i, color.set(flag.color));
  });
  flags.computeBoundingSphere();
  scene.add(flags);
}

// balloons bob on their strings; the bulbs glow (brightly at night: 0 day … 1 night)
export function updateDecor(night) {
  bulbMaterial().emissiveIntensity = 0.4 + night * 2.4 + Math.sin(game.time * 3) * 0.1 * night;
  for (const balloon of balloons) {
    balloon.g.position.y = balloon.y + Math.sin(game.time * 1.3 + balloon.phase) * 0.12;
    balloon.g.rotation.z = Math.sin(game.time * 0.9 + balloon.phase) * 0.06;
  }
}
