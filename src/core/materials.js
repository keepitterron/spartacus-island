import * as THREE from 'three';

// materials are cached by colour + options, so mat(0xff0000) everywhere shares one material
const MC = {};
export function material(c, o = {}) {
  const k = c + JSON.stringify(o);
  if (!MC[k])
    MC[k] = new THREE.MeshStandardMaterial(
      Object.assign({ color: c, flatShading: true, roughness: 0.85, metalness: 0 }, o),
    );
  return MC[k];
}
export function mesh(geometry, mat, { castShadow = true, receiveShadow = false } = {}) {
  const o = new THREE.Mesh(geometry, mat);
  o.castShadow = castShadow;
  o.receiveShadow = receiveShadow;
  return o;
}
export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// paw print drawn into a 2D canvas (sail, landing pads)
export function drawPaw(ctx, { x: cx, y: cy, size: s, color }) {
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
