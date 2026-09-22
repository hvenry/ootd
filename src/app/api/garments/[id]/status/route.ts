import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";

import { OWNER_ID } from "@/config/brand";
import { db } from "@/db";
import { job, photo } from "@/db/schema";

export const runtime = "nodejs";

/**
 * Polled by the measure screen while cutouts are in flight — one per view.
 *
 * It reports failures as well as successes: a cutout that never arrives is
 * otherwise indistinguishable from one still being worked on, and the screen
 * would say "cutting out" forever over a job that died minutes ago.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const photos = await db
    .select({ id: photo.id, view: photo.view, cutoutPath: photo.cutoutPath })
    .from(photo)
    .where(and(eq(photo.garmentId, id), eq(photo.ownerId, OWNER_ID)));

  if (photos.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pending = photos.filter((p) => !p.cutoutPath);
  const errors: Record<string, string> = {};

  for (const p of pending) {
    const [cutout] = await db
      .select({ status: job.status, result: job.result })
      .from(job)
      .where(
        and(
          eq(job.ownerId, OWNER_ID),
          eq(job.kind, "cutout"),
          sql`${job.payload}->>'photoId' = ${p.id}`,
        ),
      )
      .orderBy(desc(job.createdAt))
      .limit(1);

    if (cutout?.status === "failed") {
      errors[p.id] =
        (cutout.result as { error?: string } | null)?.error ?? "unknown";
    }
  }

  return NextResponse.json({
    photos: photos.map((p) => ({
      id: p.id,
      view: p.view,
      cutoutPath: p.cutoutPath,
      error: errors[p.id] ?? null,
    })),
    settled: pending.length === 0 || pending.every((p) => errors[p.id]),
  });
}
