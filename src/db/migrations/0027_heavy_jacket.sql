ALTER TABLE "garment" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
-- Jacket becomes light jacket, beside a new heavy jacket. Every existing
-- jacket starts light; heavy ones are moved by hand. Remap before the cast
-- back, which would reject the old value.
UPDATE "garment" SET "category" = 'light_jacket' WHERE "category" = 'jacket';--> statement-breakpoint
DROP TYPE "public"."category";--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('tshirt', 'polo', 'long_sleeve', 'shirt', 'sweater', 'sweatshirt', 'tank', 'overshirt', 'light_jacket', 'heavy_jacket', 'denim_jacket', 'leather_jacket', 'blazer', 'vest', 'trousers', 'jeans', 'sweatpants', 'shorts', 'shoe', 'hat');--> statement-breakpoint
ALTER TABLE "garment" ALTER COLUMN "category" SET DATA TYPE "public"."category" USING "category"::"public"."category";