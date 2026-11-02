// Shared, mutable game state. Modules read and write game.x instead of exporting `let`s,
// because ES module bindings can't be reassigned from outside.
export const game = {
  state: 'start', // start | play | rescue | or the name of a cutscene (sail, bubble, whale)
  island: 1, // id of the island being played
  islands: {}, // id -> island module (see docs/islands.md)
  cutscenes: {}, // state name -> {update(dt)}
  time: 0, // seconds since boot (drives all idle animations)
  flagUp: false, // ship flag raised
  spinLeft: 0, // celebration spin left (radians)
  celebrateTime: -1, // seconds into the island-complete celebration, -1 when none
  celebrateIsland: null, // island whose win panel shows when the celebration ends
  hintCooldown: 0, // cooldown for repeating "too high" hints
  building: 0, // id of the island whose build() is running, so systems know whose things they add
  restoring: false, // true while a mid-island save is being put back (messages stay quiet)
  debug: false,
};
// follow-camera settings: yaw around the player, height above, distance behind
export const followCam = { yaw: 0, height: 6, distance: 11.5 };
export const currentIsland = () => game.islands[game.island];
// the island a new dig, seed or item belongs to: the one being built, or the one being played
export const ownerIsland = () => game.building || game.island;
export const isPlaying = () => game.state === 'play';
export const isInCutscene = () => !!game.cutscenes[game.state];
