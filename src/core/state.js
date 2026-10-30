// Shared, mutable game state. Modules read and write G.x instead of exporting `let`s,
// because ES module bindings can't be reassigned from outside.
export const G = {
  state: 'start', // start | play | rescue | or the name of a cutscene (sail, bubble, whale)
  island: 1, // id of the island being played
  islands: {}, // id -> island module (see docs/islands.md)
  cutscenes: {}, // state name -> {update(dt)}
  T: 0, // seconds since boot (drives all idle animations)
  flagUp: false, // ship flag raised
  spin: 0, // celebration spin left (radians)
  celebT: -1,
  celebIsland: null,
  hintT: 0, // cooldown for repeating "too high" hints
  debug: false,
};
// follow-camera settings: yaw around the player, height above, distance behind
export const cam = { yaw: 0, h: 6, dist: 11.5 };
export const cur = () => G.islands[G.island];
export const playing = () => G.state === 'play';
export const inCutscene = () => !!G.cutscenes[G.state];
