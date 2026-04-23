// Teacher/Admin panel: review pending enrollment requests for a class.
// Approving fires a DB trigger that auto-creates the enrollment row.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, FileText, Clock, ExternalLink } from "lucide-react";
import { format } from "date-fns";

type Req = {
  id: string;
  class_id: string;
  student_id: string;
  proof_path: string;
  status: "pending" | "approved" | "rejected";
  review_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  students?: { full_name: string; year_level: string | null; section: string | null; course: string | null } | null;
};

export default function EnrollmentRequestsPanel({ classId, onApproved }: { classId: string; onApproved?: () => void }) {
  const [requests, setRequests] = useState<Req[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});

  const load = async () => {
    const { data, error } = await supabase
      .from("enrollment_requests")
      .select("id, class_id, student_id, proof_path, status, review_notes, created_at, reviewed_at, students(full_name, year_level, section, course)")
      .eq("class_id", classId)
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setRequests((data as Req[]) ?? []);
  };

  useEffect(() => { load(); }, [classId]);

  const openProof = async (req: Req) => {
    if (proofUrls[req.id]) {
      window.open(proofUrls[req.id], "_blank");
      return;
    }
    const { data, error } = await supabase.storage.from("enrollment-proofs").createSignedUrl(req.proof_path, 300);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? "Could not open proof");
    setProofUrls((m) => ({ ...m, [req.id]: data.signedUrl }));
    window.open(data.signedUrl, "_blank");
  };

  const decide = async (req: Req, status: "approved" | "rejected") => {
    setBusy(req.id);
    const { error } = await supabase
      .from("enrollment_requests")
      .update({ status, review_notes: notes[req.id] ?? null })
      .eq("id", req.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Approved & enrolled" : "Request rejected");
    setNotes((n) => { const c = { ...n }; delete c[req.id]; return c; });
    load();
    if (status === "approved") onApproved?.();
  };

  const pending = requests.filter((r) => r.status === "pending");
  const reviewed = requests.filter((r) => r.status !== "pending");

  const renderRow = (r: Req, isPending: boolean) => {
    const StatusIcon = r.status === "approved" ? CheckCircle2 : r.status === "rejected" ? XCircle : Clock;
    const tone = r.status === "approved" ? "text-success" : r.status === "rejected" ? "text-destructive" : "text-warning";
    return (
      <div key={r.id} className="border rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <StatusIcon className={`h-5 w-5 mt-0.5 ${tone}`} />
          <div className="flex-1 min-w-0">
            <div className="font-medium">{r.students?.full_name ?? "Unknown student"}</div>
            <div className="text-xs text-muted-foreground">
              {[r.students?.course, r.students?.year_level, r.students?.section && `Sec ${r.students.section}`]
                .filter(Boolean).join(" · ")}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Submitted {format(new Date(r.created_at), "PPp")}
              {r.reviewed_at && ` · Reviewed ${format(new Date(r.reviewed_at), "PPp")}`}
            </div>
            {r.review_notes && <div className="mt-1 text-sm">Note: {r.review_notes}</div>}
          </div>
          <Button size="sm" variant="outline" onClick={() => openProof(r)}>
            <FileText className="h-4 w-4 mr-1" /> View proof <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </div>
        {isPending && (
          <div className="space-y-2">
            <Textarea
              placeholder="Optional note (visible to the student, especially useful for rejections)"
              value={notes[r.id] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
              rows={2}
            />
            <div className="flex gap-2">
              <Button size="sm" disabled={busy === r.id} onClick={() => decide(r, "approved")} className="bg-gradient-brand">
                <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
              </Button>
              <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => decide(r, "rejected")}>
                <XCircle className="h-4 w-4 mr-1" /> Reject
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="reviewed">Reviewed ({reviewed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="space-y-2 mt-3">
          {pending.length === 0 && <p className="text-sm text-muted-foreground">No pending requests.</p>}
          {pending.map((r) => renderRow(r, true))}
        </TabsContent>
        <TabsContent value="reviewed" className="space-y-2 mt-3">
          {reviewed.length === 0 && <p className="text-sm text-muted-foreground">No reviewed requests yet.</p>}
          {reviewed.map((r) => renderRow(r, false))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
