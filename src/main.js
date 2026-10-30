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
for (const I of ISLANDS) {
  game.islands[I.id] = I;
  initTasks(I);
  addTerrain(I.zMax, I.height);
}
// Build order matters: all scenery shares one seeded random sequence (see core/util.js rand).
for (const I of ISLANDS) I.build();
buildSky();
for (const I of ISLANDS) I.buildLate?.();
player.pos.copy(island1.spawn);
SPAWN.copy(island1.spawn);

/* ---------- HUD + menus ---------- */
renderTasks();
$('#listToggle').addEventListener('click', () => {
  const l = $('#list');
  l.classList.toggle('closed');
  $('#listToggle').setAttribute('aria-expanded', !l.classList.contains('closed'));
});
if (innerWidth < 500) $('#list').classList.add('closed');
armButton($('#restartLink'), 'Tap again to restart from island 1', restartFromBeginning);

const contIsland = continueIsland(ISLANDS.length);
if (contIsland >= 2) {
  $('#cont').textContent = `Continue: Island ${contIsland}`;
  $('#cont').classList.remove('hidden');
}
// with a save to lose, starting over needs a second tap
if (contIsland >= 2 && loadSave().island >= 2)
  armButton($('#play'), 'Tap again to start over', () => startGame(1));
else $('#play').addEventListener('click', () => startGame(1));
$('#cont').addEventListener('click', () => startGame(contIsland));
$('#winExplore').addEventListener('click', () => {
  hideWin();
  canvas.focus();
});
$('#winGo').addEventListener('click', () => currentIsland().exit.run());
$('#restart').addEventListener('click', restartFromBeginning);

bindInput({
  onKey(k) {
    if (game.state === 'start') {
      if (k === 'enter' || k === ' ') startGame(contIsland);
      return;
    }
    const cs = game.cutscenes[game.state];
    if (cs) {
      if (k === 'enter' || k === ' ' || k === 'escape') cs.skip?.();
      return;
    }
    if (overlayOpen()) return; // let Enter/Space press the focused panel button
    if (k === ' ') player.jumpBuf = 0.15;
    if (k === 'b') bark();
    if (k === 'f' || k === 'enter') doAction();
  },
  onJump() {
    player.jumpBuf = 0.15;
  },
  onBark: bark,
  onAct: doAction,
});

/* ---------- loop ---------- */
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 30);
  game.T += dt;
  update(dt);
  renderer.render(scene, camera);
}
function update(dt) {
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
  followSun(game.state === 'start' ? vec3(0, 0, 0) : player.pos);
  if (game.state === 'start') {
    orbitCamera();
    animateDog(dt, 0);
    return;
  }
  const cs = game.cutscenes[game.state];
  if (cs) {
    cs.update(dt);
    animateDog(dt, 0);
    updatePrompt();
    return;
  }

  player.barkCd -= dt;
  player.barkT -= dt;
  if (game.state === 'rescue') updateRescue(dt);
  else if (player.swing) {
    updateSwing(dt);
    checkTriggers(dt);
  } else if (player.climb) {
    updateClimb(dt);
    checkTriggers(dt);
  } else if (player.zip) {
    updateZip(dt);
    checkTriggers(dt);
  } else {
    stepPlayer(dt);
    checkTriggers(dt);
    updateDigging(dt);
    updatePlacing(dt);
  }
  const sp =
    game.state === 'play' && !player.swing && !player.climb && !player.zip
      ? Math.hypot(player.vel.x, player.vel.z)
      : 0;
  if (sp > 0.6 && player.digT <= 0)
    player.yaw = lerpAngle(
      player.yaw,
      Math.atan2(player.vel.x, player.vel.z),
      Math.min(1, dt * 12),
    );
  if (player.power && sp > 2 && player.grounded) {
    player.sparkT -= dt;
    if (player.sparkT < 0) {
      player.sparkT = 0.12;
      burst(
        player.pos.clone().add(vec3(0, 0.3, 0)),
        2,
        POWERS[player.power].col.slice(1),
        1,
        1.5,
        0.6,
        0.7,
        0.2,
      );
    }
  }
  // celebration: confetti for ~2.4 s, then the island's win panel
  if (game.celebT >= 0) {
    game.celebT += dt;
    if (game.celebT < 2.4 && Math.floor(game.celebT * 4) !== Math.floor((game.celebT - dt) * 4))
      burst(
        player.pos.clone().add(vec3(0, 3, 0)),
        26,
        [0xff9fb2, 0xffd84d, 0x7fd8ee, 0x8a5cf6, 0x6ccb5f],
        7,
        5,
        2.2,
        1.4,
        0.25,
        true,
      );
    if (game.celebT > 2.8) {
      showWin(game.celebIsland);
      game.celebT = -1;
    }
  }
  updatePrompt();
  animateDog(dt, game.state === 'rescue' ? 3 : sp);
  updateSwingLine();
  updateCamera(dt);
}
frame();

/* ---------- debug: ?debug (always on in dev) ---------- */
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  game.debug = true;
  import('./game/debug.js').then((m) => m.installDebug());
}
