import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"TEACHER" | "STUDENT">("STUDENT");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register(email, password, name || undefined, role);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-stone-800 tracking-tight">Yoga Class</h1>
          <p className="text-stone-500 mt-1">Create your account</p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-lg shadow-stone-200/50 border border-stone-100 p-8"
        >
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-stone-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                required
                minLength={6}
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-stone-700 mb-1">
                Name (optional)
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                I am a
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="STUDENT"
                    checked={role === "STUDENT"}
                    onChange={() => setRole("STUDENT")}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-stone-700">Student</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="TEACHER"
                    checked={role === "TEACHER"}
                    onChange={() => setRole("TEACHER")}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-stone-700">Teacher</span>
                </label>
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 transition"
          >
            {submitting ? "Creating account..." : "Create account"}
          </button>
          <p className="mt-6 text-center text-sm text-stone-500">
            Already have an account?{" "}
            <Link to="/login" className="text-emerald-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
