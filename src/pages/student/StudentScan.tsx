// Student-side: scan the teacher's session QR to mark attendance.
// Calls the `student_check_in` RPC which validates enrollment, auto-closes expired sessions,
// and inserts a present/late record on the student's behalf.
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, Clock, Camera, XCircle } from "lucide-react";

type Result = { status: "present" | "late" | "absent"; className: string; ts: Date };

export default function StudentScan() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);

  const stop = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); await scannerRef.current.clear(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const handle = async (text: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc("student_check_in", { _session_code: text.trim() });
      if (rpcErr) throw rpcErr;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("No response from server");
      setResult({ status: row.status, className: row.class_name ?? "", ts: new Date() });
      toast.success(`Marked ${row.status} for ${row.class_name ?? "class"}`);
      await stop();
    } catch (err: any) {
      const msg = err?.message ?? "Check-in failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setTimeout(() => { busyRef.current = false; }, 1500);
    }
  };

  const start = async () => {
    setScanning(true); setError(null); setResult(null);
    try {
      const scanner = new Html5Qrcode("student-qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (text) => handle(text),
        () => {}
      );
    } catch (err: any) {
      setScanning(false);
      toast.error(err.message ?? "Could not start camera");
    }
  };

  useEffect(() => () => { stop(); }, []);

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl font-bold">Check in</h1>
        <p className="text-muted-foreground">Point your camera at the session QR shown by your teacher.</p>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-card">
        <div className="relative rounded-lg overflow-hidden min-h-[280px] bg-black/5">
          <div id="student-qr-reader" className="w-full" />
          {!scanning && !result && (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground text-sm pointer-events-none text-center">
              <div><Camera className="h-8 w-8 mx-auto mb-2" />Camera off</div>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-3">
          {!scanning ? <Button onClick={start} className="bg-gradient-brand">Start camera</Button> : <Button onClick={stop} variant="outline">Stop camera</Button>}
        </div>
      </div>

      {result && (
        <div className={`rounded-xl border p-6 shadow-card ${result.status === "present" ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"}`}>
          <div className="flex items-center gap-3">
            {result.status === "present"
              ? <CheckCircle2 className="h-8 w-8 text-success" />
              : <Clock className="h-8 w-8 text-warning" />}
            <div>
              <div className="font-display text-lg font-semibold capitalize">{result.status}</div>
              <div className="text-sm text-muted-foreground">{result.className} · {result.ts.toLocaleTimeString()}</div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm flex gap-2 items-start">
          <XCircle className="h-5 w-5 text-destructive shrink-0" />
          <div>{error}</div>
        </div>
      )}
    </div>
  );
}
