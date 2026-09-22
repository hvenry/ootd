CREATE TYPE "public"."photo_view" AS ENUM('front', 'back', 'detail');--> statement-breakpoint
ALTER TABLE "garment" DROP CONSTRAINT "garment_photo_id_photo_id_fk";
--> statement-breakpoint
ALTER TABLE "measurement" ADD COLUMN "photo_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "photo" ADD COLUMN "garment_id" uuid;--> statement-breakpoint
ALTER TABLE "photo" ADD COLUMN "view" "photo_view" DEFAULT 'front' NOT NULL;--> statement-breakpoint
ALTER TABLE "photo" ADD COLUMN "cutout_path" text;--> statement-breakpoint
ALTER TABLE "measurement" ADD CONSTRAINT "measurement_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photo_owner_garment" ON "photo" USING btree ("owner_id","garment_id");--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_garment_view" UNIQUE("garment_id","view");