import Link from "next/link";

import { RigForm } from "@/components/rig-form";
import { SectionHead } from "@/components/section-head";
import { OWNER_ID } from "@/config/brand";
import { loadRig } from "@/lib/rig";

export const metadata = { title: "Settings" };
// The saved rig is read per request; see the capture page for why.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { rig, source } = await loadRig(OWNER_ID);

  return (
    <div className="mx-auto max-w-3xl">
      <SectionHead bleed aside={source === "saved" ? "Saved" : "From .env"}>
        Rig
      </SectionHead>
      <p className="text-fg2 mb-8 max-w-lg">
        The four marker pages as you taped them, measured circle centre to
        circle centre. Every photo is scaled from these, so re-measure after
        moving a page.
      </p>
      {/* Keyed so a save elsewhere, or an edit to .env, resets the fields. */}
      <RigForm
        key={JSON.stringify(rig)}
        rig={rig}
        saved={source === "saved"}
      />

      <div className="mt-16">
        <SectionHead>Calibration markers</SectionHead>
        <p className="text-fg2 mb-4 max-w-lg">
          The printable pages, how to lay them out, and which distance is
          which.
        </p>
        <Link href="/sheet" className="label link-text">
          Print markers
        </Link>
      </div>
    </div>
  );
}
