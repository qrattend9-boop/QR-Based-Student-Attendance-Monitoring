-- 1. teacher_assignments table
CREATE TABLE public.teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (teacher_id, course_id)
);

CREATE INDEX idx_teacher_assignments_teacher ON public.teacher_assignments(teacher_id);
CREATE INDEX idx_teacher_assignments_course ON public.teacher_assignments(course_id);

ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;

-- Admins manage everything
CREATE POLICY "Assignments: admins manage"
ON public.teacher_assignments
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Teachers read their own
CREATE POLICY "Assignments: teacher reads own"
ON public.teacher_assignments
FOR SELECT
TO authenticated
USING (teacher_id = auth.uid());

-- 2. Helper function: is this teacher assigned to this course?
CREATE OR REPLACE FUNCTION public.is_teacher_assigned_to_course(_teacher_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_assignments
    WHERE teacher_id = _teacher_id AND course_id = _course_id
  )
$$;

-- 3. Trigger on classes: enforce assignment when course_id is set and actor is a teacher (not admin)
CREATE OR REPLACE FUNCTION public.enforce_teacher_course_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins bypass
  IF has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- No course set → allow (legacy / unassigned classes)
  IF NEW.course_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Teacher must be assigned to this course
  IF NOT public.is_teacher_assigned_to_course(NEW.teacher_id, NEW.course_id) THEN
    RAISE EXCEPTION 'You are not assigned to teach this course. Ask an admin to assign it to you.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_teacher_course_assignment
BEFORE INSERT OR UPDATE OF course_id, teacher_id ON public.classes
FOR EACH ROW
EXECUTE FUNCTION public.enforce_teacher_course_assignment();

-- 4. RPC for admins to list teachers + their assignments (avoids client-side join to auth)
CREATE OR REPLACE FUNCTION public.admin_list_teacher_assignments()
RETURNS TABLE (
  teacher_id uuid,
  full_name text,
  email text,
  assignments jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS teacher_id,
    p.full_name,
    p.email,
    COALESCE(
      jsonb_agg(
        jsonb_build_object('id', ta.id, 'course_id', c.id, 'code', c.code, 'name', c.name)
        ORDER BY c.code
      ) FILTER (WHERE ta.id IS NOT NULL),
      '[]'::jsonb
    ) AS assignments
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'teacher'
  LEFT JOIN public.teacher_assignments ta ON ta.teacher_id = p.id
  LEFT JOIN public.courses c ON c.id = ta.course_id
  WHERE has_role(auth.uid(), 'admin'::app_role)
  GROUP BY p.id, p.full_name, p.email
  ORDER BY p.full_name;
$$;