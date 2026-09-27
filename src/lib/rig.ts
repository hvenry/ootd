import { eq } from "drizzle-orm";

import { db } from "@/db";
import { rig } from "@/db/schema";
import { rigFromEnv, type Rig } from "@/lib/homography/sheet";

/**
 * The rig capture solves against: the one saved in Settings, or the
 * environment until one has been.
 *
 * Read per request and handed to the client as a prop, rather than inlined
 * into the bundle at build time as `NEXT_PUBLIC_*` is, so re-measuring the
 * rig is an edit in Settings instead of a rebuild.
 */
export async function loadRig(
  ownerId: string,
): Promise<{ rig: Rig; source: "saved" | "environment" }> {
  const [row] = await db.select().from(rig).where(eq(rig.ownerId, ownerId));
  if (!row) return { rig: rigFromEnv(), source: "environment" };
  return {
    rig: {
      quad: {
        top: row.topMm,
        right: row.rightMm,
        bottom: row.bottomMm,
        left: row.leftMm,
        diag: row.diagMm,
        diag2: row.diag2Mm ?? undefined,
      },
      blackSquareMm: row.blackSquareMm,
    },
    source: "saved",
  };
}
