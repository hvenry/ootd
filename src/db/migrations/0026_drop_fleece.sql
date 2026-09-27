ALTER TABLE "garment" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
-- Fleece folds into sweater, which shares its template and its mid layer.
-- Remap before the cast back, which would reject the old value.
UPDATE "garment" SET "category" = 'sweater' WHERE "category" = 'fleece';--> statement-breakpoint
DROP TYPE "public"."category";--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('tshirt', 'polo', 'long_sleeve', 'shirt', 'sweater', 'sweatshirt', 'tank', 'overshirt', 'jacket', 'denim_jacket', 'leather_jacket', 'blazer', 'vest', 'trousers', 'jeans', 'sweatpants', 'shorts', 'shoe', 'hat');--> statement-breakpoint
ALTER TABLE "garment" ALTER COLUMN "category" SET DATA TYPE "public"."category" USING "category"::"public"."category";