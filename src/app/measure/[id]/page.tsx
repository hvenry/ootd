import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";

import { MeasureScreen, type CutoutBounds } from "@/components/measure-screen";
import { unmeasuredGarments } from "@/lib/measure-queue";
import { OWNER_ID } from "@/config/brand";
import { db } from "@/db";
import { garment, measurement, photo, type PhotoView } from "@/db/schema";
import type { Matrix3 } from "@/lib/homography/solve";
import {
  silhouetteFor,
  templateFor,
  type Category,
} from "@/lib/measure/templates";

export const metadata = { title: "Measure" };
export const dynamic = "force-dynamic";

export default async function MeasurePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { id } = await params;
  const { next } = await searchParams;
  // "Measure now" in the add flow ends in the closet; working through the
  // closet's to-measure queue goes on to the next unmeasured garment; an
  // update from the item page returns to the item.
  let doneHref = next === "closet" ? "/" : `/item/${id}`;
  if (next === "queue") {
    const following = (await unmeasuredGarments(OWNER_ID)).find(
      (g) => g.id !== id,
    );
    doneHref = following ? `/measure/${following.id}?next=queue` : "/";
  }

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
  if (photos.length === 0) notFound();

  // Both faces are required before anything is measured. A garment with one
  // photo is one the capture flow was abandoned halfway through, usually a
  // reload between the two shots, so it goes back for the missing face
  // rather than becoming a permanently half-archived item.
  const front = photos.find((p) => p.view === "front");
  if (!front) redirect(`/capture?garment=${id}&view=front`);
  if (!photos.some((p) => p.view === "back")) {
    redirect(`/capture?garment=${id}&view=back`);
  }

  const existing = await db
    .select()
    .from(measurement)
    .where(
      and(eq(measurement.garmentId, id), eq(measurement.ownerId, OWNER_ID)),
    );

  const calibration = front.homography as {
    m: Matrix3;
    pxPerMm: number;
    source?: string;
  };

  return (
    <MeasureScreen
      garment={{
        id: row.id,
        shortId: row.shortId,
        category: row.category as Category,
        brand: row.brand,
        name: row.name,
      }}
      photo={{
        id: front.id,
        view: front.view as PhotoView,
        originalPath: front.originalPath,
        cutoutPath: front.cutoutPath,
        cutoutBounds: front.cutoutBounds as CutoutBounds | null,
        homography: calibration.m,
        pxPerMm: calibration.pxPerMm,
      }}
      dimensions={templateFor(row.category as Category)}
      silhouette={silhouetteFor(row.category as Category)}
      doneHref={doneHref}
      existing={existing.map((m) => {
        // A row measured on some other view still counts as measured, but
        // its handle coordinates live in that photo's canvas and would draw
        // in the wrong place here, so they are withheld rather than reused.
        const here = m.photoId === front.id;
        return {
          key: m.key,
          photoId: m.photoId,
          valueMm: m.valueMm,
          isDoubled: m.isDoubled,
          convention: m.convention,
          p1X: here ? m.p1X : null,
          p1Y: here ? m.p1Y : null,
          p2X: here ? m.p2X : null,
          p2Y: here ? m.p2Y : null,
        };
      })}
    />
  );
}
