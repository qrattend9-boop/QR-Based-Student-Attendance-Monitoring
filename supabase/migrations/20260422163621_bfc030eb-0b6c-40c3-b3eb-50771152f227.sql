-- 1. Status enum for enrollment requests
CREATE TYPE public.enrollment_request_status AS ENUM ('pending', 'approved', 'rejected');

-- 2. enrollment_requests table
CREATE TABLE public.enrollment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  proof_path text NOT NULL,
  status public.enrollment_request_status NOT NULL DEFAULT 'pending',
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id, status) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX idx_enrollment_requests_class_status ON public.enrollment_requests(class_id, status);
CREATE INDEX idx_enrollment_requests_student ON public.enrollment_requests(student_id);

-- updated_at trigger
CREATE TRIGGER set_enrollment_requests_updated_at
  BEFORE UPDATE ON public.enrollment_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.enrollment_requests ENABLE ROW LEVEL SECURITY;

-- RLS: student creates own
CREATE POLICY "Requests: student creates own"
  ON public.enrollment_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_student_owner(student_id));

-- RLS: student reads own
CREATE POLICY "Requests: student reads own"
  ON public.enrollment_requests FOR SELECT TO authenticated
  USING (public.is_student_owner(student_id));

-- RLS: student deletes own pending
CREATE POLICY "Requests: student deletes own pending"
  ON public.enrollment_requests FOR DELETE TO authenticated
  USING (public.is_student_owner(student_id) AND status = 'pending');

-- RLS: teacher of class / admin reads
CREATE POLICY "Requests: teacher reads class"
  ON public.enrollment_requests FOR SELECT TO authenticated
  USING (public.is_class_teacher(class_id) OR public.has_role(auth.uid(), 'admin'));

-- RLS: teacher of class / admin updates
CREATE POLICY "Requests: teacher updates class"
  ON public.enrollment_requests FOR UPDATE TO authenticated
  USING (public.is_class_teacher(class_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_class_teacher(class_id) OR public.has_role(auth.uid(), 'admin'));

-- 3. Trigger: when approved, auto-create enrollment row
CREATE OR REPLACE FUNCTION public.handle_enrollment_request_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    SELECT full_name INTO v_full_name FROM public.students WHERE id = NEW.student_id;

    -- Link to existing roster row if name matches and is unlinked
    UPDATE public.enrollments
       SET student_id = NEW.student_id
     WHERE class_id = NEW.class_id
       AND student_id IS NULL
       AND full_name = v_full_name;

    -- Otherwise insert new enrollment if not already enrolled
    IF NOT EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE class_id = NEW.class_id AND student_id = NEW.student_id
    ) THEN
      INSERT INTO public.enrollments (class_id, student_id, full_name)
      VALUES (NEW.class_id, NEW.student_id, v_full_name);
    END IF;

    NEW.reviewed_by := COALESCE(NEW.reviewed_by, auth.uid());
    NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());
  ELSIF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    NEW.reviewed_by := COALESCE(NEW.reviewed_by, auth.uid());
    NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enrollment_request_status
  BEFORE UPDATE ON public.enrollment_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_enrollment_request_approval();

-- 4. Storage bucket for proofs (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'enrollment-proofs',
  'enrollment-proofs',
  false,
  5242880, -- 5MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
);

-- Storage policies: files are organized as <student_id>/<filename>
-- Student can upload own
CREATE POLICY "Proofs: student uploads own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'enrollment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.user_id = auth.uid()
        AND s.id::text = (storage.foldername(name))[1]
    )
  );

-- Student can read own
CREATE POLICY "Proofs: student reads own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'enrollment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.user_id = auth.uid()
        AND s.id::text = (storage.foldername(name))[1]
    )
  );

-- Student can delete own (for re-upload after rejection)
CREATE POLICY "Proofs: student deletes own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'enrollment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.user_id = auth.uid()
        AND s.id::text = (storage.foldername(name))[1]
    )
  );

-- Teachers/admins read proofs for any request they can review
CREATE POLICY "Proofs: teacher/admin reads"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'enrollment-proofs'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.enrollment_requests er
        JOIN public.classes c ON c.id = er.class_id
        WHERE er.proof_path = name
          AND c.teacher_id = auth.uid()
      )
    )
  );

-- 5. Update student_check_in: remove auto-link-by-name fallback (always require proof)
CREATE OR REPLACE FUNCTION public.student_check_in(_session_code text)
RETURNS TABLE(status attendance_status, session_id uuid, class_name text)
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
  SELECT id INTO v_student_id FROM public.students WHERE user_id = auth.uid() LIMIT 1;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'No student profile for current user';
  END IF;

  SELECT * INTO v_session FROM public.attendance_sessions WHERE session_code = _session_code LIMIT 1;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_session.auto_close_at IS NOT NULL AND now() >= v_session.auto_close_at AND v_session.is_active THEN
    UPDATE public.attendance_sessions
      SET is_active = false, ended_at = COALESCE(ended_at, v_session.auto_close_at)
      WHERE id = v_session.id;
    v_session.is_active := false;
  END IF;

  IF NOT v_session.is_active THEN
    RAISE EXCEPTION 'Session is closed';
  END IF;

  -- Must be enrolled (proof must have been approved by teacher/admin)
  IF NOT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE class_id = v_session.class_id AND student_id = v_student_id
  ) THEN
    RAISE EXCEPTION 'You are not enrolled in this class. Submit your certificate of enrollment to join.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.attendance_records WHERE session_id = v_session.id AND student_id = v_student_id) THEN
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

  SELECT name INTO v_class_name FROM public.classes WHERE id = v_session.class_id;

  RETURN QUERY SELECT v_status, v_session.id, v_class_name;
END;
$$;

-- 6. Allow students to discover classes (read name/code only) — needed for "Browse classes"
CREATE POLICY "Classes: students browse for join"
  ON public.classes FOR SELECT TO authenticated
  USING (true);