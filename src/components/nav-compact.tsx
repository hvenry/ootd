"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { List, MagnifyingGlass, Plus } from "@phosphor-icons/react";

import { BRAND } from "@/config/brand";
import { NavLink } from "@/components/nav-link";
import { SearchPopover } from "@/components/search-popover";
import { Sheet } from "@/components/sheet";
import { StatusCount, StatusLink } from "@/components/status-link";

/**
 * The header below `lg`: menu and search icons left, wordmark centred, Add
 * right. Icons here are the one place the "spell it out" rule bends, and only
 * because the sheet they open spells everything out.
 */
export function NavCompact() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const close = useCallback(() => setOpen(false), []);
  const closeSearch = useCallback(() => setSearch(false), []);

  return (
    <>
      <div className="grid w-full grid-cols-3 items-center">
        <div className="flex items-center gap-5">
          <button
            type="button"
            className="link-text inline-flex cursor-pointer items-center"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <List size={20} weight="regular" aria-hidden />
          </button>
          {/* The popover is positioned against this wrapper, so it hangs
              directly under the icon. */}
          <div className="relative flex items-center">
            <button
              type="button"
              className={`inline-flex cursor-pointer items-center ${search ? "text-fg" : "link-text"}`}
              aria-label="Search"
              aria-expanded={search}
              onClick={() => {
                // Search is a closet thing: opening it from anywhere else
                // brings the closet up behind the box.
                if (pathname !== "/") router.push("/");
                setSearch((v) => !v);
              }}
            >
              <MagnifyingGlass size={18} weight="regular" aria-hidden />
            </button>
            <Suspense>
              <SearchPopover open={search} onClose={closeSearch} />
            </Suspense>
          </div>
        </div>

        <Link href="/" className="wordmark text-center">
          {BRAND}
        </Link>

        <div className="flex items-center justify-end gap-4">
          <StatusCount />
          <Link
            href="/capture"
            className="link-text inline-flex cursor-pointer items-center"
            aria-label="Add a garment"
          >
            <Plus size={18} weight="regular" aria-hidden />
          </Link>
        </div>
      </div>

      {/* Pointer events are off on the header itself, so the sheet asks for
          its own back. */}
      <Sheet
        open={open}
        title="Menu"
        onClose={close}
        closeLabel="Close"
        className="pointer-events-auto"
      >
        {/* Taking a link closes the sheet behind it. */}
        <nav className="flex flex-col gap-7" onClick={close}>
          <NavLink href="/">Closet</NavLink>
          <NavLink
            href="/capture"
            className="nav-icon-link self-start"
            underlineActive={false}
          >
            <Plus size={12} weight="bold" aria-hidden />
            Add
          </NavLink>
          <StatusLink />
          <NavLink href="/measurements">Measurements</NavLink>
          <NavLink href="/sheet">Settings</NavLink>
        </nav>
      </Sheet>
    </>
  );
}
