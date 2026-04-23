// Role-aware dashboard. Renders a different overview for admin/teacher/student.
import { useAuth } from "@/lib/auth";
import StudentOverview from "./student/StudentOverview";
import TeacherOverview from "./teacher/TeacherOverview";
import AdminOverview from "./admin/AdminOverview";

export default function Dashboard() {
  const { role } = useAuth();
  if (role === "admin") return <AdminOverview />;
  if (role === "teacher") return <TeacherOverview />;
  return <StudentOverview />;
}
