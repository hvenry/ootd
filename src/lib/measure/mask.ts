import type { Point } from "@/lib/homography/solve";

import type { HandleSeed, PinLayout } from "./templates";

/**
 * The cutout alpha, as a binary mask.
 *
 * It exists to put the two handles somewhere sensible before the person has
 * touched anything — a chord across the widest part of the chest, a line
 * down the middle of the body. It does not move them afterwards: the human
 * picks the *semantic* point, which is the pit, where the shoulder seam
 * ends, and no edge detector knows which of the edges near a fingertip that
 * is.
 */

/** Mask resolution cap; the seeds only need the silhouette's shape. */
const MASK_MAX_DIMENSION = 2000;

const ALPHA_THRESHOLD = 128;

export type Mask = {
  width: number;
  height: number;
  /** Mask pixels per source-image pixel. */
  scale: number;
  inside: Uint8Array;
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
};

export function buildMask(image: HTMLImageElement): Mask | null {
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  if (longest === 0) return null;

  const scale = longest > MASK_MAX_DIMENSION ? MASK_MAX_DIMENSION / longest : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0, width, height);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, width, height).data;
  } catch {
    return null;
  }

  return buildMaskFromAlpha(data, width, height, scale);
}

/** The mask itself, with no DOM in sight — the bit worth testing. */
export function buildMaskFromAlpha(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  scale: number,
): Mask | null {
  const data = rgba;
  const inside = new Uint8Array(width * height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let any = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (data[i * 4 + 3] > ALPHA_THRESHOLD) {
        inside[i] = 1;
        any = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!any) return null;

  return {
    width,
    height,
    scale,
    inside,
    bounds: { minX, minY, maxX, maxY },
  };
}

/** Widest horizontal span of the mask inside a vertical band, in image space. */
function widestChord(
  mask: Mask,
  fromFraction: number,
  toFraction: number,
): [Point, Point] | null {
  const b = mask.bounds;
  if (!b) return null;

  const height = b.maxY - b.minY;
  const yStart = Math.round(b.minY + height * fromFraction);
  const yEnd = Math.round(b.minY + height * toFraction);

  let best: [Point, Point] | null = null;
  let bestWidth = -1;

  for (let y = yStart; y <= yEnd; y++) {
    const row = rowExtent(mask, y);
    if (!row) continue;
    const width = row[1] - row[0];
    if (width > bestWidth) {
      bestWidth = width;
      best = [
        { x: row[0] / mask.scale, y: y / mask.scale },
        { x: row[1] / mask.scale, y: y / mask.scale },
      ];
    }
  }

  return best;
}

function rowExtent(mask: Mask, y: number): [number, number] | null {
  if (y < 0 || y >= mask.height) return null;
  const offset = y * mask.width;
  let left = -1;
  let right = -1;
  for (let x = 0; x < mask.width; x++) {
    if (mask.inside[offset + x]) {
      if (left < 0) left = x;
      right = x;
    }
  }
  return left < 0 ? null : [left, right];
}

function columnExtent(mask: Mask, x: number): [number, number] | null {
  if (x < 0 || x >= mask.width) return null;
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < mask.height; y++) {
    if (mask.inside[y * mask.width + x]) {
      if (top < 0) top = y;
      bottom = y;
    }
  }
  return top < 0 ? null : [top, bottom];
}

/**
 * Pre-position the two handles from the mask, so the common case is a nudge
 * rather than a placement. The eighth oxford should land within millimetres.
 */
export function seedHandles(
  mask: Mask | null,
  seed: HandleSeed,
  fallback: { width: number; height: number },
): [Point, Point] {
  if (!mask || !mask.bounds) return seedFromBox(seed, fallback);

  const b = mask.bounds;
  const boxWidth = b.maxX - b.minX;
  const boxHeight = b.maxY - b.minY;
  const unscale = (p: Point): Point => ({
    x: p.x / mask.scale,
    y: p.y / mask.scale,
  });

  switch (seed.kind) {
    case "widest_chord": {
      const chord = widestChord(mask, seed.from, seed.to);
      if (chord) return chord;
      break;
    }
    case "horizontal": {
      const y = Math.round(b.minY + boxHeight * seed.at);
      const row = rowExtent(mask, y);
      if (row) {
        return [unscale({ x: row[0], y }), unscale({ x: row[1], y })];
      }
      break;
    }
    case "vertical": {
      const x = Math.round(b.minX + boxWidth / 2);
      const column = columnExtent(mask, x);
      if (column) {
        const top = column[0] + (column[1] - column[0]) * seed.from;
        const bottom = column[0] + (column[1] - column[0]) * seed.to;
        return [unscale({ x, y: top }), unscale({ x, y: bottom })];
      }
      break;
    }
    case "diagonal":
      return [
        unscale({
          x: b.minX + boxWidth * seed.fromX,
          y: b.minY + boxHeight * seed.fromY,
        }),
        unscale({
          x: b.minX + boxWidth * seed.toX,
          y: b.minY + boxHeight * seed.toY,
        }),
      ];
  }

  return seedFromBox(seed, {
    width: (b.maxX - b.minX) / mask.scale,
    height: (b.maxY - b.minY) / mask.scale,
    offsetX: b.minX / mask.scale,
    offsetY: b.minY / mask.scale,
  });
}

/** No cutout yet: seed off the frame so measuring can start immediately. */
function seedFromBox(
  seed: HandleSeed,
  box: { width: number; height: number; offsetX?: number; offsetY?: number },
): [Point, Point] {
  const ox = box.offsetX ?? 0;
  const oy = box.offsetY ?? 0;
  const inset = 0.15;

  switch (seed.kind) {
    case "widest_chord":
      return [
        { x: ox + box.width * inset, y: oy + box.height * ((seed.from + seed.to) / 2) },
        { x: ox + box.width * (1 - inset), y: oy + box.height * ((seed.from + seed.to) / 2) },
      ];
    case "horizontal":
      return [
        { x: ox + box.width * inset, y: oy + box.height * seed.at },
        { x: ox + box.width * (1 - inset), y: oy + box.height * seed.at },
      ];
    case "vertical":
      return [
        { x: ox + box.width / 2, y: oy + box.height * seed.from },
        { x: ox + box.width / 2, y: oy + box.height * seed.to },
      ];
    case "diagonal":
      return [
        { x: ox + box.width * seed.fromX, y: oy + box.height * seed.fromY },
        { x: ox + box.width * seed.toX, y: oy + box.height * seed.toY },
      ];
  }
}

/**
 * The first stretch of mask along a row, from the left and no further than
 * `endX`: one leg, not both, even where the two lie touching.
 */
function firstRun(
  mask: Mask,
  y: number,
  endX: number,
): [number, number] | null {
  if (y < 0 || y >= mask.height) return null;
  const offset = y * mask.width;
  const end = Math.min(mask.width, endX + 1);
  let x = 0;
  while (x < end && !mask.inside[offset + x]) x++;
  if (x === end) return null;
  const left = x;
  while (x < end && mask.inside[offset + x]) x++;
  return [left, x - 1];
}

/**
 * Where the legs part, near the middle: the highest point, across a few
 * columns either side of centre, at which the cloth running down from the
 * waistband gives out. Null when the legs touch all the way down.
 */
function crotchY(
  mask: Mask,
  centreX: number,
  spread: number,
  fromY: number,
  toY: number,
): number | null {
  let best: number | null = null;
  for (let x = centreX - spread; x <= centreX + spread; x++) {
    if (x < 0 || x >= mask.width) continue;
    let y = fromY;
    while (y < toY && !mask.inside[y * mask.width + x]) y++;
    while (y < toY && mask.inside[y * mask.width + x]) y++;
    if (y < toY && (best === null || y < best)) best = y;
  }
  return best;
}

/**
 * The six pins of a pair of trousers or shorts, in the layout's order:
 * waist left and right, the left leg's hem outside and inside, the crotch,
 * and the top of the fly.
 *
 * The hem is cut along one leg only. The per-pair seeding it replaces cut
 * straight across the bottom of the mask, which on trousers laid flat runs
 * from one leg's outside edge to the other's, and that went in as a leg
 * opening of over 600 mm on more than one pair.
 */
export function seedBottomPins(
  mask: Mask | null,
  crotchAt: number,
  fallback: { width: number; height: number },
): Point[] {
  const fromBox = (
    box: { x: number; y: number; w: number; h: number },
  ): Point[] =>
    (
      [
        [0.1, 0.02],
        [0.9, 0.02],
        [0.05, 0.97],
        [0.42, 0.97],
        [0.5, crotchAt],
        [0.5, 0.02],
      ] as const
    ).map(([fx, fy]) => ({ x: box.x + box.w * fx, y: box.y + box.h * fy }));

  if (!mask || !mask.bounds) {
    return fromBox({ x: 0, y: 0, w: fallback.width, h: fallback.height });
  }

  const b = mask.bounds;
  const height = b.maxY - b.minY;
  const at = (fraction: number) => Math.round(b.minY + height * fraction);
  const unscale = (x: number, y: number): Point => ({
    x: x / mask.scale,
    y: y / mask.scale,
  });
  const boxed = () =>
    fromBox({
      x: b.minX / mask.scale,
      y: b.minY / mask.scale,
      w: (b.maxX - b.minX) / mask.scale,
      h: height / mask.scale,
    });

  const width = b.maxX - b.minX;

  // The waist: the first row down that is nearly as wide as the waistband
  // gets, so the high corner of a waistband lying a little crooked does not
  // stand in for all of it. Against the waistband, not the box: flares are
  // far wider at the hem than at the waist, and hips wider than the band.
  let band = 0;
  for (let y = b.minY; y <= at(0.06); y++) {
    const row = rowExtent(mask, y);
    if (row) band = Math.max(band, row[1] - row[0]);
  }
  let waistY = at(0.02);
  let waist = rowExtent(mask, waistY);
  for (let y = b.minY; y <= at(0.15); y++) {
    const row = rowExtent(mask, y);
    if (row && row[1] - row[0] >= band * 0.9) {
      waistY = y;
      waist = row;
      break;
    }
  }
  if (!waist) return boxed();

  const centreX = Math.round((waist[0] + waist[1]) / 2);
  const spread = Math.max(1, Math.round(width * 0.05));
  // Where the legs touch, the first gap near the middle is between the
  // hems, not at the crotch; that far down, fall back on the proportion.
  const found = crotchY(mask, centreX, spread, waistY, b.maxY);
  const crotch =
    found !== null && found <= at(crotchAt + 0.35) ? found : at(crotchAt);

  // The hem: the lowest row, well below the crotch, where the left leg is
  // nearly its full width. The very bottom row of a pair of shorts with a
  // slanted hem is a corner of one leg, not the leg opening.
  const fromY = Math.round(crotch + (b.maxY - crotch) * 0.4);
  let widest = 0;
  for (let y = fromY; y <= b.maxY; y++) {
    const run = firstRun(mask, y, centreX);
    if (run) widest = Math.max(widest, run[1] - run[0]);
  }
  let hemY = at(0.97);
  let leg = firstRun(mask, hemY, centreX);
  for (let y = b.maxY; y >= fromY; y--) {
    const run = firstRun(mask, y, centreX);
    if (run && run[1] - run[0] >= widest * 0.8) {
      hemY = y;
      leg = run;
      break;
    }
  }
  if (!leg) return boxed();

  return [
    unscale(waist[0], waistY),
    unscale(waist[1], waistY),
    unscale(leg[0], hemY),
    unscale(leg[1], hemY),
    unscale(centreX, crotch),
    unscale(centreX, waistY),
  ];
}

/**
 * The run of mask along a row that contains column `x`: the body's own
 * width at that height, with a sleeve only while the sleeve is joined to it.
 * Pinholes in the cutout, where a print or a thin patch let the floor
 * through, are stepped over rather than taken for the body's edge.
 */
function runThrough(mask: Mask, y: number, x: number): [number, number] | null {
  if (y < 0 || y >= mask.height || x < 0 || x >= mask.width) return null;
  const offset = y * mask.width;
  if (!mask.inside[offset + x]) return null;
  const hole = Math.max(2, Math.round(mask.width * 0.004));
  const extend = (from: number, step: -1 | 1) => {
    let edge = from;
    let at = from + step;
    let gap = 0;
    while (at >= 0 && at < mask.width) {
      if (mask.inside[offset + at]) {
        edge = at;
        gap = 0;
      } else if (++gap > hole) {
        break;
      }
      at += step;
    }
    return edge;
  };
  return [extend(x, -1), extend(x, 1)];
}

/**
 * The armpit on one side, in mask pixels.
 *
 * Read upward from near the hem, where the outline is only the body, until
 * the sleeve joins it. Mostly that is a jump: a gap under a hanging or
 * slanting sleeve closes, or a sleeve standing straight out begins, and the
 * body's edge leaps outward in a row. The row below the leap is the pit.
 * From the top down, the collar, a hood and the shoulders all make edges of
 * their own, which is why it is read from below.
 *
 * Where a sleeve's underside slopes into the side with no leap, the side is
 * fitted as a line over the body and the pit is where the outline leaves it.
 * A top without sleeves leaves that line inward, round the armhole.
 */
function armpit(
  mask: Mask,
  side: "left" | "right",
  sleeved: boolean,
  centreX: number,
  at: (fraction: number) => number,
  width: number,
): Point | null {
  const edge = (y: number) => {
    const run = runThrough(mask, y, centreX);
    if (!run) return null;
    // Measured inward from the outside, so both sides read the same way.
    return side === "left" ? run[0] : mask.width - 1 - run[1];
  };
  const toX = (inward: number) =>
    side === "left" ? inward : mask.width - 1 - inward;
  const top = at(0.08);

  if (sleeved) {
    let below: { e: number; y: number } | null = null;
    for (let y = at(0.9); y >= top; y--) {
      const e = edge(y);
      if (e === null) continue;
      if (below && below.e - e > width * 0.04) {
        return { x: toX(below.e), y: below.y };
      }
      below = { e, y };
    }
  }

  // The side seam as a line, by least squares over the body.
  const from = at(0.45);
  const to = at(0.75);
  let n = 0;
  let sy = 0;
  let se = 0;
  let syy = 0;
  let sye = 0;
  for (let y = from; y <= to; y++) {
    const e = edge(y);
    if (e === null) continue;
    n++;
    sy += y;
    se += e;
    syy += y * y;
    sye += y * e;
  }
  if (n < 2) return null;
  const denominator = n * syy - sy * sy;
  const slope = denominator === 0 ? 0 : (n * sye - sy * se) / denominator;
  const intercept = (se - slope * sy) / n;
  // Positive when the outline is outside the side seam's line.
  const off = (y: number, e: number) => slope * y + intercept - e;

  for (let y = from; y >= top; y--) {
    const e = edge(y);
    if (e === null) continue;
    const d = off(y, e);
    if (!(sleeved ? d > width * 0.03 : d < -width * 0.015)) continue;
    // Back down to where it was still on the line: the corner itself.
    for (let back = y + 1; back <= from; back++) {
      const eb = edge(back);
      if (eb !== null && Math.abs(off(back, eb)) < width * 0.005) {
        return { x: toX(eb), y: back };
      }
    }
    return { x: toX(e), y };
  }
  return null;
}

/**
 * The pins of a top, in the layout's order: the armpits left and right, the
 * shoulder points left and right, (sleeved only) the end of the left
 * sleeve, the high point of the shoulder beside the collar, and the hem
 * under it.
 *
 * The pits come off the silhouette well; the shoulder seam and the collar
 * do not, since neither is an edge of the outline, so those are placed
 * where they usually are relative to the pits and the top of the outline.
 */
export function seedTopPins(
  mask: Mask | null,
  sleeved: boolean,
  fallback: { width: number; height: number },
): Point[] {
  const fromBox = (box: {
    x: number;
    y: number;
    w: number;
    h: number;
  }): Point[] =>
    (
      [
        [0.28, 0.3],
        [0.72, 0.3],
        [0.3, 0.06],
        [0.7, 0.06],
        ...(sleeved ? [[0.08, 0.3] as const] : []),
        [0.4, 0.02],
        [0.4, 0.98],
      ] as const
    ).map(([fx, fy]) => ({ x: box.x + box.w * fx, y: box.y + box.h * fy }));

  if (!mask || !mask.bounds) {
    return fromBox({ x: 0, y: 0, w: fallback.width, h: fallback.height });
  }

  const b = mask.bounds;
  const width = b.maxX - b.minX;
  const height = b.maxY - b.minY;
  const at = (fraction: number) => Math.round(b.minY + height * fraction);
  const unscale = (p: Point): Point => ({
    x: p.x / mask.scale,
    y: p.y / mask.scale,
  });
  const boxed = () =>
    fromBox({
      x: b.minX / mask.scale,
      y: b.minY / mask.scale,
      w: width / mask.scale,
      h: height / mask.scale,
    });

  const centreX = Math.round((b.minX + b.maxX) / 2);
  const pitL = armpit(mask, "left", sleeved, centreX, at, width);
  const pitR = armpit(mask, "right", sleeved, centreX, at, width);
  if (!pitL || !pitR || pitR.x - pitL.x < width * 0.2) return boxed();
  const chest = pitR.x - pitL.x;
  const middle = Math.round((pitL.x + pitR.x) / 2);

  const topOf = (x: number): number | null => {
    const column = columnExtent(mask, Math.round(x));
    return column ? column[0] : null;
  };

  // A set-in shoulder seam sits a little inside the pit; a sleeveless top's
  // shoulder is the outside of its strap.
  const shoulder = (side: "left" | "right"): Point | null => {
    const pit = side === "left" ? pitL : pitR;
    const inward = side === "left" ? 1 : -1;
    if (sleeved) {
      const x = pit.x + inward * chest * 0.03;
      const y = topOf(x);
      return y === null ? null : { x, y };
    }
    const y = at(0.03);
    const run = runThrough(
      mask,
      y,
      Math.round(pit.x + inward * chest * 0.12),
    );
    if (!run) return null;
    return { x: side === "left" ? run[0] : run[1], y };
  };
  const shL = shoulder("left");
  const shR = shoulder("right");
  if (!shL || !shR) return boxed();

  // The high point: the top of the outline between the shoulder and the
  // neck, nearest the neck on a tie. Kept clear of the middle, where a
  // collar standing up would otherwise win.
  let hps: Point | null = null;
  for (let x = Math.round(shL.x); x <= middle - chest * 0.1; x++) {
    const y = topOf(x);
    if (y !== null && (hps === null || y <= hps.y)) hps = { x, y };
  }
  if (!hps) return boxed();
  const hemColumn = columnExtent(mask, hps.x);
  const hem = { x: hps.x, y: hemColumn ? hemColumn[1] : b.maxY };

  if (!sleeved) {
    return [pitL, pitR, shL, shR, hps, hem].map(unscale);
  }

  // The sleeve's end: of the cloth outside the left pit, the part farthest
  // from the shoulder is the cuff, and of the cuff the corner farthest from
  // the pit is on the sleeve's top edge, which is the edge measured.
  // Outside the body means left of the pit above it, and left of the body's
  // own run below it: a hem flaring wider than the pit is still body.
  // Where the body's run is broken up, along a ragged hem, nothing is
  // counted as sleeve.
  const ends = new Float64Array(height + 1);
  for (let y = b.minY; y <= b.maxY; y++) {
    const run = y > pitL.y ? runThrough(mask, y, centreX) : null;
    ends[y - b.minY] =
      y <= pitL.y
        ? pitL.x - width * 0.01
        : !run || run[1] - run[0] < chest * 0.5
          ? b.minX
          : Math.min(run[0], pitL.x) - width * 0.01;
  }
  const outsideEnd = (y: number) => ends[y - b.minY];
  // Only cloth joined to what is outside the body above the pit, which is
  // certainly sleeve: a scrap of ragged hem outside the line is not.
  const x0 = b.minX;
  const w = width + 1;
  const seen = new Uint8Array(w * (height + 1));
  const queue: number[] = [];
  const visit = (x: number, y: number) => {
    if (y < b.minY || y > b.maxY || x < x0 || x >= outsideEnd(y)) return;
    const i = (y - b.minY) * w + (x - x0);
    if (seen[i] || !mask.inside[y * mask.width + x]) return;
    seen[i] = 1;
    queue.push(x, y);
  };
  for (let y = b.minY; y <= pitL.y; y++) {
    for (let x = x0; x < outsideEnd(y); x++) visit(x, y);
  }
  const outside: { x: number; y: number; d: number }[] = [];
  let far = 0;
  for (let head = 0; head < queue.length; head += 2) {
    const x = queue[head];
    const y = queue[head + 1];
    const d = Math.hypot(x - shL.x, y - shL.y);
    outside.push({ x, y, d });
    if (d > far) far = d;
    visit(x + 1, y);
    visit(x - 1, y);
    visit(x, y + 1);
    visit(x, y - 1);
  }
  let cuff: Point | null = null;
  let best = -1;
  for (const p of outside) {
    if (p.d < far - width * 0.03) continue;
    const fromPit = Math.hypot(p.x - pitL.x, p.y - pitL.y);
    if (fromPit > best) {
      best = fromPit;
      cuff = { x: p.x, y: p.y };
    }
  }
  if (!cuff) return boxed();

  return [pitL, pitR, shL, shR, cuff, hps, hem].map(unscale);
}

/** A layout's pins from the cutout, or from the frame until there is one. */
export function seedPins(
  mask: Mask | null,
  seed: PinLayout["seed"],
  fallback: { width: number; height: number },
): Point[] {
  return seed.kind === "bottom"
    ? seedBottomPins(mask, seed.crotchAt, fallback)
    : seedTopPins(mask, seed.sleeved, fallback);
}
