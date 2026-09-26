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
import { BrandField } from "@/components/brand-field";
import { ColourDots } from "@/components/colour-dots";
import type { KnownBrand } from "@/lib/search/brands";
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
 * and takes the page to the bottom, where it is: on a phone the next
 * question would otherwise appear below the fold, and nothing would say it
 * had. Scrolling only "into view" left fields and Next half off screen.
 *
 * `answered` is false while the form first mounts, so opening the form on
 * its preselected tops does not scroll anywhere.
 */
function Step({
  answered,
  quiet,
  className = "",
  children,
}: {
  answered: React.RefObject<boolean>;
  /** Set by the group bar: what it reveals appears in place, unscrolled. */
  quiet: React.RefObject<boolean>;
  className?: string;
  children: React.ReactNode;
}) {
  // Decided on the first run and kept: development Strict Mode runs this
  // effect twice, and by the second the form has already cleared `quiet`.
  const decided = useRef<boolean | null>(null);
  useEffect(() => {
    decided.current ??= answered.current && !quiet.current;
    if (!decided.current) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // After layout, so the new question's height is counted.
    const frame = requestAnimationFrame(() =>
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: still ? "auto" : "smooth",
      }),
    );
    return () => cancelAnimationFrame(frame);
    // The refs never change, so this runs once, when the step appears.
  }, [answered, quiet]);
  return <div className={`step-in ${className}`}>{children}</div>;
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
  brands,
  footer,
}: {
  draft: GarmentDraft;
  onChange: (next: GarmentDraft) => void;
  /** The closet's brands, offered as the brand is typed. */
  brands: KnownBrand[];
  /** The screen's Next, shown with the last question. */
  footer?: React.ReactNode;
}) {
  // Children's effects run before this one, so every step rendered on the
  // first mount sees false and stays put.
  const answered = useRef(false);
  useEffect(() => {
    answered.current = true;
  }, []);

  // The group bar sits at the top; what it reveals should appear in place
  // under it, not pull the page down past it. Its click raises this, the
  // steps it mounts read it, and it drops once they have.
  const quiet = useRef(false);
  useEffect(() => {
    quiet.current = false;
  }, [draft.group]);

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
              quiet.current = true;
              // Tops open on the first sleeve, so the types are already
              // showing; the other sleeves are one tap away.
              onChange({
                ...draft,
                group,
                topType: group === "top" ? TOP_TYPES[0].silhouette : null,
                category: null,
                colour: "",
                brand: "",
                name: "",
              });
            }}
            className="label tab py-3"
          >
            {GROUP_LABELS[group]}
          </button>
        ))}
      </div>

      {draft.group === "top" ? (
        <Step
          answered={answered}
          quiet={quiet}
          className="mt-6 flex justify-center gap-6"
        >
          {TOP_TYPES.map(({ silhouette, label }) => (
            <button
              key={silhouette}
              type="button"
              aria-pressed={draft.topType === silhouette}
              onClick={() => {
                if (draft.topType === silhouette) return;
                onChange({
                  ...draft,
                  topType: silhouette,
                  category: null,
                  colour: "",
                  brand: "",
                  name: "",
                });
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
          answered={answered}
          quiet={quiet}
          key={`${draft.group}-${draft.topType}`}
          className={`mx-auto mt-8 max-w-3xl ${CATEGORY_GRID}`}
        >
          {offered(draft).map((c) => (
            <CategoryTile
              key={c}
              category={c}
              selected={draft.category === c}
              // A new type is a new garment: colour, brand and name start
              // over rather than carrying across from the last one.
              onSelect={() => {
                if (draft.category === c) return;
                onChange({
                  ...draft,
                  category: c,
                  colour: "",
                  brand: "",
                  name: "",
                });
              }}
            />
          ))}
        </Step>
      ) : null}

      {draft.category ? (
        <Step answered={answered} quiet={quiet} className="mx-auto mt-10 max-w-lg">
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
        <Step answered={answered} quiet={quiet} className="mx-auto mt-10 max-w-lg">
          <div className="grid gap-5 sm:grid-cols-2">
            <BrandField
              value={draft.brand}
              onChange={(brand) => onChange({ ...draft, brand })}
              brands={brands}
              focusOnMount
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
