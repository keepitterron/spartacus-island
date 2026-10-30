// Bubble cutscene: Wasabi blows a giant bubble around the ship and it sinks like a
// submarine; fades out and calls onDone (which enters the underwater island).
import { $, clamp, vec3 } from '../core/util.js';
import { camera } from '../core/renderer.js';
import { game, isPlaying } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { ship, shipBubble, shipState, onDeck } from '../world/ship.js';
import { player } from '../player/player.js';
import { useUpCarried } from '../systems/items.js';
import { updatePowerHud } from '../systems/powers.js';
import { hideWin } from '../game/tasks.js';

// t: seconds since start; fading: the fade-out has begun
const dive = { t: 0, fading: false, onDone: null };
export function startBubble(onDone) {
  if (!isPlaying()) return;
  hideWin();
  if (player.carrying) useUpCarried();
  player.climb = null;
  player.zip = null;
  player.swing = null;
  game.state = 'bubble';
  Object.assign(dive, { t: 0, fading: false, onDone });
  shipBubble.visible = true;
  shipBubble.scale.setScalar(0.01);
  sfx.stretch();
  updatePowerHud();
}

// timeline: bubble grows for 1.6 s, the ship sinks from 2 s (down to 7), fade out at 6.5 s
game.cutscenes.bubble = {
  update(dt) {
    const time = game.time;
    dive.t += dt;
    const grown = clamp(dive.t / 1.6, 0, 1);
    shipBubble.scale.setScalar(0.01 + grown * (1 + Math.sin(time * 3) * 0.02));
    if (dive.t > 2) shipState.depth = Math.min(7, (dive.t - 2) * 1.6);
    player.pos.copy(onDeck());
    player.yaw = ship.rotation.y;
    shipBubble.position.copy(ship.position).add(vec3(0, 2.8, 0));
    if (Math.random() < dt * 8) releaseBubble();
    // circle the ship, sinking with it
    const angle = time * 0.25,
      wanted = vec3(
        ship.position.x + Math.sin(angle) * 15,
        7 - shipState.depth * 0.6,
        ship.position.z + Math.cos(angle) * 15,
      );
    camera.position.lerp(wanted, 1 - Math.exp(-dt * 2.5));
    camera.lookAt(ship.position.x, ship.position.y + 2, ship.position.z);
    if (dive.t > 6.5 && !dive.fading) fadeOut();
  },
};

// a little air bubble rising somewhere around the ship
function releaseBubble() {
  burst(
    ship.position
      .clone()
      .add(vec3((Math.random() - 0.5) * 8, Math.random() * 5, (Math.random() - 0.5) * 8)),
    { count: 1, color: 0xdff9ff, speed: 1, up: 2, life: 1.2, size: 1.2, gravity: -0.2 },
  );
}

// fade to black, switch island behind it, fade back in
function fadeOut() {
  dive.fading = true;
  $('#fade').classList.add('show');
  setTimeout(() => {
    dive.onDone();
    $('#fade').classList.remove('show');
  }, 800);
}
