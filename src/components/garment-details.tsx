"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { deleteGarment, updateGarmentDetails } from "@/app/actions";
import { useActivity } from "@/components/activity";
import { BrandField } from "@/components/brand-field";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ColourDots } from "@/components/colour-dots";
import { CATEGORY_GRID, CategoryTile } from "@/components/category-tile";
import {
  CATEGORY_LABELS,
  isBottomSilhouette,
  isTopSilhouette,
  silhouetteFor,
  templateFor,
  type Category,
  type MeasurementKey,
} from "@/lib/measure/templates";
import type { KnownBrand } from "@/lib/search/brands";

/**
 * Correct what was typed at capture. Category is editable too, but changing it
 * swaps the measurement template, so anything already measured that the new
 * template has no place for is shown before it is deleted rather than
 * disappearing quietly.
 */
export function GarmentDetails({
  garmentId,
  category,
  brand,
  name,
  declaredColour,
  shortId,
  measuredKeys,
  brands,
  onClose,
}: {
  /** The closet's brands, offered as the brand is typed. */
  brands: KnownBrand[];
  garmentId: string;
  category: Category;
  brand: string | null;
  name: string | null;
  declaredColour: string | null;
  shortId: number;
  measuredKeys: MeasurementKey[];
  /** Leave edit mode, after a save or on discard. */
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useActivity();
  const [draftBrand, setDraftBrand] = useState(brand ?? "");
  const [draftName, setDraftName] = useState(name ?? "");
  const [draftCategory, setDraftCategory] = useState<Category>(category);
  const [draftColour, setDraftColour] = useState<string | null>(declaredColour);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  // Edit replaces the diagram, which on a phone sits under the photo, so
  // the form opened below the fold and nothing said it had. Bring Brand up
  // under the header. Below lg only: from there the column is sticky and
  // already in view, and scrolling a sticky element just jolts the page.
  const fieldsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!window.matchMedia("(max-width: 1023.98px)").matches) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    fieldsRef.current?.scrollIntoView({
      block: "start",
      behavior: still ? "auto" : "smooth",
    });
  }, []);

  const dirty =
    draftBrand !== (brand ?? "") ||
    draftName !== (name ?? "") ||
    draftColour !== declaredColour ||
    draftCategory !== category;

  // A top stays a top and a bottom stays a bottom: the photographs were
  // taken for one family of measurements, and the other family cannot be
  // read off them. Only categories in the same family are offered.
  const family = isTopSilhouette(silhouetteFor(category))
    ? isTopSilhouette
    : isBottomSilhouette;
  const siblings = (Object.keys(CATEGORY_LABELS) as Category[]).filter((c) =>
    family(silhouetteFor(c)),
  );

  const allowed = new Set(templateFor(draftCategory).map((d) => d.key));
  const wouldDrop =
    draftCategory === category
      ? []
      : measuredKeys.filter((key) => !allowed.has(key));

  async function onSave() {
    setPending(true);
    setNote(null);
    try {
      const { droppedKeys } = await updateGarmentDetails(garmentId, {
        brand: draftBrand,
        name: draftName,
        declaredColour: draftColour,
        category: draftCategory,
      });
      router.refresh();
      toast({
        message: "Details saved",
        detail: [draftBrand, draftName].filter(Boolean).join(" ") || undefined,
      });
      // Dropping measurements is worth a pause; a plain save is not.
      if (droppedKeys.length > 0) {
        setNote(
          `Saved. Dropped ${droppedKeys.length} measurement${droppedKeys.length === 1 ? "" : "s"} the new template has no place for: ${droppedKeys.join(", ")}.`,
        );
      } else {
        onClose();
      }
    } catch {
      setNote("Could not save. Check the server log.");
    } finally {
      setPending(false);
    }
  }

  async function onRemove() {
    setRemoving(true);
    try {
      await deleteGarment(garmentId);
      toast({
        message: "Removed from closet",
        detail: [brand, name].filter(Boolean).join(" ") || undefined,
      });
      router.push("/");
    } catch {
      setRemoving(false);
      setConfirming(false);
      setNote("Could not remove. Check the server log.");
    }
  }

  return (
    <section>
      <p className="label mb-4">Details</p>
      <div
        ref={fieldsRef}
        className="grid scroll-mt-[calc(var(--header-h)+1rem)] gap-4"
      >
        <BrandField
          value={draftBrand}
          onChange={setDraftBrand}
          brands={brands}
        />
        <Field
          label="Name"
          value={draftName}
          onChange={setDraftName}
          placeholder="Name"
        />
      </div>

      <p className="label text-fg2 mt-6 mb-2">Category</p>
      <div className={CATEGORY_GRID}>
        {siblings.map((c) => (
          <CategoryTile
            key={c}
            category={c}
            selected={draftCategory === c}
            onSelect={() => setDraftCategory(c)}
          />
        ))}
      </div>

      <p className="label text-fg2 mt-6 mb-2">Colour</p>
      <ColourDots selected={draftColour} onSelect={setDraftColour} />

      {wouldDrop.length > 0 ? (
        <p className="rule-top text-fg mt-4 pt-3 text-11">
          Saving this drops {wouldDrop.length} measurement
          {wouldDrop.length === 1 ? "" : "s"} ({wouldDrop.join(", ")}) because{" "}
          {CATEGORY_LABELS[draftCategory].toLowerCase()} has no such dimension.
        </p>
      ) : null}

      {/* Save takes the filled slot Measure normally holds; Discard is the
          text beside it, where Edit details was. */}
      <div className="action-row mt-8">
        <button
          type="button"
          className="btn-primary flex-1 py-4"
          onClick={onSave}
          disabled={pending || !dirty}
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="label link-text"
          onClick={onClose}
          disabled={pending}
        >
          Discard
        </button>
      </div>

      {note ? <p className="data text-fg2 mt-3">{note}</p> : null}

      {/* The one destructive control in the app, last in the form, behind
          the intent to edit. Outline and text only, never a fill. */}
      <div className="border-rule mt-6 border-t pt-6 text-center">
        <button
          type="button"
          className="label text-danger cursor-pointer hover:underline"
          onClick={() => setConfirming(true)}
          disabled={pending}
        >
          Remove from closet
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        title={`Remove ${String(shortId).padStart(3, "0")}?`}
        body={
          <p>
            Removes {brand ?? "this garment"}
            {name ? ` ${name}` : ""}, both photographs and every measurement.
            This cannot be undone.
          </p>
        }
        confirmLabel="Remove"
        pending={removing}
        onConfirm={onRemove}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="label text-fg2">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="border-rule focus:border-fg text-fg placeholder:text-fg3 mt-1 w-full border-b bg-transparent py-1 text-15 outline-none"
      />
    </label>
  );
}
