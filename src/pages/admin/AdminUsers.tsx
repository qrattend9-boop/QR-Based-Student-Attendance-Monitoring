// Admin: list users, set roles, create new teacher accounts with a temp password.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Copy, Check } from "lucide-react";

interface CreatedTeacher { email: string; temp_password: string; }

export default function AdminUsers() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedTeacher | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    const { data: roles } = await supabase.from("user_roles").select("*");
    const byUser = new Map<string, string>();
    (roles ?? []).forEach((r) => byUser.set(r.user_id, r.role));
    setRows((profiles ?? []).map((p) => ({ ...p, role: byUser.get(p.id) ?? "student" })));
  };
  useEffect(() => { load(); }, []);

  const setRole = async (userId: string, role: "admin" | "teacher" | "student") => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert([{ user_id: userId, role }]);
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    load();
  };

  const createTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) return toast.error("Name and email are required");
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-teacher", {
        body: { full_name: form.full_name.trim(), email: form.email.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setCreated({ email: data.email, temp_password: data.temp_password });
      setForm({ full_name: "", email: "" });
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create teacher");
    } finally { setSubmitting(false); }
  };

  const copyCreds = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(`Email: ${created.email}\nTemporary password: ${created.temp_password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeDialog = () => { setOpen(false); setCreated(null); setCopied(false); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">Promote to teacher or admin. Students are the default.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setCreated(null); }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-brand w-full sm:w-auto"><Plus className="h-4 w-4 mr-1" /> Create teacher</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{created ? "Teacher created" : "New teacher account"}</DialogTitle></DialogHeader>

            {!created ? (
              <form onSubmit={createTeacher} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="t-name">Full name</Label>
                  <Input id="t-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-email">Email</Label>
                  <Input id="t-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <p className="text-xs text-muted-foreground">A temporary password will be generated. Share it with the teacher — they should change it after first sign-in.</p>
                <DialogFooter>
                  <Button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create teacher"}</Button>
                </DialogFooter>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border bg-secondary/40 p-4 space-y-2 font-mono text-sm">
                  <div><span className="text-muted-foreground">Email:</span> {created.email}</div>
                  <div><span className="text-muted-foreground">Temporary password:</span> {created.temp_password}</div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Copy these credentials now — the password will not be shown again. Send them to the teacher securely.
                </p>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={copyCreds}>
                    {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                    {copied ? "Copied" : "Copy credentials"}
                  </Button>
                  <Button onClick={closeDialog}>Done</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 hidden md:table-header-group">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y block md:table-row-group">
            {rows.map((u) => (
              <tr key={u.id} className="block md:table-row p-4 md:p-0">
                <td className="p-3 block md:table-cell">
                  <span className="md:hidden font-bold block text-xs uppercase text-muted-foreground mb-1">Name</span>
                  {u.full_name || <span className="text-muted-foreground">—</span>}
                </td>
                <td className="p-3 block md:table-cell">
                  <span className="md:hidden font-bold block text-xs uppercase text-muted-foreground mb-1">Email</span>
                  {u.email}
                </td>
                <td className="p-3 block md:table-cell">
                  <span className="md:hidden font-bold block text-xs uppercase text-muted-foreground mb-1">Role</span>
                  <Select value={u.role} onValueChange={(v) => setRole(u.id, v as any)}>
                    <SelectTrigger className="w-full md:w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
