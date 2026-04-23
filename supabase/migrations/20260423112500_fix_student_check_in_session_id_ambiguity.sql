-- Fix ambiguous "session_id" reference in student_check_in.
-- The RETURNS TABLE field name (session_id) can conflict with unqualified
-- column references inside SQL statements.

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
  SELECT s.id
  INTO v_student_id
  FROM public.students s
  WHERE s.user_id = auth.uid()
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'No student profile for current user';
  END IF;

  SELECT sess.*
  INTO v_session
  FROM public.attendance_sessions sess
  WHERE sess.session_code = _session_code
  LIMIT 1;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_session.auto_close_at IS NOT NULL
     AND now() >= v_session.auto_close_at
     AND v_session.is_active
  THEN
    UPDATE public.attendance_sessions sess
    SET is_active = false,
        ended_at = COALESCE(sess.ended_at, v_session.auto_close_at)
    WHERE sess.id = v_session.id;

    v_session.is_active := false;
  END IF;

  IF NOT v_session.is_active THEN
    RAISE EXCEPTION 'Session is closed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.enrollments e
    WHERE e.class_id = v_session.class_id
      AND e.student_id = v_student_id
  ) THEN
    UPDATE public.enrollments e
    SET student_id = v_student_id
    WHERE e.class_id = v_session.class_id
      AND e.student_id IS NULL
      AND lower(trim(e.full_name)) = lower(
        trim((SELECT st.full_name FROM public.students st WHERE st.id = v_student_id))
      );

    IF NOT FOUND THEN
      RAISE EXCEPTION 'You are not enrolled in this class';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.attendance_records ar
    WHERE ar.session_id = v_session.id
      AND ar.student_id = v_student_id
  ) THEN
    RAISE EXCEPTION 'Already checked in for this session';
  END IF;

  v_late_ms := COALESCE(v_session.late_after_minutes, 15) * 60 * 1000;
  IF (EXTRACT(EPOCH FROM (now() - v_session.started_at)) * 1000) > v_late_ms THEN
    v_status := 'late';
  ELSE
    v_status := 'present';
  END IF;

  INSERT INTO public.attendance_records (session_id, student_id, status)
  VALUES (v_session.id, v_student_id, v_status);

  SELECT c.name
  INTO v_class_name
  FROM public.classes c
  WHERE c.id = v_session.class_id;

  RETURN QUERY
  SELECT v_status, v_session.id, v_class_name;
END;
$$;
