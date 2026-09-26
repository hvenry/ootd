"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { X } from "@phosphor-icons/react";

/* ------------------------------------------------------------------ jobs */

export type ActivityJob = {
  id: string;
  kind: string;
  status: "pending" | "running" | "done" | "failed";
  provider: string;
  photoId: string | null;
  view: string | null;
  garment: {
    id: string;
    shortId: number;
    brand: string | null;
    name: string | null;
  } | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  elapsed: number;
  seconds: number | null;
  cutoutPath: string | null;
  error: string | null;
};

export type WorkerHealth = {
  ok: boolean;
  provider?: string;
  processed?: number;
  failed?: number;
  last_error?: string | null;
} | null;

type Snapshot = {
  jobs: ActivityJob[];
  /** Mean seconds per provider over recent done jobs. */
  expected: Record<string, number>;
  worker: WorkerHealth;
  /** When this snapshot arrived, for ticking `elapsed` between polls. */
  at: number;
};

/* ---------------------------------------------------------------- toasts */

export type Toast = {
  id: number;
  message: string;
  /** A second line, quieter. */
  detail?: string;
  href?: string;
  /** Errors stay longer and read in full-strength text. */
  tone?: "info" | "error";
};

type ToastInput = Omit<Toast, "id">;

type Activity = {
  snapshot: Snapshot | null;
  /** Poll now, and quickly for a while: something was just queued. */
  refresh: () => void;
  toast: (t: ToastInput) => void;
};

const ActivityContext = createContext<Activity | null>(null);

export function useActivity(): Activity {
  const value = useContext(ActivityContext);
  if (!value) throw new Error("useActivity outside ActivityProvider");
  return value;
}

export const isActive = (j: ActivityJob) =>
  j.status === "pending" || j.status === "running";

/** Quick while something is in flight, slow otherwise, never while hidden. */
const FAST_MS = 2000;
const SLOW_MS = 15000;
const TOAST_MS = 4000;
const TOAST_ERROR_MS = 8000;

export function jobTitle(j: ActivityJob): string {
  const g = j.garment;
  const who = g
    ? `${String(g.shortId).padStart(3, "0")} ${[g.brand, g.name].filter(Boolean).join(" ")}`
    : "Deleted garment";
  return j.view ? `${who} · ${j.view}` : who;
}

/**
 * Everything the app is doing in the background, and the toasts that say
 * so. One poll behind every page, so a cutout that lands while you are on
 * another screen still announces itself, and the status page, the header
 * count and each re-cut's progress all read the same numbers.
 */
export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextToast = useRef(1);
  /** Last status seen per job; a toast is a change, not a state. */
  const seen = useRef<Map<string, ActivityJob["status"]> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hurryUntil = useRef(0);
  // The next tick calls through this, since a callback cannot name itself.
  const pollRef = useRef<() => void>(() => {});

  const toast = useCallback((t: ToastInput) => {
    const id = nextToast.current++;
    setToasts((current) => [...current.slice(-3), { ...t, id }]);
    setTimeout(
      () => setToasts((current) => current.filter((x) => x.id !== id)),
      t.tone === "error" ? TOAST_ERROR_MS : TOAST_MS,
    );
  }, []);

  const poll = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    let active = false;
    try {
      const response = await fetch("/api/jobs", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as Omit<Snapshot, "at">;
        active = data.jobs.some(isActive);

        // The first answer is the baseline: a page load is not news.
        const previous = seen.current;
        if (previous) {
          for (const j of data.jobs) {
            const before = previous.get(j.id);
            if (j.kind !== "cutout") continue;
            if (before && before !== "done" && j.status === "done") {
              toast({ message: "Cutout ready", detail: jobTitle(j), href: itemHref(j) });
            } else if (before && before !== "failed" && j.status === "failed") {
              toast({
                message: "Cutout failed",
                detail: `${jobTitle(j)}: ${j.error}`,
                href: "/status",
                tone: "error",
              });
            }
          }
        }
        seen.current = new Map(data.jobs.map((j) => [j.id, j.status]));
        setSnapshot({ ...data, at: Date.now() });
      }
    } catch {
      // Offline or restarting; the next tick tries again.
    }
    const quick = active || Date.now() < hurryUntil.current;
    timer.current = setTimeout(() => {
      if (document.visibilityState === "visible") pollRef.current();
    }, quick ? FAST_MS : SLOW_MS);
  }, [toast]);

  useEffect(() => {
    pollRef.current = () => void poll();
  }, [poll]);

  const refresh = useCallback(() => {
    // A job queued a moment ago may not be visible yet; keep looking
    // quickly for a little while rather than waiting out the slow tick.
    hurryUntil.current = Date.now() + 10000;
    void poll();
  }, [poll]);

  // Subscribes to the queue: the first poll on the next tick, then each
  // poll schedules the one after it, and a tab coming back into view polls
  // at once rather than waiting out a tick it slept through.
  useEffect(() => {
    const first = setTimeout(() => pollRef.current(), 0);
    const onVisible = () => {
      if (document.visibilityState === "visible") pollRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const value = useMemo(
    () => ({ snapshot, refresh, toast }),
    [snapshot, refresh, toast],
  );

  return (
    <ActivityContext.Provider value={value}>
      {children}
      <Toaster
        toasts={toasts}
        onDismiss={(id) =>
          setToasts((current) => current.filter((x) => x.id !== id))
        }
      />
    </ActivityContext.Provider>
  );
}

function itemHref(j: ActivityJob): string | undefined {
  return j.garment ? `/item/${j.garment.id}` : undefined;
}

/**
 * Top right, under the header, newest at the bottom. Hairline box on the
 * ground, no shadow, no fill: the design system's one boxed shape.
 */
function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-[calc(var(--header-h)+0.5rem)] right-(--gutter) z-60 flex w-[min(20rem,calc(100vw-2*var(--gutter)))] flex-col gap-2"
    >
      {toasts.map((t) => {
        const body = (
          <>
            <p className="label">{t.message}</p>
            {t.detail ? (
              <p
                className={`mt-0.5 text-12 ${t.tone === "error" ? "text-fg" : "text-fg2"}`}
              >
                {t.detail}
              </p>
            ) : null}
          </>
        );
        return (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className="toast bg-bg border-fg pointer-events-auto flex items-start gap-3 border px-3 py-2.5"
          >
            {t.href ? (
              <Link href={t.href} className="min-w-0 flex-1" onClick={() => onDismiss(t.id)}>
                {body}
              </Link>
            ) : (
              <div className="min-w-0 flex-1">{body}</div>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              className="link-text mt-0.5 inline-flex cursor-pointer"
              onClick={() => onDismiss(t.id)}
            >
              <X size={12} weight="bold" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- progress */

/**
 * How far along a job probably is. The worker reports nothing mid-job, so
 * this is time against how long the same provider has taken lately: honest
 * about being an estimate, and it stops short of the end rather than
 * claiming a finish it cannot see.
 */
export function useJobProgress(j: ActivityJob | null | undefined) {
  const { snapshot } = useActivity();
  const [now, setNow] = useState(() => Date.now());
  const running = j?.status === "running";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [running]);

  if (!j || !snapshot) return null;
  const elapsed = j.elapsed + (running ? (now - snapshot.at) / 1000 : 0);
  const expected = snapshot.expected[j.provider] ?? null;
  const fraction =
    running && expected ? Math.min(0.95, elapsed / expected) : running ? null : 0;
  return { elapsed: Math.round(elapsed), expected, fraction };
}

export function ProgressBar({ fraction }: { fraction: number | null }) {
  return (
    <div
      className="bg-rule relative h-0.5 w-full overflow-hidden"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={fraction === null ? undefined : Math.round(fraction * 100)}
    >
      <div
        className="bg-fg absolute inset-y-0 left-0 transition-[width] duration-500 ease-out"
        style={{ width: `${Math.round((fraction ?? 0.05) * 100)}%` }}
      />
    </div>
  );
}
