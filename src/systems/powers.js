// Fruits give powers. One power at a time: eating another fruit swaps it.
// Bushes regrow after a few seconds so swapping can be part of a puzzle.
import * as THREE from 'three';
import { $, distXZ } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { material, mesh, canvasTexture } from '../core/materials.js';
import { game, currentIsland, isInCutscene } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { burst, textSprite, onFontsReady } from '../core/fx.js';
import { toast, actionKeyName } from '../core/ui.js';
import { completeTask } from '../game/tasks.js';
import { player, MEGA } from '../player/player.js';

// a painted skin per fruit, so each power is recognisable by its pattern too (Mini-Me and
// Smash-Smash have whole models instead, see fruitModels)
const fruitSkins = {
  // purple with springy spirals
  boing: canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#8a5cf6';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c4adff';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const cx = 20 + i * 44,
        cy = i % 2 ? 40 : 88;
      ctx.beginPath();
      for (let a = 0; a < 12; a += 0.2) {
        const r = a * 2.1;
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.stroke();
    }
  }),
  // orange with pink zigzags
  stretch: canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#ff9a3d';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ff6b8a';
    ctx.lineWidth = 9;
    ctx.lineJoin = 'round';
    for (let row = 0; row < 4; row++) {
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) ctx.lineTo(i * 16, 18 + row * 30 + (i % 2 ? 12 : -4));
      ctx.stroke();
    }
  }),
  // green with little leaves
  grow: canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#4cc05a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#b6f08a';
    for (let i = 0; i < 14; i++) {
      const cx = (i * 37) % w,
        cy = (i * 53) % h;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 14, 6, i, 0, 7);
      ctx.fill();
    }
  }),
  // yellow with orange saw-tooth bands
  chop: canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#ffd84d';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff9a3d';
    for (let row = 0; row < 3; row++) {
      ctx.beginPath();
      ctx.moveTo(0, 20 + row * 40);
      for (let i = 0; i <= 16; i++) ctx.lineTo(i * 16, (i % 2 ? 8 : 26) + row * 40);
      ctx.lineTo(w, 34 + row * 40);
      ctx.lineTo(0, 34 + row * 40);
      ctx.fill();
    }
  }),
};
// sparkleColors: [main, light, accent]; signColor: bush label colour;
// intro() is the first-time toast, shown for introMs
export const POWERS = {
  boing: {
    name: 'Boing-Boing',
    icon: '🌀',
    sparkleColors: [0x8a5cf6, 0xc4adff, 0xffd84d],
    signColor: '#c4adff',
    bushColor: 0x3f9f4a,
    intro: () => 'Boing-Boing fruit! Now Spartacus can jump super high.',
    introMs: 3400,
  },
  stretch: {
    name: 'Stretchy',
    icon: '➰',
    sparkleColors: [0xff9a3d, 0xff6b8a, 0xffd84d],
    signColor: '#ffb36b',
    bushColor: 0x58a83a,
    intro: () => `Stretchy fruit! Swing from golden hooks with ${actionKeyName()}.`,
    introMs: 3600,
  },
  grow: {
    name: 'Grow-Grow',
    icon: '🌱',
    sparkleColors: [0x4cc05a, 0xb6f08a, 0xffd84d],
    signColor: '#a6f08a',
    bushColor: 0x58a83a,
    intro: () => `Grow-Grow fruit! Touch magic seeds with ${actionKeyName()} to grow vines.`,
    introMs: 3800,
  },
  chop: {
    name: 'Chop-Chop',
    icon: '✂️',
    sparkleColors: [0xffd84d, 0xff9a3d, 0xffffff],
    signColor: '#ffe16b',
    bushColor: 0x58a83a,
    intro: () =>
      `Chop-Chop fruit! Spartacus’s hat can chop seaweed. Use ${actionKeyName()} near it.`,
    introMs: 3800,
  },
  mini: {
    name: 'Mini-Me',
    icon: '🤏',
    sparkleColors: [0xe8332f, 0xffffff, 0xffd84d],
    signColor: '#ff8a7a',
    bushColor: 0x58a83a,
    intro: () => 'Mini-Me fruit! Spartacus is teeny tiny. Squeeze through little gaps!',
    introMs: 3800,
  },
  smash: {
    name: 'Smash-Smash',
    icon: '💥',
    sparkleColors: [0x5a8cff, 0xeaf2ff, 0xffd84d],
    signColor: '#9cbcff',
    bushColor: 0x58a83a,
    intro: () => 'Smash-Smash fruit! Run fast to roll into a ball and smash cracked walls!',
    introMs: 3800,
  },
  // the only power that wears off by itself (player/mega.js)
  mega: {
    name: 'Mega-Me',
    icon: '🦖',
    sparkleColors: [0xffc21f, 0xfff3b0, 0xe8332f],
    signColor: '#ffd84d',
    bushColor: 0x58a83a,
    intro: () => 'Mega-Me fruit! Spartacus is GIANT for a little while. Stomp, stomp!',
    introMs: 3800,
  },
};

// {type, model, x, z, y (rest height), regrow (seconds until it's back)}
const fruits = [];
const REGROW_TIME = 4;
// a fruit at (x,y,z): on a bush with a name sign, or on its own (e.g. on a rock)
export function addFruit(x, z, { type, y, bush }) {
  const model = makeFruit(type);
  let fruitY = y + 0.7;
  if (bush) {
    addBush(x, z, { y, type });
    fruitY = y + 1.25;
  }
  model.position.set(x, fruitY, z);
  scene.add(model);
  fruits.push({ type, model, x, z, y: fruitY, regrow: 0 });
}

// Mini-Me and Smash-Smash have their own shapes (Zoë's picks): a red mushroom with white spots,
// and a spiky blue ball, like a hedgehog curled up
// Mega-Me is the Mini-Me mushroom's big twin: fatter, yellow with red spots (a placeholder
// look until Zoë says what it is)
const fruitModels = {
  mini: () => makeMushroom(),
  smash: makeSpikyBall,
  mega: () => {
    const g = makeMushroom({ cap: 0xffc21f, spots: 0xe8332f });
    g.scale.set(1.5, 1.35, 1.5);
    return g;
  },
};

function makeMushroom({ cap: capColor = 0xe8332f, spots: spotColor = 0xffffff } = {}) {
  const g = new THREE.Group();
  const cap = mesh(
    new THREE.SphereGeometry(0.42, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    material(capColor, { flatShading: false, roughness: 0.5 }),
  );
  cap.position.y = 0.05;
  g.add(cap);
  // white spots round the cap, tilted to sit on its curve
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2,
      up = i % 2 ? 0.55 : 0.9;
    const spot = mesh(new THREE.SphereGeometry(0.1, 8, 6), material(spotColor), {
      castShadow: false,
    });
    spot.scale.set(1, 0.35, 1);
    spot.position.set(
      Math.cos(angle) * Math.sin(up) * 0.41,
      0.05 + Math.cos(up) * 0.41,
      Math.sin(angle) * Math.sin(up) * 0.41,
    );
    spot.lookAt(spot.position.clone().multiplyScalar(2));
    spot.rotateX(Math.PI / 2);
    g.add(spot);
  }
  const top = mesh(new THREE.SphereGeometry(0.1, 8, 6), material(spotColor), { castShadow: false });
  top.scale.set(1, 0.35, 1);
  top.position.y = 0.46;
  g.add(top);
  const stem = mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.36, 10), material(0xfff1d6));
  stem.position.y = -0.14;
  g.add(stem);
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.CapsuleGeometry(0.025, 0.06, 3, 6), material(0x1c2333), {
      castShadow: false,
    });
    eye.position.set(side * 0.07, -0.1, 0.21);
    g.add(eye);
  }
  return g;
}

function makeSpikyBall() {
  const g = new THREE.Group(),
    blue = material(0x2f6fe8);
  g.add(mesh(new THREE.SphereGeometry(0.34, 12, 10), blue));
  // spikes all round, swept back a little like quills
  const spikeGeo = new THREE.ConeGeometry(0.11, 0.32, 5);
  spikeGeo.translate(0, 0.42, 0);
  const count = 14;
  for (let i = 0; i < count; i++) {
    const spike = mesh(spikeGeo, blue);
    // spread evenly over the ball (a golden-angle spiral)
    const y = 1 - (2 * (i + 0.5)) / count,
      ring = Math.sqrt(1 - y * y),
      angle = i * 2.4;
    spike.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(Math.cos(angle) * ring, y, Math.sin(angle) * ring - 0.35).normalize(),
    );
    g.add(spike);
  }
  // a peach tummy patch in front
  const tummy = mesh(new THREE.SphereGeometry(0.2, 8, 6), material(0xffd2a8), {
    castShadow: false,
  });
  tummy.scale.set(1, 1, 0.5);
  tummy.position.set(0, -0.05, 0.27);
  g.add(tummy);
  return g;
}

function makeFruit(type) {
  if (fruitModels[type]) return fruitModels[type]();
  const g = new THREE.Group();
  g.add(
    mesh(
      new THREE.SphereGeometry(0.4, 14, 10),
      new THREE.MeshStandardMaterial({ map: fruitSkins[type], roughness: 0.5 }),
    ),
  );
  const stalk = mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.3, 5), material(0x3f8f3f));
  stalk.position.y = 0.45;
  stalk.rotation.z = 0.3;
  g.add(stalk);
  const leaf = mesh(new THREE.SphereGeometry(0.16, 6, 4), material(0x4cc05a));
  leaf.scale.set(1.6, 0.3, 0.8);
  leaf.position.set(0.16, 0.52, 0);
  g.add(leaf);
  return g;
}

function addBush(x, z, { y, type }) {
  const power = POWERS[type];
  const bush = mesh(new THREE.IcosahedronGeometry(0.85, 0), material(power.bushColor));
  bush.scale.y = 0.6;
  bush.position.set(x, y + 0.35, z);
  scene.add(bush);
  onFontsReady(() => {
    const sign = textSprite(power.name, power.signColor);
    sign.scale.set(2.4, 1.2, 1);
    sign.position.set(x, y + 2.6, z);
    sign.material.depthTest = true;
    scene.add(sign);
  });
}

export function updateFruits(dt) {
  const time = game.time;
  for (const fruit of fruits) {
    if (fruit.model.visible) {
      fruit.model.rotation.y += dt * 1.5;
      fruit.model.position.y = fruit.y + Math.sin(time * 2.5 + fruit.x) * 0.15;
      continue;
    }
    fruit.regrow -= dt;
    if (fruit.regrow <= 0) {
      fruit.model.visible = true;
      burst(fruit.model.position.clone(), {
        count: 10,
        color: POWERS[fruit.type].sparkleColors,
        speed: 2,
        up: 2,
        life: 0.5,
        size: 0.8,
      });
    }
  }
}

// walking into a fruit eats it (unless it's the power Spartacus already has)
export function eatFruits(pos) {
  for (const fruit of fruits)
    if (
      fruit.model.visible &&
      player.power !== fruit.type &&
      distXZ(pos, fruit.x, fruit.z) < 1.3 &&
      Math.abs(pos.y + 0.6 - fruit.model.position.y) < 1.5
    ) {
      fruit.model.visible = false;
      fruit.regrow = REGROW_TIME;
      sfx.fruit();
      burst(fruit.model.position.clone(), {
        count: 30,
        color: POWERS[fruit.type].sparkleColors,
        speed: 5,
        up: 3,
        life: 1,
        size: 1,
      });
      setPower(fruit.type);
    }
}

export function setPower(type) {
  const prev = player.power;
  player.power = type;
  player.superJump = type === 'boing';
  player.canStretch = type === 'stretch';
  player.tiny = type === 'mini';
  player.canSmash = type === 'smash';
  player.giant = type === 'mega';
  if (player.giant) player.megaTime = MEGA.time;
  updatePowerHud();
  if (prev && prev !== type) toast(`Swapped to ${POWERS[type].name}! One power at a time.`, 3000);
  else toast(POWERS[type].intro(), POWERS[type].introMs);
  // "Eat a … fruit" tasks on this island are marked with power:'…'
  for (const task of currentIsland().tasks.list) if (task.power === type) completeTask(task.id);
}

// no power at all again (Mega-Me wearing off)
export function clearPower() {
  player.power = null;
  player.superJump = false;
  player.canStretch = false;
  player.tiny = false;
  player.canSmash = false;
  player.giant = false;
  updatePowerHud();
}

export function updatePowerHud() {
  const hud = $('#power');
  if (!player.power || isInCutscene()) {
    hud.classList.add('hidden');
    return;
  }
  hud.classList.remove('hidden');
  const power = POWERS[player.power];
  // Mega-Me counts down the seconds it has left
  const timeLeft = player.giant ? ` ${Math.max(0, Math.ceil(player.megaTime))}` : '';
  $('#powerName').textContent = `${power.icon} ${power.name}${timeLeft}`;
}
