import { V } from '../../core/util.js';
import { C4 } from '../../world/layout.js';

// Shared layout of the Bubbly Ocean (sea floor basin around C4).
// PLACEHOLDER LAYOUT until Zoë draws the map: positions use W4(x,z) island-local coordinates.
export const SB = -20; // sea bed height
export const W4 = (x, z) => ({ x: C4.x + x, z: C4.z + z });

// the seaweed lane from LA to LB, guarded by tentacle gates; the octopus sleeps past its end
export const LA = W4(0, 2),
  LB = W4(-10, -21);
export const LU = V(LB.x - LA.x, 0, LB.z - LA.z);
export const LLEN = LU.length();
LU.normalize();
export const LN = V(-LU.z, 0, LU.x);
// s = distance along the lane, o = sideways offset
export const lanePt = (s, o) => ({ x: LA.x + LU.x * s + LN.x * o, z: LA.z + LU.z * s + LN.z * o });
export const OCTO = lanePt(LLEN + 3.4, 0);
OCTO.awake = false; // OCTO.y is set when the island is built
export const EDBEHIND = { x: OCTO.x + LU.x * 2.1, z: OCTO.z + LU.z * 2.1 }; // Eduardo's last hiding spot

// the bubble vent canyon from CA to CB with the pillow at the far end
export const CA = W4(5, -5),
  CB = W4(16, -17);
export const CU = V(CB.x - CA.x, 0, CB.z - CA.z);
export const CLEN = CU.length();
CU.normalize();
export const CN = V(-CU.z, 0, CU.x);
export const canPt = (s, o) => ({ x: CA.x + CU.x * s + CN.x * o, z: CA.z + CU.z * s + CN.z * o });
