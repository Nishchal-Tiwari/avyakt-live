import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getSafeRedirectPath } from "@/lib/redirect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ModeToggle } from "@/components/mode-toggle";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"TEACHER" | "STUDENT">("STUDENT");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const afterAuthPath = getSafeRedirectPath(redirectParam) ?? "/dashboard";
  const loginHref = redirectParam
    ? `/login?redirect=${encodeURIComponent(redirectParam)}`
    : "/login";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register(email, password, name || undefined, role);
      navigate(afterAuthPath, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-background to-primary/[0.07] dark:to-primary/15">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.18),transparent)]" />
      <div className="absolute right-4 top-4 z-10 flex gap-2">
        <ModeToggle />
      </div>
      <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20">
              <Sparkles className="h-7 w-7" aria-hidden />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Live Meditation</h1>
            <p className="mt-2 text-muted-foreground">Create your account</p>
          </div>

          <Card className="border-border/80 shadow-lg shadow-primary/5">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl">Get started</CardTitle>
              <CardDescription>Teachers create classes; students join invited sessions</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name (optional)</Label>
                  <Input
                    id="name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Display name"
                  />
                </div>
                <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                  <Label>I am a</Label>
                  <RadioGroup
                    value={role}
                    onValueChange={(v) => setRole(v as "TEACHER" | "STUDENT")}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    <label
                      htmlFor="role-student"
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                        role === "STUDENT" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <RadioGroupItem value="STUDENT" id="role-student" />
                      <span className="text-sm font-medium">Student</span>
                    </label>
                    <label
                      htmlFor="role-teacher"
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                        role === "TEACHER" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <RadioGroupItem value="TEACHER" id="role-teacher" />
                      <span className="text-sm font-medium">Teacher</span>
                    </label>
                  </RadioGroup>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4 pt-2">
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Creating account…" : "Create account"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link to={loginHref} className="font-medium text-primary hover:underline">
                    Sign in
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
