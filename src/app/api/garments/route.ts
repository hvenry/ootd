import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { OWNER_ID } from "@/config/brand";
import { db } from "@/db";
import { garment, job, photo } from "@/db/schema";
import { parseCalibration, str } from "@/lib/capture";
import { declaredName } from "@/lib/colour/declared";
import { newId } from "@/lib/ids";
import { contentHash, writeOriginal } from "@/lib/storage";
import { DEFAULT_LAYER_SLOT, type Category } from "@/lib/measure/templates";

export const runtime = "nodejs";

/**
 * Capture the front of a new garment: store the original, record the
 * homography, create the garment, enqueue the cutout. Further views go to
 * `/api/garments/[id]/photos`.
 *
 * The cutout is a job row rather than work done inside this request — an
 * HTTP handler must never block on image processing.
 */
export async function POST(request: Request) {
  const form = await request.formData();

  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image" }, { status: 400 });
  }

  const calibration = parseCalibration(form.get("calibration"));
  if (!calibration) {
    return NextResponse.json(
      { error: "Missing or malformed homography" },
      { status: 400 },
    );
  }

  const category = String(form.get("category") ?? "") as Category;
  if (!(category in DEFAULT_LAYER_SLOT)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }

  const photoId = newId();
  const originalPath = await writeOriginal(
    OWNER_ID,
    photoId,
    Buffer.from(await file.arrayBuffer()),
    file.type || "image/jpeg",
  );

  const garmentId = newId();

  await db.transaction(async (tx) => {
    await tx.insert(photo).values({
      id: photoId,
      ownerId: OWNER_ID,
      view: "front",
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

    // The spoken handle. Per-owner and contiguous, so it has to be max+1
    // rather than a sequence. FOR UPDATE is not allowed alongside an
    // aggregate, so the owner is locked for the length of the transaction
    // instead; UNIQUE(owner_id, short_id) is the backstop.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${OWNER_ID}))`);
    const rows = await tx
      .select({ next: sql<number>`coalesce(max(${garment.shortId}), 0) + 1` })
      .from(garment)
      .where(eq(garment.ownerId, OWNER_ID));

    await tx.insert(garment).values({
      id: garmentId,
      ownerId: OWNER_ID,
      category,
      brand: str(form.get("brand")),
      name: str(form.get("name")),
      // The form sends the swatch hex; the name is what is kept.
      declaredColour: declaredName(str(form.get("colour"))),
      shortId: Number(rows[0].next),
      photoId,
      layerSlot: DEFAULT_LAYER_SLOT[category],
    });

    await tx.update(photo).set({ garmentId }).where(eq(photo.id, photoId));

    await tx.insert(job).values({
      id: newId(),
      ownerId: OWNER_ID,
      kind: "cutout",
      payload: {
        garmentId,
        photoId,
        view: "front",
        originalPath,
        sheetQuad: calibration.cornersInImage ?? null,
        // The worker keeps the marker pages out of the cutout by geometry,
        // and geometry in millimetres needs the map into the metric canvas.
        homography: calibration.m,
        pxPerMm: calibration.pxPerMm,
      },
      contentHash: contentHash("cutout", originalPath),
    });
  });

  return NextResponse.json({ garmentId, photoId });
}
