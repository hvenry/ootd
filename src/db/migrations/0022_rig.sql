CREATE TABLE "rig" (
	"owner_id" uuid PRIMARY KEY NOT NULL,
	"top_mm" integer NOT NULL,
	"right_mm" integer NOT NULL,
	"bottom_mm" integer NOT NULL,
	"left_mm" integer NOT NULL,
	"diag_mm" integer NOT NULL,
	"diag2_mm" integer,
	"black_square_mm" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rig_spans_positive" CHECK ("rig"."top_mm" > 0 AND "rig"."right_mm" > 0 AND "rig"."bottom_mm" > 0 AND "rig"."left_mm" > 0 AND "rig"."diag_mm" > 0)
);
