CREATE TYPE "public"."detail_kind" AS ENUM('label', 'fabric', 'print', 'hardware', 'other');--> statement-breakpoint
ALTER TABLE "photo" DROP CONSTRAINT "photo_garment_view";--> statement-breakpoint
ALTER TABLE "photo" ALTER COLUMN "homography" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "photo" ADD COLUMN "detail_kind" "detail_kind";--> statement-breakpoint
ALTER TABLE "photo" ADD COLUMN "cutout_provider" text;--> statement-breakpoint
CREATE UNIQUE INDEX "photo_garment_view" ON "photo" USING btree ("garment_id","view") WHERE "photo"."view" <> 'detail';--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_measurable_view" CHECK ("photo"."view" = 'detail' OR "photo"."homography" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_detail_kind" CHECK (("photo"."view" = 'detail') = ("photo"."detail_kind" IS NOT NULL));