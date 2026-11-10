// Arriving at Jamboree Island: the ship slides down a rainbow from the sky island to the sea
// beside the dock. The slide itself is scenery (buildSlide, it stays there, fading up into the
// sky); the cutscene (startRainbowSlide) rides the ship down it, with a splash at the bottom.
import * as THREE from 'three';
import { $, smoothstep, vec3 } from '../../core/util.js';
import { camera } from '../../core/renderer.js';
import { game, isPlaying } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { toast } from '../../core/ui.js';
import { ship, shipState, onDeck } from '../../world/ship.js';
import { player } from '../../player/player.js';
import { useUpCarried } from '../../systems/items.js';
import { updatePowerHud } from '../../systems/powers.js';
import { unicornAboard } from '../../npcs/unicorn.js';
import { hideWin } from '../../game/tasks.js';
import { enterIsland } from '../../game/flow.js';
import { BANDS, addRoadBand } from '../island5/finale.js';
import { SLIDE, toWorld } from './layout.js';

const SLIDE_TIME = 10; // seconds down the rainbow (skippable)
const ISLAND = 7;

// t: 0..1 down the slide; path: the ship's curve (built with the island)
const slide = { t: 0, path: null, ended: false, skipBound: false };

// the rainbow's four bands, from the sky down to the ship's mooring
export function buildSlide() {
  slide.path = new THREE.CatmullRomCurve3(
    SLIDE.map(([x, y, z]) => {
      const at = toWorld(x, z);
      return vec3(at.x, y, at.z);
    }),
  );
  const side = vec3(1, 0, 0);
  BANDS.forEach((color, i) => {
    const band = addRoadBand(slide.path, { color, offset: (i - 1.5) * 0.9, side });
    band.setDrawRange(0, Infinity); // all of it, always
  });
}

export function startRainbowSlide() {
  if (!isPlaying()) return;
  hideWin();
  if (player.carrying) useUpCarried();
  unicornAboard(); // Lina's wings only work up in the sky: she rides down on deck
  Object.assign(slide, { t: 0, ended: false });
  game.state = 'rainbowSlide';
  $('#skip').classList.remove('hidden');
  if (!slide.skipBound) {
    $('#skip').addEventListener('click', skipSlide);
    slide.skipBound = true;
  }
  updatePowerHud();
  sfx.whoosh();
  toast('Wheee! Down the rainbow slide!', 3200);
}
const skipSlide = () => {
  if (game.state === 'rainbowSlide') slide.t = 1;
};

function updateSlide(dt) {
  slide.t = Math.min(1, slide.t + dt / SLIDE_TIME);
  // slow at the top, fast in the middle, gentle into the water
  const u = smoothstep(0, 1, slide.t),
    point = slide.path.getPointAt(u),
    tangent = slide.path.getTangentAt(u);
  ship.position.x = point.x;
  ship.position.z = point.z;
  shipState.baseY = point.y;
  shipState.depth = 0;
  ship.rotation.y = Math.atan2(tangent.x, tangent.z);
  ship.updateMatrixWorld(true);
  player.pos.copy(onDeck());
  player.yaw = ship.rotation.y;
  player.vel.set(0, 0, 0);
  if (Math.random() < dt * 20)
    burst(point.clone().add(vec3(0, -1, 0)), {
      count: 2,
      color: BANDS,
      speed: 2,
      up: 0.5,
      life: 0.8,
      size: 1,
    });
  // watch from behind and to one side, so the fair comes into view ahead of the ship
  const goal = point.clone().add(vec3(9, 6, 16));
  camera.position.lerp(goal, 1 - Math.exp(-dt * 2.5));
  camera.lookAt(point.x, point.y + 1.5, point.z);
  if (slide.t < 1 || slide.ended) return;
  slide.ended = true;
  $('#skip').classList.add('hidden');
  sfx.splash();
  burst(vec3(point.x, 0.2, point.z), {
    count: 40,
    color: [0xffffff, 0xbff3ff, 0x7fd8ee],
    speed: 7,
    up: 5,
    life: 1.1,
    size: 1.4,
  });
  enterIsland(ISLAND, true);
}

game.cutscenes.rainbowSlide = { update: updateSlide, skip: skipSlide };
