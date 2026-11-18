// Little things that make island 1 feel alive: Bubbly Spring bubbles up and rings ripples
// (world/bubble-spot.js). The camp's campfire is world/campfire.js.
import { addBubbleSpot } from '../../world/bubble-spot.js';

// spring: {spot} (world/bubble-spot.js)
const spring = { spot: null };

// pos: {x, y, z} the middle of the spring, at the water's surface
export function addSpringBubbles(pos) {
  spring.spot = addBubbleSpot(pos);
}

export function updateAmbience(dt, p) {
  spring.spot?.update(dt, p);
}
