// All islands live in one world, spread along -z. Each island registers a height
// function for its band of z: terrainHeight picks the band, so islands can't overlap in z.
import * as THREE from 'three';
import { clamp } from '../core/util.js';
import { scene, LOW_POWER } from '../core/renderer.js';
import { mesh } from '../core/materials.js';

const zones = []; // {zMax, height(x, z)}, sorted from the largest zMax down
export function addTerrain(zMax, height) {
  zones.push({ zMax, height });
  zones.sort((a, b) => b.zMax - a.zMax);
}
// the last zone (smallest zMax) that z is still below wins
export function terrainHeight(x, z) {
  let height = zones[0].height;
  for (const zone of zones) if (z < zone.zMax) height = zone.height;
  return height(x, z);
}

// Island ground mesh. Colours are painted into a texture rather than vertex colours,
// because some phone GPUs drew vertex-coloured meshes black.
// A size x size square centred on (cx, cz). palette: {g, g2} two grass greens, or
// {seabed: height} for a sandy sea floor whose raised parts fade to grey rock.
export function buildGround(cx, cz, { size, segments, palette = { g: 0x6ccb5f, g2: 0x92dc6c } }) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  geo.translate(cx, 0, cz);
  const positions = geo.attributes.position;
  for (let i = 0; i < positions.count; i++)
    positions.setY(i, terrainHeight(positions.getX(i), positions.getZ(i)));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const texSize = LOW_POWER ? 256 : 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = texSize;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(texSize, texSize);
  const pixels = img.data;
  const grass = new THREE.Color(palette.g);
  const grass2 = new THREE.Color(palette.g2);
  const sand = new THREE.Color(0xffe08a);
  const wetSand = new THREE.Color(0xe3bb6e);
  const color = new THREE.Color();
  const rgb = { r: 0, g: 0, b: 0 };
  const deepRock = new THREE.Color(0x8fa7b8);
  const isSeabed = palette.seabed !== undefined;
  // one terrain sample per texel; colour bands by height: grass, grass-to-sand, sand, wet sand
  for (let py = 0; py < texSize; py++)
    for (let px = 0; px < texSize; px++) {
      const x = cx + ((px + 0.5) / texSize) * size - size / 2;
      const z = cz + ((py + 0.5) / texSize) * size - size / 2;
      const h = terrainHeight(x, z);
      if (isSeabed) {
        color.copy(sand).lerp(wetSand, 0.5 + 0.5 * Math.sin(x * 0.5) * Math.cos(z * 0.45));
        if (h > palette.seabed + 3) color.lerp(deepRock, clamp((h - palette.seabed - 3) / 8, 0, 1));
      } else if (h > 0.75)
        color.copy(grass).lerp(grass2, 0.5 + 0.5 * Math.sin(x * 0.9) * Math.cos(z * 0.7));
      else if (h > 0.55) color.copy(sand).lerp(grass, (h - 0.55) / 0.2);
      else if (h > 0.05) color.copy(sand);
      else color.copy(wetSand);
      color.getRGB(rgb, THREE.SRGBColorSpace);
      const i = (py * texSize + px) * 4;
      pixels[i] = rgb.r * 255;
      pixels[i + 1] = rgb.g * 255;
      pixels[i + 2] = rgb.b * 255;
      pixels[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  scene.add(
    mesh(geo, new THREE.MeshStandardMaterial({ map: tex, flatShading: true, roughness: 0.95 }), {
      castShadow: false,
      receiveShadow: true,
    }),
  );
}
