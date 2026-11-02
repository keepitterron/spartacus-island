// The four colour stars of the unicorn's broken rainbow. Walking into one sends it flying home
// to its socket in the stone arch on the hub, and the island colours that stripe of her mane.
import { clamp, distXZ } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { toast } from '../../core/ui.js';
import { makeStar } from '../../models/items.js';

// {name, color, task, pos (where it waits), model, socket (Vector3 in the arch), onHome(star, {quiet}),
//  state: waiting | flying | home, t (seconds into the flight), from}
const stars = [];
const FLIGHT_HEIGHT = 12; // how high the arc home goes

export function addStar(name, { color, pos, task, socket, onHome }) {
  const model = makeStar(color);
  model.position.copy(pos);
  scene.add(model);
  const star = {
    name,
    color,
    task,
    pos: pos.clone(),
    model,
    socket,
    onHome,
    state: 'waiting',
    t: 0,
  };
  stars.push(star);
  return star;
}
export const starForTask = (task) => stars.find((star) => star.task === task);

// in the island's interact(p): walking into a waiting star
export function grabStars(pos) {
  for (const star of stars) {
    if (star.state !== 'waiting') continue;
    if (distXZ(pos, star.pos.x, star.pos.z) > 1.3 || Math.abs(pos.y + 0.8 - star.pos.y) > 1.6)
      continue;
    star.state = 'flying';
    star.t = 0;
    star.from = star.model.position.clone();
    sfx.fruit();
    burst(star.from.clone(), {
      count: 30,
      color: [star.color, 0xffffff],
      speed: 5,
      up: 3,
      life: 1,
    });
    toast(`The ${star.name} star! It’s flying home to the stone arch.`, 3200);
  }
}

// straight into its socket, no flight (also used when a save is put back)
export function sendStarHome(star, { quiet = false } = {}) {
  star.state = 'home';
  star.model.position.copy(star.socket);
  star.model.rotation.set(0, 0, 0);
  star.model.scale.setScalar(0.7);
  star.onHome(star, { quiet });
}

export function updateStars(dt) {
  const time = game.time;
  for (const star of stars) {
    if (star.state === 'waiting') {
      star.model.rotation.y += dt * 1.8;
      star.model.position.y = star.pos.y + Math.sin(time * 2.5) * 0.15;
    } else if (star.state === 'flying') fly(star, dt);
  }
}

// an arc from where it was picked up to its socket, sparkling as it goes
function fly(star, dt) {
  star.t += dt;
  const duration = clamp(star.from.distanceTo(star.socket) / 18, 1.5, 3.5),
    t = clamp(star.t / duration, 0, 1),
    eased = t * t * (3 - 2 * t);
  star.model.position.lerpVectors(star.from, star.socket, eased);
  star.model.position.y += Math.sin(Math.PI * t) * FLIGHT_HEIGHT;
  star.model.rotation.y += dt * 8;
  star.model.scale.setScalar(1 - 0.3 * eased);
  if (Math.random() < dt * 30)
    burst(star.model.position.clone(), {
      count: 1,
      color: [star.color, 0xffffff],
      speed: 0.5,
      up: 0.5,
      life: 0.7,
      size: 0.8,
    });
  if (t < 1) return;
  sfx.ding();
  burst(star.socket.clone(), {
    count: 26,
    color: [star.color, 0xffffff],
    speed: 4,
    up: 2,
    life: 1,
  });
  sendStarHome(star);
}
