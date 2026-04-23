-- Improve student self check-in enrollment linking:
-- 1) Make fallback name matching case-insensitive and trimmed.
-- 2) Backfill existing enrollments where full_name already matches a student profile.

CREATE OR REPLACE FUNCTION public.student_check_in(_session_code text)
RETURNS TABLE (status public.attendance_status, session_id uuid, class_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.attendance_sessions%ROWTYPE;
  v_student_id uuid;
  v_class_name text;
  v_status public.attendance_status;
  v_late_ms bigint;
BEGIN
  -- Resolve the calling user's student row.
  SELECT id INTO v_student_id
  FROM public.students
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'No student profile for current user';
  END IF;

  -- Resolve session by code.
  SELECT *
  INTO v_session
  FROM public.attendance_sessions
  WHERE session_code = _session_code
  LIMIT 1;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  -- Auto-close if past deadline.
  IF v_session.auto_close_at IS NOT NULL
     AND now() >= v_session.auto_close_at
     AND v_session.is_active
  THEN
    UPDATE public.attendance_sessions
    SET is_active = false,
        ended_at = COALESCE(ended_at, v_session.auto_close_at)
    WHERE id = v_session.id;

    v_session.is_active := false;
  END IF;

  IF NOT v_session.is_active THEN
    RAISE EXCEPTION 'Session is closed';
  END IF;

  -- Must be enrolled in the class (or auto-link by normalized full_name).
  IF NOT EXISTS (
    SELECT 1
    FROM public.enrollments
    WHERE class_id = v_session.class_id
      AND student_id = v_student_id
  ) THEN
    UPDATE public.enrollments e
    SET student_id = v_student_id
    WHERE e.class_id = v_session.class_id
      AND e.student_id IS NULL
      AND lower(trim(e.full_name)) = lower(
        trim((SELECT full_name FROM public.students WHERE id = v_student_id))
      );

    IF NOT FOUND THEN
      RAISE EXCEPTION 'You are not enrolled in this class';
    END IF;
  END IF;

  -- Prevent duplicates.
  IF EXISTS (
    SELECT 1
    FROM public.attendance_records
    WHERE session_id = v_session.id
      AND student_id = v_student_id
  ) THEN
    RAISE EXCEPTION 'Already checked in for this session';
  END IF;

  -- Compute present vs late.
  v_late_ms := COALESCE(v_session.late_after_minutes, 15) * 60 * 1000;
  IF (EXTRACT(EPOCH FROM (now() - v_session.started_at)) * 1000) > v_late_ms THEN
    v_status := 'late';
  ELSE
    v_status := 'present';
  END IF;

  INSERT INTO public.attendance_records (session_id, student_id, status)
  VALUES (v_session.id, v_student_id, v_status);

  SELECT name INTO v_class_name
  FROM public.classes
  WHERE id = v_session.class_id;

  RETURN QUERY
  SELECT v_status, v_session.id, v_class_name;
END;
$$;

-- Backfill existing roster rows to reduce false "not enrolled" failures.
UPDATE public.enrollments e
SET student_id = s.id
FROM public.students s
WHERE e.student_id IS NULL
  AND lower(trim(e.full_name)) = lower(trim(s.full_name));
