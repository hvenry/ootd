-- completed_at used to mean "measurements submitted"; it now means "both
-- faces photographed and added to the closet". Captures that already have
-- both faces are therefore in the closet, waiting to be measured.
UPDATE "garment" g
SET "completed_at" = g."created_at"
WHERE g."completed_at" IS NULL
  AND (
    SELECT count(DISTINCT p."view")
    FROM "photo" p
    WHERE p."garment_id" = g."id" AND p."view" IN ('front', 'back')
  ) = 2;
