import Link from "next/link";
import { and, desc, eq, isNotNull, isNull, inArray, sql } from "drizzle-orm";

import { Suspense } from "react";

import { ClosetBrowser, type ClosetItem } from "@/components/closet-browser";
import { UnfinishedCaptures } from "@/components/unfinished-captures";
import { OWNER_ID } from "@/config/brand";
import { db } from "@/db";
import { tilePathFor } from "@/lib/storage";
import { garment, job, photo } from "@/db/schema";
import type { Category } from "@/lib/measure/templates";

/**
 * The closet reads the database on every request. Without this Next
 * prerenders it at build time and the grid silently freezes at whatever was
 * in the database when the image was built. Phase 2 makes this moot: reading
 * the session for `owner_id` is itself a dynamic API.
 */
export const dynamic = "force-dynamic";

export default async function ClosetPage() {
  // The closet is what you own. A capture becomes that when its
  // measurements are submitted, not when its first photograph lands.
  const garments = await db
    .select()
    .from(garment)
    .where(and(eq(garment.ownerId, OWNER_ID), isNotNull(garment.completedAt)))
    .orderBy(desc(garment.createdAt));

  const unfinished = await db
    .select({
      id: garment.id,
      shortId: garment.shortId,
      category: garment.category,
      brand: garment.brand,
      name: garment.name,
    })
    .from(garment)
    .where(and(eq(garment.ownerId, OWNER_ID), isNull(garment.completedAt)))
    .orderBy(desc(garment.createdAt));

  // Which faces each unfinished capture already has, so the row can say what
  // is actually missing rather than guessing from a count.
  const unfinishedViews = new Map<string, string[]>();
  if (unfinished.length > 0) {
    const rows = await db
      .select({ garmentId: photo.garmentId, view: photo.view })
      .from(photo)
      .where(
        and(
          eq(photo.ownerId, OWNER_ID),
          inArray(
            photo.garmentId,
            unfinished.map((g) => g.id),
          ),
        ),
      );
    for (const row of rows) {
      if (!row.garmentId) continue;
      const list = unfinishedViews.get(row.garmentId);
      if (list) list.push(row.view);
      else unfinishedViews.set(row.garmentId, [row.view]);
    }
  }

  // A garment with no cutout is either still being cut or was refused. Left
  // undistinguished the card reads "Cutting out" forever over a job that
  // died minutes ago, which is how a failure becomes invisible.
  const uncut = garments.filter((g) => !g.cutoutPath).map((g) => g.id);
  const cutFailed = new Set<string>();
  if (uncut.length > 0) {
    const failures = await db
      .select({ garmentId: sql<string>`${job.payload}->>'garmentId'` })
      .from(job)
      .where(
        and(
          eq(job.ownerId, OWNER_ID),
          eq(job.kind, "cutout"),
          eq(job.status, "failed"),
          inArray(sql`${job.payload}->>'garmentId'`, uncut),
        ),
      );
    for (const row of failures) cutFailed.add(row.garmentId);
  }

  // The back cutout, so a tile can be swiped to its other face.
  const backTiles = new Map<string, string>();
  if (garments.length > 0) {
    const backs = await db
      .select({ garmentId: photo.garmentId, cutoutPath: photo.cutoutPath })
      .from(photo)
      .where(
        and(
          eq(photo.ownerId, OWNER_ID),
          eq(photo.view, "back"),
          inArray(
            photo.garmentId,
            garments.map((g) => g.id),
          ),
        ),
      );
    for (const row of backs) {
      if (row.garmentId && row.cutoutPath) {
        backTiles.set(row.garmentId, tilePathFor(row.cutoutPath));
      }
    }
  }

  const cards: ClosetItem[] = garments.map((item) => ({
    id: item.id,
    shortId: item.shortId,
    category: item.category as Category,
    brand: item.brand,
    name: item.name,
    declaredColour: item.declaredColour,
    cutoutPath: item.cutoutPath,
    tilePath: item.cutoutPath ? tilePathFor(item.cutoutPath) : null,
    backTilePath: backTiles.get(item.id) ?? null,
    cutFailed: cutFailed.has(item.id),
    createdAt: item.createdAt.toISOString(),
  }));

  return (
    <div>
      {garments.length === 0 ? (
        <div className={unfinished.length > 0 ? "py-10" : "py-24"}>
          <p className="max-w-md font-serif text-24 leading-tight">
            {unfinished.length > 0
              ? "Nothing archived yet, but there is a capture waiting to be measured."
              : "Nothing archived yet. Photograph a garment against the sheet and it appears here with a number you can subtract."}
          </p>
          <Link href="/capture" className="chip mt-8 inline-flex">
            Capture the first one
          </Link>
        </div>
      ) : (
        <Suspense>
          <ClosetBrowser items={cards} />
        </Suspense>
      )}

      <UnfinishedCaptures
        items={unfinished.map((row) => ({
          ...row,
          category: row.category as Category,
          views: unfinishedViews.get(row.id) ?? [],
        }))}
      />
    </div>
  );
}
