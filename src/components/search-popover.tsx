"use client";

import { useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react";

import { useSearchQuery } from "@/components/nav-search";

/**
 * The compact header's search: a small white box under the icon, black
 * hairline, floating over the page. Escape, the X, or a click outside
 * closes it; the query itself stays in the URL until cleared.
 */
export function SearchPopover({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { q, push } = useSearchQuery();
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={box}
      role="search"
      className="bg-bg border-fg absolute top-full left-0 z-50 mt-2 flex w-72 max-w-[calc(100vw-2*var(--gutter))] items-center gap-3 border px-3 py-2.5"
    >
      <input
        ref={input}
        type="text"
        value={q}
        placeholder="SEARCH"
        aria-label="Search the closet"
        onChange={(e) => push(e.target.value)}
        className="label placeholder:text-fg3 min-w-0 flex-1 bg-transparent py-0 outline-none"
      />
      <button
        type="button"
        className="link-text inline-flex cursor-pointer items-center"
        aria-label={q ? "Clear search" : "Close search"}
        onClick={() => {
          if (q) push("");
          onClose();
        }}
      >
        <X size={12} weight="bold" aria-hidden />
      </button>
    </div>
  );
}
