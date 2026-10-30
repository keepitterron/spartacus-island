import { clamp, distXZ, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst, textSprite, onFontsReady } from '../../core/fx.js';
import { toast } from '../../core/ui.js';
import { terrainHeight } from '../../world/terrain.js';
import { ship } from '../../world/ship.js';
import { player } from '../../player/player.js';
import { dog } from '../../player/dog.js';
import { completeTask } from '../../game/tasks.js';
import { makeCrab } from './crabs.js';
import { octo } from './octopus.js';
import { LU, lanePt, EDBEHIND } from './geo.js';

// Eduardo, the purple hermit crab with black spots. He thinks Spartacus is a shark and
// runs: into one seaweed clump, then the next, then behind the octopus. Once the octopus
// has moved to bed, Eduardo recognises Spartacus, rides his hat and joins the crew.
// state: idle0 | eek | run | inClump | behind | recognize | hop | riding | toShip | crew
export let eduardo = null;
let hides = [],
  sharkTxt = null;
// hideIn: the clumps he dives into, in order
export function buildEduardo(hideIn) {
  hides = hideIn;
  const c = makeCrab(0x8a5cf6, 0xb59cff, true);
  const q = lanePt(3.5, 0);
  c.g.position.set(q.x, terrainHeight(q.x, q.z), q.z);
  c.g.rotation.y = Math.atan2(-LU.x, -LU.z);
  c.g.scale.setScalar(1.6);
  scene.add(c.g);
  eduardo = { g: c.g, inner: c.inner, state: 'idle0', t: 0, stage: 0, target: null };
  onFontsReady(() => {
    sharkTxt = textSprite('A SHARK!!', '#ffffff');
    sharkTxt.scale.set(3.6, 0.9, 1);
    sharkTxt.visible = false;
    scene.add(sharkTxt);
  });
}
export function eek() {
  eduardo.state = 'eek';
  eduardo.t = 0;
  sfx.parrot();
  toast('Eduardo: “EEK! A SHARK!!”', 2200);
}
export function eduardoToShip() {
  const e = eduardo;
  e.state = 'toShip';
  e.t = 0;
  const w = vec3();
  e.g.getWorldPosition(w);
  dog.head.remove(e.g);
  scene.add(e.g);
  e.g.position.copy(w);
  e.g.scale.setScalar(1.3);
  e.from = w;
}

export function updateEduardo(dt) {
  const e = eduardo,
    eg = e.g,
    T = game.T;
  e.t += dt;
  if (e.state === 'idle0') {
    e.inner.children.forEach((ch, i) => {
      if (i > 3 && i % 2) ch.rotation.x = Math.sin(T * 4 + i) * 0.3;
    });
  } else if (e.state === 'eek') {
    eg.rotation.z = Math.sin(T * 40) * 0.15;
    eg.position.y =
      terrainHeight(eg.position.x, eg.position.z) + Math.abs(Math.sin(e.t * 14)) * 0.3;
    if (sharkTxt) {
      sharkTxt.visible = true;
      sharkTxt.position.set(eg.position.x, eg.position.y + 2.6, eg.position.z);
    }
    if (e.t > 0.9) {
      eg.rotation.z = 0;
      if (sharkTxt) sharkTxt.visible = false;
      e.stage++;
      e.state = 'run';
      e.t = 0;
      e.target = e.stage <= hides.length ? hides[e.stage - 1] : EDBEHIND;
    }
  } else if (e.state === 'run') {
    const dx = e.target.x - eg.position.x,
      dz = e.target.z - eg.position.z,
      d = Math.hypot(dx, dz);
    if (d > 0.15) {
      const st = Math.min(d, dt * 7);
      eg.position.x += (dx / d) * st;
      eg.position.z += (dz / d) * st;
      eg.position.y =
        terrainHeight(eg.position.x, eg.position.z) + Math.abs(Math.sin(T * 18)) * 0.12;
      eg.rotation.y = Math.atan2(dx, dz);
      if (Math.random() < dt * 12)
        burst(eg.position.clone(), {
          count: 1,
          color: 0xf0d9a0,
          speed: 1,
          up: 1,
          life: 0.4,
          size: 0.6,
        });
    } else if (e.stage <= hides.length) {
      eg.visible = false;
      e.target.edInside = true;
      e.state = 'inClump';
      toast('Eduardo dived into the seaweed! Chop it to find him.', 3000);
    } else {
      e.state = 'behind';
      eg.rotation.y = Math.atan2(-LU.x, -LU.z);
      toast(
        octo.moved
          ? 'Eduardo is hiding by the octopus’s bed!'
          : 'Eduardo hid behind the grumpy octopus!',
        3200,
      );
    }
  } else if (e.state === 'inClump') {
    const c = e.target;
    c.g.rotation.z += Math.sin(T * 22) * 0.06;
    if (Math.random() < dt * 4)
      burst(vec3(c.x, c.y + 1, c.z), {
        count: 1,
        color: 0xdff9ff,
        speed: 0.6,
        up: 2,
        life: 1.5,
        size: 0.8,
        gravity: -0.2,
      });
  } else if (e.state === 'behind') {
    eg.rotation.z = Math.sin(T * 30) * 0.06;
    if (octo.moved && distXZ(player.pos, eg.position.x, eg.position.z) < 2.8) {
      e.state = 'recognize';
      e.t = 0;
      eg.rotation.z = 0;
      sfx.parrot();
      eg.rotation.y = Math.atan2(player.pos.x - eg.position.x, player.pos.z - eg.position.z);
      toast('Eduardo: “Oh! It’s just Spartacus! Not a shark at all!”', 3400);
    }
  } else if (e.state === 'recognize') {
    eg.position.y = terrainHeight(eg.position.x, eg.position.z) + Math.abs(Math.sin(e.t * 8)) * 0.4;
    if (e.t > 1.4) {
      e.state = 'hop';
      e.t = 0;
      e.from = eg.position.clone();
    }
  } else if (e.state === 'hop') {
    const k = clamp(e.t / 0.8, 0, 1),
      to = dog.head.localToWorld(vec3(0, 0.72, -0.05));
    eg.position.lerpVectors(e.from, to, k);
    eg.position.y += Math.sin(Math.PI * k) * 1.2;
    if (k >= 1) {
      scene.remove(eg);
      dog.head.add(eg);
      eg.position.set(0, 0.68, -0.05);
      eg.rotation.set(0, 0, 0);
      eg.scale.setScalar(0.95);
      e.state = 'riding';
      toast('Eduardo climbs onto Spartacus’s hat!', 2600);
      completeTask('eduardo');
    }
  } else if (e.state === 'riding') {
    e.inner.children.forEach((ch, i) => {
      if (i > 3 && i % 2) ch.rotation.x = Math.sin(T * 6 + i) * 0.3;
    });
  } else if (e.state === 'toShip') {
    const k = clamp(e.t / 1, 0, 1),
      to = ship.localToWorld(vec3(-0.6, 1.2, 1));
    eg.position.lerpVectors(e.from, to, k);
    eg.position.y += Math.sin(Math.PI * k) * 2;
    if (k >= 1) {
      scene.remove(eg);
      ship.add(eg);
      eg.position.set(-0.6, 1.18, 1);
      eg.rotation.set(0, 0, 0);
      eg.scale.setScalar(1.3);
      e.state = 'crew';
      sfx.bone();
      completeTask('ship4');
    }
  }
}
