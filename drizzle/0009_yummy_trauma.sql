CREATE TABLE "drive_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"drive_file_id" text NOT NULL,
	"drive_url" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drive_files_drive_file_id_unique" UNIQUE("drive_file_id")
);
--> statement-breakpoint
ALTER TABLE "drive_files" ADD CONSTRAINT "drive_files_uploaded_by_app_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;