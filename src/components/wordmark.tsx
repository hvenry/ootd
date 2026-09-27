"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BRAND } from "@/config/brand";

/**
 * Home, and on the closet itself, back to the top of it. Scrolling rather
 * than navigating keeps the filters and search the closet was left with.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  return (
    <Link
      href="/"
      className={`wordmark ${className}`}
      onClick={(e) => {
        if (pathname !== "/") return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        const reduce = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      }}
    >
      {BRAND}
    </Link>
  );
}
