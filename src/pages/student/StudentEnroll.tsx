import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BookPlus, Search, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

type EnrollableClass = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  created_at: string;
};

export default function StudentEnroll() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [classes, setClasses] = useState<EnrollableClass[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [actingClassId, setActingClassId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);

    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!student) {
      setStudentId(null);
      setClasses([]);
      setEnrolledIds(new Set());
      setLoading(false);
      return;
    }

    setStudentId(student.id);

    const [{ data: classRows, error: classError }, { data: myEnrollments }] = await Promise.all([
      supabase.rpc("list_classes_for_enrollment"),
      supabase.from("enrollments").select("class_id").eq("student_id", student.id),
    ]);

    if (classError) {
      toast.error(classError.message);
      setClasses([]);
    } else {
      setClasses((classRows ?? []) as EnrollableClass[]);
    }

    setEnrolledIds(new Set((myEnrollments ?? []).map((e) => e.class_id)));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const visibleClasses = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((c) =>
      [c.name, c.code ?? "", c.description ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [classes, query]);

  const enroll = async (classId: string) => {
    setActingClassId(classId);
    const { data, error } = await supabase.rpc("student_enroll_in_class", { _class_id: classId });
    if (error) {
      toast.error(error.message);
      setActingClassId(null);
      return;
    }
    setEnrolledIds((prev) => new Set(prev).add(classId));
    toast.success(data === "already_enrolled" ? "You are already enrolled in this class" : "Successfully enrolled");
    setActingClassId(null);
  };

  if (!studentId) {
    return (
      <div className="max-w-xl space-y-4 dashboard-page">
        <div className="dashboard-hero">
          <h1 className="font-display text-3xl font-bold">Enroll in class</h1>
          <p className="text-muted-foreground">Create your student profile first to join classes.</p>
        </div>
        <div className="dashboard-card p-6">
          <p className="text-sm text-muted-foreground mb-4">
            We need your student profile so we can link attendance records to your account.
          </p>
          <Button asChild>
            <Link to="/student/profile">Complete profile</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 dashboard-page">
      <div className="dashboard-hero">
        <h1 className="font-display text-3xl font-bold">Enroll in class</h1>
        <p className="text-muted-foreground">Join your subjects so session QR check-in works instantly.</p>
      </div>

      <div className="dashboard-card p-4">
        <div className="relative">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            placeholder="Search by class name or code..."
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading && (
          <div className="md:col-span-2 xl:col-span-3 dashboard-card p-6 text-sm text-muted-foreground">
            Loading classes...
          </div>
        )}

        {!loading && visibleClasses.map((c) => {
          const enrolled = enrolledIds.has(c.id);
          return (
            <div key={c.id} className="dashboard-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">{c.code || "Class"}</div>
                  <h3 className="font-display text-lg font-semibold">{c.name}</h3>
                </div>
                {enrolled && <CheckCircle2 className="h-5 w-5 text-success shrink-0" />}
              </div>
              {c.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{c.description}</p>}
              <div className="mt-4">
                {enrolled ? (
                  <Button variant="outline" className="w-full" disabled>
                    Enrolled
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => enroll(c.id)}
                    disabled={actingClassId === c.id}
                  >
                    <BookPlus className="h-4 w-4 mr-1" />
                    {actingClassId === c.id ? "Enrolling..." : "Enroll"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {!loading && visibleClasses.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3 dashboard-card p-8 text-center">
            <h3 className="font-display font-semibold">No classes found</h3>
            <p className="text-sm text-muted-foreground mt-1">Try a different search keyword.</p>
          </div>
        )}
      </div>
    </div>
  );
}
