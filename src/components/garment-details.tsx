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
  GROUP_LABELS,
  categoriesIn,
  dimensionFor,
  groupFor,
  templateFor,
  type Category,
  type Group,
  type MeasurementKey,
} from "@/lib/measure/templates";
import { shotKindFor } from "@/lib/capture-shots";
import type { KnownBrand } from "@/lib/search/brands";

const GROUPS: Group[] = ["top", "bottom", "outerwear", "accessories"];

/**
 * Correct what was typed at capture. Category is editable too, and picked
 * the way the add flow picks it: group, then type.
 * Changing it swaps the measurement template, so anything already measured
 * that the new template has no place for is named before Save, and Save
 * asks once more before deleting it rather than letting it disappear quietly.
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
  const [confirmingDrop, setConfirmingDrop] = useState(false);
  const [removing, setRemoving] = useState(false);
  // What the picker is showing, which is not the same as what is picked:
  // browsing to Bottoms changes nothing until a type is tapped.
  const [group, setGroup] = useState<Group | null>(groupFor(category));

  // The page behind stays put while the dialog scrolls, and Escape
  // discards, unless a confirmation is up: its own Escape means "keep it",
  // and should not take this dialog down with it.
  const boxRef = useRef<HTMLElement | null>(null);
  const confirmOpen = confirming || confirmingDrop;
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    boxRef.current?.focus();
    return () => {
      root.style.overflow = previous;
    };
  }, []);
  useEffect(() => {
    if (confirmOpen || pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmOpen, pending, onClose]);

  const dirty =
    draftBrand !== (brand ?? "") ||
    draftName !== (name ?? "") ||
    draftColour !== declaredColour ||
    draftCategory !== category;

  // Only what is photographed the same way: a shirt can become a jacket, but
  // not a shoe, whose five photographs it does not have, and a shoe can
  // become a boot but not the belt beside it in the same group.
  const offered = group
    ? categoriesIn(group).filter(
        (c) => shotKindFor(c) === shotKindFor(category),
      )
    : [];
  const groups = GROUPS.filter((g) =>
    categoriesIn(g).some((c) => shotKindFor(c) === shotKindFor(category)),
  );

  const allowed = new Set(templateFor(draftCategory).map((d) => d.key));
  const wouldDrop =
    draftCategory === category
      ? []
      : measuredKeys.filter((key) => !allowed.has(key));
  // Named as the measure screen names them, not by their database keys.
  const dropLabels = wouldDrop.map(
    (key) => dimensionFor(category, key)?.label ?? key,
  );

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
          `Saved. Dropped ${droppedKeys.length} measurement${droppedKeys.length === 1 ? "" : "s"} the new template has no place for: ${droppedKeys.map((key) => dimensionFor(category, key)?.label ?? key).join(", ")}.`,
        );
      } else {
        onClose();
      }
    } catch {
      setNote("Could not save. Check the server log.");
    } finally {
      setPending(false);
      setConfirmingDrop(false);
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
    <>
      {/* A centred dialog over the item, laid out as the add form is: group
          bar, types, colour, then brand and name, each centred under the one
          before. The backdrop discards, as Discard does. */}
      <div
        className="bg-bg/85 step-in fixed inset-0 z-50 overflow-y-auto overscroll-contain px-gutter"
        onClick={pending ? undefined : onClose}
      >
        <div className="flex min-h-full items-center justify-center py-6">
          <section
            ref={boxRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="details-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="bg-bg border-fg w-full max-w-3xl border px-5 pt-5 pb-8 outline-none sm:px-8 sm:pt-6"
          >
            <p
              id="details-title"
              className="label mb-5 flex items-baseline gap-2"
            >
              Edit details
              <span className="data text-fg3">
                {String(shortId).padStart(3, "0")}
              </span>
            </p>

            {/* The add form's group bar, run to the box's edges as the add
              form runs it to the viewport's. */}
            <div className="split-bar -mx-5 sm:-mx-8">
              {groups.map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={group === g}
                  onClick={() => setGroup(g)}
                  className="label tab py-3"
                >
                  {GROUP_LABELS[g]}
                </button>
              ))}
            </div>

            {offered.length > 0 ? (
              <div className={`mt-8 ${CATEGORY_GRID}`}>
                {offered.map((c) => (
                  <CategoryTile
                    key={c}
                    category={c}
                    selected={draftCategory === c}
                    onSelect={() => setDraftCategory(c)}
                  />
                ))}
              </div>
            ) : null}

            {draftCategory !== category ? (
              <p className="data text-fg3 mt-3 text-center">
                {CATEGORY_LABELS[category]} → {CATEGORY_LABELS[draftCategory]}
              </p>
            ) : null}

            <div className="mx-auto mt-10 max-w-lg">
              <p className="label text-fg2 mb-4 text-center">Colour</p>
              <ColourDots
                large
                className="justify-center"
                selected={draftColour}
                onSelect={setDraftColour}
              />
            </div>

            <div className="mx-auto mt-10 grid max-w-lg gap-5 sm:grid-cols-2">
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

            <div className="mx-auto max-w-lg">
              {wouldDrop.length > 0 ? (
                <p className="rule-top text-fg mt-8 pt-3 text-11">
                  Saving this drops {wouldDrop.length} measurement
                  {wouldDrop.length === 1 ? "" : "s"} ({dropLabels.join(", ")})
                  because {CATEGORY_LABELS[draftCategory].toLowerCase()} has no
                  such dimension.
                </p>
              ) : null}

              {/* Save in the filled slot, Discard beside it, as on the item. */}
              <div className="action-row mx-auto mt-10">
                <button
                  type="button"
                  className="btn-primary flex-1 py-4"
                  onClick={() =>
                    wouldDrop.length > 0 ? setConfirmingDrop(true) : onSave()
                  }
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
            </div>
          </section>
        </div>
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

      <ConfirmDialog
        open={confirmingDrop}
        title={`Make it ${CATEGORY_LABELS[draftCategory].toLowerCase()}?`}
        body={
          <p>
            {CATEGORY_LABELS[draftCategory]} has no place for{" "}
            {dropLabels.join(", ")}, so{" "}
            {wouldDrop.length === 1
              ? "that measurement is"
              : `those ${wouldDrop.length} measurements are`}{" "}
            deleted on save. This cannot be undone.
          </p>
        }
        confirmLabel="Save"
        pendingLabel="Saving…"
        pending={pending}
        onConfirm={onSave}
        onCancel={() => setConfirmingDrop(false)}
      />
    </>
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
