import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './style.css';
import * as THREE from 'three';
import { $, lerpAngle, vec3 } from './core/util.js';
import { renderer, scene, camera, canvas, followSun } from './core/renderer.js';
import { game, currentIsland } from './core/state.js';
import { burst, updateParticles } from './core/fx.js';
import { overlayOpen, armButton } from './core/ui.js';
import { bindInput } from './core/input.js';
import { continueIsland, loadSave } from './core/save.js';
import { addTerrain } from './world/terrain.js';
import { updateOcean } from './world/ocean.js';
import { buildSky, updateSky } from './world/sky.js';
import { updateShip } from './world/ship.js';
import { player, SPAWN, stepPlayer, updateRescue } from './player/player.js';
import { animateDog } from './player/dog.js';
import { POWERS, updateFruits } from './systems/powers.js';
import { updatePickups } from './systems/collect.js';
import { updateDigSpots, updateDigging } from './systems/digs.js';
import { updateFloaters, updatePlacing } from './systems/items.js';
import { updateHooks, updateSwing, updateSwingLine } from './systems/hooks.js';
import { updateGrowers, updateClimb, updateZip } from './systems/vines.js';
import { updateHat } from './systems/hat.js';
import { updateGull } from './npcs/gull.js';
import { updateMango } from './npcs/mango.js';
import { updateWasabi } from './npcs/wasabi.js';
import { initTasks, renderTasks, showWin, hideWin } from './game/tasks.js';
import { bark, doAction, updatePrompt, updateWoof } from './game/actions.js';
import { checkTriggers } from './game/interact.js';
import { startGame, restartFromBeginning } from './game/flow.js';
import { orbitCamera, updateCamera } from './game/camera.js';
import island1 from './islands/island1/index.js';
import island2 from './islands/island2/index.js';
import island3 from './islands/island3/index.js';
import island4 from './islands/island4/index.js';

/* ---------- world ---------- */
// Islands in play order. To add one, see docs/islands.md.
const ISLANDS = [island1, island2, island3, island4];
for (const island of ISLANDS) {
  game.islands[island.id] = island;
  initTasks(island);
  addTerrain(island.zMax, island.height);
}
// Build order matters: all scenery shares one seeded random sequence (see core/util.js rand).
for (const island of ISLANDS) island.build();
buildSky();
for (const island of ISLANDS) island.buildLate?.();
player.pos.copy(island1.spawn);
SPAWN.copy(island1.spawn);

/* ---------- HUD + menus ---------- */
renderTasks();
$('#listToggle').addEventListener('click', () => {
  const list = $('#list');
  list.classList.toggle('closed');
  $('#listToggle').setAttribute('aria-expanded', !list.classList.contains('closed'));
});
if (innerWidth < 500) $('#list').classList.add('closed'); // task list starts folded on phones
armButton($('#restartLink'), 'Tap again to restart from island 1', restartFromBeginning);

const continueTo = continueIsland(ISLANDS.length);
if (continueTo >= 2) {
  $('#cont').textContent = `Continue: Island ${continueTo}`;
  $('#cont').classList.remove('hidden');
}
// with a save to lose, starting over needs a second tap
if (continueTo >= 2 && loadSave().island >= 2)
  armButton($('#play'), 'Tap again to start over', () => startGame(1));
else $('#play').addEventListener('click', () => startGame(1));
$('#cont').addEventListener('click', () => startGame(continueTo));
$('#winExplore').addEventListener('click', () => {
  hideWin();
  canvas.focus();
});
$('#winGo').addEventListener('click', () => currentIsland().exit.run());
$('#restart').addEventListener('click', restartFromBeginning);

const JUMP_BUFFER = 0.15; // s a jump press is remembered, so pressing just before landing still jumps
bindInput({
  onKey(k) {
    if (game.state === 'start') {
      if (k === 'enter' || k === ' ') startGame(continueTo);
      return;
    }
    const cutscene = game.cutscenes[game.state];
    if (cutscene) {
      if (k === 'enter' || k === ' ' || k === 'escape') cutscene.skip?.();
      return;
    }
    if (overlayOpen()) return; // let Enter/Space press the focused panel button
    if (k === ' ') player.jumpBuffer = JUMP_BUFFER;
    if (k === 'b') bark();
    if (k === 'f' || k === 'enter') doAction();
  },
  onJump() {
    player.jumpBuffer = JUMP_BUFFER;
  },
  onBark: bark,
  onAct: doAction,
});

/* ---------- loop ---------- */
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 30); // cap the step so a slow frame can't tunnel through things
  game.time += dt;
  update(dt);
  renderer.render(scene, camera);
}

// One frame of the game: the world always animates; then either the title-screen orbit,
// a cutscene, or normal play (move the player, effects, prompt, camera).
function update(dt) {
  updateWorld(dt);
  followSun(game.state === 'start' ? vec3(0, 0, 0) : player.pos);
  if (game.state === 'start') {
    orbitCamera();
    animateDog(dt, 0);
    return;
  }
  const cutscene = game.cutscenes[game.state];
  if (cutscene) {
    cutscene.update(dt);
    animateDog(dt, 0);
    updatePrompt();
    return;
  }

  player.barkCooldown -= dt;
  player.barkTimer -= dt;
  stepPlayerForState(dt);
  const speed = groundSpeed();
  turnToFaceMovement(dt, speed);
  updatePowerSparkles(dt, speed);
  updateCelebration(dt);
  updatePrompt();
  animateDog(dt, game.state === 'rescue' ? 3 : speed);
  updateSwingLine();
  updateCamera(dt);
}

// scenery, pickups, NPCs and effects that move whatever the player is doing
function updateWorld(dt) {
  updateOcean();
  updateSky(dt);
  updateShip(dt, game.state === 'bubble');
  updatePickups(dt);
  updateFruits(dt);
  updateDigSpots(dt);
  updateHooks(dt);
  updateGrowers(dt);
  updateHat(dt);
  updateGull(dt);
  updateMango(dt);
  updateWasabi(dt);
  currentIsland().update?.(dt);
  updateFloaters(dt);
  updateParticles(dt);
  updateWoof(dt);
}

// move the player the way their current mode moves them (rescue, swinging, climbing,
// zip line, or ordinary walking, which is the only mode that can dig or place items)
function stepPlayerForState(dt) {
  if (game.state === 'rescue') {
    updateRescue(dt);
    return;
  }
  const onRopeOrVine = player.swing || player.climb || player.zip; // before this step changes it
  if (player.swing) updateSwing(dt);
  else if (player.climb) updateClimb(dt);
  else if (player.zip) updateZip(dt);
  else stepPlayer(dt);
  checkTriggers(dt);
  if (onRopeOrVine) return;
  updateDigging(dt);
  updatePlacing(dt);
}

// horizontal speed while walking freely in play; 0 during rescue, swing, climb or zip
function groundSpeed() {
  const walking = game.state === 'play' && !player.swing && !player.climb && !player.zip;
  return walking ? Math.hypot(player.vel.x, player.vel.z) : 0;
}

function turnToFaceMovement(dt, speed) {
  if (speed <= 0.6 || player.digTimer > 0) return;
  player.yaw = lerpAngle(player.yaw, Math.atan2(player.vel.x, player.vel.z), Math.min(1, dt * 12));
}

// while a fruit power is active, running leaves a trail of sparkles in its light + accent colours
function updatePowerSparkles(dt, speed) {
  if (!player.power || speed <= 2 || !player.grounded) return;
  player.sparkTimer -= dt;
  if (player.sparkTimer >= 0) return;
  player.sparkTimer = 0.12;
  burst(player.pos.clone().add(vec3(0, 0.3, 0)), {
    count: 2,
    color: POWERS[player.power].sparkleColors.slice(1),
    speed: 1,
    up: 1.5,
    life: 0.6,
    size: 0.7,
    gravity: 0.2,
  });
}

// island complete: confetti four times a second for ~2.4 s, then the island's win panel
function updateCelebration(dt) {
  if (game.celebrateTime < 0) return;
  game.celebrateTime += dt;
  const crossedQuarterSecond =
    Math.floor(game.celebrateTime * 4) !== Math.floor((game.celebrateTime - dt) * 4);
  if (game.celebrateTime < 2.4 && crossedQuarterSecond)
    burst(player.pos.clone().add(vec3(0, 3, 0)), {
      count: 26,
      color: [0xff9fb2, 0xffd84d, 0x7fd8ee, 0x8a5cf6, 0x6ccb5f],
      speed: 7,
      up: 5,
      life: 2.2,
      size: 1.4,
      gravity: 0.25,
      confetti: true,
    });
  if (game.celebrateTime > 2.8) {
    showWin(game.celebrateIsland);
    game.celebrateTime = -1;
  }
}
frame();

/* ---------- debug: ?debug (always on in dev) ---------- */
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  game.debug = true;
  import('./game/debug.js').then((m) => m.installDebug());
}
