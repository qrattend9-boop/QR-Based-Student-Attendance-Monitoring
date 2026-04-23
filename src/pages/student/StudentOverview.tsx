// Student overview: shows profile status, recent attendance, attendance rate.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { QrCode, UserCircle, CheckCircle2, AlertCircle } from "lucide-react";

interface Stats { total: number; present: number; late: number; absent: number; }

export default function StudentOverview() {
  const { user } = useAuth();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, present: 0, late: 0, absent: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: student } = await supabase.from("students").select("id").eq("user_id", user.id).maybeSingle();
      setHasProfile(!!student);
      if (student) {
        const { data: records } = await supabase.from("attendance_records").select("status").eq("student_id", student.id);
        if (records) {
          setStats({
            total: records.length,
            present: records.filter(r => r.status === "present").length,
            late: records.filter(r => r.status === "late").length,
            absent: records.filter(r => r.status === "absent").length,
          });
        }
      }
    })();
  }, [user]);

  const pct = stats.total === 0 ? 0 : Math.round(((stats.present + stats.late) / stats.total) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Welcome back</h1>
        <p className="text-muted-foreground">Your attendance at a glance.</p>
      </div>

      {hasProfile === false && (
        <div className="rounded-xl border bg-card p-6 shadow-card flex items-start gap-4">
          <AlertCircle className="h-6 w-6 text-warning shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold">Finish your registration</h3>
            <p className="text-sm text-muted-foreground">We need your year, section, and course to generate your attendance QR code.</p>
          </div>
          <Button asChild><Link to="/student/profile">Complete profile</Link></Button>
        </div>
      )}

      <div className="grid md:grid-cols-4 gap-4">
        {[
          { label: "Attendance rate", value: `${pct}%`, accent: "text-brand" },
          { label: "Present", value: stats.present, accent: "text-success" },
          { label: "Late", value: stats.late, accent: "text-warning" },
          { label: "Absent", value: stats.absent, accent: "text-destructive" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-5 shadow-card">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</div>
            <div className={`font-display text-3xl font-bold mt-1 ${s.accent}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Link to="/student/qr" className="rounded-xl border bg-card p-6 shadow-card hover:shadow-elegant transition-shadow">
          <QrCode className="h-8 w-8 text-brand mb-3" />
          <h3 className="font-display font-semibold text-lg">My QR Code</h3>
          <p className="text-sm text-muted-foreground">Show this to your teacher for attendance.</p>
        </Link>
        <Link to="/student/profile" className="rounded-xl border bg-card p-6 shadow-card hover:shadow-elegant transition-shadow">
          <UserCircle className="h-8 w-8 text-teal mb-3" />
          <h3 className="font-display font-semibold text-lg">My Profile</h3>
          <p className="text-sm text-muted-foreground">Update your year, section, and course.</p>
        </Link>
      </div>

      {stats.total > 0 && (
        <div className="rounded-xl border bg-card p-6 shadow-card flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <span className="text-sm">You have <strong>{stats.total}</strong> attendance records so far.</span>
        </div>
      )}
    </div>
  );
}
