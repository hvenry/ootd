import { NextResponse } from "next/server";
import { and, desc, eq, ne, sql } from "drizzle-orm";

import { OWNER_ID } from "@/config/brand";
import { db } from "@/db";
import { job, photo } from "@/db/schema";

export const runtime = "nodejs";

/**
 * Polled by the measure and item screens while cutouts are in flight — one
 * per view.
 *
 * It reports failures as well as successes: a cutout that never arrives is
 * otherwise indistinguishable from one still being worked on, and the screen
 * would say "cutting out" forever over a job that died minutes ago.
 *
 * State comes from the photo's latest cutout job, not from whether the photo
 * has a cutout yet. A re-cut runs over a photo that already has one, and
 * "has a path" would call it finished before it had started.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const photos = await db
    .select({
      id: photo.id,
      view: photo.view,
      cutoutPath: photo.cutoutPath,
      cutoutProvider: photo.cutoutProvider,
    })
    .from(photo)
    .where(
      and(
        eq(photo.garmentId, id),
        eq(photo.ownerId, OWNER_ID),
        // Details are never cut.
        ne(photo.view, "detail"),
      ),
    );

  if (photos.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const states = await Promise.all(
    photos.map(async (p) => {
      const [latest] = await db
        .select({ status: job.status, result: job.result, payload: job.payload })
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

      const working =
        latest?.status === "pending" || latest?.status === "running";
      const error =
        latest?.status === "failed"
          ? ((latest.result as { error?: string } | null)?.error ?? "unknown")
          : null;

      return {
        id: p.id,
        view: p.view,
        cutoutPath: p.cutoutPath,
        cutoutProvider: p.cutoutProvider,
        working,
        /** The provider the latest job asked for; null means the default. */
        attempting:
          (latest?.payload as { provider?: string } | undefined)?.provider ??
          null,
        error,
      };
    }),
  );

  return NextResponse.json({
    photos: states,
    settled: states.every((p) => !p.working),
  });
}
