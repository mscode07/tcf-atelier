CREATE TYPE "public"."attempt_status" AS ENUM('in_progress', 'submitted', 'evaluated', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."auth_provider" AS ENUM('credentials', 'google');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."module_type" AS ENUM('listening', 'reading', 'writing', 'speaking');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'paid', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."proficiency_level" AS ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('multiple_choice', 'short_text', 'essay', 'audio_recording');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('pending', 'active', 'expired', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."test_mode" AS ENUM('exam', 'review');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TABLE "attempt_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option_id" uuid,
	"text_answer" text,
	"recording_url" text,
	"is_correct" boolean,
	"awarded_points" integer DEFAULT 0 NOT NULL,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"evaluator_feedback" text,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"type" "module_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"position" integer NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"exam_type" text DEFAULT 'TCF' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "module_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"tests_started" integer DEFAULT 0 NOT NULL,
	"tests_completed" integer DEFAULT 0 NOT NULL,
	"best_score" integer DEFAULT 0 NOT NULL,
	"average_percentage" integer DEFAULT 0 NOT NULL,
	"estimated_level" "proficiency_level",
	"total_practice_seconds" integer DEFAULT 0 NOT NULL,
	"last_practiced_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subscription_id" uuid,
	"provider" text DEFAULT 'razorpay' NOT NULL,
	"provider_order_id" text,
	"provider_payment_id" text,
	"amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" "payment_status" DEFAULT 'created' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practice_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"test_number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"level" "proficiency_level",
	"duration_seconds" integer,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"content_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration_days" integer NOT NULL,
	"price_minor" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pricing_plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "question_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"label" text NOT NULL,
	"text" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"test_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"mode" "test_mode" DEFAULT 'exam' NOT NULL,
	"status" "attempt_status" DEFAULT 'in_progress' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"max_score" integer DEFAULT 0 NOT NULL,
	"percentage" integer,
	"tcf_score" integer,
	"estimated_level" "proficiency_level",
	"correct_count" integer DEFAULT 0 NOT NULL,
	"incorrect_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"evaluator_feedback" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"evaluated_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"type" "question_type" DEFAULT 'multiple_choice' NOT NULL,
	"level" "proficiency_level",
	"passage" text,
	"prompt" text NOT NULL,
	"explanation" text,
	"audio_url" text,
	"image_url" text,
	"points" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "subscription_status" DEFAULT 'pending' NOT NULL,
	"starts_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_accounts" ALTER COLUMN "provider" SET DATA TYPE "public"."auth_provider" USING "provider"::"public"."auth_provider";--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "preferred_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "target_level" "proficiency_level";--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "target_exam_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "role" "user_role" DEFAULT 'student' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "status" "user_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_attempt_id_test_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."test_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_question_id_test_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."test_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_selected_option_id_question_options_id_fk" FOREIGN KEY ("selected_option_id") REFERENCES "public"."question_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_progress" ADD CONSTRAINT "module_progress_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_progress" ADD CONSTRAINT "module_progress_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_tests" ADD CONSTRAINT "practice_tests_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_test_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."test_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_test_id_practice_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."practice_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_test_id_practice_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."practice_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_pricing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."pricing_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attempt_answers_attempt_question_unique" ON "attempt_answers" USING btree ("attempt_id","question_id");--> statement-breakpoint
CREATE INDEX "attempt_answers_question_index" ON "attempt_answers" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "course_enrollments_user_course_unique" ON "course_enrollments" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE INDEX "course_enrollments_course_status_index" ON "course_enrollments" USING btree ("course_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "course_modules_course_type_unique" ON "course_modules" USING btree ("course_id","type");--> statement-breakpoint
CREATE INDEX "course_modules_course_position_index" ON "course_modules" USING btree ("course_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "module_progress_user_module_unique" ON "module_progress" USING btree ("user_id","module_id");--> statement-breakpoint
CREATE INDEX "module_progress_module_level_index" ON "module_progress" USING btree ("module_id","estimated_level");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_payment_unique" ON "payments" USING btree ("provider","provider_payment_id");--> statement-breakpoint
CREATE INDEX "payments_user_status_index" ON "payments" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "practice_tests_module_number_unique" ON "practice_tests" USING btree ("module_id","test_number");--> statement-breakpoint
CREATE INDEX "practice_tests_module_published_index" ON "practice_tests" USING btree ("module_id","is_published");--> statement-breakpoint
CREATE UNIQUE INDEX "question_options_question_position_unique" ON "question_options" USING btree ("question_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "test_attempts_user_test_number_unique" ON "test_attempts" USING btree ("user_id","test_id","attempt_number");--> statement-breakpoint
CREATE INDEX "test_attempts_user_status_index" ON "test_attempts" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "test_attempts_test_score_index" ON "test_attempts" USING btree ("test_id","score");--> statement-breakpoint
CREATE UNIQUE INDEX "test_questions_test_number_unique" ON "test_questions" USING btree ("test_id","number");--> statement-breakpoint
CREATE INDEX "user_subscriptions_user_status_index" ON "user_subscriptions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "user_subscriptions_expiry_index" ON "user_subscriptions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "app_users_role_status_index" ON "app_users" USING btree ("role","status");
--> statement-breakpoint
INSERT INTO "courses" ("slug", "title", "description", "exam_type", "is_published")
VALUES ('tcf-preparation', 'TCF Preparation', 'Complete TCF practice across all four language skills.', 'TCF', true)
ON CONFLICT ("slug") DO UPDATE SET "title" = EXCLUDED."title", "description" = EXCLUDED."description", "is_published" = true, "updated_at" = now();
--> statement-breakpoint
INSERT INTO "course_modules" ("course_id", "type", "title", "description", "position", "is_published")
SELECT "id", seed."type"::"module_type", seed."title", seed."description", seed."position", seed."published"
FROM "courses"
CROSS JOIN (VALUES
  ('listening', 'Listening', 'Audio comprehension practice.', 1, true),
  ('reading', 'Reading', 'Text comprehension practice.', 2, true),
  ('writing', 'Writing', 'Guided written production practice.', 3, false),
  ('speaking', 'Speaking', 'Guided oral production practice.', 4, false)
) AS seed("type", "title", "description", "position", "published")
WHERE "courses"."slug" = 'tcf-preparation'
ON CONFLICT ("course_id", "type") DO UPDATE SET "title" = EXCLUDED."title", "description" = EXCLUDED."description", "position" = EXCLUDED."position", "is_published" = EXCLUDED."is_published", "updated_at" = now();
--> statement-breakpoint
INSERT INTO "pricing_plans" ("code", "name", "description", "duration_days", "price_minor", "currency", "features", "is_active")
VALUES
  ('access-7', '7 days', 'Seven days of complete platform access.', 7, 1000, 'USD', '["All modules", "All practice tests", "Progress reports"]'::jsonb, true),
  ('access-15', '15 days', 'Fifteen days of complete platform access.', 15, 2500, 'USD', '["All modules", "All practice tests", "Progress reports"]'::jsonb, true),
  ('access-30', '30 days', 'Thirty days of complete platform access.', 30, 4500, 'USD', '["All modules", "All practice tests", "Progress reports"]'::jsonb, true)
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "description" = EXCLUDED."description", "duration_days" = EXCLUDED."duration_days", "price_minor" = EXCLUDED."price_minor", "currency" = EXCLUDED."currency", "features" = EXCLUDED."features", "is_active" = true, "updated_at" = now();
--> statement-breakpoint
INSERT INTO "practice_tests" ("module_id", "test_number", "title", "duration_seconds", "max_attempts", "total_points", "is_published", "content_source")
SELECT
  module."id",
  test_number,
  module."title" || ' Test ' || test_number,
  CASE WHEN module."type" IN ('listening', 'reading') THEN 2100 ELSE NULL END,
  3,
  CASE WHEN module."type" IN ('listening', 'reading') THEN 39 ELSE 0 END,
  module."type" IN ('listening', 'reading'),
  CASE
    WHEN module."type" = 'listening' THEN '/listening-tests/test-' || lpad(test_number::text, 2, '0') || '.html'
    WHEN module."type" = 'reading' THEN '/reading-tests/reading-test-' || lpad(test_number::text, 2, '0') || '.pdf'
    ELSE NULL
  END
FROM "course_modules" AS module
CROSS JOIN generate_series(1, 40) AS test_number
JOIN "courses" ON "courses"."id" = module."course_id" AND "courses"."slug" = 'tcf-preparation'
ON CONFLICT ("module_id", "test_number") DO UPDATE SET "title" = EXCLUDED."title", "duration_seconds" = EXCLUDED."duration_seconds", "max_attempts" = EXCLUDED."max_attempts", "total_points" = EXCLUDED."total_points", "is_published" = EXCLUDED."is_published", "content_source" = EXCLUDED."content_source", "updated_at" = now();
