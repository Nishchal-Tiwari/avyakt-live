import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getSafeRedirectPath } from "@/lib/redirect";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ModeToggle } from "@/components/mode-toggle";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const afterAuthPath = getSafeRedirectPath(redirectParam) ?? "/dashboard";
  const registerHref = redirectParam
    ? `/register?redirect=${encodeURIComponent(redirectParam)}`
    : "/register";

  useEffect(() => {
    let cancelled = false;
    api.pingBackend().then((ok) => {
      if (!cancelled) setBackendOk(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(afterAuthPath, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
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
            <p className="mt-2 text-muted-foreground">Sign in to join live sessions</p>
          </div>

          <Card className="border-border/80 shadow-lg shadow-primary/5">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl">Welcome back</CardTitle>
              <CardDescription>Enter your email and password to continue</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {backendOk === false && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Cannot reach the server API. From the project root run{" "}
                      <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run dev</code> so the
                      backend is listening on port 4000, or start it with{" "}
                      <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run dev --prefix backend</code>
                      .
                    </AlertDescription>
                  </Alert>
                )}
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {error}
                      {error.toLowerCase().includes("invalid") && (
                        <span className="mt-2 block text-xs opacity-90">
                          If you just set up the database, create demo users with{" "}
                          <code className="rounded bg-background/80 px-1 py-0.5">
                            {`cd backend && npx prisma db seed`}
                          </code>{" "}
                          then sign in as{" "}
                          <strong className="font-medium">teacher@yoga.demo</strong> /{" "}
                          <strong className="font-medium">demo123</strong>.
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                {backendOk === true && !error && (
                  <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    After{" "}
                    <code className="rounded bg-background px-1 py-0.5 text-[0.7rem]">
                      npx prisma db seed
                    </code>{" "}
                    in <code className="rounded bg-background px-1 py-0.5 text-[0.7rem]">backend/</code>,
                    use <strong className="text-foreground">teacher@yoga.demo</strong> /{" "}
                    <strong className="text-foreground">demo123</strong>.
                  </p>
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
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4 pt-2">
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Signing in…" : "Sign in"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Don&apos;t have an account?{" "}
                  <Link to={registerHref} className="font-medium text-primary hover:underline">
                    Register
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
