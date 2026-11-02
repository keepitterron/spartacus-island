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
import { overlayOpen, armButton, hintOnce } from './core/ui.js';
import { bindInput } from './core/input.js';
import { continueIsland, loadSave, writeSave } from './core/save.js';
import { isMuted, setMuted } from './core/audio.js';
import { isMusicOn, setMusicOn } from './core/music.js';
import { addTerrain } from './world/terrain.js';
import { updateOcean } from './world/ocean.js';
import { buildSky, updateSky } from './world/sky.js';
import { buildStars, setNight, updateDaylight, daylight } from './world/daylight.js';
import { updateShip } from './world/ship.js';
import { player, stepPlayer } from './player/player.js';
import { animateDog } from './player/dog.js';
import { POWERS, updateFruits } from './systems/powers.js';
import { updatePickups } from './systems/collect.js';
import { updateDigSpots, updateDigging } from './systems/digs.js';
import { updateFloaters, updatePlacing } from './systems/items.js';
import { updateHooks, updateSwing, updateSwingLine } from './systems/hooks.js';
import { updateGrowers, updateClimb, updateZip } from './systems/vines.js';
import { updateHat } from './systems/hat.js';
import { updateReactions } from './systems/reactions.js';
import { buildBalls, updateBalls } from './systems/balls.js';
import { buildCritters, updateCritters } from './systems/critters.js';
import { updateGull } from './npcs/gull.js';
import { updateMango } from './npcs/mango.js';
import { updateWasabi } from './npcs/wasabi.js';
import { initTasks, renderTasks, showWin, hideWin } from './game/tasks.js';
import { bark, doAction, updatePrompt, updateWoof } from './game/actions.js';
import { checkTriggers } from './game/interact.js';
import { startGame, restartFromBeginning } from './game/flow.js';
import { bindProgressSaving, updateProgress } from './game/progress.js';
import { orbitCamera, updateCamera } from './game/camera.js';
import island1 from './islands/island1/index.js';
import island2 from './islands/island2/index.js';
import island3 from './islands/island3/index.js';
import island4 from './islands/island4/index.js';
import island5 from './islands/island5/index.js';

/* ---------- world ---------- */
// Islands in play order. To add one, see docs/islands.md.
const ISLANDS = [island1, island2, island3, island4, island5];
for (const island of ISLANDS) {
  game.islands[island.id] = island;
  initTasks(island);
  addTerrain(island.zMax, island.height);
}
// Build order matters: all scenery shares one seeded random sequence (see core/util.js rand).
// game.building tells systems which island the digs, seeds and items they add belong to
for (const island of ISLANDS) {
  game.building = island.id;
  island.build();
}
buildSky();
buildStars();
for (const island of ISLANDS) {
  game.building = island.id;
  island.buildLate?.();
}
game.building = 0;
// last, so balls and critters can sit on top of everything built above
buildBalls();
buildCritters();
player.pos.copy(island1.spawn);

/* ---------- HUD + menus ---------- */
renderTasks();
$('#listToggle').addEventListener('click', () => {
  const list = $('#list');
  list.classList.toggle('closed');
  $('#listToggle').setAttribute('aria-expanded', !list.classList.contains('closed'));
});
if (innerWidth < 500) $('#list').classList.add('closed'); // task list starts folded on phones
armButton($('#restartLink'), 'Tap again to restart from island 1', restartFromBeginning);

// sound on/off, remembered in the save
function showSoundButton() {
  $('#btnSound').textContent = isMuted() ? '🔇' : '🔊';
}
function toggleSound() {
  setMuted(!isMuted());
  writeSave({ muted: isMuted() });
  showSoundButton();
}
setMuted(!!loadSave().muted);
showSoundButton();
$('#btnSound').addEventListener('click', toggleSound);

// music on/off (sound effects stay), also remembered; a crossed-out note when off
function showMusicButton() {
  $('#btnMusic').classList.toggle('off', !isMusicOn());
}
function toggleMusic() {
  setMusicOn(!isMusicOn());
  writeSave({ music: isMusicOn() });
  showMusicButton();
}
setMusicOn(loadSave().music !== false);
showMusicButton();
$('#btnMusic').addEventListener('click', toggleMusic);

// day or night, also remembered; the button shows what you'd switch to
function showNightButton() {
  $('#btnNight').textContent = daylight.target ? '☀️' : '🌙';
}
function toggleNight() {
  setNight(!daylight.target);
  writeSave({ night: !!daylight.target });
  showNightButton();
  if (daylight.target) hintOnce('night', 'Night time! Look for the fireflies ✨', 3200);
}
if (loadSave().night) {
  setNight(true);
  daylight.night = 1;
}
showNightButton();
$('#btnNight').addEventListener('click', toggleNight);

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

// Quick island picker: jump to any island. Leaving a saved island for another needs a second tap,
// because it replaces where Continue goes (and any mid-island save). The chip itself never changes
// size, so the second tap lands where the first one did; the label above says "tap again".
const PICKER_TEXT = $('#pickerLabel').textContent;
const ARM_TIME = 3000; // ms the second tap has
const hasSave = loadSave().island >= 2;
const picker = { armed: null, timer: null };
function disarmPicker() {
  picker.armed?.removeAttribute('data-armed');
  picker.armed = null;
  $('#pickerLabel').textContent = PICKER_TEXT;
}
function pickIsland(chip, island) {
  const needsSecondTap = hasSave && island.id !== continueTo;
  if (!needsSecondTap || picker.armed === chip) {
    startGame(island.id);
    return;
  }
  disarmPicker();
  picker.armed = chip;
  chip.dataset.armed = '1';
  $('#pickerLabel').textContent = `Tap ${island.id} again to sail to ${island.name}`;
  clearTimeout(picker.timer);
  picker.timer = setTimeout(disarmPicker, ARM_TIME);
}
for (const island of ISLANDS) {
  const chip = document.createElement('button');
  chip.className = 'cta ghost chip';
  chip.textContent = island.id;
  chip.title = island.name;
  chip.setAttribute('aria-label', `Island ${island.id}: ${island.name}`);
  if (island.id === continueTo) chip.classList.add('current');
  chip.addEventListener('click', () => pickIsland(chip, island));
  $('#islandPicker').append(chip);
}
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
    if (k === 'm') toggleSound();
    if (k === 'n') toggleMusic();
    if (k === 'l') toggleNight();
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
  updateProgress(dt);
  updatePrompt();
  animateDog(dt, speed);
  updateSwingLine();
  updateCamera(dt);
}

// scenery, pickups, NPCs and effects that move whatever the player is doing
function updateWorld(dt) {
  updateOcean();
  updateSky(dt);
  updateDaylight(dt);
  updateShip(dt, game.state === 'bubble');
  updatePickups(dt);
  updateFruits(dt);
  updateDigSpots(dt);
  updateHooks(dt);
  updateGrowers(dt);
  updateHat(dt);
  updateReactions(dt);
  updateBalls(dt);
  updateCritters(dt);
  updateGull(dt);
  updateMango(dt);
  updateWasabi(dt);
  currentIsland().update?.(dt);
  updateFloaters(dt);
  updateParticles(dt);
  updateWoof(dt);
}

// move the player the way their current mode moves them (swinging, climbing, zip line,
// or ordinary walking, which is the only mode that can dig or place items)
function stepPlayerForState(dt) {
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

// horizontal speed while walking freely in play; 0 during swing, climb or zip
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
bindProgressSaving();
frame();

/* ---------- debug: ?debug (always on in dev) ---------- */
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  game.debug = true;
  import('./game/debug.js').then((m) => m.installDebug());
}
