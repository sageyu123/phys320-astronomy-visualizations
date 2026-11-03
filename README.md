# NJIT PHYS 320 Fall 2026: Astronomy Teaching Visualizations

Interactive teaching visualizations for PHYS 320 (Astronomy) at NJIT, Fall 2026 — covering the historical development of planetary models (Ptolemaic geocentric astronomy and its heliocentric equivalence), sky coordinates, Kepler's laws, two-body orbits, Newton's cannon and orbital energy, stellar parallax and magnitudes, and tidal effects.

## Entry Points
- Live site: <https://sageyu123.github.io/phys320-astronomy-visualizations/>
- `index.html` opens the landing page.
- `html/ptolemy_model.html` — Ptolemy's model: eccentric, epicycle, equant, the full Almagest construction, and a geocentric ⇄ heliocentric comparison.
- `html/altaz_radec.html` — Sky coordinates: alt-az versus RA/Dec on a rotatable celestial sphere, with all-sky and RA/Dec chart views, the origin of the vernal equinox (Earth's orbit and tilted axis), and sidereal time: what LST is, why a star clock beats a Sun clock (the sidereal vs the solar day), and h = LST − α.
- `html/precession.html` — Earth's axial precession: the axis cone, gravitational torque on the equatorial bulge, and the changing celestial pole and equinox.
- `html/kepler_laws.html` — Kepler's three laws, with Ptolemy's equant compared to the ellipse.
- `html/two_body.html` — Two-body orbits: center of mass, the CM reference frame, and the reduced mass, with the barycenter drawn to scale against the primary.
- `html/newtons_cannon.html` — Newton's cannon: from the falling apple and the falling Moon to circular, elliptical, parabolic, and hyperbolic paths, with orbital energy, escape speed, and the vis-viva equation.
- `html/spherical_shell.html` — Newton’s shell theorem: a rotatable 3D sphere, animated ring integration with a running force sum and paired force-contribution integrals comparing shell rings with their masses relocated to the center, gravitational force inside and outside a uniform spherical shell, the calculus derivation, and Dyson Sphere / Ringworld comparisons with draggable test masses.
- `html/geometric_optics.html` — Geometric optics for astronomy: thin-lens ray diagrams, a signed-radius lens-maker view, and focal-plane image size, f-ratio, plate scale, and pixel scale for telescopes.
- `html/star_distances.html` — Star distances: stellar parallax, the parsec, a true-scale view of the baseline, then the magnitude scale, absolute magnitude, and the distance modulus.
- `html/nebula_disk.html` — Nebula to disk: why a collapsing, rotating cloud flattens, with sticky-parcel collapse under self-gravity, conserved angular momentum against dissipated energy, and the one-parcel centrifugal barrier.
- `html/nice_model.html` — Planetary migration (the Nice model): one planetesimal flyby and the planet's response, thousands of such flybys that move Jupiter in and the other giants out, a scripted replay of the 2:1 crossing and the Late Heavy Bombardment, and the Kuiper belt and Oort cloud left behind.
- `html/planet_building.html` — Building the planets: the snow line and the solids available at each radius, runaway growth in a shearing patch of planetesimals, and the asteroid belt, where Jupiter's stirring makes collisions destructive and its resonances carve the Kirkwood gaps.
- `html/tidal_forces.html` — Tidal forces: differential gravity across a body and the football shape, Sun versus Moon tides with spring and neap, tidal friction and the braking torque, the Earth–Moon spiral-out by angular-momentum conservation, and the Roche limit with the Saturn-ring example.

## Running Locally
Serve the folder with `python3 -m http.server`, then open the local address in a modern browser. Pages such as Geometric Optics load local JavaScript modules and require an HTTP server rather than opening the HTML file directly.

## Corrections
These materials may contain errors. If you spot a mistake or have a suggested improvement, please open an issue or let me know — I am happy to update the materials and credit useful corrections.
