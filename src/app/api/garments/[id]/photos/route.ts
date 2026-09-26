import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { OWNER_ID } from "@/config/brand";
import { db } from "@/db";
import {
  detailKindEnum,
  garment,
  job,
  photo,
  type DetailKind,
  type PhotoView,
} from "@/db/schema";
import { parseCalibration } from "@/lib/capture";
import { newId } from "@/lib/ids";
import { contentHash, writeOriginal } from "@/lib/storage";

export const runtime = "nodejs";

const VIEWS: PhotoView[] = ["front", "back", "detail"];

/**
 * Add another view to an existing garment — the back, usually, because back
 * rise cannot honestly be taken off a front photo.
 *
 * Each view is shot against the rig in its own right and carries its own
 * homography; nothing is shared but the garment.
 *
 * A detail is the exception: a close-up shot off the rig, with no markers,
 * no homography and no cutout. It is kept for what it shows, never measured,
 * and a garment has as many as it needs.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: garmentId } = await params;
  const form = await request.formData();

  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image" }, { status: 400 });
  }

  const view = String(form.get("view") ?? "back") as PhotoView;
  if (!VIEWS.includes(view)) {
    return NextResponse.json({ error: "Unknown view" }, { status: 400 });
  }

  let detailKind: DetailKind | null = null;
  if (view === "detail") {
    detailKind = String(form.get("detailKind") ?? "") as DetailKind;
    if (!detailKindEnum.enumValues.includes(detailKind)) {
      return NextResponse.json({ error: "Unknown detail kind" }, { status: 400 });
    }
  }

  const calibration =
    view === "detail" ? null : parseCalibration(form.get("calibration"));
  if (view !== "detail" && !calibration) {
    return NextResponse.json(
      { error: "Missing or malformed homography" },
      { status: 400 },
    );
  }

  const [owned] = await db
    .select({ id: garment.id })
    .from(garment)
    .where(and(eq(garment.id, garmentId), eq(garment.ownerId, OWNER_ID)));
  if (!owned) {
    return NextResponse.json({ error: "No such garment" }, { status: 404 });
  }

  const photoId = newId();
  const originalPath = await writeOriginal(
    OWNER_ID,
    photoId,
    Buffer.from(await file.arrayBuffer()),
    file.type || "image/jpeg",
  );

  if (!calibration) {
    await db.insert(photo).values({
      id: photoId,
      ownerId: OWNER_ID,
      garmentId,
      view,
      detailKind,
      originalPath,
    });
    return NextResponse.json({ garmentId, photoId, view });
  }

  await db.transaction(async (tx) => {
    // Reshooting a view replaces it; the measurements on the old one go with
    // it, because their handle coordinates belong to that photo's canvas.
    await tx
      .delete(photo)
      .where(
        and(
          eq(photo.ownerId, OWNER_ID),
          eq(photo.garmentId, garmentId),
          eq(photo.view, view),
        ),
      );

    await tx.insert(photo).values({
      id: photoId,
      ownerId: OWNER_ID,
      garmentId,
      view,
      originalPath,
      homography: {
        m: calibration.m,
        pxPerMm: calibration.pxPerMm,
        source: calibration.source ?? "sheet",
        cornersInImage: calibration.cornersInImage ?? null,
      },
      sheetVersion: Number(calibration.sheetVersion ?? 0),
      greyPatchRgb: calibration.greyPatchRgb ?? null,
    });

    if (view === "front") {
      await tx
        .update(garment)
        .set({ photoId, cutoutPath: null })
        .where(eq(garment.id, garmentId));
    }

    await tx.insert(job).values({
      id: newId(),
      ownerId: OWNER_ID,
      kind: "cutout",
      payload: {
        garmentId,
        photoId,
        view,
        originalPath,
        sheetQuad: calibration.cornersInImage ?? null,
        homography: calibration.m,
        pxPerMm: calibration.pxPerMm,
      },
      contentHash: contentHash("cutout", originalPath),
    });
  });

  return NextResponse.json({ garmentId, photoId, view });
}
