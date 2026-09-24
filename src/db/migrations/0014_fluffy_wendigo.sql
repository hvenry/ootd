-- Jacket becomes shell. A rename in place keeps every row and the enum's
-- order, which the schema snapshot already matches.
ALTER TYPE "public"."category" RENAME VALUE 'jacket' TO 'shell';--> statement-breakpoint
-- Shells default to the shell layer; bring any renamed rows with them.
UPDATE "garment" SET "layer_slot" = 'shell' WHERE "category" = 'shell' AND "layer_slot" = 'outer';
