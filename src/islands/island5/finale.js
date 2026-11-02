// The end of island 5. With every star home, at night the unicorn's horn lights the arch and the
// rainbow comes back; she follows Spartacus down to the ship and hops aboard. Then "Ride the
// rainbow": a rainbow road grows ahead of the ship and carries it up into the clouds, towards
// the sky island (island 6, still to come).
import * as THREE from 'three';
import { $, clamp, smoothstep, vec3 } from '../../core/util.js';
import { scene, camera } from '../../core/renderer.js';
import { game, isPlaying } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { toast } from '../../core/ui.js';
import { ship, shipState, onDeck } from '../../world/ship.js';
import { player } from '../../player/player.js';
import { useUpCarried } from '../../systems/items.js';
import { updatePowerHud } from '../../systems/powers.js';
import { hideWin } from '../../game/tasks.js';
import { ensureEduardoCrew } from '../island4/eduardo.js';

// outermost first, like a real rainbow
const BANDS = [0xff5a5a, 0xff9a3d, 0xffd84d, 0x5aa8ff];
const GROW_TIME = 3; // seconds for the rainbow over the arch to grow
const RIDE_TIME = 14; // seconds up the rainbow road (skippable)

const rainbow = { group: null, grow: -1 };

// four half-rings standing over the arch at (x, y, z), hidden until the finale
export function buildRainbow({ x, y, z }) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  BANDS.forEach((color, i) => {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(12 - i * 0.75, 0.36, 8, 48, Math.PI),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.85,
      }),
    );
    group.add(band);
  });
  group.visible = false;
  scene.add(group);
  rainbow.group = group;
}

// quiet: a save being put back, so it's simply there
export function showRainbow({ quiet = false } = {}) {
  rainbow.group.visible = true;
  rainbow.grow = quiet ? GROW_TIME : 0;
  rainbow.group.scale.setScalar(quiet ? 1 : 0.01);
  if (quiet) return;
  sfx.win();
  burst(rainbow.group.position.clone().add(vec3(0, 6, 0)), {
    count: 60,
    color: BANDS,
    speed: 7,
    up: 5,
    life: 1.6,
    size: 1.3,
    confetti: true,
  });
}

export function updateRainbow(dt) {
  if (rainbow.grow < 0 || rainbow.grow >= GROW_TIME) return;
  rainbow.grow = Math.min(GROW_TIME, rainbow.grow + dt);
  rainbow.group.scale.setScalar(Math.max(0.01, smoothstep(0, 1, rainbow.grow / GROW_TIME)));
}

/* ---------------- riding the rainbow up into the sky ---------------- */

// t: 0..1 up the road; path: the ship's curve; bands: the road's tubes (revealed ahead of the ship)
const ride = { t: 0, path: null, bands: [], forward: null, side: null, ended: false };

export function startRainbowRide() {
  if (!isPlaying()) return;
  hideWin();
  if (player.carrying) useUpCarried();
  player.climb = null;
  player.zip = null;
  player.swing = null;
  ensureEduardoCrew(); // off the hat and onto the deck for the trip
  const forward = vec3(Math.sin(ship.rotation.y), 0, Math.cos(ship.rotation.y)),
    side = vec3(forward.z, 0, -forward.x),
    start = vec3(ship.position.x, shipState.baseY, ship.position.z);
  const at = (ahead, up) =>
    start
      .clone()
      .addScaledVector(forward, ahead)
      .setY(start.y + up);
  ride.path = new THREE.CatmullRomCurve3([
    at(0, 0),
    at(16, 3),
    at(40, 16),
    at(70, 40),
    at(100, 75),
  ]);
  ride.bands = BANDS.map((color, i) =>
    addRoadBand(ride.path, { color, offset: (i - 1.5) * 0.9, side }),
  );
  Object.assign(ride, { t: 0, forward, side, ended: false });
  game.state = 'rainbowRide';
  $('#skip').classList.remove('hidden');
  if (!ride.skipBound) {
    $('#skip').addEventListener('click', skipRide);
    ride.skipBound = true;
  }
  updatePowerHud();
  sfx.win();
  toast('Hold on, everyone! Up the rainbow we go!', 3200);
}
const skipRide = () => {
  if (game.state === 'rainbowRide') ride.t = 1;
};

// one coloured band of the road: a tube along the ship's path, a bit to one side and under it
function addRoadBand(path, { color, offset, side }) {
  const points = path.getPoints(60).map((p) =>
    p
      .clone()
      .addScaledVector(side, offset)
      .setY(p.y - 1.4),
  );
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 160, 0.48, 6);
  geo.setDrawRange(0, 0);
  const tube = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45 }),
  );
  scene.add(tube);
  return geo;
}

function updateRide(dt) {
  ride.t = Math.min(1, ride.t + dt / RIDE_TIME);
  const u = smoothstep(0, 1, ride.t);
  // the road grows a little ahead of the ship (whole triangles only)
  for (const geo of ride.bands)
    geo.setDrawRange(0, Math.floor((geo.index.count * clamp(u + 0.18, 0, 1)) / 3) * 3);
  const point = ride.path.getPointAt(u);
  ship.position.x = point.x;
  ship.position.z = point.z;
  shipState.baseY = point.y;
  ship.updateMatrixWorld(true);
  player.pos.copy(onDeck());
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
  // watch from behind and to the side, a little above
  const goal = point
    .clone()
    .addScaledVector(ride.forward, -16)
    .addScaledVector(ride.side, 9)
    .add(vec3(0, 6, 0));
  camera.position.lerp(goal, 1 - Math.exp(-dt * 2.5));
  camera.lookAt(point.x, point.y + 1, point.z);
  if (ride.t < 1 || ride.ended) return;
  ride.ended = true;
  $('#skip').classList.add('hidden');
  showEnd();
}

function showEnd() {
  sfx.win();
  $('#end .title').textContent = 'To be continued…';
  $('#end p').textContent =
    'Spartacus and the crew rode the rainbow up into the clouds. Next stop: the sky island! What happens up there? Make up the story!';
  $('#end').classList.remove('hidden');
}

game.cutscenes.rainbowRide = { update: updateRide, skip: skipRide };
