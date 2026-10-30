import { $, clamp, V } from '../core/util.js';
import { camera } from '../core/renderer.js';
import { G, playing } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { ship, shipBubble, shipState, onDeck } from '../world/ship.js';
import { P } from '../player/player.js';
import { useUp } from '../systems/items.js';
import { updPower } from '../systems/powers.js';
import { hideWin } from '../game/tasks.js';

// Wasabi blows a giant bubble around the ship and it sinks like a submarine; fades out
// and calls onDone (which enters the underwater island).
const bub = { t: 0, shown: false, onDone: null };
export function startBubble(onDone) {
  if (!playing()) return;
  hideWin();
  if (P.carry) useUp();
  P.climb = P.zip = P.swing = null;
  G.state = 'bubble';
  Object.assign(bub, { t: 0, shown: false, onDone });
  shipBubble.visible = true;
  shipBubble.scale.setScalar(0.01);
  sfx.stretch();
  updPower();
}

G.cutscenes.bubble = {
  update(dt) {
    const T = G.T;
    bub.t += dt;
    const s = clamp(bub.t / 1.6, 0, 1);
    shipBubble.scale.setScalar(0.01 + s * (1 + Math.sin(T * 3) * 0.02));
    if (bub.t > 2) shipState.depth = Math.min(7, (bub.t - 2) * 1.6);
    P.pos.copy(onDeck());
    P.yaw = ship.rotation.y;
    shipBubble.position.copy(ship.position).add(V(0, 2.8, 0));
    if (Math.random() < dt * 8)
      burst(
        ship.position
          .clone()
          .add(V((Math.random() - 0.5) * 8, Math.random() * 5, (Math.random() - 0.5) * 8)),
        1,
        0xdff9ff,
        1,
        2,
        1.2,
        1.2,
        -0.2,
      );
    const a = T * 0.25,
      want = V(
        ship.position.x + Math.sin(a) * 15,
        7 - shipState.depth * 0.6,
        ship.position.z + Math.cos(a) * 15,
      );
    camera.position.lerp(want, 1 - Math.exp(-dt * 2.5));
    camera.lookAt(ship.position.x, ship.position.y + 2, ship.position.z);
    if (bub.t > 6.5 && !bub.shown) {
      bub.shown = true;
      $('#fade').classList.add('show');
      setTimeout(() => {
        bub.onDone();
        $('#fade').classList.remove('show');
      }, 800);
    }
  },
};
