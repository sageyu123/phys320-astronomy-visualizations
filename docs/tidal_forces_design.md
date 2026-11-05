# Design spec: "Tidal Forces" page (Lecture 12, Tidal Effects)

This spec is written so the implementer can build the page without re-deriving physics or making design calls. Where a choice is arbitrary it is stated as a decision, not an option.

---

## 0. Summary

| Item | Value |
|---|---|
| Page file | `html/tidal_forces.html` (single self-contained page, inline CSS + one `<script type="module">`) |
| Model file | `html/tidal_forces_model.js` (pure ES module, no DOM; all physics lives here) |
| Test file | `tests/tidal_forces_model.test.cjs` (`node:test`, same pattern as `tests/spherical_shell_model.test.cjs`) |
| `<title>` | `Tidal Forces — PHYS 320` |
| Brand title / sub | `TIDAL FORCES` / `‹ PHYS 320 Visualizations · Tidal Effects` |
| Tabs (`data-tab` → label) | `stretch` → **Stretch**, `tides` → **Sun & Moon**, `friction` → **Friction**, `spiral` → **Spiral out**, `roche` → **Roche limit** |
| Default tab | `stretch` |
| URL params | `?tab=<name>`, `?embed=1`, `?t=<number>` (tab-specific, see §7) |
| Hook | `window.__tidal` (see §8) |
| Thumbnail | `assets/thumbs/tidal_forces.jpg` from `?tab=stretch&embed=1` |

Five tabs follow the lecture's arc exactly: (1) differential gravity and the football shape, (2) Sun vs Moon, spring/neap, (3) tidal friction, torque, locking, (4) long-term Earth–Moon evolution by angular-momentum conservation, (5) Roche limit with the Saturn example.

The page's rendering loads the model with `import { ... } from './tidal_forces_model.js'` (as `html/spherical_shell.html` does), so it needs an HTTP server; the README already says so.

---

## 1. Page skeleton (copy from `html/planet_building.html`)

Reuse verbatim from `planet_building.html`: the `:root` tokens, `#app` grid (44 px topbar + body), `.topbar/.brand/.tabbar/.segmented`, `.body` with `--rail-w` (300 px) and a `.v-splitter`, `.rail` of `.card`s with `.eyebrow`, `.workspace` grid of `#mainPanel` / `#hSplitter` / `#subPanel` / `#stripPanel`, `.panel-header` with `.panel-title` and `.panel-readouts` (`.rd-item` / `<b>`), `.panel-caption`, `.strip` with `#stripBody`, the `.field/.field-label/.field-row/.num-input/.chip/.metrics/.small/.notice` controls CSS, the `@media(max-width:900px)` and `520px` stacks, and the `body.embed` rules (hide topbar, splitters, rail, sub panel, strip; main panel fills the viewport). Copy the `splitter()` function, `canvasSize()`, `renderMath()/renderInline()/renderDisplay()`, and the KaTeX include lines (`../vendor/katex/katex.min.css`, `../vendor/katex/katex.min.js`, non-deferred as in planet_building).

Workspace rows: `grid-template-rows: minmax(0,1.5fr) 6px minmax(0,1fr) var(--strip-h,150px)` on every tab (no per-tab row overrides are needed). Strip body uses the planet_building 4-column grid (`#stripBody{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}` plus the full-width `<p>` note). Each tab has exactly 4 formula lines plus one note `<p>`, so the grid is always full.

Rail cards in order (ids): `howto` ("How to use", numbered steps), `controlsCard` (eyebrow text set per tab, `#controls` innerHTML rebuilt on tab change, as planet_building does), `metrics` ("Readouts", `.metrics` rows), `notice` ("What to notice"), `about` ("About this model"). Texts per tab are given in each tab section below.

Canvas color constants (mirror the tokens; use these names in code):
`C={amber:'#ffcc66',cyan:'#56c7d9',magenta:'#ee65be',purple:'#a99bff',coral:'#ff7f66',green:'#56dc72',muted:'#979ea6',text:'#e7e9eb',grid:'rgba(151,158,166,.20)',bg:'#0d1015',earth:'#2f4e63',ocean:'rgba(86,199,217,.38)',moon:'#b9bec4'}`.

Role assignment, used consistently on every tab:
- **amber** = the other / forcing body (Sun, or the planet in the Roche tab) and anything "sunward".
- **cyan** = gravitational force arrows measured relative to the attracting body; ocean/bulge fill; Earth spin arrow.
- **coral** = tidal (residual) stretch, tidal acceleration, disruption debris.
- **magenta** = the subtracted centre vector, torque arrows, "current value" markers on charts, the Roche limit.
- **green** = self-gravity, orbital velocity arrow, "Moon gains L".
- **purple** = secondary chart curves (a(t), rigid-limit line).
- **muted** = grid, orbits, dashed reference lines, labels.

All canvas text: `10px Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` for labels, `bold 12px` for in-canvas titles, as in planet_building. Use `drawCanvasMathLabel` from planet_building for subscripts (`R_{\oplus}`-style brace syntax). Arrowheads: 7 px, filled, same color as the shaft, shaft width 1.6 px (2.2 px for the "highlighted" arrow).

Rendering is `paint()` on every state change, driven by `requestAnimationFrame` only while an animation is playing (`playing=true`), exactly like planet_building's `loop()`.

---

## 2. Physics model: `html/tidal_forces_model.js`

Pure functions, SI units unless stated, no DOM. Export everything listed. Inputs that are "dimensionless" are flagged.

### 2.1 Constants (export `const K = {...}`)

```
G        = 6.674e-11       // m^3 kg^-1 s^-2
M_SUN    = 1.989e30        // kg
M_EARTH  = 5.972e24
M_MOON   = 7.346e22
R_EARTH  = 6.371e6         // m
R_MOON   = 1.737e6
D_MOON   = 3.844e8         // m, mean Earth–Moon distance
D_SUN    = 1.496e11        // m, 1 AU
SIDEREAL_DAY = 86164.1     // s
SOLAR_DAY    = 86400       // s
SYNODIC_MONTH = 29.53 * 86400   // s
I_EARTH  = 0.3307 * M_EARTH * R_EARTH**2   // = 8.016e37 kg m^2
YEAR     = 365.25 * 86400
F_ROCHE  = 2.456           // Roche's fluid coefficient (slide 10)
F_RIGID  = Math.cbrt(2)    // 1.2599, the rigid two-point estimate
PDOT_PER_CENTURY = 2.3e-3  // s per century, lengthening of the day (slide 9)
SATURN   = { Rp: 6.0e7, rhoP: 690, ringInner: 8.0e7, ringOuter: 1.36e8, ringMass: 1e16, name:'Saturn' }
RHO_ICE  = 1200
```

Lecture rounding: slide 5 uses M☉=2e30, M☾=7.36e22, d☾=3.84e5 km, d☉=1.5e8 km and gets 5/11 = 0.4545. With the constants above the ratio is 0.4593. The page always *computes* with the constants above and *labels* "≈ 5/11"; the acceptance band is 0.44–0.47.

### 2.2 Differential gravity (Tab 1)

- `tidalBracketExact(x)` = `(1+x)**-2 - (1-x)**-2`, x = R/d (dimensionless, 0 ≤ x < 1). Exact.
- `tidalBracketApprox(x)` = `-4*x`. First order (binomial, n = −2). The next term is −8x³, so the relative error of the approximation is `2x²` to leading order (`relErr(x) = (exact − approx)/approx ≈ 2x²`).
- `deltaForcePerMass(M, R, d)` = `G*M/d**2 * tidalBracketExact(R/d)` (m s⁻², negative: far side pulled less). `deltaForcePerMassApprox(M,R,d)` = `-4*G*M*R/d**3`.
- `tidalAccelAcross(M, R, d)` = `2*G*M*R/d**3`: the stretch from centre to surface (half of |ΔF|/m across the diameter). Used in Tabs 3 and 5.
- `forceField(points, D)`: `points` = array of `[x,y]` in units of the body radius (body centred at origin), `D` = d/R (dimensionless). Primary at `(D,0)`. For each point returns `{p, abs:[ax,ay], res:[rx,ry]}` with `abs = (P − p)/|P − p|³` in units of `GM/R²` and `res = abs − abs(origin)` where `abs(origin) = [1/D², 0]`. Exact (no expansion).
- `samplePoints()` returns the fixed 13-point set: the 5×5 grid with spacing 0.5 R clipped to `|p| ≤ 1`: `(0,0), (±.5,0), (0,±.5), (±.5,±.5), (±1,0), (0,±1)`.
- `tidalAccelLinear(p, D)` = `[2*p[0], -p[1]] / D³` (units GM/R²): the first-order residual field. Used only for the strip's 4th line and a test; the drawing uses the exact `res`.

### 2.3 Sun and Moon (Tab 2)

- `sunMoonRatio(Ms=M_SUN, Mm=M_MOON, ds=D_SUN, dm=D_MOON)` = `(Ms/Mm) * (dm/ds)**3` → 0.459.
- `equilibriumTideHeight(M, d, Mb=M_EARTH, R=R_EARTH)` = `(M/Mb) * (R/d)**3 * R` metres: the P₂ amplitude H of the equilibrium ocean tide, ζ(ψ) = H·P₂(cos ψ), P₂(c) = (3c²−1)/2 (no Love numbers, no self-gravity of the bulge). Moon: H☾ = 0.357 m; Sun: H☉ = 0.164 m. Peak-to-trough range = 1.5 H.
- `tideHeightAt(phi, thetaM, thetaS, Hm, Hs)` = `Hm*P2(cos(phi-thetaM)) + Hs*P2(cos(phi-thetaS))` (metres; all angles in radians, observer on the equator, both bodies in the equatorial plane).
- `tideEnvelope(thetaM, thetaS, Hm, Hs)` → `{mean:(Hm+Hs)/4, amp: 0.75*Math.sqrt(Hm*Hm+Hs*Hs+2*Hm*Hs*Math.cos(2*(thetaM-thetaS)))}`. The oscillating part of `tideHeightAt` lies within mean ± amp. Spring range = 2·amp at Δθ = 0 = 1.5(H☾+H☉) = 0.781 m; neap = 1.5(H☾−H☉) = 0.289 m.
- `tideFrame(tHours, thetaM0, obsLon0)` → `{phi: obsLon0 + 2π·t/24, thetaM: thetaM0 + 2π·t/(29.53·24), thetaS: 0}`. Frame: Sun direction fixed at +x, Earth turns once per **solar** day, Moon advances at the **synodic** rate. Counter-clockwise positive (view from above the north pole).
- `lunarHighTideInterval()` = `0.5 / (1/24 - 1/(29.53*24))` hours = 12.42 h ("12 h 25 min").
- `phaseName(thetaM)` for the label: 0°±22.5 → "new Moon", 90° → "first quarter", 180° → "full Moon", 270° → "third quarter", in between "waxing crescent / waxing gibbous / waning gibbous / waning crescent".

### 2.4 Friction and locking (Tab 3)

- `bulgeForces(D, delta, eps=0)`: two point bulges at `±(1+eps)·(cos δ, sin δ)` (units of R), primary at `(D, 0)`, unit `GM_primary·m_bulge/R²`. Returns `{near:{p,f,ft}, far:{p,f,ft}, torque}` where `f` is the exact inverse-square force vector on each bulge, `ft` its tangential (azimuthal, counter-clockwise-positive) component, and `torque = Σ (x·fy − y·fx)`. Sign convention: δ > 0 means the bulge axis leads the Earth–primary line in the spin direction; then `torque < 0` (opposes the spin).
- `bulgeTorqueFirstOrder(D, delta)` = `-3*Math.sin(2*delta)/D**3` (same units). Verified: D = 60.3, δ = 3° → exact −1.4315e-6 vs first-order −1.4302e-6.
- `stretchRatioEarthOnMoon()` = `(M_EARTH*R_MOON)/(M_MOON*R_EARTH)` → 22.2 ("≈ 20" in the lecture). Also expose `tidalAccelAcross(M_EARTH, R_MOON, D_MOON)` = 2.44e-5 m s⁻² and `tidalAccelAcross(M_MOON, R_EARTH, D_MOON)` = 1.10e-6 m s⁻².

### 2.5 Earth–Moon evolution (Tab 4): analytic constant-rate model

State the model honestly in the About card (text in §3.4). Definitions:

```
Mt  = M_EARTH + M_MOON
mu  = M_EARTH*M_MOON/Mt
omega0 = 2π / SIDEREAL_DAY                     // 7.2921e-5 s^-1
a0  = D_MOON
Lspin(omega) = I_EARTH * omega                 // today 5.846e33 kg m^2 s^-1
Lorb(a)      = mu * sqrt(G*Mt*a)               // today 2.858e34
Ltot         = Lspin(omega0) + Lorb(a0)        // 3.442e34, conserved
n(a)   = sqrt(G*Mt/a^3)                        // mean motion
vorb(a) = sqrt(G*Mt/a)                         // today 1025 m/s
omegaOfA(a) = (Ltot - Lorb(a)) / I_EARTH       // conservation: spin left over once the orbit has taken its share
```

Torque calibration from the lecture number (day lengthens 2.3 ms per century). Since ω = 2π/P, dω/dt = −ω·(dP/dt)/P:
```
dPdt       = PDOT_PER_CENTURY / (100*YEAR)            // 7.29e-13 (seconds of day length per second)
dOmegaDt0  = -omega0 * dPdt / SIDEREAL_DAY            // -6.17e-22 s^-2
torque0    = I_EARTH * dOmegaDt0                       // -4.94e16 N m (on Earth's spin)
dadt0      = -torque0 / (0.5 * mu * sqrt(G*Mt/a0))    // dL_orb/da = (mu/2)·sqrt(G Mt / a)
           = 1.330e-9 m/s = 4.20 cm/yr
```
Lunar laser ranging measures 3.8 cm/yr; the readout says so next to the model's 4.2.

Rate law (constant lag/constant-Q scaling, torque ∝ a⁻⁶ ⇒ da/dt ∝ a⁻¹¹ᐟ²):
```
dadt(a) = dadt0 * (a0/a)**5.5
aOfT(t) = (a0**6.5 + 6.5*dadt0*a0**5.5*t)**(2/13)      // t in seconds from today, exact solution of the rate law
tOfA(a) = (a**6.5 - a0**6.5) / (6.5*dadt0*a0**5.5)
```
Lock: solve `omegaOfA(a) = n(a)` by bisection on `[a0, 10 a0]` → `aLock = 86.92 R⊕ = 553,700 km`, `P_lock = 2π/n(aLock) = 47.18 days`, `tLock = tOfA(aLock) = 13.70 Gyr`. Export `lockState()` → `{a, P, t}`. The page clamps t to `[-1.0 Gyr, tLock]`; past tLock the model is frozen at the lock state (the torque would reverse sign but the lecture's end state is "stops evolving").

`evolve(tSeconds)` → `{t, a, omega, n, day: 2π/omega, month: 2π/n, v: vorb(a), Lspin, Lorb, Ltot, fracSpin: Lspin/Ltot, fracOrb: Lorb/Ltot, locked: a >= aLock - 1 m}`.

Reference values (for tests and readouts): t = 0 → a = 60.34 R⊕, day 23.93 h, month 27.3 d, v = 1025 m/s, spin 17.0 %, orbit 83.0 %. t = +1 Gyr → a 65.5 R⊕, day 30.1 h. t = +5 Gyr → a 76.2 R⊕, day 60.5 h. t = −1 Gyr → a 49.9 R⊕, day 16.6 h. In this constant-rate model a → 0 at t = −1.41 Gyr; that is the well-known "time-scale problem" (today's ocean dissipation is unusually strong), which the About card states; the slider therefore stops at −1.0 Gyr and the past is labelled "extrapolation".

Ignored (say so in About): the Sun's tide on Earth, solar-orbit angular momentum, the Moon's own spin L (locked, negligible), obliquity, and the Moon's past orbital eccentricity.

### 2.6 Roche limit (Tab 5)

- `primaryMass(rhoP, Rp)` = `(4/3)π ρp Rp³` (the tab derives M_p from the preset density and radius so the limit formula and the acceleration chart agree exactly; for Saturn's rounded 690 kg m⁻³ and 60,000 km this gives 6.24e26 kg vs the true 5.68e26, acceptable and noted nowhere in the UI).
- `satelliteMass(rhoM, Rm)` = `(4/3)π ρm Rm³`.
- `selfGravity(rhoM, Rm)` = `G*satelliteMass/Rm²` = `(4/3)π G ρm Rm`.
- `tidalAtSatellite(rhoP, Rp, Rm, r)` = `2*G*primaryMass*Rm/r³`.
- `rocheRadius(rhoP, rhoM, Rp, f=F_ROCHE)` = `f*(rhoP/rhoM)**(1/3)*Rp`. Saturn/ice: 2.042 R_p = 122,537 m·10³ ⇒ display "2.04 R_p ≈ 122,500 km". `rigidRadius = rocheRadius(..., F_RIGID)` = 1.048 R_p = 62,900 km.
- `radiusFromMass(mass, rho)` = `(3*mass/(4π rho))**(1/3)`. 1e16 kg at 1200 → 12.6 km ("≈ 13 km").
- `disruptionState(r, rRoche, rRigid)` → `'intact'` if r > 1.25·rRoche, `'stretched'` if rRoche < r ≤ 1.25·rRoche, `'disrupted'` if r ≤ rRoche. (The 1.25 is a display threshold only.)
- Display-only shape helper `elongation(r, rRoche)` = `clamp((rRoche/r)**3, 0, 1)` → draw the satellite as an ellipse with semi-axes `R(1+0.6e)` radial and `R(1−0.3e)` transverse. Exaggerated; labelled so.

Coefficient decision: **f_R = 2.456 everywhere** (strip, readouts, dashed circle). The About card says: "Slide 11 rounds Roche's coefficient to 2.44, which gives 2.03 R_p; 2.456 gives 2.04 R_p — both ≈ 122,000 km. The crude estimate in the inequality (a rigid body, two points a distance R_m apart) gives 2^{1/3} ≈ 1.26; Roche's 2.456 is for a fluid body that stretches as it approaches, so its ends reach further into the gradient and it breaks up almost twice as far out." The rigid circle is drawn as a fainter dashed line so students see both.

---

## 3. Tabs

Common interactions: the main canvas gets `pointerdown/move/up` handlers; drag targets are listed per tab. All sliders mirror a `.num-input` where a number is useful (planet_building `[data-p]` pattern). Every control change calls `paint()` and `renderMath()`.

### 3.1 Tab `stretch` — "Stretch"

**Teaching point.** Gravity is unequal across a finite body. Subtract the centre's pull and what is left stretches the body along the line to the other body (mass M) and squeezes it across: a football. ΔF ≈ −4GMmR/d³ comes from the binomial expansion and is a first-order result.

**Main panel** — title `Differential gravity across a body`; caption `Left: the pull of M at every point · Right: the same arrows minus the centre's arrow · residual arrows magnified`. The canvas is split into two equal halves by a 1 px `C.grid` vertical line. In each half the body is a disc of radius `Rpx = 0.26·min(halfWidth, height)` centred at `(halfWidth/2, height/2)`, fill `C.earth`, stroke `C.muted`. In-canvas titles (bold 12 px, `C.text`, top-left of each half): `Forces toward M` and `Minus the centre's force`.

Left half: at each of the 13 `samplePoints()` draw a dot (2.5 px, `C.text`) and a **cyan** arrow for `abs`, length `kAbs·|abs|` with `kAbs` chosen so the centre arrow is `0.55·Rpx`. The centre arrow is **magenta**, 2.2 px, labelled `F_centre`. The other body: if `D ≤ 3`, draw an **amber** disc of radius `0.35·Rpx` at `(cx + D·Rpx, cy)`; otherwise draw an amber half-disc glow clipped at the right edge of the half, with an amber axis line from the body to the edge and the label `→ M, d = {D} R` (D formatted: ≤ 100 one decimal; otherwise integer with thousands separator). Arrows always point at the true location `(D·Rpx, 0)`.

Right half: same dots; **coral** arrows for `res`, length `kRes·|res|` with `kRes` chosen so the largest residual (the near point, (1,0)) is `0.55·Rpx`. A ghost of the subtracted centre vector (magenta, 40 % alpha, dashed) drawn at the centre pointing to M, labelled `− F_centre`. The football: a dashed **muted** ellipse, semi-axes `Rpx·1.16` along x and `Rpx·0.92` along y, label `equilibrium shape (exaggerated)` under the body. Magnification label (top-right of the half, `C.coral`): `residual arrows × {Math.round(kRes/kAbs)}` (= (D−1)²/(2D−1) ≈ D/2 − 3/4: ×4 at D = 10, ×29 at D = 60.3, ×11,740 at D = 23,482).

Text at the bottom of the right half (`C.muted`): `stretch along the line: +2 · squeeze across: −1 (per unit of GMmR/d³)`.

**Drag.** Horizontal drag anywhere on the left half changes D: `D = D_start · 100^(Δx/halfWidth)`, clamped to [2.5, 30000]; rail slider mirrors (log). Cursor `ew-resize`.

**Controls** (eyebrow `Geometry`):
- `Distance d / R` log slider, range 2.5–30,000 (slider value = log10 D, min .398, max 4.477, step .005), default **10**; `.num-input` shows D.
- Chips (presets set D and the physical pair): `Teaching · d = 10 R` (pair Moon→Earth), `Moon → Earth · 60.3 R⊕`, `Sun → Earth · 23,482 R⊕`, `Earth → Moon · 221 R☾` (D = D_MOON/R_MOON = 221.3). The pair fixes M and R for the SI readouts; the slider may then move d away from the real value (readouts label it "at this d").
- Toggle `Show interior points` (default on; off → only the 8 rim points + centre).

**Readouts** (`.metrics`): `d / R` · `exact [(1+R/d)⁻² − (1−R/d)⁻²]` (6 sig figs) · `first order −4R/d` · `relative error ≈ 2(R/d)²` (as %) · `ΔF/m across the diameter at this d` (m s⁻², 3 sig figs, from `deltaForcePerMass`) · `ΔF/m at the real distance` (same for the pair's true d) · `ocean bulge (equilibrium) at the real distance` = `1.5·equilibriumTideHeight` in metres for Moon→Earth (0.54 m) / Sun→Earth (0.25 m), or `—` for Earth→Moon.

Header readouts (`#headRead`): `d/R = {D}` · `exact/first-order = {ratio to 4 decimals}`.

**Sub panel** — title `Exact versus first order`; header readouts `error at this d = {2x² as %}`. Log–log chart: x = d/R from 2.5 to 30,000 (4 decades, ticks 3, 10, 30, 100, 300, 1 000, 3 000, 10 000), y = |bracket| from 1e-5 to 2 (ticks decades). Curves: exact `|tidalBracketExact(1/D)|` **cyan** solid; `4/D` **coral** dashed. Vertical **magenta** line + dot at the current D with a label `d/R = …`. Small **muted** ticks with labels at D = 60.3 (`Moon`), 221 (`Earth→Moon`) and 23,482 (`Sun`). Axis labels `d / R` and `|ΔF| / (GMm/d²)`. Note bottom-left: `the two curves merge for d ≳ 10 R`.

**Strip** (4 lines, then the note):
1. `F_1=\frac{GMm}{(d-R)^2},\qquad F_2=\frac{GMm}{(d+R)^2}` — sub: `\text{near side pulled harder than far side}`
2. `\Delta F=F_2-F_1=\frac{GMm}{d^2}\left[\left(1+\tfrac{R}{d}\right)^{-2}-\left(1-\tfrac{R}{d}\right)^{-2}\right]` — sub: `[\ldots]={exact}` at the current D
3. `(1+x)^{n}\approx1+nx\;\Rightarrow\;\Delta F\approx-\frac{4GMmR}{d^{3}}` — sub: `-4R/d={value},\ \text{error}\approx2(R/d)^2={pct}\%`
4. `\vec a_{\rm tidal}\approx\frac{GM}{d^{3}}\,(2x,\,-y,\,-z)` — sub: `\text{stretch }+2\text{ along the line, squeeze }-1\text{ across}`
Note `<p>`: `The minus sign says the far side is pulled less. Subtracting the centre's pull leaves a field that stretches the body along the line to the other body (mass M) and squeezes it across: a football. On Earth the result is a bulge of about half a metre; the ellipse and the residual arrows here are magnified.`

**Rail text.** How to use: `1. Drag left–right on the left view (or use the slider) to move the other body (mass M).<br>2. Compare the two halves: equal-looking arrows on the left become a stretch-and-squeeze pattern on the right.<br>3. Watch the lower chart: the first-order formula is excellent once d ≳ 10 R.` What to notice: `All thirteen arrows point at the other body (mass M) and differ only slightly; the difference is the tide. The residual field is ×2 outward along the line and ×1 inward across it, so the shape is a football, not a teardrop.` About: `The other body (mass M) is a point mass; exact inverse-square forces at thirteen points of a rigid sphere, residual = force minus the force at the centre. The ellipse is a fixed 1.16 : 0.92 illustration, not the computed equilibrium shape; the real equilibrium ocean tide on Earth is 0.54 m peak-to-trough for the Moon and 0.25 m for the Sun (equilibrium theory, no Love numbers). Residual arrows are rescaled so the largest is always visible; the magnification is printed on the view.`

### 3.2 Tab `tides` — "Sun & Moon"

**Teaching point.** ΔF☉/ΔF☾ = (M☉/M☾)(d☾/d☉)³ ≈ 5/11: the Moon dominates by about 2×. Two bulges ⇒ high tide every 12 h 25 min. Aligned bulges give spring tides at new and full Moon; crossed bulges give neap tides at the quarters.

**Main panel** — title `Two bulges: Moon and Sun`; caption `View from above the north pole · Sun to the right · bulges exaggerated ≈ 1.8 million times · Moon orbit not to scale`. Earth centred, `Rpx = 0.22·min(w,h)`. Draw order:
1. Moon orbit: **muted** dashed circle, radius `0.40·min(w,h)`.
2. Sun indicator: amber radial-gradient half-disc clipped at the right panel edge, centred at `(w, h/2)`, radius `0.18·h`; label `to the Sun` in amber. Amber faint axis line through Earth along x (the solar bulge axis). A **cyan** faint axis line through Earth along the Moon direction θ_m.
3. Ocean: filled polygon of 360 vertices, `r(φ) = Rpx·(1 + 0.10·ζ(φ)/H☾)` with `ζ = tideHeightAt(φ, θm, 0, H☾, H☉·sunOn)`, fill `C.ocean`, stroke cyan 1 px. (So the Moon bulge alone is 10 % of R: that is ×1.78 million; the caption rounds to 1.8 million.)
4. Solid Earth: disc radius `Rpx·0.985`, fill `C.earth`; a short meridian tick and a **magenta** observer dot on the rim at `φ_obs`, labelled `observer`.
5. Labels `high tide` (cyan) at the two tips of the combined bulge (the φ that maximise r), `low tide` (muted) at the two minima.
6. Moon: disc radius `0.27·Rpx` at angle θ_m on the orbit circle, lit half toward +x (draw the disc in `#30343a`, then the lit half-ellipse in `C.moon` facing the Sun: the terminator is a straight vertical line in the Moon's frame since the Sun is at infinity to the right). Phase label beside it (`phaseName(θm)`). A 14 px invisible grab radius; cursor `grab`.
7. Earth spin arrow: a cyan arc with arrowhead at radius `1.35·Rpx`, 60° long, counter-clockwise, labelled `24 h`.

**Drag.** Dragging the Moon sets `θm0` (angle of pointer from Earth centre) — when playing, the model time is reset so that the Moon stays where it was dropped (`θm0 = angle − 2π·t/(29.53·24)`).

**Animation.** `t` in hours; `playing` advances `t += speed·dtFrame` where `speed` is hours of model time per real second (slider 1–48, default 6). Earth rotates at `2π/24 h`, Moon orbits at `2π/(29.53·24 h)`, Sun fixed.

**Controls** (eyebrow `Moon, Sun and observer`): `▶ / pause` chip, `Reset` chip (t = 0, θm0 = 50°, obs = 0°); `Speed (hours per second)` slider 1–48 step 1 default 6; `Moon position` slider 0–360° step 1 (sets θm0; default **50°**); `Observer longitude` slider 0–360° step 5 default 0; toggle `Include the Sun's tide` default on; preset chips `New Moon · spring`, `First quarter · neap`, `Full Moon · spring`, `Third quarter · neap` (set θm0 to 0/90/180/270 and t = 0).

**Readouts**: `ΔF☉ / ΔF☾` = `0.46 ≈ 5/11` · `Moon tide amplitude H☾` 0.357 m · `Sun tide amplitude H☉` 0.164 m · `range now (peak-to-trough)` = `2·amp` from `tideEnvelope` (m) · `spring range` 0.78 m · `neap range` 0.29 m · `time between high tides` 12 h 25 min · `phase` name · `height at observer now` (m, 3 decimals).

Header readouts: `t = {days} d {hours} h` · `phase = {name}` · `range = {m} m`.

**Sub panel** — title `Tide height at the observer over one month`; header readouts `envelope = {mean ± amp} m`. Chart: x = 0 … 29.53 d (ticks every 5 d, plus labelled ticks at the days when θm = 0°, 90°, 180°, 270° starting from θm0: `new`, `1st qtr`, `full`, `3rd qtr`, in amber); y = −0.8(H☾+H☉) … +1.3(H☾+H☉) ≈ −0.42 … +0.69 m, the same with the Sun on or off (ticks every 0.2 m from −0.4, label `equilibrium tide (m)`). The equilibrium tide is not centred on zero: high tide is +H, low tide −H/2, so spring high water reaches +0.53 m and low water only −0.26 m. Curve: `tideHeightAt` sampled every 0.1 h over the window (7 087 points), **cyan** 1 px. Envelope: `mean ± amp` from `tideEnvelope` as **muted** dashed lines. Vertical **magenta** marker at `t mod 29.53 d` with a dot on the curve. With the Sun on, the phase labels read `new · spring`, `1st qtr · neap`, `full · spring`, `3rd qtr · neap` (one row at the top, clear of the curve); with the Sun off the envelope is flat and they read just `new`, `1st qtr`, `full`, `3rd qtr`. Note bottom-left: `real coastal tides are up to ten times larger: coastlines and basins resonate`.

**Strip**:
1. `\frac{\Delta F_\odot}{\Delta F_{\rm Moon}}=\frac{M_\odot}{M_{\rm Moon}}\left(\frac{d_{\rm Moon}}{d_\odot}\right)^{3}` — sub: `=0.46\approx\tfrac{5}{11}`
2. `\zeta(\psi)=\frac{M}{M_\oplus}\left(\frac{R_\oplus}{d}\right)^{3}R_\oplus\,P_2(\cos\psi)` — sub: `H_{\rm Moon}=0.36\ \mathrm{m},\ H_\odot=0.16\ \mathrm{m}`
3. `\text{spring}=\tfrac{3}{2}(H_{\rm Moon}+H_\odot),\quad\text{neap}=\tfrac{3}{2}(H_{\rm Moon}-H_\odot)` — sub: `0.78\ \mathrm{m},\ 0.29\ \mathrm{m}`
4. `T_{\rm high}=\frac{1}{2}\,\frac{24\ \mathrm{h}}{1-24\ \mathrm{h}/29.53\ \mathrm{d}}` — sub: `=12\ \mathrm{h}\ 25\ \mathrm{min}:\ \text{two bulges, and the Moon moves on}`
Note `<p>`: `The Moon raises the larger bulge; the Sun's adds to it at new and full Moon (spring tides) and fights it at the quarters (neap tides). Bulges are drawn 1.8 million times too tall: the real equilibrium tide is half a metre on a 6371-km Earth.`

**Rail text.** How to use: `1. Press ▶ and watch the observer sweep through two high tides a day while the Moon creeps around its orbit.<br>2. Drag the Moon to new, quarter and full positions and read the range.<br>3. Turn the Sun off to see the Moon-only tide.` What to notice: `The bulge follows the Moon, not the Sun: the Sun is 27 million times more massive but 390 times farther, and tides fall as 1/d³. High tides are 12 h 25 min apart because the Moon has moved on by the time Earth turns once.` About: `Equilibrium tide: ocean surface height ζ = H·P₂(cos ψ) for each body with H = (M/M⊕)(R⊕/d)³R⊕, summed; observer on the equator; Sun direction fixed; Earth turns once per solar day and the Moon advances at the synodic rate. No Love numbers, ocean dynamics, latitude or lunar declination. Bulge heights are magnified ×1.8 million; the Moon's orbit is drawn at a fixed radius (true: 60 R⊕).`

### 3.3 Tab `friction` — "Friction"

**Teaching point.** Earth spins faster than the Moon orbits, so friction carries the bulge ahead of the Earth–Moon line. The Moon pulls the near bulge back harder than it pulls the far bulge forward ⇒ a net torque brakes Earth's spin; the energy goes to heat; the day lengthens 2.3 ms per century. Earth's stretch across the Moon is ~20× stronger, so the Moon locked long ago.

**Main panel** — title `Lagging bulge, braking torque`; caption `Lag angle and bulge height exaggerated (textbook lag ≈ 3°, bulge ≈ 0.5 m) · Moon distance not to scale`. Earth centre at `(0.36 w, 0.5 h)`, `Rpx = 0.30·min(w,h)`; Moon disc (radius `0.3·Rpx`, `C.moon`) at `(0.86 w, 0.5 h)`; D for the force calculation is fixed at the true 60.3 (not the drawn distance) — the drawing uses the computed force *directions* toward the drawn Moon but the *magnitudes* from `bulgeForces(60.3, δ, 0.16)`, rescaled so the near-bulge arrow is `0.5·Rpx`.

Draw:
1. Earth–Moon line: muted dashed.
2. Earth disc `C.earth`; bulge: dashed cyan ellipse (semi-axes `1.16 Rpx`, `0.92 Rpx`) rotated by δ counter-clockwise from the Earth–Moon line; ocean fill `C.ocean` inside the ellipse. Bulge axis: thin cyan line through both tips, extended 1.4 Rpx, labelled `bulge axis` with the angle `δ = {deg}°` drawn as a small arc between the two lines (magenta).
3. Spin arrow: cyan arc at `1.45 Rpx`, counter-clockwise, label `Earth spins · 23.9 h`. Moon orbit arrow: muted arc around the Moon's orbit direction (short arc at the Moon, counter-clockwise), label `Moon orbits · 27.3 d`.
4. Forces on the bulges: at each tip, a **coral** arrow toward the Moon (`near` longer than `far`). Decompose each into a radial (muted, thin) and a tangential (**magenta**, 2.2 px) component; the tangential components are the torque-makers. Labels: near tip `pulled back` ; far tip `pulled ahead (weaker)`.
5. Net torque: a **magenta** curved arrow around Earth at `1.2 Rpx`, clockwise when `torque < 0`, labelled `net torque opposes the spin` (or `no torque` at δ = 0 with the arrow hidden, or `torque speeds the spin up` when δ < 0, counter-clockwise).
6. Reaction on the Moon: **green** arrow at the Moon pointing along +y (its orbital direction), length `0.8·Rpx·|torque|/|torque at δ=3°|` (clamped to 1.2 Rpx), labelled `Moon pulled forward → gains L`. Hidden at δ = 0.
7. Heat: subtle **coral** radial-gradient ring at the Earth's rim (alpha .25), label `flexing → heat`, shown only when `Animate spin` is on.
8. When `Animate spin` is on, a magenta surface dot (observer) moves counter-clockwise around the rim at 1 revolution per 6 s while the bulge stays put (the point: material moves through the bulge).

**Controls** (eyebrow `Lag and spin`): `Lag angle δ` slider −20 … 20°, step 0.5, default **3°** (num-input); chips `Today · δ = 3°`, `Locked · δ = 0`, `Spin slower than orbit · δ = −3°`; toggle `Animate spin` default off.

**Readouts**: `lag δ` · `torque (two-point bulge, units GM☾m_b/R⊕²)` scientific 3 s.f. with sign · `first-order −3 sin 2δ / D³` · `day lengthens` `2.3 ms per century` · `stretch across Moon / stretch across Earth` `22 ≈ 20` · `Earth on Moon 2GM⊕R☾/d³` 2.44e-5 m s⁻² · `Moon on Earth 2GM☾R⊕/d³` 1.10e-6 m s⁻².

Header readouts: `δ = {deg}°` · `τ {sign: "< 0 (brakes)", "= 0", "> 0"}`.

**Sub panel** — title `The same torque on the Moon: spin-down to lock`. Earth is larger than the Moon, and both bodies are labelled; sizes and distance are schematic. The Moon's grey dashed tidal bulge is in its rock. Dark grey maria patches turn with the Moon's near side and face Earth when locked. A caption describes the patches' rotation, and the inset charts spin / orbit versus time. The bulge and lag are exaggerated.

**Strip**:
1. `\tau\approx-\frac{3GM_{\rm Moon}m_b R_\oplus^{2}}{d^{3}}\sin2\delta` — sub: `\delta>0\Rightarrow\tau<0:\ \text{the spin slows}`
2. `\frac{dL_{\rm spin}}{dt}=\tau,\qquad\frac{dL_{\rm orb}}{dt}=-\tau` — sub: `\text{angular momentum flows from spin to orbit}`
3. `\dot P_{\rm day}\approx2.3\ \mathrm{ms\ per\ century}` — sub: `\text{rotational energy}\to\text{heat}`
4. `\frac{\Delta F_{\oplus\to\rm Moon}}{\Delta F_{{\rm Moon}\to\oplus}}=\frac{M_\oplus R_{\rm Moon}}{M_{\rm Moon}R_\oplus}\approx22` — sub: `\sim20:\ \text{the Moon locked first}`
Note `<p>`: `Friction drags the bulge ahead of the Earth–Moon line. The Moon pulls the near bulge back harder than it pulls the far bulge forward, so the net torque brakes Earth's spin and the flexing turns into heat. The same torque, acting the other way, locked the Moon's rotation to its orbit long ago.`

**Rail text.** How to use: `1. Slide the lag angle through zero and watch the torque arrow flip.<br>2. Turn on “Animate spin”: the surface moves through a bulge that stays put.<br>3. In the lower panel set spin/orbit to 1 and watch the maria face Earth.` What to notice: `Only the tangential parts of the two pulls make torque, and the near bulge wins because it is closer. The reaction pushes the Moon forward along its orbit: that is where Earth's lost spin goes.` About: `Two point bulges of mass m_b at ±R⊕(1.16) along an axis leading by δ; exact inverse-square pulls from the Moon at the true 60.3 R⊕ (the Moon is drawn closer). The first-order torque is −3GM m_b R² sin 2δ / d³. The lag angle, bulge height and Moon size are exaggerated; the 2.3 ms per century and the ≈20× ratio are the lecture's values. The Moon’s tidal bulge is in its rock; the dark maria mark its near side.`

### 3.4 Tab `spiral` — "Spiral out"

**Teaching point.** The leading bulge pulls the Moon forward; it climbs to a higher orbit. With P² = kr³, v ∝ r^{−1/2} but L ∝ r^{1/2}: the Moon ends up moving slower yet carrying more angular momentum. Spin L lost by Earth = orbital L gained by the Moon. End state: day = month ≈ 47 days at ≈ 87 R⊕.

**Main panel** — title `Earth and Moon, to scale in distance`; caption `Distances to scale (1 tick = 10 R⊕) · Earth and Moon drawn no smaller than 6 px and 4 px · constant-rate model, past is an extrapolation`. Side view. Earth centre at `(0.10 w, 0.5 h)`; scale `s = 0.82 w / 90` px per R⊕ (so 90 R⊕ reaches 0.92 w). Earth disc radius `max(6, s)`, fill `C.earth`; Moon disc radius `max(4, 0.273 s)`, `C.moon`, at `(xE + a/R⊕ · s, 0.5 h)`.

Draw:
1. Axis line along y = 0.5 h from Earth to the right edge, muted; ticks every 10 R⊕ with labels `10, 20, … 90 R⊕`.
2. Reference markers (thin vertical dashed lines, labels above): `today 60.3` (muted), `locked 86.9` (magenta), and when `t < 0` an extra coral label `constant-rate past (extrapolation)` at top-left.
3. Earth spin arrow: cyan arc at radius `max(14, 1.6·Rpx)` around Earth, counter-clockwise, label `day = {day}` (format: < 100 h → `23.9 h`; else `{days} d`).
4. Moon orbital motion: a **green** velocity arrow at the Moon pointing up (+y, tangent to the orbit at that point), length `60 px · v/1025 m s⁻¹`, label `v = {v} m/s`. A faint muted arc of the orbit through the Moon (radius a, centred on Earth; it leaves the panel — clip it), with a small arrowhead showing counter-clockwise motion.
5. Lagging bulge glyph on Earth: a small cyan ellipse rotated by 3° (hidden once locked), connecting visually to Tab 3.
6. In-canvas readout box at top-right (panel-deep fill, border): `t = {±x.xx} Gyr` / `a = {a} R⊕ = {km} km` / `day {day}` · `month {month} d` / `L_spin {pct}% · L_orb {pct}%`. When locked: an extra line in magenta `tidally locked: day = month = 47 d`.
7. A tiny "ghost" Moon at today's position in muted outline when `t ≠ 0`.

**Animation / controls** (eyebrow `Time`): `Time from today` slider −1.0 … 13.70 Gyr, step 0.01, default **0** (num-input in Gyr); `▶ / pause` chip (advances `t` at `speed` Gyr per real second, slider 0.1–2.0 default 0.5, stops at tLock); `Reset to today` chip; chips `−1 Gyr`, `today`, `+1 Gyr`, `+5 Gyr`, `locked`. Scrubbing anywhere on the main canvas horizontally (drag on the axis) also sets t: `t = tmin + (tmax − tmin)·(x − 0.08 w)/(0.84 w)`, clamped.

**Readouts**: `t` · `a` (R⊕ and km) · `day length` · `month (sidereal)` · `orbital speed v` · `L_spin` (kg m² s⁻¹, 3 s.f.) · `L_orb` · `L_total (constant)` · `Moon recedes (model)` `4.2 cm/yr today (laser ranging: 3.8)` · `locks at` `86.9 R⊕, 47.2 d, +13.7 Gyr (this model)`.

Header readouts: `t = {Gyr}` · `a = {R⊕}` · `day = {…}`.

**Sub panel** — title `Angular-momentum budget`; header readouts `L_spin + L_orb = {Ltot} = const`. Stacked area chart: x = time −1.0 … 13.7 Gyr (ticks every 2 Gyr, `today` tick in amber at 0), y = 0 … 1 (fraction of L_tot, ticks 0, .25, .5, .75, 1). Fill from 0 to `fracOrb(t)` in cyan at 45 % alpha labelled `orbit` (inside the area, left part), from `fracOrb` to 1 in amber at 45 % labelled `Earth's spin`; the boundary curve cyan 1.5 px; top line at 1 muted dashed labelled `total = const`. Sample t every 0.02 Gyr. Vertical magenta marker at the current t with a dot on the boundary. Left of t = 0 a light coral hatched overlay labelled `extrapolation`. A second curve, **purple** dashed, `a(t)/a_lock` (0.69 → 1) labelled `a / a_lock` at its right end, so the slow approach to the lock is visible.

**Strip**:
1. `L_{\rm orb}=\mu\sqrt{G M_{\rm tot}\,a}\;\propto\;\sqrt{a}` — sub: `\text{today }2.86\times10^{34}\ \mathrm{kg\,m^2\,s^{-1}}` (computed)
2. `v=\frac{2\pi a}{P}=\sqrt{\frac{GM_{\rm tot}}{a}}\;\propto\;a^{-1/2}` — sub: `\text{now }{v}\ \mathrm{m/s}` (at current t)
3. `I_\oplus\,\omega+\mu\sqrt{GM_{\rm tot}\,a}=L_{\rm tot}` — sub: `L_{\rm tot}=3.44\times10^{34};\ \text{spin }{pct}\%,\ \text{orbit }{pct}\%`
4. `\frac{da}{dt}=\left.\frac{da}{dt}\right|_0\left(\frac{a_0}{a}\right)^{11/2}\Rightarrow a(t)=\left[a_0^{13/2}+\tfrac{13}{2}\dot a_0a_0^{11/2}t\right]^{2/13}` — sub: `\dot a_0=4.2\ \mathrm{cm/yr}\ \text{from }2.3\ \mathrm{ms/century}`
Note `<p>`: `Higher orbits are slower but hold more angular momentum, so a forward push lifts the Moon and slows it. Earth's spin pays for it until day = month ≈ 47 days at ≈ 87 R⊕ (this model: in ≈ 14 Gyr; realistic estimates are longer, and the Sun will have intervened).`

**Rail text.** How to use: `1. Scrub time (or press ▶). The Moon drifts out, its speed arrow shrinks, the day stretches.<br>2. Watch the budget: whatever the spin loses, the orbit gains.<br>3. Go to the end: day = month, the bulge sits on the Earth–Moon line, and the torque is gone.` What to notice: `v falls as a^{-1/2} while L rises as a^{1/2}: speeding the Moon up ends with it moving slower. The Earth's spin is only 17 % of the budget today; by the lock it is under 1 %.` About: `Angular momentum: Earth's spin (I = 0.3307 M⊕R⊕², sidereal ω) plus the Moon's circular orbit about the barycentre (μ√(GM_tot a)), total conserved; the Sun's tide and the Moon's own spin are ignored. Torque today is set so the day lengthens 2.3 ms per century (slide 9), which gives 4.2 cm/yr recession (lunar laser ranging: 3.8 cm/yr). The rate is scaled as a^{-11/2} (constant lag angle), which integrates to the closed form shown; it ends at the lock where ω = n, a = 86.9 R⊕, P = 47.2 d, after 13.7 Gyr here. Run backwards the same law puts the Moon at Earth's surface 1.4 Gyr ago, which is wrong (the Moon is 4.5 Gyr old): today's ocean tides are unusually dissipative, so the past is marked as an extrapolation and the slider stops at −1 Gyr.`

### 3.5 Tab `roche` — "Roche limit"

**Teaching point.** Tidal stretch across a body grows as 1/r³; inside the Roche limit it beats the body's self-gravity and the body is torn apart. r_R = f_R (ρ_p/ρ_m)^{1/3} R_p with f_R = 2.456, independent of the satellite's size. Saturn example: icy body ⇒ 2.04 R_p ≈ 122,000 km, inside the rings (80,000–136,000 km). The whole ring mass, 10¹⁶ kg, is one 13-km icy body.

**Main panel** — title `A satellite approaching its planet`; caption `Planet and distances to scale · satellite enlarged · deformation and break-up schematic`. Planet centre at `(0.18 w, 0.5 h)`, `RpPx = 0.22·h` (so 6 R_p fits in a 1000×400 panel: 0.18 w + 6·88 = 708 px; at narrower panels allow horizontal clipping of the far region, the slider still reaches 6). Draw:
1. Planet disc: amber for Saturn and the Sun, `C.earth` for Earth, `#c9a27a` for Jupiter (only the Saturn preset shows rings). For Saturn: the ring annulus from `ringInner` to `ringOuter` (1.33–2.27 R_p) as an amber band at 18 % alpha with a 1 px amber border, label `rings 80,000–136,000 km`.
2. Rigid limit: **muted** dashed circle at `rigidRadius`, label `rigid estimate 2^{1/3}(ρ_p/ρ_m)^{1/3} R_p = {x.xx} R_p` placed above the circle's top.
3. Roche limit: **magenta** dashed circle at `rocheRadius`, 1.5 px, label `Roche limit 2.456(ρ_p/ρ_m)^{1/3} R_p = {x.xx} R_p = {km} km` above its top. If the two circles are within 12 px, stack the labels.
4. Radial line from the planet to the satellite (muted dotted) with a distance label `r = {x.xx} R_p = {km} km` at the midpoint.
5. Satellite, at `(xp + r·RpPx, 0.5 h)`: display radius `Rd = max(7, Rm/Rp·RpPx)`. Intact (`r > rRoche`): ellipse with semi-axes `Rd(1+0.6e)` radial, `Rd(1−0.3e)` transverse, `e = elongation(r, rRoche)`, fill `#9fb7c7` (ice) / `#a08a74` (rock, when ρ_m ≥ 2500), stroke `C.text`. Draw two **coral** tidal arrows from the near and far sides outward along the radial line and two **green** self-gravity arrows from the same points inward, with one shared scale: `green length = 0.9 Rd`, `coral length = 0.9 Rd · tidal/selfGravity`. Disrupted (`r ≤ rRoche`): replace the ellipse by 24 coral dots of radius `0.28 Rd` spread along an arc of the circle of radius r, half-angle `60°·min(1,(rRoche − r)/(rRoche − Rp))` plus small deterministic radial jitter (seeded LCG, ±0.3 Rd), with a label `torn apart → a ring`. A tiny `C.text` label beneath: `true size: {Rm km} km (drawn {Rd/ (Rm/Rp·RpPx)}× larger)` when enlarged.
6. State label at top-left (bold 12 px): `intact` (green) / `stretched` (amber) / `disrupted` (coral).

**Drag.** Dragging the satellite (grab radius 18 px) or anywhere on the canvas sets `r = clamp(dist(pointer, planet)/(0.22·h), 1.05, min(6, rMaxFit))`, where `rMaxFit` is the largest distance that still fits at the full scale (see "Circular display" below); the rail slider reaches 6 and mirrors.

**Circular display: callout and full-height blow-up (2026-11-05).** In circular mode, in every state (intact, stretched, disrupted), the right part of the main canvas is a framed **blow-up box**: width `clamp(0.38 w, 200, 380)` px, right edge at `w − 10`, top 10, bottom `h − 10`, fill slightly darker than the page (`#080b0f`), 1 px `C.muted` border. It is not a split panel: there is no divider and the main drawing remains one scene, joined to the blow-up by a **callout** and two connectors.
- *Main-view scale.* `RpPx = min(0.22 h, (limit − 0.18 w − ext) / r)` clamped to at least 8 px, with `limit = box.x − 40` and `ext = max(12, 2.2·Rd + 6)` evaluated at the full scale (state-independent, so the scale never jumps when the moon crosses the Roche limit; it shrinks only when `r` is so large that the moon would come within 40 px of the box). The planet, the moon drawing, the callout and every main-view label end at least 40 px left of the box (long labels are shifted left or wrapped by `placeLabel`); circles are clipped at the box edge. The orbit and the planet centre keep their positions `(0.18 w, 0.5 h)`.
- *Callout.* A 1 px `C.text` rectangle (about 0.8 alpha) around the moon's guiding centre (φ = 0), at least 24 × 24 px and large enough for the main-view moon drawing. When the debris spreads, its height grows to the along-orbit span the blow-up shows, capped at `0.8 ρ` (ρ = orbit radius in px), and its left side grows to enclose the curvature of the orbit over that span.
- *Connectors.* Two thin lines from the callout's top-right and bottom-right corners to the box's top-left and bottom-left corners, with a faint wedge fill between them (alpha 0.06). They are drawn under the labels and never cross the planet disc; labels avoid them when they can.
- *Blow-up content, same orientation as the main view*: radial is horizontal (toward the planet = left) and along-orbit is vertical (ahead = up); it is **not** rotated. A dashed vertical line through the centre is labelled `moon's orbit`; `ahead ↑` sits near the top, `behind ↓` near the bottom, and `← toward {planet}` / `away from {planet} →` run along the bottom (planet name from the chip: Saturn, Jupiter, Earth, the Sun). Title top-left: disrupted `close-up of the moon, moving with its orbit`, otherwise `close-up of the moon`. The stage and time sit under it (e.g. `pieces drifting apart · 0.3 orbits after break-up`, stage words break-up, pieces drifting apart, arc along the orbit, closed ring); the old stage label under the inset is gone.
- *Disrupted.* Coral dots at `(cx + x/sx, cy − y/sy)` (y wrapped to ±π r). For N > 0 a faint grey copy of the break-up row (all pieces at y = 0) is labelled `at break-up`, so the shear tilt reads (inner pieces ahead/up, outer pieces behind/down); at N = 0 the row is drawn with the stretched moon outline. Axes, monotone in N: `radialHalf = 1.25·1.5·R_m·(4 − 3cos(min(2πN, π)))`; `alongHalf = max(radialHalf·(plotH/plotW), 0.575·(max y − min y))`, capped at the half-length of orbit the callout covers (callout half-height in px × `R_p / RpPx` metres per px). Pieces outside the plot are not drawn and `arc continues ↑` / `arc continues ↓` appear. A round (1, 2 or 5 × 10ⁿ km) horizontal bar (radial) and vertical bar (along the orbit) carry their labels inside the box; when the two km-per-px scales differ by more than 1.5× the note `axes stretched differently` appears.
- *Intact or stretched.* The moon at true scale (isotropic) as an ellipse with `elongation`, a one-line state text and a km scale bar. The ellipse's long semi-axis is 0.45 of the plot half-width. Both arrows lie outside it, 2 px wide, with heads: at each tip a coral arrow starts at the tip and points outward (tidal stretch), and a green arrow comes from outside and ends at the tip, pointing inward (self-gravity); coral is drawn 3 px above and green 3 px below the axis. Lengths are proportional to the two accelerations (`tidalAtSatellite`, `selfGravity`): the longer is 85 % of the room between the tip and the plot edge, the shorter at least 6 px. The hook's `blowup.arrows[]` entries carry `{kind,x,y,dx,dy,w}` (x,y is the start point).
- *Polish (2026-11-05, second pass).* (A) The connector wedge (polygon callout top-right, box top-left, box bottom-left, callout bottom-right, plus a 4 px margin around each connector line) is a hard obstacle for every main-view label, including the circle and `r =` labels (`placeLabel` obstacle kind `{t:'w',pts,m}`; `label()` honours the module-level `labelHard` list during `drawRoche`). The moon labels are placed first, near the moon above-left, left or below-left of the callout; the debris-arc label is kept within about 50 px of the nearest debris piece by trying shorter texts (`debris arc, about N km wide: too thin to see here (see close-up)`, then `debris arc, N km wide: too thin to see (close-up)`, then `debris arc (see close-up)`) and narrower wraps. (B) `true size: …` is drawn only when the moon body is drawn (intact, stretched, or break-up at N = 0). (C) The blow-up is split into a header band (title, stage line, `ahead ↑`, `moon's orbit` above the dashed line), the plot area (pieces, moon outline, arrows, `at break-up`, `arc continues ↑/↓`; clipped to the plot; plot labels keep clear of every piece disc (radius + 2) and the outline) and a footer band (`behind ↓`, scale bars and labels, `axes stretched differently`, the intact legend, `← toward …` / `away from … →`). Axes are recomputed from the plot area and stay monotone in N. (D) Intact and stretched states draw a coral (outward) and a green (inward) arrow at each end of the long axis, lengths proportional to the two accelerations (the larger is 35 % of the plot half-width, the smaller at least 6 px); the moon is drawn at 0.16 plot-widths per radius so the arrows fit; the legend `coral: tidal stretch` / `green: self-gravity` is in the footer. (E) For `w < 600` the box is `max(140, 0.45 w)` wide, the planet centre is at `0.12 w`, and short labels are used (`Roche limit 2.04 R_p`, `rigid 1.05 R_p`, `r = 1.80 R_p`, `rings 80–136 Mm`, `← Saturn` / `away →`, `arc ↑` / `arc ↓`, `debris arc, N km wide`, `debris arc: thin`).
- *Hook.* `rocheDebris()` keeps its keys; `insetBox` is now the blow-up box in every circular state (null only outside circular mode), and it adds `calloutBox {x,y,w,h}`, `connectors [[x1,y1,x2,y2],[…]]` (callout right corners to box left corners), `blowup {radialHalfKm, alongHalfKm, drawn, total, pieces:[{sx,sy,x0,drawn,up}], plot:{x,y,w,h}, cx, cy, sxKm, syKm}` (CSS px; all 24 pieces are listed, `drawn` says whether one lies inside the plot), `planet {x,y,R,mx,rd,limit}` and `stage`. Second pass adds `wedge [[x,y]×4]` (callout top-right, box top-left, box bottom-left, callout bottom-right) and, inside `blowup`, `plot {x,y,w,h}`, `discR` (drawn piece radius, 2.3 px), `labels [{text,x,y,w,h,color,band}]` (`band` is `header`, `footer`, `plot` or `side`; `y` is the top of the box), `ellipse {cx,cy,rx,ry}` (intact, stretched and N = 0 outline; null otherwise), `arrows [{kind:'tidal'|'self',x,y,dx,dy}]` (intact and stretched only), `hbar {x0,x1,y}`, `vbar {x,y0,y1}` and `ratio`. `labelBoxes()` includes two container boxes, `close-up zone` (the blow-up plus its 40 px margin, so main labels keep out) and `callout`; labels inside the blow-up are ordinary boxes.

**Controls** (eyebrow `Planet and satellite`):
- Planet chips: `Saturn` (R_p 60,000 km, ρ_p 690) default, `Jupiter` (71,492 km, 1326), `Earth` (6371 km, 5514), `Sun` (696,000 km, 1408). Sliders `ρ_p` 300–6000 kg m⁻³ step 10 and `R_p` 1 000–1 000 000 km (log slider, num-input in km) — chips set both.
- Satellite chips: `Icy · 1200` default, `Comet · 500`, `Rocky · 3000`, `Moon-like · 3340`; slider `ρ_m` 300–6000 step 10; `R_m` log slider 1–2000 km default **13 km** (num-input).
- `Distance r / R_p` slider 1.05–6 step 0.01 default **3.0**.
- Chip `Lecture example` resets to Saturn / icy / 13 km / r = 3.0.

**Readouts**: `Roche limit r_R` `{x.xx} R_p = {km} km` · `rigid estimate` `{x.xx} R_p = {km} km` · `ratio r_R / rigid` `1.95` (= 2.456/2^{1/3}) · `satellite mass` (kg, 3 s.f.) · `self-gravity GM_m/R_m²` (m s⁻²) · `tidal stretch 2GM_pR_m/r³` (m s⁻²) · `tidal / self-gravity` · `state` · for Saturn only: `rings` `80,000–136,000 km: the limit lies inside them` · `10¹⁶ kg of ice is a body of radius` `12.6 km ≈ 13 km`.

Header readouts: `r = {x.xx} R_p` · `r_R = {km} km` · state.

**Sub panel** — title `Self-gravity versus tidal stretch`; header readouts `cross at {x.xx} R_p (rigid) · Roche at {x.xx} R_p`. Log–log chart: x = r/R_p from 1 to 6 (ticks 1, 1.5, 2, 3, 4, 6), y = acceleration in m s⁻², range auto: two decades around `selfGravity` (from `selfGravity/30` to `selfGravity·30`). Horizontal **green** line `g_self = GM_m/R_m²` labelled; **coral** curve `2GM_pR_m/r³` labelled `tidal stretch ∝ r⁻³`; vertical **muted** dashed at the rigid crossing labelled `equal (rigid)`; vertical **magenta** dashed at `rocheRadius` labelled `Roche (fluid) 2.456`; between them a light magenta fill labelled `stretched fluid body breaks here`; for Saturn, the ring span as a faint amber band on the x-axis. Current r: magenta marker with dots on both lines. Note bottom-left: `both lines scale with R_m, so the crossing does not depend on the satellite's size`.

**Strip**:
1. `\frac{GM_m}{R_m^{2}}<\frac{2GM_pR_m}{r^{3}}` — sub: `\text{self-gravity holding a surface mass vs tidal stretch across }R_m`
2. `r_{\rm rigid}=2^{1/3}\left(\frac{\rho_p}{\rho_m}\right)^{1/3}R_p` — sub: `={x.xx}\,R_p` (current)
3. `r_{\rm Roche}=f_R\left(\frac{\rho_p}{\rho_m}\right)^{1/3}R_p,\quad f_R=2.456` — sub: `={x.xx}\,R_p={km}\ \mathrm{km}` (current)
4. `R=\left(\frac{3M}{4\pi\rho}\right)^{1/3}` — sub: `10^{16}\ \mathrm{kg\ of\ ice}:\ R=12.6\ \mathrm{km}\approx13\ \mathrm{km}`
Note `<p>`: `Lecture example: an icy body (ρ ≈ 1200 kg m⁻³) at Saturn (R_p = 60,000 km, ρ_p ≈ 690) is torn apart inside 2.04 R_p ≈ 122,000 km, within the rings. The two-point inequality gives 2^{1/3} ≈ 1.26; Roche's 2.456 is for a fluid body that stretches as it falls inward and so breaks up almost twice as far out.`

**Rail text.** How to use: `1. Drag the satellite toward Saturn. It stretches, then breaks into a ring inside the magenta circle.<br>2. Change the satellite's density: ice breaks up farther out than rock.<br>3. Change its radius: the circles do not move.` What to notice: `The limit depends on the density ratio and the planet's radius, not on the satellite's size: both self-gravity and tidal stretch are proportional to R_m. Saturn's rings sit around the limit for ice.` About: `M_p = (4/3)πρ_pR_p³ from the preset values (slide 11 rounds Saturn to 60,000 km and 690 kg m⁻³). f_R = 2.456 is Roche's coefficient from slide 10; slide 11 rounds it to 2.44 (2.03 R_p). The faint circle is the rigid two-point estimate 2^{1/3} ≈ 1.26; the gap between it and 2.456 is what a deformable, cohesionless body loses by stretching. Real small bodies have tensile strength (a 13 km comet does not need self-gravity to hold together), so the limit applies to large or rubble-pile bodies. The deformation and the debris arc are schematic.`

---

## 4. Visual exaggerations (must be stated on-page, summarized here)

| Where | True | Drawn | Where stated |
|---|---|---|---|
| Tab 1 residual arrows | ≈ 2/D³ of the central pull | rescaled so the largest is 0.55 R | printed magnification on the view, About |
| Tab 1/3 football ellipse | 0.5 m on 6371 km (8×10⁻⁸) | 1.16 : 0.92 | caption, strip note, About |
| Tab 2 ocean bulge | H☾ = 0.357 m | 10 % of R (×1.78 million) | caption, strip note, About |
| Tab 2 Moon orbit radius | 60 R⊕ | 0.40 min(w,h) ≈ 1.8 R⊕ drawn | caption |
| Tab 3 lag angle | ≈ 3° | slider, default 3°, up to 20° | caption |
| Tab 3 Moon distance | 60.3 R⊕ | ≈ 1.7 R⊕ drawn; forces use 60.3 | About |
| Tab 4 Earth/Moon discs | 1 : 0.273 at 60 R⊕ | floor of 6 px / 4 px | caption |
| Tab 4 past | unknown dissipation history | constant-rate extrapolation | coral overlay, About |
| Tab 5 satellite size and shape | 13 km vs 60,000 km | floor of 7 px, schematic ellipse and debris | caption, label, About |

---

## 5. Formula strip mechanism

Same as planet_building: each tab's `stripBody.innerHTML` is four `<span class="eq" data-tex="…"></span>` followed by one `<p>…</p>`; `renderMath()` turns each `.eq` into a `.formula-line` with a `.formula-def` (the tex) and a `.formula-sub` (the per-tab `subs[i]` strings listed above, recomputed from the current state). Keep the planet_building behaviour of hiding `.formula-sub` when it would overflow.

---

## 6. State and tab switching

`setTab(name)` sets `document.body.className = 'tab-'+name (+ ' embed')`, toggles the `.active` button and `aria-selected`, rebuilds the rail (`controlsHtml()` + `installControls()`), updates panel titles/captions, stops any running animation of the previous tab, then `paint()` and `renderMath()`.

Per-tab state object (single `S` object, all defaults listed):
```
S.stretch  = { D: 10, pair: 'moonEarth', interior: true }
S.tides    = { t: 0 /*hours*/, thetaM0: 50*π/180, obsLon: 0, sunOn: true, speed: 6, playing: false }
S.friction = { lagDeg: 3, animateSpin: false, spinRatio: 1, orbitPlaying: true, orbitAngle: 0 }
S.spiral   = { tGyr: 0, speed: 0.5, playing: false }
S.roche    = { Rp: 6.0e7, rhoP: 690, rhoM: 1200, Rm: 1.3e4, r: 3.0 /*Rp*/, primary: 'saturn' }
```
Pairs for Tab 1: `moonEarth` {M: M_MOON, R: R_EARTH, d: D_MOON}, `sunEarth` {M_SUN, R_EARTH, D_SUN}, `earthMoon` {M_EARTH, R_MOON, D_MOON}.

---

## 7. URL parameters

- `tab` ∈ {stretch, tides, friction, spiral, roche}; invalid/missing → `stretch`.
- `embed=1` → `body.embed` (main panel only), as planet_building.
- `t` (number, optional), interpreted per tab: `tides` → hours of model time (sets `S.tides.t`); `spiral` → Gyr from today (clamped); `friction` → orbit angle in degrees for the lower panel; `stretch` → d/R (so `?tab=stretch&t=60.3` opens the Moon case); `roche` → r/R_p. Ignored otherwise.

---

## 8. Hook: `window.__tidal`

```
window.__tidal = {
  model,                        // the imported module namespace (all §2 exports)
  K: model.K,
  get tab(){…},
  setTab(name),
  state(){ return structuredClone({tab, ...S}) },
  set(tabName, patch){ Object.assign(S[tabName], patch); paint(); renderMath(); },   // e.g. set('stretch',{D:60.3})
  step(dt){ … },               // advance the current tab's animation by dt seconds of real time and paint (tides: t += speed*dt hours; spiral: tGyr += speed*dt; friction: orbitAngle += 2π·dt/8)
  render(){ paint(); renderMath(); },
  readouts(){ … },             // object of the numbers currently displayed in the rail metrics, keyed by label (for headless checks)
  labelBoxes(){ … }            // array of {x,y,w,h,text} for the current main canvas labels (same markBox pattern as planet_building) so overlap can be checked
}
```

---

## 9. Acceptance checks (page) and unit tests (model)

### 9.1 Unit tests — `tests/tidal_forces_model.test.cjs` (node:test, `import('../html/tidal_forces_model.js')`)

1. **Binomial first order.** For x in [1e-3, 1e-2, 1/60.3, 0.1]: `|tidalBracketExact(x) − (−4x)| / (4x)` is < `2.2·x²` and > `1.8·x²` (the error is 2x² to leading order). At x = R_EARTH/D_MOON (d/R = 60.336, the true Earth–Moon ratio): exact = −0.0663320 (±1e-6), approx = −0.0662955, rel err 5.5e-4.
2. **Residual field.** `forceField(samplePoints(), 10)`: the residual at the origin is exactly [0,0]; at (1,0) the x-component is > 0 and ≈ 2/1000 within 35 % (exact 2/D³·(1+…)); at (0,1) the y-component is < 0 and the ratio `|res_y(0,1)| / res_x(1,0)` → 0.5 within 10 % at D = 100 and within 1 % at D = 1000; `res(−1,0).x < 0`. `tidalAccelLinear([1,0],D)` equals `[2/D³,0]`.
3. **Sun/Moon ratio.** `sunMoonRatio()` ∈ [0.44, 0.47]; with the lecture's rounded inputs (2e30, 7.36e22, 1.5e11, 3.84e8) it is 0.456 (±0.001).
4. **Equilibrium tides.** `equilibriumTideHeight(M_MOON, D_MOON)` = 0.357 m (±0.005); Sun 0.164 m (±0.003); ratio equals `sunMoonRatio()` to 1e-9. `tideEnvelope` at Δθ = 0 gives 2·amp = 0.781 (±0.005) and at Δθ = π/2 gives 0.289 (±0.005). `tideHeightAt` at the observer under the Moon with Sun off equals `H☾` exactly, at 90° equals −H☾/2.
5. **High-tide interval.** `lunarHighTideInterval()` = 12.42 h (±0.01). `tideFrame(29.53·24, θ0, 0).thetaM − θ0` = 2π (±1e-9).
6. **Bulge torque.** `bulgeForces(60.3, 3°).torque` < 0; at δ = 0 the torque is 0 (|τ| < 1e-15); at δ = −3° it is the negative of +3°; the ratio to `bulgeTorqueFirstOrder` is within 0.2 % at D = 60.3 and within 4 % at D = 10. `stretchRatioEarthOnMoon()` = 22.2 (±0.2).
7. **Angular momentum.** `Lorb(2a)/Lorb(a)` = √2 (1e-12); `vorb(2a)/vorb(a)` = 1/√2; for t in [−1, 0, 1, 5, 13] Gyr `evolve(t).Lspin + Lorb` equals `Ltot` to 1e-10 relative. `evolve(0)`: a = D_MOON, day = 23.93 h (±0.01), v = 1025 m/s (±2), fracSpin = 0.170 (±0.003). `aOfT(tOfA(a))` round-trips (1e-9) for a = 1.2 a0.
8. **Calibration.** `dadt0` = 4.2 cm/yr (±0.1). `aOfT(1 Gyr)` = 65.5 R⊕ (±0.2); `evolve(1 Gyr).day` = 30.1 h (±0.2); `evolve(−1 Gyr).day` = 16.6 h (±0.2).
9. **Lock.** `lockState()`: a = 86.9 R⊕ (±0.2), P = 47.2 d (±0.2), t = 13.7 Gyr (±0.2); at that a, `omegaOfA(a)` equals `n(a)` to 1e-6 relative; `evolve(20 Gyr)` is clamped to the lock state (`locked === true`).
10. **Roche.** `rocheRadius(690, 1200, 6.0e7)` = 1.2254e8 m (±1e5), i.e. |r − 122,000 km| < 1,000 km, and `/Rp` = 2.04 (±0.01); with f = 2.44 → 2.03 (±0.005); `rocheRadius(…, F_RIGID)/Rp` = 1.048 (±0.005). `radiusFromMass(1e16, 1200)` = 12.6 km (±0.1). At `r = rigidRadius`, `tidalAtSatellite === selfGravity` to 1e-9 relative, for any Rm (test Rm = 1e3 and 1e6) — independence of satellite size. `disruptionState` returns the three states at r = 3, 2.3, 1.9 R_p for Saturn/ice.

### 9.2 Page acceptance (headless, via `window.__tidal`)

- Loads without console errors on all five tabs; `?embed=1` shows only the main panel; `?tab=xyz` falls back to `stretch`.
- Tab 1 readouts: with the `Moon → Earth` chip (D = D_MOON/R_EARTH = 60.336) the rail shows exact `−0.066332`, first-order `−0.066296`, error `0.055 %`, and bulge `0.54 m`; with D = 23,482 (Sun) the bulge reads `0.25 m`; the printed magnification at D = 10 is `×4` (exact 4.26).
- Tab 2: the readout `ΔF☉/ΔF☾` shows `0.46 ≈ 5/11`; spring `0.78 m`, neap `0.29 m`, high-tide interval `12 h 25 min`; after `step()` totalling 24 h of model time the observer dot is back at its starting angle and the Moon has advanced 12.2°; the chart's `new/1st qtr/full/3rd qtr` ticks are in increasing order and 7.38 d apart.
- Tab 3: at δ = 3° the header shows `τ < 0 (brakes)`, the torque readout is negative, the ratio readout reads `22 ≈ 20`; at δ = 0 no torque arrow or green arrow is drawn (`labelBoxes()` contains no `net torque` entry); the lower panel with s = 1 draws the face tick on the Earth-facing side for every orbit angle (check 8 angles: tick direction · (Earth − Moon) > 0).
- Tab 4: readouts at t = 0: `a = 60.3 R⊕`, `day = 23.9 h`, `v = 1025 m/s`, `L_spin 17 %`, `L_orb 83 %`; at t = 13.7 the magenta `tidally locked` line is present and `day` ≈ `month` ≈ 47 d; the budget chart's total line stays at 1 (the two fractions sum to 1 at every sampled t).
- Tab 5 (lecture example chip): header `r_R = 122,500 km` (accept 121,500–122,600), readouts `2.04 R_p`, rigid `1.05 R_p`, ring note present, `12.6 km ≈ 13 km`; dragging to r = 2.0 gives state `disrupted`, r = 2.3 `stretched`, r = 3 `intact`; changing R_m from 13 to 500 km leaves both circle radii unchanged (`readouts()` Roche/rigid identical).
- Label overlap: `labelBoxes()` reports zero overlapping pairs at 1280×800 on every tab with defaults, and at 900×600 for `stretch` and `roche`.
- `node --test tests/` passes.

---

## 10. Index card, README, thumbnails

**index.html** — add a `<a class="viz-card" href="html/tidal_forces.html">` after the Building the Planets card (before the placeholder card), same markup pattern:
- thumb: `assets/thumbs/tidal_forces.jpg`
- glyph (20×20 in a 32-viewBox, same style): an Earth circle `cx=14 cy=16 r=7` stroke `var(--cyan)`, a dashed football ellipse `rx=10 ry=5.5` around it stroke `var(--coral)` opacity .8, two short coral arrows along the long axis pointing outward (`M24 16 h4 M26.5 14 l1.5 2 -1.5 2` and mirrored), and a small amber Moon `cx=28 cy=7 r=2` fill `var(--amber)`.
- title: `Tidal Forces`
- badge: `<span class="badge badge-cyan">Interactive</span>`
- desc: `Why gravity across a finite body stretches it into a football: the differential force and its −4GMmR/d³ expansion, the Moon's tide versus the Sun's (5 : 11) with spring and neap tides, the lagging bulge that brakes Earth's spin and lifts the Moon to a slower, higher orbit by conservation of angular momentum, and the Roche limit that keeps Saturn's rings from becoming a moon.`
- tags: `Differential gravity`, `Spring and neap tides`, `Tidal locking`, `Roche limit`

**README.md** — append to Entry Points after the planet_building line:
`- \`html/tidal_forces.html\` — Tidal forces: differential gravity across a body and the football shape, Sun versus Moon tides with spring and neap, tidal friction and the braking torque, the Earth–Moon spiral-out by angular-momentum conservation, and the Roche limit with the Saturn-ring example.`
Also extend the first paragraph's topic list with "tidal effects".

**tools/make_thumbs.sh** — append:
`shot "html/tidal_forces.html?tab=stretch&embed=1" "tidal_forces"`
(The default D = 10 view shows both halves: converging cyan arrows on the left, the coral stretch-and-squeeze pattern with the dashed football on the right. No `t` needed; the page is static on that tab.)

---

## 11. Build order suggestion

1. `tidal_forces_model.js` + tests (run `node --test tests/tidal_forces_model.test.cjs`).
2. Page skeleton from planet_building (chrome, rail, strip, splitters, embed, URL params, hook).
3. Tabs in order 1, 5, 2, 3, 4 (1 and 5 are static drawings with drag; 2 and 4 add animation; 3 reuses the bulge drawing from 1 and the orbit drawing from 2).
4. Index card, README line, thumbnail `shot` line; regenerate the thumbnail with `tools/make_thumbs.sh` (or, if Chrome is unavailable, leave a note that the thumb needs capturing).

## 12. Revisions after the first review (2026-11-03)

0. Roche contrast: add a barely bound stellar pass and its fallback stream; retain the circular moon case.
1. Stretch: show the other body continuously on a draggable logarithmic distance ruler; explain the force fields and residual magnitude.
2. Sun & Moon: show a rotating Earth symbol, contrasting ocean and a pinned observer with a radial tide gauge.
3. Friction: show the Moon's leading bulge and torque with a playable spin-down, time trace, and Earth's present spin/orbit ratio.
4. Spiral: calculate and annotate the locked Moon's small spin angular momentum, retain the original conserved total, and mark the Moon's face.
5. Roche: start debris radially and show Keplerian shear into an arc and ring, controlled by elapsed orbits.
6. Math: render rail labels and explanatory formulas in mathematical type, preserving readout keys and existing hooks.

- Second review: visible references to the attracting body use M on Stretch and the body’s name elsewhere.
- Second review: Stretch includes a four-stage subtraction demonstration, with shared centre pulls, tip gaps, removal and magnification. Its arrows follow the current distance and use the right panel’s residual scale.
- Tab 2 month chart (2026-11-04): the y-axis was ±0.45 m and clipped the spring peaks (+0.53 m); it now runs −0.42 … +0.69 m, the spring/neap labels join the phase labels in the top row (they sat on the spring peaks), and the About text notes that high tide rises H above the undisturbed sea while low tide falls only H/2 below it.

- Roche plunge, second review (2026-11-05): the plunge view is framed on the black hole, r_t circle, star or bound stream and path (black hole may be off-centre; eased); a framed close-up inset carries the black hole, tidal radius and disc once the view exceeds ~8 r_t; stream labels avoid the stream; the fallback chart uses decade ticks as plain numbers, a snapped y range, "M☉ per year", "t⁻⁵ᐟ³" and a t_min tick; the circular-mode arc label sits beside the arc (whole km).

- Friction lower panel: labelled Earth and Moon use schematic sizes and distance; the Moon has a rocky tidal bulge and rotating maria. The geometry is exposed through `frictionGeom()`. The "Earth" label sits on the side of the Earth disc facing away from the Moon, so it never approaches the Moon or its bulge.

### Roche debris revision: circular-orbit shear

The Roche display now treats the locked moon as 24 initially co-rotating fragments, with initial radial offsets evenly spaced from −1.5 to +1.5 moon radii. `orbitalPeriod(r,rhoP,Rp)` uses the mass from the planet density and radius; `hillDebris(x0,orbits)` returns the radial and along-orbit Hill solution in metres, and `debrisPieces` includes the unwrapped orbital azimuth. `debrisRadialSpread` gives the instantaneous width, `ringWidth` the 12 R_m guiding-centre width, `ringCloseOrbits(r,Rm)` the secular closure estimate r/(18 R_m), and `ringCloseTime` that estimate times the period. The instantaneous radial spread oscillates between 3 and 21 R_m under the stated Hill solution; 12 R_m is the spread of the guiding centres, not its maximum envelope. `ringBandWidth(Rm)` = 7/4 · `ringWidth` = 21 R_m is the full band including the 3·x0 in-and-out swing (273 km in the lecture case). The ring-width readout shows both ("156 km (273 km with the in-and-out swing)"), and the About text states both values from the current R_m. These linearized solutions neglect collisions, fragment gravity and oblateness.

At break-up the enlarged radial moon sheds pieces at its tips. Thereafter the main view puts coral fragments at their physical azimuths on the moon's orbit, closing to a thin circle at the closure estimate. A framed moving-frame close-up (since 2026-11-05 a full-height blow-up joined to a callout, see below; the corner inset it replaced had along-orbit horizontal) has separate kilometre scales for along-orbit and radial distances, and the logarithmic elapsed-orbit control covers 0 and 0.1–10,000 orbits. The rail reports period, initial spread, closure time and the guiding-centre width; `window.__tidal.rocheDebris()` exposes the physical pieces and inset rectangle. The earlier schematic radial chain and enlarged-radius shear descriptions in this document are superseded by this revision.

Section 12 revision note: item 5 is replaced by the physical Hill-motion and narrow-ring display above. For the stated Saturn density and radius at 3 R_p, the period is 20.649 h, rather than 21.6 h; the corresponding closure time is about 1.81 years.

Plunge mode keeps its corner close-up inset (run k3 tried a callout and full-height blow-up there and was reverted on 2026-11-05): a fixed-scale blow-up stays nearly empty because the star and stream cross it in about 0.05 d, and the room it takes forces the main view to zoom out.

### Roche contrast: stellar tidal disruption

The Roche tab also offers **Star passing a black hole**. A Sun-like, uniform-density star passes a 10⁶-solar-mass black hole on a parabola; the pericentre control selects 0.5–2 tidal radii. Inside the tidal radius the frozen-in model gives 40 weighted radial slices their common pericentre velocity. Their exact two-body ellipses and hyperbolas are propagated with safeguarded Kepler solvers (Barker's equation near parabolic eccentricity). Outside the radius the star passes intact. `tidalRadius`, `plungePieces`, `propagatePlunge`, `plungeSummary`, and `fallbackRate` expose the SI model. Fallback uses the linear energy-to-position relation for a uniform sphere; the most-bound period uses the exact frozen-in energy. The disc is schematic, and its opacity represents the returned bound fraction.

The main view shows the incoming parabola, tidal radius, magnified star or coloured stream, and a distance scale. The lower log–log chart shows the fallback and its late-time t⁻⁵ᐟ³ reference. Time uses an asinh slider; playback traverses it in about ten seconds. The black-hole disc is drawn after the accretion ring (so the glow does not tint it) and before the debris; the bound and unbound labels anchor to the in-canvas piece of their group nearest the middle (bound) or the far end (unbound) of the stream, since the unbound tail leaves the canvas. The hook `__tidal.plunge()` reports radii, offsets, energies, positions and view half-width in SI (metres and m²/s²), times in days, and peak fallback in solar masses per year. `set('roche', {mode:'plunge', rpOverRt, tDays})` selects and updates this mode.

**Plunge display (second Roche review, 2026-11-05).** The view is no longer centred on the black hole. It is the equal-scale fit, with about 10 % padding, of the bounding box of the black hole, the r_t circle, the star (before pericentre, and for r_p > r_t at all times) or every bound piece that has not yet returned (after it), and the incoming path (from the star to pericentre, or the last two r_p of the path, y from −2 r_p to 0, once the stream exists). A bound piece whose orbital period 2π√(a³/GM) has elapsed since pericentre counts as returned gas that has joined the disc, and is no longer drawn in the stream: no dot, no polyline segment, not in the framing box or the inset (the disc ring's brightness shows the returned mass fraction; `plunge().pieces[i].returned` flags it), so the stream thins with time and the bound label is omitted once no bound piece remains. Unbound pieces may leave the canvas. The frame is stored as the screen position of the black hole plus the logarithm of the scale; it eases towards its target (time constant 0.16 s, faster if the star or a bound piece would otherwise leave the canvas) and `__tidal.render()` snaps it, so headless checks need no `requestAnimationFrame`. Before pericentre the star is drawn with radius max(6 px, 20 R☉), stretched along the line to the black hole near r_t; its label reads "star drawn 20× larger" only when the 20× size is used, else "star (drawn enlarged)". The incoming and outgoing parabola is a brighter dotted line. An au scale bar stays at the lower left.

**Close-up inset.** When the r_t circle would be smaller than 7.5 % of the smaller canvas dimension (the view half-width exceeds about 8 r_t), a framed inset about 28 % of the canvas width appears. The main-view frame is fitted to the canvas minus the inset (top, bottom, left or right band, whichever leaves the largest scale), and the corner is the one furthest from every drawn item (black hole, star, pieces, stream polyline, scale bar). It shows the black hole, the dashed r_t circle, the glowing disc ring at 2 r_p (opacity = bound mass returned so far, only in disrupting passes after t_min), pieces inside its range (1.18 × the larger of r_t and 2 r_p) and its own au bar, under the title "close-up near the black hole". The labels "black hole, 10⁶ M☉", "tidal radius" and "returning gas forms an accretion disc (schematic)" then live in the inset (the last wraps onto two or more lines in a narrow inset) and not in the main view, where a faint circle and line connect the black hole to the inset. The inset box is registered in `labelBoxes()` as "close-up inset", exactly as in circular mode, and the hook `plunge()` also returns `frame` {bx,by,scale} (canvas px of the black hole, px per metre), `inset` {x,y,w,h}, `insetView` {cx,cy,scale,halfWidth,bhR} and `settled`.

**Labels.** `placeLabel` searches positions around anchors on the label's own part and rejects any that overlap another label, the polyline between the drawn pieces, a piece (with a few px clearance), the black hole disc, the star, the scale bar or the inset; soft obstacles (the circles) are avoided when possible. Stream labels sit within about 28 px of their own stretch of stream.

**Fallback chart axes.** Ticks are plain decades (0.0001 … 100), the title is "M☉ per year", the y range runs from the decade at or below peak/1000 to the decade at or above 3 × peak (so the peak sits in the top third), and the x range starts at the decade at or below min(10 d, t_min/2) (1 d at r_p = 0.5 r_t, where the peak is 7.6 M☉/yr at 8 d). The slope label is "falls off as t⁻⁵ᐟ³". A short tick at t_min carries "first gas returns (≈ 40 d)" (value from `plungeSummary`; 5.0 d at r_p = 0.5 r_t). `__tidal.fallbackChart()` returns the ranges, tick strings and tick position.

**Circular mode arc label.** "debris arc: about N km wide, too thin to see here" (longer wordings follow as fall-backs) is placed by the same search within 60 px of the nearest debris dot (or the closed ring; usually 7-45 px), clear of the planet disc, the other labels and the connector wedge, in at most three lines, with a leader line when it is more than 12 px away. Candidate positions include the area just below the callout (left of the bottom connector). N is rounded to whole km.

- Roche circular display, callout and full-height blow-up, same orientation as the main view (2026-11-05): the instructor rejected the corner inset because its along-orbit axis ran horizontally while the main view's runs vertically at the moon. The circular mode now reserves the right `clamp(0.38 w, 200, 380)` px at full height (all states) for a blow-up box, the main scene shrinks only when it must to end 40 px left of it, a callout rectangle at the moon is joined to the box by two connectors and a faint wedge, and the blow-up keeps radial horizontal (toward the planet left) and along-orbit vertical (ahead up). Details, axis rules and the `rocheDebris()` additions (`calloutBox`, `connectors`, `blowup`, `planet`, `stage`; `insetBox` now always set in circular mode) are in section 3.5, "Circular display". `rocheInsetLayout`/`drawRocheInset` are removed.
