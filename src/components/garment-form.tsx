"use client";

import {
  CATEGORY_LABELS,
  isBottomSilhouette,
  isTopSilhouette,
  silhouetteFor,
  type Category,
} from "@/lib/measure/templates";
import { declaredHex, declaredName } from "@/lib/colour/declared";
import { ColourDots } from "@/components/colour-dots";

export type Group = "top" | "bottom";

export type GarmentDraft = {
  /** Tops or bottoms; picked first, and it decides which types are offered. */
  group: Group | null;
  /** null until the person picks one; nothing is preselected */
  category: Category | null;
  brand: string;
  name: string;
  /** sRGB hex of the declared colour, or "" when not set */
  colour: string;
};

/**
 * Every top takes the same measurements and every bottom takes the same
 * measurements, so the split here is exactly the split that decides what you
 * will be asked. Coat is omitted: it measures identically to a jacket and the
 * distinction belongs in `garment.subcategory`. Shoes and hats have no
 * template yet.
 */
const CATEGORIES: Record<Group, Category[]> = {
  top: (Object.keys(CATEGORY_LABELS) as Category[]).filter(
    (c) => isTopSilhouette(silhouetteFor(c)) && c !== "coat",
  ),
  bottom: (Object.keys(CATEGORY_LABELS) as Category[]).filter((c) =>
    isBottomSilhouette(silhouetteFor(c)),
  ),
};

/**
 * What the garment is, asked before the camera opens.
 *
 * The category decides which dimensions the measure screen offers, so asking
 * for it afterwards means the person shoots first and only then finds out
 * what they were meant to be looking at. Brand and name are here for the
 * same reason: they are typed once, at the point where the garment is in
 * your hands and the label is readable.
 */
export function GarmentForm({
  draft,
  onChange,
}: {
  draft: GarmentDraft;
  onChange: (next: GarmentDraft) => void;
}) {
  return (
    <>
      {/* Tops | Bottoms is the closet's Filter | Sort bar. On desktop it
          stops bleeding and becomes a closed box inside the content. */}
      <div className="split-bar split-bar-bleed lg:static lg:w-auto lg:translate-x-0 lg:border-x lg:border-x-rule">
        {(["top", "bottom"] as const).map((group) => (
          <button
            key={group}
            type="button"
            aria-pressed={draft.group === group}
            onClick={() => {
              // Re-picking the group already chosen would clear the type.
              if (draft.group === group) return;
              onChange({ ...draft, group, category: null });
            }}
            className="label tab py-3"
          >
            {group === "top" ? "Tops" : "Bottoms"}
          </button>
        ))}
      </div>

      {draft.group ? (
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {CATEGORIES[draft.group].map((c) => (
            <button
              key={c}
              type="button"
              className="chip"
              aria-pressed={draft.category === c}
              onClick={() => onChange({ ...draft, category: c })}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mx-auto mt-10 max-w-lg">
        <p className="label text-fg2 mb-3 text-center">Colour</p>
        <ColourDots
          className="justify-center"
          selected={declaredName(draft.colour)}
          onSelect={(name) =>
            onChange({ ...draft, colour: declaredHex(name) ?? "" })
          }
        />

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <Field
            label="Brand"
            value={draft.brand}
            onChange={(brand) => onChange({ ...draft, brand })}
            placeholder="Brand"
          />
          <Field
            label="Name"
            value={draft.name}
            onChange={(name) => onChange({ ...draft, name })}
            placeholder="Name"
          />
        </div>
      </div>
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
