import { Suspense } from "react";

import { CaptureScreen } from "@/components/capture-screen";
import { OWNER_ID } from "@/config/brand";
import { knownBrands } from "@/lib/brands";
import { loadRig } from "@/lib/rig";

export const metadata = { title: "Capture" };
// The brand suggestions and the rig are read per request. Left static,
// `next build` would query the database at build time, where in Docker there
// is none.
export const dynamic = "force-dynamic";

export default async function CapturePage() {
  const [brands, { rig }] = await Promise.all([
    knownBrands(OWNER_ID),
    loadRig(OWNER_ID),
  ]);
  // The screen reads ?garment=&view= to attach another view to an existing
  // garment, which opts it out of prerendering.
  return (
    <Suspense fallback={null}>
      <CaptureScreen brands={brands} rig={rig} />
    </Suspense>
  );
}
