import { NextResponse } from "next/server";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";

import { OWNER_ID } from "@/config/brand";
import { db } from "@/db";
import { garment, job } from "@/db/schema";
import { defaultCutoutProvider } from "@/lib/providers/cutout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How far back "recent" reaches on the status page. */
const RECENT_HOURS = 24;
const RECENT_LIMIT = 40;
/** Done jobs averaged, per provider, for the expected duration. */
const EXPECTED_SAMPLE = 20;

/**
 * The queue, as the app sees it: what is running, what just finished, how
 * long each provider usually takes, and whether the worker is there at all.
 *
 * Polled by the activity watcher behind every page. Worker health is the
 * part nothing else showed: with the worker down, jobs sit at "pending"
 * forever and look exactly like jobs about to start.
 */
export async function GET() {
  const rows = await db
    .select({
      id: job.id,
      kind: job.kind,
      status: job.status,
      payload: job.payload,
      result: job.result,
      attempts: job.attempts,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      // Server-side, so the client's clock never enters into it.
      elapsed: sql<number>`extract(epoch from now() - ${job.updatedAt})::float`,
    })
    .from(job)
    .where(
      and(
        eq(job.ownerId, OWNER_ID),
        or(
          inArray(job.status, ["pending", "running"]),
          sql`${job.updatedAt} > now() - make_interval(hours => ${RECENT_HOURS})`,
        ),
      ),
    )
    .orderBy(desc(job.createdAt))
    .limit(RECENT_LIMIT);

  const garmentIds = [
    ...new Set(
      rows
        .map((r) => (r.payload as { garmentId?: string }).garmentId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const garments =
    garmentIds.length > 0
      ? await db
          .select({
            id: garment.id,
            shortId: garment.shortId,
            brand: garment.brand,
            name: garment.name,
          })
          .from(garment)
          .where(
            and(eq(garment.ownerId, OWNER_ID), inArray(garment.id, garmentIds)),
          )
      : [];
  const byId = new Map(garments.map((g) => [g.id, g]));

  const averages = await db.execute<{ provider: string; seconds: number }>(sql`
    select provider, avg(seconds)::float as seconds from (
      select ${job.result}->>'provider' as provider,
             (${job.result}->>'seconds')::float as seconds,
             row_number() over (
               partition by ${job.result}->>'provider'
               order by ${job.updatedAt} desc
             ) as n
      from ${job}
      where ${job.ownerId} = ${OWNER_ID}
        and ${job.status} = 'done'
        and ${job.result} ? 'seconds'
    ) recent
    where n <= ${EXPECTED_SAMPLE}
    group by provider
  `);
  const expected = Object.fromEntries(
    averages.rows.map((r) => [r.provider, Math.round(r.seconds * 10) / 10]),
  );

  const fallback = defaultCutoutProvider();
  const jobs = rows.map((r) => {
    const payload = r.payload as {
      garmentId?: string;
      photoId?: string;
      view?: string;
      provider?: string;
    };
    const result = r.result as {
      error?: string;
      cutoutPath?: string | null;
      seconds?: number;
      provider?: string;
    } | null;
    return {
      id: r.id,
      kind: r.kind,
      status: r.status,
      provider: result?.provider ?? payload.provider ?? fallback,
      photoId: payload.photoId ?? null,
      view: payload.view ?? null,
      garment: payload.garmentId ? (byId.get(payload.garmentId) ?? null) : null,
      attempts: r.attempts,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      /** Seconds since the last state change: time running, if it is. */
      elapsed: Math.max(0, Math.round(r.elapsed)),
      seconds: result?.seconds ?? null,
      cutoutPath: result?.cutoutPath ?? null,
      error: r.status === "failed" ? (result?.error ?? "unknown") : null,
    };
  });

  return NextResponse.json({ jobs, expected, worker: await workerHealth() });
}

type WorkerHealth = {
  ok: boolean;
  provider?: string;
  processed?: number;
  failed?: number;
  last_error?: string | null;
};

/** Null means unreachable, which on this page is the finding. */
async function workerHealth(): Promise<WorkerHealth | null> {
  const url = process.env.WORKER_URL ?? "http://localhost:8000";
  try {
    const response = await fetch(`${url}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    return response.ok ? ((await response.json()) as WorkerHealth) : null;
  } catch {
    return null;
  }
}
