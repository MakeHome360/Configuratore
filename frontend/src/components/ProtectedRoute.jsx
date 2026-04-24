import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading || user === null) {
    return (
      <div className="h-screen flex items-center justify-center text-zinc-500 mono text-sm" data-testid="auth-loading">
        caricamento sessione…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
