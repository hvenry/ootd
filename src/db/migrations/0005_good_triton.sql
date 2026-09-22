ALTER TABLE "garment" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
-- Anything already measured was finished under the old rules, so it keeps its
-- place in the closet. Dated from the measurement itself rather than now(),
-- so the column means the same thing for old rows as for new ones.
UPDATE "garment" g
SET "completed_at" = m.last_measured
FROM (
  SELECT "garment_id", max("measured_at") AS last_measured
  FROM "measurement"
  GROUP BY "garment_id"
) m
WHERE m."garment_id" = g."id";
