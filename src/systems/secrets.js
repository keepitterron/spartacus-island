// Secrets: wrapped presents hidden on every island, each with an accessory inside. They never
// block an island's to-do list; they're reasons to explore. Islands list them as data, in
// island-local coordinates:
//   secrets: [{ id, x, z, reward, y?, dig? }]
//   id:     unique across the game (it goes in the save)
//   reward: an accessory id from models/accessories.js
//   y:      height it sits at; default is the highest surface there (e.g. the top of a rock)
//   dig:    buried in an unmarked sand mound instead of lying in the open
//   night:  only there at night (world/daylight.js)
import { distXZ, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { game, isPlaying } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { toast, hintOnce } from '../core/ui.js';
import { loadSave, writeSave } from '../core/save.js';
import { supportHeight } from '../core/colliders.js';
import { makeGift } from '../models/items.js';
import { accessory } from '../models/accessories.js';
import { player } from '../player/player.js';
import { addDig } from './digs.js';
import { giveAccessory, wear } from './outfits.js';
import { renderTasks } from '../game/tasks.js';
import { isNight } from '../world/daylight.js';

const GIFT_COLORS = [0xff9fb2, 0xb59cff, 0x7fd8ee, 0x9be38a, 0xffa53d];
const SPARKLE_RANGE = 12; // close enough to see it glitter: findable, but not obvious
// every secret: the island's entry plus {island, x, z (world), y, found, model, pop}
const secrets = [];
// the new accessory spinning above Spartacus after opening a present: {model, t}
const showcase = { model: null, t: 0 };

// after every island is built, so presents can sit on top of rocks and pillars
export function buildSecrets() {
  const found = new Set(loadSave().secrets || []);
  for (const island of Object.values(game.islands))
    for (const entry of island.secrets || []) {
      const x = island.center.x + entry.x,
        z = island.center.z + entry.z;
      const secret = {
        ...entry,
        island: island.id,
        x,
        z,
        y: entry.y ?? supportHeight(x, z, Infinity),
        found: found.has(entry.id),
        model: null,
        pop: 0,
      };
      secrets.push(secret);
      if (secret.found) continue;
      if (entry.dig) addDig(x, z, { y: secret.y, reward: () => showGift(secret, { pop: 0.6 }) });
      else showGift(secret);
    }
}

function showGift(secret, { pop = 0 } = {}) {
  secret.model = makeGift(GIFT_COLORS[secrets.indexOf(secret) % GIFT_COLORS.length]);
  secret.model.position.set(secret.x, secret.y + 0.3, secret.z);
  secret.pop = pop;
  scene.add(secret.model);
}

export function updateSecrets(dt) {
  for (const secret of secrets) {
    if (secret.found || !secret.model) continue;
    const dist = distXZ(player.pos, secret.x, secret.z);
    if (secret.night && !showsAtNight(secret, dist)) continue;
    if (secret.pop > 0) secret.pop -= dt;
    secret.model.rotation.y += dt * 0.8;
    secret.model.position.y =
      secret.y + 0.3 + Math.sin(game.time * 2.5 + secret.x) * 0.06 + Math.max(0, secret.pop) * 1.4;
    if (dist < SPARKLE_RANGE) sparkle(secret, dt);
    if (dist < 7 && Math.abs(player.pos.y - secret.y) < 3)
      hintOnce('secret', 'A present! 🎁 Walk into it to open it.', 3000);
    const touching = dist < 1.2 && Math.abs(player.pos.y - secret.y) < 1.4 && secret.pop <= 0;
    if (touching && isPlaying()) openGift(secret);
  }
  updateShowcase(dt);
}

// night presents are invisible by day, with a hint the first time you walk past one
function showsAtNight(secret, dist) {
  secret.model.visible = isNight();
  if (!isNight() && dist < 6)
    hintOnce('night-secret', 'Something twinkles here… come back at night 🌙', 3200);
  return isNight();
}

function sparkle(secret, dt) {
  if (Math.random() > dt * 3) return;
  burst(
    vec3(
      secret.x + (Math.random() - 0.5) * 0.8,
      secret.y + 0.7,
      secret.z + (Math.random() - 0.5) * 0.8,
    ),
    {
      count: 1,
      color: [0xffd84d, 0xffffff],
      speed: 0.6,
      up: 1.4,
      life: 0.7,
      size: 0.7,
      gravity: 0.1,
    },
  );
}

function openGift(secret) {
  secret.found = true;
  scene.remove(secret.model);
  writeSave({ secrets: secrets.filter((s) => s.found).map((s) => s.id) });
  const item = accessory(secret.reward);
  giveAccessory(item.id);
  wear(item.id);
  sfx.fruit();
  sfx.ding();
  burst(secret.model.position.clone(), {
    count: 30,
    color: [0xff9fb2, 0xffd84d, 0x7fd8ee, 0x8a5cf6, 0x6ccb5f],
    speed: 6,
    up: 5,
    life: 1.6,
    size: 1.3,
    gravity: 0.3,
    confetti: true,
  });
  showOff(item);
  toast(`New outfit: ${item.name}! Dress up with 👕`, 3600);
  renderTasks();
}

// the new accessory, big, spinning above Spartacus's head for a couple of seconds
function showOff(item) {
  showcase.model?.removeFromParent();
  showcase.model = item.build();
  showcase.model.scale.setScalar(2.2);
  showcase.t = 0;
  scene.add(showcase.model);
}
function updateShowcase(dt) {
  if (!showcase.model) return;
  showcase.t += dt;
  showcase.model.position.copy(player.pos).add(vec3(0, 3.2 + Math.min(showcase.t, 0.4), 0));
  showcase.model.rotation.y += dt * 3;
  if (showcase.t < 2.6) return;
  showcase.model.removeFromParent();
  showcase.model = null;
}

// for the to-do list line "🎁 Secrets 2/6"
export function secretProgress(islandId) {
  const own = secrets.filter((s) => s.island === islandId);
  return { found: own.filter((s) => s.found).length, total: own.length };
}

// debug: the current island's secrets, and their island-local positions
export const secretList = () =>
  secrets
    .filter((s) => s.island === game.island)
    .map(({ id, reward, found, dig, x, y, z }) => {
      const center = game.islands[game.island].center;
      return { id, reward, found, dig: !!dig, x: x - center.x, y, z: z - center.z };
    });
