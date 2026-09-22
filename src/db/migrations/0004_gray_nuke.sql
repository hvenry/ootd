ALTER TABLE "garment" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
-- `tee` and `tshirt` were the same garment under two names. Remapped here
-- rather than dropped, so the cast below cannot fail on real data.
UPDATE "garment" SET "category" = 'tshirt' WHERE "category" = 'tee';--> statement-breakpoint
DROP TYPE "public"."category";--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('tshirt', 'polo', 'henley', 'long_sleeve', 'shirt', 'short_sleeve_shirt', 'knit', 'sweater', 'jacket', 'coat', 'trousers', 'jeans', 'shorts', 'shoe', 'hat');--> statement-breakpoint
ALTER TABLE "garment" ALTER COLUMN "category" SET DATA TYPE "public"."category" USING "category"::"public"."category";