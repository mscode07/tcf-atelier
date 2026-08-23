import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["student", "admin"]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "deleted"]);
export const authProviderEnum = pgEnum("auth_provider", ["credentials", "google"]);
export const moduleTypeEnum = pgEnum("module_type", ["listening", "reading", "writing", "speaking"]);
export const proficiencyLevelEnum = pgEnum("proficiency_level", ["A1", "A2", "B1", "B2", "C1", "C2"]);
export const enrollmentStatusEnum = pgEnum("enrollment_status", ["active", "completed", "cancelled"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["pending", "active", "expired", "cancelled", "refunded"]);
export const paymentStatusEnum = pgEnum("payment_status", ["created", "paid", "failed", "refunded"]);
export const testModeEnum = pgEnum("test_mode", ["exam", "review"]);
export const attemptStatusEnum = pgEnum("attempt_status", ["in_progress", "submitted", "evaluated", "abandoned"]);
export const questionTypeEnum = pgEnum("question_type", ["multiple_choice", "short_text", "essay", "audio_recording"]);

export const users = pgTable("app_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  googleSub: text("google_sub"),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  phone: text("phone"),
  country: text("country"),
  timezone: text("timezone").notNull().default("UTC"),
  preferredLanguage: text("preferred_language").notNull().default("en"),
  targetLevel: proficiencyLevelEnum("target_level"),
  targetExamDate: timestamp("target_exam_date", { withTimezone: true }),
  role: userRoleEnum("role").notNull().default("student"),
  status: userStatusEnum("status").notNull().default("active"),
  primaryProvider: text("primary_provider").notNull().default("credentials"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("app_users_google_sub_unique").on(table.googleSub),
  index("app_users_role_status_index").on(table.role, table.status),
]);

export const authAccounts = pgTable("auth_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: authProviderEnum("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("auth_accounts_provider_account_unique").on(table.provider, table.providerAccountId),
  index("auth_accounts_user_id_index").on(table.userId),
]);

export const courses = pgTable("courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  examType: text("exam_type").notNull().default("TCF"),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const courseModules = pgTable("course_modules", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  type: moduleTypeEnum("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  position: integer("position").notNull(),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("course_modules_course_type_unique").on(table.courseId, table.type),
  index("course_modules_course_position_index").on(table.courseId, table.position),
]);

export const courseEnrollments = pgTable("course_enrollments", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  status: enrollmentStatusEnum("status").notNull().default("active"),
  enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("course_enrollments_user_course_unique").on(table.userId, table.courseId),
  index("course_enrollments_course_status_index").on(table.courseId, table.status),
]);

export const pricingPlans = pgTable("pricing_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  durationDays: integer("duration_days").notNull(),
  priceMinor: integer("price_minor").notNull(),
  currency: text("currency").notNull().default("USD"),
  isActive: boolean("is_active").notNull().default(true),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userSubscriptions = pgTable("user_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").notNull().references(() => pricingPlans.id),
  status: subscriptionStatusEnum("status").notNull().default("pending"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("user_subscriptions_user_status_index").on(table.userId, table.status), index("user_subscriptions_expiry_index").on(table.expiresAt)]);

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  subscriptionId: uuid("subscription_id").references(() => userSubscriptions.id, { onDelete: "set null" }),
  provider: text("provider").notNull().default("razorpay"),
  providerOrderId: text("provider_order_id"),
  providerPaymentId: text("provider_payment_id"),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: paymentStatusEnum("status").notNull().default("created"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("payments_provider_payment_unique").on(table.provider, table.providerPaymentId), index("payments_user_status_index").on(table.userId, table.status)]);

export const practiceTests = pgTable("practice_tests", {
  id: uuid("id").defaultRandom().primaryKey(),
  moduleId: uuid("module_id").notNull().references(() => courseModules.id, { onDelete: "cascade" }),
  testNumber: integer("test_number").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  level: proficiencyLevelEnum("level"),
  durationSeconds: integer("duration_seconds"),
  maxAttempts: integer("max_attempts").notNull().default(3),
  totalPoints: integer("total_points").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(false),
  contentSource: text("content_source"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("practice_tests_module_number_unique").on(table.moduleId, table.testNumber), index("practice_tests_module_published_index").on(table.moduleId, table.isPublished)]);

export const testQuestions = pgTable("test_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  testId: uuid("test_id").notNull().references(() => practiceTests.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  type: questionTypeEnum("type").notNull().default("multiple_choice"),
  level: proficiencyLevelEnum("level"),
  passage: text("passage"),
  prompt: text("prompt").notNull(),
  explanation: text("explanation"),
  audioUrl: text("audio_url"),
  imageUrl: text("image_url"),
  points: integer("points").notNull().default(1),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("test_questions_test_number_unique").on(table.testId, table.number)]);

export const questionOptions = pgTable("question_options", {
  id: uuid("id").defaultRandom().primaryKey(),
  questionId: uuid("question_id").notNull().references(() => testQuestions.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  text: text("text").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("question_options_question_position_unique").on(table.questionId, table.position)]);

export const testAttempts = pgTable("test_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  testId: uuid("test_id").notNull().references(() => practiceTests.id, { onDelete: "cascade" }),
  attemptNumber: integer("attempt_number").notNull(),
  mode: testModeEnum("mode").notNull().default("exam"),
  status: attemptStatusEnum("status").notNull().default("in_progress"),
  score: integer("score").notNull().default(0),
  maxScore: integer("max_score").notNull().default(0),
  percentage: integer("percentage"),
  tcfScore: integer("tcf_score"),
  estimatedLevel: proficiencyLevelEnum("estimated_level"),
  correctCount: integer("correct_count").notNull().default(0),
  incorrectCount: integer("incorrect_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  evaluatorFeedback: text("evaluator_feedback"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  evaluatedAt: timestamp("evaluated_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("test_attempts_user_test_number_unique").on(table.userId, table.testId, table.attemptNumber), index("test_attempts_user_status_index").on(table.userId, table.status), index("test_attempts_test_score_index").on(table.testId, table.score)]);

export const attemptAnswers = pgTable("attempt_answers", {
  id: uuid("id").defaultRandom().primaryKey(),
  attemptId: uuid("attempt_id").notNull().references(() => testAttempts.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").notNull().references(() => testQuestions.id, { onDelete: "cascade" }),
  selectedOptionId: uuid("selected_option_id").references(() => questionOptions.id, { onDelete: "set null" }),
  textAnswer: text("text_answer"),
  recordingUrl: text("recording_url"),
  isCorrect: boolean("is_correct"),
  awardedPoints: integer("awarded_points").notNull().default(0),
  isFlagged: boolean("is_flagged").notNull().default(false),
  evaluatorFeedback: text("evaluator_feedback"),
  answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("attempt_answers_attempt_question_unique").on(table.attemptId, table.questionId), index("attempt_answers_question_index").on(table.questionId)]);

export const moduleProgress = pgTable("module_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  moduleId: uuid("module_id").notNull().references(() => courseModules.id, { onDelete: "cascade" }),
  testsStarted: integer("tests_started").notNull().default(0),
  testsCompleted: integer("tests_completed").notNull().default(0),
  bestScore: integer("best_score").notNull().default(0),
  averagePercentage: integer("average_percentage").notNull().default(0),
  estimatedLevel: proficiencyLevelEnum("estimated_level"),
  totalPracticeSeconds: integer("total_practice_seconds").notNull().default(0),
  lastPracticedAt: timestamp("last_practiced_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("module_progress_user_module_unique").on(table.userId, table.moduleId), index("module_progress_module_level_index").on(table.moduleId, table.estimatedLevel)]);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Course = typeof courses.$inferSelect;
export type PracticeTest = typeof practiceTests.$inferSelect;
export type TestAttempt = typeof testAttempts.$inferSelect;
export type AttemptAnswer = typeof attemptAnswers.$inferSelect;
