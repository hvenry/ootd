import { Suspense } from "react";
import { and, eq } from "drizzle-orm";

import { CaptureScreen } from "@/components/capture-screen";
import { OWNER_ID } from "@/config/brand";
import { db } from "@/db";
import { garment } from "@/db/schema";
import { knownBrands } from "@/lib/brands";
import type { Category } from "@/lib/measure/templates";
import { loadRig } from "@/lib/rig";

export const metadata = { title: "Capture" };
// The brand suggestions and the rig are read per request. Left static,
// `next build` would query the database at build time, where in Docker there
// is none.
export const dynamic = "force-dynamic";

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ garment?: string }>;
}) {
  const { garment: garmentId } = await searchParams;
  const [brands, { rig }, existing] = await Promise.all([
    knownBrands(OWNER_ID),
    loadRig(OWNER_ID),
    // Shooting one more view of an item needs its category, which decides
    // what that view is and whether it goes on the markers.
    garmentId
      ? db
          .select({ category: garment.category })
          .from(garment)
          .where(and(eq(garment.id, garmentId), eq(garment.ownerId, OWNER_ID)))
          .then(([row]) => row)
      : undefined,
  ]);
  // The screen reads ?garment=&view= to attach another view to an existing
  // garment, which opts it out of prerendering.
  return (
    <Suspense fallback={null}>
      <CaptureScreen
        brands={brands}
        rig={rig}
        existingCategory={(existing?.category as Category | undefined) ?? null}
      />
    </Suspense>
  );
}
