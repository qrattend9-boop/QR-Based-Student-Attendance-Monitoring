
-- 1. year_level enum
DO $$ BEGIN
  CREATE TYPE public.year_level AS ENUM ('first_year','second_year','third_year','fourth_year','graduate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. courses table
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Courses: anyone authenticated reads" ON public.courses;
CREATE POLICY "Courses: anyone authenticated reads"
  ON public.courses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Courses: admins manage" ON public.courses;
CREATE POLICY "Courses: admins manage"
  ON public.courses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_courses_updated_at ON public.courses;
CREATE TRIGGER trg_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. classes: add course_id + year_level
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS year_level public.year_level;

CREATE INDEX IF NOT EXISTS idx_classes_course_id ON public.classes(course_id);
CREATE INDEX IF NOT EXISTS idx_classes_year_level ON public.classes(year_level);

-- 4. students: add course_id (keep free-text course for backwards compat)
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_course_id ON public.students(course_id);

-- 5. Helper RPC for admin-create-user edge function (executes with definer rights, gated by has_role check)
CREATE OR REPLACE FUNCTION public.admin_assign_teacher_role(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can assign teacher role';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'teacher');
END;
$$;
