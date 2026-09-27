import {
  CalibrationMarkers,
  type MarkerParams,
} from "@/components/calibration-markers";
import { RigForm } from "@/components/rig-form";
import { SectionHead } from "@/components/section-head";
import { OWNER_ID } from "@/config/brand";
import { loadRig } from "@/lib/rig";

export const metadata = { title: "Settings" };
// The saved rig is read per request; see the capture page for why.
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<MarkerParams>;
}) {
  const [{ rig, source }, markers] = await Promise.all([
    loadRig(OWNER_ID),
    searchParams,
  ]);

  return (
    <>
      <div className="mx-auto max-w-3xl print:hidden">
        <SectionHead bleed aside={source === "saved" ? "Saved" : "From .env"}>
          Settings
        </SectionHead>
        {/* Boxed so the numbers every photo depends on read as one unit,
            apart from the printing notes below. */}
        <section className="border-rule mb-16 border p-4 sm:p-6">
          <p className="text-fg2 mb-8 max-w-lg">
            The four marker pages as you taped them, measured circle centre to
            circle centre. Every photo is scaled from these, so re-measure
            after moving a page.
          </p>
          {/* Keyed so a save elsewhere, or an edit to .env, resets the fields. */}
          <RigForm
            key={JSON.stringify(rig)}
            rig={rig}
            saved={source === "saved"}
          />
        </section>
      </div>

      <div id="markers">
        <CalibrationMarkers {...markers} />
      </div>
    </>
  );
}
