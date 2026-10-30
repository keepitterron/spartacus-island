import * as THREE from 'three';

// materials are cached by colour + options, so mat(0xff0000) everywhere shares one material
const MC = {};
export function mat(c, o = {}) {
  const k = c + JSON.stringify(o);
  if (!MC[k])
    MC[k] = new THREE.MeshStandardMaterial(
      Object.assign({ color: c, flatShading: true, roughness: 0.85, metalness: 0 }, o),
    );
  return MC[k];
}
export function mesh(g, m, cast = true, recv = false) {
  const o = new THREE.Mesh(g, m);
  o.castShadow = cast;
  o.receiveShadow = recv;
  return o;
}
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// paw print drawn into a 2D canvas (sail, landing pads)
export function paw(x, cx, cy, s, col) {
  x.fillStyle = col;
  x.beginPath();
  x.ellipse(cx, cy + s * 0.35, s * 0.55, s * 0.45, 0, 0, 7);
  x.fill();
  [
    [-0.62, -0.25],
    [-0.22, -0.62],
    [0.22, -0.62],
    [0.62, -0.25],
  ].forEach(([dx, dy]) => {
    x.beginPath();
    x.ellipse(cx + dx * s, cy + dy * s, s * 0.2, s * 0.26, dx * 0.5, 0, 7);
    x.fill();
  });
}
