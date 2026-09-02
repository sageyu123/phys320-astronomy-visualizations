/* =============================================================================
   ALTAZ ORIGIN STAGE — "why the seasons happen" teaching stage
   PHYS 320 — companion module for html/altaz_radec.html (NOT imported by it;
   this file is a separate, self-contained ES module so it can be wired into
   the existing page later without touching it here).

   Exports a single factory, createOriginStage(deps), that builds TWO
   three.js scenes/cameras and renders both into ONE shared WebGLRenderer
   canvas (split left/right or top/bottom) via renderer.setScissorTest(true)
   + setViewport/setScissor per viewport — the standard three.js
   "multiple views, one canvas" technique.

   This module receives everything three.js-related through `deps` and does
   NOT itself `import` anything (verified with `node --check`): the host
   page/harness owns the vendored three.js modules and hands over the pieces
   this stage needs:

     deps = {
       THREE, Line2, LineGeometry, LineMaterial,   // vendored r168 classes
       renderer,                                    // a THREE.WebGLRenderer already bound to a canvas
       makeTextSprite,                               // (text, colorHex, {pixelHeight,math,upright}) -> THREE.Sprite
       applySpriteScale                              // (sprite, camera, viewportHeightPx) -> void
     }

   makeTextSprite has EXACTLY the signature/behaviour of the same-named
   function in altaz_radec.html (copy its logic verbatim into the host).
   applySpriteScale's SIGNATURE is intentionally widened relative to the
   single-viewport page: the page's own applySpriteScale(sprite) reads a
   single module-level `camera`/`state.mainH` closure, which has no meaning
   here since this stage owns TWO cameras/viewports at once. The host's copy
   must accept the camera and viewport CSS height explicitly:
       function applySpriteScale(sprite, camera, viewportHeightPx){
         if(!camera || !viewportHeightPx) return;
         const k = 2*Math.tan((camera.fov/2)*Math.PI/180) / viewportHeightPx;
         const h = sprite.userData.pixelHeight * k;
         sprite.scale.set(h*sprite.userData.aspect, h, 1);
       }
   — same formula, just parameterized instead of closing over globals. This
   is the "labelPx scale update on resize" the spec calls for, done per
   viewport height rather than whole-canvas height.

   The host MUST call resize(cssW, cssH) once immediately after creation
   (before the first meaningful frame is wanted) and again on every later
   size change — that is what seeds the renderer size, the two viewport
   rects, both cameras' aspect, every LineMaterial's resolution, and every
   label sprite's on-screen scale; resize() calls render() itself at the end.

   RETURNS:
     {
       setDate(dayOfYear),   // updates the model + all THREE object transforms;
                             // does NOT draw — call render() to see it (this
                             // lets an animation loop batch many setDate()s
                             // per rendered frame if it ever needs to)
       getState(),           // -> {day, dateLabel, lambdaDeg, raHours, decDeg, seasonN, seasonS}
       setOptions(opts),     // {ghosts,zodiac,sunArcs,eqGrid,labels} -- all boolean, all default
                             // true; toggles this stage's Display-card layers. Like setDate(),
                             // this only updates visibility flags -- call render() to see it.
       resize(cssW, cssH),   // lay out the two viewports + resize the renderer; renders once
       render(),             // draw both viewports into the current renderer canvas
       attachPointer(el),    // wire drag-rotate/wheel-zoom on `el`, scoped per-viewport
       detachPointer(),      // undo attachPointer
       resetView(),          // restore both cameras' default orbit + renders once
       setVisible(bool),     // when false, render() is a no-op (host is hiding this stage)
       dispose()             // free all GPU resources + remove listeners
     }

   PHYSICS — CLOSED-FORM, CIRCULAR ORBIT, MEAN SUN (a deliberate teaching
   simplification: Earth's real orbit is a slightly eccentric ellipse and the
   real Sun's ecliptic longitude does not advance at a perfectly uniform
   rate, which is why real equinox/solstice dates drift by about a day
   year-to-year and are NOT exactly a quarter-year apart. Here the orbit is a
   perfect circle and the Sun's mean longitude advances uniformly in time, so
   every derived formula below is exact algebra, not an approximation of an
   ephemeris.):

     epsilon = 23.44 deg (obliquity)
     lambda(d) = 360 * (d - 79) / 365.25   (deg; d = day of year, 1-indexed
                 so d=1 is Jan 1; lambda=0 at d=79 = Mar 20, the March
                 equinox — see dayOfYearToLabel for the calendar mapping)
     sin(delta) = sin(epsilon) * sin(lambda)
     alpha = atan2(cos(epsilon) * sin(lambda), cos(lambda)), wrapped to [0,24h)

   The four "cardinal" ghost Earths are placed at the EXACT cardinal
   longitudes lambda = 0/90/180/270 deg (not at lambda(79)/lambda(172)/
   lambda(265)/lambda(355), which the uniform-rate model puts at very
   slightly different longitudes — about +1.7 deg at the June point, +3.3 at
   the September point, +2.0 at the December point). Using the exact
   quarter-longitudes keeps the ghosts at astronomically exact equinox/
   solstice positions (delta=+/-epsilon or 0, alpha=6h/12h/18h/0h to machine
   precision) while still labelling them with the ordinary calendar dates
   79/172/265/355 -> "Mar 20"/"Jun 21"/"Sep 22"/"Dec 21" people actually use.
   The CONTINUOUS/current Earth (driven by setDate) always uses the uniform
   lambda(d) formula above, so at d=79 it sits exactly on the March ghost,
   and near-but-not-exactly on the other three (by the few degrees noted
   above) — a fair reflection of the real Sun doing the same thing, for the
   opposite reason (eccentricity rather than a labelling simplification).

   Ecliptic frame -> three.js (y-up) mapping used throughout:
     x_ecl -> +X (toward the vernal equinox, Aries)
     z_ecl (ecliptic north) -> +Y
     y_ecl -> -Z
   i.e. toThree(v) = (v.x, v.z, -v.y). n_hat (fixed NCP direction, ecliptic
   frame) = (0, sin(eps), cos(eps)) maps to (0, cos(eps), -sin(eps)).

   RENDERING: two THREE.Scene + two THREE.PerspectiveCamera, ONE renderer.
   Nothing allocates per frame: all dynamic point buffers are preallocated
   Float32Arrays fed to LineGeometry.setPositions() via a bounded subarray
   view (the same pattern altaz_radec.html's own setLinePoints() uses for
   its fat dynamic arcs), all scratch vectors are created once and mutated
   with .set()/.copy(), and geometries/materials are shared wherever two
   objects are visually identical (e.g. the 4 ghost Earths share one sphere
   geometry + one material).
   ========================================================================= */

/* ---- pure constants / math (no THREE needed for any of this) ---- */
const TAU = Math.PI * 2;
const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;
const CIRCLE_N = 96;   // sample count for static great/small circles
const ARC_N = 64;      // sample count for the dynamic teaching arcs

const EPS_DEG = 23.44;
const EPS = EPS_DEG * RAD;
const COS_EPS = Math.cos(EPS);
const SIN_EPS = Math.sin(EPS);

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function norm360(d) { d = d % 360; if (d < 0) d += 360; return d; }
function wrap24(h) { h = h % 24; if (h < 0) h += 24; return h; }

/* ---- palette (fixed design tokens shared with altaz_radec.html's :root
   CSS custom properties; hardcoded here since deps carries no palette —
   colors are a fixed part of this design system, not a per-host parameter).
   "coral" is a NEW accent introduced by this stage for the ecliptic, per
   spec, distinct from every color already used by the host page. ---- */
const COLOR_HEX = {
  text: "#e7e9eb", muted: "#979ea6",
  cyan: "#56c7d9", amber: "#ffcc66", magenta: "#ee65be", purple: "#a99bff",
  green: "#56dc72", coral: "#ff7f66",
  orbit: "#fff1d9" // amber-white blend for the orbit path line only (not a core token)
};
function hexToInt(hex) { return parseInt(hex.replace("#", ""), 16); }
const COLOR_INT = {};
Object.keys(COLOR_HEX).forEach(function (k) { COLOR_INT[k] = hexToInt(COLOR_HEX[k]); });
function hexToRgb(hex) {
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map(function (c) { return c + c; }).join("");
  const num = parseInt(hex, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

/* ---- zodiac: 12 signs, 30 deg each, counted eastward from Aries (sign 0).
   "︎" (VS15, text-presentation selector) is appended to every glyph so
   it renders as a plain text glyph rather than a colored emoji on platforms
   that would otherwise substitute one. ---- */
const ZODIAC_SIGNS = [
  { glyph: "♈︎", name: "Aries" }, { glyph: "♉︎", name: "Taurus" },
  { glyph: "♊︎", name: "Gemini" }, { glyph: "♋︎", name: "Cancer" },
  { glyph: "♌︎", name: "Leo" }, { glyph: "♍︎", name: "Virgo" },
  { glyph: "♎︎", name: "Libra" }, { glyph: "♏︎", name: "Scorpio" },
  { glyph: "♐︎", name: "Sagittarius" }, { glyph: "♑︎", name: "Capricorn" },
  { glyph: "♒︎", name: "Aquarius" }, { glyph: "♓︎", name: "Pisces" }
];

/* ---- physics (pure numbers; independently re-verified in a Node harness) ---- */
function meanSunLongitudeDeg(dayOfYear) { return norm360(360 * (dayOfYear - 79) / 365.25); }
function sunEquatorialFromLambda(lambdaDeg) {
  const l = lambdaDeg * RAD;
  const sinDelta = clamp(SIN_EPS * Math.sin(l), -1, 1);
  const decDeg = Math.asin(sinDelta) * DEG;
  const alphaDeg = norm360(Math.atan2(COS_EPS * Math.sin(l), Math.cos(l)) * DEG);
  return { raHours: alphaDeg / 15, decDeg: decDeg };
}
function seasonsForLambda(lambdaDeg) {
  const l = norm360(lambdaDeg);
  if (l < 90) return { N: "spring", S: "autumn" };
  if (l < 180) return { N: "summer", S: "winter" };
  if (l < 270) return { N: "autumn", S: "spring" };
  return { N: "winter", S: "summer" };
}
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/* day-of-year -> calendar label for a non-leap year, d=1 is Jan 1 (so d=79 is
   Mar 20); d outside [1,365] wraps around the year. */
function dayOfYearToLabel(dayOfYear) {
  let i = Math.round(dayOfYear) - 1;
  i = ((i % 365) + 365) % 365;
  let m = 0;
  while (i >= MONTH_DAYS[m]) { i -= MONTH_DAYS[m]; m++; }
  return MONTH_NAMES[m] + " " + (i + 1);
}

/* ---- geometry, all in three.js (y-up) coordinates already, as plain
   {x,y,z} objects (converted to THREE.Vector3 only where a THREE API
   demands one) ---- */
function earthOrbitPos3(lambdaDeg) { // heliocentric Earth position, orbit radius A=1
  const l = lambdaDeg * RAD;
  return { x: -Math.cos(l), y: 0, z: Math.sin(l) };
}
function eclipticPoint3(anyDeg) { // unit point on the ecliptic great circle;
  // also equals the Earth->Sun UNIT direction when anyDeg = the Sun's lambda
  const l = anyDeg * RAD;
  return { x: Math.cos(l), y: 0, z: -Math.sin(l) };
}
const N_HAT3 = { x: 0, y: COS_EPS, z: -SIN_EPS };  // NCP direction, fixed in space at every date
const X_EQ3 = { x: 1, y: 0, z: 0 };                // equinox direction (shared with the ecliptic x-axis)
const Y_EQ3 = { x: 0, y: -SIN_EPS, z: -COS_EPS };
/* point on the unit sphere for (RA=alphaDeg, Dec=tDeg); ALSO doubles as the
   full-circle parametrization of the hour-circle/meridian great circle at
   RA=alphaDeg when tDeg sweeps through the full +/-180 range (used for the
   static hour-circle grid and the Sun's declination arc alike) */
function equatorPoint3(alphaDeg, tDeg) {
  const a = alphaDeg * RAD, t = tDeg * RAD;
  const ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(t), st = Math.sin(t);
  const eq0x = ca, eq0y = sa * Y_EQ3.y, eq0z = sa * Y_EQ3.z; // equatorPoint3(alphaDeg,0)
  return { x: ct * eq0x + st * N_HAT3.x, y: ct * eq0y + st * N_HAT3.y, z: ct * eq0z + st * N_HAT3.z };
}
/* analytic unit tangents (d/d(angle), always unit length) for the three
   dynamic arcs -- used instead of a finite-difference (tip-minus-prev)
   estimate so the arrowhead orientation stays well-defined even when an
   arc's length is exactly zero (this genuinely happens: at d=79 the Sun's
   RA and ecliptic longitude are both exactly 0, so the alpha-arc and
   lambda-arc both degenerate to a single point at that exact frame). */
function equatorTangentAtEquator3(alphaDeg) { // d/da of equatorPoint3(a,0)
  const a = alphaDeg * RAD;
  return { x: -Math.sin(a), y: Math.cos(a) * Y_EQ3.y, z: Math.cos(a) * Y_EQ3.z };
}
function meridianTangent3(alphaDeg, tDeg) { // d/dt of equatorPoint3(alphaDeg,t)
  const eq0 = equatorPoint3(alphaDeg, 0);
  const t = tDeg * RAD, ct = Math.cos(t), st = Math.sin(t);
  return { x: -st * eq0.x + ct * N_HAT3.x, y: -st * eq0.y + ct * N_HAT3.y, z: -st * eq0.z + ct * N_HAT3.z };
}
function eclipticTangent3(anyDeg) { // d/dl of eclipticPoint3(l)
  const l = anyDeg * RAD;
  return { x: -Math.sin(l), y: 0, z: -Math.cos(l) };
}
function ringPoints3(basisU, basisV, radius, n) {
  const pts = new Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * TAU, c = Math.cos(t) * radius, s = Math.sin(t) * radius;
    pts[i] = { x: basisU.x * c + basisV.x * s, y: basisU.y * c + basisV.y * s, z: basisU.z * c + basisV.z * s };
  }
  return pts;
}
const ECL_U = { x: 1, y: 0, z: 0 }, ECL_V = { x: 0, y: 0, z: -1 }; // ecliptic-plane basis (matches eclipticPoint3)

/* right scene: the Sun's alpha/delta/lambda arcs sit lifted slightly off the
   celestial-equator/ecliptic rings (radius 1) they're drawn on, matching
   altaz_radec.html's own ARC_LIFT=1.012 -- same rationale (never z-fight
   with the ring underneath). A uniform radial scale doesn't change a
   spherical curve's unit tangent direction, so every tangent/arrowhead
   helper below still takes the UNLIFTED point/direction; only the points
   actually written into the line buffers (and the cone tip fed to
   orientConeAlongTangent) are lifted. */
const ARC_LIFT_R = 1.012;
function liftedPoint(p, k) { return { x: p.x * k, y: p.y * k, z: p.z * k }; }

/* =========================================================================
   FACTORY
   ========================================================================= */
export function createOriginStage(deps) {
  const THREE = deps.THREE;
  const Line2 = deps.Line2;
  const LineGeometry = deps.LineGeometry;
  const LineMaterial = deps.LineMaterial;
  const renderer = deps.renderer;
  const makeTextSprite = deps.makeTextSprite;
  const applySpriteScale = deps.applySpriteScale;

  function v3(p) { return new THREE.Vector3(p.x, p.y, p.z); }
  function pts3(arr) { return arr.map(v3); }

  /* ---- scenes / cameras ---- */
  const sceneL = new THREE.Scene();
  const sceneR = new THREE.Scene();
  const camL = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
  const camR = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
  sceneL.add(camL); // cameras are added to their own scene so camera-child HUD sprites render
  sceneR.add(camR);

  const CAM_L_DEFAULT = { theta: 0, phi: 40 * RAD, radius: 3.6 };
  const CAM_R_DEFAULT = { theta: 25 * RAD, phi: 25 * RAD, radius: 3.2 };
  const ZOOM_MIN = 1.3, ZOOM_MAX = 11;
  // world-space radius of each scene's outermost content (ghost-Earth labels /
  // NCP-SCP labels), used by computeDefaultRadius() below to auto-refit the
  // default distance so nothing clips off-frame at an unusually narrow
  // per-viewport aspect (e.g. a wide canvas split left/right still gives each
  // half a PORTRAIT aspect, which the fov's fixed vertical-only definition
  // does not automatically accommodate) -- same "isDefault auto-refit on
  // resize" strategy altaz_radec.html's own computeDefaultRadius() uses.
  // CONTENT_RADIUS_L raised from 1.3 to accommodate the zodiac ring's sign
  // name labels (the new outermost left-scene content, out to radius ~1.70)
  const CONTENT_RADIUS_L = 1.78, CONTENT_RADIUS_R = 1.2;
  function computeDefaultRadius(aspect, vfovDeg, contentRadius, baseRadius) {
    const halfV = Math.tan((vfovDeg / 2) * RAD);
    const neededByHeight = contentRadius / halfV;
    const neededByWidth = contentRadius / (halfV * Math.max(aspect, 0.15));
    return Math.max(baseRadius, neededByHeight * 1.15, neededByWidth * 1.15);
  }
  const camState = {
    L: { theta: CAM_L_DEFAULT.theta, phi: CAM_L_DEFAULT.phi, radius: CAM_L_DEFAULT.radius, isDefault: true },
    R: { theta: CAM_R_DEFAULT.theta, phi: CAM_R_DEFAULT.phi, radius: CAM_R_DEFAULT.radius, isDefault: true }
  };
  function applyCam(cam, cs) {
    const cp = Math.cos(cs.phi), sp = Math.sin(cs.phi);
    cam.position.set(cs.radius * cp * Math.sin(cs.theta), cs.radius * sp, cs.radius * cp * Math.cos(cs.theta));
    cam.lookAt(0, 0, 0);
  }

  /* ---- shared registries (per scene) kept in sync on resize ---- */
  const labelsL = [], labelsR = [];
  const fatMatsL = [], fatMatsR = [];
  const disposables = []; // {dispose(){...}} entries collected as things are built, for dispose()

  function track(x) { disposables.push(x); return x; }

  function makeFatLine(colorInt, opacity, widthPx, capacityPts, fatMatsArr) {
    const cap = capacityPts || (ARC_N + 1);
    const positions = new Float32Array(cap * 3);
    const geo = new LineGeometry();
    geo.setPositions(positions);
    const mat = new LineMaterial({ color: colorInt, linewidth: widthPx, transparent: true, opacity: opacity, worldUnits: false, depthWrite: false });
    mat.resolution.set(1, 1);
    const line = new Line2(geo, mat);
    line.frustumCulled = false;
    fatMatsArr.push(mat);
    track({ dispose: function () { geo.dispose(); mat.dispose(); } });
    return { line: line, geo: geo, positions: positions, capacity: cap, material: mat };
  }
  function makeFatLoop(points, colorInt, opacity, widthPx, fatMatsArr) {
    const closed = points.concat([points[0]]);
    const flat = new Float32Array(closed.length * 3);
    for (let i = 0; i < closed.length; i++) { flat[i * 3] = closed[i].x; flat[i * 3 + 1] = closed[i].y; flat[i * 3 + 2] = closed[i].z; }
    const geo = new LineGeometry();
    geo.setPositions(flat);
    const mat = new LineMaterial({ color: colorInt, linewidth: widthPx, transparent: true, opacity: opacity, worldUnits: false, depthWrite: false });
    mat.resolution.set(1, 1);
    const line = new Line2(geo, mat);
    line.frustumCulled = false;
    fatMatsArr.push(mat);
    track({ dispose: function () { geo.dispose(); mat.dispose(); } });
    return line;
  }
  function setFatLinePoints(obj, n) {
    // obj.positions already holds n*3 valid floats, written in place by the caller
    const nn = Math.max(2, n);
    obj.geo.setPositions(obj.positions.subarray(0, nn * 3)); // subarray = view, not a copy
  }
  function writePoint(arr, i, p) { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; }

  function thinLoop(points, colorInt, opacity, scene) {
    const geo = new THREE.BufferGeometry().setFromPoints(pts3(points));
    const mat = new THREE.LineBasicMaterial({ color: colorInt, transparent: true, opacity: opacity, depthWrite: false });
    const line = new THREE.LineLoop(geo, mat);
    scene.add(line);
    track({ dispose: function () { geo.dispose(); mat.dispose(); } });
    return { line: line, material: mat };
  }
  function thinSeg(p0, p1, colorInt, opacity, scene) {
    const geo = new THREE.BufferGeometry().setFromPoints([v3(p0), v3(p1)]);
    const mat = new THREE.LineBasicMaterial({ color: colorInt, transparent: true, opacity: opacity, depthWrite: false });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    track({ dispose: function () { geo.dispose(); mat.dispose(); } });
    return line;
  }

  function registerLabel(sprite, arr) { arr.push(sprite); return sprite; }

  /* Every label's "intended" world position is tracked separately from its
     actual (possibly edge-clamped) rendered position -- see
     clampLabelToViewport() below, called every render() so labels always
     read at least 28px inside their viewport (a label positioned via this
     helper is eligible for clamping; the camera-pinned HUD sprites are
     positioned directly via positionHud() instead and never call this, so
     the clamp loop's "no basePos -> skip" check naturally leaves them alone). */
  function setLabelPos(sprite, x, y, z) {
    if (!sprite.userData.basePos) sprite.userData.basePos = { x: 0, y: 0, z: 0 };
    sprite.userData.basePos.x = x; sprite.userData.basePos.y = y; sprite.userData.basePos.z = z;
    sprite.position.set(x, y, z);
  }

  /* soft radial-gradient glow sprite (Sun / star glints); world-space sized
     (sizeAttenuation:true) since it represents a physical glow around a
     world object, unlike the fixed-CSS-px text sprites from makeTextSprite */
  function makeGlowSprite(colorHex, worldSize, opacity) {
    const size = 64;
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const ctx = c.getContext("2d");
    const rgb = hexToRgb(colorHex);
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + opacity + ")");
    grad.addColorStop(0.5, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + (opacity * 0.4) + ")");
    grad.addColorStop(1, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, sizeAttenuation: true, blending: THREE.AdditiveBlending });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(worldSize, worldSize, 1);
    track({ dispose: function () { tex.dispose(); mat.dispose(); } });
    return spr;
  }

  /* shared arrowhead cone geometry, reused (different materials) for every
     dynamic arc/arrow tip in both scenes. Sized to match the host page's own
     arrowheads: altaz_radec.html's coneGeoShared is
     ConeGeometry(0.012*1.45*0.7, 0.044*1.45*0.7, 8) -- i.e. its base 4px-arc
     cone scaled down 0.7x in a later polish pass -- reused verbatim here so
     this stage's Sun-arc arrowheads read as the same small accents, not a
     bigger/different shape (both scenes' celestial spheres share radius 1). */
  const coneGeo = new THREE.ConeGeometry(0.012 * 1.45 * 0.7, 0.044 * 1.45 * 0.7, 8);
  track({ dispose: function () { coneGeo.dispose(); } });
  const coneHalfH = (0.044 * 1.45 * 0.7) / 2;
  const UP3 = new THREE.Vector3(0, 1, 0);
  const scratchDir = new THREE.Vector3();
  function makeCone(colorInt, scene) {
    const mat = new THREE.MeshBasicMaterial({ color: colorInt, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(coneGeo, mat);
    scene.add(mesh);
    track({ dispose: function () { mat.dispose(); } });
    return mesh;
  }
  function orientConeAlongDelta(cone, tip, prev) {
    let dx = tip.x - prev.x, dy = tip.y - prev.y, dz = tip.z - prev.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len; dy /= len; dz /= len;
    cone.position.set(tip.x - dx * coneHalfH, tip.y - dy * coneHalfH, tip.z - dz * coneHalfH);
    scratchDir.set(dx, dy, dz);
    cone.quaternion.setFromUnitVectors(UP3, scratchDir);
  }
  /* used for the 3 great-circle arcs instead of a finite-difference estimate:
     a finite difference degenerates to a zero vector exactly when the arc's
     sweep is zero-length (which really happens -- see the tangent helpers'
     own comment above), while the analytic unit tangent stays well-defined
     even then. `tangent` must already be a unit vector (see
     equatorTangentAtEquator3/meridianTangent3/eclipticTangent3 above). */
  function orientConeAlongTangent(cone, tip, tangent) {
    cone.position.set(tip.x - tangent.x * coneHalfH, tip.y - tangent.y * coneHalfH, tip.z - tangent.z * coneHalfH);
    scratchDir.set(tangent.x, tangent.y, tangent.z);
    cone.quaternion.setFromUnitVectors(UP3, scratchDir);
  }

  /* small shared "dot" marker geometry (equinox/solstice/NCP/SCP points) */
  const dotGeo = new THREE.SphereGeometry(0.018, 10, 8);
  track({ dispose: function () { dotGeo.dispose(); } });
  function makeDot(colorInt, pos, scene) {
    const mat = new THREE.MeshBasicMaterial({ color: colorInt });
    const mesh = new THREE.Mesh(dotGeo, mat);
    mesh.position.copy(v3(pos));
    scene.add(mesh);
    track({ dispose: function () { mat.dispose(); } });
    return mesh;
  }

  /* =======================================================================
     LEFT SCENE — heliocentric "solar system, seen from above the ecliptic"
     ======================================================================= */
  let earthMain; // group holding the current-date Earth (position updated per setDate)
  let arrowAriesObj, arrowAriesCone, ariesLabel; // dynamic: track the current Earth
  let earthSunLineObj; // dynamic thin amber Earth->Sun line
  let ncpLabel; // "NCP" sprite pinned to the current Earth's axis tip
  // Display-option groups (left scene): geometry gated by its own toggle,
  // label sprites additionally gated by that toggle AND "Labels" -- see
  // applyOptionsVisibility() below.
  let ghostGeomGroup, ghostLabelGroup;       // "Ghost Earths"
  let zodiacGeomGroupL, zodiacLabelGroupL;   // "Zodiac" (left ring)
  let labelsOnlyGroupL;                      // always-on geometry; label gated by "Labels" alone
  const zodiacGlyphsL = [], zodiacNamesL = []; // per-sign sprites, tinted per setDate() (see updateZodiacHighlight)

  function buildEarthTemplate(scene, opacity, isMain) {
    const group = new THREE.Group();
    scene.add(group);

    let sphereGeo;
    if (isMain) {
      sphereGeo = new THREE.SphereGeometry(0.12, 28, 20);
      track({ dispose: function () { sphereGeo.dispose(); } });
    } else {
      if (!buildEarthTemplate._ghostSphereGeo) {
        buildEarthTemplate._ghostSphereGeo = new THREE.SphereGeometry(0.12, 20, 14);
        track({ dispose: function () { buildEarthTemplate._ghostSphereGeo.dispose(); } });
      }
      sphereGeo = buildEarthTemplate._ghostSphereGeo; // shared across all 4 ghosts
    }
    const sphereMat = new THREE.MeshLambertMaterial({ color: 0x3b7dd8, transparent: opacity < 1, opacity: opacity });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    group.add(sphere);
    track({ dispose: function () { sphereMat.dispose(); } });

    // equator ring right on the sphere surface, tilted with the (fixed) axis
    const ringPts = ringPoints3(X_EQ3, Y_EQ3, 0.122, 40);
    const ringGeo = new THREE.BufferGeometry().setFromPoints(pts3(ringPts));
    const ringMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 * opacity, depthWrite: false });
    const ring = new THREE.LineLoop(ringGeo, ringMat);
    group.add(ring);
    track({ dispose: function () { ringGeo.dispose(); ringMat.dispose(); } });

    // extended equatorial-plane disk (translucent amber), same tilt
    const diskR = 0.28;
    const diskPts = ringPoints3(X_EQ3, Y_EQ3, diskR, 40);
    const diskVerts = [0, 0, 0];
    diskPts.forEach(function (p) { diskVerts.push(p.x, p.y, p.z); });
    const diskIndex = [];
    for (let i = 1; i < diskPts.length; i++) diskIndex.push(0, i, i + 1);
    const diskGeo = new THREE.BufferGeometry();
    diskGeo.setAttribute("position", new THREE.Float32BufferAttribute(diskVerts, 3));
    diskGeo.setIndex(diskIndex);
    diskGeo.computeVertexNormals();
    const diskMat = new THREE.MeshBasicMaterial({ color: COLOR_INT.amber, transparent: true, opacity: 0.22 * opacity, side: THREE.DoubleSide, depthWrite: false });
    const disk = new THREE.Mesh(diskGeo, diskMat);
    group.add(disk);
    track({ dispose: function () { diskGeo.dispose(); diskMat.dispose(); } });

    // rotation axis, fixed direction n_hat, length 0.36, through the sphere
    const axisLen = 0.18;
    const axisObj = makeFatLine(COLOR_INT.magenta, 0.9 * opacity, 2, 2, fatMatsL);
    writePoint(axisObj.positions, 0, { x: -N_HAT3.x * axisLen, y: -N_HAT3.y * axisLen, z: -N_HAT3.z * axisLen });
    writePoint(axisObj.positions, 1, { x: N_HAT3.x * axisLen, y: N_HAT3.y * axisLen, z: N_HAT3.z * axisLen });
    setFatLinePoints(axisObj, 2);
    group.add(axisObj.line);

    return { group: group };
  }

  function buildHelioScene() {
    // lighting: point light at the Sun + a soft ambient fill so Earths shade correctly
    const sunLight = new THREE.PointLight(0xffe9b0, 2.5, 0, 0); // decay 0 (no falloff)
    sceneL.add(sunLight);
    sceneL.add(new THREE.AmbientLight(0x334455, 0.35));

    // the Sun
    const sunGeo = new THREE.SphereGeometry(0.09, 24, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: COLOR_INT.amber });
    sceneL.add(new THREE.Mesh(sunGeo, sunMat));
    sceneL.add(makeGlowSprite(COLOR_HEX.amber, 0.5, 0.8));
    track({ dispose: function () { sunGeo.dispose(); sunMat.dispose(); } });

    // Earth's orbit (thin amber-white circle, r=1) + ecliptic-plane hint disk + faint radial grid
    thinLoop(ringPoints3(ECL_U, ECL_V, 1, CIRCLE_N), COLOR_INT.orbit, 0.5, sceneL);
    {
      const diskPts = ringPoints3(ECL_U, ECL_V, 1.35, 64);
      const verts = [0, 0, 0];
      diskPts.forEach(function (p) { verts.push(p.x, p.y, p.z); });
      const idx = [];
      for (let i = 1; i < diskPts.length; i++) idx.push(0, i, i + 1);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(idx);
      const mat = new THREE.MeshBasicMaterial({ color: COLOR_INT.cyan, transparent: true, opacity: 0.04, side: THREE.DoubleSide, depthWrite: false });
      sceneL.add(new THREE.Mesh(geo, mat));
      track({ dispose: function () { geo.dispose(); mat.dispose(); } });
      [0.34, 0.68, 1.02].forEach(function (r) { thinLoop(ringPoints3(ECL_U, ECL_V, r, 64), COLOR_INT.cyan, 0.06, sceneL); });
      for (let k = 0; k < 8; k++) {
        const t = (k / 8) * TAU;
        const far = { x: Math.cos(t) * 1.35, y: 0, z: -Math.sin(t) * 1.35 };
        thinSeg({ x: 0, y: 0, z: 0 }, far, COLOR_INT.cyan, 0.05, sceneL);
      }
    }

    // ghost Earths at the exact cardinal longitudes -- geometry and labels
    // wrapped in their own groups so "Ghost Earths" gates both together
    // (Object3D.visible=false hides an entire subtree, so decGeomGroup's
    // children need no individual visibility bookkeeping)
    ghostGeomGroup = new THREE.Group(); sceneL.add(ghostGeomGroup);
    ghostLabelGroup = new THREE.Group(); sceneL.add(ghostLabelGroup);
    const CARDINALS = [
      { lambdaDeg: 0, label: "Mar 20 · ♈ equinox" },
      { lambdaDeg: 90, label: "Jun 21 · solstice" },
      { lambdaDeg: 180, label: "Sep 22 · equinox" },
      { lambdaDeg: 270, label: "Dec 21 · solstice" }
    ];
    CARDINALS.forEach(function (c) {
      const tmpl = buildEarthTemplate(ghostGeomGroup, 0.45, false);
      const pos = earthOrbitPos3(c.lambdaDeg);
      tmpl.group.position.set(pos.x, pos.y, pos.z);
      const lab = registerLabel(makeTextSprite(c.label, COLOR_HEX.muted, { pixelHeight: 11 }), labelsL);
      const outward = Math.hypot(pos.x, pos.z) || 1;
      setLabelPos(lab, pos.x * 1.18 / outward, 0.15, pos.z * 1.18 / outward);
      ghostLabelGroup.add(lab);
    });

    // the current Earth (always shown -- not gated by "Ghost Earths")
    earthMain = buildEarthTemplate(sceneL, 1, true);
    // labels that are always-on geometry but whose TEXT is gated by "Labels"
    // alone (no other toggle applies to them)
    labelsOnlyGroupL = new THREE.Group(); sceneL.add(labelsOnlyGroupL);
    ncpLabel = registerLabel(makeTextSprite("NCP", COLOR_HEX.magenta, { pixelHeight: 12 }), labelsL);
    labelsOnlyGroupL.add(ncpLabel);

    // dynamic: Earth->Sun thin amber line
    earthSunLineObj = thinSeg({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, COLOR_INT.amber, 0.7, sceneL);
    earthSunLineObj.material.linewidth = 1.5; // ignored by most browsers but harmless; documents intent

    // dynamic: arrow from the current Earth toward Aries (world +X, fixed direction, every date)
    arrowAriesObj = makeFatLine(COLOR_INT.purple, 1, 3, 2, fatMatsL);
    sceneL.add(arrowAriesObj.line);
    arrowAriesCone = makeCone(COLOR_INT.purple, sceneL);
    ariesLabel = registerLabel(makeTextSprite("♈", COLOR_HEX.purple, { pixelHeight: 18, upright: true }), labelsL);
    labelsOnlyGroupL.add(ariesLabel);

    // top-left HUD title, pinned to the camera so it stays put through drag/zoom
    const hud = registerLabel(makeTextSprite("SOLAR SYSTEM · SEEN FROM ABOVE THE ECLIPTIC", COLOR_HEX.muted, { pixelHeight: 10 }), labelsL);
    camL.add(hud);
    return { hud: hud };
  }

  /* =======================================================================
     RIGHT SCENE — geocentric celestial sphere, "from Earth"
     ======================================================================= */
  let sunMarkerGroup;
  let raArcObj, raCone, decArcObj, decCone, lamArcObj, lamCone;
  let raLabel, decLabel, lamLabel;
  // Display-option groups (right scene) -- same gating convention as the left
  // scene's groups above.
  let eqGridGroupR;                          // "Equatorial grid"
  let sunArcGeomGroup, sunArcLabelGroup;      // "Sun arcs"
  let zodiacGeomGroupR, zodiacLabelGroupR;    // "Zodiac" (right ticks + sign glyphs)
  let labelsOnlyGroupR;                       // always-on geometry; label gated by "Labels" alone
  const zodiacGlyphsR = []; // per-sign sprites (glyph only, no name), tinted per setDate()

  function buildCelestialScene() {
    // tiny Earth at the center + its (short) rotation axis
    const eGeo = new THREE.SphereGeometry(0.05, 20, 14);
    const eMat = new THREE.MeshBasicMaterial({ color: 0x3b7dd8 });
    sceneR.add(new THREE.Mesh(eGeo, eMat));
    track({ dispose: function () { eGeo.dispose(); eMat.dispose(); } });
    const axisLen = 0.075;
    thinSeg({ x: -N_HAT3.x * axisLen, y: -N_HAT3.y * axisLen, z: -N_HAT3.z * axisLen },
            { x: N_HAT3.x * axisLen, y: N_HAT3.y * axisLen, z: N_HAT3.z * axisLen },
            COLOR_INT.magenta, 0.9, sceneR);

    // faint full-sphere shell (radius 1) -- no horizon, no observer here
    const shellGeo = new THREE.SphereGeometry(1, 48, 32);
    const shellMat = new THREE.MeshBasicMaterial({ color: COLOR_INT.cyan, transparent: true, opacity: 0.03, side: THREE.DoubleSide, depthWrite: false });
    sceneR.add(new THREE.Mesh(shellGeo, shellMat));
    track({ dispose: function () { shellGeo.dispose(); shellMat.dispose(); } });

    // labels that are always-on geometry but whose TEXT is gated by "Labels"
    // alone (no other toggle applies to them)
    labelsOnlyGroupR = new THREE.Group(); sceneR.add(labelsOnlyGroupR);

    // celestial equator (amber) + ecliptic (coral) -- reference rings: kept
    // THIN and DIM (1.5px, opacity 0.55/0.6) so the 4px/opacity-1.0 Sun arcs
    // drawn ON them always read as the dominant, didactic overlay
    function makeFatLoopClosed(points, colorInt, opacity, widthPx) { return makeFatLoop(points, colorInt, opacity, widthPx, fatMatsR); }
    const eqPts = []; for (let i = 0; i <= CIRCLE_N; i++) eqPts.push(equatorPoint3((i / CIRCLE_N) * 360, 0));
    sceneR.add(makeFatLoopClosed(eqPts, COLOR_INT.amber, 0.55, 1.5));
    const eclPts = []; for (let i = 0; i <= CIRCLE_N; i++) eclPts.push(eclipticPoint3((i / CIRCLE_N) * 360));
    sceneR.add(makeFatLoopClosed(eclPts, COLOR_INT.coral, 0.6, 1.5));
    {
      const eclLabel = registerLabel(makeTextSprite("ecliptic", COLOR_HEX.coral, { pixelHeight: 14 }), labelsR);
      // near side of the ring, offset outward -- 205deg (far/back side) used
      // to clip at the viewport edge at some camera angles; 70deg keeps it on
      // the near side where there is room (the generic edge clamp in
      // clampAllLabels() still catches any residual case)
      const p = eclipticPoint3(70);
      setLabelPos(eclLabel, p.x * 1.08, p.y * 1.08 + 0.05, p.z * 1.08);
      labelsOnlyGroupR.add(eclLabel);
    }

    // equatorial grid: dec circles +/-30,+/-60 and hour circles every 2h --
    // gated by the "Equatorial grid" option (NOT the equator/ecliptic rings
    // above, which are permanent references)
    eqGridGroupR = new THREE.Group(); sceneR.add(eqGridGroupR);
    [-60, -30, 30, 60].forEach(function (dec) {
      const pts = []; for (let i = 0; i <= CIRCLE_N; i++) pts.push(equatorPoint3((i / CIRCLE_N) * 360, dec));
      thinLoop(pts, COLOR_INT.amber, 0.16, eqGridGroupR);
    });
    for (let h = 0; h < 24; h += 2) {
      const alpha0 = h * 15;
      const pts = []; for (let i = 0; i <= CIRCLE_N; i++) pts.push(equatorPoint3(alpha0, (i / CIRCLE_N) * 360));
      thinLoop(pts, COLOR_INT.amber, h === 0 ? 0.4 : 0.16, eqGridGroupR);
    }

    // Aries / Libra crossing points (dots always shown; labels "Labels"-gated)
    const ariesPt = eclipticPoint3(0), libraPt = eclipticPoint3(180);
    makeDot(COLOR_INT.purple, ariesPt, sceneR);
    makeDot(COLOR_INT.muted, libraPt, sceneR);
    { const l = registerLabel(makeTextSprite("♈", COLOR_HEX.purple, { pixelHeight: 18 }), labelsR); setLabelPos(l, ariesPt.x * 1.1, 0.09, ariesPt.z * 1.1); labelsOnlyGroupR.add(l); }
    { const l = registerLabel(makeTextSprite("♎", COLOR_HEX.muted, { pixelHeight: 16 }), labelsR); setLabelPos(l, libraPt.x * 1.1, 0.09, libraPt.z * 1.1); labelsOnlyGroupR.add(l); }

    // solstice points on the ecliptic (longitude 90/270)
    const junPt = eclipticPoint3(90), decPt = eclipticPoint3(270);
    makeDot(COLOR_INT.muted, junPt, sceneR);
    makeDot(COLOR_INT.muted, decPt, sceneR);
    { const l = registerLabel(makeTextSprite("♋ Jun solstice", COLOR_HEX.muted, { pixelHeight: 11 }), labelsR); setLabelPos(l, junPt.x * 1.1, junPt.y + 0.09, junPt.z * 1.1); labelsOnlyGroupR.add(l); }
    { const l = registerLabel(makeTextSprite("♑ Dec solstice", COLOR_HEX.muted, { pixelHeight: 11 }), labelsR); setLabelPos(l, decPt.x * 1.1, decPt.y + 0.09, decPt.z * 1.1); labelsOnlyGroupR.add(l); }

    // NCP / SCP
    makeDot(COLOR_INT.magenta, N_HAT3, sceneR);
    makeDot(COLOR_INT.magenta, { x: -N_HAT3.x, y: -N_HAT3.y, z: -N_HAT3.z }, sceneR);
    { const l = registerLabel(makeTextSprite("NCP", COLOR_HEX.magenta, { pixelHeight: 12 }), labelsR); setLabelPos(l, N_HAT3.x * 1.1, N_HAT3.y * 1.1 + 0.06, N_HAT3.z * 1.1); labelsOnlyGroupR.add(l); }
    { const l = registerLabel(makeTextSprite("SCP", COLOR_HEX.magenta, { pixelHeight: 12 }), labelsR); setLabelPos(l, -N_HAT3.x * 1.1, -N_HAT3.y * 1.1 - 0.06, -N_HAT3.z * 1.1); labelsOnlyGroupR.add(l); }

    // the Sun marker (sphere + glow), position updated every setDate()
    sunMarkerGroup = new THREE.Group();
    const sGeo = new THREE.SphereGeometry(0.035, 16, 12);
    const sMat = new THREE.MeshBasicMaterial({ color: COLOR_INT.amber });
    sunMarkerGroup.add(new THREE.Mesh(sGeo, sMat));
    sunMarkerGroup.add(makeGlowSprite(COLOR_HEX.amber, 0.18, 0.8));
    sceneR.add(sunMarkerGroup);
    track({ dispose: function () { sGeo.dispose(); sMat.dispose(); } });

    // dynamic arcs: RA (amber, along equator), Dec (amber, along the Sun's
    // hour circle), lambda (coral, along ecliptic) -- the didactic "Sun
    // arcs" layer: near-opaque (opacity 1.0) and thick (4px) so they always
    // read as dominant over the thin/dim rings they're drawn on, plus
    // lifted slightly (radius ARC_LIFT_R) so they never z-fight with those
    // rings. Geometry+cones grouped so "Sun arcs" gates them together;
    // labels in their own group so "Sun arcs" AND "Labels" both gate them.
    sunArcGeomGroup = new THREE.Group(); sceneR.add(sunArcGeomGroup);
    sunArcLabelGroup = new THREE.Group(); sceneR.add(sunArcLabelGroup);
    raArcObj = makeFatLine(COLOR_INT.amber, 1.0, 4, ARC_N + 1, fatMatsR); sunArcGeomGroup.add(raArcObj.line);
    raCone = makeCone(COLOR_INT.amber, sunArcGeomGroup);
    decArcObj = makeFatLine(COLOR_INT.amber, 1.0, 4, ARC_N + 1, fatMatsR); sunArcGeomGroup.add(decArcObj.line);
    decCone = makeCone(COLOR_INT.amber, sunArcGeomGroup);
    lamArcObj = makeFatLine(COLOR_INT.coral, 1.0, 4, ARC_N + 1, fatMatsR); sunArcGeomGroup.add(lamArcObj.line);
    lamCone = makeCone(COLOR_INT.coral, sunArcGeomGroup);

    raLabel = registerLabel(makeTextSprite("α☉", COLOR_HEX.amber, { pixelHeight: 16, math: true }), labelsR); sunArcLabelGroup.add(raLabel);
    decLabel = registerLabel(makeTextSprite("δ☉", COLOR_HEX.amber, { pixelHeight: 16, math: true }), labelsR); sunArcLabelGroup.add(decLabel);
    lamLabel = registerLabel(makeTextSprite("λ☉", COLOR_HEX.coral, { pixelHeight: 16, math: true }), labelsR); sunArcLabelGroup.add(lamLabel);

    const hud = registerLabel(makeTextSprite("CELESTIAL SPHERE · FROM EARTH", COLOR_HEX.muted, { pixelHeight: 10 }), labelsR);
    camR.add(hud);
    return { hud: hud };
  }

  /* =======================================================================
     ZODIAC -- the twelve signs, 30 deg each, counted eastward from Aries
     (sign 0). LEFT: a ring just outside Earth's orbit with tick marks at
     the sign boundaries and a glyph+name sprite at each sign's center.
     RIGHT: tick marks along the ecliptic ring itself, glyph only at each
     center. Every glyph/name sprite is baked in WHITE, not its final muted/
     amber color -- SpriteMaterial multiplies its texture by material.color,
     so a white glyph on transparent tints cleanly to either accent without
     ever rebuilding the canvas texture, letting updateZodiacHighlight()
     below re-tint all 12 signs every setDate() call for free (no allocation,
     no texture work -- just a Color.set() + an opacity number per sprite).
     ======================================================================= */
  const ZODIAC_RING_L = 1.45, ZODIAC_TICK_IN_L = 1.40, ZODIAC_TICK_OUT_L = 1.50;
  const ZODIAC_GLYPH_R_L = 1.55, ZODIAC_NAME_R_L = 1.70;
  const ZODIAC_TICK_IN_R = 0.94, ZODIAC_TICK_OUT_R = 1.06, ZODIAC_GLYPH_R_R = 1.14;
  function makeZodiacTintSprite(text, pixelHeightPx) {
    const spr = makeTextSprite(text, "#ffffff", { pixelHeight: pixelHeightPx });
    spr.material.color.set(COLOR_HEX.muted);
    spr.material.opacity = 0.45;
    return spr;
  }
  function buildZodiacLeft() {
    zodiacGeomGroupL = new THREE.Group(); sceneL.add(zodiacGeomGroupL);
    zodiacLabelGroupL = new THREE.Group(); sceneL.add(zodiacLabelGroupL);
    thinLoop(ringPoints3(ECL_U, ECL_V, ZODIAC_RING_L, CIRCLE_N), COLOR_INT.muted, 0.1, zodiacGeomGroupL);
    for (let k = 0; k < 12; k++) {
      const p0 = eclipticPoint3(k * 30); // sign boundary
      thinSeg(
        { x: p0.x * ZODIAC_TICK_IN_L, y: 0, z: p0.z * ZODIAC_TICK_IN_L },
        { x: p0.x * ZODIAC_TICK_OUT_L, y: 0, z: p0.z * ZODIAC_TICK_OUT_L },
        COLOR_INT.muted, 0.25, zodiacGeomGroupL
      );
      const pc = eclipticPoint3(k * 30 + 15); // sign center
      const sign = ZODIAC_SIGNS[k];
      const glyph = registerLabel(makeZodiacTintSprite(sign.glyph, 12), labelsL);
      setLabelPos(glyph, pc.x * ZODIAC_GLYPH_R_L, 0, pc.z * ZODIAC_GLYPH_R_L);
      zodiacLabelGroupL.add(glyph);
      zodiacGlyphsL.push(glyph);
      const name = registerLabel(makeZodiacTintSprite(sign.name, 12), labelsL);
      setLabelPos(name, pc.x * ZODIAC_NAME_R_L, 0, pc.z * ZODIAC_NAME_R_L);
      zodiacLabelGroupL.add(name);
      zodiacNamesL.push(name);
    }
  }
  function buildZodiacRight() {
    zodiacGeomGroupR = new THREE.Group(); sceneR.add(zodiacGeomGroupR);
    zodiacLabelGroupR = new THREE.Group(); sceneR.add(zodiacLabelGroupR);
    for (let k = 0; k < 12; k++) {
      const p0 = eclipticPoint3(k * 30);
      thinSeg(
        { x: p0.x * ZODIAC_TICK_IN_R, y: 0, z: p0.z * ZODIAC_TICK_IN_R },
        { x: p0.x * ZODIAC_TICK_OUT_R, y: 0, z: p0.z * ZODIAC_TICK_OUT_R },
        COLOR_INT.muted, 0.3, zodiacGeomGroupR
      );
      const pc = eclipticPoint3(k * 30 + 15);
      const glyph = registerLabel(makeZodiacTintSprite(ZODIAC_SIGNS[k].glyph, 10), labelsR);
      setLabelPos(glyph, pc.x * ZODIAC_GLYPH_R_R, 0, pc.z * ZODIAC_GLYPH_R_R);
      zodiacLabelGroupR.add(glyph);
      zodiacGlyphsR.push(glyph);
    }
  }
  /* re-tints all 24(+12) zodiac sprites so the sign containing the Sun's
     current longitude reads amber/opaque and every other sign stays muted --
     called every setDate() (cheap: 12 iterations, no allocation) */
  function updateZodiacHighlight(lambdaDeg) {
    const signIdx = Math.floor(norm360(lambdaDeg) / 30) % 12;
    for (let k = 0; k < 12; k++) {
      const hi = k === signIdx;
      const colorHex = hi ? COLOR_HEX.amber : COLOR_HEX.muted;
      const op = hi ? 1.0 : 0.45;
      zodiacGlyphsL[k].material.color.set(colorHex); zodiacGlyphsL[k].material.opacity = op;
      zodiacNamesL[k].material.color.set(colorHex); zodiacNamesL[k].material.opacity = op;
      zodiacGlyphsR[k].material.color.set(colorHex); zodiacGlyphsR[k].material.opacity = op;
    }
  }

  const hudL = buildHelioScene().hud;
  const hudR = buildCelestialScene().hud;
  buildZodiacLeft();
  buildZodiacRight();

  /* =======================================================================
     setDate(): update the model + every dynamic THREE object's transform.
     Does not draw (call render() to see it) -- see the module header.
     ======================================================================= */
  const scratchP0 = { x: 0, y: 0, z: 0 }, scratchP1 = { x: 0, y: 0, z: 0 };
  let current = { day: 79, lambdaDeg: 0, raHours: 0, decDeg: 0, seasonN: "spring", seasonS: "autumn" };

  function setDate(dayOfYear) {
    const day = dayOfYear;
    const lambdaDeg = meanSunLongitudeDeg(day);
    const eq = sunEquatorialFromLambda(lambdaDeg);
    const seasons = seasonsForLambda(lambdaDeg);
    current = { day: day, lambdaDeg: lambdaDeg, raHours: eq.raHours, decDeg: eq.decDeg, seasonN: seasons.N, seasonS: seasons.S };

    // ---- left scene ----
    const eOrb = earthOrbitPos3(lambdaDeg);
    earthMain.group.position.set(eOrb.x, eOrb.y, eOrb.z);

    scratchP0.x = eOrb.x; scratchP0.y = eOrb.y; scratchP0.z = eOrb.z;
    scratchP1.x = eOrb.x + 0.55; scratchP1.y = eOrb.y; scratchP1.z = eOrb.z; // arrow tip: fixed world +X direction
    writePoint(arrowAriesObj.positions, 0, scratchP0);
    writePoint(arrowAriesObj.positions, 1, scratchP1);
    setFatLinePoints(arrowAriesObj, 2);
    orientConeAlongDelta(arrowAriesCone, scratchP1, scratchP0);
    setLabelPos(ariesLabel, scratchP1.x + 0.07, scratchP1.y, scratchP1.z);

    earthSunLineObj.geometry.attributes.position.setXYZ(0, eOrb.x, eOrb.y, eOrb.z);
    earthSunLineObj.geometry.attributes.position.setXYZ(1, 0, 0, 0);
    earthSunLineObj.geometry.attributes.position.needsUpdate = true;

    setLabelPos(ncpLabel, eOrb.x + N_HAT3.x * 0.18, eOrb.y + N_HAT3.y * 0.18 + 0.05, eOrb.z + N_HAT3.z * 0.18);

    // ---- right scene ----
    const sunDir = eclipticPoint3(lambdaDeg); // == Earth->Sun unit direction
    sunMarkerGroup.position.set(sunDir.x, sunDir.y, sunDir.z);

    const alphaDeg = eq.raHours * 15, decDeg = eq.decDeg;
    // RA and lambda always sweep 0 -> a non-negative target (raHours/lambdaDeg
    // are both normalized to [0,360)), so the plain positive-direction
    // analytic tangent is always the correct "forward" direction -- even in
    // the degenerate case where the target is exactly 0 (d=79: alphaDeg=0
    // and lambdaDeg=0 simultaneously) and the arc has zero length.
    for (let i = 0; i <= ARC_N; i++) writePoint(raArcObj.positions, i, liftedPoint(equatorPoint3((i / ARC_N) * alphaDeg, 0), ARC_LIFT_R));
    setFatLinePoints(raArcObj, ARC_N + 1);
    orientConeAlongTangent(raCone, liftedPoint(equatorPoint3(alphaDeg, 0), ARC_LIFT_R), equatorTangentAtEquator3(alphaDeg));

    for (let i = 0; i <= ARC_N; i++) writePoint(decArcObj.positions, i, liftedPoint(equatorPoint3(alphaDeg, (i / ARC_N) * decDeg), ARC_LIFT_R));
    setFatLinePoints(decArcObj, ARC_N + 1);
    // decDeg can be negative (sweep runs 0 -> negative), so the forward
    // direction is the analytic tangent times sign(decDeg); at decDeg exactly
    // 0 the arc has zero length AND no defined direction (an equinox
    // instant), so just hide the arrowhead rather than guess.
    decCone.visible = Math.abs(decDeg) > 1e-9;
    if (decCone.visible) {
      const mt = meridianTangent3(alphaDeg, decDeg);
      const sgn = Math.sign(decDeg);
      orientConeAlongTangent(decCone, liftedPoint(equatorPoint3(alphaDeg, decDeg), ARC_LIFT_R), { x: mt.x * sgn, y: mt.y * sgn, z: mt.z * sgn });
    }

    for (let i = 0; i <= ARC_N; i++) writePoint(lamArcObj.positions, i, liftedPoint(eclipticPoint3((i / ARC_N) * lambdaDeg), ARC_LIFT_R));
    setFatLinePoints(lamArcObj, ARC_N + 1);
    orientConeAlongTangent(lamCone, liftedPoint(eclipticPoint3(lambdaDeg), ARC_LIFT_R), eclipticTangent3(lambdaDeg));

    const raMid = equatorPoint3(alphaDeg * 0.55, 0);
    setLabelPos(raLabel, raMid.x * 1.08, raMid.y * 1.08 + 0.04, raMid.z * 1.08);
    const decMid = equatorPoint3(alphaDeg, decDeg * 0.55);
    setLabelPos(decLabel, decMid.x * 1.1, decMid.y * 1.1, decMid.z * 1.1);
    const lamMid = eclipticPoint3(lambdaDeg * 0.55);
    setLabelPos(lamLabel, lamMid.x * 1.1, lamMid.y * 1.1 - 0.04, lamMid.z * 1.1);

    updateZodiacHighlight(lambdaDeg);
  }

  function getState() {
    return {
      day: current.day, dateLabel: dayOfYearToLabel(current.day), lambdaDeg: current.lambdaDeg,
      raHours: current.raHours, decDeg: current.decDeg, seasonN: current.seasonN, seasonS: current.seasonS
    };
  }

  /* =======================================================================
     OPTIONS -- the Origin tab's Display card. Each option gates a GEOMETRY
     group (visible = the option alone) and, where that layer has text, a
     LABEL group nested under it (visible = the option AND "labels") --
     Object3D.visible=false hides an entire subtree, so nothing here needs
     per-child bookkeeping. decCone's own extra visibility condition
     (Math.abs(decDeg)>1e-9, set in setDate()) still applies underneath: it
     only matters when sunArcGeomGroup is already visible.
     Like setDate(), setOptions() only updates state/visibility -- it does
     NOT render (call render() to see it), and it never allocates. ---- */
  const options = { ghosts: true, zodiac: true, sunArcs: true, eqGrid: true, labels: true };
  function applyOptionsVisibility() {
    ghostGeomGroup.visible = options.ghosts;
    ghostLabelGroup.visible = options.ghosts && options.labels;
    labelsOnlyGroupL.visible = options.labels;
    zodiacGeomGroupL.visible = options.zodiac;
    zodiacLabelGroupL.visible = options.zodiac && options.labels;

    eqGridGroupR.visible = options.eqGrid;
    labelsOnlyGroupR.visible = options.labels;
    sunArcGeomGroup.visible = options.sunArcs;
    sunArcLabelGroup.visible = options.sunArcs && options.labels;
    zodiacGeomGroupR.visible = options.zodiac;
    zodiacLabelGroupR.visible = options.zodiac && options.labels;
  }
  function setOptions(opts) {
    Object.assign(options, opts || {});
    applyOptionsVisibility();
  }

  /* =======================================================================
     LAYOUT / RESIZE / RENDER
     ======================================================================= */
  let canvasW = 2, canvasH = 2, layout = "row";
  const rectL = { x: 0, y: 0, w: 1, h: 1 }, rectR = { x: 0, y: 0, w: 1, h: 1 };
  let visible = true;

  function positionHud(sprite, camera, heightPx, aspect) {
    if (!sprite || !heightPx) return;
    const fovRad = camera.fov * RAD;
    const k = 2 * Math.tan(fovRad / 2) / heightPx;
    const zDist = 1;
    const halfH = zDist * Math.tan(fovRad / 2);
    const halfW = halfH * aspect;
    const padWorld = 10 * zDist * k; // ~10 CSS px padding from the corner
    const halfSpriteW = sprite.scale.x / 2, halfSpriteH = sprite.scale.y / 2;
    sprite.position.set(-halfW + padWorld + halfSpriteW, halfH - padWorld - halfSpriteH, -zDist);
  }

  /* =======================================================================
     LABEL VIEWPORT CLAMP -- keeps every label sprite at least `marginPx`
     inside its viewport (spec: 28px), fixing labels ("ecliptic", NCP/SCP,
     etc.) that would otherwise get cut at the viewport edge. Reads each
     sprite's tracked "intended" position (userData.basePos, set via
     setLabelPos above) and nudges the RENDERED position toward the viewport
     center along the camera's own right/up axes just enough to clear the
     margin -- idempotent (always computed fresh off basePos, never off the
     previous frame's already-nudged position) and allocation-free (all
     scratch objects below are module-scope, reused every call). Called from
     render() every frame -- cheap (a few dozen sprites, no allocations) and
     correct regardless of how the camera got to its current orbit/zoom. */
  const _clampNdc = new THREE.Vector3();
  const _clampWorld = new THREE.Vector3();
  const _clampRight = new THREE.Vector3(), _clampUp = new THREE.Vector3(), _clampFwd = new THREE.Vector3();
  function clampLabelToViewport(sprite, camera, viewportW, viewportH, marginPx) {
    const base = sprite.userData.basePos;
    if (!base) return; // untracked (e.g. the camera-pinned HUD) -- leave as positioned
    _clampWorld.set(base.x, base.y, base.z);
    _clampNdc.copy(_clampWorld).project(camera);
    const sx = (_clampNdc.x * 0.5 + 0.5) * viewportW;
    const sy = (1 - (_clampNdc.y * 0.5 + 0.5)) * viewportH;
    let dx = 0, dy = 0;
    if (sx < marginPx) dx = marginPx - sx;
    else if (sx > viewportW - marginPx) dx = (viewportW - marginPx) - sx;
    if (sy < marginPx) dy = marginPx - sy;
    else if (sy > viewportH - marginPx) dy = (viewportH - marginPx) - sy;
    if (dx === 0 && dy === 0) { sprite.position.set(base.x, base.y, base.z); return; }
    const dist = camera.position.distanceTo(_clampWorld);
    const k = 2 * Math.tan((camera.fov / 2) * RAD) * dist / Math.max(1, viewportH); // world units / CSS px at this depth
    camera.matrixWorld.extractBasis(_clampRight, _clampUp, _clampFwd);
    sprite.position.set(
      base.x + _clampRight.x * dx * k - _clampUp.x * dy * k,
      base.y + _clampRight.y * dx * k - _clampUp.y * dy * k,
      base.z + _clampRight.z * dx * k - _clampUp.z * dy * k
    );
  }
  const LABEL_EDGE_MARGIN_PX = 28;
  function clampAllLabels() {
    labelsL.forEach(function (s) { clampLabelToViewport(s, camL, rectL.w, rectL.h, LABEL_EDGE_MARGIN_PX); });
    labelsR.forEach(function (s) { clampLabelToViewport(s, camR, rectR.w, rectR.h, LABEL_EDGE_MARGIN_PX); });
  }

  function resize(cssW, cssH) {
    canvasW = Math.max(2, Math.round(cssW));
    canvasH = Math.max(2, Math.round(cssH));
    layout = (canvasW / canvasH) >= 1.1 ? "row" : "col";
    if (layout === "row") {
      const halfW = Math.floor(canvasW / 2);
      rectL.x = 0; rectL.y = 0; rectL.w = halfW; rectL.h = canvasH;
      rectR.x = halfW; rectR.y = 0; rectR.w = canvasW - halfW; rectR.h = canvasH;
    } else {
      const halfH = Math.floor(canvasH / 2);
      // GL viewport y=0 is the BOTTOM of the canvas; put the helio (left/primary)
      // view visually on TOP, i.e. at the higher GL y-range.
      rectL.x = 0; rectL.y = canvasH - halfH; rectL.w = canvasW; rectL.h = halfH;
      rectR.x = 0; rectR.y = 0; rectR.w = canvasW; rectR.h = canvasH - halfH;
    }
    renderer.setSize(canvasW, canvasH, false);
    camL.aspect = rectL.w / Math.max(1, rectL.h); camL.updateProjectionMatrix();
    camR.aspect = rectR.w / Math.max(1, rectR.h); camR.updateProjectionMatrix();
    // re-fit each camera's default distance to the new aspect (only while the
    // user hasn't manually dragged/zoomed that viewport -- see isDefault)
    if (camState.L.isDefault) { camState.L.radius = computeDefaultRadius(camL.aspect, camL.fov, CONTENT_RADIUS_L, CAM_L_DEFAULT.radius); applyCam(camL, camState.L); }
    if (camState.R.isDefault) { camState.R.radius = computeDefaultRadius(camR.aspect, camR.fov, CONTENT_RADIUS_R, CAM_R_DEFAULT.radius); applyCam(camR, camState.R); }
    fatMatsL.forEach(function (m) { m.resolution.set(rectL.w, rectL.h); });
    fatMatsR.forEach(function (m) { m.resolution.set(rectR.w, rectR.h); });
    labelsL.forEach(function (s) { applySpriteScale(s, camL, rectL.h); });
    labelsR.forEach(function (s) { applySpriteScale(s, camR, rectR.h); });
    positionHud(hudL, camL, rectL.h, camL.aspect);
    positionHud(hudR, camR, rectR.h, camR.aspect);
    render();
  }

  function render() {
    if (!visible || !renderer) return;
    clampAllLabels();
    renderer.setScissorTest(true);
    renderer.setViewport(rectL.x, rectL.y, rectL.w, rectL.h);
    renderer.setScissor(rectL.x, rectL.y, rectL.w, rectL.h);
    renderer.render(sceneL, camL);
    renderer.setViewport(rectR.x, rectR.y, rectR.w, rectR.h);
    renderer.setScissor(rectR.x, rectR.y, rectR.w, rectR.h);
    renderer.render(sceneR, camR);
  }

  function resetView() {
    camState.L.theta = CAM_L_DEFAULT.theta; camState.L.phi = CAM_L_DEFAULT.phi;
    camState.L.radius = computeDefaultRadius(camL.aspect, camL.fov, CONTENT_RADIUS_L, CAM_L_DEFAULT.radius);
    camState.L.isDefault = true;
    camState.R.theta = CAM_R_DEFAULT.theta; camState.R.phi = CAM_R_DEFAULT.phi;
    camState.R.radius = computeDefaultRadius(camR.aspect, camR.fov, CONTENT_RADIUS_R, CAM_R_DEFAULT.radius);
    camState.R.isDefault = true;
    applyCam(camL, camState.L);
    applyCam(camR, camState.R);
    render();
  }
  applyCam(camL, camState.L);
  applyCam(camR, camState.R);

  /* =======================================================================
     POINTER (drag-rotate / wheel-zoom), scoped to whichever viewport half
     the interaction started (drag) or is currently over (wheel).
     ======================================================================= */
  let pointerEl = null, dragging = false, dragTarget = null, lastX = 0, lastY = 0;
  function pickViewport(clientX, clientY, rect) {
    const lx = clientX - rect.left, ly = clientY - rect.top;
    if (layout === "row") return lx < rect.width / 2 ? "L" : "R";
    return ly < rect.height / 2 ? "L" : "R";
  }
  function onPointerDown(ev) {
    const rect = pointerEl.getBoundingClientRect();
    dragTarget = pickViewport(ev.clientX, ev.clientY, rect);
    dragging = true; lastX = ev.clientX; lastY = ev.clientY;
    try { pointerEl.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
  }
  function onPointerMove(ev) {
    if (!dragging) return;
    const dx = ev.clientX - lastX, dy = ev.clientY - lastY;
    lastX = ev.clientX; lastY = ev.clientY;
    const cs = dragTarget === "L" ? camState.L : camState.R;
    cs.isDefault = false; // manual interaction -- stop auto-refitting the radius on resize
    cs.theta -= dx * 0.006;
    cs.phi = clamp(cs.phi + dy * 0.006, -10 * RAD, 85 * RAD);
    applyCam(dragTarget === "L" ? camL : camR, cs);
    render();
  }
  function onPointerUp() { dragging = false; dragTarget = null; }
  function onWheel(ev) {
    ev.preventDefault();
    const rect = pointerEl.getBoundingClientRect();
    const vp = pickViewport(ev.clientX, ev.clientY, rect);
    const cs = vp === "L" ? camState.L : camState.R;
    cs.isDefault = false;
    cs.radius = clamp(cs.radius * Math.pow(1.0016, ev.deltaY), ZOOM_MIN, ZOOM_MAX);
    applyCam(vp === "L" ? camL : camR, cs);
    render();
  }
  function attachPointer(el) {
    detachPointer();
    pointerEl = el;
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });
  }
  function detachPointer() {
    if (!pointerEl) return;
    pointerEl.removeEventListener("pointerdown", onPointerDown);
    pointerEl.removeEventListener("pointermove", onPointerMove);
    pointerEl.removeEventListener("pointerup", onPointerUp);
    pointerEl.removeEventListener("pointercancel", onPointerUp);
    pointerEl.removeEventListener("wheel", onWheel);
    pointerEl = null;
    dragging = false; dragTarget = null;
  }

  function setVisible(v) { visible = !!v; }

  function dispose() {
    detachPointer();
    disposables.forEach(function (d) { try { d.dispose(); } catch (e) { /* ignore */ } });
    disposables.length = 0;
  }

  setDate(current.day);
  applyOptionsVisibility(); // seed the default (all-on) visibility state

  return {
    setDate: setDate, getState: getState, setOptions: setOptions, resize: resize, render: render,
    attachPointer: attachPointer, detachPointer: detachPointer, resetView: resetView,
    setVisible: setVisible, dispose: dispose
  };
}
