// The wardrobe catalog: every accessory Spartacus can wear, built from primitives like the
// straw hat. Adding one is a data entry: {id, name, icon, slot, anchor?, build()}.
//   slot:   head | face | neck | back | tail (one item per slot)
//   anchor: where it hangs on the dog, if not the slot's usual spot ('ear')
//   build:  returns a THREE.Group in the anchor's local space (see the origins below);
//           set group.userData.animate = (group, time) => … for flapping wings and the like
// Anchor origins: head = on top of the head where the straw hat's brim sits (thrown by
// Chop-Chop with whatever is in it); face = centre of the head, nose towards +z (eyes at
// y .07, z .4, x ±.17); neck = the base of the neck; back = top of the back, just behind the
// shoulders; tail = partway up the tail (it points along +y).
import * as THREE from 'three';
import { material, mesh } from '../core/materials.js';

// one mesh placed in a group, so the builders below stay one line per piece
function part(group, geometry, { color, pos = [0, 0, 0], rot = [0, 0, 0], scale, options }) {
  const m = mesh(geometry, material(color, options), { castShadow: false });
  m.position.set(...pos);
  m.rotation.set(...rot);
  if (scale) m.scale.set(...scale);
  group.add(m);
  return m;
}
const ball = (r, detail = 8) => new THREE.SphereGeometry(r, detail, Math.max(4, detail - 2));
// (radiusTop, radiusBottom, height, sides = 12), like THREE.CylinderGeometry
const cylinder = (...args) => new THREE.CylinderGeometry(...args);
const ring = (r, tube, arc = Math.PI * 2) => new THREE.TorusGeometry(r, tube, 6, 20, arc);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
// a collar ring around the neck, tilted forward to follow it
const COLLAR_TILT = [-1.07, 0, 0];
const GOLD = { metalness: 0.4, roughness: 0.35 };

// little round things spread along the front half of the collar (shells, pearls, leaves)
function aroundCollar(group, { count, radius, spread = Math.PI * 1.2, add }) {
  for (let i = 0; i < count; i++) {
    const angle = -spread / 2 + (spread * i) / Math.max(1, count - 1);
    // front of the ring, following its tilt
    const x = Math.sin(angle) * radius,
      along = Math.cos(angle) * radius;
    add([x, -along * 0.48 - 0.02, along * 0.88], i);
  }
  return group;
}

function makeStar(color) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.07 : 0.16,
      angle = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(angle) * r,
      y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelSize: 0.02,
    bevelThickness: 0.02,
    bevelSegments: 1,
  });
  return mesh(geometry, material(color), { castShadow: false });
}

function wings({ upper, lower, size = 1 }) {
  const g = new THREE.Group();
  const sides = [-1, 1].map((side) => {
    const wing = new THREE.Group();
    wing.position.x = side * 0.08;
    g.add(wing);
    part(wing, ball(0.32 * size), {
      color: upper,
      pos: [side * 0.3, 0.22, 0.05],
      rot: [0, 0, side * -0.5],
      scale: [1, 0.75, 0.12],
    });
    part(wing, ball(0.22 * size), {
      color: lower,
      pos: [side * 0.24, -0.05, -0.15],
      rot: [0, 0, side * 0.4],
      scale: [1, 0.8, 0.12],
    });
    part(wing, ball(0.07), { color: 0xffffff, pos: [side * 0.38, 0.28, 0.08] });
    return { wing, side };
  });
  g.userData.animate = (group, time) => {
    for (const { wing, side } of sides) wing.rotation.y = side * (0.25 + Math.sin(time * 9) * 0.35);
  };
  return g;
}

export const ACCESSORIES = [
  // the default hat, always owned (its model lives in player/dog.js)
  { id: 'straw-hat', name: 'Straw hat', icon: '👒', slot: 'head', build: null },

  /* ---------- island 1 ---------- */
  {
    id: 'tricorn',
    name: 'Captain’s hat',
    icon: '🏴‍☠️',
    slot: 'head',
    build() {
      const g = new THREE.Group();
      // three radial segments make a triangle: the tricorn's brim
      part(g, cylinder(0.72, 0.72, 0.08, 3), { color: 0xffc83d, pos: [0, 0.02, 0], options: GOLD });
      part(g, cylinder(0.68, 0.66, 0.16, 3), { color: 0x23232e, pos: [0, 0.1, 0] });
      part(g, cylinder(0.3, 0.34, 0.32, 12), { color: 0x23232e, pos: [0, 0.3, 0] });
      part(g, ball(0.08), { color: 0xffffff, pos: [0, 0.32, 0.33], scale: [1, 1, 0.4] });
      g.rotation.y = Math.PI / 6; // a point at the front
      return g;
    },
  },
  {
    id: 'sunglasses',
    name: 'Sunglasses',
    icon: '🕶️',
    slot: 'face',
    build() {
      const g = new THREE.Group();
      for (const side of [-1, 1]) {
        part(g, cylinder(0.12, 0.12, 0.03, 14), {
          color: 0x1a1a24,
          pos: [side * 0.17, 0.08, 0.47],
          rot: [Math.PI / 2, 0, 0],
          options: { roughness: 0.2 },
        });
        part(g, ring(0.12, 0.022), { color: 0xff6b8a, pos: [side * 0.17, 0.08, 0.48] });
        part(g, box(0.03, 0.03, 0.4), { color: 0xff6b8a, pos: [side * 0.33, 0.1, 0.3] });
      }
      part(g, box(0.12, 0.03, 0.03), { color: 0xff6b8a, pos: [0, 0.11, 0.5] });
      return g;
    },
  },
  {
    id: 'red-bandana',
    name: 'Red bandana',
    icon: '🧣',
    slot: 'neck',
    build() {
      const g = new THREE.Group();
      part(g, ring(0.33, 0.07), { color: 0xd9343f, rot: COLLAR_TILT });
      // the knot's triangle hanging over the chest
      part(g, cylinder(0.26, 0.26, 0.05, 3), {
        color: 0xd9343f,
        pos: [0, -0.2, 0.32],
        rot: [Math.PI / 2 - 0.5, Math.PI / 2, 0],
      });
      for (const [x, y] of [
        [-0.08, -0.15],
        [0.1, -0.24],
        [0, -0.33],
      ])
        part(g, ball(0.03, 5), { color: 0xffffff, pos: [x, y, 0.4] });
      return g;
    },
  },
  {
    id: 'shell-necklace',
    name: 'Seashell necklace',
    icon: '🐚',
    slot: 'neck',
    build() {
      const g = new THREE.Group();
      part(g, ring(0.34, 0.015), { color: 0xe8d3a0, rot: COLLAR_TILT });
      const colors = [0xffd1dc, 0xfff3d6, 0xffb38a, 0xfff3d6, 0xffd1dc];
      return aroundCollar(g, {
        count: 5,
        radius: 0.35,
        add: (pos, i) =>
          part(g, new THREE.ConeGeometry(0.07, 0.12, 6), {
            color: colors[i],
            pos,
            rot: [Math.PI, 0, 0],
          }),
      });
    },
  },
  {
    id: 'feather-bow',
    name: 'Parrot-feather bow',
    icon: '🪶',
    slot: 'tail',
    build() {
      const g = new THREE.Group();
      for (const side of [-1, 1])
        part(g, new THREE.ConeGeometry(0.09, 0.16, 6), {
          color: 0xff6b8a,
          pos: [side * 0.09, 0, 0],
          rot: [0, 0, side * (Math.PI / 2)],
        });
      part(g, ball(0.045, 6), { color: 0xff6b8a });
      for (const [i, color] of [0x3fbf5a, 0x2fa4c7, 0xffd84d].entries())
        part(g, ball(0.06, 6), {
          color,
          pos: [(i - 1) * 0.07, 0.14, -0.03],
          rot: [0, 0, (i - 1) * 0.5],
          scale: [0.6, 2.2, 0.3],
        });
      return g;
    },
  },
  {
    id: 'flower-crown',
    name: 'Flower crown',
    icon: '🌸',
    slot: 'head',
    build() {
      const g = new THREE.Group();
      part(g, ring(0.34, 0.045), { color: 0x5fbf5a, pos: [0, 0.02, 0], rot: [Math.PI / 2, 0, 0] });
      const colors = [0xff9fb2, 0xffd84d, 0xffffff, 0xb59cff];
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const x = Math.sin(angle) * 0.34,
          z = Math.cos(angle) * 0.34;
        part(g, new THREE.IcosahedronGeometry(0.09, 0), {
          color: colors[i % colors.length],
          pos: [x, 0.07, z],
        });
        part(g, ball(0.04, 5), { color: 0xffc83d, pos: [x, 0.14, z] });
      }
      return g;
    },
  },

  /* ---------- island 2 ---------- */
  {
    id: 'cowboy-hat',
    name: 'Cowboy hat',
    icon: '🤠',
    slot: 'head',
    build() {
      const g = new THREE.Group();
      part(g, cylinder(0.7, 0.72, 0.05, 18), { color: 0xa0673a, scale: [1, 1, 0.85] });
      // curled-up brim sides
      for (const side of [-1, 1])
        part(g, ring(0.2, 0.05, Math.PI), {
          color: 0xa0673a,
          pos: [side * 0.55, 0.12, 0],
          rot: [0, Math.PI / 2, side * 0.6],
          scale: [1, 0.7, 1],
        });
      part(g, cylinder(0.27, 0.34, 0.42, 12), { color: 0xa0673a, pos: [0, 0.22, 0] });
      part(g, cylinder(0.345, 0.345, 0.08, 12), { color: 0x5a3a20, pos: [0, 0.07, 0] });
      part(g, box(0.06, 0.04, 0.5), { color: 0x7a4a2a, pos: [0, 0.44, 0] }); // the dent on top
      return g;
    },
  },
  {
    id: 'eye-patch',
    name: 'Eye patch',
    icon: '🏴‍☠️',
    slot: 'face',
    build() {
      const g = new THREE.Group();
      part(g, cylinder(0.12, 0.12, 0.04, 14), {
        color: 0x14141c,
        pos: [0.17, 0.08, 0.45],
        rot: [Math.PI / 2 - 0.2, 0, 0],
        scale: [1, 1, 0.85],
      });
      part(g, ring(0.47, 0.016), { color: 0x14141c, pos: [0, 0.12, 0], rot: [-0.25, 0, 0.45] });
      return g;
    },
  },
  {
    id: 'rope-collar',
    name: 'Rope collar',
    icon: '🪢',
    slot: 'neck',
    build() {
      const g = new THREE.Group();
      part(g, ring(0.33, 0.06), { color: 0xd9b77a, rot: COLLAR_TILT });
      part(g, ring(0.33, 0.035), { color: 0xb08a4a, pos: [0, 0.03, -0.02], rot: COLLAR_TILT });
      part(g, ball(0.08, 7), { color: 0xd9b77a, pos: [0, -0.18, 0.3] });
      part(g, cylinder(0.025, 0.025, 0.2, 5), { color: 0xd9b77a, pos: [0.03, -0.3, 0.32] });
      return g;
    },
  },
  {
    id: 'backpack',
    name: 'Tiny backpack',
    icon: '🎒',
    slot: 'back',
    build() {
      const g = new THREE.Group();
      part(g, box(0.5, 0.36, 0.42), { color: 0x2fa4c7, pos: [0, 0.12, -0.1] });
      part(g, box(0.52, 0.12, 0.3), { color: 0x1f7f9c, pos: [0, 0.32, -0.08] });
      part(g, box(0.3, 0.18, 0.06), { color: 0xffd84d, pos: [0, 0.08, -0.33] });
      for (const side of [-1, 1])
        part(g, ring(0.4, 0.025), {
          color: 0x1f7f9c,
          pos: [side * 0.22, -0.2, 0.15],
          rot: [0, Math.PI / 2, 0],
          scale: [1, 0.9, 1],
        });
      return g;
    },
  },
  {
    id: 'lily-hat',
    name: 'Lily-pad hat',
    icon: '🪷',
    slot: 'head',
    build() {
      const g = new THREE.Group();
      part(g, new THREE.CylinderGeometry(0.6, 0.6, 0.06, 16, 1, false, 0.4, 5.8), {
        color: 0x5fbf5a,
        pos: [0, 0.03, 0],
      });
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        part(g, new THREE.ConeGeometry(0.09, 0.22, 4), {
          color: i % 2 ? 0xff9fb2 : 0xffd1dc,
          pos: [Math.sin(angle) * 0.08, 0.16, Math.cos(angle) * 0.08],
          rot: [Math.cos(angle) * 0.5, 0, -Math.sin(angle) * 0.5],
        });
      }
      part(g, ball(0.06, 6), { color: 0xffd84d, pos: [0, 0.18, 0] });
      return g;
    },
  },
  {
    id: 'gold-earring',
    name: 'Gold earring',
    icon: '💛',
    slot: 'face',
    anchor: 'ear',
    build() {
      const g = new THREE.Group();
      part(g, ring(0.09, 0.028), {
        color: 0xffc83d,
        pos: [0.1, -0.46, 0.08],
        rot: [0, Math.PI / 2, 0],
        options: GOLD,
      });
      return g;
    },
  },

  /* ---------- island 3 ---------- */
  {
    id: 'acorn-cap',
    name: 'Acorn cap',
    icon: '🌰',
    slot: 'head',
    build() {
      const g = new THREE.Group();
      part(g, new THREE.SphereGeometry(0.42, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), {
        color: 0x8b5a3c,
        scale: [1, 0.75, 1],
      });
      part(g, cylinder(0.43, 0.43, 0.08, 14), { color: 0x6e4a30, pos: [0, 0.02, 0] });
      part(g, cylinder(0.04, 0.05, 0.2, 6), {
        color: 0x6e4a30,
        pos: [0.03, 0.38, 0],
        rot: [0, 0, -0.3],
      });
      return g;
    },
  },
  {
    id: 'leaf-cape',
    name: 'Leaf cape',
    icon: '🍃',
    slot: 'back',
    build() {
      const g = new THREE.Group();
      const cape = new THREE.Group();
      cape.position.set(0, 0.1, 0.25);
      g.add(cape);
      // [x, z, size, colour] leaves overlapping down the back like scales
      for (const [x, z, size, color] of [
        [-0.22, -0.05, 1, 0x4fa84a],
        [0.22, -0.05, 1, 0x4fa84a],
        [0, -0.12, 1.1, 0x6ccb5f],
        [-0.26, -0.38, 1, 0x6ccb5f],
        [0.26, -0.38, 1, 0x6ccb5f],
        [0, -0.48, 1.1, 0x4fa84a],
        [-0.18, -0.72, 0.9, 0x4fa84a],
        [0.18, -0.72, 0.9, 0x4fa84a],
      ])
        part(cape, ball(0.24 * size), {
          color,
          pos: [x, 0.02, z],
          rot: [0, 0, x * 1.2],
          scale: [0.85, 0.18, 1.3],
        });
      g.userData.animate = (group, time) => {
        cape.rotation.x = -0.1 + Math.sin(time * 4) * 0.06;
      };
      return g;
    },
  },
  {
    id: 'butterfly-wings',
    name: 'Butterfly wings',
    icon: '🦋',
    slot: 'back',
    build: () => wings({ upper: 0xffa53d, lower: 0xb59cff }),
  },
  {
    id: 'mushroom-hat',
    name: 'Mushroom hat',
    icon: '🍄',
    slot: 'head',
    build() {
      const g = new THREE.Group();
      part(g, new THREE.SphereGeometry(0.55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), {
        color: 0xf2545b,
        pos: [0, 0.08, 0],
        scale: [1, 0.7, 1],
      });
      part(g, cylinder(0.25, 0.3, 0.14, 12), { color: 0xfff3d6, pos: [0, 0.03, 0] });
      for (const [x, z, r] of [
        [0, 0, 0.09],
        [0.3, 0.15, 0.07],
        [-0.28, 0.18, 0.06],
        [0.1, -0.33, 0.07],
        [-0.25, -0.22, 0.06],
        [0.36, -0.15, 0.05],
      ]) {
        const y = 0.08 + Math.sqrt(Math.max(0, 0.3 - x * x - z * z)) * 0.7;
        part(g, ball(r, 6), { color: 0xffffff, pos: [x, y, z], scale: [1, 0.4, 1] });
      }
      return g;
    },
  },
  {
    id: 'honey-pot',
    name: 'Honey-pot backpack',
    icon: '🍯',
    slot: 'back',
    build() {
      const g = new THREE.Group();
      part(g, ball(0.27, 10), { color: 0xffa53d, pos: [0, 0.2, -0.1], scale: [1, 0.9, 1] });
      part(g, cylinder(0.17, 0.2, 0.1, 10), { color: 0xffc83d, pos: [0, 0.42, -0.1] });
      part(g, ball(0.06, 6), { color: 0xffc83d, pos: [0.14, 0.36, 0.05], scale: [1, 1.6, 1] });
      part(g, cylinder(0.28, 0.28, 0.05, 10), { color: 0xd9343f, pos: [0, 0.27, -0.1] });
      return g;
    },
  },
  {
    id: 'vine-scarf',
    name: 'Vine scarf',
    icon: '🌿',
    slot: 'neck',
    build() {
      const g = new THREE.Group();
      part(g, ring(0.33, 0.045), { color: 0x3f8f3a, rot: COLLAR_TILT });
      return aroundCollar(g, {
        count: 7,
        radius: 0.36,
        spread: Math.PI * 1.6,
        add: (pos, i) =>
          part(g, ball(0.08, 5), {
            color: i % 2 ? 0x6ccb5f : 0x9be38a,
            pos,
            rot: [0, i, 0.6],
            scale: [1.4, 0.35, 0.8],
          }),
      });
    },
  },

  /* ---------- island 4 ---------- */
  {
    id: 'goggles',
    name: 'Diving goggles',
    icon: '🥽',
    slot: 'face',
    build() {
      const g = new THREE.Group();
      for (const side of [-1, 1]) {
        part(g, cylinder(0.13, 0.13, 0.08, 14), {
          color: 0x7fd8ee,
          pos: [side * 0.17, 0.09, 0.45],
          rot: [Math.PI / 2, 0, 0],
          options: { roughness: 0.1, metalness: 0.2 },
        });
        part(g, ring(0.13, 0.035), { color: 0xffa53d, pos: [side * 0.17, 0.09, 0.49] });
      }
      part(g, ring(0.47, 0.025), {
        color: 0xffa53d,
        pos: [0, 0.1, 0.02],
        rot: [Math.PI / 2, 0, 0],
      });
      return g;
    },
  },
  {
    id: 'coral-crown',
    name: 'Coral crown',
    icon: '🪸',
    slot: 'head',
    build() {
      const g = new THREE.Group();
      part(g, ring(0.32, 0.06), { color: 0xff8fb1, pos: [0, 0.03, 0], rot: [Math.PI / 2, 0, 0] });
      for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * Math.PI * 2,
          tall = i % 2 ? 0.22 : 0.34;
        const x = Math.sin(angle) * 0.32,
          z = Math.cos(angle) * 0.32;
        part(g, cylinder(0.025, 0.05, tall, 5), {
          color: i % 3 ? 0xff8fb1 : 0xffa53d,
          pos: [x, tall / 2, z],
          rot: [Math.cos(angle) * 0.3, 0, -Math.sin(angle) * 0.3],
        });
        part(g, ball(0.05, 5), { color: 0xff6b8a, pos: [x * 1.15, tall, z * 1.15] });
      }
      return g;
    },
  },
  {
    id: 'starfish-brooch',
    name: 'Starfish brooch',
    icon: '⭐',
    slot: 'neck',
    build() {
      const g = new THREE.Group();
      part(g, ring(0.33, 0.02), { color: 0x2fa4c7, rot: COLLAR_TILT });
      const star = makeStar(0xffa53d);
      star.position.set(0, -0.2, 0.33);
      star.rotation.x = -0.5;
      g.add(star);
      return g;
    },
  },
  {
    id: 'bubble-helmet',
    name: 'Bubble helmet',
    icon: '🫧',
    slot: 'head',
    build() {
      const g = new THREE.Group();
      // a see-through ball around the whole head (the anchor sits on top of it)
      part(g, ball(0.72, 18), {
        color: 0xbff3ff,
        pos: [0, -0.3, 0.05],
        options: { transparent: true, opacity: 0.3, roughness: 0.05, depthWrite: false },
      });
      part(g, ring(0.5, 0.05), { color: 0xffc83d, pos: [0, -0.78, 0.0], rot: [Math.PI / 2, 0, 0] });
      part(g, ball(0.08, 6), { color: 0xffffff, pos: [0.3, 0.15, 0.4] });
      return g;
    },
  },
  {
    id: 'pearl-collar',
    name: 'Pearl collar',
    icon: '🦪',
    slot: 'neck',
    build() {
      const g = new THREE.Group();
      return aroundCollar(g, {
        count: 11,
        radius: 0.34,
        spread: Math.PI * 1.9,
        add: (pos, i) =>
          part(g, ball(i === 5 ? 0.08 : 0.055, 8), {
            color: 0xfffaf0,
            pos,
            options: { roughness: 0.25, metalness: 0.1 },
          }),
      });
    },
  },
  {
    id: 'ink-mustache',
    name: 'Octopus-ink mustache',
    icon: '🥸',
    slot: 'face',
    build() {
      const g = new THREE.Group();
      for (const side of [-1, 1])
        part(g, ring(0.1, 0.035, Math.PI * 1.3), {
          color: 0x3a2a5a,
          pos: [side * 0.11, -0.1, 0.66],
          rot: [0, 0, side > 0 ? -0.3 : Math.PI + 0.3],
        });
      return g;
    },
  },
];

export const accessory = (id) => ACCESSORIES.find((item) => item.id === id);
