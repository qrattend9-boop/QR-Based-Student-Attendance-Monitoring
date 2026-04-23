// Sign in / sign up page. Uses Lovable Cloud auth (email + password).
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { QrCode } from "lucide-react";
import { z } from "zod";

const signInSchema = z.object({
  email: z.string().email("Invalid email").max(255),
  password: z.string().min(6, "Min 6 characters").max(72),
});
const signUpSchema = signInSchema.extend({
  fullName: z.string().trim().min(2, "Enter your full name").max(100),
});

export default function Auth() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard", { replace: true });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const parsed = signUpSchema.safeParse({ email, password, fullName });
        if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: parsed.data.fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created! You're signed in.");
        navigate("/dashboard", { replace: true });
      } else {
        const parsed = signInSchema.safeParse({ email, password });
        if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
        const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
        if (error) throw error;
        navigate("/dashboard", { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-4 bg-gradient-soft">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg justify-center mb-8">
          <div className="h-8 w-8 rounded-lg bg-gradient-brand grid place-items-center text-brand-foreground">
            <QrCode className="h-4 w-4" />
          </div>
          QRoll
        </Link>
        <div className="rounded-2xl border bg-card p-8 shadow-card">
          <h1 className="font-display text-2xl font-bold">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signup" ? "You'll start as a Student. Admins can promote to Teacher." : "Sign in to continue."}
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Alex Santos" required />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full bg-gradient-brand" disabled={loading}>
              {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground mt-6 text-center">
            {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
            <button
              className="text-brand font-medium hover:underline"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            >
              {mode === "signup" ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
