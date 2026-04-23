// Student QR code page. QR encodes the unique qr_token (not PII).
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";

export default function StudentQR() {
  const { user } = useAuth();
  const [student, setStudent] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("students").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setStudent(data));
  }, [user]);

  useEffect(() => {
    if (student && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, student.qr_token, {
        width: 320, margin: 2,
        color: { dark: "#1e1b4b", light: "#ffffff" },
      });
    }
  }, [student]);

  const download = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `qr-${student.full_name.replace(/\s+/g, "_")}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  if (!student) {
    return (
      <div className="max-w-md rounded-xl border bg-card p-8 shadow-card text-center">
        <h2 className="font-display text-xl font-semibold mb-2">Create your profile first</h2>
        <p className="text-sm text-muted-foreground mb-4">You need a student profile before we can generate your QR.</p>
        <Button asChild><Link to="/student/profile">Go to profile</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <h1 className="font-display text-3xl font-bold mb-1">My QR code</h1>
      <p className="text-muted-foreground mb-6">Show this during attendance. The teacher's camera does the rest.</p>
      <div className="rounded-2xl border bg-card p-8 shadow-card flex flex-col items-center">
        <canvas ref={canvasRef} className="rounded-lg" />
        <div className="mt-6 text-center">
          <div className="font-display font-semibold text-lg">{student.full_name}</div>
          <div className="text-sm text-muted-foreground">{student.course} · {student.year_level} · Section {student.section}</div>
        </div>
        <Button onClick={download} className="mt-6 w-full" variant="outline">
          <Download className="h-4 w-4 mr-2" /> Download PNG
        </Button>
      </div>
    </div>
  );
}
