ALTER TABLE "admin_settings" ALTER COLUMN "passcode_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_settings" ADD COLUMN "security_question_1" text;--> statement-breakpoint
ALTER TABLE "admin_settings" ADD COLUMN "security_answer_1_hash" text;--> statement-breakpoint
ALTER TABLE "admin_settings" ADD COLUMN "security_question_2" text;--> statement-breakpoint
ALTER TABLE "admin_settings" ADD COLUMN "security_answer_2_hash" text;