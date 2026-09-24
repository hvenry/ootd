-- Sweatshirt becomes hoodie, beside crewneck. A rename in place keeps every
-- row and the enum's order, which the schema snapshot already matches.
ALTER TYPE "public"."category" RENAME VALUE 'sweatshirt' TO 'hoodie';
