
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');

CREATE TYPE public.attendance_status AS ENUM ('present', 'late', 'absent');

-- ============ PROFILES (1:1 with auth.users) ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security-definer role checker (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get a user's primary role (first one found)
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- ============ STUDENTS ============
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  year_level TEXT NOT NULL,
  section TEXT NOT NULL,
  course TEXT NOT NULL,
  qr_token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- ============ CLASSES ============
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- ============ ENROLLMENTS (CSV-uploaded roster) ============
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, full_name)
);
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- ============ ATTENDANCE SESSIONS ============
CREATE TABLE public.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  late_after_minutes INTEGER NOT NULL DEFAULT 15,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

-- ============ ATTENDANCE RECORDS ============
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status public.attendance_status NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_students_updated BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_classes_updated BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + default student role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );

  -- Default role = student (admins/teachers promoted by an admin afterwards)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student'::public.app_role)
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "Profiles: users read own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Profiles: admins read all" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Profiles: users update own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Profiles: admins update any" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Profiles: teachers read all" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'teacher'));

-- user_roles
CREATE POLICY "Roles: user reads own" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Roles: admins read all" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles: admins insert" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles: admins update" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles: admins delete" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- students
CREATE POLICY "Students: self read" ON public.students
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Students: teachers read all" ON public.students
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "Students: admins read all" ON public.students
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Students: self insert" ON public.students
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Students: self update" ON public.students
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Students: admins manage" ON public.students
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- classes
CREATE POLICY "Classes: teacher owns" ON public.classes
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Classes: students read enrolled" ON public.classes
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      JOIN public.students s ON s.id = e.student_id
      WHERE e.class_id = classes.id AND s.user_id = auth.uid()
    )
  );

-- enrollments
CREATE POLICY "Enrollments: teacher of class manages" ON public.enrollments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = enrollments.class_id AND c.teacher_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = enrollments.class_id AND c.teacher_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Enrollments: student reads own" ON public.enrollments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.students s WHERE s.id = enrollments.student_id AND s.user_id = auth.uid())
  );

-- attendance_sessions
CREATE POLICY "Sessions: teacher manages own" ON public.attendance_sessions
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sessions: students read class sessions" ON public.attendance_sessions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      JOIN public.students s ON s.id = e.student_id
      WHERE e.class_id = attendance_sessions.class_id AND s.user_id = auth.uid()
    )
  );

-- attendance_records
CREATE POLICY "Records: teacher of session manages" ON public.attendance_records
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.attendance_sessions s WHERE s.id = attendance_records.session_id AND s.teacher_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.attendance_sessions s WHERE s.id = attendance_records.session_id AND s.teacher_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Records: student reads own" ON public.attendance_records
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.students s WHERE s.id = attendance_records.student_id AND s.user_id = auth.uid())
  );
