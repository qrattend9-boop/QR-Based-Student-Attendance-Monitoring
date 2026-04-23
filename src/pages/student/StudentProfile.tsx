// Student registration / edit profile form. Course is picked from the admin-managed list; year level uses the shared enum.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { z } from "zod";
import { YEAR_LEVELS, type YearLevel } from "@/lib/academic";

const schema = z.object({
  full_name: z.string().trim().min(2).max(100),
  year_level: z.string().trim().min(1).max(50),
  section: z.string().trim().min(1).max(50),
  course_id: z.string().uuid({ message: "Please select a course" }),
});

interface Course { id: string; code: string; name: string; }

export default function StudentProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState<{ full_name: string; year_level: YearLevel | ""; section: string; course_id: string; }>({
    full_name: "", year_level: "", section: "", course_id: "",
  });
  const [existing, setExisting] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: student }, { data: crs }] = await Promise.all([
        supabase.from("students").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("courses").select("id, code, name").order("code"),
      ]);
      setCourses((crs as Course[]) ?? []);
      if (student) {
        setExisting(student);
        // Map legacy year_level text to enum value if needed
        const yl = (YEAR_LEVELS.find((y) => y.value === student.year_level)?.value ?? "") as YearLevel | "";
        setForm({
          full_name: student.full_name,
          year_level: yl,
          section: student.section,
          course_id: student.course_id ?? "",
        });
      } else {
        const { data: p } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
        if (p?.full_name) setForm((f) => ({ ...f, full_name: p.full_name }));
      }
    })();
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!user) return;
    setLoading(true);
    try {
      const courseName = courses.find((c) => c.id === parsed.data.course_id)?.name ?? "";
      const payload = {
        full_name: parsed.data.full_name,
        year_level: parsed.data.year_level,
        section: parsed.data.section,
        course_id: parsed.data.course_id,
        course: courseName, // keep free-text mirror for backwards compat
      };
      if (existing) {
        const { error } = await supabase.from("students").update(payload).eq("id", existing.id);
        if (error) throw error;
        toast.success("Profile updated");
      } else {
        const { data, error } = await supabase.from("students").insert([{ ...payload, user_id: user.id }]).select().single();
        if (error) throw error;
        setExisting(data);
        toast.success("Profile created! Your QR is ready.");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Student profile</h1>
        <p className="text-muted-foreground">These details appear on your attendance records.</p>
      </div>
      <form onSubmit={submit} className="rounded-xl border bg-card p-6 shadow-card space-y-4">
        <div>
          <Label>Full name</Label>
          <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Year level</Label>
            <Select value={form.year_level} onValueChange={(v) => setForm({ ...form, year_level: v as YearLevel })}>
              <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
              <SelectContent>
                {YEAR_LEVELS.map((y) => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Section</Label>
            <Input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="e.g. A" required />
          </div>
        </div>
        <div>
          <Label>Course</Label>
          <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
            <SelectTrigger>
              <SelectValue placeholder={courses.length ? "Select course" : "No courses available — ask an admin"} />
            </SelectTrigger>
            <SelectContent>
              {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="bg-gradient-brand" disabled={loading}>
          {existing ? "Save changes" : "Create profile"}
        </Button>
      </form>
    </div>
  );
}
