"use server";

import { rm } from "node:fs/promises";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { OWNER_ID } from "@/config/brand";
import { db } from "@/db";
import { garment, job, measurement, photo } from "@/db/schema";
import { isDeclaredColour } from "@/lib/colour/declared";
import { newId } from "@/lib/ids";
import { absolutePath, cutoutPathFor, tilePathFor } from "@/lib/storage";
import {
  DEFAULT_LAYER_SLOT,
  templateFor,
  type Category,
  type Convention,
  type MeasurementKey,
} from "@/lib/measure/templates";

export type MeasurementInput = {
  key: MeasurementKey;
  /** Integer millimetres. The caller has already divided by px/mm. */
  valueMm: number;
  isDoubled: boolean;
  convention: Convention;
  /** Handle positions in the metric canvas, for the overlay and re-derivation. */
  p1: { x: number; y: number };
  p2: { x: number; y: number };
};

/**
 * Write the whole set in one transaction.
 *
 * Measuring is one sitting, not six: the pins for every dimension are placed
 * against the same photograph and reviewed together on the diagram, so they
 * are committed together too. Saving each one as it was dragged meant a
 * garment could sit in the closet with three of its four numbers, and no
 * screen anywhere said so.
 */
export async function saveMeasurements(input: {
  garmentId: string;
  /** The photo the handles were placed on. */
  photoId: string;
  rows: MeasurementInput[];
}) {
  const rows = input.rows.map((row) => {
    const valueMm = Math.round(row.valueMm);
    if (!Number.isFinite(valueMm) || valueMm <= 0) {
      throw new Error("Measurement must be a positive length in millimetres");
    }
    return { ...row, valueMm };
  });
  if (rows.length === 0) return;

  const [owned] = await db
    .select({ id: garment.id })
    .from(garment)
    .where(and(eq(garment.id, input.garmentId), eq(garment.ownerId, OWNER_ID)));
  if (!owned) throw new Error("No such garment");

  await db.transaction(async (tx) => {
    for (const row of rows) {
      await tx
        .insert(measurement)
        .values({
          id: newId(),
          ownerId: OWNER_ID,
          garmentId: input.garmentId,
          photoId: input.photoId,
          key: row.key,
          valueMm: row.valueMm,
          isDoubled: row.isDoubled,
          convention: row.convention,
          source: "measured",
          p1X: Math.round(row.p1.x),
          p1Y: Math.round(row.p1.y),
          p2X: Math.round(row.p2.x),
          p2Y: Math.round(row.p2.y),
        })
        .onConflictDoUpdate({
          target: [measurement.garmentId, measurement.key],
          set: {
            valueMm: row.valueMm,
            photoId: input.photoId,
            isDoubled: row.isDoubled,
            convention: row.convention,
            p1X: Math.round(row.p1.x),
            p1Y: Math.round(row.p1.y),
            p2X: Math.round(row.p2.x),
            p2Y: Math.round(row.p2.y),
            measuredAt: new Date(),
          },
        });
    }

    // The submission is what turns a capture into a garment. Set once, on
    // the first one, so the date means "when this entered the closet" rather
    // than "when it was last corrected".
    await tx
      .update(garment)
      .set({ completedAt: new Date() })
      .where(
        and(
          eq(garment.id, input.garmentId),
          eq(garment.ownerId, OWNER_ID),
          isNull(garment.completedAt),
        ),
      );
  });

  revalidatePath("/");
  revalidatePath(`/measure/${input.garmentId}`);
  revalidatePath(`/item/${input.garmentId}`);
}

/**
 * Remove the garment, its photographs and everything derived from them.
 *
 * Irreversible, and deliberately so: the originals are the one thing the app
 * cannot recreate, so a "deleted" garment that quietly kept its files would
 * be a storage leak nobody ever notices. The database rows cascade from the
 * garment; the files have to be chased by hand, and are unlinked only after
 * the transaction has committed, so a failed delete never orphans an image
 * that a surviving row still points at.
 */
export async function deleteGarment(garmentId: string) {
  const [owned] = await db
    .select({ id: garment.id })
    .from(garment)
    .where(and(eq(garment.id, garmentId), eq(garment.ownerId, OWNER_ID)));
  if (!owned) throw new Error("No such garment");

  const photos = await db
    .select({
      id: photo.id,
      originalPath: photo.originalPath,
      cutoutPath: photo.cutoutPath,
    })
    .from(photo)
    .where(and(eq(photo.garmentId, garmentId), eq(photo.ownerId, OWNER_ID)));

  await db.transaction(async (tx) => {
    // Drop any cutout still queued for these photos first. Left behind, it
    // would be picked up seconds later and write a PNG for a photo that no
    // longer exists — and nothing would ever point at that file again.
    if (photos.length > 0) {
      await tx.delete(job).where(
        and(
          eq(job.ownerId, OWNER_ID),
          eq(job.kind, "cutout"),
          inArray(
            sql`${job.payload}->>'photoId'`,
            photos.map((p) => p.id),
          ),
        ),
      );
    }

    await tx
      .delete(garment)
      .where(and(eq(garment.id, garmentId), eq(garment.ownerId, OWNER_ID)));
  });

  for (const row of photos) {
    // The cutout path is conventional, so it can be removed whether or not
    // the row had recorded it yet. A job already *running* can still land
    // after this; the worker checks the photo survived and deletes its own
    // output when it did not.
    const paths = [
      row.originalPath,
      row.cutoutPath ?? cutoutPathFor(OWNER_ID, row.id),
    ];
    for (const relative of paths) {
      if (!relative) continue;
      // `force` because a cutout that never landed is the normal case, not
      // an error worth failing a delete over.
      await rm(absolutePath(relative), { force: true });
      if (relative.endsWith(".png")) {
        await rm(absolutePath(tilePathFor(relative)), { force: true });
      }
    }
  }

  revalidatePath("/");
}

export type UpdateGarmentDetailsInput = {
  brand?: string | null;
  name?: string | null;
  /** A name from lib/colour/declared, or null to clear. */
  declaredColour?: string | null;
  category?: Category;
};

/**
 * Correct what was typed at capture time.
 *
 * Changing the category changes which measurement template applies, so any
 * measurement whose key the new template does not contain is deleted rather
 * than left behind. A stranded `front_rise` on a t-shirt is invisible in the
 * UI but still real in the database, and it would quietly poison every
 * comparison that reads measurements by garment.
 */
export async function updateGarmentDetails(
  garmentId: string,
  fields: UpdateGarmentDetailsInput,
): Promise<{ droppedKeys: MeasurementKey[] }> {
  const [existing] = await db
    .select({ category: garment.category })
    .from(garment)
    .where(and(eq(garment.id, garmentId), eq(garment.ownerId, OWNER_ID)));
  if (!existing) throw new Error("No such garment");

  const nextCategory = fields.category;
  const categoryChanged =
    nextCategory !== undefined && nextCategory !== existing.category;

  let droppedKeys: MeasurementKey[] = [];

  await db.transaction(async (tx) => {
    if (categoryChanged) {
      const allowed = new Set(templateFor(nextCategory).map((d) => d.key));
      const rows = await tx
        .select({ key: measurement.key })
        .from(measurement)
        .where(
          and(
            eq(measurement.garmentId, garmentId),
            eq(measurement.ownerId, OWNER_ID),
          ),
        );

      droppedKeys = rows.map((r) => r.key).filter((k) => !allowed.has(k));
      if (droppedKeys.length > 0) {
        await tx
          .delete(measurement)
          .where(
            and(
              eq(measurement.garmentId, garmentId),
              eq(measurement.ownerId, OWNER_ID),
              inArray(measurement.key, droppedKeys),
            ),
          );
      }
    }

    await tx
      .update(garment)
      .set({
        ...(fields.brand !== undefined ? { brand: fields.brand || null } : {}),
        ...(fields.name !== undefined ? { name: fields.name || null } : {}),
        ...(fields.declaredColour !== undefined
          ? {
              declaredColour:
                fields.declaredColour && isDeclaredColour(fields.declaredColour)
                  ? fields.declaredColour
                  : null,
            }
          : {}),
        ...(categoryChanged
          ? {
              category: nextCategory,
              layerSlot: DEFAULT_LAYER_SLOT[nextCategory],
            }
          : {}),
      })
      .where(and(eq(garment.id, garmentId), eq(garment.ownerId, OWNER_ID)));
  });

  revalidatePath("/");
  revalidatePath(`/measure/${garmentId}`);
  revalidatePath(`/item/${garmentId}`);

  return { droppedKeys };
}
