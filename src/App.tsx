import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import StudentProfile from "./pages/student/StudentProfile";
import StudentQR from "./pages/student/StudentQR";
import StudentScan from "./pages/student/StudentScan";
import StudentJoin from "./pages/student/StudentJoin";
import TeacherClasses from "./pages/teacher/TeacherClasses";
import TeacherClassDetail from "./pages/teacher/TeacherClassDetail";
import TeacherScan from "./pages/teacher/TeacherScan";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminCourses from "./pages/admin/AdminCourses";
import AdminAssignments from "./pages/admin/AdminAssignments";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" richColors closeButton />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />

            {/* Authenticated area */}
            <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />

              {/* Student */}
              <Route path="/student/profile" element={<StudentProfile />} />
              <Route path="/student/qr" element={<StudentQR />} />
              <Route path="/student/scan" element={<StudentScan />} />
              <Route path="/student/join" element={<StudentJoin />} />

              {/* Teacher */}
              <Route path="/teacher/classes" element={<ProtectedRoute roles={["teacher", "admin"]}><TeacherClasses /></ProtectedRoute>} />
              <Route path="/teacher/classes/:id" element={<ProtectedRoute roles={["teacher", "admin"]}><TeacherClassDetail /></ProtectedRoute>} />
              <Route path="/teacher/scan" element={<ProtectedRoute roles={["teacher", "admin"]}><TeacherScan /></ProtectedRoute>} />

              {/* Admin */}
              <Route path="/admin/users" element={<ProtectedRoute roles={["admin"]}><AdminUsers /></ProtectedRoute>} />
              <Route path="/admin/courses" element={<ProtectedRoute roles={["admin"]}><AdminCourses /></ProtectedRoute>} />
              <Route path="/admin/assignments" element={<ProtectedRoute roles={["admin"]}><AdminAssignments /></ProtectedRoute>} />
              <Route path="/admin/analytics" element={<ProtectedRoute roles={["admin"]}><AdminAnalytics /></ProtectedRoute>} />
            </Route>

            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
