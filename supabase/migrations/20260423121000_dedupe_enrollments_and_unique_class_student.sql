-- Prevent duplicate linked enrollments per class/student and clean up existing duplicates.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY class_id, student_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.enrollments
  WHERE student_id IS NOT NULL
)
DELETE FROM public.enrollments e
USING ranked r
WHERE e.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS enrollments_class_student_unique
  ON public.enrollments (class_id, student_id)
  WHERE student_id IS NOT NULL;
