import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Originals are kept forever so the whole closet can be re-cut with a better
 * model later, as one batch job. Cutouts are derived and disposable.
 */
export const STORAGE_ROOT = path.resolve(
  process.env.STORAGE_ROOT ?? "./storage",
);

export type MediaKind = "originals" | "cutouts";

export function storagePathFor(kind: MediaKind, ownerId: string, file: string) {
  // Owner-scoped from day one; per-user isolation later is then a no-op.
  return path.join(kind, ownerId, file);
}

export function absolutePath(relative: string) {
  const resolved = path.resolve(STORAGE_ROOT, relative);
  // Never let a crafted path escape the volume.
  if (!resolved.startsWith(STORAGE_ROOT + path.sep)) {
    throw new Error("Path escapes the storage root");
  }
  return resolved;
}

/**
 * Where the worker writes a photo's cutout. Conventional, not recorded, so a
 * delete can remove it even while the job that produces it is still running
 * and the `photo.cutout_path` column is still null.
 */
export function cutoutPathFor(ownerId: string, photoId: string): string {
  return storagePathFor("cutouts", ownerId, `${photoId}.png`);
}

export async function writeOriginal(
  ownerId: string,
  id: string,
  bytes: Buffer,
  mimeType: string,
): Promise<string> {
  const ext = extensionFor(mimeType);
  const relative = storagePathFor("originals", ownerId, `${id}${ext}`);
  const absolute = absolutePath(relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, bytes);
  return relative;
}

function extensionFor(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/heic":
    case "image/heif":
      return ".heic";
    default:
      return ".jpg";
  }
}

/** Dedupe key for the job queue: same input, same work, reuse the result. */
export function contentHash(...parts: string[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

/**
 * The tile the worker writes beside every cutout: the garment cropped onto a
 * 3:4 canvas. Path by convention, so nothing new is stored on the row.
 */
export function tilePathFor(cutoutPath: string): string {
  return cutoutPath.replace(/\.png$/, "_tile.png");
}

/** Where the garment sits inside its tile, as fractions of the tile. */
export type TileCrop = { x: number; y: number; w: number; h: number };

/**
 * The garment's own box within its tile, as the worker recorded it beside
 * the cutout's bounds.
 *
 * Tiles share a scale so the closet shows garments at their relative sizes,
 * which leaves a small garment small in its tile. Wherever one is shown on
 * its own, cropping to this box lets it fill the space instead. Null for a
 * tile written before the worker recorded it.
 */
export function tileCrop(bounds: unknown): TileCrop | null {
  const tile = (bounds as { tile?: Partial<TileCrop> } | null)?.tile;
  if (!tile) return null;
  const { x, y, w, h } = tile;
  return [x, y, w, h].every((v) => typeof v === "number" && Number.isFinite(v)) &&
    w! > 0 &&
    h! > 0
    ? { x: x!, y: y!, w: w!, h: h! }
    : null;
}
