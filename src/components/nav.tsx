import Link from "next/link";

import { Plus } from "@phosphor-icons/react/dist/ssr";

import { BRAND } from "@/config/brand";
import { NavCompact } from "@/components/nav-compact";
import { NavLink } from "@/components/nav-link";
import { NavSearch } from "@/components/nav-search";
import { StatusLink } from "@/components/status-link";
import { Suspense } from "react";

// Nav items spell out their destination. No icon-only navigation anywhere.
const LINKS = [{ href: "/", text: "Closet" }];

/**
 * Fixed with no backdrop: the header is text laid over whatever scrolls
 * beneath it, not a bar. Fixed rather than sticky so that overscroll bounce
 * at the top of the page moves the content and not the header. Its height is
 * --header-h; main pads by the same token so nothing starts under it.
 * Pointer events pass through the empty parts so the grid under the header's
 * box stays clickable; only the words catch a click.
 *
 * Three columns with the wordmark centred. The side columns are given equal
 * flex-basis rather than being laid out by content, so the wordmark sits on
 * the true centre of the page and does not drift when a link is added.
 * Below lg the row is icons; see NavCompact.
 */
export function Nav() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 px-gutter pt-3 max-lg:bg-bg max-lg:pb-2.5 max-lg:pointer-events-auto [&_a,&_button,&_input]:pointer-events-auto">
      {/* Below lg: icons and a menu sheet. */}
      <div className="lg:hidden">
        <NavCompact />
      </div>

      <div className="hidden lg:flex lg:items-center lg:justify-between lg:gap-4">
        <nav className="flex flex-1 justify-start gap-6">
          {LINKS.map((link) => (
            <NavLink key={link.href} href={link.href}>
              {link.text}
            </NavLink>
          ))}
          <NavLink
            href="/capture"
            className="nav-icon-link"
            underlineActive={false}
          >
            <Plus size={12} weight="bold" aria-hidden />
            Add
          </NavLink>
          {/* useSearchParams needs a boundary so the static shell still renders. */}
          <Suspense fallback={<span className="label link-text">Search</span>}>
            <NavSearch />
          </Suspense>
        </nav>

        <Link href="/" className="wordmark shrink-0">
          {BRAND}
        </Link>

        <div className="flex flex-1 items-center justify-end gap-6">
          <StatusLink />
          <NavLink href="/measurements">Measurements</NavLink>
          {/* Settings: today that is the calibration sheet, so it still routes there. */}
          <NavLink href="/sheet">Settings</NavLink>
        </div>
      </div>
    </header>
  );
}
