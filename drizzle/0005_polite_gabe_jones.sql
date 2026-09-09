CREATE TABLE "admin_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"passcode_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_audio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module" "module_type" NOT NULL,
	"mime" text NOT NULL,
	"data" text NOT NULL
);
