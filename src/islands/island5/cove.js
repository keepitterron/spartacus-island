// Crab Cove (the red islet): Eduardo's ropes.
//   On the hilltop a long drawbridge is pulled up and tied to a post: Pinch the rope and it
//   drops across the bay to Crab Rock (too far to jump, even with Boing-Boing, and too tall to
//   climb out of the water). On Crab Rock a crate hangs from a crane: Pinch its rope, then jump
//   on the crate and SLAM it open. The red star is inside. Bark under the crane and Mango fetches
//   the shell on top of its arm.
import * as THREE from 'three';
import { distXZ, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { game } from '../../core/state.js';
import { material, mesh } from '../../core/materials.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { toast, hintOnce, actionKeyName } from '../../core/ui.js';
import { addBox } from '../../core/colliders.js';
import { terrainHeight } from '../../world/terrain.js';
import { rockTop } from '../../world/props.js';
import { makeShell } from '../../models/items.js';
import { addPickup } from '../../systems/collect.js';
import { mango, mangoFetch } from '../../npcs/mango.js';
import { eduardo } from '../island4/eduardo.js';
import { revealStar } from './stars.js';

const WOOD = 0xb57b46,
  ROPE = 0xe8d3a0;
const GAP = 18; // platform edge to Crab Rock edge: a running Boing-Boing jump lands ~15 out
const BRIDGE_FALL = 1.1; // seconds for the bridge to swing down
const CRATE_HANG = 3.2; // how high above the rock the crate hangs

// center: the islet's middle (world). addStar(name, pos) makes its hidden red star.
export function buildCrabCove(center, { addStar }) {
  const cove = { bridgeDown: false, crate: 'hanging', shellFetched: null, fall: 0 };
  const deckY = terrainHeight(center.x, center.z) + 0.5;
  // the lookout platform on the hilltop, then the bridge and Crab Rock out to the west
  const edgeX = center.x - 2.5;
  addPlatform(center, { top: deckY });
  const rock = { x: edgeX - GAP - 2.4, z: center.z };
  rockTop(rock.x, rock.z, { radius: 2.6, top: deckY, color: 0xc9a27a });
  cove.rock = { ...rock, y: deckY };
  buildBridge(cove, { edgeX, z: center.z, top: deckY, length: GAP + 1 });
  buildCrane(cove);
  cove.star = addStar('red', vec3(rock.x, deckY + 1.3, rock.z));
  return makeIslet(cove);
}

function addPlatform(center, { top }) {
  const ground = terrainHeight(center.x, center.z);
  const deck = mesh(new THREE.BoxGeometry(5, top - ground + 0.6, 4), material(WOOD), {
    receiveShadow: true,
  });
  deck.position.set(center.x, (top + ground - 0.6) / 2, center.z);
  scene.add(deck);
  addBox(center.x, center.z, { hw: 2.5, hd: 2, bottom: ground - 1, top });
}

// a long plank bridge hinged at the platform's west edge, standing up and tied to a post
function buildBridge(cove, { edgeX, z, top, length }) {
  const hinge = new THREE.Group();
  hinge.position.set(edgeX, top, z);
  scene.add(hinge);
  for (let i = 0; i < length / 0.8; i++) {
    const plank = mesh(new THREE.BoxGeometry(0.75, 0.16, 2), material(i % 2 ? WOOD : 0xc48a54), {
      receiveShadow: true,
    });
    plank.position.set(-0.4 - i * 0.8, -0.08, 0);
    hinge.add(plank);
  }
  for (const side of [-1, 1]) {
    const rail = mesh(new THREE.BoxGeometry(length, 0.1, 0.1), material(0x7a4a2a));
    rail.position.set(-length / 2, 0.5, side * 0.95);
    hinge.add(rail);
  }
  hinge.rotation.z = -Math.PI / 2 + 0.12; // pulled up, leaning back a little
  // the post the rope is tied to, on the platform, and the rope up to the raised bridge
  const post = { x: edgeX + 1.4, z: z + 1.4, y: top };
  const postMesh = mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.4, 6), material(0x7a4a2a));
  postMesh.position.set(post.x, top + 0.7, post.z);
  scene.add(postMesh);
  const rope = makeRope(vec3(post.x, top + 1.3, post.z), vec3(edgeX - 0.3, top + 5, z + 1.1));
  cove.bridge = { hinge, post, rope, length, z, top, edgeX };
  // the walkway, switched on once the bridge is down
  cove.bridge.col = addBox(edgeX - length / 2, z, { hw: length / 2, hd: 1, bottom: top - 1, top });
  cove.bridge.col.top = -999;
}

// a thin rope between two points
function makeRope(a, b) {
  const len = a.distanceTo(b);
  const rope = mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 5), material(ROPE), {
    castShadow: false,
  });
  rope.position.copy(a).add(b).multiplyScalar(0.5);
  rope.quaternion.setFromUnitVectors(vec3(0, 1, 0), b.clone().sub(a).normalize());
  scene.add(rope);
  return rope;
}

// a crane on Crab Rock: a post, an arm over the middle, a crate hanging from a rope;
// a shell sits on the end of the arm, for Mango
function buildCrane(cove) {
  const { x, z, y } = cove.rock;
  const postX = x + 1.9,
    armY = y + CRATE_HANG + 1.6;
  const post = mesh(new THREE.BoxGeometry(0.3, armY - y + 0.2, 0.3), material(0x7a4a2a));
  post.position.set(postX, (armY + y) / 2, z);
  scene.add(post);
  const arm = mesh(new THREE.BoxGeometry(2.6, 0.25, 0.25), material(0x7a4a2a));
  arm.position.set(x + 0.7, armY, z);
  scene.add(arm);
  const crate = new THREE.Group();
  crate.add(mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), material(0xd4955a)));
  for (const k of [-1, 1]) {
    const band = mesh(new THREE.BoxGeometry(1.13, 0.14, 1.13), material(0x9c6436));
    band.position.y = k * 0.38;
    crate.add(band);
  }
  crate.position.set(x, y + CRATE_HANG, z);
  scene.add(crate);
  const rope = makeRope(vec3(x, armY, z), vec3(x, y + CRATE_HANG + 0.55, z));
  const col = addBox(x, z, { hw: 0.55, hd: 0.55, bottom: y - 0.5, top: y + 1.1 });
  col.top = -999;
  const shell = makeShell();
  shell.position.set(x - 0.4, armY + 0.45, z);
  scene.add(shell);
  cove.crane = { crate, rope, col, shell, shellSpot: { x: x - 0.4, y: armY + 0.2, z } };
}

/* ---------------- what happens ---------------- */

function dropBridge(cove) {
  cove.bridgeDown = true;
  cove.fall = 0;
  cove.bridge.rope.visible = false;
  sfx.grab();
  burst(vec3(cove.bridge.post.x, cove.bridge.post.y + 1.2, cove.bridge.post.z), {
    count: 12,
    color: [0xe8d3a0, 0xffffff],
    speed: 2,
    up: 2,
    life: 0.6,
  });
  toast('Snip! Eduardo pinched the rope. Down comes the bridge!', 3200);
}
function lowerBridgeAtOnce(cove) {
  cove.bridgeDown = true;
  cove.fall = BRIDGE_FALL;
  cove.bridge.rope.visible = false;
  cove.bridge.hinge.rotation.z = 0;
  cove.bridge.col.top = cove.bridge.top;
}
// swing down, speeding up like a real falling drawbridge, then THUNK
function updateBridge(cove, dt) {
  if (!cove.bridgeDown || cove.fall >= BRIDGE_FALL) return;
  cove.fall = Math.min(BRIDGE_FALL, cove.fall + dt);
  const t = cove.fall / BRIDGE_FALL;
  cove.bridge.hinge.rotation.z = (-Math.PI / 2 + 0.12) * (1 - t * t);
  if (t < 1) return;
  cove.bridge.col.top = cove.bridge.top;
  sfx.thunk();
  const { edgeX, length, z, top } = cove.bridge;
  burst(vec3(edgeX - length, top + 0.3, z), {
    count: 24,
    color: [0xd09a5e, 0xffd84d],
    speed: 4,
    up: 3,
    life: 0.8,
  });
}

function dropCrate(cove, { quiet = false } = {}) {
  const { crate, rope, col } = cove.crane;
  cove.crate = 'dropped';
  rope.visible = false;
  crate.position.y = cove.rock.y + 0.55;
  col.top = cove.rock.y + 1.1;
  if (quiet) return;
  sfx.thunk();
  burst(crate.position.clone(), {
    count: 16,
    color: [0xd4955a, 0xfff0c8],
    speed: 3,
    up: 2,
    life: 0.6,
  });
  toast('Bonk! The crate fell down. Jump on it and SLAM it open!', 3400);
}
function breakCrate(cove, { quiet = false } = {}) {
  const { crate, rope, col } = cove.crane;
  cove.crate = 'broken';
  rope.visible = false;
  crate.visible = false;
  col.top = -999;
  revealStar(cove.star, { quiet });
  if (quiet) return;
  sfx.thunk();
  burst(crate.position.clone(), {
    count: 30,
    color: [0xd4955a, 0x9c6436, 0xffd84d],
    speed: 6,
    up: 4,
    life: 1,
  });
  toast('CRASH! There’s the red star!', 2800);
}

// barking under the crane: Mango flies over and brings down the shell
function callMango(cove) {
  const { shell, shellSpot } = cove.crane;
  cove.shellFetched = 'flying';
  toast('Mango heard you! He’s getting the shell…', 2600);
  mangoFetch(shellSpot, shell, (pos) => {
    cove.shellFetched = [pos.x, pos.y, pos.z];
    addPickup(pos.x, pos.z, { y: pos.y, island: 5 });
  });
}

/* ---------------- the islet, as the island sees it ---------------- */

const ridingEduardo = () => eduardo.state === 'riding';

function makeIslet(cove) {
  const { bridge, rock } = cove;
  const onRock = (p) => distXZ(p, rock.x, rock.z) < 2.6 && Math.abs(p.y - rock.y) < 1.2;
  return {
    update(dt) {
      updateBridge(cove, dt);
      if (cove.crate === 'hanging') cove.crane.crate.rotation.y = Math.sin(game.time * 1.1) * 0.15; // swaying on its rope
    },
    interact(p) {
      const nearPost = distXZ(p, bridge.post.x, bridge.post.z) < 2.2;
      if (!cove.bridgeDown && nearPost && Math.abs(p.y - bridge.top) < 1.2)
        hintOnce(
          'coveRope',
          `The bridge is tied up! Eduardo can Pinch the rope (${actionKeyName()}).`,
          3600,
        );
      if (onRock(p) && cove.crate === 'hanging')
        hintOnce('coveCrate', 'A crate on a rope! Stand under it and Pinch.', 3200);
      if (onRock(p) && cove.crate === 'dropped')
        hintOnce('coveSlam', 'Jump on the crate, then SLAM it in the air!', 3200);
      if (onRock(p) && !cove.shellFetched)
        hintOnce('coveShell', 'A shell up on the crane! Bark to call Mango.', 3200);
    },
    action(p) {
      if (!ridingEduardo()) return null;
      const nearPost = distXZ(p, bridge.post.x, bridge.post.z) < 1.8;
      if (!cove.bridgeDown && nearPost && Math.abs(p.y - bridge.top) < 1.2)
        return { label: 'Pinch', run: () => dropBridge(cove) };
      const underCrate = distXZ(p, rock.x, rock.z) < 1.6 && Math.abs(p.y - rock.y) < 1;
      if (cove.crate === 'hanging' && underCrate)
        return { label: 'Pinch', run: () => dropCrate(cove) };
      return null;
    },
    bark(p) {
      if (cove.shellFetched || mango.state !== 'crew' || !onRock(p)) return;
      callMango(cove);
    },
    // a slam landing on top of the dropped crate breaks it
    pound(p) {
      const onCrate = distXZ(p, rock.x, rock.z) < 1 && Math.abs(p.y - (rock.y + 1.1)) < 0.6;
      if (cove.crate === 'dropped' && onCrate) breakCrate(cove);
    },
    save: () => ({
      bridgeDown: cove.bridgeDown,
      crate: cove.crate,
      // a shell Mango was still carrying is back on the crane
      shellFetched: Array.isArray(cove.shellFetched) ? cove.shellFetched : null,
    }),
    load(state) {
      if (state.bridgeDown) lowerBridgeAtOnce(cove);
      if (state.crate === 'dropped') dropCrate(cove, { quiet: true });
      if (state.crate === 'broken') breakCrate(cove, { quiet: true });
      if (state.shellFetched) {
        const [x, y, z] = state.shellFetched;
        scene.remove(cove.crane.shell);
        cove.shellFetched = state.shellFetched;
        addPickup(x, z, { y, island: 5 });
      }
    },
  };
}
