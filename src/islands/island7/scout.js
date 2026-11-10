// Leo the magpie helps on this island (the friend rescued on the last one always does). He
// loves shiny things, and golden tickets are very shiny: woof, and he flies from his perch on
// the welcome arch to the nearest ticket Spartacus hasn't found, and flutters over it for a
// while. So the last hidden ticket never means a long, sad search.
// (npcs/leo.js only moves him on the sky island; here this module does.)
import { clamp, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { toast, hintOnce } from '../../core/ui.js';
import { remainingPickups } from '../../systems/collect.js';
import { leo } from '../../npcs/leo.js';

const FLY_SPEED = 17;
const HOVER_TIME = 9; // seconds he stays over a ticket
const HOVER_HEIGHT = 2.4;
const ISLAND = 7;

// state: perched | out (flying to a ticket) | hover | back; flight: {from, to, t, duration}
const scout = { perch: null, state: 'perched', flight: null, ticket: null, timeLeft: 0 };

// perch: a Vector3 on top of the welcome arch. Call from the island's enter().
export function leoToPerch(perch) {
  scout.perch = perch;
  scout.state = 'perched';
  const g = leo.g;
  g.parent?.remove(g);
  scene.add(g);
  g.position.copy(perch);
  g.scale.setScalar(1.2);
  g.rotation.set(0, 0, 0); // looking down the path from the dock
  leo.jewel.visible = false;
  leo.cone.visible = false;
  for (const mark of Object.values(leo.marks)) mark.visible = false;
  leo.state = 'crew'; // npcs/leo.js leaves a crew member alone
}

function flyTo(to, next) {
  const from = leo.g.position.clone();
  scout.flight = { from, to, next, t: 0, duration: clamp(from.distanceTo(to) / FLY_SPEED, 0.8, 7) };
  scout.state = next === 'hover' ? 'out' : 'back';
  sfx.flutter();
}

// a woof at pos: off he goes to the nearest ticket still out there. Returns true if he went.
export function sendLeo(pos) {
  if (!scout.perch || scout.state === 'out') return false;
  const tickets = remainingPickups(ISLAND);
  if (!tickets.length) return false;
  const dist = (ticket) => Math.hypot(ticket.x - pos.x, ticket.z - pos.z, ticket.y - pos.y);
  const nearest = tickets.reduce((best, ticket) => (dist(ticket) < dist(best) ? ticket : best));
  if (scout.state === 'hover' && scout.ticket === nearest) {
    scout.timeLeft = HOVER_TIME; // already there: he just stays longer
    return true;
  }
  scout.ticket = nearest;
  flyTo(vec3(nearest.x, nearest.y + HOVER_HEIGHT, nearest.z), 'hover');
  sfx.parrot();
  hintOnce('leoScout', 'Leo: “Chack-chack! I can see something shiny!” Follow him!', 3800);
  return true;
}

export function updateScout(dt) {
  if (!scout.perch) return;
  const g = leo.g,
    flying = scout.state === 'out' || scout.state === 'back';
  if (flying) updateFlight(dt);
  if (scout.state === 'hover') hover(dt);
  // wings: fast flaps in the air, folded on the perch
  const flap =
    scout.state === 'perched' ? Math.sin(game.time * 3) * 0.05 : Math.sin(game.time * 22) * 0.9;
  leo.wings.forEach((wing, i) => {
    wing.rotation.z = (i ? -1 : 1) * (0.1 + flap);
  });
  if (scout.state === 'perched') g.rotation.y = Math.sin(game.time * 0.7) * 0.5;
}

function updateFlight(dt) {
  const flight = scout.flight,
    g = leo.g;
  flight.t += dt;
  const t = clamp(flight.t / flight.duration, 0, 1);
  g.position.lerpVectors(flight.from, flight.to, t);
  g.position.y += Math.sin(Math.PI * t) * 3;
  g.rotation.y = Math.atan2(flight.to.x - flight.from.x, flight.to.z - flight.from.z);
  if (t < 1) return;
  scout.state = flight.next;
  if (flight.next === 'hover') {
    scout.timeLeft = HOVER_TIME;
    toast('Leo: “Chack! Here! Shiny!”', 2400);
  }
}

// circling just above the ticket, with sparkles; home again when it's found or time's up
function hover(dt) {
  const { ticket } = scout,
    g = leo.g,
    angle = game.time * 2.2;
  g.position.set(
    ticket.x + Math.cos(angle) * 1.1,
    ticket.y + HOVER_HEIGHT + Math.sin(game.time * 5) * 0.15,
    ticket.z + Math.sin(angle) * 1.1,
  );
  g.rotation.y = -angle;
  if (Math.random() < dt * 8)
    burst(vec3(ticket.x, ticket.y + 0.4, ticket.z), {
      count: 1,
      color: [0xffd84d, 0xffffff],
      speed: 0.8,
      up: 3,
      life: 0.8,
      size: 0.8,
      gravity: 0.05,
    });
  scout.timeLeft -= dt;
  if (ticket.taken || scout.timeLeft <= 0) flyTo(scout.perch.clone(), 'perched');
}
