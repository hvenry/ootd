"use client";

import { useState, useTransition } from "react";

import { saveRig, type RigInput } from "@/app/actions";
import { useActivity } from "@/components/activity";
import {
  quadCheckMm,
  RIG_TOLERANCE_MM,
  solveQuadMm,
  type Rig,
} from "@/lib/homography/sheet";

type Key = keyof RigInput;

const FIELDS: { key: Key; label: string; hint: string; optional?: boolean }[] = [
  { key: "topMm", label: "Top", hint: "ID 0 → 1" },
  { key: "bottomMm", label: "Bottom", hint: "ID 3 → 2" },
  { key: "leftMm", label: "Left", hint: "ID 0 → 3" },
  { key: "rightMm", label: "Right", hint: "ID 1 → 2" },
  { key: "diagMm", label: "Diagonal", hint: "ID 0 → 2, fixes the shape" },
  {
    key: "diag2Mm",
    label: "Second diagonal",
    hint: "ID 1 → 3, optional check",
    optional: true,
  },
  {
    key: "blackSquareMm",
    label: "Black square",
    hint: "Meant to be 88. Blank if it is",
    optional: true,
  },
];

type Values = Record<Key, string>;

function valuesFrom(rig: Rig): Values {
  const mm = (n: number | null | undefined) =>
    n === null || n === undefined ? "" : String(Math.round(n));
  return {
    topMm: mm(rig.quad.top),
    rightMm: mm(rig.quad.right),
    bottomMm: mm(rig.quad.bottom),
    leftMm: mm(rig.quad.left),
    diagMm: mm(rig.quad.diag),
    diag2Mm: mm(rig.quad.diag2),
    blackSquareMm: mm(rig.blackSquareMm),
  };
}

/** The form's strings as the numbers the action takes, or null if unusable. */
function parse(values: Values): RigInput | null {
  const out: Partial<Record<Key, number | null>> = {};
  for (const field of FIELDS) {
    const raw = values[field.key].trim();
    if (raw === "") {
      if (!field.optional) return null;
      out[field.key] = null;
      continue;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    out[field.key] = n;
  }
  return out as RigInput;
}

/** What the live check says about the numbers as typed. */
function describe(input: RigInput | null): { tone: "quiet" | "loud"; text: string } {
  if (!input) return { tone: "quiet", text: "Fill in the five spans." };
  const quad = {
    top: input.topMm,
    right: input.rightMm,
    bottom: input.bottomMm,
    left: input.leftMm,
    diag: input.diagMm,
    diag2: input.diag2Mm ?? undefined,
  };
  try {
    solveQuadMm(quad);
  } catch {
    return {
      tone: "loud",
      text: "These five distances cannot form a shape. Re-check the tape.",
    };
  }
  const residual = quadCheckMm(quad);
  if (residual === null) {
    return {
      tone: "quiet",
      text: "Add the second diagonal to check the other five.",
    };
  }
  return residual > RIG_TOLERANCE_MM
    ? {
        tone: "loud",
        text: `The diagonals disagree by ${residual.toFixed(1)} mm. One of the six numbers is wrong.`,
      }
    : {
        tone: "quiet",
        text: `The diagonals agree to ${residual.toFixed(1)} mm.`,
      };
}

/**
 * The rig's measured spans, edited in place.
 *
 * The same geometry capture solves with checks the numbers as they are
 * typed, so a slip of the tape shows here rather than as every garment
 * shot afterwards measuring a few millimetres out.
 */
export function RigForm({
  rig,
  saved,
}: {
  rig: Rig;
  /** False while the numbers still come from the environment. */
  saved: boolean;
}) {
  const { toast } = useActivity();
  const [baseline, setBaseline] = useState(() => valuesFrom(rig));
  const [values, setValues] = useState(baseline);
  const [isSaved, setIsSaved] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const input = parse(values);
  const dirty = FIELDS.some((f) => values[f.key].trim() !== baseline[f.key]);

  const check = describe(input);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!input) return;
    setError(null);
    startTransition(async () => {
      const result = await saveRig(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const rounded = Object.fromEntries(
        FIELDS.map((f) => {
          const v = input[f.key];
          return [f.key, v === null ? "" : String(Math.round(v))];
        }),
      ) as Values;
      setBaseline(rounded);
      setValues(rounded);
      setIsSaved(true);
      toast({ message: "Rig updated", detail: "Photos taken from now on use it" });
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg">
      <div className="grid grid-cols-2 gap-x-8 gap-y-6">
        {FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="label text-fg2">{field.label}</span>
            <span className="text-fg3 block text-11">{field.hint}</span>
            <span className="mt-1 flex items-baseline gap-2 border-b border-rule focus-within:border-fg">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={values[field.key]}
                placeholder={field.optional ? "—" : ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [field.key]: e.target.value }))
                }
                className="data text-fg placeholder:text-fg3 w-full bg-transparent py-1 text-15 outline-none"
              />
              <span className="data text-fg3">mm</span>
            </span>
          </label>
        ))}
      </div>

      <p
        className={`mt-6 text-12 ${check.tone === "loud" ? "text-fg" : "text-fg3"}`}
        aria-live="polite"
      >
        {check.text}
      </p>
      {error ? (
        <p className="text-fg mt-2 text-12" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-baseline gap-x-6 gap-y-3">
        <button
          type="submit"
          className="btn-primary px-12 py-4"
          disabled={!input || !dirty || pending}
        >
          {pending ? "Saving" : "Update rig"}
        </button>
        <span className="text-fg3 text-12">
          {isSaved
            ? "Applies to photos taken from now on. Existing measurements stay as they are."
            : "From the environment until you save."}
        </span>
      </div>
    </form>
  );
}
