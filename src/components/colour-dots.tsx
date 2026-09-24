"use client";

import { DECLARED_COLOURS } from "@/lib/colour/declared";

/**
 * The declared colours as a row of dots: a hairline ring, a white gap, the
 * colour inside. The selected ring is full-strength. Names are the value;
 * hex is only what is painted.
 */
export function ColourDots({
  selected,
  onSelect,
  large = false,
  className = "",
}: {
  selected: string | null;
  onSelect: (name: string | null) => void;
  /** The add form's size, where colour is the whole question on screen. */
  large?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap ${large ? "gap-3.5" : "gap-2.5"} ${className}`}
    >
      {DECLARED_COLOURS.map(([name, hex]) => {
        const on = selected === name;
        return (
          <button
            key={name}
            type="button"
            title={name}
            aria-label={name}
            aria-pressed={on}
            onClick={() => onSelect(on ? null : name)}
            className={`colour-dot ${large ? "colour-dot-lg" : ""} ${on ? "border-fg" : "border-rule hover:border-fg3"}`}
          >
            <span aria-hidden style={{ background: hex }} />
          </button>
        );
      })}
    </div>
  );
}
