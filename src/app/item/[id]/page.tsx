import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";

import { ItemScreen } from "@/components/item-screen";
import { OWNER_ID } from "@/config/brand";
import { db } from "@/db";
import { knownBrands } from "@/lib/brands";
import { tilePathFor } from "@/lib/storage";
import { garment, measurement, photo, type PhotoView } from "@/db/schema";
import {
  silhouetteFor,
  templateFor,
  type Category,
} from "@/lib/measure/templates";

export const metadata = { title: "Item" };

/** Front first, then back, then the details in the order they were shot. */
const viewOrder = (view: string) =>
  view === "front" ? 0 : view === "back" ? 1 : 2;
export const dynamic = "force-dynamic";

/**
 * View mode. The garment as it is: both photographs, its name, and the
 * measurements behind a switch. Nothing here changes anything; editing is
 * the measure route.
 */
export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [row] = await db
    .select()
    .from(garment)
    .where(and(eq(garment.id, id), eq(garment.ownerId, OWNER_ID)));
  if (!row) notFound();

  const photos = await db
    .select()
    .from(photo)
    .where(and(eq(photo.garmentId, id), eq(photo.ownerId, OWNER_ID)))
    .orderBy(asc(photo.view));

  // Half-captured garments go back to capture, the same as the measure route.
  if (!photos.some((p) => p.view === "front")) {
    redirect(`/capture?garment=${id}&view=front`);
  }
  if (!photos.some((p) => p.view === "back")) {
    redirect(`/capture?garment=${id}&view=back`);
  }

  const existing = await db
    .select({ key: measurement.key, valueMm: measurement.valueMm })
    .from(measurement)
    .where(
      and(eq(measurement.garmentId, id), eq(measurement.ownerId, OWNER_ID)),
    );

  const category = row.category as Category;

  return (
    <ItemScreen
      garment={{
        id: row.id,
        shortId: row.shortId,
        category,
        brand: row.brand,
        name: row.name,
        declaredColour: row.declaredColour,
      }}
      photos={photos
        .sort(
          (a, b) =>
            viewOrder(a.view) - viewOrder(b.view) ||
            a.takenAt.getTime() - b.takenAt.getTime(),
        )
        .map((p) => ({
          id: p.id,
          view: p.view as PhotoView,
          detailKind: p.detailKind,
          src: `/api/media/${p.cutoutPath ? tilePathFor(p.cutoutPath) : p.originalPath}`,
          fallback: `/api/media/${p.cutoutPath ?? p.originalPath}`,
        }))}
      dimensions={templateFor(category)}
      silhouette={silhouetteFor(category)}
      values={Object.fromEntries(existing.map((m) => [m.key, m.valueMm]))}
      brands={await knownBrands(OWNER_ID)}
    />
  );
}
