// Juf Anne and her class on their school trip (the squirrels from island 1's Growly Cave, models
// from island1/juf-anne.js). They're at Base Camp when Spartacus arrives, set up a classroom in
// the Great Hall once the door is open, line up in the Sun Chamber for the class photo, and wave
// goodbye from the dock at the end. They move while he's somewhere else, never in front of him.
//
//   addSchool(spots)            spots: {camp, anne, classroom, photo, dock} ({x, y, z} each)
//   schoolGo(where)             'camp' | 'hall' | 'photo' | 'dock', as soon as nobody's looking
//   anneSpot()                  where Juf Anne stands right now (for talking to her)
import * as THREE from 'three';
import { distXZ, lerp, lerpAngle, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { player } from '../../player/player.js';
import { makeSquirrel, makeChalkboard, makePinkTower } from '../island1/juf-anne.js';

const UNSEEN = 22; // m: Spartacus is this far from where they are and where they're going
const BACKPACKS = [0xff6b8a, 0x5aa8ff, 0xffd84d, 0x6ccb5f];

// where: where they are; next: where they're going once he's away; seats: per place, Juf Anne's
// spot and facing, and each little one's
const school = { anne: null, kids: [], where: null, next: null, layouts: {}, board: null };

// a little squirrel with a backpack in its own colour
function makeKid(color) {
  const kid = makeSquirrel({ size: 0.55 });
  const pack = mesh(new THREE.BoxGeometry(0.36, 0.42, 0.2), material(color));
  pack.position.set(0, 0.42, -0.3);
  kid.g.add(pack);
  return kid;
}

// [x, z] offsets turned to face `yaw`
const around = (spot, yaw, [side, ahead]) =>
  vec3(
    spot.x + Math.cos(yaw) * side + Math.sin(yaw) * ahead,
    spot.y,
    spot.z - Math.sin(yaw) * side + Math.cos(yaw) * ahead,
  );

function layouts({ camp, anne, classroom, photo, dock }) {
  const facingCamp = Math.atan2(camp.x - anne.x, camp.z - anne.z);
  const ring = [0.6, 1.9, 3.5, 4.8].map((angle) => ({
    pos: vec3(camp.x + Math.cos(angle) * 2.3, camp.y, camp.z + Math.sin(angle) * 2.3),
    yaw: Math.atan2(-Math.cos(angle), -Math.sin(angle)), // facing the fire
  }));
  // the classroom: Juf Anne by the board facing east, the class in a half circle in front of her
  const east = Math.PI / 2;
  const lesson = [-0.9, -0.3, 0.3, 0.9].map((angle) => {
    const pos = vec3(
      classroom.x + Math.cos(angle) * 2.2,
      classroom.y,
      classroom.z + Math.sin(angle) * 2.2,
    );
    return { pos, yaw: Math.atan2(classroom.x - pos.x, classroom.z - pos.z) };
  });
  // the class photo: a row either side of the paw mark, all facing the camera (south)
  const row = [-3.4, -4.4, 3.4, 4.4].map((side, i) => ({
    pos: around(photo, 0, [side, i % 2 ? -0.6 : 0.4]),
    yaw: 0,
  }));
  // the dock: in a line behind Juf Anne, facing the sea
  const line = [0, 1, 2, 3].map((i) => ({
    pos: vec3(dock.x, dock.y, dock.z - 0.9 - i * 0.7),
    yaw: 0,
  }));
  return {
    camp: { anne: { pos: vec3(anne.x, anne.y, anne.z), yaw: facingCamp }, kids: ring },
    hall: {
      anne: { pos: vec3(classroom.x - 1.4, classroom.y, classroom.z), yaw: east },
      kids: lesson,
    },
    photo: { anne: { pos: around(photo, 0, [-2.2, -0.2]), yaw: 0 }, kids: row },
    dock: { anne: { pos: vec3(dock.x, dock.y, dock.z), yaw: 0 }, kids: line },
  };
}

export function addSchool(spots) {
  school.layouts = layouts(spots);
  const teacher = makeSquirrel({ size: 1.4, glasses: true });
  school.anne = { g: teacher.g, paw: teacher.paw };
  scene.add(teacher.g);
  school.kids = BACKPACKS.map((color, i) => {
    const kid = makeKid(color);
    scene.add(kid.g);
    return { g: kid.g, paw: kid.paw, phase: i * 1.3, hop: 0 };
  });
  // the classroom's board and pink tower stand in the Great Hall from the start
  const room = spots.classroom;
  school.board = makeChalkboard();
  school.board.position.set(room.x - 2.4, room.y, room.z);
  school.board.rotation.y = Math.PI / 2;
  scene.add(school.board);
  const tower = makePinkTower();
  tower.position.set(room.x - 1.6, room.y, room.z + 1.6);
  scene.add(tower);
  moveTo('camp');
}

// put everyone in their places at once
function moveTo(where) {
  school.where = where;
  school.next = null;
  const layout = school.layouts[where];
  school.anne.g.position.copy(layout.anne.pos);
  school.anne.g.rotation.y = layout.anne.yaw;
  school.kids.forEach((kid, i) => {
    kid.g.position.copy(layout.kids[i].pos);
    kid.g.rotation.set(0, layout.kids[i].yaw, 0);
  });
}

export function schoolGo(where, { now = false } = {}) {
  if (where === school.where) return;
  if (now) moveTo(where);
  else school.next = where;
}
export const schoolAt = () => school.where;
export const anneSpot = () => school.anne.g.position;

// the little ones jump for joy
export function cheerSchool() {
  sfx.squeak();
  for (const kid of school.kids) kid.hop = 1.6;
}

export function updateSchool(dt) {
  if (!school.anne) return;
  if (school.next && awayFrom(school.where) && awayFrom(school.next)) moveTo(school.next);
  const time = game.time,
    layout = school.layouts[school.where],
    anne = school.anne,
    p = player.pos;
  // Juf Anne looks at Spartacus when he's near, otherwise at her class; she waves at the dock
  const near = distXZ(p, anne.g.position.x, anne.g.position.z) < 9;
  const toPlayer = Math.atan2(p.x - anne.g.position.x, p.z - anne.g.position.z);
  anne.g.rotation.y = lerpAngle(
    anne.g.rotation.y,
    near ? toPlayer : layout.anne.yaw,
    Math.min(1, dt * 3),
  );
  anne.g.position.y = layout.anne.pos.y + Math.abs(Math.sin(time * 2)) * 0.04;
  if (school.where === 'dock' || school.where === 'photo') wave(anne.paw, time, 0);
  else
    anne.paw.rotation.x = lerp(
      anne.paw.rotation.x,
      Math.sin(time * 0.8) > 0.4 ? -1.4 : 0,
      Math.min(1, dt * 5),
    );
  school.kids.forEach((kid, i) => updateKid(kid, { dt, time, seat: layout.kids[i] }));
}

function updateKid(kid, { dt, time, seat }) {
  kid.hop = Math.max(0, kid.hop - dt);
  const bounce = Math.abs(Math.sin(time * 6 + kid.phase)) * Math.min(1, kid.hop) * 0.5;
  const fidget = Math.abs(Math.sin(time * 1.3 + kid.phase)) * 0.03;
  kid.g.position.y = seat.pos.y + bounce + fidget;
  if (school.where === 'dock' || kid.hop > 0) wave(kid.paw, time, kid.phase);
  else {
    kid.paw.rotation.x = lerp(kid.paw.rotation.x, 0, Math.min(1, dt * 6));
    kid.paw.rotation.z = 0;
  }
}

function wave(paw, time, phase) {
  paw.rotation.x = -2.6;
  paw.rotation.z = Math.sin(time * 9 + phase) * 0.45;
}

const awayFrom = (where) => {
  const spot = school.layouts[where].anne.pos;
  return distXZ(player.pos, spot.x, spot.z) > UNSEEN;
};

// mid-island saves: where they are (or are about to be)
export const schoolState = () => school.next ?? school.where;
export function restoreSchool(where) {
  if (where && school.layouts[where]) moveTo(where);
}
