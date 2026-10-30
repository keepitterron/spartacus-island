// Shared building blocks for models: cached flat-shaded materials, meshes and canvas textures.
import * as THREE from 'three';

// materials are cached by colour + options, so material(0xff0000) everywhere shares one material
const materialCache = {};
export function material(color, options = {}) {
  const key = color + JSON.stringify(options);
  materialCache[key] ??= new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 0.85,
    metalness: 0,
    ...options,
  });
  return materialCache[key];
}
export function mesh(geometry, mat, { castShadow = true, receiveShadow = false } = {}) {
  const m = new THREE.Mesh(geometry, mat);
  m.castShadow = castShadow;
  m.receiveShadow = receiveShadow;
  return m;
}
// draw(ctx, w, h) paints a w x h canvas that becomes the texture
export function canvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
// paw print drawn into a 2D canvas (sail, landing pads)
export function drawPaw(ctx, { x: cx, y: cy, size: s, color }) {
  // pad, then four toes
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.35, s * 0.55, s * 0.45, 0, 0, 7);
  ctx.fill();
  [
    [-0.62, -0.25],
    [-0.22, -0.62],
    [0.22, -0.62],
    [0.62, -0.25],
  ].forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.ellipse(cx + dx * s, cy + dy * s, s * 0.2, s * 0.26, dx * 0.5, 0, 7);
    ctx.fill();
  });
}
