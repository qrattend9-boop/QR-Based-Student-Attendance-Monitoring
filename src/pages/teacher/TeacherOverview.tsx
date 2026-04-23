// Teacher overview: classes, active session, quick links.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { BookOpen, ScanLine, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TeacherOverview() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: cs } = await supabase.from("classes").select("*").eq("teacher_id", user.id).order("created_at", { ascending: false });
      setClasses(cs ?? []);
      const { data: ss } = await supabase.from("attendance_sessions").select("*, classes(name)").eq("teacher_id", user.id).eq("is_active", true);
      setActiveSessions(ss ?? []);
    })();
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-3xl font-bold">Teacher dashboard</h1>
          <p className="text-muted-foreground">Manage classes and run attendance.</p>
        </div>
        <Button asChild className="bg-gradient-brand">
          <Link to="/teacher/classes"><Plus className="h-4 w-4 mr-1" /> New class</Link>
        </Button>
      </div>

      {activeSessions.length > 0 && (
        <div className="rounded-xl border bg-card p-6 shadow-elegant border-brand/30">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <h3 className="font-semibold">Active session</h3>
          </div>
          {activeSessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium">{s.classes?.name}</div>
                <div className="text-xs text-muted-foreground">Started {new Date(s.started_at).toLocaleTimeString()}</div>
              </div>
              <Button asChild><Link to={`/teacher/scan?session=${s.id}`}><ScanLine className="h-4 w-4 mr-1" /> Scan</Link></Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.length === 0 ? (
          <div className="md:col-span-2 lg:col-span-3 rounded-xl border border-dashed bg-card p-10 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-display font-semibold">No classes yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create a class to upload your roster and start sessions.</p>
            <Button asChild><Link to="/teacher/classes">Create your first class</Link></Button>
          </div>
        ) : classes.map((c) => (
          <Link key={c.id} to={`/teacher/classes/${c.id}`} className="rounded-xl border bg-card p-5 shadow-card hover:shadow-elegant transition-shadow">
            <div className="text-xs text-muted-foreground">{c.code || "Class"}</div>
            <div className="font-display font-semibold text-lg mt-1">{c.name}</div>
            {c.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
