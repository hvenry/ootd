"use client";

import { useEffect, useRef } from "react";

import {
  GROUP_LABELS,
  TOP_TYPES,
  categoriesIn,
  type Category,
  type Group,
  type Silhouette,
} from "@/lib/measure/templates";
import { declaredHex, declaredName } from "@/lib/colour/declared";
import { ColourDots } from "@/components/colour-dots";
import { CATEGORY_GRID, CategoryTile } from "@/components/category-tile";

export type GarmentDraft = {
  /** Tops, bottoms or outerwear; picked first, and it decides what is offered. */
  group: Group | null;
  /** Tops only: the sleeve, which is the shape the top is measured as. */
  topType: Silhouette | null;
  /** null until the person picks one; nothing is preselected */
  category: Category | null;
  brand: string;
  name: string;
  /** sRGB hex of the declared colour, or "" when not set */
  colour: string;
};

const GROUPS: Group[] = ["top", "bottom", "outerwear"];

/**
 * The types on offer once enough has been picked: a top needs its sleeve
 * first, because two dozen chips at once is a list nobody reads. Shoes and
 * hats are sized, not measured, and are not offered here yet.
 */
function offered(draft: GarmentDraft): Category[] {
  if (!draft.group) return [];
  if (draft.group === "top") {
    return draft.topType ? categoriesIn("top", draft.topType) : [];
  }
  return categoriesIn(draft.group);
}

/**
 * One question, shown only once the one before it is answered. It fades in
 * and scrolls itself just into view: on a phone the next question would
 * otherwise appear below the fold, and nothing would say it had.
 */
function Step({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({
      block: "nearest",
      behavior: still ? "auto" : "smooth",
    });
  }, []);
  return (
    <div ref={ref} className={`step-in ${className}`}>
      {children}
    </div>
  );
}

/**
 * What the garment is, asked before the camera opens.
 *
 * The category decides which dimensions the measure screen offers, so asking
 * for it afterwards means the person shoots first and only then finds out
 * what they were meant to be looking at. Brand and name are here for the
 * same reason: they are typed once, at the point where the garment is in
 * your hands and the label is readable.
 *
 * Asked one question at a time — group, sleeve, type, colour, then brand
 * and name — so the screen only ever holds the choice in front of you.
 */
export function GarmentForm({
  draft,
  onChange,
  footer,
}: {
  draft: GarmentDraft;
  onChange: (next: GarmentDraft) => void;
  /** The screen's Next, shown with the last question. */
  footer?: React.ReactNode;
}) {
  return (
    <>
      {/* The group bar is the closet's Filter | Sort bar. On desktop it
          stops bleeding and becomes a closed box inside the content. */}
      <div className="split-bar split-bar-bleed lg:static lg:w-auto lg:transform-none lg:border-x lg:border-x-rule">
        {GROUPS.map((group) => (
          <button
            key={group}
            type="button"
            aria-pressed={draft.group === group}
            onClick={() => {
              // Re-picking the group already chosen would clear the type.
              if (draft.group === group) return;
              // Tops open on the first sleeve, so the types are already
              // showing; the other sleeves are one tap away.
              onChange({
                ...draft,
                group,
                topType: group === "top" ? TOP_TYPES[0].silhouette : null,
                category: null,
              });
            }}
            className="label tab py-3"
          >
            {GROUP_LABELS[group]}
          </button>
        ))}
      </div>

      {draft.group === "top" ? (
        <Step className="mt-6 flex justify-center gap-6">
          {TOP_TYPES.map(({ silhouette, label }) => (
            <button
              key={silhouette}
              type="button"
              aria-pressed={draft.topType === silhouette}
              onClick={() => {
                if (draft.topType === silhouette) return;
                onChange({ ...draft, topType: silhouette, category: null });
              }}
              className="label tab"
            >
              {label}
            </button>
          ))}
        </Step>
      ) : null}

      {offered(draft).length > 0 ? (
        <Step
          key={`${draft.group}-${draft.topType}`}
          className={`mx-auto mt-8 max-w-3xl ${CATEGORY_GRID}`}
        >
          {offered(draft).map((c) => (
            <CategoryTile
              key={c}
              category={c}
              selected={draft.category === c}
              onSelect={() => onChange({ ...draft, category: c })}
            />
          ))}
        </Step>
      ) : null}

      {draft.category ? (
        <Step className="mx-auto mt-10 max-w-lg">
          <p className="label text-fg2 mb-4 text-center">Colour</p>
          <ColourDots
            large
            className="justify-center"
            selected={declaredName(draft.colour)}
            onSelect={(name) =>
              onChange({ ...draft, colour: declaredHex(name) ?? "" })
            }
          />
        </Step>
      ) : null}

      {draft.category && draft.colour ? (
        <Step className="mx-auto mt-10 max-w-lg">
          <div className="grid gap-5 sm:grid-cols-2">
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
          {footer}
        </Step>
      ) : null}
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
