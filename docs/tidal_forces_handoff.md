# Handoff: Tidal Forces page (Lecture 12)

Branch: `claude/great-euler-tlnxd1`. Workflow the author wants: **Fable designs → Codex implements** (run Codex locally to save tokens).

## Status

| Step | State |
|---|---|
| Extract Lecture 12 (`Phys320_Lecture12.pptx`) text and equations | Done (transcribed below; most equations were images) |
| Survey repo conventions | Done (summary below) |
| Fable design spec | **In progress when the cloud session wrapped.** If `docs/tidal_forces_design.md` is not on this branch, have the designer write it from the brief in "Design brief" below, or design from the outline at the end. |
| Implementation | Not started. No page files exist yet. |

## Deliverables

1. `html/tidal_forces.html`: single self-contained page in the house style.
2. Optional `html/tidal_forces_model.js` (pure ES module) + `tests/tidal_forces_model.test.cjs` (node:test) if the physics is non-trivial, following `html/spherical_shell_model.js` / `tests/spherical_shell_model.test.cjs`.
3. `index.html`: one more `<a class="viz-card">` before the `placeholder-card` (thumbnail, inline SVG glyph, title, badge, desc, 4 tags). Copy the `planet_building` card's structure.
4. `README.md`: one entry-point line, same format as the others.
5. `tools/make_thumbs.sh`: one `shot "html/tidal_forces.html?tab=…&embed=1" "tidal_forces"` line; then generate `assets/thumbs/tidal_forces.jpg` (the script uses macOS Chrome and `sips`).

## Repo conventions (read these files)

- House style: `html/planet_building.html` (193 lines) and `html/nebula_disk.html` (44 long lines) are the newest pages. Copy their `:root` color tokens (`--background --rail --canvas --panel --cyan --magenta --purple --amber --green --coral …`), layout, and CSS verbatim.
- Layout: 44px topbar (brand link back to `../index.html` + segmented tab bar), left rail of control `.card`s, workspace of canvas `.panel`s with header/readouts/caption, a formula strip rendered with vendored KaTeX (`../vendor/katex/`), and resizable splitters.
- URL params: `?tab=<name>`, `?embed=1` (hides chrome for thumbnails), optionally `?t=<time>`.
- Expose a `window.__tidal = { state(), step(n) }` hook for headless checks (cf. `window.__nebula`).
- Serve with `python3 -m http.server`; run tests with `node --test tests/`.
- No build step and no external CDNs; everything is vendored.

## Lecture 12 content (transcribed)

**1. Differential gravity (slides 2–4).** Behind Saturn's rings, Io's volcanism, Earth tides, the Moon showing one face, crater chains, and accretion disks. For a body of radius R at distance d from mass M:
- Near side: F₁ = GMm/(d−R)²; far side: F₂ = GMm/(d+R)²
- ΔF = F₂ − F₁ = (GMm/d²)[(1+R/d)⁻² − (1−R/d)⁻²]
- Binomial expansion (a=1, x=±R/d, n=−2) gives **ΔF ≈ −4GMmR/d³**. The minus sign means less force on the far side. This holds only on the line joining the bodies.
- Figure pair: forces relative to the Sun (all sunward, unequal) vs. relative to the body's center (subtract the center vector). The result stretches the body along the line and compresses it perpendicular to it, like an American football or rugby ball.
- General field (textbook, for the vector plot): a_tidal ≈ (GM/d³)(2x, −y, −z), with x along the line to M.

**2. Tides from the Sun and Moon (slide 5).**
- ΔF☉/ΔF☾ = (M☉/M☾)(d☾/d☉)³ = (2e30/7.36e22)(3.84e5/1.5e8)³ ≈ 0.456 ≈ **5/11**. The Moon is about 2× the Sun. The ratio does not depend on Earth's R or on the test mass.
- Two bulges, so high tides come about every 12 h as Earth rotates beneath them.
- **Spring tides** at new/full Moon (Sun and Moon aligned, effects add). **Neap tides** at first/third quarter (90°).

**3. Tidal friction (slides 6–7).**
- Rotation drags the bulge axis ahead of the Earth–Moon line, so the bulges lead slightly. The resulting torque opposes rotation and slows the spin.
- Flexing of solid Earth and sloshing oceans dissipate rotational energy as heat.
- Day lengthening: slide 6 says "about 0.002 s per century" and slide 9 says "~2.3 ms per century". These are consistent; use 2.3 ms/century.
- Earth's tides on the Moon vs. the Moon's on Earth: (M⊕R☾)/(M☾R⊕) ≈ 22, quoted as **~20×**. The Moon is therefore already **tidally locked** (rotation period = orbital period, so the torque and dissipation stop).

**4. Long-term Earth–Moon evolution (slides 8–9).**
- Earth's leading bulge pulls the Moon forward along its orbit, so v_θ and L = m r v_θ grow.
- Kepler III for a circular orbit: P² = kr³ ⇒ v = 2πr/P ∝ r^(−1/2) ⇒ **L ∝ r v ∝ r^(1/2)**. A larger orbit has more L but lower speed, so the Moon spirals outward.
- The spin L that Earth loses equals the orbital L the Moon gains (conservation of angular momentum).
- Sequence: Earth's tides on the Moon lock the Moon. The Moon's tides on Earth slow Earth's spin and push the Moon out. Eventually Earth locks to the Moon too, and evolution stops. This is the very distant future.

**5. Roche limit (slides 10–11).**
- Disruption when self-gravity < tidal acceleration across the satellite: GM_m/R_m² < 2GM_pR_m/r³.
- ⇒ **r = f_R (ρ_p/ρ_m)^(1/3) R_p**, with f_R = 2.456 (slide 10, Roche's fluid-body result). The naive rigid-sphere estimate from the inequality gives 2^(1/3) ≈ 1.26.
- Gravity dominates cohesion for R ≳ 500 km. Smaller bodies such as comets are held by material strength.
- Example (slide 11 uses 2.44): icy body ρ_m ≈ 1200 kg/m³ at Saturn (R_p = 60,000 km, ρ_p ≈ 690 kg/m³) gives d = 2.44(690/1200)^(1/3) R_p = 2.03 R_p ≈ **122,000 km**. With 2.456 it is 2.04 R_p ≈ 122,500 km. Saturn's rings span 80,000–136,000 km, so they lie largely inside the limit. **Pick one coefficient for the whole page and note the discrepancy.**
- The rings' total mass, ~10¹⁶ kg, at 1200 kg/m³ would make one body of radius ≈ **13 km**.

**Learning goals (slide 12):** observable consequences (ocean tides, locking, friction and heating, disruption); origin of the force and the football-shaped deformation; the meaning of every symbol (m is a test mass that cancels in ratios; M is the *perturbing* body, not the deformed one); the Earth–Moon evolution sequence and why it conserves angular momentum; using the Roche limit in calculations.

## Acceptance checks (numbers the page must reproduce)

- Exact ΔF vs. −4GMmR/d³: the ratio → 1 as R/d → 0. Show the error growing as R/d increases.
- Sun/Moon tidal ratio ≈ 0.456 (≈5/11) with the constants above.
- Earth-on-Moon / Moon-on-Earth ≈ 22 (quoted ~20).
- Roche (Saturn, icy body) ≈ 2.03–2.04 R_p ≈ 122,000 km, inside the ring span.
- L_orb ∝ r^(1/2) and v ∝ r^(−1/2) (check at two radii).
- Ring-mass equivalent body radius ≈ 13 km.

## Honesty notes for the visuals

- Real tidal bulges are about 0.5 m on a 6371 km Earth. Any visible football shape is exaggerated by about 10⁶×, so label the exaggeration factor on screen.
- Distances (Earth–Moon, Earth–Sun) cannot be drawn to scale alongside the bodies. Say so where they are not.
- Any Earth–Moon time evolution is schematic unless it is integrated from a stated tidal model. Label it.

## Design brief (give this to the designer if the spec is missing)

Write `docs/tidal_forces_design.md`, concrete enough to build without re-deriving the physics:
- Title, subtitle, file names, and a tab list (about 4 tabs following the lecture arc).
- For each tab: teaching point, panel layout, what is drawn (geometry, token colors, arrow scaling, labels), controls (ranges, defaults, presets), animation, readouts, caption, and formula-strip KaTeX.
- Physics model: formulas, constants, exact vs. first-order, and the numerical method for anything integrated.
- The `window.__tidal` API, acceptance checks, and model unit tests.
- Index-card copy (title, desc, 4 tags, glyph), README line, and the make_thumbs `shot` line.
- Scope it to be buildable in one pass. Prefer things students manipulate (drag the Moon, move a satellite inward, scrub time) over static diagrams.

## Starting outline (if designing from scratch)

1. **Differential force**: Earth with a ring of test points and a draggable perturber. Toggle "relative to perturber" vs. "relative to center" arrows. A slider for R/d compares exact ΔF with −4GMmR/d³. An exaggerated football-shaped equilibrium bulge.
2. **Sun + Moon tides**: Moon phase slider/animation and Sun and Moon bulges added as vectors. Spring vs. neap presets, plus a tide-height-vs-time plot at a coastal point (12.4 h semidiurnal beat with 14.8-day spring–neap envelope).
3. **Tidal friction & evolution**: a rotating Earth with a lagged bulge, the torque on the Moon, and the Moon's orbit drifting outward. Readouts for day length, month, and Earth–Moon distance, plus a bar chart of spin L vs. orbital L with a constant total. End state: both locked.
4. **Roche limit**: drag a self-gravitating rubble moon toward a planet (preset Saturn) with density sliders. Show the self-gravity vs. tidal arrows and the Roche radius circle. Inside it, the moon breaks into a ring arc. Include the Saturn worked example and the 13 km ring-mass note.
