// Beach balls: simple home-made physics for props, no library. Run into one to kick it; a bark
// pushes nearby balls away and a ground pound launches them. A ball that rolls into the sea
// bobs there for a moment, then pops back where it started (nothing is ever lost).
// Islands list them as data, island-local: balls: [[x, z], …]
import * as THREE from 'three';
import { distXZ, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { canvasTexture } from '../core/materials.js';
import { game } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { colliders, pushOut, supportHeight } from '../core/colliders.js';
import { player, RADIUS } from '../player/player.js';

const BALL_RADIUS = 0.45;
const GRAVITY = 20;
const BOUNCE = 0.6; // share of the speed kept on each bounce
const FLOAT_TIME = 2.5; // seconds bobbing in the sea before it pops back home
const ACTIVE_RANGE = 70; // balls further away than this sleep
// {mesh, pos, vel, home, floatTime}
const balls = [];

// red/white/blue/yellow segments, like a real beach ball
const ballTexture = () =>
  canvasTexture(128, 64, (ctx, w, h) => {
    const colors = ['#f2545b', '#fffaf0', '#2fa4c7', '#fffaf0', '#ffd84d', '#fffaf0'];
    colors.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect((i * w) / colors.length, 0, w / colors.length + 1, h);
    });
  });

// after every island is built, so balls can rest on top of things
export function buildBalls() {
  const ballMaterial = new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.5 });
  const geometry = new THREE.SphereGeometry(BALL_RADIUS, 16, 12);
  for (const island of Object.values(game.islands))
    for (const [localX, localZ] of island.balls || []) {
      const x = island.center.x + localX,
        z = island.center.z + localZ;
      const home = vec3(x, supportHeight(x, z, Infinity) + BALL_RADIUS, z);
      const mesh = new THREE.Mesh(geometry, ballMaterial);
      mesh.castShadow = true;
      mesh.position.copy(home);
      scene.add(mesh);
      balls.push({ mesh, pos: home.clone(), vel: vec3(), home, floatTime: 0 });
    }
}

// push every ball within reach away from pos (and up a bit)
export function shoveBalls(pos, { reach, push, up }) {
  for (const ball of balls) {
    const dist = distXZ(pos, ball.pos.x, ball.pos.z);
    if (dist > reach || Math.abs(pos.y - ball.pos.y) > 3) continue;
    const away = vec3(ball.pos.x - pos.x, 0, ball.pos.z - pos.z).normalize();
    ball.vel.addScaledVector(away, push * (1 - dist / reach) + 1);
    ball.vel.y += up;
  }
}

export function updateBalls(dt) {
  for (const ball of balls) {
    if (distXZ(player.pos, ball.pos.x, ball.pos.z) > ACTIVE_RANGE) continue;
    kickByPlayer(ball);
    stepBall(ball, dt);
  }
}

// running into a ball kicks it the way Spartacus is going
function kickByPlayer(ball) {
  const reach = RADIUS + BALL_RADIUS,
    dx = ball.pos.x - player.pos.x,
    dz = ball.pos.z - player.pos.z,
    dist = Math.hypot(dx, dz);
  const ballBottom = ball.pos.y - BALL_RADIUS;
  if (dist >= reach || ballBottom > player.pos.y + 1.2 || ballBottom < player.pos.y - 0.8) return;
  const nx = dx / (dist || 1),
    nz = dz / (dist || 1);
  // move it out of his way, then kick with his speed towards it
  ball.pos.x = player.pos.x + nx * reach;
  ball.pos.z = player.pos.z + nz * reach;
  const toward = player.vel.x * nx + player.vel.z * nz;
  if (toward < 1) return;
  ball.vel.x = nx * toward * 1.4;
  ball.vel.z = nz * toward * 1.4;
  ball.vel.y = Math.max(ball.vel.y, 2 + toward * 0.4);
  sfx.pop();
}

function stepBall(ball, dt) {
  const { pos, vel } = ball;
  vel.y -= GRAVITY * dt;
  pos.addScaledVector(vel, dt);
  for (const c of colliders)
    if (c.top > pos.y - BALL_RADIUS + 0.3 && pos.y + BALL_RADIUS > c.bottom)
      pushOut(c, { pos, vel, radius: BALL_RADIUS });
  const ground = supportHeight(pos.x, pos.z, pos.y) + BALL_RADIUS;
  if (ground < 0 && pos.y < BALL_RADIUS * 0.6) floatInSea(ball, dt);
  else if (pos.y <= ground) {
    pos.y = ground;
    if (vel.y < -2) {
      vel.y *= -BOUNCE;
      if (vel.y > 3) sfx.bonk();
    } else vel.y = 0;
    const friction = Math.exp(-dt * 1.2); // rolling slows it down
    vel.x *= friction;
    vel.z *= friction;
  }
  // roll: spin around the axis across the direction of travel
  ball.mesh.position.copy(pos);
  ball.mesh.rotation.x += (vel.z / BALL_RADIUS) * dt;
  ball.mesh.rotation.z -= (vel.x / BALL_RADIUS) * dt;
}

// bob on the surface, then pop back home in a puff of bubbles
function floatInSea(ball, dt) {
  const { pos, vel } = ball;
  pos.y = BALL_RADIUS * 0.6 + Math.sin(game.time * 3) * 0.05;
  vel.set(vel.x * Math.exp(-dt * 2), 0, vel.z * Math.exp(-dt * 2));
  ball.floatTime += dt;
  if (ball.floatTime < FLOAT_TIME) return;
  ball.floatTime = 0;
  burst(pos.clone(), { count: 12, color: [0xffffff, 0xbff3ff], speed: 3, up: 2, life: 0.6 });
  pos.copy(ball.home);
  vel.set(0, 0, 0);
  burst(pos.clone(), { count: 12, color: [0xffd84d, 0xffffff], speed: 3, up: 2, life: 0.6 });
  sfx.pop();
}
