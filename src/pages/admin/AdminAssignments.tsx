// Admin: assign teachers to courses they're allowed to teach.
// A teacher can only create classes for assigned courses (enforced by DB trigger).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, X, BookOpen } from "lucide-react";

interface Course { id: string; code: string; name: string; }
interface AssignmentChip { id: string; course_id: string; code: string; name: string; }
interface TeacherRow {
  teacher_id: string;
  full_name: string;
  email: string | null;
  assignments: AssignmentChip[];
}

export default function AdminAssignments() {
  const [rows, setRows] = useState<TeacherRow[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ teacher_id: "", course_id: "" });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: tdata, error: terr }, { data: cdata }] = await Promise.all([
      supabase.rpc("admin_list_teacher_assignments"),
      supabase.from("courses").select("id, code, name").order("code"),
    ]);
    if (terr) toast.error(terr.message);
    setRows((tdata as any as TeacherRow[]) ?? []);
    setCourses((cdata as Course[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.teacher_id || !form.course_id) return toast.error("Pick a teacher and a course");
    const { error } = await supabase.from("teacher_assignments").insert({
      teacher_id: form.teacher_id,
      course_id: form.course_id,
    });
    if (error) return toast.error(error.message);
    toast.success("Course assigned");
    setForm({ teacher_id: "", course_id: "" });
    setOpen(false);
    load();
  };

  const remove = async (assignmentId: string) => {
    if (!confirm("Remove this course from the teacher? They won't be able to create new classes for it.")) return;
    const { error } = await supabase.from("teacher_assignments").delete().eq("id", assignmentId);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  };

  const selectedTeacher = rows.find((r) => r.teacher_id === form.teacher_id);
  const availableCourses = courses.filter(
    (c) => !selectedTeacher?.assignments.some((a) => a.course_id === c.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">Teacher Assignments</h1>
          <p className="text-muted-foreground">
            Assign courses to teachers. They can only create classes for courses assigned to them.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Assign course</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Assign course to teacher</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div className="space-y-2">
                <Label>Teacher</Label>
                <Select value={form.teacher_id} onValueChange={(v) => setForm({ teacher_id: v, course_id: "" })}>
                  <SelectTrigger><SelectValue placeholder={rows.length ? "Select teacher" : "No teachers yet"} /></SelectTrigger>
                  <SelectContent>
                    {rows.map((t) => (
                      <SelectItem key={t.teacher_id} value={t.teacher_id}>
                        {t.full_name || t.email || t.teacher_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Course</Label>
                <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })} disabled={!form.teacher_id}>
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !form.teacher_id ? "Pick a teacher first"
                        : availableCourses.length ? "Select course"
                        : "All courses already assigned"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCourses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={!form.teacher_id || !form.course_id}>Assign</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 hidden md:table-header-group">
            <tr>
              <th className="text-left p-3">Teacher</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Assigned courses</th>
            </tr>
          </thead>
          <tbody className="divide-y block md:table-row-group">
            {loading && (
              <tr className="block md:table-row"><td colSpan={3} className="p-6 text-center text-muted-foreground block md:table-cell">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr className="block md:table-row"><td colSpan={3} className="p-6 text-center text-muted-foreground block md:table-cell">
                No teachers yet.
              </td></tr>
            )}
            {rows.map((t) => (
              <tr key={t.teacher_id} className="block md:table-row p-4 md:p-0">
                <td className="p-3 block md:table-cell font-medium">
                  <span className="md:hidden font-bold block text-xs uppercase text-muted-foreground mb-1">Teacher</span>
                  {t.full_name || "—"}
                </td>
                <td className="p-3 block md:table-cell text-muted-foreground">
                  <span className="md:hidden font-bold block text-xs uppercase text-muted-foreground mb-1">Email</span>
                  {t.email || "—"}
                </td>
                <td className="p-3 block md:table-cell">
                  <span className="md:hidden font-bold block text-xs uppercase text-muted-foreground mb-1">Assigned courses</span>
                  <div className="flex flex-wrap gap-2">
                    {t.assignments.length === 0 && (
                      <span className="text-muted-foreground text-xs italic">No courses assigned — they cannot create classes yet.</span>
                    )}
                    {t.assignments.map((a) => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-secondary text-secondary-foreground pl-2.5 pr-1 py-1 text-xs"
                      >
                        <BookOpen className="h-3 w-3" />
                        <span className="font-mono font-semibold">{a.code}</span>
                        <span className="text-muted-foreground hidden sm:inline">{a.name}</span>
                        <button
                          onClick={() => remove(a.id)}
                          className="ml-1 rounded-full hover:bg-destructive hover:text-destructive-foreground p-0.5"
                          aria-label="Remove"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
