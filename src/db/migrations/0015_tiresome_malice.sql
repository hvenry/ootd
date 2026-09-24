ALTER TABLE "garment" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
-- Long sleeve polo dropped; a long-sleeve top measures the same whatever
-- its name, so these become long-sleeve tees. Remap before the cast back.
UPDATE "garment" SET "category" = 'long_sleeve' WHERE "category" = 'long_sleeve_polo';--> statement-breakpoint
DROP TYPE "public"."category";--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('tshirt', 'polo', 'henley', 'short_sleeve_henley', 'long_sleeve', 'shirt', 'short_sleeve_shirt', 'overshirt', 'turtleneck', 'sweater', 'crewneck', 'sweatshirt', 'fleece', 'cardigan', 'tank', 'shell', 'chore_jacket', 'blazer', 'coat', 'parka', 'vest', 'trousers', 'chinos', 'jeans', 'sweatpants', 'shorts', 'sweat_shorts', 'shoe', 'hat');--> statement-breakpoint
ALTER TABLE "garment" ALTER COLUMN "category" SET DATA TYPE "public"."category" USING "category"::"public"."category";