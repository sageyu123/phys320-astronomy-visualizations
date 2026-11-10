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
