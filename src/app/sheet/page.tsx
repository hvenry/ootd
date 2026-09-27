import { redirect } from "next/navigation";

// The markers moved under the rig in Settings. Old links and bookmarks,
// including a chosen paper or page, still land on them.
export default async function SheetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
  }
  const qs = query.toString();
  redirect(`/settings${qs ? `?${qs}` : ""}#markers`);
}
