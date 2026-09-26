import { and, asc, eq, isNotNull, notExists, sql } from "drizzle-orm";

import { db } from "@/db";
import { garment, measurement } from "@/db/schema";

/**
 * Garments in the closet with no measurements yet, oldest first: the order
 * they were added in, which is the order they are most likely still laid out
 * or remembered in.
 */
export async function unmeasuredGarments(ownerId: string) {
  return db
    .select({ id: garment.id })
    .from(garment)
    .where(
      and(
        eq(garment.ownerId, ownerId),
        isNotNull(garment.completedAt),
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
