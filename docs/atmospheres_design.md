# Design spec: Lecture 13 (Atmospheres) pages

Two new pages illustrate Lecture 13 ("Physical Processes: Atmospheres"). Each decision below is final unless it is marked as the implementer's choice. Numbers in **Tests** were computed independently by the supervisor (2026-11-09) and are the acceptance values.

| | Page A | Page B |
|---|---|---|
| Lecture slides | 2–6 (kinetic theory, escape, retention) | 7–13 (albedo, temperature, hydrostatics, Earth's layers, magnetosphere) |
| Page | `html/atmospheric_escape.html` | `html/planet_atmospheres.html` |
| Model (pure ES module, no DOM) | `html/atmospheric_escape_model.js` | `html/planet_atmospheres_model.js` |
| Tests (`node:test`, same pattern as `tests/tidal_forces_model.test.cjs`) | `tests/atmospheric_escape_model.test.cjs` | `tests/planet_atmospheres_model.test.cjs` |
| `<title>` | `Atmospheric Escape — PHYS 320` | `Planet Atmospheres — PHYS 320` |
| Brand title / sub | `ATMOSPHERIC ESCAPE` / `‹ PHYS 320 Visualizations · Atmospheres` | `PLANET ATMOSPHERES` / `‹ PHYS 320 Visualizations · Temperature & Structure` |
| Tabs (`data-tab` → label) | `maxwell` → **Speed distribution**, `escape` → **Escape tail**, `retain` → **Who keeps what** | `albedo` → **Sunlight & albedo**, `scale` → **Scale height**, `layers` → **Earth's layers**, `magneto` → **Magnetosphere** |
| Default tab | `maxwell` | `albedo` |
| Test hook | `window.__atmo` | `window.__planatmo` |
| Thumbnail (supervisor adds later) | `?tab=maxwell&embed=1` | `?tab=albedo&embed=1` |

Do not edit `index.html`, `README.md` or `tools/make_thumbs.sh`; the supervisor wires both pages in afterwards.

---

## 0. Shared conventions (both pages)

**Skeleton.** Copy the page skeleton from `html/tidal_forces.html` (the most recently reviewed page): the `:root` tokens and dark theme, `#app` grid (44 px topbar + body), `.topbar/.brand/.tabbar/.segmented`, the rail of cards (`howto`, `controlsCard`, Readouts `metrics`, `notice` "What to notice", `about` "About this model"), the `.workspace` grid of `#mainPanel` / `#hSplitter` / `#subPanel` / `#stripPanel` with the `@media(min-width:901px)` row override, `.panel-header/.panel-title/.panel-readouts/.panel-caption`, the 4-column `#stripBody` grid with one full-width `<p>` note, the splitters, `canvasSize()`, KaTeX include lines (`../vendor/katex/...`, non-deferred), `renderInline`, `fitFormulas`, `mathText/proseMath`, the `@media(max-width:900px)` and `520px` stacks, and the `body.embed` rules (hide topbar, rail, splitters, sub panel and strip; main panel fills the viewport). Pages load their model with `import ... from './<name>_model.js'`, so they need an HTTP server (`python3 -m http.server 8321` from the repo root).

**URL params:** `?tab=<name>`, `?embed=1`. Rendering is `paint()` on every state change; `requestAnimationFrame` runs only while something animates.

**Each tab has:** a How-to card (2–4 numbered steps), controls, 4–6 readouts, a "What to notice" card (2–4 short bullets), an "About this model" card (assumptions, sources), a main canvas, a sub canvas, and exactly 4 formula cells + 1 note `<p>` in the strip.

**Canvas colours** (same constants as tidal_forces): `C={amber:'#ffcc66',cyan:'#56c7d9',magenta:'#ee65be',purple:'#a99bff',coral:'#ff7f66',green:'#56dc72',muted:'#979ea6',text:'#e7e9eb',grid:'rgba(151,158,166,.20)',bg:'#0d1015'}`.
Roles on both pages:
- **amber**: the Sun, sunlight, solar wind, the escape speed v_esc.
- **cyan**: the gas, its distribution curve, pressure forces, v_p, magnetic field lines.
- **coral**: hot / lost / escaping (the tail beyond v_esc, "lost" verdicts, infrared emission, the real temperature profile).
- **green**: kept / retained, weight mg, the "6× rule" marker.
- **magenta**: the current-value marker on any chart, v_rms, the magnetopause stand-off point.
- **purple**: ⟨v⟩, secondary curves, ozone.
- **muted**: grids, reference lines, labels.

Canvas text: `11px Inter, ui-sans-serif, -apple-system, ...` for labels (never smaller than 10 px), `bold 12px` for in-canvas titles. Subscripts in canvas labels: reuse tidal_forces' canvas math-label helper (`v_{esc}` style) rather than writing "vesc". Every chart axis has a title with units. Arrowheads 7 px filled, shaft 1.6 px.

**Label hygiene (acceptance).** Every page keeps an array of the canvas label rectangles it drew in the last paint (main and sub canvases separately) and exposes them as `hook.labelBoxes()` / `hook.subLabelBoxes()`. No two label boxes may overlap, and every box must lie inside its canvas. Use simple greedy collision avoidance (try offsets, else drop the lower-priority label).

**Hook (both pages):** `{model, K, get tab, setTab(name), state(), set(tabName, patch), readouts(), labelBoxes(), subLabelBoxes(), render()}`. `readouts()` returns the numbers shown in the Readouts card as plain numbers (SI unless the key says otherwise).

**Numbers on screen** use 3 significant figures; very small or large values use `3.0 × 10⁻²³` style (KaTeX or Unicode superscripts), never `e-23`.

---

## Page A — Atmospheric Escape (`atmospheric_escape*.js/html`)

### A.1 Model (`html/atmospheric_escape_model.js`)

```
K = { kB: 1.380649e-23, AMU: 1.66054e-27, G: 6.674e-11, YEAR: 3.15576e7, AGE_SS_YR: 4.5e9 }
```

`SPECIES` (id, label for canvas with subscripts, mass A in amu):
H 1.008, H2 2.016, He 4.0026, CH4 16.043, NH3 17.031, H2O 18.015, N2 28.014, O2 31.998, Ar 39.948, CO2 44.009, Xe 131.29.

`BODIES` (name, M kg, R m, Ttyp K, Tup K). Ttyp = "typical temperature" as used on the lecture's slide-5 figure (Earth and Moon use the slides' 300 K); Tup = approximate temperature of the upper atmosphere / exobase where escape happens (for airless bodies, the dayside surface). R for giant planets is the equatorial 1-bar radius.

| name | M | R | Ttyp | Tup |
|---|---|---|---|---|
| Mercury | 3.3011e23 | 2.4397e6 | 470 | 700 |
| Venus | 4.8675e24 | 6.0518e6 | 325 | 300 |
| Earth | 5.9722e24 | 6.3710e6 | 300 | 1000 |
| Moon | 7.346e22 | 1.7374e6 | 300 | 390 |
| Mars | 6.4171e23 | 3.3895e6 | 220 | 270 |
| Jupiter | 1.89813e27 | 7.1492e7 | 125 | 1000 |
| Ganymede | 1.4819e23 | 2.6341e6 | 120 | 150 |
| Saturn | 5.6834e26 | 6.0268e7 | 90 | 450 |
| Titan | 1.3452e23 | 2.5747e6 | 90 | 150 |
| Uranus | 8.6813e25 | 2.5559e7 | 75 | 800 |
| Neptune | 1.02413e26 | 2.4764e7 | 65 | 750 |
| Triton | 2.139e22 | 1.3534e6 | 60 | 95 |
| Pluto | 1.303e22 | 1.1883e6 | 40 | 70 |

Functions (SI):
- `speeds(A, T)` → `{vp, vmean, vrms}` with `m = A*AMU`: `vp=√(2kT/m)`, `vmean=√(8kT/(πm))`, `vrms=√(3kT/m)`.
- `maxwellPdf(v, A, T)` = `4π (m/2πkT)^{3/2} v² exp(−mv²/2kT)` (per m/s; integrates to 1).
- `vesc(M, R)` = `√(2GM/R)`.
- `erfc(x)`: Numerical Recipes `erfcc` (Chebyshev form `t·exp(−x²−1.26551223+t·(1.00002368+…))`), which keeps relative accuracy for large x. Also export `log10Erfc(x)` computed from the same form without the final `exp` so values below 1e-300 do not underflow.
- `tailFraction(x)` = fraction of molecules with speed > x·v_p = `erfc(x) + (2x/√π) e^{−x²}`; and `log10TailFraction(x)` in log space.
- `jeans(M, R, A, T)` → `{lambda, ratio, log10Years, years}`: `λ = v_esc²/v_p²` (= GMm/kTR), `ratio = v_esc/v_rms`, escape flux per particle at the exobase `Φ/n = v_p(1+λ)e^{−λ}/(2√π)`, column `n·H` with `H = R/λ`, so `t = (R/λ)·2√π·e^{λ}/(v_p(1+λ))`. Compute `log10Years` in log space; `years` may be `Infinity`.
- `retains(body, A, T, factor)` → `vesc > factor·vrms`.

Gas simulation (deterministic with a seeded RNG, e.g. mulberry32; export it):
- `createGas({N, A, T, init, seed})`; `init ∈ {'beam','maxwell','hotcold'}`. Positions uniform in the unit cube. `beam`: every speed = `vrms(T)`, isotropic random directions. `maxwell`: each velocity component Normal(0, √(kT/m)) (Box–Muller), then rescale all velocities so the mean of v² is exactly 3kT/m. `hotcold`: half the particles at speed `vrms(1.6T)`, half at `vrms(0.4T)`, isotropic. In all cases ⟨v²⟩ = 3kT/m, so the end state is the Maxwellian at T.
- `collide(v1, v2, rng)` (equal masses): `vcm=(v1+v2)/2`, `g=|v1−v2|`, random isotropic unit vector n̂, `v1'=vcm+n̂g/2`, `v2'=vcm−n̂g/2`. Conserves momentum and energy exactly. Collision probability does not depend on relative speed (Maxwell-molecule model); this does not change the equilibrium.
- `stepGas(gas, dt, {collRate, visScale, rng})`: move `pos += vel·visScale·dt` (visScale in box-lengths per (m/s) per s; page uses `0.25/1000`, i.e. 1 km/s crosses a quarter of the box per second), reflect specularly at the six walls, then perform `round(0.5·N·collRate·dt)` collisions between random pairs drawn from the same cell of a 3×3×3 grid (fall back to a random pair if the cell has <2 particles); keep a fractional carry so the average rate is exact. Track `collisionsPerParticle`. Return `{pairs}`, the list of `[i, j]` index pairs that collided in this step (the page uses it for collision flashes and the tracked molecule's collision dots).
- `gasStats(gas)` → `{Tkin, vmeanSq, kurt, speeds}` with `Tkin = m⟨v²⟩/(3k)`, `kurt = ⟨v⁴⟩/⟨v²⟩²` (1 for the beam, 5/3 for a Maxwellian).
- `rescaleGas(gas, A2, T2)`: multiply every velocity by `√((T2/T)·(A/A2))` and store the new A, T (the relaxation state is kept).

**Tests** (`tests/atmospheric_escape_model.test.cjs`):
1. O₂ at 300 K: vp = 394.8, vmean = 445.5, vrms = 483.6 m/s (±0.5).
2. `maxwellPdf` for N₂ at 300 K integrates to 1 ± 1e-4 (trapezoid, 0–5000 m/s).
3. `tailFraction(0)=1`; `tailFraction(√1.5)=0.39163` (±1e-4); `tailFraction(6√1.5)=2.956e-23` (relative ±1e-3); `log10TailFraction(30)` finite and ≈ −389.3 (±0.2).
4. v_esc (km/s, ±0.01): Earth 11.186, Moon 2.376, Mars 5.027, Jupiter 59.531, Triton 1.452.
5. Jeans: Earth with ratio 6 (choose T so that v_esc/v_rms = 6, any species) → log10Years = 16.65 ± 0.05; ratio 4 → 4.14 ± 0.05; ratio 5 → 9.72 ± 0.05. Moon O₂ 300 K: ratio 4.913 (±0.005), λ = 36.20 (±0.02), years ≈ 1.93e9 (log10 9.29 ± 0.05). Earth He 1000 K: years ≈ 4.5e6 (log10 6.65 ± 0.05).
6. `collide`: momentum and energy conserved to 1e-12 relative for 1000 random pairs.
7. `stepGas` returns `pairs` whose total count over 500 steps equals round(0.5·N·collRate·total time) within 1. Gas, N = 2000, beam, seed 1: kinetic energy conserved to 1e-9 relative over 500 steps; starts with kurt = 1.000; after collisionsPerParticle ≥ 8, kurt within 0.05 of 5/3 and the Kolmogorov–Smirnov distance between the speeds and the Maxwellian CDF < 0.04.
8. `retains`: Earth/He at 300 K with factor 6 → true; at 1000 K → false. Moon/O₂ at 300 K → false. Earth/H₂O at 1000 K → true.

### A.2 Tab `maxwell` — Speed distribution (slides 2–3)

Story (revised 2026-11-09 at the owner's request: "I want to intuitively show how random molecule movements form a Maxwell curve"). Random motion plus pairwise collisions alone turn any start into the Maxwell curve. The tab must make this visible: individual collisions trading energy, the histogram spreading from a spike into the Maxwell hump, and one molecule whose speed, followed over time, visits speeds with the same Maxwell frequencies. A working prototype of this behaviour was shown to the owner and is the reference for feel and pacing.

**Main panel** "Gas in a box → Maxwell curve". Left ~52 %: the unit cube wireframe in a fixed oblique projection (x right, y up, depth z drawn up-right by (0.36, 0.28) of the edge; muted, 1 px). N = 500 molecules (300 below 520 px width) as dots of radius 2.7 − 1.0·z px and alpha 1 − 0.45·z, drawn back to front, coloured by speed on the sequential ramp #3b4cc0 → #56c7d9 → #ffcc66 → #fff4d6 over 0–3 v_p, with a small "slow → fast" ramp legend in the bottom-right corner. The tracked molecule (index 0) is drawn on top: magenta, radius 4.5 px, 1 px white outline, with a fading magenta trail of its last 1.5 s of positions; label "● tracked molecule" bottom-left. Collision flashes: every collision of the tracked molecule draws a magenta line to its partner plus an expanding ring at the midpoint, fading over 0.6 s; about 3 % of all other collisions draw the same in faint white, fading over 0.35 s, so collisions are visible without clutter. Right ~48 %: speed histogram, 30 bins over 0 → 3.2 v_p, density-normalised, bars cyan at 45 % alpha, smoothed in time with an exponential moving average (τ = 0.35 s; reset to the instantaneous histogram on every restart) so the shape reads despite N = 500; y-max fixed at 1.6× the Maxwell peak, clipped bars get "↑". Overlays: the analytic Maxwell curve (text colour, 2 px, labelled "Maxwell curve"); dashed v_p (cyan), ⟨v⟩ (purple), v_rms (magenta) markers, labelled; ghost snapshots: when collisions per molecule first reaches 0.5, 1 and 2, copy the smoothed histogram and keep drawing it as an amber dashed step line (later ones more opaque), legend "dashed: after 0.5, 1, 2 collisions each" listing only the snapshots taken so far; the tracked molecule's current speed as a magenta triangle under the x axis. With the "One molecule's history" toggle on, also draw the tracked molecule's time-share histogram (fraction of time it has spent in each bin since the restart, density-normalised) as a magenta step line with legend "one molecule, time-share (N s)"; with Fast-forward it converges to the same Maxwell curve. x axis "speed v (m/s)" with ticks in m/s; y axis "fraction per m/s". Header readouts: species, T, "collisions/molecule: 4.2".
Caption: "Molecules move at random and collide in pairs, trading energy. Start them all at one speed: the spike spreads, and after a few collisions each the histogram settles onto the Maxwell curve set by T and m alone."

**Controls:** species chips H₂, He, H₂O, N₂, O₂ (default), CO₂, Xe; T slider 20–2000 K (log scale, default 300) with number input; Start chips "Same speed" (default), "Already Maxwellian", "Hot + cold"; collision-rate slider 0–5 per molecule per second (default 1); Play/Pause (default playing), Restart, and a "Fast-forward ×5" toggle (5× simulated time per frame, same physics); toggle "One molecule's history" (default off); Compare chips for the sub panel: "One molecule" (default), "Why this shape", "Species", "Temperatures". Changing T or species calls `rescaleGas` (no restart).

**Readouts:** v_p, ⟨v⟩, v_rms (m/s); T from kinetic energy (K; stays equal to T); total kinetic energy relative to the start (shows 1.000: conserved); shape index ⟨v⁴⟩/⟨v²⟩² (1.00 → 1.67, label "1.67 = Maxwellian"); collisions per molecule; tracked molecule's speed now (m/s).

**Sub panel** (by Compare):
- "One molecule" (default), title "One molecule's speed over time": the tracked molecule's speed vs simulated time over the last 16 s (magenta 1.6 px line, white dots at each of its collisions, dashed line at v_p labelled "v_p"), y from 0 to 3.2 v_p in m/s. Note: "Between collisions its speed stays constant; each collision kicks it up or down at random."
- "Why this shape", title "Why the Maxwell curve has this shape": left half, a live histogram of one velocity component v_x of all molecules (30 bins over ±3 v_p) with the analytic Gaussian e^{−v_x²/v_p²}/(√π v_p), label "each direction: a bell curve"; right half, analytic curves over 0 → 3.2 v_p, each scaled to peak 1: e^{−v²/v_p²} (purple, "chance per velocity: falls with energy"), (v/v_p)² (coral, "velocities with speed v: shell area 4πv²"), and their product (text colour, 2 px, "product = Maxwell curve"). Note: "Collisions make every direction equally likely and give each velocity component a bell curve. Counting all the directions that share one speed multiplies by 4πv², which turns the bell into the lopsided Maxwell hump."
- "Species", title "Same T, different masses": analytic curves at the current T for H₂, He, H₂O, N₂, O₂, CO₂ (x: speed in km/s, 0 → 3.2·v_p(He); y: fraction per km/s), each labelled near its peak with labels kept apart (leader lines where needed); the selected species 2.5 px cyan, others 1.2 px muted.
- "Temperatures": the selected species at T/2, T, 2T (purple, cyan, coral), labelled.

**What to notice:** (1) From "Same speed" the spike spreads at the first collisions; after about 2–3 collisions per molecule the histogram already sits on the Maxwell curve (compare the dashed snapshots). (2) Follow the magenta molecule: its speed jumps at every collision, sometimes far above v_p. Over a long time (Fast-forward with "One molecule's history") the time it spends at each speed follows the same Maxwell curve as the whole crowd at one instant. (3) Total kinetic energy never changes; collisions only share it out, and the Maxwell curve is the overwhelmingly most likely way to share it. (4) Speeds scale as √(T/m): 4× the temperature doubles every speed; H₂ is 4× faster than O₂ at the same T.

#### A.2b Injection and development (added 2026-11-09, owner request)

Owner's words: control the number of molecules, the molecular mass and the temperature; inject the particles in a distribution that is not random; show how many rounds of collisions turn it into the Maxwellian, so students see what the distribution means and why physics produces it. The relaxed animation above stays as the end state.

**Controls (replace the A.2 control list where they overlap):**
- "Molecules N": slider with steps 50, 100, 200, 500 (default; 300 below 520 px width), 1000, 2000; changing N re-injects with the current start.
- "Gas": species chips H₂, He, H₂O, N₂, O₂ (default), CO₂, Xe plus a "Molecular mass" slider 1–200 u (step 1) with number input; a chip sets the slider, moving the slider deselects the chips (label "custom"). Readout of m in kg.
- "Temperature": the T slider (20–2000 K, log, default 300). Rail note: "Temperature fixes the average kinetic energy per molecule, ½m⟨v²⟩ = (3/2)kT. It does not fix each molecule's speed."
- "Inject as" chips, all with ⟨v²⟩ = 3kT/m so every start relaxes to the same Maxwellian: "Same speed" (default; every speed v_rms, random directions), "Two opposite beams" (half at +v_rms x̂, half at −v_rms x̂), "Hot + cold" (half at v_rms(1.6T), half at v_rms(0.4T), random directions), "Flat" (speeds uniform on 0 → √3·v_rms, random directions), "Already Maxwellian". Button "Inject again" (replaces Restart) re-injects with fresh positions and resets collisions, snapshots, smoothing and the development record.
- Collisions: rate slider 0–5 per molecule per animation second (default 1). At 0 a note appears: "Collisions off: walls only reverse velocities, so no speed ever changes and the histogram stays as injected." Button "Step: ½ collision each": runs the simulation (with motion) until collisions per molecule has grown by 0.5, then pauses. Play/Pause and "Fast-forward ×5" as before.
- Animation pacing: positions move so that v_p of the current gas crosses 0.32 of the box edge per animation second, whatever the gas and T (the box is not to scale); the histogram axis and readouts carry the real speeds in m/s. (This replaces the fixed visScale for the page; keep stepGas's visScale argument.)

**Sub panel, new Compare mode "Development" (becomes the default; order: Development, One molecule, Why this shape, Species, Temperatures):** title "How collisions build the Maxwell curve". Top ~60 %: a film strip of six small histograms (same bins as the main histogram) captured when collisions per molecule first reaches 0, ½, 1, 2, 4 and 8, each with the Maxwell curve in text colour and a caption "0", "½", "1", "2", "4", "8 collisions each"; frames not reached yet are drawn as empty outlined boxes captioned "not yet". Bottom ~40 %: "difference from Maxwell" (half the area between the histogram and the Maxwell curve, 0–100 %) against collisions per molecule (x 0–10, linear), drawn as a cyan line that grows live, plus a muted band at the noise floor expected for N molecules (compute it once per N by sampling Maxwellian gases with the model, or use ≈ 0.6·√(bins/N) clipped to the axis; label "noise floor for N = 500"). Note: "Each collision is random, but it conserves energy and momentum. There are overwhelmingly more ways to share a fixed total energy among N molecules in the Maxwell pattern than in any other, so random collisions drive any start into it and keep it there."

**Readouts (add):** N; molecular mass (u); difference from Maxwell (%).

**What to notice (add, as the first two items):** (1) Set collisions to 0 and press Play: the molecules fly and bounce, but the histogram never changes. Motion alone does not make a Maxwell curve; collisions do. (2) Inject "Two opposite beams" or "Flat" and press "Step: ½ collision each" a few times: the film strip shows the shape after each stage; by about 4 collisions each every start looks the same.

**Model (add to A.1):** `createGas` takes `mass` in u (A) as before, and `init` ∈ {'beam', 'twobeams', 'hotcold', 'flat', 'maxwell'} as above. Add `maxwellDistance(speeds, A, T, nBins = 30, uMax = 3.2)` = ½ Σ|h_i − p_i| over bins of width uMax·v_p/nBins (h_i the sample fraction in bin i, p_i the Maxwellian probability of bin i from the CDF; the tail above uMax·v_p counts as one more bin), in 0–1. Tests: beam start gives > 0.8; a 'maxwell' start with N = 2000 gives < 0.08; with collRate = 0, 200 steps leave every speed unchanged to 1e-12 relative; 'twobeams' and 'flat' starts have ⟨v²⟩ = 3kT/m to 1e-12 and total momentum 0 (twobeams) to 1e-9 relative.

**Hook (add):** state keys N, mass, start, collRate; `step(halfCollision=true)`; `development()` → {frames: [{c, filled}], distance: [[c, d], …]}.

**Acceptance (add):** with rate 0, five animation seconds of Play leave difference from Maxwell unchanged within 1 % absolute; from "Same speed" at default settings the six frames fill in order and the difference falls below noise floor + 5 % by 8 collisions each; moving the mass slider from 32 to 2 multiplies the v_p readout by 4 (±1 %); N = 2000 runs without dropping below 30 fps on the supervisor's Mac (report the frame time measured in the browser).

#### A.2c Design-review revision (2026-11-10; supersedes A.2 and A.2b where they differ)

Source: a design review requested by the owner, adopted by the supervisor. Goal unchanged: students see what a speed distribution is, how collisions build the Maxwell curve, and why it has that shape.

**Guided path.** The How-to-use card becomes four numbered steps, each with a small "Set up" link that applies a preset (controls stay free afterwards):
1. "What a distribution is": Same speed, collisions 0, Play. Molecules fly and bounce; the histogram is one spike and never changes. Hover or tap a bar. Then set N = 50: the bars jump.
2. "Collisions build it": rate 1, press "Step: ½ collision each" repeatedly; the film strip fills. Re-inject as Two opposite beams and as Hot + cold: same final curve, same T readout.
3. "Why this shape": Compare → Why this shape, inject Two opposite beams (the v_x histogram starts as two spikes at ±v_rms and melts into a bell); optional "Boltzmann line" toggle.
4. "What T and m do": drag T, switch species: the hump stretches as √(T/m); watch the coral tail beyond 2 v_p; optionally One molecule's history with Fast-forward.

**Histogram in counts, linked to the dots.** y axis "molecules per bin" (30 bins over 0–3.2 v_p, stored in units of v_p so a rescale keeps them); the Maxwell curve drawn as the expected count N·p_i, labelled "Maxwell: expected number per bin"; y-max 1.6× the Maxwell peak count. Hover (tap on touch) a bar: ring exactly those molecules in white in the box and print "73 of 500 between 400 and 500 m/s" above the bar. Caption ends "Hover a bar to see which molecules it counts."

**Smoothing by N.** No time smoothing when N ≤ 100 (the ragged, jumping bars are part of the lesson; caption adds "Few molecules: the bars jump. A distribution describes many."); EMA τ = 0.35 s for N ≥ 200.

**Main histogram markers.** Only v_p (cyan dashed) and v_rms (magenta dashed); ⟨v⟩ moves to the Species/Temperatures sub panels and the strip. Ghost snapshots at ½, 1, 2 collisions each stay (one-line legend). Coral fill under the bars beyond 2 v_p with the label "faster than 2 v_p: 23 of 500 (Maxwell: 4.6 %)"; later tabs reuse this coral for the escaping tail. Tracked speed stays a magenta triangle. At most 8 label boxes on the main histogram at default.

**Tracking toggle.** "Track one molecule" (default on) shows or hides the tracked molecule's colour, trail, flashes and triangle; "One molecule's history" (default off) as before, and its legend appears only when on.

**Temperature made visible.** Readout "⟨½mv²⟩ = 6.21×10⁻²¹ J → T = 300 K"; it equals the slider for every injection at 0 collisions (Same speed and Hot + cold read 300 K although no molecule sits on the Maxwell curve). T and mass rescale velocities (never re-inject); N and Inject chips re-inject. While T or mass is dragged the histogram's m/s axis stays fixed so the hump visibly stretches or shrinks; 0.5 s after release the axis refits (animated).

**Pacing (replaces A.2b's v_p normalisation).** Screen speed factor = √(v_p / v_p(O₂, 300 K)) applied to a base of 0.32 box edge per second at O₂ 300 K, so hotter or lighter gas always looks faster without blurring (range about 0.32–3.8× over the sliders). Hook `visScale()` returns the current factor.

**Readouts (six).** v_p; v_rms; ⟨½mv²⟩ → T; total kinetic energy / start (1.000); difference from Maxwell (%); faster than 2 v_p (count, %, and Maxwell's 4.6 %). N, mass and collisions per molecule move to the header: "O₂ · N = 500 · 300 K · collisions each 4.2" (short form at 375 px: "O₂ · 300 K · 4.2 coll."). Shape index stays in the hook only.

**Why this shape (sub panel).** As A.2 (live v_x histogram of the same molecules labelled "one of three velocity components", Gaussian; then e^{−v²/v_p²} × 4πv² = Maxwell), plus a toggle "Boltzmann line": plot ln(count_i / v_i²) against ½m v_i² for bins with ≥ 5 counts; the points fall on a straight line of slope −1/kT; print the fitted "slope → T = 298 K" next to the slider value. Never show a 2-D speed distribution.

**Development (sub panel, default).** As A.2b, with two changes: the noise floor is the median difference of 20 Maxwellian samples of size N computed with the model (cache per N; it is about 8 % at N = 500), and film frames are captured on threshold crossings inside every sub-step so Fast-forward never skips one.

**Model changes.** Collision partners come from a g×g×g grid with g = max(2, round(∛(N/6))) (about 6 molecules per cell; fall back to a random pair only when the cell has fewer than 2); the tracked molecule (index 0) takes the nearest molecule in its cell, so flash lines join near neighbours. Add `noiseFloor(N, A, T, seed)`, `binMembers(gas, i)` helpers as needed.

**About (add).** "The box, the collision rate and the motion are slowed and enlarged for viewing. In real air at sea level a molecule collides about 7×10⁹ times per second and travels about 70 nm between collisions."

**375 px.** Rail stacks above; the main panel stacks the box (square, about 45 % of the height) over the histogram; film strip 3 × 2; tap replaces hover.

**Acceptance (replaces A.2b's list for this tab).**
1. Rate 0, 5 s Play: every speed unchanged to 1e-9 relative; difference unchanged; KE ratio 1.000.
2. Every Inject chip at 0 collisions: T readout equals the slider to 1e-6 relative; total momentum 0 (two beams) to 1e-9.
3. Same speed default: frames fill in order; difference < floor + 5 % by 8 collisions each; T readout equals the slider at all times.
4. Two beams: at 0 collisions the v_x histogram has exactly two non-empty bins and v_y = v_z = 0; at ≥ 4 collisions each the KS distance of v_x to Normal(0, √(kT/m)) < 0.10 at N = 500 (a state that has not relaxed gives > 0.3; 0.06 would sit at the 5 % critical value and fail one correct run in twenty).
5. Mass 32 → 2 multiplies v_p and v_rms by 4 (±1 %); T 300 → 1200 doubles them; visScale() is larger at 1200 K than at 300 K and at 2 u than at 32 u.
6. N = 2000 after ≥ 8 collisions each: fraction beyond 2 v_p within ±1.5 % absolute of 4.6 %; the Boltzmann-line fit gives T within 15 % of the slider.
7. Hook `binMembers(i)` returns indices whose count equals that bar's instantaneous count; `highlight(i)` paints exactly that many rings.
8. Noise floor at N = 500 between 5 % and 12 %.
9. Each Step press advances collisions each by 0.50 ± 0.02 and pauses; Fast-forward never skips a film frame.
10. Mean separation of collision partners < 0.3 box edge at N = 500 over 500 steps.
11. Main histogram ≤ 8 label boxes at default, none overlapping; at 375 px the box and the histogram each take ≥ 40 % of the main panel height; N = 2000 runs at ≥ 30 fps on the supervisor's Mac.
12. Rail at 375 px: all four control groups reachable, no horizontal overflow; no console errors; no .katex-error; no "slide" in page text.

**About:** 3D kinetic model with elastic, isotropic, energy- and momentum-conserving collisions between neighbouring molecules (Maxwell-molecule rule; the end state is the same as for hard spheres). Speeds are real; the animation is slowed so 1 km/s crosses a quarter of the box per second, and the box is not to scale. Slide 3 gets 394 and 482 m/s for O₂ with m = 32×1.67×10⁻²⁷ kg; with the atomic mass unit the values are 395 and 484 m/s.

**Strip:** (1) `P = nkT`; (2) `n_v\,dv = n\left(\frac{m}{2\pi kT}\right)^{3/2} e^{-mv^2/2kT}\,4\pi v^2\,dv`; (3) `v_p=\sqrt{2kT/m},\ \langle v\rangle=\sqrt{8kT/\pi m},\ v_{rms}=\sqrt{3kT/m}` with a sub-line ratio `1 : 1.128 : 1.225`; (4) live worked example for the current species and T (e.g. O₂ at 300 K: `v_p=\sqrt{2(1.38\times10^{-23})(300)/(32\times1.66\times10^{-27})}=395` m/s). Note: "k = 1.38×10⁻²³ J/K; m = A × 1.66×10⁻²⁷ kg."

### A.3 Tab `escape` — Escape tail (slides 4, 6)

Story: the high-speed tail is a leak. The fraction above v_esc is exponentially sensitive to v_esc/v_rms, which is why the rule asks for a factor of 6.

**Main panel** "The high-speed tail beyond escape speed". Maxwellian f(v) for the chosen species and T, x from 0 to max(1.25·v_esc, 4·v_p) in km/s. Fill under the curve cyan 25 %; the part above v_esc filled coral. Vertical lines: v_esc (amber, solid, labelled "v_esc = 11.2 km/s"), 6·v_rms (green dashed, labelled "6 v_rms"), v_rms (magenta dashed). Scale chips "Linear" / "Log" (default Linear). On Log, y spans from max(10⁻⁶⁰, 0.1×f(v_esc)) to 2× peak with decade ticks, so the coral tail is always visible; a label at the tail reads "fraction faster than v_esc: 3.0 × 10⁻²³". On Linear, when the tail area < 10⁻⁴ show a small muted note near v_esc: "tail too thin to see — try Log".
Header readouts: body, species, T.

**Controls:** body chips Earth (default), Moon, Mars, Venus, Mercury, Titan, Jupiter, Pluto; species chips H, H₂, He (default), H₂O, N₂, O₂, CO₂; T slider 20–3000 K log (default = body Ttyp) with number input; chips "Typical T" / "Upper-atmosphere T" that set T from the table (the active one highlighted while T equals it); scale chips.

**Readouts:** v_esc (km/s); v_rms (km/s); v_esc / v_rms; fraction faster than v_esc; thermal escape time (yr, as a power of ten, e.g. "≈ 10¹⁶ yr"); verdict line "6× rule: kept" (green) / "lost" (coral).

**Sub panel** "How long the gas lasts (Jeans escape)". x: v_esc / v_rms from 1 to 8 (linear). y: escape time in years, log, 10⁻⁶ to 10³⁰. Curve computed with the current body's M, R and species, sweeping T. Horizontal reference lines (muted, labelled): "1 day", "1 yr", "age of Solar System 4.5 Gyr" (amber). Vertical green dashed line at 6, labelled "6× rule". Magenta dot at the current ratio with its value. Shade the region where t > 4.5 Gyr faint green.

**What to notice:** (1) On a linear scale the tail looks empty; on the log scale it is always there — that is the leak. (2) Each step of 1 in v_esc/v_rms cuts the escaping fraction by about a million: ratio 1 → 39 %, 3 → 6 × 10⁻⁶, 6 → 3 × 10⁻²³. (3) Escape time jumps from about a year at ratio 3 to 10⁹ yr at 5 and 10¹⁶ yr at 6; the factor 6 is a safety margin. (4) Earth's helium: kept at 300 K, lost at the 1000 K of the upper atmosphere where escape actually happens.

**About:** Thermal (Jeans) escape: molecules faster than v_esc leave from the exobase, the level above which collisions are rare. Escape time = (gas column n·H above the exobase) / (escaping flux), with H = R/λ, taking the exobase at the surface radius and an isothermal gas at T. Real atmospheres hold far more gas below the exobase, so this is an order-of-magnitude time scale. Non-thermal processes (photochemistry, ion pick-up by the solar wind, sputtering) often dominate for heavy species on small bodies; the Moon's tenuous exosphere is lost mainly that way.

**Strip:** (1) `v_{esc}=\sqrt{2GM/R}` from `\tfrac12mv^2=GMm/R`; (2) `v_{esc}>6\,v_{rms}` (retention rule); (3) `F(>v_{esc})=\operatorname{erfc}x+\frac{2x}{\sqrt\pi}e^{-x^2},\ x=v_{esc}/v_p`; (4) `t_{esc}\approx\frac{H}{v_p}\,\frac{2\sqrt\pi\,e^{\lambda}}{1+\lambda},\ \lambda=\frac{v_{esc}^2}{v_p^2},\ H=\frac{R}{\lambda}`. Note: live worked example "Moon, O₂, 300 K: v_esc = 2.38 km/s, v_rms = 0.484 km/s, ratio 4.9 < 6" for the current selection.

### A.4 Tab `retain` — Who keeps what (slides 5–6)

Story: slide 5's chart, made live. Each line is factor·v_rms(T) for one gas; a body keeps every gas whose line passes below its dot.

**Main panel** "Escape speed vs. temperature". x: temperature, log, **hot on the left** as on the slide, from 2000 K (left) to 30 K (right); y: speed, log, 1–100 km/s. Lines (dashed, 1.6 px, muted) for H₂, He, H₂O, N₂, O₂, CO₂, Xe at speed = factor·v_rms(T), each labelled along its line near the left end like the slide figure (rotated text is fine). Toggle "All gases" adds H, CH₄, NH₃, Ar. Bodies as 5 px dots at (T, v_esc) with name labels. Temperature mode chips: "Typical T" (default), "Upper-atmosphere T", "Both" (draw typical as hollow, upper as filled, joined by a thin arrow typical → upper). Click a body (or its chip) to select it: ring it in magenta, then colour each gas line green where the line lies below the body's dot at the body's temperature (kept) and coral where it lies above (lost), and draw a short vertical tick from the dot to each line at that T.
Header readouts: factor, temperature mode, selected body.

**Controls:** factor slider 3–12 step 0.5 (default 6) with chips "6× (lecture rule)" and "10× (slide-figure lines)"; temperature mode chips; "All gases" toggle; body chips (all 13; default selected Earth).

**Readouts:** body; v_esc; T used; kept (list of gas names, green); lost (list, coral).

**Sub panel** "v_esc / v_rms for each gas on <body>". Horizontal bars, one per gas in SPECIES order (11 rows), length = v_esc/v_rms at the T in use (log x from 0.3 to 100), green if > factor, coral otherwise; vertical dashed line at the factor labelled "6×"; value printed at the bar end.

**What to notice:** (1) With the 6× rule and Earth at 300 K the chart says Earth keeps helium — but Earth's air has almost none. (2) Switch to Upper-atmosphere T: escape happens near 1000 K, and the H₂ and He lines rise above Earth. (3) The figure on slide 5 draws its lines at about 10 v_rms with typical temperatures; try the 10× chip — the verdicts nearly match the 6× rule at upper-atmosphere temperatures. (4) The Moon (2.4 km/s) cannot hold O₂ or CO₂ either way; Titan, cold and small, keeps N₂.

**About:** Escape speeds from M and R (1-bar radius for the giant planets). Typical temperatures follow the slide-5 figure; upper-atmosphere temperatures are approximate exobase values from spacecraft measurements (Earth ≈ 1000 K varying with solar activity; Jupiter ≈ 1000 K; Uranus ≈ 800 K; Neptune ≈ 750 K; Titan ≈ 150 K; Pluto ≈ 70 K) and dayside surface temperatures for airless bodies. The slide figure predates Voyager 2 and places Triton near 3 km/s; its escape speed is 1.45 km/s.

**Strip:** (1) `v_{esc}=\sqrt{2GM/R}`; (2) `v_{rms}=\sqrt{3kT/m}\propto\sqrt{T}` (a straight line of slope ½ on log–log axes); (3) `\text{kept if } v_{esc}>f\,v_{rms}`; (4) live worked example for the selected body and He: "Earth, He: 300 K → ratio 8.3 (kept); 1000 K → 4.5 (lost)". Note: "Lines of constant gas sit at fixed f·v_rms; moving a body to its hotter upper atmosphere slides it left, under more lines."

---

## Page B — Planet Atmospheres (`planet_atmospheres*.js/html`)

### B.1 Model (`html/planet_atmospheres_model.js`)

```
K = { sigma: 5.670374e-8, T_SUN: 5772, R_SUN: 6.957e8, AU: 1.495978707e11, WIEN: 2.897771955e-3,
      kB: 1.380649e-23, MH: 1.6735e-27, G0: 9.80665, R_STAR: 8.31432, M_AIR: 28.9644e-3, R0_US76: 6356.766,
      MU0: 4e-7*Math.PI, MP: 1.6726e-27, R_E: 6.371e6, B_EQ: 3.12e-5 }
L_SUN = 4π R_SUN² σ T_SUN⁴   (≈ 3.828e26 W; S at 1 AU ≈ 1361 W/m²)
```

`PLANETS` (name, a in AU, bond A and geometric p from slide 7, measured temperature notes):
Mercury 0.387, 0.088, 0.142, "max ≈ 700 K (equator, noon), mean ≈ 340 K, night ≈ 100 K"; Venus 0.723, 0.76, 0.689, "surface 737 K (greenhouse)"; Earth 1.000, 0.306, 0.434, "mean surface 288 K"; Moon 1.000, 0.11, 0.12, "equator noon ≈ 390 K, night ≈ 100 K"; Mars 1.524, 0.25, 0.170, "mean ≈ 210 K"; Jupiter 5.203, 0.503, 0.538, "emits 124 K (internal heat)"; Saturn 9.537, 0.342, 0.499, "emits 95 K (internal heat)"; Uranus 19.19, 0.300, 0.488, "emits 59 K"; Neptune 30.07, 0.290, 0.442, "emits 59 K (internal heat)". Store the measured comparison value as a number too (Mercury 700 for T_ss and 340 for T_eq; Venus 737; Earth 288; Moon 390 for T_ss; Mars 210; Jupiter 124; Saturn 95; Uranus 59; Neptune 59).

Temperature functions:
- `flux(rAU)` = L_SUN / (4π (r·AU)²).
- `Tss(rAU, A)` = T_SUN·√(R_SUN/(r·AU))·(1−A)^{1/4}; `Teq(rAU, A)` = Tss/√2. Export the coefficients `C_SS = T_SUN·√(R_SUN/AU)` (≈ 393.6, the slide's 394) and `C_EQ = C_SS/√2` (≈ 278.3, the slide's 279).
- `localT(thetaRad, rAU, A)` = Tss·cos^{1/4}θ for θ < 90°, else 0 (slow rotator, no heat storage).
- `wienPeak(T)` = WIEN/T (m).

Hydrostatics:
- `scaleHeight(T, mu, g)` = kB·T/(mu·MH·g).
- `ATM_BODIES`: Earth (g 9.81, μ 28.97, T 288, P0 101325 Pa), Mars (3.71, 43.34, 210, 610), Venus (8.87, 43.45, 737, 9.2e6), Titan (1.352, 28.0, 94, 1.467e5), Jupiter (24.79, 2.22, 165, 1e5, "1-bar level"), Saturn (10.44, 2.07, 134, 1e5, "1-bar level").
- `isothermalP(z, P0, H)` = P0·e^{−z/H}.
- `parcel(z1, dz, P0, H, g)` (per 1 m² of column) → `{F1: P(z1), F2: P(z1+dz), weight: (P(z1)−P(z1+dz))}`, and also `mass = weight/g`. In the isothermal model `F1 = F2 + weight` exactly.

US Standard Atmosphere 1976 (`us76T(zKm)`, `us76P(zKm)`, `localScaleHeight(zKm)`), z geometric in km:
- Below 86 km use geopotential altitude `h = R0·z/(R0+z)` (R0 = 6356.766 km) and the layers (base h, lapse K/km): (0, −6.5), (11, 0), (20, +1.0), (32, +2.8), (47, 0), (51, −2.8), (71, −2.0), top h = 84.852 km (z = 86 km). Base T = 288.15 K, base P = 101325 Pa. Pressure within a layer: lapse ≠ 0 → `P = Pb (Tb/T)^{g0 M/(R* L)}` with L in K/m; lapse = 0 → `P = Pb exp(−g0 M (h−hb)/(R* Tb))`.
- 86–91 km: T constant at its 86 km value. 91–110 km: `T = 263.1905 − 76.3232·√(1 − ((z−91)/19.9429)²)`. 110–120 km: `T = 240 + 12(z−110)`. Above 120 km: `T = Tinf − (Tinf − 360)·exp(−0.01875·ξ)`, `ξ = (z−120)(R0+120)/(R0+z)`, Tinf a parameter (default 1000 K).
- `us76P` defined for 0–86 km only (return NaN above; the page says why).
- `localScaleHeight(z)` = R*·T/(M·g(z)), g(z) = g0·(R0/(R0+z))², in km.

Magnetosphere:
- `dipoleB(rRE, latRad)` = B_EQ·rRE^{−3}·√(1+3sin²λ) (T).
- `fieldLine(L, n)` → points of r = L cos²λ in the meridian plane (x = r cosλ, z = r sinλ), from the southern footpoint to the northern one (r ≥ 1).
- `pdyn(nCm3, vKms)` = n·10⁶·MP·(v·10³)² (Pa).
- `standoff(nCm3, vKms)` = (2·B_EQ²/(MU0·pdyn))^{1/6} in R_E (pressure balance with the field doubled at the boundary).
- `magnetopause(theta, r0, pdynNPa)` = r0·(2/(1+cosθ))^{α}, α = 0.58·(1 + 0.010·pdynNPa) (Shue et al. 1997 shape, B_z = 0).
- `magPressure(rRE)` = (2·B_EQ·rRE^{−3})²/(2·MU0) (Pa).

**Tests** (`tests/planet_atmospheres_model.test.cjs`):
1. C_SS = 393.6 ± 0.2, C_EQ = 278.3 ± 0.2; flux(1) = 1361 ± 2 W/m².
2. Tss/Teq (K, ±0.5): Mercury 618.3 / 437.2; Venus 324.0 / 229.1; Earth 359.3 / 254.0; Mars 296.7 / 209.8; Jupiter 144.9 / 102.5; Neptune 65.9 / 46.6. Mercury at perihelion 0.307 AU: Tss = 694 ± 1.
3. wienPeak(5772) = 502 nm ± 1; wienPeak(290) = 9.99 μm ± 0.02.
4. scaleHeight (km, ±0.05): Earth 288 K 8.36; Mars 10.77; Venus 15.78; Titan 20.49; Jupiter 24.74; Saturn 51.16.
5. parcel: F1 − F2 − weight = 0 to 1e-9 relative for several z1, dz.
6. US76: T(0) = 288.15; T(z where h = 11) = 216.65; P(h = 11 km) = 22632 ± 1 Pa; P(h = 20) = 5474.9 ± 0.5; P(h = 32) = 868.02 ± 0.1; P(h = 47) = 110.91 ± 0.02; P(h = 71) = 3.9564 ± 0.001; P(86 km) = 0.3734 ± 0.001; T(86) = 186.95 ± 0.1; T(110) = 240.0 ± 0.1; T(120) = 360; T(500, Tinf 1000) = 999.2 ± 0.3. Continuity: |T(z+ε) − T(z−ε)| < 0.2 K at 86, 91, 110, 120 km.
7. standoff(5, 400) = 10.25 ± 0.05 R_E; standoff(30, 800) = 6.03 ± 0.05; standoff(1, 300) = 14.75 ± 0.05; pdyn(5, 400) = 1.338e-9 ± 0.005e-9 Pa. magPressure(standoff(n,v)) = pdyn(n,v) to 1e-9 relative.
8. dipoleB(1, 0) = 3.12e-5; dipoleB(1, π/2) = 6.24e-5; dipoleB(10, 0) = 3.12e-8.

### B.2 Tab `albedo` — Sunlight & albedo (slides 7–9)

Story: sunlight thins as 1/r²; the planet reflects A of it and re-emits the rest as infrared. A slow, airless rotator balances sunlight point by point (sub-solar temperature); a fast rotator or thick atmosphere spreads the heat over the whole sphere (equilibrium temperature, 1/√2 lower).

**Main panel** "Sunlight in, infrared out". Sun at the left edge (amber disk partly off-canvas with glow). Two dashed muted arcs centred on the Sun at the planet's distance and at 2× (schematic, not to scale), labelled "area 4πr²" and "4× area → ¼ flux". Planet on the right as a large disk (radius ≈ 22 % of panel height). Incoming sunlight: 7 parallel amber arrows hitting the dayside across the cross-section (label "πR² intercepts sunlight"). Reflected: a fraction of the arrows (round(7·A), at least 1 if A>0) turned back as pale arrows labelled "A = 0.09 reflected". Absorbed fraction labelled "(1−A) absorbed".
Surface colour = temperature on a fixed ramp (0 K #1b2130 → 150 K #3b4cc0 → 300 K #56c7d9 → 450 K #ffcc66 → 700 K+ #fff4d6), with a vertical colour bar (0–800 K) at the right edge with ticks at 0, 200, 400, 600, 800 and magenta marks for T_ss and T_eq.
- Mode "Slow rotator / airless": dayside shaded by `localT(θ)` (θ from the sub-solar point), nightside #1b2130 with label "night side: no sunlight (cools far below)". Coral infrared arrows only from the dayside, length ∝ local σT⁴.
- Mode "Fast rotator / thick atmosphere": the whole disk at T_eq; coral infrared arrows evenly all around; a curved spin arrow; label "heat spread over 4πR²".
Header readouts: planet, r (AU), A, T_ss or T_eq (the one for the mode).

**Controls:** planet chips Mercury (default), Venus, Earth, Moon, Mars, Jupiter, Saturn, Uranus, Neptune, plus "Mercury at perihelion" (r = 0.307 AU, A = 0.088); r slider 0.2–40 AU (log) with number input; bond albedo slider 0–0.95 with number input; mode chips "Slow rotator / airless" (default) and "Fast rotator / thick atmosphere". Choosing a planet sets r and A.

**Readouts:** flux at r (W/m²); absorbed per m² facing the Sun (W/m²); T_ss; T_eq; measured (from the table, labelled); planet's emission peak λ_max (μm) vs the Sun's 0.50 μm.

**Sub panel** "Temperature vs distance". Log x 0.2–40 AU, log y 30–800 K. Curves T_ss(r) (coral) and T_eq(r) (cyan) for the current A; magenta dot for the current r on the curve of the current mode. For every planet in PLANETS (with its own albedo): hollow circle at its computed T_eq and a filled diamond at its measured value (Mercury: both 340 and 700 as diamonds), labelled; highlight Venus ("greenhouse") and Jupiter/Saturn/Neptune ("internal heat") with short coral labels. Legend in the top-right corner.

**What to notice:** (1) Mercury: T_ss = 618 K at 0.387 AU, but 694 K at perihelion — matching the ≈ 700 K measured noon maximum. (2) Spreading heat over 4πR² instead of πR² lowers the temperature by 4^{1/4} ≈ 1.41 (T_ss → T_eq). (3) Venus is 0.72 AU from the Sun but its high albedo gives T_eq ≈ 229 K; the 737 K surface is the greenhouse effect. (4) Jupiter, Saturn and Neptune emit more than sunlight explains: internal heat.

**About:** Blackbody planet with uniform bond albedo, in radiative balance with the Sun (T☉ = 5772 K, R☉ = 6.957 × 10⁵ km). No heat storage or transport in the slow-rotator map, so its night side is shown cold rather than at a modelled temperature. Bond albedos from slide 7 (Wikipedia, "Albedo"); measured temperatures are standard values (Mercury from slide 9).

**Strip:** (1) `A=\dfrac{\text{reflected}}{\text{incident}}`; (2) `F=\sigma T^4,\quad \lambda_{max}=\dfrac{2.898\times10^{-3}\ \text{m K}}{T}`; (3) `4\pi R_\odot^2\sigma T_\odot^4=4\pi r^2\,\dfrac{\sigma T_{ss}^4}{1-A}\ \Rightarrow\ T_{ss}=394\,(1-A)^{1/4}\,r_{AU}^{-1/2}\ \text{K}` — write it as `T_{ss}=T_\odot\sqrt{R_\odot/r}\,(1-A)^{1/4}=394\,(1-A)^{1/4}r_{AU}^{-1/2}` K; (4) `\pi R^2(1-A)F=4\pi R^2\sigma T_{eq}^4\ \Rightarrow\ T_{eq}=279\,(1-A)^{1/4}r_{AU}^{-1/2}` K. Note: live example for the current planet ("Mercury: T_ss = 618 K, T_eq = 437 K").

### B.3 Tab `scale` — Scale height (slides 10–11)

Story: a parcel of gas is held up by the pressure difference across it; with P = nkT this gives an exponential with scale height H = kT/(μ m_H g).

**Main panel** "Hydrostatic equilibrium". Left ~40 %: a vertical gas column from z = 0 to 5H (y axis on its left in km, ticks at H, 2H, 3H, 4H labelled "H", "2H", …, plus km values), with a background whose brightness ∝ e^{−z/H} and 500 seeded dots distributed with density ∝ e^{−z/H} (fixed positions; small jitter animation optional). A parcel slab (cyan outline, translucent) between z1 and z1+Δz, draggable vertically. Middle ~25 %: free-body diagram of the parcel as on slide 10: a box with F₁ (up, cyan, at its bottom face), F₂ (down, cyan, at its top face) and mg (down, green, from its centre). Arrow lengths: F₁ and F₂ scaled to the box size; mg drawn at the same scale as the difference F₁ − F₂ (it is equal). Under the diagram: "F₁ = F₂ + mg" with live numbers in Pa (per m²). Right ~35 %: P(z)/P₀ (x: 0–1 linear; chip for log) vs the same z axis, cyan curve, with dashed muted guides at z = H, 2H, 3H where P/P₀ = 1/e, 1/e², 1/e³ (labelled 0.37, 0.14, 0.05) and the parcel's z1 and z1+Δz marked in magenta.
Header readouts: body, H (km), P₀.

**Controls:** body chips Earth (default), Mars, Venus, Titan, Jupiter, Saturn (set T, μ, g, P₀); sliders T 50–1000 K, mean molecular weight μ 2–50, g 0.5–30 m/s², parcel thickness Δz 0.05H–1H (default 0.3H), parcel height z1 0–4H (also by dragging).

**Readouts:** H (km); P at z1 (Pa); P at z1+Δz; parcel weight per m² (= P₁ − P₂) and mass per m² (kg); P/P₀ at z1.

**Sub panel** "Pressure falls by e every scale height". log P/P₀ (10⁻⁶–1) vs altitude 0–150 km for all ATM_BODIES at their defaults (straight lines of slope −1/H), each labelled with its name and H; the current body (with any slider changes) in cyan 2.5 px, others muted.

**What to notice:** (1) The parcel floats because the gas below pushes up harder than the gas above pushes down; the difference is exactly its weight. (2) Hotter or lighter gas, or weaker gravity, gives a taller atmosphere: Earth 8.4 km, Mars 10.8 km, Saturn 51 km. (3) Every H the pressure (and density) falls by a factor e ≈ 2.72.

**About:** Isothermal ideal gas, constant g and μ, thin atmosphere (z ≪ R). P₀ values are surface pressures (1-bar level for the giant planets). Earth's real atmosphere is not isothermal; see Earth's layers.

**Strip:** (1) `F_1=F_2+mg,\quad m=\rho A\,\Delta r`; (2) `\dfrac{dP}{dr}=-\rho g`; (3) `P=nkT,\ n=\dfrac{\rho}{\mu m_H}\ \Rightarrow\ \dfrac{dP}{P}=-\dfrac{\mu m_H g}{kT}\,dr`; (4) `P=P_0e^{-z/H},\quad H=\dfrac{kT}{\mu m_H g}=\dfrac{P}{\rho g}`. Note: live value "Earth, 288 K, μ = 29: H = 8.4 km".

### B.4 Tab `layers` — Earth's layers (slide 12)

Story: Earth's T(z) is not constant: it falls in the troposphere, rises in the stratosphere where ozone absorbs solar UV, falls in the mesosphere, and rises steeply in the thermosphere where solar EUV and X-rays are absorbed.

**Main panel** "Temperature vs height (US Standard Atmosphere 1976)". y: altitude 0–120 km (toggle "Extend to 500 km"); x: temperature in K (bottom axis) with °C on a top axis (as slide 12 uses °C). Horizontal layer bands with soft fills and names: troposphere (0–11 km), stratosphere (11–47), mesosphere (51–86 for the band; 47–51 is the stratopause), thermosphere (> 86); dashed lines and labels for tropopause, stratopause, mesopause. T(z) curve in coral, 2 px. Heating annotations (toggle "Show heating", default on): purple band 15–35 km "ozone layer" with a purple arrow from the left "Sun's UV absorbed by O₃ → heats the stratosphere"; amber arrow into the thermosphere "Sun's EUV and X-rays absorbed → heats the thermosphere". Markers on the right edge: Mt Everest 8.8 km, airliners ≈ 11 km, weather balloons ≈ 35 km, aurora 100–300 km (extended view), ISS ≈ 420 km (extended view). A horizontal draggable altitude cursor (magenta) with a dot on the curve.
Header readouts: altitude, T, P.

**Controls:** "Extend to 500 km" toggle; thermosphere top temperature T∞ slider 600–1400 K (default 1000) with chips "Quiet Sun ≈ 700 K", "Average 1000 K", "Active Sun ≈ 1400 K" (affects only z > 120 km; note it is set by solar EUV/X-ray output); "Show heating" toggle; altitude slider 0–(120 or 500) km (also drag).

**Readouts:** altitude; T (K and °C); layer name; P (Pa and as fraction of sea level; "not modelled above 86 km" above 86 km); local scale height H(z) (km).

**Sub panel** "Pressure: real profile vs one scale height". log P (10⁻¹–10⁵ Pa... pick 0.1 Pa to 1.2 × 10⁵) vs altitude 0–86 km: US76 P(z) (coral) and the isothermal exponential with H = 8.4 km (cyan dashed, label "isothermal, H = 8.4 km"); magenta marker at the cursor altitude (if ≤ 86 km). Label at 86 km: "real: 0.37 Pa vs isothermal: 3.7 Pa".

**What to notice:** (1) T falls about 6.5 K per km up to the tropopause (≈ 11 km), where weather happens. (2) The stratosphere warms upward because ozone absorbs solar UV; warm air over cold air is stable, so clouds spread in layers. (3) Above the mesopause (≈ 86 km, the coldest place, ≈ 187 K) solar EUV and X-rays heat the thin gas to ≈ 1000 K; this varies with solar activity. (4) The colder air aloft has a smaller scale height, so real pressure at 86 km is 10× below the 8.4 km exponential.

**About:** US Standard Atmosphere 1976: piecewise-linear temperature below 86 km (geopotential altitude), its standard thermosphere formulas above, with T∞ adjustable; pressure from hydrostatic balance with constant mean molecular mass (valid below 86 km, where the air is well mixed).

**Strip:** (1) `\dfrac{dP}{dz}=-\dfrac{\mu m_H g}{kT(z)}\,P` (scale height changes with T); (2) troposphere `dT/dz\approx-6.5` K/km; (3) `H(z)=\dfrac{kT(z)}{\mu m_H g}` (≈ 6.3 km at the tropopause, 8.4 km at the ground); (4) heating: `\text{UV }(200\text{–}300\ \text{nm})+\mathrm{O_3}\to` stratosphere; `\text{EUV, X-rays}+\mathrm{O,O_2,N_2}\to` thermosphere. Note: "Low-Earth-orbit satellites (ISS ≈ 420 km) fly through the thermosphere."

### B.5 Tab `magneto` — Magnetosphere (slide 13)

Story: Earth's field is close to a dipole falling as r⁻³; geographic north is a magnetic south pole; the solar wind pushes on the field until magnetic pressure balances the wind's dynamic pressure, about 10 R_E sunward.

**Main panel** "Earth's magnetosphere (noon–midnight plane)". Sun to the left (amber edge glow; label "Sun"). Earth at about 62 % of the panel width; x range ≈ −22 to +12 R_E (sunward to the left — keep the slide's Sun-on-the-left orientation), scale bar "5 R_E". Earth drawn with a day/night split and a small bar magnet inside, **S at the top (geographic north), N at the bottom**, labelled "geographic N = magnetic S". Dipole field lines (cyan, 1.3 px) for L = 1.5, 2, 3, 4, 6, 8 and, on the dayside, any L up to 0.9·r0, drawn only inside the magnetopause; arrowheads show direction (out of the southern hemisphere, into the northern hemisphere). Nightside tail: from high latitudes (footpoints at |λ| = 72°, 75°, 78°) draw lines that leave the Earth and stretch anti-sunward to the right edge (schematic; labelled "magnetotail (schematic)"). Magnetopause (magenta, 2 px) from `magnetopause(θ, r0, pdyn)` with θ from 0 to 150°, labelled "magnetopause" and with the stand-off point marked "r₀ = 10.3 R_E". Toggle "Bow shock": a dashed muted curve with r = 1.3·r0·(2/(1+cosθ))^{0.8}. Solar wind: amber streaks flowing from the left, deflected around the bow shock / magnetopause (animate when playing; static otherwise). Toggle "Radiation belts": translucent fills between L-shells inner 1.2–2.5 (coral, "inner belt: protons") and outer 3–7 (purple, "outer belt: electrons"), limited to |λ| < 50°. Markers: geostationary orbit circle 6.6 R_E (dashed muted, label "GEO 6.6 R_E"; turns coral with label "GEO outside magnetopause!" when r0 < 6.6). Toggle "Tilt 11°" rotates the dipole (field lines, magnet, belts) by 11° in the plane; the magnetopause stays Sun-aligned.
Header readouts: P_dyn (nPa), r0 (R_E).

**Controls:** solar-wind density slider 1–50 cm⁻³ (log, default 5), speed slider 250–1000 km/s (default 400); chips "Quiet wind (5 cm⁻³, 400 km/s)", "Fast stream (3, 750)", "CME storm (30, 800)"; toggles Bow shock (on), Radiation belts (on), Field direction arrows (on), Tilt 11° (off); Play/Pause for the wind animation.

**Readouts:** P_dyn (nPa); r0 (R_E and km); B at the surface, equator 0.31 G and pole 0.62 G (fixed, shown in gauss and tesla); B just inside r0 (nT, = 2·B_EQ·r0⁻³); GEO inside/outside.

**Sub panel** "Pressure balance at the nose". log–log: x r/R_E from 1 to 30; y pressure 10⁻³–10⁴ nPa. Magnetic pressure `magPressure(r)` (cyan, slope −6, label "(2B)²/2μ₀ ∝ r⁻⁶"); solar-wind P_dyn (amber horizontal, label "ρv²"); magenta dot at the crossing with label "r₀ = 10.3 R_E"; muted vertical marker at GEO 6.6 R_E. Secondary: B(r) itself is not plotted (keep one quantity).

**What to notice:** (1) B ∝ r⁻³, so magnetic pressure ∝ r⁻⁶: doubling the wind pressure moves the nose in only by 2^{1/6} ≈ 12 %. (2) A strong CME (30 cm⁻³, 800 km/s) pushes the magnetopause to ≈ 6 R_E, inside geostationary orbit. (3) A compass needle's north end points to geographic north because a magnetic south pole sits there.

**About:** Dipole field with B = 0.31 G at the equator (slide 13 quotes ≈ 0.4 G as a typical surface value; it ranges 0.25–0.65 G). Stand-off distance from pressure balance with the field doubled by the boundary current (Chapman–Ferraro); magnetopause shape from Shue et al. (1997) with B_z = 0. Field lines are pure dipole lines clipped at the magnetopause; the compressed dayside and the tail are drawn schematically.

**Strip:** (1) `B=B_0\left(\dfrac{R_\oplus}{r}\right)^3\sqrt{1+3\sin^2\lambda}`; (2) `p_B=\dfrac{B^2}{2\mu_0}`, `p_{sw}=\rho v^2`; (3) `\dfrac{(2B)^2}{2\mu_0}=\rho v^2\ \Rightarrow\ r_0=R_\oplus\left(\dfrac{2B_0^2}{\mu_0\rho v^2}\right)^{1/6}`; (4) live numbers: `n=5\ \text{cm}^{-3},\ v=400\ \text{km/s}\Rightarrow\rho v^2=1.3\ \text{nPa},\ r_0=10.3\,R_\oplus`. Note: "Magnetic field lines leave Earth near the geographic south pole and re-enter near the geographic north pole."

---

## Acceptance checks (both pages; encode in one reusable script per page)

1. `node --test tests/<model>.test.cjs` passes.
2. For every tab at 1280×800 and at 375×812: no console errors or warnings, no `.katex-error`, no horizontal page overflow (`document.scrollingElement.scrollWidth <= innerWidth`), every canvas has non-zero size, label boxes do not overlap and lie inside their canvas.
3. `?embed=1` shows only the main panel, filling the viewport.
4. Hook readouts equal the model values for the defaults (Page A: O₂ 300 K v_p 395 m/s, v_rms 484 m/s; Earth/He 300 K ratio 8.18 kept, 1000 K ratio 4.48 lost. Page B: Mercury T_ss 618 K, T_eq 437 K; Earth H 8.36 km; r0(5, 400) = 10.25 R_E; US76 P(86 km) 0.373 Pa).
5. Page A `maxwell`: from "Same speed", the shape index reaches > 1.60 within 15 s of simulated time at the default collision rate.
6. Each tab's default view looks complete with no empty regions larger than ~25 % of a panel, and text never smaller than 10 px.

---

### B.6 Owner review revision (2026-11-10; supersedes B.2–B.5 where they differ)

The owner reviewed the live page and found real usability defects. Round J implements B.6.1–B.6.5. Round K implements B.6.6 (albedo main panel: showing distance) and B.6.7 (layers tab redesign); the owner approved both mocks on 2026-11-10.

General label rule (all tabs, all canvases): every text label is placed so that its box overlaps no other label, no marker, no legend and no axis tick label; leader lines are at most 24 px and are used only when no free slot exists next to the item; if a label still cannot be placed, shorten it, never overlap. Every label and marker is registered with markBox so the checker can test it.

#### B.6.1 Live controls (all tabs)
- Every range slider updates state, readouts and drawing on the `input` event, continuously while dragging. Number boxes update on `input` when they hold a finite number within [min, max], and clamp and commit on `change`. Nothing waits for the pointer to be released; no debouncing (every model here is cheap).
- Choosing a chip moves the matching sliders and number boxes.
- Splitter (bug): the horizontal bar `#hSplitter` sits between the main and sub panels but its handler changed `--strip-h` (the formula strip), so dragging it down squeezed both cards. It must move the boundary between the main and sub panels: dragging down makes the main (upper) panel taller and the sub panel shorter by the same amount, following the pointer; the formula strip keeps its height. Store the split as a fraction of the main+sub height (grid rows `<f>fr 6px <1−f>fr <strip>`), so it survives window resizes; clamp so each panel keeps at least 120 px; arrow keys move it in 10 px steps; redraw both canvases while dragging. The vertical rail splitter is unchanged.
- No empty unit brackets in control labels: "Bond albedo ()" → "Bond albedo A"; "Mean molecular weight ()" → "Mean molecular weight μ".

#### B.6.2 Albedo sub panel "Temperature vs distance" (layout rebuilt)
- Axes: log x 0.2–40 AU, ticks and labels at 0.2, 0.5, 1, 2, 5, 10, 20, 40; log y 30–800 K, ticks and labels at 30, 50, 100, 200, 300, 500, 800; faint grid lines at those ticks; axis titles "distance from the Sun (AU)" (below) and "temperature (K)" (rotated, left).
- Curves: T_ss(r) coral 2 px and T_eq(r) cyan 2 px for the current A; magenta dot (radius 5, white 1 px ring) at the current r on the current mode's curve, moving continuously with the r slider.
- Bodies (fixed; independent of the sliders): for each body a thin muted vertical connector from its computed T_eq (hollow circle, radius 4, its own albedo) to its measured temperature (filled diamond, half-diagonal 4.5). Mercury: diamonds at 340 K and 700 K on one connector. Earth and the Moon share 1 AU: draw Earth's pair 7 px left and the Moon's 7 px right of the 1 AU position.
- Excess heat: the connectors of Venus, Jupiter, Saturn and Neptune are coral 2 px (measured well above computed). One short coral label "greenhouse" beside Venus's connector and one "internal heat" beside Saturn's connector.
- Name labels 11 px (10 px when the plot is narrower than 420 px), placed by a greedy search over 8 candidate slots around the body's pair (right-centre first, then left-centre, above, below, the four diagonals), testing each against every box placed so far (labels, markers, connectors' bounding boxes, legend, axis labels). Bodies are placed in the order Neptune, Uranus, Saturn, Jupiter, Mars, Moon, Earth, Venus, Mercury. If no slot fits, use the short name (Mer, Ven, Ear, Moon, Mars, Jup, Sat, Ura, Nep) and repeat; never overlap.
- Legend: a framed box in the empty upper-right region (large r, high T) with rows: coral line "T_ss (slow rotator, sub-solar point)", cyan line "T_eq (fast rotator, whole sphere)", hollow circle "computed T_eq, own albedo", diamond "measured", magenta dot "current planet". When the plot is narrower than 420 px use short rows ("T_ss", "T_eq", "computed", "measured", "current").
- Remove the old floating "Tss / Teq" corner text and the old leader lines.

#### B.6.3 Scale tab: fixed altitude axis, molecules that move
- New checkbox "Fix altitude axis" (default checked) in Controls, above "Log pressure".
- When checked, the altitude axis of the gas column and of the P/P₀ plot spans 0–Z_top km and does not change while T, μ or g move. Z_top = niceCeil(5·H) where H is the scale height at the moment the axis was fixed: on load, when a body chip is pressed, or when the box is re-checked. niceCeil rounds up to a multiple of 10 km below 100 km and of 50 km from 100 km (Earth 50, Mars 60, Venus 80, Titan 150, Jupiter 150, Saturn 300). When unchecked, Z_top = 5H, live (the old behaviour).
- Left axis: km ticks at a nice step (4–7 ticks), always labelled in km. On the right edge of the gas column, small cyan ticks labelled "H", "2H", "3H", "4H" at z = kH for every kH < Z_top; they slide as H changes.
- Molecules: 500 dots, each with a fixed seeded quantile u_i ∈ (0, 1) and fixed x_i. Altitude z_i = −H·ln(1 − u_i), recomputed every frame from the current H, so the whole column stretches upward as T rises or μ or g falls and squashes as they go the other way, smoothly while a slider moves. Dots with z_i > Z_top are not drawn; when more than 1 % of the gas lies above Z_top, show "x % of the gas is above this plot" at the top of the column. Background shading ∝ e^{−z/H} on the same fixed axis. Optional small jitter ∝ √T.
- Parcel in km: sliders "Parcel bottom z₁ (km)" 0–0.8·Z_top and "Parcel thickness Δz (km)" 0.01·Z_top–0.2·Z_top. Defaults on load and on each body chip: z₁ = 2·H_body, Δz = 0.3·H_body (Earth 16.7 km, 2.5 km). The parcel stays at its km position when T, μ or g change, so P₁, P₂, the weight and P/P₀ change instead. Dragging still moves it.
- Free-body diagram: F₁ drawn at a fixed length; F₂ = F₁·P₂/P₁ and mg = F₁ − F₂ at the same scale (so a larger H visibly shrinks mg relative to F₁). Live numbers in Pa below, as now.
- P/P₀ plot: same fixed z axis; dashed guides at z = H, 2H, 3H (where below Z_top) labelled 0.37, 0.14, 0.05 to the right of the curve, no overlaps with each other or with the magenta parcel marks.
- Sub panel "Pressure falls by e every scale height": each body's line labelled once, at its upper end inside the plot, without leader ticks, labels non-overlapping (shift along the line if needed); the current state's line (cyan 2.5 px) labelled in cyan "now: 14.0 km" (live H).

#### B.6.4 Magnetosphere tab: fixed planet, moving boundary
- Fixed scale at every solar-wind setting: x from −24 R_E (left edge, sunward) to +16 R_E (right edge); y the same px per R_E, centred on Earth. Earth's radius in px = panel width / 40 (minimum 6 px). When the main panel is narrower than 600 px use −20 to +10 R_E. Never rescale with r₀; Earth, its field lines, the radiation belts and the GEO circle (6.6 R_E) keep their size, and only the magnetopause, bow shock and wind change.
- Dipole field lines for L = 1.5, 2, 3, 4, 6, 8, 10, 12, 14, clipped at the magnetopause (a line that would cross it is cut there), so a stronger wind visibly cuts off the outer lines. Tail lines as before.
- Solar wind, animated by default (button shows "Pause"): amber particles enter at the left edge and move right; on reaching the bow shock they turn to flow around the magnetopause and continue tailward outside it; none enter the magnetopause. On-screen count = round(17·√n) (n in cm⁻³: 1 → 17, 5 → 38, 30 → 93, 50 → 120); speed in px/s = 0.15·v (v in km/s: 400 → 60 px/s). Changing n or v changes the stream at once.
- Labels: "magnetopause", "bow shock", "r₀ = 10.3 R_E" at the nose, "GEO 6.6 R_E", "Sun", "5 R_E" scale bar, "magnetotail (schematic)": all non-overlapping at every slider setting.
- Readouts in readable units: surface field "0.31 G / 0.62 G" and "31 μT / 62 μT" (equator / pole); no long decimals.

#### B.6.5 Hook and checks for round J
- `window.__planatmo.debug()` returns { albedoSub: {labels:[boxes], markers:[boxes], legend:box}, scale: {zTop, tickLabels:[strings], medianDotKm, aboveFrac}, magneto: {earthPx, noseX, windCount, windMeanSpeedPx} }.
- check_B.js groups (keep all previous groups):
  - live: for every range input on every tab, set a new value and dispatch only an `input` event; the matching hook state value and at least one readout change.
  - albedoSub: at the current viewport, labels, markers and legend are pairwise non-overlapping (label vs label, label vs marker, label vs legend) and inside the plot.
  - scaleAxis: with "Fix altitude axis" checked, T 288 → 600 K leaves zTop and tickLabels unchanged and multiplies medianDotKm by 600/288 (± 5 %); unchecked, zTop = 5H (± 1 %).
  - magnetoScale: for (n, v) = (1, 300), (5, 400), (30, 800), (50, 1000), earthPx is constant (± 0.5 px), noseX moves toward Earth monotonically, and windCount increases.

#### B.6.6 Albedo main panel: showing distance (owner approved the mock, 2026-11-10; round K)
Idea: the planet never changes size. What changes with distance is how big the Sun looks from the planet (exactly ∝ 1/r; flux ∝ the Sun's solid angle ∝ 1/r², which is the √(R☉/r) in T_ss) and how often photons arrive (exactly ∝ 1/r²).
- Planet: fixed centre (x = 78 % of the panel width, y = 45 % of its height) and fixed radius (20 % of the panel height) at every r and A. Surface colouring, mode behaviour (slow rotator day map and dark night side; fast rotator uniform T_eq with spin arrow), coral infrared arrows, colour bar with T_ss/T_eq marks and the night-side label stay as in B.2.
- Sun: centre at x = 13 % of the width, y = the planet's centre. Drawn radius ρ = ρ₁·(1 AU / r) with ρ₁ = 0.10 × panel height, minimum 1.5 px; a faint glow ring of radius max(4, 1.25ρ) + 6 px keeps it visible as a point far out. Near 0.2 AU the large disk is clipped by the left edge (intended). A dashed muted circle of radius ρ₁ shows the Sun as seen from Earth. Caption under the Sun, two lines: "Sun as seen from <planet name, or "here" for a custom r>: 1.38° across" (angular diameter 0.533°/r_AU; 2 decimals, 3 decimals beyond 5 AU) and, muted, "dashed: as seen from Earth".
- Beam: a faint amber band (alpha ≈ 0.05) from the Sun to the planet, as tall as the planet's diameter.
- Photon packets: short amber dashes (5 × 2 px) spawned at the Sun's right edge (x = Sun x + min(ρ, 0.1 W)), y uniform within ±0.92 R_planet of the planet's centre, moving right at 0.42 W per second. Spawn rate exactly 40 per second × (1 AU / r)², no floor, using a fractional accumulator (Mercury ≈ 267/s, Jupiter 1.5/s, Neptune 1 every 23 s); cap 900 on screen. When a packet reaches the planet's disk it is reflected with probability A (turns back as a pale #e6edf3 dash at 0.8 of the speed and leaves at the left edge) or absorbed (disappears with a 0.2 s small glow at the hit point). A muted line above the beam: "photons arrive at 267 per second (40/s at 1 AU, ∝ 1/r²)", or "1 every 23 s (…)" below one per second. Labels "A = 0.09: 9 % of photons bounce off" near the reflected packets and "(1−A) absorbed" by the dayside.
- Distance ruler along the bottom of the panel: log 0.2–40 AU, a tick and short name for each planet (Mer, Ven, Ear, Mars, Jup, Sat, Ura, Nep), value labels 0.2, 1, 10, 40 AU, and a magenta triangle marker at the current r that moves continuously with the r slider.
- Removed: the two dashed "area 4πr²" arcs and their labels, and the seven static sunlight arrows (the packets replace them).
- Animation runs only while the albedo tab is shown; with prefers-reduced-motion, draw a still frame with packets placed at the density the rate implies.
- New readouts: "Sun's angular size" (°) and "Sunlight vs Earth" ("6.7×" when r < 1 AU, "1/27" etc. beyond).
- What to notice, new first item: "From Neptune the Sun looks 1/30 as wide as from Earth, covers 1/900 as much sky and delivers 1/900 as much light per m²: that is the √(R☉/r) in T_ss."
- Hook: debug().albedoMain = {sunPx, planetPx, photonRatePerS, packetsOnScreen}.
- Checks (group albedoMain): planetPx equal (± 0.5 px) at r = 0.387, 1, 5.2, 30.1; sunPx(1)/sunPx(5.2) = 5.2 (± 2 %); photonRatePerS = 40/r² (± 1 %) at those r; after 3 s at r = 0.387 AU and A = 0.5, both reflected and absorbed packets have occurred (hook counters).

#### B.6.7 Layers tab redesign (owner approved the mock, 2026-11-10; round K; supersedes B.4 where they differ)
Idea: each control drives one heat source, the profile responds across the default view, and a sunlight column shows where each band of sunlight is absorbed. Main panel title "Where sunlight is absorbed sets the temperature".

Model additions (pure, in html/planet_atmospheres_model.js, with tests):
- `layersT(z, {T0 = 288.15, ozone = 1, Tinf = 1000})`. Let base(z) be the existing US76 temperature (same altitude convention as the existing function) and floor(z) the straight line from base(11) = 216.65 at 11 km to base(86) at 86 km. strat(z) = 216.65 for z < 11 and floor(z) + ozone·(base(z) − floor(z)) for 11 ≤ z ≤ 86. z_trop = the lowest z in [0, 25] where T0 − 6.5·h(z) ≤ strat(z), h(z) being the altitude variable the existing troposphere formula uses (bisection to 1e-4 km). T = T0 − 6.5·h(z) below z_trop, strat(z) from z_trop to 86 km, and the existing US76 formulas with T∞ = Tinf above 86 km. At the defaults layersT must equal the existing US76 temperature to 1e-6 K at every altitude.
- `layersTropopause(opts)` = z_trop; `layersStratopause(opts)` = the altitude of the maximum of layersT between z_trop and 80 km when ozone ≥ 0.05, else null.
- `layersP(z, opts)` for 0 ≤ z ≤ 86 km: hydrostatic integration from 101325 Pa with the same constants and altitude convention as the existing US76 pressure (trapezoid, step ≤ 0.05 km); at the defaults within 0.2 % of the existing US76 pressure at 11, 20, 32, 47, 71 and 86 km.
- Tests: the defaults reproduce US76 T at 0, 11, 20, 32, 47, 51, 71, 86, 110, 120 km (1e-6 K); tropopause at T0 = 288.15 equals the existing 11 km point (± 0.02 km), at T0 = 300 is (300 − 216.65)/6.5 km in the troposphere's altitude variable (± 0.02), at T0 = 250 likewise; ozone = 0 gives no stratopause and T non-increasing from 0 to 86 km; for ozone = 1.5, layersT(49) − floor(49) = 1.5·(base(49) − floor(49)) (1e-9); layersP at the defaults as above; Tinf only changes T above 120 km.

Main panel layout (left to right):
- T(z) plot, about 60 % of the width: altitude 0–120 km linear; temperature 160–340 K bottom axis (K) with a top axis in °C (−100, −50, 0, 50). Layer bands computed from the live profile: troposphere 0–z_trop; stratosphere z_trop–stratopause; mesosphere stratopause–86 km; thermosphere above 86 km (with no stratopause, one band "stratosphere and mesosphere" from z_trop to 86 km). Layer names inside their bands at the left. Dashed boundary lines labelled at the right inside the plot: "tropopause 11.0 km", "stratopause 47 km", "mesopause 86 km" (live values, non-overlapping). Standard profile as a dashed muted reference curve, label "dashed: standard atmosphere"; live profile coral 2.2 px, leaving through the top or right edge where it exceeds the axes.
- Sunlight column, about 13 % of the width (minimum 40 px), sharing the altitude axis: dark column with a ground strip; the ozone layer as a translucent purple ellipse centred at 27 km spanning 15–40 km, width ∝ ozone amount; "sunlight in" label at the top. Animated packets falling the full 120 km in 2 s: violet "X-ray, EUV" absorbed uniformly between 92 and 120 km at 3 + 9·(T∞ − 600)/800 per second; purple-magenta "UV" at 9/s, absorbed between 15 and 45 km with probability min(0.97, 0.97·ozone), otherwise reaching the ground; amber "visible" at 9/s reaching the ground; orange "ground heat" wiggles rising from the ground to random heights inside the troposphere at 2 + 8·max(0, T0 − 230)/80 per second. Each absorption shows a 0.25 s flash. Colour legend (four rows) below the inset.
- Inset, about 22 % of the width, top right: "above 100 km": layersT for 100–500 km against 0–1500 K in amber, ISS dashed line at 420 km, faint aurora band 100–300 km, the probe marker when the probe is above 100 km. At main-panel widths below 600 px, omit the inset and show "thermosphere top T∞" in the readouts instead.
- Probe: magenta horizontal line across the T plot at z ≤ 120 km with a dot on the curve, and a marker in the inset when z > 100 km. "Launch probe" animates z = 500·(t / 16 s)² km until 500 km, readouts following; moving a slider or dragging cancels it. Dragging on the T plot sets z, as before.

Controls (replace B.4's): "Surface temperature" slider 240–310 K (default 288.15) with chips "Polar winter 250 K", "Standard 288 K", "Tropics 300 K"; "Ozone amount" slider 0–150 % (default 100) with chip "Ozone hole 35 %"; "Solar activity (T∞)" slider 600–1400 K (default 1000) with chips "Quiet Sun ≈ 700 K", "Average 1000 K", "Active Sun ≈ 1400 K"; "Probe altitude" slider 0–500 km and a "Launch probe" button. Remove "Extend to 500 km" and "Show heating" (the inset and column replace them). Under the first two sliders a muted note: "surface and ozone controls are schematic".

Readouts: altitude; T (K and °C); layer; "what is here" (0–9 km weather and clouds, Everest 8.8 km; 9–13 airliners cruise; 13–36 ozone layer, weather balloons burst near 35 km; 36–60 stratopause region; 60–86 meteors burn up near 80 km; 86–92 mesopause, the coldest air; 92–300 aurora; 300–450 ISS orbit near 420 km; above 450 exosphere begins); tropopause height; P (Pa and fraction of sea level, from layersP; "not modelled above 86 km" above); local H(z) (km).

Sub panel "Pressure: real profile vs one scale height": as B.4 but the coral real curve is layersP for the current controls, the standard US76 P is a dashed muted reference, the isothermal H = 8.4 km line stays cyan dashed, the magenta marker follows the probe (≤ 86 km), and the 86 km label is live ("real: 0.37 Pa vs isothermal: 3.7 Pa").

Rail: How to use: "1. Change the surface temperature, ozone or solar activity and watch the layer it heats. 2. Launch the probe or drag the altitude line. 3. Compare the real pressure with a single scale height." What to notice: "(1) A warmer surface raises the tropopause: about 17 km in the tropics, 8 km over the poles. (2) Ozone absorbing solar UV warms the stratosphere; with less ozone the warm layer shrinks and more UV reaches the ground. (3) Solar EUV and X-rays heat the thin thermosphere: about 700 K at solar minimum, 1400 K at maximum. (4) The mesopause near 86 km is the coldest air on Earth." About: "US Standard Atmosphere 1976 is the reference. The surface-temperature and ozone controls are schematic: the troposphere keeps the standard 6.5 K/km lapse rate from the chosen surface temperature, and the ozone control scales the standard profile's warming above a straight no-ozone line between 11 and 86 km. Solar activity sets T∞ in the standard thermosphere formulas. Pressure from hydrostatic balance with constant mean molecular mass (below 86 km)."
Strip: as B.4; live note "Tropopause 11.0 km; stratopause 47 km at 271 K" (live values).

Hook: debug().layers = {ztrop, zstrat, T5km, T400km, probeZ, packets: {euv, uv, uvGround, vis, heat}}.
Checks (group layersLive): T0 288 → 300 raises ztrop by 1.8 ± 0.1 km and changes T5km; ozone 100 → 0 makes zstrat null; Tinf 1000 → 1400 raises T400km by more than 300 K; each of the four sliders, via an `input` event only, changes the main canvas pixels; Launch probe raises probeZ within 2 s; label boxes non-overlapping and inside the canvas at the current viewport.

---

### A.5 Owner review revision, Page A (2026-11-10; supersedes A.2–A.4 where they differ)

The general label rule of B.6 applies to every canvas on this page. The main/sub splitter is already fixed on this page (it moves the boundary between the cards; do not change it).

#### A.5.1 Boltzmann line (was blank)
The "Boltzmann line" checkbox drew only in the "Why this shape" compare mode and drew nothing when too few bins qualified, so it looked dead. Replace the checkbox with a sixth Compare mode "Boltzmann line" (order: Development, One molecule, Why this shape, Boltzmann line, Species, Temperatures), title "Boltzmann factor: ln(count / v²) falls on a straight line".
- Points: for each main-histogram bin with ≥ 5 molecules, x = ½ m v_i² (v_i the bin centre) in units of 10⁻²¹ J, y = ln(count_i / v_i²) (axis "ln(count / v²) + const"); white dots with ±1/√count_i error bars.
- Lines: least-squares fit weighted by count (cyan 2 px) with the label "slope = −1/kT → T = 298 K" (live); the expected line for the slider T (dashed muted, label "expected for T = 300 K"), drawn through the weighted mean point.
- With fewer than 3 qualifying bins, show the centred note "Needs at least 3 bins with 5 or more molecules: press Play to let collisions spread the speeds" and the expected line alone (so it is never blank).
- Axes refit only on double-click on the sub panel (as A.5.2).

#### A.5.2 Fixed speed axis; refit only on double-click
- Only the speed (horizontal) axis is fixed (owner correction 2026-11-10; the count and density axes always fit, see A.7). The main histogram's speed axis (m/s) stays fixed when the species, mass, temperature, N, injection or collision settings change. It is fitted on page load (after any URL parameters) and when the user double-clicks the histogram or presses a small "Fit axes" symbol button (inline SVG, aria-label "Fit axes") at the histogram's top-right corner, for touch. Nothing else refits it.
- Fit: x max = 3.2·v_p of the current gas rounded up to a multiple of 100 m/s (below 2000 m/s) or 500 m/s (above). 30 bins over 0–x max in m/s, recomputed only at a fit (so ghost snapshots, the coral tail beyond 2 v_p, hover and the film strip all use the same m/s bins between fits). The vertical axis follows A.7.
- Content beyond x max is clipped. A muted hint "double-click to fit" appears at the plot's top-right whenever more than 2 % of molecules lie beyond x max.
- Sub panels with speed axes (One molecule, Why this shape, Species, Temperatures) keep their speed axis fixed the same way and refit it on double-click on the sub panel; their vertical axes follow A.7. Boltzmann line keeps its own fit (A.6 item 4). The Development film strip uses the main histogram's bins.

#### A.5.3 Transport controls as symbol buttons, smaller steps
- One compact row of icon buttons (inline SVG icons, 32 px square, each with aria-label and a title tooltip): Restart (re-inject the current start), Play/Pause toggle (▶ / ❚❚), Step (⏭: run with motion until collisions each has grown by the step size, then pause), Fast-forward ×5 toggle (⏩, shown pressed when on). Next to them a chip group "step: 0.05 · 0.1 · 0.25 · 0.5" (collisions each; default 0.1). The tooltip names the action and size ("Step 0.1 collision each").
- The row fits on one line at 375 px. Remove the old text buttons "Pause", "Step: ½ collision each" and the "Fast-forward ×5" checkbox.
- Each Step press advances collisions each by the step size (± 0.01) and pauses; film frames are still captured at their thresholds.

#### A.5.4 Box vertically centred
The projected 3D box is centred vertically on the histogram's plot area: the centre of the box's projected bounding box equals the centre of the plot area (top of the y axis to the x axis) within 2 px, and the box height does not exceed the plot area's height. In the stacked narrow layout, centre the box in its own region.

#### A.5.5 Who keeps what: no overlapping labels
- Body labels: greedy search over 8 candidate slots around each body dot (right, left, above, below, diagonals), tested against every box placed so far: body dots, body labels, the selected body's ring and vertical guide, gas-line labels, axis tick labels. Order: selected body first, then by escape speed. A leader ≤ 24 px only if no slot is free; never overlap.
- Gas-line labels: placed along their own line, starting near the left end and stepping inward 20 px at a time until the (rotated) box hits no body dot, body label or other gas label; same colour as the line.
- The selected temperature's tick label under the x axis must not overlap the axis tick labels (move it above the axis inside the plot if needed).
- The rule holds for every body selected, for modes Typical / Upper-atmosphere / Both, with All gases on and off, at 1280×800 and 375×812.

#### A.5.6 Hook and checks
- `window.__atmo.debug()` returns {axis: {xMax, yMax, binWidth, hint}, transport: {stepSize, playing, fast}, box: {centerY, plotCenterY, height, plotHeight}, boltzmann: {nPoints, Tfit, note}, retain: {labels: [boxes], markers: [boxes]}}.
- check_A.js groups (keep all previous): axisFixed (O₂ → H₂, T 300 → 1000 K and N 500 → 1000 leave xMax and yMax unchanged; a dblclick event on the histogram sets xMax = the fit rule for the current gas); boltzmann (Compare → Boltzmann line at 0 collisions shows the note and the expected line; after ≥ 4 collisions each at N = 2000, nPoints ≥ 8 and Tfit within 15 % of the slider); transport (each step size advances collisions each by that size ± 0.01 and pauses; Fast-forward toggles); boxAlign (|centerY − plotCenterY| ≤ 2 px at 1280×800); retainLabels (labels pairwise non-overlapping and not over markers, for every body chip, each mode, All gases on and off).

#### B.6.8 Fast rotator: show the spin carrying heat (owner request, 2026-11-10)
- "Fast rotator / thick atmosphere": the planet visibly rotates. Six meridians in orthographic projection (muted, 1 px) move across the disk at one rotation per 4 s about a vertical axis, in the sense of the curved spin arrow. Heat parcels: where a sunlight packet (B.6.6) is absorbed, a small coral dot appears; it rides the rotation round the limb onto the night side (hidden while on the far side, visible again when it comes round) and fades over about one rotation while short coral infrared ticks leave it. The disk colour stays uniform at T_eq. Label "spin carries the day's heat to the night side".
- "Slow rotator / airless": meridians still; parcels stay at their hit points on the dayside and fade within 0.5 s; the night side stays dark. Label "no spin: the night side gets no heat".
- Switching modes blends the surface colour map over 1.5 s and starts or stops the spin smoothly.
- Hook: debug().albedoMain.spinPhase advances in fast mode and is constant in slow mode; debug().albedoMain.parcels counts live parcels.

---

#### A.7 Vertical axes always fit (owner correction, 2026-11-10)
The owner asked only for the speed axis to stay fixed (A.5.2). Every vertical axis on the Speed distribution tab fits its content at all times, and nothing is ever clipped in y. This covers the main histogram ("molecules per bin"), each Development film-strip frame (each frame fits its own bars and curve), and the sub panel of every Compare view whose horizontal axis is speed: One molecule, Why this shape, Species, Temperatures. Boltzmann line keeps its own fit (A.6 item 4).
- Target: y max = 1.12 × the largest value drawn within the current speed range. That means every curve (Maxwell or analytic), every histogram bar, and every ghost or reference curve. Recompute it on every change: species, mass, T, N, start, collisions, Compare view, and speed refit.
- Display: when the target rises above the shown y max, jump to it in the same frame, so no frame clips. When the target falls, ease down with shown += (target − shown)·min(1, dt / 0.25 s), so a running histogram does not jitter.
- Ticks: 4–6 ticks from 0 at a nice step of 1, 2, 2.5 or 5 × 10ⁿ. Gridlines sit exactly at the ticks. Labels use uniform decimals (0, 0.5, 1.0, 1.5). The axis top gets no label unless it is a tick. The current labels 0.468, 0.936, 1.4, 1.8 are wrong.
- Remove the coral ▲ y-clip marker and the y conditions of the "double-click to fit" hint. Double-click refits the speed axis only.
- Main histogram after the "Same speed" start: at the start the single bar of N molecules sets y max, so the Maxwell curve sits low. The axis eases down as collisions spread the speeds.
- Hook: debug().yAxes = {main:{yMax, dataMax}, sub:{yMax, dataMax}}, in the plotted units.
- Check group yFit (check_A.js) covers every species chip, T ∈ {100, 1000, 3000} K, every Compare view with a speed axis, and the five starts, each at 0 and after 2 collisions each. After 600 ms of settling:
  - main: dataMax ≤ yMax ≤ 1.25 × dataMax;
  - sub: the same bounds;
  - ticks: nice steps;
  - no y-clip marker drawn.

#### A.8 Who keeps what, side by side (owner approved 2026-11-10)
Reference implementation: output/atmospheres-20261109/mocks/who_keeps_what_side_by_side_mock.html. Port its drawing and label code. Where this section and the mock differ, this section wins. A.8 supersedes, for this tab only:
- A.4's layout and its "Both" drawing;
- A.5.5;
- A.6 item 9.

The owner rejected the hollow-plus-filled markers joined by a line (they read as motion). They also rejected the stretched, wide chart, which is what made the labels awkward.
- **Layout.** On this tab the main area shows the two charts side by side, in one row with widths in the ratio 1.3 : 1:
  - left: "Escape speed vs. temperature";
  - right: $v_\mathrm{esc}/v_\mathrm{rms}$ for each gas on the selected body.

  Each chart keeps its own title row and subtitle; the formula strip stays below. The main/sub splitter is hidden on this tab. Below 700 px of main width the two charts stack, escape chart first. The other two tabs keep their stacked layout and splitter. At 1280×800 the left plot area's width-to-height ratio lies between 0.8 and 1.3, like the slide figure.
- **Left chart axes.**
  - x is log temperature from 2000 K on the left to 30 K on the right, titled "← temperature (K)". Ticks at 2000, 1000, 500, 300, 200, 100, 50 and 30.
  - y is log escape speed from 1 to 100 km/s. Ticks at 1, 2, 5, 10, 20, 50 and 100.
- **Gas lines.** Dashed, 1.3 px, coloured for the selected body: green kept, coral lost, and amber (Both only) lost at the hotter temperature only. There is no vertical temperature marker and no tick label for the selected temperature.
- **Gas labels.**
  - Formulas use KaTeX_Main with subscripts, rotated along the line near the hot end, on a halo, in the line's colour.
  - Lines closer than 7 px share one label ("N₂, O₂"; "CH₄, NH₃, H₂O"; "Ar, CO₂").
  - A label goes above the group's top line when the gap to the group above is at least 14.5 px and the previous label is not below its line. Otherwise it goes below the group's bottom line when the gap below is at least 16 px.
  - The label then slides right in 4 px steps until it is inside the plot, clear of the other gas labels (oriented-rectangle test) and clear of every body shape.
- **Bodies.** One primitive per body: a round-capped horizontal segment at $v_\mathrm{esc}$ from $T_a$ to $T_b$, 8 px thick (11 px and magenta when selected), which is a dot when $T_a=T_b$.
  - Typical: $T_a=T_b=T_\mathrm{typ}$.
  - Upper: $T_a=T_b=T_\mathrm{up}$.
  - Both: $T_a=T_\mathrm{typ}$, $T_b=T_\mathrm{up}$, at 0.85 alpha.
  - No hollow markers, connectors or arrows.
  - A mode switch tweens $T_a$ and $T_b$ in log T over 450 ms with smoothstep easing. Labels are hidden during the tween and placed when it ends.
  - Clicking within 14 px of a body selects it; the rail's body chips stay.
- **Body labels.**
  - UI font at 11.5 px; the selected body's label is 600 weight and magenta.
  - Order: the selected body first, then by escape speed, descending.
  - Candidate slots: 8 around the shape (right, left, above, below, and the four diagonals) at gaps of 3, 7 and 13 px.
  - A slot is rejected if it leaves the plot, overlaps any placed label (gas labels included, oriented test), or comes within r + 1 px of any body shape.
  - Score = slot index + 10 × the number of gas lines crossing the box; lowest score wins.
  - Gap-13 slots get a leader of at most 24 px. Halo on every label.
- **Right chart.**
  - Rows: one per visible gas, lightest at the top, with the formula right-aligned at the left.
  - x axis: log from 0.5 to 600. Major ticks at 1, 10 and 100; minor ticks at 2, 5, 20, 50, 200 and 500. Title: $v_\mathrm{esc}/v_\mathrm{rms}$ (log scale).
  - Bars, Typical and Upper modes: from the axis to the ratio; green if above $f$, coral otherwise.
  - Bars, Both mode: a range bar from the ratio at the hotter temperature to the ratio at the cooler one; coral below $f$, green above.
  - Bar thickness: min(14 px, 0.6 × the row pitch).
  - Value labels: just past the bar end, in the math font; inside the bar in dark text if they would leave the canvas. In Both mode the label reads "lo–hi".
  - Rule: a dashed line at $f$, labelled "$f$ = 6" above the plot.
- **DOM text (KaTeX for the math).**
  - Mode chips: "Typical $T$", "Upper-atmosphere $T$", "Both (range)".
  - Left subtitle: "dashed lines: $f\,v_\mathrm{rms}$ for each gas, coloured for Earth (green kept, coral lost)"; in Both mode it adds "amber lost only when hot".
  - Right subtitle, for example: "at 300 K, its typical $T$; kept where the bar passes $f$".
- **Hook.**
  - labelBoxes(): the left chart's labels, with gas labels as their four rotated corners.
  - subLabelBoxes(): the right chart's labels.
  - debug().retain = {mode, sel, f, all, tweening, shapes:[{name, xa, xb, y}]}.
- **Check group retain2** (check_A.js), run at 1280×800 and 375×812 for every body × each mode × All gases on and off:
  - no two labels overlap (oriented test);
  - no label lies within r + 1 px of a body shape;
  - every label is inside its plot;
  - the left plot's aspect ratio is between 0.8 and 1.3 at 1280×800;
  - no stroke joins a body's two temperatures;
  - check_labels.js has 0 FAIL on retain;
  - check_mathfont.js has 0 FAIL.

## C. Math typesetting everywhere (both pages; owner review 2026-11-10)

Every mathematical symbol or expression shown anywhere on either page is typeset as math, not in the UI sans font.
- What counts: variables and constants (T, A, r, R, v, m, k, g, H, z, P, n, B, μ, ρ, λ, π, f), subscripted or superscripted quantities (T_ss, T_eq, T_∞, v_p, v_rms, v_esc, ⟨v⟩, r₀, R_⊕ or R_E, P₀, λ_max, 4πr², πR², ½mv², e^{−z/H}, P/P₀, z/H, v_esc/v_rms, f·v_rms, kT, ρv², (1−A)). Variables are italic in the math font with real subscripts and superscripts; numbers, units (K, km, m/s, W/m², AU, nPa, G, μT, J) and operators are upright in the math roman font; the minus sign is − (U+2212); multiplication ×. Plain words stay in the UI sans font.
- Where: everywhere a reader sees text: canvas labels, legends, axis titles and tick labels containing variables ("v_esc / v_rms (log)", "P/P₀ (log)", "½mv² (10⁻²¹ J)"), panel header readouts ("T_ss 618 K"), Readouts-card labels ("T_ss (K)", "v_p", "v_rms"), control labels ("Bond albedo A", "Mean molecular weight μ", "T_∞"), chips, sub-panel titles, rail cards (How to use, What to notice, About), strip notes, captions and hover text. Exempt: aria-labels, title tooltips and the document title (plain text).
- How: DOM text uses the vendored KaTeX (render the math spans with katex.render or the page's existing rendering path). Canvas text uses one helper, e.g. `mathText(ctx, tex, x, y, opts)`, that parses a small TeX subset (letters → italic KaTeX_Math; digits, units and operators → upright KaTeX_Main; `_{}` and `^{}` → about 70 % size, offset; `\pi \mu \rho \lambda \infty \odot \oplus \langle \rangle \times \cdot`), returns its box for markBox, and is used for every canvas label that contains math; mixed labels draw their words in the UI font and their math through the helper. Wait for `document.fonts.load` of KaTeX_Math and KaTeX_Main before the first paint (and repaint once when they arrive). Reuse an existing canvas math helper on the page if it does this.
- Check (group mathFont, both check scripts): wrap CanvasRenderingContext2D.prototype.fillText during one paint of every tab and every Compare/mode view and record (text, font); every recorded text that matches the math pattern below must have been drawn with a KaTeX font family. Scan every visible DOM text node outside `.katex`, aria-labels and titles with the same pattern. Report each violation with its tab, view and text; pass = none. Math pattern (case-sensitive): a variable letter directly followed by a subscript-like token (ss, eq, p, rms, esc, max, 0, ₀, ∞, E, ⊕, ⊙) or by an exponent (², ³, ⁴, ⁻, ^); any of π μ ρ λ ∞ ⊙ ⊕ ⟨ ⟩ ½; and the strings "1−A", "1-A", "kT", "mv", "z/H", "P/P", "/v".

#### A.5.7 Curve labels in the Species and Temperatures sub panels (owner, 2026-11-10)
The labels "150 K / 300 K / 600 K" (and the species names) sat in a row at the top-left with long leader lines to the curves. Label every curve directly at its own peak instead: the text centred just above the peak in the curve's colour (beside the peak, left or right, if the slot above is taken), no leader lines, never overlapping another label or curve peak. The y axis gets ticks with values and a full axis title (the current one is clipped and shows only the top value).

#### B.6.9 Magnetosphere physics (owner, 2026-11-10; superseded by B.8)
The current drawing cuts dipole field lines where they meet the magnetopause and draws closed night-side loops out to 14 R_E. Field lines never end in space: inside the magnetopause the dayside field is compressed (lines pile up along the boundary, field doubled at the nose), the highest-latitude lines funnel into the cusps or open into the tail lobes, the night side is stretched into a tail, and the bow shock stands upstream in the solar wind with the slowed, deflected wind flowing round the magnetopause through the magnetosheath. Detailed design to follow.

#### A.6 Round N fixes, Page A (2026-11-10; from the round-L browser check, output/atmospheres-20261109/browser-checks-L.md)
1. Blocker: in the bar-highlight path (drawMax) a local `let members = … new Set(members(…))` shadows the function, so every hover throws "Cannot access 'members' before initialization" and the main canvas stops repainting. Rename the local; hovering any bar must work (check a2c.7).
2. Play/Pause: the icon, aria-label and title switch between Play and Pause with the state.
3. The transport row must not overlap the "View" heading below it at any width (it covers it now at 1280 and 375).
4. Boltzmann-line compare: x and y axes with ticks and numbers; fit both axes (on entering the mode and on double-click) to the qualifying points with 10 % margins, so the points fill the plot; the expected line spans the plot.
5. Main histogram: "Maxwell: expected number per bin" must not cross the v_p and v_rms marker labels (move it to a free slot or make it a legend row).
6. A.5.7: Species and Temperatures curve labels at their peaks, y ticks and full axis titles.
7. Superseded by A.7 (owner correction 2026-11-10): density and count axes are never fixed; they always fit their content.
8. Step tolerance: each pair collision adds 2/N to "collisions each", so a step lands within max(0.01, 2/N); the check uses that tolerance.
9. Who keeps what, label design:
   - Label halo: every canvas label on this chart (and on any busy chart of the page) is drawn on a dark backdrop (the panel colour at 0.85 alpha, 2 px padding, 3 px radius), so a line passing behind never strikes through text.
   - Gas lines are parallel. Label them once each, just inside the plot's left edge at the line's height, in the line's colour. Lines closer than 12 px at that x share one merged label, e.g. "CH₄, NH₃, H₂O", "N₂, O₂", "Ar, CO₂".
   - Body labels: greedy search over 8 slots around the dot, tested against every body dot (radius + 2 px), every label placed so far (gas labels included), and every connector segment (segment–rectangle intersection). In Both mode the label goes next to the typical-temperature dot. Order: selected body, then by escape speed. If no slot is free, a leader of at most 24 px; never overlap.
   - Lower bar chart: one evenly spaced row per gas; the gas name right-aligned left of the plot at the bar's centre; the value inside the bar end (right-aligned, white) when the bar is long enough, else just past the end; rows at least 14 px apart (10 px font when tight); nothing staggered or overlapping.
10. At 375 px the top bar must not clip the tab buttons (compare with the live page; fix if this round introduced it).
11. Hook honesty: labelBoxes() and subLabelBoxes() must contain every text actually drawn, with its real measured box (ctx.measureText with the current font and transform). The supervisor verifies with an independent checker that wraps fillText and stroke paths; a self-report that says "no overlap" while text overlaps counts as a failure.
(Section C math typesetting for this page follows in a separate round.)

### B.7 Round M2 fixes, Page B (2026-11-10; from browser-checks-J.md and browser-checks-K.md)
Do not work on the magnetosphere tab in this round: it is being redesigned (B.6.9 and the coming B_z section supersede its open defects).
1. Label halo: every canvas label on this page that can meet a line or curve is drawn on a dark backdrop (the panel colour at 0.85 alpha, 2 px padding, 3 px radius), so no line strikes through text. Hook honesty as A.6 item 11: labelBoxes()/subLabelBoxes() hold every drawn text with its real measured box.
2. Albedo sub panel: the rotated "temperature (K)" title sits left of the tick labels with ≥ 4 px clearance (it is drawn over 300 and 200 now).
3. Albedo ruler: tick labels (Mer … Nep, 0.2 … 40 AU) never move; the current planet is shown by the magenta marker and by highlighting its tick label in magenta, not by displacing a label (now "Nep" or "40 AU" jumps ~70 px off its tick).
4. Albedo main, narrow widths: reserve the colour bar's column, so the planet never runs under the bar and the night-side label is fully visible at 375 px.
5. Albedo main: the two Sun captions sit below the Sun's glow (or on a halo), never on the glow.
6. Scale main: the P/P₀ guide labels (0.37, 0.14, 0.05) never collide with the magenta parcel marks (place each on the side away from the mark, or shift it vertically).
7. Scale sub panel: each body's line is labelled once near its upper end, shifted along its own line until the label is free; no leader ticks; the "now" line labelled in cyan.
8. Layers main: the "temperature (K)" title sits below the bottom tick labels, outside the plot; "altitude (km)" clears the axis; the °C top-axis labels clear the curve; layer and boundary labels have halos. At 375 px the colour legend moves below the sunlight column (or into the readouts) so it never overlaps the column.
9. Layers sub: the "real: … vs isothermal: …" label sits where no curve crosses it, on a halo.
10. Formula strip: no strip cell's content is taller than its cell (check formula.fit passes at 1280 and 375); scale the KaTeX size down slightly or let the strip grow; do not clip.
11. check_B.js: below 600 px main width, layersLive's Tinf check tests the readout (the inset is omitted by design); add checks for items 2-10.
12. B.6.8 fast-rotator spin animation.

### B.8 Magnetosphere rebuild: solar wind, IMF $B_z$ and the Dungey cycle (owner approved 2026-11-10)
**Reference implementations.** Both files are in output/atmospheres-20261109/mocks/ (copied to inti for Codex runs):
- magnetosphere_imf_bz_storm_mock.html: controls, field geometry, storm physics;
- dungey_cycle_reconnection_mock_v2.html: the reconnection animation, including the smoothing fix.

Port their code into the magnetosphere tab. Where this section and the mocks differ, this section wins. B.8 supersedes B.6.4's drawing and B.6.9; the fixed planet scale of B.6.4 stays.

**Controls (live on input).**
- Wind density $n$: 1–50 cm⁻³, log slider.
- Wind speed $v$: 250–1000 km/s.
- IMF $B_z$: −25 to +10 nT.
- Presets as $(n, v, B_z)$:
  - Quiet wind (5, 400, +2);
  - Fast stream (3, 750, −5);
  - CME, southward field (30, 800, −20);
  - CME, northward field (30, 800, +10).
- $B_y$ is fixed at 3 nT, stated in About.
- Transport: Play/Pause, Next stage (jumps to the next key frame and pauses), Restart, and an "other field lines" toggle (default on).

**Physics. Use these formulas exactly. Units: $n$ in cm⁻³, $v$ in km/s, $B$ in nT, distances in $R_\mathrm{E}$.**
- Dynamic pressure: $P = 1.6726\times10^{-6}\,n v^2$ nPa (1.338 nPa for 5 cm⁻³ at 400 km/s). The model's existing pdyn(n, v) returns pascals (1.338e-9 Pa); keep it and its test unchanged, and use $P_\mathrm{nPa} = 10^9\,$pdyn in the B.8 formulas.
- Existing model functions and their tests never change. If a B.8 function name already exists with different units or a different formula, keep the existing one and add the B.8 version under a "magneto" prefix (for example magnetoStandoffR0). A units difference between this section and an existing test is not a blocker.
- Stand-off distance: $r_0 = 10.25\,\big((n/5)(v/400)^2\big)^{-1/6} f_{B_z}$, with $f_{B_z} = \big(10.22+1.29\tanh(0.184(B_z+8.14))\big)/11.39$ (Shue et al. 1998 $B_z$ term, normalised so that $f=1$ at $B_z=0$).
- Magnetopause shape: $r(\theta)=r_0\,(2/(1+\cos\theta))^{\alpha}$, with $\alpha=(0.58-0.007B_z)(1+0.024\ln P)$.
- Bow shock (Farris & Russell 1994):
  - nose: $r_\mathrm{bs}=r_0\big[1+1.1\,((\gamma-1)M^2+2)/((\gamma+1)(M^2-1))\big]$, with $\gamma=5/3$;
  - Mach number: $M=v/\sqrt{v_A^2+c_s^2}$, with $v_A=21.8\cdot5/\sqrt{n}$ km/s and $c_s=60$ km/s;
  - shape: $r_\mathrm{bs}(\theta)=r_\mathrm{bs}(2/(1+\cos\theta))^{0.8}$.
- Coupling (Newell et al. 2007): $D=v^{4/3}B_T^{2/3}\sin^{8/3}(\theta_c/2)$, with $\theta_c=\operatorname{atan2}(|B_y|,B_z)$, $B_T=\sqrt{B_y^2+B_z^2}$ and $\hat D=\min(1,D/50000)$.
- Kp: $\mathrm{Kp}=0.05+2.244\times10^{-4}D+2.844\times10^{-6}\sqrt{n}\,v^2$, clipped to 0–9.
- Auroral oval equatorward edge (Gussenhoven et al. 1983): $67.8-2.07\,\mathrm{Kp}$ at midnight (23–24 MLT) and $70.1-1.25\,\mathrm{Kp}$ at noon.
- Polar cap:
  - flux: $F_\mathrm{PC}=0.3+0.7\hat D$ GWb;
  - colatitude: $\theta_\mathrm{pc}=\arcsin\sqrt{F_\mathrm{PC}/7.9}$;
  - boundary latitude: $90^\circ-\theta_\mathrm{pc}+3.5^\circ$ at noon and $90^\circ-\theta_\mathrm{pc}-3.5^\circ$ at midnight.
- Tail X-line: $x_X=25-10\hat D$. It is drawn at $13\,R_\mathrm{E}$ for the animation, and its true value is marked at the right edge as "tail X-line ≈ 20 R_E →".
- Sheath flow: $\mathbf v = U[\hat x + r_0(x,z)/(x^2+z^2)]$ inside the bow shock (Rankine half-body) and $U\hat x$ outside.

**Drawing (fixed scale $s = W/40$ px per $R_\mathrm{E}$; Earth at $x=0$, which is 24 $R_\mathrm{E}$ from the left edge; the planet radius in px is constant across presets).**
- Static field, as in the storm mock:
  - dayside closed lines through the radial map $r' = a+(R-a)\tanh((r-a)/(R-a))$ with $a=0.4R$;
  - night-side closed lines stretched by $x(1+kx^2)$;
  - lobe/open lines from the polar-cap boundary;
  - a plasma-sheet wedge;
  - the oval arcs at $1.12\,R_\mathrm{E}$ with brightness $0.3+0.07\,\mathrm{Kp}$.
- Wind particles follow the sheath flow and are pushed outside the magnetopause.
- **Reconnection animation, $B_z<0$** (from the v2 mock), with six stages and captions:
  1. draping;
  2. dayside reconnection;
  3. open lines whipped over the poles;
  4. lobe loading;
  5. tail reconnection;
  6. dipolarisation and precipitation.

  Animation details:
  - Solar-wind field lines are frozen in: every point is advected by the sheath flow.
  - A conveyor of 6 lines runs, one bright and five dim.
  - The geometry is recomputed from the current wind, debounced 120 ms.
  - The precompute must take ≤ 150 ms in node on inti. Use lookup tables for $r_\mathrm{mp}(\theta)$ and $r_\mathrm{bs}(\theta)$, move points outside the bow shock analytically, and use RK2 with $dt=0.1$.
  - In the page the precompute is split across frames, so no frame blocks for more than 50 ms. The previous geometry stays on screen until the new one is ready.
- **Northward $B_z\ge0$.** No dayside reconnection. The conveyor lines drape, pile up at the nose and slide past, fading over the last 20 % of their cycle. Caption: "Northward field: reconnection happens only behind the cusps and closes little flux, so the magnetosphere stays quiet."
- **Smoothness (owner, 2026-11-10: the coarse, bent lines must go).** Each solar-wind line carries 361 samples, clustered as $z=22\sinh(2q)/\sinh(2)$, $q\in[-1,1]$. Every field line is drawn through a Catmull-Rom spline sub-sampled to steps of ≤ 0.25 $R_\mathrm{E}$, then quadratic curves through midpoints. No visible corners except the real kink where a line crosses the magnetopause.
- **Precipitation.**
  - Stage 6 sends a burst along the contracting line into the oval.
  - Separately, a background trickle runs along night closed lines with feet between the oval edge and the polar cap, at a rate ∝ Kp (none at Kp 0).
- **Labels.** Math per section C, each on a halo, with no overlaps:
  - words: "solar wind", "bow shock", "magnetopause", "plasma sheet", "tail X-line" (stages 5–6), "auroral oval" (stage 6);
  - math: "$B_z$ = … nT";
  - a scale bar "10 $R_\mathrm{E}$".
- **DOM legend.** Closed: both ends on Earth (cyan). Open: one end on Earth (gold). Solar-wind field line (lavender).

**Sub panel "Storm response"** (replaces the current magnetosphere sub panel):
- **Plot.** $\mathrm{Dst}(t)$ from −6 h to 48 h, with arrival at $t=0$.
- **Driving.** The current wind drives from 0 to 12 h. Quiet wind (5, 400, +2) applies before 0 and after 12 h.
- **O'Brien & McPherron (2000).** Integrate with $dt=0.05$ h:
  - $d\mathrm{Dst}^*/dt=Q-\mathrm{Dst}^*/\tau$;
  - $VB_s=10^{-3}v\max(0,-B_z)$ mV/m;
  - $Q=-4.4(VB_s-0.49)$ nT/h when $VB_s>0.49$, else 0;
  - $\tau=2.40\,e^{9.74/(4.69+VB_s)}$ h;
  - $\mathrm{Dst}=\mathrm{Dst}^*+7.26\sqrt{P}-11$.

  The $\sqrt P$ jump at $t=0$ is the sudden commencement.
- **Guides.** Dotted lines at −50, −100 and −250 nT, labelled "moderate", "intense" and "super".
- **Readouts.** Minimum Dst and its time.
- **Range note.** When the minimum is below −150 nT, a note says the value is outside the range the model was fitted to (Dst ≥ −150 nT).

**Readouts.**
- $r_0$ and $r_\mathrm{bs}$ ($R_\mathrm{E}$);
- $D$ and $\hat D$;
- Kp;
- $F_\mathrm{PC}$ (GWb) and the polar-cap boundary latitude;
- the oval's equatorward edge at midnight;
- $x_X$;
- steady Dst and minimum Dst.

**Model functions** (planet_atmospheres_model.js) **with tests.** pdyn, standoffR0, shueAlpha, bowShockR0, newellD, kpFromD, ovalEdges, polarCap, obrienQ, obrienTau, dstSteady and dstSeries. Reference values:
- quiet wind: $r_0=10.30\pm0.05$, $D=935\pm10$, Kp $=1.28\pm0.05$;
- CME south (30, 800, −20):
  - $r_0=4.75\pm0.05$;
  - steady $\mathrm{Dst}^*=-262\pm2$ and steady $\mathrm{Dst}=-232\pm2$ nT;
  - dstSeries minimum $-253.3\pm1.5$ nT at $t=12$ h, just after the driving ends. The pressure term drops from $7.26\sqrt{32.1}$ to $7.26\sqrt{1.34}$ nT while $\mathrm{Dst}^*$ is still at −250.7 nT. During the driving the lowest value is −220.6 nT, just before 12 h.

**Hook.** debug().magneto = {r0, rbs0, alpha, D, Dhat, Kp, pcNoon, pcMidnight, eqNoon, eqMidnight, xX, FPC, dstSteady, dstMin, stage, u, playing, maxSegRE}, where maxSegRE is the largest drawn field-line step this frame in $R_\mathrm{E}$.

**Check group magneto2** (check_B.js):
- the presets give the reference values;
- Next stage steps through 6 key frames whose captions start 1…6;
- at $B_z=+10$ no reconnection stage occurs;
- the planet's radius in px is equal across presets;
- maxSegRE ≤ 0.3;
- the precompute takes ≤ 150 ms, and no frame takes longer than 50 ms during a preset change;
- check_labels.js and check_mathfont.js have 0 FAIL on the tab at 1280×800 and 375×812.

**About / caveat text.** "Noon–midnight cross-section. The stand-off distances, bow shock, coupling, Kp, oval, polar cap and Dst are computed (Shue et al. 1998; Farris & Russell 1994; Newell et al. 2007; Gussenhoven et al. 1983; O'Brien & McPherron 2000). The field-line shapes are schematic. Real reconnection is 3-D and continuous (Dungey 1961), and one cycle takes about 1–2 h." No dipole-tilt chips in this round.

#### B.8.1 Magnetosphere layout (supervisor decision 2026-11-10; side-by-side part superseded by B.9.1, framing kept)
In the stacked layout at 1280×800 the main canvas was 940×287 px and showed only ±6 R_E. The magnetopause flanks and the lobes were cut off, and the open lines left the view as vertical strokes. The owner rejects stretched, wide charts; that is why Who keeps what went side by side, and the same fix applies here.
- **Side by side.** On this tab the magnetosphere view and the Storm response sit side by side, widths in the ratio 1.9 : 1, filling the main area's height. The main/sub splitter is hidden on this tab.
- **Narrow screens.** Below 900 px of main width the two stack, view first. The view's canvas height is then 0.65 × its width, at least 300 px.
- **Framing.** The reference frame is x ∈ [−24, 16] $R_\mathrm{E}$, z ∈ [−13, 13] $R_\mathrm{E}$.
  - Scale: $s=\min(W/40, H/26)$ px per $R_\mathrm{E}$, with the frame's centre (x = −4, z = 0) at the canvas centre.
  - When the canvas is wider or taller than the frame, more space shows around it, and every line reaches the canvas edges:
    - solar-wind lines start 1 $R_\mathrm{E}$ beyond the left edge (or at x = −25 if that is further left);
    - lobe and tail lines run 2 $R_\mathrm{E}$ past the right edge;
    - particles spawn at the left edge.
  - The planet's radius in px depends only on the canvas size (B.6.4).
- **Storm response.** In its narrower column it keeps the same content, with time ticks at 0, 12, 24, 36 and 48 h. No label collisions.
- **Check group magnetoLayout.**
  - At 1280×800 the view shows at least ±12 $R_\mathrm{E}$ vertically and x from −24 to 16 $R_\mathrm{E}$, and its canvas width:height lies between 1.0 and 1.8.
  - At 375×812 the panels stack and the same coverage rule holds.
  - magneto2, check_labels and check_mathfont stay at 0 FAIL on the tab.

### B.9 Owner review of the overnight build (2026-11-10)

#### B.9.1 Magnetosphere tab: stacked again (owner; supersedes the side-by-side part of B.8.1)
- The view sits on top and the Storm response below, with `#hSplitter` between them, visible and working as B.6.1 describes (the split is a fraction of the main+sub height; the formula strip keeps its height).
- The split fraction is kept per tab. On this tab the view gets 0.72 of the main+sub height by default. Minimum heights: view 260 px, Storm response 150 px.
- The B.8.1 framing stays: $s=\min(W/40,H/26)$, the frame centre at the canvas centre, every line reaching the canvas edges, and the particle-density rule.
- The Storm response becomes a wide, short panel. It keeps its content (guides, minimum readout, range note) with no label collisions, and its time ticks are spaced at least 60 px apart.
- Below 900 px of main width the panels stack as before: the view's height is 0.65 × its width and at least 300 px.
- Check group magnetoLayout, replacing B.8.1's:
  - At 1280×800 the sub panel's top is at or below the view's bottom, and the view shows at least ±12 $R_\mathrm{E}$ vertically and x from −24 to 16 $R_\mathrm{E}$.
  - Dragging `#hSplitter` down by 80 px makes the view 80 ± 2 px taller and leaves the strip's height unchanged.
  - At 375×812 the same coverage rule holds.
  - magneto2, check_labels and check_mathfont stay at 0 FAIL.

#### B.9.2 Albedo, scale and layers: side by side with a splitter (owner approved the prototype, 2026-11-10)
- Port the side-by-side layout of `html/planet_atmospheres_proto.html` (md5 afe4f76c…) into `html/planet_atmospheres.html` for these three tabs. The main panel sits on the left, the sub panel on the right, and the formula strip spans both below. The prototype file stays untracked; leave it in place.
- Add a vertical splitter, `#sideSplitter`, as a 6 px column between the two panels.
  - It looks like the other splitters. It has `cursor: col-resize`, `role="separator"` and `aria-orientation="vertical"`, and arrow keys move it in 10 px steps.
  - Dragging moves the boundary between the panels and follows the pointer. Both canvases redraw live during the drag, throttled to one redraw per animation frame.
  - The split is stored per tab as the main panel's fraction of the two panels' width. Clamp it so each panel keeps at least 300 px.
  - Double-click resets the split to the tab's default.
  - The split is remembered per tab across reloads in `localStorage`. Wrap every access in try/catch; the page works without storage.
- Default fractions: albedo 0.60 (the owner wants its left panel wider), scale 0.50, layers 0.50.
- Content:
  - **Albedo:** at every splitter position the Sun shows at least the same fraction of its disk as on the stacked page, and is never cut more.
  - **Scale:** the parcel drawing and its labels stay clean at the default and at both clamp limits.
  - **Layers:** the upper-atmosphere inset returns whenever the main canvas is at least 560 px wide (as on the stacked page) and hides below that.
- Below 900 px of main width the panels stack, as in the prototype: `#sideSplitter` is hidden and `#hSplitter` works.
- The magnetosphere tab hides `#sideSplitter`.
- Check group sideLayout, run on each of the three tabs:
  - At 1280×800 the panels sit side by side and the main fraction equals the default ± 0.01.
  - A synthetic pointer drag of `#sideSplitter` by +100 px widens the main panel by 100 ± 2 px; both canvases' backing widths follow by the next frame.
  - Dragging past either limit clamps it. Double-click restores the default.
  - At 375×812 the panels stack.
  - check_labels and check_mathfont report 0 FAIL at the default split and at both clamp limits.

#### B.9.3 Make the reconnection cycle and the auroral oval visible (owner, 2026-11-10)
The owner saw the CME arrive but no reconnection and no auroral oval. Evidence is in output/atmospheres-20261109/diag/ (code.md and the contact sheets).
- **Northward field.** The owner's screenshot had $B_z=+7$ nT. That correctly shows no dayside reconnection.
- **Southward field.** The full cycle runs, but in play mode the stages are badly paced. A cycle takes about 23 s. Dayside reconnection (stage 2) lasts only about 1.1 s, and tail reconnection and the oval (stages 5–6) start only after about 18 s.
- **Oval.** It is a 3 px arc 4–5 px long, drawn under the field lines, and labelled only in stage 6.
- **Precipitation.** The rate is Kp × 1.5, the same for every stage and for both signs of $B_z$.

Changes:
1. **Pacing.** In play, map play time to the cycle phase u with a monotone piecewise-linear warp so that each of the six stages lasts 3.5 ± 0.3 s, a 21 s cycle.
   - At the moment of dayside reconnection (the start of stage 2) and of tail reconnection (the start of stage 5), the X mark flashes: it grows to 1.6× and returns over 0.8 s, with a white glow.
   - "Next stage" key frames are unchanged.
   - Northward field keeps its own variant, with the same per-stage timing rule if it has stages.
2. **Auroral oval.**
   - Draw it on top of the field lines in `C.green`, 4 px wide with a soft glow (shadowBlur 6), in both hemispheres on both the day side and the night side.
   - Each arc spans the model's latitudes, from the polar-cap boundary (`pcNoon`/`pcMidnight`) to the equatorward edge (`eqNoon`/`eqMidnight`).
   - Each arc is at least 10 px long. If the model span is shorter on screen, centre a 10 px arc on the span's mid-latitude. This is schematic; say so in "About this model".
   - Its opacity is 0.35 + 0.65·$\hat D$, so it is bright under southward field and faint under northward. Its latitudes follow the model, so the oval moves equatorward as $\hat D$ grows.
   - The label "auroral oval" is shown in every stage and for both signs of $B_z$ (the storm mock always labels it). Place it with the label rule, with a leader if needed, and register its box.
3. **Precipitation** (green dots streaming down the field lines into the oval and the cusps).
   - The rate is $1+28\hat D$ per second, as in the storm mock.
   - Add a cusp stream when $B_z<0$.
   - Add a burst of 3× the rate for 1.5 s when the snapped-back closed line reaches Earth in stage 6.
   - Under the CME, northward preset the rate is at most 1/5 of the rate under the CME, southward preset.
4. **Field direction.** The arrows on the solar-wind field lines point in the direction of $B_z$: up for $B_z>0$, down for $B_z<0$. Verify that the draped and open lines' arrows are consistent with that direction.
- Hook additions to `debug().magneto`:
  - `stageDurations` (seconds per stage measured in play);
  - `oval`: `{drawn, lineWidth, minArcPx, alpha, aboveFieldLines, labelled}`;
  - `precipRate`;
  - `swArrowSign` (+1 or −1).
- Check group magnetoVis:
  - Under the CME, southward preset in play, every stage lasts 3.5 ± 0.3 s, and the X-flash is seen at the starts of stages 2 and 5.
  - The oval is drawn, at least 4 px wide, at least 10 px long and above the field lines, with its label in every stage and under both CME presets.
  - Oval alpha is greater under the CME, southward preset than under the Quiet wind preset.
  - `precipRate` equals $1+28\hat D$ within 1 %, and the northward rate is at most 1/5 of the southward rate.
  - `swArrowSign` = sign($B_z$) for $B_z=\pm7$ and $\pm20$.

#### B.9.4 CME arrival and compression (owner request 2026-11-10; prototype first, owner to review)
Build this in a copy of the page, `html/planet_atmospheres_cme_proto.html` (untracked), not in the page itself. Two stand-alone mocks failed: their base mock is hard-wired to one wind, so its reconnection geometry did not follow the compression. The page computes everything from (n, v, $B_z$), so the prototype builds on that.
- **Physics in words.**
  - The geomagnetic poles stay fixed; the core sets them.
  - The CME's shock front raises the dynamic pressure. The bow shock and the magnetopause move inward as the front sweeps past, compressing the dayside field.
  - The cusps (`pcNoon`), the polar-cap boundary and the auroral oval move to their new model latitudes. For a southward CME that is equatorward; for a northward one the cusp barely moves (the model gives +0.2°), and the caption says so.
- **Trigger.** Choosing either CME preset plays the arrival from the current wind to the CME wind. A "Replay arrival" button (an inline SVG icon plus text, in the transport row) is shown while a CME preset is active. Slider drags keep today's behaviour.
- **Front.**
  - An amber curve, 2 px, convex toward Earth with a 60 $R_\mathrm{E}$ radius, labelled "CME shock front".
  - It enters at the left edge and reaches the bow-shock nose 3 s later, at a constant screen speed, then leaves at the right edge.
  - Behind the front the particles have the new density ratio (capped at 4×) and the new speed; ahead of it the old values hold.
  - Upstream solar-wind field lines show the new $B_z$ direction behind the front and the old direction ahead.
- **Compression.**
  - Each boundary point at x uses $w(x)=\mathrm{smoothstep}((x_f-x+8)/16)$ ($R_\mathrm{E}$), and $r_0$, α and the bow-shock parameters are blended point by point.
  - Closed field lines are compressed radially by the local ratio of new to old magnetopause radius. The factor tapers to 1 at 2 $R_\mathrm{E}$, so no closed line ever crosses the drawn magnetopause.
  - Cusp and oval latitudes blend with w(0).
  - During the arrival the Dungey animation is paused and hidden. The old-state draped sheath lines fade out as w rises.
  - The new magnetoPrecompute runs chunked during the front's travel. When the front is 5 $R_\mathrm{E}$ past Earth, the Dungey cycle for the new state starts at stage 1, and its geometry (bright pair, nose X, lobes) matches the new magnetopause.
- **Captions** (one line, KaTeX math, never code identifiers):
  - "CME shock front approaching";
  - "The front hits the bow shock: pressure jumps from $P_1$ to $P_2$";
  - "Magnetopause pushed in from $r_1$ to $r_2\,R_\mathrm{E}$; cusps and auroral oval move equatorward" (northward: "...; the cusp barely moves");
  - then the stage captions.
  A real-time clock reads "$t=+1.2$ min after the front reached the bow shock (sped up; the real compression takes about 5 minutes)".
  The readouts update live during the arrival.
- **Storm response.** When the front reaches the magnetopause nose, the sudden-commencement point at t = 0 pulses (a ring that grows and fades over 1 s).
- **Hook.** `debug().magneto.arrival` returns `{phase, xFront, r0Nose, cuspLat, kinkMaxDeg, closedOutside, imfInside, densityRatio, maxFrameMs}`.
- **Check group magnetoArrival.** Run it for both CME presets starting from Quiet wind:
  - r0Nose falls monotonically to the model value: 4.75 ± 0.05 southward, 6.10 ± 0.05 northward.
  - kinkMaxDeg ≤ 8. closedOutside = 0 and imfInside = 0 during the arrival.
  - densityRatio ≥ 3 for the southward CME.
  - maxFrameMs ≤ 20, and no console errors.
  - After the arrival under a southward CME, the Dungey nose X lies within 0.5 $R_\mathrm{E}$ of the new r0. Under a northward CME there is no nose reconnection: instead, the draped line's closest approach to the nose lies outside the new magnetopause and within 1.5 $R_\mathrm{E}$ of it.
  - Upstream solar-wind field lines behind the front use the same spacing, length (full canvas height) and arrow spacing as those ahead of it; they never bunch near the front.
  - Labels and math font stay at 0 FAIL.

#### B.9.5 Fixes from the supervisor's review of round LY1 (2026-11-10)
Evidence: output/atmospheres-20261109/ly1/magneto-south-stage6.png.
1. **Storm response legible when stacked.** At 1280×800 on the magnetosphere tab, its plot area (inside the axes) is about 50 px tall, so the guide labels crowd and the −100 tick is missing. Fix:
   - The formula strip on this tab shrinks to the height its content needs (at most 120 px; formula.fit must still pass).
   - The view's default fraction becomes 0.64.
   - At 1280×800 the Storm response plot area is at least 110 px tall. The ticks 0, −100 and −200 (and −300 when in range) all show.
   - The guide labels moderate, intense and super overlap neither each other nor the ticks.
2. **Uniform flow upstream.** The particles pile up in a band before the bow shock. Upstream of the bow shock the solar wind is uniform: particles move at the wind's screen speed with no deceleration. They slow down and bunch up only inside the magnetosheath (between the bow shock and the magnetopause), following the sheath-flow model there.
   - Tighten check magneto.particles: across 4 equal x-bins from the left edge to the bow-shock nose, no bin may hold more than 1.4× the mean.
   - Check at load, after 5 s and after 15 s of play, for both Quiet wind and CME southward.
3. **One tail X-line label.** When the model's $x_X$ lies inside the view, draw a single label, "tail X-line", at the drawn X. Use the off-screen form "tail X-line ≈ N $R_\mathrm{E}$ →" only when $x_X$ is beyond the right edge. The drawn X sits at the model's $x_X$ within 1 $R_\mathrm{E}$; if the animation's X is schematic, the About text already says so.
- Add these to check_B: magnetoLayout.dstPlotH ≥ 110, magneto.particles (the tightened rule) and magneto.xlineLabels (exactly one tail X-line label).
- **B.9.5 item 2, amended after round LY2.** Recycling particles that leave on the right back to the left edge makes bands: the early exits return as a burst. The upstream bin ratio reached 2.95 at 5 s. Replace recycling with a steady inflow:
  - New particles enter at the left edge as a Poisson process with rate $\rho\,v_\mathrm{px}\,H$ per second. Here ρ is the target upstream density (particles per px², from the existing per-$R_\mathrm{E}^2$ rule), $v_\mathrm{px}$ the upstream screen speed and H the canvas height. They get uniformly random z and an x offset uniform in $[0, v_\mathrm{px}\,\Delta t]$ behind the edge.
  - Particles are removed when they leave the canvas. The count floats, with a safety cap of 2× the target.
  - Initial fill: uniform density ρ upstream of the bow shock. In the sheath the fill is uniform too, so a short transient there is acceptable.
  - The upstream check of B.9.5 (≤ 1.4× in every bin at load, 5 s and 15 s) must pass at both sizes for Quiet wind and the CME, southward preset.

#### B.9.6 Solar-wind dots show density and speed (owner, 2026-11-10)
The owner: changing n or v changes the magnetosphere but not the incoming dots, which look like a constant flow. Cause: the dot density was fixed per area (0.2 per $R_\mathrm{E}^2$, from round PB4), independent of n; the dot speed was never checked against v.
- **Density.** The upstream dot density is $0.04\,n$ per $R_\mathrm{E}^2$ (n in cm⁻³), so n = 5 gives 0.2, the current value.
  - Cap it at 1.6 per $R_\mathrm{E}^2$ (n = 40), with a floor of 0.04 per $R_\mathrm{E}^2$.
  - Above the cap, keep the cap and say in "About this model" that dot density is proportional to n up to 40 cm⁻³.
  - The Poisson inflow rate uses this density.
  - When n changes, add or remove dots at random across the upstream region at once, so the density changes immediately without bands.
- **Speed.** The upstream dots move at $0.0115\,v$ $R_\mathrm{E}$ per second (v in km/s; 400 km/s gives 4.6 $R_\mathrm{E}$/s), converted to px with the current scale. A change in v applies at once. The sheath flow scales with the same factor.
- **Label.** The canvas label block "solar wind / $B_z$ = …" gains two lines, $n = 30\ \mathrm{cm^{-3}}$ and $v = 800\ \mathrm{km/s}$, typeset with mathText. It follows the label rule.
- **Performance.** At most 2500 dots on the canvas, and the frame-time check still passes.
- **Check group magnetoWind** (both sizes):
  - The measured upstream count per $R_\mathrm{E}^2$ for n = 5, 15 and 30 is within ±15 % of $0.04\,n$.
  - The measured mean upstream screen speed at v = 400 and 800 matches $0.0115\,v\cdot s$ px/s within ±5 %.
  - A step from n = 5 to n = 30 reaches the new density within 0.5 s.
  - The uniformity rule of B.9.5 (≤ 1.4× per bin) holds at n = 5 and at n = 30.
- The CME-arrival prototype (B.9.4) uses the same mapping behind the front: the density ratio is $n_2/n_1$, capped by the dot cap. Apply this when the prototype is ported.

#### B.9.7 Albedo main panel: beams only (owner decision 2026-11-10; Fable consulted; supersedes the Sun and beam parts of B.6.6)
The owner proposed removing the Sun from the scene, because the Sun and the planet collide when the splitter makes the panel narrow. Sunlight at a planet is essentially parallel, so beams entering from the edge are the honest picture. The 1/r² lesson is carried by the photon rate (exact) and the readouts.
1. **No Sun in the scene.**
   - Remove the Sun disk, its glow, the dashed Earth circle and the caption under the Sun.
   - Sunlight is a horizontal amber band from the left edge to the planet, as tall as the planet's diameter, with alpha 0.03 + 0.07·min(1, 1/r²).
   - Packets spawn at x = 0 with y uniform within ±0.92 R_planet and move right at 0.42 W per second. The rate stays exactly 40/s × (1 AU/r)², with the fractional accumulator.
   - The on-screen cap becomes 2500, so the 1/r² density holds near 0.2 AU.
2. **No inset** (owner: "no need"). The Sun's angular size stays only as the readout "Sun's angular size", and the "Sunlight vs Earth" readout stays.
3. **Band label.** The band label stays, muted, above the band: "photons arrive at 267 per second (40/s at 1 AU, ∝ 1/r²)" or "1 every 23 s". Place it with the label rule.
4. **Reflection.** Reflected packets (probability A) leave the hit point diffusely, in a direction drawn within ±60° of the local outward surface normal, as pale #e6edf3 dashes at 0.8 of the speed. They leave through any edge. The absorption glow is unchanged.
5. **Unchanged:** the planet (fixed centre and radius), its surface colouring and modes, the infrared arrows, the colour bar, the distance ruler, the readouts, "What to notice" and reduced motion (a still frame at the implied density).
6. **Hook.** debug().albedoMain = {planetPx, photonRatePerS, packetsOnScreen, sunDrawn} (sunDrawn must be false).
7. **Check group albedoMain (replaces B.6.6's):**
   - planetPx is constant (± 0.5 px) at r = 0.387, 1, 5.2 and 30.1.
  - photonRatePerS = 40/r² ± 1 %.
   - The packetsOnScreen ratio between 0.387 AU and 1 AU is 6.7 ± 15 % after 3 s.
   - Reflected and absorbed packets both occur at A = 0.5.
   - No Sun disk is drawn (sunDrawn = false).
   - At main-panel widths of 300, 600 and 900 px (set with #sideSplitter), the band label, planet, colour bar and ruler labels do not overlap one another.

#### B.9.8 Planet chips set the matching heat-spreading mode (owner, 2026-11-10)
Choosing a planet currently sets only r and A, so no planet ever shows the fast-rotator case. Each planet chip now also sets its usual mode:
- **Slow rotator / airless:** Mercury, Mercury at perihelion and the Moon (slow rotation, no air; their noon surfaces approach $T_{ss}$).
- **Fast rotator / thick atmosphere:**
  - Venus: its thick atmosphere spreads the heat even though it rotates slowly.
  - Earth and Mars: about 24 h days, and Earth also has air and oceans.
  - Jupiter, Saturn, Uranus and Neptune.

The mode chips stay clickable after a planet is chosen; a manual switch holds until another planet chip is chosen. The mode change uses the existing B.6.8 spin blend.

Add one short line to "What to notice": "Each planet starts in its usual case: airless, slow Mercury and the Moon near $T_{ss}$; planets with air or fast spin near $T_{eq}$."

Check albedo.modeLink: each chip sets the listed mode, and a manual switch after a chip click persists.

#### B.9.9 Real planet image, a temperature-map toggle, and the spin process on both (owner decision 2026-11-10, after mock output/atmospheres-20261109/mocks/planet_image/mock.png)
The owner chose option A plus a toggle. The real image identifies the planet. The temperature map shows the result. The spin animation (B.6.8) shows the process, and it runs on whichever view is shown.
1. **Disk view control.** A two-chip segmented control "Disk: Real image | Temperature map" sits under the mode chips. The default is Real image. The choice persists across planet changes.
2. **Real image.**
   - The disk is an orthographic projection of the body's 360° map, `assets/planets/<body>_2k.jpg` (NASA/USGS public domain; see assets/planets/README.md).
   - The view is equatorial, with north up and the axial tilt ignored (schematic; say so in About).
   - It is lit from the left: the day side is at full brightness, the terminator is a soft 12° band, and the night side is at 18 % brightness.
   - Sample per pixel through a lookup table of (latitude, longitude) for each disk pixel, rebuilt only when the disk radius changes; per frame, only the longitude offset changes.
   - Under a custom r (no chip), keep the last chosen body's map.
   - Body to map: Mercury and Mercury at perihelion use mercury; Venus uses venus (cloud tops if available); then earth, moon, mars, jupiter, saturn, uranus and neptune.
3. **Temperature map.** Exactly today's rendering: slow rotator by $T(\theta)=T_{ss}\cos^{1/4}\theta$ with a dark night side; fast rotator uniform at $T_{eq}$.
4. **The process on both views (B.6.8 kept).**
   - Fast-rotator mode: the surface visibly rotates at one rotation per 4 s. On the image the map's longitude advances; on the temperature map the six meridians move as now.
   - The heat parcels (small coral dots born where sunlight packets are absorbed) ride the rotation round to the night side and fade, with their infrared ticks. They are drawn over either view, with a thin dark outline so they read on bright images.
   - Slow-rotator mode: the spin blends to zero over 1.5 s (B.6.8). Parcels stay at their hit points and fade within 0.5 s.
   - The existing labels stay: "spin carries the day's heat to the night side" and "no spin: the night side gets no heat".
   - Sense of rotation: Venus and Uranus spin retrograde (Venus's cloud tops super-rotate retrograde); all others prograde. The spin arrow follows the body. Say in About that the 4 s period is schematic, not the real day length.
5. **Colour bar and readouts** are unchanged in both views. The T mark stays.
6. **About** gains a credit line for the maps, as the README asks.
7. **Hook.** debug().albedoMain gains {diskView: 'image'|'temperature', body, mapLoaded, spinSense}.
8. **Check group albedoImage:**
   - Each planet chip loads its map (mapLoaded true within 2 s; no console errors) and sets body.
   - The default diskView is 'image'. The toggle switches the view, and the switch persists across a planet change.
   - In fast mode spinPhase advances under both views, and parcels > 0 after 3 s at 0.387 AU.
   - spinSense is −1 for Venus and Uranus and +1 otherwise.
   - Frame time ≤ 20 ms at 1280×800 with the image view spinning.
   - No label overlaps (labels, parcels' text and the toggle).

#### B.9.10 Photons land across the day hemisphere, not only on the limb (owner, 2026-11-10)
Packets travel in the screen plane, so every hit lands on the limb. That is right for a 2-D cut but gives the wrong impression. Give each packet a 3-D path instead:
- **Sampling.** At spawn, draw (y, z) uniformly over the disk of radius R_planet: y is screen-vertical, and z is depth toward the viewer, with z > 0 in front. The spawn rate stays exactly 40/s × (1 AU/r)². The packet moves along +x at the existing speed.
- **Hit point.** The packet hits the sphere at $x_\mathrm{hit}=x_c-\sqrt{R^2-y^2-z^2}$ (screen px) and is absorbed or reflected there. So hits fill the whole lit half of the disk: densest near the limb and thinning toward the terminator, as the projected illumination does.
- **Visibility.** Packets with z ≥ 0 stay visible as they cross the disk face to their hit point; draw them over the planet image with the same dash. Packets with z < 0 disappear when they reach the limb (x = x_c − √(R² − y²)), because they are behind the planet. They still count toward the rate and the absorbed/reflected tallies, but their hit marks are not drawn.
- **Reflection.** Reflected packets leave from the hit point within ±60° of the 3-D outward normal (x_hit − x_c, y, z)/R, projected onto the screen.
- **Heat parcels** (B.6.8/B.9.9) are born at the visible hit point: latitude and longitude from (y, z). In fast mode they ride the rotation from there.
- **Hook.** debug().albedoMain gains hitSpread: the standard deviation of the visible hits' x_hit, in units of R.
- **Check albedoMain.hits:** after 3 s at 0.387 AU, the visible hits cover the lit half disk. Divide the lit half (from x_c − R to x_c) into 4 equal x-bins; every bin must hold ≥ 5 % of the visible hits, and no hit may lie on the night side (x_hit > x_c + 1 px).
