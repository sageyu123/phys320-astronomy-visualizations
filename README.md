# NJIT PHYS 320 Fall 2026: Astronomy Teaching Visualizations

Interactive teaching visualizations for PHYS 320 (Astronomy) at NJIT, Fall 2026 — covering the historical development of planetary models (Ptolemaic geocentric astronomy and its heliocentric equivalence), sky coordinates, Kepler's laws, two-body orbits, Newton's cannon and orbital energy, and stellar parallax and magnitudes.

## Entry Points
- Live site: <https://sageyu123.github.io/phys320-astronomy-visualizations/>
- `index.html` opens the landing page.
- `html/ptolemy_model.html` — Ptolemy's model: eccentric, epicycle, equant, the full Almagest construction, and a geocentric ⇄ heliocentric comparison.
- `html/altaz_radec.html` — Sky coordinates: alt-az versus RA/Dec on a rotatable celestial sphere, with all-sky and RA/Dec chart views, the origin of the vernal equinox (Earth's orbit and tilted axis), and sidereal time: what LST is, why a star clock beats a Sun clock (the sidereal vs the solar day), and h = LST − α.
- `html/kepler_laws.html` — Kepler's three laws, with Ptolemy's equant compared to the ellipse.
- `html/two_body.html` — Two-body orbits: center of mass, the CM reference frame, and the reduced mass, with the barycenter drawn to scale against the primary.
- `html/newtons_cannon.html` — Newton's cannon: from the falling apple and the falling Moon to circular, elliptical, parabolic, and hyperbolic paths, with orbital energy, escape speed, and the vis-viva equation.
- `html/star_distances.html` — Star distances: stellar parallax, the parsec, a true-scale view of the baseline, then the magnitude scale, absolute magnitude, and the distance modulus.

## Running Locally
Every page is a single self-contained HTML file with no dependencies. Open it directly in any modern browser, or serve the folder with `python3 -m http.server`.

## Corrections
These materials may contain errors. If you spot a mistake or have a suggested improvement, please open an issue or let me know — I am happy to update the materials and credit useful corrections.
