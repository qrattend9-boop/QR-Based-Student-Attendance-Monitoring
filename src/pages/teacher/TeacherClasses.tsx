// Teacher: list of classes + create new class scoped to a course and year level.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { YEAR_LEVELS, yearLevelLabel, type YearLevel } from "@/lib/academic";

interface Course { id: string; code: string; name: string; }

export default function TeacherClasses() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; code: string; description: string; course_id: string; year_level: YearLevel | ""; }>({
    name: "", code: "", description: "", course_id: "", year_level: "",
  });

  const load = async () => {
    if (!user) return;
    // Only show courses this teacher is assigned to (RLS already restricts teacher_assignments to own).
    const [{ data: cls }, { data: assigns }] = await Promise.all([
      supabase.from("classes").select("*, courses(code, name)").eq("teacher_id", user.id).order("created_at", { ascending: false }),
      supabase.from("teacher_assignments").select("course_id, courses(id, code, name)").eq("teacher_id", user.id),
    ]);
    setClasses(cls ?? []);
    const myCourses = (assigns ?? [])
      .map((a: any) => a.courses)
      .filter(Boolean)
      .sort((a: Course, b: Course) => a.code.localeCompare(b.code));
    setCourses(myCourses as Course[]);
  };
  useEffect(() => { load(); }, [user]);

  const createClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.name.trim()) return;
    const { error } = await supabase.from("classes").insert({
      teacher_id: user.id,
      name: form.name.trim(),
      code: form.code.trim() || null,
      description: form.description.trim() || null,
      course_id: form.course_id || null,
      year_level: (form.year_level || null) as YearLevel | null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Class created");
    setForm({ name: "", code: "", description: "", course_id: "", year_level: "" });
    setOpen(false);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this class and all its data?")) return;
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="font-display text-3xl font-bold">Classes</h1>
          <p className="text-muted-foreground">Create a class, upload roster, run attendance.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-brand" disabled={courses.length === 0}>
              <Plus className="h-4 w-4 mr-1" /> New class
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create class</DialogTitle></DialogHeader>
            {courses.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                You haven't been assigned to any courses yet. Ask an admin to assign courses to you in
                <span className="font-medium text-foreground"> Admin → Assignments</span>.
              </div>
            ) : (
            <form onSubmit={createClass} className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Course</Label>
                  <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Year level</Label>
                  <Select value={form.year_level} onValueChange={(v) => setForm({ ...form, year_level: v as YearLevel })}>
                    <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                    <SelectContent>
                      {YEAR_LEVELS.map((y) => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Code (optional)</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CS101" /></div>
              <div><Label>Description (optional)</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <Button type="submit" className="w-full bg-gradient-brand">Create</Button>
            </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {courses.length === 0 && (
        <div className="rounded-xl border border-dashed bg-card p-5 text-sm">
          <p className="font-medium">You haven't been assigned to teach any courses yet.</p>
          <p className="text-muted-foreground mt-1">
            An admin needs to assign courses to your account before you can create classes. Once assigned,
            those courses will appear in the "New class" dialog.
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map((c) => (
          <div key={c.id} className="rounded-xl border bg-card p-5 shadow-card group">
            <div className="flex justify-between items-start">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  {c.code && <span>{c.code}</span>}
                  {c.courses?.code && <span className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{c.courses.code}</span>}
                  {c.year_level && <span className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{yearLevelLabel(c.year_level)}</span>}
                </div>
                <Link to={`/teacher/classes/${c.id}`} className="font-display font-semibold text-lg block hover:text-brand mt-1">{c.name}</Link>
                {c.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => del(c.id)} className="opacity-0 group-hover:opacity-100">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {classes.length === 0 && <div className="text-muted-foreground">No classes yet. Create your first one.</div>}
      </div>
    </div>
  );
}
