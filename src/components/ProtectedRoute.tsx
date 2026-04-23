// Route guard: requires auth, optionally requires a specific role.
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, AppRole } from "@/lib/auth";

interface Props {
  children: JSX.Element;
  roles?: AppRole[];
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;
  if (roles && role && !roles.includes(role)) return <Navigate to="/dashboard" replace />;
  return children;
}
