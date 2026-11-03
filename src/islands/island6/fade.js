// Tall walls on the sky island (the cloud walls, the crystal fence) fade to see-through while
// they're between the camera and Spartacus, so they never hide him or the way on. Each wall
// has its own material(s) for this.
import { vec3 } from '../../core/util.js';
import { camera } from '../../core/renderer.js';
import { inFootprint } from '../../core/colliders.js';
import { player } from '../../player/player.js';

const FADED = 0.08; // opacity (times the material's own) while it's in the way
const FADE_SPEED = 6;
const VIEW_STEPS = 12;
// {cols: [collider], materials: [{m, opacity}], fade: 1}
const faders = [];

// cols: the wall's colliders (what blocks the view); materials: only this wall's
export function addFader(cols, materials) {
  for (const m of materials) m.transparent = true;
  faders.push({ cols, materials: materials.map((m) => ({ m, opacity: m.opacity })), fade: 1 });
}

// is any of these colliders on the line from Spartacus to the camera?
function blocksView(cols, from, to) {
  const point = vec3();
  for (let i = 1; i < VIEW_STEPS; i++) {
    point.lerpVectors(from, to, i / VIEW_STEPS);
    if (cols.some((c) => point.y > c.bottom && point.y < c.top && inFootprint(c, point)))
      return true;
  }
  return false;
}

export function updateFaders(dt) {
  const from = player.pos.clone().setY(player.pos.y + 0.6 * player.size);
  for (const fader of faders) {
    const target = blocksView(fader.cols, from, camera.position) ? FADED : 1;
    fader.fade += (target - fader.fade) * Math.min(1, dt * FADE_SPEED);
    for (const { m, opacity } of fader.materials) {
      m.opacity = opacity * fader.fade;
      m.depthWrite = fader.fade > 0.95; // see-through walls mustn't hide what's behind them
    }
  }
}
