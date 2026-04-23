// Teacher: single-class detail. CSV roster upload + sessions + reports + attendance %.
import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Papa from "papaparse";
import QRCode from "qrcode";
import { Upload, Play, Square, ScanLine, Download, Users, Timer } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, formatDistanceToNowStrict } from "date-fns";
import EnrollmentRequestsPanel from "@/components/teacher/EnrollmentRequestsPanel";

export default function TeacherClassDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [cls, setCls] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [lateMin, setLateMin] = useState(15);
  const [durationMin, setDurationMin] = useState(60);
  const [sessionTitle, setSessionTitle] = useState("");
  const [now, setNow] = useState(Date.now());
  const fileRef = useRef<HTMLInputElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Tick every second so the countdown updates and we can auto-close the active session client-side.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    if (!id) return;
    const [c, e, s, r] = await Promise.all([
      supabase.from("classes").select("*").eq("id", id).maybeSingle(),
      supabase.from("enrollments").select("*, students(full_name, year_level, section, course)").eq("class_id", id).order("full_name"),
      supabase.from("attendance_sessions").select("*").eq("class_id", id).order("started_at", { ascending: false }),
      supabase.from("attendance_records").select("*, students(full_name), attendance_sessions!inner(class_id, started_at, title)").eq("attendance_sessions.class_id", id),
    ]);
    setCls(c.data);
    setEnrollments(e.data ?? []);
    setSessions(s.data ?? []);
    setRecords(r.data ?? []);
  };
  useEffect(() => { load(); }, [id]);

  // Parse and upload CSV roster. Supports "Full Name" or single column.
  const onCsv = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: true,
      complete: async (res) => {
        const names = new Set<string>();
        for (const row of res.data) {
          const name = (row["Full Name"] ?? row["full_name"] ?? row["name"] ?? Object.values(row)[0] ?? "").toString().trim();
          if (name.length >= 2 && name.length <= 100) names.add(name);
        }
        if (names.size === 0) { toast.error("No valid names found"); return; }
        const rows = Array.from(names).map((n) => ({ class_id: id!, full_name: n }));
        const { error } = await supabase.from("enrollments").upsert(rows, { onConflict: "class_id,full_name", ignoreDuplicates: true });
        if (error) return toast.error(error.message);
        toast.success(`Imported ${names.size} students`);
        load();
      },
      error: (err) => toast.error(err.message),
    });
  };

  const startSession = async () => {
    if (!user || !id) return;
    const startedAt = new Date();
    const autoCloseAt = durationMin > 0 ? new Date(startedAt.getTime() + durationMin * 60_000) : null;
    const { error } = await supabase.from("attendance_sessions").insert([{
      class_id: id, teacher_id: user.id,
      title: sessionTitle || `Session ${startedAt.toLocaleDateString()}`,
      late_after_minutes: lateMin,
      started_at: startedAt.toISOString(),
      auto_close_at: autoCloseAt ? autoCloseAt.toISOString() : null,
    }]);
    if (error) return toast.error(error.message);
    toast.success(autoCloseAt ? `Session started · auto-closes in ${durationMin} min` : "Session started");
    setSessionTitle("");
    load();
  };

  const endSession = async (sid: string, opts: { silent?: boolean } = {}) => {
    // Mark session ended; then create absent records for un-scanned enrollees.
    const { data: sess } = await supabase.from("attendance_sessions").select("*").eq("id", sid).single();
    if (!sess) return;
    if (!sess.is_active) return; // already closed
    const { data: existing } = await supabase.from("attendance_records").select("student_id").eq("session_id", sid);
    const already = new Set((existing ?? []).map((r) => r.student_id));
    const absents = enrollments
      .filter((en) => en.student_id && !already.has(en.student_id))
      .map((en) => ({ session_id: sid, student_id: en.student_id, status: "absent" as const }));
    if (absents.length) await supabase.from("attendance_records").insert(absents);
    await supabase.from("attendance_sessions").update({ is_active: false, ended_at: new Date().toISOString() }).eq("id", sid);
    if (opts.silent) toast.info("Session auto-closed");
    else toast.success("Session ended");
    load();
  };

  // Auto-close the active session client-side once auto_close_at is reached.
  useEffect(() => {
    const active = sessions.find((s) => s.is_active && s.auto_close_at);
    if (!active) return;
    const remainingMs = new Date(active.auto_close_at).getTime() - Date.now();
    if (remainingMs <= 0) { endSession(active.id, { silent: true }); return; }
    const t = setTimeout(() => endSession(active.id, { silent: true }), remainingMs + 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  // Render the session QR (encodes session_code) onto the canvas whenever the active session changes.
  useEffect(() => {
    const active = sessions.find((s) => s.is_active);
    if (active && qrCanvasRef.current && active.session_code) {
      QRCode.toCanvas(qrCanvasRef.current, active.session_code, {
        width: 240, margin: 2,
        color: { dark: "#1e1b4b", light: "#ffffff" },
      });
    }
  }, [sessions]);

  // Attendance % per enrolled student (present + late) / total sessions
  const stats = enrollments.map((en) => {
    const studentRecords = records.filter((r) => r.student_id === en.student_id);
    const attended = studentRecords.filter((r) => r.status === "present" || r.status === "late").length;
    const pct = sessions.length === 0 ? 0 : Math.round((attended / sessions.length) * 100);
    return { name: en.full_name, linked: !!en.student_id, attended, pct };
  });

  const exportCsv = (scope: "all" | "week" | "month") => {
    const now = new Date();
    const cutoff = scope === "week" ? new Date(now.getTime() - 7 * 864e5) : scope === "month" ? new Date(now.getTime() - 30 * 864e5) : null;
    const filteredSessions = sessions
      .filter((s) => !cutoff || new Date(s.started_at) >= cutoff)
      .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());

    // One row per (student × session) with date + per-status marks (X) so teachers can scan a register-style sheet.
    const rows = enrollments.flatMap((en) =>
      filteredSessions.map((s) => {
        const rec = records.find((r) => r.session_id === s.id && r.student_id === en.student_id);
        const status = rec?.status ?? (en.student_id ? "absent" : "");
        return {
          date: format(new Date(s.started_at), "yyyy-MM-dd"),
          time: format(new Date(s.started_at), "HH:mm"),
          session: s.title ?? "",
          student: en.full_name,
          present: status === "present" ? "X" : "",
          late: status === "late" ? "X" : "",
          absent: status === "absent" ? "X" : "",
          status,
          scanned_at: rec ? format(new Date(rec.scanned_at), "yyyy-MM-dd HH:mm") : "",
        };
      })
    );
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${cls?.name ?? "class"}-${scope}-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!cls) return <div>Loading...</div>;
  const activeSession = sessions.find((s) => s.is_active);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/teacher/classes" className="text-sm text-muted-foreground hover:text-foreground">← Classes</Link>
        <h1 className="font-display text-3xl font-bold mt-1">{cls.name}</h1>
        <p className="text-muted-foreground">{cls.code} {cls.description && `· ${cls.description}`}</p>
      </div>

      <Tabs defaultValue="session">
        <TabsList>
          <TabsTrigger value="session">Session</TabsTrigger>
          <TabsTrigger value="roster">Roster ({enrollments.length})</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="session" className="space-y-4">
          {activeSession ? (
            <div className="rounded-xl border bg-card p-6 shadow-elegant border-brand/30 grid md:grid-cols-[1fr_auto] gap-6 items-start">
              <div>
                <div className="flex items-center gap-2 mb-2"><span className="h-2 w-2 rounded-full bg-success animate-pulse" /><span className="text-sm font-medium">Active session</span></div>
                <div className="font-display text-xl font-semibold">{activeSession.title}</div>
                <div className="text-sm text-muted-foreground">Started {format(new Date(activeSession.started_at), "PPpp")} · Late after {activeSession.late_after_minutes} min</div>
                {activeSession.auto_close_at && (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-warning/10 text-warning px-3 py-1 text-sm">
                    <Timer className="h-4 w-4" />
                    {new Date(activeSession.auto_close_at).getTime() - now > 0
                      ? <>Auto-closes in {formatDistanceToNowStrict(new Date(activeSession.auto_close_at))}</>
                      : <>Closing…</>}
                  </div>
                )}
                <div className="flex gap-2 mt-4 flex-wrap">
                  <Button asChild className="bg-gradient-brand"><Link to={`/teacher/scan?session=${activeSession.id}`}><ScanLine className="h-4 w-4 mr-1" /> Open scanner</Link></Button>
                  <Button variant="outline" onClick={() => endSession(activeSession.id)}><Square className="h-4 w-4 mr-1" /> End session now</Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">Students can also self check-in by scanning the session QR →</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <canvas ref={qrCanvasRef} className="rounded-lg border bg-white p-2" />
                <span className="text-xs text-muted-foreground">Session QR</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-6 shadow-card space-y-3">
              <h3 className="font-display font-semibold">Start a new session</h3>
              <div className="grid sm:grid-cols-3 gap-3">
                <div><Label>Title</Label><Input value={sessionTitle} onChange={(e) => setSessionTitle(e.target.value)} placeholder="e.g. Week 5 Lecture" /></div>
                <div><Label>Late after (minutes)</Label><Input type="number" min={0} value={lateMin} onChange={(e) => setLateMin(parseInt(e.target.value) || 0)} /></div>
                <div><Label>Auto-close after (minutes)</Label><Input type="number" min={0} value={durationMin} onChange={(e) => setDurationMin(parseInt(e.target.value) || 0)} /></div>
              </div>
              <p className="text-xs text-muted-foreground">Set 0 to keep open until manually ended.</p>
              <Button onClick={startSession} className="bg-gradient-brand"><Play className="h-4 w-4 mr-1" /> Start session</Button>
            </div>
          )}

          <div className="rounded-xl border bg-card p-6 shadow-card">
            <h3 className="font-display font-semibold mb-3">Past sessions</h3>
            <div className="space-y-2">
              {sessions.filter((s) => !s.is_active).map((s) => {
                const sessRecs = records.filter((r) => r.session_id === s.id);
                const p = sessRecs.filter((r) => r.status === "present").length;
                const l = sessRecs.filter((r) => r.status === "late").length;
                const a = sessRecs.filter((r) => r.status === "absent").length;
                return (
                  <div key={s.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <div className="font-medium">{s.title}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(s.started_at), "PP")}</div>
                    </div>
                    <div className="text-sm flex gap-3">
                      <span className="text-success">{p} present</span>
                      <span className="text-warning">{l} late</span>
                      <span className="text-destructive">{a} absent</span>
                    </div>
                  </div>
                );
              })}
              {sessions.filter((s) => !s.is_active).length === 0 && <p className="text-sm text-muted-foreground">No past sessions.</p>}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="roster" className="space-y-4">
          <div className="rounded-xl border bg-card p-6 shadow-card">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <h3 className="font-display font-semibold">Upload roster</h3>
                <p className="text-sm text-muted-foreground">CSV with a "Full Name" column. Duplicates are skipped.</p>
              </div>
              <div>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && onCsv(e.target.files[0])} />
                <Button onClick={() => fileRef.current?.click()} variant="outline"><Upload className="h-4 w-4 mr-1" /> Upload CSV</Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">Sample: <code>Full Name\nAlex Santos\nJamie Cruz</code></div>
          </div>

          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <div className="p-4 flex items-center gap-2 border-b"><Users className="h-4 w-4" /><strong>{enrollments.length}</strong> students</div>
            <div className="divide-y">
              {enrollments.map((en) => (
                <div key={en.id} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{en.full_name}</div>
                    {en.students && <div className="text-xs text-muted-foreground">{en.students.course} · {en.students.year_level} · Sec {en.students.section}</div>}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${en.student_id ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                    {en.student_id ? "Linked" : "Unlinked"}
                  </span>
                </div>
              ))}
              {enrollments.length === 0 && <p className="p-4 text-sm text-muted-foreground">No students yet. Upload a CSV.</p>}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="requests" className="space-y-3">
          <div className="rounded-xl border bg-card p-4 shadow-card">
            <h3 className="font-display font-semibold mb-1">Enrollment requests</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Students request to join by uploading their Certificate of Enrollment. Approving a request adds them to the roster automatically.
            </p>
            {id && <EnrollmentRequestsPanel classId={id} onApproved={load} />}
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => exportCsv("all")}><Download className="h-4 w-4 mr-1" /> All</Button>
            <Button variant="outline" onClick={() => exportCsv("week")}><Download className="h-4 w-4 mr-1" /> Last 7 days</Button>
            <Button variant="outline" onClick={() => exportCsv("month")}><Download className="h-4 w-4 mr-1" /> Last 30 days</Button>
          </div>
          <p className="text-xs text-muted-foreground">CSV includes the session date and Present / Late / Absent marks for every student.</p>

          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <div className="p-3 border-b font-medium">Attendance summary</div>
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr><th className="text-left p-3">Student</th><th className="text-left p-3">Attended</th><th className="text-left p-3">%</th></tr>
              </thead>
              <tbody className="divide-y">
                {stats.map((s, i) => (
                  <tr key={i}>
                    <td className="p-3">{s.name} {!s.linked && <span className="text-xs text-muted-foreground">(unlinked)</span>}</td>
                    <td className="p-3">{s.attended} / {sessions.length}</td>
                    <td className="p-3 font-medium" style={{ color: s.pct >= 80 ? "hsl(var(--success))" : s.pct >= 50 ? "hsl(var(--warning))" : "hsl(var(--destructive))" }}>{s.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <div className="p-3 border-b font-medium">Daily register</div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Session</th>
                    <th className="text-left p-3">Student</th>
                    <th className="text-center p-3">Present</th>
                    <th className="text-center p-3">Late</th>
                    <th className="text-center p-3">Absent</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sessions.length === 0 && (
                    <tr><td colSpan={6} className="p-4 text-sm text-muted-foreground text-center">No sessions yet.</td></tr>
                  )}
                  {[...sessions]
                    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
                    .flatMap((s) =>
                      enrollments.map((en) => {
                        const rec = records.find((r) => r.session_id === s.id && r.student_id === en.student_id);
                        const status = rec?.status ?? (en.student_id ? "absent" : "");
                        return (
                          <tr key={`${s.id}-${en.id}`}>
                            <td className="p-3 whitespace-nowrap">{format(new Date(s.started_at), "PP")}</td>
                            <td className="p-3">{s.title}</td>
                            <td className="p-3">{en.full_name}</td>
                            <td className="p-3 text-center text-success font-semibold">{status === "present" ? "✓" : ""}</td>
                            <td className="p-3 text-center text-warning font-semibold">{status === "late" ? "✓" : ""}</td>
                            <td className="p-3 text-center text-destructive font-semibold">{status === "absent" ? "✓" : ""}</td>
                          </tr>
                        );
                      })
                    )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
