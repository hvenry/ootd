"use client";

import { useEffect, useRef } from "react";

/**
 * A centred confirmation. Used for the one irreversible act in the app, so
 * it is deliberately plain: a hairline box on a washed-out page, a sentence,
 * and two words. Escape and the backdrop both mean "keep it"; only the
 * red word does the thing.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus lands on the safe choice.
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="bg-bg/85 fixed inset-0 z-[60] flex items-center justify-center px-gutter"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-bg border-fg w-full max-w-sm border p-6"
      >
        <p id="confirm-title" className="label">
          {title}
        </p>
        <div className="text-fg2 mt-3">{body}</div>
        <div className="mt-8 flex items-center justify-between gap-6">
          <button
            ref={cancelRef}
            type="button"
            className="label link-text"
            onClick={onCancel}
            disabled={pending}
          >
            Keep it
          </button>
          <button
            type="button"
            className="chip chip-danger"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Removing…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
