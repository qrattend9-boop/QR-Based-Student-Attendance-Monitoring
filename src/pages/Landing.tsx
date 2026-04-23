// Marketing / landing page for unauthenticated visitors.
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { QrCode, ScanLine, BarChart3, ShieldCheck, Users, Upload } from "lucide-react";

const features = [
  { icon: QrCode, title: "Unique student QR", desc: "Each student gets a cryptographic QR token — not just a name." },
  { icon: ScanLine, title: "Fast scanning", desc: "Teachers scan with any camera. Present / Late is set automatically." },
  { icon: Upload, title: "CSV roster", desc: "Upload your class list once. Duplicates and invalid rows are filtered." },
  { icon: BarChart3, title: "Reports", desc: "Daily, weekly, monthly exports. Attendance % per student." },
  { icon: ShieldCheck, title: "Role-based access", desc: "Admin, teacher, student — secured with row-level policies." },
  { icon: Users, title: "Scales with you", desc: "Built on Postgres. From one class to an entire campus." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="container flex items-center justify-between h-16">
        <div className="flex items-center gap-2 font-display font-bold text-lg">
          <div className="h-8 w-8 rounded-lg bg-gradient-brand grid place-items-center text-brand-foreground">
            <QrCode className="h-4 w-4" />
          </div>
          QRoll
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
          <Button asChild><Link to="/auth?mode=signup">Get started</Link></Button>
        </div>
      </header>

      <section className="container pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          QR-based attendance, done right
        </div>
        <h1 className="font-display font-bold text-5xl md:text-7xl tracking-tight max-w-4xl mx-auto">
          Attendance that takes <span className="text-gradient">seconds</span>, not a class period.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          A clean, role-based system for admins, teachers, and students. Upload your roster, start a session,
          scan — the numbers do themselves.
        </p>
        <div className="mt-8 flex gap-3 justify-center flex-wrap">
          <Button asChild size="lg" className="bg-gradient-brand shadow-elegant">
            <Link to="/auth?mode=signup">Create free account</Link>
          </Button>
          <Button asChild size="lg" variant="outline"><Link to="/auth">I already have an account</Link></Button>
        </div>
      </section>

      <section className="container pb-24">
        <div className="grid md:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-6 shadow-card hover:shadow-elegant transition-shadow">
              <div className="h-10 w-10 rounded-lg bg-secondary grid place-items-center text-brand mb-4">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display font-semibold text-lg">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t">
        <div className="container py-6 text-sm text-muted-foreground flex justify-between flex-wrap gap-2">
          <span>© {new Date().getFullYear()} QRoll</span>
          <span>Built for schools that have better things to do than roll call.</span>
        </div>
      </footer>
    </div>
  );
}
