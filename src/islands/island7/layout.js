// Where everything stands on Jamboree Island, in island-local coordinates (x east, z south,
// heights above the sea), so a new map is a number edit. The modules next to this file build
// the things; island7/index.js puts them together.
import { CENTER_7 } from '../../world/layout.js';

export const toWorld = (x, z) => ({ x: CENTER_7.x + x, z: CENTER_7.z + z }); // island-local -> world

export const GROUND = 1.6; // the height of the fairground's grass
export const SHORE = 60; // the island's radius (its edge wobbles a few units either way)
export const DOCK = { x: 0, zFrom: 56, zTo: 70 };
export const SPAWN = [0, 53];
export const SHIP_SPOT = [4.6, 67];

// the way in: the welcome arch, Pip the ringmaster on his drum, and the rocket stand in the
// middle of the fair (the fireworks go up from here, in front of the Big Top)
export const ARCH = { x: 0, z: 45 };
export const PIP = { x: 4.5, z: 37 };
export const STAND = { x: 0, z: 14, radius: 5.5 };
export const BIG_TOP = { x: -6, z: -45, radius: 8 };

// the five show rockets, one per ride: its colour, and the task that ticks when it's home
export const ROCKETS = {
  purple: { color: 0xb06cff, task: 'fairJelly' }, // on top of the cake (Jelly Jumps)
  red: { color: 0xff5a5a, task: 'fairCannon' }, // out on Bullseye Rock
  green: { color: 0x5fd66a, task: 'fairGarden' }, // in the Secret Garden
  yellow: { color: 0xffd84d, task: 'fairWheel' }, // on the Sky Deck
  blue: { color: 0x5aa8ff, task: 'fairLoop' }, // in the coaster's loop
};

// Jelly Jumps: [x, z, top (above the ground), radius], each one a step higher towards the cake
// and about 7 from the last, and wide, so a plain bounce is enough to hop along them.
// A plain bounce rises 3.75, holding Jump 6, a Slam 12: the last hop up the cake needs the Slam.
export const JELLIES = [
  [-19, 25, 0.45, 2.4],
  [-25, 22, 2.2, 2.4],
  [-31, 18.5, 3.9, 2.4],
  [-36.5, 14.5, 5.5, 2.4],
  [-41.5, 9.5, 6.8, 2.4],
];
// the three-tier cake: [radius, top (above the ground)] per tier, the rocket on the top one
export const CAKE = {
  x: -47,
  z: 2,
  tiers: [
    [5.5, 5.4],
    [3.8, 10.4],
    [2.4, 15.4],
  ],
};

// Bullseye Rock: a little islet out at sea that only the cannon reaches
export const ISLET = { x: 80, z: -20, radius: 9, height: 1.5 };
// the Kaboom Cannon fires out to the islet; the one out there fires back onto the hay
export const CANNON_OUT = { x: 30, z: 38, to: [78, -18], apex: 24 };
export const CANNON_BACK = { x: 83, z: -24, to: [15, 35], apex: 30 };
export const HAY = { x: 15, z: 35 };
export const MOUNDS = [{ x: 30, z: 38, radius: 4.5, height: 1.4 }]; // the cannon stands on one

// the Big Wheel turns in the x-y plane (its gondolas keep the same z); the Sky Deck stands
// beside the top of it, on the south side, with the coaster's cart at its east end
export const WHEEL = { x: -32, z: -28, radius: 11, hubHeight: 14.1 };
export const SKY_DECK = { x: -32, z: -22.7, hw: 7, hd: 4.2, height: 22.4 };

// Loop-de-Woof: the coaster's track as [x, y, z] (y above the sea), from the Sky Deck down
// to the little station by the plaza. `LOOP` is added between the two halves.
const DECK_RAIL = GROUND + SKY_DECK.height + 0.3;
export const TRACK_IN = [
  [-27, DECK_RAIL, -22.7],
  [-21, DECK_RAIL, -22.7],
  [-12, 21, -24.5],
  [-1, 11, -31],
  [9, 4.6, -38.5],
  [14, 3.8, -39.2],
];
// a full vertical loop, entered heading east; `shift` slides it sideways as it goes round, so
// the way out doesn't run into the way in
export const LOOP = { x: 20, z: -38, bottom: 3.8, radius: 6.5, shift: 1.2 };
export const TRACK_OUT = [
  [26, 3.8, -36.8],
  [34, 4.5, -36],
  [43, 6.5, -30],
  [49, 8, -18],
  [50, 7.5, -4],
  [47, 6, 10],
  [39, 4.5, 19],
  [28, 3.4, 22],
  [19, 3, 22],
  [14, 3, 22],
];

// the Secret Garden: a round hedge with no door, too tall to jump. A Mega-Me dog steps over.
export const GARDEN = { x: 40, z: -4, radius: 7.5, height: 2.8 };
export const MEGA_BUSH = [22, -2];
// a stall whose roof only a giant dog can step up onto (a golden ticket lies on it)
export const POPCORN_STALL = { x: -12, z: 36 };

// where the rainbow slide from the sky island touches down: [x, y, z] steps from high in the
// south-east down to the ship's mooring (island-local, y above the sea)
export const SLIDE = [
  [34, 72, 215],
  [28, 50, 170],
  [16, 26, 128],
  [7, 7, 93],
  [4.6, 0.8, 76],
  [4.6, -0.15, 67],
];
