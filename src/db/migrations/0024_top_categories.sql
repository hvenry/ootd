ALTER TABLE "garment" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
-- Tops lose their sleeve split and fold into broader types; the two vests
-- merge and move to outerwear. Remap before the cast back, which would
-- reject the old values. Every pair shares a measurement template (a short
-- sleeve shirt and a shirt store the same four keys), so nothing is dropped.
-- Layer slots are left alone.
UPDATE "garment" SET "category" = 'tshirt' WHERE "category" = 'short_sleeve_henley';--> statement-breakpoint
UPDATE "garment" SET "category" = 'long_sleeve' WHERE "category" = 'henley';--> statement-breakpoint
UPDATE "garment" SET "category" = 'shirt' WHERE "category" = 'short_sleeve_shirt';--> statement-breakpoint
UPDATE "garment" SET "category" = 'sweater' WHERE "category" IN ('turtleneck', 'cardigan');--> statement-breakpoint
UPDATE "garment" SET "category" = 'sweatshirt' WHERE "category" IN ('crewneck', 'hoodie');--> statement-breakpoint
UPDATE "garment" SET "category" = 'vest' WHERE "category" = 'puffer_vest';--> statement-breakpoint
DROP TYPE "public"."category";--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('tshirt', 'polo', 'long_sleeve', 'shirt', 'sweater', 'sweatshirt', 'tank', 'overshirt', 'fleece', 'jacket', 'denim_jacket', 'leather_jacket', 'blazer', 'vest', 'trousers', 'jeans', 'sweatpants', 'shorts', 'sweat_shorts', 'shoe', 'hat');--> statement-breakpoint
ALTER TABLE "garment" ALTER COLUMN "category" SET DATA TYPE "public"."category" USING "category"::"public"."category";