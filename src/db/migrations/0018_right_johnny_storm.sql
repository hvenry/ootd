ALTER TABLE "garment" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
-- Chinos folded into trousers, which share their slant pockets. Remap
-- before the cast back, which would reject the old value.
UPDATE "garment" SET "category" = 'trousers' WHERE "category" = 'chinos';--> statement-breakpoint
DROP TYPE "public"."category";--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('tshirt', 'polo', 'henley', 'short_sleeve_henley', 'long_sleeve', 'shirt', 'short_sleeve_shirt', 'overshirt', 'turtleneck', 'sweater', 'crewneck', 'hoodie', 'fleece', 'cardigan', 'tank', 'shell', 'chore_jacket', 'denim_jacket', 'leather_jacket', 'blazer', 'coat', 'parka', 'puffer_vest', 'vest', 'trousers', 'jeans', 'sweatpants', 'shorts', 'sweat_shorts', 'shoe', 'hat');--> statement-breakpoint
ALTER TABLE "garment" ALTER COLUMN "category" SET DATA TYPE "public"."category" USING "category"::"public"."category";