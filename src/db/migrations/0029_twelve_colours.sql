-- Declared colours cut to twelve plain words. Each retired name folds into
-- the nearest one kept; the photograph's extracted colour is untouched.
UPDATE "garment" SET "declared_colour" = 'Gray' WHERE "declared_colour" IN ('Grey', 'Charcoal');--> statement-breakpoint
UPDATE "garment" SET "declared_colour" = 'Blue' WHERE "declared_colour" IN ('Navy', 'Light blue', 'Teal');--> statement-breakpoint
UPDATE "garment" SET "declared_colour" = 'Green' WHERE "declared_colour" = 'Olive';--> statement-breakpoint
UPDATE "garment" SET "declared_colour" = 'Beige' WHERE "declared_colour" IN ('Cream', 'Tan', 'Khaki');--> statement-breakpoint
UPDATE "garment" SET "declared_colour" = 'Red' WHERE "declared_colour" = 'Burgundy';
