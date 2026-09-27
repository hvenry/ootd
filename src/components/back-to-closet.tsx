"use client";

import { useEffect, useRef, type RefObject } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretLeft } from "@phosphor-icons/react";

import { CLOSET_HREF_KEY, FROM_CLOSET_KEY } from "@/components/closet-browser";

/**
 * Back to the closet as it was left: its filters, sort and search.
 *
 * Arrived straight from a tile, it is the browser's own Back, which also
 * puts the grid back where it was scrolled. Arrived any other way (a shared
 * link, the end of measuring), history holds something else, so it links to
 * the closet's last URL instead.
 */
export function BackToCloset({
  fromCloset,
  className = "",
}: {
  /** From useFromCloset, read once per page for however many links. */
  fromCloset: RefObject<boolean>;
  className?: string;
}) {
  const router = useRouter();

  return (
    <Link
      href="/"
      className={`label link-text inline-flex items-center gap-1.5 ${className}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        if (fromCloset.current) return router.back();
        let href = "/";
        try {
          href = sessionStorage.getItem(CLOSET_HREF_KEY) ?? "/";
        } catch {}
        router.push(href);
      }}
    >
      <CaretLeft size={12} weight="bold" aria-hidden />
      Closet
    </Link>
  );
}

/**
 * Whether this item was opened from a closet tile. Read once and cleared,
 * so a later visit by another route (item → measure → item) does not step
 * back into the measure screen.
 */
export function useFromCloset(garmentId: string) {
  const fromCloset = useRef(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(FROM_CLOSET_KEY) === garmentId) {
        fromCloset.current = true;
        sessionStorage.removeItem(FROM_CLOSET_KEY);
      }
    } catch {}
  }, [garmentId]);
  return fromCloset;
}
