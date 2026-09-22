"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A header link that underlines itself while its page is in view, the same
 * mark a selected filter uses. The header stays a Server Component; only the
 * pathname read lives here.
 */
export function NavLink({
  href,
  className = "",
  underlineActive = true,
  children,
}: {
  href: string;
  className?: string;
  /** Icon-led links show active by ink alone; the underline cannot span an SVG. */
  underlineActive?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  // `.tab` reads aria-current for the selected underline; an icon-led link
  // cannot carry one, so it shows active by ink and its own bottom border.
  let state = "tab";
  if (!underlineActive) state = active ? "text-fg" : "link-text";
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`label ${state} ${className}`}
    >
      {children}
    </Link>
  );
}
