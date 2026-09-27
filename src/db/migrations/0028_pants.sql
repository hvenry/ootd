-- Trousers becomes pants. A rename in place keeps every row and the enum's
-- order, where drop and recreate would need a remap.
ALTER TYPE "public"."category" RENAME VALUE 'trousers' TO 'pants';
