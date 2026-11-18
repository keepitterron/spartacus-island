// Where each island sits in the world. Islands are spread along -z and each owns a band
// of z for its terrain (see addTerrain). Keep ~150 units between land islands so the
// sailing cutscene has room; the underwater island is far away so the surface fog hides it.
export const CENTER_1 = { x: 0, z: 0 }; // starter island
export const CENTER_2 = { x: 0, z: -170 }; // Hook Rock Bay
export const CENTER_3 = { x: 0, z: -322 }; // Mossy Paw Woods
export const CENTER_4 = { x: 0, z: -720 }; // Bubbly Ocean (sea floor)
export const CENTER_5 = { x: 0, z: -1100 }; // Rainbow Reef: a ring of islets, far enough that fog hides island 4
// the sky island: clouds at about sea level, past the end of island 5's sea so no water shows
// under it (the height is faked with a sea of clouds and the fog)
export const CENTER_6 = { x: 0, z: -1550 };
// the funfair: back down on the sea, far past the sky island so its cloud sea is lost in the fog
export const CENTER_7 = { x: 0, z: -2000 }; // Jamboree Island
