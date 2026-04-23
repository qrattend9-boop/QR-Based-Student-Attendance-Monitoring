// Admin: manage courses (e.g. BSCS, BSN). Used to scope classes and student profiles.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface Course { id: string; code: string; name: string; description: string | null; }

export default function AdminCourses() {
  const [rows, setRows] = useState<Course[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", description: "" });

  const load = async () => {
    const { data } = await supabase.from("courses").select("*").order("code");
    setRows((data as Course[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) return toast.error("Code and name are required");
    const { error } = await supabase.from("courses").insert([{
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim() || null,
    }]);
    if (error) return toast.error(error.message);
    toast.success("Course added");
    setForm({ code: "", name: "", description: "" });
    setOpen(false);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this course? Classes and students will be unlinked.")) return;
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">Courses</h1>
          <p className="text-muted-foreground">Reference list of academic programs (e.g. BSCS, BSN).</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New course</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New course</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input id="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="BSCS" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="BS Computer Science" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <DialogFooter><Button type="submit">Create</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 hidden md:table-header-group">
            <tr>
              <th className="text-left p-3">Code</th>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Description</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y block md:table-row-group">
            {rows.length === 0 && (
              <tr className="block md:table-row"><td colSpan={4} className="p-6 text-center text-muted-foreground block md:table-cell">No courses yet.</td></tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} className="block md:table-row p-4 md:p-0">
                <td className="p-3 block md:table-cell">
                  <span className="md:hidden font-bold block text-xs uppercase text-muted-foreground mb-1">Code</span>
                  <span className="font-mono font-semibold">{c.code}</span>
                </td>
                <td className="p-3 block md:table-cell">
                  <span className="md:hidden font-bold block text-xs uppercase text-muted-foreground mb-1">Name</span>
                  {c.name}
                </td>
                <td className="p-3 block md:table-cell">
                  <span className="md:hidden font-bold block text-xs uppercase text-muted-foreground mb-1">Description</span>
                  <span className="text-muted-foreground">{c.description || "—"}</span>
                </td>
                <td className="p-3 text-right block md:table-cell border-t md:border-0 mt-2 md:mt-0">
                  <Button variant="ghost" size="sm" onClick={() => del(c.id)} className="text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
