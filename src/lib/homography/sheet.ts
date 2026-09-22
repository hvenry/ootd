import type { Point } from "./solve";

/**
 * The printed calibration markers.
 *
 * The four markers do **not** need to share a piece of paper — they need to be
 * coplanar at a known spacing. That matters because a garment is far bigger
 * than any printable sheet: a tee is ~530mm pit-to-pit and ~700mm long, so it
 * covers an A3 sheet and every marker on it. The default layout is therefore
 * one marker per A4 page, taped out at the corners of a rectangle larger than
 * the garment.
 *
 * Spacing is *measured*, never assumed — you tape the pages where they suit
 * the garment, then put a tape measure across the marker centres. That also
 * absorbs printer scaling, which is real: a 2% error is 10mm on a 530mm chest,
 * larger than everything else in the budget combined.
 */

export const DICTIONARY_NAME = "ARUCO_MIP_36h12";

/** The metric canvas. Measuring is counting pixels at this scale. */
export const PX_PER_MM = 4;

/**
 * Tiled layout — the default. One marker per A4 page.
 *
 * The markers are large because the camera is now over a metre away: at a
 * 1200mm span a 12MP frame is ~3.4 px/mm, and detection runs on a 1280px
 * downscale, so a 40mm marker would arrive as ~43px and detect unreliably.
 * At 110mm it arrives as ~117px with room to spare.
 */
export const TILE_PAGE_WIDTH_MM = 210;
export const TILE_PAGE_HEIGHT_MM = 297;

/**
 * Paper sizes the marker pages can be printed on.
 *
 * The marker, the black square and the target offsets are identical on both —
 * they are the geometry, and changing them would change every measurement.
 * Only the page canvas and the text anchored to its edges move.
 *
 * This exists because A4 content sent to a Letter tray gets silently scaled
 * to fit: 6.1% down, which reads a 530mm chest as 564mm.
 */
export const PAPER_SIZES = {
  a4: { label: "A4", widthMm: 210, heightMm: 297 },
  letter: { label: "Letter", widthMm: 216, heightMm: 279 },
} as const;

export type PaperSize = keyof typeof PAPER_SIZES;

export function isPaperSize(v: string): v is PaperSize {
  return v in PAPER_SIZES;
}
export const TILE_MARKER_SIZE_MM = 110;

/**
 * generateSVG draws the marker into a 10-unit box whose black square is 8
 * units, so the printed black square is 0.8 of the tile. That is worth
 * printing on the page: measuring it is a free check that the printer really
 * did print at 100%, needing nothing but a ruler.
 */
export const MARKER_BLACK_RATIO = 0.8;
export const TILE_BLACK_SQUARE_MM = TILE_MARKER_SIZE_MM * MARKER_BLACK_RATIO;

/**
 * The measuring target: one printed circle per page, and the only thing you
 * put a tape on.
 *
 * It exists because the obvious reference — the marker's centre — is buried
 * under the marker, and lines pointing at a hidden point are worse than no
 * marking at all. Since every page carries this target at the *same* offset
 * from its marker, target-to-target distance equals marker-centre-to-centre
 * distance exactly, which is what the homography wants.
 *
 * The app never looks at it; it is purely for the human with the tape. Its
 * one condition is that all four pages lie the same way up.
 */
export const TARGET_DIAMETER_MM = 22;
export const TARGET_OFFSET_X_MM = 65;
export const TARGET_OFFSET_Y_MM = 68;

/**
 * Each page's target faces the middle of the rig, so the four circles sit on
 * the interior edges and the arrangement reads itself: the circles outline
 * the space the garment goes in.
 *
 * The offsets no longer cancel in a subtraction, so circle-to-circle is not
 * marker-to-marker any more and the app has to add them back — see
 * `markerQuadMm`. That correction is exact on a rectangular rig and leaves a
 * residual shape error on a skewed one: measured at 0.15mm on a realistically
 * sloppy rig and 0.32mm on a deliberately awful one, per 530mm of garment.
 * Against a ±3mm budget that is noise, and roughly six times smaller than the
 * thing that actually dominates — how square the pages are to each other.
 */
/**
 * What the black square actually came out as, in millimetres.
 *
 * No printer lands on 100.00%, and a driver set to "fit to printable area"
 * can be 12% out. That scales the circle's distance from its marker, which
 * the correction in `markerQuadMm` assumes it knows — at 88.6% it over-reads
 * a 530mm chest by 10mm. So the ruler check is not pass/fail: whatever the
 * square measures goes here, and the offsets scale with it.
 *
 * The marker *span* is measured directly and is unaffected either way.
 */
export function printScale(): number {
  const measured = Number(process.env.NEXT_PUBLIC_SHEET_BLACK_SQUARE_MM);
  if (!Number.isFinite(measured) || measured <= 0) return 1;
  return measured / TILE_BLACK_SQUARE_MM;
}

/** Nominal offsets, as drawn into the PDF. */
export const TARGET_OFFSETS: Point[] = [
  { x: TARGET_OFFSET_X_MM, y: TARGET_OFFSET_Y_MM }, // ID 0 top-left    → circle bottom-right
  { x: -TARGET_OFFSET_X_MM, y: TARGET_OFFSET_Y_MM }, // ID 1 top-right   → circle bottom-left
  { x: -TARGET_OFFSET_X_MM, y: -TARGET_OFFSET_Y_MM }, // ID 2 bottom-right → circle top-left
  { x: TARGET_OFFSET_X_MM, y: -TARGET_OFFSET_Y_MM }, // ID 3 bottom-left  → circle top-right
];
export const TILE_VERSION_MARKER_SIZE_MM = 30;

/** Starting points. What you tape is what you measure. */
export const SUGGESTED_SPANS = [
  { label: "Tees, shirts, knits", xMm: 800, yMm: 1000 },
  { label: "Jackets, coats", xMm: 900, yMm: 1100 },
  { label: "Trousers, jeans", xMm: 700, yMm: 1300 },
] as const;

/** Single-sheet A3 layout — only useful for small flat items. */
export const SHEET_WIDTH_MM = 297;
export const SHEET_HEIGHT_MM = 420;
export const MARKER_SIZE_MM = 40;
export const SHEET_MARGIN_MM = 15;

/** Corner marker IDs, clockwise from top-left. Reserved; never reuse. */
export const CORNER_IDS = [0, 1, 2, 3] as const;

/**
 * Two reserved IDs *can* encode the sheet version, for a future where several
 * rigs are in use at once and the app must tell them apart.
 *
 * They are no longer printed. They sat at the foot of page one, which is
 * exactly where printers clip, and nothing in the app computes with the
 * version — it is metadata, and with one rig at a time the configured
 * SHEET_VERSION says the same thing without costing a marker. Detection has
 * never needed anything but the four corner IDs. The ranges stay reserved so
 * printing them again later is additive.
 */
export const VERSION_ID_BASE_A = 200;
export const VERSION_ID_BASE_B = 220;
export const MAX_SHEET_VERSION = 19;
export const SHEET_VERSION = 1;

export function versionMarkerIds(version: number): [number, number] {
  if (version < 0 || version > MAX_SHEET_VERSION) {
    throw new Error(`Sheet version must be 0..${MAX_SHEET_VERSION}`);
  }
  return [VERSION_ID_BASE_A + version, VERSION_ID_BASE_B + version];
}

export function sheetVersionFromIds(ids: readonly number[]): number | null {
  for (const id of ids) {
    if (id >= VERSION_ID_BASE_A && id <= VERSION_ID_BASE_A + MAX_SHEET_VERSION) {
      return id - VERSION_ID_BASE_A;
    }
    if (id >= VERSION_ID_BASE_B && id <= VERSION_ID_BASE_B + MAX_SHEET_VERSION) {
      return id - VERSION_ID_BASE_B;
    }
  }
  return null;
}

/** Nominal centre-to-centre spacing, before the printer gets involved. */
export const NOMINAL_SPACING_X_MM =
  SHEET_WIDTH_MM - 2 * (SHEET_MARGIN_MM + MARKER_SIZE_MM / 2);
export const NOMINAL_SPACING_Y_MM =
  SHEET_HEIGHT_MM - 2 * (SHEET_MARGIN_MM + MARKER_SIZE_MM / 2);

function envNumber(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * What the tape measure said, between marker centres.
 *
 * Four sides plus one diagonal is not redundancy — it is exactly what four
 * points in a plane need (8 coordinates, minus 3 for rigid motion, leaves 5).
 * Assuming a rectangle instead asks you to get a metre-wide shape square on a
 * floor, and 25mm of skew is 8mm of error on a chest. Measure what you
 * actually made; the second diagonal is optional and only checks your work.
 */
export type MeasuredQuad = {
  /** marker 0 -> 1, across the top. */
  top: number;
  /** marker 1 -> 2, down the right. */
  right: number;
  /** marker 3 -> 2, across the bottom. */
  bottom: number;
  /** marker 0 -> 3, down the left. */
  left: number;
  /** marker 0 -> 2. */
  diag: number;
  /** marker 1 -> 3. Optional; validates the other five. */
  diag2?: number;
};

export function measuredQuad(): MeasuredQuad {
  // The rectangle shorthand, for a rig built carefully enough to trust it.
  const top = envNumber(
    process.env.NEXT_PUBLIC_SHEET_TOP_MM ?? process.env.NEXT_PUBLIC_SHEET_SPACING_X_MM,
    NOMINAL_SPACING_X_MM,
  );
  const left = envNumber(
    process.env.NEXT_PUBLIC_SHEET_LEFT_MM ?? process.env.NEXT_PUBLIC_SHEET_SPACING_Y_MM,
    NOMINAL_SPACING_Y_MM,
  );
  const right = envNumber(process.env.NEXT_PUBLIC_SHEET_RIGHT_MM, left);
  const bottom = envNumber(process.env.NEXT_PUBLIC_SHEET_BOTTOM_MM, top);
  const diag = envNumber(
    process.env.NEXT_PUBLIC_SHEET_DIAG_MM,
    Math.hypot(top, left),
  );
  const diag2Raw = Number(process.env.NEXT_PUBLIC_SHEET_DIAG2_MM);
  const diag2 = Number.isFinite(diag2Raw) && diag2Raw > 0 ? diag2Raw : undefined;

  return { top, right, bottom, left, diag, diag2 };
}

/**
 * The two points at distance `ra` from `a` and `rb` from `b`.
 * Throws when the distances cannot describe a real shape.
 */
function trilaterate(
  a: Point,
  ra: number,
  b: Point,
  rb: number,
): [Point, Point] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-9 || d > ra + rb || d < Math.abs(ra - rb)) {
    throw new Error(
      "Those distances cannot form a shape — re-check the tape measure",
    );
  }

  const t = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - t * t));
  const mx = a.x + (t * dx) / d;
  const my = a.y + (t * dy) / d;
  const ox = (-dy * h) / d;
  const oy = (dx * h) / d;

  return [
    { x: mx + ox, y: my + oy },
    { x: mx - ox, y: my - oy },
  ];
}

function side(a: Point, b: Point, p: Point): number {
  return Math.sign((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
}

/**
 * Place the four marker centres in millimetres from the measured distances.
 * Marker 0 is the origin and marker 1 lies along +x, which fixes the rigid
 * motion the distances cannot determine.
 */
export function solveQuadMm(q: MeasuredQuad = measuredQuad()): Point[] {
  const p0 = { x: 0, y: 0 };
  const p1 = { x: q.top, y: 0 };

  // Marker 2 sits below the 0-1 axis.
  const p2 = pick(trilaterate(p0, q.diag, p1, q.right), (c) => c.y > 0);
  // Marker 3 sits on the far side of the 0-2 diagonal from marker 1.
  const p3 = pick(
    trilaterate(p0, q.left, p2, q.bottom),
    (c) => side(p0, p2, c) !== side(p0, p2, p1),
  );

  return [p0, p1, p2, p3];
}

function pick(candidates: [Point, Point], test: (p: Point) => boolean): Point {
  if (test(candidates[0])) return candidates[0];
  if (test(candidates[1])) return candidates[1];
  throw new Error("Measured distances describe a folded shape");
}

/**
 * How far the optional second diagonal is from what the other five imply.
 * A few millimetres is tape-measure noise; tens of millimetres means one of
 * the numbers is wrong, and every measurement would inherit it.
 */
export function quadCheckMm(q: MeasuredQuad = measuredQuad()): number | null {
  if (q.diag2 === undefined) return null;
  try {
    const [, p1, , p3] = solveQuadMm(q);
    return Math.abs(Math.hypot(p3.x - p1.x, p3.y - p1.y) - q.diag2);
  } catch {
    return null;
  }
}

/** Offsets as they exist on the paper you actually printed. */
export function printedTargetOffsets(): Point[] {
  const k = printScale();
  return TARGET_OFFSETS.map((o) => ({ x: o.x * k, y: o.y * k }));
}

/**
 * Marker centres from circle centres.
 *
 * The tape measures between circles, but the camera detects markers, so the
 * per-page offsets have to come off. They are expressed in page coordinates,
 * and every page lies the same way up, so one rotation serves all four — read
 * off the rig's two side edges, which is why keeping the pages square to each
 * other matters more than anything else in the setup.
 */
export function markerQuadMm(
  circles: Point[],
  offsets: Point[] = printedTargetOffsets(),
): Point[] {
  const ux = circles[0].x - circles[3].x + (circles[1].x - circles[2].x);
  const uy = circles[0].y - circles[3].y + (circles[1].y - circles[2].y);
  const n = Math.hypot(ux, uy);
  if (n < 1e-9) return circles;

  const up = { x: ux / n, y: uy / n };
  const right = { x: -up.y, y: up.x };

  return circles.map((c, i) => {
    const o = offsets[i];
    return {
      x: c.x - (right.x * o.x - up.x * o.y),
      y: c.y - (right.y * o.x - up.y * o.y),
    };
  });
}

/**
 * Destination points for the four corner markers, in metric canvas pixels.
 * This is the target of the homography.
 */
export function sheetCanvasCorners(q: MeasuredQuad = measuredQuad()): Point[] {
  let mm: Point[];
  try {
    mm = markerQuadMm(solveQuadMm(q));
  } catch {
    // Impossible distances: fall back to the rectangle rather than refuse to
    // measure at all. The numbers are then only as good as the placement.
    mm = [
      { x: 0, y: 0 },
      { x: q.top, y: 0 },
      { x: q.top, y: q.left },
      { x: 0, y: q.left },
    ];
  }
  return mm.map((p) => ({ x: p.x * PX_PER_MM, y: p.y * PX_PER_MM }));
}

export function sheetCanvasSize(q: MeasuredQuad = measuredQuad()): {
  width: number;
  height: number;
} {
  const corners = sheetCanvasCorners(q);
  return {
    width: Math.round(Math.max(...corners.map((c) => c.x))),
    height: Math.round(Math.max(...corners.map((c) => c.y))),
  };
}

/**
 * The canvas origin is the *top-left marker centre* — the markers are what the
 * homography actually sees, and they are the only fixed points once the pages
 * are taped out independently.
 *
 * So the colour patches are defined as an offset from that centre rather than
 * from any paper edge, which keeps them locatable at any spacing. They sit
 * *outside* the measurement rectangle, above the top-left marker, where the
 * garment can never cover them.
 */
export const GREY_PATCH = {
  offsetXMm: 62,
  offsetYMm: -108,
  sizeMm: 26,
  /** 18% neutral grey. */
  hex: "#7A7A7A",
} as const;

export const WHITE_PATCH = {
  offsetXMm: 62,
  offsetYMm: -74,
  sizeMm: 26,
  hex: "#FFFFFF",
} as const;

/**
 * Millimetres from the top-left marker centre to metric canvas pixels,
 * scaled by however the sheet actually printed.
 */
export function offsetMmToCanvas(xMm: number, yMm: number): Point {
  const k = printScale();
  return { x: xMm * k * PX_PER_MM, y: yMm * k * PX_PER_MM };
}
