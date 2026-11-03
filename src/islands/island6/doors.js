// Little golden arches round the sky island's tiny doorways (the cloud walls' holes, the fork's
// cubby), which sparkle when Spartacus is near, so a tiny way through is easy to spot.
import * as THREE from 'three';
import { vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { burst } from '../../core/fx.js';
import { player } from '../../player/player.js';

const SPARKLE_NEAR = 10; // sparkles only within this distance
const SPARKLE_EVERY = 0.3; // seconds
// {pos, yaw, radius}
const arches = [];
const sparkle = { timeLeft: 0 };

// an arch standing at pos (its feet on the floor), facing along yaw, `radius` wide and high
export function addDoorArch(pos, { yaw, radius }) {
  const arch = mesh(
    new THREE.TorusGeometry(radius, 0.07, 6, 16, Math.PI),
    material(0xffd84d, { emissive: 0xffc23d, emissiveIntensity: 0.6, roughness: 0.3 }),
    { castShadow: false },
  );
  arch.position.copy(pos);
  arch.rotation.y = yaw;
  scene.add(arch);
  arches.push({ pos: pos.clone(), yaw, radius });
}

// every frame: a couple of sparkles somewhere along each arch near him
export function updateDoorArches(dt) {
  sparkle.timeLeft -= dt;
  if (sparkle.timeLeft > 0) return;
  sparkle.timeLeft = SPARKLE_EVERY;
  for (const arch of arches) {
    if (arch.pos.distanceTo(player.pos) > SPARKLE_NEAR) continue;
    const angle = Math.random() * Math.PI,
      across = Math.cos(angle) * arch.radius;
    const at = arch.pos
      .clone()
      .add(
        vec3(
          Math.cos(arch.yaw) * across,
          Math.sin(angle) * arch.radius,
          -Math.sin(arch.yaw) * across,
        ),
      );
    burst(at, { count: 2, color: [0xffd84d, 0xffffff], speed: 0.6, up: 0.6, life: 0.6, size: 0.6 });
  }
}
