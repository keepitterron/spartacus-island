// The Jamboree fireworks. A firework is a "shell": one THREE.Points whose sparks fly out from a
// centre to their places, hang there twinkling and sag as they fade. A burst's places are spread
// over a ball; a picture's (a paw, a heart, a name) are laid out flat, facing the audience.
// The show itself is a short cutscene: Spartacus pushes the fuse box, the five rockets go up
// one by one, then the pictures, the last of which spells the name of the girl this fair was
// built for. Afterwards a woof by the stand at night sends up another one, any time.
import * as THREE from 'three';
import { $, clamp, vec3 } from '../../core/util.js';
import { scene, camera } from '../../core/renderer.js';
import { canvasTexture } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { toast } from '../../core/ui.js';
import { player } from '../../player/player.js';
import { updatePowerHud } from '../../systems/powers.js';
import { hideWin } from '../../game/tasks.js';
import { exciteFuzzles, gatherFuzzles, scatterFuzzles } from './fuzzles.js';
import { allRockets, hideRocket, pushPlunger } from './rockets.js';

const NAME = 'ZOË';
const SKY = { back: 46, height: 33 }; // the pictures hang this far north of the stand, this high
const CAMERA = { back: 17, side: 4, up: 2.4 }; // where the audience's view is, from the stand
const CLIMB_TIME = 1.1; // seconds a rocket takes to reach the sky
const BURST_COLORS = [0xff5a5a, 0xffd84d, 0x5fd66a, 0x5aa8ff, 0xb06cff, 0xff8fd0, 0xffa53d];

// {points, offsets (Float32Array: where each spark ends up, from the centre), center, age, life,
//  grow (how fast they fly out), sag (how fast they sink)}
const shells = [];
const look = {};

// a soft round dot, so sparks glow instead of being square
const sparkTexture = () =>
  canvasTexture(64, 64, (ctx, w) => {
    const glow = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    glow.addColorStop(0, 'rgba(255,255,255,1)');
    glow.addColorStop(0.35, 'rgba(255,255,255,0.8)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, w);
  });

// offsets: [[x, y, z], …] from the centre; colors: one hex colour per spark, or one for all
function addShell(center, { offsets, colors, life, grow, sag, size = 1.2 }) {
  look.spark ??= sparkTexture();
  const count = offsets.length,
    positions = new Float32Array(count * 3),
    tints = new Float32Array(count * 3),
    color = new THREE.Color();
  offsets.forEach((offset, i) => {
    positions.set([center.x, center.y, center.z], i * 3);
    color.set(Array.isArray(colors) ? colors[i % colors.length] : colors);
    // a few white-hot sparks in every shell
    if (i % 7 === 0) color.lerp(new THREE.Color(0xffffff), 0.7);
    tints.set([color.r, color.g, color.b], i * 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(tints, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size,
      map: look.spark,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  points.frustumCulled = false; // its sparks move every frame
  scene.add(points);
  shells.push({
    points,
    offsets: new Float32Array(offsets.flat()),
    center,
    age: 0,
    life,
    grow,
    sag,
  });
}

// every frame, show or not: sparks fly out, twinkle, sink and fade; spent shells are removed
export function updateFireworks(dt) {
  for (let i = shells.length - 1; i >= 0; i--) {
    const shell = shells[i],
      { points, offsets, center } = shell;
    shell.age += dt;
    const out = 1 - Math.exp(-shell.grow * shell.age),
      sunk = shell.sag * shell.age * shell.age,
      positions = points.geometry.attributes.position;
    for (let k = 0; k < positions.count; k++)
      positions.setXYZ(
        k,
        center.x + offsets[k * 3] * out,
        center.y + offsets[k * 3 + 1] * out - sunk,
        center.z + offsets[k * 3 + 2] * out,
      );
    positions.needsUpdate = true;
    const left = shell.life - shell.age;
    points.material.opacity = clamp(left / 0.9, 0, 1) * (0.85 + 0.15 * Math.sin(shell.age * 30));
    if (left > 0) continue;
    scene.remove(points);
    points.geometry.dispose();
    points.material.dispose();
    shells.splice(i, 1);
  }
  updateEncores(dt);
}

/* ---------------- the shapes ---------------- */

// sparks spread evenly over a ball of this radius (a golden-angle spiral, a little uneven)
function ballOffsets(count, radius) {
  const offsets = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * (i + 0.5)) / count,
      ring = Math.sqrt(1 - y * y),
      angle = i * 2.39996,
      reach = radius * (0.82 + Math.random() * 0.18);
    offsets.push([Math.cos(angle) * ring * reach, y * reach, Math.sin(angle) * ring * reach]);
  }
  return offsets;
}

// flat pictures are lists of [x, y] in about -1..1; `half` is half the picture's width
const flat = (points, half) => points.map(([x, y]) => [x * half, y * half, 0]);

function heartPoints() {
  const points = [];
  for (const scale of [1, 0.72, 0.44])
    for (let i = 0; i < 70 * scale; i++) {
      const t = (i / (70 * scale)) * Math.PI * 2;
      points.push([
        (scale * 16 * Math.sin(t) ** 3) / 17,
        (scale * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))) /
          17,
      ]);
    }
  return points;
}

// a paw print: a big pad and four toes, each an oval filled with sparks
function pawPoints() {
  const ovals = [
    [0, -0.3, 0.55, 0.45, 70],
    [-0.62, 0.3, 0.2, 0.26, 20],
    [-0.22, 0.67, 0.2, 0.26, 20],
    [0.22, 0.67, 0.2, 0.26, 20],
    [0.62, 0.3, 0.2, 0.26, 20],
  ];
  const points = [];
  for (const [cx, cy, radiusX, radiusY, count] of ovals)
    for (let i = 0; i < count; i++) {
      // a sunflower pattern fills the oval evenly
      const dist = Math.sqrt((i + 0.5) / count),
        angle = i * 2.39996;
      points.push([cx + Math.cos(angle) * dist * radiusX, cy + Math.sin(angle) * dist * radiusY]);
    }
  return points;
}

// the letters, written with the game font on a hidden canvas and read back as dots
function textPoints(text) {
  const canvas = document.createElement('canvas'),
    width = 640,
    height = 240,
    step = 7;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.font = '700 170px Fredoka, ui-rounded, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(text, width / 2, height / 2 + 14);
  const pixels = ctx.getImageData(0, 0, width, height).data,
    points = [];
  for (let y = 0; y < height; y += step)
    for (let x = 0; x < width; x += step)
      if (pixels[(y * width + x) * 4 + 3] > 128)
        points.push([(x - width / 2) / (width / 2), (height / 2 - y) / (width / 2)]);
  return points;
}

// a round burst of one colour at pos
function peony(pos, color, { radius = 9, count = 150 } = {}) {
  addShell(pos, { offsets: ballOffsets(count, radius), colors: color, life: 2.3, grow: 3, sag: 1 });
  sfx.bang();
}

// a picture in the sky at pos; colors: one colour, or one per spark. size: of each spark
// (small for the letters, so they stay crisp dots instead of melting together)
function picture(pos, { points, half, colors, life, size = 1.5 }) {
  addShell(pos, { offsets: flat(points, half), colors, life, grow: 6, sag: 0.1, size });
  sfx.bang();
}

/* ---------------- the show ---------------- */

// t: seconds into the show; events: [[at, run], …] still to come; climbing: rockets on their
// way up {rocket, from, to, t}; origin: the stand; onDone runs when it ends (or is skipped)
const show = { t: 0, events: [], climbing: [], origin: null, onDone: null, skipBound: false };

// the picture sky: `side` units east of the stand's middle, `up` above the usual height
const sky = (side = 0, up = 0) =>
  vec3(show.origin.x + side, show.origin.y + SKY.height + up, show.origin.z - SKY.back);

// how wide a picture can be and still fit on this screen (phones held upright are narrow)
function pictureHalfWidth() {
  const distance = SKY.back + CAMERA.back,
    halfView = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * distance;
  return Math.min(26, halfView * 0.8);
}

// origin: the middle of the stand (a Vector3)
export function startShow(origin, { onDone }) {
  hideWin();
  Object.assign(show, { t: 0, origin, onDone, climbing: [] });
  game.state = 'fireworks';
  // Spartacus at the fuse box, looking up at the sky with everyone else
  player.pos.set(origin.x - 1.4, origin.y, origin.z + 3.6);
  player.vel.set(0, 0, 0);
  player.yaw = Math.PI;
  player.grounded = true;
  gatherFuzzles(origin.x, origin.z + 7);
  updatePowerHud();
  $('#skip').classList.remove('hidden');
  if (!show.skipBound) {
    $('#skip').addEventListener('click', skipShow);
    show.skipBound = true;
  }
  const half = pictureHalfWidth(),
    rockets = allRockets();
  show.events = [
    [0, () => toast('Pip: “Ladies and gentle-fuzzles… the JAMBOREE fireworks!”', 3600)],
    [1.4, pushFuse],
    ...rockets.map((rocket, i) => [2.2 + i * 0.9, () => launch(rocket, i)]),
    [
      8.4,
      () => picture(sky(), { points: pawPoints(), half: half * 0.5, colors: 0xffd84d, life: 3.4 }),
    ],
    [8.6, () => toast('A giant golden paw print!', 2600)],
    [
      11.6,
      () =>
        picture(sky(), {
          points: heartPoints(),
          half: half * 0.55,
          colors: [0xff5a8a, 0xff8fd0],
          life: 3.4,
        }),
    ],
    [14.8, showName],
    [15.4, () => toast(`The fireworks spell a name… ${NAME}!`, 3800)],
    // little ones either side while the name hangs there (kept in time order, like the rest)
    ...[17, 18.1, 19.2].map((at, i) => [at, () => sideBurst(i, half)]),
    [19.6, () => toast(`Fuzzles: “${NAME}! ${NAME}! ${NAME}!”`, 3600)],
    [20.3, () => sideBurst(3, half)],
    ...Array.from({ length: 9 }, (unused, i) => [
      22.6 + i * 0.42,
      () =>
        peony(
          sky((Math.random() - 0.5) * half * 1.9, (Math.random() - 0.5) * 16),
          BURST_COLORS[i % 7],
          {
            radius: 7 + Math.random() * 4,
          },
        ),
    ]),
    [26.6, goldenRain],
    [29.5, endShow],
  ];
  sfx.win();
}

// a small burst beside the name, left and right in turn
function sideBurst(i, half) {
  const side = (i % 2 ? 1 : -1) * half * 0.9;
  peony(sky(side, -9 + i * 2), BURST_COLORS[i], { radius: 5, count: 80 });
}

// paws on the handle, down it goes, and a big happy woof
function pushFuse() {
  pushPlunger(true);
  sfx.thunk();
  sfx.bark();
  player.barkTimer = 0.35;
}

// rocket number i leaves its tube for its own spot in the sky
function launch(rocket, i) {
  const to = sky((i - 2) * 11, (i % 2) * 6 - 3);
  show.climbing.push({ rocket, from: rocket.model.position.clone(), to, t: 0 });
  sfx.whistle();
}

function updateClimbing(dt) {
  for (let i = show.climbing.length - 1; i >= 0; i--) {
    const climb = show.climbing[i],
      { rocket, from, to } = climb;
    climb.t += dt;
    const t = clamp(climb.t / CLIMB_TIME, 0, 1);
    rocket.model.position.lerpVectors(from, to, t * t); // slow off the stand, then whoosh
    rocket.model.rotation.set(0, climb.t * 9, 0);
    burst(rocket.model.position.clone(), {
      count: 2,
      color: [rocket.color, 0xffd84d, 0xffffff],
      speed: 1,
      up: -2,
      life: 0.6,
      size: 0.9,
      gravity: 0.3,
    });
    if (t < 1) continue;
    hideRocket(rocket);
    peony(to, rocket.color);
    cheer();
    show.climbing.splice(i, 1);
  }
}

// the letters, each spark a colour of the rainbow from left to right, held for a long look
function showName() {
  const points = textPoints(NAME),
    color = new THREE.Color(),
    colors = points.map(([x]) => color.setHSL(0.02 + ((x + 1) / 2) * 0.78, 1, 0.62).getHex());
  picture(sky(0, 1), { points, half: pictureHalfWidth(), colors, life: 7.5, size: 1 });
  sfx.win();
  cheer();
}

// the last one: a huge slow shower of gold over everything
function goldenRain() {
  addShell(sky(0, 6), {
    offsets: ballOffsets(320, 26),
    colors: [0xffd84d, 0xffe9a8, 0xffa53d],
    life: 3.4,
    grow: 1.6,
    sag: 1.6,
    size: 1.4,
  });
  sfx.boom();
  cheer();
}

// the Fuzzles jump for joy, and Spartacus's tail can't stop
function cheer() {
  exciteFuzzles(show.origin, { reach: 30, up: 5 });
}

function updateShow(dt) {
  show.t += dt;
  while (show.events.length && show.events[0][0] <= show.t) show.events.shift()[1]();
  updateClimbing(dt);
  // the audience's view: behind Spartacus and the Fuzzles, looking up over the Big Top
  const { origin } = show;
  if (!origin) return;
  const drift = Math.sin(show.t * 0.2) * 1.5,
    wanted = vec3(origin.x + CAMERA.side + drift, origin.y + CAMERA.up, origin.z + CAMERA.back);
  camera.position.lerp(wanted, 1 - Math.exp(-dt * 2));
  camera.lookAt(origin.x, origin.y + SKY.height * 0.72, origin.z - SKY.back);
}

function skipShow() {
  if (game.state !== 'fireworks') return;
  endShow();
}

function endShow() {
  for (const rocket of allRockets()) hideRocket(rocket);
  show.events = [];
  show.climbing = [];
  pushPlunger(false);
  scatterFuzzles();
  $('#skip').classList.add('hidden');
  game.state = 'play';
  updatePowerHud();
  show.onDone();
}

game.cutscenes.fireworks = { update: updateShow, skip: skipShow };

/* ---------------- encores ---------------- */

// after the show: one more firework over the stand (origin), e.g. for a woof at night
export function encore(origin) {
  const at = vec3(
    origin.x + (Math.random() - 0.5) * 44,
    origin.y + SKY.height + (Math.random() - 0.5) * 14,
    origin.z - SKY.back + (Math.random() - 0.5) * 16,
  );
  encores.push({ at, timeLeft: 0.9, color: BURST_COLORS[Math.floor(Math.random() * 7)] });
  sfx.whistle();
}
// waiting to burst (the whistle comes first): {at, timeLeft, color}
const encores = [];
function updateEncores(dt) {
  for (let i = encores.length - 1; i >= 0; i--) {
    const next = encores[i];
    next.timeLeft -= dt;
    if (next.timeLeft > 0) continue;
    peony(next.at, next.color, { radius: 6 + Math.random() * 4, count: 110 });
    encores.splice(i, 1);
  }
}
