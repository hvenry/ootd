import { Suspense } from "react";

import { CaptureScreen } from "@/components/capture-screen";
import { OWNER_ID } from "@/config/brand";
import { knownBrands } from "@/lib/brands";

export const metadata = { title: "Capture" };
// The brand suggestions are read per request. Left static, `next build`
// would query the database at build time, where in Docker there is none.
export const dynamic = "force-dynamic";

export default async function CapturePage() {
  const brands = await knownBrands(OWNER_ID);
  // The screen reads ?garment=&view= to attach another view to an existing
  // garment, which opts it out of prerendering.
  return (
    <Suspense fallback={null}>
      <CaptureScreen brands={brands} />
    </Suspense>
  );
}
