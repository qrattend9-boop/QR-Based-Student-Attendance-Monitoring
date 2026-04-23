-- Add auto-close timestamp + session token (used for student-side scanning) to attendance_sessions.
ALTER TABLE public.attendance_sessions
  ADD COLUMN IF NOT EXISTS auto_close_at timestamptz,
  ADD COLUMN IF NOT EXISTS session_code text NOT NULL DEFAULT (gen_random_uuid())::text;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_sessions_session_code_key
  ON public.attendance_sessions(session_code);

-- Allow enrolled students to read sessions of classes they are in (already true via existing
-- "Sessions: students read class sessions" policy). Nothing else needed for SELECT.

-- Allow a student (enrolled in the class) to insert their OWN present/late record into an active session.
DROP POLICY IF EXISTS "Records: student self check-in" ON public.attendance_records;
CREATE POLICY "Records: student self check-in"
  ON public.attendance_records FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_student_owner(student_id)
    AND EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      WHERE s.id = session_id
        AND s.is_active = true
        AND public.is_enrolled_in_class(s.class_id)
    )
  );

-- RPC the student app calls to check-in by session_code. Bypasses RLS via SECURITY DEFINER
-- but enforces: caller must own a student row, session must be active & not past auto_close,
-- and the student must be enrolled in that class. Returns the resolved status.
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
  -- Resolve the calling user's student row
  SELECT id INTO v_student_id FROM public.students WHERE user_id = auth.uid() LIMIT 1;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'No student profile for current user';
  END IF;

  -- Resolve session by code
  SELECT * INTO v_session FROM public.attendance_sessions WHERE session_code = _session_code LIMIT 1;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  -- Auto-close if past deadline
  IF v_session.auto_close_at IS NOT NULL AND now() >= v_session.auto_close_at AND v_session.is_active THEN
    UPDATE public.attendance_sessions
      SET is_active = false, ended_at = COALESCE(ended_at, v_session.auto_close_at)
      WHERE id = v_session.id;
    v_session.is_active := false;
  END IF;

  IF NOT v_session.is_active THEN
    RAISE EXCEPTION 'Session is closed';
  END IF;

  -- Must be enrolled in the class (or auto-link by name match if there's a slot)
  IF NOT EXISTS (SELECT 1 FROM public.enrollments WHERE class_id = v_session.class_id AND student_id = v_student_id) THEN
    -- Try to auto-link by full_name
    UPDATE public.enrollments e
       SET student_id = v_student_id
     WHERE e.class_id = v_session.class_id
       AND e.student_id IS NULL
       AND e.full_name = (SELECT full_name FROM public.students WHERE id = v_student_id);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'You are not enrolled in this class';
    END IF;
  END IF;

  -- Prevent duplicates
  IF EXISTS (SELECT 1 FROM public.attendance_records WHERE session_id = v_session.id AND student_id = v_student_id) THEN
    RAISE EXCEPTION 'Already checked in for this session';
  END IF;

  -- Compute present vs late
  v_late_ms := COALESCE(v_session.late_after_minutes, 15) * 60 * 1000;
  IF (EXTRACT(EPOCH FROM (now() - v_session.started_at)) * 1000) > v_late_ms THEN
    v_status := 'late';
  ELSE
    v_status := 'present';
  END IF;

  INSERT INTO public.attendance_records (session_id, student_id, status)
  VALUES (v_session.id, v_student_id, v_status);

  SELECT name INTO v_class_name FROM public.classes WHERE id = v_session.class_id;

  RETURN QUERY SELECT v_status, v_session.id, v_class_name;
END;
$$;