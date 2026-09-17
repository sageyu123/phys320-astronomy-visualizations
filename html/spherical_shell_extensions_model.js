// Total shell/ring mass M and reference radius R0 set the units:
// position in R0; field in GM/R0²; force on m in GMm/R0².
export function shellField(position, radius = 1) {
  const r = Math.hypot(...position);
  if (Math.abs(r - radius) < 1e-9) return null;
  if (r < radius) return [0, 0, 0];
  return position.map(v => -v / (r * r * r));
}

export function starField(position, mass = 0.5) {
  const r = Math.hypot(...position);
  if (r === 0) return null;
  return position.map(v => -mass * v / (r * r * r));
}

export function addFields(a, b) {
  return a && b ? a.map((v, i) => v + b[i]) : null;
}

const ringSamples = Array.from({ length: 1024 }, (_, i) => {
  const angle = 2 * Math.PI * (i + 0.5) / 1024;
  return [Math.cos(angle), Math.sin(angle)];
});

export function ringField([x, y, z], radius = 1) {
  if (Math.abs(Math.hypot(x, y) - radius) < 1e-9 && Math.abs(z) < 1e-9) return null;
  if (x === 0 && y === 0) return [0, 0, -z / (radius * radius + z * z) ** 1.5];
  const sum = [0, 0, 0];
  for (const [cx, cy] of ringSamples) {
    const dx = radius * cx - x, dy = radius * cy - y;
    const weight = 1 / (ringSamples.length * (dx * dx + dy * dy + z * z) ** 1.5);
    sum[0] += dx * weight; sum[1] += dy * weight; sum[2] -= z * weight;
  }
  return sum.map(v => Math.abs(v) < 1e-14 ? 0 : v);
}

// Opposite narrow cones with equal solid angle, with their apex at the test mass.
// Their intersections with the sphere have equal |cos(incidence)|, hence
// dA_far/dA_near = s_far²/s_near² and their inverse-square pulls cancel.
export function oppositeShellPatches([x, y], angle, radius = 1) {
  if (Math.hypot(x, y) >= radius) return null;
  const ux = Math.cos(angle), uy = Math.sin(angle), projection = x * ux + y * uy;
  const chordHalf = Math.sqrt(radius * radius - x * x - y * y + projection * projection);
  const positive = chordHalf - projection, negative = chordHalf + projection;
  const a = { point: [x + positive * ux, y + positive * uy], distance: positive };
  const b = { point: [x - negative * ux, y - negative * uy], distance: negative };
  const [near, far] = a.distance <= b.distance ? [a, b] : [b, a];
  return {
    near: near.point, far: far.point,
    nearDistance: near.distance, farDistance: far.distance,
    areaRatio: (far.distance / near.distance) ** 2,
  };
}
