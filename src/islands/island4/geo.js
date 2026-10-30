import { vec3 } from '../../core/util.js';
import { CENTER_4 } from '../../world/layout.js';

// Shared layout of the Bubbly Ocean: the sea floor basin around CENTER_4, the seaweed lane
// and the bubble vent canyon. Used by every island4 module.
// PLACEHOLDER LAYOUT until Zoë draws the map: positions use toWorld(x, z) island-local coordinates.
export const SEA_BED_Y = -20;
export const toWorld = (x, z) => ({ x: CENTER_4.x + x, z: CENTER_4.z + z });

// the seaweed lane from LANE_START to LANE_END, guarded by tentacle gates; the octopus sleeps past its end
export const LANE_START = toWorld(0, 2);
export const LANE_END = toWorld(-10, -21);
export const LANE_DIR = vec3(LANE_END.x - LANE_START.x, 0, LANE_END.z - LANE_START.z);
export const LANE_LENGTH = LANE_DIR.length();
LANE_DIR.normalize();
export const LANE_NORMAL = vec3(-LANE_DIR.z, 0, LANE_DIR.x);
// along = distance down the lane, side = sideways offset
export const lanePoint = (along, side) => ({
  x: LANE_START.x + LANE_DIR.x * along + LANE_NORMAL.x * side,
  z: LANE_START.z + LANE_DIR.z * along + LANE_NORMAL.z * side,
});
export const OCTOPUS_SPOT = lanePoint(LANE_LENGTH + 3.4, 0); // .y is set when the island is built
export const EDUARDO_LAST_HIDE = {
  x: OCTOPUS_SPOT.x + LANE_DIR.x * 2.1,
  z: OCTOPUS_SPOT.z + LANE_DIR.z * 2.1,
}; // behind the octopus

// the bubble vent canyon from CANYON_START to CANYON_END with the pillow at the far end
export const CANYON_START = toWorld(5, -5);
export const CANYON_END = toWorld(16, -17);
export const CANYON_DIR = vec3(CANYON_END.x - CANYON_START.x, 0, CANYON_END.z - CANYON_START.z);
export const CANYON_LENGTH = CANYON_DIR.length();
CANYON_DIR.normalize();
export const CANYON_NORMAL = vec3(-CANYON_DIR.z, 0, CANYON_DIR.x);
export const canyonPoint = (along, side) => ({
  x: CANYON_START.x + CANYON_DIR.x * along + CANYON_NORMAL.x * side,
  z: CANYON_START.z + CANYON_DIR.z * along + CANYON_NORMAL.z * side,
});
