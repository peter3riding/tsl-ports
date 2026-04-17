// simplexNoise2d.ts
import {
  Fn,
  vec2,
  vec3,
  vec4,
  float,
  floor,
  fract,
  dot,
  max,
  abs,
  mod,
  step,
} from "three/tsl";
import type { Node } from "three/tsl"; // ← proper typing for TSL nodes

// Helper function
const permute = Fn(([x]: [Node]) => {
  return mod(x.mul(34).add(1).mul(x), 289);
});

// Main Simplex Noise 2D (exact match to the course)
export const simplexNoise2D = Fn(([v]: [Node]) => {
  const C = vec4(
    0.211324865405187,
    0.366025403784439,
    -0.577350269189626,
    0.024390243902439,
  );

  // First corner
  const i = floor(v.add(dot(v, vec2(C.y, C.y))));
  const x0 = v.sub(i).add(dot(i, vec2(C.x, C.x)));

  // Other corners
  const i1x = step(x0.y, x0.x);
  const i1 = vec2(i1x, float(1).sub(i1x));

  const x1 = x0.sub(i1).add(C.x);
  const x2 = x0.add(C.z);

  // Permutations
  const ii = mod(i, 289);
  const p = permute(
    permute(vec3(ii.y, ii.y.add(i1.y), ii.y.add(1))).add(
      vec3(ii.x, ii.x.add(i1.x), ii.x.add(1)),
    ),
  );

  // Gradients and falloff
  const m = max(float(0.5).sub(vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2))), 0);
  const m4 = m.mul(m).mul(m).mul(m);

  const x_grad = fract(p.mul(C.w)).mul(2).sub(1);
  const h = abs(x_grad).sub(0.5);
  const ox = floor(x_grad.add(0.5));
  const a0 = x_grad.sub(ox);

  const m4_norm = m4.mul(
    float(1.79284291400159).sub(
      float(0.85373472095314).mul(a0.mul(a0).add(h.mul(h))),
    ),
  );

  const g = vec3(
    a0.x.mul(x0.x).add(h.x.mul(x0.y)),
    a0.y.mul(x1.x).add(h.y.mul(x1.y)),
    a0.z.mul(x2.x).add(h.z.mul(x2.y)),
  );

  return float(130).mul(dot(m4_norm, g)).mul(0.5).add(0.5); // normalized [0, 1]
});
