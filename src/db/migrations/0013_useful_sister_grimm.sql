ALTER TABLE "garment" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
-- Knit folded into sweater. Remap before the cast back, which would reject it.
UPDATE "garment" SET "category" = 'sweater' WHERE "category" = 'knit';--> statement-breakpoint
DROP TYPE "public"."category";--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('tshirt', 'polo', 'long_sleeve_polo', 'henley', 'short_sleeve_henley', 'long_sleeve', 'shirt', 'short_sleeve_shirt', 'overshirt', 'turtleneck', 'sweater', 'crewneck', 'sweatshirt', 'fleece', 'cardigan', 'tank', 'jacket', 'chore_jacket', 'blazer', 'coat', 'parka', 'vest', 'trousers', 'chinos', 'jeans', 'sweatpants', 'shorts', 'sweat_shorts', 'shoe', 'hat');--> statement-breakpoint
ALTER TABLE "garment" ALTER COLUMN "category" SET DATA TYPE "public"."category" USING "category"::"public"."category";