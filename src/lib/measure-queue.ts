import { and, asc, eq, isNotNull, notExists, notInArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { categoryEnum, garment, measurement } from "@/db/schema";
import { templateFor } from "@/lib/measure/templates";

/** Categories with nothing to measure yet, which never join the queue. */
const UNMEASURED = categoryEnum.enumValues.filter(
  (c) => templateFor(c).length === 0,
);

/**
 * Garments in the closet with no measurements yet, oldest first: the order
 * they were added in, which is the order they are most likely still laid out
 * or remembered in.
 */
export async function unmeasuredGarments(ownerId: string) {
  return db
    .select({ id: garment.id, createdAt: garment.createdAt })
    .from(garment)
    .where(
      and(
        eq(garment.ownerId, ownerId),
        isNotNull(garment.completedAt),
        notInArray(garment.category, UNMEASURED),
        notExists(
          db
            .select({ one: sql`1` })
            .from(measurement)
            .where(eq(measurement.garmentId, garment.id)),
        ),
      ),
    )
    .orderBy(asc(garment.createdAt));
}
