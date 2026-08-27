INSERT INTO "practice_tests" (
  "module_id",
  "test_number",
  "title",
  "duration_seconds",
  "max_attempts",
  "total_points",
  "is_published",
  "content_source"
)
SELECT
  module."id",
  test_number,
  module."title" || ' Test ' || test_number,
  2100,
  3,
  39,
  true,
  CASE
    WHEN module."type" = 'listening' THEN '/listening-tests/test-' || lpad(test_number::text, 2, '0') || '.html'
    WHEN module."type" = 'reading' THEN '/reading-tests/' || lpad(test_number::text, 2, '0')
  END
FROM "course_modules" AS module
CROSS JOIN generate_series(1, 40) AS test_number
WHERE module."type" IN ('listening', 'reading')
ON CONFLICT ("module_id", "test_number") DO UPDATE SET
  "title" = EXCLUDED."title",
  "duration_seconds" = EXCLUDED."duration_seconds",
  "max_attempts" = EXCLUDED."max_attempts",
  "total_points" = EXCLUDED."total_points",
  "is_published" = EXCLUDED."is_published",
  "content_source" = EXCLUDED."content_source",
  "updated_at" = now();
