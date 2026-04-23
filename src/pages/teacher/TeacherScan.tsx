// Teacher: QR scanner page. Uses html5-qrcode. Camera-based live scanning.
import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Camera } from "lucide-react";

type ScanResult = { name: string; status: "present" | "late" | "duplicate" | "unknown"; ts: Date };

export default function TeacherScan() {
  const [params] = useSearchParams();
  const sessionId = params.get("session");
  const [session, setSession] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    supabase.from("attendance_sessions").select("*, classes(name)").eq("id", sessionId).single()
      .then(({ data }) => setSession(data));
  }, [sessionId]);

  // Auto-stop the camera when session.auto_close_at passes (or when teacher closes session elsewhere).
  useEffect(() => {
    if (!session?.auto_close_at) return;
    const remaining = new Date(session.auto_close_at).getTime() - Date.now();
    if (remaining <= 0) { stop(); toast.info("Session auto-closed"); return; }
    const t = setTimeout(() => { stop(); toast.info("Session auto-closed"); }, remaining + 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const handleScan = async (token: string) => {
    if (busyRef.current || !sessionId || !session) return;
    busyRef.current = true;
    try {
      // 1. Find student by qr_token
      const { data: student } = await supabase.from("students").select("id, full_name").eq("qr_token", token).maybeSingle();
      if (!student) {
        setResults((r) => [{ name: "Unknown QR", status: "unknown", ts: new Date() }, ...r]);
        return;
      }
      // 2. Verify enrollment in this class — student must have an approved enrollment request.
      const { data: enrollment } = await supabase.from("enrollments").select("id")
        .eq("class_id", session.class_id).eq("student_id", student.id).maybeSingle();
      if (!enrollment) {
        setResults((r) => [{ name: `${student.full_name} (not enrolled — needs proof approval)`, status: "unknown", ts: new Date() }, ...r]);
        toast.error(`${student.full_name} has not been approved for this class`);
        return;
      }
      // 3. Prevent duplicate
      const { data: existing } = await supabase.from("attendance_records").select("id").eq("session_id", sessionId).eq("student_id", student.id).maybeSingle();
      if (existing) {
        setResults((r) => [{ name: student.full_name, status: "duplicate", ts: new Date() }, ...r]);
        return;
      }
      // 4. Determine Present vs Late
      const startedAt = new Date(session.started_at).getTime();
      const now = Date.now();
      const lateMs = (session.late_after_minutes ?? 15) * 60_000;
      const status: "present" | "late" = now - startedAt > lateMs ? "late" : "present";
      const { error } = await supabase.from("attendance_records").insert([{ session_id: sessionId, student_id: student.id, status }]);
      if (error) throw error;
      setResults((r) => [{ name: student.full_name, status, ts: new Date() }, ...r]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTimeout(() => { busyRef.current = false; }, 1200); // debounce
    }
  };

  const start = async () => {
    setScanning(true);
    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (text) => handleScan(text),
        () => {}
      );
    } catch (err: any) {
      setScanning(false);
      toast.error(err.message ?? "Could not start camera");
    }
  };

  const stop = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); await scannerRef.current.clear(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => () => { stop(); }, []);

  if (!sessionId) return (
    <div className="rounded-xl border bg-card p-8 shadow-card text-center">
      <h2 className="font-display text-xl font-semibold mb-2">No session selected</h2>
      <p className="text-sm text-muted-foreground mb-4">Start a session from a class to scan.</p>
      <Button asChild><Link to="/teacher/classes">Go to classes</Link></Button>
    </div>
  );

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl font-bold">Scan attendance</h1>
        {session && <p className="text-muted-foreground">{session.classes?.name} · {session.title}</p>}
      </div>
      <div className="rounded-xl border bg-card p-4 shadow-card">
        {/* Wrapper holds the placeholder; #qr-reader stays empty so React never owns html5-qrcode's nodes */}
        <div className="relative rounded-lg overflow-hidden min-h-[280px] bg-black/5">
          <div id="qr-reader" className="w-full" />
          {!scanning && (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground text-sm pointer-events-none">
              <div><Camera className="h-8 w-8 mx-auto mb-2" />Camera off</div>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-3">
          {!scanning ? <Button onClick={start} className="bg-gradient-brand">Start camera</Button> : <Button onClick={stop} variant="outline">Stop camera</Button>}
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <div className="p-3 border-b font-medium">Recent scans</div>
        <div className="divide-y max-h-80 overflow-auto">
          {results.length === 0 && <div className="p-4 text-sm text-muted-foreground">Scans will appear here.</div>}
          {results.map((r, i) => {
            const { icon: Icon, color, label } =
              r.status === "present" ? { icon: CheckCircle2, color: "text-success", label: "Present" } :
              r.status === "late"    ? { icon: Clock,        color: "text-warning", label: "Late" } :
              r.status === "duplicate" ? { icon: CheckCircle2, color: "text-muted-foreground", label: "Already scanned" } :
                                      { icon: XCircle,      color: "text-destructive", label: "Unknown" };
            return (
              <div key={i} className="flex items-center gap-3 p-3">
                <Icon className={`h-5 w-5 ${color}`} />
                <div className="flex-1">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.ts.toLocaleTimeString()}</div>
                </div>
                <span className={`text-xs font-medium ${color}`}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
