-- Student self-enrollment flow:
-- 1) List classes available for enrollment.
-- 2) Allow authenticated student to enroll themselves into a class.

CREATE OR REPLACE FUNCTION public.list_classes_for_enrollment()
RETURNS TABLE (
  id uuid,
  name text,
  code text,
  description text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.code, c.description, c.created_at
  FROM public.classes c
  ORDER BY c.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.student_enroll_in_class(_class_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_full_name text;
BEGIN
  SELECT s.id, s.full_name
  INTO v_student_id, v_full_name
  FROM public.students s
  WHERE s.user_id = auth.uid()
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'No student profile for current user';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.enrollments e
    WHERE e.class_id = _class_id
      AND e.student_id = v_student_id
  ) THEN
    RETURN 'already_enrolled';
  END IF;

  UPDATE public.enrollments e
  SET student_id = v_student_id
  WHERE e.class_id = _class_id
    AND e.student_id IS NULL
    AND lower(trim(e.full_name)) = lower(trim(v_full_name));

  IF FOUND THEN
    RETURN 'enrolled';
  END IF;

  BEGIN
    INSERT INTO public.enrollments (class_id, full_name, student_id)
    VALUES (_class_id, v_full_name, v_student_id);
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'A roster row with this student name already exists and is linked to another account';
  END;

  RETURN 'enrolled';
END;
$$;
