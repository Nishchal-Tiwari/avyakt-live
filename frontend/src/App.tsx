import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getSafeRedirectPath } from "@/lib/redirect";
import { Skeleton } from "@/components/ui/skeleton";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Meeting from "@/pages/Meeting";
import TeacherStudentAttendance from "@/pages/TeacherStudentAttendance";
import StudentMyAttendance from "@/pages/StudentMyAttendance";
import TeacherStreaks from "@/pages/TeacherStreaks";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background px-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }
  if (!user) {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(from)}`} replace />;
  }
  return <>{children}</>;
}

function StudentRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background px-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== "STUDENT") {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function TeacherRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background px-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== "TEACHER") {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background px-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }
  if (user) {
    const params = new URLSearchParams(location.search);
    const next = getSafeRedirectPath(params.get("redirect")) ?? "/dashboard";
    return <Navigate to={next} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestRoute>
            <Login />
          </GuestRoute>
        }
      />
      <Route
        path="/register"
        element={
          <GuestRoute>
            <Register />
          </GuestRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/attendance"
        element={
          <TeacherRoute>
            <TeacherStudentAttendance />
          </TeacherRoute>
        }
      />
      <Route
        path="/teacher/streaks"
        element={
          <TeacherRoute>
            <TeacherStreaks />
          </TeacherRoute>
        }
      />
      <Route
        path="/student/attendance"
        element={
          <StudentRoute>
            <StudentMyAttendance />
          </StudentRoute>
        }
      />
      <Route
        path="/meeting/:classId"
        element={
          <ProtectedRoute>
            <Meeting />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
