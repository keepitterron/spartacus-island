// The whale who brought the ship here lives in the lagoon by the sea stack. Every few seconds
// it surfaces; stand on its back and its spout throws Spartacus high up, enough to land on the
// sea stack's first ledge without Boing-Boing.
import { distXZ, lerp, smoothstep, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { toast, hintOnce } from '../../core/ui.js';
import { addCylinder } from '../../core/colliders.js';
import { player } from '../../player/player.js';
import { makeWhale } from '../island4/whale.js';

const SCALE = 0.5;
const BACK_TOP = 0.6; // standing height on its back when surfaced
const UNDER = -4.5; // body centre when it's down
const SURFACED = BACK_TOP - 3 * SCALE;
const SPOUT_SPEED = 20; // straight up: about 6.7 high
// one cycle (seconds): down, rising, surfaced, spouting, sinking
const PHASES = { down: 4, rise: 1.2, up: 3.2, spout: 1.6, sink: 1.2 };
const CYCLE = Object.values(PHASES).reduce((a, b) => a + b, 0);

// spot: where it surfaces (world {x, z}); toward: what it faces
export function buildWhaleSpout(spot, { toward }) {
  const { g, tail } = makeWhale();
  g.scale.setScalar(SCALE);
  g.position.set(spot.x, UNDER, spot.z);
  g.rotation.y = Math.atan2(toward.x - spot.x, toward.z - spot.z);
  scene.add(g);
  const col = addCylinder(spot.x, spot.z, { r: 1.7, bottom: -3, top: BACK_TOP });
  col.top = -999;
  const whale = { g, tail, col, spot, launched: false };
  return {
    update: (dt) => updateWhale(whale, dt),
    interact(p) {
      if (distXZ(p, spot.x, spot.z) < 8)
        hintOnce('reefWhale', 'The friendly whale! Hop on its back when it comes up.', 3400);
    },
  };
}

// where in the cycle we are: {name, t (0..1 through that phase)}
function phaseAt(time) {
  let left = time % CYCLE;
  for (const [name, length] of Object.entries(PHASES)) {
    if (left < length) return { name, t: left / length };
    left -= length;
  }
  return { name: 'down', t: 0 };
}

function updateWhale(whale, dt) {
  const { g, tail, col, spot } = whale,
    { name, t } = phaseAt(game.time);
  tail.rotation.x = Math.sin(game.time * 2) * 0.3;
  const heights = { down: UNDER, up: SURFACED, spout: SURFACED };
  const y =
    heights[name] ??
    (name === 'rise' ? lerp(UNDER, SURFACED, smoothstep(0, 1, t)) : lerp(SURFACED, UNDER, t));
  g.position.y = y;
  col.top = y > SURFACED - 0.8 ? y + 3 * SCALE : -999;
  if (name !== 'spout') {
    whale.launched = false;
    return;
  }
  spray(spot, dt);
  const onBack = distXZ(player.pos, spot.x, spot.z) < 1.8 && Math.abs(player.pos.y - col.top) < 0.3;
  if (!onBack || whale.launched) return;
  whale.launched = true;
  player.vel.y = SPOUT_SPEED;
  player.grounded = false;
  sfx.boing();
  toast('WHOOSH! The whale’s spout throws Spartacus up high!', 2600);
}

function spray(spot, dt) {
  if (Math.random() > dt * 30) return;
  burst(vec3(spot.x, BACK_TOP + 0.3, spot.z), {
    count: 2,
    color: [0xffffff, 0xbff3ff],
    speed: 1.5,
    up: 10,
    life: 0.9,
    size: 1,
  });
}
