"use client";

import Link from "next/link";

import { isActive, useActivity } from "@/components/activity";
import { NavLink } from "@/components/nav-link";

function useCounts() {
  const { snapshot } = useActivity();
  const jobs = snapshot?.jobs ?? [];
  return {
    active: jobs.filter(isActive).length,
    // Only failures nobody has retried: the latest job per photo.
    failed: latestPerPhoto(jobs).filter((j) => j.status === "failed").length,
    workerDown: snapshot !== null && snapshot.worker === null,
  };
}

function latestPerPhoto<T extends { photoId: string | null; createdAt: string }>(
  jobs: T[],
): T[] {
  const latest = new Map<string, T>();
  for (const j of jobs) {
    const key = j.photoId ?? j.createdAt;
    const held = latest.get(key);
    if (!held || held.createdAt < j.createdAt) latest.set(key, j);
  }
  return [...latest.values()];
}

/** "Status", with how much is in flight beside it while anything is. */
export function StatusLink() {
  const { active, failed, workerDown } = useCounts();
  return (
    <NavLink href="/status">
      Status
      {active > 0 ? <span className="data ml-1.5">{active}</span> : null}
      {active === 0 && (failed > 0 || workerDown) ? (
        <span className="data ml-1.5">!</span>
      ) : null}
    </NavLink>
  );
}

/**
 * The compact header's version: nothing at all while idle, a count while
 * something is processing. Spelled with its meaning for a screen reader,
 * since a bare number beside the Add icon says nothing on its own.
 */
export function StatusCount() {
  const { active } = useCounts();
  if (active === 0) return null;
  return (
    <Link
      href="/status"
      className="data link-text"
      aria-label={`${active} processing. Status.`}
    >
      {active} processing
    </Link>
  );
}

export { latestPerPhoto };
