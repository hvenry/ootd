"use client";

import Link from "next/link";

import {
  isActive,
  jobTitle,
  ProgressBar,
  useActivity,
  useJobProgress,
  type ActivityJob,
} from "@/components/activity";
import { SectionHead } from "@/components/section-head";
import { CUTOUT_PROVIDER_LABELS } from "@/lib/providers/cutout";

const providerLabel = (name: string) =>
  CUTOUT_PROVIDER_LABELS[name as keyof typeof CUTOUT_PROVIDER_LABELS] ?? name;

/**
 * What the background is doing. The worker first, because when it is down
 * nothing below moves and every job just reads "queued"; then what is in
 * flight, with an estimate of how far along; then the last day's results.
 */
export function StatusScreen() {
  const { snapshot } = useActivity();

  if (!snapshot) {
    return <p className="data text-fg3 mx-auto max-w-3xl">Loading…</p>;
  }

  const active = snapshot.jobs.filter(isActive);
  const recent = snapshot.jobs.filter((j) => !isActive(j));
  const worker = snapshot.worker;

  return (
    <div className="mx-auto max-w-3xl">
      <SectionHead bleed aside={worker ? "Online" : "Unreachable"}>
        Worker
      </SectionHead>
      {worker ? (
        <p className="data text-fg2">
          Default {providerLabel(worker.provider ?? "")} · {worker.processed ?? 0}{" "}
          done · {worker.failed ?? 0} failed since start
        </p>
      ) : (
        <p className="text-fg text-12">
          The worker is not answering. Nothing below will move until it is
          back: <span className="data">docker compose up -d worker</span>.
        </p>
      )}

      <div className="mt-10">
        <SectionHead aside={active.length || "—"}>Processing</SectionHead>
        {active.length === 0 ? (
          <p className="text-fg3 text-12">Nothing in flight.</p>
        ) : (
          <ul>
            {active.map((j) => (
              <ActiveRow key={j.id} job={j} />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-10">
        <SectionHead aside="Last 24 hours">Recent</SectionHead>
        {recent.length === 0 ? (
          <p className="text-fg3 text-12">Nothing yet.</p>
        ) : (
          <ul>
            {recent.map((j) => (
              <li
                key={j.id}
                className="border-rule flex items-baseline justify-between gap-4 border-b py-2 text-12"
              >
                <div className="min-w-0">
                  <Title job={j} />
                  {j.error ? (
                    <p className="text-fg mt-0.5 break-words">{j.error}</p>
                  ) : null}
                </div>
                <span className="data text-fg3 shrink-0 text-right">
                  {j.status === "done" ? "Done" : "Failed"} ·{" "}
                  {providerLabel(j.provider)}
                  {j.seconds != null ? ` · ${j.seconds.toFixed(1)}s` : ""}
                  <br />
                  {ago(j.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Title({ job }: { job: ActivityJob }) {
  const text = jobTitle(job);
  return job.garment ? (
    <Link href={`/item/${job.garment.id}`} className="link-text">
      {text}
    </Link>
  ) : (
    <span className="text-fg3">{text}</span>
  );
}

function ActiveRow({ job }: { job: ActivityJob }) {
  const progress = useJobProgress(job);
  return (
    <li className="border-rule border-b py-3 text-12">
      <div className="flex items-baseline justify-between gap-4">
        <Title job={job} />
        <span className="data text-fg3 shrink-0">
          {providerLabel(job.provider)} ·{" "}
          {job.status === "pending"
            ? "queued"
            : progress?.expected
              ? `${progress.elapsed}s of ~${Math.round(progress.expected)}s`
              : `${progress?.elapsed ?? 0}s`}
        </span>
      </div>
      <div className="mt-2">
        <ProgressBar fraction={progress?.fraction ?? 0} />
      </div>
    </li>
  );
}

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
