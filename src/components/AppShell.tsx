// Shared shell: top nav + sidebar + content area for authenticated pages.
import { useState, useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, QrCode, LayoutDashboard, Users, BookOpen, ScanLine, BarChart3, UserCircle, Camera, GraduationCap, UserCog, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AppShell() {
  const { role, user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Automatically close the side panel when the user clicks a link and navigates
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  const navItems = (() => {
    if (role === "admin") {
      return [
        { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
        { to: "/admin/users", label: "Users", icon: Users },
        { to: "/admin/courses", label: "Courses", icon: GraduationCap },
        { to: "/admin/assignments", label: "Assignments", icon: UserCog },
        { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      ];
    }
    if (role === "teacher") {
      return [
        { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
        { to: "/teacher/classes", label: "Classes", icon: BookOpen },
        { to: "/teacher/scan", label: "Scan", icon: ScanLine },
      ];
    }
    return [
      { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { to: "/student/profile", label: "My Profile", icon: UserCircle },
      { to: "/student/qr", label: "My QR", icon: QrCode },
      { to: "/student/join", label: "Join class", icon: GraduationCap },
      { to: "/student/scan", label: "Check in", icon: Camera },
    ];
  })();

  return (
    <div className="min-h-screen bg-gradient-soft">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 w-full">
        <div className="container px-4 md:px-6 flex items-center justify-between h-16 max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
            <Link to="/dashboard" className="flex items-center gap-2 font-display font-bold text-lg">
              <div className="h-8 w-8 rounded-lg bg-gradient-brand grid place-items-center text-brand-foreground">
                <QrCode className="h-4 w-4" />
              </div>
              <span>QRoll</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden lg:inline">
              {user?.email} · <span className="capitalize text-foreground font-medium">{role}</span>
            </span>
            <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate("/"); }} className="h-9">
              <LogOut className="h-4 w-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      <div className={cn(
        "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transition-all duration-300 md:hidden",
        isMobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )} onClick={() => setIsMobileOpen(false)}>
        <div 
          className={cn(
            "fixed inset-y-0 left-0 w-[280px] bg-card border-r p-6 shadow-2xl transition-transform duration-300 ease-in-out",
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2 font-display font-bold text-lg">
              <div className="h-8 w-8 rounded-lg bg-gradient-brand grid place-items-center text-brand-foreground">
                <QrCode className="h-4 w-4" />
              </div>
              <span>QRoll</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsMobileOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <nav className="flex flex-col gap-2">
            <NavLinks items={navItems} />
          </nav>
        </div>
      </div>

      <div className="container px-4 md:px-6 grid md:grid-cols-[240px_1fr] gap-8 py-6 max-w-screen-2xl mx-auto">
        <aside className="hidden md:block md:sticky md:top-24 h-[calc(100vh-120px)] overflow-y-auto">
          <nav className="flex flex-col gap-1 pr-4">
            <NavLinks items={navItems} />
          </nav>
        </aside>
        <main className="min-w-0 pb-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavLinks({ items }: { items: any[] }) {
  return (
    <>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-brand text-brand-foreground shadow-elegant"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )
          }
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </>
  );
}
