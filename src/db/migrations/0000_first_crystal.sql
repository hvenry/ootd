CREATE TYPE "public"."category" AS ENUM('tshirt', 'tee', 'shirt', 'knit', 'sweater', 'jacket', 'coat', 'trousers', 'jeans', 'shorts', 'shoe', 'hat');--> statement-breakpoint
CREATE TYPE "public"."convention" AS ENUM('edge_to_edge', 'seam_to_seam', 'one_inch_below_pit', 'hps_to_hem', 'back_waistband');--> statement-breakpoint
CREATE TYPE "public"."job_kind" AS ENUM('cutout', 'colour_extract', 'render');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."layer_slot" AS ENUM('base', 'mid', 'outer', 'shell', 'bottom', 'footwear', 'headwear');--> statement-breakpoint
CREATE TYPE "public"."measurement_key" AS ENUM('chest', 'shoulder', 'sleeve', 'body_length', 'waist', 'front_rise', 'back_rise', 'thigh', 'knee', 'inseam', 'leg_opening', 'hem', 'bicep', 'cuff', 'collar');--> statement-breakpoint
CREATE TYPE "public"."measurement_source" AS ENUM('measured', 'brand_spec', 'estimated');--> statement-breakpoint
CREATE TYPE "public"."stretch" AS ENUM('none', 'low', 'high');--> statement-breakpoint
CREATE TABLE "garment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"category" "category" NOT NULL,
	"subcategory" text,
	"brand" text,
	"name" text,
	"short_id" integer NOT NULL,
	"photo_id" uuid,
	"cutout_path" text,
	"fabric" text,
	"stretch" "stretch" DEFAULT 'none' NOT NULL,
	"clo" numeric(3, 2),
	"windproof" boolean DEFAULT false NOT NULL,
	"waterproof" boolean DEFAULT false NOT NULL,
	"layer_slot" "layer_slot" NOT NULL,
	"layer_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "garment_owner_short_id" UNIQUE("owner_id","short_id")
);
--> statement-breakpoint
CREATE TABLE "job" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" "job_kind" NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"content_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_kind_content_hash" UNIQUE("kind","content_hash")
);
--> statement-breakpoint
CREATE TABLE "measurement" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"garment_id" uuid NOT NULL,
	"key" "measurement_key" NOT NULL,
	"value_mm" integer NOT NULL,
	"is_doubled" boolean NOT NULL,
	"convention" "convention" NOT NULL,
	"source" "measurement_source" DEFAULT 'measured' NOT NULL,
	"p1_x" integer,
	"p1_y" integer,
	"p2_x" integer,
	"p2_y" integer,
	"measured_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "measurement_garment_key" UNIQUE("garment_id","key")
);
--> statement-breakpoint
CREATE TABLE "photo" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"original_path" text NOT NULL,
	"homography" jsonb NOT NULL,
	"sheet_version" integer DEFAULT 0 NOT NULL,
	"grey_patch_rgb" integer[],
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "garment" ADD CONSTRAINT "garment_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement" ADD CONSTRAINT "measurement_garment_id_garment_id_fk" FOREIGN KEY ("garment_id") REFERENCES "public"."garment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "garment_owner_created" ON "garment" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "job_status_created" ON "job" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "measurement_owner_garment" ON "measurement" USING btree ("owner_id","garment_id");