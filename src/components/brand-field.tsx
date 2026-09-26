"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  matchBrands,
  withStarterBrands,
  type KnownBrand,
} from "@/lib/search/brands";

/**
 * The brand input, with brands offered as you type: the closet's own first,
 * then a starter list of common ones.
 *
 * Free text still wins: a brand on neither list is typed and kept as typed.
 * The list exists so a brand is spelled the same way every time. Arrow keys
 * move through it, Enter takes the highlighted one, Escape closes it; a tap takes one without the field losing focus, so a
 * phone keeps its keyboard up.
 */
export function BrandField({
  value,
  onChange,
  brands,
  focusOnMount = false,
}: {
  value: string;
  onChange: (v: string) => void;
  brands: KnownBrand[];
  /** See the Field in garment-form: the tap that revealed it raises the keyboard. */
  focusOnMount?: boolean;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (focusOnMount) ref.current?.focus({ preventScroll: true });
  }, [focusOnMount]);

  const candidates = useMemo(() => withStarterBrands(brands), [brands]);
  const matches = open ? matchBrands(value, candidates) : [];
  const shown = matches.length > 0;

  function choose(brand: KnownBrand) {
    onChange(brand.name);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!shown) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i <= 0 ? matches.length - 1 : i - 1));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      choose(matches[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <label className="relative block">
      <span className="label text-fg2">Brand</span>
      <input
        ref={ref}
        type="text"
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          shown && active >= 0 ? `${listId}-${active}` : undefined
        }
        autoComplete="off"
        value={value}
        placeholder="Brand"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="border-rule focus:border-fg text-fg placeholder:text-fg3 mt-1 w-full border-b bg-transparent py-1 text-15 outline-none"
      />
      {shown ? (
        <ul
          id={listId}
          role="listbox"
          className="bg-bg border-fg absolute top-full right-0 left-0 z-50 mt-1 border py-1"
        >
          {matches.map((brand, i) => (
            <li
              key={brand.name}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // Pointer-down, not click: a click lands after the input's
              // blur has already closed the list.
              onPointerDown={(e) => {
                e.preventDefault();
                choose(brand);
              }}
              onPointerEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1.5 text-15 ${
                i === active ? "text-fg underline" : "text-fg2"
              }`}
            >
              <span>{brand.name}</span>
              {/* How many are owned; a brand from the starter list has none
                  to count, and a 0 would read as a stock level. */}
              {brand.count > 0 ? (
                <span className="data text-fg3">{brand.count}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </label>
  );
}
