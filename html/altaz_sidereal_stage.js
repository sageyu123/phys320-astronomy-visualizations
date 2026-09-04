/* =============================================================================
   ALTAZ SIDEREAL STAGE — "star clock vs Sun clock" teaching stage
   PHYS 320 — companion module for html/altaz_radec.html (imported by it as an
   ES module; this file is otherwise self-contained, mirroring the convention
   set by html/altaz_origin_stage.js: everything the drawing code needs comes
   in through `deps`, and this file itself has NO `import` statements at all
   (verified with `node --check`) so the host controls exactly which build of
   its own color system gets handed down.

   deps = { COLORS, hexAlpha }
     COLORS   — plain object of CSS hex strings, e.g. COLORS.cyan === "#56c7d9"
                (see html/altaz_radec.html's loadColors()/cssVar() for how the
                host itself builds this from its CSS custom properties). Keys
                used here: cyan, amber, magenta, purple, text, muted, border,
                "border-strong", canvas, "panel-deep", panel, "panel-raised",
                green, coral.
     hexAlpha — hexAlpha(hex, alpha) -> "rgba(r,g,b,alpha)" string, identical
                in behaviour to the same-named helper in altaz_radec.html.

   WHAT THIS TEACHES: a sidereal day (Earth turning once relative to the
   fixed stars) is a few minutes SHORTER than a solar day (Earth turning
   until the Sun is back on the meridian), because Earth also advances along
   its orbit during the day, so it has to turn a little bit extra to catch
   the Sun back up. That few-minutes-per-day gap is exactly why a sidereal
   clock (LST) drifts ahead of an ordinary (solar) clock by about 3 m 56.6 s
   every day -- 360 degrees over one year, i.e. one whole extra sidereal
   "lap" per year (366.25 sidereal days == 365.25 solar days).

   PHYSICS MODEL (all true-scale, mean Sun -- no dramatization of any angle
   or duration; every number this module reports is the literal output of
   the formulas below, not a stylised stand-in for them):

     SID_RATE = 1.00273791          sidereal hours per mean-solar hour
     T_SID_H  = 24 / SID_RATE       length of a sidereal day in ordinary
                                    (solar) hours = 23.934470 h, and
                                    hmsParts()/fmtHMS() render that as
                                    "23 h 56 m 04 s" -- see the self-check
                                    at the bottom of this file's header for
                                    the arithmetic identity that makes this
                                    exact rather than approximate.
     YEAR_DAYS = 365.2422           mean tropical year, days
     GAIN_H   = 24 / YEAR_DAYS      how much LST advances beyond 24 h in one
                                    solar day (0.0657098 h = 3 m 56.6 s) --
                                    also how much LST-at-local-noon advances,
                                    day over day
     SUN_DEG_PER_DAY = 360/YEAR_DAYS  the Sun's apparent daily eastward
                                    creep against the stars, ~0.9856 deg/day

   Day `n` (integer, 0..365) counts solar days since local mean noon of
   March 20 (day-of-year 79 in a 365-day calendar): at that instant the mean
   Sun sits at the vernal point ("Aries", RA 0h), so LST = 0. `t` is clock
   hours since noon of day n, 0 <= t <= 24. Angles below are measured in the
   orbital plane, looking down from above Earth's north pole, CCW from the
   fixed direction to Aries -- which this module always draws along screen
   +x, so "CCW on screen" needs the usual y-flip (polar() below negates the
   sin term for exactly that reason).

       lmtHours       = (12 + t) mod 24
       lstHours       = (n*GAIN_H + t*SID_RATE) mod 24
       sunAngleDeg    = (n + t/24) * SUN_DEG_PER_DAY         -- Sun direction,
                        seen from Earth, mod 360
       pointerAngleDeg = n*SUN_DEG_PER_DAY + 360*t/T_SID_H    -- the observer's
                        meridian, mod 360; by construction this equals
                        sunAngleDeg again exactly at t=24 (Earth has turned
                        360 deg relative to the stars PLUS the day's Sun
                        creep -- see the algebraic identity in the header of
                        drawEarthView() below)
       tVernal(n)     = T_SID_H - n*(24 - T_SID_H)            -- the clock
                        time (since noon) at which Aries recrosses the
                        meridian; earlier each day by (24-T_SID_H), the same
                        ~3 m 56 s gap in reverse
       Theta (orbit)  = 180 + (n + t/24)*SUN_DEG_PER_DAY       -- Earth's own
                        angle around the Sun, for the orbit inset (Earth
                        starts opposite Aries, at 180 deg, on day 0)

   SCRIPTED TIMELINE (advance()): each day runs through four phases --
   "spin" (t: 0 -> tVernal, at the caller's speedHoursPerSec) then a 1 s
   "dwellSid" pause (Aries back on the meridian: one sidereal day is done)
   then "extra" (t: tVernal -> 24, deliberately slowed to at least 1.5 real
   seconds so the "extra turn" the lecture is about doesn't just flash by)
   then a 1 s "dwellSol" pause (Sun back on the meridian: one solar day is
   done) -- then day n+1, t=0, phase "spin" again. See advance()'s own
   comment for the real-time bookkeeping.

   RETURNS (see each function's own comment for detail):
     {
       reset(), setDay(n), setTime(tHours), advance(dtSec, speedHoursPerSec),
       getState(), draw(ctx, cssW, cssH, opts), drawStrip(ctx, cssW, cssH, opts)
     }
   ============================================================================= */

export function createSiderealStage(deps) {
  const COLORS = deps.COLORS;
  const hexAlpha = deps.hexAlpha;

  /* ---------------------------------------------------------------------
     constants + tiny numeric helpers (self-contained -- this module does
     not import altaz_radec.html's TAU/RAD/DEG/norm360, it just re-declares
     the same conventions locally)
     --------------------------------------------------------------------- */
  const TAU = Math.PI * 2;
  const RAD = Math.PI / 180;
  const DEG = 180 / Math.PI;

  const SID_RATE = 1.00273791;
  const T_SID_H = 24 / SID_RATE;              // 23.934470... h
  const YEAR_DAYS = 365.2422;
  const GAIN_H = 24 / YEAR_DAYS;               // 0.0657098... h
  const SUN_DEG_PER_DAY = 360 / YEAR_DAYS;     // 0.985647... deg/day
  const TVERNAL_STEP = 24 - T_SID_H;           // ~0.06553 h, the "earlier each day" step

  function mod(a, n) { const r = a % n; return r < 0 ? r + n : r; }
  function mod360(a) { return mod(a, 360); }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function tVernal(n) { return T_SID_H - n * TVERNAL_STEP; }
  function pad2(x) { return (x < 10 ? "0" : "") + x; }

  // floor-based H/MM/SS split -- matches a real clock (it TICKS to the next
  // second rather than rounding to the nearest one); +1e-7 just guards the
  // exact-integer case from floating point landing a hair under it.
  function hmsParts(hoursFloat) {
    const totalSec = Math.floor(hoursFloat * 3600 + 1e-7);
    const hh = Math.floor(totalSec / 3600);
    const mm = Math.floor((totalSec % 3600) / 60);
    const ss = totalSec % 60;
    return { hh, mm, ss };
  }
  function fmtClock(hoursFloat) {            // "HH:MM:SS", wrapped to a 24h face
    const p = hmsParts(mod(hoursFloat, 24));
    return pad2(p.hh) + ":" + pad2(p.mm) + ":" + pad2(p.ss);
  }
  function fmtHMS(hoursFloat) {              // "H h MM m SS s", NOT wrapped (durations)
    const p = hmsParts(hoursFloat);
    return p.hh + " h " + pad2(p.mm) + " m " + pad2(p.ss) + " s";
  }

  const MONTH_LEN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function dayOfYearToLabel(doy) {
    let m = 0, rem = doy;
    while (rem > MONTH_LEN[m]) { rem -= MONTH_LEN[m]; m++; }
    return MONTH_NAMES[m] + " " + rem;
  }
  function calendarLabel(n) {
    const doy = mod(79 + n - 1, 365) + 1;
    return dayOfYearToLabel(doy);
  }
  // n (0..365) at which a given day-of-year falls, inverse of the line above
  // -- used only to lay out the strip chart's month gridlines below.
  function nOfDoy(doy) { return mod(doy - 79, 365); }

  /* =======================================================================
     STATE + SCRIPTED TIMELINE
     ======================================================================= */
  const state = {
    day: 0, t: 0, phase: "spin",
    dwellElapsed: 0,     // real seconds accumulated in the current dwell*
    extraElapsed: 0,     // real seconds accumulated in the current "extra"
    extraDur: 0          // real seconds the current "extra" phase should take
  };

  function derivePhaseFromT() {
    state.dwellElapsed = 0; state.extraElapsed = 0; state.extraDur = 0;
    state.phase = (state.t < tVernal(state.day)) ? "spin" : "extra";
  }

  function reset() {
    state.day = 0; state.t = 0; state.phase = "spin";
    state.dwellElapsed = 0; state.extraElapsed = 0; state.extraDur = 0;
  }

  function setDay(n) {
    state.day = clamp(Math.round(n), 0, 365);
    derivePhaseFromT();
  }

  function setTime(tHours) {
    state.t = clamp(tHours, 0, 24);
    derivePhaseFromT();
  }

  /* Advances the scripted timeline by dtSec of REAL (wall-clock) time.
     During "spin"/"extra" that real time buys speedHoursPerSec of simulated
     clock-hours (dt_hours = dtSec*speed); during the two "dwell*" pauses it
     just counts toward their fixed 1.0 s hold. A single call can cross
     several phase (even day) boundaries -- e.g. a big dtSec, or speed
     cranked way up -- so this runs a small bounded loop rather than
     assuming at most one transition per call. Returns true iff any state
     field actually moved (false for a zero/negative dtSec, or a
     speedHoursPerSec <= 0 while stuck in a phase that can only advance via
     simulated hours -- that combination truly can't progress, so this
     bails out rather than spinning the loop forever). */
  function advance(dtSec, speedHoursPerSec) {
    if (!(dtSec > 0)) return false;
    let remaining = dtSec;
    let changed = false;
    let guard = 0;
    while (remaining > 1e-9 && guard < 10000) {
      guard++;
      if (state.phase === "spin") {
        const tv = tVernal(state.day);
        const room = tv - state.t;
        if (room <= 1e-9) {
          state.t = tv; state.phase = "dwellSid"; state.dwellElapsed = 0;
          changed = true; continue;
        }
        if (!(speedHoursPerSec > 0)) break;              // can't advance -- stop here
        const availHours = remaining * speedHoursPerSec;
        if (availHours >= room) {
          remaining -= room / speedHoursPerSec;
          state.t = tv; state.phase = "dwellSid"; state.dwellElapsed = 0;
        } else {
          state.t += availHours;
          remaining = 0;
        }
        changed = true;
      } else if (state.phase === "dwellSid") {
        const room = 1.0 - state.dwellElapsed;
        if (remaining >= room) {
          remaining -= room;
          state.phase = "extra"; state.extraElapsed = 0;
          const hoursLeft = 24 - state.t; // == 24 - tVernal(day)
          const naturalDur = (speedHoursPerSec > 0) ? hoursLeft / speedHoursPerSec : Infinity;
          state.extraDur = Math.max(1.5, naturalDur);
        } else {
          state.dwellElapsed += remaining; remaining = 0;
        }
        changed = true;
      } else if (state.phase === "extra") {
        const tv = tVernal(state.day);
        const hoursLeft = 24 - tv;
        if (!(state.extraDur > 0)) {
          const naturalDur = (speedHoursPerSec > 0) ? hoursLeft / speedHoursPerSec : Infinity;
          state.extraDur = Math.max(1.5, naturalDur);
        }
        const room = state.extraDur - state.extraElapsed;
        if (room <= 1e-9) {
          state.t = 24; state.phase = "dwellSol"; state.dwellElapsed = 0;
          changed = true; continue;
        }
        if (remaining >= room) {
          remaining -= room;
          state.t = 24; state.phase = "dwellSol"; state.dwellElapsed = 0;
        } else {
          state.extraElapsed += remaining;
          state.t = tv + (state.extraElapsed / state.extraDur) * hoursLeft;
          remaining = 0;
        }
        changed = true;
      } else { // "dwellSol"
        const room = 1.0 - state.dwellElapsed;
        if (remaining >= room) {
          remaining -= room;
          state.day = (state.day + 1) % 366;
          if (state.day > 365) state.day = 0; // defensive; 366 only ever appears via the mod above
          state.t = 0; state.phase = "spin";
          state.dwellElapsed = 0; state.extraElapsed = 0; state.extraDur = 0;
        } else {
          state.dwellElapsed += remaining; remaining = 0;
        }
        changed = true;
      }
    }
    return changed;
  }

  function computeBanner(n, t, phase) {
    if (phase === "spin") {
      return { text: "Earth turns once relative to the stars every 23 h 56 m 04 s", color: "muted" };
    }
    if (phase === "dwellSid") {
      return { text: "♈ is back on the meridian — one sidereal day, 23 h 56 m 04 s", color: "cyan" };
    }
    if (phase === "extra") {
      // The label's own wording quotes the familiar rounded "0.986 deg/day"
      // figure a student would memorize; the NUMBER itself is computed from
      // the precise SUN_DEG_PER_DAY constant above so it stays exactly
      // consistent with the wedge actually drawn in the Earth view (using
      // the literal 0.986 here would drift from the true angle by up to
      // ~0.1 deg by the end of the year).
      const X = (n + 1) * SUN_DEG_PER_DAY;
      return { text: "…but the Sun has moved on: Earth must turn " + X.toFixed(2) + "° more", color: "amber" };
    }
    return { text: "the Sun is back on the meridian — one solar day, 24 h 00 m", color: "amber" };
  }

  function getState() {
    const n = state.day, t = state.t;
    const lmtHours = mod(12 + t, 24);
    const lstHours = mod(n * GAIN_H + t * SID_RATE, 24);
    const sunAngleDeg = mod360((n + t / 24) * SUN_DEG_PER_DAY);
    const pointerAngleDeg = mod360(n * SUN_DEG_PER_DAY + 360 * t / T_SID_H);
    return {
      day: n, tHours: t, phase: state.phase,
      lmtHours, lstHours, sunAngleDeg, pointerAngleDeg,
      calendarLabel: calendarLabel(n),
      T_SID_H, GAIN_H,
      banner: computeBanner(n, t, state.phase)
    };
  }

  /* =======================================================================
     SHARED DRAWING HELPERS
     ======================================================================= */

  // Angle convention for BOTH draw() and drawStrip()'s hero geometry: degrees
  // CCW from screen +x, with the mandatory y-flip so "increasing angle" is
  // visually CCW on screen (screen y grows downward, math angles grow CCW
  // when y grows upward -- flipping the sin term reconciles the two).
  function polar(cx, cy, r, angleDeg) {
    const a = angleDeg * RAD;
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  }
  function angleDiff(a, b) { let d = mod(a - b + 180, 360) - 180; return Math.abs(d); }
  function angleNear(a, b, tolDeg) { return angleDiff(a, b) <= tolDeg; }

  // Generic straight arrow (line + triangular head) between two PIXEL points
  // -- built from the actual endpoints rather than re-deriving a heading
  // from an angle, so it is agnostic to whichever polar() convention placed
  // those endpoints.
  function drawArrow(ctx, x0, y0, x1, y1, opts) {
    opts = opts || {};
    const color = opts.color || COLORS.text;
    const lw = (opts.lineWidth != null) ? opts.lineWidth : 2;
    const head = (opts.head != null) ? opts.head : 8;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.setLineDash(opts.dash || []);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    if (opts.head !== 0) {
      const ang = Math.atan2(y1 - y0, x1 - x0);
      const s1 = ang + Math.PI - 0.42, s2 = ang + Math.PI + 0.42;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + head * Math.cos(s1), y1 + head * Math.sin(s1));
      ctx.lineTo(x1 + head * Math.cos(s2), y1 + head * Math.sin(s2));
      ctx.closePath();
      ctx.fillStyle = color; ctx.fill();
    }
    ctx.restore();
  }

  // Soft radial-gradient glow behind a filled dot -- the Canvas-2D
  // equivalent of altaz_radec.html's pre-rendered glow SPRITE (drawGlow +
  // makeGlowSprite there), reimplemented with a gradient here since this
  // module receives no canvas/image dependency to draw a sprite from.
  function drawGlowDot(ctx, x, y, colorHex, r, glowR) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
    g.addColorStop(0, hexAlpha(colorHex, 0.55));
    g.addColorStop(1, hexAlpha(colorHex, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, glowR, 0, TAU); ctx.fill();
    ctx.fillStyle = colorHex;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }

  // Rounded-rect path (own implementation rather than ctx.roundRect(), which
  // is a relatively recent Canvas addition and this module targets whatever
  // Canvas 2D the rest of the site already assumes).
  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // A left-aligned label made of up to three runs with different fonts,
  // used everywhere this stage needs the serif ♈ glyph inline with the
  // Inter UI font (canvas can't mix fonts within a single fillText call).
  function drawRunsLeft(ctx, x, y, runs) {
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    let cx = x;
    for (const run of runs) {
      ctx.font = run.font; ctx.fillStyle = run.color;
      ctx.fillText(run.text, cx, y);
      cx += ctx.measureText(run.text).width;
    }
  }
  function drawRunsRight(ctx, x, y, runs) {
    // same idea, but anchored so the LAST run's right edge sits at x
    ctx.textBaseline = "middle";
    let totalW = 0;
    for (const run of runs) { ctx.font = run.font; totalW += ctx.measureText(run.text).width; }
    let cx = x - totalW;
    ctx.textAlign = "left";
    for (const run of runs) {
      ctx.font = run.font; ctx.fillStyle = run.color;
      ctx.fillText(run.text, cx, y);
      cx += ctx.measureText(run.text).width;
    }
  }

  // Greedy word-wrap for a single ctx.font -- used by the orbit inset's
  // title, which is wide enough (~230px at its spec'd size) to overrun the
  // inset box's own spec'd minimum width (170px) if drawn on one line.
  function wrapText(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let cur = "";
    for (const word of words) {
      const test = cur ? cur + " " + word : word;
      if (cur && ctx.measureText(test).width > maxWidth) { lines.push(cur); cur = word; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  const UI_FONT = "Inter, sans-serif";
  // "serif" alone frequently has NO glyph for U+2648 (♈) -- verified against
  // this project's own headless Chrome test rig, where plain "serif" (and
  // "sans-serif", and several named symbol fonts not actually installed)
  // all fell back to Chromium's solid-box .notdef glyph, while only the
  // macOS-only "Apple Symbols" actually drew the ram's-horn character. Kept
  // "serif" as the final fallback per the site's own drawHlstDial()
  // convention in altaz_radec.html, but tried ahead of it are the couple of
  // symbol-coverage fonts most likely to exist per platform (macOS/Windows).
  const GLYPH_FONT = "'Apple Symbols', 'Segoe UI Symbol', serif";

  // Filled + stroked angular wedge from a0 to a1 (degrees, CCW, a1 taken
  // mod 360 relative to a0 so it never wraps past a full turn), centred at
  // (cx,cy), radius r. Shared by the Earth-view wedge and the orbit-inset
  // wedge -- "same angle... same geometry helper" keeps the two visually
  // consistent by construction rather than by two hand-matched copies.
  function drawWedgeArc(ctx, cx, cy, r, a0, a1Raw, colorHex, fillAlpha, strokeW) {
    const span = mod360(a1Raw - a0);
    if (span < 0.05) return 0;
    const n = 40;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    for (let i = 0; i <= n; i++) {
      const a = a0 + span * (i / n);
      const p = polar(cx, cy, r, a);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle = hexAlpha(colorHex, fillAlpha);
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = a0 + span * (i / n);
      const p = polar(cx, cy, r, a);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = hexAlpha(colorHex, 0.9);
    ctx.lineWidth = strokeW;
    ctx.stroke();
    return span;
  }

  /* =======================================================================
     draw() -- the main teaching canvas
     ======================================================================= */
  function draw(ctx, cssW, cssH, opts) {
    opts = opts || {};
    const topInset = clamp(opts.topInsetPx || 0, 0, 46);
    const starName = opts.starName || "the star";
    const starRA = (opts.starRA != null) ? opts.starRA : 6.75;

    const w = cssW, h = cssH;
    const H = h - topInset;
    const m = Math.min(w, H);
    const st = getState();

    ctx.fillStyle = COLORS.canvas;
    ctx.fillRect(0, 0, w, h);
    // topInset band intentionally left as bare background -- the host draws
    // its own UI overlay there.

    drawEarthView(ctx, w, topInset, H, m, st);
    drawOrbitInset(ctx, w, topInset, m, st);
    drawTwoClocks(ctx, w, topInset, m, st);
    drawBanner(ctx, w, h, st);
  }

  function drawEarthView(ctx, w, topInset, H, m, st) {
    const cx = 0.42 * w, cy = topInset + 0.54 * H;
    const rE = 0.16 * m, L = 0.40 * m;

    // Earth disc
    ctx.beginPath(); ctx.arc(cx, cy, rE, 0, TAU);
    ctx.fillStyle = hexAlpha(COLORS.cyan, 0.10); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = hexAlpha(COLORS.cyan, 0.5); ctx.stroke();

    // four faint meridian spokes, rotating with the pointer -- makes the
    // spin itself legible even when the pointer/label alone might read as
    // static from frame to frame
    ctx.strokeStyle = hexAlpha(COLORS.text, 0.15); ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      const p = polar(cx, cy, rE, st.pointerAngleDeg + k * 90);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p.x, p.y); ctx.stroke();
    }

    // wedge between the Aries ray (angle 0) and the Sun ray (angle sunAngleDeg)
    const bright = (st.phase === "extra" || st.phase === "dwellSol");
    const wedgeR = 0.88 * L;
    const wedgeDeg = drawWedgeArc(ctx, cx, cy, wedgeR, 0, st.sunAngleDeg, COLORS.amber,
      bright ? 0.22 : 0.10, bright ? 2.2 : 1.5);

    // Three ray labels (pointer / Aries / Sun) can all swing close together
    // in angle -- most obviously right around day 0, where the Aries ray
    // (fixed at 0) and the Sun ray (still within ~1 deg of 0 all year-start)
    // sit almost on top of each other AND the sweeping pointer passes both
    // at once. The spec's own "push the near ray's label out by 14px"
    // handles a pointer brushing past a SINGLE ray, but not this coincidence
    // of two or three at once, so this groups whichever of the three angles
    // are mutually within 10 deg and gives every member of a group the SAME
    // anchor point (the outermost member's radius, at the group's mean
    // angle) with rows stacked under it in a fixed pointer/Aries/Sun
    // priority order -- sharing one anchor is what actually guarantees a
    // clean vertical list; staggering each label from its OWN ray's radius
    // (which differ) instead produces a diagonal cascade that can still
    // clip, since the three rays' individual label radii were tuned for
    // "one ray's label alone", not for stacking against each other. The
    // general "no label may overlap another" site rule outranks the single
    // named case in the spec text.
    const ariesAngle = 0;
    const rawAngles = [st.pointerAngleDeg, ariesAngle, st.sunAngleDeg];
    const group3 = [0, 1, 2];
    function unite3(i, j) {
      const gi = group3[i], gj = group3[j];
      if (gi !== gj) for (let k = 0; k < 3; k++) if (group3[k] === gj) group3[k] = gi;
    }
    if (angleNear(rawAngles[0], rawAngles[1], 10)) unite3(0, 1);
    if (angleNear(rawAngles[0], rawAngles[2], 10)) unite3(0, 2);
    if (angleNear(rawAngles[1], rawAngles[2], 10)) unite3(1, 2);
    // per-item "solo" label radius, i.e. what each ray would use if drawn alone
    const ariesNear = angleNear(st.pointerAngleDeg, ariesAngle, 8);
    const sunNearPointer = angleNear(st.pointerAngleDeg, st.sunAngleDeg, 8);
    const soloRadius = [L + 10, L + (ariesNear ? 14 : 0) + 10, L + 16 + (sunNearPointer ? 14 : 0) + 12];
    const anchor = [null, null, null]; // {x,y,align} per item, filled below
    {
      const members = {};
      for (let idx = 0; idx < 3; idx++) { const g = group3[idx]; (members[g] = members[g] || []).push(idx); }
      Object.values(members).forEach(function (idxs) {
        let sx = 0, sy = 0, maxR = 0;
        idxs.forEach(function (idx) { sx += Math.cos(rawAngles[idx] * RAD); sy += Math.sin(rawAngles[idx] * RAD); maxR = Math.max(maxR, soloRadius[idx]); });
        const meanAngle = Math.atan2(sy, sx) * DEG;
        const rightSide = Math.cos(meanAngle * RAD) >= 0;
        const base = polar(cx, cy, maxR, meanAngle);
        idxs.forEach(function (idx, rank) {
          anchor[idx] = { x: base.x + (rightSide ? 4 : -4), y: base.y + rank * 15, align: rightSide ? "left" : "right" };
        });
      });
    }

    const ariesTip = polar(cx, cy, L, ariesAngle);
    drawArrow(ctx, cx, cy, ariesTip.x, ariesTip.y, { color: COLORS.cyan, lineWidth: 1.8, head: 9 });
    {
      const a = anchor[1];
      ctx.textAlign = a.align; ctx.textBaseline = "middle";
      if (a.align === "left") {
        drawRunsLeft(ctx, a.x, a.y, [
          { text: "to ", font: "10.5px " + UI_FONT, color: COLORS.cyan },
          { text: "♈", font: "12px " + GLYPH_FONT, color: COLORS.cyan },
          { text: " — the stars", font: "10.5px " + UI_FONT, color: COLORS.cyan }
        ]);
      } else {
        drawRunsRight(ctx, a.x, a.y, [
          { text: "to ", font: "10.5px " + UI_FONT, color: COLORS.cyan },
          { text: "♈", font: "12px " + GLYPH_FONT, color: COLORS.cyan },
          { text: " — the stars", font: "10.5px " + UI_FONT, color: COLORS.cyan }
        ]);
      }
    }

    // meridian pointer -- the thing that visibly sweeps
    const pTip = polar(cx, cy, L, st.pointerAngleDeg);
    drawArrow(ctx, cx, cy, pTip.x, pTip.y, { color: COLORS.text, lineWidth: 2.2, head: 9 });
    const obs = polar(cx, cy, rE, st.pointerAngleDeg);
    ctx.beginPath(); ctx.arc(obs.x, obs.y, 4, 0, TAU); ctx.fillStyle = COLORS.text; ctx.fill();
    {
      const a = anchor[0];
      ctx.font = "10.5px " + UI_FONT; ctx.fillStyle = COLORS.text;
      ctx.textBaseline = "middle"; ctx.textAlign = a.align;
      ctx.fillText("your meridian", a.x, a.y);
    }

    // Sun ray -- ends in a small glowing disc rather than an arrowhead (the
    // Sun is a real object here, not an abstract direction)
    {
      const tip = polar(cx, cy, L, st.sunAngleDeg);
      ctx.strokeStyle = COLORS.amber; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tip.x, tip.y); ctx.stroke();
      const discP = polar(cx, cy, L + 16, st.sunAngleDeg);
      drawGlowDot(ctx, discP.x, discP.y, COLORS.amber, 7, 22);

      const a = anchor[2];
      ctx.font = "10.5px " + UI_FONT; ctx.fillStyle = COLORS.amber;
      ctx.textBaseline = "middle"; ctx.textAlign = a.align;
      ctx.fillText("to the Sun", a.x, a.y);
    }

    // wedge label -- once it's wide enough to read; kept off to the side
    // when it's still a sliver so it never lands on top of the two ray
    // labels that both sit near angle 0 at that point in the day.
    if (wedgeDeg >= 0.3) {
      const label = "(n + t/24) × 0.986° = " + wedgeDeg.toFixed(2) + "°";
      ctx.font = "10px " + UI_FONT; ctx.fillStyle = hexAlpha(COLORS.amber, 0.9);
      ctx.textBaseline = "middle";
      if (wedgeDeg < 4) {
        ctx.textAlign = "left";
        ctx.fillText(label, cx + L * 0.55, cy + 0.12 * L + 22);
      } else {
        const mid = st.sunAngleDeg / 2;
        const lp = polar(cx, cy, wedgeR + 14, mid);
        ctx.textAlign = (Math.cos(mid * RAD) >= 0) ? "left" : "right";
        ctx.fillText(label, lp.x, lp.y);
      }
    }
  }

  function drawOrbitInset(ctx, w, topInset, m, st) {
    const S = clamp(0.30 * m, 170, 300);
    const ox = 12, oy = topInset + 12;

    ctx.fillStyle = hexAlpha(COLORS["panel-deep"], 0.85);
    ctx.fillRect(ox, oy, S, S);
    ctx.lineWidth = 1; ctx.strokeStyle = COLORS.border;
    ctx.strokeRect(ox + 0.5, oy + 0.5, S - 1, S - 1);

    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.font = "600 11px " + UI_FONT; ctx.fillStyle = COLORS.text;
    // The title can overrun the box's own spec'd minimum width (170px) at
    // 11px; wrap it rather than let it spill out past the panel's border.
    const titleLines = wrapText(ctx, "Earth's orbit · from above the north pole", S - 16);
    const titleLineH = 12;
    titleLines.forEach(function (line, i) { ctx.fillText(line, ox + 8, oy + 6 + i * titleLineH); });
    const subtitleY = oy + 6 + titleLines.length * titleLineH + 2;
    ctx.font = "10px " + UI_FONT; ctx.fillStyle = COLORS.muted;
    ctx.fillText("Mar 20 + " + st.day + " d · " + st.calendarLabel, ox + 8, subtitleY);
    const headerBottom = subtitleY + 10 + 6;

    const orbitR = 0.34 * S;
    const cx = ox + S / 2;
    // Centred in the box by default, but never so high that the circle
    // would climb back up into the (possibly two-line, when wrapped)
    // header text above -- whichever placement sits lower wins.
    const cy = Math.max(oy + S / 2 + 12, oy + headerBottom + orbitR);

    // faint dashed +x reference through the Sun -- "the Aries direction is
    // the same everywhere", i.e. parallel to the cyan arrow drawn at Earth
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = hexAlpha(COLORS.cyan, 0.22); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + orbitR * 1.3, cy); ctx.stroke();
    ctx.restore();

    ctx.beginPath(); ctx.arc(cx, cy, orbitR, 0, TAU);
    ctx.strokeStyle = hexAlpha(COLORS.muted, 0.35); ctx.lineWidth = 1; ctx.stroke();

    drawGlowDot(ctx, cx, cy, COLORS.amber, 8, 24);

    const Theta = mod360(180 + (st.day + st.tHours / 24) * SUN_DEG_PER_DAY);
    const eP = polar(cx, cy, orbitR, Theta);
    ctx.beginPath(); ctx.arc(eP.x, eP.y, 5, 0, TAU); ctx.fillStyle = COLORS.cyan; ctx.fill();

    // Earth -> Aries (fixed direction, always screen +x)
    const vTip = { x: eP.x + 0.26 * S, y: eP.y };
    drawArrow(ctx, eP.x, eP.y, vTip.x, vTip.y, { color: COLORS.cyan, lineWidth: 1.6, head: 7 });
    drawRunsLeft(ctx, vTip.x + 4, vTip.y, [{ text: "♈", font: "12px " + GLYPH_FONT, color: COLORS.cyan }]);

    // Earth -> Sun
    ctx.beginPath(); ctx.moveTo(eP.x, eP.y); ctx.lineTo(cx, cy);
    ctx.strokeStyle = hexAlpha(COLORS.amber, 0.6); ctx.lineWidth = 1; ctx.stroke();

    // wedge, centred at Earth, same angle as the hero view's wedge
    const wedgeDeg = drawWedgeArc(ctx, eP.x, eP.y, 0.20 * S, 0, st.sunAngleDeg, COLORS.amber, 0.14, 1.3);
    if (wedgeDeg >= 3) {
      const mid = st.sunAngleDeg / 2;
      const lp = polar(eP.x, eP.y, 0.20 * S + 10, mid);
      ctx.font = "9.5px " + UI_FONT; ctx.fillStyle = hexAlpha(COLORS.amber, 0.9);
      ctx.textBaseline = "middle";
      ctx.textAlign = (Math.cos(mid * RAD) >= 0) ? "left" : "right";
      ctx.fillText(wedgeDeg.toFixed(2) + "°", lp.x, lp.y);
    }
  }

  function dialPoint(cx, cy, r, angDegFromTopCW) {
    const a = angDegFromTopCW * RAD;
    return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
  }

  function drawOneClock(ctx, cx, cy, rc, o) {
    ctx.beginPath(); ctx.arc(cx, cy, rc, 0, TAU);
    ctx.fillStyle = hexAlpha(COLORS["panel-deep"], 0.85); ctx.fill();
    ctx.lineWidth = o.flash ? 2.5 : 1;
    ctx.strokeStyle = o.flash ? o.color : COLORS.border;
    ctx.stroke();

    for (let k = 0; k < 24; k++) {
      const ang = (k / 24) * 360;
      const major = (k % 6 === 0);
      const p1 = dialPoint(cx, cy, rc * 0.84, ang);
      const p2 = dialPoint(cx, cy, rc * 0.98, ang);
      ctx.strokeStyle = hexAlpha(COLORS.muted, major ? 0.6 : 0.28);
      ctx.lineWidth = major ? 1.3 : 0.8;
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }
    ctx.font = "9px " + UI_FONT; ctx.fillStyle = COLORS.muted;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    [[0, "0"], [6, "6"], [12, "12"], [18, "18"]].forEach(function (d) {
      const p = dialPoint(cx, cy, rc * 0.66, (d[0] / 24) * 360);
      ctx.fillText(d[1], p.x, p.y);
    });

    const ang = (o.hours / 24) * 360;
    const tip = dialPoint(cx, cy, rc * 0.72, ang);
    ctx.strokeStyle = o.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 2.2, 0, TAU); ctx.fillStyle = o.color; ctx.fill();

    ctx.font = "600 11px " + UI_FONT; ctx.fillStyle = o.color;
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText(o.title, cx, cy - rc - 8);

    ctx.font = "11px " + UI_FONT; ctx.fillStyle = COLORS.text;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(o.readoutLabel + " " + o.readoutValue, cx, cy + rc + 8);
  }

  function drawTwoClocks(ctx, w, topInset, m, st) {
    const rc = clamp(0.085 * m, 40, 66);
    const cy = topInset + 12 + rc + 16;
    const cxSid = w - 12 - 3.4 * rc;
    const cxSol = w - 12 - rc;

    drawOneClock(ctx, cxSid, cy, rc, {
      title: "Sidereal clock", color: COLORS.cyan,
      hours: st.lstHours, flash: (st.phase === "dwellSid"),
      readoutLabel: "LST", readoutValue: fmtClock(st.lstHours)
    });
    drawOneClock(ctx, cxSol, cy, rc, {
      title: "Solar clock", color: COLORS.amber,
      hours: st.lmtHours, flash: (st.phase === "dwellSol"),
      readoutLabel: "mean time", readoutValue: fmtClock(st.lmtHours)
    });

    const solarAsHourAngle = mod(st.lmtHours - 12 + 24, 24);
    const gain = mod(st.lstHours - solarAsHourAngle + 48, 24);
    const gy = cy + rc + 26;
    const gainText = "LST − solar: +" + st.day + " × 3 m 56.6 s = +" + fmtHMS(gain);
    // Centred under the two dials, at a font size shrunk (down to a 7px
    // floor) just enough that it fits WITHOUT sliding off-centre -- the
    // two-dial cluster sits close to the right edge (both anchored off
    // w-12), so at narrow canvas widths this, the longest line in the whole
    // stage, has little natural clearance on the right. Re-centring it
    // instead of shrinking it would have been the simpler fix, but the
    // Earth view's own labels can reach up into that same left-of-clocks
    // real estate at some day/time combinations, so sliding this block
    // sideways risks trading one collision for another; shrinking it in
    // place never leaves its own designated column.
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillStyle = COLORS.cyan;
    const naturalGx = (cxSid + cxSol) / 2;
    const maxHalfW = Math.max(30, Math.min(naturalGx - 8, w - 8 - naturalGx));
    let gainFontPx = 10.5;
    ctx.font = gainFontPx + "px " + UI_FONT;
    while (ctx.measureText(gainText).width / 2 > maxHalfW && gainFontPx > 7) {
      gainFontPx -= 0.5;
      ctx.font = gainFontPx + "px " + UI_FONT;
    }
    const gainHalfW = ctx.measureText(gainText).width / 2;
    const gx = clamp(naturalGx, 8 + gainHalfW, w - 8 - gainHalfW); // last-resort safety net
    ctx.fillText(gainText, gx, gy);
  }

  function drawBanner(ctx, w, h, st) {
    const b = st.banner;
    const color = COLORS[b.color] || COLORS.muted;
    const y = h - 26;
    ctx.font = "600 13px " + UI_FONT;
    const textW = ctx.measureText(b.text).width;
    const bw = textW + 28, bh = 24;
    ctx.fillStyle = hexAlpha(COLORS["panel-deep"], 0.8);
    roundRectPath(ctx, w / 2 - bw / 2, y - bh / 2, bw, bh, 6);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(b.text, w / 2, y);

    ctx.font = "10.5px " + UI_FONT; ctx.fillStyle = COLORS.muted;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("pointer: your meridian, turning with Earth · ♈ ray: fixed direction to the stars", w / 2, h - 52 - 7);
    ctx.fillText("Sun ray: moves ≈ 1° per day as Earth orbits", w / 2, h - 52 + 7);
  }

  /* =======================================================================
     drawStrip() -- "the two clocks through the year"
     ======================================================================= */
  function drawStrip(ctx, cssW, cssH, opts) {
    opts = opts || {};
    const starName = opts.starName || "the star";
    const starRA = (opts.starRA != null) ? opts.starRA : 6.75;
    const w = cssW, h = cssH;
    const compact = h < 150;

    ctx.fillStyle = COLORS.canvas; ctx.fillRect(0, 0, w, h);

    const padL = 48, padR = 12, padT = 10, padB = 24;
    const px0 = padL, px1 = w - padR, py0 = padT, py1 = h - padB;
    const plotW = Math.max(1, px1 - px0), plotH = Math.max(1, py1 - py0);
    const st = getState();

    function xOf(n) { return px0 + (n / 365) * plotW; }
    function yOf(hr) { return py1 - (hr / 24) * plotH; }

    // grid + axes
    ctx.strokeStyle = hexAlpha(COLORS.border, 0.6); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.rect(px0, py0, plotW, plotH); ctx.stroke();

    ctx.font = "9px " + UI_FONT; ctx.fillStyle = COLORS.muted;
    for (let hr = 0; hr <= 24; hr += 6) {
      const y = yOf(hr);
      ctx.strokeStyle = hexAlpha(COLORS.border, 0.35);
      ctx.beginPath(); ctx.moveTo(px0, y); ctx.lineTo(px1, y); ctx.stroke();
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText(hr + "h", px0 - 5, y);
    }

    const orderedMonths = MONTH_NAMES.slice(3).concat(MONTH_NAMES.slice(0, 3));
    let acc = 1; const doyStarts = [1];
    for (let i = 0; i < 11; i++) { acc += MONTH_LEN[i]; doyStarts.push(acc); }
    const orderedDoys = doyStarts.slice(3).concat(doyStarts.slice(0, 3));
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (let i = 0; i < orderedMonths.length; i++) {
      const n = nOfDoy(orderedDoys[i]);
      if (n < 0 || n > 365) continue;
      const x = xOf(n);
      ctx.strokeStyle = hexAlpha(COLORS.border, 0.35);
      ctx.beginPath(); ctx.moveTo(x, py0); ctx.lineTo(x, py1); ctx.stroke();
      ctx.fillStyle = COLORS.muted;
      ctx.fillText(orderedMonths[i], x, py1 + 4);
    }

    // axis titles
    ctx.save();
    ctx.translate(14, (py0 + py1) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = "9px " + UI_FONT; ctx.fillStyle = COLORS.muted;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("LST", 0, 0);
    ctx.restore();
    ctx.font = "9px " + UI_FONT; ctx.fillStyle = COLORS.muted;
    ctx.textAlign = "right"; ctx.textBaseline = "bottom";
    ctx.fillText("days after Mar 20", px1, h - 2);

    // wrap-aware polyline: breaks (moveTo instead of lineTo) whenever the
    // sampled value jumps by more than 12h between adjacent samples -- the
    // signature of a mod-24 wraparound rather than real motion -- so a line
    // that crosses 24h/0h draws as two clean segments instead of one long
    // diagonal seam across the whole chart.
    function plotLine(valueFn, color, lineWidth, dash) {
      const steps = 240;
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = lineWidth;
      ctx.setLineDash(dash || []);
      ctx.beginPath();
      let prev = null;
      for (let i = 0; i <= steps; i++) {
        const n = (365 * i) / steps;
        const v = mod(valueFn(n), 24);
        const x = xOf(n), y = yOf(v);
        if (prev === null || Math.abs(v - prev) > 12) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        prev = v;
      }
      ctx.stroke();
      ctx.restore();
    }

    const noonVal = function (n) { return n * GAIN_H; };
    const midnightVal = function (n) { return n * GAIN_H + 12 * SID_RATE; };

    plotLine(noonVal, COLORS.cyan, 2, null);
    plotLine(midnightVal, COLORS.cyan, 1.5, [5, 4]);

    // the star: horizontal amber line at its RA
    const raWrapped = mod(starRA, 24);
    const yStar = yOf(raWrapped);
    ctx.strokeStyle = hexAlpha(COLORS.amber, 0.85); ctx.lineWidth = 1.3;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(px0, yStar); ctx.lineTo(px1, yStar); ctx.stroke();
    ctx.font = "10px " + UI_FONT; ctx.fillStyle = COLORS.amber;
    ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillText(starName + " α = " + raWrapped.toFixed(2) + " h", px0 + 4, yStar - 3);

    // where the star's RA meets each cyan curve
    const nMidnight = mod(raWrapped - 12 * SID_RATE, 24) / GAIN_H;
    const nNoon = raWrapped / GAIN_H;
    function markMeet(n, label, dim) {
      if (!(n >= 0 && n <= 365)) return;
      const x = xOf(n);
      ctx.fillStyle = COLORS.amber;
      ctx.beginPath(); ctx.arc(x, yStar, 3, 0, TAU); ctx.fill();
      if (compact || !label) return;
      const textW = ctx.measureText(label).width;
      let lx = x + 6, align = "left";
      if (lx + textW > px1) { lx = x - 6; align = "right"; }
      ctx.font = "9.5px " + UI_FONT;
      ctx.fillStyle = hexAlpha(COLORS.amber, dim ? 0.65 : 0.95);
      ctx.textAlign = align; ctx.textBaseline = (yStar < (py0 + py1) / 2) ? "top" : "bottom";
      ctx.fillText(label, lx, yStar + (align ? 0 : 0) + ((yStar < (py0 + py1) / 2) ? 5 : -5));
    }
    markMeet(nMidnight, "on the meridian at midnight: " + calendarLabel(Math.round(mod(nMidnight, 366))), false);
    markMeet(nNoon, "… at noon", true);

    // current day marker
    {
      const n = st.day;
      const x = xOf(n);
      ctx.strokeStyle = hexAlpha(COLORS.cyan, 0.35); ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x, py0); ctx.lineTo(x, py1); ctx.stroke();
      ctx.setLineDash([]);
      const yN = yOf(mod(noonVal(n), 24));
      const yM = yOf(mod(midnightVal(n), 24));
      ctx.fillStyle = COLORS.cyan;
      ctx.beginPath(); ctx.arc(x, yN, 3.2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(x, yM, 3.2, 0, TAU); ctx.fill();
      if (!compact) {
        const label = "LST(noon) = " + mod(noonVal(n), 24).toFixed(2) + " h";
        const textW = ctx.measureText(label).width;
        ctx.font = "9.5px " + UI_FONT; ctx.fillStyle = COLORS.cyan;
        let lx = x + 6, align = "left";
        if (lx + textW > px1) { lx = x - 6; align = "right"; }
        ctx.textAlign = align; ctx.textBaseline = (yN < (py0 + py1) / 2) ? "bottom" : "top";
        ctx.fillText(label, lx, yN + ((yN < (py0 + py1) / 2) ? -5 : 5));
      }
    }

    if (!compact) {
      ctx.font = "10px " + UI_FONT; ctx.fillStyle = hexAlpha(COLORS.text, 0.7);
      ctx.textAlign = "left"; ctx.textBaseline = "bottom";
      const nA = 365 / 3;
      ctx.fillText("+3 m 56.6 s per day", xOf(nA) + 6, yOf(noonVal(nA)) - 6);
      // The solid line ends near 24h, i.e. right at the plot's TOP edge --
      // an "above the line" placement (like the annotation above) would
      // sit off the top of the canvas here, so this one goes below instead.
      ctx.textAlign = "right"; ctx.textBaseline = "top";
      ctx.fillText("= 24 h in a year: 366.25 sidereal days = 365.25 solar days", px1 - 2, yOf(noonVal(365)) + 6);
    }
  }

  reset();
  return { reset, setDay, setTime, advance, getState, draw, drawStrip };
}
