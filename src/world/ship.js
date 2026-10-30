// The crew's ship. It moves between islands; rescued friends ride on it.
import * as THREE from 'three';
import { lerp } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { material, mesh, canvasTexture, drawPaw } from '../core/materials.js';
import { game } from '../core/state.js';

export const ship = new THREE.Group();
ship.position.set(5.6, -0.15, 33.5);
scene.add(ship);
// baseY: resting height (bobs around it); depth: how far it has sunk (island 3 -> 4)
export const shipState = { baseY: -0.15, depth: 0 };
// deck spot where Spartacus stands during cutscenes (ship-local)
export const DECK = new THREE.Vector3(0, 1.17, -0.5);
const FLAG_LOWERED_Y = 5.0;
const FLAG_RAISED_Y = 6.9;
let flag;
{
  // hull: a side profile extruded across the ship's width, then turned to face +z
  const profile = new THREE.Shape();
  profile.moveTo(-3, 1.1);
  profile.lineTo(3.4, 1.35);
  profile.quadraticCurveTo(3.0, 0, 2.2, -0.6);
  profile.lineTo(-2.4, -0.6);
  profile.quadraticCurveTo(-3.1, -0.2, -3, 1.1);
  const hullGeo = new THREE.ExtrudeGeometry(profile, {
    depth: 2.3,
    bevelEnabled: true,
    bevelSize: 0.15,
    bevelThickness: 0.15,
    bevelSegments: 1,
    curveSegments: 6,
  });
  hullGeo.translate(0, 0, -1.15);
  hullGeo.rotateY(-Math.PI / 2);
  ship.add(mesh(hullGeo, material(0x8b5a3c), { receiveShadow: true }));
  const stripe = mesh(new THREE.BoxGeometry(2.75, 0.18, 5.4), material(0xf2545b));
  stripe.position.set(0, 0.75, 0.1);
  ship.add(stripe);
  const deck = mesh(new THREE.BoxGeometry(2.2, 0.12, 5.6), material(0xd9a46a), {
    receiveShadow: true,
  });
  deck.position.set(0, 1.1, 0.1);
  ship.add(deck);
  const cabin = mesh(new THREE.BoxGeometry(1.7, 1, 1.4), material(0xfffaf0));
  cabin.position.set(0, 1.65, -1.8);
  ship.add(cabin);
  const roof = mesh(new THREE.BoxGeometry(1.95, 0.18, 1.65), material(0x2fa4c7));
  roof.position.set(0, 2.22, -1.8);
  ship.add(roof);
  const mast = mesh(new THREE.CylinderGeometry(0.11, 0.14, 6.4, 6), material(0x7a4a2a));
  mast.position.set(0, 4.2, 0.4);
  ship.add(mast);
  const nest = mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.4, 8), material(0x9c6436));
  nest.position.set(0, 6.4, 0.4);
  ship.add(nest);
  const sailTex = canvasTexture(256, 220, (ctx, w, h) => {
    ctx.fillStyle = '#fff6e2';
    ctx.fillRect(0, 0, w, h);
    drawPaw(ctx, { x: w / 2, y: h / 2, size: 52, color: '#f2545b' });
  });
  const sail = mesh(
    new THREE.BoxGeometry(3, 2.5, 0.06),
    new THREE.MeshStandardMaterial({ map: sailTex, roughness: 0.9 }),
  );
  sail.position.set(0, 4.1, 0.55);
  ship.add(sail);
  const yard = mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.3, 5), material(0x7a4a2a));
  yard.rotation.z = Math.PI / 2;
  yard.position.set(0, 5.4, 0.55);
  ship.add(yard);
  // pirate flag: a white bone (bar + four knobs) under a paw print
  const flagTex = canvasTexture(128, 86, (ctx, w, h) => {
    ctx.fillStyle = '#f2545b';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(34, 38, 60, 12);
    [
      [34, 38],
      [34, 50],
      [94, 38],
      [94, 50],
    ].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, 7);
      ctx.fill();
    });
    drawPaw(ctx, { x: 64, y: 20, size: 13, color: '#fff' });
  });
  const flagGeo = new THREE.PlaneGeometry(1.2, 0.8);
  flagGeo.translate(0.6, 0, 0); // hinge on the mast edge so it flaps around it
  flag = new THREE.Mesh(
    flagGeo,
    new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.9 }),
  );
  flag.position.set(0.1, FLAG_LOWERED_Y, 0.4);
  ship.add(flag);
  // figurehead: a little Spartacus (head, white blaze, snout, nose, floppy ears)
  const figurehead = new THREE.Group();
  figurehead.position.set(0, 1.55, 3.55);
  ship.add(figurehead);
  figurehead.add(mesh(new THREE.SphereGeometry(0.42, 10, 8), material(0x2a2a33)));
  const blaze = mesh(new THREE.BoxGeometry(0.027, 0.3, 0.05), material(0xffffff));
  blaze.position.set(0, 0.16, 0.38);
  blaze.rotation.x = -0.4;
  figurehead.add(blaze);
  const snout = mesh(new THREE.SphereGeometry(0.22, 8, 6), material(0x2a2a33));
  snout.position.set(0, -0.1, 0.36);
  figurehead.add(snout);
  const nose = mesh(new THREE.SphereGeometry(0.08, 6, 5), material(0x0c0c10));
  nose.position.set(0, -0.03, 0.58);
  figurehead.add(nose);
  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.BoxGeometry(0.13, 0.42, 0.26), material(0x1f1f27));
    ear.position.set(side * 0.38, -0.12, 0);
    ear.rotation.z = side * 0.3;
    figurehead.add(ear);
  }
}
// the big air bubble around the ship underwater
export const shipBubble = new THREE.Mesh(
  new THREE.SphereGeometry(5.5, 24, 16),
  new THREE.MeshStandardMaterial({
    color: 0xbff3ff,
    transparent: true,
    opacity: 0.28,
    roughness: 0.1,
    metalness: 0.2,
    depthWrite: false,
  }),
);
shipBubble.visible = false;
scene.add(shipBubble);

// put the ship at t (0..1) along a sailing path, facing along it
export function placeShipAt(t, path) {
  const eased = t * t * (3 - 2 * t); // smoothstep: ease in and out of the harbour
  const point = path.getPointAt(eased);
  const tangent = path.getTangentAt(eased);
  ship.position.x = point.x;
  ship.position.z = point.z;
  ship.rotation.y = Math.atan2(tangent.x, tangent.z);
  ship.updateMatrixWorld(true);
}
// where Spartacus stands while the ship moves
export const onDeck = () => {
  ship.updateMatrixWorld(true);
  return ship.localToWorld(DECK.clone());
};

// a water bucket on deck for Wasabi
export function addBucket() {
  if (ship.userData.bucket) return;
  const bucket = mesh(new THREE.CylinderGeometry(0.36, 0.3, 0.45, 10), material(0x9aa6b8));
  bucket.position.set(0.65, 1.38, 1.4);
  ship.add(bucket);
  const water = mesh(new THREE.CircleGeometry(0.32, 10), material(0x4cc3e6), { castShadow: false });
  water.rotation.x = -Math.PI / 2;
  water.position.set(0.65, 1.58, 1.4);
  ship.add(water);
  ship.userData.bucket = bucket;
}

// bob and rock on the waves, flap the flag and slide it up the mast once game.flagUp is set.
// During a cutscene the bubble is left where the cutscene puts it.
export function updateShip(dt, cutscene) {
  const time = game.time;
  ship.position.y = shipState.baseY + Math.sin(time * 1.2) * 0.12 - shipState.depth;
  if (shipBubble.visible && !cutscene)
    shipBubble.position.copy(ship.position).add(new THREE.Vector3(0, 2.8, 0));
  ship.rotation.z = Math.sin(time * 0.9) * 0.04;
  ship.rotation.x = Math.sin(time * 0.7) * 0.02;
  flag.rotation.y = Math.sin(time * 4) * 0.25;
  const flagTargetY = game.flagUp ? FLAG_RAISED_Y : FLAG_LOWERED_Y;
  flag.position.y = lerp(flag.position.y, flagTargetY, dt * 1.2);
}
