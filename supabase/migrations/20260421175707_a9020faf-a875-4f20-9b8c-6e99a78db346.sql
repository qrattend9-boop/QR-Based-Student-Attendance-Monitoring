-- Helper to check if the current user is the linked owner of a student row.
-- SECURITY DEFINER bypasses RLS on `students`, eliminating the recursion.
CREATE OR REPLACE FUNCTION public.is_student_owner(_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students
    WHERE id = _student_id AND user_id = auth.uid()
  )
$$;

-- Helper: does the current user (a student) belong to a given class via an enrollment?
CREATE OR REPLACE FUNCTION public.is_enrolled_in_class(_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.students s ON s.id = e.student_id
    WHERE e.class_id = _class_id AND s.user_id = auth.uid()
  )
$$;

-- Helper: does the current user own (teach) the class that owns this session?
CREATE OR REPLACE FUNCTION public.is_session_teacher(_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.attendance_sessions
    WHERE id = _session_id AND teacher_id = auth.uid()
  )
$$;

-- Helper: does the current user own (teach) the class?
CREATE OR REPLACE FUNCTION public.is_class_teacher(_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes
    WHERE id = _class_id AND teacher_id = auth.uid()
  )
$$;

-- ============ classes ============
DROP POLICY IF EXISTS "Classes: students read enrolled" ON public.classes;
CREATE POLICY "Classes: students read enrolled"
  ON public.classes FOR SELECT
  TO authenticated
  USING (public.is_enrolled_in_class(id));

-- ============ attendance_sessions ============
DROP POLICY IF EXISTS "Sessions: students read class sessions" ON public.attendance_sessions;
CREATE POLICY "Sessions: students read class sessions"
  ON public.attendance_sessions FOR SELECT
  TO authenticated
  USING (public.is_enrolled_in_class(class_id));

-- ============ enrollments ============
DROP POLICY IF EXISTS "Enrollments: student reads own" ON public.enrollments;
DROP POLICY IF EXISTS "Enrollments: teacher of class manages" ON public.enrollments;

CREATE POLICY "Enrollments: student reads own"
  ON public.enrollments FOR SELECT
  TO authenticated
  USING (public.is_student_owner(student_id));

CREATE POLICY "Enrollments: teacher of class manages"
  ON public.enrollments FOR ALL
  TO authenticated
  USING (public.is_class_teacher(class_id) OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.is_class_teacher(class_id) OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============ attendance_records ============
DROP POLICY IF EXISTS "Records: student reads own" ON public.attendance_records;
DROP POLICY IF EXISTS "Records: teacher of session manages" ON public.attendance_records;

CREATE POLICY "Records: student reads own"
  ON public.attendance_records FOR SELECT
  TO authenticated
  USING (public.is_student_owner(student_id));

CREATE POLICY "Records: teacher of session manages"
  ON public.attendance_records FOR ALL
  TO authenticated
  USING (public.is_session_teacher(session_id) OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.is_session_teacher(session_id) OR public.has_role(auth.uid(), 'admin'::public.app_role));