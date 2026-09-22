import type { Point } from "@/lib/homography/solve";

import type { HandleSeed } from "./templates";

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
