/**
 * Plane-to-plane homography.
 *
 * Four coplanar correspondences determine a perspective transform exactly and
 * need no camera intrinsics, which is why this is a homography and not
 * single-marker pose estimation: pose from one marker is noisy out of plane
 * and there is no reason to accept that noise when the sheet gives four points.
 * See docs/features/01-capture.md.
 */

export type Point = { x: number; y: number };

/** Row-major 3x3. */
export type Matrix3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/**
 * Solve the transform taking the four `src` points to the four `dst` points.
 * Points must be given in the same order and must not be collinear.
 */
export function getPerspectiveTransform(
  src: readonly Point[],
  dst: readonly Point[],
): Matrix3 {
  if (src.length !== 4 || dst.length !== 4) {
    throw new Error("getPerspectiveTransform needs exactly 4 point pairs");
  }

  // Each correspondence contributes two rows, with h33 fixed at 1:
  //   x*h11 + y*h12 + h13 - x*u*h31 - y*u*h32 = u
  //   x*h21 + y*h22 + h23 - x*v*h31 - y*v*h32 = v
  const a: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    a.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    b.push(v);
  }

  const h = solveLinearSystem(a, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1] as const;
}

/** Gaussian elimination with partial pivoting. */
function solveLinearSystem(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    if (Math.abs(m[pivot][col]) < 1e-12) {
      throw new Error("Degenerate marker geometry — points are collinear");
    }
    [m[col], m[pivot]] = [m[pivot], m[col]];

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = m[row][col] / m[col][col];
      for (let k = col; k <= n; k++) m[row][k] -= factor * m[col][k];
    }
  }

  return m.map((row, i) => row[n] / row[i]);
}

/** Map a point through the transform. */
export function applyHomography(h: Matrix3, p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  };
}

export function invertHomography(h: Matrix3): Matrix3 {
  const [a, b, c, d, e, f, g, i, j] = h;
  const det =
    a * (e * j - f * i) - b * (d * j - f * g) + c * (d * i - e * g);
  if (Math.abs(det) < 1e-12) throw new Error("Homography is not invertible");

  return [
    (e * j - f * i) / det,
    (c * i - b * j) / det,
    (b * f - c * e) / det,
    (f * g - d * j) / det,
    (a * j - c * g) / det,
    (c * d - a * f) / det,
    (d * i - e * g) / det,
    (b * g - a * i) / det,
    (a * e - b * d) / det,
  ] as const;
}

/**
 * Distance between two points after mapping both into the metric canvas.
 *
 * This is the whole measurement: transform the coordinates, never the image.
 * Warping pixels and then measuring the warp resamples twice and throws away
 * precision for nothing.
 */
export function distanceMm(
  h: Matrix3,
  p1: Point,
  p2: Point,
  pxPerMm: number,
): number {
  const a = applyHomography(h, p1);
  const b = applyHomography(h, p2);
  return Math.round(Math.hypot(b.x - a.x, b.y - a.y) / pxPerMm);
}

/** Centroid of a marker's four corners. */
export function centroid(corners: readonly Point[]): Point {
  const n = corners.length;
  return {
    x: corners.reduce((s, c) => s + c.x, 0) / n,
    y: corners.reduce((s, c) => s + c.y, 0) / n,
  };
}
