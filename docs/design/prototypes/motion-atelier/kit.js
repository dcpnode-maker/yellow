import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

// Presentation-only geometry helpers. No application or guest data dependencies.
export function mat(color, options = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: .35, metalness: .05,
    envMapIntensity: .7, ...options });
}
export function roundedBox(w, h, d, radius = .08, material = mat('#ded8cc')) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4,
    Math.max(.001, Math.min(radius, Math.min(w, h, d) / 2 - .001))), material);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
export function label(text, { size = .23, color = '#263d36' } = {}) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = '500 64px Urbanist, sans-serif';
  canvas.width = Math.ceil(context.measureText(text).width + 44);
  canvas.height = 104;
  context.font = '500 64px Urbanist, sans-serif';
  context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillStyle = color;
  context.fillText(text, canvas.width / 2, 52);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:texture, depthWrite:false, toneMapped:false}));
  sprite.scale.set(size * canvas.width / canvas.height, size, 1);
  return sprite;
}
export function tube(points, radius, color) {
  const vectors = points.map(p => p.isVector3 ? p : new THREE.Vector3(...p));
  const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vectors), 80, radius, 8, false);
  const mesh = new THREE.Mesh(geometry, mat(color, {roughness:.3}));
  mesh.castShadow = true;
  return mesh;
}
export function smooth(a, b, t) {
  const u = THREE.MathUtils.clamp(t, 0, 1);
  return THREE.MathUtils.lerp(a, b, u * u * (3 - 2 * u));
}
export const kit = {mat, roundedBox, label, tube, smooth};
