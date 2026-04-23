// Admin: platform-wide stats.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, BookOpen, ScanLine, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";

export default function AdminOverview() {
  const [stats, setStats] = useState({ users: 0, students: 0, teachers: 0, classes: 0, sessions: 0, records: 0 });

  useEffect(() => {
    (async () => {
      const [u, s, t, c, ss, r] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "teacher"),
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase.from("attendance_sessions").select("id", { count: "exact", head: true }),
        supabase.from("attendance_records").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        users: u.count ?? 0, students: t.count !== null ? s.count ?? 0 : 0,
        teachers: t.count ?? 0, classes: c.count ?? 0, sessions: ss.count ?? 0, records: r.count ?? 0,
      });
    })();
  }, []);

  const cards = [
    { label: "Users", value: stats.users, icon: Users, color: "text-brand" },
    { label: "Students", value: stats.students, icon: Users, color: "text-accent-teal" },
    { label: "Teachers", value: stats.teachers, icon: Users, color: "text-brand-glow" },
    { label: "Classes", value: stats.classes, icon: BookOpen, color: "text-success" },
    { label: "Sessions", value: stats.sessions, icon: ScanLine, color: "text-warning" },
    { label: "Attendance records", value: stats.records, icon: BarChart3, color: "text-brand" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold">Admin dashboard</h1>
        <p className="text-muted-foreground">Platform overview.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4 sm:p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</div>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <div className="font-display text-2xl sm:text-3xl font-bold mt-2 truncate">{c.value}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/admin/users" className="rounded-xl border bg-card p-4 sm:p-6 shadow-card hover:shadow-elegant transition-shadow">
          <Users className="h-8 w-8 text-brand mb-2" />
          <h3 className="font-display font-semibold">Manage users</h3>
          <p className="text-sm text-muted-foreground">Promote teachers, remove users, edit profiles.</p>
        </Link>
        <Link to="/admin/analytics" className="rounded-xl border bg-card p-4 sm:p-6 shadow-card hover:shadow-elegant transition-shadow">
          <BarChart3 className="h-8 w-8 text-accent-teal mb-2" />
          <h3 className="font-display font-semibold">Analytics</h3>
          <p className="text-sm text-muted-foreground">Attendance trends across all classes.</p>
        </Link>
      </div>
    </div>
  );
}
