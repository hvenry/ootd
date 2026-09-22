import { Suspense } from "react";

import { CaptureScreen } from "@/components/capture-screen";

export const metadata = { title: "Capture" };

export default function CapturePage() {
  // The screen reads ?garment=&view= to attach another view to an existing
  // garment, which opts it out of prerendering.
  return (
    <Suspense fallback={null}>
      <CaptureScreen />
    </Suspense>
  );
}
