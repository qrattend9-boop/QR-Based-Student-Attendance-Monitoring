// Student "Join class" page.
// Students browse classes or enter a class code, upload a Certificate of Enrollment (PDF/JPG/PNG, ≤5MB),
// and submit an enrollment_request. Teachers/admins approve or reject; on approval an enrollment row is
// auto-created by a DB trigger, which lets the student check in via the session QR.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, Search, BookOpen, Clock, CheckCircle2, XCircle, FileText } from "lucide-react";
import { format } from "date-fns";

type ClassRow = { id: string; name: string; code: string | null; description: string | null };
type RequestRow = {
  id: string;
  class_id: string;
  status: "pending" | "approved" | "rejected";
  proof_path: string;
  review_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  classes?: { name: string; code: string | null } | null;
};

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export default function StudentJoin() {
  const { user } = useAuth();
  const [student, setStudent] = useState<any>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [enrolledClassIds, setEnrolledClassIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [code, setCode] = useState("");
  const [selectedClass, setSelectedClass] = useState<ClassRow | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    const { data: s } = await supabase.from("students").select("*").eq("user_id", user.id).maybeSingle();
    setStudent(s);
    const [{ data: c }, reqRes, enrRes] = await Promise.all([
      supabase.from("classes").select("id, name, code, description").order("name"),
      s ? supabase
        .from("enrollment_requests")
        .select("id, class_id, status, proof_path, review_notes, created_at, reviewed_at, classes(name, code)")
        .eq("student_id", s.id)
        .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as RequestRow[] }),
      s ? supabase.from("enrollments").select("class_id").eq("student_id", s.id) : Promise.resolve({ data: [] as { class_id: string }[] }),
    ]);
    setClasses(c ?? []);
    setRequests((reqRes.data as RequestRow[]) ?? []);
    setEnrolledClassIds(new Set(((enrRes.data as { class_id: string }[]) ?? []).map((e) => e.class_id)));
  };

  useEffect(() => { load(); }, [user]);

  const pendingClassIds = useMemo(
    () => new Set(requests.filter((r) => r.status === "pending").map((r) => r.class_id)),
    [requests]
  );

  const filteredClasses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.code ?? "").toLowerCase().includes(q)
    );
  }, [classes, search]);

  const findByCode = () => {
    const q = code.trim().toLowerCase();
    if (!q) return;
    const match = classes.find((c) => (c.code ?? "").toLowerCase() === q);
    if (!match) return toast.error("No class found with that code");
    setSelectedClass(match);
  };

  const validateAndSetFile = (f: File | null) => {
    if (!f) { setFile(null); return; }
    if (!ALLOWED.includes(f.type)) { toast.error("Only PDF, JPG, PNG, or WEBP allowed"); return; }
    if (f.size > MAX_BYTES) { toast.error("File must be ≤ 5MB"); return; }
    setFile(f);
  };

  const submit = async () => {
    if (!student) return toast.error("Create your student profile first");
    if (!selectedClass) return toast.error("Select a class");
    if (!file) return toast.error("Upload your certificate of enrollment");
    if (enrolledClassIds.has(selectedClass.id)) return toast.error("You are already enrolled in this class");
    if (pendingClassIds.has(selectedClass.id)) return toast.error("You already have a pending request for this class");

    setSubmitting(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${student.id}/${selectedClass.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("enrollment-proofs")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("enrollment_requests").insert([{
        class_id: selectedClass.id,
        student_id: student.id,
        proof_path: path,
        status: "pending",
      }]);
      if (insErr) {
        // best-effort cleanup
        await supabase.storage.from("enrollment-proofs").remove([path]);
        throw insErr;
      }
      toast.success("Request submitted. Wait for your teacher to approve.");
      setSelectedClass(null);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Could not submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (req: RequestRow) => {
    const { error } = await supabase.from("enrollment_requests").delete().eq("id", req.id);
    if (error) return toast.error(error.message);
    await supabase.storage.from("enrollment-proofs").remove([req.proof_path]);
    toast.success("Request cancelled");
    load();
  };

  if (!student) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-card text-center max-w-xl">
        <h2 className="font-display text-xl font-semibold mb-2">Create your profile first</h2>
        <p className="text-sm text-muted-foreground mb-4">We need your name, year level, course, and section before you can join a class.</p>
        <Button asChild className="bg-gradient-brand"><Link to="/student/profile">Go to profile</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-bold">Join a class</h1>
        <p className="text-muted-foreground">Submit your Certificate of Enrollment to be added to a class.</p>
      </div>

      <Tabs defaultValue="browse">
        <TabsList>
          <TabsTrigger value="browse">Browse classes</TabsTrigger>
          <TabsTrigger value="code">Enter class code</TabsTrigger>
          <TabsTrigger value="requests">My requests ({requests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-3">
          <div className="rounded-xl border bg-card p-4 shadow-card">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by class name or code" className="pl-9" />
            </div>
          </div>
          <div className="rounded-xl border bg-card shadow-card divide-y max-h-96 overflow-auto">
            {filteredClasses.length === 0 && <p className="p-4 text-sm text-muted-foreground">No classes found.</p>}
            {filteredClasses.map((c) => {
              const enrolled = enrolledClassIds.has(c.id);
              const pending = pendingClassIds.has(c.id);
              return (
                <div key={c.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium flex items-center gap-2"><BookOpen className="h-4 w-4 text-muted-foreground" />{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.code ?? "No code"} {c.description && `· ${c.description}`}</div>
                  </div>
                  {enrolled ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-success/10 text-success whitespace-nowrap">Enrolled</span>
                  ) : pending ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-warning/10 text-warning whitespace-nowrap">Pending</span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setSelectedClass(c)}>Request to join</Button>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="code" className="space-y-3">
          <div className="rounded-xl border bg-card p-6 shadow-card space-y-3">
            <Label>Class code</Label>
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. CS101-A4" />
              <Button onClick={findByCode} variant="outline">Find</Button>
            </div>
            {selectedClass && (
              <p className="text-sm text-muted-foreground">Selected: <strong className="text-foreground">{selectedClass.name}</strong></p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="requests" className="space-y-2">
          {requests.length === 0 && (
            <div className="rounded-xl border bg-card p-6 shadow-card text-sm text-muted-foreground">
              You have no requests yet.
            </div>
          )}
          {requests.map((r) => {
            const StatusIcon = r.status === "approved" ? CheckCircle2 : r.status === "rejected" ? XCircle : Clock;
            const tone = r.status === "approved" ? "text-success" : r.status === "rejected" ? "text-destructive" : "text-warning";
            return (
              <div key={r.id} className="rounded-xl border bg-card p-4 shadow-card flex items-start gap-3">
                <StatusIcon className={`h-5 w-5 mt-0.5 ${tone}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{r.classes?.name ?? "Class"}</div>
                  <div className="text-xs text-muted-foreground">
                    Submitted {format(new Date(r.created_at), "PPp")}
                    {r.reviewed_at && ` · Reviewed ${format(new Date(r.reviewed_at), "PPp")}`}
                  </div>
                  {r.review_notes && <div className="mt-1 text-sm">Note: {r.review_notes}</div>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                    r.status === "approved" ? "bg-success/10 text-success" :
                    r.status === "rejected" ? "bg-destructive/10 text-destructive" :
                    "bg-warning/10 text-warning"
                  }`}>{r.status}</span>
                  {r.status === "pending" && (
                    <Button size="sm" variant="ghost" onClick={() => cancelRequest(r)}>Cancel</Button>
                  )}
                </div>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* Submission panel — appears once a class is selected */}
      {selectedClass && !enrolledClassIds.has(selectedClass.id) && !pendingClassIds.has(selectedClass.id) && (
        <div className="rounded-xl border bg-card p-6 shadow-elegant border-brand/30 space-y-4">
          <div>
            <h3 className="font-display font-semibold">Submit request for {selectedClass.name}</h3>
            <p className="text-sm text-muted-foreground">Upload your Certificate of Enrollment — PDF, JPG, PNG, or WEBP, max 5MB.</p>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => validateAndSetFile(e.target.files?.[0] ?? null)}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> {file ? "Change file" : "Choose file"}
            </Button>
            {file && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-md border bg-secondary/40 px-3 py-1.5 text-sm">
                <FileText className="h-4 w-4" /> {file.name} <span className="text-muted-foreground">({(file.size / 1024).toFixed(0)} KB)</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={submit} disabled={submitting || !file} className="bg-gradient-brand">
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
            <Button variant="ghost" onClick={() => { setSelectedClass(null); setFile(null); }}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
