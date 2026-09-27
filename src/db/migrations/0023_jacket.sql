ALTER TABLE "garment" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
-- Shell becomes jacket, and chore jackets, coats and parkas fold into it.
-- Remap before the cast back, which would reject the old values. Layer
-- slots are left alone: a windbreaker keeps shell, a chore jacket outer.
UPDATE "garment" SET "category" = 'jacket' WHERE "category" IN ('shell', 'chore_jacket', 'coat', 'parka');--> statement-breakpoint
DROP TYPE "public"."category";--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('tshirt', 'polo', 'henley', 'short_sleeve_henley', 'long_sleeve', 'shirt', 'short_sleeve_shirt', 'overshirt', 'turtleneck', 'sweater', 'crewneck', 'hoodie', 'fleece', 'cardigan', 'tank', 'jacket', 'denim_jacket', 'leather_jacket', 'blazer', 'puffer_vest', 'vest', 'trousers', 'jeans', 'sweatpants', 'shorts', 'sweat_shorts', 'shoe', 'hat');--> statement-breakpoint
ALTER TABLE "garment" ALTER COLUMN "category" SET DATA TYPE "public"."category" USING "category"::"public"."category";