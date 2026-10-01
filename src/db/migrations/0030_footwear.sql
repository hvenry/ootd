ALTER TYPE "public"."category" ADD VALUE 'boot';--> statement-breakpoint
ALTER TYPE "public"."category" ADD VALUE 'belt';--> statement-breakpoint
ALTER TYPE "public"."layer_slot" ADD VALUE 'accessory';--> statement-breakpoint
ALTER TYPE "public"."photo_view" ADD VALUE 'top';--> statement-breakpoint
ALTER TYPE "public"."photo_view" ADD VALUE 'outer';--> statement-breakpoint
ALTER TYPE "public"."photo_view" ADD VALUE 'inner';--> statement-breakpoint
ALTER TYPE "public"."photo_view" ADD VALUE 'toe';--> statement-breakpoint
ALTER TYPE "public"."photo_view" ADD VALUE 'heel';--> statement-breakpoint
ALTER TABLE "photo" DROP CONSTRAINT "photo_measurable_view";--> statement-breakpoint
ALTER TABLE "rig" ADD COLUMN "a3_black_square_mm" integer;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_measurable_view" CHECK ("photo"."view"::text NOT IN ('front', 'back', 'top') OR "photo"."homography" IS NOT NULL);