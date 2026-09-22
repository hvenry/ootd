"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "@phosphor-icons/react";

/**
 * The query lives in ?q= so the closet grid reads it from the URL and the
 * address stays shareable. Searching from another page carries you back to
 * the closet. Shared by the desktop link-to-input and the compact popover.
 */
export function useSearchQuery() {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const push = useCallback(
    (value: string) => {
      const next = new URLSearchParams(params);
      if (value) next.set("q", value);
      else next.delete("q");
      const qs = next.toString();
      router.replace(`/${qs ? `?${qs}` : ""}`);
    },
    [params, router],
  );
  return { q, push };
}

export function NavSearch() {
  const pathname = usePathname();
  const router = useRouter();
  const { q, push } = useSearchQuery();
  const [open, setOpen] = useState(q.length > 0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    if (q) push("");
  };

  if (!open) {
    return (
      <button
        type="button"
        className="label tab"
        aria-pressed={pathname === "/" && q.length > 0}
        onClick={() => {
          if (pathname !== "/") router.push("/");
          setOpen(true);
        }}
      >
        Search
      </button>
    );
  }

  return (
    <span className="inline-flex items-baseline gap-2">
      <input
        ref={input}
        type="text"
        value={q}
        placeholder="SEARCH"
        aria-label="Search the closet"
        onChange={(e) => push(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
        onBlur={() => {
          if (!q) setOpen(false);
        }}
        className="label border-fg placeholder:text-fg3 w-32 border-b bg-transparent py-0 outline-none md:w-44"
      />
      <button
        type="button"
        className="link-text inline-flex items-center self-center"
        aria-label="Clear search"
        onClick={close}
      >
        <X size={12} weight="bold" aria-hidden />
      </button>
    </span>
  );
}
