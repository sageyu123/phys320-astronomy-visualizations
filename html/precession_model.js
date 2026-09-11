/*
   AXIAL PRECESSION MODEL
   The model is intentionally small and geometric. It keeps the ecliptic
   frame fixed, lets Earth's angular-momentum direction precess around the
   ecliptic pole, and supplies the instantaneous quadrupole torque direction
   used by the force diagram.
*/

export const TAU = Math.PI * 2;
export const PRECESSION_YEARS = 26000;
export const LUNAR_ORBIT_DAYS = 27.322;
export const SOLAR_YEAR_DAYS = 365.2422;
export const LUNAR_PHASE_OFFSET_DEG = 35;
export const SIDEREAL_ROTATIONS_PER_SOLAR_DAY = 1.002737909;
export const FORCE_APPLICATION_RADIUS = 1.04;
export const TIDAL_FORCE_SCALE = 0.2;
export const TIDAL_TORQUE_SCALE = 6 * FORCE_APPLICATION_RADIUS * FORCE_APPLICATION_RADIUS * TIDAL_FORCE_SCALE;
export const OBLIQUITY_DEG = 23.44;
export const OBLIQUITY = OBLIQUITY_DEG * Math.PI / 180;
export const LUNAR_INCLINATION_DEG = 5.1;
export const LUNAR_INCLINATION = LUNAR_INCLINATION_DEG * Math.PI / 180;

export function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
export function mod(x, n) { const r = x % n; return r < 0 ? r + n : r; }
export function add(a, b) { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
export function sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
export function scale(a, k) { return [a[0]*k, a[1]*k, a[2]*k]; }
export function dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
export function cross(a, b) {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}
export function length(a) { return Math.hypot(a[0], a[1], a[2]); }
export function normalize(a) {
  const m = length(a) || 1;
  return [a[0]/m, a[1]/m, a[2]/m];
}

export const ECLIPTIC_POLE = [0, 0, 1];
// The fixed teaching plane uses the x-axis as its line of nodes.
export const LUNAR_ORBIT_NORMAL = [0, -Math.sin(LUNAR_INCLINATION), Math.cos(LUNAR_INCLINATION)];

/*
   Reference convention: viewed from the north ecliptic pole, positive elapsed
   years make psi decrease. This is a teaching phase, not a named historical
   epoch; no pole-star dates are inferred from it.
*/
export function phaseForYear(year) {
  const y = clamp(Number(year) || 0, 0, PRECESSION_YEARS);
  return -TAU * y / PRECESSION_YEARS;
}

export function axisForYear(year) {
  const psi = phaseForYear(year);
  return [Math.sin(OBLIQUITY)*Math.cos(psi), Math.sin(OBLIQUITY)*Math.sin(psi), Math.cos(OBLIQUITY)];
}

export function precessionTangentForYear(year) {
  const psi = phaseForYear(year);
  // Direction of dn/d(year), with psi decreasing westward.
  return normalize([Math.sin(OBLIQUITY)*Math.sin(psi), -Math.sin(OBLIQUITY)*Math.cos(psi), 0]);
}

/* The selected vernal-equinoctial direction is the ecliptic/equator
   intersection that points toward the positive reference branch at year 0. */
export function equinoxForYear(year) {
  const psi = phaseForYear(year);
  return [Math.sin(psi), -Math.cos(psi), 0];
}

export function sunDirection(angleDeg) {
  const a = (Number(angleDeg) || 0) * Math.PI / 180;
  return [Math.cos(a), Math.sin(a), 0];
}

// Retain the old name for callers that used the ecliptic direction helper.
export function moonDirection(angleDeg) { return sunDirection(angleDeg); }

export function inclinedMoonDirection(angleDeg) {
  const a = (Number(angleDeg) || 0) * Math.PI / 180;
  const sa = Math.sin(a);
  return [Math.cos(a), sa * Math.cos(LUNAR_INCLINATION), sa * Math.sin(LUNAR_INCLINATION)];
}

export function lunarStateAt(day) {
  const d = clamp(Number(day) || 0, 0, LUNAR_ORBIT_DAYS);
  const angleDeg = mod(LUNAR_PHASE_OFFSET_DEG + 360 * d / LUNAR_ORBIT_DAYS, 360);
  return { day: d, angleDeg, moon: inclinedMoonDirection(angleDeg) };
}

export function earthSpinPhaseForDays(day) {
  return TAU * (Number(day) || 0) * SIDEREAL_ROTATIONS_PER_SOLAR_DAY;
}

export function sunAngleForDays(day) {
  return 225 + 360 * (Number(day) || 0) / SOLAR_YEAR_DAYS;
}

/* For an oblate body in an external direction u, the instantaneous quadrupole
   torque has the teaching-sign form tau ∝ (n·u)(u×n). Opposite orbital
   positions produce the same product, which is why the secular average does
   not cancel even though the Moon makes a full orbit. */
export function instantaneousTorque(axis, externalDirection) {
  return scale(cross(externalDirection, axis), dot(axis, externalDirection));
}

export function orbitAverageTorque(axis, normal=ECLIPTIC_POLE) {
  const n=normalize(axis), k=normalize(normal);
  return scale(cross(n,k), .5 * dot(n,k));
}

/* A dimensionless linear tidal field, scaled for the schematic renderer. */
export function tidalForceAtPoint(externalDirection, point) {
  const u = normalize(externalDirection);
  return scale(sub(scale(u, 3 * dot(u, point)), point), TIDAL_FORCE_SCALE);
}

export function equatorialBasis(axis) {
  let e1 = cross(ECLIPTIC_POLE, axis);
  if (length(e1) < 1e-8) e1 = [1, 0, 0];
  e1 = normalize(e1);
  return { e1, e2: normalize(cross(axis, e1)) };
}

export function forcePoints(axis, externalDirection) {
  const basis = equatorialBasis(axis);
  const projected = sub(externalDirection, scale(axis, dot(axis, externalDirection)));
  const towardExternal = length(projected) < 1e-8 ? basis.e1 : normalize(projected);
  const near = scale(towardExternal, FORCE_APPLICATION_RADIUS), far = scale(towardExternal, -FORCE_APPLICATION_RADIUS);
  const nearForce = tidalForceAtPoint(externalDirection, near), farForce = tidalForceAtPoint(externalDirection, far);
  return {
    near, far, nearForce, farForce,
    torque: add(cross(near, nearForce), cross(far, farForce)), basis
  };
}

export function stateAt(year, moonAngleDeg = LUNAR_PHASE_OFFSET_DEG, sunAngleDeg = 225) {
  const y = clamp(Number(year) || 0, 0, PRECESSION_YEARS);
  const axis = axisForYear(y);
  const moon = inclinedMoonDirection(moonAngleDeg);
  const sun = sunDirection(sunAngleDeg);
  const moonForcePoints = forcePoints(axis, moon), sunForcePoints = forcePoints(axis, sun);
  const analyticMoonTorque = instantaneousTorque(axis, moon);
  const averageMoonTorque = orbitAverageTorque(axis,LUNAR_ORBIT_NORMAL);
  return {
    year: y,
    phase: phaseForYear(y),
    sunAngleDeg,
    axis,
    angularMomentum: axis,
    precessionTangent: precessionTangentForYear(y),
    equinox: equinoxForYear(y),
    moon,
    sun,
    // moonTorque is the same scaled sum shown by the force diagram.
    moonTorque: moonForcePoints.torque,
    analyticMoonTorque,
    moonTorqueFromForces: moonForcePoints.torque,
    averageMoonTorque,
    averageMoonTorqueFromForces: scale(averageMoonTorque, TIDAL_TORQUE_SCALE),
    lunarMeanDirection: normalize(averageMoonTorque),
    lunarOrbitNormal: LUNAR_ORBIT_NORMAL,
    sunTorque: instantaneousTorque(axis, sun),
    moonForcePoints,
    sunForcePoints
  };
}
