"use client";

import { useEffect } from "react";

/**
 * The small-screen sheet. It is the whole screen: white, no backdrop, and it
 * slides in from the left edge and back out the same way. It is always
 * mounted and parked off-screen when closed, which is what lets the exit
 * animate; `inert` keeps the parked copy out of the tab order.
 *
 * The menu behind the compact header and the closet's Filter and Sort panels
 * are the same object, so they are the same component.
 */
export function Sheet({
  open,
  title,
  onClose,
  closeLabel = "Cancel",
  footer,
  className = "",
  children,
}: {
  open: boolean;
  /** Centred in the chrome, and the accessible name of the dialog. */
  title: string;
  onClose: () => void;
  /**
   * The word on the way out. Cancel where the sheet holds choices being
   * made; Close where there is nothing to call off, as in the menu.
   */
  closeLabel?: string;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      inert={!open}
      className={`bg-bg fixed inset-0 z-50 flex flex-col px-gutter transition-transform duration-(--sheet-duration) ease-out ${
        open ? "translate-x-0" : "-translate-x-full"
      } ${className}`}
    >
      <div className="grid grid-cols-3 items-center pt-8 pb-6">
        <button
          type="button"
          className="label cursor-pointer text-left"
          onClick={onClose}
        >
          {closeLabel}
        </button>
        <span className="label text-fg3 text-center">{title}</span>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
      {footer ? <div className="pb-gutter pt-4">{footer}</div> : null}
    </div>
  );
}

/** Rows in a sheet: body size, one per line, generous air between them. */
export function SheetList({ children }: { children: React.ReactNode }) {
  return <ul className="flex flex-col gap-7 py-4">{children}</ul>;
}

/** A selected row is marked with a dash in the margin; the space is held
    either way so nothing shifts on selection. */
export function SheetRow({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <li className="flex items-baseline gap-4">
      <span
        aria-hidden
        className={`w-4 shrink-0 ${selected ? "" : "invisible"}`}
      >
        &mdash;
      </span>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onClick}
        className="cursor-pointer text-left text-15 leading-tight"
      >
        {label}
      </button>
    </li>
  );
}
