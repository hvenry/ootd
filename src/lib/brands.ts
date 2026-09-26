import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { garment } from "@/db/schema";
import { brandKey, type KnownBrand } from "@/lib/search/brands";

/**
 * Every brand already in the closet, most-owned first.
 *
 * These rank ahead of the starter list because the job is consistency more
 * than discovery: the closet filters on the exact string, so "Levis" beside "Levi's" is two brands with half a closet
 * each. Spellings that differ only in case or punctuation are folded into
 * whichever is used most.
 */
export async function knownBrands(ownerId: string): Promise<KnownBrand[]> {
  const rows = await db
    .select({ name: garment.brand, count: sql<number>`count(*)::int` })
    .from(garment)
    .where(and(eq(garment.ownerId, ownerId), isNotNull(garment.brand)))
    .groupBy(garment.brand)
    .orderBy(desc(sql`count(*)`), garment.brand);

  const folded = new Map<string, KnownBrand>();
  for (const row of rows) {
    if (!row.name) continue;
    const key = brandKey(row.name);
    const held = folded.get(key);
    // Rows arrive most-used first, so the first spelling seen is the one kept.
    if (held) held.count += row.count;
    else folded.set(key, { name: row.name, count: row.count });
  }
  return [...folded.values()].sort((a, b) => b.count - a.count);
}
